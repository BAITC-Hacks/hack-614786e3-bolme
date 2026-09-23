"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Icon } from "@/ui/icons";
import { GUIDE_STEPS } from "./steps";
import { useOnboardingStore } from "./store";

type Rect = { x: number; y: number; w: number; h: number };

const PAD = 8;
const CARD_W = 340;
const CARD_H_EST = 240;
const GAP = 16;

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

/** Tracks the target element's box every frame (hotspot labels follow the camera). */
function useTargetRect(target: string | null, step: number): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!target) return;
    const first = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    first?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    let raf = 0;
    let last: Rect | null = null;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      const r = el?.getBoundingClientRect();
      const visible = !!r && r.width > 0 && r.height > 0 && getComputedStyle(el!).opacity !== "0";
      // Clip to the scrolling panel so a long list does not spill past its frame.
      const frame = el?.closest(".sim-panel")?.getBoundingClientRect();
      const top = Math.max(r?.top ?? 0, frame?.top ?? 0);
      const bottom = Math.min(r?.bottom ?? 0, frame?.bottom ?? window.innerHeight - PAD);
      const next = visible && r ? { x: r.left, y: top, w: r.width, h: Math.max(0, bottom - top) } : null;
      if (!sameRect(next, last)) {
        last = next;
        setRect(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, step]);
  return target ? rect : null;
}

/** Card beside the spotlight: right, left, below or above — whichever fits. */
function placeCard(r: Rect | null): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  if (!r) return { left: (vw - w) / 2, top: vh / 2 - CARD_H_EST / 2, width: w };
  const clampY = (y: number) => Math.max(16, Math.min(y, vh - CARD_H_EST - 16));
  const clampX = (x: number) => Math.max(16, Math.min(x, vw - w - 16));
  if (r.x + r.w + GAP + w + 16 <= vw) return { left: r.x + r.w + GAP, top: clampY(r.y), width: w };
  if (r.x - GAP - w >= 16) return { left: r.x - GAP - w, top: clampY(r.y), width: w };
  if (r.y + r.h + GAP + CARD_H_EST <= vh) return { left: clampX(r.x + r.w / 2 - w / 2), top: r.y + r.h + GAP, width: w };
  return { left: clampX(r.x + r.w / 2 - w / 2), top: Math.max(16, r.y - GAP - CARD_H_EST), width: w };
}

export function Walkthrough() {
  const stage = useOnboardingStore((s) => s.stage);
  const step = useOnboardingStore((s) => s.step);
  const next = useOnboardingStore((s) => s.next);
  const back = useOnboardingStore((s) => s.back);
  const finish = useOnboardingStore((s) => s.finish);
  const active = stage === "guide";
  const current = GUIDE_STEPS[step];
  const rect = useTargetRect(active ? (current?.target ?? null) : null, step);

  useEffect(() => {
    if (active) current?.before?.();
  }, [active, current]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") next(GUIDE_STEPS.length);
      else if (e.code === "ArrowLeft") back();
      else if (e.code === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, back, finish]);

  if (!active || !current) return null;
  const last = step === GUIDE_STEPS.length - 1;
  const top = current.grow?.top ?? 0;
  const side = current.grow?.x ?? 0;
  const grown = rect ? { x: rect.x - side, y: rect.y - top, w: rect.w + side * 2, h: rect.h + top } : null;
  const hole = grown ? { x: grown.x - PAD, y: grown.y - PAD, w: grown.w + PAD * 2, h: grown.h + PAD * 2 } : null;
  return (
    <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="guide__scrim" onClick={() => next(GUIDE_STEPS.length)} />
      {hole ? (
        <div className="guide__spot" style={{ transform: `translate(${hole.x}px, ${hole.y}px)`, width: hole.w, height: hole.h }} aria-hidden />
      ) : (
        <div className="guide__veil" aria-hidden />
      )}
      <section className="guide__card" style={placeCard(grown)} key={step}>
        <header className="guide__head">
          <span className="guide__icon">
            <Icon name={current.icon} size={18} />
          </span>
          <span className="guide__count">
            {step + 1} / {GUIDE_STEPS.length}
          </span>
          <button type="button" className="guide__close" onClick={finish} aria-label="Закрыть обучение">
            <Icon name="close" size={16} />
          </button>
        </header>
        <h2 id="guide-title" className="guide__title">
          {current.title}
        </h2>
        <p className="guide__body">{current.body}</p>
        <div className="guide__dots" aria-hidden>
          {GUIDE_STEPS.map((_, i) => (
            <span key={i} className={i === step ? "is-now" : i < step ? "is-done" : ""} />
          ))}
        </div>
        <footer className="guide__actions">
          <button type="button" className="sim-btn sim-btn--ghost sim-btn--small" onClick={finish}>
            Пропустить
          </button>
          <span className="guide__spacer" />
          {step > 0 && (
            <button type="button" className="sim-btn sim-btn--small" onClick={back} aria-label="Назад">
              <Icon name="arrowLeft" size={14} />
            </button>
          )}
          <button type="button" className="sim-btn sim-btn--primary sim-btn--small" onClick={() => next(GUIDE_STEPS.length)} autoFocus>
            {last ? "Начать игру" : "Далее"}
            <Icon name={last ? "check" : "arrow"} size={14} />
          </button>
        </footer>
      </section>
    </div>
  );
}

/** «?» in the top-right corner: replay the walkthrough. */
export function HelpButton() {
  const stage = useOnboardingStore((s) => s.stage);
  const startGuide = useOnboardingStore((s) => s.startGuide);
  if (stage === "intro") return null;
  return (
    <button type="button" className="help-button" data-tour="help" onClick={startGuide} title="Как играть — обучение">
      <Icon name="help" size={18} />
      <span>Как играть</span>
    </button>
  );
}
