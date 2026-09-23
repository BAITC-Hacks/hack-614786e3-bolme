"use client";

/**
 * «События»: what needs attention right now — critical indicators per district
 * and the authored emergencies (mod «ЧС»). Clicking a row flies the camera there.
 */
import { useState } from "react";
import { CRITICAL_THRESHOLD, DISTRICTS } from "@/domain/data";
import { EMERGENCIES, type Emergency } from "@/domain/mods";
import { DISTRICT_IDS, INDICATOR_IDS, type DistrictId, type IndicatorId } from "@/domain/types";
import { useCityStore } from "@/city/store";
import { num, SHORT } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { useSignedAnalysis } from "@/sim/useAnalysis";
import { EVENT_ICONS, Icon, type IconName } from "@/ui/icons";

type Level = "high" | "mid" | "low" | "ok";
type Row = { id: string; icon: IconName; title: string; meta: string; level: Level; badge: string; hotspot: string };

/** Total indicator points lost over the event: drives the severity badge. */
function severity(e: Emergency): { level: Level; badge: string } {
  const total = Object.values(e.loss).reduce((s, v) => s + Math.abs(v ?? 0), 0) * e.durationQuarters;
  if (total >= 40) return { level: "high", badge: "Высокий" };
  if (total >= 20) return { level: "mid", badge: "Средний" };
  return { level: "low", badge: "Умеренный" };
}

function criticalRows(values: (d: DistrictId, k: IndicatorId) => number): Row[] {
  return DISTRICT_IDS.flatMap((d) => {
    const crit = INDICATOR_IDS.filter((k) => values(d, k) < CRITICAL_THRESHOLD);
    if (!crit.length) return [];
    return [
      {
        id: `crit-${d}`,
        icon: "alert" as const,
        title: `${DISTRICTS[d].name}: ${crit.map((k) => `${SHORT[k].toLowerCase()} ${num(values(d, k), 0)}`).join(", ")}`,
        meta: "Ниже критической черты 40 · −1 к Score за каждый",
        level: "high" as const,
        badge: "Требует внимания",
        hotspot: d,
      },
    ];
  });
}

function useRows(): Row[] {
  const emergenciesOn = useSimStore((s) => s.mods.emergencies);
  const a = useSignedAnalysis();
  if (!a) {
    const rows = criticalRows((d, k) => DISTRICTS[d].baseline[k]);
    if (emergenciesOn)
      rows.push(
        ...EMERGENCIES.map((e) => ({
          id: e.id,
          icon: EVENT_ICONS[e.id] ?? "bolt",
          title: e.title,
          meta: `${e.season} · прогноз`,
          hotspot: e.districtId,
          ...severity(e),
        })),
      );
    return rows;
  }
  const rows = criticalRows((d, k) => a.result.indicators[d][k]);
  for (const e of a.mods.emergencies ?? []) {
    const ignored = e.response.id === "none";
    rows.push({
      id: e.event.id,
      icon: EVENT_ICONS[e.event.id] ?? "bolt",
      title: e.event.title,
      meta: `${e.event.season} · ${e.response.title}`,
      level: ignored ? "high" : "ok",
      badge: ignored ? "Без реакции" : `Реакция · ${e.response.cost} ед.`,
      hotspot: `event:${e.event.id}`,
    });
  }
  return rows;
}

/** Top-right bell: toggles the right panel; the badge keeps counting events while it is collapsed. */
export function EventsBell() {
  const mode = useCityStore((s) => s.mode);
  const revealing = useSimStore((s) => s.revealStep >= 0);
  const open = useSimStore((s) => s.infoOpen);
  const setOpen = useSimStore((s) => s.setInfoOpen);
  const rows = useRows();
  if (mode !== "map" || revealing) return null;
  const urgent = rows.some((r) => r.level === "high");
  return (
    <button
      type="button"
      className="events-bell"
      data-tour="events-bell"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
      title={open ? "Свернуть панель — события останутся в колокольчике" : "Показать события и состояние города"}
    >
      <Icon name="bell" size={18} />
      <span>{open ? "Свернуть" : "События"}</span>
      {rows.length > 0 && (
        <b key={rows.length} className={`events-bell__badge${urgent ? " is-urgent" : ""}`}>
          {rows.length}
        </b>
      )}
    </button>
  );
}

export function EventsCard() {
  const [open, setOpen] = useState(true);
  const selectHotspot = useCityStore((s) => s.selectHotspot);
  const rows = useRows();
  return (
    <div className="sim-events-card" data-tour="events">
      <button type="button" className="sim-events-card__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          События <b>· {rows.length}</b>
        </span>
        <Icon name="chevron" size={18} className={open ? "is-open" : ""} />
      </button>
      {open && (
        <ul className="sim-events-card__list">
          {rows.length === 0 && <li className="sim-events-card__empty">Критических провалов нет — город спокоен.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className={`sim-event-row is-${r.level}`} onClick={() => selectHotspot(r.hotspot)} title="Показать на карте в 3D">
                <span className="sim-event-row__icon">
                  <Icon name={r.icon} size={20} />
                </span>
                <span className="sim-event-row__body">
                  <b>{r.title}</b>
                  <small>{r.meta}</small>
                </span>
                <span className="sim-event-row__badge">{r.badge}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
