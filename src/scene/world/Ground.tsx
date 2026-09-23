"use client";

import { useEffect, useMemo } from "react";
import { Mesh, PlaneGeometry, type BufferGeometry, type Material } from "three";
import type { GroundLayers } from "@/city/geometry/ground";
import { AreaKind } from "@/city/schema";
import { AREA_COLORS, LAYER_ORDER, PALETTE } from "../palette";
import { createLayerMaterial, createMarkingMaterial, createSolidMaterial, createWaterMaterial } from "./materials";

const GROUND_SIZE = 90000;

type LayerSpec = { geometry: BufferGeometry | null; material: Material; order: number; shadow?: boolean };

/**
 * Flat ground: an opaque base plane that writes depth, then every land-use,
 * road and rail layer drawn in painter's order without depth testing (no
 * z-fighting at any zoom), then the 3D bridge/viaduct structures.
 */
export function Ground({ layers }: { layers: GroundLayers }) {
  const { flat, solids, base, disposables } = useMemo(() => {
    const flat: LayerSpec[] = [];
    for (const [kind, geometry] of layers.areas) {
      const material = kind === AreaKind.Water ? createWaterMaterial() : createLayerMaterial(AREA_COLORS[kind]);
      flat.push({ geometry, material, order: LAYER_ORDER.areaBase + kind });
    }
    flat.push(
      { geometry: layers.paths, material: createLayerMaterial(PALETTE.path), order: LAYER_ORDER.paths },
      { geometry: layers.tracks, material: createLayerMaterial(PALETTE.track), order: LAYER_ORDER.tracks },
      { geometry: layers.railBed, material: createLayerMaterial(PALETTE.railBed), order: LAYER_ORDER.railBed },
      { geometry: layers.railTrack, material: createLayerMaterial(PALETTE.railTrack, 0.6), order: LAYER_ORDER.railTrack },
      { geometry: layers.casing, material: createLayerMaterial(PALETTE.casing), order: LAYER_ORDER.casing },
      { geometry: layers.pedestrian, material: createLayerMaterial(PALETTE.pedestrian), order: LAYER_ORDER.pedestrian },
      { geometry: layers.asphalt, material: createLayerMaterial(PALETTE.asphalt, 0.82), order: LAYER_ORDER.asphalt },
      { geometry: layers.markings, material: createMarkingMaterial(), order: LAYER_ORDER.markings },
    );
    const concrete = createSolidMaterial(PALETTE.concrete, 0.85);
    const trackMaterial = createSolidMaterial(PALETTE.railTrack, 0.6);
    const solids: LayerSpec[] = [
      { geometry: layers.parapets, material: concrete, order: 0, shadow: true },
      { geometry: layers.viaduct, material: concrete, order: 0, shadow: true },
      { geometry: layers.viaductTrack, material: trackMaterial, order: 0 },
    ];
    const baseMaterial = createSolidMaterial(PALETTE.ground, 0.97);
    const plane = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    plane.rotateX(-Math.PI / 2);
    const base = new Mesh(plane, baseMaterial);
    base.receiveShadow = true;
    base.renderOrder = LAYER_ORDER.ground;
    // Geometries belong to the prepared city (cached for the page); only materials are ours.
    const disposables: { dispose(): void }[] = [...flat, ...solids].map((l) => l.material);
    disposables.push(baseMaterial, plane);
    return { flat, solids, base, disposables };
  }, [layers]);

  useEffect(
    () => () => {
      for (const d of disposables) d?.dispose();
    },
    [disposables],
  );

  return (
    <group>
      <primitive object={base} />
      {flat.map((l, i) =>
        l.geometry ? (
          <mesh key={`flat-${i}`} geometry={l.geometry} material={l.material} renderOrder={l.order} receiveShadow frustumCulled={false} />
        ) : null,
      )}
      {solids.map((l, i) =>
        l.geometry ? <mesh key={`solid-${i}`} geometry={l.geometry} material={l.material} castShadow={l.shadow} receiveShadow /> : null,
      )}
    </group>
  );
}
