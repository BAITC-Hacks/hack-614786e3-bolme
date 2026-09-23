**I would build “City Under Oath”: make a plan, face a public hearing, and defend its measurable consequences.** The solver supplies the evidence; AI gives the competing interests a voice. The interesting question becomes: **“Which compromises will you accept, knowing exactly what they cost?”**

That gives the solved model a useful role. Finding the maximum is a short puzzle. Choosing commitments, discovering their consequences, and defending an amendment can sustain a game.

I read both documents fully: the [case brief](<C:/Users/Alinazar/projects/hackthon/alinazar/docs/case/HackAlem AI_ «Аким на 5 часов» - AI-симулятор управления городом.md>) and [dataset and rules](C:/Users/Alinazar/projects/hackthon/alinazar/docs/case/akim-simulator-dataset-and-rules.md). No files were modified.

**First, four design boundaries that matter.**

- **The timeline claim needs correcting.** The lag multiplier can represent time-averaged *indicator effects*. But `Score(average indicators) ≠ average(quarterly Scores)` because of `min()`, critical thresholds, and potentially clipping. I checked your optimal plan: official Score **57.236735**; average quarterly Score under full effects switching on at `L+1` is **56.580735**. Fixed, unlagged synergies introduce another timing ambiguity. Animate delivery, but calculate the official result separately.
- **Decision order has no numerical effect.** A school chosen after a park does not inherit a different effect. Sequential play can reveal information, commitments, and conflicts; it cannot secretly change the formula.
- **District measures have no geographical spillovers.** City measures affect all districts; district measures affect their target. Shared budget, citywide measures, synergies, and the weakest-district term provide the legitimate connections.
- **Use the detailed rules as the default.** Their example explicitly omits transport. Document the interpretation; keep “one per direction” as a separately labelled compatibility mode with its own solver benchmark. Single-measure examples and Shapley subsets are analytical probes, not valid submitted plans.

**1–2. Thirty mechanics, ranked by `(WOW × jury relevance) / hours`**

These are **incremental team elapsed hours**, assuming a working evaluator, validator, reusable enumeration code, basic district map, and OpenAI connection. They are estimates for narrow demo versions, not production features. They exclude the common foundation and final documentation/testing.

WOW and jury relevance: 5 is highest. Risk: 5 is highest. Jury relevance considers the actual rubric, including reproducibility—not just originality.

| # | Mechanic — one-line implementation | WOW | Jury | Hours | Risk | Ratio |
|---:|---|---:|---:|---:|---:|---:|
| 1 | **40-line alarm:** a district indicator crossing 40 triggers an inspection showing the continuous benefit and the separate critical penalty. | 4 | 5 | 0.50 | 1 | 40.0 |
| 2 | **Promise price tag:** pin a political commitment; the solver prints its exact opportunity cost and identifies incompatible promises. | 5 | 5 | 0.75 | 2 | 33.3 |
| 3 | **Optimal-city ghost:** hold a key to overlay the best feasible alternative on your map, showing precisely where your plan differs. | 5 | 5 | 1.00 | 2 | 25.0 |
| 4 | **Two constitutions:** an efficiency cabinet and an equity cabinet propose different investments using the same dataset and budget. | 5 | 5 | 1.25 | 2 | 20.0 |
| 5 | **Witness stand:** an AI resident challenges one decision; you summon an evidence card, answer, or amend the plan. | 5 | 5 | 1.25 | 3 | 20.0 |
| 6 | **Cabinet credit hearing:** ministers claim credit; exact Shapley attribution allocates the improvement and exposes exaggerated claims. | 4 | 5 | 1.00 | 2 | 20.0 |
| 7 | **Hotseat objection:** a second player gets 90 seconds to submit a valid amendment; code shows its benefits and sacrifices. | 5 | 4 | 1.25 | 2 | 16.0 |
| 8 | **Land duel:** park and school proposals occupy one schematic site; dragging both there exposes the official same-district conflict. | 4 | 4 | 1.00 | 1 | 16.0 |
| 9 | **Surgical amendment:** request a target improvement while changing as few decisions as possible; the solver finds the smallest repair. | 4 | 5 | 1.25 | 2 | 16.0 |
| 10 | **Evidence replay:** share a plan that reopens every decision, calculation, objection, and amendment with its rules version. | 3 | 5 | 1.00 | 1 | 15.0 |
| 11 | **Press ambush:** a journalist asks one uncomfortable question about your actual plan; your spoken answer opens supporting or contradicting evidence. | 5 | 4 | 1.50 | 3 | 13.3 |
| 12 | **Model malpractice:** investigate why a sports hub improves the school indicator, separating a model incentive from a defensible real policy. | 4 | 5 | 1.50 | 2 | 13.3 |
| 13 | **Last-26 auction:** inspect frontier plans and decide whether the final 26 budget units justify roughly 0.37 additional Score. | 4 | 5 | 1.50 | 2 | 13.3 |
| 14 | **Socratic budget officer:** predict the consequence before receiving a hint; the coach selects a counterexample to your apparent misconception. | 4 | 5 | 1.50 | 3 | 13.3 |
| 15 | **Co-sign government:** two players alternately choose measures and district assignments, then jointly ratify one valid five-decision plan. | 4 | 4 | 1.25 | 2 | 12.8 |
| 16 | **Invisible cityworks:** citywide operational measures illuminate all five districts, giving maintenance and service reform equal visual presence to buildings. | 4 | 4 | 1.25 | 2 | 12.8 |
| 17 | **Synergy wiring:** connect two measure cards to expose the precise bonus, beneficiary district, and fixed-versus-lagged contribution. | 3 | 4 | 1.00 | 1 | 12.0 |
| 18 | **Ministry of admissibility:** a procedural clerk returns rejected plans with the exact violated rule and a selectable valid repair. | 3 | 4 | 1.00 | 2 | 12.0 |
| 19 | **Eight-quarter openings:** scrub through project openings and active-quarter bars while an adjacent ledger preserves the official lag-adjusted calculation. | 4 | 4 | 1.50 | 2 | 10.7 |
| 20 | **Inherit your rival:** swap plans with another player and improve theirs while preserving one publicly declared commitment. | 4 | 4 | 1.50 | 2 | 10.7 |
| 21 | **Resident diary:** follow one fictional household through changes to represented services; every factual claim links to a district indicator. | 4 | 4 | 1.50 | 3 | 10.7 |
| 22 | **Late petition:** before ratification, receive a new public request and decide whether to revise the plan, with no hidden numerical event. | 4 | 4 | 1.50 | 2 | 10.7 |
| 23 | **Opposition proof contest:** an AI critic must produce a valid counterplan supporting its objection; unsupported numerical criticism is dismissed. | 5 | 4 | 2.00 | 3 | 10.0 |
| 24 | **Near-optimal identities:** discover structurally different plans within a chosen distance of the optimum and compare what each prioritizes. | 4 | 5 | 2.00 | 2 | 10.0 |
| 25 | **Lobby register:** interest groups submit explicit demands; accepting one publishes its beneficiary, constraint, and solver-measured cost. | 4 | 4 | 1.75 | 3 | 9.1 |
| 26 | **Cabinet truth bluff:** identify the minister whose causal claim fails a computed counterfactual test, then reveal the evidence. | 4 | 4 | 1.75 | 2 | 9.1 |
| 27 | **Five-akim negotiation:** district representatives negotiate priorities from computed alternatives while a shared ledger records every concession. | 5 | 4 | 2.50 | 4 | 8.0 |
| 28 | **Audible city:** select a district to hear its service priorities, with critical indicators changing a deliberately abstract soundscape. | 4 | 3 | 2.50 | 4 | 4.8 |
| 29 | **Emergency tabletop:** enter a separate, explicitly modified scenario with deterministic shocks and a newly computed reference solution. | 4 | 3 | 3.00 | 4 | 4.0 |
| 30 | **Live remote battle:** synchronized opponents submit plans and challenge amendments under identical rules, with reconnect and timeout handling. | 5 | 3 | 4.00 | 5 | 3.8 |

The ranking favors small, visible features. It does **not** imply that all six leaders fit alongside the required application in five hours.

**3. Detailed designs for the top six**

**① 40-line alarm — make the scoring discontinuity playable**

**Player verbs:** place, inspect, predict, relocate, repair.

**On screen:** a top-down map of five schematic districts. Selecting an indicator reveals its baseline, resulting value, and a clearly marked 40 boundary. When a valid plan crosses that boundary, the result splits into ordinary weighted changes and the critical-penalty change.

For M11 in Алматы, absent an offsetting transport measure, show:

> Road safety improves. Road decongestion falls from 40 to 38.25. A new critical penalty appears.

The player sees why an apparently sensible intervention can worsen the official result.

**AI does:** asks whether the player wants to preserve the safety improvement, avoid the penalty, or examine a different district. It explains the distinction between the metric’s judgment and a policy judgment.

**Code does:** calculates indicator deltas and penalty changes; finds valid repairs. In incomplete drafts, show indicator previews and validation status, not an official submitted Score.

**Distinctive payoff:** players discover a real trap inside the provided rules. The map becomes something to investigate, with a visible cause for an unexpected result.

**Smallest version:** one selected-indicator panel and one reliable demonstration. No elaborate alert system.

---

**② Promise price tag — turn politics into inspectable constraints**

**Player verbs:** promise, pin, relax, compare, ratify.

**On screen:** three commitment slots beside the five measure slots. Examples:

- Preserve the school proposal in Нура.
- Include at least one locally targeted measure outside Нура.
- Keep total spending below a voluntarily chosen ceiling.

Each accepted commitment displays:

> Best possible Score with this commitment: …  
> Opportunity cost against the unrestricted optimum: …

If several promises cannot coexist, the clerk identifies a conflicting combination and offers a relaxation.

**AI does:** translates a statement into a supported constraint and explains its consequences. The user sees the interpreted commitment before applying it. AI does not decide whether the commitment is morally correct.

**Code does:** filters valid plans and computes `best unrestricted − best under commitments`. Distinguish that from `best under commitments − current plan`: the first is the price of your priorities; the second is an opportunity to implement them better.

**Distinctive payoff:** a low Score can be an intentional, explainable choice. Conversely, “this was unavoidable” becomes a testable claim.

**Smallest version:** three predefined constraint types. Open-ended natural-language political programs are unnecessary.

---

**③ Optimal-city ghost — make the oracle a learning instrument**

**Player verbs:** commit, reveal, overlay, inspect, borrow.

**On screen:** hold Space to switch between your city and the solver’s alternative. Changed project tokens receive outlines; district differences appear in place. A concise comparison shows Score, spending, critical indicators, and weakest district.

Keep the official Score prominent. A secondary improvement ruler can show:

- Baseline: **52.558**
- Case example: **56.543**
- Best possible: **57.237**
- Available improvement captured by the example: **85.2%**

That makes the small numerical range intelligible.

**AI does:** explains the most consequential difference and asks which part of the alternative the player would accept.

**Code does:** supplies the actual optimum for the selected rules and commitments, compares full plans, and validates proposed amendments. Copying one ghost measure may require other changes; never imply every individual substitution is feasible.

**Distinctive payoff:** the benchmark is spatial and actionable. Players can inspect the city they could have produced.

**Smallest version:** two map states and a hold-to-compare interaction. Avoid animated building morphs.

---

**④ Two constitutions — reveal the political assumptions inside optimization**

**Player verbs:** appoint, compare, challenge, choose.

**On screen:** two cabinets submit proposals:

- **Efficiency:** maximize population-weighted `D_avg`.
- **Equity:** maximize the weakest district’s `D`.

Both proposals also display their **official Score**, cost, district outcomes, and critical values. The official formula remains unchanged.

Your supplied results create a strong scene: the efficiency solution favors Есиль; the equity solution concentrates on Нура. The difference is grounded in the objective functions.

**AI does:** presents each cabinet’s strongest argument from computed evidence and identifies the sacrifice it accepts. Avoid cartoon personalities where one is compassionate and the other is selfish.

**Code does:** solves both objectives, handles ties consistently, and evaluates each result under the official rules.

**Distinctive payoff:** players learn that optimization requires a choice of values. “The AI recommends this” becomes insufficient without knowing its objective.

**Smallest version:** two proposal cards and one map comparison. Skip editable weight sliders.

---

**⑤ Witness stand — put the plan under public examination**

**Player verbs:** summon, listen, inspect evidence, answer, amend.

**On screen:** the map remains visible. One fictional resident appears in a compact hearing panel tied to a district and concern. Their statement points to a specific result:

> “I can see improvements elsewhere. Show me what this plan changes for access to primary care here.”

Three actions: **Show evidence**, **Explain the compromise**, **Find an amendment**.

**AI does:** role-plays the concern, chooses an appropriate tool request, and responds to the amendment. A successful exchange involves a changing argument, not merely a different voice reading a report.

**Code does:** provides the district results, retrieves feasible alternatives, and calculates their consequences. AI returns prose with fact references; the interface and TTS insert the formatted numerical facts. Proposed decisions must pass validation.

**Distinctive payoff:** the user must connect a citywide policy to a particular constituency. Voice gives the choice emotional weight without inventing a popularity model.

**Smallest version:** one witness, one follow-up, one amendment. TTS is useful; typed responses should work immediately. Continuous voice conversation is unnecessary.

Treat the witness as a fictional perspective, never a representative survey or a forecast of public opinion.

---

**⑥ Cabinet credit hearing — make attribution a dispute worth resolving**

**Player verbs:** assign credit, hear claims, audit, compare.

**On screen:** five ministers stand behind the five selected measures. Before revealing the result, the player assigns the largest share of credit. An attribution waterfall then reconciles baseline to final Score.

Your optimal plan creates a useful reveal: the inexpensive M9 receives roughly **+1.34**, while M3 receives roughly **+0.83**. Cost and visibility do not determine contribution.

**AI does:** explains why a threshold, synergy, or weakest-district effect changes the allocation. It identifies shared credit rather than attributing the whole synergy to whichever minister speaks first.

**Code does:** evaluates the 32 subsets and computes exact Shapley values. These are internal counterfactual evaluations; they do not bypass the rule that submitted plans require exactly five measures.

**Distinctive payoff:** the app explains a nonlinear result without misleading “individual benefit” bars. It also teaches why departments’ performance claims can double-count shared outcomes.

**Smallest version:** one waterfall with selectable explanations. Make clear that Shapley is a mathematical attribution convention within this model, not proof of real-world causation.

**4. Evaluation of the lead’s ideas**

| Lead’s idea | Decision | Smallest version that still wows | Critical boundary |
|---|---|---|---|
| **AI coach** | **Keep, reshape into a diagnostic coach.** | Ask the player to predict one consequence; use a computed counterexample to address the misconception; offer one valid amendment. | An unrestricted “best plan” assistant ends the optimization puzzle immediately. Let players request hints or reveal the answer deliberately. |
| **Online multiplayer fighting/battles** | **Cut live networking; keep adversarial play.** | A hotseat opponent challenges one choice and submits an amendment. Compare both plans immediately and let the original player defend the sacrifice. | With a public exact solver, a pure maximum-Score contest converges on the same answer. Optional commitments and amendment constraints create different problems; show those conditions explicitly. |
| **Choices affecting other districts** | **Keep the experience through existing connections.** | Citywide measures animate across every district; local decisions expose shared-budget opportunity costs and changes to the weakest-district component. | A local project does not alter another district’s indicators. Do not invent commuter redistribution, pollution drift, or noise effects. |
| **Realism** | **Reshape toward credible decision procedure.** | Draft → rule check → public hearing → amendment → ratification → accountable report. Show lag, opportunity cost, land conflict, and shared credit. | The data is synthetic and the causal model is sparse. A realistic-looking city does not make its forecasts realistic. |

The road → noise → mitigation chain is a promising future game, but this dataset contains neither road construction of that kind nor a noise indicator. Implementing it honestly requires a separate expanded model with explicit assumptions.

For “how government really works,” focus on the distinctions the supplied material can support: **appropriation limits, admissibility, implementation delay, constituency demands, opportunity cost, and KPI incentives**. Actual Kazakhstan Budget Code procedures would require additional sourced material. A fictional clerk should cite the simulator’s rules rather than invent legal requirements.

One especially valuable lesson is already present: **a sports hub lifting a school indicator over a critical threshold can be mathematically excellent and still deserve policy scrutiny.** Teach players to inspect the model they are optimizing.

**5. Three overall product concepts**

**A. CITY UNDER OATH**

**Pitch:** Every city plan must survive a public hearing where every objection can be tested against an exact alternative.

**Core loop:** select five measures on the map → inspect results → hear a constituency challenge → pin a commitment → examine its cost → amend or defend → publish the decision record.

**Signature moment:** a resident asks for a different priority; the player requests an amendment; the map and ledger reveal exactly what must be sacrificed. The resident responds to the revised proposal.

**Why it could win:** a compact interaction combines a working simulator, meaningful AI tool use, explainable trade-offs, voice, and an inspectable decision record.

**Primary risk:** dialogue latency or ungrounded claims. Keep one witness active, bound the exchange, and preserve a useful evidence view while speech loads.

---

**B. EIGHT QUARTERS**

**Pitch:** Sign five projects, then watch the difference between announcing a policy and delivering its benefits.

**Core loop:** draft the full plan → inspect opening dates → scrub through eight quarters → hear delivery-related questions → return to the draft → compare an amended plan.

**Signature moment:** the large LRT project is still waiting while faster measures are already active; the player sees why full benefit and realized contribution differ.

**Why it could win:** a memorable visual explanation of implementation lag, with a natural public-accountability narrative.

**Primary risk:** implying a dynamic simulation that the rules do not supply. All five decisions are made for the same starting horizon; opening animations are explanatory. Show the official Score in its own ledger, and keep untimed synergy bonuses separate. Midterm policy changes and numerical crises belong to a separately labelled extension.

---

**C. THE PRICE OF A PROMISE**

**Pitch:** An exact policy laboratory that tells you what every commitment costs—and how much better you could honor it.

**Core loop:** declare priorities → receive a best feasible plan → inspect alternatives → add or relax a promise → compare opportunity costs → publish a defensible portfolio.

**Signature moment:** excluding Нура changes the best achievable Score from approximately **57.24 to 54.77**. The explanation identifies the critical indicators and weakest-district term responsible.

**Why it could win:** unusually strong technical substance, exact counterfactuals, reproducibility, and a credible path toward decision-support tools.

**Primary risk:** feeling like an optimization dashboard. Use the map as the primary comparison surface and frame constraints as concrete commitments.

**My bet: CITY UNDER OATH, powered by THE PRICE OF A PROMISE.** It fits your backend/LLM/voice strengths and makes the solver visible through an interaction a judge can understand quickly. EIGHT QUARTERS has presentation appeal, but requires more care to avoid overstating what the model simulates.

**What I would actually ship in five hours**

Assuming your existing enumeration code is reusable:

| Time | Deliverable |
|---|---|
| **0:00–1:30** | Exact evaluator and validator; baseline/example checks; solver access; schematic five-district map; five-slot plan editor; required result and AI explanation. |
| **1:30–2:00** | **40-line alarm:** one clear threshold inspection and repair demonstration. |
| **2:00–2:45** | **Promise price tag:** predefined constraints and best-feasible comparison. |
| **2:45–4:00** | **Witness stand:** one grounded hearing, one amendment, optional TTS. |
| **4:00–5:00** | Integration, clean-start check, README, reproducible demo plans, screenshots, model limitations, and actual Codex-development evidence. |

If the evaluator must be rebuilt, cut interactive promise pricing first. Keep a reliable comparison against a verified reference plan.

Use **one LLM orchestrator with a few tools**—evaluate, compare, find a constrained alternative, retrieve evidence. Multiple simulated personas do not require a multi-agent runtime.

The README deserves that final hour: it carries **25 points**. Include the exact interpretation of the rules, reproduced baseline/example, startup instructions, numerical provenance, and a short deterministic demo route. The official Score remains the assessed outcome; commitments and learning feedback stay separately labelled.

**6. Five likely entries to avoid resembling**

These are predictions, not observations of other teams:

1. **Budget sliders plus five colored charts**, followed by a generic AI summary.
2. **A map used as decoration**, where selecting a district merely opens another form.
3. **An omniscient chatbot that outputs the optimal plan**, leaving the user with little meaningful play.
4. **Random disasters and invented consequences**, with the LLM improvising numerical effects.
5. **A maximum-Score leaderboard**, where informed players submit effectively identical Нура-heavy portfolios.