# apps/kushal-salary: operating notes

PIN-gated salary tracker. Worker (Hono) + D1 + R2 + Vite/React. Human detail: `README.md`.
Payslips and mail notes are added by the `kushal-salary` skill, never through the UI.

## Guardrails

- **Never commit real salary data.** No payslip numbers, PDFs, names, PAN, UAN, account numbers
  or the employer's name in git, docs, memory or decisions. Fixtures are synthetic
  (`test/fixtures/`, company `TEST COMPANY`). `.ingest.env` and `.dev.vars` are gitignored.
- **Numbers and events come only from `src/shared/salary.ts`.** The UI never re-derives them;
  view arrangement lives in `src/client/derive.ts`. `HIKE_MIN_FRACTION` (5%) changes only with
  the owner, with `test/salary.test.ts`.
- **The parser is `scripts/parse-slip.mjs`** (pure, RazorpayX `pdftotext -layout` text). It
  handles the plain layout and the arrears layout whose labels wrap above and below the number
  row. A new layout: add a synthetic fixture and a test in `test/parse.test.ts` first.
  `push-month.mjs` refuses a PDF whose checks fail (net = gross - deductions, items add up).
- **Screens (owner-approved design, 2026-10-08):** tab "Every month" (`MonthsTab.tsx`,
  `MonthChart.tsx`) and tab "Timeline" (`TimelineTab.tsx`). The chart is a line chart (owner
  rejected stacked bars as cluttered): solid line = paid that month, dashed = normal pay, amber
  dot = payout month, vertical markers = promotion / hike, with a crosshair readout on hover,
  tap or arrow keys. It draws at the box's real pixel width (ResizeObserver).
- **Money is shown in full** (`inr()`, e.g. ₹1,85,846), never rounded to k / L (owner, 2026-10-08).
- **PDFs are cookie-only.** `GET /api/months/:month/pdf` and `/api/notes/:id/pdf` use
  `requireAuth`, never `requireAuthOrIngest`. Tested in `test/auth.test.ts` and `scripts/smoke.sh`.
- **Re-pushing a month replaces its items** and keeps its stored PDF. Same for notes.
- `package-lock.json` was seeded from kushal-health's: a fresh `npm install` hits an npm
  arborist bug (`Cannot read properties of null (reading 'edgesOut')`).

## Run / deploy

```bash
npm run typecheck && npm test && npm run build && bash scripts/smoke.sh
npm run deploy   # first deploy steps: README.md
```
