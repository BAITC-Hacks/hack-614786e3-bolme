"use client";

/**
 * Sky dome, distance haze, image-based light and the sun. The sun's shadow
 * frustum follows the camera focus and is snapped to shadow-map texels so
 * shadows stay stable while the camera moves.
 */
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Fog, MathUtils, ShaderMaterial, Vector3, type DirectionalLight, type Mesh } from "three";
import { cameraState } from "../camera/cameraState";
import { PALETTE } from "../palette";
import { sceneUniforms } from "./materials";

/** Afternoon sun from the south-west, 40° above the horizon. */
const SUN_AZIMUTH_DEG = 232; // compass bearing, clockwise from north
const SUN_ELEVATION_DEG = 40;
const SUN_DISTANCE = 30000;
const SHADOW_MAP = 4096;

export const SUN_DIRECTION = (() => {
  const az = MathUtils.degToRad(SUN_AZIMUTH_DEG);
  const el = MathUtils.degToRad(SUN_ELEVATION_DEG);
  // +x = east, -z = north
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
})();

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999; // pinned just inside the far plane
}`;

const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, h), 0.8));
  vec3 col = h >= 0.0 ? sky : mix(uHorizon, uGround, smoothstep(0.0, -0.2, h));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function SkyDome() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: {
          uZenith: { value: new Color(PALETTE.sky.zenith) },
          uHorizon: { value: new Color(PALETTE.sky.horizon) },
          uGround: { value: new Color(PALETTE.fog) },
        },
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-1000} frustumCulled={false} scale={1000}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  );
}

function Sun() {
  const light = useRef<DirectionalLight>(null);
  const scratch = useMemo(() => ({ focus: new Vector3(), right: new Vector3(), up: new Vector3() }), []);
  const lastHalf = useRef(0);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const { focus, right, up } = scratch;
    // Shadow coverage scales with how far the camera is from what it looks at.
    const wanted = MathUtils.clamp(cameraState.distance * (0.6 + 0.5 * cameraState.mapness), 220, 11000);
    // Quantise the frustum size (±12 %) so texel size does not change every frame.
    const step = Math.pow(1.12, Math.round(Math.log(wanted) / Math.log(1.12)));
    const half = step;
    const texel = (2 * half) / SHADOW_MAP;
    // Snap the focus to the texel grid in light space.
    right.crossVectors(new Vector3(0, 1, 0), SUN_DIRECTION).normalize();
    up.crossVectors(SUN_DIRECTION, right);
    focus.copy(cameraState.target).setY(0);
    const u = Math.round(focus.dot(right) / texel) * texel;
    const v = Math.round(focus.dot(up) / texel) * texel;
    const w = focus.dot(SUN_DIRECTION);
    focus.copy(right).multiplyScalar(u).addScaledVector(up, v).addScaledVector(SUN_DIRECTION, w);

    l.position.copy(focus).addScaledVector(SUN_DIRECTION, SUN_DISTANCE);
    l.target.position.copy(focus);
    l.target.updateMatrixWorld();
    if (half !== lastHalf.current) {
      const cam = l.shadow.camera;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      // Oblique sun: ground at the frustum edge is ~half·cos(elevation) deeper.
      cam.near = Math.max(10, SUN_DISTANCE - half * 1.3 - 800);
      cam.far = SUN_DISTANCE + half * 1.3 + 800;
      cam.updateProjectionMatrix();
      l.shadow.normalBias = texel * 1.1;
      l.shadow.radius = MathUtils.clamp(3.5 - Math.log10(half) * 0.6, 1.2, 3);
      lastHalf.current = half;
    }
  });

  return (
    <directionalLight
      ref={light}
      color={PALETTE.sun}
      intensity={2.6}
      castShadow
      shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
      shadow-bias={-0.00025}
    />
  );
}

/** Distance haze that adapts to zoom: the map stays crisp, 3D views get depth. */
function Haze() {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new Fog(PALETTE.fog, 2000, 30000), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [fog, scene]);
  useFrame((_, dt) => {
    const d = cameraState.distance;
    const map = cameraState.mapness;
    const near = d * MathUtils.lerp(1.3, 2.2, map) + 700;
    const far = d * MathUtils.lerp(4.4, 7, map) + 14000;
    fog.near = MathUtils.damp(fog.near, near, 6, dt);
    fog.far = MathUtils.damp(fog.far, far, 6, dt);
    sceneUniforms.uTime.value += dt;
  });
  return null;
}

export function Atmosphere() {
  const sunPos = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(60).toArray(), []);
  return (
    <>
      <SkyDome />
      <Haze />
      <hemisphereLight args={[PALETTE.hemiSky, PALETTE.hemiGround, 0.95]} />
      <Sun />
      <Environment resolution={256} frames={1} environmentIntensity={0.8}>
        <mesh scale={100}>
          <sphereGeometry args={[1, 32, 16]} />
          <shaderMaterial
            side={BackSide}
            vertexShader={skyVertex}
            fragmentShader={skyFragment}
            uniforms={{
              uZenith: { value: new Color(PALETTE.sky.zenith) },
              uHorizon: { value: new Color(PALETTE.sky.horizon) },
              uGround: { value: new Color("#9aa093") },
            }}
          />
        </mesh>
        <Lightformer form="circle" intensity={8} color="#fff1d6" position={sunPos as [number, number, number]} scale={10} />
      </Environment>
    </>
  );
}
