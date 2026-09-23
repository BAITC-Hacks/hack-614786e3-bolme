/** Line icons for the HUD (24×24, stroke = currentColor). */
import type { MeasureId } from "@/domain/types";

const PATHS = {
  bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="3" />
      <path d="M4 11h16M8 18v2.5M16 18v2.5M8 14.5h.01M16 14.5h.01" />
    </>
  ),
  trafficLight: (
    <>
      <rect x="8" y="2.5" width="8" height="19" rx="4" />
      <path d="M12 7h.01M12 12h.01M12 17h.01" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M9 21l1.5-4M15 21l-1.5-4M9 13.5h.01M15 13.5h.01" />
    </>
  ),
  tree: <path d="M12 21v-6M12 3 6 11h3l-3 4h12l-3-4h3l-6-8Z" />,
  leaf: <path d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15M5 19l8-8" />,
  wind: <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  school: <path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5M9.5 11h1M13.5 11h1" />,
  heart: (
    <>
      <path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z" />
      <path d="M4.5 12h4l1.5-3 2.5 5 1.5-2h5" />
    </>
  ),
  sport: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3ZM9 12l2 2 4-4" />,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  pipe: <path d="M3 7h6a3 3 0 0 1 3 3v11M12 10h9M3 4v6M21 7v6" />,
  siren: <path d="M7 18v-6a5 5 0 0 1 10 0v6M5 21h14v-3H5ZM12 3v1.5M4.2 6.2l1 1M19.8 6.2l-1 1" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  flame: <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6Z" />,
  smog: <path d="M3 8c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 13c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 18c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.5h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </>
  ),
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  sparkle: <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7ZM19 17l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 0 11-3v3" />
      <path d="M16 13.5h.01" />
    </>
  ),
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />,
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.8 5 3.2-5 3.2V8.8Z" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

export const MEASURE_ICONS: Record<MeasureId, IconName> = {
  M1: "bus",
  M2: "trafficLight",
  M3: "train",
  M4: "tree",
  M5: "leaf",
  M6: "wind",
  M7: "school",
  M8: "heart",
  M9: "sport",
  M10: "camera",
  M11: "shield",
  M12: "chat",
  M13: "pipe",
  M14: "siren",
};

/** Emergency id (src/domain/mods.ts) → icon. */
export const EVENT_ICONS: Record<string, IconName> = {
  "flood-nura": "drop",
  "heating-almaty": "flame",
  "smog-saryarka": "smog",
};
