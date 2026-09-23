/**
 * Decoders for the delta-encoded decimetre polygons / polylines in public/city.
 * Output rings are Float32Arrays of metres: [x0, z0, x1, z1, ...].
 */
import { COORD_SCALE, type PolygonSet, type PolylineSet } from "./schema";

export type DecodedRing = Float32Array;

/** Calls `visit` for every polygon with its rings (outer first, then holes). */
export function forEachPolygon(set: PolygonSet, visit: (index: number, rings: DecodedRing[]) => void): void {
  let ringCursor = 0;
  let coordCursor = 0;
  for (let p = 0; p < set.rings.length; p++) {
    const ringCount = set.rings[p];
    const rings: DecodedRing[] = [];
    for (let r = 0; r < ringCount; r++) {
      const pointCount = set.points[ringCursor++];
      const ring = new Float32Array(pointCount * 2);
      let x = 0;
      let z = 0;
      for (let k = 0; k < pointCount; k++) {
        const dx = set.coords[coordCursor++];
        const dz = set.coords[coordCursor++];
        if (k === 0) {
          x = dx;
          z = dz;
        } else {
          x += dx;
          z += dz;
        }
        ring[k * 2] = x * COORD_SCALE;
        ring[k * 2 + 1] = z * COORD_SCALE;
      }
      rings.push(ring);
    }
    visit(p, rings);
  }
}

/** Calls `visit` for every polyline. */
export function forEachPolyline(set: PolylineSet, visit: (index: number, points: Float32Array) => void): void {
  let coordCursor = 0;
  for (let l = 0; l < set.points.length; l++) {
    const count = set.points[l];
    const line = new Float32Array(count * 2);
    let x = 0;
    let z = 0;
    for (let k = 0; k < count; k++) {
      const dx = set.coords[coordCursor++];
      const dz = set.coords[coordCursor++];
      if (k === 0) {
        x = dx;
        z = dz;
      } else {
        x += dx;
        z += dz;
      }
      line[k * 2] = x * COORD_SCALE;
      line[k * 2 + 1] = z * COORD_SCALE;
    }
    visit(l, line);
  }
}

export function ringCentroid(ring: DecodedRing): [number, number] {
  let cx = 0;
  let cz = 0;
  let area = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const f = ring[j * 2] * ring[i * 2 + 1] - ring[i * 2] * ring[j * 2 + 1];
    cx += (ring[j * 2] + ring[i * 2]) * f;
    cz += (ring[j * 2 + 1] + ring[i * 2 + 1]) * f;
    area += f;
  }
  if (Math.abs(area) < 1e-6) return [ring[0], ring[1]];
  return [cx / (3 * area), cz / (3 * area)];
}

export function ringArea(ring: DecodedRing): number {
  let sum = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) sum += ring[j * 2] * ring[i * 2 + 1] - ring[i * 2] * ring[j * 2 + 1];
  return sum / 2;
}
