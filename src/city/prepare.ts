/**
 * One-time preparation of the city: download baked data and build GPU
 * geometry outside React rendering. Cached per page load so StrictMode
 * double-mounts and remounts reuse the same result.
 */
import { buildBuildingChunks, type BuildingChunk, type BuildingStats } from "./geometry/buildings";
import { buildGroundLayers, type GroundLayers } from "./geometry/ground";
import { loadCityData } from "./loader";
import { buildRailNetwork, buildRoadNetwork, type PathNetwork } from "./geometry/traffic";
import type { CityManifest } from "./schema";

export type PreparedCity = {
  manifest: CityManifest;
  buildingChunks: BuildingChunk[];
  buildingStats: BuildingStats;
  ground: GroundLayers;
  /** Arterial road and LRT graphs for decorative traffic. */
  traffic: { roads: PathNetwork; rails: PathNetwork };
};

export type PrepareProgress = (fraction: number, stage: string) => void;

const BUILDING_CHUNK_SIZE = 1200;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

let cached: Promise<PreparedCity> | null = null;

export function prepareCity(onProgress: PrepareProgress): Promise<PreparedCity> {
  if (!cached) {
    cached = run(onProgress).catch((error: unknown) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

async function run(onProgress: PrepareProgress): Promise<PreparedCity> {
  onProgress(0.02, "Загружаем карту Астаны");
  const data = await loadCityData((f) => onProgress(f * 0.6, "Загружаем карту Астаны"));
  onProgress(0.62, "Прокладываем улицы и набережные");
  await nextFrame();
  const ground = buildGroundLayers(data.ground);
  onProgress(0.78, `Возводим ${data.buildings.count.toLocaleString("ru-RU")} зданий`);
  await nextFrame();
  const { chunks, stats } = buildBuildingChunks(data.buildings, BUILDING_CHUNK_SIZE);
  onProgress(0.92, "Выпускаем машины на проспекты");
  await nextFrame();
  const traffic = { roads: buildRoadNetwork(data.ground), rails: buildRailNetwork(data.ground) };
  onProgress(0.97, "Зажигаем солнце");
  await nextFrame();
  return { manifest: data.manifest, buildingChunks: chunks, buildingStats: stats, ground, traffic };
}
