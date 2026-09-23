/**
 * Landmarks of Astana that get hand-built models or camera shots.
 *
 * - `replace`: OSM footprint defines the anchor; the OSM volume (and any
 *   building parts inside it) is removed and a custom model is placed.
 * - `base`: OSM footprint is kept but capped at `baseHeight`; a custom
 *   crown (dome, minarets) is added on top.
 * - `anchor`: OSM geometry is rendered as is; the anchor is used for cameras.
 */
export type LandmarkMode = "replace" | "base" | "anchor";

export type LandmarkDef = {
  id: LandmarkId;
  title: string;
  mode: LandmarkMode;
  /** OSM elements, e.g. "way/230401645". The first one defines the anchor. */
  osm: string[];
  baseHeight?: number;
  /** Used when the OSM element is not part of the downloaded layers. */
  fallback?: { lat: number; lon: number };
};

export type LandmarkId =
  | "baiterek"
  | "khan-shatyr"
  | "peace-palace"
  | "ak-orda"
  | "hazrat-sultan"
  | "kazakh-eli"
  | "nur-alem"
  | "abu-dhabi-plaza"
  | "emerald"
  | "northern-lights"
  | "transport-tower"
  | "astana-arena";

export const LANDMARKS: LandmarkDef[] = [
  { id: "baiterek", title: "Байтерек", mode: "replace", osm: ["way/230401645", "way/230401644"] },
  { id: "khan-shatyr", title: "Хан Шатыр", mode: "replace", osm: ["way/460703779", "way/460703778", "way/460703777"] },
  { id: "peace-palace", title: "Дворец мира и согласия", mode: "replace", osm: ["way/166197368"] },
  { id: "nur-alem", title: "Нұр Әлем · EXPO", mode: "replace", osm: ["way/1461813334"] },
  { id: "ak-orda", title: "Акорда", mode: "base", osm: ["way/166198046"], baseHeight: 24 },
  { id: "hazrat-sultan", title: "Мечеть Хазрет Султан", mode: "base", osm: ["way/240860325"], baseHeight: 16 },
  {
    id: "kazakh-eli",
    title: "Монумент «Қазақ Елі»",
    mode: "replace",
    osm: ["node/2681623412"],
    fallback: { lat: 51.12211, lon: 71.46988 },
  },
  { id: "abu-dhabi-plaza", title: "Abu Dhabi Plaza", mode: "anchor", osm: ["way/1373723368"] },
  { id: "emerald", title: "Изумрудный квартал", mode: "anchor", osm: ["way/230361899"] },
  { id: "northern-lights", title: "Северное сияние", mode: "anchor", osm: ["way/230358851"] },
  { id: "transport-tower", title: "Транспорт Тауэр", mode: "anchor", osm: ["relation/3466338"] },
  { id: "astana-arena", title: "Астана Арена", mode: "anchor", osm: ["way/1460088073"] },
];
