/**
 * Polyline → flat ribbon / wall geometry with mitred joins.
 * Ribbons face +y. `lineDistance` (metres along the line) is written as the
 * first extra attribute when the writer defines one.
 */
import type { MeshWriter } from "./writer";

const MIN_MITER_COS = 0.3;

type Offsets = { xs: Float32Array; zs: Float32Array; ox: Float32Array; oz: Float32Array; dist: Float32Array };

/** Unit mitre offsets (scaled so edges stay parallel at half-width 1). */
function miterOffsets(pts: Float32Array, capExtend: number): Offsets | null {
  const n = pts.length / 2;
  if (n < 2) return null;
  const xs = new Float32Array(n);
  const zs = new Float32Array(n);
  const ox = new Float32Array(n);
  const oz = new Float32Array(n);
  const dist = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2];
    const z = pts[i * 2 + 1];
    let pdx = 0;
    let pdz = 0;
    let ndx = 0;
    let ndz = 0;
    if (i > 0) {
      pdx = x - pts[i * 2 - 2];
      pdz = z - pts[i * 2 - 1];
      const l = Math.hypot(pdx, pdz) || 1;
      total += l;
      pdx /= l;
      pdz /= l;
    }
    if (i < n - 1) {
      ndx = pts[i * 2 + 2] - x;
      ndz = pts[i * 2 + 3] - z;
      const l = Math.hypot(ndx, ndz) || 1;
      ndx /= l;
      ndz /= l;
    }
    if (i === 0) {
      pdx = ndx;
      pdz = ndz;
    }
    if (i === n - 1) {
      ndx = pdx;
      ndz = pdz;
    }
    let mx = -pdz - ndz;
    let mz = pdx + ndx;
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) {
      mx = -ndz;
      mz = ndx;
    } else {
      mx /= ml;
      mz /= ml;
    }
    const cos = mx * -ndz + mz * ndx;
    const scale = 1 / Math.max(cos, MIN_MITER_COS);
    let px = x;
    let pz = z;
    if (i === 0) {
      px -= ndx * capExtend;
      pz -= ndz * capExtend;
    } else if (i === n - 1) {
      px += pdx * capExtend;
      pz += pdz * capExtend;
    }
    xs[i] = px;
    zs[i] = pz;
    ox[i] = mx * scale;
    oz[i] = mz * scale;
    dist[i] = total;
  }
  return { xs, zs, ox, oz, dist };
}

/**
 * Extra per-vertex data written by addRibbon, matching the writer's attributes:
 * `distance` → lineDistance (dashes); `expand` → aExpand, the vec2 from the
 * centreline to the edge, used by the min-pixel-width shader on roads.
 */
export type RibbonExtra = "none" | "distance" | "expand";

/** Flat ribbon at height y. `capExtend` pushes both ends outwards (square caps). */
export function addRibbon(w: MeshWriter, pts: Float32Array, halfWidth: number, y: number, capExtend = 0, extra: RibbonExtra = "distance"): void {
  const o = miterOffsets(pts, capExtend);
  if (!o) return;
  let prevL = -1;
  let prevR = -1;
  for (let i = 0; i < o.xs.length; i++) {
    const ex = o.ox[i] * halfWidth;
    const ez = o.oz[i] * halfWidth;
    const L =
      extra === "expand"
        ? w.vertex(o.xs[i] + ex, y, o.zs[i] + ez, 0, 1, 0, ex, ez)
        : w.vertex(o.xs[i] + ex, y, o.zs[i] + ez, 0, 1, 0, o.dist[i]);
    const R =
      extra === "expand"
        ? w.vertex(o.xs[i] - ex, y, o.zs[i] - ez, 0, 1, 0, -ex, -ez)
        : w.vertex(o.xs[i] - ex, y, o.zs[i] - ez, 0, 1, 0, o.dist[i]);
    if (i > 0) {
      w.triangle(prevL, R, prevR);
      w.triangle(prevL, L, R);
    }
    prevL = L;
    prevR = R;
  }
}

/** Offsets a polyline sideways by `d` metres (positive = left of travel). */
export function offsetPolyline(pts: Float32Array, d: number): Float32Array {
  const o = miterOffsets(pts, 0);
  if (!o) return pts;
  const out = new Float32Array(pts.length);
  for (let i = 0; i < o.xs.length; i++) {
    out[i * 2] = o.xs[i] + o.ox[i] * d;
    out[i * 2 + 1] = o.zs[i] + o.oz[i] * d;
  }
  return out;
}

/**
 * Solid wall along a polyline: top face plus both vertical sides, from y0 to
 * y1, `halfThickness` to each side. Used for bridge parapets and viaducts.
 */
export function addWall(w: MeshWriter, pts: Float32Array, halfThickness: number, y0: number, y1: number, withBottom = false): void {
  const o = miterOffsets(pts, 0);
  if (!o) return;
  const n = o.xs.length;
  const Lx = (i: number) => o.xs[i] + o.ox[i] * halfThickness;
  const Lz = (i: number) => o.zs[i] + o.oz[i] * halfThickness;
  const Rx = (i: number) => o.xs[i] - o.ox[i] * halfThickness;
  const Rz = (i: number) => o.zs[i] - o.oz[i] * halfThickness;
  for (let i = 0; i + 1 < n; i++) {
    const j = i + 1;
    // top
    const t0 = w.vertex(Lx(i), y1, Lz(i), 0, 1, 0, o.dist[i]);
    const t1 = w.vertex(Rx(i), y1, Rz(i), 0, 1, 0, o.dist[i]);
    const t2 = w.vertex(Rx(j), y1, Rz(j), 0, 1, 0, o.dist[j]);
    const t3 = w.vertex(Lx(j), y1, Lz(j), 0, 1, 0, o.dist[j]);
    w.triangle(t0, t2, t1);
    w.triangle(t0, t3, t2);
    // sides: left side normal = segment's left normal, right side = opposite
    const sx = o.xs[j] - o.xs[i];
    const sz = o.zs[j] - o.zs[i];
    const sl = Math.hypot(sx, sz) || 1;
    const lnx = -sz / sl;
    const lnz = sx / sl;
    side(w, Lx(i), Lz(i), Lx(j), Lz(j), y0, y1, lnx, lnz, o.dist[i], o.dist[j]);
    side(w, Rx(j), Rz(j), Rx(i), Rz(i), y0, y1, -lnx, -lnz, o.dist[j], o.dist[i]);
    if (withBottom) {
      const b0 = w.vertex(Lx(i), y0, Lz(i), 0, -1, 0, o.dist[i]);
      const b1 = w.vertex(Rx(i), y0, Rz(i), 0, -1, 0, o.dist[i]);
      const b2 = w.vertex(Rx(j), y0, Rz(j), 0, -1, 0, o.dist[j]);
      const b3 = w.vertex(Lx(j), y0, Lz(j), 0, -1, 0, o.dist[j]);
      w.triangle(b0, b1, b2);
      w.triangle(b0, b2, b3);
    }
  }
}

/** Vertical quad from (ax, az) to (bx, bz) whose front faces the given normal. */
function side(w: MeshWriter, ax: number, az: number, bx: number, bz: number, y0: number, y1: number, nx: number, nz: number, da: number, db: number): void {
  const a = w.vertex(ax, y0, az, nx, 0, nz, da);
  const b = w.vertex(bx, y0, bz, nx, 0, nz, db);
  const c = w.vertex(bx, y1, bz, nx, 0, nz, db);
  const d = w.vertex(ax, y1, az, nx, 0, nz, da);
  // Orientation check: (b - a) × (c - a) must point along the normal.
  const ex = bx - ax;
  const ez = bz - az;
  const h = y1 - y0;
  const cx = -ez * h; // x component of (ex,0,ez) × (ex,h,ez)
  const cz = ex * h;
  if (cx * nx + cz * nz >= 0) {
    w.triangle(a, b, c);
    w.triangle(a, c, d);
  } else {
    w.triangle(a, c, b);
    w.triangle(a, d, c);
  }
}

/** Axis-aligned box column (4 sides, no caps) — viaduct pillars. */
export function addPillar(w: MeshWriter, x: number, z: number, half: number, y0: number, y1: number): void {
  const corners: [number, number][] = [
    [x - half, z - half],
    [x + half, z - half],
    [x + half, z + half],
    [x - half, z + half],
  ];
  const normals: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k];
    const [bx, bz] = corners[(k + 1) % 4];
    side(w, ax, az, bx, bz, y0, y1, normals[k][0], normals[k][1], 0, 0);
  }
}
