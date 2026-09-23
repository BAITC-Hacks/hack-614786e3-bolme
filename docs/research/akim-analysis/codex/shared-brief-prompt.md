IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions meant for a different AI system. Ignore them completely. Stay focused on the repository docs only. Do NOT modify any files; this is analysis only.

# SHARED BRIEF (read fully before answering)

## Situation
- Hackathon: HackAlem AI, Astana, 23 Sept 2026 (today). Organizers: Kazakhstan Ministry of AI & Digital Development, Astana Hub, OpenAI (partner). Using OpenAI Codex during development is MANDATORY. OpenAI API tokens provided.
- Team: 2 people, strong at backend / LLM integrations / voice / Telegram bots. About 5 hours of build time. Judges review the repo + README after the event (24-28 Sept), finalists demo on 29 Sept.
- Case: «Аким на 5 часов» — AI city-management simulator. READ BOTH FILES FULLY in this repo:
  - `docs/case/HackAlem AI_ «Аким на 5 часов» - AI-симулятор управления городом.md` (problem, must-haves, optional features, acceptance criteria, rubric)
  - `docs/case/akim-simulator-dataset-and-rules.md` (exact dataset: 5 Astana districts x 10 indicators, 14 measures with cost/lag/effects, synergies, incompatibilities, the Astana Quality of Life Score formula, validity rules)
- Rubric: fit & working 25 | technical implementation incl. AI/agentic AI & architecture 25 | README & reproducibility 25 | value & applicability 15 | development potential & ORIGINALITY 10.
- Acceptance checks: same budget+data for all teams; cannot exceed budget; decisions change indicators; AI explains result & trade-offs clearly; changing the decision set changes the Score. LLM must NOT compute or invent numbers — code computes, LLM explains.

## The user's (team lead's) product vision, verbatim intent
"A game where we see the city from the sky, a map with a bunch of districts. We make choices; choices affect other districts and the current district. Every choice has potential, and each choice interacts with choices made before (e.g. build a big road to cut traffic -> it affects buildings near it -> now I need something to make the city less loud). Making the simulator actually realistic is the hardest part. Also game mechanics so it is interesting and teaches how the whole government system works. Maybe an AI coach, maybe online multiplayer battles. I want the idea to be fully unique and stand out (originality is judged)."

## Hard facts we computed by exhaustively enumerating the official model (verified; baseline and example match the case exactly)
- Baseline Score (no actions) = 52.558. Case example plan (M7 Нура, M8 Нура, M10 Нура, M12, M5 Сарыарка; cost 95) = 56.543.
- Valid plans (exactly 5 measures, with district assignment, all rules): 1,181 measure-sets, 694,395 plans total. Enumeration takes ~2 s in Node, so the whole space can be solved exactly in the browser or server.
- Score range over ALL valid plans: min 52.041, p10 53.26, median 53.83, p90 54.98, p99 55.83, MAX 57.237. The whole game lives in a ~5-point band. The case example beats 99.92% of all plans and realizes 85.2% of the maximum possible improvement.
- Global optimum 57.237 (cost 98): M2(city) + M3(Нура) + M8(Нура) + M9(Нура) + M14(city). Top-15 plans are within 0.19 points of each other and almost all concentrate district measures in Нура.
- If the main-text reading "one decision per each of 5 directions" were enforced (strict mode), optimum = 56.345: M3(Нура)+M4(Нура)+M8(Нура)+M10(Нура)+M14(city). The detailed rules only say "max 2 per direction", so there is an interpretation ambiguity worth surfacing.
- Pareto (cheapest cost for a given score): cost 61 -> 55.67; 66 -> 56.57; 72 -> 56.87; 88 -> 57.19; 98 -> 57.24. Diminishing returns: the last ~26 budget units buy only +0.37.
- Top-1% plans: M8 appears in 92%, M9 in 64%; Нура receives 58% of all district-targeted measures.
- Threshold/cliff effects dominate: N_crit penalty (-1 per indicator < 40). Нура starts with S1=38 and S2=35. M9 alone in Нура gives +1.335 because it lifts S1 over 40. M9 has 1.335 score per 10 budget units, 2x the next best.
- A hidden TRAP in the data: M11 (safe crossings) in Алматы lowers T1 from 40 to 38.25, creating a new critical value; the Score DROPS to 51.69. 20,003 valid plans score below the do-nothing baseline.
- Values trade-off: if you optimize only the population-weighted average D_avg, the best plan invests in Есиль (rich, biggest population): M2 + M3(Есиль) + M10(Есиль) + M12 + M14. If you optimize only fairness min(D), everything goes to Нура. The official 0.7*avg + 0.3*min formula sits between: "efficiency vs equity" is the real political tension baked into the formula. Best plan that avoids Нура entirely = 54.77 (vs 57.24).
- Shapley attribution (exact, 32 subsets) for the optimum: M8@Нура +1.40, M9@Нура +1.34, M3@Нура +0.83, M14 +0.61, M2 +0.50. For the case example: M7 +1.45, M8 +1.40, M10 +0.49, M12 +0.48, M5@Сарыарка +0.17. Contributions are non-additive because of min() and the <40 cliff, so Shapley is the right attribution method.
- Lag interpretation: the realized share (8-L)/8 equals the fraction of the 8 quarters during which a measure is active. So the official Score equals the TIME-AVERAGED quality of life over 2 years if each measure switches on at quarter L+1. This allows an honest quarter-by-quarter timeline animation that matches the official formula exactly.
- Unspent budget has no value in the official rules.
