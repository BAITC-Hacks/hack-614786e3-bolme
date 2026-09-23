/**
 * Geometry helpers for the offline pipeline: projection, rings, polygons.
 * Points are [x, z] in metres (local frame, +x east, +z south).
 */
import { ORIGIN } from "../config";

export type Vec2 = [number, number];
export type Ring = Vec2[];
/** First ring = outer boundary, the rest are holes. */
export type Polygon = Ring[];
export type LatLon = { lat: number; lon: number };

// WGS84 radii of curvature at the origin latitude (accurate local tangent plane).
const A = 6378137;
const E2 = 0.00669437999014;
const PHI0 = (ORIGIN.lat * Math.PI) / 180;
const SIN0 = Math.sin(PHI0);
const W = Math.sqrt(1 - E2 * SIN0 * SIN0);
const N_RADIUS = A / W; // prime vertical
const M_RADIUS = (A * (1 - E2)) / (W * W * W); // meridional
const DEG = Math.PI / 180;
const X_PER_DEG = N_RADIUS * Math.cos(PHI0) * DEG;
const Z_PER_DEG = M_RADIUS * DEG;

export function project(lat: number, lon: number): Vec2 {
  return [(lon - ORIGIN.lon) * X_PER_DEG, -(lat - ORIGIN.lat) * Z_PER_DEG];
}

export function unproject([x, z]: Vec2): LatLon {
  return { lat: ORIGIN.lat - z / Z_PER_DEG, lon: ORIGIN.lon + x / X_PER_DEG };
}

export function projectLine(points: LatLon[]): Vec2[] {
  return points.map((p) => project(p.lat, p.lon));
}

/** Signed area with the shoelace formula in (x, z). Positive = outer ring convention. */
export function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

export function polygonArea(polygon: Polygon): number {
  return polygon.reduce((acc, ring, i) => acc + (i === 0 ? 1 : -1) * Math.abs(signedArea(ring)), 0);
}

export function ringCentroid(ring: Ring): Vec2 {
  let cx = 0;
  let cz = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cz += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInRing(x: number, z: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(x: number, z: number, polygon: Polygon): boolean {
  if (!pointInRing(x, z, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (pointInRing(x, z, polygon[i])) return false;
  return true;
}

export type Box = { minX: number; minZ: number; maxX: number; maxZ: number };

export function ringBox(ring: Ring): Box {
  const box = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const [x, z] of ring) {
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (z < box.minZ) box.minZ = z;
    if (z > box.maxZ) box.maxZ = z;
  }
  return box;
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

/** Drops the closing duplicate and consecutive duplicates. */
export function cleanRing(ring: Ring, epsilon = 0.02): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > epsilon || Math.abs(last[1] - p[1]) > epsilon) out.push(p);
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first[0] - last[0]) <= epsilon && Math.abs(first[1] - last[1]) <= epsilon) out.pop();
    else break;
  }
  return out;
}

function perpendicularDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/** Douglas–Peucker for open polylines. */
export function simplifyLine(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Douglas–Peucker for closed rings (anchored at the farthest pair of points). */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4 || tolerance <= 0) return ring;
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = simplifyLine(ring.slice(0, far + 1), tolerance);
  const second = simplifyLine([...ring.slice(far), ring[0]], tolerance);
  const result = [...first.slice(0, -1), ...second.slice(0, -1)];
  return result.length >= 3 ? result : ring;
}

/** Normalises winding: outer ring positive area, holes negative. */
export function orientPolygon(polygon: Polygon): Polygon {
  return polygon.map((ring, i) => {
    const area = signedArea(ring);
    const wantPositive = i === 0;
    return (area > 0) === wantPositive ? ring : [...ring].reverse();
  });
}

/**
 * Oriented footprint box from the longest edge direction of the outer ring.
 * Good enough for rectangular-ish landmark footprints.
 */
export function orientedBox(ring: Ring): { rotation: number; length: number; width: number; center: Vec2 } {
  let bestLen = -1;
  let angle = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const len = Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
    if (len > bestLen) {
      bestLen = len;
      angle = Math.atan2(ring[i][1] - ring[j][1], ring[i][0] - ring[j][0]);
    }
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, z] of ring) {
    const u = x * cos + z * sin;
    const v = -x * sin + z * cos;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  const center: Vec2 = [cu * cos - cv * sin, cu * sin + cv * cos];
  // three.js rotation.y turns +x towards -z, i.e. the negative of the (x, z) angle.
  return { rotation: -angle, length: maxU - minU, width: maxV - minV, center };
}

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export function hash01(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Sutherland–Hodgman clip of a ring against an axis-aligned box. */
export function clipRingToBox(ring: Ring, box: Box): Ring {
  const edges: [(p: Vec2) => boolean, (a: Vec2, b: Vec2) => Vec2][] = [
    [(p) => p[0] >= box.minX, (a, b) => lerpAt(a, b, (box.minX - a[0]) / (b[0] - a[0]))],
    [(p) => p[0] <= box.maxX, (a, b) => lerpAt(a, b, (box.maxX - a[0]) / (b[0] - a[0]))],
    [(p) => p[1] >= box.minZ, (a, b) => lerpAt(a, b, (box.minZ - a[1]) / (b[1] - a[1]))],
    [(p) => p[1] <= box.maxZ, (a, b) => lerpAt(a, b, (box.maxZ - a[1]) / (b[1] - a[1]))],
  ];
  let output = ring;
  for (const [inside, intersect] of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(prev)) output.push(intersect(prev, current));
        output.push(current);
      } else if (inside(prev)) {
        output.push(intersect(prev, current));
      }
    }
    if (!output.length) break;
  }
  return output;
}

function lerpAt(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
