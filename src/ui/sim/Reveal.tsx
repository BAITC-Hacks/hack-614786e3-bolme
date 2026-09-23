"use client";

/**
 * Cinematic reveal after signing: "two years later", then the camera flies
 * over the districts that changed most (teammate's camera API via the city
 * store), each with a caption computed by the engine, then the final analysis.
 */
import { useEffect, useMemo } from "react";
import { CRITICAL_THRESHOLD, DISTRICTS, MEASURES } from "@/domain/data";
import { DISTRICT_IDS, INDICATOR_IDS, type DistrictId } from "@/domain/types";
import { useCityStore } from "@/city/store";
import type { Analysis } from "@/sim/analysis";
import { num, SHORT } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { useSignedAnalysis } from "@/sim/useAnalysis";

type Shot =
  | { kind: "intro"; ms: number }
  | { kind: "district"; ms: number; districtId: DistrictId }
  | { kind: "outro"; ms: number };

function buildShots(a: Analysis): Shot[] {
  const r = a.result;
  const touched = DISTRICT_IDS.map((d) => ({ d, delta: r.districtScores[d] - r.baselineDistrictScores[d] }))
    .filter((x) => x.delta > 0.005)
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 4);
  return [{ kind: "intro", ms: 2600 }, ...touched.map((t) => ({ kind: "district" as const, ms: 4200, districtId: t.d })), { kind: "outro", ms: 1800 }];
}

function DistrictCaption({ a, d }: { a: Analysis; d: DistrictId }) {
  const r = a.result;
  const changes = INDICATOR_IDS.map((k) => ({ k, before: r.baseline[d][k], after: r.indicators[d][k] }))
    .filter((c) => Math.abs(c.after - c.before) > 1e-9)
    .sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before))
    .slice(0, 3);
  const fixed = INDICATOR_IDS.filter((k) => r.baseline[d][k] < CRITICAL_THRESHOLD && r.indicators[d][k] >= CRITICAL_THRESHOLD);
  const built = a.facts.context.plan as Array<{ id: keyof typeof MEASURES; where: string }>;
  const here = built.filter((p) => p.where === DISTRICTS[d].name).map((p) => MEASURES[p.id].title);
  return (
    <>
      <span className="reveal__eyebrow">{here.length ? `Построено: ${here.join(" · ")}` : "Городские программы дошли до района"}</span>
      <span className="reveal__title">{DISTRICTS[d].name}</span>
      <span className="reveal__line">
        Балл района {num(r.baselineDistrictScores[d], 1)} → <b>{num(r.districtScores[d], 1)}</b>
        {changes.length > 0 && <> · {changes.map((c) => `${SHORT[c.k]} ${num(c.before, 0)} → ${num(c.after, 1)}`).join(" · ")}</>}
      </span>
      {fixed.length > 0 && <span className="reveal__badge">Критический провал устранён: {fixed.map((k) => SHORT[k]).join(", ")}</span>}
    </>
  );
}

export function Reveal() {
  const step = useSimStore((s) => s.revealStep);
  const setStep = useSimStore((s) => s.setRevealStep);
  const setDebriefOpen = useSimStore((s) => s.setDebriefOpen);
  const a = useSignedAnalysis();
  const shots = useMemo(() => (a ? buildShots(a) : []), [a]);
  const shot = step >= 0 ? shots[step] : undefined;

  // Drive the camera and the timeline.
  useEffect(() => {
    if (!shot) return;
    const city = useCityStore.getState();
    if (shot.kind === "district") city.focusDistrict(shot.districtId);
    else city.backToMap();
    const timer = window.setTimeout(() => {
      if (step + 1 < shots.length) setStep(step + 1);
      else {
        setStep(-1);
        setDebriefOpen(true);
      }
    }, shot.ms);
    return () => window.clearTimeout(timer);
  }, [shot, step, shots.length, setStep, setDebriefOpen]);

  if (!a || !shot) return null;
  const skip = () => {
    setStep(-1);
    useCityStore.getState().backToMap();
    setDebriefOpen(true);
  };
  const r = a.result;
  return (
    <div className="reveal" key={step}>
      <div className="reveal__caption">
        {shot.kind === "intro" && (
          <>
            <span className="reveal__eyebrow">Бюджет подписан · {r.cost} из 100 · 5 решений</span>
            <span className="reveal__title">Прошло 2 года</span>
            <span className="reveal__line">8 кварталов: стройки, открытия, первые результаты…</span>
          </>
        )}
        {shot.kind === "district" && <DistrictCaption a={a} d={shot.districtId} />}
        {shot.kind === "outro" && (
          <>
            <span className="reveal__eyebrow">Astana Quality of Life Score</span>
            <span className="reveal__title">
              {num(r.baselineScore)} → {num(r.score)}
            </span>
            <span className="reveal__line">Готовим итоговый анализ…</span>
          </>
        )}
      </div>
      <div className="reveal__progress" aria-hidden>
        {shots.map((_, i) => (
          <span key={i} className={i < step ? "is-done" : i === step ? "is-now" : ""} style={i === step ? ({ "--ms": `${shot.ms}ms` } as React.CSSProperties) : undefined} />
        ))}
      </div>
      <button type="button" className="sim-btn sim-btn--small reveal__skip" onClick={skip}>
        Пропустить →
      </button>
    </div>
  );
}
