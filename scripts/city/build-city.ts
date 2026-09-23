/**
 * Bakes raw OSM layers (data/osm) into compact scene data (public/city).
 *
 * Usage: npm run city:build
 *
 * Real geometry is kept 1:1 — every OSM building footprint in the scene box is
 * exported at its surveyed position; only duplicate/collinear points closer
 * than a few centimetres are dropped. Heights come from OSM `height` /
 * `building:levels`; missing heights are estimated and flagged.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANDMARKS } from "../../src/city/landmarks";
import {
  AreaKind,
  BuildingFlag,
  BuildingKind,
  CITY_DATA_VERSION,
  RailFlag,
  RoadClass,
  RoadFlag,
  type Bounds,
  type BuildingsFile,
  type CityManifest,
  type DistrictData,
  type GroundFile,
  type LandmarkAnchor,
  type PolygonSet,
  type PolylineSet,
  type TreeChunk,
  TREE_RECORD_BYTES,
} from "../../src/city/schema";
import { DISTRICT_RELATIONS, ORIGIN, OUT_DIR, RAW_DIR, SCENE_BBOX } from "./config";
import { areaKind, buildingHeight, buildingKind, parseMeters, railInfo, roadInfo } from "./lib/classify";
import {
  boxesIntersect,
  cleanRing,
  hash01,
  orientedBox,
  pointInPolygon,
  polygonArea,
  project,
  ringBox,
  ringCentroid,
  simplifyLine,
  simplifyRing,
  type Box,
  type Polygon,
  type Vec2,
} from "./lib/geo";
import { elementPolygons, loadLayer, wayLine, type OsmElement, type Tags } from "./lib/osm";
import { Raster } from "./lib/raster";

const DISTRICT_NAMES: Record<keyof typeof DISTRICT_RELATIONS, string> = {
  esil: "Есиль",
  almaty: "Алматы",
  saryarka: "Сарыарка",
  baikonur: "Байконур",
  nura: "Нура",
};

const BUILDING_TOLERANCE = 0.05; // m — only removes collinear noise
const AREA_TOLERANCE = 0.3;
const LINE_TOLERANCE = 0.15;
const TREE_CELL = 2.5;
const TREE_LATTICE = 5;
const TREE_CHUNK = 1000;
const MAX_TREES = 650_000;

// ---------------------------------------------------------------- helpers ---

const [sceneMinX, sceneMaxZ] = project(SCENE_BBOX.south, SCENE_BBOX.west);
const [sceneMaxX, sceneMinZ] = project(SCENE_BBOX.north, SCENE_BBOX.east);
const bounds: Bounds = { minX: sceneMinX, maxX: sceneMaxX, minZ: sceneMinZ, maxZ: sceneMaxZ };
const boundsBox: Box = { minX: bounds.minX, minZ: bounds.minZ, maxX: bounds.maxX, maxZ: bounds.maxZ };

const inBounds = (x: number, z: number, margin = 0) =>
  x >= bounds.minX - margin && x <= bounds.maxX + margin && z >= bounds.minZ - margin && z <= bounds.maxZ + margin;

const refOf = (el: OsmElement) => `${el.type}/${el.id}`;

function quantizeRing(ring: Vec2[], tolerance: number): Vec2[] {
  const simplified = tolerance > 0 ? simplifyRing(ring, tolerance) : ring;
  const q = simplified.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)] as Vec2);
  return cleanRing(q, 0.5);
}

function quantizePolygon(polygon: Polygon, tolerance: number): Polygon | null {
  const outer = quantizeRing(polygon[0], tolerance);
  if (outer.length < 3) return null;
  const holes = polygon
    .slice(1)
    .map((ring) => quantizeRing(ring, tolerance))
    .filter((ring) => ring.length >= 3);
  return [outer, ...holes];
}

function pushPolygon(set: PolygonSet, polygon: Polygon): void {
  set.rings.push(polygon.length);
  for (const ring of polygon) {
    set.points.push(ring.length);
    let px = 0;
    let pz = 0;
    ring.forEach(([x, z], i) => {
      if (i === 0) set.coords.push(x, z);
      else set.coords.push(x - px, z - pz);
      px = x;
      pz = z;
    });
  }
}

function pushLine(set: PolylineSet, line: Vec2[]): boolean {
  const q = simplifyLine(line, LINE_TOLERANCE).map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)] as Vec2);
  const clean = q.filter((p, i) => i === 0 || p[0] !== q[i - 1][0] || p[1] !== q[i - 1][1]);
  if (clean.length < 2) return false;
  set.points.push(clean.length);
  let px = 0;
  let pz = 0;
  clean.forEach(([x, z], i) => {
    if (i === 0) set.coords.push(x, z);
    else set.coords.push(x - px, z - pz);
    px = x;
    pz = z;
  });
  return true;
}

function lineBox(line: Vec2[]): Box {
  return ringBox(line);
}

function largestPolygon(polygons: Polygon[]): Polygon {
  return polygons.reduce((best, p) => (polygonArea(p) > polygonArea(best) ? p : best), polygons[0]);
}

/** Smooth value noise in [0, 1] for organic tree clustering. */
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h = (i: number, j: number) => hash01(Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * u;
  const b = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * u;
  return a + (b - a) * v;
}

// ------------------------------------------------------------------ load ---

console.time("load");
const buildingEls = loadLayer(RAW_DIR, "buildings_");
const transportEls = loadLayer(RAW_DIR, "transport_");
const areaEls = loadLayer(RAW_DIR, "areas_");
const districtEls = loadLayer(RAW_DIR, "districts");
const byRef = new Map<string, OsmElement>();
for (const el of [...buildingEls, ...transportEls, ...areaEls]) byRef.set(refOf(el), el);
const meta = existsSync(join(RAW_DIR, "_meta.json"))
  ? (JSON.parse(readFileSync(join(RAW_DIR, "_meta.json"), "utf8")) as { fetchedAt: string })
  : { fetchedAt: "unknown" };
console.timeEnd("load");

// ------------------------------------------------------------- districts ---

console.time("districts");
const districtRaster = new Raster(bounds, 20);
const districtDefs = (Object.keys(DISTRICT_RELATIONS) as (keyof typeof DISTRICT_RELATIONS)[]).map((id, index) => {
  const el = districtEls.find((e) => e.type === "relation" && e.id === DISTRICT_RELATIONS[id]);
  const polygons = el ? elementPolygons(el).map((p) => p.map((ring) => simplifyRing(ring, 2))) : [];
  if (!polygons.length) console.warn(`  district ${id}: no geometry`);
  for (const polygon of polygons) districtRaster.fillPolygon(polygon, index + 1);
  return { id, index, polygons, sumX: 0, sumZ: 0, count: 0 };
});
console.timeEnd("districts");

// ------------------------------------------------------------- landmarks ---

const landmarks: Record<string, LandmarkAnchor> = {};
const excludedRefs = new Set<string>();
/** Footprints whose inner buildings/parts are removed (custom model sits there). */
const replaceZones: Polygon[] = [];
/** Footprints whose inner building:parts are removed (custom crown on top). */
const baseZones: Polygon[] = [];
const baseOverrides = new Map<string, number>();

for (const def of LANDMARKS) {
  const el = def.osm.map((ref) => byRef.get(ref)).find((e): e is OsmElement => !!e);
  let anchor: LandmarkAnchor | null = null;
  if (el && el.type !== "node") {
    const polygons = elementPolygons(el);
    if (polygons.length) {
      const outer = largestPolygon(polygons)[0];
      const [cx, cz] = ringCentroid(outer);
      const radius = Math.max(...outer.map(([x, z]) => Math.hypot(x - cx, z - cz)));
      const box = orientedBox(outer);
      anchor = { id: def.id, x: cx, z: cz, radius, rotation: box.rotation, length: box.length, width: box.width };
      if (def.mode === "replace") replaceZones.push(largestPolygon(polygons));
      if (def.mode === "base") baseZones.push(largestPolygon(polygons));
    }
  } else if (el && el.type === "node") {
    const [x, z] = project(el.lat, el.lon);
    anchor = { id: def.id, x, z, radius: 12, rotation: 0, length: 24, width: 24 };
  } else if (def.fallback) {
    const [x, z] = project(def.fallback.lat, def.fallback.lon);
    anchor = { id: def.id, x, z, radius: 12, rotation: 0, length: 24, width: 24 };
  }
  if (!anchor) {
    console.warn(`  landmark ${def.id}: not found in OSM layers`);
    continue;
  }
  landmarks[def.id] = anchor;
  if (def.mode === "replace") def.osm.forEach((ref) => excludedRefs.add(ref));
  if (def.mode === "base" && def.baseHeight) baseOverrides.set(def.osm[0], def.baseHeight);
}

// ------------------------------------------------------------- buildings ---

console.time("buildings");
type Candidate = {
  el: OsmElement;
  tags: Tags;
  polygons: Polygon[];
  isPart: boolean;
  area: number;
  cx: number;
  cz: number;
  box: Box;
  hasParts: boolean;
};

const insideZone = (zones: Polygon[], x: number, z: number) => zones.some((zone) => pointInPolygon(x, z, zone));

const candidates: Candidate[] = [];
for (const el of buildingEls) {
  const tags = el.tags ?? {};
  const isPart = !!tags["building:part"] && tags["building:part"] !== "no";
  const isBuilding = !!tags.building && tags.building !== "no";
  if (!isPart && !isBuilding) continue;
  if (tags.location === "underground" || tags.building === "underground") continue;
  if (excludedRefs.has(refOf(el))) continue;
  const polygons = elementPolygons(el);
  if (!polygons.length) continue;
  const area = polygons.reduce((s, p) => s + polygonArea(p), 0);
  if (area < 2) continue;
  const [cx, cz] = ringCentroid(largestPolygon(polygons)[0]);
  if (!inBounds(cx, cz)) continue;
  if (insideZone(replaceZones, cx, cz)) continue;
  if (isPart && !baseOverrides.has(refOf(el)) && insideZone(baseZones, cx, cz)) continue;
  candidates.push({ el, tags, polygons, isPart, area, cx, cz, box: ringBox(largestPolygon(polygons)[0]), hasParts: false });
}

// Simple 3D Buildings: an outline that contains building:parts is not rendered.
const GRID = 100;
const outlineGrid = new Map<string, Candidate[]>();
for (const c of candidates) {
  if (c.isPart) continue;
  for (let gx = Math.floor(c.box.minX / GRID); gx <= Math.floor(c.box.maxX / GRID); gx++) {
    for (let gz = Math.floor(c.box.minZ / GRID); gz <= Math.floor(c.box.maxZ / GRID); gz++) {
      const key = `${gx}:${gz}`;
      const list = outlineGrid.get(key);
      if (list) list.push(c);
      else outlineGrid.set(key, [c]);
    }
  }
}
for (const part of candidates) {
  if (!part.isPart) continue;
  const list = outlineGrid.get(`${Math.floor(part.cx / GRID)}:${Math.floor(part.cz / GRID)}`) ?? [];
  for (const outline of list) {
    if (!outline.hasParts && pointInPolygon(part.cx, part.cz, outline.polygons[0])) outline.hasParts = true;
  }
}

const buildings: BuildingsFile = {
  version: CITY_DATA_VERSION,
  count: 0,
  id: [],
  height: [],
  minHeight: [],
  kind: [],
  roof: [],
  roofHeight: [],
  flags: [],
  district: [],
  rings: [],
  points: [],
  coords: [],
};
let estimatedCount = 0;
let partCount = 0;
const buildingFootprints: Polygon[] = [];

for (const c of candidates) {
  if (!c.isPart && c.hasParts) continue;
  const kind = buildingKind(c.tags);
  const info = buildingHeight(c.el.id, c.tags, kind, c.area);
  let flags = 0;
  const override = baseOverrides.get(refOf(c.el));
  if (override !== undefined) {
    info.height = override;
    info.minHeight = 0;
    info.estimated = false;
    info.roofHeight = 0;
    info.roof = 0;
    flags |= BuildingFlag.LandmarkBase;
  }
  if (info.estimated) flags |= BuildingFlag.EstimatedHeight;
  if (c.isPart) flags |= BuildingFlag.Part;
  const districtIndex = districtRaster.get(c.cx, c.cz) - 1;

  for (const polygon of c.polygons) {
    const q = quantizePolygon(polygon, BUILDING_TOLERANCE);
    if (!q) continue;
    pushPolygon(buildings, q);
    buildings.id.push(c.el.type === "relation" ? -c.el.id : c.el.id);
    buildings.height.push(Math.round(info.height * 10));
    buildings.minHeight.push(Math.round(info.minHeight * 10));
    buildings.kind.push(kind);
    buildings.roof.push(info.roof);
    buildings.roofHeight.push(Math.round(info.roofHeight * 10));
    buildings.flags.push(flags);
    buildings.district.push(districtIndex >= 0 ? districtIndex : 255);
    buildings.count++;
    buildingFootprints.push(polygon);
  }
  if (info.estimated) estimatedCount++;
  if (c.isPart) partCount++;
  if (districtIndex >= 0 && !c.isPart) {
    const d = districtDefs[districtIndex];
    d.sumX += c.cx;
    d.sumZ += c.cz;
    d.count++;
  }
}
console.timeEnd("buildings");

// ----------------------------------------------------------------- areas ---

console.time("areas");
type AreaItem = { kind: AreaKind; polygon: Polygon };
const areaItems: AreaItem[] = [];
for (const el of [...areaEls, ...transportEls]) {
  if (el.type === "node") continue;
  const kind = areaKind(el.tags ?? {});
  if (kind === null) continue;
  for (const polygon of elementPolygons(el)) {
    if (!boxesIntersect(ringBox(polygon[0]), boundsBox)) continue;
    areaItems.push({ kind, polygon });
  }
}
areaItems.sort((a, b) => a.kind - b.kind);
const ground: GroundFile = {
  version: CITY_DATA_VERSION,
  areas: { kind: [], rings: [], points: [], coords: [] },
  roads: { cls: [], width: [], flags: [], points: [], coords: [] },
  rails: { kind: [], flags: [], points: [], coords: [] },
};
for (const item of areaItems) {
  const tolerance = item.kind === AreaKind.Water || item.kind >= AreaKind.Playground ? 0.15 : AREA_TOLERANCE;
  const q = quantizePolygon(item.polygon, tolerance);
  if (!q) continue;
  pushPolygon(ground.areas, q);
  ground.areas.kind.push(item.kind);
}
console.timeEnd("areas");

// ----------------------------------------------------------------- roads ---

console.time("roads");
type LineItem = { line: Vec2[]; width: number; cls: number };
const roadLines: LineItem[] = [];
const railLines: Vec2[][] = [];
for (const el of transportEls) {
  if (el.type !== "way") continue;
  const tags = el.tags ?? {};
  const road = roadInfo(tags);
  const rail = road ? null : railInfo(tags);
  if (!road && !rail) continue;
  const line = wayLine(el);
  if (line.length < 2 || !boxesIntersect(lineBox(line), boundsBox)) continue;
  if (road) {
    const flags = (road.bridge ? RoadFlag.Bridge : 0) | (road.oneway ? RoadFlag.Oneway : 0) | (road.sidewalk ? RoadFlag.Sidewalk : 0);
    if (pushLine(ground.roads, line)) {
      ground.roads.cls.push(road.cls);
      ground.roads.width.push(Math.round(road.width * 10));
      ground.roads.flags.push(flags);
      roadLines.push({ line, width: road.width, cls: road.cls });
    }
  } else if (rail) {
    if (pushLine(ground.rails, line)) {
      ground.rails.kind.push(rail.kind);
      ground.rails.flags.push(rail.bridge ? RailFlag.Bridge : 0);
      railLines.push(line);
    }
  }
}
console.timeEnd("roads");

// ----------------------------------------------------------------- trees ---

console.time("trees");
const BLOCK_BUILDING = 1;
const BLOCK_WATER = 2;
const BLOCK_OTHER = 3;
const green = new Raster(bounds, TREE_CELL);
const blocked = new Raster(bounds, TREE_CELL);

const GREEN_ORDER: AreaKind[] = [AreaKind.Grass, AreaKind.Cemetery, AreaKind.Scrub, AreaKind.Park, AreaKind.Forest];
for (const kind of GREEN_ORDER) {
  for (const item of areaItems) if (item.kind === kind) green.fillPolygon(item.polygon, kind);
}
const BLOCKING_AREAS = new Set<AreaKind>([AreaKind.Pitch, AreaKind.Parking, AreaKind.Plaza, AreaKind.Playground, AreaKind.Bridge, AreaKind.Sand, AreaKind.Rail]);
for (const item of areaItems) {
  if (item.kind === AreaKind.Water) blocked.fillPolygon(item.polygon, BLOCK_WATER);
  else if (BLOCKING_AREAS.has(item.kind)) blocked.fillPolygon(item.polygon, BLOCK_OTHER);
}
for (const { line, width, cls } of roadLines) blocked.stampLine(line, width / 2 + (cls === RoadClass.Path ? 0.6 : 1.2), BLOCK_OTHER);
for (const line of railLines) blocked.stampLine(line, 3, BLOCK_OTHER);
for (const polygon of buildingFootprints) {
  blocked.fillPolygon(polygon, BLOCK_BUILDING);
  for (const ring of polygon) blocked.stampLine([...ring, ring[0]], 1.4, BLOCK_BUILDING);
}

/** Keep probability per 5 m lattice node (25 m²). */
const DENSITY: Partial<Record<AreaKind, number>> = {
  [AreaKind.Forest]: 0.3,
  [AreaKind.Park]: 0.4,
  [AreaKind.Scrub]: 0.3,
  [AreaKind.Cemetery]: 0.22,
  [AreaKind.Grass]: 0.06,
};
const CONIFER: Partial<Record<AreaKind, number>> = {
  [AreaKind.Forest]: 0.32,
  [AreaKind.Park]: 0.16,
  [AreaKind.Cemetery]: 0.4,
};

type Tree = { x: number; z: number; h: number; v: number };
const trees: Tree[] = [];
const cols = Math.floor((bounds.maxX - bounds.minX) / TREE_LATTICE);
const rows = Math.floor((bounds.maxZ - bounds.minZ) / TREE_LATTICE);
for (let j = 0; j < rows; j++) {
  for (let i = 0; i < cols; i++) {
    const seed = Math.imul(i + 1, 92837111) ^ Math.imul(j + 1, 689287499);
    const x = bounds.minX + (i + 0.5 + (hash01(seed) - 0.5) * 0.9) * TREE_LATTICE;
    const z = bounds.minZ + (j + 0.5 + (hash01(seed ^ 0x5bd1e995) - 0.5) * 0.9) * TREE_LATTICE;
    const kind = green.get(x, z) as AreaKind;
    if (!kind || blocked.get(x, z)) continue;
    let p = DENSITY[kind] ?? 0;
    if (kind === AreaKind.Park || kind === AreaKind.Grass) {
      const n = valueNoise(x / 42, z / 42) * 0.65 + valueNoise(x / 13, z / 13) * 0.35;
      p *= 0.2 + 1.6 * Math.min(1, Math.max(0, (n - 0.32) / 0.4));
    }
    if (hash01(seed ^ 0x27d4eb2f) >= p) continue;
    const conifer = hash01(seed ^ 0x165667b1) < (CONIFER[kind] ?? 0.1);
    const r = hash01(seed ^ 0x61c88647);
    const h = kind === AreaKind.Scrub ? 3 + r * 2.5 : conifer ? 9 + r * 7 : kind === AreaKind.Forest ? 10 + r * 6 : 6.5 + r * 5.5;
    trees.push({ x, z, h, v: conifer ? 1 : 0 });
  }
}
const scatteredCount = trees.length;

// Individually mapped trees and tree rows keep their surveyed positions.
let mappedCount = 0;
for (const el of areaEls) {
  const tags = el.tags ?? {};
  if (el.type === "node" && tags.natural === "tree") {
    const [x, z] = project(el.lat, el.lon);
    const b = blocked.get(x, z);
    if (!inBounds(x, z) || b === BLOCK_BUILDING || b === BLOCK_WATER) continue;
    const r = hash01(el.id);
    const conifer = tags.leaf_type === "needleleaved";
    trees.push({ x, z, h: parseMeters(tags.height) ?? (conifer ? 9 + r * 5 : 6 + r * 5), v: conifer ? 1 : 0 });
    mappedCount++;
  } else if (el.type === "way" && tags.natural === "tree_row") {
    const line = wayLine(el);
    const conifer = tags.leaf_type === "needleleaved";
    for (let k = 0; k + 1 < line.length; k++) {
      const [ax, az] = line[k];
      const [bx, bz] = line[k + 1];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 6.5));
      for (let s = 0; s < n; s++) {
        const x = ax + ((bx - ax) * s) / n;
        const z = az + ((bz - az) * s) / n;
        const b = blocked.get(x, z);
        if (!inBounds(x, z) || b === BLOCK_BUILDING || b === BLOCK_WATER) continue;
        const r = hash01(Math.imul(el.id, 31) + k * 1009 + s);
        trees.push({ x, z, h: conifer ? 8 + r * 5 : 6 + r * 4.5, v: conifer ? 1 : 0 });
        mappedCount++;
      }
    }
  }
}

let finalTrees = trees;
if (trees.length > MAX_TREES) {
  const keep = (MAX_TREES - (trees.length - scatteredCount)) / scatteredCount;
  finalTrees = trees.filter((_, i) => i >= scatteredCount || hash01(i * 7919) < keep);
}

// Group into chunks, shuffle inside each chunk (prefix = uniform subset for LOD).
const chunkMap = new Map<string, Tree[]>();
for (const t of finalTrees) {
  const cx = Math.floor((t.x - bounds.minX) / TREE_CHUNK);
  const cz = Math.floor((t.z - bounds.minZ) / TREE_CHUNK);
  const key = `${cx}:${cz}`;
  const list = chunkMap.get(key);
  if (list) list.push(t);
  else chunkMap.set(key, [t]);
}
const treeChunks: TreeChunk[] = [];
const treeBuffer = Buffer.alloc(finalTrees.length * TREE_RECORD_BYTES);
let record = 0;
for (const [key, list] of [...chunkMap.entries()].sort()) {
  const [cx, cz] = key.split(":").map(Number);
  const originX = bounds.minX + cx * TREE_CHUNK;
  const originZ = bounds.minZ + cz * TREE_CHUNK;
  const shuffled = list
    .map((t, i) => ({ t, k: hash01(Math.imul(i + 1, 2654435761) ^ Math.imul(cx + 7, 40503) ^ Math.imul(cz + 13, 9973)) }))
    .sort((a, b) => a.k - b.k)
    .map((e) => e.t);
  treeChunks.push({ x: +originX.toFixed(1), z: +originZ.toFixed(1), offset: record, count: shuffled.length });
  for (const t of shuffled) {
    const o = record * TREE_RECORD_BYTES;
    const lx = Math.min(65535, Math.max(0, Math.round(((t.x - originX) / TREE_CHUNK) * 65535)));
    const lz = Math.min(65535, Math.max(0, Math.round(((t.z - originZ) / TREE_CHUNK) * 65535)));
    treeBuffer.writeUInt16LE(lx, o);
    treeBuffer.writeUInt16LE(lz, o + 2);
    treeBuffer.writeUInt8(Math.min(255, Math.max(10, Math.round(t.h * 10))), o + 4);
    const tint = Math.floor(hash01(record * 131 + 17) * 127);
    treeBuffer.writeUInt8((t.v & 1) | (tint << 1), o + 5);
    record++;
  }
}
console.timeEnd("trees");

// ---------------------------------------------------------------- output ---

const districts: DistrictData[] = districtDefs.map((d) => {
  const polygons: PolygonSet = { rings: [], points: [], coords: [] };
  for (const polygon of d.polygons) {
    const q = quantizePolygon(polygon, 3);
    if (q) pushPolygon(polygons, q);
  }
  return {
    id: d.id,
    name: DISTRICT_NAMES[d.id],
    osmRelation: DISTRICT_RELATIONS[d.id],
    center: d.count ? [+(d.sumX / d.count).toFixed(1), +(d.sumZ / d.count).toFixed(1)] : [0, 0],
    buildingCount: d.count,
    polygons,
  };
});

const round1 = (n: number) => Math.round(n * 10) / 10;
const manifest: CityManifest = {
  version: CITY_DATA_VERSION,
  generatedAt: new Date().toISOString(),
  osmFetchedAt: meta.fetchedAt,
  origin: { lat: ORIGIN.lat, lon: ORIGIN.lon },
  bounds: { minX: round1(bounds.minX), maxX: round1(bounds.maxX), minZ: round1(bounds.minZ), maxZ: round1(bounds.maxZ) },
  counts: {
    buildings: buildings.count,
    buildingElements: candidates.filter((c) => c.isPart || !c.hasParts).length,
    buildingParts: partCount,
    estimatedHeights: estimatedCount,
    areas: ground.areas.kind.length,
    roads: ground.roads.cls.length,
    rails: ground.rails.kind.length,
    trees: record,
    treesMapped: mappedCount,
  },
  landmarks: Object.fromEntries(
    Object.entries(landmarks).map(([id, a]) => [
      id,
      { ...a, x: round1(a.x), z: round1(a.z), radius: round1(a.radius), rotation: +a.rotation.toFixed(4), length: round1(a.length), width: round1(a.width) },
    ]),
  ),
  districts,
  files: { buildings: "buildings.json", ground: "ground.json" },
  trees: { file: "trees.bin", chunkSize: TREE_CHUNK, count: record, chunks: treeChunks },
  attribution: "© OpenStreetMap contributors, ODbL",
};

mkdirSync(OUT_DIR, { recursive: true });
const write = (name: string, data: unknown) => {
  const file = join(OUT_DIR, name);
  writeFileSync(file, JSON.stringify(data));
  return `${name} ${(statSync(file).size / 1e6).toFixed(2)} MB`;
};
writeFileSync(join(OUT_DIR, "trees.bin"), treeBuffer);
console.log(
  [write("buildings.json", buildings), write("ground.json", ground), write("manifest.json", manifest)].join(" · "),
  `· trees.bin ${(treeBuffer.length / 1e6).toFixed(2)} MB`,
);
console.log("counts", manifest.counts);
console.log(
  "districts",
  districts.map((d) => `${d.name}: ${d.buildingCount}`),
);
console.log("landmarks", Object.keys(landmarks).join(", "));
console.log(`trees: ${scatteredCount} scattered + ${mappedCount} mapped → ${record} in ${treeChunks.length} chunks`);
console.log(
  "kinds",
  Object.entries(BuildingKind)
    .map(([name, k]) => `${name}:${buildings.kind.filter((v) => v === k).length}`)
    .join(" "),
);
