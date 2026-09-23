"use client";

/**
 * District boundaries (real OSM admin_level=6 relations) drawn as thin dashed
 * screen-space lines. Visible on the map, fading out in 3D. Names are DOM
 * labels (MapLabels).
 */
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Line2 } from "three-stdlib";
import { forEachPolygon } from "@/city/decode";
import type { CityManifest } from "@/city/schema";
import { useCityStore } from "@/city/store";
import { cameraState } from "../camera/cameraState";
import { LAYER_ORDER } from "../palette";

type Outline = { districtIndex: number; points: [number, number, number][] };

export function Districts({ manifest }: { manifest: CityManifest }) {
  const mode = useCityStore((s) => s.mode);
  const highlighted = useCityStore((s) => s.highlightedDistrict);
  const lines = useRef<(Line2 | null)[]>([]);

  const outlines = useMemo<Outline[]>(() => {
    const result: Outline[] = [];
    manifest.districts.forEach((d, districtIndex) => {
      forEachPolygon(d.polygons, (_, rings) => {
        const ring = rings[0];
        const points: [number, number, number][] = [];
        for (let k = 0; k < ring.length; k += 2) points.push([ring[k], 1, ring[k + 1]]);
        if (points.length > 1) points.push(points[0]);
        result.push({ districtIndex, points });
      });
    });
    return result;
  }, [manifest]);

  useFrame(() => {
    const visibility = mode === "drone" ? 0 : 0.12 + 0.88 * cameraState.mapness;
    lines.current.forEach((line, i) => {
      if (!line) return;
      const isHighlighted = outlines[i].districtIndex === highlighted;
      line.material.opacity = isHighlighted ? Math.max(0.9, visibility) : visibility * 0.8;
      line.material.linewidth = isHighlighted ? 3 : 1.5;
    });
  });

  return (
    <group>
      {outlines.map((o, i) => (
        <Line
          key={i}
          ref={(el) => {
            lines.current[i] = el as unknown as Line2 | null;
          }}
          points={o.points}
          color={o.districtIndex === highlighted ? "#ffd27a" : "#ffffff"}
          lineWidth={1.5}
          transparent
          depthTest={false}
          renderOrder={LAYER_ORDER.districts}
          dashed
          dashSize={70}
          gapSize={45}
        />
      ))}
    </group>
  );
}
