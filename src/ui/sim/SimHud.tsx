"use client";

import { BUDGET, DECISIONS } from "@/domain/data";
import { useCityStore } from "@/city/store";
import { SimBridge } from "@/sim/SimBridge";
import { useSimStore } from "@/sim/store";
import { usePreview } from "@/sim/useAnalysis";
import { BriefSheet } from "./BriefSheet";
import { FinalDebrief } from "./FinalDebrief";
import { Reveal } from "./Reveal";
import { InfoPanel } from "./InfoPanel";
import { PlanPanel } from "./PlanPanel";

function MiniBar() {
  const plan = useSimStore((s) => s.plan);
  const phase = useSimStore((s) => s.phase);
  const backToMap = useCityStore((s) => s.backToMap);
  const preview = usePreview();
  return (
    <div className="sim-mini">
      <span>
        Бюджет <b>{preview.cost}</b>/{BUDGET} · {plan.length} из {DECISIONS} решений{phase === "revealed" ? " · бюджет подписан" : ""}
      </span>
      <button type="button" className="sim-btn sim-btn--small" onClick={backToMap}>
        К плану <kbd>M</kbd>
      </button>
    </div>
  );
}

/** Simulator UI on top of the city scene (mounted from src/ui/hud/Hud.tsx). */
export function SimHud() {
  const mode = useCityStore((s) => s.mode);
  const revealing = useSimStore((s) => s.revealStep >= 0);
  const infoOpen = useSimStore((s) => s.infoOpen);
  return (
    <>
      <SimBridge />
      {revealing ? (
        <Reveal />
      ) : mode === "map" ? (
        <>
          <PlanPanel />
          {infoOpen && <InfoPanel />}
        </>
      ) : (
        <MiniBar />
      )}
      <FinalDebrief />
      <BriefSheet />
    </>
  );
}
