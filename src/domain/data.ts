/**
 * The case dataset, transcribed 1:1 from docs/case/akim-simulator-dataset-and-rules.md
 * (synthetic data from the organisers, not real Astana statistics).
 * Every team starts from exactly these numbers and BUDGET.
 */
import type { DirectionId, District, DistrictId, Incompatibility, Indicator, IndicatorId, Measure, MeasureId, Synergy } from "./types";

export const DATASET_VERSION = "akim-case-v1";
export const BUDGET = 100;
export const DECISIONS = 5;
export const HORIZON_QUARTERS = 8;
export const CRITICAL_THRESHOLD = 40;
export const MAX_PER_DIRECTION = 2;
export const WEIGHT_AVG = 0.7;
export const WEIGHT_MIN = 0.3;
export const CRITICAL_PENALTY = 1;

export const DIRECTIONS: Record<DirectionId, { name: string; short: string; color: string }> = {
  transport: { name: "Транспорт", short: "Транспорт", color: "#6aa9ff" },
  ecology: { name: "Озеленение и экология", short: "Экология", color: "#5fd08a" },
  social: { name: "Социальная инфраструктура", short: "Соцсфера", color: "#f0b35a" },
  safety: { name: "Безопасность", short: "Безопасность", color: "#ff8a70" },
  service: { name: "Городской сервис", short: "Сервис", color: "#b59cff" },
};

export const INDICATORS: Record<IndicatorId, Indicator> = {
  T1: { id: "T1", direction: "transport", name: "Разгрузка дорог", weight: 0.1, meaning100: "нет пробок в час пик" },
  T2: { id: "T2", direction: "transport", name: "Доступность общественного транспорта", weight: 0.1, meaning100: "все жители в 500 м от остановки, интервал ≤ 10 мин" },
  E1: { id: "E1", direction: "ecology", name: "Озеленение", weight: 0.09, meaning100: "≥ 20 м² зелени на жителя" },
  E2: { id: "E2", direction: "ecology", name: "Качество воздуха", weight: 0.11, meaning100: "зимой AQI ≤ 50" },
  S1: { id: "S1", direction: "social", name: "Школы и детсады", weight: 0.11, meaning100: "100% нормативной потребности, без второй смены" },
  S2: { id: "S2", direction: "social", name: "Поликлиники и первичная медпомощь", weight: 0.11, meaning100: "норматив на жителя выполнен" },
  B1: { id: "B1", direction: "safety", name: "Безопасность улиц", weight: 0.09, meaning100: "освещение и камеры везде" },
  B2: { id: "B2", direction: "safety", name: "Безопасность дорожного движения", weight: 0.09, meaning100: "минимум ДТП с пострадавшими" },
  C1: { id: "C1", direction: "service", name: "Надёжность ЖКХ", weight: 0.1, meaning100: "нет аварий отопления и воды за год" },
  C2: { id: "C2", direction: "service", name: "Скорость решения обращений", weight: 0.1, meaning100: "все обращения закрыты в срок" },
};

const row = (v: number[]): Record<IndicatorId, number> => ({
  T1: v[0], T2: v[1], E1: v[2], E2: v[3], S1: v[4], S2: v[5], B1: v[6], B2: v[7], C1: v[8], C2: v[9],
});

export const DISTRICTS: Record<DistrictId, District> = {
  esil: { id: "esil", name: "Есиль", population: 0.27, profile: "Богатый, но пробки на мостах и переполненные школы", baseline: row([45, 62, 68, 72, 48, 55, 78, 60, 75, 70]) },
  almaty: { id: "almaty", name: "Алматы", population: 0.24, profile: "Старое ЖКХ и пробки", baseline: row([40, 75, 50, 55, 60, 65, 62, 52, 50, 60]) },
  saryarka: { id: "saryarka", name: "Сарыарка", population: 0.2, profile: "Смог от частного сектора, слабое озеленение", baseline: row([50, 70, 42, 40, 62, 68, 58, 55, 45, 55]) },
  baikonur: { id: "baikonur", name: "Байконур", population: 0.13, profile: "Середняк без ярких перекосов", baseline: row([52, 68, 55, 50, 58, 60, 52, 58, 55, 58]) },
  nura: { id: "nura", name: "Нура", population: 0.16, profile: "Главный аутсайдер по соцсфере и транспорту", baseline: row([55, 40, 45, 65, 38, 35, 55, 50, 60, 50]) },
};

export const MEASURES: Record<MeasureId, Measure> = {
  M1: { id: "M1", direction: "transport", title: "Выделенные полосы для автобусов", scope: "district", cost: 18, lag: 2, effects: { T1: 6, T2: 9 } },
  M2: { id: "M2", direction: "transport", title: "Умные светофоры (адаптивное управление)", scope: "city", cost: 22, lag: 2, effects: { T1: 4, B2: 3 } },
  M3: { id: "M3", direction: "transport", title: "Линия ЛРТ / расширение", scope: "district", cost: 30, lag: 4, effects: { T1: 16, T2: 20, E2: 4 } },
  M4: { id: "M4", direction: "ecology", title: "Парк / сквер", scope: "district", cost: 15, lag: 2, effects: { E1: 12, E2: 3, B1: 2 } },
  M5: { id: "M5", direction: "ecology", title: "Перевод частного сектора на чистое топливо", scope: "district", cost: 25, lag: 3, effects: { E2: 14, C1: 4 } },
  M6: { id: "M6", direction: "ecology", title: "Городская программа озеленения и ветрозащитных полос", scope: "city", cost: 20, lag: 4, effects: { E1: 5, E2: 3 } },
  M7: { id: "M7", direction: "social", title: "Школа + детсад (модульное строительство)", scope: "district", cost: 24, lag: 3, effects: { S1: 16 } },
  M8: { id: "M8", direction: "social", title: "Центр семейного здоровья / поликлиника", scope: "district", cost: 20, lag: 3, effects: { S2: 14 } },
  M9: { id: "M9", direction: "social", title: "Дворовые спорт-хабы", scope: "district", cost: 10, lag: 1, effects: { S1: 3, S2: 3, B1: 3 } },
  M10: { id: "M10", direction: "safety", title: "Освещение и камеры (расширение Safe City)", scope: "district", cost: 12, lag: 1, effects: { B1: 12, B2: 2 } },
  M11: { id: "M11", direction: "safety", title: "Безопасные переходы и школьные зоны", scope: "district", cost: 10, lag: 1, effects: { B2: 12, T1: -2 } },
  M12: { id: "M12", direction: "service", title: "Единая цифровая платформа обращений", scope: "city", cost: 14, lag: 1, effects: { C2: 5 } },
  M13: { id: "M13", direction: "service", title: "Модернизация тепло- и водосетей", scope: "district", cost: 28, lag: 4, effects: { C1: 18, E2: 2 } },
  M14: { id: "M14", direction: "service", title: "Аварийные бригады ЖКХ + раннее оповещение", scope: "city", cost: 16, lag: 1, effects: { C1: 5, C2: 2 } },
};

/** Bonus applies when both are chosen; given in the district of `a`; not scaled by lag. */
export const SYNERGIES: Synergy[] = [
  { a: "M1", b: "M2", indicator: "T1", bonus: 2 },
  { a: "M10", b: "M12", indicator: "B1", bonus: 2 },
  { a: "M5", b: "M6", indicator: "E2", bonus: 2 },
];

export const INCOMPATIBILITIES: Incompatibility[] = [
  { a: "M1", b: "M3", sameDistrictOnly: false, reason: "Либо BRT, либо ЛРТ: совместный выбор запрещён в любом районе" },
  { a: "M4", b: "M7", sameDistrictOnly: true, reason: "Парк и школа в одном районе конфликтуют за участок" },
  { a: "M5", b: "M13", sameDistrictOnly: true, reason: "Чистое топливо и модернизация сетей в одном районе дублируют программу" },
];
