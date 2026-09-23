"use client";

/**
 * "Stone in the water" hotspot markers: rings keep leaving the centre of an
 * area where something is happening. Hover brightens the marker, click flies
 * the camera into 3D over that area. Labels live in the DOM (MapLabels).
 */
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, MathUtils, NormalBlending, ShaderMaterial, type Group } from "three";
import { useCityStore, type Hotspot, type HotspotTone } from "@/city/store";
import { cameraState } from "../camera/cameraState";
import { labelAnchors } from "../labels/anchors";
import { sceneUniforms } from "../world/materials";

/** On the zoomed-out map a marker never shrinks below this on-screen radius. */
const MIN_RADIUS_PX = 72;

const smoothstep = (a: number, b: number, x: number) => MathUtils.smoothstep(x, a, b);

export const TONE_COLORS: Record<HotspotTone, string> = {
  critical: "#ff4a2e",
  warning: "#ffa412",
  info: "#12c9b8",
  positive: "#3fcf66",
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uHover;
varying vec2 vUv;

float band(float r, float center, float width) {
  return 1.0 - smoothstep(0.0, width, abs(r - center));
}

void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float bright = 0.0;
  float dark = 0.0;
  // Three waves leave the centre, widen and fade — a stone dropped in water.
  for (int i = 0; i < 3; i++) {
    float p = fract(uTime * 0.3 + uPhase + float(i) / 3.0);
    float w = 0.03 + 0.03 * p;
    float fade = pow(1.0 - p, 1.25) * smoothstep(0.0, 0.08, p);
    bright += band(r, p, w) * fade;
    dark += band(r, p, w * 3.2) * fade;
  }
  // Calm tinted water surface and the boundary of the affected area.
  float fill = 0.3 * (1.0 - smoothstep(0.1, 1.0, r));
  float rim = 0.7 * band(r, 0.975, 0.012);
  dark += 0.5 * band(r, 0.975, 0.03);
  // Solid core with a white ring.
  float core = 1.0 - smoothstep(0.06, 0.078, r);
  float coreRing = band(r, 0.088, 0.016);
  bright += fill + rim;
  vec3 color = uColor * (1.0 + 0.25 * uHover);
  color = mix(color, vec3(1.0), coreRing);
  float lit = bright + core * 1.4 + coreRing;
  // Dark halo under the bright rings keeps them readable on a light map.
  vec3 rgb = mix(vec3(0.06, 0.08, 0.11), color, clamp(lit / (lit + dark * 0.55 + 1e-4), 0.0, 1.0));
  float alpha = clamp(lit + dark * 0.28, 0.0, 1.0) * uOpacity * (0.85 + 0.3 * uHover);
  gl_FragColor = vec4(rgb, alpha);
}`;

function Ripple({ hotspot, index }: { hotspot: Hotspot; index: number }) {
  const hovered = useCityStore((s) => s.hoveredHotspotId === hotspot.id);
  const focused = useCityStore((s) => s.focus?.kind === "hotspot" && s.focus.id === hotspot.id);
  const mode = useCityStore((s) => s.mode);
  const setHovered = useCityStore((s) => s.setHoveredHotspot);
  const select = useCityStore((s) => s.selectHotspot);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: index * 0.27 },
          uColor: { value: new Color(TONE_COLORS[hotspot.tone]) },
          uOpacity: { value: 1 },
          uHover: { value: 0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [hotspot.tone, index],
  );
  useEffect(() => () => material.dispose(), [material]);
  const group = useRef<Group>(null);

  useFrame((_, dt) => {
    // Keep a readable size on the overview: grow with camera distance.
    const cam = cameraState.position;
    const dist = Math.hypot(cam.x - hotspot.x, cam.y, cam.z - hotspot.z);
    const scale = Math.max(1, (MIN_RADIUS_PX * sceneUniforms.uPixelScale.value * dist) / hotspot.radius);
    group.current?.scale.set(scale, 1, scale);
    const label = labelAnchors.get(`hotspot:${hotspot.id}`);
    if (label) label.z = hotspot.z + hotspot.radius * scale * 1.02;

    const u = material.uniforms;
    u.uTime.value += dt;
    u.uHover.value += ((hovered ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 10);
    // Full strength on the map; in 3D only markers near the view centre stay,
    // so far-away rings are not painted over the skyline.
    const dx = hotspot.x - cameraState.target.x;
    const dz = hotspot.z - cameraState.target.z;
    const near = 1 - smoothstep(hotspot.radius * 2.5, hotspot.radius * 5, Math.hypot(dx, dz));
    const inView = cameraState.mapness + (1 - cameraState.mapness) * near;
    const wanted = mode === "drone" ? 0.2 * near : (focused ? 0.35 : 0.5 + 0.5 * cameraState.mapness) * inView;
    u.uOpacity.value += (wanted - u.uOpacity.value) * Math.min(1, dt * 4);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(hotspot.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "";
    select(hotspot.id);
  };

  return (
    <group ref={group} position={[hotspot.x, 0.5, hotspot.z]}>
      <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={40} frustumCulled={false}>
        <planeGeometry args={[hotspot.radius * 2, hotspot.radius * 2]} />
      </mesh>
      {/* Invisible, generous hit area — clicks work even between waves. */}
      <mesh rotation-x={-Math.PI / 2} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} visible={false}>
        <circleGeometry args={[hotspot.radius * 0.8, 32]} />
      </mesh>
    </group>
  );
}

export function Ripples() {
  const hotspots = useCityStore((s) => s.hotspots);
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );
  return (
    <group>
      {hotspots.map((h, i) => (
        <Ripple key={h.id} hotspot={h} index={i} />
      ))}
    </group>
  );
}
