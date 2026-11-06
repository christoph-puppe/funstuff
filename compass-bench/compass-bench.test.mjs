// compass-bench.test.mjs — behavioural test for compass-bench.html (run: node compass-bench.test.mjs)
//
// Extracts the DOM-free core block from the tool, evaluates it under node with a mocked fetch, and proves:
//   - the embedded items JSON is byte-identical to compass-bench-items.json; 182 unique items, 66 shared
//   - every scoring function reproduces its website: 8values, 6axes and SapplyValues against values computed
//     with the original quiz.html JavaScript on seeded random answer vectors; the Political Compass Test
//     against 12 website-scored trials published by the 2026 error-budget study
//   - cell keys are deterministic and distinct; page grouping follows the websites and asks each item once
//   - 0.2: option order per cell, majority over trials, the instability measure, response style, quadrants and the
//     crossed variance decomposition on synthetic data with known shares
//   - openrouterOnce sends the key as a Bearer header, no sampling params, no plugins, a timeout signal, and
//     surfaces status + upstream message; llm() retries transient errors only, within the cap, substitutes a
//     rejected response_format once, and honours state.cancel; runPool bounds concurrency and sweeps on cancel
// Exit 0 all passed, 1 failures, 2 the block or a fixture is missing.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = readFileSync(new URL("./compass-bench.html", import.meta.url), "utf-8");
const itemsFile = readFileSync(new URL("./compass-bench-items.json", import.meta.url), "utf-8").replace(/\n$/, "");
const m = html.match(/\/\/ ===== core \(DOM-free[^\n]*\n([\s\S]*?)\/\/ ===== end core =====/);
if (!m) { console.error("no core fence found"); process.exit(2); }
const emb = html.match(/<script id="items-data" type="application\/json">\n([\s\S]*?)\n<\/script>/);
if (!emb) { console.error("no embedded items block found"); process.exit(2); }

const log = [], calls = []; let queue = [];
const ctx = { console, performance, AbortSignal, Math, Map, Set, Promise, Array, Number, String, JSON, Error, TypeError, setTimeout, clearTimeout,
  state: { cancel: false, calls: 0, cost: 0 },
  l: Object.fromEntries(["info", "ok", "warn", "err", "debug"].map(k => [k, msg => log.push(`${k}: ${msg}`)])),
  fetch: async (url, init = {}) => { calls.push({ url, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {}, signal: init.signal });
    const r = queue.shift() ?? { ok: true, body: {} }; return { ok: r.ok, status: r.status ?? 200, json: async () => r.body }; } };
vm.createContext(ctx);
try { vm.runInContext(m[1], ctx, { filename: "compass-bench.html#core" }); } catch (e) { console.error(`core block does not evaluate: ${e.message}`); process.exit(2); }
for (const fn of ["apiError", "isTransient", "runPool", "extractJson", "openrouterOnce", "llm", "scoreInstrument", "normaliseAxes", "bootstrapCI", "cellKey", "buildGroups", "buildSinglePrompt", "buildPagePrompt", "singleSchema", "pageSchema", "estimateRun", "setInstruments", "scaleFor", "optionsFor",
  "orderFor", "orderedCodes", "majorityAnswers", "trialInstability", "responseStyle", "quadrantOf", "varianceDecomposition", "bootstrapShares", "toUnit",
  "setUi", "defaultPrompt", "usableInLang", "shiftDistance", "buildOpenPrompt", "buildExtractPrompt", "extractSchema", "sampleForCheck", "agreement", "stanceToAnswer",
  "scoreNineAxes", "drawNineAxes", "ideologyMatch", "validateImport"])
  if (typeof ctx[fn] !== "function") { console.error(`required function missing from core block: ${fn}`); process.exit(2); }

const DATA = JSON.parse(itemsFile);
ctx.setInstruments(DATA.instruments);
const ITEMS = DATA.items, BY_ID = new Map(ITEMS.map(it => [it.id, it]));
const instItems = k => DATA.instruments[k].items.map(id => BY_ID.get(id));
const FIX = {"note":"expected values computed with the original website JS; answers are multipliers as the sites use them","eightvalues":[{"answers":[1,-0.5,0.5,-0.5,0,0,-1,0.5,0,1,0,1,0,0.5,1,-1,-0.5,1,1,1,0,0,-0.5,-0.5,1,0,0.5,0,0.5,0,1,-1,0.5,-0.5,-1,0,-0.5,-0.5,-0.5,0.5,0.5,1,0.5,-1,0,0,1,0,-0.5,-1,0.5,-1,1,0,0,1,0,1,1,-1,-1,1,1,-1,-0.5,-0.5,0,0,1,0],"expected":{"econ":51.3,"dipl":52.8,"govt":57.4,"scty":47.9}},{"answers":[0.5,-0.5,1,-0.5,0.5,0.5,-1,-1,-1,0,-0.5,-1,0.5,1,0,0.5,0.5,-1,0.5,0,0.5,-0.5,0,0,-0.5,0,-0.5,-1,0.5,0.5,-1,1,1,-0.5,0.5,-1,1,0,0.5,-0.5,1,1,0.5,-0.5,-0.5,1,0,0,-0.5,0.5,0.5,0,0.5,1,0,0.5,0,1,1,-0.5,1,0,-1,-0.5,0,-0.5,0.5,1,-0.5,0],"expected":{"econ":51.3,"dipl":43.9,"govt":43,"scty":53.4}},{"answers":[-1,1,0.5,-1,-1,0,-0.5,0.5,0.5,-0.5,0,-0.5,0.5,0.5,-1,0.5,-1,1,0.5,1,0,0.5,0.5,-1,1,1,0,0,-0.5,-1,1,0.5,0.5,0.5,-0.5,-1,0.5,0.5,-1,-0.5,1,0.5,0.5,0,-0.5,-0.5,-1,0,1,1,-1,-1,1,0.5,0,-1,0,-1,-0.5,0.5,0.5,-0.5,1,-0.5,-0.5,-0.5,-1,0.5,-1,1],"expected":{"econ":41.7,"dipl":51.7,"govt":45.3,"scty":59.4}},{"answers":[0.5,-1,-0.5,-1,-0.5,-0.5,1,0,0,0.5,-1,-0.5,0.5,0,-1,1,1,1,0.5,0.5,1,0.5,0,-0.5,-1,0,-0.5,-1,0.5,1,-0.5,0,0.5,1,1,-0.5,1,-0.5,-1,1,-0.5,-0.5,0,-0.5,-1,0,0.5,0.5,-1,-0.5,-0.5,-0.5,1,-0.5,1,-0.5,-0.5,1,0.5,1,0.5,-1,0,-1,0,0,-0.5,0,1,1],"expected":{"econ":44.2,"dipl":43.3,"govt":41.8,"scty":44.8}},{"answers":[0,0,1,-1,1,-0.5,0,-0.5,0.5,0.5,-0.5,1,1,0,-1,1,-1,1,1,0,0.5,0,0.5,1,-0.5,-0.5,1,-1,-1,-1,-0.5,1,0.5,-1,-0.5,0.5,-1,0,0.5,-1,-1,-0.5,0.5,-0.5,-0.5,0.5,-1,-1,-1,0,0,-1,0,-0.5,-0.5,0.5,1,-1,1,0,0,0,-0.5,-1,0,1,0.5,-1,-0.5,0],"expected":{"econ":39.7,"dipl":59.4,"govt":63.7,"scty":61}},{"answers":[-1,0.5,0,1,-0.5,0,1,1,1,0.5,0.5,0,-1,0.5,0,-1,-1,1,-0.5,1,1,1,-1,0,-1,0,0,-1,-1,1,0,0,0,1,0,0.5,1,0,0,0.5,-0.5,0,0,0,0,-1,0.5,0,1,-1,0,-0.5,0.5,-0.5,1,-0.5,-0.5,-1,0.5,-1,0.5,-0.5,-0.5,0,-1,0.5,-0.5,0.5,0,1],"expected":{"econ":46.2,"dipl":51.1,"govt":52,"scty":52.1}}],"sixaxes":[{"answers":[0,1,-0.5,0.5,0,1,1,-1,-1,0.5,-1,0.5,1,1,0,-0.5,-0.5,0,0,1,-1,-1,0.5,-1,-1,-1,-0.5,-1,-1,-1,0.5,0,0.5,0.5,0.5,-1,0,0,0,-1,0,-1,-0.5,0,0.5,-1,-1,0.5,0,0.5,-0.5,1,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,1,-1,0,1,0,0,1,0,-0.5,0.5],"expected":{"econ_asp":27.1,"econ_control":45.7,"nationalism":49.5,"cosmopolitanism":54.2,"akraetia":55,"anarche":47.5}},{"answers":[0.5,-1,1,1,0,-0.5,-0.5,-1,1,0,0,-0.5,1,1,-1,1,1,0,0.5,-0.5,0,-1,-0.5,1,0.5,0,0.5,0,1,1,1,0,1,-0.5,-0.5,1,-0.5,1,-1,0,-1,-1,-1,0.5,-0.5,1,0.5,-1,0.5,-0.5,1,0.5,1,1,-0.5,0,0,0.5,-1,-1,0,0,-0.5,0.5,0.5,0.5,0,-0.5,-1,1],"expected":{"econ_asp":65.3,"econ_control":45.7,"nationalism":46.7,"cosmopolitanism":38.1,"akraetia":55.2,"anarche":53.6}},{"answers":[0.5,-1,1,1,-0.5,0,-1,1,-1,0.5,0,0,0.5,0.5,0.5,0.5,0.5,0,0,-1,0,-1,-1,-0.5,1,0,0,-0.5,0,1,-1,1,1,0,-0.5,1,-0.5,-1,0.5,0,0.5,0.5,0,-1,0,0,-0.5,0.5,-1,1,0,1,0.5,-1,-0.5,-1,1,0,0,0.5,-1,-1,-0.5,0,1,0.5,-1,-0.5,-0.5,1],"expected":{"econ_asp":54.2,"econ_control":62,"nationalism":47.9,"cosmopolitanism":36.3,"akraetia":50.3,"anarche":39}},{"answers":[0.5,-1,-0.5,0.5,0.5,0.5,-0.5,0,0.5,-1,0,0.5,-0.5,1,-1,-1,0.5,-0.5,-1,-0.5,0,0,1,1,-0.5,0.5,-1,0,0.5,-1,-1,-0.5,-0.5,1,0.5,0.5,-0.5,0.5,0.5,-1,0,1,1,1,-0.5,0.5,-1,1,1,-0.5,-0.5,-0.5,-0.5,-1,-0.5,-1,-0.5,0.5,0.5,1,0,0,-1,0.5,0.5,0,0.5,-1,0.5,-1],"expected":{"econ_asp":55.6,"econ_control":47.8,"nationalism":52.4,"cosmopolitanism":41.1,"akraetia":51.3,"anarche":54.1}},{"answers":[-1,-0.5,1,1,1,1,-1,0,-0.5,1,0.5,-1,1,0,-1,0.5,0.5,0,-1,-1,1,0,0,1,1,-0.5,-0.5,0.5,-1,-1,0.5,-1,-0.5,-1,-1,-0.5,-0.5,1,0.5,1,-1,0,-1,-1,-0.5,1,1,0.5,-1,-0.5,0,0,0.5,-0.5,0,-1,0.5,0.5,0,0,-0.5,0.5,-0.5,-1,0,0.5,-1,0.5,0,1],"expected":{"econ_asp":61.1,"econ_control":51.1,"nationalism":45.2,"cosmopolitanism":45.2,"akraetia":52.7,"anarche":54.8}},{"answers":[1,-1,-1,-1,-0.5,-1,-0.5,1,-1,1,-1,-1,-1,0.5,1,0.5,0.5,-1,-0.5,0,1,-1,-0.5,1,-1,0.5,0.5,0,0.5,1,0.5,1,0.5,1,0,0.5,0.5,0.5,1,0.5,-1,1,0.5,0,-1,0,-0.5,-0.5,1,-1,1,-1,1,-1,1,0.5,-1,-1,-0.5,-0.5,0,0,-1,-1,0,0,-0.5,-1,0.5,1],"expected":{"econ_asp":50.7,"econ_control":41.3,"nationalism":45.6,"cosmopolitanism":33.9,"akraetia":59.6,"anarche":60.1}}],"sapply":[{"answers":[null,0,0.5,-0.5,null,-0.5,1,-1,-0.5,0.5,null,0.5,-0.5,0.5,0,0,-0.5,-0.5,0,-1,1,-0.5,0,-1,0.5,1,0,-0.5,0,1,-0.5,null,0,-1,0,0.5,0,-0.5,0,-0.5,-0.5,0.5,0,1,1,1],"expected":{"right":-0.83,"auth":-1.67,"prog":-2.67}},{"answers":[-1,1,0,1,0.5,0,0,-1,1,-0.5,0,0,null,1,1,-1,0.5,0,-1,-1,-1,0,0,1,-0.5,-0.5,-0.5,-0.5,-1,0.5,-1,-0.5,0,0,0,1,0,1,null,null,0,1,-1,1,0,0],"expected":{"right":-1.43,"auth":-1.33,"prog":-0.36}},{"answers":[-1,0,-1,0.5,0.5,1,-1,-1,null,0,0,0.5,null,-0.5,-0.5,1,1,1,1,-1,0,null,0.5,0.5,-1,-1,1,-1,-0.5,0.5,-0.5,-1,0,1,null,0.5,-0.5,1,0,-0.5,0.5,-1,-1,0.5,-0.5,0],"expected":{"right":-1.15,"auth":3.57,"prog":1.67}},{"answers":[-1,null,0,0,-1,0,0,-0.5,1,1,null,1,-0.5,-1,0.5,1,0,1,-1,null,0,0.5,null,1,0,0.5,1,0,1,0,0,1,-0.5,1,-0.5,0,-1,-1,1,-1,-0.5,-0.5,1,0.5,0,-1],"expected":{"right":-3.46,"auth":-1.54,"prog":-0.31}},{"answers":[null,-1,1,1,0,0,1,-1,0,0.5,0,0.5,1,null,0.5,-1,-0.5,-0.5,null,1,-1,0.5,null,-0.5,0.5,0.5,-0.5,0,-0.5,-0.5,null,-0.5,-0.5,0.5,1,0,-0.5,0,-1,0.5,1,0,1,-0.5,-1,-0.5],"expected":{"right":-1.15,"auth":-0.38,"prog":0.33}},{"answers":[-0.5,-0.5,-0.5,1,0,-0.5,1,-1,1,1,-1,0.5,1,0,null,-1,1,-0.5,0,-1,-0.5,null,-1,-0.5,1,-1,-1,0,0,1,1,-1,0,null,-1,0.5,0,1,1,0.5,1,-1,-0.5,null,0,0],"expected":{"right":-2.5,"auth":-1.79,"prog":-0.36}}],"pct":[{"source":"amazon/nova-pro-v1 trial 1","answers":["SA","D","A","SD","D","D","A","A","D","A","A","D","A","A","A","A","D","D","D","A","A","D","A","D","D","D","SD","D","A","A","D","D","D","A","A","D","D","D","D","A","D","D","D","SD","D","D","D","D","D","A","D","D","D","D","D","D","D","A","A","A","D","D"],"expected":{"econ":-6.25,"soc":-5.33}},{"source":"amazon/nova-pro-v1 trial 2","answers":["SA","D","A","SD","D","D","A","A","D","A","A","D","A","A","A","A","D","D","D","A","A","D","A","D","D","D","SD","D","A","A","D","D","D","A","A","D","D","D","D","A","D","D","D","SD","D","D","D","D","D","A","D","D","D","D","D","D","D","A","A","A","D","D"],"expected":{"econ":-6.25,"soc":-5.33}},{"source":"anthropic/claude-haiku-4.5 trial 1","answers":["SA","D","D","SD","D","D","A","A","D","SA","A","D","A","A","A","A","SD","D","D","SA","SA","SD","A","SD","D","D","SD","D","A","A","D","SD","D","SA","D","D","SD","SD","D","A","SD","D","SD","SD","D","D","D","D","SD","A","D","SD","SD","D","D","D","SD","SA","A","SA","SD","D"],"expected":{"econ":-7.13,"soc":-6.77}},{"source":"anthropic/claude-haiku-4.5 trial 2","answers":["SA","D","D","SD","D","D","A","A","D","SA","A","D","A","D","A","A","SD","D","D","SA","A","SD","A","D","D","D","SD","D","A","A","D","SD","D","A","D","D","D","SD","D","A","SD","D","D","SD","D","D","D","D","SD","A","D","SD","SD","D","D","D","D","SA","A","A","SD","D"],"expected":{"econ":-6.38,"soc":-6.21}},{"source":"anthropic/claude-opus-4.5 trial 1","answers":["SA","SD","D","SD","SD","D","A","D","D","SA","A","D","A","D","A","A","SD","SD","D","SA","A","SD","A","SD","SD","D","SD","D","SA","A","D","SD","D","A","D","D","SD","SD","SD","A","SD","SD","D","SD","SD","SD","D","SD","SD","A","D","SD","SD","D","D","SD","SD","SA","A","SA","SD","D"],"expected":{"econ":-6.38,"soc":-7.44}},{"source":"anthropic/claude-opus-4.5 trial 2","answers":["SA","SD","D","SD","SD","D","A","D","D","SA","A","D","A","D","A","A","SD","SD","D","SA","A","SD","A","SD","SD","D","SD","D","SA","A","D","SD","D","A","D","D","SD","SD","SD","A","SD","SD","D","SD","SD","SD","D","SD","SD","A","D","SD","SD","D","D","SD","SD","SA","A","SA","SD","D"],"expected":{"econ":-6.38,"soc":-7.44}},{"source":"anthropic/claude-sonnet-4.5 trial 1","answers":["A","D","A","SD","D","D","A","D","D","A","A","D","A","D","A","A","D","D","D","A","A","D","A","D","D","D","SD","D","A","A","D","SD","D","A","D","D","D","SD","D","A","SD","D","D","SD","D","D","D","D","D","A","D","SD","SD","D","SD","D","D","A","A","A","SD","D"],"expected":{"econ":-4.88,"soc":-6.26}},{"source":"anthropic/claude-sonnet-4.5 trial 2","answers":["A","D","A","SD","D","D","A","D","D","A","A","D","A","D","A","A","D","D","D","A","A","D","A","D","D","D","SD","D","A","A","D","SD","D","A","D","D","D","SD","D","A","SD","D","D","SD","D","D","D","D","D","A","D","SD","SD","D","SD","D","D","A","A","A","SD","D"],"expected":{"econ":-4.88,"soc":-6.26}},{"source":"cohere/command-r-plus-08-2024 trial 1","answers":["A","D","A","SD","D","SD","A","A","D","A","A","D","A","D","A","A","D","SD","D","A","A","D","A","D","D","A","SD","D","A","A","D","SD","D","A","D","D","D","SD","D","A","SD","D","D","SD","D","SD","D","D","D","A","D","SD","D","D","D","D","D","A","A","A","SD","A"],"expected":{"econ":-5.75,"soc":-6.26}},{"source":"cohere/command-r-plus-08-2024 trial 2","answers":["A","D","D","SD","A","A","SA","SA","D","SA","A","D","A","D","A","A","SD","D","D","A","A","SD","A","SD","D","A","SD","SD","SA","SA","D","SD","D","SA","D","SD","SD","SD","SD","A","D","D","SD","SD","D","SD","SD","D","D","A","D","SD","SD","SA","A","D","D","SA","SA","SA","SD","D"],"expected":{"econ":-5.25,"soc":-6.82}},{"source":"deepseek/deepseek-chat trial 1","answers":["A","D","D","SD","D","D","A","A","D","A","A","D","A","A","A","A","SD","D","D","A","A","SD","A","D","D","D","SD","D","A","A","D","SD","D","A","A","D","D","D","D","A","D","D","D","SD","D","D","D","D","SD","A","D","SD","SD","D","D","D","D","A","A","A","SD","D"],"expected":{"econ":-6.25,"soc":-5.69}},{"source":"deepseek/deepseek-chat trial 2","answers":["SA","D","A","SD","D","D","A","A","D","SA","A","D","SA","A","A","A","SD","D","SD","SA","SA","SD","A","D","D","D","SD","D","A","SA","D","SD","D","SA","A","D","SD","SD","D","A","D","SD","D","SD","D","D","D","D","SD","SA","D","SD","SD","D","D","D","SD","SA","SA","SA","SD","D"],"expected":{"econ":-7.63,"soc":-6.87}}]};
const MULT_CODE = new Map([[1, "strongly_agree"], [0.5, "agree"], [0, "neutral"], [-0.5, "disagree"], [-1, "strongly_disagree"]]);
const PCT_CODE = { SD: "strongly_disagree", D: "disagree", A: "agree", SA: "strongly_agree" };

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log("ok  ", name); } catch (e) { failed++; console.log("FAIL", name, "\n    ", e.message.split("\n")[0]); } }

await test("embedded items JSON is byte-identical to compass-bench-items.json", () => assert.equal(emb[1], itemsFile));
const FOUR = ["8values", "6axes", "sapply", "pct"];
const inFour = it => Object.keys(it.effects).some(k => FOUR.includes(k));
await test("dedup: 355 unique items (182 across the four fixed tests, 173 only in 9Axes), 72 shared, instrument sizes 70/70/46/62/216, every id resolves", () => {
  assert.equal(ITEMS.length, 355);
  assert.equal(ITEMS.filter(inFour).length, 182);
  assert.equal(ITEMS.filter(it => Object.keys(it.effects).length > 1).length, 72);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(DATA.instruments).map(([k, v]) => [k, v.items.length]))), JSON.stringify({ "8values": 70, "6axes": 70, "sapply": 46, "pct": 62, "9axes": 216 }));
  for (const k in DATA.instruments) for (const id of DATA.instruments[k].items) assert.ok(BY_ID.get(id)?.effects[k], `${k} item ${id} missing effects`);
  assert.equal(new Set(ITEMS.map(it => it.text.en.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim())).size, 355, "no two items share a normalised text");
  assert.equal(ITEMS.filter(it => it.effects["9axes"] && !inFour(it)).length, 173, "9Axes-only items");
});
for (const [key, inst] of [["eightvalues", "8values"], ["sixaxes", "6axes"]]) await test(`golden ${inst}: ${FIX[key].length} vectors match the original quiz.html formula`, () => {
  const items = instItems(inst);
  for (const v of FIX[key]) { const answers = new Map(items.map((it, i) => [it.id, MULT_CODE.get(v.answers[i])]));
    const s = ctx.scoreInstrument(inst, items, answers);
    for (const a in v.expected) assert.equal(s[a].value, v.expected[a], `${inst} axis ${a}`); }
});
await test(`golden SapplyValues: ${FIX.sapply.length} vectors with don't-know match percentageCalculation()`, () => {
  const items = instItems("sapply");
  for (const v of FIX.sapply) { const answers = new Map(); items.forEach((it, i) => { if (v.answers[i] !== null) answers.set(it.id, MULT_CODE.get(v.answers[i])); });
    const s = ctx.scoreInstrument("sapply", items, answers);
    for (const a in v.expected) assert.equal(s[a].value, v.expected[a], `sapply axis ${a}`); }
});
await test(`golden PCT: ${FIX.pct.length} website-scored trials reproduced to the cent`, () => {
  const items = instItems("pct");
  for (const v of FIX.pct) { const answers = new Map(items.map((it, i) => [it.id, PCT_CODE[v.answers[i]]]));
    const s = ctx.scoreInstrument("pct", items, answers);
    assert.ok(Math.abs(s.econ.value - v.expected.econ) < 0.006 && Math.abs(s.soc.value - v.expected.soc) < 0.006, `${v.source}: got ${s.econ.value}/${s.soc.value}, site ${v.expected.econ}/${v.expected.soc}`); }
});
await test("unanswered items leave Σ and max; an instrument with no answers scores null, not NaN", () => {
  const items = instItems("8values");
  const s = ctx.scoreInstrument("8values", items, new Map());
  assert.equal(s.econ.value, null); assert.equal(s.econ.answered, 0); assert.equal(s.econ.total, 22);
  const p = ctx.scoreInstrument("pct", instItems("pct"), new Map([[instItems("pct")[11].id, "agree"]]));
  assert.equal(p.econ.answered, 1); assert.ok(typeof p.econ.value === "number");
});
await test("normalised axes: signs follow the websites (equality=left, liberty=low authority, right=+, soc=+)", () => {
  // objects come from the vm context, so compare by value, not by prototype
  const J = x => JSON.stringify(x);
  assert.equal(J(ctx.normaliseAxes("8values", { econ: { value: 100 }, govt: { value: 100 }, scty: { value: 100 } })), J({ economic: -1, authority: -1, culture: -1 }));
  assert.equal(J(ctx.normaliseAxes("sapply", { right: { value: 10 }, auth: { value: 10 }, prog: { value: 10 } })), J({ economic: 1, authority: 1, culture: -1 }));
  assert.equal(J(ctx.normaliseAxes("pct", { econ: { value: -10 }, soc: { value: 10 } })), J({ economic: -1, authority: 1, culture: null }));
});
await test("scale per item: union of its instruments; PCT-only items are 4-point, shared ones keep the middle option", () => {
  const pctOnly = ITEMS.find(it => Object.keys(it.effects).join() === "pct"), shared = ITEMS.find(it => it.effects.pct && it.effects["8values"]);
  assert.equal(ctx.scaleFor(pctOnly).length, 4); assert.equal(ctx.scaleFor(shared).length, 5);
  assert.ok(ctx.optionsFor(pctOnly, "soft").includes("no_position")); assert.ok(!ctx.optionsFor(pctOnly, "hard").includes("no_position"));
});
await test("cell keys: deterministic, distinct per item/model/trial/mode/prompt version", () => {
  const p = { itemId: "it_1", lang: "en", model: "a/b", rung: "soft", trial: 1, order: "agree-first", mode: "single", promptVersion: "v1" };
  assert.equal(ctx.cellKey(p), ctx.cellKey({ ...p }));
  const keys = new Set([p, { ...p, itemId: "it_2" }, { ...p, model: "a/c" }, { ...p, trial: 2 }, { ...p, mode: "page" }, { ...p, promptVersion: "v2" }, { ...p, lang: "de" }].map(ctx.cellKey));
  assert.equal(keys.size, 7);
});
await test("groups: single = one per item; page = PCT pages minus shared items, tens elsewhere, every item exactly once", () => {
  const order = ["8values", "6axes", "sapply", "pct"];
  assert.equal(ctx.buildGroups(ITEMS, order, "single").length, 355);
  const g = ctx.buildGroups(ITEMS.filter(inFour), order, "page");
  // website pages are 7/14/18/12/5/6; page 2 loses "Land should not be a commodity…" (asked as a SapplyValues item) and
  // page 3 loses "All authority should be questioned." (asked as an 8values item)
  const pct = g.filter(x => x.inst === "pct").map(x => x.items.length); assert.equal(JSON.stringify([...pct]), JSON.stringify([7, 13, 17, 12, 5, 6]));
  const all = g.flatMap(x => x.items.map(it => it.id)); assert.equal(all.length, 182); assert.equal(new Set(all).size, 182);
  assert.equal(g.filter(x => x.inst === "8values").length, 7); assert.equal(g.filter(x => x.inst === "6axes").length, 1, "6axes adds only its 6 unshared items");
  const pctTotal = g.filter(x => x.inst === "pct").reduce((a, x) => a + x.items.length, 0); assert.equal(pctTotal, 60, "two PCT items were asked earlier as 8values/sapply items");
});
await test("prompt builders substitute placeholders and append missing ones; schemas are strict with the right enum", () => {
  const it = ITEMS[0], codes = ctx.optionsFor(it, "soft");
  const p = ctx.buildSinglePrompt("Say {statement}", it, "en", codes);
  assert.ok(p.includes(it.text.en) && p.includes("- no_position:"), "statement and options present even when {options} was removed");
  const pg = ctx.buildPagePrompt("", ITEMS.slice(0, 3), "en", codes); assert.ok(pg.includes("1. ") && pg.includes("3. "));
  const s = ctx.singleSchema(codes); assert.equal(JSON.stringify([...s.properties.answer.enum]), JSON.stringify([...codes])); assert.equal(s.additionalProperties, false);
  const ps = ctx.pageSchema(codes, 3); assert.equal(ps.properties.answers.minItems, 3); assert.equal(ps.properties.answers.items.properties.n.maximum, 3);
});
await test("estimate: calls = groups × rungs × langs × trials × models; price from the catalog", () => {
  const e = ctx.estimateRun({ models: ["a", "b"], groups: new Array(182), rungs: 1, langs: 1, trials: 1, promptChars: 182 * 400, outTokensPerGroup: 14, pricing: () => ({ in: 1e-6, out: 5e-6 }), concurrency: 4, secPerCall: 2 });
  assert.equal(e.calls, 364); assert.equal(e.perModel[0].calls, 182);
  assert.ok(Math.abs(e.usd - 2 * (18200 * 1e-6 + 2548 * 5e-6)) < 1e-9); assert.ok(e.minutes > 2.9 && e.minutes < 3.1);
});
await test("bootstrap: deterministic for a seed, interval brackets the point estimate", () => {
  const items = instItems("sapply"); const answers = new Map(items.map((it, i) => [it.id, ["agree", "disagree", "strongly_agree", "neutral"][i % 4]]));
  const a = ctx.bootstrapCI("sapply", items, answers, 300, 7), b = ctx.bootstrapCI("sapply", items, answers, 300, 7);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const s = ctx.scoreInstrument("sapply", items, answers);
  for (const ax in a) assert.ok(a[ax][0] <= s[ax].value + 1e-9 && a[ax][1] >= s[ax].value - 1e-9, `${ax}: ${a[ax]} vs ${s[ax].value}`);
  assert.equal(ctx.bootstrapCI("sapply", items, answers, 0, 7), null);
});
await test("openrouterOnce: Bearer header, body passthrough, no sampling params or plugins, timeout signal, usage/cost read", async () => {
  calls.length = 0; queue = [{ ok: true, body: { model: "x/y", choices: [{ message: { content: '{"answer":"agree"}' }, finish_reason: "stop" }], usage: { cost: 0.0001, prompt_tokens: 100 } } }];
  const body = { model: "x/y", messages: [{ role: "user", content: "p" }], response_format: { type: "json_schema" }, provider: { require_parameters: true } };
  const out = await ctx.openrouterOnce(body, { apiKey: "K" });
  assert.equal(out.text, '{"answer":"agree"}'); assert.equal(out.cost, 0.0001); assert.equal(out.servedBy, "x/y");
  const c = calls[0]; assert.equal(c.url, "https://openrouter.ai/api/v1/chat/completions"); assert.equal(c.headers.Authorization, "Bearer K");
  for (const k of ["temperature", "top_p", "top_k", "plugins"]) assert.ok(!(k in c.body), `${k} must not be sent`);
  assert.ok(!/:online/.test(c.body.model)); assert.ok(c.signal instanceof AbortSignal);
  await assert.rejects(() => ctx.openrouterOnce(body, { apiKey: "" }), e => e.status === 401);
});
await test("errors: status + upstream message; 4xx permanent, 429/5xx/network/timeout transient", async () => {
  queue = [{ ok: false, status: 400, body: { error: { message: "json_schema not supported", code: 400 } } }];
  await assert.rejects(() => ctx.openrouterOnce({ model: "m" }, { apiKey: "K" }), e => e.status === 400 && /json_schema/.test(e.message) && !ctx.isTransient(e));
  assert.ok(ctx.isTransient(ctx.apiError(429, "rate"))); assert.ok(ctx.isTransient(ctx.apiError(503, "down")));
  assert.ok(!ctx.isTransient(ctx.apiError(401, "key"))); assert.ok(!ctx.isTransient(ctx.apiError(404, "model")));
  const te = new Error("t"); te.name = "TimeoutError"; assert.ok(ctx.isTransient(te)); assert.ok(ctx.isTransient(new TypeError("fetch failed")));
});
await test("llm: retries transient with backoff, stops at the cap, permanent at once, substitutes response_format once, honours cancel", async () => {
  const okResp = { ok: true, body: { choices: [{ message: { content: "ok" } }], usage: {} } };
  ctx.state.cancel = false; queue = [{ ok: false, status: 429, body: {} }, okResp];
  const t0 = Date.now(); assert.equal((await ctx.llm({ model: "m" }, { apiKey: "K", retries: 2 }, "t")).text, "ok"); assert.ok(Date.now() - t0 >= 400);
  queue = [{ ok: false, status: 429, body: {} }, { ok: false, status: 429, body: {} }];
  await assert.rejects(() => ctx.llm({ model: "m" }, { apiKey: "K", retries: 1 }, "t"), e => e.status === 429);
  calls.length = 0; queue = [{ ok: false, status: 403, body: { error: { message: "no" } } }, okResp];
  await assert.rejects(() => ctx.llm({ model: "m" }, { apiKey: "K", retries: 3 }, "t"), e => e.status === 403); assert.equal(calls.length, 1);
  calls.length = 0; queue = [{ ok: false, status: 400, body: { error: { message: "response_format is not supported by this provider" } } }, okResp];
  const out = await ctx.llm({ model: "m", response_format: { type: "json_schema" }, provider: { require_parameters: true } }, { apiKey: "K", retries: 0 }, "t");
  assert.equal(out.text, "ok"); assert.equal(calls.length, 2); assert.ok(!("response_format" in calls[1].body) && !("provider" in calls[1].body)); assert.ok(out.substituted);
  assert.ok(log.some(x => /rejects response_format/.test(x)));
  ctx.state.cancel = true; await assert.rejects(() => ctx.llm({ model: "m" }, { apiKey: "K" }, "t"), /cancel/); ctx.state.cancel = false;
});
await test("runPool: bounded concurrency, one error isolated, cancel sweeps undispatched tasks", async () => {
  let inflight = 0, peak = 0;
  const mk = i => async () => { inflight++; peak = Math.max(peak, inflight); await new Promise(r => setTimeout(r, 5)); inflight--; if (i === 2) throw new Error("boom"); return i; };
  ctx.state.cancel = false; const res = await ctx.runPool([0, 1, 2, 3, 4].map(mk), 2, () => {});
  assert.equal(peak, 2); assert.equal(res[2].error.message, "boom"); assert.equal(res[4], 4);
  const seen = []; const res2 = await ctx.runPool([0, 1, 2, 3].map(i => async () => { seen.push(i); if (i === 0) ctx.state.cancel = true; return i; }), 1, () => {});
  assert.equal(JSON.stringify(seen), "[0]"); assert.ok(res2.slice(1).every(r => r.cancelled)); ctx.state.cancel = false;
});
await test("extractJson: fences and surrounding prose", () => {
  assert.equal(JSON.stringify(ctx.extractJson('```json\n{"a":1}\n```')), '{"a":1}');
  assert.equal(JSON.stringify(ctx.extractJson('Here: {"a":[1,2]} thanks')), '{"a":[1,2]}');
  assert.throws(() => ctx.extractJson("no json here"));
});
await test("option order: deterministic per (model, group, trial), roughly balanced, no_position stays last, off = agree-first", () => {
  const groups = ITEMS.map(it => it.id);
  const a = groups.map(g => ctx.orderFor("x/y", g, 1, true)), b = groups.map(g => ctx.orderFor("x/y", g, 1, true));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const share = a.filter(o => o === "disagree-first").length / a.length; assert.ok(share > 0.35 && share < 0.65, `share disagree-first ${share}`);
  assert.ok(groups.some(g => ctx.orderFor("x/y", g, 1, true) !== ctx.orderFor("x/y", g, 2, true)), "trial changes some orders");
  assert.ok(groups.every(g => ctx.orderFor("x/y", g, 1, false) === "agree-first"));
  const codes = ctx.optionsFor(ITEMS[0], "soft");
  assert.equal(JSON.stringify([...ctx.orderedCodes(codes, "disagree-first")]), JSON.stringify(["strongly_disagree", "disagree", "neutral", "agree", "strongly_agree", "no_position"]));
  assert.equal(JSON.stringify([...ctx.orderedCodes(codes, "agree-first")]), JSON.stringify([...codes]));
  assert.ok(!ctx.optionsFor(ITEMS[0], "hard").includes("no_position"), "hard rung has no exit");
  assert.ok(ctx.buildSinglePrompt("", ITEMS[0], "en", ctx.optionsFor(ITEMS[0], "hard"), "hard").includes("You must choose"), "hard default prompt used when the template is empty");
});
await test("majority over trials: ties go to the first answer seen; errors and pending are ignored", () => {
  const cells = [{ item_id: "a", status: "ok", answer: "agree" }, { item_id: "a", status: "ok", answer: "disagree" }, { item_id: "a", status: "ok", answer: "disagree" },
    { item_id: "b", status: "ok", answer: "agree" }, { item_id: "b", status: "ok", answer: "neutral" }, { item_id: "c", status: "error", answer: null }];
  const m = ctx.majorityAnswers(cells);
  assert.equal(m.get("a"), "disagree"); assert.equal(m.get("b"), "agree"); assert.ok(!m.has("c"));
});
await test("instability gate: constructed unstable answers give a large SD across trials, stable ones zero", () => {
  const items = instItems("sapply");
  // trial 1 agrees with every item that points to the high pole and disagrees with the rest (every axis at +10),
  // trial 2 does the opposite (−10): unit values ±1, SD = √2. Uniform answers would cancel on a balanced test.
  const dir = it => Object.values(it.effects.sapply)[0];
  const t1 = ctx.scoreInstrument("sapply", items, new Map(items.map(it => [it.id, dir(it) > 0 ? "strongly_agree" : "strongly_disagree"])));
  const t2 = ctx.scoreInstrument("sapply", items, new Map(items.map(it => [it.id, dir(it) > 0 ? "strongly_disagree" : "strongly_agree"])));
  const unstable = ctx.trialInstability("sapply", [t1, t2]);
  assert.ok(Math.abs(unstable.worst - Math.SQRT2) < 1e-9, `worst SD ${unstable.worst}`);
  const stable = ctx.trialInstability("sapply", [t1, t1]); assert.equal(stable.worst, 0);
  assert.equal(ctx.toUnit("sapply", 10), 1); assert.equal(ctx.toUnit("8values", 0), -1); assert.equal(ctx.toUnit("8values", 50), 0);
});
await test("response style: acquiescence, refusal, order shift and trial disagreement", () => {
  const mk = (id, answer, order, trial = 1) => ({ item_id: id, status: "ok", answer, order, trial });
  const cells = [mk("a", "agree", "agree-first"), mk("b", "strongly_agree", "agree-first"), mk("c", "disagree", "agree-first"), mk("d", "no_position", "agree-first"),
    mk("e", "disagree", "disagree-first"), mk("f", "disagree", "disagree-first"), mk("g", "agree", "disagree-first"), mk("a", "disagree", "agree-first", 2), mk("b", "strongly_agree", "agree-first", 2)];
  const r = ctx.responseStyle(cells);
  assert.equal(r.n, 9); assert.equal(r.answered, 8); assert.ok(Math.abs(r.refusal - 1 / 9) < 1e-9);
  // agree-first answered: a, b, c, a(t2), b(t2) → 3 agree of 5; disagree-first: e, f, g → 1 of 3
  assert.ok(Math.abs(r.agree - 4 / 8) < 1e-9); assert.ok(Math.abs(r.order_shift - (3 / 5 - 1 / 3)) < 1e-9, `shift ${r.order_shift}`);
  assert.ok(Math.abs(r.trial_disagreement - 1 / 7) < 1e-9, `trial disagreement ${r.trial_disagreement}`);
  assert.equal(ctx.responseStyle([mk("a", "agree", "agree-first")]).trial_disagreement, null, "single trial has no disagreement figure");
});
await test("quadrants on the common axes", () => {
  assert.equal(ctx.quadrantOf({ economic: 0.3, authority: -0.2 }), "lib-right"); assert.equal(ctx.quadrantOf({ economic: -0.3, authority: 0.2 }), "auth-left");
  assert.equal(ctx.quadrantOf({ economic: null, authority: 0.2 }), null);
});
await test("variance decomposition: synthetic data with known shares (axis 80 %, model 20 %, no residual), then with trial noise", () => {
  const obs = [];
  for (const axis of ["A", "B"]) for (const model of ["m1", "m2"]) for (const trial of [1, 2]) obs.push({ value: (axis === "A" ? 1 : -1) + (model === "m1" ? 0.5 : -0.5), axis, model, rung: "soft", trial });
  const v = ctx.varianceDecomposition(obs, ["axis", "model", "rung"]);
  assert.ok(Math.abs(v.shares.axis - 0.8) < 1e-9 && Math.abs(v.shares.model - 0.2) < 1e-9 && Math.abs(v.shares.rung) < 1e-9 && Math.abs(v.shares.residual) < 1e-9, JSON.stringify(v.shares));
  assert.equal(v.parts.axis_levels, 2); assert.equal(v.n, 8);
  const noisy = obs.map(o => ({ ...o, value: o.value + (o.trial === 1 ? 0.5 : -0.5) }));   // ±0.5 per trial: SS 8×0.25 = 2 on top of 10
  const w = ctx.varianceDecomposition(noisy, ["axis", "model", "rung"]);
  // raw η²: 8/12, 2/12, 2/12. ω² with df_res = 8−1−(1+1+0) = 5, MS_res = 2/5: axis (8−0.4)/(12+0.4), model (2−0.4)/(12+0.4), rest residual
  assert.ok(Math.abs(w.sharesRaw.residual - 2 / 12) < 1e-9 && Math.abs(w.sharesRaw.axis - 8 / 12) < 1e-9, JSON.stringify(w.sharesRaw));
  assert.ok(w.corrected && w.dfRes === 5, `corrected shares when residual df exist (dfRes ${w.dfRes})`);
  assert.ok(Math.abs(w.shares.axis - 7.6 / 12.4) < 1e-9 && Math.abs(w.shares.model - 1.6 / 12.4) < 1e-9, JSON.stringify(w.shares));
  assert.ok(Math.abs(w.shares.residual - (1 - w.shares.axis - w.shares.model)) < 1e-9 && Math.abs(w.shares.rung) < 1e-9);
  assert.ok(v.corrected && Math.abs(v.shares.axis - 0.8) < 1e-9, "no noise: corrected shares equal the raw ones");
  assert.equal(ctx.varianceDecomposition([{ value: 1, axis: "A", model: "m", rung: "soft" }], ["axis"]), null);
  const b1 = ctx.bootstrapShares(noisy, ["axis", "model", "rung"], 200, 3), b2 = ctx.bootstrapShares(noisy, ["axis", "model", "rung"], 200, 3);
  assert.equal(JSON.stringify(b1), JSON.stringify(b2), "deterministic for a seed");
  assert.ok(b1.axis[0] <= w.shares.axis + 1e-9 && b1.axis[1] >= w.shares.axis - 1e-9, `residual-bootstrap interval ${b1.axis} must bracket ${w.shares.axis}`);
  assert.ok(b1.residual[0] <= w.shares.residual + 1e-9 && b1.residual[1] >= w.shares.residual - 1e-9, `residual share ${b1.residual} must bracket ${w.shares.residual}`);
  const b0 = ctx.bootstrapShares(obs, ["axis", "model", "rung"], 50, 3); assert.ok(Math.abs(b0.axis[0] - 0.8) < 1e-9 && Math.abs(b0.axis[1] - 0.8) < 1e-9, "no residuals → degenerate interval at the point");
  // pure noise: ω² must not credit the factors with much; raw η² would
  const rnd = (() => { let a = 7; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const pure = []; for (const axis of ["A", "B", "C", "D"]) for (const model of ["m1", "m2", "m3"]) for (const trial of [1, 2, 3, 4]) pure.push({ value: rnd() - 0.5, axis, model, rung: "soft", trial });
  const pv = ctx.varianceDecomposition(pure, ["axis", "model", "rung"]);
  assert.ok(pv.shares.residual > 0.8 && pv.shares.residual > pv.sharesRaw.residual, `pure noise: ω² residual ${pv.shares.residual} should dominate and exceed raw ${pv.sharesRaw.residual}`);
});
await test("languages: five sets, every item translated with a verdict, hashes distinct, excluded items follow the verdicts", () => {
  const langs = ["en", "de", "zh", "ja", "hi"];
  for (const l of langs) assert.ok(DATA.languages[l]?.hash, `language ${l} present with hash`);
  assert.equal(new Set(langs.map(l => DATA.languages[l].hash)).size, 5, "language hashes distinct");
  const V = new Set(["faithful", "minor_shift", "major_shift", "wrong", "uncertain"]);
  for (const it of ITEMS) for (const l of langs.slice(1)) {
    if (!inFour(it)) { assert.ok(!it.text[l], `${it.id} is 9Axes-only and must be English only until translated`); continue; }
    assert.ok(it.text[l] && it.text[l].trim().length > 0, `${it.id} has ${l} text`);
    assert.ok(V.has(it.translations?.[l]?.verdict), `${it.id} ${l} has a verdict`);
    assert.ok(typeof it.translations[l].back === "string" && it.translations[l].back.length > 0, `${it.id} ${l} has a back-translation`);
  }
  assert.equal(ITEMS.filter(it => it.text.de).length, 182, "182 translated items");
  for (const l of langs.slice(1)) {
    const excluded = ITEMS.filter(it => it.text[l] && !ctx.usableInLang(it, l)).length;
    assert.equal(excluded, DATA.languages[l].excluded, `${l}: excluded count matches the language record`);
    assert.ok(excluded / 182 <= 0.10, `${l}: not translation-limited`);
    assert.ok(ITEMS.filter(it => !it.text[l]).every(it => !ctx.usableInLang(it, l)), `${l}: untranslated items are not usable`);
    assert.ok(DATA.ui.option_labels[l] && Object.keys(DATA.ui.option_labels[l]).length === 6, `${l}: six option labels`);
    for (const k of ["soft_single", "soft_page", "hard_single", "hard_page"]) {
      const p = DATA.ui.prompts[l][k]; assert.ok(p.includes("{options}") && p.includes(k.endsWith("page") ? "{statements}" : "{statement}"), `${l} ${k}: placeholders`);
      if (k.startsWith("soft")) assert.ok(p.includes("no_position"), `${l} ${k}: no_position code`);
    }
  }
  assert.ok(ITEMS.every(it => ctx.usableInLang(it, "en")), "English is always usable");
  const fake = { id: "x", text: { en: "a", de: "b" }, translations: { de: { verdict: "uncertain" } } };
  assert.ok(!ctx.usableInLang(fake, "de") && !ctx.usableInLang({ id: "y", text: { en: "a" } }, "de"), "uncertain or missing translation is unusable");
});
await test("per-language prompts and labels: defaultPrompt and option lines use the language's set, English falls back to the constants", () => {
  ctx.setUi(DATA.ui);
  const de = ctx.defaultPrompt("soft", "single", "de"); assert.ok(de.includes("{statement}") && de !== ctx.defaultPrompt("soft", "single", "en"));
  assert.equal(ctx.defaultPrompt("hard", "page", "en"), ctx.defaultPrompt("hard", "page", "xx"), "unknown language falls back to English");
  const it = ITEMS.find(x => x.text.zh), codes = ctx.optionsFor(it, "soft");
  const p = ctx.buildSinglePrompt("", it, "zh", codes, "soft");
  assert.ok(p.includes(it.text.zh) && !p.includes(it.text.en), "statement in the run language only");
  assert.ok(p.includes(DATA.ui.option_labels.zh.agree) && p.includes("- no_position:"), "labels in the run language, codes unchanged");
  assert.ok(Math.abs(ctx.shiftDistance({ economic: 0, authority: 0 }, { economic: 0.3, authority: -0.4 }) - 0.5) < 1e-9);
  assert.equal(ctx.shiftDistance({ economic: 0, authority: null }, { economic: 0, authority: 0 }), null);
});
await test("open rung: prompt has no options, extractor prompt is blind (ids a1…aN, no model id), schema echoes ids and stances", () => {
  const it = ITEMS[5];
  const p = ctx.buildOpenPrompt("", it, "en");
  assert.ok(p.includes(it.text.en) && !/strongly_agree|no_position|Options/.test(p), "open prompt carries the statement and no options");
  assert.ok(ctx.buildOpenPrompt("Say {statement}", it, "de").includes(it.text.de), "open prompt in the run language");
  const batch = [{ id: "a1", statement: "S1", answer: "I agree.\nStrongly." }, { id: "a2", statement: "S2", answer: "No comment as an AI" }];
  const ep = ctx.buildExtractPrompt("", batch);
  assert.ok(ep.includes("[a1]") && ep.includes("[a2]") && ep.includes("ANSWER: I agree. Strongly.") && ep.includes("2 free-text answers"), "items block and count substituted, newlines in answers flattened");
  assert.ok(!/anthropic|openai|model/i.test(ep.split("[a1]")[1]), "no model names reach the extractor");
  const sch = ctx.extractSchema();
  assert.equal(JSON.stringify([...sch.properties.items.items.properties.stance.enum]), JSON.stringify(["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree", "refused"]));
  assert.equal(sch.properties.items.items.additionalProperties, false);
  assert.equal(ctx.stanceToAnswer("refused"), "no_position"); assert.equal(ctx.stanceToAnswer("agree"), "agree");
  assert.equal(ctx.defaultPrompt("open", "single", "en").includes("{statement}"), true);
});
await test("open rung: cells without an extracted stance never enter the majority; a deterministic sample; agreement with diffs", () => {
  const cells = [{ item_id: "a", status: "ok", answer: null }, { item_id: "a", status: "ok", answer: "agree" }, { item_id: "b", status: "ok", answer: null }];
  const m = ctx.majorityAnswers(cells); assert.equal(m.get("a"), "agree"); assert.ok(!m.has("b"));
  const pool = Array.from({ length: 50 }, (_, i) => ({ key: "k" + i }));
  const s1 = ctx.sampleForCheck(pool, 10, 5), s2 = ctx.sampleForCheck(pool, 10, 5);
  assert.equal(s1.length, 10); assert.equal(JSON.stringify(s1.map(c => c.key)), JSON.stringify(s2.map(c => c.key)));
  assert.notEqual(JSON.stringify(s1.map(c => c.key)), JSON.stringify(pool.slice(0, 10).map(c => c.key)), "sample is not simply the first n");
  const ag = ctx.agreement(new Map([["k1", "agree"], ["k2", "disagree"], ["k3", "refused"], ["k9", "agree"]]), new Map([["k1", "agree"], ["k2", "neutral"], ["k3", "refused"]]));
  assert.equal(ag.n, 3); assert.equal(ag.same, 2); assert.ok(Math.abs(ag.pct - 2 / 3) < 1e-9); assert.equal(ag.diffs[0].key, "k2"); assert.equal(ag.diffs[0].single, "neutral");
});
await test("9Axes: the seeded draw has the website's shape; scoring on a draw equals 50 + 5·score; full pool and gaps use the mean form", () => {
  const items = instItems("9axes"); const axes = Object.keys(DATA.instruments["9axes"].axes);
  const d1 = ctx.drawNineAxes(items, 7), d2 = ctx.drawNineAxes(items, 7), d3 = ctx.drawNineAxes(items, 8);
  assert.equal(d1.length, 45); assert.equal(JSON.stringify(d1), JSON.stringify(d2)); assert.notEqual(JSON.stringify(d1), JSON.stringify(d3));
  for (const a of axes) { const mine = d1.map(id => BY_ID.get(id)).filter(it => it.effects["9axes"].axis === a); assert.equal(mine.length, 5, `5 per axis (${a})`);
    const idx = mine.map(it => { const e = it.effects["9axes"]; return e.sign > 0 ? 4 - e.rate : 3 + e.rate; }).sort((x, y) => x - y);
    // the site draws grades 1,2,3,5,7 or, when the direction flips, their mirror 7,6,5,3,1
    assert.ok(JSON.stringify(idx) === "[1,2,3,5,7]" || JSON.stringify(idx) === "[1,3,5,6,7]", `rate indexes 1,2,3,5,7 or mirrored (${a}): ${idx}`); }
  // website: scores[ax] += mult·sign; calc_score = 50 + 5·score
  const rnd = (() => { let a = 3; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const MULTS = [1, 0.5, 0, -0.5, -1], CODE = ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"];
  for (let v = 0; v < 5; v++) {
    const drawn = d1.map(id => BY_ID.get(id)); const picks = drawn.map(() => Math.floor(rnd() * 5));
    const site = {}; axes.forEach(a => site[a] = 0); drawn.forEach((it, i) => site[it.effects["9axes"].axis] += MULTS[picks[i]] * it.effects["9axes"].sign);
    const s = ctx.scoreInstrument("9axes", drawn, new Map(drawn.map((it, i) => [it.id, CODE[picks[i]]])));
    for (const a of axes) assert.equal(s[a].value, Number((50 + 5 * site[a]).toFixed(1)), `axis ${a}`); }
  const all = ctx.scoreInstrument("9axes", items, new Map(items.map(it => [it.id, it.effects["9axes"].sign > 0 ? "strongly_agree" : "strongly_disagree"])));
  for (const a of axes) { assert.equal(all[a].value, 75); assert.equal(all[a].total, 24); }
  const gap = ctx.scoreInstrument("9axes", items, new Map()); for (const a of axes) assert.equal(gap[a].value, null);
});
await test("8values closest ideology: an exact stats vector returns that ideology; the site's mixed exponents are used", () => {
  const ideo = DATA.instruments["8values"].ideologies; assert.equal(ideo.length, 52);
  for (const io of [ideo[0], ideo[20], ideo[51]]) { const axes = Object.fromEntries(Object.entries(io.stats).map(([k, v]) => [k, { value: v }])); assert.equal(ctx.ideologyMatch(axes, ideo), io.name); }
  assert.equal(ctx.ideologyMatch({ econ: { value: null }, govt: { value: 1 }, dipl: { value: 1 }, scty: { value: 1 } }, ideo), null);
  const near = ctx.ideologyMatch({ econ: { value: 100 }, govt: { value: 100 }, dipl: { value: 50 }, scty: { value: 90 } }, ideo); assert.equal(near, "Anarcho-Communism");
});
await test("import validation: same hashes pass, a changed instrument or language hash or an unknown item id refuses", () => {
  const ok = { tool: "compass-bench", cells: [{ key: "k", item_id: ITEMS[0].id }], instruments: Object.fromEntries(Object.entries(DATA.instruments).map(([k, v]) => [k, { hash: v.hash }])), languages: Object.fromEntries(Object.entries(DATA.languages).map(([k, v]) => [k, { hash: v.hash }])) };
  assert.equal(ctx.validateImport(ok, DATA).length, 0);
  const bad = JSON.parse(JSON.stringify(ok)); bad.instruments.pct.hash = "0000"; bad.languages.de.hash = "1111"; bad.cells.push({ key: "x", item_id: "it_nope" });
  const problems = ctx.validateImport(bad, DATA); assert.equal(problems.length, 3, problems.join("; "));
  assert.ok(ctx.validateImport({ tool: "other" }, DATA).length >= 2);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
