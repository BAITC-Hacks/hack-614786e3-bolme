/**
 * Independent verification of the simulator against the case document.
 *
 *   npm run sim:verify
 *
 * 1. Parses the tables of docs/case/akim-simulator-dataset-and-rules.md
 *    (NOT src/domain/data.ts) and compares every number with data.ts.
 * 2. Re-implements the rules and formula from the document text as a small
 *    reference evaluator and compares it with the engine on EVERY combination
 *    of 5 measures × every district assignment (valid and invalid plans):
 *    same validity decision, same rejection reasons, same Score (1e-9).
 * 3. Checks the reference numbers printed in the document itself.
 */
import { readFileSync } from "node:fs";
import { DISTRICTS, INCOMPATIBILITIES, INDICATORS, MEASURES, SYNERGIES } from "../../src/domain/data";
import { evaluatePlan } from "../../src/domain/engine";
import { DISTRICT_IDS, INDICATOR_IDS, MEASURE_IDS, type Choice, type DistrictId, type IndicatorId, type IssueCode, type MeasureId } from "../../src/domain/types";

const doc = readFileSync("docs/case/akim-simulator-dataset-and-rules.md", "utf8");
const lines = doc.split(/\r?\n/);
const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
const num = (s: string) => Number(s.replace("−", "-").replace(",", "."));
let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failures++;
    console.log(`  FAIL ${what}`);
  }
};

/* ------------------------------------------------ 1. parse the document --- */
const NAME_TO_ID: Record<string, DistrictId> = { Есиль: "esil", Алматы: "almaty", Сарыарка: "saryarka", Байконур: "baikonur", Нура: "nura" };
const docDistricts = {} as Record<DistrictId, { pop: number; values: Record<IndicatorId, number>; D: number }>;
for (const line of lines) {
  const c = cells(line);
  if (c.length === 13 && NAME_TO_ID[c[0]]) {
    const values = Object.fromEntries(INDICATOR_IDS.map((k, i) => [k, num(c[2 + i])])) as Record<IndicatorId, number>;
    docDistricts[NAME_TO_ID[c[0]]] = { pop: num(c[1]), values, D: num(c[12]) };
  }
}
const weightRow = cells(lines.find((l) => l.startsWith("| Вес w[k]"))!);
const docWeights = Object.fromEntries(INDICATOR_IDS.map((k, i) => [k, num(weightRow[1 + i])])) as Record<IndicatorId, number>;

type DocMeasure = { city: boolean; cost: number; lag: number; effects: Partial<Record<IndicatorId, number>>; direction: string };
const docMeasures = {} as Record<MeasureId, DocMeasure>;
for (const line of lines) {
  const c = cells(line);
  if (c.length === 7 && /^M\d+$/.test(c[0])) {
    const effects: Partial<Record<IndicatorId, number>> = {};
    for (const part of c[6].split(";")) {
      const m = part.trim().match(/^([TESBC][12])\s*([+−-]\d+)$/);
      if (m) effects[m[1] as IndicatorId] = num(m[2]);
    }
    docMeasures[c[0] as MeasureId] = { direction: c[1], city: c[3] === "Город", cost: num(c[4]), lag: num(c[5]), effects };
  }
}
const docSynergies: Array<{ a: MeasureId; b: MeasureId; k: IndicatorId; bonus: number }> = [];
for (const line of lines) {
  const m = line.match(/^\| (M\d+) \+ (M\d+) \| ([TESBC][12]) \+(\d+) в районе (M\d+) \|$/);
  if (m) docSynergies.push({ a: m[1] as MeasureId, b: m[2] as MeasureId, k: m[3] as IndicatorId, bonus: num(m[4]) });
}
const docIncompat: Array<{ a: MeasureId; b: MeasureId; sameDistrict: boolean }> = [];
for (const line of lines) {
  const m = line.match(/^- \*\*(M\d+) и (M\d+):\*\* (.*)$/);
  if (m) docIncompat.push({ a: m[1] as MeasureId, b: m[2] as MeasureId, sameDistrict: /в одном районе/.test(m[3]) });
}
const budget = num(doc.match(/Бюджет — (\d+) условных единиц/)![1]);

console.log("1. Document → data.ts");
check(Object.keys(docDistricts).length === 5, "5 districts parsed");
check(Object.keys(docMeasures).length === 14, "14 measures parsed");
check(docSynergies.length === 3 && docIncompat.length === 3, "3 synergies and 3 incompatibilities parsed");
check(budget === 100, "budget 100 parsed");
let compared = 0;
for (const d of DISTRICT_IDS) {
  check(DISTRICTS[d].population === docDistricts[d].pop, `${d} population`);
  compared++;
  for (const k of INDICATOR_IDS) {
    check(DISTRICTS[d].baseline[k] === docDistricts[d].values[k], `${d} ${k}`);
    compared++;
  }
}
for (const k of INDICATOR_IDS) {
  check(INDICATORS[k].weight === docWeights[k], `weight ${k}`);
  compared++;
}
for (const id of MEASURE_IDS) {
  const m = MEASURES[id];
  const dm = docMeasures[id];
  check((m.scope === "city") === dm.city, `${id} scope`);
  check(m.cost === dm.cost, `${id} cost`);
  check(m.lag === dm.lag, `${id} lag`);
  check(JSON.stringify(Object.entries(m.effects).sort()) === JSON.stringify(Object.entries(dm.effects).sort()), `${id} effects`);
  compared += 4;
}
for (const s of docSynergies) check(SYNERGIES.some((x) => x.a === s.a && x.b === s.b && x.indicator === s.k && x.bonus === s.bonus), `synergy ${s.a}+${s.b}`);
for (const s of docIncompat) check(INCOMPATIBILITIES.some((x) => x.a === s.a && x.b === s.b && x.sameDistrictOnly === s.sameDistrict), `incompatibility ${s.a}/${s.b}`);
compared += 6;
console.log(`  compared ${compared} values`);

/* ------------------------------------- 2. reference evaluator from text --- */
const DIR_OF: Record<MeasureId, string> = Object.fromEntries(MEASURE_IDS.map((id) => [id, docMeasures[id].direction])) as Record<MeasureId, string>;

function refIssues(plan: Choice[]): Set<IssueCode> {
  const out = new Set<IssueCode>();
  if (plan.length !== 5) out.add("COUNT"); // rule 2: exactly 5
  if (new Set(plan.map((c) => c.measureId)).size !== plan.length) out.add("DUPLICATE"); // rule 3
  if (plan.reduce((s, c) => s + docMeasures[c.measureId].cost, 0) > budget) out.add("BUDGET"); // rule 1
  for (const c of plan) {
    if (!docMeasures[c.measureId].city && c.districtId === null) out.add("DISTRICT_REQUIRED"); // rule 4
    if (docMeasures[c.measureId].city && c.districtId !== null) out.add("DISTRICT_NOT_ALLOWED");
  }
  const perDir = new Map<string, number>();
  for (const c of plan) perDir.set(DIR_OF[c.measureId], (perDir.get(DIR_OF[c.measureId]) ?? 0) + 1);
  if ([...perDir.values()].some((n) => n > 2)) out.add("DIRECTION_LIMIT"); // rule 5
  for (const inc of docIncompat) {
    const a = plan.find((c) => c.measureId === inc.a);
    const b = plan.find((c) => c.measureId === inc.b);
    if (a && b && (!inc.sameDistrict || a.districtId === b.districtId)) out.add("INCOMPATIBLE"); // rule 6
  }
  return out;
}

function refScore(plan: Choice[]): number {
  const I = {} as Record<DistrictId, Record<IndicatorId, number>>;
  for (const d of DISTRICT_IDS) I[d] = { ...docDistricts[d].values };
  for (const c of plan) {
    const m = docMeasures[c.measureId];
    const share = (8 - m.lag) / 8; // «Реализованная доля эффекта равна (8 − L) / 8»
    for (const d of m.city ? DISTRICT_IDS : [c.districtId!]) for (const [k, v] of Object.entries(m.effects)) I[d][k as IndicatorId] += v * share;
  }
  for (const s of docSynergies) {
    const a = plan.find((c) => c.measureId === s.a);
    if (a && plan.some((c) => c.measureId === s.b)) for (const d of docMeasures[s.a].city ? DISTRICT_IDS : [a.districtId!]) I[d][s.k] += s.bonus; // fixed, not lag-scaled
  }
  let nCrit = 0;
  const D = {} as Record<DistrictId, number>;
  for (const d of DISTRICT_IDS) {
    D[d] = 0;
    for (const k of INDICATOR_IDS) {
      const v = Math.min(100, Math.max(0, I[d][k])); // clip after all effects
      if (v < 40) nCrit++; // strictly below 40
      D[d] += docWeights[k] * v;
    }
  }
  const dAvg = DISTRICT_IDS.reduce((s, d) => s + docDistricts[d].pop * D[d], 0);
  return 0.7 * dAvg + 0.3 * Math.min(...DISTRICT_IDS.map((d) => D[d])) - 1 * nCrit;
}

console.log("2. Engine vs reference on every 5-measure combination × every district assignment");
let plans = 0;
let valid = 0;
let maxDiff = 0;
const t0 = Date.now();
const ids = [...MEASURE_IDS];
const combos: MeasureId[][] = [];
const pick = (start: number, acc: MeasureId[]) => {
  if (acc.length === 5) return void combos.push([...acc]);
  for (let i = start; i < ids.length; i++) pick(i + 1, [...acc, ids[i]]);
};
pick(0, []);
for (const combo of combos) {
  // District measures: each of the 5 districts; city measures: null. Plus one "wrong target" variant per measure.
  const options = combo.map((id) => (docMeasures[id].city ? [null] : [...DISTRICT_IDS])) as (DistrictId | null)[][];
  const total = options.reduce((p, o) => p * o.length, 1);
  for (let x = 0; x < total; x++) {
    let y = x;
    const plan: Choice[] = combo.map((measureId, i) => {
      const o = options[i];
      const districtId = o[y % o.length];
      y = Math.floor(y / o.length);
      return { measureId, districtId };
    });
    plans++;
    const expected = refIssues(plan);
    const ev = evaluatePlan(plan);
    const got = new Set(ev.ok ? [] : ev.issues.map((i) => i.code));
    if ([...expected].sort().join() !== [...got].sort().join()) check(false, `validity ${JSON.stringify(plan)} expected [${[...expected]}] got [${[...got]}]`);
    if (ev.ok) {
      valid++;
      const diff = Math.abs(ev.result.score - refScore(plan));
      maxDiff = Math.max(maxDiff, diff);
      if (diff > 1e-9) check(false, `score ${JSON.stringify(plan)} diff ${diff}`);
    }
    if (failures > 20) break;
  }
}
// Wrong targets, wrong counts and duplicates.
const extra: Choice[][] = [
  [{ measureId: "M2", districtId: "nura" }, { measureId: "M4", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M14", districtId: null }],
  [{ measureId: "M1", districtId: null }, { measureId: "M4", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M14", districtId: null }],
  [{ measureId: "M4", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M14", districtId: null }],
  [{ measureId: "M4", districtId: "nura" }, { measureId: "M4", districtId: "esil" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M14", districtId: null }],
];
for (const plan of extra) {
  const expected = refIssues(plan);
  const ev = evaluatePlan(plan);
  const got = new Set(ev.ok ? [] : ev.issues.map((i) => i.code));
  check(!ev.ok && [...expected].every((c) => got.has(c)), `edge case ${JSON.stringify(plan)} expected [${[...expected]}] got [${[...got]}]`);
  plans++;
}
console.log(`  ${plans.toLocaleString("en")} plans compared (${valid.toLocaleString("en")} valid), max |Δscore| = ${maxDiff.toExponential(1)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/* --------------------------------- 3. numbers printed in the document --- */
console.log("3. Reference numbers from the document");
const base = refScore([]);
const example: Choice[] = [
  { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" },
  { measureId: "M12", districtId: null }, { measureId: "M5", districtId: "saryarka" },
];
const ex = evaluatePlan(example);
for (const d of DISTRICT_IDS) {
  const D = INDICATOR_IDS.reduce((s, k) => s + docWeights[k] * docDistricts[d].values[k], 0);
  check(Math.abs(D - docDistricts[d].D) < 0.005, `district ${d} D = ${docDistricts[d].D}`);
}
check(Math.abs(base - 52.55768) < 1e-5, `baseline 52.55768 (got ${base})`);
check(ex.ok && Math.abs(ex.result.score - 56.54307) < 1e-5, `case example 56.54307 (got ${ex.ok ? ex.result.score : "invalid"})`);
check(ex.ok && ex.result.cost === 95 && ex.result.nCrit === 0, "case example cost 95, no critical values");
check(valid === 694395, `valid plans 694 395 (got ${valid})`);
console.log(`  baseline ${base.toFixed(5)}, case example ${ex.ok ? ex.result.score.toFixed(5) : "—"}, valid plans ${valid.toLocaleString("en")}`);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED — engine and data match the case document");
process.exit(failures ? 1 : 0);
