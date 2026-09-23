"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sphere, Vector3 } from "three";
import { createTreeGeometry, decodeTreeChunks, type TreeChunkData } from "@/city/geometry/trees";
import { loadTreeRecords } from "@/city/loader";
import type { CityManifest } from "@/city/schema";
import { useCityStore } from "@/city/store";
import { cameraState } from "../camera/cameraState";
import { PALETTE } from "../palette";

/** Distance LOD: share of a chunk's trees drawn, and crown scale compensation. */
const LOD = [
  { maxDistance: 1800, fraction: 1, boost: 1, shadow: true },
  { maxDistance: 4200, fraction: 0.4, boost: 1.28, shadow: true },
  { maxDistance: 9000, fraction: 0.15, boost: 1.65, shadow: false },
  { maxDistance: Infinity, fraction: 0.06, boost: 2.1, shadow: false },
] as const;

type ChunkMesh = { mesh: InstancedMesh; chunk: TreeChunkData; level: number };

const m4 = new Matrix4();
const q = new Quaternion();
const up = new Vector3(0, 1, 0);
const pos = new Vector3();
const scl = new Vector3();

function writeMatrices(entry: ChunkMesh, level: number): void {
  const { mesh, chunk } = entry;
  const { fraction, boost, shadow } = LOD[level];
  const count = Math.max(1, Math.ceil(chunk.count * fraction));
  const yBoost = Math.sqrt(boost);
  for (let k = 0; k < count; k++) {
    const h = chunk.height[k];
    const conifer = chunk.conifer[k] === 1;
    const width = (conifer ? 0.58 : 0.95) * h * boost;
    q.setFromAxisAngle(up, chunk.tint[k] * Math.PI * 2);
    pos.set(chunk.x[k], 0, chunk.z[k]);
    scl.set(width, h * yBoost * (conifer ? 1.08 : 1), width);
    mesh.setMatrixAt(k, m4.compose(pos, q, scl));
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadow;
  entry.level = level;
}

export function Trees({ manifest }: { manifest: CityManifest }) {
  const [chunks, setChunks] = useState<TreeChunkData[] | null>(null);
  const setTreesReady = useCityStore((s) => s.setTreesReady);

  useEffect(() => {
    let cancelled = false;
    loadTreeRecords(manifest)
      .then((buffer) => {
        if (cancelled) return;
        setChunks(decodeTreeChunks(buffer, manifest.trees));
        setTreesReady();
      })
      .catch((error: unknown) => {
        // Trees are decorative: the city stays usable without them.
        console.error("Деревья не загружены", error);
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, setTreesReady]);

  const geometry = useMemo(() => createTreeGeometry(), []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.45 }), []);

  const entries = useMemo<ChunkMesh[]>(() => {
    if (!chunks) return [];
    const color = new Color();
    const half = manifest.trees.chunkSize / 2;
    return chunks.map((chunk) => {
      const mesh = new InstancedMesh(geometry, material, chunk.count);
      for (let k = 0; k < chunk.count; k++) {
        const palette = chunk.conifer[k] ? PALETTE.treeConifer : PALETTE.treeBroadleaf;
        const t = chunk.tint[k];
        color.set(palette[Math.floor(t * palette.length) % palette.length]).multiplyScalar(0.9 + ((t * 7.31) % 1) * 0.2);
        mesh.setColorAt(k, color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.boundingSphere = new Sphere(new Vector3(chunk.centerX, 10, chunk.centerZ), half * Math.SQRT2 + 30);
      const entry: ChunkMesh = { mesh, chunk, level: -1 };
      writeMatrices(entry, LOD.length - 1);
      return entry;
    });
  }, [chunks, geometry, material, manifest.trees.chunkSize]);

  useEffect(
    () => () => {
      for (const e of entries) e.mesh.dispose();
    },
    [entries],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const cam = cameraState.position;
    for (const entry of entries) {
      const dx = entry.chunk.centerX - cam.x;
      const dz = entry.chunk.centerZ - cam.z;
      const d = Math.sqrt(dx * dx + dz * dz + cam.y * cam.y);
      let level = LOD.findIndex((l) => d < l.maxDistance);
      if (level < 0) level = LOD.length - 1;
      // Hysteresis: only switch when clearly across a boundary.
      if (level !== entry.level) {
        const boundary = LOD[Math.min(level, entry.level)]?.maxDistance ?? 0;
        if (entry.level < 0 || Math.abs(d - boundary) > 120) writeMatrices(entry, level);
      }
    }
  });

  return (
    <group>
      {entries.map((e, i) => (
        <primitive key={i} object={e.mesh} />
      ))}
    </group>
  );
}
