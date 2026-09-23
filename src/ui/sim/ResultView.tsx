"use client";

import { CRITICAL_THRESHOLD, DISTRICTS, MEASURES, WEIGHT_AVG, WEIGHT_MIN } from "@/domain/data";
import { DISTRICT_IDS, INDICATOR_IDS } from "@/domain/types";
import { choiceLabel } from "@/sim/report";
import { num, SHORT, signed } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { useSignedAnalysis } from "@/sim/useAnalysis";
import type { Analysis } from "@/sim/analysis";
import { AiReport } from "./AiReport";
import { AngerGauge } from "./InfoPanel";

function ScoreCard({ a }: { a: Analysis }) {
  const r = a.result;
  const gain = r.score - r.baselineScore;
  return (
    <div className="sim-block sim-score">
      <span className="sim-eyebrow">Astana Quality of Life Score · официальная формула кейса</span>
      <div className="sim-score__main">
        <strong>{num(r.score)}</strong>
        <em className={gain >= 0 ? "is-up" : "is-down"}>{signed(gain)} к базе {num(r.baselineScore)}</em>
      </div>
      <div className="sim-score__meter" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, a.rank.potentialPercent))}%` }} />
      </div>
      <p className="sim-score__rank">
        {a.rank.potentialPercent >= 0 ? <>Реализовано <b>{num(a.rank.potentialPercent, 1)}%</b> возможного прироста</> : <>План <b>хуже, чем ничего не делать</b></>} · план лучше <b>{num(a.rank.beatsPercent, 1)}%</b> из{" "}
        {a.rank.validPlanCount.toLocaleString("ru-RU")} допустимых планов · максимум {num(a.rank.maxScore)}
      </p>
      <dl className="sim-score__parts">
        <div>
          <dt>{WEIGHT_AVG} × средний город</dt>
          <dd>{num(WEIGHT_AVG * r.dAvg)}</dd>
        </div>
        <div>
          <dt>
            {WEIGHT_MIN} × слабейший ({DISTRICTS[r.weakestDistrict].name})
          </dt>
          <dd>{num(WEIGHT_MIN * r.dMin)}</dd>
        </div>
        <div>
          <dt>− критических &lt; 40</dt>
          <dd>{r.nCrit ? `−${r.nCrit}` : "0"}</dd>
        </div>
        <div>
          <dt>Потрачено / остаток</dt>
          <dd>
            {r.cost} / {r.remaining}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CriticalChanges({ a }: { a: Analysis }) {
  const r = a.result;
  const rows = DISTRICT_IDS.flatMap((d) =>
    INDICATOR_IDS.filter((k) => r.baseline[d][k] < CRITICAL_THRESHOLD || r.indicators[d][k] < CRITICAL_THRESHOLD).map((k) => ({ d, k, before: r.baseline[d][k], after: r.indicators[d][k] })),
  );
  if (!rows.length) return null;
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">Критические показатели (порог 40)</h3>
      <ul className="sim-crit">
        {rows.map(({ d, k, before, after }) => {
          const status = before < CRITICAL_THRESHOLD && after >= CRITICAL_THRESHOLD ? "fixed" : before >= CRITICAL_THRESHOLD && after < CRITICAL_THRESHOLD ? "new" : "left";
          return (
            <li key={`${d}${k}`} className={`is-${status}`}>
              <span>
                {DISTRICTS[d].name} · {SHORT[k]}
              </span>
              <span>
                {num(before, 1)} → {num(after, 1)}
              </span>
              <b>{status === "fixed" ? "устранено, штраф снят" : status === "new" ? "НОВЫЙ провал, −1" : "остаётся, −1"}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DistrictTable({ a }: { a: Analysis }) {
  const r = a.result;
  const anger = a.mods.anger;
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">Районы через 2 года</h3>
      <ul className="sim-dtable">
        {DISTRICT_IDS.map((d) => {
          const delta = r.districtScores[d] - r.baselineDistrictScores[d];
          return (
            <li key={d} className={d === r.weakestDistrict ? "is-weakest" : ""}>
              <span className="sim-dtable__name">
                {DISTRICTS[d].name}
                {d === r.weakestDistrict && <small> слабейший</small>}
              </span>
              <span>
                {num(r.baselineDistrictScores[d])} → <b>{num(r.districtScores[d])}</b>
              </span>
              <em className={delta > 0.005 ? "is-up" : "is-flat"}>{signed(delta)}</em>
              {anger && <AngerGauge value={anger[d].value} label={anger[d].label} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Contributions({ a }: { a: Analysis }) {
  const max = Math.max(...a.shapley.map((s) => Math.abs(s.value)), 0.01);
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">
        Вклад каждой меры <span>точные значения Шепли, сумма = прирост</span>
      </h3>
      <ul className="sim-contrib">
        {[...a.shapley]
          .sort((x, y) => y.value - x.value)
          .map((s) => (
            <li key={s.choice.measureId}>
              <span>{choiceLabel(s.choice)}</span>
              <span className="sim-contrib__bar">
                <span style={{ width: `${(Math.abs(s.value) / max) * 100}%` }} className={s.value < 0 ? "is-down" : ""} />
              </span>
              <b>{signed(s.value)}</b>
            </li>
          ))}
      </ul>
    </div>
  );
}

function Improve({ a }: { a: Analysis }) {
  const replacePlan = useSimStore((s) => s.replacePlan);
  const ghost = useSimStore((s) => s.ghost);
  const setGhost = useSimStore((s) => s.setGhost);
  const opt = a.rank.optimum;
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">
        Как улучшить <span>проверено движком</span>
      </h3>
      {a.swaps.length ? (
        <ul className="sim-swaps">
          {a.swaps.map((s) => (
            <li key={s.title}>
              <span>{s.title}</span>
              <b>{signed(s.delta)}</b>
              <button type="button" className="sim-btn sim-btn--small" onClick={() => replacePlan(s.plan)}>
                Применить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sim-note">Одиночной заменой план не улучшить — это локальный оптимум.</p>
      )}
      <label className="sim-switch">
        <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} />
        <span className="sim-switch__track" aria-hidden />
        <span>
          <b>Призрак оптимума на карте</b>
          <small>
            Лучший из {a.rank.validPlanCount.toLocaleString("ru-RU")} планов: {opt.plan.map((c) => `${c.measureId}${c.districtId ? `·${DISTRICTS[c.districtId].name}` : ""}`).join(", ")} → {num(opt.score)} за {opt.cost}
          </small>
        </span>
      </label>
    </div>
  );
}

function Emergencies({ a }: { a: Analysis }) {
  const responses = useSimStore((s) => s.responses);
  const setResponse = useSimStore((s) => s.setResponse);
  const m = a.mods;
  if (!m.emergencies) return null;
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">
        ЧС за 2 года <span>резерв {m.reserveLeft} из {m.reserveStart}</span>
      </h3>
      <ul className="sim-events">
        {m.emergencies.map((e) => {
          const current = responses[e.event.id] ?? "none";
          const spentElsewhere = m.reserveSpent - e.response.cost;
          return (
            <li key={e.event.id}>
              <div className="sim-event__head">
                <b>{e.event.title}</b>
                <span>
                  {e.event.season} · {DISTRICTS[e.event.districtId].name}
                </span>
              </div>
              <p>{e.event.story}</p>
              <p className="sim-event__loss">
                Удар:{" "}
                {Object.entries(e.peakLoss)
                  .map(([k, v]) => `${SHORT[k as keyof typeof SHORT]} ${num(v as number, 1)}`)
                  .join(" · ")}
                {e.preparedness.length > 0 && <> · смягчает: {e.preparedness.map((p) => p.why).join(", ")}</>}
              </p>
              <div className="sim-seg sim-seg--wrap">
                {e.event.responses.map((r) => {
                  const affordable = spentElsewhere + r.cost <= m.reserveStart;
                  return (
                    <button key={r.id} type="button" aria-pressed={current === r.id} disabled={!affordable} onClick={() => setResponse(e.event.id, r.id)} title={affordable ? "" : "Не хватает резерва"}>
                      {r.title} · {r.cost}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {m.stressedScore !== null && (
        <p className="sim-note">
          Score с учётом ЧС (игровой мод, не официальный): <b>{num(m.stressedScore)}</b> ({signed(m.stressedScore - a.result.score)} к официальному).
        </p>
      )}
    </div>
  );
}

function Promises({ a }: { a: Analysis }) {
  const p = a.mods.promises;
  if (!p) return null;
  return (
    <div className="sim-block">
      <h3 className="sim-block__title">Память народа</h3>
      {p.length === 0 ? (
        <p className="sim-note">Вы не давали обещаний — жителям нечего вам припомнить, но и доверия не прибавилось.</p>
      ) : (
        <ul className="sim-promise-list">
          {p.map((x) => (
            <li key={x.promise.id} className={x.kept ? "is-kept" : "is-broken"}>
              <b>{x.kept ? "Выполнено" : "Нарушено"}</b> «{x.promise.text}»<small>{x.proof}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResultView() {
  const a = useSignedAnalysis();
  const setBriefOpen = useSimStore((s) => s.setBriefOpen);
  const setDebriefOpen = useSimStore((s) => s.setDebriefOpen);
  const setRevealStep = useSimStore((s) => s.setRevealStep);
  if (!a) return <div className="sim-block">План недопустим — Score не рассчитывается.</div>;
  return (
    <>
      <div className="sim-result-actions">
        <button type="button" className="sim-btn sim-btn--primary sim-btn--small" onClick={() => setDebriefOpen(true)}>
          Итоговый анализ
        </button>
        <button type="button" className="sim-btn sim-btn--small" onClick={() => setRevealStep(0)}>
          ▶ Повторить облёт
        </button>
      </div>
      <ScoreCard a={a} />
      <CriticalChanges a={a} />
      <AiReport a={a} />
      <DistrictTable a={a} />
      <Emergencies a={a} />
      <Promises a={a} />
      <Contributions a={a} />
      <Improve a={a} />
      <div className="sim-block">
        <button type="button" className="sim-btn sim-btn--primary" onClick={() => setBriefOpen(true)}>
          Бриф для презентации (PDF)
        </button>
        <p className="sim-note">Все числа — расчёт движка по формуле кейса. Моды — игровой слой с допущениями команды.</p>
      </div>
    </>
  );
}

export const measureTitle = (id: keyof typeof MEASURES) => MEASURES[id].title;
