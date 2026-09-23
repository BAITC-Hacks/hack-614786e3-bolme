import test from "node:test";
import assert from "node:assert/strict";
import { BUDGET, DATASET_VERSION, DISTRICTS, MEASURES } from "./data";
import { evaluatePlan, issuesForAdding, planCost, simulate, validatePlan } from "./engine";
import { bestSwaps, enumerateValidPlans, shapley } from "./solver";
import { rankInfo } from "./rank";
import generated from "./generated/solver.json";
import { DISTRICT_IDS, INDICATOR_IDS, MEASURE_IDS } from "./types";
import type { Choice, DistrictId, IssueCode, MeasureId } from "./types";

const c = (measureId: MeasureId, districtId: DistrictId | null = null): Choice => ({ measureId, districtId });
const example = [c("M7", "nura"), c("M8", "nura"), c("M10", "nura"), c("M12"), c("M5", "saryarka")];
const optimum = [c("M2"), c("M3", "nura"), c("M8", "nura"), c("M9", "nura"), c("M14")];
const strictOptimum = [c("M3", "nura"), c("M4", "nura"), c("M8", "nura"), c("M10", "nura"), c("M14")];
const trap = [c("M9", "baikonur"), c("M11", "almaty"), c("M10", "baikonur"), c("M12"), c("M4", "baikonur")];
const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} (±${tolerance})`);
const codes = (plan: Choice[]) => validatePlan(plan).map((issue) => issue.code);
const key = (plan: Choice[]) => plan.map((choice) => `${choice.measureId}:${choice.districtId ?? ""}`).sort().join("|");

function* permutations<T>(items: T[]): Generator<T[]> {
  if (!items.length) { yield []; return; }
  for (let index = 0; index < items.length; index++) {
    for (const rest of permutations(items.filter((_, i) => i !== index))) yield [items[index], ...rest];
  }
}

test("A1 same budget and data: exact baseline and district table", () => {
  assert.equal(BUDGET, 100);
  const result = simulate([]);
  close(result.score, 52.55768, 1e-5);
  close(result.dAvg, 56.8624);
  close(result.dMin, 49.18);
  assert.equal(result.nCrit, 2);
  assert.equal(result.weakestDistrict, "nura");
  assert.deepEqual(result.criticalPairs, [
    { districtId: "nura", indicator: "S1", value: 38 },
    { districtId: "nura", indicator: "S2", value: 35 },
  ]);
  const table = [62.99, 57.06, 54.65, 56.63, 49.18];
  DISTRICT_IDS.forEach((id, i) => close(result.districtScores[id], table[i], 0.005));
  assert.deepEqual(result.districtScores, result.baselineDistrictScores);
  assert.deepEqual(result.indicators, result.baseline);
  assert.equal(result.score, result.baselineScore);
  assert.equal(result.cost, 0);
  assert.equal(result.remaining, 100);
});

test("A2 budget cannot be exceeded: invalid plans receive no score", () => {
  const plan = [c("M3", "nura"), c("M5", "nura"), c("M7", "nura"), c("M8", "nura"), c("M14")];
  assert.equal(planCost(plan), 115);
  const evaluation = evaluatePlan(plan);
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.result, null);
  assert.deepEqual(evaluation.issues.map((issue) => issue.code), ["BUDGET"]);
  assert.ok(issuesForAdding(plan.slice(0, 4), plan[4]).some((issue) => issue.code === "BUDGET"));
});

test("A2 budget cannot be exceeded: exactly 100 is allowed and remainder has no bonus", () => {
  const plan = [c("M2"), c("M3", "nura"), c("M4", "nura"), c("M9", "nura"), c("M13", "nura")];
  // Use the known 98-cost optimum plus a 2-cost replacement to reach 100.
  const exact = optimum.map((choice) => choice.measureId === "M9" ? c("M10", "nura") : choice);
  assert.equal(planCost(exact), 100);
  assert.equal(evaluatePlan(exact).ok, true);
  assert.equal(simulate(exact).remaining, 0);
  assert.equal(planCost(plan), 105);
  const result = simulate(example);
  close(result.score, 0.7 * result.dAvg + 0.3 * result.dMin - result.nCrit);
  assert.equal(result.remaining, 5);
});

test("A3 decisions change indicators: district scope, city scope and M3 lag", () => {
  const district = simulate([c("M3", "nura")]);
  assert.equal(district.indicators.nura.T1, 63);
  assert.equal(district.indicators.nura.T2, 50);
  assert.equal(district.indicators.nura.E2, 67);
  for (const id of DISTRICT_IDS.filter((id) => id !== "nura")) assert.deepEqual(district.indicators[id], DISTRICTS[id].baseline);
  assert.deepEqual(district.contributions.find((row) => row.indicator === "T1"),
    { measureId: "M3", districtId: "nura", indicator: "T1", amount: 8, kind: "effect" });
  const city = simulate([c("M2")]);
  for (const id of DISTRICT_IDS) {
    assert.equal(city.indicators[id].T1, DISTRICTS[id].baseline.T1 + 3);
    assert.equal(city.indicators[id].B2, DISTRICTS[id].baseline.B2 + 2.25);
  }
  assert.equal(city.contributions.length, 10);
});

test("A3 decisions change indicators: fixed synergy in the first measure's district", () => {
  const result = simulate([c("M12"), c("M10", "nura")]);
  assert.equal(result.indicators.nura.B1, 55 + 10.5 + 2);
  assert.equal(result.indicators.esil.B1, 78);
  assert.deepEqual(result.synergies, [{ a: "M10", b: "M12", districtId: "nura", indicator: "B1", bonus: 2 }]);
  assert.deepEqual(result.contributions.filter((row) => row.kind === "synergy"),
    [{ measureId: "M10", districtId: "nura", indicator: "B1", amount: 2, kind: "synergy" }]);
  assert.equal(simulate([c("M10", "nura")]).synergies.length, 0);
  assert.equal(simulate([c("M12")]).synergies.length, 0);
  const other = simulate([c("M1", "almaty"), c("M2"), c("M5", "saryarka"), c("M6")]);
  assert.equal(other.indicators.almaty.T1, 40 + 4.5 + 3 + 2);
  assert.equal(other.indicators.saryarka.E2, 40 + 8.75 + 1.5 + 2);
  assert.equal(other.synergies.length, 2);
});

test("A3 decisions change indicators: clipping happens after every effect is summed", () => {
  const high = simulate(Array.from({ length: 10 }, () => c("M3", "almaty")));
  assert.equal(high.indicators.almaty.T1, 100);
  const mixed = simulate([
    ...Array.from({ length: 8 }, () => c("M3", "almaty")),
    ...Array.from({ length: 20 }, () => c("M11", "almaty")),
  ]);
  assert.equal(mixed.indicators.almaty.T1, 40 + 8 * 8 - 20 * 1.75);
  assert.equal(simulate(Array.from({ length: 40 }, () => c("M11", "almaty"))).indicators.almaty.T1, 0);
});

test("A3 decisions change indicators: exactly 40 is safe and M11 can create a critical pair", () => {
  assert.ok(!simulate([]).criticalPairs.some((pair) => pair.value === 40));
  const result = simulate([c("M11", "almaty")]);
  assert.equal(result.indicators.almaty.T1, 38.25);
  assert.equal(result.nCrit, 3);
  assert.ok(result.criticalPairs.some((pair) => pair.districtId === "almaty" && pair.indicator === "T1"));
  assert.equal(result.contributions.find((row) => row.indicator === "T1")?.amount, -1.75);
});

test("A3 decisions change indicators: contributions reconstruct all unclipped changes", () => {
  const result = simulate(example);
  for (const district of DISTRICT_IDS) for (const indicator of INDICATOR_IDS) {
    const amount = result.contributions.filter((row) => row.districtId === district && row.indicator === indicator)
      .reduce((sum, row) => sum + row.amount, 0);
    close(result.indicators[district][indicator], Math.max(0, Math.min(100, result.baseline[district][indicator] + amount)));
  }
});

test("A5 changing decisions changes the Score: case example and global optimum", () => {
  assert.equal(evaluatePlan(example).ok, true);
  assert.equal(evaluatePlan(optimum).ok, true);
  const result = simulate(example);
  assert.equal(result.cost, 95);
  close(result.score, 56.54307, 1e-5);
  close(result.dAvg, 58.0776);
  close(result.dMin, 52.9625);
  assert.equal(result.weakestDistrict, "nura");
  assert.equal(result.nCrit, 0);
  close(simulate(optimum).score, 57.236735, 1e-6);
  assert.notEqual(result.score, simulate(optimum).score);
});

test("Golden extra: trap plan, relocation and strict optimum", () => {
  assert.equal(evaluatePlan(trap).ok, true);
  assert.equal(planCost(trap), 61);
  close(simulate(trap).score, 52.42381625);
  close(simulate(trap.map((choice) => choice.measureId === "M11" ? c("M11", "baikonur") : choice)).score, 53.36452625);
  assert.equal(evaluatePlan(strictOptimum, { strictDirections: true }).ok, true);
  close(simulate(strictOptimum).score, 56.34451);
});

const minimalFailures: Array<[IssueCode, Choice[]]> = [
  ["COUNT", []],
  ["DUPLICATE", [c("M12"), c("M12")]],
  ["BUDGET", [c("M3", "nura"), c("M5", "nura"), c("M7", "nura"), c("M13", "esil")]],
  ["DIRECTION_LIMIT", [c("M7", "nura"), c("M8", "nura"), c("M9", "nura")]],
  ["DISTRICT_REQUIRED", [c("M1")]],
  ["DISTRICT_NOT_ALLOWED", [c("M2", "nura")]],
  ["UNKNOWN_MEASURE", [c("M404" as MeasureId)]],
  ["UNKNOWN_DISTRICT", [c("M1", "unknown" as DistrictId)]],
  ["INCOMPATIBLE", [c("M1", "nura"), c("M3", "esil")]],
];
for (const [code, plan] of minimalFailures) test(`Rules: minimal failing plan produces ${code}`, () => {
  const issues = validatePlan(plan);
  assert.ok(issues.some((issue) => issue.code === code));
  assert.ok(issues.every((issue) => /[А-Яа-яЁё]/.test(issue.message)));
  assert.equal(evaluatePlan(plan).result, null);
});

test("Rules: all violations are returned, including malformed runtime IDs", () => {
  const plan = [c("M1"), c("M1"), c("M3", "esil"), c("M2", "nura"), c("M404" as MeasureId, "unknown" as DistrictId), c("M13", "nura")];
  assert.deepEqual(new Set(codes(plan)), new Set<IssueCode>([
    "COUNT", "DUPLICATE", "BUDGET", "DIRECTION_LIMIT", "DISTRICT_REQUIRED",
    "DISTRICT_NOT_ALLOWED", "UNKNOWN_MEASURE", "UNKNOWN_DISTRICT", "INCOMPATIBLE",
  ]));
  assert.ok(codes([c("toString" as MeasureId)]).includes("UNKNOWN_MEASURE"));
  assert.ok(codes([c("M1", "toString" as DistrictId)]).includes("UNKNOWN_DISTRICT"));
});

test("Rules: permutation invariance for results, violations and partial additions", () => {
  const expected = simulate(example);
  for (const permutation of permutations(example)) {
    assert.deepEqual(simulate(permutation), expected);
    assert.deepEqual(validatePlan(permutation), []);
  }
  const invalid = [c("M1", "nura"), c("M3", "esil"), c("M4", "nura"), c("M7", "nura"), c("M4", "nura")];
  for (const permutation of permutations(invalid)) assert.deepEqual(validatePlan(permutation), validatePlan(invalid));
  const partial = example.slice(0, 4);
  for (const permutation of permutations(partial)) assert.deepEqual(issuesForAdding(permutation, example[4]), []);
});

test("Rules: global and district-only incompatibilities", () => {
  assert.ok(codes([c("M1", "nura"), c("M3", "esil")]).includes("INCOMPATIBLE"));
  for (const [a, b] of [["M4", "M7"], ["M5", "M13"]] as const) {
    assert.ok(!codes([c(a, "nura"), c(b, "esil")]).includes("INCOMPATIBLE"));
    assert.ok(codes([c(a, "nura"), c(b, "nura")]).includes("INCOMPATIBLE"));
  }
});

test("Rules: partial additions omit incompleteness and block every applicable rule", () => {
  assert.deepEqual(issuesForAdding([], c("M12")), []);
  assert.deepEqual(issuesForAdding([], c("M12"), { strictDirections: true }), []);
  assert.ok(issuesForAdding(example, c("M2")).some((issue) => issue.code === "COUNT"));
  assert.ok(issuesForAdding([c("M12")], c("M12")).some((issue) => issue.code === "DUPLICATE"));
  assert.ok(issuesForAdding([c("M7", "nura"), c("M8", "nura")], c("M9", "nura")).some((issue) => issue.code === "DIRECTION_LIMIT"));
  assert.ok(issuesForAdding([c("M1", "esil")], c("M3", "nura")).some((issue) => issue.code === "INCOMPATIBLE"));
  assert.ok(issuesForAdding([], c("M1")).some((issue) => issue.code === "DISTRICT_REQUIRED"));
  assert.ok(issuesForAdding([], c("M2", "nura")).some((issue) => issue.code === "DISTRICT_NOT_ALLOWED"));
  assert.ok(issuesForAdding([c("M12")], c("M14"), { strictDirections: true }).some((issue) => issue.code === "DIRECTION_LIMIT"));
  assert.ok(validatePlan(example, { strictDirections: true }).some((issue) => issue.code === "DIRECTION_LIMIT"));
  assert.equal(validatePlan([], { strictDirections: true }).filter((issue) => issue.code === "DIRECTION_LIMIT").length, 5);
});

test("Rules: calls do not mutate inputs, data or shared baseline results", () => {
  const before = JSON.stringify({ example, DISTRICTS, MEASURES });
  const result = simulate(example);
  validatePlan(example);
  issuesForAdding(example.slice(0, 4), example[4]);
  bestSwaps(example);
  shapley(example);
  result.baseline.nura.S1 = 999;
  result.baselineDistrictScores.nura = 999;
  result.indicators.esil.T1 = 999;
  assert.equal(JSON.stringify({ example, DISTRICTS, MEASURES }), before);
  assert.equal(simulate([]).baseline.nura.S1, 38);
  close(simulate([]).baselineDistrictScores.nura, 49.18);
});

test("Solver: exhaustive counts, extrema, top plans, Pareto frontier and histogram", () => {
  let count = 0, min = Infinity, max = -Infinity, strictMax = -Infinity;
  const sets = new Set<string>();
  const histogram = generated.histogram.counts.map(() => 0);
  const bestAtCost = new Map<number, number>();
  for (const { plan, cost } of enumerateValidPlans()) {
    count++;
    assert.equal(cost, planCost(plan));
    const score = simulate(plan).score;
    sets.add(plan.map((choice) => choice.measureId).join(","));
    min = Math.min(min, score);
    max = Math.max(max, score);
    if (new Set(plan.map((choice) => MEASURES[choice.measureId].direction)).size === 5) strictMax = Math.max(strictMax, score);
    bestAtCost.set(cost, Math.max(bestAtCost.get(cost) ?? -Infinity, score));
    histogram[Math.floor((score - generated.histogram.min) / generated.histogram.step)]++;
  }
  assert.equal(sets.size, 1181);
  assert.equal(count, 694395);
  close(max, simulate(optimum).score);
  close(strictMax, simulate(strictOptimum).score);
  assert.equal(generated.datasetVersion, DATASET_VERSION);
  assert.equal(generated.rules, "max2-per-direction");
  assert.equal(generated.measureSetCount, sets.size);
  assert.equal(generated.validPlanCount, count);
  assert.equal(generated.minScore, min);
  assert.equal(generated.maxScore, max);
  assert.equal(generated.baselineScore, simulate([]).score);
  assert.equal(generated.histogram.min, min);
  assert.equal(generated.histogram.step, 0.001);
  assert.deepEqual(generated.histogram.counts, histogram);
  assert.equal(histogram.reduce((sum, n) => sum + n, 0), count);
  assert.equal(generated.topPlans.length, 10);
  assert.equal(new Set(generated.topPlans.map((entry) => key(entry.plan as Choice[]))).size, 10);
  assert.equal(generated.optimum.score, max);
  assert.equal(generated.strictOptimum.score, strictMax);
  assert.deepEqual(validatePlan(generated.strictOptimum.plan as Choice[], { strictDirections: true }), []);
  for (const entry of [generated.optimum, generated.strictOptimum, ...generated.topPlans, ...generated.pareto]) {
    assert.deepEqual(validatePlan(entry.plan as Choice[]), []);
    assert.equal(planCost(entry.plan as Choice[]), entry.cost);
    assert.equal(simulate(entry.plan as Choice[]).score, entry.score);
  }
  generated.topPlans.forEach((entry, i) => { if (i) assert.ok(entry.score <= generated.topPlans[i - 1].score); });
  const frontier: Array<{ cost: number; score: number }> = [];
  let best = -Infinity;
  for (const [cost, score] of [...bestAtCost].sort(([a], [b]) => a - b)) {
    if (score > best) { frontier.push({ cost, score }); best = score; }
  }
  assert.deepEqual(generated.pareto.map(({ cost, score }) => ({ cost, score })), frontier);
});

test("Solver: strict enumeration has one measure per direction and finds its optimum", () => {
  let count = 0, max = -Infinity;
  for (const { plan } of enumerateValidPlans({ strictDirections: true })) {
    assert.equal(new Set(plan.map((choice) => MEASURES[choice.measureId].direction)).size, 5);
    max = Math.max(max, simulate(plan).score);
    count++;
  }
  assert.ok(count > 0 && count < 694395);
  close(max, 56.34451);
});

test("Solver: bestSwaps covers every improving neighbor, sorted and valid", () => {
  const base = simulate(example).score;
  const expected = new Map<string, number>();
  for (let index = 0; index < example.length; index++) for (const measureId of MEASURE_IDS) {
    const districts = MEASURES[measureId].scope === "city" ? [null] : DISTRICT_IDS;
    for (const district of districts) {
      const candidate = example.map((choice, i) => i === index ? c(measureId, district) : choice);
      const evaluation = evaluatePlan(candidate);
      if (evaluation.ok && evaluation.result.score - base > 1e-9) expected.set(key(candidate), evaluation.result.score);
    }
  }
  const all = bestSwaps(example, {}, Infinity);
  assert.equal(all.length, expected.size);
  for (const [i, entry] of all.entries()) {
    assert.equal(expected.get(key(entry.plan)), entry.score);
    assert.equal(evaluatePlan(entry.plan).ok, true);
    assert.ok(entry.delta > 1e-9);
    close(entry.delta, entry.score - base);
    assert.equal(entry.plan.filter((choice, index) => key([choice]) !== key([example[index]])).length, 1);
    assert.equal(entry.change.kind, entry.change.from.measureId === entry.change.to.measureId ? "move" : "replace");
    if (i) assert.ok(entry.score <= all[i - 1].score);
  }
  assert.deepEqual(bestSwaps(example), all.slice(0, 5));
  assert.ok(all.length > 0);
  assert.deepEqual(bestSwaps([]), []);
  assert.deepEqual(bestSwaps(example, {}, 0), []);
  assert.deepEqual(bestSwaps(example, { strictDirections: true }), []);
  assert.deepEqual(bestSwaps(optimum), []);
  assert.deepEqual(bestSwaps(strictOptimum, { strictDirections: true }), []);
  assert.ok(bestSwaps(trap, {}, Infinity).some((entry) => entry.change.kind === "move" && entry.change.to.measureId === "M11" && entry.change.to.districtId === "baikonur"));
  assert.deepEqual(bestSwaps([...example].reverse()).map((entry) => key(entry.plan)), bestSwaps(example).map((entry) => key(entry.plan)));
});

test("Solver: exact Shapley efficiency, permutation invariance and permutation oracle", () => {
  for (const plan of [[], [c("M11", "almaty")], example, optimum, strictOptimum, trap]) {
    const result = shapley(plan);
    close(result.reduce((sum, entry) => sum + entry.value, 0), simulate(plan).score - simulate([]).score, 1e-9);
    assert.deepEqual(result.map((entry) => entry.choice), plan);
  }
  const expected = new Map<MeasureId, number>(example.map((choice) => [choice.measureId, 0]));
  for (const permutation of permutations(example)) {
    const subset: Choice[] = [];
    let previous = simulate([]).score;
    for (const choice of permutation) {
      subset.push(choice);
      const score = simulate(subset).score;
      expected.set(choice.measureId, expected.get(choice.measureId)! + (score - previous) / 120);
      previous = score;
    }
  }
  for (const { choice, value } of shapley(example)) close(value, expected.get(choice.measureId)!);
  for (const { choice, value } of shapley([...example].reverse())) close(value, expected.get(choice.measureId)!);
  assert.ok(shapley([c("M11", "almaty")])[0].value < 0);
});

test("Rank: histogram estimate, bounds, potential and independent returned plans", () => {
  const { min, step, counts } = generated.histogram;
  const bin = Math.floor(counts.length / 2);
  const score = min + (bin + 0.5) * step;
  const below = counts.slice(0, bin).reduce((sum, count) => sum + count, 0) + counts[bin] / 2;
  close(rankInfo(score).beatsPercent, below / generated.validPlanCount * 100);
  assert.equal(rankInfo(min - 1).beatsPercent, 0);
  assert.equal(rankInfo(generated.maxScore + 1).beatsPercent, 100);
  close(rankInfo(min).beatsPercent, counts[0] / 2 / generated.validPlanCount * 100);
  assert.equal(rankInfo(generated.baselineScore).potentialPercent, 0);
  assert.equal(rankInfo(generated.maxScore).potentialPercent, 100);
  const result = rankInfo(score);
  assert.equal(result.validPlanCount, 694395);
  close(result.maxScore, 57.236735);
  assert.deepEqual(result.optimum, generated.optimum);
  result.optimum.plan[0].districtId = "almaty";
  assert.deepEqual(rankInfo(score).optimum, generated.optimum);
});
