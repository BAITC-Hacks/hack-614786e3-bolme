/**
 * City scene state shared by the 3D scene and the UI layer.
 *
 * The UX layer drives the camera only through this store: switch the view
 * mode, focus a hotspot / landmark / district, or go back to the map.
 */
import { create } from "zustand";
import type { LandmarkId } from "./landmarks";
import type { CityManifest } from "./schema";

/** map = main top-down screen, orbit = free 3D, drone = free flight, tour = auto flyover. */
export type ViewMode = "map" | "orbit" | "drone" | "tour";

export type HotspotTone = "critical" | "warning" | "info" | "positive";

/** A "stone in the water" marker: something is happening in this area. */
export type Hotspot = {
  id: string;
  title: string;
  caption: string;
  /** Centre in scene metres (+x east, +z south). */
  x: number;
  z: number;
  /** Area radius, metres. */
  radius: number;
  tone: HotspotTone;
  districtId?: string;
};

export type Focus =
  | { kind: "hotspot"; id: string }
  | { kind: "landmark"; id: LandmarkId }
  | { kind: "district"; id: string }
  /** Any scene point, e.g. the site of a proposed clinic. */
  | { kind: "point"; x: number; z: number; distance?: number; title?: string };

export type LoadStatus = "loading" | "ready" | "error";

type CityState = {
  status: LoadStatus;
  progress: number;
  error: string | null;
  manifest: CityManifest | null;
  mode: ViewMode;
  focus: Focus | null;
  /** Increments on every camera request so repeated requests re-trigger flights. */
  cameraNonce: number;
  hotspots: Hotspot[];
  hoveredHotspotId: string | null;
  /** Index into manifest.districts, -1 = none. */
  highlightedDistrict: number;
  treesReady: boolean;
  /** Short cinematic caption (tour stop, focused landmark). */
  caption: string | null;

  setProgress: (progress: number) => void;
  setReady: (manifest: CityManifest) => void;
  setError: (message: string) => void;
  setTreesReady: () => void;
  setCaption: (caption: string | null) => void;
  setMode: (mode: ViewMode) => void;
  setHotspots: (hotspots: Hotspot[]) => void;
  setHoveredHotspot: (id: string | null) => void;
  selectHotspot: (id: string) => void;
  focusLandmark: (id: LandmarkId) => void;
  focusDistrict: (id: string) => void;
  /** Fly the 3D camera to a scene point (metres). `distance` defaults to 900 m. */
  focusPoint: (x: number, z: number, options?: { distance?: number; title?: string }) => void;
  backToMap: () => void;
};

export const useCityStore = create<CityState>()((set, get) => ({
  status: "loading",
  progress: 0,
  error: null,
  manifest: null,
  mode: "map",
  focus: null,
  cameraNonce: 0,
  hotspots: [],
  hoveredHotspotId: null,
  highlightedDistrict: -1,
  treesReady: false,
  caption: null,

  setProgress: (progress) => set({ progress }),
  setReady: (manifest) => set({ status: "ready", progress: 1, manifest }),
  setError: (message) => set({ status: "error", error: message }),
  setTreesReady: () => set({ treesReady: true }),
  setCaption: (caption) => set({ caption }),
  setMode: (mode) =>
    set((s) => ({
      mode,
      focus: mode === "map" ? null : s.focus,
      highlightedDistrict: mode === "map" ? -1 : s.highlightedDistrict,
      cameraNonce: s.cameraNonce + 1,
    })),
  setHotspots: (hotspots) => set({ hotspots }),
  setHoveredHotspot: (id) => set({ hoveredHotspotId: id }),
  selectHotspot: (id) => {
    const { hotspots, manifest } = get();
    const hotspot = hotspots.find((h) => h.id === id);
    if (!hotspot) return;
    const districtIndex = manifest?.districts.findIndex((d) => d.id === hotspot.districtId) ?? -1;
    set((s) => ({
      mode: "orbit",
      focus: { kind: "hotspot", id },
      highlightedDistrict: districtIndex,
      hoveredHotspotId: null,
      cameraNonce: s.cameraNonce + 1,
    }));
  },
  focusLandmark: (id) =>
    set((s) => ({ mode: "orbit", focus: { kind: "landmark", id }, highlightedDistrict: -1, cameraNonce: s.cameraNonce + 1 })),
  focusDistrict: (id) => {
    const index = get().manifest?.districts.findIndex((d) => d.id === id) ?? -1;
    set((s) => ({ mode: "orbit", focus: { kind: "district", id }, highlightedDistrict: index, cameraNonce: s.cameraNonce + 1 }));
  },
  focusPoint: (x, z, options = {}) =>
    set((s) => ({ mode: "orbit", focus: { kind: "point", x, z, ...options }, cameraNonce: s.cameraNonce + 1 })),
  backToMap: () => set((s) => ({ mode: "map", focus: null, highlightedDistrict: -1, cameraNonce: s.cameraNonce + 1 })),
}));
