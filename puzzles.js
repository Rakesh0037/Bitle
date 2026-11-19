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

/* ===== Batch 2: C, memory mapping and FreeRTOS (puzzles #16–#33) ===== */

{ topic:"Pointers", title:"Pointer arithmetic scales by type",
  code:`uint32_t *p = (uint32_t *)0x20000000;

p += 3;
uint32_t REG = (uint32_t)p;`,
  answer: 0x2000000C,
  run(){ return (0x20000000 + 3*4)>>>0; },
  lesson:`<h4>What happened</h4><p><code>p += 3</code> moves the pointer by 3 <i>elements</i>, not 3 bytes. Each <code>uint32_t</code> is 4 bytes, so the address moves by 12 = <code>0xC</code>.</p>
  <h4>Takeaway</h4><p>Pointer arithmetic always scales by <code>sizeof(*p)</code>. If you need a byte offset (e.g. a register at +0x14 from a base), cast to <code>uint8_t *</code> first, or use a struct that maps the registers.</p>`},

{ topic:"FreeRTOS", title:"pdMS_TO_TICKS at 100 Hz",
  code:`#define configTICK_RATE_HZ  100
#define pdMS_TO_TICKS(ms) \\
  ((TickType_t)(((TickType_t)(ms) * configTICK_RATE_HZ) / 1000U))

uint32_t REG = pdMS_TO_TICKS(25) + pdMS_TO_TICKS(5);`,
  answer: 0x00000002,
  run(){ return (Math.floor(25*100/1000) + Math.floor(5*100/1000))>>>0; },
  lesson:`<h4>What happened</h4><p>At 100 Hz one tick is 10 ms. 25 × 100 / 1000 = 2.5, which integer division truncates to <b>2</b>. 5 × 100 / 1000 = 0.5, which truncates to <b>0</b>. Total: 2.</p>
  <h4>Takeaway</h4><p><code>pdMS_TO_TICKS</code> rounds <b>down</b>. <code>vTaskDelay(pdMS_TO_TICKS(5))</code> at 100 Hz is <code>vTaskDelay(0)</code>, which just yields and doesn't wait at all. Delays shorter than one tick need a faster tick or a hardware timer.</p>`},

{ topic:"Unions", title:"Writing bytes, reading the word",
  code:`union {
    uint32_t w;
    uint8_t  b[4];
} u;

u.w    = 0;
u.b[1] = 0xAB;
u.b[3] = 0xCD;
uint32_t REG = u.w;`,
  answer: 0xCD00AB00,
  run(){ return ((0xAB<<8)|(0xCD<<24))>>>0; },
  lesson:`<h4>What happened</h4><p>Cortex-M is little-endian, so <code>b[0]</code> is the <b>least</b> significant byte. <code>b[1]</code> lands in bits 8–15 and <code>b[3]</code> in bits 24–31, giving <code>0xCD00AB00</code>.</p>
  <h4>Takeaway</h4><p>Unions are a common way to build CAN or UART frames, but the result depends on the CPU's endianness. Code that needs to be portable should build words with shifts: <code>(b3 &lt;&lt; 24) | (b1 &lt;&lt; 8)</code>.</p>`},

{ topic:"Memory map", title:"Where is GPIOA->ODR? (STM32F4)",
  code:`typedef struct {
    volatile uint32_t MODER;    <span class="cm">// +0x00</span>
    volatile uint32_t OTYPER;
    volatile uint32_t OSPEEDR;
    volatile uint32_t PUPDR;
    volatile uint32_t IDR;
    volatile uint32_t ODR;
} GPIO_TypeDef;

#define GPIOA ((GPIO_TypeDef *)0x40020000)

uint32_t REG = (uint32_t)&GPIOA->ODR;`,
  answer: 0x40020014,
  run(){ return (0x40020000 + 5*4)>>>0; },
  lesson:`<h4>What happened</h4><p>Each member is a 4-byte register, so ODR is the 6th one at offset 5 × 4 = <code>0x14</code>. That makes its address <code>0x40020014</code>, which matches the reference manual.</p>
  <h4>Takeaway</h4><p>This is exactly how CMSIS device headers work: a struct describes the register layout, and a cast turns the base address into a pointer to it. The <code>volatile</code> makes sure every access really goes to the hardware.</p>`},

{ topic:"FreeRTOS", title:"How many bytes of stack?",
  code:`<span class="cm">// Cortex-M: StackType_t is uint32_t</span>
xTaskCreate(vSensorTask, "sensor",
            256,          <span class="cm">// usStackDepth</span>
            NULL, 2, NULL);

uint32_t REG = <span class="cm">/* stack size in BYTES */</span>;`,
  answer: 0x00000400,
  run(){ return (256*4)>>>0; },
  lesson:`<h4>What happened</h4><p>The stack depth in <code>xTaskCreate</code> is counted in <b>words</b> of <code>StackType_t</code>, not bytes. On Cortex-M a word is 4 bytes, so 256 × 4 = 1024 = <code>0x400</code>.</p>
  <h4>Takeaway</h4><p>Passing a byte count here makes the stack 4× bigger than intended, and that's a common reason the heap runs out. Use <code>uxTaskGetStackHighWaterMark()</code> during testing to size stacks from real usage.</p>`},

{ topic:"Signed math", title:"Shifting a negative number",
  code:`<span class="cm">// GCC / Clang on Cortex-M</span>
int32_t x = -16;

uint32_t REG = (uint32_t)(x >> 2);`,
  answer: 0xFFFFFFFC,
  run(){ return ((-16)>>2)>>>0; },
  lesson:`<h4>What happened</h4><p>GCC uses an <b>arithmetic</b> right shift for signed values (the ARM <code>ASR</code> instruction), so the sign bit is copied in from the left. −16 &gt;&gt; 2 = −4 = <code>0xFFFFFFFC</code>.</p>
  <h4>Takeaway</h4><p>In C, right-shifting a negative signed value is <i>implementation-defined</i>. Every common compiler does it arithmetically, but MISRA forbids relying on it. For bit manipulation, use unsigned types; to divide signed values, write <code>/ 4</code>. Note that <code>/</code> rounds toward zero, while <code>&gt;&gt;</code> rounds toward −∞.</p>`},

{ topic:"Memory map", title:"Bit-band alias of GPIOA->ODR bit 5",
  code:`<span class="cm">// Cortex-M3/M4 peripheral bit-band:
// alias = 0x42000000 + (addr - 0x40000000)*32 + bit*4</span>
uint32_t addr = 0x40020014;   <span class="cm">// GPIOA->ODR</span>
uint32_t bit  = 5;

uint32_t REG = 0x42000000 + (addr - 0x40000000) * 32 + bit * 4;`,
  answer: 0x42400294,
  run(){ return (0x42000000 + (0x40020014-0x40000000)*32 + 5*4)>>>0; },
  lesson:`<h4>What happened</h4><p>The offset into the peripheral region is <code>0x20014</code>. Multiplied by 32 that's <code>0x400280</code>. Bit 5 adds 5 × 4 = <code>0x14</code>, giving <code>0x400294</code>. Adding the alias base gives <code>0x42400294</code>.</p>
  <h4>Takeaway</h4><p>Writing 1 or 0 to that alias word sets or clears just that one bit, atomically and without a read-modify-write. Bit-banding exists only on Cortex-M3/M4. The M0, M7 and M33 don't have it, so code that relies on it won't port to those cores.</p>`},

{ topic:"FreeRTOS", title:"Event group after a wait with clear-on-exit",
  code:`<span class="cm">// group starts at 0</span>
xEventGroupSetBits  (eg, 0x13);
xEventGroupClearBits(eg, 0x02);
xEventGroupSetBits  (eg, 0x40);

xEventGroupWaitBits(eg, 0x11,
        pdTRUE,   <span class="cm">// clear on exit</span>
        pdTRUE,   <span class="cm">// wait for all</span>
        0);

uint32_t REG = xEventGroupGetBits(eg);`,
  answer: 0x00000040,
  run(){ let g=0; g|=0x13; g&=~0x02; g|=0x40; if((g&0x11)===0x11) g&=~0x11; return g>>>0; },
  lesson:`<h4>What happened</h4><ol><li>Set <code>0x13</code> → 0x13. Clear <code>0x02</code> → 0x11. Set <code>0x40</code> → 0x51.</li><li>The wait needs bits <code>0x11</code>, and both are set, so it returns immediately with 0x51. Clear-on-exit then clears only the bits it waited for (0x11), leaving <code>0x40</code>.</li></ol>
  <h4>Takeaway</h4><p><code>xEventGroupWaitBits()</code> returns the bits as they were <b>before</b> the clear, and it clears only the bits you asked for. Other bits stay set for other tasks.</p>`},

{ topic:"Endianness", title:"Looking at a word through a byte pointer",
  code:`uint32_t v = 0x11223344;
uint8_t *b = (uint8_t *)&v;

uint32_t REG = b[0];`,
  answer: 0x00000044,
  run(){ return 0x44; },
  lesson:`<h4>What happened</h4><p>On a little-endian CPU, the byte at the lowest address is the least significant one, <code>0x44</code>. In memory the word is stored as <code>44 33 22 11</code>.</p>
  <h4>Takeaway</h4><p>This is how you check endianness at runtime. It's also why a <code>memcpy</code> of an <code>int</code> into a network buffer sends the bytes "backwards" compared with what a big-endian protocol expects.</p>`},

{ topic:"Structs", title:"Address of a member in an array of structs",
  code:`typedef struct {
    uint16_t a;
    uint32_t b;
} item_t;

item_t *arr = (item_t *)0x20000000;

uint32_t REG = (uint32_t)&arr[2].b;`,
  answer: 0x20000014,
  run(){ return (0x20000000 + 2*8 + 4)>>>0; },
  lesson:`<h4>What happened</h4><p><code>a</code> takes 2 bytes, then 2 bytes of padding so <code>b</code> is 4-byte aligned. That makes <code>sizeof(item_t)</code> = 8, with <code>b</code> at offset 4. <code>arr[2]</code> starts at 2 × 8 = 0x10, and <code>.b</code> adds 4 → <code>0x20000014</code>.</p>
  <h4>Takeaway</h4><p>Use <code>offsetof(item_t, b)</code> and <code>sizeof(item_t)</code> instead of hand-calculating. Add <code>_Static_assert(sizeof(item_t) == 8, "layout")</code> when the layout must match hardware or a protocol.</p>`},

{ topic:"FreeRTOS", title:"configMAX_SYSCALL_INTERRUPT_PRIORITY on STM32",
  code:`#define __NVIC_PRIO_BITS  4
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY  5

#define configMAX_SYSCALL_INTERRUPT_PRIORITY \\
  (configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY << (8 - __NVIC_PRIO_BITS))

uint32_t REG = configMAX_SYSCALL_INTERRUPT_PRIORITY;`,
  answer: 0x00000050,
  run(){ return (5<<(8-4))>>>0; },
  lesson:`<h4>What happened</h4><p>The NVIC priority register is 8 bits wide, but STM32 implements only the top 4. Priority 5 must be shifted into those upper bits: 5 &lt;&lt; 4 = <code>0x50</code>.</p>
  <h4>Takeaway</h4><p>Any ISR that calls a <code>...FromISR()</code> API must have a priority <b>numerically ≥ 5</b>, which means lower urgency. On Cortex-M, priority 0 is the most urgent. Getting this wrong triggers the famous <code>configASSERT</code> in <code>vPortValidateInterruptPriority()</code>.</p>`},

{ topic:"Bit-fields", title:"Bit-field layout in a register union (GCC, ARM)",
  code:`union {
    struct {
        uint32_t en   : 1;
        uint32_t mode : 3;
        uint32_t div  : 4;
    } f;
    uint32_t w;
} r;

r.w      = 0;
r.f.en   = 1;
r.f.mode = 5;
r.f.div  = 0xA;
uint32_t REG = r.w;`,
  answer: 0x000000AB,
  run(){ return (1 | (5<<1) | (0xA<<4))>>>0; },
  lesson:`<h4>What happened</h4><p>GCC on little-endian ARM allocates bit-fields starting from bit 0. <code>en</code> is bit 0 = 1. <code>mode</code> is bits 1–3 = 5 → <code>0xA</code>. <code>div</code> is bits 4–7 = <code>0xA</code> → <code>0xA0</code>. Together: <code>0xAB</code>.</p>
  <h4>Takeaway</h4><p>Bit-field order, padding and access width are <i>implementation-defined</i>, so a different compiler or a big-endian target can lay them out differently. Vendor headers use <code>_Pos</code>/<code>_Msk</code> macros for exactly this reason.</p>`},

{ topic:"Startup code", title:"How many words does .bss zeroing clear?",
  code:`<span class="cm">// from the linker script</span>
uint32_t *start = (uint32_t *)0x20000130;   <span class="cm">// _sbss</span>
uint32_t *end   = (uint32_t *)0x20000400;   <span class="cm">// _ebss</span>

uint32_t REG = end - start;`,
  answer: 0x000000B4,
  run(){ return ((0x20000400-0x20000130)/4)>>>0; },
  lesson:`<h4>What happened</h4><p>Subtracting two pointers gives the number of <b>elements</b> between them, not bytes. The gap is 0x2D0 bytes, and 0x2D0 / 4 = <code>0xB4</code> (180 words).</p>
  <h4>Takeaway</h4><p>This is what the reset handler does before <code>main()</code>: copy <code>.data</code> from flash to RAM, then zero <code>.bss</code> word by word. Globals without an initialiser are zero only because of that loop.</p>`},

{ topic:"FreeRTOS", title:"Queue storage size",
  code:`typedef struct {
    uint8_t  id;
    uint32_t value;
} msg_t;

QueueHandle_t q = xQueueCreate(12, sizeof(msg_t));

uint32_t REG = <span class="cm">/* bytes of item storage */</span>;`,
  answer: 0x00000060,
  run(){ return (12*8)>>>0; },
  lesson:`<h4>What happened</h4><p><code>msg_t</code> looks like 5 bytes, but padding after <code>id</code> makes it 8. The queue stores 12 copies: 12 × 8 = 96 = <code>0x60</code> bytes, plus the queue's own control structure.</p>
  <h4>Takeaway</h4><p>FreeRTOS queues copy items <b>by value</b>, padding included. For large messages, send a pointer, or reorder members to cut padding. Check what's left with <code>xPortGetFreeHeapSize()</code>.</p>`},

{ topic:"Vector table", title:"Where is the USART1 handler entry? (STM32F4)",
  code:`<span class="cm">// Vector table at the start of flash.
// 16 system exceptions come first, then IRQs.</span>
uint32_t base = 0x08000000;
uint32_t irqn = 37;           <span class="cm">// USART1_IRQn</span>

uint32_t REG = base + (16 + irqn) * 4;`,
  answer: 0x080000D4,
  run(){ return (0x08000000 + (16+37)*4)>>>0; },
  lesson:`<h4>What happened</h4><p>Entry 0 is the initial stack pointer, entries 1–15 are the system exceptions (Reset, NMI, HardFault…), and IRQ 0 starts at entry 16. USART1 is entry 53, and 53 × 4 = 212 = <code>0xD4</code>.</p>
  <h4>Takeaway</h4><p>Each entry holds the handler address with bit 0 set (the Thumb bit). A handler at <code>0x08000400</code> is stored as <code>0x08000401</code>. Bootloaders move the table by writing the new base to <code>SCB-&gt;VTOR</code>.</p>`},

{ topic:"FreeRTOS", title:"Ready-priority bitmap",
  code:`<span class="cm">// configUSE_PORT_OPTIMISED_TASK_SELECTION = 1
// one bit per priority that has a ready task</span>
uint32_t uxTopReadyPriority = 0;

uxTopReadyPriority |=  (1u << 1);   <span class="cm">// task prio 1 ready</span>
uxTopReadyPriority |=  (1u << 3);   <span class="cm">// task prio 3 ready</span>
uxTopReadyPriority |=  (1u << 6);   <span class="cm">// task prio 6 ready</span>
uxTopReadyPriority &= ~(1u << 3);   <span class="cm">// prio 3 task blocks</span>

uint32_t REG = uxTopReadyPriority;`,
  answer: 0x00000042,
  run(){ let r=0; r|=1<<1; r|=1<<3; r|=1<<6; r&=~(1<<3); return r>>>0; },
  lesson:`<h4>What happened</h4><p>Bits 1, 3 and 6 are set (<code>0x4A</code>), then bit 3 is cleared, leaving bits 1 and 6: <code>0x42</code>.</p>
  <h4>Takeaway</h4><p>To pick the next task, the Cortex-M port computes <code>31 - __CLZ(uxTopReadyPriority)</code> = 31 − 25 = <b>6</b>. That's a single instruction, no matter how many priorities exist, and it's why this mode limits you to 32 priorities.</p>`},

{ topic:"FreeRTOS", title:"16-bit tick counter overflow",
  code:`<span class="cm">// configTICK_TYPE_WIDTH_IN_BITS = TICK_TYPE_WIDTH_16_BITS</span>
TickType_t xTickCount  = 0xFFF0;
TickType_t xTimeToWake = xTickCount + 0x20;

uint32_t REG = xTimeToWake;`,
  answer: 0x00000010,
  run(){ return ((0xFFF0+0x20)&0xFFFF)>>>0; },
  lesson:`<h4>What happened</h4><p><code>0xFFF0 + 0x20</code> = <code>0x10010</code>, but <code>TickType_t</code> is 16 bits, so it wraps to <code>0x0010</code>.</p>
  <h4>Takeaway</h4><p>The wake time is now "smaller" than the current tick. FreeRTOS spots this and puts the task on the <b>overflow</b> delayed list, which it swaps in when the counter wraps. With 16-bit ticks at 1 kHz that happens every 65.5 s, so the longest possible delay is about a minute.</p>`},

{ topic:"Cortex-M", title:"SP after exception entry",
  code:`<span class="cm">// Cortex-M4, no FPU context, STKALIGN = 1
// basic frame: R0-R3, R12, LR, PC, xPSR (8 words)</span>
uint32_t sp = 0x20001FFC;     <span class="cm">// SP just before the IRQ</span>

uint32_t REG = <span class="cm">/* SP inside the ISR */</span>;`,
  answer: 0x20001FD8,
  run(){ let f=0x20001FFC-0x20; if(f&7) f-=4; return f>>>0; },
  lesson:`<h4>What happened</h4><p>The hardware pushes 8 words = 32 bytes. <code>0x20001FFC − 0x20</code> = <code>0x20001FDC</code>, but the frame must start on an 8-byte boundary, so the core adds one padding word: <code>0x20001FD8</code>. It records this in bit 9 of the stacked xPSR so the return can undo it.</p>
  <h4>Takeaway</h4><p>AAPCS requires 8-byte stack alignment at function calls. If FPU registers are stacked too, the frame grows to 26 words. Remember this when you're decoding a HardFault stack dump by hand.</p>`},

];

if (typeof module !== "undefined") module.exports = PUZZLES;
