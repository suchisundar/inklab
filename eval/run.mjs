// Scores the practice coach (js/coach.js) against eval/gold.json.
// Usage: node eval/run.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = vm.createContext({ window: {} });
for (const f of ["js/data.js", "js/coach.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const { INKLAB_DATA: D, InkCoach: C } = ctx.window;
const gold = JSON.parse(fs.readFileSync(path.join(root, "eval/gold.json"), "utf8"));
const verbose = process.argv.includes("--verbose");

const levelIdx = (id) => D.LEVELS.findIndex((l) => l.id === id);

// Turn the compact history into journal entries, oldest first, one per day.
function attemptsFrom(history) {
  return history.map((h, i) => {
    const ex = C.byId[h.ex];
    const n = ex.checks.length;
    const ticked = Math.round(h.c * n);
    const date = new Date(Date.UTC(2026, 9, 1 + i)).toISOString();
    return { id: "a" + i, date, exerciseId: h.ex, minutes: 20, difficulty: h.d, checks: ex.checks.map((_, k) => k < ticked), problems: h.p || [] };
  });
}

// A problem logged 2+ times in the last 10 entries is "recurring".
function recurring(attempts) {
  const counts = {};
  attempts.slice(-10).forEach((a) => a.problems.forEach((p) => (counts[p] = (counts[p] || 0) + 1)));
  return Object.keys(counts).filter((p) => counts[p] >= 2);
}

const CRITERIA = {
  main: "Main exercise is one the gold label accepts",
  time: "Blocks add up to the time available, none shorter than 3 min",
  problem: "A recurring problem gets a block that targets it",
  level: "Nothing above the learner's level",
};

let pass = 0, total = 0, perfect = 0, heldPerfect = 0;
const byCrit = Object.fromEntries(Object.keys(CRITERIA).map((k) => [k, [0, 0]]));
const rows = [];

for (const s of gold.scenarios) {
  const attempts = attemptsFrom(s.history);
  const plan = C.generateSession(s.profile, attempts);
  const blocks = plan.blocks;
  const main = blocks.find((b) => b.role === "Main exercise");
  const exBlocks = blocks.filter((b) => b.exerciseId);
  const results = {};

  results.main = s.acceptMain.includes(main.exerciseId);
  const sum = blocks.reduce((t, b) => t + b.minutes, 0);
  results.time = sum === s.profile.minutes && blocks.every((b) => b.minutes >= 3);
  const rec = recurring(attempts);
  if (rec.length) results.problem = rec.every((p) => exBlocks.some((b) => b.exerciseId === C.problemById[p].drill));
  results.level = exBlocks.every((b) => Math.min(...C.byId[b.exerciseId].levels.map(levelIdx)) <= levelIdx(s.profile.level));

  let sp = 0, st = 0;
  for (const [k, v] of Object.entries(results)) {
    byCrit[k][1]++; st++;
    if (v) { byCrit[k][0]++; sp++; }
  }
  pass += sp; total += st;
  if (sp === st) perfect++;
  if (sp === st && s.heldOut) heldPerfect++;
  rows.push({ s, results, plan: blocks.map((b) => `${b.role}:${b.exerciseId || "-"}(${b.minutes})`).join(" → ") });
}

console.log(`\nPractice coach eval: ${gold.scenarios.length} scenarios\n`);
for (const { s, results, plan } of rows) {
  const fails = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${fails.length ? "✗" : "✓"} ${s.id} ${s.desc}${fails.length ? "  [failed: " + fails.join(", ") + "]" : ""}`);
  if (verbose || fails.length) console.log(`    ${plan}`);
}
console.log("\nBy criterion:");
for (const [k, [p, t]] of Object.entries(byCrit)) console.log(`  ${CRITERIA[k].padEnd(62)} ${p}/${t}`);
console.log(`\nScore: ${pass}/${total} checks passed (${Math.round((pass / total) * 100)}%), ${perfect}/${gold.scenarios.length} scenarios fully correct`);
const held = gold.scenarios.filter((s) => s.heldOut).length;
if (held) console.log(`Held-out (S19+, written before the v2 fixes): ${heldPerfect}/${held} fully correct`);
console.log("");
