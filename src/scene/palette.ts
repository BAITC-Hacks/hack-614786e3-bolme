/**
 * Scene colour tokens — the architectural "white clay" model look.
 * Sampled from the team reference (docs/design/astana-clay-reference.png)
 * and then balanced for PBR lighting + neutral tone mapping.
 */
import { AreaKind } from "@/city/schema";

export const PALETTE = {
  ground: "#aeb2ab",
  building: "#f6f7fa",
  casing: "#cdd0d1",
  asphalt: "#7f858f",
  marking: "#eef0f2",
  path: "#dfe2e1",
  pedestrian: "#d6d8d5",
  track: "#c3bba8",
  railBed: "#b3aea6",
  railTrack: "#6e6c6a",
  concrete: "#e4e5e3",
  sky: { zenith: "#9fbad3", horizon: "#e6eaec" },
  fog: "#dde3e7",
  sun: "#fff4e6",
  hemiSky: "#dfe8f3",
  hemiGround: "#b3ad9d",
  treeBroadleaf: ["#5d7c34", "#6b8a3b", "#78963f", "#58763a"],
  treeConifer: ["#40603a", "#4a6b40", "#385736"],
  gold: "#e3b04b",
  glassBlue: "#6f93b3",
  domeBlue: "#8cc0e2",
} as const;

export const AREA_COLORS: Record<AreaKind, string> = {
  [AreaKind.Farmland]: "#b4b995",
  [AreaKind.Industrial]: "#b3b3ab",
  [AreaKind.Sand]: "#cdc3b1",
  [AreaKind.Rail]: "#b1afa7",
  [AreaKind.Grass]: "#8a9a58",
  [AreaKind.Scrub]: "#7d9150",
  [AreaKind.Cemetery]: "#909c78",
  [AreaKind.Park]: "#7d924b",
  [AreaKind.Forest]: "#5c773b",
  [AreaKind.Playground]: "#cfc2a4",
  [AreaKind.Pitch]: "#7f9c52",
  [AreaKind.Parking]: "#9aa0ac",
  [AreaKind.Water]: "#8aa9c6",
  [AreaKind.Plaza]: "#d3d5d2",
  [AreaKind.Bridge]: "#d8dad8",
};

/** Draw order for flat ground layers (lower first). Roads come after areas. */
export const LAYER_ORDER = {
  ground: -100,
  areaBase: -90, // + AreaKind
  paths: -60,
  tracks: -59,
  railBed: -58,
  railTrack: -57,
  casing: -56,
  pedestrian: -55,
  asphalt: -54,
  markings: -53,
  districts: -40,
} as const;
