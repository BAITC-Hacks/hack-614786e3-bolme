/**
 * Reading raw Overpass JSON (`out geom`) and assembling OSM geometry.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanRing, orientPolygon, pointInRing, project, type LatLon, type Polygon, type Ring, type Vec2 } from "./geo";

export type Tags = Record<string, string>;

export type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Tags };
export type OsmWay = { type: "way"; id: number; nodes?: number[]; geometry?: (LatLon | null)[]; tags?: Tags };
export type OsmMember = { type: "node" | "way" | "relation"; ref: number; role: string; geometry?: (LatLon | null)[] };
export type OsmRelation = { type: "relation"; id: number; members?: OsmMember[]; tags?: Tags };
export type OsmElement = OsmNode | OsmWay | OsmRelation;

/** Loads all raw files whose name starts with `prefix`, de-duplicated by element. */
export function loadLayer(dir: string, prefix: string): OsmElement[] {
  const seen = new Map<string, OsmElement>();
  const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
  if (!files.length) throw new Error(`No raw OSM files for "${prefix}" in ${dir}. Run npm run city:fetch first.`);
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as { elements: OsmElement[] };
    for (const el of data.elements) seen.set(`${el.type}/${el.id}`, el);
  }
  return [...seen.values()];
}

function validPoints(geometry: (LatLon | null)[] | undefined): LatLon[] {
  return (geometry ?? []).filter((p): p is LatLon => p !== null && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

export function wayLine(way: OsmWay): Vec2[] {
  return validPoints(way.geometry).map((p) => project(p.lat, p.lon));
}

function isClosed(points: LatLon[]): boolean {
  if (points.length < 4) return false;
  const a = points[0];
  const b = points[points.length - 1];
  return a.lat === b.lat && a.lon === b.lon;
}

const same = (a: LatLon, b: LatLon) => a.lat === b.lat && a.lon === b.lon;

/** Joins way segments end-to-end into closed rings (exact coordinate matching). */
export function assembleRings(segments: LatLon[][]): LatLon[][] {
  const rings: LatLon[][] = [];
  const open: LatLon[][] = [];
  for (const segment of segments) {
    if (segment.length < 2) continue;
    if (isClosed(segment)) rings.push(segment);
    else open.push(segment);
  }
  while (open.length) {
    let current = open.pop()!;
    let changed = true;
    while (!isClosed(current) && changed) {
      changed = false;
      for (let i = 0; i < open.length; i++) {
        const s = open[i];
        const head = current[0];
        const tail = current[current.length - 1];
        if (same(tail, s[0])) current = current.concat(s.slice(1));
        else if (same(tail, s[s.length - 1])) current = current.concat(s.slice(0, -1).reverse());
        else if (same(head, s[s.length - 1])) current = s.concat(current.slice(1));
        else if (same(head, s[0])) current = [...s].reverse().concat(current.slice(1));
        else continue;
        open.splice(i, 1);
        changed = true;
        break;
      }
    }
    if (isClosed(current)) rings.push(current);
  }
  return rings;
}

function toRing(points: LatLon[]): Ring {
  return cleanRing(points.map((p) => project(p.lat, p.lon)));
}

/** Polygons (outer + holes) for a closed way or a multipolygon relation. */
export function elementPolygons(el: OsmElement): Polygon[] {
  if (el.type === "way") {
    const points = validPoints(el.geometry);
    if (!isClosed(points)) return [];
    const ring = toRing(points);
    return ring.length >= 3 ? [orientPolygon([ring])] : [];
  }
  if (el.type !== "relation") return [];
  const members = el.members ?? [];
  const outerSegs: LatLon[][] = [];
  const innerSegs: LatLon[][] = [];
  for (const m of members) {
    if (m.type !== "way") continue;
    const pts = validPoints(m.geometry);
    if (m.role === "inner") innerSegs.push(pts);
    else if (m.role === "outer" || m.role === "" || m.role === "outline") outerSegs.push(pts);
  }
  const outers = assembleRings(outerSegs).map(toRing).filter((r) => r.length >= 3);
  const inners = assembleRings(innerSegs).map(toRing).filter((r) => r.length >= 3);
  const polygons: Polygon[] = outers.map((outer) => [outer]);
  for (const inner of inners) {
    const [x, z] = inner[0];
    const owner = polygons.find((poly) => pointInRing(x, z, poly[0]));
    if (owner) owner.push(inner);
  }
  return polygons.map(orientPolygon);
}

export function tag(el: OsmElement, key: string): string | undefined {
  return el.tags?.[key];
}
