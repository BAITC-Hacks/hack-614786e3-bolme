**Build the game around an exact official score and a separate, auditable rehearsal of city operations.** The originality should come from showing *who benefits, who bears the disruption, when benefits arrive, and what happens under stress*.

I read both repository documents fully. No files were modified.

One correction to the brief matters: **the official Score is not generally the average of quarterly Scores.** The lag factor supports time-averaged indicator effects, but `min(D)`, critical thresholds, clipping, and unscaled synergies prevent the same interpretation for the final Score. Below is a timeline design that preserves the formula exactly.

**1. Much of the desired game already exists in the official model.**

| Existing mechanism | What it already represents | How to make players feel it |
|---|---|---|
| District measures versus M2/M6/M12/M14 citywide measures | Local investment versus shared urban systems | A local project lights up one district; a citywide service activates a network across all five. |
| M1+M2, M10+M12, M5+M6 synergies | Complementary infrastructure and institutions | Selecting the second measure reveals an explicit connector: “Adaptive signals make the bus corridor more effective: T1 +2.” |
| M4/M7 conflict within a district | Competition for land | Show one contested development site: park or school. This is an abstract representation of the official constraint, not an actual identified parcel. |
| M5/M13 conflict within a district | Overlapping programmes | Show a warning about duplicated scope before commitment. |
| Global M1/M3 incompatibility | A mandated strategic transport choice | Present it as a **case rule**. Real cities can operate bus lanes and rail together; do not invent an engineering justification for a global ban. |
| M11: B2 +12, T1 −2 | Safety versus vehicle throughput | Show safer crossings alongside slower cars. This already supplies the lead’s desired “benefit with a consequence.” |
| Lags | Procurement, construction, commissioning, delayed service | Keep facilities visibly under construction until their opening quarter. |
| Values below 40 | A scoring threshold for critical service deficits | Display the exact threshold and distance to crossing it. A value of 39.99 triggers the penalty; 40 does not. |
| `0.7 × average + 0.3 × weakest district` | Aggregate welfare versus territorial equity | Show both components separately, including which district currently determines the fairness term. |
| Non-additive contributions | A measure’s value depends on its companions | Use your exact Shapley attribution and explain which threshold or synergy produced the contribution. |

Two limitations deserve explicit acknowledgement:

- **Selection order has no official effect.** Players may choose sequentially, but the final official plan is an unordered set. Actual scheduling, cancellation, and “responding to earlier construction” belong in the consequences mode.
- **Some official effects are educational abstractions.** M9 increasing S1 does not mean a sports hub creates school seats. Likewise, crossing 40 is a scoring discontinuity, not a sudden physical transformation in public services.

Missing mechanisms include transport flows between districts, construction disruption, noise exposure, induced demand, facility operating capacity, maintenance and staffing costs, population growth, uncertainty, emergency response, and public confidence.

The five-point Score band also suggests a design choice: use **district conditions, critical deficits, and service openings** as the main visual feedback. A city should not appear dramatically transformed because its composite score moved from 54 to 55.

**2. Separate the models in both code and the interface.**

Layer 1 should implement the [official dataset and rules](C:/Users/Alinazar/projects/hackthon/alinazar/docs/case/akim-simulator-dataset-and-rules.md) as a pure calculation:

```text
officialResult = evaluateOfficial(officialDataset, fiveDecisions, rulesVersion)
```

It returns validity, spending, final indicators, district scores, population-weighted average, weakest district, critical cells, and Score. Invalid plans receive validation errors, not an official Score.

Use the detailed “maximum two per direction” interpretation by default: the official example itself omits transport. Record this interpretation in the README; offer strict coverage as a separately labelled comparison.

Layer 2 receives a copy of the plan:

```ts
type ForesightConfig = {
  version: string;
  seed: string;
  edges: Edge[];
  assumptions: Assumption[];
  eventDeck: EventDefinition[];
};

type QuarterState = {
  q: number;
  indicators: DistrictIndicatorMatrix; // experimental operational state
  noiseBurden: Record<DistrictId, number>;
  trust: Record<DistrictId, number>;
  projectStatus: ProjectStatus[];
  budget: { spentCapital: number; committed: number;
            responseSpent: number; cash: number };
};

type Consequence = {
  ruleId: string;
  quarter: number;
  causes: string[];                     // measures, events, earlier consequences
  district: DistrictId;
  metric: string;
  delta: number;
  calculation: string;
  assumptionId: string;
};
```

There must be **no path from `QuarterState.indicators` back into `evaluateOfficial`**.

Keep these labels visible:

- **Official Score — case formula**
- **Foresight — experimental assumptions**
- **Event scenario — seed/version**

Every changed number should open its calculation and provenance.

For geography, preserve the case’s five districts. Astana created Сарайшық in 2024, so a five-district map should say **“Case geography: five synthetic districts”**. [Astana administration](https://www.gov.kz/memleket/entities/astana/press/news/details/1251104)

Use this coarse graph, inferred from the 2023 boundary descriptions:

| Connection | Geographic interpretation | Transport weight `g` |
|---|---|---:|
| Нура ↔ Есиль | Same side of the Ishim; boundary around Қабанбай батыр/Қарқаралы | 1 |
| Сарыарка ↔ Байконур | Same Ishim bank; adjoining northern districts | 1 |
| Байконур ↔ Алматы | Same Ishim bank; boundary partly follows Ақбұлақ | 1 |
| Нура ↔ Сарыарка | Across the Ishim | 0.5 |
| Есиль ↔ Байконур | Across the Ishim | 0.5 |
| Есиль ↔ Алматы | Across the Ishim | 0.5 |

This is a **schematic interaction graph**, not a bridge inventory or cadastral map; omit corner-only contacts and model each cross-river connection as an aggregate crossing corridor. The underlying boundaries are described in the [2023 Astana planning document, p. 18](https://www.gov.kz/uploads/2023/6/27/d6104b4749d10f8888d99069a1dc947a_original.2635760.pdf).

For distributing an effect from district `d` to neighbour `c`, define:

```text
Z[d] = sum of baseline transport weights from d
transfer(d,c, fraction, effect)
  = fraction × effect × g[d,c]/Z[d] × population[d]/population[c]
```

The population ratio makes the transferred pool consistent in population-weighted indicator units. Closing a crossing sets its contribution to zero **without renormalizing the remaining edges**. Otherwise, a bridge closure would magically divert all benefits through other routes.

All coefficients below are **proposed game assumptions**, not empirical estimates for Astana.

| Rule | Concrete default, explainable in one sentence |
|---|---|
| **R1. Transport spillovers** | Once M1 or M3 opens, distribute an additional **20% of its full T1 and T2 benefit** across neighbours using `transfer`; do not propagate citywide measures again. |
| **R2. Construction disruption** | During lag quarters, apply local T1 penalties of **−2 for M1, −5 for M3, −3 for M13, and −1 for M7/M8**, with E2 **−2 for M3** and **−1 for M13/M7/M8**, removing them on opening. |
| **R3. Diverted traffic** | Distribute **25% of R2’s local T1 loss** to neighbours using the same transfer formula, representing displaced traffic during works. |
| **R4. Traffic rebound** | After M2 opens, subtract **10% of its full T1 benefit per subsequent quarter**, capped at **25%**, representing partial erosion of initial congestion relief. |
| **R5. Noise nuisance** | Start a synthetic noise-burden index at **50** everywhere; M3 adds **+8 during construction and +3 after opening**, M13 adds **+5 during construction**, M7/M8 add **+3 during construction**, and active M11 subtracts **2**. |
| **R6. Air spillovers** | During winter quarters, active M5 distributes **20% of its full E2 benefit** to adjacent districts using equal adjacency weights and population adjustment; rivers do not attenuate air movement. |
| **R7. Clinic catchments** | Once M8 opens, reallocate **10% of its added S2 benefit** from the host district to neighbours using the transport graph, representing cross-boundary use of a finite facility. |
| **R8. Future operating burden** | In each of years 3–5, charge an indicative annual operating requirement equal to **4% of capital cost for M1/M11; 6% for M3; 8% for M7/M8; 3% for M4/M5/M6/M13; 5% for M9/M10; and 10% for M2/M12/M14**. |
| **R9. Infrastructure dependency** | If a district’s event-adjusted C1 falls below **40**, reduce the operating contribution of active M7/M8 by **25% for that quarter**, representing facilities constrained by utility failures. |
| **R10. Confidence follows experience** | Starting at 50, update synthetic trust as `0.75 × previous + 0.25 × target`, where `target = clip(50 + 2×change in district D − 0.5×change in noise burden, 0,100)`. |

Important implementation details:

- Apply spillovers **once from direct project effects**; never diffuse a spillover again.
- Recompute temporary effects each quarter; do not repeatedly accumulate the same construction penalty.
- Resolve commissioning and responses, then direct effects/construction/events, then spillovers and facility dependencies, then clipping and trust.
- Noise is an illustrative nuisance index, **not decibels**. Trust is a simulated response, **not polling**.
- Air diffusion is deliberately crude: adjacency without wind is a transparent teaching assumption, not an atmospheric model.
- Future opex is a separate obligation, not another subtraction from the official 100-unit capital budget.

A trace should look like:

> **Есиль, Q5, T1 +1.26:** M3 in Нура has opened; `16 × 20% × (1/1.5) × (0.16/0.27)`. Assumption R1. Official Score unaffected.

Under the proposed opex coefficients, the official optimum creates **7.7 units/year**, or **23.1 over years 3–5**, of additional operating requirements. That is a useful conversation about affordability after construction.

**3. Animate Q1–Q8, but distinguish operating conditions from official accounting.**

For the operational timeline, let:

```text
X[q,d,k] = baseline[d,k]
           + Σ fullEffect[m,d,k] × 1(q > lag[m])
```

All five official measures are assumed committed before Q1. Therefore:

| Quarter | Newly active measures |
|---|---|
| Q1 | None; implementation begins |
| Q2 | L=1: M9, M10, M11, M12, M14 |
| Q3 | L=2: M1, M2, M4 |
| Q4 | L=3: M5, M7, M8 |
| Q5 | L=4: M3, M6, M13 |
| Q6–Q8 | Continued operation; foresight consequences and events |

The exact reconciliation is:

```text
officialIndicators
  = clip(mean of the eight UNCLIPPED X vectors + officialSynergyBonus, 0,100)

officialScore
  = officialFormula(officialIndicators)
```

Keep fixed synergy bonuses in a separate **“official interaction bonus”** row. Activating a +2 synergy only after both projects open would time-discount it and violate the rules.

Likewise:

```text
officialFormula(mean(X)) ≠ mean(officialFormula(X))
```

I checked this using the valid optimum from the brief, which has no synergy complication:

- Official Score: **57.236735**.
- Average of eight instantaneous quarterly Scores: **56.580735**.
- Q8 instantaneous Score: **58.2978**.
- The weakest district changes from Нура to Сарыарка in Q5.

That is valuable gameplay: **the city’s bottleneck moves**.

The clean interface has three coordinated displays:

1. **Map:** current-quarter operational conditions, with construction and commissioning.
2. **Official scorecard:** the unchanged full-plan result.
3. **Benefit ledger:** each active quarter earns `fullEffect/8` toward the official horizon-adjusted indicators; at Q8, add the fixed synergy bonus and evaluate the official formula.

The timeline then teaches that “a good final facility” and “two years of lived experience” are different questions without misrepresenting the official calculation.

**4. Events should test preparedness against shared shocks.**

Astana-specific foundations are strong: the administration documents winter pollution from heating and transport, flood-protection and drainage work, school-capacity pressure, blizzards, expanding water infrastructure, and the iKOMEK109 service system. These support the **types of scenarios**, not the invented probabilities or numerical losses below. [Air pollution](https://www.gov.kz/memleket/entities/astana-upr/press/article/details/122840), [flood preparations](https://www.gov.kz/memleket/entities/astana/press/news/details/741612?lang=ru), [school capacity](https://www.gov.kz/memleket/entities/astana/press/news/details/627064?lang=ru), [blizzard warning](https://www.gov.kz/memleket/entities/astana/press/news/details/953763?lang=ru), [water infrastructure](https://www.gov.kz/memleket/entities/astana/press/news/details/1054918?lang=ru), [iKOMEK109](https://www.gov.kz/memleket/entities/astana/press/article/details/99399?lang=ru).

Use Q1/Q5 as winter, Q2/Q6 spring, Q3/Q7 summer, Q4/Q8 autumn. These are two fictional scenario years.

Generate each event independently:

```text
u = first32bits(SHA256(seed + deckVersion + eventId + quarter)) / 2^32
eventOccurs = u < configuredProbability
```

Do not consume a mutable random stream on button clicks. Identical seed/version gives identical hazards regardless of player actions.

All losses below affect **Layer 2 only**. They are illustrative quarterly indicator-point impacts, not estimates of actual damage. “Restore” means offset that event’s loss, capped at the original loss.

| Event and deterministic trigger | Unanswered consequence | Response options |
|---|---|---|
| **Heating-main rupture, Алматы. Q5; p=0.65.** Old-network exposure comes from the case profile. | C1 **−18**, C2 **−5**, for one quarter. | **0:** accept loss. **4:** temporary bypass halves losses. **8:** repair plus temporary supply leaves 25% of losses. |
| **Winter inversion/smog, Сарыарка. Q5; p=0.70.** | E2 **−12**, S2 **−2**, one quarter. | **3:** clean-air rooms/mobile care remove S2 loss but leave ambient E2 unchanged. **7:** emergency clean-fuel support plus care halves E2 loss and removes S2 loss. |
| **Enrolment surge, Есиль. Q3; p=0.60.** | S1 **−10** through Q8. | **3:** school transport restores 4 S1 but adds T1 **−1** for the remaining horizon. **8:** leased classrooms and staffing restore 8 S1 through Q8. |
| **Spring flood pressure, Нура and Сарыарка. Q2; p=0.40.** | Each: C1 **−12**, T1 **−8**, B2 **−4**, two quarters. | **3:** barriers leave 75% of losses. **9:** pumping, barriers and evacuation leave 25% of losses for one quarter. |
| **Blizzard and black ice, citywide. Q1; p=0.65.** | T1 **−6**, T2 **−8**, B2 **−6**, one quarter. | **4:** halve losses in two chosen districts. **8:** halve losses citywide. |
| **Crossing inspection closure, Есиль–Байконур. Q6; p=0.35.** | Both districts: T1 **−10**, T2 **−6**, two quarters; their graph edge closes. | **3:** replacement buses reduce T2 loss to **−2**, leaving other effects. **8:** accelerated works shorten closure and losses to one quarter. |
| **Water-demand surge, Нура. Q7; p=0.50.** | C1 **−14**, S2 **−4**, two quarters. | **4:** tankers restore 6 C1 and 2 S2. **8:** temporary pumping and supply restore 10 C1 and all 4 S2. |
| **Complaint/dispatch overload, citywide. Q4; p=0.40.** | C2 **−10**, two quarters. | **3:** temporary call handlers leave C2 **−5**. **6:** dispatch surge capacity leaves C2 **−2** for one quarter. |

Add four explicit preparedness modifiers:

- Active **M13** in the affected district halves heating/water-event losses.
- Active **M5** in Сарыарка halves the smog event’s E2 loss.
- Active **M14** multiplies heating/flood/water losses by **0.8**.
- Active **M12** halves event-related C2 losses.

Apply preparedness and response fractions multiplicatively, with restored quantities capped so a disaster cannot produce a positive bonus. Hazards stay identical across teams; consequences differ because preparedness differs.

For simultaneous events, reveal them together, allocate responses, then resolve the quarter. The LLM should neither choose the hazard nor set its severity.

**Make reserve actual cash, not an extra score term.**

At commitment:

```text
reserve = 100 − committed project costs
```

In event mode, use a simple expenditure schedule: each project spends `cost/L` at the end of each of its construction quarters.

At the start of quarter `q`:

```text
sunkCost[m] = cost[m] × min((q−1)/L[m], 1)
```

Cancelling an unfinished project releases only its unspent commitment and removes its future benefits. Completed projects provide no refund. Maintain:

```text
spentCapital + remainingCommitments + responseSpent + cash = 100
```

This supports real reallocation without free money or refundable completed buildings.

Keep the original five-measure official plan frozen as the **“Official reference plan — assuming delivery.”** If crisis decisions cancel projects, the operational scenario has diverged; do not present its original Score as the outcome actually delivered.

The reserve dilemma is already compelling:

| Initial plan | Official Score | Available reserve |
|---|---:|---:|
| Best at cost 72 | ≈56.87 | 28 |
| Best at cost 98 | ≈57.24 | 2 |

The extra 26 units buy approximately **0.37 official points**. The 28-unit reserve can fund several responses; the 2-unit reserve cannot fund most single responses. Which policy performs better under events must be computed across the shared scenarios.

For fair competition:

- Separate official and event leaderboards.
- Use the same seed, deck, coefficients, information timing, and response prices.
- Announce event possibilities in advance, while hiding realizations until their quarter.
- Report population-weighted critical-indicator quarters, average district welfare, cancelled projects, and remaining cash.
- For a robustness comparison, evaluate the same **100 published seeds** using the same response policy. A single lucky playthrough is not evidence of resilience.

**5. Keep highways and extra indicators out of Official mode.**

**Recommendation: add noise and operating burden to Foresight; postpone extra construction measures until Extended mode.**

Adding a highway to the official 14 measures changes the feasible set and breaks comparability. The fixed dataset already provides enough material for a distinctive demo.

Use M3 to demonstrate the desired chain:

> Choose rail expansion → construction disrupts streets → neighbours receive diverted traffic → the line opens → neighbouring districts gain access → operating costs remain.

Use M11 to demonstrate a harder value judgement:

> Safer school crossings improve B2 but reduce T1; in Алматы, the official threshold can make the composite result look worse.

That is a meaningful discussion about the scoring system itself.

If an Extended mode is included, make it a separate catalogue and engine, with an explicit **“No official competition score”** label. An illustrative highway chain could be:

| Extended measure | Illustrative assumptions |
|---|---|
| **X1: Urban expressway** | Cost **32**, lag **3**; T1 **+10** on opening, eroding by 1 point per subsequent quarter to a floor of **+6**; E1 **−3**, E2 **−4**, noise burden **+10**. |
| **X2: Acoustic treatment along the corridor** | Cost **6**, lag **1**; noise burden **−6** where X1 operates; no invented air-quality benefit. |

These are design parameters to test, not transport forecasts. Keep extended plans out of official exports and leaderboards.

**6. Government judges will find it credible when assumptions, obligations, and disagreements are inspectable.**

The strongest features are these:

- **An assumptions registry.** Each rule records its coefficient, unit, source or “designer assumption,” applicable horizon, uncertainty range, owner, and version. Distinguish official case inputs, real-world contextual evidence, and experimental coefficients.
- **Sensitivity that reveals policy choices.** Compare `α × D_avg + (1−α) × min(D) − λ × Ncrit` for `α ∈ {0.5,0.7,0.9}` and `λ ∈ {0,1,2}`. Keep `0.7/1` as the official setting. Show whether the preferred plan changes.
- **Honest uncertainty.** For foresight, test spillover fractions **0.10–0.30**, delivery delays **0–2 extra quarters**, and opex multipliers **0.75–1.25**. Call outputs “scenario ranges”; they are not statistical confidence intervals without calibrated distributions.
- **Distributional accounting.** Show capital committed by district, citywide investment separately, direct and spillover benefits, critical deficits remaining, and where construction burdens fall. Do not allocate all citywide spending to one district for presentation convenience.
- **Delivery and operating responsibility.** Each project card identifies who builds it, who operates it, its staffing dependency, annual operating requirement, and an observable success measure. This teaches why opening a building is only one part of government work.
- **Physical units where data supports them.** Show actual school seats, travel time, outage-hours, or pollutant concentrations only when those quantities exist. The synthetic indices do not supply valid conversions.
- **References with correct status.** For example, WHO’s PM2.5 guidelines specify **5 µg/m³ annual mean** and **15 µg/m³ over 24 hours**, with the short-term exceedance convention; these are health guidelines, not a conversion formula for E2 or a claim about Kazakhstan’s statutory limits. [WHO guidelines](https://www.who.int/news-room/questions-and-answers/item/who-global-air-quality-guidelines)
- **Reproducibility as a product feature.** Export dataset hash, plan, rule interpretation, official calculation, foresight version, seed, responses, and consequence ledger. Include the exact baseline and case-example checks in the README.

Make the AI coach useful through **counterfactual questions backed by tools**:

> “What is the cheapest valid plan that removes Нура’s critical deficits?”

> “What changes if we reserve 20 units?”

> “Which benefits disappear if the clinic opens two quarters late?”

> “Why does the official formula penalize this safer-crossing plan?”

Code should calculate every answer and return structured evidence; the LLM explains the trade-offs and cites the relevant rule IDs.

For the five-hour build, prioritize the exact engine, a schematic overhead map, the reconciled timeline, three visible ripple rules, two working event cards, and the audit export. Keep the eight-event catalogue data-driven. An asynchronous comparison of plans on the same seed provides most of the competitive value without live multiplayer infrastructure.

The distinctive demo moment is concrete: **a judge chooses the highest-scoring plan, watches its construction and service dependencies, faces a shared winter emergency, and sees exactly what a slightly lower-scoring plan’s reserve would have bought.**