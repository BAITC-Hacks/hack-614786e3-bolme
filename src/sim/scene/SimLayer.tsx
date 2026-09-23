"use client";

/**
 * 3D objects of the plan on the real map: a block per district measure at the
 * district, a beacon in every district for citywide measures. While planning
 * they are translucent pulsing "ghosts"; after signing they are built. The
 * optional "optimum ghost" shows the exact best plan in gold.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, MeshStandardMaterial } from "three";
import type { CityManifest } from "@/city/schema";
import { DIRECTIONS, MEASURES } from "@/domain/data";
import { rankInfo } from "@/domain/rank";
import type { Choice, DirectionId } from "@/domain/types";
import { DISTRICT_IDS } from "@/domain/types";
import { useSimStore } from "../store";

type Item = { key: string; x: number; z: number; w: number; h: number; round: boolean; dir: DirectionId };

function layout(plan: Choice[], manifest: CityManifest, angle0: number, radius: number): Item[] {
  const centre = (id: string) => manifest.districts.find((d) => d.id === id)?.center ?? [0, 0];
  const perDistrict = new Map<string, number>();
  const items: Item[] = [];
  for (const c of plan) {
    const m = MEASURES[c.measureId];
    const targets = c.districtId ? [c.districtId] : [...DISTRICT_IDS];
    for (const d of targets) {
      const i = perDistrict.get(d) ?? 0;
      perDistrict.set(d, i + 1);
      const [cx, cz] = centre(d);
      const a = angle0 + i * 1.25;
      items.push({
        key: `${c.measureId}:${d}`,
        x: cx + Math.cos(a) * radius,
        z: cz + Math.sin(a) * radius,
        w: c.districtId ? 300 : 170,
        h: c.districtId ? 160 + m.cost * 9 : 260,
        round: !c.districtId,
        dir: m.direction,
      });
    }
  }
  return items;
}

function useMaterials() {
  const mats = useMemo(() => {
    const out = {} as Record<DirectionId | "ghost", MeshStandardMaterial>;
    for (const [id, d] of Object.entries(DIRECTIONS))
      out[id as DirectionId] = new MeshStandardMaterial({ color: new Color(d.color), emissive: new Color(d.color), emissiveIntensity: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
    out.ghost = new MeshStandardMaterial({ color: "#ffd166", emissive: "#ffb000", emissiveIntensity: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
    return out;
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

export function SimLayer({ manifest }: { manifest: CityManifest }) {
  const plan = useSimStore((s) => s.plan);
  const phase = useSimStore((s) => s.phase);
  const ghost = useSimStore((s) => s.ghost);
  const mats = useMaterials();
  const built = phase === "revealed";

  const items = useMemo(() => layout(plan, manifest, -0.6, 620), [plan, manifest]);
  const ghostItems = useMemo(() => (ghost ? layout(rankInfo(0).optimum.plan, manifest, 2.4, 620) : []), [ghost, manifest]);

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4);
    for (const [key, m] of Object.entries(mats)) {
      if (key === "ghost") {
        m.opacity = 0.25 + 0.2 * pulse;
        continue;
      }
      m.opacity = built ? 0.95 : 0.35 + 0.25 * pulse;
      m.depthWrite = built;
      m.emissiveIntensity = built ? 0.25 : 0.35 + 0.3 * pulse;
    }
  });

  return (
    <group name="sim-layer">
      {items.map((it) => (
        <mesh key={it.key} position={[it.x, it.h / 2, it.z]} material={mats[it.dir]} castShadow={built} renderOrder={50}>
          {it.round ? <cylinderGeometry args={[it.w / 2, it.w / 2, it.h, 20]} /> : <boxGeometry args={[it.w, it.h, it.w * 0.8]} />}
        </mesh>
      ))}
      {ghostItems.map((it) => (
        <mesh key={`ghost:${it.key}`} position={[it.x, it.h / 2, it.z]} material={mats.ghost} renderOrder={51}>
          {it.round ? <cylinderGeometry args={[it.w / 2, it.w / 2, it.h, 20]} /> : <boxGeometry args={[it.w, it.h, it.w * 0.8]} />}
        </mesh>
      ))}
    </group>
  );
}
