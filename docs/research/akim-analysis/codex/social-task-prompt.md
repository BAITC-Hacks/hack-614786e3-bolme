IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. Stay inside this repository.

# Task: deterministic "social network reactions" for the city simulator

Repository: Next.js 16 + TypeScript. Pure domain layer only. Read first: `src/domain/types.ts`, `src/domain/data.ts`, `src/domain/mods.ts` (ModsOutcome, EmergencyOutcome, PromiseOutcome, AngerLevel), `src/domain/engine.ts` (simulate), `src/domain/engine.test.ts` (test style: node:test + node:assert/strict, relative imports).

Do NOT modify any existing file. Create ONLY:
- `src/domain/social.ts`
- `src/domain/social.test.ts`
(the existing `npm test` script already runs `src/domain/*.test.ts`).

## What to build

After the player signs a 5-measure plan, residents react on a fictional city social network. CODE decides who posts, about what, and whether people like it — with seeded randomness ("there is some chance they will like it or not"). An LLM later only rewrites `text` (not your job). Everything must be deterministic for the same seed.

```ts
import type { Choice, DistrictId, SimulationResult } from "./types";
import type { ModsOutcome } from "./mods";

export type Sentiment = "support" | "neutral" | "angry";

export type SocialPost = {
  id: string;                      // stable, e.g. "measure:M8", "promise:schools-nura", "event:heating-almaty", "forgotten:baikonur"
  kind: "measure" | "promise" | "event" | "forgotten";
  districtId: DistrictId | null;   // null = city-wide
  author: string;                  // fictional Kazakh/Russian name, e.g. "Айгерим С."
  handle: string;                  // e.g. "@aigerim_nura" (latin, fictional)
  sentiment: Sentiment;
  /** Probability of a supportive reaction that was used for the draw (0..1), for transparency in the UI. */
  supportChance: number;
  likes: number;
  dislikes: number;
  reposts: number;
  /** Short Russian fact phrases the post is about, e.g. "Поликлиника в Нуре", "Школы в Нуре: 38 → 48". May contain numbers. */
  facts: string[];
  /** Fallback Russian post text (1–2 sentences, informal social-media tone, NO digits at all). */
  text: string;
};

export function hashSeed(s: string): number;          // e.g. FNV-1a 32-bit
export function rng(seed: number): () => number;       // e.g. mulberry32, returns [0,1)

export function buildSocialFeed(args: {
  plan: Choice[];
  result: SimulationResult;          // official result of the plan (simulate(plan))
  mods: ModsOutcome;                 // from runMods(...) — emergencies/promises/anger may each be null (mod off)
  seed: string;                      // e.g. JSON of the plan + responses; same seed => identical feed
}): SocialPost[];
```

Rules (keep coefficients as named constants at the top so they are easy to tune; they are game assumptions):
1. One "measure" post per chosen measure. District measure → its district; city measure → the district whose district score D improved most (still kind "measure"). `supportChance = clamp(0.5 + 0.06·ΔD_district + 0.2·(critical indicators fixed in that district) − (anger/250 if mods.anger) , 0.05, 0.95)`, ΔD = districtScores − baselineDistrictScores. Also slightly lower support for long lags (lag ≥ 3 → −0.1: "обещают только через год").
2. For each promise in `mods.promises` (if not null): kept → supportChance 0.8, broken → 0.12. District = promise.districtId.
3. For each emergency in `mods.emergencies` (if not null): response id "none" → 0.15, "full" → 0.75, anything else → 0.45. District = event.districtId.
4. "forgotten": the weakest district after the plan (`result.weakestDistrict`) gets one post if NO chosen district measure targets it → supportChance 0.2.
5. Sentiment draw: u = rng(); u < supportChance → "support"; else u < supportChance + (1 − supportChance)·0.35 → "neutral"; else "angry".
6. Audience = round(150 + population_share·5000·(0.6 + 0.8·rng())) (city-wide posts use 0.3 as the share). likes = round(audience·(support ? 0.7 : neutral ? 0.35 : 0.1)·(0.8+0.4·rng())), dislikes = round(audience·(angry ? 0.5 : neutral ? 0.15 : 0.04)·(0.8+0.4·rng())), reposts = round((likes + dislikes)·0.12·rng()).
7. Each post uses its own generator seeded with hashSeed(seed + "|" + post.id) so adding a post does not change others.
8. `facts`: 1–3 phrases built from real values, e.g. measure title + district, the most-changed indicator of that district "Школы в Нуре: 38 → 48" (use DISTRICTS[d].name, INDICATORS[k].name, 0 or 1 decimal, ru-RU comma), promise text + kept/broken, emergency title + chosen response title.
9. `text` fallback templates in Russian, per kind × sentiment (at least 2 variants each, picked by rng), informal (emoji allowed), mention the district name and the subject, and contain NO digits.
10. Authors/handles: pick from a pool of ≥ 16 fictional names (mix of Kazakh and Russian), handles derived from latin transliteration + district id. Never real public figures.
11. Return the feed sorted by (likes + dislikes + reposts) desc, max 9 posts.

## Tests (`src/domain/social.test.ts`, names start with "Social:")
- deterministic: same inputs → deep-equal feed; changing seed can change sentiments (find a seed pair that differs, or assert that over 20 seeds not all feeds are identical).
- broken promise ("schools-nura" broken with a plan that does not touch Нура S1) yields a promise post with supportChance 0.12; kept promise yields 0.8.
- emergency response "none" → supportChance 0.15.
- forgotten post exists when no district measure targets the weakest district, and does not exist when one does.
- all supportChance in [0.05, 0.95] (promise/event values as specified), likes/dislikes/reposts are non-negative integers, no digits in any `text`, ≤ 9 posts, sorted by engagement.
Use real plans, e.g. the case example: M7 nura, M8 nura, M10 nura, M12 city, M5 saryarka; build `mods` with `runMods(result, plan, {emergencies:true, anger:true, promises:true}, responses, promiseIds)` from `./mods`.

## Done criteria
- `npx tsc --noEmit` passes; run your tests in-process if `npm test` is blocked by the sandbox, and report the summary.
- Final message: files created, exported API, test summary, any deviation.
