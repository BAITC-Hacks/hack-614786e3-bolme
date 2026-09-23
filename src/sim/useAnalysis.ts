"use client";

import { useMemo } from "react";
import { MEASURES } from "@/domain/data";
import { issuesForAdding, simulate } from "@/domain/engine";
import { MEASURE_IDS, type Choice, type MeasureId } from "@/domain/types";
import { analyzePlan } from "./analysis";
import { useSimStore } from "./store";

/** Live simulation of the current (possibly partial) plan. */
export function usePreview() {
  const plan = useSimStore((s) => s.plan);
  return useMemo(() => simulate(plan), [plan]);
}

/** Full analysis of the signed plan (null while planning or if invalid). */
export function useSignedAnalysis() {
  const phase = useSimStore((s) => s.phase);
  const plan = useSimStore((s) => s.plan);
  const mods = useSimStore((s) => s.mods);
  const responses = useSimStore((s) => s.responses);
  const promiseIds = useSimStore((s) => s.promiseIds);
  return useMemo(() => {
    if (phase !== "revealed") return null;
    const a = analyzePlan(plan, { mods, responses, promiseIds });
    return a.ok ? a.analysis : null;
  }, [phase, plan, mods, responses, promiseIds]);
}

/** Score of the untouched city: the reference for analyst forecasts. */
export const BASELINE = simulate([]);

/** Analyst mode: Score change from adding each measure now (district measures go to the selected district). */
export function useGainIfAdded(): Partial<Record<MeasureId, number>> {
  const plan = useSimStore((s) => s.plan);
  const district = useSimStore((s) => s.district);
  return useMemo(() => {
    const current = simulate(plan).score;
    const entries = MEASURE_IDS.filter((id) => !plan.some((c) => c.measureId === id)).flatMap((id) => {
      const choice: Choice = { measureId: id, districtId: MEASURES[id].scope === "city" ? null : district };
      return issuesForAdding(plan, choice).length ? [] : [[id, simulate([...plan, choice]).score - current] as const];
    });
    return Object.fromEntries(entries);
  }, [plan, district]);
}

/** Analyst mode: what each chosen measure adds to the plan (Score without it vs with it). */
export function useGainOf(): Partial<Record<MeasureId, number>> {
  const plan = useSimStore((s) => s.plan);
  return useMemo(() => {
    const full = simulate(plan).score;
    return Object.fromEntries(plan.map((c) => [c.measureId, full - simulate(plan.filter((x) => x !== c)).score]));
  }, [plan]);
}
