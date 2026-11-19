# Contributing a puzzle

Thanks for helping! A good Bitle puzzle:

- fits in **3–8 lines** of C and can be solved in your head or on paper in 1–3 minutes
- ends with a single 32-bit value in `REG`
- teaches **one** real embedded idea, ideally one that has caused a real bug
- has one correct answer on a 32-bit Cortex-M (say so in a comment if the puzzle assumes something else)

## Steps

1. Fork the repo and open `puzzles.js`.
2. Add your puzzle at the **end** of the `PUZZLES` array. Never reorder existing ones, because that would change past days' puzzles.
3. Fill in every field:

```js
{ topic:"Bit masks", title:"Set one bit, clear a nibble",
  code:`uint32_t REG = 0x12345678;

REG |=  (1u << 31);
REG &= ~(0xFu << 4);`,
  answer: 0x92345608,
  run(){ let r=0x12345678; r=(r|(1<<31))>>>0; r=(r&~(0xF<<4))>>>0; return r; },
  lesson:`<h4>What happened</h4><p>…step by step…</p>
  <h4>Takeaway</h4><p>…the one thing to remember…</p>`},
```

- `run()` is the same logic written in JavaScript. Use `>>> 0` to keep values unsigned 32-bit and `>>>` for logical right shifts.
- If something can't be computed in JS (like `sizeof`), `run()` can simply `return` the value. In that case explain the reasoning carefully in `lesson`.

4. Check it:

```bash
node tests/check-puzzles.js
```

5. Open a pull request. The same check runs automatically on GitHub.
