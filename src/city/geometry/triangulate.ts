/**
 * Polygon triangulation (earcut) producing upward-facing triangles in the
 * local frame (+y up). Upward faces need a negative (x, z) shoelace sign.
 */
import earcut from "earcut";
import type { DecodedRing } from "../decode";

export type Triangulation = {
  /** Flat [x, z, x, z, ...] vertices of all rings. */
  vertices: Float32Array;
  /** Triangle indices into `vertices`, already oriented to face +y. */
  indices: number[];
};

export function triangulate(rings: DecodedRing[]): Triangulation {
  let total = 0;
  for (const ring of rings) total += ring.length;
  const vertices = new Float32Array(total);
  const holes: number[] = [];
  let offset = 0;
  rings.forEach((ring, i) => {
    if (i > 0) holes.push(offset / 2);
    vertices.set(ring, offset);
    offset += ring.length;
  });
  const raw = earcut(vertices, holes.length ? holes : undefined, 2);
  const indices: number[] = [];
  for (let t = 0; t < raw.length; t += 3) {
    const a = raw[t];
    const b = raw[t + 1];
    const c = raw[t + 2];
    const ax = vertices[a * 2];
    const az = vertices[a * 2 + 1];
    const cross = (vertices[b * 2] - ax) * (vertices[c * 2 + 1] - az) - (vertices[b * 2 + 1] - az) * (vertices[c * 2] - ax);
    if (cross > 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  }
  return { vertices, indices };
}
