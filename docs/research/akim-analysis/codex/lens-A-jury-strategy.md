**Build “Akim: Defend Your Budget”: a five-decision city simulator where players see consequences, diagnose a bad outcome, and defend their trade-offs with help from an AI coach.** Use a simple overhead district map. Make the distinctive feature the quality of the explanation and the ability to verify a better alternative.

I read both the [case brief](<C:/Users/Alinazar/projects/hackthon/alinazar/docs/case/HackAlem AI_ «Аким на 5 часов» - AI-симулятор управления городом.md>) and the [dataset and rules](C:/Users/Alinazar/projects/hackthon/alinazar/docs/case/akim-simulator-dataset-and-rules.md) fully. No files were modified. The evidence targets below are my interpretation of the rubric, not additional organizer requirements.

**1. Rubric → evidence map**

| Rubric line | What the judge should see in the demo | What the judge should find in the repo | Typical point loss |
|---|---|---|---|
| **Fit and functionality — 25** | A complete journey: identical starting city and 100 budget → five legal decisions → computed indicators and Score → understandable explanation. Change a decision and repeat successfully. | A requirement-to-feature checklist; explicit validation rules; baseline and official-example fixtures; documented demo scenarios. | Attractive map with an incomplete decision loop; allowing four or six decisions; ignoring incompatibilities; explanations disconnected from displayed results. |
| **Technical implementation — 25** | Immediate deterministic calculations; intelligible validation errors; AI explaining actual evidence. If agentic behavior is claimed, show a real tool call and its returned result. | Separate data, validator, simulator, and AI adapter; typed input/output contracts; meaningful calculation tests; server-side key handling; architecture matching the implementation. | LLM arithmetic; frontend-only validation with an unvalidated API; unexplained “multi-agent” branding; prompt instructions presented as a guarantee against fabricated numbers. |
| **README and reproducibility — 25** | A saved scenario can be reopened and reproduce its numeric result. Briefly show the documented startup and verification commands. | Exact prerequisites, dependency lockfile, environment-variable example, launch/test commands, source-data provenance, rule interpretations, architecture, walkthrough, expected outputs, limitations, and actual Codex-use evidence. | Missing API configuration; undocumented services; stale commands; screenshots without runnable code; README describing planned features as implemented. |
| **Value and applicability — 15** | A user discovers a counterintuitive consequence, understands who benefits, and makes a better-informed decision. Explain the target use: training, classroom exercises, or facilitated policy discussion. | A specific user and workflow; worked examples; explanation of what the synthetic model supports; credible route to calibrated data and expert review. | Generic claims about “smart cities”; maximizing a number without explaining distribution; portraying synthetic outputs as real Astana forecasts. |
| **Development potential and originality — 10** | One memorable interaction: “Why did a safety investment hurt my score?” followed by evidence and a verified repair. Ideally, the user can defend a cheaper or more equitable alternative. | The distinctive mechanism explained and reproducible: counterfactual comparison, exact benchmark, or attribution. A short extension path with genuine prerequisites. | Claiming originality from a chatbot, map, or voice interface alone; ambitious roadmap unsupported by the prototype; adding features that weaken the core. |

The five acceptance checks deserve their own explicit verification:

| Acceptance check | Demo evidence | Repository evidence | Common mistake |
|---|---|---|---|
| **Same starting budget and data** | Reset or open a second scenario: budget 100, identical district values, baseline **52.55768**. Display dataset/rules version. | One canonical dataset and rules configuration; provenance to supplied materials; deterministic initialization; dataset fingerprint. | Random starting conditions, user-specific budgets, or quietly “improved” data. |
| **Cannot exceed budget** | Attempt a five-measure replacement that would exceed 100. The application rejects it and identifies the cost violation. | Authoritative validation before scoring and AI analysis; a fixture that violates budget while satisfying the other rules. | Disabling a button while accepting the same invalid plan through another path. |
| **Decisions change indicators** | Show a named indicator before and after, including district scope, lag-adjusted effect, and any synergy. A city measure visibly reaches all five districts. | Tests for district versus city scope, lag, fixed synergy bonuses, clipping, and negative effects. | Animating colors without changing model state; applying district effects citywide. |
| **AI explains outcomes and trade-offs** | AI references the actual plan, a benefit, a drawback, and why the Score changed. Each numerical statement can be traced to the calculation panel. | The exact evidence payload, prompt/output schema, representative transcript, and grounding checks. | Generic praise; invented effects, residents, savings, or causal explanations. |
| **Changing decisions changes Score** | Compare two known legal plans with different outcomes—for example, the supplied example **56.54307** and optimum **57.236735**. | Regression fixtures for both plans and a test that edits trigger recomputation. | Stale cached explanations or scores; comparing a legal plan with an illegal one. Different plans can legitimately tie, so do not enforce artificial uniqueness. |

**2. How to balance uniqueness against the weighting**

**Seventy-five points concern whether the required system works, how it is implemented, and whether judges can reproduce it.** Originality shares its ten points with development potential; there is no separate ten-point prize for spectacle.

The correct ambition is **one distinctive mechanism supported by an exceptionally inspectable implementation**.

Uniqueness earns points beyond its own category when it does useful work:

- **Technical:** exact search supplies verified alternatives; structured evidence constrains AI explanations.
- **Value:** a player understands why a beneficial local intervention can worsen the overall result.
- **Fit:** the AI clearly explains consequences and trade-offs.
- **Reproducibility:** saved scenarios let reviewers reproduce the surprising result.

An elaborate 3D city primarily buys presentation appeal. An auditable counterfactual coach can support four rubric categories.

Protect **1.5–2 person-hours for documentation and independent startup verification**, plus integration buffer. Do not leave the README until the last fifteen minutes. With repository review happening later, it is part of the delivered product.

**3. Ambiguities: recommended positions**

| Issue | Recommended stance |
|---|---|
| **Five decisions across five directions versus maximum two per direction** | Default to **exactly five distinct measures, maximum two per direction**, with all five directions available. The detailed rules explicitly say this, and the supplied valid example omits transport. Document the interpretation. If organizers clarify otherwise, switch validation to one per direction and recompute benchmarks. A strict-mode option is cheap insurance only after the core works. |
| **Must AI be agentic?** | No explicit requirement says so. The rubric says “AI/agentic AI,” and the detailed rules specify an LLM that explains code-computed results. A strong grounded explanation satisfies the stated AI role. If you claim an agent, implement a genuine bounded tool loop; do not rename a single prompt. |
| **May we change the formula?** | Preserve the official formula for assessed results. Alternative objectives can appear as supplementary comparisons, with the official Score still visible. Do not replace its weights to make gameplay more exciting. |
| **“Unified budget for all users”** | Every independent scenario starts with **100 units**. It does not imply a shared wallet, synchronized multiplayer treasury, or database-backed accounting. |
| **How do we prove the same data for all teams?** | You can prove your application uses the supplied data consistently. You cannot prove what other teams loaded. Preserve source materials, document transcription, expose a version/fingerprint, and reproduce the supplied baseline and example. A hash proves consistency, not organizer endorsement. |
| **Can incomplete plans receive Scores?** | The rules say invalid plans receive no Score. During drafting, show cost, effects, and validation status. Display the no-action baseline as a reference, not an eligible submission. Reserve official scenario Scores for legal five-measure plans. |
| **Can decisions affect neighboring districts or depend on earlier choices?** | Only through effects actually specified: citywide measures, synergies, incompatibilities, and the global scoring formula. Selection order explicitly does not matter. A new road causing noise, displacement, or adjacent-district congestion would be an invented extension. |
| **Are improvement recommendations optional?** | The main task mentions recommendations, while the optional list includes scenario improvement recommendations. Ship a short grounded recommendation in the basic AI analysis. Treat a validated replacement plan with a computed improvement as the optional enhancement. |
| **What rounding should be used?** | Compute without intermediate rounding; round presentation only. Check `<40` against underlying values, not their formatted display. |
| **May unexpected events alter budget or data?** | Only in a clearly separate experimental scenario. The official comparison must preserve the common starting conditions. Event mode requires new assumptions about cancellation, committed spending, and reallocation. |

**One correction to the supplied facts matters:** `(8−L)/8` supports an activation-time interpretation of additive effects, but it does **not** make the official Score the average of quarterly Scores. The critical-value penalty and minimum are nonlinear; clipping can also break equivalence, and synergy timing is unspecified.

I checked the optimum using your proposed “switch on at quarter L+1” interpretation:

- Official Score: **57.236735**
- Average of the eight quarterly Scores: **56.580735**

A timeline can illustrate activation lags. Do not claim it reproduces an exact quarterly quality-of-life average. Keep the official result labeled as the model’s horizon-adjusted evaluation.

**4. Which computed facts are product gold?**

| Fact | Product treatment | Demo/README treatment |
|---|---|---|
| **The whole search space is solvable** | Offer “Find a stronger plan” or “Show the best plan under my constraints.” Code searches; AI explains the returned alternatives. | Describe exhaustive enumeration, validity filtering, counts, and tie handling. Report measured runtime with environment details. Claim optimality only for the named dataset, rules, and objective. |
| **The Score occupies a narrow band** | Show the absolute Score alongside **gain versus baseline**, **gap to optimum**, and optionally **percentile among valid plans**. | Explain why 56.54 is excellent in this model. Never present percentile as measured quality of life or a likelihood of success. |
| **The official example is already exceptionally strong** | Include it as a reproducible preset and onboarding example. | Show that your engine reproduces **56.54307**. The example captures about **85.2% of the available improvement**, giving the judge context for small remaining gains. |
| **Threshold traps** | Highlight indicators approaching or crossing 40; clicking a warning reveals the exact effect and penalty. | Lead the demo with a legal plan whose average improves while its final Score falls. This proves both technical correctness and educational value. |
| **Efficiency versus equity** | Display population-weighted average, weakest-district score, and critical-count penalty separately. Let users compare alternatives on these components. | Explain that targeting Нура follows the scoring model’s priorities. It is a conclusion within the synthetic model, not a universal prescription for Astana. |
| **Diminishing returns** | Compare the cost-72 plan with the cost-98 optimum: approximately **56.87 versus 57.24**. | Explain that the extra 26 units buy about 0.37 points. Unspent funds receive no official bonus; any preference for savings is the user’s additional value judgment. |
| **Exact attribution with five decisions is cheap** | Optional contribution view using Shapley values, including an explanation that interactions are shared across measures. | Verify contributions sum to the total gain. Distinguish allocated model contribution from real-world causal impact. Internal subset evaluations are analytical intermediates, not legal submissions. |

Two findings belong primarily in the README or coach evidence panel: **M8’s prevalence among top plans** and **Нура’s concentration of district investments**. They help explain the model; they are weak headline product features.

The solvable space also changes the game design. Once the optimum is revealed, repeated score chasing has limited depth. The durable exercise is:

> “Understand why this plan wins, what it sacrifices, and whether you would defend it.”

That supports the team lead’s educational ambition without inventing new physics.

**5. Five-hour scope for two people**

Estimates below are **person-hours**, with ten available in total. They assume a familiar application stack and that the enumeration work described in the brief can be reused.

**Tier 0 — must ship: 6 person-hours**

| Deliverable | Estimate | Requirement covered |
|---|---:|---|
| Canonical data, pure calculation engine, all validity rules, meaningful fixtures | 1.5 | Common starting conditions; budget control; indicator changes; correct Score |
| Complete interface: five decision slots, all directions, district assignment, budget, validation, before/after results | 1.5 | Required decision journey and visible consequences |
| Real AI explanation using computed evidence: strengths, risks, trade-offs, grounded advice; timeout/error behavior | 1.0 | AI analysis and clear explanation |
| README, reproducible setup, environment example, scenario presets, Codex-use evidence, independent launch | 1.5 | Reproducibility and mandatory development-tool evidence |
| End-to-end integration and acceptance walkthrough | 0.5 | Working system rather than disconnected components |

A simple district table is enough for Tier 0. The engine should expose measure-level indicator effects, active synergies, and Score components. Do not falsely add independent “Score contributions” when nonlinear interactions are present.

**Tier 1 — the case’s optional features**

| Optional feature | Estimate | Decision |
|---|---:|---|
| **District visualization** | 0.5 | **Build.** Five labeled SVG regions, selection, before/after coloring, critical-value markers. Treat it as a schematic if boundaries are approximate. |
| **AI improvement recommendations** | 1.0 | **Build.** Retrieve legal computed alternatives, then explain them. Allow a useful constraint such as keeping a chosen measure or imposing a spending ceiling. |
| **Team comparison** | 0.5 | **Build only as local A/B comparison or saved scenario import/export.** Label whose plan it is. No accounts or live leaderboard. |
| **Unexpected events and reallocation** | 1.5–2.5 | **Cut today.** Too many new rules and comparison problems for the remaining time. |
| **Automatic short presentation** | 0.5–1.0 | **Stretch only.** A printable one-page briefing from the existing result view. Cut PPTX generation and slide editing. |

Recommended Tier 1 spend: **2 person-hours**.

**Tier 2 — stand-out originality: 0.5 person-hours**

Add a **“Defend your budget” debrief** to the existing recommendation flow:

1. Show the player’s result relative to the verified best result.
2. Surface one consequential trade-off.
3. Offer a computed alternative and ask the player to keep or replace the plan.
4. Preserve their choice and rationale in the result summary.

This is a small interface layer over work already required. It does not need a separate debate system.

Exact Shapley attribution is a worthwhile **0.5–1 hour replacement feature** if the implementation is already close. It is not essential to the winning demonstration. A full timeline is lower priority.

**Reserve the remaining 1.5 person-hours for integration, clean startup, README corrections, and rehearsal.**

Suggested division:

- **Hours 0–1.5:** person A owns data/engine/tests; person B owns the complete interaction.
- **Hours 1.5–3:** A integrates AI and the end-to-end flow; B writes and verifies documentation. **Tier 0 must work by hour 3.**
- **Hours 3–4.25:** add the selected map, comparison, verified recommendations, and debrief.
- **Hours 4.25–5:** feature freeze. Fix, reproduce, document, rehearse.

If the enumerator is not reusable, consume the comparison/debrief allocation before sacrificing core verification.

**Cut brutally:** real-time multiplayer, WebSockets, accounts, matchmaking, persistent leaderboards, 3D buildings, GIS ingestion, traffic simulation, invented noise mechanics, voice integration, Telegram delivery, autonomous-agent societies, multiple languages, and arbitrary scenario generation. Your voice and bot strengths do not automatically make those the best use of these five hours.

**6. Three-minute demo**

Use prepared presets and real interactions. The following opening uses a **legal five-measure plan I independently calculated from the supplied rules**:

`M9@Байконур + M11@Алматы + M10@Байконур + M12(city) + M4@Байконур`

Cost: **61**. Score: **52.42381625**, below the baseline **52.55768**.

| Time | On screen | What to say/do |
|---|---|---|
| **0:00–0:25** | Overhead district map, five selected measures, budget **61/100**, Score **52.42**, baseline **52.56**. | “We invested in sport, street safety, green space, and city services. The city’s average indicators improved—but our official result got worse.” Open the warning. |
| **0:25–0:50** | Алматы indicator inspector: road safety improves; T1 falls **40 → 38.25**; critical count rises **2 → 3**. AI explanation beside the evidence. | “School crossings improve safety but reduce road throughput. Crossing this threshold adds a full penalty point. The coach explains the specific trade-off from the calculation.” |
| **0:50–1:15** | Move only M11 to Байконур. Score becomes **53.36452625**; cost remains **61**. A/B comparison stays visible. | Make the move by roughly **0:58**. “Same measures, same spending, different placement: almost one point recovered.” Show that the AI explanation updates with the plan. |
| **1:15–1:40** | “Find a stronger plan.” Computed recommendation: optimum **57.236735**, cost **98**. Show the tool result and concise explanation. | “The search checks legal plans. The AI explains the answer. This optimum targets Нура with local measures and also improves all districts through city measures.” |
| **1:40–2:05** | Cost-72 alternative beside cost-98 optimum; average, weakest district, and critical-count components. | “The final 26 budget units buy roughly 0.37 points. The official objective prefers the higher score. A decision-maker may still want to discuss the cost.” |
| **2:05–2:30** | On the optimum, attempt replacing M9 with M7: cost becomes **112**. Replacement is rejected. Then reopen the official example preset. | “Invalid plans cannot receive a Score. The supplied example reproduces at **56.54307**.” This replacement isolates a budget violation while retaining five measures and valid direction counts. |
| **2:30–3:00** | Result summary, then README showing startup, verification, source rules, architecture, and actual Codex-use evidence. | “Every result can be reproduced from the supplied data and a saved plan. This is an educational simulator using the official synthetic model. Our next step is expert-calibrated scenarios.” |

The first minute establishes a problem, explains its mechanism, and begins the repair. Do not spend it introducing the team, narrating infrastructure, or scrolling through the catalog.

For a network failure, keep deterministic results usable and clearly label any saved AI explanation as recorded. Do not present a cached response as a live model call.

**7. Seven ways you could lose despite a strong idea**

1. **The engine disagrees with the source.**  
   Mitigation: gate the build on the exact baseline and example, plus lag, synergy, incompatibility, `<40`, and invalid-plan tests. Review generated calculation code manually.

2. **The AI invents the explanation’s most convincing detail.**  
   Mitigation: supply explicit evidence and constrain numerical outputs to verified references or code-rendered values. Prompting alone is insufficient. Reject unsupported recommendations before displaying them.

3. **The judge cannot reproduce the project.**  
   Mitigation: have the teammate who did not write the startup instructions follow them from a clean environment. Document real versus fallback AI behavior and all required configuration.

4. **The team builds the imagined game instead of completing the assessed simulator.**  
   Mitigation: enforce the hour-three Tier 0 checkpoint and hour-4.25 feature freeze. Any additional feature must reuse an existing calculation or result component.

5. **Claims of realism undermine credibility.**  
   Mitigation: label synthetic data, explain model limitations, preserve order independence, and avoid invented neighborhood spillovers. Present calibration as future work with identifiable data requirements.

6. **The optimum makes the game feel solved and the AI redundant.**  
   Mitigation: make the coach responsible for understanding constraints and explaining defensible choices. Explain openly that exact optimization is available; learning and deliberation provide the experience.

7. **The demo and README fail to prove the claimed work—including mandatory Codex use.**  
   Mitigation: preserve genuine development evidence, commit reproducible scenario fixtures, document only implemented features, and rehearse the three-minute evidence sequence. A judge should be able to verify the central claim without reconstructing your intentions.