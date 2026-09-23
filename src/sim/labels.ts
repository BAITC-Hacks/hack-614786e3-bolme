import type { IndicatorId } from "@/domain/types";

export const SHORT: Record<IndicatorId, string> = {
  T1: "Дороги",
  T2: "Общ. транспорт",
  E1: "Зелень",
  E2: "Воздух",
  S1: "Школы",
  S2: "Медпомощь",
  B1: "Улицы",
  B2: "ДТП",
  C1: "ЖКХ",
  C2: "Обращения",
};

export const num = (x: number, digits = 2) =>
  x.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signed = (x: number, digits = 2) => `${x >= 0 ? "+" : "−"}${num(Math.abs(x), digits)}`;

export const lagText = (lag: number) => `с ${lag + 1}-го квартала`;

/** Colour for a 0–100 district/indicator value (red → amber → green). */
export function valueColor(v: number): string {
  if (v < 40) return "#c4503a";
  if (v < 50) return "#d08a2e";
  if (v < 60) return "#c2ad4c";
  return "#6f9a52";
}
