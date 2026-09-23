"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MathUtils } from "three";
import type { BuildingChunk } from "@/city/geometry/buildings";
import { useCityStore } from "@/city/store";
import { createBuildingMaterial, sceneUniforms } from "./materials";

export function Buildings({ chunks }: { chunks: BuildingChunk[] }) {
  const material = useMemo(() => createBuildingMaterial(), []);
  const highlighted = useCityStore((s) => s.highlightedDistrict);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    // Fade the district highlight in/out instead of popping.
    if (highlighted >= 0) sceneUniforms.uHighlight.value = highlighted;
    const target = highlighted >= 0 ? 1 : 0;
    sceneUniforms.uHighlightMix.value = MathUtils.damp(sceneUniforms.uHighlightMix.value, target, 4, dt);
  });

  return (
    <group>
      {chunks.map((c) => (
        <mesh key={c.key} geometry={c.geometry} material={material} castShadow receiveShadow userData={{ buildingIds: c.buildingIds }} />
      ))}
    </group>
  );
}
