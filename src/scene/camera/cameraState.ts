/**
 * Per-frame camera snapshot for render-loop consumers (sun shadows, LOD,
 * overlays). Written by CameraRig every frame; read-only elsewhere.
 * Kept outside React state on purpose: it changes 60 times a second.
 */
import { Vector3 } from "three";
import type { ViewMode } from "@/city/store";

export const cameraState = {
  target: new Vector3(),
  position: new Vector3(),
  distance: 1000,
  polar: 0,
  azimuth: 0,
  mode: "map" as ViewMode,
  /** 1 = top-down map view, 0 = oblique 3D. Smoothly follows the polar angle. */
  mapness: 1,
  flying: false,
};
