/**
 * Downloads OpenStreetMap data for the Astana scene via Overpass.
 *
 * Usage: npm run city:fetch            (skips layers that are already cached)
 *        npm run city:fetch -- --force (re-downloads everything)
 *
 * Output: data/osm/<layer>.json — raw Overpass JSON (`out geom`), one file per
 * thematic layer so a busy server only costs a retry of one layer.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICT_RELATIONS, OVERPASS_ENDPOINTS, RAW_DIR, SCENE_BBOX, USER_AGENT } from "./config";

const MAX_ATTEMPTS = 12;
const REQUEST_TIMEOUT_MS = 180_000;
/** Overpass admits requests by their declared budget: keep it modest. */
const header = "[out:json][timeout:120][maxsize:268435456];";
/** Each thematic layer is fetched in this many north–south strips. */
const STRIPS = 4;

function stripBbox(index: number): string {
  const step = (SCENE_BBOX.north - SCENE_BBOX.south) / STRIPS;
  const south = SCENE_BBOX.south + index * step;
  return `${south.toFixed(5)},${SCENE_BBOX.west},${(south + step).toFixed(5)},${SCENE_BBOX.east}`;
}

const STRIPPED_LAYERS: Record<string, (bbox: string) => string> = {
  buildings: (bbox) => `${header}
(
  way["building"](${bbox});
  relation["building"](${bbox});
  way["building:part"](${bbox});
  relation["building:part"](${bbox});
);
out geom qt;`,
  transport: (bbox) => `${header}
(
  way["highway"](${bbox});
  way["railway"](${bbox});
  way["aeroway"~"runway|taxiway|apron"](${bbox});
);
out geom qt;`,
  areas: (bbox) => `${header}
(
  way["natural"](${bbox});
  relation["natural"](${bbox});
  way["waterway"="riverbank"](${bbox});
  way["water"](${bbox});
  way["landuse"](${bbox});
  relation["landuse"](${bbox});
  way["leisure"](${bbox});
  relation["leisure"](${bbox});
  way["amenity"](${bbox});
  relation["amenity"](${bbox});
  way["man_made"](${bbox});
  relation["man_made"](${bbox});
  way["place"="square"](${bbox});
  way["area:highway"](${bbox});
  node["natural"="tree"](${bbox});
);
out geom qt;`,
};

const LAYERS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(STRIPPED_LAYERS).flatMap(([name, build]) =>
      Array.from({ length: STRIPS }, (_, i) => [`${name}_${i}`, build(stripBbox(i))]),
    ),
  ),
  districts: `${header}
(
${Object.values(DISTRICT_RELATIONS)
  .map((id) => `  relation(${id});`)
  .join("\n")}
);
out geom;`,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runQuery(name: string, query: string): Promise<string> {
  let lastError = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % 2 === 0 ? 0 : 1 + ((attempt >> 1) % 2)];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      if (!response.ok || !text.trimStart().startsWith("{")) {
        const reason = text.match(/Error<\/strong>: ([^<]*)/)?.[1] ?? text.replace(/\s+/g, " ").slice(0, 120);
        throw new Error(`HTTP ${response.status} from ${new URL(endpoint).host}: ${reason}`);
      }
      const parsed = JSON.parse(text) as { remark?: string };
      if (parsed.remark && /runtime error|timed out|out of memory/i.test(parsed.remark)) {
        throw new Error(`Overpass remark: ${parsed.remark}`);
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const backoff = Math.min(30_000, 5_000 * (attempt + 1));
      console.warn(`  ${name}: attempt ${attempt + 1} failed (${lastError}); retry in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
  throw new Error(`${name} failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

async function main() {
  const force = process.argv.includes("--force");
  mkdirSync(RAW_DIR, { recursive: true });
  for (const [name, query] of Object.entries(LAYERS)) {
    const file = join(RAW_DIR, `${name}.json`);
    if (!force && existsSync(file)) {
      console.log(`  ${name}: cached`);
      continue;
    }
    const started = Date.now();
    const text = await runQuery(name, query);
    writeFileSync(file, text);
    const count = (JSON.parse(text) as { elements: unknown[] }).elements.length;
    console.log(`  ${name}: ${count} elements, ${(text.length / 1e6).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  writeFileSync(join(RAW_DIR, "_meta.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), bbox: SCENE_BBOX }, null, 2));
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
