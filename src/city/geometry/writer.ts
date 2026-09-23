/**
 * Growable typed-array writer for large merged BufferGeometries.
 */
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";

export type ExtraAttribute = { name: string; itemSize: number; normalized?: boolean; type: "u8" | "f32" };

export class MeshWriter {
  private positions = new Float32Array(3 * 4096);
  private normals = new Float32Array(3 * 4096);
  private indices = new Uint32Array(3 * 4096);
  private extras: { def: ExtraAttribute; data: Uint8Array | Float32Array }[];
  vertexCount = 0;
  indexCount = 0;

  constructor(extra: ExtraAttribute[] = []) {
    this.extras = extra.map((def) => ({
      def,
      data: def.type === "u8" ? new Uint8Array(def.itemSize * 4096) : new Float32Array(def.itemSize * 4096),
    }));
  }

  private grow(vertices: number, indices: number): void {
    const needV = (this.vertexCount + vertices) * 3;
    if (needV > this.positions.length) {
      const size = Math.max(needV, this.positions.length * 2);
      const p = new Float32Array(size);
      p.set(this.positions);
      this.positions = p;
      const n = new Float32Array(size);
      n.set(this.normals);
      this.normals = n;
      for (const extra of this.extras) {
        const next =
          extra.def.type === "u8"
            ? new Uint8Array((size / 3) * extra.def.itemSize)
            : new Float32Array((size / 3) * extra.def.itemSize);
        next.set(extra.data);
        extra.data = next;
      }
    }
    const needI = this.indexCount + indices;
    if (needI > this.indices.length) {
      const next = new Uint32Array(Math.max(needI, this.indices.length * 2));
      next.set(this.indices);
      this.indices = next;
    }
  }

  reserve(vertices: number, indices: number): void {
    this.grow(vertices, indices);
  }

  /** Adds a vertex; `extra` values are written in the order of the constructor definitions. */
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, ...extra: number[]): number {
    this.grow(1, 0);
    const i = this.vertexCount;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.normals[i * 3] = nx;
    this.normals[i * 3 + 1] = ny;
    this.normals[i * 3 + 2] = nz;
    let e = 0;
    for (const attr of this.extras) {
      for (let k = 0; k < attr.def.itemSize; k++) attr.data[i * attr.def.itemSize + k] = extra[e++] ?? 0;
    }
    this.vertexCount++;
    return i;
  }

  triangle(a: number, b: number, c: number): void {
    this.grow(0, 3);
    this.indices[this.indexCount++] = a;
    this.indices[this.indexCount++] = b;
    this.indices[this.indexCount++] = c;
  }

  get isEmpty(): boolean {
    return this.indexCount === 0;
  }

  toGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions.slice(0, this.vertexCount * 3), 3));
    geometry.setAttribute("normal", new BufferAttribute(this.normals.slice(0, this.vertexCount * 3), 3));
    for (const { def, data } of this.extras) {
      geometry.setAttribute(def.name, new BufferAttribute(data.slice(0, this.vertexCount * def.itemSize), def.itemSize, def.normalized ?? false));
    }
    const index =
      this.vertexCount < 65536 ? new Uint16Array(this.indices.subarray(0, this.indexCount)) : this.indices.slice(0, this.indexCount);
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export function sphereOf(geometry: BufferGeometry): Sphere {
  return geometry.boundingSphere ?? new Sphere(new Vector3(), 0);
}
