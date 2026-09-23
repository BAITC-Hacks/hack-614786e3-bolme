"use client";

import { useCityStore } from "@/city/store";
import { bindLabel } from "@/scene/labels/anchors";

/**
 * Labels for hotspots ("stones in the water") and districts without an event.
 * Positions are driven by LabelProjector; this component only owns the DOM.
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
  if (status !== "ready" || !manifest) return null;

  const onMap = mode === "map";
  const quietDistricts = manifest.districts.filter((d) => !hotspots.some((h) => h.districtId === d.id));

  return (
    <div className="map-labels" aria-label="Метки на карте">
      {hotspots.map((h) => {
        const isFocused = focus?.kind === "hotspot" && focus.id === h.id;
        const visible = (onMap || hovered === h.id) && !isFocused;
        return (
          <button
            key={h.id}
            type="button"
            ref={(el) => bindLabel(`hotspot:${h.id}`, el, h.x, 0, h.z + h.radius * 1.02)}
            className={`hotspot-label${hovered === h.id ? " is-hovered" : ""}${visible ? "" : " is-hidden"}`}
            data-tone={h.tone}
            onPointerEnter={() => setHovered(h.id)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => selectHotspot(h.id)}
            tabIndex={visible ? 0 : -1}
          >
            <span className="hotspot-label__title">{h.title}</span>
            <span className="hotspot-label__caption">{h.caption}</span>
          </button>
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
          <span className="district-label__meta">{d.buildingCount.toLocaleString("ru-RU")} зданий</span>
        </button>
      ))}
    </div>
  );
}
