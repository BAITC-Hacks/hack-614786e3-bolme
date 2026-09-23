# «Аким на 5 часов» — design spec

Date: 2026-09-23. Status: approved in chat; this document records it. Build time left: **under 3 hours**.
Background research: [docs/research/akim-analysis/README.md](../../research/akim-analysis/README.md).

## 1. Goal and priority order

A top-down city simulator of the case's 5 conditional Astana districts. The **core is exactly the case**. On top of it sit switchable "mods" that make it feel like a living city without ever changing the official score.

Priority is strict. A lower level starts only when the level above works end to end.

| Level | What | Why |
|---|---|---|
| **P0 Core** | Everything in the case's Must-have + Критерии проверки + README | 75 of 100 rubric points; the user asked twice not to forget it |
| **P1 Case optionals** | District visualization, AI improvement recommendations, auto brief | The case lists them explicitly |
| **P2 Mods** | ЧС (emergencies), Шкала недовольства (anger scale), Память народа (promises) | Originality + "how government works" |
| **P3 Roadmap only** | Contractors, consequences layer (spillovers, noise, opex), strict mode, team duels/multiplayer, voice hearing, 6th district, real data | Written up in the README as the development plan |

Removed at the user's request: the random protests mod (replaced by the anger scale) and multiplayer (roadmap only).

## 2. P0 Core: requirement → implementation

| Case requirement | Implementation | Proof |
|---|---|---|
| Единый виртуальный бюджет, одинаковые данные | `src/data/astana.v1.json` holds exactly the case dataset (50 values, pop shares, weights, 14 measures, synergies, conflicts). Budget 100. Dataset hash shown in UI footer and README | Test A1 |
| Решения по 5 направлениям | Measure cards grouped by the 5 directions (Транспорт, Озеленение/экология, Соцсфера, Безопасность, Городской сервис). Exactly 5 measures, ≤2 per direction, district required for «Район» measures, none for «Город» | Validator tests |
| Автоматический контроль бюджета | UI refuses a card that would exceed 100 and shows the reason; server `/api/evaluate` rejects over-budget plans with `score: null` + reason code | Test A2 |
| Расчёт Astana QoL Score | Pure TS engine, exact formula; integer arithmetic in eighths; clip after summing; `<40` critical; `0.7·D_avg + 0.3·min(D) − N_crit` | Golden tests: baseline 52.557680, case example 56.543070, optimum 57.236735 |
| Решения влияют на показатели | Reveal shows per-district, per-indicator before → after, with the lag factor and synergies | Test A3 |
| Изменение решений меняет Score | Every change re-evaluates; compare two plans | Test A5 |
| AI-анализ + сильные стороны, риски, последствия, компромиссы | `/api/analyze`: OpenAI Responses API, strict JSON schema (summary, strengths, risks, consequences, tradeOffs, recommendations). The model receives only engine-computed facts, and numbers are rendered from fact IDs by code. If there is no API key or the call errors → a deterministic template report built from the same facts, labelled "offline" | Test A4 + manual review |
| Rules | Invalid plan → no Score, validator returns reasons. Order-independent. Unspent budget gives no bonus. Default reading "≤2 per direction" (documented; the case example has no transport measure) | Validator tests |

### Game flow (P0)
1. **Map screen.** An SVG top-down map of 5 districts with the Ishim river, labelled "условная география кейса". District colour = district score D. Critical indicators (<40) pulse. The weakest district is marked.
2. **Choosing, Akim mode (default).** Each card shows cost, lag (quarters to start), scope (this district / all 5), affected indicators as ↑/↓ arrows **without magnitudes**, synergy and conflict hints. Selecting a district-type card asks for a district on the map. The budget bar and 5 slots are always visible. Numeric results stay hidden.
3. **Analyst mode toggle.** Shows magnitudes and a live score preview (the case names "аналитик" as a user).
4. **«Подписать бюджет»** is enabled only for a valid plan → reveal: map recolours before → after, a per-district delta table, Score with gain vs baseline, % of max potential, rank among all 694,395 valid plans, and the components (avg / weakest / criticals).
5. **AI report** panel. "Изменить решения" returns to choosing with the plan kept.

## 3. P1 Case optionals
- **Визуализация изменений районов**: part of the P0 reveal (map + delta table).
- **AI-рекомендации по улучшению**: code computes the best single change (swap a measure or move it to another district: ≤270 candidates, all validated) and the global optimum (precomputed). After signing, the "Призрак оптимума" toggle overlays the optimal plan on the map. AI explains the top 1-2 candidates; it never invents one.
- **Краткая презентация**: a "Бриф" button renders a printable one-page summary (plan, score, map snapshot, AI conclusions) via browser print-to-PDF.
- Comparing several teams: not built (roadmap). If time remains, add a local A/B "compare with previous plan".

## 4. P2 Mods (switch panel before signing)

Mods never change the official Score. They produce a separate, labelled block «Итог с модами». All randomness is seeded (fixed default seed shown in the UI), so every run is reproducible and fair.

- **ЧС (unexpected events; also a case optional).** 3 authored events on the 8-quarter horizon:
  - Q2: spring flood in Нура (C1 −12, T1 −8).
  - Q5, winter: heating-main rupture in Алматы (C1 −18, C2 −5).
  - Q5: smog in Сарыарка (E2 −12, S2 −2).
  Each event pauses the reveal and offers 2-3 responses priced from the **reserve** (100 − plan cost). Preparedness from the chosen plan: M13 in the district halves heating/water losses; M14 ×0.8; M5 in Сарыарка halves the smog loss. The unused reserve becomes insurance.
- **Шкала недовольства (anger scale, 0-100 per district).** Deterministic from code:
  - starts from the district's critical indicators and its gap to the city average;
  - rises with unanswered ЧС and broken promises;
  - falls with measures that fix critical values.
  Shown as a gauge on each district and summarised in «Итог с модами».
- **Память народа (promises).** Before choosing, the player picks up to 3 public promises from a fixed list (e.g. "Решу проблему школ в Нуре", "Уберу смог в Сарыарке", "Не трону резерв"). Code checks kept or broken after signing. A broken promise adds anger in that district, and the AI report quotes the promise back.

## 5. Architecture

- **Stack:** Next.js (App Router) + TypeScript + Tailwind, one app, Node LTS pinned, npm lockfile. Vitest. Deploy to Vercel if time allows; local run is the primary path.
- **`src/data`**: `astana.v1.json`, presets (case example, optimum, trap plan).
- **`src/engine`**: pure TS, no framework imports. `validate.ts` (reason codes), `evaluate.ts` (indicators, D, D_avg, min, N_crit, Score in eighths), `facts.ts` (fact registry for the AI), `timeline.ts` (quarter each measure starts, used by the reveal and ЧС).
- **`src/solver`**: `scripts/solve.ts` generates `public/solver/meta.json` (counts, optimum, Pareto, sorted scores for rank). `bestSwap.ts` runs at request time.
- **`src/mods`**: `events.ts`, `anger.ts`, `promises.ts`. Pure functions of (plan, mod settings, seed, responses).
- **`src/ai`**: server-only OpenAI client (`OPENAI_API_KEY`, `OPENAI_MODEL`), report schema, prompts, deterministic fallback, verifier (unknown fact IDs → fallback).
- **`app/api/evaluate`, `app/api/analyze`**: the server recomputes everything and never trusts client numbers.
- **UI:** `CityMap`, `MeasureCard`, `DecisionTray`, `BudgetBar`, `ModsPanel`, `RevealPanel`, `AiReport`, `Brief`.

AI guardrail: the LLM explains and advises only. Every number the user sees comes from the engine.

## 6. Tests (named after the case's Критерии проверки)
A1 same budget + dataset hash · A2 over-budget rejected (UI + API) · A3 district/city scope, lag, synergy, clip · A4 report schema + fallback without key · A5 two valid plans → different Scores. Plus golden values, every validator reason, order independence, rank count 694,395.

## 7. Codex usage (mandatory for the hackathon)
The engine, validator and tests are implemented by Codex (`codex exec`, workspace-write, model `gpt-6-astra`) from a precise task prompt; Claude reviews and integrates. The earlier research sessions count too. Everything is logged in `docs/codex-log.md` (time, task, session id, what a human verified).

## 8. Time plan (under 3 hours) and cut line
| Time | Work | Gate |
|---|---|---|
| 0:00-0:15 | Scaffold app, data JSON, AGENTS.md, dispatch the Codex engine task | — |
| 0:15-1:15 | Engine + tests (Codex) ∥ map, cards, tray, budget, reveal (Claude) ∥ AI route + fallback | — |
| 1:15-1:45 | Integration: full P0 flow with a live AI report | **P0 works end to end** |
| 1:45-2:20 | P1: best swap + ghost + brief; P2: ЧС + anger scale (+ promises if time) | Feature freeze at 2:20 |
| 2:20-2:50 | README (run, verify, A1-A5 table, AI vs code, rules, architecture, Codex log, roadmap), clean-run check | — |
| 2:50-3:00 | Buffer / demo recording | — |

Cut order if late: promises → anger scale → ЧС → ghost → brief. P0 and README are never cut.
