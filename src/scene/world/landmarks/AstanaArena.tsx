"use client";

/**
 * Astana Arena on its OSM footprint: an elliptical shell whose roof curves in
 * to a retractable opening, coloured stands inside and a striped pitch with
 * field markings visible from above.
 */
import { useEffect, useMemo } from "react";
import { CanvasTexture, DoubleSide, LatheGeometry, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from "three";
import type { LandmarkAnchor } from "@/city/schema";

const HEIGHT = 56;

/** Radial roof ribs as a repeating stripe texture. */
function ribTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 8;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#f4f5f6";
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = "#b9c0c8";
  g.fillRect(0, 0, 5, 8);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(64, 1);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Football pitch: mowing stripes and white markings, 105 × 68 m. */
function pitchTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const w = 1050;
  const h = 680;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 ? "#4f9a3c" : "#5aa845";
    g.fillRect((i * w) / 14, 0, w / 14 + 1, h);
  }
  g.strokeStyle = "#f2f5f0";
  g.lineWidth = 6;
  g.strokeRect(20, 20, w - 40, h - 40);
  g.beginPath();
  g.moveTo(w / 2, 20);
  g.lineTo(w / 2, h - 20);
  g.stroke();
  g.beginPath();
  g.arc(w / 2, h / 2, 91, 0, Math.PI * 2);
  g.stroke();
  g.strokeRect(20, h / 2 - 201, 165, 402);
  g.strokeRect(w - 185, h / 2 - 201, 165, 402);
  g.strokeRect(20, h / 2 - 92, 55, 184);
  g.strokeRect(w - 75, h / 2 - 92, 55, 184);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function lathe(profile: [number, number][], segments = 96): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
}

export function AstanaArena({ anchor }: { anchor: LandmarkAnchor }) {
  const parts = useMemo(() => {
    const shell = lathe([
      [1.0, 0],
      [1.0, HEIGHT * 0.48],
      [0.97, HEIGHT * 0.66],
      [0.9, HEIGHT * 0.8],
      [0.78, HEIGHT * 0.91],
      [0.64, HEIGHT * 0.98],
      [0.52, HEIGHT],
      [0.5, HEIGHT * 0.97],
    ]);
    const stands = lathe([
      [0.5, HEIGHT * 0.86],
      [0.44, HEIGHT * 0.62],
      [0.36, HEIGHT * 0.3],
      [0.3, 3],
    ]);
    const shellMaterial = new MeshStandardMaterial({ color: "#eef0f2", roughness: 0.4, metalness: 0.3, side: DoubleSide, map: ribTexture() });
    const standsMaterial = new MeshStandardMaterial({ color: "#2f7fb5", roughness: 0.7, side: DoubleSide });
    const pitchMaterial = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, map: pitchTexture() });
    return { shell, stands, shellMaterial, standsMaterial, pitchMaterial };
  }, []);

  useEffect(
    () => () => {
      parts.shell.dispose();
      parts.stands.dispose();
      parts.shellMaterial.map?.dispose();
      parts.pitchMaterial.map?.dispose();
      parts.shellMaterial.dispose();
      parts.standsMaterial.dispose();
      parts.pitchMaterial.dispose();
    },
    [parts],
  );

  const sx = anchor.length / 2;
  const sz = anchor.width / 2;
  return (
    <group position={[anchor.x, 0, anchor.z]} rotation={[0, anchor.rotation, 0]}>
      <mesh geometry={parts.shell} material={parts.shellMaterial} scale={[sx, 1, sz]} castShadow receiveShadow />
      <mesh geometry={parts.stands} material={parts.standsMaterial} scale={[sx, 1, sz]} receiveShadow />
      <mesh material={parts.pitchMaterial} position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.min(112, sx * 0.62), Math.min(74, sz * 0.62)]} />
      </mesh>
    </group>
  );
}
