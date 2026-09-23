import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DATASET_VERSION, MEASURES } from "../../src/domain/data";
import { simulate } from "../../src/domain/engine";
import { enumerateValidPlans } from "../../src/domain/solver";
import type { Choice } from "../../src/domain/types";

type ScoredPlan = { plan: Choice[]; score: number; cost: number };

const measureSets = new Set<string>();
const scores: number[] = [];
const topPlans: ScoredPlan[] = [];
const bestByCost = new Map<number, ScoredPlan>();
let optimum: ScoredPlan | undefined;
let strictOptimum: ScoredPlan | undefined;
let minScore = Infinity;
let maxScore = -Infinity;

// One traversal, including strict-mode candidates and the budget frontier.
for (const { plan, cost } of enumerateValidPlans()) {
  const score = simulate(plan).score;
  const entry = { plan, score, cost };
  measureSets.add(plan.map((choice) => choice.measureId).join(","));
  scores.push(score);
  minScore = Math.min(minScore, score);
  maxScore = Math.max(maxScore, score);
  if (!optimum || score > optimum.score) optimum = entry;
  if (new Set(plan.map((c) => MEASURES[c.measureId].direction)).size === 5 &&
      (!strictOptimum || score > strictOptimum.score)) strictOptimum = entry;
  if (!bestByCost.has(cost) || score > bestByCost.get(cost)!.score) bestByCost.set(cost, entry);
  if (topPlans.length < 10 || score > topPlans[topPlans.length - 1].score) {
    topPlans.push(entry);
    topPlans.sort((a, b) => b.score - a.score);
    if (topPlans.length > 10) topPlans.pop();
  }
}
if (!optimum || !strictOptimum) throw new Error("Не найден допустимый план.");

const pareto: ScoredPlan[] = [];
let frontierScore = -Infinity;
for (const cost of [...bestByCost.keys()].sort((a, b) => a - b)) {
  const entry = bestByCost.get(cost)!;
  if (entry.score > frontierScore) {
    pareto.push(entry);
    frontierScore = entry.score;
  }
}
const step = 0.001;
const counts: number[] = Array(Math.floor((maxScore - minScore) / step) + 1).fill(0);
for (const score of scores) counts[Math.floor((score - minScore) / step)]++;

const result = {
  datasetVersion: DATASET_VERSION, rules: "max2-per-direction",
  measureSetCount: measureSets.size, validPlanCount: scores.length,
  baselineScore: simulate([]).score, minScore, maxScore,
  optimum, strictOptimum, topPlans, pareto, histogram: { min: minScore, step, counts },
};
const target = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/domain/generated/solver.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ measureSetCount: result.measureSetCount, validPlanCount: result.validPlanCount,
  minScore, maxScore, optimum, strictOptimum, output: target }, null, 2));
