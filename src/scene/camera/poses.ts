/**
 * Camera poses and shots. A pose is an orbit description around a target:
 * polar 0 = straight down (map), azimuth 0 = camera south of target looking north.
 */
import { MathUtils, Vector3 } from "three";
import type { LandmarkId } from "@/city/landmarks";
import type { CityManifest } from "@/city/schema";
import type { Hotspot } from "@/city/store";

export type Pose = {
  target: Vector3;
  distance: number;
  polar: number;
  azimuth: number;
  fov: number;
};

/** Main screen: straight top-down map. Tiny polar keeps "north up" stable. */
export const MAP_POLAR = 0.0006;
export const MAP_FOV = 30;
export const ORBIT_FOV = 40;
export const ORBIT_POLAR = { min: 0.12, max: 1.36 } as const;
export const DISTANCE = { min: 60, max: 36000 } as const;

export function clonePose(p: Pose): Pose {
  return { target: p.target.clone(), distance: p.distance, polar: p.polar, azimuth: p.azimuth, fov: p.fov };
}

export function poseToPosition(p: Pose, out = new Vector3()): Vector3 {
  const s = Math.sin(p.polar);
  return out.set(
    p.target.x + p.distance * s * Math.sin(p.azimuth),
    p.target.y + p.distance * Math.cos(p.polar),
    p.target.z + p.distance * s * Math.cos(p.azimuth),
  );
}

/** Keeps the ground footprint of the view similar when the FOV changes. */
export function distanceForFov(distance: number, fromFov: number, toFov: number): number {
  return (distance * Math.tan(MathUtils.degToRad(fromFov) / 2)) / Math.tan(MathUtils.degToRad(toFov) / 2);
}

/** Whole-city map pose that frames the built-up cores of all five districts. */
export function overviewPose(manifest: CityManifest, aspect: number): Pose {
  const xs = manifest.districts.map((d) => d.center[0]);
  const zs = manifest.districts.map((d) => d.center[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  // Generous margins: ripples, their labels and the HUD chrome must all fit.
  const width = maxX - minX + 6000;
  const height = maxZ - minZ + 6400;
  const halfTan = Math.tan(MathUtils.degToRad(MAP_FOV) / 2);
  const distance = Math.max(height / (2 * halfTan), width / (2 * halfTan * aspect));
  return {
    target: new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
    distance: MathUtils.clamp(distance, 3000, DISTANCE.max),
    polar: MAP_POLAR,
    azimuth: 0,
    fov: MAP_FOV,
  };
}

/** Preferred viewing direction per landmark (azimuth, polar, distance multiplier). */
const LANDMARK_VIEWS: Partial<Record<LandmarkId, { azimuth: number; polar: number; distance: number; lift: number }>> = {
  baiterek: { azimuth: 1.25, polar: 1.12, distance: 520, lift: 55 },
  "khan-shatyr": { azimuth: 0.55, polar: 1.05, distance: 900, lift: 60 },
  "peace-palace": { azimuth: -0.6, polar: 1.08, distance: 520, lift: 25 },
  "ak-orda": { azimuth: -1.35, polar: 1.1, distance: 600, lift: 30 },
  "hazrat-sultan": { azimuth: 0.4, polar: 1.05, distance: 620, lift: 25 },
  "kazakh-eli": { azimuth: 0.9, polar: 1.1, distance: 420, lift: 40 },
  "nur-alem": { azimuth: 0.35, polar: 1.08, distance: 700, lift: 40 },
  "abu-dhabi-plaza": { azimuth: 0.2, polar: 1.12, distance: 1100, lift: 140 },
  emerald: { azimuth: 0.8, polar: 1.1, distance: 900, lift: 90 },
  "northern-lights": { azimuth: 1.6, polar: 1.1, distance: 800, lift: 70 },
  "transport-tower": { azimuth: 0.1, polar: 1.1, distance: 800, lift: 60 },
  "astana-arena": { azimuth: -0.4, polar: 0.95, distance: 1100, lift: 20 },
};

export function landmarkPose(manifest: CityManifest, id: LandmarkId): Pose | null {
  const anchor = manifest.landmarks[id];
  if (!anchor) return null;
  const view = LANDMARK_VIEWS[id] ?? { azimuth: 0.6, polar: 1.05, distance: Math.max(500, anchor.radius * 6), lift: 30 };
  return {
    target: new Vector3(anchor.x, view.lift, anchor.z),
    distance: view.distance,
    polar: view.polar,
    azimuth: view.azimuth,
    fov: ORBIT_FOV,
  };
}

export function hotspotPose(hotspot: Hotspot, azimuth: number): Pose {
  return {
    target: new Vector3(hotspot.x, 0, hotspot.z),
    distance: MathUtils.clamp(hotspot.radius * 3.1, 700, 5000),
    polar: 0.98,
    azimuth: azimuth + 0.35,
    fov: ORBIT_FOV,
  };
}

export function pointPose(x: number, z: number, distance: number, azimuth: number): Pose {
  return { target: new Vector3(x, 0, z), distance, polar: 1.02, azimuth: azimuth + 0.3, fov: ORBIT_FOV };
}

export function districtPose(manifest: CityManifest, id: string, azimuth: number): Pose | null {
  const d = manifest.districts.find((x) => x.id === id);
  if (!d) return null;
  return { target: new Vector3(d.center[0], 0, d.center[1]), distance: 3800, polar: 0.92, azimuth, fov: ORBIT_FOV };
}

/** Cinematic tour order. */
export const TOUR: LandmarkId[] = [
  "baiterek",
  "abu-dhabi-plaza",
  "ak-orda",
  "peace-palace",
  "hazrat-sultan",
  "kazakh-eli",
  "nur-alem",
  "khan-shatyr",
  "northern-lights",
  "emerald",
];

export function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
