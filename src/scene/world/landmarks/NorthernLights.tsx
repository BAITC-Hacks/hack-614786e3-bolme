"use client";

/**
 * «Северное сияние»: three glass towers on their OSM footprints (heights from
 * OSM levels) with wave-shaped crowns, rendered with the building material
 * and the Aurora accent (teal → violet glass).
 */
import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import { MeshWriter } from "@/city/geometry/writer";
import { BuildingAccent, type LandmarkAnchor } from "@/city/schema";
import { createBuildingMaterial } from "../materials";

type Vec3 = [number, number, number];

const SEGMENTS = 16;
const CROWN = 18;
/** aTint, aDistrict (255 = none), aAccent — matches the building material. */
const TAG = [250, 255, BuildingAccent.Aurora];

function pushQuad(w: MeshWriter, p: Vec3[], n: Vec3): void {
  const ids = p.map(([x, y, z]) => w.vertex(x, y, z, n[0], n[1], n[2], ...TAG));
  // Face normal from the first triangle; flip the winding if it points inwards.
  const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
  const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1];
  const cy = e1[2] * e2[0] - e1[0] * e2[2];
  const cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) {
    w.triangle(ids[0], ids[1], ids[2]);
    w.triangle(ids[0], ids[2], ids[3]);
  } else {
    w.triangle(ids[0], ids[2], ids[1]);
    w.triangle(ids[0], ids[3], ids[2]);
  }
}

function buildTowers(parts: NonNullable<LandmarkAnchor["parts"]>): BufferGeometry {
  const w = new MeshWriter([
    { name: "aTint", itemSize: 1, type: "u8", normalized: true },
    { name: "aDistrict", itemSize: 1, type: "f32" },
    { name: "aAccent", itemSize: 1, type: "f32" },
  ]);
  parts.forEach((part, index) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < part.ring.length; k += 2) pts.push([part.ring[k], part.ring[k + 1]]);
    // Oriented box along the longest footprint edge.
    let best = 0;
    let ux = 1;
    let uz = 0;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > best) {
        best = len;
        ux = (b[0] - a[0]) / len;
        uz = (b[1] - a[1]) / len;
      }
    });
    const vx = -uz;
    const vz = ux;
    const us = pts.map(([x, z]) => x * ux + z * uz);
    const vs = pts.map(([x, z]) => x * vx + z * vz);
    const u0 = Math.min(...us);
    const u1 = Math.max(...us);
    const v0 = Math.min(...vs);
    const v1 = Math.max(...vs);
    const at = (u: number, v: number, y: number): Vec3 => [u * ux + v * vx, y, u * uz + v * vz];
    const phase = index * 0.22;
    const top = (t: number) => part.height - CROWN * 0.3 + CROWN * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.8 + 0.1 + phase))), 1.6);
    for (let k = 0; k < SEGMENTS; k++) {
      const t0 = k / SEGMENTS;
      const t1 = (k + 1) / SEGMENTS;
      const ua = u0 + (u1 - u0) * t0;
      const ub = u0 + (u1 - u0) * t1;
      const ha = top(t0);
      const hb = top(t1);
      pushQuad(w, [at(ua, v0, 0), at(ub, v0, 0), at(ub, v0, hb), at(ua, v0, ha)], [-vx, 0, -vz]);
      pushQuad(w, [at(ua, v1, 0), at(ub, v1, 0), at(ub, v1, hb), at(ua, v1, ha)], [vx, 0, vz]);
      // Sloped roof strip: normal tilts against the crown's slope.
      const slope = (hb - ha) / Math.max(0.01, ub - ua);
      const nl = Math.hypot(slope, 1);
      pushQuad(w, [at(ua, v0, ha), at(ub, v0, hb), at(ub, v1, hb), at(ua, v1, ha)], [(-slope * ux) / nl, 1 / nl, (-slope * uz) / nl]);
    }
    const h0 = top(0);
    const h1 = top(1);
    pushQuad(w, [at(u0, v0, 0), at(u0, v1, 0), at(u0, v1, h0), at(u0, v0, h0)], [-ux, 0, -uz]);
    pushQuad(w, [at(u1, v0, 0), at(u1, v1, 0), at(u1, v1, h1), at(u1, v0, h1)], [ux, 0, uz]);
  });
  return w.toGeometry();
}

export function NorthernLights({ anchor }: { anchor: LandmarkAnchor }) {
  const geometry = useMemo(() => (anchor.parts?.length ? buildTowers(anchor.parts) : null), [anchor]);
  const material = useMemo(() => createBuildingMaterial(), []);
  useEffect(
    () => () => {
      geometry?.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
