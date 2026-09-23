/**
 * Byte rasters over the scene used for fast point queries while baking
 * (district lookup, tree placement masks).
 */
import type { Bounds } from "../../../src/city/schema";
import type { Polygon, Vec2 } from "./geo";

export class Raster {
  readonly data: Uint8Array;
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly bounds: Bounds,
    readonly cell: number,
  ) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.data = new Uint8Array(this.cols * this.rows);
  }

  get(x: number, z: number): number {
    const c = Math.floor((x - this.bounds.minX) / this.cell);
    const r = Math.floor((z - this.bounds.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.data[r * this.cols + c];
  }

  /** Even–odd scanline fill of all rings (holes are respected). */
  fillPolygon(polygon: Polygon, value: number): void {
    const { minX, minZ } = this.bounds;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const [, z] of polygon[0]) {
      zMin = Math.min(zMin, z);
      zMax = Math.max(zMax, z);
    }
    const r0 = Math.max(0, Math.floor((zMin - minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((zMax - minZ) / this.cell));
    const xs: number[] = [];
    for (let r = r0; r <= r1; r++) {
      const z = minZ + (r + 0.5) * this.cell;
      xs.length = 0;
      for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, zi] = ring[i];
          const [xj, zj] = ring[j];
          if (zi > z !== zj > z) xs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
        }
      }
      xs.sort((a, b) => a - b);
      const rowOffset = r * this.cols;
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - minX) / this.cell - 0.5));
        const c1 = Math.min(this.cols - 1, Math.floor((xs[k + 1] - minX) / this.cell - 0.5));
        for (let c = c0; c <= c1; c++) this.data[rowOffset + c] = value;
      }
    }
  }

  /** Marks every cell within `radius` of the polyline. */
  stampLine(points: Vec2[], radius: number, value: number): void {
    const step = this.cell * 0.6;
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s <= n; s++) this.stampDisc(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n, radius, value);
    }
  }

  stampDisc(x: number, z: number, radius: number, value: number): void {
    const { minX, minZ } = this.bounds;
    const cc = (x - minX) / this.cell;
    const rc = (z - minZ) / this.cell;
    const rr = radius / this.cell;
    const c0 = Math.max(0, Math.floor(cc - rr));
    const c1 = Math.min(this.cols - 1, Math.floor(cc + rr));
    const r0 = Math.max(0, Math.floor(rc - rr));
    const r1 = Math.min(this.rows - 1, Math.floor(rc + rr));
    const rr2 = (rr + 0.5) * (rr + 0.5);
    for (let r = r0; r <= r1; r++) {
      const dz = r + 0.5 - rc;
      for (let c = c0; c <= c1; c++) {
        const dx = c + 0.5 - cc;
        if (dx * dx + dz * dz <= rr2) this.data[r * this.cols + c] = value;
      }
    }
  }
}
