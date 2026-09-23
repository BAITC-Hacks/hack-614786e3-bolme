/**
 * Game state of the simulator (plan, phase, mods, AI report).
 * Separate from the shared city/camera store (src/city/store.ts): the sim
 * only *drives* the scene through that store's public actions.
 */
import { create } from "zustand";
import type { Choice, DistrictId, MeasureId } from "@/domain/types";
import type { ReportPayload } from "./report";

export type Phase = "plan" | "revealed";

export type ModSettings = {
  /** ЧС: authored city emergencies paid from the unused reserve. */
  emergencies: boolean;
  /** Шкала недовольства: per-district public anger gauge. */
  anger: boolean;
  /** Память народа: public promises that people remember. */
  promises: boolean;
};

export type ReportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ReportPayload }
  | { status: "error"; message: string };

type SimState = {
  phase: Phase;
  plan: Choice[];
  /** District the player is working with (for «Район» measures). */
  district: DistrictId;
  /** Analyst mode shows effect magnitudes and a live score preview. */
  analyst: boolean;
  /** Overlay the exact optimal plan after signing. */
  ghost: boolean;
  mods: ModSettings;
  promiseIds: string[];
  /** Emergency id → chosen response id. */
  responses: Record<string, string>;
  report: ReportState;
  /** A short non-blocking message (why a card cannot be added, etc.). */
  toast: { text: string; tone: "error" | "info" } | null;
  /** Printable one-page brief overlay. */
  briefOpen: boolean;
  /** Right panel (events, city, results); collapsed it leaves the events bell. */
  infoOpen: boolean;
  setInfoOpen: (open: boolean) => void;
  setBriefOpen: (open: boolean) => void;
  /** Cinematic reveal after signing: index of the current shot, -1 = not playing. */
  revealStep: number;
  setRevealStep: (step: number) => void;
  /** Full-screen final analysis ("Итоговый анализ"). */
  debriefOpen: boolean;
  setDebriefOpen: (open: boolean) => void;

  setDistrict: (id: DistrictId) => void;
  addChoice: (choice: Choice) => void;
  removeChoice: (measureId: MeasureId) => void;
  replacePlan: (plan: Choice[]) => void;
  clearPlan: () => void;
  setAnalyst: (on: boolean) => void;
  setGhost: (on: boolean) => void;
  setMod: (key: keyof ModSettings, on: boolean) => void;
  togglePromise: (id: string) => void;
  setResponse: (eventId: string, responseId: string) => void;
  sign: () => void;
  edit: () => void;
  setReport: (report: ReportState) => void;
  showToast: (text: string, tone?: "error" | "info") => void;
  clearToast: () => void;
};

export const useSimStore = create<SimState>()((set) => ({
  phase: "plan",
  plan: [],
  district: "nura",
  analyst: false,
  ghost: false,
  mods: { emergencies: true, anger: true, promises: true },
  promiseIds: [],
  responses: {},
  report: { status: "idle" },
  toast: null,
  briefOpen: false,
  infoOpen: true,
  setInfoOpen: (infoOpen) => set({ infoOpen }),
  setBriefOpen: (briefOpen) => set({ briefOpen }),
  revealStep: -1,
  setRevealStep: (revealStep) => set({ revealStep }),
  debriefOpen: false,
  setDebriefOpen: (debriefOpen) => set({ debriefOpen }),

  setDistrict: (district) => set({ district }),
  addChoice: (choice) => set((s) => ({ plan: [...s.plan, choice], report: { status: "idle" } })),
  removeChoice: (measureId) =>
    set((s) => ({ plan: s.plan.filter((c) => c.measureId !== measureId), report: { status: "idle" } })),
  replacePlan: (plan) => set({ plan, phase: "plan", report: { status: "idle" }, responses: {}, ghost: false, revealStep: -1, debriefOpen: false }),
  clearPlan: () => set({ plan: [], phase: "plan", report: { status: "idle" }, responses: {}, ghost: false, revealStep: -1, debriefOpen: false }),
  setAnalyst: (analyst) => set({ analyst }),
  setGhost: (ghost) => set({ ghost }),
  setMod: (key, on) => set((s) => ({ mods: { ...s.mods, [key]: on } })),
  togglePromise: (id) =>
    set((s) => ({
      promiseIds: s.promiseIds.includes(id)
        ? s.promiseIds.filter((p) => p !== id)
        : s.promiseIds.length >= 3
          ? s.promiseIds
          : [...s.promiseIds, id],
    })),
  setResponse: (eventId, responseId) => set((s) => ({ responses: { ...s.responses, [eventId]: responseId } })),
  sign: () => set({ phase: "revealed", report: { status: "idle" }, responses: {}, ghost: false, revealStep: 0, debriefOpen: false }),
  edit: () => set({ phase: "plan", ghost: false, revealStep: -1, debriefOpen: false }),
  setReport: (report) => set({ report }),
  showToast: (text, tone = "error") => set({ toast: { text, tone } }),
  clearToast: () => set({ toast: null }),
}));
