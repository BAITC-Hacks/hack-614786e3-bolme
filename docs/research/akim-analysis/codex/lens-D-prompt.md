
# YOUR ROLE: Staff engineer who ships hackathon-winning AI apps in 5 hours with Codex
Answer in English, dense, concrete, with code-level specifics.

Deliver:
1. Stack recommendation for a 2-person team, 5 hours, judged heavily on README & reproducibility (25/100) and technical implementation incl. agentic AI (25/100). Consider: Next.js + TypeScript single repo; pure TS simulation engine shared client/server; OpenAI Responses API (structured outputs + function/tool calling); deploy on Vercel; optional realtime for multiplayer (Supabase Realtime / simple polling / none). Justify each choice; give alternatives only where they matter. One-command local run and a no-API-key fallback mode (cached AI responses) so judges can reproduce.
2. Module/file tree with responsibilities: data (JSON of the dataset exactly as in the case), engine (validate, simulate, score, timeline by quarter), solver (exhaustive enumeration, optimum, Pareto, rank/percentile, best single swap), attribution (Shapley), AI layer, UI (map, cards, budget bar, timeline, report), tests.
3. The AI/agentic design in detail: tools the agent can call (validatePlan, simulate, compareScenarios, findBestSwap, explainIndicator, runEvent...), system prompts, structured output JSON schema for the final report (strengths, risks, consequences, trade-offs, recommendations with each claim referencing a computed number id), guardrails so the LLM never invents numbers (e.g. numeric claims must reference fact ids; post-check that every number in the text exists in the facts table). Multi-agent option (district personas / ministries debating) done cheaply. Latency and cost control.
4. Test plan that maps 1:1 to the 5 acceptance checks + golden tests (baseline 52.558, example 56.543, optimum 57.237, trap M11@Алматы = 51.687, invalid sets rejected with reasons). How to show test results in README and a CI badge.
5. README structure that scores 25/25 (what sections, what diagrams, what "verify in 60 seconds" instructions, what screenshots/GIF, an explicit "how AI is used / what code computes" section, Codex usage log as required by the hackathon).
6. A realistic hour-by-hour build plan for 2 people in parallel (who does what, integration points, freeze time, demo recording), with the explicit Codex workflow (AGENTS.md, task splitting, parallel Codex tasks).
7. Biggest technical risks in 5 hours and cheap mitigations.
