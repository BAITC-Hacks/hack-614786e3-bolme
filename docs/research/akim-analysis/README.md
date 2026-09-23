# «Аким на 5 часов»: product analysis and concept recommendation

Date: 23 Sept 2026 (hackathon day). Research material for choosing the idea. This is not an approved spec yet.

Method: every valid plan was enumerated with the official formula ([solve-space.mjs](solve-space.mjs), output in [solve-space-output.txt](solve-space-output.txt)). Four independent Codex analyses (`gpt-6-astra`, fast tier) then looked at the case as a jury, a simulation modeller, a game designer and an architect ([codex/](codex/)). Claude cross-checked every number Codex reported.

> Correction to the Codex brief: the brief claimed the official Score equals the time-averaged quarterly Score. That is wrong. The lag factor time-averages the **indicators**, but `min(D)`, the `<40` penalty and clipping are nonlinear. For the optimum: official 57.2367, average of quarterly Scores 56.5807. All four Codex lenses caught this, and the timeline design below takes it into account.

## 1. TL;DR

**Build a top-down city game where every number is exact and every decision must be defended.**

- **Layer 1, the Official model.** The case formula, bit-exact. It is solved exhaustively, so the app always knows the true optimum.
- **The stand-out.** A "public hearing": a resident or journalist from the weakest district challenges your plan, and the AI coach tests each objection with real tool calls. The coach shows what your promises cost, overlays the optimal city as a "ghost", and lets you amend the plan or defend it.
- **Your realism vision** (roads → noise → neighbours, crises, reserve) ships as a clearly labelled **Foresight / Crisis layer**. It never touches the official Score. Build it after the core works, or present it as the roadmap.

Why: the rubric gives 75/100 to working + technical + README/reproducibility and only 10/100 to originality, and even those 10 are shared with "development potential". Uniqueness has to earn points in the technical and value lines as well. An exact, glass-box simulator with a grounded AI that judges can reproduce does exactly that.

## 2. Hard facts from the exhaustive solve (verified)

| Fact | Value | Product use |
|---|---|---|
| Baseline (no actions) | **52.55768** | Reference line |
| Case example (cost 95) | **56.54307**. Beats 99.92% of valid plans; captures 85.2% of the achievable gain | Preset + onboarding |
| Valid plans | 1,181 measure-sets → **694,395** plans (~2 s in Node) | "Your plan beats X% of 694,395 plans" |
| Score band | min 52.04 · median 53.83 · p99 55.83 · **max 57.2367** | Raw points look flat, so show *% of potential* and *rank* |
| Global optimum (cost 98) | M2 + M3@Нура + M8@Нура + M9@Нура + M14 | "Optimal ghost" overlay |
| Strict reading (1 per direction) | optimum **56.3445** | Documented interpretation, toggle |
| Pareto | 61→55.67 · 66→56.57 · 72→56.87 · 88→57.19 · 98→57.24 | The last 26 units buy only +0.37 |
| **Trap** | M11 (safe crossings) in Алматы pushes T1 from 40 to 38.25 → new critical. Plan `M9@Байконур + M11@Алматы + M10@Байконур + M12 + M4@Байконур` (cost 61) raises the average (56.86 → 57.91) but the Score **falls to 52.42 < baseline**. Moving M11 to Байконур gives 53.36 at the same cost | **Demo opener** |
| Efficiency vs equity | Max avg only → invest in **Есиль**; max min(D) only → everything in **Нура**. Best plan avoiding Нура = 54.77 vs 57.24 | "Two cabinets" / "price of a promise" |
| Cliffs dominate | M9 in Нура alone +1.335 (lifts S1 over 40); 1.34 pts per 10 units, 2× the next measure | The 40-line alarm |
| Shapley (optimum) | M8 +1.40 · M9 +1.34 · M3 +0.83 · M14 +0.61 · M2 +0.50 (sums to the gain) | "Who gets the credit" |
| Timeline | Measures switch on at Q(L+1). For the optimum, the weakest district moves **Нура → Сарыарка at Q5** | "The bottleneck moves" |
| Geography | Astana created **Сарайшық** district in 2024 (now 6); the case uses 5 | Label the map "case geography" |

## 3. Your vision vs. what the data already contains

The official model already contains most of the "choices ripple" idea. It just isn't visible yet:

| Your idea | Already in the official data | Missing (Foresight layer only) |
|---|---|---|
| Choice affects other districts | City-wide measures (M2, M6, M12, M14) hit all 5; the weakest district drives 30% of the Score | Spatial spillovers between neighbours |
| Choices interact with earlier choices | Synergies (M1+M2, M10+M12, M5+M6), incompatibilities (M1/M3; M4/M7 and M5/M13 same district) | Order effects (the official model is order-independent) |
| A good thing has a cost (road → noise) | M11: B2 +12 but T1 −2 → can create a critical value | Noise, induced demand, construction disruption |
| Things take time | Lags 1-4 quarters, realised share (8−L)/8 | Opex after opening (years 3-5), delays |
| Crises | none | Events + reserve (the case lists this as optional) |

There is no road/highway measure and no noise indicator. Adding them to the scored model breaks "same data for all teams". Codex B designed them as an Extended-mode sandbox (X1 expressway, X2 acoustic treatment) instead.

## 4. Recommended concept (working title: «Аким под присягой» / City Under Oath)

**Pitch:** "Five decisions, 100 units, two years. Every number is exact, and you must defend every trade-off in a public hearing."

**Core loop:** drag measure cards onto the map → the city reacts (district colour, city-wide pulse, synergy wires, conflicts, 40-line alarms, weakest-district marker) → submit → AI report → **hearing**: a persona from the weakest district objects → the coach investigates with tools → amend or defend → final decision record + optimal-city ghost + rank.

**Signature moments:**
1. The trap: a "good" safety investment lowers the city's score, and the map shows exactly why.
2. Hold Space to see the optimal city: the ghost overlay of the best plan.
3. "What does your promise cost?" Pin "don't touch Нура" and the solver prints the exact opportunity cost (−2.47).
4. Timeline scrub: construction → openings; after the LRT opens, the bottleneck moves to Сарыарка.

## 5. Scope tiers (2 people × 5 hours)

### Tier 0: must ship (maps 1:1 to must-haves and acceptance checks A1-A5). About 3h, gate at hour 3
- Dataset JSON exactly per case; pure TS engine with integer arithmetic in eighths; validator with reason codes (budget, count, duplicates, direction ≤2, district required, incompatibilities).
- Golden tests: baseline 52.557680, example 56.543070, optimum 57.236735, trap, invalid plans rejected, order-independence.
- Top-down SVG map of 5 districts plus the Ishim river; measure cards; 5 slots; hard budget bar (100); visible ripples from official mechanics.
- Score panel: Score, gain vs baseline, % of max potential, rank among 694,395; components 0.7·avg / 0.3·min / −N_crit.
- AI analysis: strengths / risks / consequences / trade-offs / recommendations. Structured output; claims reference computed fact IDs; numbers rendered by code; works with no API key (recorded plus deterministic fallback).
- README: verify-in-60-seconds, A1-A5 → tests table, "what code computes vs what AI says", Codex log.

### Tier 1: the case's own optional list. About 1.5h
- District visualization → already the map.
- AI improvement recommendations → solver "best swap" + optimal ghost.
- Team comparison → **challenge link**: the plan encoded in the URL, a side-by-side duel, and an AI commentator (no realtime infra).
- Short presentation → a one-page printable brief / 5-slide HTML from the report.
- Unexpected events → *stretch*: 2 seeded events in a separate "Crisis rehearsal" mode where the unused reserve becomes insurance (a cost-72 plan keeps 28 units, a cost-98 plan keeps only 2).

### Tier 2: stand-out, pick 1-2. About 1h
- ★ **Public hearing**: one witness, one objection, one tool-backed amendment; optional TTS voice (team strength).
- ★ **Price of a promise**: 3 predefined commitments → exact opportunity cost.
- Two cabinets (efficiency vs equity), Shapley credit waterfall, 8-quarter timeline.

### Later (Demo Day / after the hackathon): the full "living city"
- Foresight layer (Codex B rules R1-R10): adjacency graph with river crossings at weight 0.5, 20% transport spillovers, construction disruption during lag quarters, a noise index, opex years 3-5, trust dynamics, plus an assumptions registry and sensitivity ranges.
- The full 8-event deck (heating-main rupture in Алматы, smog in Сарыарка, spring flood, blizzard...) with a 100-seed robustness test.
- Live multiplayer rooms and a 5-akim negotiation council; real open data; 6 districts.

### Cut today
Real-time multiplayer infra, accounts, 3D, GIS ingestion, invented effects inside the official score, Telegram delivery, multi-language.

## 6. Three-minute demo (from Codex A, numbers verified)
0:00 map, trap plan (cost 61), Score 52.42 < baseline 52.56 → 0:25 inspector: T1 in Алматы 40 → 38.25, criticals 2 → 3, AI explains → 0:50 move M11 to Байконур: 53.36, same cost → 1:15 "find a stronger plan": optimum 57.24, ghost overlay → 1:40 cost-72 vs cost-98 (the last 26 units buy +0.37) → 2:05 over-budget swap rejected; official example reproduces 56.543 → 2:30 hearing / report / README + Codex log.

## 7. Architecture (Codex D, condensed)
Next.js + TypeScript, one repo, Node pinned. `src/engine` (pure, shared), `src/solver` (enumerate, Pareto, rank, best-swap), `src/attribution` (Shapley over 32 subsets), `src/facts` (fact + claim registry), `src/ai` (OpenAI Responses API: ≤2 tool rounds with validatePlan / simulate / compareScenarios / findBestSwap / explainIndicator / getAttribution, then a strict JSON report; the verifier rejects unknown fact IDs), `app/api/evaluate`, `app/api/coach`. Report source is `live | recorded | deterministic`. Vitest + a small Playwright suite; CI badge; Vercel deploy; `npm run demo` works with no key. In-app model is configurable via `OPENAI_MODEL`; check which models the hackathon key can use before choosing.

## 8. Top risks
1. The engine disagrees with the case → golden tests first, before any UI polish.
2. The AI invents numbers → a claim registry, with numbers rendered by code.
3. Judges can't run it → no-key mode, pinned versions, the teammate runs the README cold.
4. Building the dream game instead of the assessed simulator → Tier 0 gate at hour 3, feature freeze at 3:45.
5. Realism claims hurt credibility → "synthetic model" labels; Foresight kept separate.
6. The solver makes the game feel "solved" → reveal the optimum after submission; the challenge becomes *defending* trade-offs.
7. No proof of Codex use → keep a `docs/codex-log.md` plus these research sessions.

## 9. Open decisions for the team
- Concept emphasis: hearing (recommended) vs timeline/crisis vs realism-first vs arena.
- Realism layer: official-only today + roadmap (recommended), or a small labelled Foresight prototype.
- Multiplayer: async challenge link (recommended) vs live rooms.
- Voice in the hearing: yes/no.
- Interpretation: "max 2 per direction" (the detailed rules; recommended) with a strict toggle. Ask the organizers if possible.
