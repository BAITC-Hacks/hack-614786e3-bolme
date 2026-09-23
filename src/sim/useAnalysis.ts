"use client";

import { useMemo } from "react";
import { simulate } from "@/domain/engine";
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
