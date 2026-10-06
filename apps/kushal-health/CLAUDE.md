# apps/kushal-health: operating notes

PIN-gated health tracker. Worker (Hono) + D1 + R2 + Vite/React. Human detail: `README.md`.
Reports are added by the `kushal-health` skill, never through the UI.

## Guardrails

- **Never commit real health data.** No report values, JSON, PDFs, lab ids or patient names in
  git, docs, memory or decisions. Test fixtures are synthetic (`test/fixtures/`, lab `Test Lab`).
  `.ingest.env` and `.dev.vars` are gitignored.
- **Status and trend come only from `src/shared/status.ts`.** The UI never re-derives them.
  `BORDER_FRACTION` and `STEADY_FRACTION` change only with the owner, with the table tests.
- **PDFs are cookie-only.** `GET /api/reports/:id/pdf` uses `requireAuth`, never
  `requireAuthOrIngest`; a leaked ingest token must not download reports. Tested in
  `test/auth.test.ts` and `scripts/smoke.sh`.
- **Re-pushing a report id replaces its results** and keeps its stored PDF.
- **Marker keys are chart-line identity.** Never rename a key once data uses it.
- `test/fixtures/report.json` and `report-older.json` are generated from `test/fixtures/blood.ts`;
  a test fails if they drift.
- `package-lock.json` was seeded from closet-app's: a fresh `npm install` here hits an npm
  arborist bug (`Cannot read properties of null (reading 'edgesOut')`).

## Run / deploy

```bash
npm run typecheck && npm test && npm run build && bash scripts/smoke.sh
npm run deploy   # first deploy steps: README.md
```
