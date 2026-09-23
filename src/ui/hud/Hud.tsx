"use client";

import { useEffect, useState } from "react";
import { LANDMARKS } from "@/city/landmarks";
import { useCityStore, type ViewMode } from "@/city/store";
import { TONE_COLORS } from "@/scene/markers/Ripples";
import { fpsState } from "@/scene/fpsState";
import { ViewSwitcher } from "./ViewSwitcher";
import { SimHud } from "@/ui/sim/SimHud";
import { Intro } from "@/ui/onboarding/Intro";
import { useOnboardingStore } from "@/ui/onboarding/store";
import { HelpButton, Walkthrough } from "@/ui/onboarding/Walkthrough";
import { EventsBell } from "@/ui/sim/EventsCard";
import { FocusActions } from "@/ui/sim/FocusActions";

const HINTS: Record<ViewMode, string[]> = {
  map: ["Тяни — сдвиг", "Колесо — масштаб", "ПКМ — поворот", "Клик по кругу — пролёт в 3D"],
  orbit: ["ЛКМ — вращение", "ПКМ — сдвиг", "Колесо — к курсору", "WASD · Q/E", "Esc — к карте"],
  drone: ["Зажми ЛКМ — обзор", "WASD — полёт", "E/Space — выше · Q/C — ниже", "Shift — быстрее", "Esc — к карте"],
  tour: ["Любое действие — перехватить камеру", "Esc — к карте"],
};

const EYEBROW = { hotspot: "Событие в районе", landmark: "Ориентир", district: "Район", point: "Место" } as const;

const QUICK_LANDMARKS = ["baiterek", "khan-shatyr", "ak-orda", "peace-palace", "hazrat-sultan", "nur-alem", "abu-dhabi-plaza"] as const;

function FocusCard() {
  const focus = useCityStore((s) => s.focus);
  const mode = useCityStore((s) => s.mode);
  const hotspots = useCityStore((s) => s.hotspots);
  const manifest = useCityStore((s) => s.manifest);
  const backToMap = useCityStore((s) => s.backToMap);
  if (!focus || mode !== "orbit") return null;

  let title = "";
  let caption = "";
  let tone: string | undefined;
  if (focus.kind === "hotspot") {
    const h = hotspots.find((x) => x.id === focus.id);
    if (!h) return null;
    title = h.title;
    caption = h.caption;
    tone = TONE_COLORS[h.tone];
  } else if (focus.kind === "landmark") {
    title = LANDMARKS.find((l) => l.id === focus.id)?.title ?? "";
    caption = "Ориентир · модель по реальному контуру OSM";
  } else if (focus.kind === "point") {
    title = focus.title ?? "Точка на карте";
    caption = "Площадка на реальной карте";
  } else {
    const d = manifest?.districts.find((x) => x.id === focus.id);
    title = d ? `Район ${d.name}` : "";
    caption = d ? `${d.buildingCount.toLocaleString("ru-RU")} зданий в границах OSM` : "";
  }

  return (
    <aside className="focus-card" style={tone ? ({ "--tone": tone } as React.CSSProperties) : undefined}>
      <p className="focus-card__eyebrow">{EYEBROW[focus.kind]}</p>
      <h2 className="focus-card__title">{title}</h2>
      <p className="focus-card__caption">{caption}</p>
      <FocusActions focus={focus} />
      <button type="button" className="focus-card__back" onClick={backToMap}>
        <span aria-hidden>←</span> К карте <kbd>Esc</kbd>
      </button>
    </aside>
  );
}

function LandmarkMenu() {
  const mode = useCityStore((s) => s.mode);
  const focus = useCityStore((s) => s.focus);
  const focusLandmark = useCityStore((s) => s.focusLandmark);
  if (mode !== "orbit") return null;
  return (
    <nav className="landmark-menu" aria-label="Ориентиры Астаны">
      {QUICK_LANDMARKS.map((id) => (
        <button
          key={id}
          type="button"
          className="landmark-menu__item"
          aria-pressed={focus?.kind === "landmark" && focus.id === id}
          onClick={() => focusLandmark(id)}
        >
          {LANDMARKS.find((l) => l.id === id)?.title}
        </button>
      ))}
    </nav>
  );
}

function Caption() {
  const caption = useCityStore((s) => s.caption);
  const mode = useCityStore((s) => s.mode);
  if (!caption || mode !== "tour") return null;
  return (
    <div className="cinema-caption" key={caption}>
      <span className="cinema-caption__eyebrow">Облёт Астаны</span>
      <span className="cinema-caption__title">{caption}</span>
    </div>
  );
}

function DebugStats() {
  // Hud renders only after the client-side city load, so window is available.
  const [enabled] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setText(`${fpsState.fps.toFixed(0)} FPS · ${fpsState.calls} draw · ${(fpsState.triangles / 1e6).toFixed(2)}M tris`);
    }, 500);
    return () => window.clearInterval(id);
  }, [enabled]);
  if (!enabled) return null;
  return <div className="debug-stats">{text}</div>;
}

export function Hud() {
  const mode = useCityStore((s) => s.mode);
  const status = useCityStore((s) => s.status);
  const intro = useOnboardingStore((s) => s.stage === "intro");
  if (status !== "ready") return null;
  if (intro)
    return (
      <div className="hud">
        <Intro />
      </div>
    );
  return (
    <div className="hud">
      <header className="brand">
        <span className="brand__mark">АКИМ</span>
      </header>
      <ViewSwitcher />
      <SimHud />
      <FocusCard />
      <LandmarkMenu />
      <Caption />
      {mode !== "map" && (
        <footer className="hud-footer">
          <ul className="controls-hint" aria-label="Управление">
            {HINTS[mode].map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </footer>
      )}
      <div className="top-actions">
        <EventsBell />
        <HelpButton />
      </div>
      <DebugStats />
      <Walkthrough />
    </div>
  );
}
