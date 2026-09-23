/**
 * Game mods (P2). They NEVER change the official Score: they read the
 * official SimulationResult and produce a separate, clearly labelled layer.
 * All coefficients below are designer assumptions for the game, not
 * forecasts for Astana. Events are authored (identical for every player).
 */
import { CRITICAL_PENALTY, CRITICAL_THRESHOLD, DISTRICTS, HORIZON_QUARTERS, INDICATORS, WEIGHT_AVG, WEIGHT_MIN } from "./data";
import type { Choice, DistrictId, IndicatorId, IndicatorMatrix, MeasureId, SimulationResult } from "./types";
import { DISTRICT_IDS, INDICATOR_IDS } from "./types";

/* ------------------------------------------------------------ scoring --- */

/** Same formula as the official engine, applied to an arbitrary matrix (mod layer only). */
export function scoreMatrix(m: IndicatorMatrix) {
  let nCrit = 0;
  const D = {} as Record<DistrictId, number>;
  for (const d of DISTRICT_IDS) {
    let s = 0;
    for (const k of INDICATOR_IDS) {
      const v = Math.min(100, Math.max(0, m[d][k]));
      if (v < CRITICAL_THRESHOLD) nCrit++;
      s += INDICATORS[k].weight * v;
    }
    D[d] = s;
  }
  const dAvg = DISTRICT_IDS.reduce((s, d) => s + DISTRICTS[d].population * D[d], 0);
  const dMin = Math.min(...DISTRICT_IDS.map((d) => D[d]));
  return { D, dAvg, dMin, nCrit, score: WEIGHT_AVG * dAvg + WEIGHT_MIN * dMin - CRITICAL_PENALTY * nCrit };
}

const has = (plan: Choice[], id: MeasureId, district?: DistrictId) =>
  plan.some((c) => c.measureId === id && (district === undefined || c.districtId === district || c.districtId === null));

/* -------------------------------------------------------- emergencies --- */

export type EmergencyResponse = { id: string; title: string; cost: number; /** Share of the loss that remains. */ keep: Partial<Record<IndicatorId, number>> & { all?: number } };

export type Emergency = {
  id: string;
  quarter: number;
  season: string;
  districtId: DistrictId;
  title: string;
  story: string;
  /** Loss per affected quarter, indicator points. */
  loss: Partial<Record<IndicatorId, number>>;
  durationQuarters: number;
  responses: EmergencyResponse[];
  /** Preparedness from the signed plan: multiplier on the loss and why. */
  preparedness: (plan: Choice[]) => Array<{ factor: number; why: string; indicators?: IndicatorId[] }>;
};

export const EMERGENCIES: Emergency[] = [
  {
    id: "flood-nura",
    quarter: 2,
    season: "Весна, 2-й квартал",
    districtId: "nura",
    title: "Паводок на Нуре",
    story: "Талые воды подтопили низины: вода в подвалах, объезды, аварийные отключения.",
    loss: { C1: -12, T1: -8, B2: -4 },
    durationQuarters: 2,
    responses: [
      { id: "none", title: "Не вмешиваться", cost: 0, keep: { all: 1 } },
      { id: "barriers", title: "Мешки и временные дамбы", cost: 3, keep: { all: 0.75 } },
      { id: "full", title: "Насосы, дамбы и эвакуация", cost: 9, keep: { all: 0.25 } },
    ],
    preparedness: (plan) => [
      ...(has(plan, "M13", "nura") ? [{ factor: 0.5, why: "модернизированные сети в Нуре (M13)", indicators: ["C1"] as IndicatorId[] }] : []),
      ...(has(plan, "M14") ? [{ factor: 0.8, why: "аварийные бригады и оповещение (M14)" }] : []),
    ],
  },
  {
    id: "heating-almaty",
    quarter: 5,
    season: "Зима, 5-й квартал",
    districtId: "almaty",
    title: "Порыв теплотрассы в Алматы",
    story: "−30 °C, старая магистраль не выдержала: дома без тепла, поток жалоб.",
    loss: { C1: -18, C2: -5 },
    durationQuarters: 1,
    responses: [
      { id: "none", title: "Ждать плановый ремонт", cost: 0, keep: { all: 1 } },
      { id: "bypass", title: "Временный обвод", cost: 4, keep: { all: 0.5 } },
      { id: "full", title: "Ремонт + мобильные котельные", cost: 8, keep: { all: 0.25 } },
    ],
    preparedness: (plan) => [
      ...(has(plan, "M13", "almaty") ? [{ factor: 0.5, why: "модернизация тепло- и водосетей в Алматы (M13)", indicators: ["C1"] as IndicatorId[] }] : []),
      ...(has(plan, "M14") ? [{ factor: 0.8, why: "аварийные бригады и оповещение (M14)" }] : []),
      ...(has(plan, "M12") ? [{ factor: 0.5, why: "цифровая платформа обращений (M12)", indicators: ["C2"] as IndicatorId[] }] : []),
    ],
  },
  {
    id: "smog-saryarka",
    quarter: 5,
    season: "Зима, 5-й квартал",
    districtId: "saryarka",
    title: "Смог над Сарыаркой",
    story: "Инверсия и безветрие: частный сектор топит углём, поликлиники переполнены.",
    loss: { E2: -12, S2: -2 },
    durationQuarters: 1,
    responses: [
      { id: "none", title: "Выпустить предупреждение", cost: 0, keep: { all: 1 } },
      { id: "care", title: "Комнаты чистого воздуха и мобильные врачи", cost: 3, keep: { E2: 1, S2: 0 } },
      { id: "full", title: "Экстренная помощь чистым топливом + врачи", cost: 7, keep: { E2: 0.5, S2: 0 } },
    ],
    preparedness: (plan) => [
      ...(has(plan, "M5", "saryarka") ? [{ factor: 0.5, why: "чистое топливо в Сарыарке (M5)", indicators: ["E2"] as IndicatorId[] }] : []),
      ...(has(plan, "M6") ? [{ factor: 0.8, why: "городская программа озеленения (M6)", indicators: ["E2"] as IndicatorId[] }] : []),
    ],
  },
];

export type EmergencyOutcome = {
  event: Emergency;
  response: EmergencyResponse;
  preparedness: Array<{ factor: number; why: string; indicators?: IndicatorId[] }>;
  /** Time-averaged loss over the 8-quarter horizon, per indicator (negative). */
  averagedLoss: Partial<Record<IndicatorId, number>>;
  /** Loss in the worst quarter itself (what residents feel). */
  peakLoss: Partial<Record<IndicatorId, number>>;
};

export function resolveEmergencies(plan: Choice[], responses: Record<string, string>): EmergencyOutcome[] {
  return EMERGENCIES.map((event) => {
    const response = event.responses.find((r) => r.id === responses[event.id]) ?? event.responses[0];
    const prep = event.preparedness(plan);
    const averagedLoss: Partial<Record<IndicatorId, number>> = {};
    const peakLoss: Partial<Record<IndicatorId, number>> = {};
    for (const [k, v] of Object.entries(event.loss) as [IndicatorId, number][]) {
      let factor = response.keep[k] ?? response.keep.all ?? 1;
      for (const p of prep) if (!p.indicators || p.indicators.includes(k)) factor *= p.factor;
      peakLoss[k] = v * factor;
      averagedLoss[k] = (v * factor * event.durationQuarters) / HORIZON_QUARTERS;
    }
    return { event, response, preparedness: prep, averagedLoss, peakLoss };
  });
}

/* ------------------------------------------------------------ promises --- */

export type PublicPromise = {
  id: string;
  text: string;
  districtId: DistrictId | null;
  check: (r: SimulationResult, plan: Choice[], reserveLeft: number) => boolean;
  proof: (r: SimulationResult, plan: Choice[], reserveLeft: number) => string;
};

const v = (r: SimulationResult, d: DistrictId, k: IndicatorId) => r.indicators[d][k];
const fmt = (x: number) => x.toFixed(1).replace(".", ",");

export const PROMISES: PublicPromise[] = [
  {
    id: "schools-nura",
    text: "Выведу школы Нуры из критической зоны",
    districtId: "nura",
    check: (r) => v(r, "nura", "S1") >= CRITICAL_THRESHOLD,
    proof: (r) => `Школы в Нуре: ${fmt(r.baseline.nura.S1)} → ${fmt(v(r, "nura", "S1"))} (порог 40)`,
  },
  {
    id: "clinic-nura",
    text: "Построю поликлинику в Нуре",
    districtId: "nura",
    check: (_r, plan) => plan.some((c) => c.measureId === "M8" && c.districtId === "nura"),
    proof: (_r, plan) => (plan.some((c) => c.measureId === "M8" && c.districtId === "nura") ? "Поликлиника (M8) в Нуре в плане" : "В плане нет поликлиники в Нуре"),
  },
  {
    id: "smog-saryarka",
    text: "Сарыарка будет дышать чистым воздухом",
    districtId: "saryarka",
    check: (r) => v(r, "saryarka", "E2") >= 50,
    proof: (r) => `Воздух в Сарыарке: ${fmt(r.baseline.saryarka.E2)} → ${fmt(v(r, "saryarka", "E2"))} (обещано ≥ 50)`,
  },
  {
    id: "bridges-esil",
    text: "Разгружу мосты Есиля",
    districtId: "esil",
    check: (r) => v(r, "esil", "T1") >= 52,
    proof: (r) => `Разгрузка дорог в Есиле: ${fmt(r.baseline.esil.T1)} → ${fmt(v(r, "esil", "T1"))} (обещано ≥ 52)`,
  },
  {
    id: "heat-almaty",
    text: "Этой зимой в Алматы не будет аварий отопления",
    districtId: "almaty",
    check: (r) => v(r, "almaty", "C1") >= 60,
    proof: (r) => `ЖКХ в Алматы: ${fmt(r.baseline.almaty.C1)} → ${fmt(v(r, "almaty", "C1"))} (обещано ≥ 60)`,
  },
  {
    id: "reserve",
    text: "Оставлю резерв 15 на чрезвычайные ситуации",
    districtId: null,
    check: (_r, _p, reserve) => reserve >= 15,
    proof: (_r, _p, reserve) => `Резерв после плана и реагирования на ЧС: ${reserve}`,
  },
];

export type PromiseOutcome = { promise: PublicPromise; kept: boolean; proof: string };

export function checkPromises(ids: string[], r: SimulationResult, plan: Choice[], reserveLeft: number): PromiseOutcome[] {
  return PROMISES.filter((p) => ids.includes(p.id)).map((promise) => ({
    promise,
    kept: promise.check(r, plan, reserveLeft),
    proof: promise.proof(r, plan, reserveLeft),
  }));
}

/* --------------------------------------------------------------- anger --- */

export type AngerReason = { text: string; delta: number };
export type AngerLevel = { value: number; label: "спокойно" | "напряжённо" | "гнев"; reasons: AngerReason[] };

const angerLabel = (x: number): AngerLevel["label"] => (x < 35 ? "спокойно" : x < 60 ? "напряжённо" : "гнев");

function critCount(m: IndicatorMatrix, d: DistrictId) {
  return INDICATOR_IDS.filter((k) => m[d][k] < CRITICAL_THRESHOLD).length;
}

/** Anger before any decision: critical indicators and lagging behind the city. */
export function baselineAnger(r: SimulationResult): Record<DistrictId, AngerLevel> {
  const out = {} as Record<DistrictId, AngerLevel>;
  const avg = DISTRICT_IDS.reduce((s, d) => s + DISTRICTS[d].population * r.baselineDistrictScores[d], 0);
  for (const d of DISTRICT_IDS) {
    const reasons: AngerReason[] = [{ text: "Фон", delta: 25 }];
    const c = critCount(r.baseline, d);
    if (c) reasons.push({ text: `Критических показателей: ${c}`, delta: 14 * c });
    const gap = avg - r.baselineDistrictScores[d];
    if (gap > 0) reasons.push({ text: "Район отстаёт от города", delta: Math.round(2.5 * gap) });
    const value = Math.max(0, Math.min(100, reasons.reduce((s, x) => s + x.delta, 0)));
    out[d] = { value, label: angerLabel(value), reasons };
  }
  return out;
}

/** Anger after the plan, emergencies and promises. */
export function resultAnger(
  r: SimulationResult,
  emergencies: EmergencyOutcome[] | null,
  promises: PromiseOutcome[] | null,
): Record<DistrictId, AngerLevel> {
  const base = baselineAnger(r);
  const out = {} as Record<DistrictId, AngerLevel>;
  for (const d of DISTRICT_IDS) {
    const reasons: AngerReason[] = [...base[d].reasons];
    const fixed = critCount(r.baseline, d) - critCount(r.indicators, d);
    if (fixed > 0) reasons.push({ text: `Устранены критические проблемы: ${fixed}`, delta: -14 * fixed });
    if (fixed < 0) reasons.push({ text: `Новые критические проблемы: ${-fixed}`, delta: 14 * -fixed });
    const gain = r.districtScores[d] - r.baselineDistrictScores[d];
    if (gain > 0.05) reasons.push({ text: "Жизнь в районе заметно улучшилась", delta: -Math.round(4 * gain) });
    for (const e of emergencies ?? []) {
      if (e.event.districtId !== d) continue;
      if (e.response.id === "none") reasons.push({ text: `${e.event.title}: власть не вмешалась`, delta: 18 });
      else if (e.response.id !== "full") reasons.push({ text: `${e.event.title}: помощь частичная`, delta: 7 });
      else reasons.push({ text: `${e.event.title}: быстрая реакция`, delta: -4 });
    }
    for (const p of promises ?? []) {
      if (p.promise.districtId !== null && p.promise.districtId !== d) continue;
      const w = p.promise.districtId === null ? 6 : 20;
      reasons.push(p.kept ? { text: `Обещание выполнено: «${p.promise.text}»`, delta: -Math.round(w / 2) } : { text: `Обещание нарушено: «${p.promise.text}»`, delta: w });
    }
    const value = Math.max(0, Math.min(100, reasons.reduce((s, x) => s + x.delta, 0)));
    out[d] = { value, label: angerLabel(value), reasons };
  }
  return out;
}

/* ------------------------------------------------------- mod summary --- */

export type ModsOutcome = {
  emergencies: EmergencyOutcome[] | null;
  promises: PromiseOutcome[] | null;
  anger: Record<DistrictId, AngerLevel> | null;
  reserveStart: number;
  reserveSpent: number;
  reserveLeft: number;
  /** Official formula on indicators after emergency losses (experimental, not the official Score). */
  stressedScore: number | null;
  stressedMatrix: IndicatorMatrix | null;
};

export function runMods(
  r: SimulationResult,
  plan: Choice[],
  mods: { emergencies: boolean; anger: boolean; promises: boolean },
  responses: Record<string, string>,
  promiseIds: string[],
): ModsOutcome {
  const reserveStart = r.remaining;
  const emergencies = mods.emergencies ? resolveEmergencies(plan, responses) : null;
  const reserveSpent = emergencies?.reduce((s, e) => s + e.response.cost, 0) ?? 0;
  const reserveLeft = reserveStart - reserveSpent;
  let stressedMatrix: IndicatorMatrix | null = null;
  let stressedScore: number | null = null;
  if (emergencies) {
    stressedMatrix = JSON.parse(JSON.stringify(r.indicators)) as IndicatorMatrix;
    for (const e of emergencies)
      for (const [k, loss] of Object.entries(e.averagedLoss) as [IndicatorId, number][])
        stressedMatrix[e.event.districtId][k] = Math.min(100, Math.max(0, stressedMatrix[e.event.districtId][k] + loss));
    stressedScore = scoreMatrix(stressedMatrix).score;
  }
  const promises = mods.promises ? checkPromises(promiseIds, r, plan, reserveLeft) : null;
  const anger = mods.anger ? resultAnger(r, emergencies, promises) : null;
  return { emergencies, promises, anger, reserveStart, reserveSpent, reserveLeft, stressedScore, stressedMatrix };
}
