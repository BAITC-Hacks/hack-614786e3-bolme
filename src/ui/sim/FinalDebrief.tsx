"use client";

/**
 * «Итоговый анализ» — the after-game debrief the case asks for: final
 * scenario assessment, strengths, risks, consequences, trade-offs and
 * recommendations, plus how the city reacted. Every number is from the engine.
 */
import { BUDGET, DIRECTIONS, DISTRICTS, INDICATORS, MEASURES } from "@/domain/data";
import { DIRECTION_IDS, DISTRICT_IDS, INDICATOR_IDS } from "@/domain/types";
import type { Analysis } from "@/sim/analysis";
import { num, signed } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { useSignedAnalysis } from "@/sim/useAnalysis";
import { useReport } from "./AiReport";
import { SocialFeed } from "./SocialFeed";

/** Game rank by the share of the achievable improvement (official Score). */
export function akimRank(potential: number): { title: string; tone: string } {
  if (potential < 0) return { title: "Отставка: хуже, чем ничего не делать", tone: "bad" };
  if (potential >= 95) return { title: "Легендарный аким", tone: "top" };
  if (potential >= 80) return { title: "Сильный аким", tone: "good" };
  if (potential >= 60) return { title: "Крепкий хозяйственник", tone: "good" };
  if (potential >= 35) return { title: "Осторожный аким", tone: "mid" };
  return { title: "Аким-стажёр", tone: "mid" };
}

function Kpis({ a }: { a: Analysis }) {
  const r = a.result;
  const gain = r.score - r.baselineScore;
  const baseCrit = Object.values(r.baseline).reduce((s, row) => s + Object.values(row).filter((v) => v < 40).length, 0);
  const weakestBefore = DISTRICT_IDS.reduce((w, d) => (r.baselineDistrictScores[d] < r.baselineDistrictScores[w] ? d : w), DISTRICT_IDS[0]);
  return (
    <div className="debrief__kpis">
      <div>
        <span>Потрачено</span>
        <b>
          {r.cost} / {BUDGET}
        </b>
        <small>остаток {r.remaining} не даёт бонуса</small>
      </div>
      <div>
        <span>Эффективность</span>
        <b>{signed((gain / Math.max(1, r.cost)) * 10)}</b>
        <small>Score на каждые 10 единиц</small>
      </div>
      <div>
        <span>Критических &lt; 40</span>
        <b>
          {baseCrit} → {r.nCrit}
        </b>
        <small>{r.nCrit < baseCrit ? "штрафы сняты" : r.nCrit > baseCrit ? "новые провалы" : "без изменений"}</small>
      </div>
      <div>
        <span>Слабейший район</span>
        <b>
          {num(r.baselineDistrictScores[weakestBefore], 1)} → {num(r.dMin, 1)}
        </b>
        <small>
          {DISTRICTS[weakestBefore].name} → {DISTRICTS[r.weakestDistrict].name}
        </small>
      </div>
    </div>
  );
}

function BudgetSplit({ a }: { a: Analysis }) {
  const plan = useSimStore((s) => s.plan);
  const byDir = DIRECTION_IDS.map((d) => ({ d, cost: plan.filter((c) => MEASURES[c.measureId].direction === d).reduce((s, c) => s + MEASURES[c.measureId].cost, 0) }));
  return (
    <div className="debrief__card">
      <h3>Куда ушли деньги</h3>
      <div className="debrief__split" aria-hidden>
        {byDir
          .filter((x) => x.cost)
          .map((x) => (
            <span key={x.d} style={{ flex: x.cost, background: DIRECTIONS[x.d].color }} />
          ))}
        {a.result.remaining > 0 && <span style={{ flex: a.result.remaining }} className="is-rest" />}
      </div>
      <ul className="debrief__legend">
        {byDir.map((x) => (
          <li key={x.d} className={x.cost ? "" : "is-zero"}>
            <i style={{ background: DIRECTIONS[x.d].color }} /> {DIRECTIONS[x.d].short} · {x.cost}
          </li>
        ))}
      </ul>
      {byDir
        .filter((x) => !x.cost)
        .map((x) => {
          // Derive the statement from indicator deltas: citywide measures of other directions can still move these indicators.
          const ks = INDICATOR_IDS.filter((k) => INDICATORS[k].direction === x.d);
          const moved = ks.filter((k) => DISTRICT_IDS.some((dd) => Math.abs(a.result.indicators[dd][k] - a.result.baseline[dd][k]) > 1e-9));
          return (
            <p key={x.d} className="sim-note">
              {DIRECTIONS[x.d].short}: без прямых вложений (правила допускают — не более двух мер на направление).{" "}
              {moved.length
                ? `Показатели ${moved.join(", ")} всё равно изменились за счёт мер других направлений.`
                : `Показатели ${ks.join(", ")} остались на исходном уровне.`}
            </p>
          );
        })}
    </div>
  );
}

function BestAkim({ a }: { a: Analysis }) {
  const opt = a.rank.optimum;
  const plan = useSimStore((s) => s.plan);
  const replacePlan = useSimStore((s) => s.replacePlan);
  const same = (c: (typeof plan)[number]) => opt.plan.some((o) => o.measureId === c.measureId && o.districtId === c.districtId);
  const shared = plan.filter(same).length;
  return (
    <div className="debrief__card">
      <h3>А как сделал бы лучший аким?</h3>
      <p>
        Лучший из {a.rank.validPlanCount.toLocaleString("ru-RU")} допустимых планов даёт <b>{num(opt.score)}</b> за {opt.cost}: {opt.plan.map((c) => `${MEASURES[c.measureId].title}${c.districtId ? ` (${DISTRICTS[c.districtId].name})` : ""}`).join(", ")}.
      </p>
      <p className="sim-note">
        Совпадает с вашим планом решений: {shared} из 5. Разрыв до максимума: {num(opt.score - a.result.score)}.
      </p>
      {a.swaps[0] && (
        <p>
          Самый простой шаг: {a.swaps[0].title} → <b>{signed(a.swaps[0].delta)}</b>.
        </p>
      )}
      <button type="button" className="sim-btn sim-btn--small" onClick={() => replacePlan(opt.plan)}>
        Разобрать план лучшего акима
      </button>
    </div>
  );
}

function ModsSummary({ a }: { a: Analysis }) {
  const m = a.mods;
  if (!m.emergencies && !m.promises && !m.anger) return null;
  const avgAnger = m.anger ? DISTRICT_IDS.reduce((s, d) => s + m.anger![d].value * DISTRICTS[d].population, 0) : null;
  return (
    <div className="debrief__card">
      <h3>Город жил своей жизнью</h3>
      <ul className="debrief__list">
        {m.emergencies?.map((e) => (
          <li key={e.event.id}>
            <b>{e.event.title}</b> — {e.response.title.toLowerCase()}
            {e.preparedness.length ? `; смягчило: ${e.preparedness.map((p) => p.why).join(", ")}` : ""}
          </li>
        ))}
        {m.promises?.map((p) => (
          <li key={p.promise.id} className={p.kept ? "is-kept" : "is-broken"}>
            {p.kept ? "Сдержано" : "Нарушено"}: «{p.promise.text}»
          </li>
        ))}
      </ul>
      {m.stressedScore !== null && (
        <p className="sim-note">
          Score с учётом ЧС (игровой мод): {num(m.stressedScore)} · резерв потрачен {m.reserveSpent} из {m.reserveStart}.
        </p>
      )}
      {avgAnger !== null && <p className="sim-note">Среднее недовольство горожан: {Math.round(avgAnger)} / 100.</p>}
    </div>
  );
}

function Sheet({ a }: { a: Analysis }) {
  const setDebriefOpen = useSimStore((s) => s.setDebriefOpen);
  const setBriefOpen = useSimStore((s) => s.setBriefOpen);
  const edit = useSimStore((s) => s.edit);
  const { report, loading } = useReport(a);
  const r = a.result;
  const rank = akimRank(a.rank.potentialPercent);
  const sections: Array<[keyof typeof report & ("strengths" | "risks" | "consequences" | "tradeoffs" | "recommendations"), string]> = [
    ["strengths", "Сильные стороны"],
    ["risks", "Риски"],
    ["consequences", "Последствия для жителей"],
    ["tradeoffs", "Компромиссы"],
    ["recommendations", "Рекомендации"],
  ];
  return (
    <div className="debrief" role="dialog" aria-label="Итоговый анализ">
      <div className="debrief__panel">
        <header className="debrief__head">
          <div>
            <p className="sim-eyebrow">Итоговый анализ сценария · через 2 года</p>
            <h2 className={`debrief__rank is-${rank.tone}`}>{rank.title}</h2>
            <p className="debrief__sub">
              {a.rank.potentialPercent >= 0 ? `Реализовано ${num(a.rank.potentialPercent, 1)}% возможного прироста` : "План хуже, чем ничего не делать"} · лучше {num(a.rank.beatsPercent, 1)}% из{" "}
              {a.rank.validPlanCount.toLocaleString("ru-RU")} допустимых планов
            </p>
          </div>
          <div className="debrief__score">
            <span>Astana QoL Score</span>
            <strong>{num(r.score)}</strong>
            <em className={r.score >= r.baselineScore ? "is-up" : "is-down"}>
              {signed(r.score - r.baselineScore)} к {num(r.baselineScore)}
            </em>
          </div>
        </header>
        <Kpis a={a} />
        <div className="debrief__grid">
          <div className="debrief__card debrief__ai">
            <h3>
              Вывод AI-аналитика <span className={`sim-ai__badge${report.source === "live" ? " is-live" : ""}`}>{loading ? "GPT анализирует…" : report.source === "live" ? `GPT · ${report.model}` : "офлайн-отчёт движка"}</span>
            </h3>
            <p className="debrief__summary">{report.summary}</p>
            {sections.map(([key, title]) => (
              <div key={key}>
                <h4>{title}</h4>
                <ul>
                  {report[key].map((it, i) => (
                    <li key={i}>{it.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="debrief__side">
            <SocialFeed a={a} />
            <BudgetSplit a={a} />
            <BestAkim a={a} />
            <ModsSummary a={a} />
          </div>
        </div>
        <footer className="debrief__actions">
          <button type="button" className="sim-btn sim-btn--primary" onClick={() => setBriefOpen(true)}>
            Бриф для презентации (PDF)
          </button>
          <button type="button" className="sim-btn" onClick={edit}>
            ← Изменить решения
          </button>
          <button type="button" className="sim-btn sim-btn--ghost" onClick={() => setDebriefOpen(false)}>
            Смотреть город
          </button>
          <span className="sim-note">Все числа — расчёт движка по формуле кейса; AI только объясняет. Моды и соцсети — игровой слой.</span>
        </footer>
      </div>
    </div>
  );
}

export function FinalDebrief() {
  const open = useSimStore((s) => s.debriefOpen);
  const briefOpen = useSimStore((s) => s.briefOpen);
  const a = useSignedAnalysis();
  if (!open || !a || briefOpen) return null;
  return <Sheet a={a} />;
}
