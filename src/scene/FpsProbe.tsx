"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useCityStore } from "@/city/store";
import { fpsState } from "./fpsState";

/**
 * Samples frame rate and whole-frame draw stats (all post-processing passes
 * included) into fpsState, read by the debug HUD. With `?debug` the store is
 * also exposed as `window.__akim` for manual testing from the console.
 */
export function FpsProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const acc = useRef({ frames: 0, time: 0 });
  useEffect(() => {
    gl.info.autoReset = false;
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __akim?: unknown }).__akim = { store: useCityStore, gl, scene, camera };
    }
  }, [gl, scene, camera]);
  // Runs first each frame: read the previous frame's totals, then reset.
  useFrame((_, dt) => {
    acc.current.frames++;
    acc.current.time += dt;
    if (acc.current.time >= 0.5) {
      fpsState.fps = acc.current.frames / acc.current.time;
      fpsState.calls = gl.info.render.calls;
      fpsState.triangles = gl.info.render.triangles;
      acc.current.frames = 0;
      acc.current.time = 0;
    }
    gl.info.reset();
  }, -1000);
  return null;
}
