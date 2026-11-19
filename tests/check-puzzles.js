// Checks every puzzle in puzzles.js: required fields present, answer is a
// 32-bit value, and run() (the JS version of the C code) gives that answer.
// Run with:  node tests/check-puzzles.js
const PUZZLES = require("../puzzles.js");

const REQUIRED = ["topic", "title", "code", "answer", "run", "lesson"];
let failed = 0;

PUZZLES.forEach((p, i) => {
  const id = `#${i + 1} (${p.title || "untitled"})`;
  const missing = REQUIRED.filter((k) => p[k] === undefined);
  if (missing.length) {
    console.error(`FAIL ${id}: missing ${missing.join(", ")}`);
    failed++;
    return;
  }
  if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer > 0xffffffff) {
    console.error(`FAIL ${id}: answer must be a 32-bit unsigned value`);
    failed++;
    return;
  }
  const got = p.run() >>> 0;
  if (got !== p.answer) {
    const h = (n) => "0x" + n.toString(16).toUpperCase().padStart(8, "0");
    console.error(`FAIL ${id}: run() gives ${h(got)} but answer is ${h(p.answer)}`);
    failed++;
    return;
  }
  console.log(`ok   ${id}`);
});

console.log(`\n${PUZZLES.length - failed}/${PUZZLES.length} puzzles OK`);
process.exit(failed ? 1 : 0);
