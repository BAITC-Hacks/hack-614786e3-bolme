"use client";

/**
 * Camera director: map (main top-down screen), orbit (3D), drone (free flight)
 * and tour (cinematic flyover). Every transition is an eased flight that
 * interpolates target, log-distance, tilt and FOV, with an arc for long hops.
 */
import { useFrame, useThree } from "@react-three/fiber";
import CameraControls from "camera-controls";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from "three";
import { LANDMARKS } from "@/city/landmarks";
import type { CityManifest } from "@/city/schema";
import { useCityStore, type ViewMode } from "@/city/store";
import { cameraState } from "./cameraState";
import {
  DISTANCE,
  MAP_POLAR,
  ORBIT_FOV,
  ORBIT_POLAR,
  TOUR,
  clonePose,
  distanceForFov,
  districtPose,
  easeInOutCubic,
  hotspotPose,
  landmarkPose,
  overviewPose,
  pointPose,
  poseToPosition,
  shortestAngle,
  type Pose,
} from "./poses";
import { isTyping, usePressedKeys } from "./useKeyboard";

CameraControls.install({
  THREE: { Box3, MathUtils: { clamp: MathUtils.clamp }, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
});

const ACTION = CameraControls.ACTION;
const TOUR_ORBIT_SECONDS = 6.5;
const DRONE_LOOK_SPEED = 0.0028;

type Flight = { from: Pose; to: Pose; t: number; duration: number; bump: number; onDone?: () => void };

const titleOf = (id: string) => LANDMARKS.find((l) => l.id === id)?.title ?? null;

export function CameraRig({ manifest }: { manifest: CityManifest }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const controls = useMemo(() => new CameraControls(camera), [camera]);
  const mode = useCityStore((s) => s.mode);
  const focus = useCityStore((s) => s.focus);
  const nonce = useCityStore((s) => s.cameraNonce);
  const keys = usePressedKeys();

  const flight = useRef<Flight | null>(null);
  const modeRef = useRef<ViewMode>(mode);
  const prevMode = useRef<ViewMode | null>(null);
  const mapPose = useRef<Pose | null>(null);
  const drift = useRef(false);
  const tour = useRef({ index: 0, orbitLeft: 0 });
  const tourNext = useRef<(() => void) | null>(null);
  const drone = useRef({ euler: new Euler(0, 0, 0, "YXZ"), velocity: new Vector3(), dragging: false });
  const scratch = useMemo(
    () => ({ pose: { target: new Vector3(), distance: 1, polar: 0, azimuth: 0, fov: ORBIT_FOV } as Pose, v: new Vector3(), w: new Vector3() }),
    [],
  );

  // ------------------------------------------------------------ helpers --
  const api = useMemo(() => {
    const readPose = (): Pose => ({
      target: controls.getTarget(new Vector3()),
      distance: controls.distance,
      polar: controls.polarAngle,
      azimuth: controls.azimuthAngle,
      fov: camera.fov,
    });

    const applyPose = (p: Pose) => {
      const pos = poseToPosition(p, scratch.v);
      controls.setLookAt(pos.x, pos.y, pos.z, p.target.x, p.target.y, p.target.z, false);
      if (Math.abs(camera.fov - p.fov) > 1e-4) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
    };

    const relax = () => {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.minDistance = 1;
      controls.maxDistance = Infinity;
    };

    const constrain = (m: ViewMode) => {
      controls.enabled = m !== "drone";
      controls.dollyToCursor = true;
      controls.smoothTime = 0.2;
      controls.draggingSmoothTime = 0.08;
      if (m === "map") {
        controls.minPolarAngle = MAP_POLAR;
        controls.maxPolarAngle = MAP_POLAR;
        controls.minDistance = 450;
        controls.maxDistance = DISTANCE.max;
        controls.mouseButtons.left = ACTION.TRUCK;
        controls.mouseButtons.right = ACTION.ROTATE;
        controls.mouseButtons.middle = ACTION.DOLLY;
        controls.mouseButtons.wheel = ACTION.DOLLY;
        controls.touches.one = ACTION.TOUCH_TRUCK;
        controls.touches.two = ACTION.TOUCH_DOLLY_ROTATE;
        controls.touches.three = ACTION.TOUCH_TRUCK;
      } else {
        controls.minPolarAngle = ORBIT_POLAR.min;
        controls.maxPolarAngle = ORBIT_POLAR.max;
        controls.minDistance = DISTANCE.min;
        controls.maxDistance = 16000;
        controls.mouseButtons.left = ACTION.ROTATE;
        // SCREEN_PAN = map-like pan: vertical drag moves along the ground.
        controls.mouseButtons.right = ACTION.SCREEN_PAN;
        controls.mouseButtons.middle = ACTION.DOLLY;
        controls.mouseButtons.wheel = ACTION.DOLLY;
        controls.touches.one = ACTION.TOUCH_ROTATE;
        controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
        controls.touches.three = ACTION.TOUCH_SCREEN_PAN;
      }
    };

    const startFlight = (to: Pose, options: { duration?: number; onDone?: () => void } = {}) => {
      const from = readPose();
      const travel = from.target.distanceTo(to.target);
      const zoom = Math.abs(Math.log(to.distance / Math.max(1, from.distance)));
      const tilt = Math.abs(to.polar - from.polar);
      const duration = options.duration ?? MathUtils.clamp(1.3 + travel / 5200 + tilt * 0.9 + zoom * 0.3, 1.5, 4.6);
      const target = clonePose(to);
      target.azimuth = from.azimuth + shortestAngle(from.azimuth, to.azimuth);
      relax();
      drift.current = false;
      flight.current = {
        from,
        to: target,
        t: 0,
        duration,
        bump: Math.max(0, travel - Math.max(from.distance, to.distance)) * 0.45,
        onDone: options.onDone,
      };
    };

    const syncFromCamera = () => {
      const dir = camera.getWorldDirection(scratch.w);
      const target = scratch.v.copy(camera.position);
      if (dir.y < -0.08) target.addScaledVector(dir, Math.min(-camera.position.y / dir.y, 6000));
      else target.addScaledVector(dir, 600).setY(0);
      controls.setLookAt(camera.position.x, camera.position.y, camera.position.z, target.x, target.y, target.z, false);
    };

    return { readPose, applyPose, relax, constrain, startFlight, syncFromCamera };
  }, [camera, controls, scratch]);

  // --------------------------------------------------------- lifecycle --
  useEffect(() => {
    controls.connect(gl.domElement);
    const b = manifest.bounds;
    controls.setBoundary(new Box3(new Vector3(b.minX - 800, -50, b.minZ - 800), new Vector3(b.maxX + 800, 600, b.maxZ + 800)));
    controls.boundaryFriction = 0.15;
    const initial = overviewPose(manifest, gl.domElement.clientWidth / Math.max(1, gl.domElement.clientHeight));
    api.relax();
    api.applyPose(initial);
    api.constrain("map");
    mapPose.current = initial;

    const onControlStart = () => {
      flight.current = null;
      drift.current = false;
      if (modeRef.current === "tour") useCityStore.getState().setMode("orbit");
      else api.constrain(modeRef.current);
    };
    controls.addEventListener("controlstart", onControlStart);
    return () => {
      controls.removeEventListener("controlstart", onControlStart);
      controls.disconnect();
    };
  }, [api, controls, gl, manifest]);

  // Drone look (drag) and tour interruption, handled on the canvas element.
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      if (modeRef.current === "drone") {
        drone.current.dragging = true;
        el.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (modeRef.current !== "drone" || !drone.current.dragging) return;
      const eul = drone.current.euler;
      eul.y -= e.movementX * DRONE_LOOK_SPEED;
      eul.x = MathUtils.clamp(eul.x - e.movementY * DRONE_LOOK_SPEED, -1.5, 0.9);
    };
    const onUp = (e: PointerEvent) => {
      drone.current.dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      if (modeRef.current === "tour") useCityStore.getState().setMode("orbit");
      if (modeRef.current === "drone") {
        const dir = camera.getWorldDirection(scratch.w);
        camera.position.addScaledVector(dir, -e.deltaY * Math.max(1, camera.position.y) * 0.002);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (modeRef.current === "tour" && !isTyping(e.target) && /^(Key[WASDQE]|Arrow)/.test(e.code)) useCityStore.getState().setMode("orbit");
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [camera, gl, scratch]);

  // ------------------------------------------------------ mode changes --
  useEffect(() => {
    const prev = prevMode.current;
    prevMode.current = mode;
    modeRef.current = mode;
    const store = useCityStore.getState();
    if (prev === null) return; // initial mount handled above
    if (prev === "map" && mode !== "map" && !flight.current) mapPose.current = api.readPose();
    if (prev === "drone" && mode !== "drone") {
      api.syncFromCamera();
      controls.enabled = true;
    }
    if (mode !== "tour") store.setCaption(null);

    if (mode === "map") {
      api.startFlight(mapPose.current ?? overviewPose(manifest, gl.domElement.clientWidth / gl.domElement.clientHeight), {
        onDone: () => api.constrain("map"),
      });
      return;
    }

    if (mode === "drone") {
      flight.current = null;
      controls.enabled = false;
      const eul = drone.current.euler.setFromQuaternion(camera.quaternion, "YXZ");
      if (eul.x < -1.1) eul.x = -0.55;
      drone.current.velocity.set(0, 0, 0);
      return;
    }

    if (mode === "tour") {
      tour.current.orbitLeft = 0;
      const next = () => {
        for (let guard = 0; guard < TOUR.length; guard++) {
          const id = TOUR[tour.current.index % TOUR.length];
          tour.current.index++;
          const pose = landmarkPose(manifest, id);
          if (!pose) continue;
          useCityStore.getState().setCaption(titleOf(id));
          api.startFlight(pose, {
            duration: 4.4,
            onDone: () => {
              tour.current.orbitLeft = TOUR_ORBIT_SECONDS;
            },
          });
          return;
        }
      };
      tourNext.current = next;
      next();
      return;
    }

    // orbit
    const current = api.readPose();
    let to: Pose | null = null;
    if (focus?.kind === "hotspot") {
      const hotspot = store.hotspots.find((h) => h.id === focus.id);
      if (hotspot) to = hotspotPose(hotspot, current.azimuth);
    } else if (focus?.kind === "landmark") {
      to = landmarkPose(manifest, focus.id);
      store.setCaption(titleOf(focus.id));
    } else if (focus?.kind === "district") {
      to = districtPose(manifest, focus.id, current.azimuth);
    } else if (focus?.kind === "point") {
      to = pointPose(focus.x, focus.z, focus.distance ?? 900, current.azimuth);
      if (focus.title) store.setCaption(focus.title);
    } else if (prev === "map") {
      const d = distanceForFov(current.distance, current.fov, ORBIT_FOV);
      to = {
        target: current.target.clone(),
        distance: MathUtils.clamp(d * 0.5, 450, 9000),
        polar: 0.98,
        azimuth: current.azimuth + 0.45,
        fov: ORBIT_FOV,
      };
    }
    if (to) {
      api.startFlight(to, {
        onDone: () => {
          api.constrain("orbit");
          drift.current = focus !== null;
        },
      });
    } else {
      api.constrain("orbit");
    }
    // `nonce` re-triggers flights for repeated requests of the same focus.
  }, [mode, focus, nonce, api, camera, controls, gl, manifest]);

  function stepKeys(dt: number, m: ViewMode) {
    const k = keys.current;
    if (!k || k.size === 0) return;
    let fwd = 0;
    let side = 0;
    let rot = 0;
    let zoom = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) fwd += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fwd -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) side += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) side -= 1;
    if (k.has("KeyQ")) rot += 1;
    if (k.has("KeyE")) rot -= 1;
    if (k.has("Equal") || k.has("NumpadAdd") || k.has("KeyZ")) zoom += 1;
    if (k.has("Minus") || k.has("NumpadSubtract") || k.has("KeyX")) zoom -= 1;
    if (!fwd && !side && !rot && !zoom) return;
    drift.current = false;
    const boost = k.has("ShiftLeft") || k.has("ShiftRight") ? 2.5 : 1;
    const step = controls.distance * 0.75 * dt * boost;
    const az = controls.azimuthAngle;
    const t = controls.getTarget(scratch.v);
    const dx = (-Math.sin(az) * fwd + Math.cos(az) * side) * step;
    const dz = (-Math.cos(az) * fwd - Math.sin(az) * side) * step;
    if (dx || dz) controls.moveTo(t.x + dx, t.y, t.z + dz, false);
    if (rot) controls.rotate(rot * dt * 1.1, 0, false);
    if (zoom) controls.dolly(zoom * controls.distance * dt * 1.4, false);
    if (m === "tour") useCityStore.getState().setMode("orbit");
  }

  function stepDrone(dt: number) {
    const d = drone.current;
    camera.quaternion.setFromEuler(d.euler);
    const k = keys.current ?? new Set<string>();
    const forward = scratch.v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = scratch.w.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const input = new Vector3();
    if (k.has("KeyW") || k.has("ArrowUp")) input.add(forward);
    if (k.has("KeyS") || k.has("ArrowDown")) input.sub(forward);
    if (k.has("KeyD") || k.has("ArrowRight")) input.add(right);
    if (k.has("KeyA") || k.has("ArrowLeft")) input.sub(right);
    if (k.has("KeyE") || k.has("Space")) input.y += 1;
    if (k.has("KeyQ") || k.has("KeyC")) input.y -= 1;
    const boost = k.has("ShiftLeft") || k.has("ShiftRight") ? 3.5 : 1;
    const speed = MathUtils.clamp(camera.position.y * 0.8, 30, 1400) * boost;
    if (input.lengthSq() > 0) input.normalize().multiplyScalar(speed);
    d.velocity.lerp(input, 1 - Math.exp(-5 * dt));
    camera.position.addScaledVector(d.velocity, dt);
    const b = manifest.bounds;
    camera.position.set(
      MathUtils.clamp(camera.position.x, b.minX - 2000, b.maxX + 2000),
      MathUtils.clamp(camera.position.y, 6, 9000),
      MathUtils.clamp(camera.position.z, b.minZ - 2000, b.maxZ + 2000),
    );
    if (Math.abs(camera.fov - ORBIT_FOV - 8) > 0.01) {
      camera.fov = MathUtils.lerp(camera.fov, ORBIT_FOV + 8, 1 - Math.exp(-4 * dt));
      camera.updateProjectionMatrix();
    }
  }

  function publishState(m: ViewMode) {
    cameraState.mode = m;
    cameraState.flying = flight.current !== null;
    cameraState.position.copy(camera.position);
    if (m === "drone") {
      const dir = camera.getWorldDirection(scratch.w);
      const reach = dir.y < -0.05 ? Math.min(-camera.position.y / dir.y, 4000) : 800;
      cameraState.target.copy(camera.position).addScaledVector(dir, reach).setY(0);
      cameraState.distance = camera.position.distanceTo(cameraState.target);
      cameraState.polar = Math.acos(MathUtils.clamp(-dir.y, -1, 1));
    } else {
      controls.getTarget(cameraState.target);
      cameraState.distance = controls.distance;
      cameraState.polar = controls.polarAngle;
      cameraState.azimuth = controls.azimuthAngle;
    }
    const mapness = 1 - MathUtils.smoothstep(cameraState.polar, 0.04, 0.4);
    cameraState.mapness += (mapness - cameraState.mapness) * 0.25;

    const altitude = Math.max(2, camera.position.y);
    const near = MathUtils.clamp(Math.min(altitude, cameraState.distance) * 0.02, 0.5, 300);
    const far = MathUtils.clamp(cameraState.distance * 4 + 28000, 32000, 150000);
    if (Math.abs(camera.near - near) / near > 0.05 || Math.abs(camera.far - far) / far > 0.05) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  // --------------------------------------------------------- per frame --
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const m = modeRef.current;
    const f = flight.current;

    if (f) {
      f.t = Math.min(1, f.t + dt / f.duration);
      const e = easeInOutCubic(f.t);
      const eTarget = easeInOutCubic(Math.min(1, f.t * 1.12));
      const eTilt = easeInOutCubic(MathUtils.clamp((f.t - 0.08) / 0.92, 0, 1));
      const p = scratch.pose;
      p.target.lerpVectors(f.from.target, f.to.target, eTarget);
      p.distance =
        Math.exp(MathUtils.lerp(Math.log(Math.max(1, f.from.distance)), Math.log(Math.max(1, f.to.distance)), e)) +
        f.bump * Math.sin(Math.PI * e);
      p.polar = MathUtils.lerp(f.from.polar, f.to.polar, eTilt);
      p.azimuth = MathUtils.lerp(f.from.azimuth, f.to.azimuth, e);
      p.fov = MathUtils.lerp(f.from.fov, f.to.fov, eTilt);
      api.applyPose(p);
      if (f.t >= 1) {
        flight.current = null;
        f.onDone?.();
      }
    } else if (m === "drone") {
      stepDrone(dt);
    } else {
      if (m === "tour") {
        controls.rotate(0.075 * dt, 0, false);
        tour.current.orbitLeft -= dt;
        if (tour.current.orbitLeft <= 0 && tourNext.current) tourNext.current();
      } else if (drift.current) {
        controls.rotate(0.03 * dt, 0, false);
      }
      stepKeys(dt, m);
    }

    if (m !== "drone") controls.update(dt);
    publishState(m);
  });

  return null;
}
