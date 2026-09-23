/**
 * Contract of the «Аким на 5 часов» simulator domain.
 * Pure data types — no React, no three.js. Shared by the browser, the API
 * routes and the tests. Rules: docs/case/akim-simulator-dataset-and-rules.md.
 */

export const DISTRICT_IDS = ["esil", "almaty", "saryarka", "baikonur", "nura"] as const;
export type DistrictId = (typeof DISTRICT_IDS)[number];

export const INDICATOR_IDS = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];

export const DIRECTION_IDS = ["transport", "ecology", "social", "safety", "service"] as const;
export type DirectionId = (typeof DIRECTION_IDS)[number];

export const MEASURE_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13", "M14"] as const;
export type MeasureId = (typeof MEASURE_IDS)[number];

export type Scope = "district" | "city";

export type District = {
  id: DistrictId;
  name: string;
  population: number; // share of city population, sums to 1
  profile: string;
  baseline: Record<IndicatorId, number>;
};

export type Indicator = {
  id: IndicatorId;
  direction: DirectionId;
  name: string;
  weight: number;
  meaning100: string;
};

export type Measure = {
  id: MeasureId;
  direction: DirectionId;
  title: string;
  scope: Scope;
  cost: number;
  /** Quarters until the measure starts working (L). Realised share = (8 − L) / 8. */
  lag: number;
  /** Full effects before the lag factor. */
  effects: Partial<Record<IndicatorId, number>>;
};

export type Synergy = { a: MeasureId; b: MeasureId; indicator: IndicatorId; bonus: number };

export type Incompatibility = { a: MeasureId; b: MeasureId; sameDistrictOnly: boolean; reason: string };

/** One decision. `districtId` is required for «Район» measures and must be null for «Город». */
export type Choice = { measureId: MeasureId; districtId: DistrictId | null };

export type IssueCode =
  | "COUNT" // not exactly 5 decisions
  | "DUPLICATE" // same measure twice
  | "BUDGET" // total cost > budget
  | "DIRECTION_LIMIT" // > 2 measures from one direction (or strict mode: not 1 per direction)
  | "DISTRICT_REQUIRED" // district measure without district
  | "DISTRICT_NOT_ALLOWED" // city measure with district
  | "UNKNOWN_MEASURE"
  | "UNKNOWN_DISTRICT"
  | "INCOMPATIBLE"; // M1+M3 anywhere, M4+M7 / M5+M13 in one district

export type ValidationIssue = { code: IssueCode; message: string; measureIds?: MeasureId[] };

export type RuleOptions = {
  /** Strict reading of the brief: exactly one measure per direction. Default false (≤ 2 per direction). */
  strictDirections?: boolean;
};

export type IndicatorMatrix = Record<DistrictId, Record<IndicatorId, number>>;

/** Where a change in an indicator came from (after the lag factor). */
export type Contribution = {
  measureId: MeasureId;
  districtId: DistrictId;
  indicator: IndicatorId;
  amount: number;
  kind: "effect" | "synergy";
};

export type CriticalPair = { districtId: DistrictId; indicator: IndicatorId; value: number };

export type ActiveSynergy = { a: MeasureId; b: MeasureId; districtId: DistrictId; indicator: IndicatorId; bonus: number };

export type SimulationResult = {
  cost: number;
  remaining: number;
  baseline: IndicatorMatrix;
  /** Indicators after all effects, clipped to [0, 100]. */
  indicators: IndicatorMatrix;
  districtScores: Record<DistrictId, number>;
  baselineDistrictScores: Record<DistrictId, number>;
  dAvg: number;
  dMin: number;
  weakestDistrict: DistrictId;
  criticalPairs: CriticalPair[];
  nCrit: number;
  score: number;
  baselineScore: number;
  synergies: ActiveSynergy[];
  contributions: Contribution[];
};

export type Evaluation =
  | { ok: true; issues: []; result: SimulationResult }
  | { ok: false; issues: ValidationIssue[]; result: null };
