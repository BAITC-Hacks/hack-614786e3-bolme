"use client";

/**
 * Debug helper (only with `?debug`): Alt/Option + click on the map prints the
 * scene coordinates and lat/lon of the ground point, and stores them in
 * `window.__akim.lastPick`. Handy for placing initiative objects on real plots.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { sceneToLonLat } from "@/city/geo";
import type { CityManifest } from "@/city/schema";

export function DebugGroundPicker({ manifest }: { manifest: CityManifest }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const tools = useMemo(() => ({ ray: new Raycaster(), ndc: new Vector2(), ground: new Plane(new Vector3(0, 1, 0), 0), hit: new Vector3() }), []);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      if (!e.altKey) return;
      const rect = el.getBoundingClientRect();
      tools.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      if (!tools.ray.ray.intersectPlane(tools.ground, tools.hit)) return;
      const x = Math.round(tools.hit.x);
      const z = Math.round(tools.hit.z);
      const { lat, lon } = sceneToLonLat(manifest, { x, z });
      const pick = { x, z, lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
      const w = window as unknown as { __akim?: Record<string, unknown> };
      if (w.__akim) w.__akim.lastPick = pick;
      console.info("[akim] ground pick", pick);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [camera, gl, manifest, tools]);

  return null;
}
