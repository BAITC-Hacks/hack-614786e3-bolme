/**
 * Everything the result screen and the AI need, computed by code from a plan.
 * Shared by the browser (instant result) and /api/analyze (grounded AI input).
 */
import { DISTRICTS, MEASURES } from "@/domain/data";
import { evaluatePlan } from "@/domain/engine";
import { runMods, type ModsOutcome } from "@/domain/mods";
import { rankInfo } from "@/domain/rank";
import { bestSwaps, shapley } from "@/domain/solver";
import type { Choice, SimulationResult, ValidationIssue } from "@/domain/types";
import { buildFacts, choiceLabel, type FactContext, type SwapSuggestion } from "./report";

export type ModsInput = {
  mods: { emergencies: boolean; anger: boolean; promises: boolean };
  responses: Record<string, string>;
  promiseIds: string[];
};

export type Analysis = {
  result: SimulationResult;
  rank: ReturnType<typeof rankInfo>;
  shapley: Array<{ choice: Choice; value: number }>;
  swaps: SwapSuggestion[];
  mods: ModsOutcome;
  facts: FactContext;
};

const where = (c: Choice) => (c.districtId ? DISTRICTS[c.districtId].name : "весь город");

export function swapTitle(change: { kind: "replace" | "move"; from: Choice; to: Choice }): string {
  if (change.kind === "move") return `Перенести «${MEASURES[change.from.measureId].title}» из района ${where(change.from)} в ${where(change.to)}`;
  return `Заменить «${MEASURES[change.from.measureId].title}» (${where(change.from)}) на «${MEASURES[change.to.measureId].title}» (${where(change.to)})`;
}

export function analyzePlan(plan: Choice[], modsInput: ModsInput): { ok: true; analysis: Analysis } | { ok: false; issues: ValidationIssue[] } {
  const evaluation = evaluatePlan(plan);
  if (!evaluation.ok) return { ok: false, issues: evaluation.issues };
  const result = evaluation.result;
  const rank = rankInfo(result.score);
  const sh = shapley(plan);
  const swaps: SwapSuggestion[] = bestSwaps(plan, undefined, 3).map((s) => ({ title: swapTitle(s.change), delta: s.delta, score: s.score, plan: s.plan }));
  const mods = runMods(result, plan, modsInput.mods, modsInput.responses, modsInput.promiseIds);
  const facts = buildFacts(plan, result, { rank, shapley: sh, swaps, mods });
  return { ok: true, analysis: { result, rank, shapley: sh, swaps, mods, facts } };
}

export const contributionsOf = (a: Analysis) => a.shapley.map((s) => ({ label: choiceLabel(s.choice), value: s.value }));

/** Validates the shape of an API request body. Rule violations are left to the engine (it returns reasons). */
export function parseRequest(body: unknown): { ok: true; plan: Choice[]; modsInput: ModsInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Ожидается JSON-объект" };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.plan) || b.plan.length > 20) return { ok: false, error: "plan: ожидается массив решений" };
  const plan: Choice[] = [];
  for (const c of b.plan) {
    if (!c || typeof c !== "object") return { ok: false, error: "plan: каждое решение — объект { measureId, districtId }" };
    const { measureId, districtId } = c as Record<string, unknown>;
    if (typeof measureId !== "string" || !(districtId === null || typeof districtId === "string"))
      return { ok: false, error: "plan: measureId — строка, districtId — строка или null" };
    plan.push({ measureId, districtId } as Choice);
  }
  const m = (b.mods ?? {}) as Record<string, unknown>;
  const responses = b.responses && typeof b.responses === "object" ? (b.responses as Record<string, unknown>) : {};
  return {
    ok: true,
    plan,
    modsInput: {
      mods: { emergencies: m.emergencies === true, anger: m.anger === true, promises: m.promises === true },
      responses: Object.fromEntries(Object.entries(responses).filter(([, v]) => typeof v === "string")) as Record<string, string>,
      promiseIds: Array.isArray(b.promiseIds) ? b.promiseIds.filter((x): x is string => typeof x === "string") : [],
    },
  };
}

/** Seed of the social feed: same plan, responses and promises => same reactions (order-independent). */
export function socialSeed(plan: Choice[], m: Pick<ModsInput, "responses" | "promiseIds">): string {
  return JSON.stringify({ plan: [...plan].sort((a, b) => a.measureId.localeCompare(b.measureId)), responses: m.responses, promises: [...m.promiseIds].sort() });
}
