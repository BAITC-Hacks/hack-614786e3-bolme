IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. Stay inside this repository. READ-ONLY: do not modify any file.

# Task: adversarial compliance audit of the simulator against the case document

You are an independent auditor for a hackathon jury. The team claims the core game follows the case EXACTLY. Try hard to prove them wrong.

Source of truth (read fully):
- `docs/case/HackAlem AI_ «Аким на 5 часов» - AI-симулятор управления городом.md` (task, must-haves, acceptance criteria)
- `docs/case/akim-simulator-dataset-and-rules.md` (dataset, 14 measures, lags, synergies, incompatibilities, formula, rules 1–8)
- The original screenshots in `docs/case/*.png` if you can view images (the markdown was transcribed from them).

Code to audit:
- `src/domain/data.ts` (transcribed dataset), `src/domain/types.ts`, `src/domain/engine.ts` (validation + formula), `src/domain/solver.ts`, `src/domain/rank.ts`, `src/domain/engine.test.ts`
- UI flow that enforces the rules: `src/ui/sim/PlanPanel.tsx` (adding cards, blocking, sign button), `src/sim/store.ts`, `src/ui/sim/ResultView.tsx`, `src/ui/sim/InfoPanel.tsx`, `src/ui/sim/Reveal.tsx`, `src/ui/sim/FinalDebrief.tsx`
- AI: `src/app/api/analyze/route.ts`, `src/sim/report.ts`, `src/sim/analysis.ts`
- Mods (must NOT change the official score): `src/domain/mods.ts`, `src/domain/social.ts`

Check and report, each with file:line evidence:
1. Every number in data.ts vs the document (50 baseline values, population shares, 10 weights, 14 measures: direction, scope, cost, lag, effects; 3 synergies; 3 incompatibilities).
2. Formula: lag factor (8−L)/8 applied to effects only; synergy fixed, NOT lag-scaled, in the district of the first measure of the pair; clip to [0,100] after summing; D = Σ w·I′; D_avg population-weighted; Score = 0.7·D_avg + 0.3·min(D) − 1·N_crit with N_crit counting values STRICTLY < 40; no intermediate rounding.
3. Rules 1–8: budget 100, remainder gives no bonus; exactly 5; no repeats; district required for «Район», not allowed for «Город»; ≤ 2 per direction; incompatibilities (M1/M3 anywhere; M4/M7 and M5/M13 same district only); invalid plan gets NO score with a reason; order irrelevant.
4. UI: can the user ever exceed the budget, sign an invalid plan, get a score for an incomplete plan, or see a number that disagrees with the engine? Is anything shown to the user (labels, lag texts like "с N-го квартала", analyst-mode magnitudes, reveal captions) inconsistent with the document's definitions?
5. AI layer: can the model inject numbers not computed by the engine? Is the server recomputing rather than trusting the client?
6. Mods/social: confirm they never alter the official Score/indicators shown as official.
7. Any interpretation choices (e.g. "5 decisions across 5 directions" vs "≤ 2 per direction") and whether they are documented.

Output: a table of checks with PASS / FAIL / RISK, evidence, and for any FAIL or RISK a minimal reproducer and the fix. Be concise. Do not pad with passes you did not actually verify.
