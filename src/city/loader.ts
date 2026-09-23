/**
 * Loads the baked Astana scene data from /city.
 */
import { CITY_DATA_VERSION, type BuildingsFile, type CityManifest, type GroundFile } from "./schema";

export const CITY_BASE_URL = "/city";

export type CityData = {
  manifest: CityManifest;
  buildings: BuildingsFile;
  ground: GroundFile;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function loadCityData(onProgress?: (fraction: number) => void): Promise<CityData> {
  const manifest = await fetchJson<CityManifest>(`${CITY_BASE_URL}/manifest.json`);
  if (manifest.version !== CITY_DATA_VERSION) {
    throw new Error(`Версия данных города ${manifest.version} не совпадает с ожидаемой ${CITY_DATA_VERSION}. Выполните npm run city:build.`);
  }
  onProgress?.(0.15);
  let done = 0;
  const track = <T,>(promise: Promise<T>) =>
    promise.then((value) => {
      done++;
      onProgress?.(0.15 + done * 0.35);
      return value;
    });
  const [buildings, ground] = await Promise.all([
    track(fetchJson<BuildingsFile>(`${CITY_BASE_URL}/${manifest.files.buildings}`)),
    track(fetchJson<GroundFile>(`${CITY_BASE_URL}/${manifest.files.ground}`)),
  ]);
  return { manifest, buildings, ground };
}

export async function loadTreeRecords(manifest: CityManifest): Promise<ArrayBuffer> {
  const response = await fetch(`${CITY_BASE_URL}/${manifest.trees.file}`);
  if (!response.ok) throw new Error(`Не удалось загрузить деревья: HTTP ${response.status}`);
  return response.arrayBuffer();
}
