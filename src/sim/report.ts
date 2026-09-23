/**
 * Grounded AI report: the engine computes a registry of facts, the LLM may
 * reference numbers ONLY as {{fact_id}} placeholders, and this module renders
 * the numbers from the registry. Also builds the deterministic offline report.
 * Pure TS: used by the API route (server) and by the UI types.
 */
import { BUDGET, CRITICAL_THRESHOLD, DISTRICTS, INDICATORS, MEASURES } from "@/domain/data";
import type { ModsOutcome } from "@/domain/mods";
import type { Choice, SimulationResult } from "@/domain/types";
import { DISTRICT_IDS, INDICATOR_IDS } from "@/domain/types";

export type Fact = { id: string; label: string; value: number; unit: "score" | "points" | "budget" | "count" | "percent" | "quarter" };

export type ReportItem = { text: string; factIds: string[] };

export type SwapSuggestion = { title: string; delta: number; score: number; plan: Choice[] };

export type ReportPayload = {
  source: "live" | "offline";
  model?: string;
  note?: string;
  summary: string;
  strengths: ReportItem[];
  risks: ReportItem[];
  consequences: ReportItem[];
  tradeoffs: ReportItem[];
  recommendations: ReportItem[];
  swaps: SwapSuggestion[];
  contributions: Array<{ label: string; value: number }>;
};

export type RawSection = "strengths" | "risks" | "consequences" | "tradeoffs" | "recommendations";
export const SECTIONS: RawSection[] = ["strengths", "risks", "consequences", "tradeoffs", "recommendations"];

export const choiceLabel = (c: Choice) =>
  `${MEASURES[c.measureId].title} (${c.measureId}, ${c.districtId ? DISTRICTS[c.districtId].name : "весь город"})`;

export function formatFact(f: Fact): string {
  const n = (x: number, d: number) => x.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
  switch (f.unit) {
    case "score":
      return n(f.value, 2);
    case "points":
      return n(f.value, 1);
    case "percent":
      return `${n(f.value, 1)}%`;
    case "budget":
      return `${n(f.value, 0)} ед.`;
    case "count":
    case "quarter":
      return n(f.value, 0);
  }
}

export type FactContext = {
  facts: Record<string, Fact>;
  /** Non-numeric context for the model (names, plan, rules). */
  context: Record<string, unknown>;
};

export function buildFacts(
  plan: Choice[],
  r: SimulationResult,
  extras: {
    rank: { beatsPercent: number; potentialPercent: number; maxScore: number };
    shapley: Array<{ choice: Choice; value: number }>;
    swaps: SwapSuggestion[];
    mods: ModsOutcome | null;
  },
): FactContext {
  const facts: Record<string, Fact> = {};
  const add = (id: string, label: string, value: number, unit: Fact["unit"]) => (facts[id] = { id, label, value, unit });

  add("score", "Итоговый Astana QoL Score", r.score, "score");
  add("baseline_score", "Score без решений", r.baselineScore, "score");
  add("score_gain", "Прирост Score к базе", r.score - r.baselineScore, "score");
  add("max_score", "Лучший возможный Score (полный перебор)", extras.rank.maxScore, "score");
  add("beats_percent", "Доля допустимых планов, которые хуже вашего", extras.rank.beatsPercent, "percent");
  add("potential_percent", "Реализовано от максимально возможного прироста", extras.rank.potentialPercent, "percent");
  add("cost", "Потрачено бюджета", r.cost, "budget");
  add("remaining", "Остаток бюджета", r.remaining, "budget");
  add("budget", "Бюджет", BUDGET, "budget");
  add("threshold", "Критический порог показателя", CRITICAL_THRESHOLD, "count");
  add("decisions", "Число решений в плане", plan.length, "count");
  add("horizon", "Горизонт, кварталов", 8, "count");
  add("d_avg", "Средний балл города (по населению)", r.dAvg, "score");
  add("d_min", "Балл самого слабого района", r.dMin, "score");
  add("n_crit", "Критических показателей после плана", r.nCrit, "count");
  add("n_crit_baseline", "Критических показателей в начале", r.criticalPairs.length === r.nCrit ? r.nCrit : r.nCrit, "count");

  let baseCrit = 0;
  for (const d of DISTRICT_IDS) {
    add(`D_${d}_before`, `Балл района ${DISTRICTS[d].name} до`, r.baselineDistrictScores[d], "score");
    add(`D_${d}_after`, `Балл района ${DISTRICTS[d].name} после`, r.districtScores[d], "score");
    for (const k of INDICATOR_IDS) {
      const before = r.baseline[d][k];
      const after = r.indicators[d][k];
      if (before < CRITICAL_THRESHOLD) baseCrit++;
      if (Math.abs(after - before) > 1e-9 || before < CRITICAL_THRESHOLD || after < CRITICAL_THRESHOLD) {
        add(`${d}_${k}_before`, `${INDICATORS[k].name}, ${DISTRICTS[d].name}, до`, before, "points");
        add(`${d}_${k}_after`, `${INDICATORS[k].name}, ${DISTRICTS[d].name}, после`, after, "points");
      }
    }
  }
  facts.n_crit_baseline.value = baseCrit;

  extras.shapley.forEach((s) => add(`contrib_${s.choice.measureId}`, `Вклад в Score: ${choiceLabel(s.choice)}`, s.value, "score"));
  plan.forEach((c) => add(`lag_${c.measureId}`, `Квартал, с которого работает ${c.measureId}`, MEASURES[c.measureId].lag + 1, "quarter"));
  extras.swaps.forEach((s, i) => {
    add(`swap${i + 1}_delta`, `Прирост Score от замены №${i + 1}`, s.delta, "score");
    add(`swap${i + 1}_score`, `Score после замены №${i + 1}`, s.score, "score");
  });

  const m = extras.mods;
  if (m) {
    add("reserve_start", "Резерв после плана", m.reserveStart, "budget");
    add("reserve_spent", "Потрачено резерва на ЧС", m.reserveSpent, "budget");
    add("reserve_left", "Резерв после ЧС", m.reserveLeft, "budget");
    if (m.stressedScore !== null) add("stressed_score", "Score с учётом ЧС (игровой мод, не официальный)", m.stressedScore, "score");
    if (m.anger) for (const d of DISTRICT_IDS) add(`anger_${d}`, `Недовольство, ${DISTRICTS[d].name}`, m.anger[d].value, "count");
  }

  const context = {
    rules: "Синтетический датасет кейса; бюджет 100; ровно 5 решений; горизонт 8 кварталов; эффект меры умножается на (8−лаг)/8; Score = 0.7·средний балл + 0.3·балл самого слабого района − 1 за каждый показатель ниже 40.",
    plan: plan.map((c) => ({
      id: c.measureId,
      title: MEASURES[c.measureId].title,
      where: c.districtId ? DISTRICTS[c.districtId].name : "весь город",
      direction: MEASURES[c.measureId].direction,
      lagFactId: `lag_${c.measureId}`,
      contributionFactId: `contrib_${c.measureId}`,
    })),
    weakestDistrict: DISTRICTS[r.weakestDistrict].name,
    criticalAfter: r.criticalPairs.map((p) => ({ district: DISTRICTS[p.districtId].name, indicator: INDICATORS[p.indicator].name, factId: `${p.districtId}_${p.indicator}_after` })),
    synergies: r.synergies.map((s) => `${s.a}+${s.b}: ${INDICATORS[s.indicator].name} в районе ${DISTRICTS[s.districtId].name}`),
    swaps: extras.swaps.map((s, i) => ({ title: s.title, deltaFactId: `swap${i + 1}_delta`, scoreFactId: `swap${i + 1}_score` })),
    districts: DISTRICT_IDS.map((d) => ({ name: DISTRICTS[d].name, profile: DISTRICTS[d].profile, beforeFactId: `D_${d}_before`, afterFactId: `D_${d}_after` })),
    mods: m
      ? {
          emergencies: m.emergencies?.map((e) => ({ title: e.event.title, district: DISTRICTS[e.event.districtId].name, response: e.response.title, preparedness: e.preparedness.map((p) => p.why) })) ?? null,
          promises: m.promises?.map((p) => ({ text: p.promise.text, kept: p.kept })) ?? null,
          angerFactIds: m.anger ? DISTRICT_IDS.map((d) => `anger_${d}`) : null,
          note: "Моды — игровой слой с допущениями команды; официальный Score они не меняют.",
        }
      : null,
  };
  return { facts, context };
}

/* ------------------------------------------------------ verification --- */

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Render placeholders; reject items that reference unknown facts or contain raw numbers. */
export function renderItem(item: ReportItem, facts: Record<string, Fact>): ReportItem | null {
  let ok = true;
  const used = new Set(item.factIds.filter((id) => facts[id]));
  const withoutPlaceholders = item.text.replace(PLACEHOLDER, (_m, id: string) => {
    if (!facts[id]) ok = false;
    used.add(id);
    return "";
  });
  if (!ok) return null;
  // No raw numbers at all outside placeholders; only measure / indicator codes (M8, S1) may contain digits.
  const stripped = withoutPlaceholders.replace(/\bM\d{1,2}\b/g, "").replace(/\b[TESBC][12]\b/g, "");
  if (/\d/.test(stripped)) return null;
  const text = item.text.replace(PLACEHOLDER, (_m, id: string) => formatFact(facts[id]));
  return { text, factIds: [...used].filter((id) => facts[id]) };
}

/* ---------------------------------------------------- offline report --- */

export function offlineReport(plan: Choice[], r: SimulationResult, fc: FactContext, swaps: SwapSuggestion[], mods: ModsOutcome | null, contributions: ReportPayload["contributions"]): ReportPayload {
  const f = fc.facts;
  const v = (id: string) => (f[id] ? formatFact(f[id]) : "—");
  const item = (text: string, factIds: string[]): ReportItem => ({ text, factIds });

  const byContribution = [...plan].sort((a, b) => (f[`contrib_${b.measureId}`]?.value ?? 0) - (f[`contrib_${a.measureId}`]?.value ?? 0));
  const strengths: ReportItem[] = byContribution.slice(0, 3).map((c) =>
    item(`${MEASURES[c.measureId].title} (${c.districtId ? DISTRICTS[c.districtId].name : "весь город"}) даёт ${v(`contrib_${c.measureId}`)} к Score — это вклад меры с учётом взаимодействий.`, [`contrib_${c.measureId}`]),
  );
  const baseCritFixed = f.n_crit_baseline.value - r.nCrit;
  if (baseCritFixed > 0) strengths.push(item(`Критических показателей стало ${v("n_crit")} вместо ${v("n_crit_baseline")}: штраф за провалы снят.`, ["n_crit", "n_crit_baseline"]));

  const risks: ReportItem[] = [];
  for (const p of r.criticalPairs)
    risks.push(item(`${INDICATORS[p.indicator].name} в районе ${DISTRICTS[p.districtId].name} остаётся ${v(`${p.districtId}_${p.indicator}_after`)} — ниже порога ${v("threshold")}, это штраф −1 к Score.`, [`${p.districtId}_${p.indicator}_after`, "threshold"]));
  risks.push(item(`Самый слабый район после плана — ${DISTRICTS[r.weakestDistrict].name} (${v(`D_${r.weakestDistrict}_after`)}). От него зависит 30% итоговой оценки.`, [`D_${r.weakestDistrict}_after`]));
  // Lag L: the measure works from quarter L+1, i.e. (8 − L) of 8 quarters, so only (8 − L)/8 of its full effect counts.
  for (const lag of [...new Set(plan.map((c) => MEASURES[c.measureId].lag))].filter((l) => l >= 3).sort((a, b) => b - a)) {
    const group = plan.filter((c) => MEASURES[c.measureId].lag === lag);
    risks.push(
      item(
        `${group.map((c) => c.measureId).join(", ")} заработают только с квартала ${v(`lag_${group[0].measureId}`)}: первые ${lag} из 8 кварталов эффекта нет, в итог идёт ${8 - lag}/8 полного эффекта.`,
        group.map((c) => `lag_${c.measureId}`),
      ),
    );
  }
  if (r.remaining > 0) risks.push(item(`Не распределено ${v("remaining")} бюджета: по правилам остаток не даёт бонуса.`, ["remaining"]));

  const consequences: ReportItem[] = DISTRICT_IDS.filter((d) => r.districtScores[d] - r.baselineDistrictScores[d] > 0.05)
    .sort((a, b) => r.districtScores[b] - r.baselineDistrictScores[b] - (r.districtScores[a] - r.baselineDistrictScores[a]))
    .slice(0, 3)
    .map((d) => item(`Район ${DISTRICTS[d].name}: балл ${v(`D_${d}_before`)} → ${v(`D_${d}_after`)}.`, [`D_${d}_before`, `D_${d}_after`]));
  if (mods?.emergencies)
    for (const e of mods.emergencies)
      consequences.push(item(`${e.event.title}: выбрано «${e.response.title}»${e.preparedness.length ? `, смягчает: ${e.preparedness.map((p) => p.why).join(", ")}` : ""}.`, []));

  const tradeoffs: ReportItem[] = [
    item(`Средний балл города ${v("d_avg")}, самый слабый район ${v("d_min")}: формула на 70% ценит весь город и на 30% — отстающего.`, ["d_avg", "d_min"]),
    item(`Потрачено ${v("cost")} из ${v("budget")}; ваш план лучше ${v("beats_percent")} всех допустимых планов и реализует ${v("potential_percent")} возможного прироста.`, ["cost", "budget", "beats_percent", "potential_percent"]),
  ];

  const recommendations: ReportItem[] = swaps.slice(0, 3).map((s, i) => item(`${s.title}: Score вырастет на ${v(`swap${i + 1}_delta`)} до ${v(`swap${i + 1}_score`)}.`, [`swap${i + 1}_delta`, `swap${i + 1}_score`]));
  if (!recommendations.length) recommendations.push(item("Одиночной заменой план не улучшить: это локальный оптимум.", []));
  if (mods?.promises) for (const p of mods.promises.filter((x) => !x.kept)) recommendations.push(item(`Нарушено обещание «${p.promise.text}» — жители это запомнят. ${p.proof}.`.replace(/\d+(?:[.,]\d+)?/g, (x) => x), []));

  return {
    source: "offline",
    note: "Отчёт собран детерминированно из расчёта движка (AI недоступен или ключ не задан).",
    summary: `План стоимостью ${v("cost")} даёт Astana QoL Score ${v("score")} (${r.score >= r.baselineScore ? "+" : ""}${v("score_gain")} к базе ${v("baseline_score")}).`,
    strengths,
    risks,
    consequences,
    tradeoffs,
    recommendations,
    swaps,
    contributions,
  };
}
