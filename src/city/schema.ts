/**
 * Data contract between the offline OSM pipeline (scripts/city) and the
 * browser scene. All coordinates are integer decimetres in the local frame:
 * +x = east, +z = south, origin = Baiterek. Polygon/polyline coordinates are
 * delta-encoded per ring: the first point is absolute, the rest are deltas.
 */

export const CITY_DATA_VERSION = 1;

/** Metres per stored coordinate unit. */
export const COORD_SCALE = 0.1;

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Ground polygon kinds, in draw order (lower first). */
export const AreaKind = {
  Farmland: 1,
  Industrial: 2,
  Sand: 3,
  Rail: 4,
  Grass: 5,
  Scrub: 6,
  Cemetery: 7,
  Park: 8,
  Forest: 9,
  Playground: 10,
  Pitch: 11,
  Parking: 12,
  Water: 13,
  Plaza: 14,
  Bridge: 15,
} as const;
export type AreaKind = (typeof AreaKind)[keyof typeof AreaKind];

/** Road classes; smaller number = more important road. */
export const RoadClass = {
  Motorway: 0,
  Primary: 1,
  Secondary: 2,
  Tertiary: 3,
  Minor: 4,
  Service: 5,
  Track: 6,
  Pedestrian: 7,
  Path: 8,
} as const;
export type RoadClass = (typeof RoadClass)[keyof typeof RoadClass];

export const RoadFlag = { Bridge: 1, Oneway: 2, Sidewalk: 4 } as const;

export const RailKind = { Rail: 0, LightRail: 1, Tram: 2 } as const;
export const RailFlag = { Bridge: 1 } as const;

/** Coarse building function, used for subtle tinting and future gameplay. */
export const BuildingKind = {
  Other: 0,
  House: 1,
  Apartments: 2,
  Commercial: 3,
  Industrial: 4,
  Public: 5,
  Education: 6,
  Health: 7,
  Religious: 8,
  Sport: 9,
  Transport: 10,
  Small: 11,
} as const;
export type BuildingKind = (typeof BuildingKind)[keyof typeof BuildingKind];

export const RoofShape = { Flat: 0, Pyramidal: 1, Dome: 2 } as const;

export const BuildingFlag = {
  /** Height was estimated from type/footprint, not tagged in OSM. */
  EstimatedHeight: 1,
  /** Element is a building:part. */
  Part: 2,
  /** Height overridden because a custom landmark model sits on top. */
  LandmarkBase: 4,
} as const;

/** Flattened polygon set: polygon → rings → points. */
export type PolygonSet = {
  /** Number of rings per polygon (first ring is outer, rest are holes). */
  rings: number[];
  /** Number of points per ring (closing point is not repeated). */
  points: number[];
  /** Delta-encoded decimetre coordinates (x, z pairs). */
  coords: number[];
};

/** Flattened polyline set. */
export type PolylineSet = {
  points: number[];
  coords: number[];
};

export type BuildingsFile = PolygonSet & {
  version: number;
  count: number;
  id: number[];
  /** Top height, decimetres. */
  height: number[];
  /** Base height, decimetres (non-zero for parts on podiums, canopies, bridges). */
  minHeight: number[];
  kind: number[];
  roof: number[];
  /** Roof height, decimetres (0 when flat). */
  roofHeight: number[];
  flags: number[];
  /** Index into districts, 255 = outside the five case districts. */
  district: number[];
};

export type GroundFile = {
  version: number;
  areas: PolygonSet & { kind: number[] };
  roads: PolylineSet & { cls: number[]; width: number[]; flags: number[] };
  rails: PolylineSet & { kind: number[]; flags: number[] };
};

/**
 * Trees are stored in `trees.bin`, grouped by square chunks (for culling and
 * distance LOD) and shuffled inside each chunk so that any prefix of a chunk
 * is a uniform random subset. Record layout, little-endian, 6 bytes:
 *   u16 x, u16 z — position inside the chunk, 0..65535 → 0..chunkSize metres
 *   u8 height    — decimetres
 *   u8 bits      — bit 0: conifer, bits 1..7: random tint seed
 */
export const TREE_RECORD_BYTES = 6;

export type TreeChunk = {
  /** Chunk origin, metres. */
  x: number;
  z: number;
  /** First record index and record count. */
  offset: number;
  count: number;
};

export type TreesIndex = {
  file: string;
  chunkSize: number;
  count: number;
  chunks: TreeChunk[];
};

export type DistrictData = {
  id: string;
  name: string;
  osmRelation: number;
  /** Building-weighted centre of the district inside the scene, metres. */
  center: [number, number];
  buildingCount: number;
  polygons: PolygonSet;
};

export type LandmarkAnchor = {
  id: string;
  /** Centre of the footprint, metres. */
  x: number;
  z: number;
  /** Max distance from centre to the footprint outline, metres. */
  radius: number;
  /** Rotation of the footprint's main axis around +y, radians. */
  rotation: number;
  /** Size of the oriented footprint box along / across the main axis, metres. */
  length: number;
  width: number;
};

export type CityManifest = {
  version: number;
  generatedAt: string;
  osmFetchedAt: string;
  origin: { lat: number; lon: number };
  /** Scene bounds in metres. */
  bounds: Bounds;
  counts: Record<string, number>;
  landmarks: Record<string, LandmarkAnchor>;
  districts: DistrictData[];
  files: { buildings: string; ground: string };
  trees: TreesIndex;
  attribution: string;
};
