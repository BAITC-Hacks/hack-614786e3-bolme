"use client";

/**
 * Keeps the 3D scene in sync with the game: replaces the demo hotspots with
 * engine-derived ones (critical problems before signing, results after) and
 * follows camera focus to select the district in the side panel.
 */
import { useEffect } from "react";
import { CRITICAL_THRESHOLD, DISTRICTS } from "@/domain/data";
import { DISTRICT_IDS, INDICATOR_IDS, type DistrictId } from "@/domain/types";
import { useCityStore, type Hotspot } from "@/city/store";
import { num, SHORT } from "./labels";
import { useSimStore } from "./store";
import { useSignedAnalysis } from "./useAnalysis";

const isDistrict = (id: string | undefined): id is DistrictId => !!id && (DISTRICT_IDS as readonly string[]).includes(id);

export function SimBridge() {
  const status = useCityStore((s) => s.status);
  const manifest = useCityStore((s) => s.manifest);
  const plan = useSimStore((s) => s.plan);
  const analysis = useSignedAnalysis();

  // Engine → hotspots ("stones in the water").
  useEffect(() => {
    if (status !== "ready" || !manifest) return;
    const centre = (d: DistrictId) => manifest.districts.find((x) => x.id === d)?.center ?? [0, 0];
    const list: Hotspot[] = [];
    for (const d of DISTRICT_IDS) {
      const [x, z] = centre(d);
      const measures = plan.filter((c) => c.districtId === d).map((c) => c.measureId);
      if (!analysis) {
        const base = DISTRICTS[d].baseline;
        const crit = INDICATOR_IDS.filter((k) => base[k] < CRITICAL_THRESHOLD);
        const weakest = [...INDICATOR_IDS].sort((a, b) => base[a] - base[b]).slice(0, 2);
        const caption = crit.length
          ? `${crit.map((k) => `${SHORT[k]} ${base[k]}`).join(" · ")} — ниже 40`
          : `${weakest.map((k) => `${SHORT[k]} ${base[k]}`).join(" · ")}`;
        list.push({
          id: d,
          districtId: d,
          title: DISTRICTS[d].name,
          caption: measures.length ? `${caption} · мер: ${measures.join(", ")}` : caption,
          x,
          z,
          radius: 950,
          tone: crit.length ? "critical" : measures.length ? "info" : "warning",
        });
      } else {
        const r = analysis.result;
        const crit = r.criticalPairs.filter((p) => p.districtId === d);
        const delta = r.districtScores[d] - r.baselineDistrictScores[d];
        list.push({
          id: d,
          districtId: d,
          title: DISTRICTS[d].name,
          caption: `Балл ${num(r.baselineDistrictScores[d], 1)} → ${num(r.districtScores[d], 1)}${crit.length ? ` · ниже 40: ${crit.map((p) => SHORT[p.indicator]).join(", ")}` : ""}`,
          x,
          z,
          radius: 950,
          tone: crit.length ? "critical" : delta > 0.3 ? "positive" : delta > 0.005 ? "info" : "warning",
        });
      }
    }
    if (analysis?.mods.emergencies) {
      for (const e of analysis.mods.emergencies) {
        const [x, z] = centre(e.event.districtId);
        list.push({
          id: `event:${e.event.id}`,
          districtId: e.event.districtId,
          title: `ЧС · ${e.event.title}`,
          caption: `${e.event.season} · ${e.response.title}`,
          // Pull the marker towards the city centre (Baiterek = origin) so it stays clear of the side panels.
          x: x * 0.55,
          z: z * 0.55 - 500,
          radius: 600,
          tone: e.response.id === "none" ? "critical" : "warning",
        });
      }
    }
    useCityStore.getState().setHotspots(list);
  }, [status, manifest, plan, analysis]);

  // Camera focus → district in the side panel.
  useEffect(
    () =>
      useCityStore.subscribe((s, prev) => {
        if (s.focus === prev.focus || !s.focus) return;
        let id: string | undefined;
        if (s.focus.kind === "district") id = s.focus.id;
        if (s.focus.kind === "hotspot") {
          const focusId = s.focus.id;
          id = s.hotspots.find((h) => h.id === focusId)?.districtId;
        }
        if (isDistrict(id)) useSimStore.getState().setDistrict(id);
      }),
    [],
  );

  return null;
}
