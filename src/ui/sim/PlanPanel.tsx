"use client";

import { useState } from "react";
import { BUDGET, DECISIONS, DIRECTIONS, DISTRICTS, HORIZON_QUARTERS, INCOMPATIBILITIES, INDICATORS, MEASURES, SYNERGIES } from "@/domain/data";
import { evaluatePlan, issuesForAdding } from "@/domain/engine";
import { DIRECTION_IDS, DISTRICT_IDS, MEASURE_IDS, type Choice, type DirectionId, type Measure } from "@/domain/types";
import { lagText, num, SHORT } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { usePreview } from "@/sim/useAnalysis";
import { Icon, MEASURE_ICONS } from "@/ui/icons";

function BudgetHeader() {
  const plan = useSimStore((s) => s.plan);
  const analyst = useSimStore((s) => s.analyst);
  const setAnalyst = useSimStore((s) => s.setAnalyst);
  const preview = usePreview();
  const pct = Math.min(100, (preview.cost / BUDGET) * 100);
  return (
    <header className="sim-head">
      <div className="sim-toggle" role="group" aria-label="Режим отображения" data-tour="mode">
        <button type="button" aria-pressed={!analyst} onClick={() => setAnalyst(false)} title="Результаты скрыты до подписи бюджета">
          <Icon name="user" size={16} /> Аким
        </button>
        <button type="button" aria-pressed={analyst} onClick={() => setAnalyst(true)} title="Показывать величины эффектов и живой прогноз">
          <Icon name="chart" size={16} /> Аналитик
        </button>
      </div>
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
    </header>
  );
}

function Slots() {
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
            <span className="sim-slot__cost">{m.cost} ед.</span>
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
  const clearPlan = useSimStore((s) => s.clearPlan);
  if (phase === "revealed")
    return (
      <div className="sim-sign" data-tour="sign">
        <button type="button" className="sim-btn sim-btn--primary" onClick={edit}>
          <Icon name="pencil" size={16} /> Изменить решения
        </button>
        <button type="button" className="sim-btn" onClick={clearPlan}>
          <Icon name="plus" size={16} /> Новый план
        </button>
      </div>
    );
  const evaluation = evaluatePlan(plan);
  const reason = evaluation.ok ? null : evaluation.issues[0]?.message;
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

function MeasureCard({ m }: { m: Measure }) {
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
          <MeasureCard key={m.id} m={m} />
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
      <Slots />
      <SignBar />
      {phase === "plan" && <Presets />}
      {phase === "plan" && <Catalog />}
    </section>
  );
}
