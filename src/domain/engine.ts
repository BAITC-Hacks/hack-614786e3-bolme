import {
  BUDGET, CRITICAL_PENALTY, CRITICAL_THRESHOLD, DECISIONS, DIRECTIONS,
  DISTRICTS, HORIZON_QUARTERS, INCOMPATIBILITIES, INDICATORS,
  MAX_PER_DIRECTION, MEASURES, SYNERGIES, WEIGHT_AVG, WEIGHT_MIN,
} from "./data";
import { DIRECTION_IDS, DISTRICT_IDS, INDICATOR_IDS, MEASURE_IDS } from "./types";
import type {
  Choice, CriticalPair, DistrictId, Evaluation, IndicatorMatrix,
  RuleOptions, SimulationResult, ValidationIssue,
} from "./types";

const knownMeasure = (id: Choice["measureId"]) => Object.hasOwn(MEASURES, id);
const knownDistrict = (id: DistrictId) => Object.hasOwn(DISTRICTS, id);

function ordered(plan: Choice[]): Choice[] {
  return [...plan].sort((a, b) => {
    const measureOrder = MEASURE_IDS.indexOf(a.measureId) - MEASURE_IDS.indexOf(b.measureId);
    if (measureOrder) return measureOrder;
    const aKey = `${a.measureId}:${a.districtId ?? ""}`;
    const bKey = `${b.measureId}:${b.districtId ?? ""}`;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
}

function baselineMatrix(): IndicatorMatrix {
  return Object.fromEntries(DISTRICT_IDS.map((id) => [id, { ...DISTRICTS[id].baseline }])) as IndicatorMatrix;
}

function summarize(indicators: IndicatorMatrix) {
  const districtScores = {} as Record<DistrictId, number>;
  const criticalPairs: CriticalPair[] = [];
  let dAvg = 0;
  let dMin = Infinity;
  let weakestDistrict: DistrictId = DISTRICT_IDS[0];
  for (const districtId of DISTRICT_IDS) {
    let total = 0;
    for (const indicator of INDICATOR_IDS) {
      const value = indicators[districtId][indicator];
      total += INDICATORS[indicator].weight * value;
      if (value < CRITICAL_THRESHOLD) criticalPairs.push({ districtId, indicator, value });
    }
    districtScores[districtId] = total;
    dAvg += DISTRICTS[districtId].population * total;
    if (total < dMin) {
      dMin = total;
      weakestDistrict = districtId;
    }
  }
  return {
    districtScores, dAvg, dMin, weakestDistrict, criticalPairs,
    nCrit: criticalPairs.length,
    score: WEIGHT_AVG * dAvg + WEIGHT_MIN * dMin - CRITICAL_PENALTY * criticalPairs.length,
  };
}

const baselineSummary = summarize(baselineMatrix());

/** Unknown IDs have no catalog cost; validation reports them independently. */
export function planCost(plan: Choice[]): number {
  return plan.reduce((sum, choice) => sum + (knownMeasure(choice.measureId) ? MEASURES[choice.measureId].cost : 0), 0);
}

/** No plan validation: also supports previews, repeated effects and Shapley subsets. */
export function simulate(plan: Choice[]): SimulationResult {
  const indicators = baselineMatrix();
  const contributions: SimulationResult["contributions"] = [];
  const synergies: SimulationResult["synergies"] = [];
  const choices = ordered(plan);
  for (const choice of choices) {
    const measure = MEASURES[choice.measureId];
    const districts = measure.scope === "city" ? DISTRICT_IDS : [choice.districtId!];
    const factor = (HORIZON_QUARTERS - measure.lag) / HORIZON_QUARTERS;
    for (const districtId of districts) {
      for (const indicator of INDICATOR_IDS) {
        const effect = measure.effects[indicator];
        if (effect === undefined) continue;
        const amount = effect * factor;
        indicators[districtId][indicator] += amount;
        contributions.push({ measureId: measure.id, districtId, indicator, amount, kind: "effect" });
      }
    }
  }
  for (const synergy of SYNERGIES) {
    const first = choices.find((choice) => choice.measureId === synergy.a);
    if (!first || !choices.some((choice) => choice.measureId === synergy.b)) continue;
    const districts = MEASURES[synergy.a].scope === "city" ? DISTRICT_IDS : [first.districtId!];
    for (const districtId of districts) {
      indicators[districtId][synergy.indicator] += synergy.bonus;
      synergies.push({ ...synergy, districtId });
      contributions.push({ measureId: synergy.a, districtId, indicator: synergy.indicator, amount: synergy.bonus, kind: "synergy" });
    }
  }
  // Clip once, after all positive/negative effects and fixed synergy bonuses.
  for (const districtId of DISTRICT_IDS) {
    for (const indicator of INDICATOR_IDS) {
      indicators[districtId][indicator] = Math.max(0, Math.min(100, indicators[districtId][indicator]));
    }
  }
  const cost = planCost(plan);
  return {
    cost, remaining: BUDGET - cost, baseline: baselineMatrix(), indicators,
    baselineDistrictScores: { ...baselineSummary.districtScores },
    baselineScore: baselineSummary.score, ...summarize(indicators), synergies, contributions,
  };
}

function checkRules(plan: Choice[], opts: RuleOptions, partial: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const choices = ordered(plan);
  if (partial ? plan.length > DECISIONS : plan.length !== DECISIONS) {
    issues.push({ code: "COUNT", message: partial ? `Нельзя выбрать больше ${DECISIONS} решений.` : `Нужно выбрать ровно ${DECISIONS} решений.` });
  }
  const groups = new Map<Choice["measureId"], Choice[]>();
  for (const choice of choices) {
    const group = groups.get(choice.measureId) ?? [];
    group.push(choice);
    groups.set(choice.measureId, group);
  }
  for (const [id, group] of groups) {
    if (group.length > 1) issues.push({ code: "DUPLICATE", message: `Мера ${id} выбрана повторно.`, measureIds: [id] });
  }
  const cost = planCost(plan);
  if (cost > BUDGET) issues.push({ code: "BUDGET", message: `Стоимость ${cost} превышает бюджет ${BUDGET}.` });
  for (const direction of DIRECTION_IDS) {
    const ids = choices.filter((c) => knownMeasure(c.measureId) && MEASURES[c.measureId].direction === direction).map((c) => c.measureId);
    const limit = opts.strictDirections ? 1 : MAX_PER_DIRECTION;
    if (ids.length > limit || (opts.strictDirections && !partial && ids.length !== 1)) {
      issues.push({ code: "DIRECTION_LIMIT", message: opts.strictDirections
        ? `Направление «${DIRECTIONS[direction].short}»: нужна ровно одна мера.`
        : `Направление «${DIRECTIONS[direction].short}»: допускается не более ${limit} мер.`, measureIds: ids });
    }
  }
  for (const choice of choices) {
    const { measureId, districtId } = choice;
    if (districtId != null && !knownDistrict(districtId)) {
      issues.push({ code: "UNKNOWN_DISTRICT", message: `Неизвестный район: ${districtId}.`, measureIds: [measureId] });
    }
    if (!knownMeasure(measureId)) {
      issues.push({ code: "UNKNOWN_MEASURE", message: `Неизвестная мера: ${measureId}.`, measureIds: [measureId] });
      continue;
    }
    const measure = MEASURES[measureId];
    if (measure.scope === "district" && districtId == null) {
      issues.push({ code: "DISTRICT_REQUIRED", message: `Для меры ${measureId} нужно выбрать район.`, measureIds: [measureId] });
    }
    if (measure.scope === "city" && districtId != null) {
      issues.push({ code: "DISTRICT_NOT_ALLOWED", message: `Мера ${measureId} действует на весь город: район не указывается.`, measureIds: [measureId] });
    }
  }
  for (const conflict of INCOMPATIBILITIES) {
    const a = groups.get(conflict.a);
    const b = groups.get(conflict.b);
    if (a && b && (!conflict.sameDistrictOnly || a.some((first) =>
      first.districtId != null && knownDistrict(first.districtId) && b.some((second) => first.districtId === second.districtId)))) {
      issues.push({ code: "INCOMPATIBLE", message: conflict.reason, measureIds: [conflict.a, conflict.b] });
    }
  }
  return issues;
}

export function validatePlan(plan: Choice[], opts: RuleOptions = {}): ValidationIssue[] {
  return checkRules(plan, opts, false);
}

export function evaluatePlan(plan: Choice[], opts: RuleOptions = {}): Evaluation {
  const issues = validatePlan(plan, opts);
  return issues.length ? { ok: false, issues, result: null } : { ok: true, issues: [], result: simulate(plan) };
}

export function issuesForAdding(plan: Choice[], choice: Choice, opts: RuleOptions = {}): ValidationIssue[] {
  return checkRules([...plan, choice], opts, true);
}
