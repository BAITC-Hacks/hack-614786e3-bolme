"use client";

import { useEffect, useState } from "react";
import { useCityStore, type Hotspot } from "@/city/store";
import { bindLabel } from "@/scene/labels/anchors";
import { Icon } from "@/ui/icons";

const TONE_TEXT: Record<Hotspot["tone"], string> = {
  critical: "Требует внимания",
  warning: "Слабые места",
  info: "Меры в работе",
  positive: "Стало лучше",
};

const isEvent = (h: Hotspot) => h.id.startsWith("event:");
const shortTitle = (h: Hotspot) => (isEvent(h) ? h.title.replace(/^ЧС\s*·\s*/, "") : h.title);

/**
 * Labels for hotspots ("stones in the water") and districts without an event.
 * On the map each ring carries only a compact chip; a click opens a card with
 * the details and a flight to 3D. Positions are driven by LabelProjector.
 */
export function MapLabels() {
  const status = useCityStore((s) => s.status);
  const mode = useCityStore((s) => s.mode);
  const hotspots = useCityStore((s) => s.hotspots);
  const hovered = useCityStore((s) => s.hoveredHotspotId);
  const focus = useCityStore((s) => s.focus);
  const manifest = useCityStore((s) => s.manifest);
  const setHovered = useCityStore((s) => s.setHoveredHotspot);
  const selectHotspot = useCityStore((s) => s.selectHotspot);
  const focusDistrict = useCityStore((s) => s.focusDistrict);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (status !== "ready" || !manifest) return null;

  const onMap = mode === "map";
  const quietDistricts = manifest.districts.filter((d) => !hotspots.some((h) => h.districtId === d.id));

  return (
    <div className="map-labels" aria-label="Метки на карте">
      {hotspots.map((h) => {
        const isFocused = focus?.kind === "hotspot" && focus.id === h.id;
        const visible = (onMap || hovered === h.id) && !isFocused;
        const open = onMap && openId === h.id;
        const event = isEvent(h);
        return (
          <div
            key={h.id}
            ref={(el) => bindLabel(`hotspot:${h.id}`, el, h.x, 0, h.z + h.radius * 1.02)}
            className={`hotspot-pin${open ? " is-open" : ""}${visible ? "" : " is-hidden"}`}
            data-tone={h.tone}
          >
            <button
              type="button"
              className={`hotspot-chip${event ? " hotspot-chip--event" : ""}${hovered === h.id ? " is-hovered" : ""}`}
              data-tour={`hotspot-${h.id}`}
              aria-expanded={open}
              aria-label={event ? h.title : undefined}
              title={event ? h.title : undefined}
              onPointerEnter={() => setHovered(h.id)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => setOpenId(open ? null : h.id)}
              tabIndex={visible ? 0 : -1}
            >
              {event ? <Icon name="bolt" size={15} /> : <span className="hotspot-chip__dot" aria-hidden />}
              {!event && <span className="hotspot-chip__title">{h.title}</span>}
            </button>
            {open && (
              <div className="hotspot-pop" role="dialog" aria-label={h.title}>
                <div className="hotspot-pop__head">
                  <span className="hotspot-pop__eyebrow">{event ? "Чрезвычайная ситуация" : TONE_TEXT[h.tone]}</span>
                  <button type="button" className="hotspot-pop__close" onClick={() => setOpenId(null)} aria-label="Закрыть">
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <b className="hotspot-pop__title">{shortTitle(h)}</b>
                <p className="hotspot-pop__caption">{h.caption}</p>
                <button
                  type="button"
                  className="hotspot-pop__go"
                  onClick={() => {
                    setOpenId(null);
                    selectHotspot(h.id);
                  }}
                >
                  Смотреть в 3D <Icon name="arrow" size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {quietDistricts.map((d) => (
        <button
          key={d.id}
          type="button"
          ref={(el) => bindLabel(`district:${d.id}`, el, d.center[0], 0, d.center[1])}
          className={`district-label${onMap ? "" : " is-hidden"}`}
          onClick={() => focusDistrict(d.id)}
          title={`Показать район ${d.name} в 3D`}
          tabIndex={onMap ? 0 : -1}
        >
          <span className="district-label__name">{d.name}</span>
        </button>
      ))}
    </div>
  );
}
