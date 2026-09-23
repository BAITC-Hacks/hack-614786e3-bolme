"use client";

import { useState } from "react";
import { BUDGET, DECISIONS, DIRECTIONS, DISTRICTS, HORIZON_QUARTERS, INCOMPATIBILITIES, INDICATORS, MEASURES, SYNERGIES } from "@/domain/data";
import { evaluatePlan, issuesForAdding } from "@/domain/engine";
import { DIRECTION_IDS, DISTRICT_IDS, MEASURE_IDS, type Choice, type DirectionId, type Measure } from "@/domain/types";
import { lagText, num, SHORT, signed } from "@/sim/labels";
import { useCityStore } from "@/city/store";
import { useSimStore, type ModSettings } from "@/sim/store";
import { BASELINE, useGainIfAdded, useGainOf, usePreview } from "@/sim/useAnalysis";
import { Icon, MEASURE_ICONS } from "@/ui/icons";
import { checkPromises } from "@/domain/mods";
import { MOD_INFO } from "./WorldSetup";

/** Analyst mode: live Score of the plan as it is now (not official until signed). */
function Forecast() {
  const plan = useSimStore((s) => s.plan);
  const preview = usePreview();
  const delta = preview.score - BASELINE.score;
  return (
    <div className="sim-forecast" aria-live="polite">
      <span className="sim-forecast__label">
        <Icon name="chart" size={14} /> Прогноз Score
      </span>
      {plan.length ? (
        <>
          <span className="sim-forecast__value">
            {num(BASELINE.score)} → <b>{num(preview.score)}</b>
            <em className={delta >= 0 ? "is-up" : "is-down"}>{signed(delta)}</em>
          </span>
          <small>
            Критических показателей: {BASELINE.nCrit} → {preview.nCrit}. Официальный Score — после подписи.
          </small>
        </>
      ) : (
        <small>Добавьте меру — прогноз и прирост каждой карточки пересчитаются сразу.</small>
      )}
    </div>
  );
}

function BudgetHeader() {
  const phase = useSimStore((s) => s.phase);
  const plan = useSimStore((s) => s.plan);
  const analyst = useSimStore((s) => s.analyst);
  const preview = usePreview();
  const pct = Math.min(100, (preview.cost / BUDGET) * 100);
  return (
    <header className="sim-head">
      <WorldRules />
      <div className="sim-head__budget" data-tour="budget">
        <h2 className="sim-head__title">Бюджет города</h2>
        <p className="sim-head__sub">Горизонт: {HORIZON_QUARTERS} кварталов · 2 года</p>
        <div className="sim-budget">
          <strong>{preview.cost}</strong>
          <span>/ {BUDGET}</span>
        </div>
        <div className="sim-budget-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="sim-head__sub">
          Осталось {BUDGET - preview.cost} ед. · выбрано {plan.length} из {DECISIONS}
        </p>
      </div>
      {analyst && phase === "plan" && <Forecast />}
    </header>
  );
}

/** The world settings chosen before the game: read-only, changed only by «Новая игра». */
function WorldRules() {
  const analyst = useSimStore((s) => s.analyst);
  const mods = useSimStore((s) => s.mods);
  const on = (Object.keys(MOD_INFO) as (keyof ModSettings)[]).filter((k) => mods[k]);
  return (
    <div className="sim-rules" data-tour="mods" title="Правила мира выбраны перед игрой. Поменять — «Новая игра» после подписи.">
      <span className="sim-rules__mode" data-tour="mode">
        <Icon name={analyst ? "chart" : "user"} size={14} /> {analyst ? "Аналитик" : "Аким"}
      </span>
      {on.length ? (
        on.map((k) => (
          <span key={k} className="sim-rules__mod">
            <Icon name={MOD_INFO[k].icon} size={12} /> {MOD_INFO[k].short}
          </span>
        ))
      ) : (
        <span className="sim-rules__mod">Без модов</span>
      )}
    </div>
  );
}

/** Promises given at the start, pinned above the plan so they shape it. Analyst mode: on track by the forecast. */
function PinnedPromises() {
  const promiseIds = useSimStore((s) => s.promiseIds);
  const plan = useSimStore((s) => s.plan);
  const analyst = useSimStore((s) => s.analyst);
  const emergencies = useSimStore((s) => s.mods.emergencies);
  const preview = usePreview();
  if (!promiseIds.length) return null;
  const outcomes = checkPromises(promiseIds, preview, plan, BUDGET - preview.cost);
  return (
    <div className="sim-pinned" data-tour="promises">
      <h3 className="sim-block__title">
        Ваши обещания <span>проверят через 2 года</span>
      </h3>
      <ul>
        {outcomes.map((o) => {
          const dependsOnEvents = o.promise.id === "reserve" && emergencies;
          return (
            <li key={o.promise.id} className={analyst ? (o.kept ? "is-kept" : "is-risk") : ""}>
              {analyst && <b aria-hidden>{o.kept ? "✓" : "✗"}</b>}
              <span>
                «{o.promise.text}»
                {analyst && <small>{dependsOnEvents ? `${o.proof} · до реакции на ЧС` : o.proof}</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Slots() {
  const analyst = useSimStore((s) => s.analyst);
  const gains = useGainOf();
  const plan = useSimStore((s) => s.plan);
  const phase = useSimStore((s) => s.phase);
  const removeChoice = useSimStore((s) => s.removeChoice);
  return (
    <div className="sim-slots-wrap">
    <h3 className="sim-block__title">Выбранные решения</h3>
    <ol className="sim-slots">
      {Array.from({ length: DECISIONS }, (_, i) => {
        const c = plan[i];
        if (!c) return (
          <li key={i} className="sim-slot is-empty">
            <span className="sim-slot__num">{i + 1}</span> Свободный слот решения
          </li>
        );
        const m = MEASURES[c.measureId];
        return (
          <li key={c.measureId} className="sim-slot" style={{ "--dir": DIRECTIONS[m.direction].color } as React.CSSProperties}>
            <span className="sim-slot__id">{m.id}</span>
            <span className="sim-slot__icon">
              <Icon name={MEASURE_ICONS[m.id]} size={20} />
            </span>
            <span className="sim-slot__body">
              <span className="sim-slot__title">{m.title}</span>
              <span className="sim-slot__meta">
                {c.districtId ? DISTRICTS[c.districtId].name : "Весь город"} · {lagText(m.lag)}
              </span>
            </span>
            <span className="sim-slot__cost">
              {m.cost} ед.
              {analyst && gains[m.id] !== undefined && <em className={gains[m.id]! >= 0 ? "is-up" : "is-down"}>{signed(gains[m.id]!)}</em>}
            </span>
            {phase === "plan" && (
              <button type="button" className="sim-slot__remove" onClick={() => removeChoice(c.measureId)} aria-label={`Убрать ${m.title}`}>
                ×
              </button>
            )}
          </li>
        );
      })}
    </ol>
    </div>
  );
}

/** Reproducible scenarios from the case and the analysis (see README). */
const PRESETS: Array<{ id: string; title: string; hint: string; plan: Choice[] }> = [
  {
    id: "case",
    title: "Пример из кейса",
    hint: "M7, M8, M10 в Нуре + M12 + M5 в Сарыарке · 95 ед. · ожидаемо 56,54",
    plan: [
      { measureId: "M7", districtId: "nura" },
      { measureId: "M8", districtId: "nura" },
      { measureId: "M10", districtId: "nura" },
      { measureId: "M12", districtId: null },
      { measureId: "M5", districtId: "saryarka" },
    ],
  },
  {
    id: "trap",
    title: "Ловушка M11",
    hint: "Безопасные переходы в Алматы роняют «Дороги» ниже 40 · Score ниже базы",
    plan: [
      { measureId: "M9", districtId: "baikonur" },
      { measureId: "M11", districtId: "almaty" },
      { measureId: "M10", districtId: "baikonur" },
      { measureId: "M12", districtId: null },
      { measureId: "M4", districtId: "baikonur" },
    ],
  },
];

function Presets() {
  const replacePlan = useSimStore((s) => s.replacePlan);
  return (
    <div className="sim-presets" data-tour="presets">
      <span className="sim-eyebrow">Быстрый старт</span>
      {PRESETS.map((p) => (
        <button key={p.id} type="button" className="sim-btn sim-btn--small sim-btn--ghost" title={p.hint} onClick={() => replacePlan(p.plan)}>
          {p.title}
        </button>
      ))}
    </div>
  );
}

function SignBar() {
  const plan = useSimStore((s) => s.plan);
  const phase = useSimStore((s) => s.phase);
  const sign = useSimStore((s) => s.sign);
  const edit = useSimStore((s) => s.edit);
  const newGame = useSimStore((s) => s.newGame);
  if (phase === "revealed")
    return (
      <div className="sim-sign" data-tour="sign">
        <button type="button" className="sim-btn sim-btn--primary" onClick={edit}>
          <Icon name="pencil" size={16} /> Изменить решения
        </button>
        <button
          type="button"
          className="sim-btn"
          onClick={() => {
            newGame();
            useCityStore.getState().setMode("tour");
          }}
          title="Заново: настройки мира, обещания, план"
        >
          <Icon name="plus" size={16} /> Новая игра
        </button>
      </div>
    );
  const evaluation = evaluatePlan(plan);
  // Dead end: fewer than 5 decisions, but no remaining measure fits the budget and rules in any district.
  const stuck =
    plan.length > 0 &&
    plan.length < DECISIONS &&
    !MEASURE_IDS.some((id) =>
      (MEASURES[id].scope === "city" ? [null] : DISTRICT_IDS).some((d) => issuesForAdding(plan, { measureId: id, districtId: d }).length === 0),
    );
  const reason = stuck
    ? `Тупик: ни одна из оставшихся мер не помещается в остаток бюджета или в правила. Уберите одну из выбранных мер.`
    : evaluation.ok
      ? null
      : evaluation.issues[0]?.message;
  return (
    <div className="sim-sign" data-tour="sign">
      <button type="button" className="sim-btn sim-btn--primary" disabled={!evaluation.ok} onClick={sign}>
        <Icon name="check" size={16} /> Подписать бюджет и прожить 2 года
      </button>
      {reason && plan.length > 0 && <p className="sim-sign__reason">{reason}</p>}
    </div>
  );
}

function EffectChips({ m }: { m: Measure }) {
  const analyst = useSimStore((s) => s.analyst);
  const share = (HORIZON_QUARTERS - m.lag) / HORIZON_QUARTERS;
  return (
    <span className="sim-chips">
      {Object.entries(m.effects).map(([k, v]) => (
        <span key={k} className={`sim-chip ${v > 0 ? "is-up" : "is-down"}`} title={INDICATORS[k as keyof typeof INDICATORS].name}>
          {SHORT[k as keyof typeof SHORT]} {v > 0 ? "↑" : "↓"}
          {analyst && <b>{`${v > 0 ? "+" : "−"}${num(Math.abs(v * share), 1)}`}</b>}
        </span>
      ))}
    </span>
  );
}

function MeasureCard({ m, gain }: { m: Measure; gain?: number }) {
  const analyst = useSimStore((s) => s.analyst);
  const plan = useSimStore((s) => s.plan);
  const district = useSimStore((s) => s.district);
  const addChoice = useSimStore((s) => s.addChoice);
  const removeChoice = useSimStore((s) => s.removeChoice);
  const chosen = plan.find((c) => c.measureId === m.id);
  const choice = { measureId: m.id, districtId: m.scope === "city" ? null : district };
  const issues = chosen ? [] : issuesForAdding(plan, choice);
  const blocked = issues.length > 0;
  const synergy = SYNERGIES.filter((s) => s.a === m.id || s.b === m.id);
  const conflicts = INCOMPATIBILITIES.filter((x) => x.a === m.id || x.b === m.id);
  return (
    <li
      className={`sim-card${chosen ? " is-chosen" : ""}${blocked ? " is-blocked" : ""}`}
      style={{ "--dir": DIRECTIONS[m.direction].color } as React.CSSProperties}
    >
      <button
        type="button"
        className="sim-card__main"
        onClick={() => (chosen ? removeChoice(m.id) : !blocked && addChoice(choice))}
        aria-disabled={blocked}
        title={blocked ? issues.map((i) => i.message).join("\n") : chosen ? "Убрать из плана" : "Добавить в план"}
      >
        <span className="sim-card__top">
          <span className="sim-card__icon">
            <Icon name={MEASURE_ICONS[m.id]} size={18} />
          </span>
          <span className="sim-card__id">{m.id}</span>
          <span className="sim-card__title">{m.title}</span>
          <span className="sim-card__cost">{m.cost}</span>
        </span>
        <span className="sim-card__meta">
          <span className={`sim-scope sim-scope--${m.scope}`}>{m.scope === "city" ? "Весь город · 5 районов" : `Район: ${chosen?.districtId ? DISTRICTS[chosen.districtId].name : DISTRICTS[district].name}`}</span>
          <span>{lagText(m.lag)}</span>
        </span>
        {analyst && gain !== undefined && (
          <span className={`sim-card__gain ${gain >= 0.005 ? "is-up" : gain <= -0.005 ? "is-down" : "is-flat"}`}>
            <Icon name="chart" size={13} /> {signed(gain)} к Score, если добавить сейчас
          </span>
        )}
        <EffectChips m={m} />
        {(synergy.length > 0 || conflicts.length > 0) && (
          <span className="sim-card__hints">
            {synergy.map((s) => (
              <span key={`${s.a}${s.b}`} className="sim-hint sim-hint--syn">
                ⚡ с {s.a === m.id ? s.b : s.a}: {SHORT[s.indicator]} +{s.bonus}
              </span>
            ))}
            {conflicts.map((x) => (
              <span key={`${x.a}${x.b}`} className="sim-hint sim-hint--conf">
                ⛔ {x.a === m.id ? x.b : x.a}
                {x.sameDistrictOnly ? " в том же районе" : ""}
              </span>
            ))}
          </span>
        )}
        {blocked && <span className="sim-card__reason">{issues[0].message}</span>}
        {chosen && <span className="sim-card__chosen">✓ В плане — нажмите, чтобы убрать</span>}
      </button>
    </li>
  );
}

function Catalog() {
  const district = useSimStore((s) => s.district);
  const setDistrict = useSimStore((s) => s.setDistrict);
  const [dir, setDir] = useState<DirectionId | "all">("all");
  const gains = useGainIfAdded();
  const measures = MEASURE_IDS.map((id) => MEASURES[id]).filter((m) => dir === "all" || m.direction === dir);
  return (
    <div className="sim-catalog" data-tour="catalog">
      <div className="sim-catalog__district">
        <span className="sim-eyebrow">Районные меры — в район</span>
        <div className="sim-seg">
          {DISTRICT_IDS.map((d) => (
            <button key={d} type="button" aria-pressed={district === d} onClick={() => setDistrict(d)}>
              {DISTRICTS[d].name}
            </button>
          ))}
        </div>
      </div>
      <div className="sim-seg sim-seg--dirs" role="tablist" aria-label="Направления">
        <button type="button" aria-pressed={dir === "all"} onClick={() => setDir("all")}>
          Все 14
        </button>
        {DIRECTION_IDS.map((d) => (
          <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)} style={{ "--dir": DIRECTIONS[d].color } as React.CSSProperties}>
            {DIRECTIONS[d].short}
          </button>
        ))}
      </div>
      <ul className="sim-cards">
        {measures.map((m) => (
          <MeasureCard key={m.id} m={m} gain={gains[m.id]} />
        ))}
      </ul>
    </div>
  );
}

export function PlanPanel() {
  const phase = useSimStore((s) => s.phase);
  return (
    <section className="sim-panel sim-panel--left" aria-label="План акима">
      <BudgetHeader />
      <PinnedPromises />
      <Slots />
      <SignBar />
      {phase === "plan" && <Presets />}
      {phase === "plan" && <Catalog />}
    </section>
  );
}
