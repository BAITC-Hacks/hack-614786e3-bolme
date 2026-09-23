"use client";

/**
 * Hand-built landmark models placed on their real OSM footprints.
 * Dimensions follow published figures (Baiterek 97 m with a 22 m sphere,
 * Khan Shatyr 150 m, Palace of Peace 62 m pyramid, Nur Alem 80 m sphere…).
 */
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector2,
  Vector3,
  type Material,
} from "three";
import type { CityManifest, LandmarkAnchor } from "@/city/schema";
import { PALETTE } from "../palette";

const WHITE = "#f3f4f6";

function useMaterials() {
  const materials = useMemo(() => {
    const white = new MeshStandardMaterial({ color: WHITE, roughness: 0.62, metalness: 0.02 });
    const gold = new MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.26, metalness: 1, envMapIntensity: 1.6, emissive: "#3b2604", emissiveIntensity: 0.35 });
    const dome = new MeshStandardMaterial({ color: PALETTE.domeBlue, roughness: 0.32, metalness: 0.25, envMapIntensity: 1.2 });
    const glass = new MeshStandardMaterial({ color: "#c7d9e8", roughness: 0.14, metalness: 0.35, envMapIntensity: 1.5 });
    const sphereGlass = createRibbedGlass();
    const tent = createTentMaterial();
    return { white, gold, dome, glass, sphereGlass, tent };
  }, []);
  useEffect(
    () => () => {
      Object.values(materials).forEach((m: Material) => m.dispose());
    },
    [materials],
  );
  return materials;
}

/** Nur Alem: dark reflective glass with light meridian/parallel ribs. */
function createRibbedGlass(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: "#35526f", roughness: 0.1, metalness: 0.55, envMapIntensity: 1.5 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRibUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRibUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRibUv;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float ribU = step(fract(vRibUv.x * 36.0), 0.045);
float ribV = step(fract(vRibUv.y * 18.0), 0.06);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93), max(ribU, ribV) * 0.85);`,
      );
  };
  m.customProgramCacheKey = () => "nur-alem-glass";
  return m;
}

/** Khan Shatyr: pearly ETFE skin with a diamond cable net. */
function createTentMaterial(): MeshStandardMaterial {
  const size = 256;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const m = new MeshStandardMaterial({ color: "#f5f3ee", roughness: 0.45, metalness: 0.05, side: DoubleSide, envMapIntensity: 0.9 });
  if (!canvas) return m;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(120,128,140,0.55)";
    ctx.lineWidth = 3;
    for (let i = -size; i <= size * 2; i += size / 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, size);
      ctx.lineTo(i + size, 0);
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(14, 5);
  texture.anisotropy = 8;
  m.map = texture;
  return m;
}

type Mats = ReturnType<typeof useMaterials>;

function Baiterek({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const branches = useMemo(() => {
    const count = 14;
    const tubes: CatmullRomCurve3[] = [];
    for (let i = 0; i < count; i++) {
      const base = (i / count) * Math.PI * 2;
      // Radius profile (y, r): a slim bundle that flares into a cradle for the sphere.
      const profile: [number, number][] = [
        [0, 6.8],
        [18, 4.6],
        [40, 3.3],
        [60, 3.1],
        [70, 5.4],
        [77, 9.4],
        [83, 11.9],
        [89, 11.9],
        [93, 10.1],
      ];
      const pts = profile.map(([y, r]) => {
        const twist = base + y * 0.006;
        return new Vector3(Math.cos(twist) * r, y, Math.sin(twist) * r);
      });
      tubes.push(new CatmullRomCurve3(pts));
    }
    return { tubes };
  }, []);
  return (
    <group position={[a.x, 0, a.z]}>
      <mesh material={m.white} position={[0, 0.3, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[21, 22, 0.6, 48]} />
      </mesh>
      <mesh material={m.white} position={[0, 2.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[9, 10.5, 4.4, 40]} />
      </mesh>
      <mesh material={m.white} position={[0, 40, 0]} castShadow>
        <cylinderGeometry args={[1.9, 2.6, 80, 16]} />
      </mesh>
      {branches.tubes.map((curve, i) => (
        <mesh key={i} material={m.white} castShadow>
          <tubeGeometry args={[curve, 48, 0.62, 6, false]} />
        </mesh>
      ))}
      <mesh material={m.gold} position={[0, 86, 0]} castShadow>
        <sphereGeometry args={[11, 48, 32]} />
      </mesh>
    </group>
  );
}

function KhanShatyr({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const tent = useMemo(() => {
    const pts: Vector2[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Concave tent profile: wide base, long thin top.
      const r = Math.pow(1 - t, 1.55) * (1 + 0.06 * Math.sin(Math.PI * t));
      pts.push(new Vector2(Math.max(0.004, r), t * 128));
    }
    return new LatheGeometry(pts, 64);
  }, []);
  useEffect(() => () => tent.dispose(), [tent]);
  // Local x follows the footprint's main axis (anchor.length), z the cross axis.
  const sx = a.length / 2;
  const sz = a.width / 2;
  return (
    <group position={[a.x, 0, a.z]} rotation={[0, a.rotation, 0]}>
      <mesh geometry={tent} material={m.tent} scale={[sx * 0.98, 1, sz * 0.98]} castShadow receiveShadow />
      <mesh material={m.white} position={[6, 136, 0]} rotation={[0, 0, -0.16]} castShadow>
        <cylinderGeometry args={[0.5, 1.1, 34, 8]} />
      </mesh>
    </group>
  );
}

function PeacePalace({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const side = Math.min(a.length, a.width) * 0.98;
  const r = side / Math.SQRT2;
  const glassFrom = 0.78;
  return (
    <group position={[a.x, 0, a.z]} rotation={[0, a.rotation + Math.PI / 4, 0]}>
      <mesh material={m.white} position={[0, (62 * glassFrom) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * (1 - glassFrom), r, 62 * glassFrom, 4, 1]} />
      </mesh>
      <mesh material={m.glass} position={[0, 62 * glassFrom + (62 * (1 - glassFrom)) / 2, 0]} castShadow>
        <coneGeometry args={[r * (1 - glassFrom), 62 * (1 - glassFrom), 4, 1]} />
      </mesh>
    </group>
  );
}

function NurAlem({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const radius = Math.max(36, Math.min(42, a.radius));
  return (
    <group position={[a.x, 0, a.z]}>
      <mesh material={m.white} position={[0, 4.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.62, radius * 0.7, 9, 48]} />
      </mesh>
      <mesh material={m.sphereGlass} position={[0, 9 + radius, 0]} castShadow>
        <sphereGeometry args={[radius, 64, 40]} />
      </mesh>
    </group>
  );
}

function AkOrdaCrown({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const base = 24;
  return (
    <group position={[a.x, base, a.z]}>
      <mesh material={m.white} position={[0, 5, 0]} castShadow>
        <cylinderGeometry args={[13, 13.5, 10, 40]} />
      </mesh>
      <mesh material={m.dome} position={[0, 10, 0]} scale={[1, 1.28, 1]} castShadow>
        <sphereGeometry args={[13, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={m.gold} position={[0, 28, 0]} castShadow>
        <sphereGeometry args={[1.8, 16, 12]} />
      </mesh>
      <mesh material={m.gold} position={[0, 41, 0]} castShadow>
        <coneGeometry args={[1.0, 26, 10]} />
      </mesh>
    </group>
  );
}

function HazratSultanCrown({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  const base = 16;
  const hx = Math.max(20, a.length / 2 - 7);
  const hz = Math.max(20, a.width / 2 - 7);
  const corners: [number, number][] = [
    [hx, hz],
    [-hx, hz],
    [hx, -hz],
    [-hx, -hz],
  ];
  return (
    <group position={[a.x, 0, a.z]} rotation={[0, a.rotation, 0]}>
      <group position={[0, base, 0]}>
        <mesh material={m.white} position={[0, 4, 0]} castShadow>
          <cylinderGeometry args={[15, 15.5, 8, 40]} />
        </mesh>
        <mesh material={m.white} position={[0, 8, 0]} scale={[1, 1.15, 1]} castShadow>
          <sphereGeometry args={[15, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={m.gold} position={[0, 29, 0]} castShadow>
          <coneGeometry args={[0.8, 8, 8]} />
        </mesh>
        {[
          [22, 0],
          [-22, 0],
          [0, 22],
          [0, -22],
        ].map(([x, z], i) => (
          <mesh key={i} material={m.white} position={[x, 0, z]} castShadow>
            <sphereGeometry args={[6.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        ))}
      </group>
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={m.white} position={[0, 31, 0]} castShadow>
            <cylinderGeometry args={[2.1, 2.6, 62, 12]} />
          </mesh>
          <mesh material={m.white} position={[0, 50, 0]} castShadow>
            <cylinderGeometry args={[3.4, 3.4, 1.6, 12]} />
          </mesh>
          <mesh material={m.white} position={[0, 66, 0]} castShadow>
            <cylinderGeometry args={[1.6, 2.0, 8, 12]} />
          </mesh>
          <mesh material={m.gold} position={[0, 73.5, 0]} castShadow>
            <coneGeometry args={[2.0, 7, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function KazakhEli({ a, m }: { a: LandmarkAnchor; m: Mats }) {
  return (
    <group position={[a.x, 0, a.z]}>
      <mesh material={m.white} position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 6, 18]} />
      </mesh>
      <mesh material={m.white} position={[0, 46, 0]} castShadow>
        <cylinderGeometry args={[2.1, 3.4, 80, 20]} />
      </mesh>
      <group position={[0, 89, 0]}>
        <mesh material={m.gold} scale={[1.2, 1.1, 2.6]} castShadow>
          <sphereGeometry args={[1.6, 16, 12]} />
        </mesh>
        <mesh material={m.gold} position={[4, 1.4, 0]} rotation={[0, 0, 0.45]} castShadow>
          <boxGeometry args={[7, 0.35, 2.6]} />
        </mesh>
        <mesh material={m.gold} position={[-4, 1.4, 0]} rotation={[0, 0, -0.45]} castShadow>
          <boxGeometry args={[7, 0.35, 2.6]} />
        </mesh>
      </group>
    </group>
  );
}

export function Landmarks({ manifest }: { manifest: CityManifest }) {
  const m = useMaterials();
  const L = manifest.landmarks;
  return (
    <group>
      {L.baiterek && <Baiterek a={L.baiterek} m={m} />}
      {L["khan-shatyr"] && <KhanShatyr a={L["khan-shatyr"]} m={m} />}
      {L["peace-palace"] && <PeacePalace a={L["peace-palace"]} m={m} />}
      {L["nur-alem"] && <NurAlem a={L["nur-alem"]} m={m} />}
      {L["ak-orda"] && <AkOrdaCrown a={L["ak-orda"]} m={m} />}
      {L["hazrat-sultan"] && <HazratSultanCrown a={L["hazrat-sultan"]} m={m} />}
      {L["kazakh-eli"] && <KazakhEli a={L["kazakh-eli"]} m={m} />}
    </group>
  );
}
