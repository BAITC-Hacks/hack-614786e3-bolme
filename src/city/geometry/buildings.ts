/**
 * Extrudes OSM building footprints into merged, chunked BufferGeometries.
 *
 * Per-vertex attributes besides position/normal:
 *   aTint     (u8, normalized) — subtle per-building brightness variation
 *   aDistrict (f32)            — district index (255 = none) for highlighting
 */
import type { BufferGeometry } from "three";
import { forEachPolygon, ringArea, ringCentroid, type DecodedRing } from "../decode";
import { BuildingFlag, COORD_SCALE, RoofShape, type BuildingsFile } from "../schema";
import { triangulate } from "./triangulate";
import { MeshWriter } from "./writer";

export type BuildingChunk = {
  key: string;
  geometry: BufferGeometry;
  /** OSM id of each building in draw order, and its first triangle. */
  buildingIds: Int32Array;
  triangleStart: Uint32Array;
};

export type BuildingStats = { buildings: number; triangles: number; chunks: number };

const DOME_STEPS = 6;

function hashTint(id: number): number {
  let h = Math.imul(id ^ 0x2c1b3c6d, 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

type ChunkState = { writer: MeshWriter; ids: number[]; starts: number[] };

export function buildBuildingChunks(data: BuildingsFile, chunkSize: number): { chunks: BuildingChunk[]; stats: BuildingStats } {
  const states = new Map<string, ChunkState>();
  let triangles = 0;

  forEachPolygon(data, (i, rings) => {
    const outer = rings[0];
    if (!outer || outer.length < 6) return;
    const [cx, cz] = ringCentroid(outer);
    const key = `${Math.floor(cx / chunkSize)}:${Math.floor(cz / chunkSize)}`;
    let state = states.get(key);
    if (!state) {
      state = {
        writer: new MeshWriter([
          { name: "aTint", itemSize: 1, type: "u8", normalized: true },
          { name: "aDistrict", itemSize: 1, type: "f32" },
        ]),
        ids: [],
        starts: [],
      };
      states.set(key, state);
    }
    const w = state.writer;
    state.ids.push(data.id[i]);
    state.starts.push(w.indexCount / 3);

    const top = data.height[i] * COORD_SCALE;
    const base = data.minHeight[i] * COORD_SCALE;
    const roof = data.roof[i];
    const roofHeight = roof === RoofShape.Flat ? 0 : data.roofHeight[i] * COORD_SCALE;
    const wallTop = Math.max(base + 0.5, top - roofHeight);
    const flags = data.flags[i];
    // Landmark bases and parts keep a pure tone; ordinary buildings vary ±3 %.
    const tint = flags & BuildingFlag.LandmarkBase ? 250 : Math.round(236 + hashTint(data.id[i]) * 19);
    const district = data.district[i];

    const before = w.indexCount;
    for (const ring of rings) addWalls(w, ring, base, wallTop, tint, district);
    if (roof === RoofShape.Pyramidal && roofHeight > 0.5) addPyramid(w, outer, cx, cz, wallTop, top, tint, district);
    else if (roof === RoofShape.Dome && roofHeight > 0.5) addDome(w, outer, cx, cz, wallTop, roofHeight, tint, district);
    else addFlatRoof(w, rings, wallTop, tint, district);
    triangles += (w.indexCount - before) / 3;
  });

  const chunks: BuildingChunk[] = [];
  for (const [key, state] of states) {
    if (state.writer.isEmpty) continue;
    chunks.push({
      key,
      geometry: state.writer.toGeometry(),
      buildingIds: Int32Array.from(state.ids),
      triangleStart: Uint32Array.from(state.starts),
    });
  }
  return { chunks, stats: { buildings: data.count, triangles, chunks: chunks.length } };
}

function addWalls(w: MeshWriter, ring: DecodedRing, base: number, top: number, tint: number, district: number): void {
  const n = ring.length / 2;
  const sign = ringArea(ring) >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = ring[i * 2];
    const z0 = ring[i * 2 + 1];
    const x1 = ring[j * 2];
    const z1 = ring[j * 2 + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    // Outward normal for positive rings is (dz, -dx); holes are stored negative,
    // so the same formula points out of the solid. `sign` guards odd data.
    const nx = (dz / len) * sign;
    const nz = (-dx / len) * sign;
    const a = w.vertex(x0, base, z0, nx, 0, nz, tint, district);
    const b = w.vertex(x1, base, z1, nx, 0, nz, tint, district);
    const c = w.vertex(x1, top, z1, nx, 0, nz, tint, district);
    const d = w.vertex(x0, top, z0, nx, 0, nz, tint, district);
    if (sign > 0) {
      w.triangle(a, c, b);
      w.triangle(a, d, c);
    } else {
      w.triangle(a, b, c);
      w.triangle(a, c, d);
    }
  }
}

function addFlatRoof(w: MeshWriter, rings: DecodedRing[], y: number, tint: number, district: number): void {
  const { vertices, indices } = triangulate(rings);
  const start = w.vertexCount;
  for (let k = 0; k < vertices.length; k += 2) w.vertex(vertices[k], y, vertices[k + 1], 0, 1, 0, tint, district);
  for (let t = 0; t < indices.length; t += 3) w.triangle(start + indices[t], start + indices[t + 1], start + indices[t + 2]);
}

function addPyramid(w: MeshWriter, ring: DecodedRing, cx: number, cz: number, y0: number, y1: number, tint: number, district: number): void {
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = ring[i * 2];
    const az = ring[i * 2 + 1];
    const bx = ring[j * 2];
    const bz = ring[j * 2 + 1];
    // Face normal = (b - a) × (apex - a), flipped to point up.
    const ux = bx - ax;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = y1 - y0;
    const vz = cz - az;
    let nx = 0 * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - 0 * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const flip = ny < 0 ? -1 : 1;
    nx = (nx / len) * flip;
    ny = (ny / len) * flip;
    nz = (nz / len) * flip;
    const a = w.vertex(ax, y0, az, nx, ny, nz, tint, district);
    const b = w.vertex(bx, y0, bz, nx, ny, nz, tint, district);
    const c = w.vertex(cx, y1, cz, nx, ny, nz, tint, district);
    if (flip > 0) w.triangle(a, b, c);
    else w.triangle(a, c, b);
  }
}

function addDome(w: MeshWriter, ring: DecodedRing, cx: number, cz: number, y0: number, h: number, tint: number, district: number): void {
  const n = ring.length / 2;
  const grid: number[][] = [];
  for (let s = 0; s <= DOME_STEPS; s++) {
    const theta = (s / DOME_STEPS) * (Math.PI / 2);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const row: number[] = [];
    for (let i = 0; i < n; i++) {
      const rx = ring[i * 2] - cx;
      const rz = ring[i * 2 + 1] - cz;
      const r = Math.hypot(rx, rz) || 1;
      // Ellipsoid normal: radial cos/r, vertical sin/h.
      let nx = (rx / r) * (cos / r);
      let ny = sin / h;
      let nz = (rz / r) * (cos / r);
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      row.push(w.vertex(cx + rx * cos, y0 + h * sin, cz + rz * cos, nx, ny, nz, tint, district));
    }
    grid.push(row);
  }
  const positive = ringArea(ring) >= 0;
  for (let s = 0; s < DOME_STEPS; s++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = grid[s][i];
      const b = grid[s][j];
      const c = grid[s + 1][j];
      const d = grid[s + 1][i];
      if (positive) {
        w.triangle(a, c, b);
        w.triangle(a, d, c);
      } else {
        w.triangle(a, b, c);
        w.triangle(a, c, d);
      }
    }
  }
}
