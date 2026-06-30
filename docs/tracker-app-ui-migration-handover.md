# Session Handoff — tracker-app UI migration to Tailwind + shadcn (DONE) + local dev flow + dark mode

## Status: COMPLETE for tracker-app. Deployed.
The whole of `apps/tracker-app` is migrated off the old hand-rolled CSS onto **Tailwind v4 + shadcn/ui**, with a **light/dark/system theme**, plus a proper **local dev + Playwright screenshot loop**. Build + 49 tests green. Committed and deployed to `tutorials-tracker.agrolloo.com`. tracker-app is the reference implementation the other apps copy next.

## What shipped (all in `apps/tracker-app/`)

### UI foundation
- **Tailwind v4** via `@tailwindcss/vite` (no config file). `@` path alias in `vite.config.ts` + `tsconfig`.
- **shadcn/ui** (`new-york`, `components.json`, base `neutral`) — primitives in `src/components/ui/` (button, card, badge, dialog, select, input, tooltip, scroll-area, separator). Uses the unified `radix-ui` package. `cn()` in `src/lib/utils.ts`.
- **`src/client/globals.css`** is the single stylesheet — token spine (primitive → semantic), `:root` (light) + `.dark` blocks, amber `#fb923c` (`oklch(0.77 0.165 54)`) as the one brand accent + focus ring. `color-scheme` follows the theme. **The old `src/client/styles.css` (1.9k lines, warm-amber dark) is DELETED.**

### Theme (light / dark / system)
- `src/client/theme.ts` — applies `.dark` on `<html>`, persists choice in `localStorage` (`tracker-theme`), defaults to **system**, live-syncs when OS theme changes. `initTheme()` is called in `main.tsx` before render (no flash).
- `src/client/ThemeToggle.tsx` — topbar + sign-in button cycling Light → Dark → System (sun/moon/monitor).
- Status colours live in ONE place: `src/client/status.ts` (`TONE_BADGE`/`TONE_DOT`, semantic blue/amber/red/emerald/violet, each with `dark:` variants). Reused by `StatusPill` (exported from `Card.tsx`) everywhere. Any new hardcoded palette colour needs a `dark:` variant.

### Migrated surfaces (every one)
`App.tsx` (topbar, sign-in, view-as picker, banners), `Board.tsx` + `Card.tsx` (work tabs, lanes, cards), `ReviewQueue.tsx`, `CardDetail.tsx` (→ shadcn `Dialog`, all auto-save/transition/gating logic preserved; `ComboSelect` lives here), `PipelineBoard.tsx` (dense table) + `Filters.tsx`, `TeamPanel.tsx`, `AssignmentDefaults.tsx`. No legacy class names remain in `src/`.

### Local dev + design loop (see `apps/tracker-app/LOCAL-DEV.md`)
- `npm run seed:local` — wipes/reseeds **local** D1 with 7 dev personas + 12 demo cards across both pipelines and every status (incl. In Review, Need Changes). Reuses the engine's own `decomposeRow` so it can't drift. `scripts/seed-local.ts`.
- `npm run dev:local` — Vite HMR on **:5173** + wrangler API on **:8787** (proxied `/api`,`/auth`,`/dev-login`). Iterate UI with instant reload; no rebuild/restart. Use **:5173** for design work (`:8787` serves the built `dist/` and needs rebuild+restart).
- `npm run shot -- <persona>` — ad-hoc Playwright screenshot of any board (personas: `sean sam anusha john tara uma riya`). `scripts/shot.ts`.
- `npm run e2e` / `e2e:report` — Playwright smoke specs in `e2e/` (`helpers.ts` has `loginAs`). Vitest excludes `e2e/` (`vite.config.ts` `test.exclude`).
- Dev login is gated by `DEV_AUTH=1` (only in local `.dev.vars`, never prod). Preview persona buttons in `App.tsx` (`DEV_PERSONAS`) are kept in sync with the seed.

## How to run it (fresh session)
```bash
cd apps/tracker-app
npm install
npx playwright install chromium        # once, for screenshots/e2e
npm run seed:local                     # populate local D1
npm run dev:local                      # Vite :5173 + wrangler :8787
# open http://localhost:5173/dev-login?email=seankerman25@gmail.com   (admin, all tabs)
#   or  .../dev-login?email=kushalbakliwal25@gmail.com                 (Sam — Script board)
```
GOTCHA: a stale **service worker** from another local PWA (personal-dashboard "Dashboard" gate) can hijack a port. If a login screen for a different app shows, run in that tab's console: `navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).then(()=>caches.keys()).then(ks=>Promise.all(ks.map(k=>caches.delete(k)))).then(()=>location.reload())`. tracker-app itself ships no service worker.

## Deploy
Standard: `npm run build && npx wrangler deploy` (prod secrets + OAuth redirect already configured; it's already live). `DEV_AUTH`/`NOTIFY_REDIRECT` are NOT set in prod, so dev-login/preview buttons are inert there.

## Verify
`npm run build` (tsc -b + vite build) and `npm test` (vitest, 49 tests) both green. Lint (`npm run lint`) still has the same ~6 **pre-existing** react-hooks/react-refresh errors (e.g. in unchanged `TeamPanel`/`App` effects) — not introduced by this work, not blocking.

## Open / deferred
- **Roll the system out to the other apps** (gym-app, kushal-docs, analytics-app, personal-dashboard): copy `globals.css` token spine + `components.json` + `lib/utils` + shadcn setup; reuse `StatusPill`/theme pattern. tracker-app is the template.
- The two new design skills (`ui-craft`, `ui-craft-dense-dashboard`) + manifest edits + the `tts-transcript-prep` deletion are **still uncommitted** in the repo tree — separate concern, not part of the tracker commit.
- `apps/tracker-app/CLAUDE.md` "Run locally" section predates this flow; could point at `LOCAL-DEV.md`.
- Dark palette is near-neutral warm-dark + amber, tuned for data scannability; adjust tokens in `globals.css` if a shade feels off.

## Running state
- `npm run dev:local` may still be running in a background shell (Vite :5173 + wrangler :8787). No worktrees — work is on `main` per repo convention.
