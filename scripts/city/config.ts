/**
 * Shared configuration for the Astana city data pipeline.
 *
 * Coordinates: WGS84 lon/lat. The scene uses a local tangent plane in metres
 * centred on Baiterek: +x = east, +z = south, +y = up (three.js convention).
 */

export const ORIGIN = { lat: 51.12829, lon: 71.43045 } as const; // Baiterek

/**
 * Built-up Astana: all five districts of the case (Esil, Almaty, Saryarka,
 * Baikonur, Nura) meet inside this box. ~19.5 km (N–S) × 17.5 km (E–W).
 */
export const SCENE_BBOX = { south: 51.055, west: 71.32, north: 51.23, east: 71.57 } as const;

/** OSM relation ids of the five districts used by the case (admin_level=6). */
export const DISTRICT_RELATIONS = {
  esil: 3479876,
  almaty: 3482819,
  saryarka: 3486954,
  baikonur: 8593081,
  nura: 20593940,
} as const;

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

export const USER_AGENT = "akim-city-builder/0.1 (HackAlem team Bolme; OSM ODbL data prep)";

export const RAW_DIR = "data/osm";
export const OUT_DIR = "public/city";
