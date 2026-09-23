/**
 * WGS84 ↔ scene coordinates for the browser (same local tangent plane as the
 * data pipeline in scripts/city/lib/geo.ts). Scene frame: metres, +x = east,
 * +z = south, +y = up, origin = Baiterek (manifest.origin).
 */
import type { CityManifest } from "./schema";

const A = 6378137;
const E2 = 0.00669437999014;
const DEG = Math.PI / 180;

export type ScenePoint = { x: number; z: number };

function factors(origin: CityManifest["origin"]) {
  const phi = origin.lat * DEG;
  const sin = Math.sin(phi);
  const w = Math.sqrt(1 - E2 * sin * sin);
  return { xPerDeg: (A / w) * Math.cos(phi) * DEG, zPerDeg: ((A * (1 - E2)) / (w * w * w)) * DEG };
}

/** Latitude/longitude → scene metres. */
export function lonLatToScene(manifest: CityManifest, lat: number, lon: number): ScenePoint {
  const { xPerDeg, zPerDeg } = factors(manifest.origin);
  return { x: (lon - manifest.origin.lon) * xPerDeg, z: -(lat - manifest.origin.lat) * zPerDeg };
}

/** Scene metres → latitude/longitude. */
export function sceneToLonLat(manifest: CityManifest, { x, z }: ScenePoint): { lat: number; lon: number } {
  const { xPerDeg, zPerDeg } = factors(manifest.origin);
  return { lat: manifest.origin.lat - z / zPerDeg, lon: manifest.origin.lon + x / xPerDeg };
}
