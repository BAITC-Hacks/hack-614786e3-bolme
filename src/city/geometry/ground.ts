/**
 * Ground layers: land-use polygons, road network (casing + asphalt +
 * markings), paths, rails, bridge parapets and the elevated LRT viaduct.
 */
import type { BufferGeometry } from "three";
import { forEachPolygon, forEachPolyline } from "../decode";
import { AreaKind, RailFlag, RailKind, RoadClass, RoadFlag, type GroundFile } from "../schema";
import { addPillar, addRibbon, addWall, offsetPolyline } from "./ribbon";
import { triangulate } from "./triangulate";
import { MeshWriter } from "./writer";

export type GroundLayers = {
  areas: Map<AreaKind, BufferGeometry>;
  paths: BufferGeometry | null;
  pedestrian: BufferGeometry | null;
  tracks: BufferGeometry | null;
  casing: BufferGeometry | null;
  asphalt: BufferGeometry | null;
  markings: BufferGeometry | null;
  railBed: BufferGeometry | null;
  railTrack: BufferGeometry | null;
  /** 3D (depth-tested) structures. */
  parapets: BufferGeometry | null;
  viaduct: BufferGeometry | null;
  viaductTrack: BufferGeometry | null;
};

/** Kerb (sidewalk edge) width per side for each vehicular class, metres. */
const CURB: Record<number, number> = {
  [RoadClass.Motorway]: 1.6,
  [RoadClass.Primary]: 1.4,
  [RoadClass.Secondary]: 1.2,
  [RoadClass.Tertiary]: 1.0,
  [RoadClass.Minor]: 0.8,
  [RoadClass.Service]: 0.45,
};

export const VIADUCT = { deckBottom: 7.2, deckTop: 8.6, halfWidth: 4.4, pillarSpacing: 32, pillarHalf: 0.9 } as const;

const orNull = (w: MeshWriter) => (w.isEmpty ? null : w.toGeometry());

export function buildGroundLayers(data: GroundFile): GroundLayers {
  // Areas grouped by kind.
  const areaWriters = new Map<AreaKind, MeshWriter>();
  forEachPolygon(data.areas, (i, rings) => {
    const kind = data.areas.kind[i] as AreaKind;
    let w = areaWriters.get(kind);
    if (!w) {
      w = new MeshWriter();
      areaWriters.set(kind, w);
    }
    const { vertices, indices } = triangulate(rings);
    const start = w.vertexCount;
    for (let k = 0; k < vertices.length; k += 2) w.vertex(vertices[k], 0, vertices[k + 1], 0, 1, 0);
    for (let t = 0; t < indices.length; t += 3) w.triangle(start + indices[t], start + indices[t + 1], start + indices[t + 2]);
  });
  const areas = new Map<AreaKind, BufferGeometry>();
  for (const [kind, w] of areaWriters) if (!w.isEmpty) areas.set(kind, w.toGeometry());

  const dist = [{ name: "lineDistance", itemSize: 1, type: "f32" as const }];
  // Roads keep a minimum on-screen width (see createLayerMaterial minPixels).
  const expand = [{ name: "aExpand", itemSize: 2, type: "f32" as const }];
  const paths = new MeshWriter();
  const pedestrian = new MeshWriter();
  const tracks = new MeshWriter(expand);
  const casing = new MeshWriter(expand);
  const asphalt = new MeshWriter(expand);
  const markings = new MeshWriter(dist);
  const parapets = new MeshWriter();

  forEachPolyline(data.roads, (i, pts) => {
    const cls = data.roads.cls[i];
    const width = data.roads.width[i] / 10;
    const flags = data.roads.flags[i];
    const half = width / 2;
    if (cls === RoadClass.Path) {
      addRibbon(paths, pts, Math.max(0.9, half), 0, 0.4);
      return;
    }
    if (cls === RoadClass.Pedestrian) {
      addRibbon(pedestrian, pts, half, 0, half);
      return;
    }
    if (cls === RoadClass.Track) {
      addRibbon(tracks, pts, half, 0, 0, "expand");
      return;
    }
    const curb = CURB[cls] ?? 0.5;
    addRibbon(casing, pts, half + curb, 0, half + curb, "expand");
    addRibbon(asphalt, pts, half, 0, half, "expand");
    if (cls <= RoadClass.Tertiary && width >= 7.5) addRibbon(markings, pts, 0.16, 0, 0);
    if (flags & RoadFlag.Bridge) {
      const edge = half + curb;
      addWall(parapets, offsetPolyline(pts, edge), 0.28, 0, 1.15);
      addWall(parapets, offsetPolyline(pts, -edge), 0.28, 0, 1.15);
    }
  });

  const railBed = new MeshWriter();
  const railTrack = new MeshWriter(expand);
  const viaduct = new MeshWriter();
  const viaductTrack = new MeshWriter();
  forEachPolyline(data.rails, (i, pts) => {
    const kind = data.rails.kind[i];
    const elevated = kind === RailKind.LightRail && (data.rails.flags[i] & RailFlag.Bridge) !== 0;
    if (!elevated) {
      addRibbon(railBed, pts, 1.9, 0, 0);
      addRibbon(railTrack, pts, 0.8, 0, 0, "expand");
      return;
    }
    addWall(viaduct, pts, VIADUCT.halfWidth, VIADUCT.deckBottom, VIADUCT.deckTop, true);
    addWall(viaduct, offsetPolyline(pts, VIADUCT.halfWidth - 0.2), 0.2, VIADUCT.deckTop, VIADUCT.deckTop + 1.0);
    addWall(viaduct, offsetPolyline(pts, -(VIADUCT.halfWidth - 0.2)), 0.2, VIADUCT.deckTop, VIADUCT.deckTop + 1.0);
    addRibbon(viaductTrack, offsetPolyline(pts, 1.9), 0.85, VIADUCT.deckTop + 0.03, 0);
    addRibbon(viaductTrack, offsetPolyline(pts, -1.9), 0.85, VIADUCT.deckTop + 0.03, 0);
    // Pillars at a fixed spacing along the line.
    let carry = VIADUCT.pillarSpacing / 2;
    for (let k = 0; k + 1 < pts.length / 2; k++) {
      const ax = pts[k * 2];
      const az = pts[k * 2 + 1];
      const dx = pts[k * 2 + 2] - ax;
      const dz = pts[k * 2 + 3] - az;
      const len = Math.hypot(dx, dz);
      let s = carry;
      while (s < len) {
        addPillar(viaduct, ax + (dx * s) / len, az + (dz * s) / len, VIADUCT.pillarHalf, 0, VIADUCT.deckBottom);
        s += VIADUCT.pillarSpacing;
      }
      carry = s - len;
    }
  });

  return {
    areas,
    paths: orNull(paths),
    pedestrian: orNull(pedestrian),
    tracks: orNull(tracks),
    casing: orNull(casing),
    asphalt: orNull(asphalt),
    markings: orNull(markings),
    railBed: orNull(railBed),
    railTrack: orNull(railTrack),
    parapets: orNull(parapets),
    viaduct: orNull(viaduct),
    viaductTrack: orNull(viaductTrack),
  };
}
