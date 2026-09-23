"use client";

import { CRITICAL_THRESHOLD, DISTRICTS, INDICATORS } from "@/domain/data";
import { baselineAnger } from "@/domain/mods";
import { DISTRICT_IDS, INDICATOR_IDS } from "@/domain/types";
import { useCityStore } from "@/city/store";
import { num, SHORT, signed, valueColor } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { usePreview } from "@/sim/useAnalysis";
import { EventsCard } from "./EventsCard";
import { ResultView } from "./ResultView";

export function AngerGauge({ value, label }: { value: number; label: string }) {
  return (
    <span className={`sim-anger sim-anger--${label === "гнев" ? "hot" : label === "напряжённо" ? "warm" : "calm"}`} title={`Недовольство ${Math.round(value)}/100`}>
      <span className="sim-anger__bar">
        <span style={{ width: `${value}%` }} />
      </span>
      <span className="sim-anger__label">
        {label} · {Math.round(value)}
      </span>
    </span>
  );
}

function DistrictView() {
  const district = useSimStore((s) => s.district);
  const setDistrict = useSimStore((s) => s.setDistrict);
  const analyst = useSimStore((s) => s.analyst);
  const plan = useSimStore((s) => s.plan);
  const angerOn = useSimStore((s) => s.mods.anger);
  const focusDistrict = useCityStore((s) => s.focusDistrict);
  const preview = usePreview();
  const d = DISTRICTS[district];
  const anger = baselineAnger(preview)[district];
  const here = plan.filter((c) => c.districtId === district || c.districtId === null);
  return (
    <div className="sim-block" data-tour="district">
      <div className="sim-seg">
        {DISTRICT_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={district === id} onClick={() => setDistrict(id)}>
            {DISTRICTS[id].name}
          </button>
        ))}
      </div>
      <div className="sim-district">
        <div className="sim-district__head">
          <div>
            <h3>{d.name}</h3>
            <p>
              {d.profile} · {Math.round(d.population * 100)}% жителей
            </p>
          </div>
          <div className="sim-district__score">
            <span>Балл района</span>
            <strong>{num(preview.baselineDistrictScores[district])}</strong>
            {analyst && plan.length > 0 && <em>прогноз {num(preview.districtScores[district])}</em>}
          </div>
        </div>
        {angerOn && <AngerGauge value={anger.value} label={anger.label} />}
        <ul className="sim-indicators">
          {INDICATOR_IDS.map((k) => {
            const before = d.baseline[k];
            const after = preview.indicators[district][k];
            const changed = Math.abs(after - before) > 1e-9;
            return (
              <li key={k} className={before < CRITICAL_THRESHOLD ? "is-critical" : ""} title={`${INDICATORS[k].name}: 100 = ${INDICATORS[k].meaning100}`}>
                <span className="sim-ind__name">
                  <b>{k}</b> {SHORT[k]}
                </span>
                <span className="sim-ind__bar">
                  <span style={{ width: `${before}%`, background: valueColor(before) }} />
                  {analyst && changed && <i style={{ left: `${Math.min(before, after)}%`, width: `${Math.abs(after - before)}%` }} className={after > before ? "is-up" : "is-down"} />}
                  <u style={{ left: `${CRITICAL_THRESHOLD}%` }} />
                </span>
                <span className="sim-ind__val">
                  {num(before, 0)}
                  {analyst && changed && <em className={after > before ? "is-up" : "is-down"}> {signed(after - before, 1)}</em>}
                  {!analyst && changed && <em className="is-hidden-change">•</em>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="sim-note">
          {here.length ? `Здесь работают ваши меры: ${here.map((c) => c.measureId).join(", ")}.` : "В этом районе пока нет ваших мер."}{" "}
          {!analyst && "В режиме «Аким» величины эффектов скрыты до подписи бюджета — • отмечает затронутые показатели."}
        </p>
        <button type="button" className="sim-btn sim-btn--ghost sim-btn--small" onClick={() => focusDistrict(district)}>
          Показать район в 3D
        </button>
      </div>
    </div>
  );
}

function CityOverview() {
  const preview = usePreview();
  const analyst = useSimStore((s) => s.analyst);
  const plan = useSimStore((s) => s.plan);
  const baseCrit = DISTRICT_IDS.flatMap((d) => INDICATOR_IDS.filter((k) => DISTRICTS[d].baseline[k] < CRITICAL_THRESHOLD).map((k) => `${DISTRICTS[d].name}: ${SHORT[k]} ${DISTRICTS[d].baseline[k]}`));
  return (
    <div className="sim-block sim-overview" data-tour="score">
      <div>
        <span className="sim-eyebrow">Astana QoL Score сейчас</span>
        <strong className="sim-overview__score">{num(preview.baselineScore)}</strong>
      </div>
      {analyst && plan.length > 0 && (
        <p className="sim-overview__forecast">
          Прогноз с вашим планом: <b>{num(preview.score)}</b> <em className={preview.score >= preview.baselineScore ? "is-up" : "is-down"}>{signed(preview.score - preview.baselineScore)}</em> · критических {preview.nCrit}
        </p>
      )}
      <p>
        Критических показателей (&lt; 40): <b>{baseCrit.length}</b> — {baseCrit.join(", ")}. Итоговая оценка появится только после подписи допустимого плана из 5 решений.
      </p>
    </div>
  );
}

export function InfoPanel() {
  const phase = useSimStore((s) => s.phase);
  return (
    <section className="sim-panel sim-panel--right" aria-label="Город и результаты">
      <EventsCard />
      {phase === "plan" ? (
        <>
          <CityOverview />
          <DistrictView />
        </>
      ) : (
        <ResultView />
      )}
    </section>
  );
}
