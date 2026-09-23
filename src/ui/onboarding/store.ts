/**
 * Onboarding state: cinematic intro over the flyover → world settings
 * (src/ui/sim/WorldSetup.tsx) → spotlight walkthrough → play.
 * Steps live in ./steps.ts; add a step there when a new feature ships.
 */
import { create } from "zustand";
import { useCityStore } from "@/city/store";

export type OnboardingStage = "intro" | "guide" | "done";

type OnboardingState = {
  stage: OnboardingStage;
  step: number;
  /** The player asked for the walkthrough at the intro: it starts once the world is created. */
  guidePending: boolean;
  /** Leave the intro for the world settings; the flyover keeps playing behind them. */
  leaveIntro: (withGuide: boolean) => void;
  /** World created: run the walkthrough if it was asked for. */
  startPendingGuide: () => void;
  /** Land on the map and start the walkthrough. */
  startGuide: () => void;
  /** Leave the intro or the guide and play. */
  finish: () => void;
  next: (total: number) => void;
  back: () => void;
};

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  stage: "intro",
  step: 0,
  guidePending: false,
  leaveIntro: (withGuide) => set({ stage: "done", step: 0, guidePending: withGuide }),
  startPendingGuide: () => {
    const city = useCityStore.getState();
    if (city.mode === "tour") city.backToMap();
    set((s) => (s.guidePending ? { stage: "guide", step: 0, guidePending: false } : {}));
  },
  startGuide: () => {
    useCityStore.getState().backToMap();
    set({ stage: "guide", step: 0 });
  },
  finish: () => {
    const city = useCityStore.getState();
    if (city.mode === "tour") city.backToMap();
    set({ stage: "done", step: 0 });
  },
  next: (total) => set((s) => (s.step + 1 >= total ? { stage: "done", step: 0 } : { step: s.step + 1 })),
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
}));
