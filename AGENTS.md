<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: АКИМ · HackAlem, team Bolme

- **3D city scene** (Astana 1:1 from OpenStreetMap, map/3D/drone/tour camera, "stone in the water" hotspots) and **how to plug the simulator into it**: read [docs/city-scene-guide.md](docs/city-scene-guide.md) before changing `src/scene`, `src/city` or adding simulator features. The scene is driven only through the zustand store `src/city/store.ts`.
- Case, dataset and scoring rules: [docs/case/](docs/case/). Product concept: [docs/planning/city-simulator-concept.md](docs/planning/city-simulator-concept.md).
