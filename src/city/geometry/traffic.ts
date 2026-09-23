/**
 * Decorative traffic on the real road graph: directed edges from OSM road
 * centrelines (both directions for two-way roads), joined where ways share an
 * end node. Vehicles keep right, pick the straightest continuation at
 * junctions and U-turn or respawn at dead ends. Visual only, not a model.
 */
import { forEachPolyline } from "../decode";
import { RailFlag, RailKind, RoadClass, RoadFlag, type GroundFile } from "../schema";

export type NetworkEdge = {
  /** x, z pairs in travel direction. */
  pts: Float32Array;
  /** Cumulative length at each point. */
  cum: Float32Array;
  length: number;
  cls: number;
  width: number;
  oneway: boolean;
  elevated: boolean;
  next: number[];
  reverse: number;
};

export type PathNetwork = { edges: NetworkEdge[]; totalLength: number };

type LineInput = { pts: Float32Array; cls: number; width: number; oneway: boolean; elevated: boolean };

const nodeKey = (x: number, z: number) => `${Math.round(x * 10)}:${Math.round(z * 10)}`;

function reversed(pts: Float32Array): Float32Array {
  const out = new Float32Array(pts.length);
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    out[i * 2] = pts[(n - 1 - i) * 2];
    out[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1];
  }
  return out;
}

function makeEdge(pts: Float32Array, line: LineInput): NetworkEdge {
  const n = pts.length / 2;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  return { pts, cum, length: cum[n - 1], cls: line.cls, width: line.width, oneway: line.oneway, elevated: line.elevated, next: [], reverse: -1 };
}

function buildNetwork(lines: LineInput[]): PathNetwork {
  const edges: NetworkEdge[] = [];
  for (const line of lines) {
    const forward = makeEdge(line.pts, line);
    if (forward.length < 5) continue;
    const fi = edges.push(forward) - 1;
    if (!line.oneway) {
      const ri = edges.push(makeEdge(reversed(line.pts), line)) - 1;
      edges[fi].reverse = ri;
      edges[ri].reverse = fi;
    }
  }
  const starts = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const key = nodeKey(e.pts[0], e.pts[1]);
    const list = starts.get(key);
    if (list) list.push(i);
    else starts.set(key, [i]);
  });
  let totalLength = 0;
  for (const e of edges) {
    const n = e.pts.length / 2;
    e.next = (starts.get(nodeKey(e.pts[(n - 1) * 2], e.pts[(n - 1) * 2 + 1])) ?? []).filter((i) => edges[i] !== e);
    totalLength += e.length;
  }
  return { edges, totalLength };
}

/** Motorways … tertiary roads; paths, service and minor streets stay quiet. */
export function buildRoadNetwork(data: GroundFile, maxClass: number = RoadClass.Tertiary): PathNetwork {
  const lines: LineInput[] = [];
  forEachPolyline(data.roads, (i, pts) => {
    const cls = data.roads.cls[i];
    if (cls > maxClass) return;
    lines.push({ pts, cls, width: data.roads.width[i] / 10, oneway: (data.roads.flags[i] & RoadFlag.Oneway) !== 0, elevated: false });
  });
  return buildNetwork(lines);
}

/** Astana LRT (light rail), both directions. */
export function buildRailNetwork(data: GroundFile): PathNetwork {
  const lines: LineInput[] = [];
  forEachPolyline(data.rails, (i, pts) => {
    if (data.rails.kind[i] !== RailKind.LightRail) return;
    lines.push({ pts, cls: 0, width: 4, oneway: false, elevated: (data.rails.flags[i] & RailFlag.Bridge) !== 0 });
  });
  return buildNetwork(lines);
}

/** Deterministic PRNG so every load looks the same. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FleetOptions = {
  count: number;
  seed: number;
  /** Relative spawn weight per metre for an edge. */
  weight: (e: NetworkEdge) => number;
  /** Cruise speed on an edge, m/s. */
  speed: (e: NetworkEdge) => number;
  /** Lateral offset (m, positive = right of travel) from a per-vehicle lane fraction 0..1. */
  lateral: (e: NetworkEdge, lane: number) => number;
  /** Height above ground on an edge. */
  height: (e: NetworkEdge) => number;
};

/** A set of vehicles moving over a network; writes instance matrices directly. */
export class Fleet {
  readonly count: number;
  private readonly edge: Int32Array;
  private readonly s: Float32Array;
  private readonly seg: Int32Array;
  private readonly mult: Float32Array;
  private readonly lane: Float32Array;
  private readonly spawnCdf: Float64Array;
  private readonly rnd: () => number;

  constructor(
    private readonly net: PathNetwork,
    private readonly options: FleetOptions,
  ) {
    this.rnd = mulberry32(options.seed);
    const cdf = new Float64Array(net.edges.length);
    let acc = 0;
    net.edges.forEach((e, i) => {
      acc += e.length * options.weight(e);
      cdf[i] = acc;
    });
    this.spawnCdf = cdf;
    this.count = net.edges.length && acc > 0 ? options.count : 0;
    this.edge = new Int32Array(this.count);
    this.s = new Float32Array(this.count);
    this.seg = new Int32Array(this.count);
    this.mult = new Float32Array(this.count);
    this.lane = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.mult[i] = 0.82 + this.rnd() * 0.32;
      this.lane[i] = this.rnd();
      this.spawn(i, true);
    }
  }

  private spawn(i: number, anywhere: boolean): void {
    const total = this.spawnCdf[this.spawnCdf.length - 1];
    const target = this.rnd() * total;
    let lo = 0;
    let hi = this.spawnCdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.spawnCdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    this.edge[i] = lo;
    this.s[i] = anywhere ? this.rnd() * this.net.edges[lo].length : 0;
    this.seg[i] = 0;
  }

  private nextEdge(current: number): number {
    const e = this.net.edges[current];
    const n = e.pts.length / 2;
    let dx = e.pts[(n - 1) * 2] - e.pts[(n - 2) * 2];
    let dz = e.pts[(n - 1) * 2 + 1] - e.pts[(n - 2) * 2 + 1];
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    let best = -1;
    let bestScore = -Infinity;
    for (const c of e.next) {
      if (c === e.reverse) continue;
      const f = this.net.edges[c];
      let fx = f.pts[2] - f.pts[0];
      let fz = f.pts[3] - f.pts[1];
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const score = dx * fx + dz * fz + this.rnd() * 0.9 + (f.cls <= e.cls ? 0.25 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best >= 0 ? best : e.reverse;
  }

  step(dt: number): void {
    const { edges } = this.net;
    for (let i = 0; i < this.count; i++) {
      let e = edges[this.edge[i]];
      this.s[i] += this.options.speed(e) * this.mult[i] * dt;
      let guard = 0;
      while (this.s[i] > e.length && guard++ < 4) {
        const rest = this.s[i] - e.length;
        const next = this.nextEdge(this.edge[i]);
        if (next < 0) {
          this.spawn(i, false);
          e = edges[this.edge[i]];
          break;
        }
        this.edge[i] = next;
        this.s[i] = rest;
        this.seg[i] = 0;
        e = edges[next];
      }
    }
  }

  /** Writes a column-major Y-rotation + translation matrix per vehicle. */
  writeMatrices(out: Float32Array): void {
    const { edges } = this.net;
    for (let i = 0; i < this.count; i++) {
      const e = edges[this.edge[i]];
      const s = Math.min(this.s[i], e.length);
      let k = this.seg[i];
      const last = e.cum.length - 2;
      while (k < last && e.cum[k + 1] < s) k++;
      this.seg[i] = k;
      const segLen = e.cum[k + 1] - e.cum[k] || 1;
      const t = (s - e.cum[k]) / segLen;
      const ax = e.pts[k * 2];
      const az = e.pts[k * 2 + 1];
      const dx = (e.pts[k * 2 + 2] - ax) / segLen;
      const dz = (e.pts[k * 2 + 3] - az) / segLen;
      const lat = this.options.lateral(e, this.lane[i]);
      // +z points south, so the right-hand side of travel is (-dz, dx).
      const x = ax + dx * segLen * t - dz * lat;
      const z = az + dz * segLen * t + dx * lat;
      const o = i * 16;
      // Rotation about +y so local +z faces the travel direction (dx, dz).
      out[o] = dz;
      out[o + 1] = 0;
      out[o + 2] = -dx;
      out[o + 3] = 0;
      out[o + 4] = 0;
      out[o + 5] = 1;
      out[o + 6] = 0;
      out[o + 7] = 0;
      out[o + 8] = dx;
      out[o + 9] = 0;
      out[o + 10] = dz;
      out[o + 11] = 0;
      out[o + 12] = x;
      out[o + 13] = this.options.height(e);
      out[o + 14] = z;
      out[o + 15] = 1;
    }
  }
}
