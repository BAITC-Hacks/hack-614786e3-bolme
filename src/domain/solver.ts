import { BUDGET, DECISIONS, INCOMPATIBILITIES, MAX_PER_DIRECTION, MEASURES } from "./data";
import { planCost, simulate, validatePlan } from "./engine";
import { DISTRICT_IDS, MEASURE_IDS } from "./types";
import type { Choice, DirectionId, MeasureId, RuleOptions } from "./types";

function assignments(measureId: MeasureId): Choice[] {
  return MEASURES[measureId].scope === "city"
    ? [{ measureId, districtId: null }]
    : DISTRICT_IDS.map((districtId) => ({ measureId, districtId }));
}

/** Catalog order and district order provide deterministic enumeration and tie breaks. */
export function* enumerateValidPlans(opts: RuleOptions = {}): Generator<{ plan: Choice[]; cost: number }> {
  const selected: MeasureId[] = [];
  const directions = new Map<DirectionId, number>();
  const limit = opts.strictDirections ? 1 : MAX_PER_DIRECTION;

  function* expand(index: number, plan: Choice[], cost: number): Generator<{ plan: Choice[]; cost: number }> {
    if (index === selected.length) {
      if (validatePlan(plan, opts).length === 0) yield { plan: plan.map((choice) => ({ ...choice })), cost };
      return;
    }
    for (const choice of assignments(selected[index])) {
      if (INCOMPATIBILITIES.some((c) => c.sameDistrictOnly && plan.some((previous) =>
        previous.districtId === choice.districtId &&
        ((previous.measureId === c.a && choice.measureId === c.b) || (previous.measureId === c.b && choice.measureId === c.a))))) continue;
      plan.push(choice);
      yield* expand(index + 1, plan, cost);
      plan.pop();
    }
  }

  function* select(start: number, cost: number): Generator<{ plan: Choice[]; cost: number }> {
    if (selected.length === DECISIONS) {
      yield* expand(0, [], cost);
      return;
    }
    const needed = DECISIONS - selected.length;
    for (let index = start; index <= MEASURE_IDS.length - needed; index++) {
      const id = MEASURE_IDS[index];
      const measure = MEASURES[id];
      const count = directions.get(measure.direction) ?? 0;
      if (cost + measure.cost > BUDGET || count >= limit) continue;
      if (INCOMPATIBILITIES.some((c) => !c.sameDistrictOnly &&
        ((c.a === id && selected.includes(c.b)) || (c.b === id && selected.includes(c.a))))) continue;
      selected.push(id);
      directions.set(measure.direction, count + 1);
      yield* select(index + 1, cost + measure.cost);
      directions.set(measure.direction, count);
      selected.pop();
    }
  }
  yield* select(0, 0);
}

export function bestSwaps(plan: Choice[], opts: RuleOptions = {}, limit = 5): Array<{
  plan: Choice[]; score: number; delta: number;
  change: { kind: "replace" | "move"; from: Choice; to: Choice };
}> {
  if (limit <= 0 || validatePlan(plan, opts).length) return [];
  const baseline = simulate(plan).score;
  const results: ReturnType<typeof bestSwaps> = [];
  for (let index = 0; index < plan.length; index++) {
    const from = plan[index];
    for (const id of MEASURE_IDS) {
      if (plan.some((c, i) => i !== index && c.measureId === id)) continue;
      for (const to of assignments(id)) {
        if (from.measureId === to.measureId && from.districtId === to.districtId) continue;
        const candidate = plan.map((c, i) => ({ ...(i === index ? to : c) }));
        if (planCost(candidate) > BUDGET || validatePlan(candidate, opts).length) continue;
        const score = simulate(candidate).score;
        const delta = score - baseline;
        if (delta > 1e-9) results.push({ plan: candidate, score, delta, change: {
          kind: from.measureId === to.measureId ? "move" : "replace", from: { ...from }, to: { ...to },
        } });
      }
    }
  }
  // Explicit canonical tie break also makes recommendations invariant to input order.
  const key = (p: Choice[]) => p.map((c) => `${c.measureId}:${c.districtId ?? ""}`).sort().join("|");
  results.sort((a, b) => {
    const difference = b.score - a.score;
    if (difference) return difference;
    const ka = key(a.plan), kb = key(b.plan);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return results.slice(0, Math.floor(limit));
}

/** Exact subset weights: 1 / (n * choose(n - 1, subsetSize)). */
export function shapley(plan: Choice[]): Array<{ choice: Choice; value: number }> {
  const n = plan.length;
  if (!n) return [];
  const scores = new Map<number, number>();
  const weights = [1 / n];
  for (let size = 1; size < n; size++) weights[size] = weights[size - 1] * size / (n - size);
  // Arithmetic masks avoid JavaScript's signed 32-bit bitwise truncation.
  const has = (mask: number, index: number) => Math.floor(mask / 2 ** index) % 2 === 1;
  for (let mask = 0; mask < 2 ** n; mask++) {
    scores.set(mask, simulate(plan.filter((_, index) => has(mask, index))).score);
  }
  return plan.map((choice, index) => {
    let value = 0;
    for (let mask = 0; mask < 2 ** n; mask++) {
      if (has(mask, index)) continue;
      let size = 0;
      for (let bit = 0; bit < n; bit++) if (has(mask, bit)) size++;
      value += weights[size] * (scores.get(mask + 2 ** index)! - scores.get(mask)!);
    }
    return { choice: { ...choice }, value };
  });
}
