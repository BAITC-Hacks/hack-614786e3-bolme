import generated from "./generated/solver.json";
import type { Choice } from "./types";

export type RankInfo = {
  beatsPercent: number;
  potentialPercent: number;
  validPlanCount: number;
  maxScore: number;
  optimum: { plan: Choice[]; score: number; cost: number };
};

const cumulative = [0];
for (const count of generated.histogram.counts) cumulative.push(cumulative[cumulative.length - 1] + count);

/** Percentile is a histogram estimate: half of the queried bin is counted. */
export function rankInfo(score: number): RankInfo {
  const { histogram, validPlanCount, maxScore, baselineScore } = generated;
  const bin = Math.floor((score - histogram.min) / histogram.step);
  const below = score < histogram.min ? 0 : score > maxScore ? validPlanCount
    : (cumulative[bin] ?? 0) + (histogram.counts[bin] ?? 0) / 2;
  return {
    beatsPercent: below / validPlanCount * 100,
    potentialPercent: (score - baselineScore) / (maxScore - baselineScore) * 100,
    validPlanCount, maxScore,
    optimum: { ...generated.optimum, plan: generated.optimum.plan.map((choice) => ({ ...choice })) as Choice[] },
  };
}
