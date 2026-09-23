"use client";

import { useCityStore, type ViewMode } from "@/city/store";

type ModeSpec = { mode: ViewMode; label: string; hint: string; key: string; icon: React.ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const MODES: ModeSpec[] = [
  {
    mode: "map",
    label: "Карта",
    hint: "Вид сверху",
    key: "M",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
        <path d="M9 4v13M15 6.5v13" />
      </svg>
    ),
  },
  {
    mode: "orbit",
    label: "3D",
    hint: "Объёмный вид",
    key: "3",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </svg>
    ),
  },
  {
    mode: "drone",
    label: "Полёт",
    hint: "Свободная камера",
    key: "F",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
        <path d="M3 13.5 21 5l-5.5 16-3.2-6.3L3 13.5Z" />
        <path d="m12.3 14.7 3.2-3.2" />
      </svg>
    ),
  },
  {
    mode: "tour",
    label: "Облёт",
    hint: "Кинематографичный тур",
    key: "T",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m10 8.8 5 3.2-5 3.2V8.8Z" />
      </svg>
    ),
  },
];

export function ViewSwitcher() {
  const mode = useCityStore((s) => s.mode);
  const setMode = useCityStore((s) => s.setMode);
  const backToMap = useCityStore((s) => s.backToMap);
  return (
    <nav className="view-switcher" aria-label="Режим просмотра карты" data-tour="views">
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          className="view-switcher__item"
          aria-pressed={mode === m.mode}
          title={`${m.hint} · клавиша ${m.key}`}
          onClick={() => (m.mode === "map" ? backToMap() : setMode(m.mode))}
        >
          <span className="view-switcher__icon">{m.icon}</span>
          <span className="view-switcher__label">{m.label}</span>
          <kbd className="view-switcher__key">{m.key}</kbd>
        </button>
      ))}
    </nav>
  );
}
