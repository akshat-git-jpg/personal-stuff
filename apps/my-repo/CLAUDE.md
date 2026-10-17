# apps/my-repo: operating notes

PIN-gated map of this repo's skills, CLIs, MCPs and harness. Worker (Hono) + Vite/React, no database.
Live at `my-repo.agrolloo.com`. Redeployed by the `my-repo` skill, and by itself after any land that touches what
the map draws (`scripts/auto-deploy.sh`, run by `pp-land`; Mac only; log in `~/.local/state/pp-land/*/my-repo-deploy.log`;
`MYREPO_AUTODEPLOY=0` turns it off). Human detail: `README.md`.

## Guardrails

- **The map is generated.** `scripts/scan.mjs` (I/O) feeds `scripts/graph.mjs` (pure, tested in
  `test/graph.test.ts`) and writes `data/graph.json`, which is gitignored and bundled into the Worker
  at deploy. Never commit the graph or hand-edit it; fix the scanner or `data/curated.json`.
- **Names and descriptions only.** The scanner reads user-level MCP names but never their config
  (it holds connection strings), and work-skills as name + description. Keep it that way: the page is
  hosted.
- **The graph is cookie-only.** `/api/graph` uses `requireAuth`. `/api/version` (sha + scan time) is
  public on purpose: the maintainer `my-repo` job reads it. Both tested in `test/auth.test.ts`.
- **Two tabs, then areas (owner design, 2026-10-16).** Personal and Work never mix on one screen; inside a tab the home is a grid of area cards and the map shows one area at a time. Area rules are data in `data/curated.json` (`areas`, `workScope`), applied by `assignAreas` in `scripts/graph.mjs`. A tool another area owns still draws on the map, tagged with its area.
- **Layout and trace live in `src/client/derive.ts`** (tested in `test/derive.test.ts`); components only render.
- `package-lock.json` was seeded from kushal-health's, same reason as there (npm arborist bug on a fresh install).

## Run / deploy

```bash
npm test && npm run typecheck && npm run build
npm run dev:local                         # scan, then wrangler :8787 + vite :5173
npx wrangler dev --port 8791 --local      # serves dist/ + API; then: node scripts/shoot.mjs
npm run deploy                            # scan -> build -> deploy
```

- Wrangler needs Node 22: `. ../../scripts/node22-path.sh` first (the `npm` scripts do it themselves).
- An old `workerd` from another workspace can still hold :8791 and serve a stale graph (check `/api/version`).
  Use another port and pass it: `node scripts/shoot.mjs http://localhost:8792`.
- A workspace `npm ci` can miss rolldown's native binding ("Cannot find native binding"):
  `npm_config_registry=https://registry.npmjs.org/ npm i --no-save @rolldown/binding-darwin-arm64@<rolldown version>`.

`node scripts/shoot.mjs [url]` screenshots Map, Table and Loose ends at 1440 and 390 px into
`.shots/`, clicks a box, searches, and fails on sideways scroll or page errors. Against the live
site set `MYREPO_PIN`.
