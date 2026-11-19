/* Bitle puzzle bank
 *
 * Each puzzle:
 *   topic   – short tag shown on the page
 *   title   – one-line description
 *   code    – the C snippet shown to the player (may contain <span class="cm">…</span> comments)
 *   answer  – expected final value of REG (32-bit)
 *   run()   – the same code written in JavaScript; tests check run() === answer
 *   lesson  – HTML explanation shown after the game
 *
 * Puzzle #1 is shown on launch day; one new puzzle per day after that.
 * Add new puzzles at the END of the list so earlier days don't change.
 */
const PUZZLES = [
{ topic:"Bit masks", title:"Set one bit, clear a nibble",
  code:`uint32_t REG = 0x12345678;

REG |=  (1u << 31);
REG &= ~(0xFu << 4);`,
  answer: 0x92345608,
  run(){ let r=0x12345678; r=(r|(1<<31))>>>0; r=(r&~(0xF<<4))>>>0; return r; },
  lesson:`<h4>What happened</h4><ol><li><code>1u &lt;&lt; 31</code> is <code>0x80000000</code>. OR-ing it sets bit 31: <code>0x12…</code> becomes <code>0x92…</code>.</li><li><code>0xFu &lt;&lt; 4</code> is <code>0x000000F0</code>. <code>~</code> flips it to <code>0xFFFFFF0F</code>, and AND-ing with that clears bits 4–7. The <code>7</code> becomes <code>0</code>.</li></ol>
  <h4>Takeaway</h4><p><code>|=</code> sets bits, <code>&amp;= ~mask</code> clears them, and every other bit stays as it was. This read-modify-write pattern is how you touch one setting in a peripheral register without wrecking the others.</p>`},

{ topic:"XOR", title:"Toggle the upper half",
  code:`uint32_t REG = 0x00FF00FF;

REG ^= 0xFFFF0000;`,
  answer: 0xFF0000FF,
  run(){ return (0x00FF00FF ^ 0xFFFF0000)>>>0; },
  lesson:`<h4>What happened</h4><p>XOR with 1 flips a bit, and XOR with 0 leaves it alone. The upper 16 bits <code>0x00FF</code> flip to <code>0xFF00</code>. The lower half has nothing to XOR with, so it stays <code>0x00FF</code>.</p>
  <h4>Takeaway</h4><p><code>^=</code> is the toggle you use for blinking an LED. Many MCUs also have dedicated toggle or set/reset registers (for example <code>GPIOx-&gt;BSRR</code> on STM32), so the hardware does the change in one atomic write and no ISR can interrupt a read-modify-write halfway.</p>`},

{ topic:"GPIO", title:"Configure pin 5 as output (STM32-style MODER)",
  code:`<span class="cm">// MODER: 2 bits per pin. 00=input 01=output</span>
uint32_t REG = 0xABCD0000;
uint32_t pin = 5;

REG &= ~(3u << (pin * 2));
REG |=  (1u << (pin * 2));`,
  answer: 0xABCD0400,
  run(){ let r=0xABCD0000; r=(r&~(3<<10))>>>0; r=(r|(1<<10))>>>0; return r; },
  lesson:`<h4>What happened</h4><ol><li>Pin 5's field covers bits 10–11. <code>3u &lt;&lt; 10</code> = <code>0x00000C00</code>. Clearing it changes nothing here because those bits were already 0.</li><li><code>1u &lt;&lt; 10</code> = <code>0x00000400</code> writes <code>01</code> (output) into the field.</li></ol>
  <h4>Takeaway</h4><p>For a field that's several bits wide, always <b>clear first, then set</b>. If you only OR, a field that was <code>10</code> ends up as <code>11</code> (analog mode on STM32), not output.</p>`},

{ topic:"Endianness", title:"Swap the bytes",
  code:`uint32_t x = 0x11223344;

uint32_t REG = (x >> 24)
             | ((x >>  8) & 0x0000FF00)
             | ((x <<  8) & 0x00FF0000)
             | (x << 24);`,
  answer: 0x44332211,
  run(){ const x=0x11223344; return ((x>>>24)|((x>>>8)&0xFF00)|((x<<8)&0xFF0000)|(x<<24))>>>0; },
  lesson:`<h4>What happened</h4><p>Each byte moves to the mirrored position: <code>11 22 33 44</code> becomes <code>44 33 22 11</code>.</p>
  <h4>Takeaway</h4><p>Networks and many sensors send data big-endian, while Cortex-M is little-endian. On ARM this whole expression compiles to one <code>REV</code> instruction (<code>__REV()</code> in CMSIS, <code>__builtin_bswap32()</code> in GCC).</p>`},

{ topic:"Sign extension", title:"Casting a negative byte",
  code:`int8_t s = -2;

uint32_t REG = (uint32_t)s;`,
  answer: 0xFFFFFFFE,
  run(){ return (-2)>>>0; },
  lesson:`<h4>What happened</h4><p><code>-2</code> as an <code>int8_t</code> is <code>0xFE</code>. When it's widened to 32 bits, the sign bit is copied into all the new upper bits, giving <code>0xFFFFFFFE</code>, not <code>0x000000FE</code>.</p>
  <h4>Takeaway</h4><p>This is a classic bug when parsing sensor bytes. If you want the raw byte, cast through <code>uint8_t</code> first: <code>(uint32_t)(uint8_t)s</code> gives <code>0x000000FE</code>.</p>`},

{ topic:"Integer promotion", title:"Inverting a uint8_t",
  code:`uint8_t a = 0xF0;

uint32_t REG = ~a;`,
  answer: 0xFFFFFF0F,
  run(){ return (~0xF0)>>>0; },
  lesson:`<h4>What happened</h4><p>Before <code>~</code> runs, <code>a</code> is promoted to a 32-bit <code>int</code>: <code>0x000000F0</code>. Inverting that gives <code>0xFFFFFF0F</code>, not <code>0x0F</code>.</p>
  <h4>Takeaway</h4><p>Integer promotion catches people out in code like <code>if (~a == 0x0F)</code>, which is never true. Mask or cast back: <code>(uint8_t)~a</code>. MISRA C rule 10.x exists largely because of this.</p>`},

{ topic:"Timers", title:"Tick math across a wrap-around",
  code:`<span class="cm">// 32-bit free-running tick counter</span>
uint32_t start = 0xFFFFFFF0;
uint32_t now   = 0x00000010;

uint32_t REG = now - start;`,
  answer: 0x00000020,
  run(){ return (0x10 - 0xFFFFFFF0)>>>0; },
  lesson:`<h4>What happened</h4><p>Unsigned subtraction wraps modulo 2³². The counter overflowed between the two reads, but <code>now - start</code> still gives the true elapsed time: 16 ticks to reach the wrap plus 16 after it = <code>0x20</code>.</p>
  <h4>Takeaway</h4><p>Always write timeouts as <code>(now - start) &gt;= timeout</code>, never <code>now &gt;= start + timeout</code>. The first survives counter overflow; the second breaks once every 49.7 days at 1 kHz.</p>`},

{ topic:"Bit fields", title:"Extract a 6-bit field",
  code:`uint32_t REG = 0xDEADBEEF;

REG = (REG >> 12) & 0x3F;`,
  answer: 0x0000001B,
  run(){ return ((0xDEADBEEF>>>12)&0x3F)>>>0; },
  lesson:`<h4>What happened</h4><p>Shifting right by 12 drops the lowest three hex digits and leaves <code>0x000DEADB</code>. The mask <code>0x3F</code> keeps the lowest 6 bits. <code>0xDB</code> = <code>1101 1011</code>, and the last six bits <code>01 1011</code> = <code>0x1B</code>.</p>
  <h4>Takeaway</h4><p>Reading a field is <b>shift, then mask</b>: <code>(reg &gt;&gt; POS) &amp; ((1u &lt;&lt; WIDTH) - 1)</code>. CMSIS headers give you <code>_Pos</code> and <code>_Msk</code> macros so you don't hard-code the numbers.</p>`},

{ topic:"Bit tricks", title:"Clear the lowest set bit",
  code:`uint32_t REG = 0x00006800;

REG &= REG - 1;`,
  answer: 0x00006000,
  run(){ const r=0x6800; return (r&(r-1))>>>0; },
  lesson:`<h4>What happened</h4><p><code>0x6800 - 1</code> = <code>0x67FF</code>. Subtracting 1 flips the lowest set bit and every 0 below it. AND-ing with the original wipes out exactly that one bit, leaving <code>0x6000</code>.</p>
  <h4>Takeaway</h4><p><code>x &amp; (x - 1)</code> is used to count set bits fast (loop until 0) and to check for a power of two: <code>x &amp;&amp; !(x &amp; (x - 1))</code>. That's handy for asserting a ring buffer size.</p>`},

{ topic:"Timers", title:"1 kHz from a 72 MHz clock",
  code:`uint32_t f_clk = 72000000;  <span class="cm">// Hz</span>
uint32_t PSC   = 71;
uint32_t f_out = 1000;      <span class="cm">// Hz</span>

uint32_t REG = f_clk / (PSC + 1) / f_out - 1;  <span class="cm">// ARR</span>`,
  answer: 0x000003E7,
  run(){ return (72000000/72/1000 - 1)>>>0; },
  lesson:`<h4>What happened</h4><p>The prescaler divides by <code>PSC + 1</code>: 72 MHz / 72 = 1 MHz timer clock. To overflow at 1 kHz you need 1000 counts, and because the counter starts at 0, ARR = 999 = <code>0x3E7</code>.</p>
  <h4>Takeaway</h4><p>The update rate is <code>f_clk / ((PSC + 1) × (ARR + 1))</code>. Forgetting either <code>+1</code> is the most common timer off-by-one, and the symptom is a PWM or tick that's 0.1% off.</p>`},

{ topic:"CAN", title:"Load a standard ID into a TX mailbox (bxCAN TIR)",
  code:`<span class="cm">// TIR: STID[10:0] at bits 31..21, TXRQ at bit 0</span>
uint32_t id = 0x123;

uint32_t REG = (id << 21) | (1u << 0);`,
  answer: 0x24600001,
  run(){ return ((0x123<<21)|1)>>>0; },
  lesson:`<h4>What happened</h4><p>The 11-bit ID moves to the top of the register: <code>0x123 &lt;&lt; 21</code> = <code>0x24600000</code>. Setting TXRQ (bit 0) asks the hardware to send the frame, giving <code>0x24600001</code>.</p>
  <h4>Takeaway</h4><p>Fill the data and DLC registers first and write TXRQ last. As soon as that bit is set the controller may start arbitration with whatever is in the mailbox.</p>`},

{ topic:"Memory layout", title:"How big is this struct?",
  code:`typedef struct {
    uint8_t  a;
    uint32_t b;
    uint16_t c;
} pkt_t;

uint32_t REG = sizeof(pkt_t);`,
  answer: 0x0000000C,
  run(){ return 12; },
  lesson:`<h4>What happened</h4><p><code>a</code> takes 1 byte, then 3 bytes of padding so <code>b</code> starts on a 4-byte boundary. <code>b</code> takes 4 bytes, <code>c</code> takes 2, and 2 more bytes of padding at the end keep the struct a multiple of 4. That's 12 bytes, not 7.</p>
  <h4>Takeaway</h4><p>Order members from largest to smallest (<code>b, c, a</code> gives 8 bytes). Never <code>memcpy</code> a struct straight onto a wire protocol; serialise each field instead, or use <code>__attribute__((packed))</code> and accept the slower unaligned access.</p>`},

{ topic:"Ring buffers", title:"Wrap the head index",
  code:`#define SIZE 16u   <span class="cm">// power of two</span>
uint32_t head = 14;

head = (head + 5) & (SIZE - 1);
uint32_t REG = head;`,
  answer: 0x00000003,
  run(){ return ((14+5)&15)>>>0; },
  lesson:`<h4>What happened</h4><p>14 + 5 = 19. AND-ing with <code>SIZE - 1</code> = <code>0xF</code> keeps 19 mod 16, which is 3.</p>
  <h4>Takeaway</h4><p>With a power-of-two size, <code>&amp; (SIZE - 1)</code> replaces <code>%</code>. That matters on cores without a hardware divider (Cortex-M0) and inside ISRs where every cycle counts.</p>`},

{ topic:"Bit tricks", title:"Rotate left by 4",
  code:`uint32_t x = 0x80000001;

uint32_t REG = (x << 4) | (x >> 28);`,
  answer: 0x00000018,
  run(){ const x=0x80000001; return ((x<<4)|(x>>>28))>>>0; },
  lesson:`<h4>What happened</h4><p><code>x &lt;&lt; 4</code> pushes the top bit out and gives <code>0x00000010</code>. <code>x &gt;&gt; 28</code> brings the top nibble <code>8</code> down to the bottom. OR them together: <code>0x00000018</code>.</p>
  <h4>Takeaway</h4><p>C has no rotate operator, but compilers recognise this pattern and emit one <code>ROR</code> instruction on ARM. Rotates show up in CRCs, hashes and LFSR-based PRNGs.</p>`},

{ topic:"Bit tricks", title:"Isolate the lowest set bit",
  code:`uint32_t x = 0x00B40000;

uint32_t REG = x & (~x + 1);`,
  answer: 0x00040000,
  run(){ const x=0x00B40000; return (x & ((~x+1)>>>0))>>>0; },
  lesson:`<h4>What happened</h4><p><code>~x + 1</code> is two's-complement negation (<code>-x</code>). It keeps the lowest set bit and flips everything above it, so the AND leaves only that bit. <code>0xB4</code> = <code>1011 0100</code>, and its lowest set bit is the <code>0x04</code>, giving <code>0x00040000</code>.</p>
  <h4>Takeaway</h4><p>This is how a scheduler or interrupt dispatcher picks the next pending flag. On ARM, <code>__CLZ(__RBIT(x))</code> gives you its bit <i>position</i> in two instructions.</p>`},
];

if (typeof module !== "undefined") module.exports = PUZZLES;
