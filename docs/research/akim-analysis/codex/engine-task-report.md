Implemented the domain layer. Created:

- [engine.ts](src/domain/engine.ts)
- [solver.ts](src/domain/solver.ts)
- [rank.ts](src/domain/rank.ts)
- [engine.test.ts](src/domain/engine.test.ts)
- [solve.ts](scripts/sim/solve.ts)
- [generated/solver.json](src/domain/generated/solver.json)

Added the two requested package scripts. Left `types.ts` and `data.ts` unchanged.

Verified **1,181 measure sets / 694,395 valid plans** and deterministic JSON output.

| Mode | Optimal plan | Cost | Score |
|---|---|---:|---:|
| Default | M2, M3@nura, M8@nura, M9@nura, M14 | 98 | 57.236735 |
| Strict | M3@nura, M4@nura, M8@nura, M10@nura, M14 | 93 | 56.34451 |

Whole-project TypeScript checking and linting of the created TypeScript files pass.

Test summary using the in-process runner:

```text
tests 29
pass 29
fail 0
skipped 0
```

**Execution deviation:** `npm test` and `npm run sim:solve` were attempted but blocked by this environment’s child-process restriction (`spawn EPERM`). The same tests and solve script ran successfully using the installed TypeScript compiler in-process.