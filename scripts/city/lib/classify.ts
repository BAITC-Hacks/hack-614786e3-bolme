/**
 * OSM tags → scene semantics: building heights, area kinds, road widths.
 *
 * Heights follow Simple 3D Buildings: `height` (m) wins, then
 * `building:levels`; only when both are missing an explicit estimate from the
 * building type and footprint area is used (and flagged as estimated).
 */
import { AreaKind, BuildingAccent, BuildingKind, RailKind, RoadClass, RoofShape } from "../../../src/city/schema";
import { hash01 } from "./geo";
import type { Tags } from "./osm";

const LEVEL_HEIGHT = 3.0;
const PARAPET = 1.0;

export function parseMeters(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  let n = parseFloat(match[0]);
  if (/ft|'/.test(value)) n *= 0.3048;
  return Number.isFinite(n) ? n : undefined;
}

/** "9", "9;16", "5-9" → the largest number. */
export function parseLevels(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const nums = value.match(/\d+(\.\d+)?/g)?.map(Number).filter(Number.isFinite);
  return nums?.length ? Math.max(...nums) : undefined;
}

const HOUSE = new Set(["house", "detached", "semidetached_house", "terrace", "bungalow", "cabin", "farm", "hut", "static_caravan", "villa"]);
const SMALL = new Set(["garage", "garages", "shed", "carport", "kiosk", "toilets", "service", "container", "guardhouse", "gatehouse", "booth", "shelter", "transformer_tower", "bunker"]);
const APARTMENTS = new Set(["apartments", "residential", "dormitory"]);
const COMMERCIAL = new Set(["commercial", "retail", "office", "supermarket", "mall", "hotel", "shop", "bank"]);
const INDUSTRIAL = new Set(["industrial", "warehouse", "hangar", "factory", "manufacture", "storage_tank", "silo", "greenhouse", "boiler_house"]);
const PUBLIC = new Set(["public", "government", "civic", "townhall", "courthouse", "embassy", "museum", "theatre", "library", "fire_station", "police"]);
const EDUCATION = new Set(["school", "kindergarten", "college", "university"]);
const HEALTH = new Set(["hospital", "clinic"]);
const RELIGIOUS = new Set(["mosque", "church", "cathedral", "temple", "chapel", "synagogue", "religious"]);
const SPORT = new Set(["stadium", "sports_hall", "sports_centre", "grandstand", "riding_hall"]);
const TRANSPORT = new Set(["train_station", "transportation", "parking"]);

export function buildingAccent(kind: BuildingKind, height: number, estimated: boolean): BuildingAccent {
  if (!estimated && height >= 90) return BuildingAccent.Glass;
  if (!estimated && height >= 45 && (kind === BuildingKind.Commercial || kind === BuildingKind.Public)) return BuildingAccent.Glass;
  if (kind === BuildingKind.Education) return BuildingAccent.SchoolRoof;
  if (kind === BuildingKind.Health) return BuildingAccent.HealthRoof;
  return BuildingAccent.None;
}

export function buildingKind(tags: Tags): BuildingKind {
  const b = tags.building ?? tags["building:part"] ?? "yes";
  const amenity = tags.amenity ?? "";
  if (HOUSE.has(b)) return BuildingKind.House;
  if (SMALL.has(b)) return BuildingKind.Small;
  if (APARTMENTS.has(b)) return BuildingKind.Apartments;
  if (EDUCATION.has(b) || EDUCATION.has(amenity)) return BuildingKind.Education;
  if (HEALTH.has(b) || HEALTH.has(amenity) || amenity === "doctors") return BuildingKind.Health;
  if (RELIGIOUS.has(b) || amenity === "place_of_worship") return BuildingKind.Religious;
  if (SPORT.has(b) || tags.leisure === "sports_centre" || tags.leisure === "stadium") return BuildingKind.Sport;
  if (TRANSPORT.has(b)) return BuildingKind.Transport;
  if (COMMERCIAL.has(b) || tags.shop) return BuildingKind.Commercial;
  if (INDUSTRIAL.has(b)) return BuildingKind.Industrial;
  if (PUBLIC.has(b) || amenity === "townhall") return BuildingKind.Public;
  return BuildingKind.Other;
}

function pick<T>(options: readonly T[], r: number): T {
  return options[Math.min(options.length - 1, Math.floor(r * options.length))];
}

/** Explicit estimate used only when OSM has neither height nor levels. */
function estimateLevels(kind: BuildingKind, area: number, r: number): number {
  switch (kind) {
    case BuildingKind.House:
      return area > 180 ? (r < 0.5 ? 2 : 1) : r < 0.2 ? 2 : 1;
    case BuildingKind.Apartments:
      if (area < 250) return 2;
      if (area < 700) return pick([5, 5, 9], r);
      return pick([9, 9, 10, 12, 14, 16], r);
    case BuildingKind.Commercial:
      if (area < 300) return r < 0.6 ? 1 : 2;
      if (area < 2000) return pick([2, 3, 4], r);
      return pick([3, 4, 5], r);
    case BuildingKind.Education:
      return area < 1200 ? pick([2, 3], r) : pick([3, 4], r);
    case BuildingKind.Health:
      return area < 800 ? pick([2, 3], r) : pick([4, 5], r);
    case BuildingKind.Public:
      return area < 800 ? pick([2, 3], r) : pick([3, 4, 6], r);
    case BuildingKind.Transport:
      return 3;
    default:
      if (area < 40) return 1;
      if (area < 200) return r < 0.7 ? 1 : 2;
      if (area < 600) return pick([1, 2, 3], r);
      if (area < 2000) return pick([2, 3, 4, 5], r);
      return pick([2, 3, 4], r);
  }
}

export type HeightInfo = { height: number; minHeight: number; estimated: boolean; roof: number; roofHeight: number };

export function buildingHeight(id: number, tags: Tags, kind: BuildingKind, area: number): HeightInfo {
  const r = hash01(id);
  const levels = parseLevels(tags["building:levels"]);
  const roofLevels = parseLevels(tags["roof:levels"]) ?? 0;
  const minLevel = parseLevels(tags["building:min_level"]);
  let height = parseMeters(tags.height);
  let minHeight = parseMeters(tags.min_height) ?? (minLevel !== undefined ? minLevel * LEVEL_HEIGHT : 0);
  let estimated = false;

  if (height === undefined && levels !== undefined) {
    height = levels * LEVEL_HEIGHT + roofLevels * 2.5 + (levels > 0 ? PARAPET : 0);
  }
  const b = tags.building ?? tags["building:part"];
  if (b === "roof" && height === undefined) {
    minHeight = Math.max(minHeight, 3.5);
    height = minHeight + 1;
  }
  if (height === undefined) {
    estimated = true;
    if (kind === BuildingKind.Small) height = 2.6 + r * 0.8;
    else if (kind === BuildingKind.Industrial) height = 6 + r * 6;
    else if (kind === BuildingKind.Religious) height = 12 + r * 8;
    else if (kind === BuildingKind.Sport) height = 10 + r * 8;
    else {
      const lv = estimateLevels(kind, area, r);
      height = lv * LEVEL_HEIGHT + (kind === BuildingKind.House ? 1.4 : PARAPET);
    }
  }
  if (height <= minHeight) height = minHeight + 3;

  const shape = tags["roof:shape"];
  let roof: number = RoofShape.Flat;
  if (shape === "pyramidal" || shape === "cone") roof = RoofShape.Pyramidal;
  else if (shape === "dome" || shape === "onion") roof = RoofShape.Dome;
  let roofHeight = roof === RoofShape.Flat ? 0 : (parseMeters(tags["roof:height"]) ?? 0);
  if (roof !== RoofShape.Flat && roofHeight === 0) {
    roofHeight = Math.min((height - minHeight) * 0.45, Math.sqrt(area) * (roof === RoofShape.Dome ? 0.5 : 0.35));
  }
  roofHeight = Math.min(roofHeight, height - minHeight);
  return { height, minHeight, estimated, roof, roofHeight };
}

/** Returns null for elements that are not rendered as ground polygons. */
export function areaKind(tags: Tags): AreaKind | null {
  const { natural, landuse, leisure, amenity, waterway, water, place, man_made, highway, railway, aeroway } = tags;
  if (tags.building) return null;
  if (natural === "water" || waterway === "riverbank" || water || landuse === "reservoir" || landuse === "basin") return AreaKind.Water;
  if (leisure === "swimming_pool" || amenity === "fountain") return AreaKind.Water;
  if (man_made === "bridge") return AreaKind.Bridge;
  if (landuse === "forest" || natural === "wood") return AreaKind.Forest;
  if (leisure === "park" || leisure === "garden" || leisure === "dog_park" || landuse === "recreation_ground" || landuse === "village_green") return AreaKind.Park;
  if (leisure === "playground") return AreaKind.Playground;
  if (leisure === "track") return AreaKind.Track;
  if (leisure === "pitch" || leisure === "golf_course") return AreaKind.Pitch;
  if (landuse === "cemetery" || amenity === "grave_yard") return AreaKind.Cemetery;
  if (natural === "scrub" || natural === "heath") return AreaKind.Scrub;
  if (landuse === "grass" || landuse === "meadow" || landuse === "flowerbed" || landuse === "orchard" || landuse === "plant_nursery" || natural === "grassland") return AreaKind.Grass;
  if (landuse === "farmland" || landuse === "farmyard" || landuse === "allotments" || landuse === "greenhouse_horticulture" || natural === "wetland") return AreaKind.Farmland;
  if (amenity === "parking" && !["underground", "multi-storey", "rooftop"].includes(tags.parking ?? "")) return AreaKind.Parking;
  if (landuse === "construction" || landuse === "brownfield" || landuse === "landfill" || landuse === "quarry" || natural === "sand" || natural === "beach" || natural === "bare_rock" || natural === "scree") return AreaKind.Sand;
  if (place === "square" || (highway && tags.area === "yes") || railway === "platform" || amenity === "marketplace") return AreaKind.Plaza;
  if (tags["area:highway"] === "footway" || tags["area:highway"] === "pedestrian") return AreaKind.Plaza;
  if (landuse === "railway") return AreaKind.Rail;
  if (landuse === "industrial" || aeroway === "apron") return AreaKind.Industrial;
  return null;
}

const VEHICULAR: Record<string, RoadClass> = {
  motorway: RoadClass.Motorway,
  trunk: RoadClass.Motorway,
  motorway_link: RoadClass.Tertiary,
  trunk_link: RoadClass.Tertiary,
  primary: RoadClass.Primary,
  primary_link: RoadClass.Tertiary,
  secondary: RoadClass.Secondary,
  secondary_link: RoadClass.Tertiary,
  tertiary: RoadClass.Tertiary,
  tertiary_link: RoadClass.Minor,
  unclassified: RoadClass.Minor,
  residential: RoadClass.Minor,
  living_street: RoadClass.Minor,
  road: RoadClass.Minor,
  busway: RoadClass.Minor,
  service: RoadClass.Service,
  track: RoadClass.Track,
  pedestrian: RoadClass.Pedestrian,
  footway: RoadClass.Path,
  path: RoadClass.Path,
  cycleway: RoadClass.Path,
  steps: RoadClass.Path,
  bridleway: RoadClass.Path,
};

/** Default carriageway width (m) for two-way / one-way roads. */
const DEFAULT_WIDTH: Record<number, [number, number]> = {
  [RoadClass.Motorway]: [22, 12],
  [RoadClass.Primary]: [16, 10],
  [RoadClass.Secondary]: [13, 8],
  [RoadClass.Tertiary]: [10, 6.5],
  [RoadClass.Minor]: [6.5, 4.5],
  [RoadClass.Service]: [4, 3.5],
  [RoadClass.Track]: [3.5, 3],
  [RoadClass.Pedestrian]: [5, 5],
  [RoadClass.Path]: [2, 2],
};

export type RoadInfo = { cls: RoadClass; width: number; bridge: boolean; oneway: boolean; sidewalk: boolean };

export function roadInfo(tags: Tags): RoadInfo | null {
  const hw = tags.highway;
  if (!hw || tags.area === "yes") return null;
  const cls = VEHICULAR[hw];
  if (cls === undefined) return null;
  if (tags.tunnel && tags.tunnel !== "no") return null;
  if (tags.indoor === "yes" || tags.location === "underground") return null;
  const layer = parseFloat(tags.layer ?? "0");
  if (layer < 0 && tags.bridge !== "yes") return null;
  const oneway = tags.oneway === "yes" || tags.oneway === "1" || tags.junction === "roundabout" || hw === "motorway";
  let width = parseMeters(tags.width);
  if (width !== undefined && (width < 1 || width > 60)) width = undefined;
  const lanes = parseLevels(tags.lanes);
  if (width === undefined && lanes !== undefined && cls <= RoadClass.Minor) width = lanes * 3.4 + (oneway ? 0.6 : 1);
  if (width === undefined) {
    const [two, one] = DEFAULT_WIDTH[cls];
    width = oneway ? one : two;
    if (hw === "service" && tags.service === "driveway") width = 3.2;
  }
  const bridge = !!tags.bridge && tags.bridge !== "no";
  const sidewalk = cls === RoadClass.Path && (tags.footway === "sidewalk" || tags.footway === "crossing");
  return { cls, width, bridge, oneway, sidewalk };
}

export type RailInfo = { kind: number; bridge: boolean };

export function railInfo(tags: Tags): RailInfo | null {
  const r = tags.railway;
  if (!r) return null;
  if (tags.tunnel && tags.tunnel !== "no") return null;
  let kind: number;
  if (r === "light_rail" || r === "monorail" || r === "subway") kind = RailKind.LightRail;
  else if (r === "tram") kind = RailKind.Tram;
  else if (r === "rail" || r === "narrow_gauge") kind = RailKind.Rail;
  else if (r === "construction" && /light_rail|subway/.test(tags.construction ?? "")) kind = RailKind.LightRail;
  else return null;
  return { kind, bridge: !!tags.bridge && tags.bridge !== "no" };
}
