"use client";

/**
 * City life: cars and buses on the real arterial network and LRT trains on
 * the elevated line. Instanced meshes, matrices written straight from the
 * simulation; hidden (and not simulated) when the camera is far away.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferAttribute, Color, DynamicDrawUsage, InstancedMesh, MeshStandardMaterial, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VIADUCT } from "@/city/geometry/ground";
import { Fleet, mulberry32, type NetworkEdge, type PathNetwork } from "@/city/geometry/traffic";
import { RoadClass } from "@/city/schema";
import { cameraState } from "../camera/cameraState";

/** Beyond this camera distance vehicles are sub-pixel: skip them entirely. */
const VISIBLE_DISTANCE = 9000;
const MAX_CARS = 15000;

const CAR_COLORS = ["#f2f2f0", "#f2f2f0", "#f2f2f0", "#b9bdc3", "#b9bdc3", "#2a2d33", "#2a2d33", "#5d626a", "#2f5f9e", "#b8322c", "#cdb892", "#f2c230"];

/** Per-metre spawn density by road class (vehicles per metre of directed lane). */
const DENSITY: Record<number, number> = {
  [RoadClass.Motorway]: 1 / 24,
  [RoadClass.Primary]: 1 / 28,
  [RoadClass.Secondary]: 1 / 45,
  [RoadClass.Tertiary]: 1 / 95,
};
const SPEED: Record<number, number> = {
  [RoadClass.Motorway]: 19,
  [RoadClass.Primary]: 15,
  [RoadClass.Secondary]: 13,
  [RoadClass.Tertiary]: 10.5,
};

/** Lane placement: two-way roads use the right half, one-way roads spread across. */
function laneOffset(e: NetworkEdge, lane: number): number {
  if (e.oneway) return (lane * 2 - 1) * Math.max(0, e.width / 2 - 1.8);
  return 1.3 + lane * Math.max(0, e.width / 2 - 2.6);
}

type Rgb = [number, number, number];
const BODY: Rgb = [1, 1, 1];
const GLASS: Rgb = [0.26, 0.29, 0.34];

/** Box with a constant vertex colour; the instance colour tints it (body paint). */
function box(w: number, h: number, l: number, y: number, z: number, rgb: Rgb): BufferGeometry {
  const g = new BoxGeometry(w, h, l).toNonIndexed();
  g.translate(0, y, z);
  g.deleteAttribute("uv");
  const count = g.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(rgb, i * 3);
  g.setAttribute("color", new BufferAttribute(colors, 3));
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("Vehicle geometry merge failed");
  return g;
}

/** Car: body + glass cabin, 4.4 m long; local +z = forward. */
const carGeometry = () => merge([box(1.8, 0.95, 4.4, 0.72, 0, BODY), box(1.58, 0.62, 2.3, 1.5, -0.25, GLASS)]);
/** City bus, 12 m, with a dark window band. */
const busGeometry = () => merge([box(2.5, 1.2, 12, 0.95, 0, BODY), box(2.52, 0.95, 11.6, 2.05, 0, GLASS), box(2.5, 0.3, 12, 2.7, 0, BODY)]);
/** LRT train: three coupled cars, white with a teal band. */
const trainGeometry = () =>
  merge([
    box(2.65, 1.4, 42, 0.95, 0, BODY),
    box(2.67, 0.9, 41.6, 2.1, 0, GLASS),
    box(2.65, 0.55, 42, 2.8, 0, BODY),
    box(2.7, 0.35, 42.2, 1.55, 0, [0.05, 0.55, 0.62]),
  ]);

type Layer = { mesh: InstancedMesh; fleet: Fleet };

function makeLayer(geometry: BufferGeometry, material: MeshStandardMaterial, fleet: Fleet, colors: (i: number) => string): Layer {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, fleet.count));
  mesh.count = fleet.count;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  const color = new Color();
  for (let i = 0; i < fleet.count; i++) mesh.setColorAt(i, color.set(colors(i)));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  fleet.writeMatrices(mesh.instanceMatrix.array as Float32Array);
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, fleet };
}

export function Traffic({ roads, rails }: { roads: PathNetwork; rails: PathNetwork }) {
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25, envMapIntensity: 0.9 }), []);

  const layers = useMemo(() => {
    const expected = roads.edges.reduce((acc, e) => acc + e.length * (DENSITY[e.cls] ?? 0), 0);
    const carCount = Math.min(MAX_CARS, Math.round(expected));
    const rng = mulberry32(7);
    const cars = new Fleet(roads, {
      count: carCount,
      seed: 11,
      weight: (e) => DENSITY[e.cls] ?? 0,
      speed: (e) => SPEED[e.cls] ?? 11,
      lateral: laneOffset,
      height: () => 0,
    });
    const buses = new Fleet(roads, {
      count: Math.round(carCount * 0.035),
      seed: 23,
      weight: (e) => (e.cls <= RoadClass.Secondary ? 1 : 0),
      speed: (e) => (SPEED[e.cls] ?? 11) * 0.8,
      lateral: (e) => laneOffset(e, 0.95),
      height: () => 0,
    });
    const trains = new Fleet(rails, {
      count: Math.max(3, Math.round(rails.totalLength / 5000)),
      seed: 37,
      weight: () => 1,
      speed: () => 16,
      lateral: () => 0,
      height: (e) => (e.elevated ? VIADUCT.deckTop : 0.3),
    });
    return [
      makeLayer(carGeometry(), material, cars, () => CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]),
      makeLayer(busGeometry(), material, buses, (i) => (i % 3 === 0 ? "#e2b23a" : "#18a394")),
      makeLayer(trainGeometry(), material, trains, () => "#f4f6f7"),
    ];
  }, [roads, rails, material]);

  useEffect(
    () => () => {
      for (const l of layers) {
        l.mesh.geometry.dispose();
        l.mesh.dispose();
      }
      material.dispose();
    },
    [layers, material],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const visible = cameraState.distance < VISIBLE_DISTANCE && cameraState.mode !== "map";
    for (const { mesh, fleet } of layers) {
      mesh.visible = visible || (cameraState.distance < VISIBLE_DISTANCE * 0.5 && fleet.count > 0);
      if (!mesh.visible) continue;
      fleet.step(dt);
      fleet.writeMatrices(mesh.instanceMatrix.array as Float32Array);
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {layers.map((l, i) => (
        <primitive key={i} object={l.mesh} />
      ))}
    </group>
  );
}
