"use client";

/**
 * Decisions from the 3D view. Focused on a district (or a ЧС before signing):
 * the measures that lift its weak indicators or soften its emergency, with
 * «В план». Focused on a ЧС after signing: pick the response from the reserve.
 */
import { useMemo } from "react";
import { BUDGET, CRITICAL_THRESHOLD, DECISIONS, DISTRICTS, MEASURES } from "@/domain/data";
import { evaluatePlan, issuesForAdding, simulate } from "@/domain/engine";
import { EMERGENCIES } from "@/domain/mods";
import { DISTRICT_IDS, INDICATOR_IDS, MEASURE_IDS, type Choice, type DistrictId, type IndicatorId, type Measure } from "@/domain/types";
import { useCityStore, type Focus } from "@/city/store";
import { num, SHORT, signed } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { usePreview, useSignedAnalysis } from "@/sim/useAnalysis";
import { Icon, MEASURE_ICONS } from "@/ui/icons";

const WEAK_BELOW = 50;
const MAX_SUGGESTIONS = 5;
/** A measure that softens the district's emergency ranks like a strong indicator lift. */
const SOFTEN_WEIGHT = 14;

const isDistrict = (id: string | undefined): id is DistrictId => !!id && (DISTRICT_IDS as readonly string[]).includes(id);

type Suggestion = { m: Measure; choice: Choice; lifts: IndicatorId[]; hurts: IndicatorId[]; softens: string[]; score: number; blocked: boolean };

function useSuggestions(d: DistrictId): { weak: IndicatorId[]; list: Suggestion[] } {
  const plan = useSimStore((s) => s.plan);
  const preview = usePreview();
  return useMemo(() => {
    const values = preview.indicators[d];
    const sorted = [...INDICATOR_IDS].sort((a, b) => values[a] - values[b]);
    const below = sorted.filter((k) => values[k] < WEAK_BELOW);
    const weak = below.length ? below : sorted.slice(0, 2);
    const emergencies = EMERGENCIES.filter((e) => e.districtId === d);
    const list = MEASURE_IDS.map((id) => MEASURES[id])
      .filter((m) => !plan.some((c) => c.measureId === m.id))
      .map((m) => {
        const choice: Choice = { measureId: m.id, districtId: m.scope === "city" ? null : d };
        const lifts = weak.filter((k) => (m.effects[k] ?? 0) > 0);
        const hurts = INDICATOR_IDS.filter((k) => (m.effects[k] ?? 0) < 0);
        const softens = emergencies.filter((e) => e.preparedness([...plan, choice]).length > e.preparedness(plan).length).map((e) => e.title);
        const score =
          lifts.reduce((s, k) => s + (m.effects[k] ?? 0) * (values[k] < CRITICAL_THRESHOLD ? 2 : 1), 0) + softens.length * SOFTEN_WEIGHT - hurts.length * 4;
        return { m, choice, lifts, hurts, softens, score, blocked: issuesForAdding(plan, choice).length > 0 };
      })
      .filter((x) => x.lifts.length > 0 || x.softens.length > 0)
      // Actionable measures first, then the blocked ones with their reason.
      .sort((a, b) => Number(a.blocked) - Number(b.blocked) || b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);
    return { weak, list };
  }, [d, plan, preview]);
}

function SuggestionRow({ s, d }: { s: Suggestion; d: DistrictId }) {
  const plan = useSimStore((s) => s.plan);
  const analyst = useSimStore((s) => s.analyst);
  const addChoice = useSimStore((s) => s.addChoice);
  const setDistrict = useSimStore((s) => s.setDistrict);
  const preview = usePreview();
  const issues = issuesForAdding(plan, s.choice);
  const blocked = issues.length > 0;
  const gain = useMemo(() => (blocked ? null : simulate([...plan, s.choice]).score - preview.score), [blocked, plan, s.choice, preview.score]);
  return (
    <li className="focus-measure">
      <span className="focus-measure__icon">
        <Icon name={MEASURE_ICONS[s.m.id]} size={18} />
      </span>
      <span className="focus-measure__body">
        <b>
          {s.m.title} <small>{s.m.id}</small>
        </b>
        <span className="focus-measure__tags">
          <span>{s.m.cost} ед.</span>
          <span>{s.m.scope === "city" ? "весь город" : DISTRICTS[d].name}</span>
          {s.lifts.map((k) => (
            <span key={k} className="is-up">
              {SHORT[k]} ↑
            </span>
          ))}
          {s.hurts.map((k) => (
            <span key={k} className="is-down">
              {SHORT[k]} ↓
            </span>
          ))}
          {s.softens.map((t) => (
            <span key={t} className="is-shield">
              смягчает ЧС
            </span>
          ))}
          {analyst && gain !== null && <span className={gain >= 0 ? "is-up" : "is-down"}>{signed(gain)} к Score</span>}
        </span>
        {issues.length > 0 && <span className="focus-measure__reason">{issues[0].message}</span>}
      </span>
      <button
        type="button"
        className="sim-btn sim-btn--primary sim-btn--small"
        disabled={blocked}
        onClick={() => {
          setDistrict(d);
          addChoice(s.choice);
        }}
      >
        <Icon name="plus" size={14} /> В план
      </button>
    </li>
  );
}

function PlanStatus() {
  const plan = useSimStore((s) => s.plan);
  const sign = useSimStore((s) => s.sign);
  const preview = usePreview();
  const ready = evaluatePlan(plan).ok;
  return (
    <div className="focus-plan">
      <span>
        Решений <b>{plan.length}</b> из {DECISIONS} · бюджет <b>{preview.cost}</b>/{BUDGET}
      </span>
      {ready && (
        <button type="button" className="sim-btn sim-btn--primary sim-btn--small" onClick={sign}>
          <Icon name="check" size={14} /> Подписать бюджет
        </button>
      )}
    </div>
  );
}

function DistrictDecisions({ d, eventTitle }: { d: DistrictId; eventTitle?: string }) {
  const plan = useSimStore((s) => s.plan);
  const removeChoice = useSimStore((s) => s.removeChoice);
  const preview = usePreview();
  const { weak, list } = useSuggestions(d);
  const here = plan.filter((c) => c.districtId === d || c.districtId === null);
  return (
    <div className="focus-actions">
      <p className="focus-actions__weak">
        {eventTitle ? `Впереди ЧС «${eventTitle}». Слабые места района: ` : "Слабые места района: "}
        {weak.map((k) => (
          <b key={k} className={preview.indicators[d][k] < CRITICAL_THRESHOLD ? "is-critical" : ""}>
            {SHORT[k]} {num(preview.indicators[d][k], 0)}
          </b>
        ))}
      </p>
      {here.length > 0 && (
        <ul className="focus-actions__chosen">
          {here.map((c) => (
            <li key={c.measureId}>
              <Icon name={MEASURE_ICONS[c.measureId]} size={14} /> {MEASURES[c.measureId].title}
              <button type="button" onClick={() => removeChoice(c.measureId)} aria-label={`Убрать ${MEASURES[c.measureId].title}`}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="focus-actions__title">Что можно сделать здесь</h3>
      {list.length ? (
        <ul className="focus-actions__list">
          {list.map((s) => (
            <SuggestionRow key={s.m.id} s={s} d={d} />
          ))}
        </ul>
      ) : (
        <p className="focus-actions__empty">Подходящих мер больше нет — все сильные ходы для района уже в плане.</p>
      )}
      <PlanStatus />
    </div>
  );
}

function EventResponse({ eventId }: { eventId: string }) {
  const a = useSignedAnalysis();
  const responses = useSimStore((s) => s.responses);
  const setResponse = useSimStore((s) => s.setResponse);
  const outcome = a?.mods.emergencies?.find((e) => e.event.id === eventId);
  if (!a || !outcome) return null;
  const current = responses[eventId] ?? "none";
  const spentElsewhere = a.mods.reserveSpent - outcome.response.cost;
  return (
    <div className="focus-actions">
      <p className="focus-actions__weak">{outcome.event.story}</p>
      <h3 className="focus-actions__title">
        Ваше решение <span>резерв {a.mods.reserveLeft} из {a.mods.reserveStart} ед.</span>
      </h3>
      <ul className="focus-actions__list">
        {outcome.event.responses.map((r) => {
          const affordable = spentElsewhere + r.cost <= a.mods.reserveStart;
          const chosen = current === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                className={`focus-response${chosen ? " is-chosen" : ""}`}
                disabled={!affordable}
                onClick={() => setResponse(eventId, r.id)}
                title={affordable ? "" : "Не хватает резерва"}
              >
                <Icon name={chosen ? "check" : "plus"} size={14} />
                <span>{r.title}</span>
                <b>{r.cost} ед.</b>
              </button>
            </li>
          );
        })}
      </ul>
      {outcome.event.responses.some((r) => r.cost > 0 && spentElsewhere + r.cost > a.mods.reserveStart) && (
        <p className="focus-actions__empty">Резерв — это неподписанный остаток бюджета. Оставьте больше при планировании, чтобы хватило на сильную реакцию.</p>
      )}
      {a.mods.stressedScore !== null && (
        <p className="focus-actions__empty">
          Score с учётом ЧС (игровой мод): <b>{num(a.mods.stressedScore)}</b>
        </p>
      )}
    </div>
  );
}

/** Rendered inside the 3D focus card (src/ui/hud/Hud.tsx). */
export function FocusActions({ focus }: { focus: Focus }) {
  const phase = useSimStore((s) => s.phase);
  const edit = useSimStore((s) => s.edit);
  const hotspots = useCityStore((s) => s.hotspots);
  const emergenciesOn = useSimStore((s) => s.mods.emergencies);
  if (focus.kind !== "hotspot" && focus.kind !== "district") return null;

  const eventId = focus.kind === "hotspot" && focus.id.startsWith("event:") ? focus.id.slice("event:".length) : null;
  if (eventId && phase === "revealed") return <EventResponse eventId={eventId} />;

  const districtId = focus.kind === "district" ? focus.id : hotspots.find((h) => h.id === focus.id)?.districtId;
  if (!isDistrict(districtId)) return null;
  if (phase === "revealed")
    return (
      <div className="focus-actions">
        <p className="focus-actions__empty">Бюджет подписан. Чтобы поменять меры в этом районе, вернитесь к плану.</p>
        <button type="button" className="sim-btn sim-btn--small" onClick={edit}>
          <Icon name="pencil" size={14} /> Изменить решения
        </button>
      </div>
    );
  const upcoming = emergenciesOn ? EMERGENCIES.find((e) => e.districtId === districtId) : undefined;
  return <DistrictDecisions d={districtId} eventTitle={upcoming?.title} />;
}
