/**
 * Demo hotspots for the main map: one per case district, placed at the
 * building-weighted centre of the real district. Indicator values come from
 * the case dataset (synthetic, see docs/case/README.md). The game layer is
 * expected to replace these via useCityStore.getState().setHotspots().
 */
import type { CityManifest } from "./schema";
import type { Hotspot } from "./store";

const DEMO: Record<string, Omit<Hotspot, "id" | "x" | "z" | "districtId">> = {
  nura: { title: "Нура", caption: "Медпомощь 35 · школы 38 — ниже 40", radius: 900, tone: "critical" },
  saryarka: { title: "Сарыарка", caption: "Смог частного сектора · воздух 40", radius: 1000, tone: "warning" },
  almaty: { title: "Алматы", caption: "Старое ЖКХ 50 · пробки 40", radius: 950, tone: "warning" },
  esil: { title: "Есиль", caption: "Пробки на мостах · школы 48", radius: 900, tone: "info" },
  baikonur: { title: "Байконур", caption: "Без перекосов · район 56.6", radius: 900, tone: "positive" },
};

export function demoHotspots(manifest: CityManifest): Hotspot[] {
  return manifest.districts
    .filter((d) => DEMO[d.id])
    .map((d) => ({ id: d.id, districtId: d.id, x: d.center[0], z: d.center[1], ...DEMO[d.id] }));
}
