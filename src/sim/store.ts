/**
 * Game state of the simulator (plan, phase, mods, AI report).
 * Separate from the shared city/camera store (src/city/store.ts): the sim
 * only *drives* the scene through that store's public actions.
 */
import { create } from "zustand";
import type { Choice, DistrictId, MeasureId } from "@/domain/types";
import { evaluatePlan, issuesForAdding } from "@/domain/engine";
import type { ReportPayload } from "./report";

/**
 * Game stages, strictly in order: world settings → promises (only with the
 * «Память народа» mod) → the 5 decisions → signed. Mods and the Аким/Аналитик
 * mode are fixed once the world is created; «Новая игра» starts over.
 */
export type Phase = "setup" | "promises" | "plan" | "revealed";

/** Exactly this many promises when the «Память народа» mod is on. */
export const PROMISE_COUNT = 3;

const DEFAULT_MODS: ModSettings = { emergencies: true, anger: true, promises: true };

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
  /** Setup stage only. */
  setAnalyst: (on: boolean) => void;
  setGhost: (on: boolean) => void;
  /** Setup stage only. */
  setMod: (key: keyof ModSettings, on: boolean) => void;
  /** Promises stage only; at most PROMISE_COUNT. */
  togglePromise: (id: string) => void;
  /** Setup → promises (mod on) or straight to the plan. */
  createWorld: () => void;
  /** Promises → plan, once exactly PROMISE_COUNT are chosen. */
  confirmPromises: () => void;
  /** Promises → back to the world settings. */
  backToSetup: () => void;
  /** Start over from the world settings. */
  newGame: () => void;
  setResponse: (eventId: string, responseId: string) => void;
  sign: () => void;
  edit: () => void;
  setReport: (report: ReportState) => void;
  showToast: (text: string, tone?: "error" | "info") => void;
  clearToast: () => void;
};

export const useSimStore = create<SimState>()((set) => ({
  phase: "setup",
  plan: [],
  district: "nura",
  analyst: false,
  ghost: false,
  mods: DEFAULT_MODS,
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
  // Rules are enforced at the action boundary too, not only by disabled buttons.
  addChoice: (choice) =>
    set((s) => (s.phase === "plan" && issuesForAdding(s.plan, choice).length === 0 ? { plan: [...s.plan, choice], report: { status: "idle" } } : {})),
  removeChoice: (measureId) =>
    set((s) => ({ plan: s.plan.filter((c) => c.measureId !== measureId), report: { status: "idle" } })),
  replacePlan: (plan) => set(evaluatePlan(plan).ok ? { plan, phase: "plan", report: { status: "idle" }, responses: {}, ghost: false, revealStep: -1, debriefOpen: false } : {}),
  setAnalyst: (analyst) => set((s) => (s.phase === "setup" ? { analyst } : {})),
  setGhost: (ghost) => set({ ghost }),
  setMod: (key, on) => set((s) => (s.phase === "setup" ? { mods: { ...s.mods, [key]: on } } : {})),
  togglePromise: (id) =>
    set((s) => {
      if (s.phase !== "promises") return {};
      if (s.promiseIds.includes(id)) return { promiseIds: s.promiseIds.filter((p) => p !== id) };
      return s.promiseIds.length >= PROMISE_COUNT ? {} : { promiseIds: [...s.promiseIds, id] };
    }),
  createWorld: () =>
    set((s) => (s.phase !== "setup" ? {} : s.mods.promises ? { phase: "promises" } : { phase: "plan", promiseIds: [] })),
  confirmPromises: () => set((s) => (s.phase === "promises" && s.promiseIds.length === PROMISE_COUNT ? { phase: "plan" } : {})),
  backToSetup: () => set((s) => (s.phase === "promises" ? { phase: "setup" } : {})),
  newGame: () =>
    set({
      phase: "setup",
      plan: [],
      mods: DEFAULT_MODS,
      analyst: false,
      promiseIds: [],
      responses: {},
      report: { status: "idle" },
      ghost: false,
      revealStep: -1,
      debriefOpen: false,
    }),
  setResponse: (eventId, responseId) => set((s) => ({ responses: { ...s.responses, [eventId]: responseId } })),
  sign: () => set((s) => (s.phase === "plan" && evaluatePlan(s.plan).ok ? { phase: "revealed", report: { status: "idle" }, responses: {}, ghost: false, revealStep: 0, debriefOpen: false } : {})),
  edit: () => set({ phase: "plan", ghost: false, revealStep: -1, debriefOpen: false }),
  setReport: (report) => set({ report }),
  showToast: (text, tone = "error") => set({ toast: { text, tone } }),
  clearToast: () => set({ toast: null }),
}));
