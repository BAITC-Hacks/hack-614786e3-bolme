IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. Stay inside this repository.

# Task: implement the exact simulation engine, solver and tests for «Аким на 5 часов»

Repository: a Next.js 16 + TypeScript app (see AGENTS.md). You are implementing ONLY the pure domain layer. Another engineer is building the UI in parallel against the contract in `src/domain/types.ts` — DO NOT change `src/domain/types.ts` or `src/domain/data.ts` (if you believe a change is essential, stop and describe it in your final message instead). Do not touch any other existing file except `package.json` "scripts" (add scripts only; do NOT add dependencies — use only what is installed: typescript, tsx, node built-ins).

Read first: `docs/case/akim-simulator-dataset-and-rules.md` (rules + formula), `src/domain/types.ts` (contract), `src/domain/data.ts` (dataset constants — already transcribed).

## Files to create

1. `src/domain/engine.ts` (pure, no React / three imports; import data from "./data" and types from "./types" with relative paths so it also runs under tsx/node):
   - `planCost(plan: Choice[]): number`
   - `simulate(plan: Choice[]): SimulationResult` — NO validation; works for 0..n choices (used for baseline, previews, Shapley subsets). Formula per rules doc:
     `I'[d,k] = clip(I[d,k] + Σ effect[m,k]·(8−L[m])/8 + synergy[d,k], 0, 100)` — city measures apply to all 5 districts, district measures to their district; synergy bonus (not lag-scaled) in the district of the pair's FIRST measure `a` (if `a` is a city measure — not the case in the data, but handle it — apply to all districts); clip AFTER summing everything. `D[d] = Σ w[k]·I'[d,k]`; `D_avg = Σ pop[d]·D[d]`; `Score = 0.7·D_avg + 0.3·min(D) − 1.0·N_crit` where N_crit counts (district, indicator) pairs with value STRICTLY < 40 after all effects. Fill `contributions` (per measure/district/indicator amount after lag factor, plus synergy rows with kind "synergy"), `synergies`, `criticalPairs`, `weakestDistrict`, `baseline*` fields (baseline = simulate([]) values), `remaining = BUDGET − cost`.
   - `validatePlan(plan: Choice[], opts?: RuleOptions): ValidationIssue[]` — returns ALL violated rules with Russian `message`s and stable `code`s: COUNT (exactly 5), DUPLICATE, BUDGET (> 100), DIRECTION_LIMIT (> 2 per direction; with `strictDirections` exactly one per each of the 5 directions), DISTRICT_REQUIRED, DISTRICT_NOT_ALLOWED, UNKNOWN_MEASURE, UNKNOWN_DISTRICT, INCOMPATIBLE (M1+M3 anywhere; M4+M7 and M5+M13 only when in the same district). Order of choices must not matter.
   - `evaluatePlan(plan: Choice[], opts?: RuleOptions): Evaluation` — validate, then `{ok:true, issues:[], result: simulate(plan)}` or `{ok:false, issues, result:null}` (invalid plan gets NO score).
   - `issuesForAdding(plan: Choice[], choice: Choice, opts?: RuleOptions): ValidationIssue[]` — for a PARTIAL plan (0–4 choices): what would be violated by adding `choice` (6th decision, duplicate, budget overflow, direction limit, incompatibility, district required/not allowed). Does NOT complain that the plan is incomplete. Used by the UI to block a card with a reason.
2. `src/domain/solver.ts`:
   - `enumerateValidPlans(opts?: RuleOptions): Generator<{ plan: Choice[]; cost: number }>` — all 5-measure combinations × all district assignments that pass validatePlan (prune by cost/direction/M1+M3 before expanding districts). Expected counts with default rules: 1,181 measure sets, 694,395 plans.
   - `bestSwaps(plan: Choice[], opts?: RuleOptions, limit = 5): Array<{ plan: Choice[]; score: number; delta: number; change: { kind: "replace" | "move"; from: Choice; to: Choice } }>` — every valid plan that differs from `plan` by exactly one choice (replace a measure by another measure+district, or move a district measure to another district), sorted by score desc, only those with delta > 1e-9, top `limit`. Works only for a valid 5-choice plan (return [] otherwise).
   - `shapley(plan: Choice[]): Array<{ choice: Choice; value: number }>` — exact Shapley values over the choices (value function = simulate(subset).score); must sum to simulate(plan).score − baselineScore (assert in tests to 1e-9).
3. `scripts/sim/solve.ts` — enumerates everything once and writes `src/domain/generated/solver.json` (pretty-printed, deterministic) with:
   `{ datasetVersion, rules: "max2-per-direction", measureSetCount, validPlanCount, baselineScore, minScore, maxScore, optimum: { plan, score, cost }, strictOptimum: { plan, score, cost }, topPlans: [10 × {plan, score, cost}], pareto: [{ cost, score, plan }] (cheapest plan for each new best score as cost increases), histogram: { min, step: 0.001, counts: number[] } (counts of valid plans per score bin, bin = floor((score−min)/step)) }`.
   Add package.json script `"sim:solve": "tsx scripts/sim/solve.ts"` and RUN it so the JSON is committed-ready.
4. `src/domain/rank.ts` — imports `./generated/solver.json` and exports `rankInfo(score: number): { beatsPercent: number; potentialPercent: number; validPlanCount: number; maxScore: number; optimum: ... }` where beatsPercent = % of valid plans with a strictly lower score (use histogram; within the score's own bin count half of the bin), potentialPercent = (score − baselineScore)/(maxScore − baselineScore)·100.
5. `src/domain/engine.test.ts` using `node:test` + `node:assert/strict` (NO vitest/jest). Add package.json script `"test": "tsx --test src/domain/*.test.ts"`. Group tests by the case acceptance criteria, names starting with:
   - `A1 same budget and data:` BUDGET === 100, baseline Score 52.55768 (±1e-5), D_avg 56.8624, min(D) 49.18, N_crit 2 (S1=38, S2=35 in nura), every district D matches the table (62.99, 57.06, 54.65, 56.63, 49.18 ±0.005).
   - `A2 budget cannot be exceeded:` a 5-measure plan costing > 100 → ok:false with BUDGET and result null; issuesForAdding blocks an overflowing card.
   - `A3 decisions change indicators:` district scope vs city scope, lag factor (M3 T1 +16·4/8 = +8), synergy fixed +2 not lag-scaled in district of `a` (M10@nura + M12 → nura B1 +2 extra), clip at 100, exactly 40 not critical, M11 negative T1 effect.
   - `A4` is covered by the AI layer — skip here.
   - `A5 changing decisions changes the Score:` case example (M7 nura, M8 nura, M10 nura, M12 city, M5 saryarka; cost 95) = 56.54307 (±1e-5), N_crit 0, min(D) 52.9625 (nura); optimum (M2, M3 nura, M8 nura, M9 nura, M14) = 57.236735 (±1e-6); they differ.
   - Golden extra: trap plan (M9 baikonur, M11 almaty, M10 baikonur, M12, M4 baikonur; cost 61) = 52.42381625 and moving M11 to baikonur = 53.36452625; strict-mode optimum 56.34451 (M3 nura, M4 nura, M8 nura, M10 nura, M14).
   - Rules: every IssueCode produced by a minimal failing plan; permutation invariance; M1+M3 rejected even in different districts; M4+M7 allowed in different districts, rejected in same.
   - Solver: counts 1181 / 694395 (may take a few seconds — fine), max score equals optimum, bestSwaps on the case example returns strictly improving valid plans, shapley sums correctly.

## Done criteria
- `npx tsc --noEmit` passes for the files you created (the whole project typecheck should pass).
- `npm test` passes; paste the summary in your final message.
- `npm run sim:solve` has produced `src/domain/generated/solver.json`.
- Final message: list files created, test summary, the optimum/strict optimum found, any deviation from this spec.
