<!-- boss frontmatter -->
---
executor: agy
model: Gemini 3.1 Pro (High)
test_cmd: cd apps/timeblock && npm install && npm run check
ui: true
deploy:
needs: []
---

# Plan 054: timeblock — fast tap-to-block day planner

## Summary

- **Problem statement**: Google Calendar is too slow for quickly blocking time (too many taps, dragging to set times). The owner wants a dead-simple personal web app to lay out a day's time blocks in two taps.
- **Goals**:
  - New deployable `apps/timeblock` — a single-screen responsive web app (phone + desktop).
  - Core interaction (already prototyped & owner-approved): sticky active label + **tap start cell, tap end cell** = a block. Tap same cell twice = a 30-min block. No dragging, no save button, no dialogs. Tap a block to relabel/delete via a bottom sheet.
  - Today-focused single-day grid, 6:00 AM–midnight, 30-min slots, with `‹ ›` day nav and a live "now" line.
  - Shared backend so phone + desktop stay in sync: Cloudflare Worker + **KV**, one JSON blob per day (`day:YYYY-MM-DD`).
  - Password gate via the repo's **stateless signed-cookie** pattern (reuse `lists-app` `auth.ts` near-verbatim). Secrets `APP_PASSWORD` + `SESSION_SECRET`.
  - No build step for the frontend: a single static `public/index.html` served by the Worker via the `ASSETS` binding.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) (standard — nearly every file is inlined here; the executor assembles, wires, and verifies).
- **Done criteria** (terse — full list below): `npm run check` (tsc + vitest) passes; app runs under `npm run dev` and the two-tap flow creates/persists/reloads blocks behind the password gate; screenshot attached.
- **Stop conditions** (terse — full list below): do NOT swap the auth for OAuth/KV-session/DB; do NOT add Google Calendar sync, recurring blocks, drag-to-resize, notifications, or multi-user; do NOT run real `wrangler deploy` (needs owner's Cloudflare account + KV/secret setup).
- **Test / verification for success**: `vitest` unit tests for the pure day-validator + the auth/day API via Hono `app.request` with a mock env (fully offline, no Cloudflare creds); plus a manual screenshot of the running app.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat aa0cea7..HEAD -- apps/timeblock plans/README.md my-hosted-sites.md INFRA.md decisions.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `aa0cea7`, 2026-07-09

## Why this matters

The owner blocks time to structure their day but finds Google Calendar's create-event
flow too slow on mobile — multiple taps, then dragging to set start/end. This app
does exactly one thing fast: two taps drop a labeled time block onto today. It is
deliberately NOT a calendar client (no sync). A clickable front-end prototype was
built and approved; this plan turns it into a real synced, password-gated deployable
following the repo's established Cloudflare-Worker conventions. Intent to preserve:
**speed and zero friction beat features** — if a choice adds taps, it's wrong.

## Current state

This is a brand-new app; `apps/timeblock/` does not exist yet. The plan reuses three
established repo patterns — read these exemplars, they define the conventions to match:

- **`apps/lists-app/src/worker/auth.ts`** — the canonical stateless signed-cookie
  password gate (HMAC-SHA256 over an expiry, `SESSION_SECRET`; no KV/DB). This is a
  documented house guardrail (`decisions.md` 2026-07-01, and `apps/lists-app/CLAUDE.md`:
  "Do NOT replace this with OAuth/KV/database check"). We copy it near-verbatim
  (only the `Env` type and cookie name change). Its full source is Appendix D.
- **`apps/lists-app/src/worker/index.ts`** — the Hono entry pattern: `POST /auth/login`,
  `POST /auth/logout`, `GET /api/me`, an `app.use('/api/*', …requireAuth)` guard, data
  routes, then `app.get('*', c => c.env.ASSETS.fetch(c.req.raw))` to serve static assets.
- **`apps/redirector/wrangler.toml`** and **`apps/lists-app/wrangler.toml`** — the
  Worker config: `name`, `main`, `compatibility_date`/`nodejs_compat`, an `[assets]`
  block with `binding = "ASSETS"`, a KV binding, and a `[[routes]]` `custom_domain`
  entry on the `agrolloo.com` zone (Cloudflare auto-provisions DNS + SSL).
- **`apps/lists-app/test/auth.test.ts`** — the offline test pattern: `import app from
  '../src/worker/index'` then `app.request(path, init, ENV)` with a mock `ENV`. Our
  tests extend this with an in-memory KV mock.

Hosting facts (from `INFRA.md`): Cloudflare account `akshatpatidar17@gmail.com`; zone
`agrolloo.com`. Existing password-gated apps on it: `lists.agrolloo.com`,
`kushal-tools.agrolloo.com`, `yt-analytics.agrolloo.com` — all use `APP_PASSWORD` +
`SESSION_SECRET`. New app domain: **`timeblock.agrolloo.com`**.

The approved front-end prototype (localStorage-backed) is the visual/interaction base;
Appendix A is the FINAL `public/index.html` (prototype ported to call the Worker API
instead of localStorage, plus a password-gate overlay and a save-error toast). Copy it
verbatim — the interaction/CSS is already approved; do not redesign it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install deps | `cd apps/timeblock && npm install` | exits 0, creates `node_modules` + `package-lock.json` |
| Typecheck | `cd apps/timeblock && npm run typecheck` | `tsc --noEmit` exits 0, no errors |
| Unit tests | `cd apps/timeblock && npm test` | vitest: all tests pass |
| Merge gate | `cd apps/timeblock && npm run check` | typecheck + vitest both pass, exit 0 |
| Run locally | `cd apps/timeblock && npm run dev` | wrangler dev serves on `http://localhost:8787` (needs `.dev.vars`) |

## Scope

**In scope** (the only files to create/touch):
- `apps/timeblock/` — entire new app:
  - `public/index.html` (Appendix A), `public/favicon.svg` (Appendix B)
  - `src/worker/index.ts` (Appendix C), `src/worker/auth.ts` (Appendix D),
    `src/worker/constants.ts` (Appendix E), `src/worker/validate.ts` (Appendix F)
  - `test/validate.test.ts` (Appendix G), `test/api.test.ts` (Appendix H)
  - `package.json` (Appendix I), `tsconfig.json` (Appendix J), `wrangler.toml` (Appendix K)
  - `.dev.vars.example` (Appendix L), `.gitignore` (Appendix M), `.npmrc` (Appendix P)
  - `README.md` (Appendix N), `CLAUDE.md` (Appendix O)
- `plans/README.md` — add the 054 row + mark DONE at the end.
- `my-hosted-sites.md` — add the `timeblock.agrolloo.com` row (Step 6).
- `INFRA.md` — add the worker to the Cloudflare Workers list (Step 6).
- `decisions.md` — append the dated decision line (Step 6).

**Out of scope** (looks related, don't touch, because…):
- `apps/telegram-my-planner/` — unrelated (task/routine digest files, not a time-block UI).
- `apps/lists-app/`, `apps/redirector/` — exemplars only; read, never modify.
- Any real Cloudflare deploy, KV-namespace creation, secret upload, DNS — those need
  the owner's account and are the manual runbook in the README (see STOP conditions).

## Git workflow

- Branch: `advisor/054-timeblock-day-planner`
- Commit (per stage is fine): e.g. `feat(timeblock): scaffold worker + auth + KV day store` — no AI footers. Do NOT push.

## Steps

Work in order. Commit after each numbered step so rollback is granular.

### Step 1: Scaffold the app skeleton + config

Create `apps/timeblock/` and add the config files exactly as given:
`package.json` (Appendix I), `tsconfig.json` (Appendix J), `wrangler.toml` (Appendix K),
`.dev.vars.example` (Appendix L), `.gitignore` (Appendix M), `.npmrc` (Appendix P —
pins the public npm registry so `npm install` does NOT 401 against a private
CodeArtifact registry; this is why the exemplar apps carry it). Then install deps:

```
cd apps/timeblock && npm install
```

**Verify**: `cd apps/timeblock && npm run typecheck` → exits 0 (no `src` yet means tsc
has nothing to check; if it errors on "no inputs", that's fine to see resolve after
Step 2 — otherwise exit 0). If `npm install` fails, STOP and report the error.

### Step 2: Worker — constants, validator, auth, entry

Create the four worker files: `src/worker/constants.ts` (Appendix E),
`src/worker/validate.ts` (Appendix F), `src/worker/auth.ts` (Appendix D — copied from
lists-app with the `Env` type and cookie name changed), `src/worker/index.ts`
(Appendix C).

**Verify**: `cd apps/timeblock && npm run typecheck` → `tsc --noEmit` exits 0, zero errors.

### Step 3: Tests — pure validator + API round-trip

Create `test/validate.test.ts` (Appendix G) and `test/api.test.ts` (Appendix H).

**Verify**: `cd apps/timeblock && npm test` → vitest reports all tests passing
(≥ 6 validator assertions + the 5 API tests), exit 0.

### Step 4: Frontend — the approved single-page app

Create `public/index.html` (Appendix A, verbatim) and `public/favicon.svg` (Appendix B).

**Verify**: file exists and is non-empty:
`test -s apps/timeblock/public/index.html && grep -q "tap the end time" apps/timeblock/public/index.html && echo OK` → prints `OK`.

### Step 5: Local smoke test + screenshot (UI gate)

Create a local `.dev.vars` (NOT committed — `.gitignore` excludes it) with a test
password, then run the app and confirm the flow:

```
cd apps/timeblock
printf 'APP_PASSWORD=test1234\nSESSION_SECRET=local-dev-secret-least-32-characters-long\n' > .dev.vars
npm run dev
```

In a browser at `http://localhost:8787`:
1. You should see the password screen. Enter `test1234` → the day grid loads.
2. Tap a start time (e.g. 10:00 AM) then an end time (e.g. 12:00 PM) → a "Deep work"
   block appears spanning the range.
3. Tap the **Gym** chip, then tap two cells → a green Gym block appears.
4. Reload the page → the blocks are still there (proves KV persistence via the API).
5. Tap a block → the bottom sheet opens; relabel it and delete another.

**Attach a screenshot of step 2/3 (a day with a couple of blocks) to the PR** — this
is the `ui: true` gate; `test_cmd` cannot judge how it looks.

**Verify**: the reload in sub-step 4 shows the same blocks (persistence works). If blocks
vanish on reload, the API wiring is wrong — fix before proceeding.

### Step 6: Docs + registry updates

- Create `apps/timeblock/README.md` (Appendix N) and `apps/timeblock/CLAUDE.md` (Appendix O).
- **`my-hosted-sites.md`**: add a row/line for the new site. Match the file's existing
  format; the entry must contain: `timeblock.agrolloo.com` — "fast tap-to-block day
  planner; password-gated (APP_PASSWORD/SESSION_SECRET); Worker + KV (BLOCKS_KV),
  static `public/`; app at `apps/timeblock`". (Not yet live until the owner deploys.)
- **`INFRA.md`**: under the Cloudflare Workers list (near `lists-app`, `kushal-tools`),
  add: `- **timeblock** — \`timeblock.agrolloo.com\` — personal tap-to-block day
  planner. Shared-password gate (stateless signed cookie, no KV sessions). Binding:
  \`BLOCKS_KV\` (KV, one JSON blob per day). Secrets: \`APP_PASSWORD\`, \`SESSION_SECRET\`.`
- **`decisions.md`**: append one dated line:
  `## 2026-07-09 — timeblock day-planner app` … "New `apps/timeblock`: personal
  time-blocking web app. Chose NO Google Calendar sync (self-contained KV store, one
  JSON blob per day) — the point is speed, not calendar integration. Reused the
  lists-app stateless signed-cookie auth (house pattern). No frontend build: single
  static `public/index.html` served via ASSETS. Two-tap block creation (no drag) is
  the core anti-friction decision."

**Verify**: `grep -q timeblock my-hosted-sites.md && grep -q timeblock INFRA.md && grep -q "timeblock" decisions.md && echo OK` → prints `OK`.

### Step 7: Final gate

**Verify**: `cd apps/timeblock && npm run check` → exits 0 (tsc + vitest). Then update
the `054` row in `plans/README.md` to `DONE`.

## Test plan

- **`test/validate.test.ts`** (pure `normalizeDay`): valid blocks pass through; a
  non-array input → `[]`; out-of-range slots dropped; unknown `labelId` dropped;
  `end < start` dropped; overlapping blocks — the later one dropped; ids reassigned
  `1..n` in start order.
- **`test/api.test.ts`** (Hono `app.request` + in-memory KV mock, mirrors
  `lists-app/test/auth.test.ts`): wrong password → 401; correct password → 200 +
  `tb_session=` cookie; `GET /api/day` without cookie → 401; with cookie, `PUT
  /api/day` then `GET /api/day` returns the normalized blocks (round-trip); `GET
  /api/me` reflects auth state.
- **Manual** (Step 5): the two-tap create flow, chip stickiness, persistence across
  reload, relabel/delete sheet — screenshot attached to the PR.

## Done criteria

- [ ] `apps/timeblock/` exists with every file listed in Scope.
- [ ] `cd apps/timeblock && npm run check` exits 0 (tsc clean + all vitest tests pass).
- [ ] Running `npm run dev` + logging in with the `.dev.vars` password shows the grid;
      two taps create a block; blocks survive a reload (KV persistence); relabel/delete work.
- [ ] Screenshot of the running app (a day with blocks) attached to the PR.
- [ ] `my-hosted-sites.md`, `INFRA.md`, `decisions.md`, `plans/README.md` updated.
- [ ] Auth is the stateless signed-cookie gate (NOT OAuth/KV-session/DB).

## STOP conditions

- **Auth**: if tempted to use Google OAuth, KV/DB sessions, or any per-user store —
  STOP. The house pattern is the stateless signed cookie in Appendix D. Do not change it.
- **Scope creep**: if a step seems to call for Google Calendar sync, recurring blocks,
  drag-to-resize, reminders/notifications, or multi-user — STOP and report; all are
  explicitly out of scope.
- **Deploy**: do NOT run `wrangler deploy`, `wrangler kv namespace create`, or
  `wrangler secret put`. Those need the owner's Cloudflare login and are the manual
  runbook in the README. The KV `id` in `wrangler.toml` stays as the placeholder;
  local `wrangler dev` simulates KV and needs no real id.
- If `npm install` or `npm run check` fails after 5 fix attempts on the same error,
  write `BLOCKED: <reason>` in the run-log and STOP.

## Maintenance notes

- **Label set is duplicated on purpose**: `src/worker/constants.ts` (`LABEL_IDS`) and
  the `LABELS` array in `public/index.html` must stay in sync — there's no build step
  to share them. Both files carry a comment saying so. A reviewer changing labels must
  edit both.
- The server's `normalizeDay` is the storage guard — it drops anything malformed or
  overlapping even though the client also prevents overlaps. Keep it strict.
- `SLOTS = 36` encodes 6:00 AM–midnight at 30-min granularity in both places; changing
  the range/granularity means updating `START_HOUR`/`END_HOUR`/`SLOTS` in the HTML and
  `SLOTS` in `constants.ts` together.
- One-time deploy setup (owner, documented in README): `wrangler kv namespace create
  BLOCKS_KV` → paste id into `wrangler.toml`; `wrangler secret put APP_PASSWORD`;
  `wrangler secret put SESSION_SECRET`; `npm run deploy`. The `custom_domain` route
  auto-provisions `timeblock.agrolloo.com` DNS + SSL on the agrolloo.com zone.

---

## Appendix A — `public/index.html` (create verbatim)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
  <meta name="theme-color" content="#f4f6f9" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0e1015" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>timeblock</title>
  <style>
    :root {
      --bg: #f4f6f9; --surface: #ffffff; --surface-2: #fafbfc;
      --line: #e7eaef; --line-strong: #d7dce3; --text: #191c22;
      --text-dim: #667085; --text-faint: #9aa2b0; --accent: #5b5ef0; --now: #ef4444;
      --rowh: 46px; --gutter: 66px;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif;
      --lbl-deep: #5b5ef0; --lbl-meeting: #e8890c; --lbl-gym: #0ea472; --lbl-break: #0891b2; --lbl-personal: #e11d68;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0e1015; --surface: #161922; --surface-2: #1b1f2a;
        --line: #262b36; --line-strong: #333a48; --text: #e9ebef;
        --text-dim: #939bab; --text-faint: #626b7c; --accent: #7d80f5; --now: #f8716b;
        --lbl-deep: #7d80f5; --lbl-meeting: #f5a63a; --lbl-gym: #22c48c; --lbl-break: #22b8d6; --lbl-personal: #f4517f;
      }
    }
    :root[data-theme="light"] {
      --bg: #f4f6f9; --surface: #ffffff; --surface-2: #fafbfc;
      --line: #e7eaef; --line-strong: #d7dce3; --text: #191c22;
      --text-dim: #667085; --text-faint: #9aa2b0; --accent: #5b5ef0; --now: #ef4444;
      --lbl-deep: #5b5ef0; --lbl-meeting: #e8890c; --lbl-gym: #0ea472; --lbl-break: #0891b2; --lbl-personal: #e11d68;
    }
    :root[data-theme="dark"] {
      --bg: #0e1015; --surface: #161922; --surface-2: #1b1f2a;
      --line: #262b36; --line-strong: #333a48; --text: #e9ebef;
      --text-dim: #939bab; --text-faint: #626b7c; --accent: #7d80f5; --now: #f8716b;
      --lbl-deep: #7d80f5; --lbl-meeting: #f5a63a; --lbl-gym: #22c48c; --lbl-break: #22b8d6; --lbl-personal: #f4517f;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--bg); }
    /* Overlays below set an explicit `display`, which beats the UA
       [hidden]{display:none} rule and would keep them permanently visible.
       Make the hidden attribute authoritative so JS toggling .hidden hides them. */
    [hidden] { display: none !important; }
    .app {
      font-family: var(--sans); background: var(--bg); color: var(--text);
      min-height: 100vh; max-width: 540px; margin: 0 auto;
      -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; position: relative;
    }
    .topbar {
      position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 8px;
      padding: 14px 16px 12px; background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--line);
    }
    .nav {
      appearance: none; border: 1px solid var(--line-strong); background: var(--surface); color: var(--text);
      width: 38px; height: 38px; border-radius: 11px; font-size: 20px; line-height: 1; cursor: pointer;
      display: grid; place-items: center; touch-action: manipulation; transition: background .12s, transform .08s;
    }
    .nav:active { transform: scale(.93); background: var(--surface-2); }
    .daterow { flex: 1; text-align: center; }
    .dayname { font-size: 17px; font-weight: 640; letter-spacing: -.01em; }
    .datesub { font-size: 12.5px; color: var(--text-dim); margin-top: 1px; font-variant-numeric: tabular-nums; }
    .chips {
      position: sticky; top: 65px; z-index: 25; display: flex; gap: 8px; overflow-x: auto;
      padding: 11px 16px; background: var(--bg); border-bottom: 1px solid var(--line); scrollbar-width: none;
    }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      appearance: none; flex: 0 0 auto; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 13px 8px 11px; border-radius: 999px; border: 1.5px solid var(--line-strong);
      background: var(--surface); color: var(--text); font-size: 13.5px; font-weight: 550;
      font-family: var(--sans); touch-action: manipulation; transition: border-color .13s, background .13s, transform .08s;
    }
    .chip:active { transform: scale(.95); }
    .chip .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--c); }
    .chip[aria-pressed="true"] {
      border-color: var(--c); background: color-mix(in srgb, var(--c) 13%, var(--surface));
      color: color-mix(in srgb, var(--c) 55%, var(--text));
    }
    .gridwrap { flex: 1; overflow-y: auto; padding-bottom: 96px; }
    .grid { position: relative; }
    .slot { display: flex; height: var(--rowh); border-top: 1px solid var(--line); }
    .slot.hour { border-top: 1px solid var(--line-strong); }
    .slot:first-child { border-top: none; }
    .time {
      width: var(--gutter); flex: 0 0 var(--gutter); padding: 3px 10px 0 0; text-align: right;
      font-size: 11px; color: var(--text-faint); font-variant-numeric: tabular-nums; user-select: none;
      transform: translateY(-8px);
    }
    .cell { flex: 1; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; border-left: 1px solid var(--line); }
    .cell:active { background: color-mix(in srgb, var(--accent) 9%, transparent); }
    .cell.start { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    .cell.preview { background: color-mix(in srgb, var(--sel) 14%, transparent); }
    .blocks { position: absolute; top: 0; left: var(--gutter); right: 8px; bottom: 0; pointer-events: none; }
    .block {
      position: absolute; left: 0; right: 0; border-radius: 9px; overflow: hidden; cursor: pointer;
      pointer-events: auto; touch-action: manipulation; background: color-mix(in srgb, var(--c) 15%, var(--surface));
      box-shadow: inset 3.5px 0 0 var(--c); border: 1px solid color-mix(in srgb, var(--c) 26%, transparent);
      padding: 5px 10px; display: flex; flex-direction: column; gap: 1px; animation: pop .16s ease-out;
    }
    @media (prefers-reduced-motion: reduce) { .block, .pill, .sheet, .backdrop { animation: none !important; } }
    @keyframes pop { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .block .b-title { font-size: 13.5px; font-weight: 620; color: color-mix(in srgb, var(--c) 45%, var(--text)); letter-spacing: -.01em; }
    .block .b-time { font-size: 11.5px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
    .block.tiny { padding: 3px 10px; flex-direction: row; align-items: center; gap: 8px; }
    .block.tiny .b-time { font-size: 11px; }
    .nowline { position: absolute; left: calc(var(--gutter) - 4px); right: 8px; height: 0; z-index: 5; pointer-events: none; }
    .nowline::before { content: ""; position: absolute; left: 0; top: -3.5px; width: 7px; height: 7px; border-radius: 50%; background: var(--now); }
    .nowline::after { content: ""; position: absolute; left: 4px; right: 0; top: 0; border-top: 2px solid var(--now); }
    .hint { position: absolute; left: var(--gutter); right: 8px; text-align: center; color: var(--text-faint); font-size: 13px; pointer-events: none; padding: 0 12px; }
    .pill {
      position: fixed; left: 50%; transform: translateX(-50%); bottom: 22px; z-index: 40;
      max-width: 500px; width: calc(100% - 32px); display: flex; align-items: center; gap: 12px;
      padding: 11px 12px 11px 16px; border-radius: 14px; background: var(--text); color: var(--bg);
      box-shadow: 0 8px 30px rgba(0,0,0,.28); animation: slideup .2s ease-out;
    }
    @keyframes slideup { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .pill .p-txt { flex: 1; font-size: 14px; font-weight: 500; }
    .pill .p-txt b { font-variant-numeric: tabular-nums; }
    .pill .p-cancel {
      appearance: none; border: none; cursor: pointer; background: color-mix(in srgb, var(--bg) 20%, transparent);
      color: var(--bg); font-size: 13px; font-weight: 600; padding: 7px 13px; border-radius: 9px;
      font-family: var(--sans); touch-action: manipulation;
    }
    .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.38); display: grid; align-items: end; animation: fade .15s ease; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .sheet {
      max-width: 540px; width: 100%; margin: 0 auto; background: var(--surface);
      border-radius: 20px 20px 0 0; padding: 20px 18px calc(20px + env(safe-area-inset-bottom)); animation: slideup2 .22s ease-out;
    }
    @keyframes slideup2 { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .sheet h3 { margin: 0 0 2px; font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
    .sheet .s-sub { color: var(--text-dim); font-size: 13px; font-variant-numeric: tabular-nums; margin-bottom: 16px; }
    .sheet .s-lbl { font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); margin: 4px 0 10px; }
    .sheet .s-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .s-actions { display: flex; gap: 10px; }
    .btn {
      flex: 1; appearance: none; cursor: pointer; font-family: var(--sans); padding: 13px; border-radius: 12px;
      font-size: 15px; font-weight: 600; border: 1px solid var(--line-strong); background: var(--surface-2);
      color: var(--text); touch-action: manipulation;
    }
    .btn.danger { border-color: color-mix(in srgb, var(--now) 40%, transparent); color: var(--now); background: color-mix(in srgb, var(--now) 8%, var(--surface)); }
    .btn:active { transform: scale(.98); }
    /* login overlay */
    .login { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: var(--bg); padding: 24px; font-family: var(--sans); }
    .login .card { width: 100%; max-width: 320px; text-align: center; }
    .login .mark { width: 46px; height: 46px; margin: 0 auto 16px; border-radius: 12px; background: var(--accent); display: grid; place-items: center; }
    .login .mark span { display: block; width: 22px; height: 3px; border-radius: 2px; background: #fff; margin: 2.5px 0; }
    .login .mark span:nth-child(2) { opacity: .7; width: 22px; } .login .mark span:nth-child(3) { opacity: .45; width: 13px; }
    .login h1 { font-size: 21px; font-weight: 680; letter-spacing: -.02em; margin: 0 0 4px; color: var(--text); }
    .login p { font-size: 13.5px; color: var(--text-dim); margin: 0 0 20px; }
    .login input {
      width: 100%; appearance: none; font-family: var(--sans); font-size: 16px; text-align: center;
      padding: 13px; border-radius: 12px; border: 1.5px solid var(--line-strong); background: var(--surface);
      color: var(--text); margin-bottom: 10px;
    }
    .login input:focus { outline: none; border-color: var(--accent); }
    .login .go { width: 100%; appearance: none; cursor: pointer; font-family: var(--sans); font-size: 15px; font-weight: 640; padding: 13px; border-radius: 12px; border: none; background: var(--accent); color: #fff; touch-action: manipulation; }
    .login .go:active { transform: scale(.98); }
    .login .err { color: var(--now); font-size: 13px; min-height: 20px; margin-top: 10px; }
    .toast {
      position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 70;
      background: var(--now); color: #fff; padding: 10px 16px; border-radius: 12px; font-size: 13px;
      font-family: var(--sans); box-shadow: 0 8px 30px rgba(0,0,0,.28);
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="nav" id="prevDay" aria-label="Previous day">&lsaquo;</button>
      <div class="daterow">
        <div class="dayname" id="dayName">Today</div>
        <div class="datesub" id="dateSub"></div>
      </div>
      <button class="nav" id="nextDay" aria-label="Next day">&rsaquo;</button>
    </header>
    <div class="chips" id="chips"></div>
    <div class="gridwrap" id="gridwrap">
      <div class="grid" id="grid"></div>
    </div>
  </div>

  <div class="pill" id="pill" hidden>
    <div class="p-txt">Start <b id="pillTime"></b> &middot; now tap the end time</div>
    <button class="p-cancel" id="pillCancel">Cancel</button>
  </div>

  <div class="backdrop" id="backdrop" hidden>
    <div class="sheet" id="sheet" role="dialog" aria-modal="true"></div>
  </div>

  <div class="login" id="login" hidden>
    <div class="card">
      <div class="mark"><span></span><span></span><span></span></div>
      <h1>timeblock</h1>
      <p>Enter your password to continue</p>
      <form id="loginForm">
        <input type="password" id="pw" inputmode="text" autocomplete="current-password" placeholder="Password" aria-label="Password">
        <button class="go" type="submit">Unlock</button>
      </form>
      <div class="err" id="loginErr"></div>
    </div>
  </div>

  <div class="toast" id="toast" hidden></div>

  <script>
  (function () {
    "use strict";

    var START_HOUR = 6, END_HOUR = 24;
    var SLOTS = (END_HOUR - START_HOUR) * 2; // 30-min slots
    var ROWH = 46;

    // NOTE: keep these label ids in sync with src/worker/constants.ts — there is
    // no build step sharing them between the browser and the Worker validator.
    var LABELS = [
      { id: "deep",     name: "Deep work", css: "--lbl-deep" },
      { id: "meeting",  name: "Meeting",   css: "--lbl-meeting" },
      { id: "gym",      name: "Gym",       css: "--lbl-gym" },
      { id: "break",    name: "Break",     css: "--lbl-break" },
      { id: "personal", name: "Personal",  css: "--lbl-personal" }
    ];
    function labelById(id) { for (var i=0;i<LABELS.length;i++) if (LABELS[i].id===id) return LABELS[i]; return LABELS[0]; }
    function labelColor(id) { return "var(" + labelById(id).css + ")"; }

    var activeLabel = "deep";
    var pendingStart = null;
    var viewDate = new Date();
    var blocks = [];
    var idc = 1;

    // ---------- date ----------
    function dateKey(d) {
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    }
    function isToday(d) { var n = new Date(); return d.toDateString() === n.toDateString(); }

    // ---------- time helpers ----------
    function slotToMin(i) { return START_HOUR*60 + i*30; }
    function fmt(mins) {
      var h = Math.floor(mins/60), m = mins%60;
      var ap = h >= 12 ? "PM" : "AM";
      var hh = h % 12; if (hh === 0) hh = 12;
      return hh + (m ? ":" + String(m).padStart(2,"0") : "") + " " + ap;
    }
    function slotStartLabel(i) { return fmt(slotToMin(i)); }

    // ---------- API ----------
    async function apiMe() {
      try { var r = await fetch("/api/me", { credentials: "same-origin" }); if (!r.ok) return false; var j = await r.json(); return !!j.authenticated; }
      catch (e) { return false; }
    }
    async function apiLogin(pw) {
      try {
        var r = await fetch("/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
        return r.ok;
      } catch (e) { return false; }
    }
    async function apiGetDay(dstr) {
      var r = await fetch("/api/day?date=" + dstr, { credentials: "same-origin" });
      if (r.status === 401) { showLogin(); return null; }
      if (!r.ok) throw new Error("load failed");
      var j = await r.json();
      return j.blocks || [];
    }
    async function persist() {
      var dstr = dateKey(viewDate);
      var payload = blocks.map(function (b) { return { start: b.start, end: b.end, labelId: b.labelId }; });
      try {
        var r = await fetch("/api/day", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: dstr, blocks: payload }) });
        if (r.status === 401) { showLogin(); return; }
        if (!r.ok) throw new Error("save failed");
      } catch (e) { toast("Couldn't save — reloading"); await loadDay(); }
    }
    async function loadDay() {
      var got = await apiGetDay(dateKey(viewDate));
      if (got === null) return; // login overlay shown
      idc = 1;
      blocks = got.map(function (b) { return { id: idc++, start: b.start, end: b.end, labelId: b.labelId }; });
      render();
    }

    // ---------- rendering ----------
    var grid = document.getElementById("grid");
    var gridwrap = document.getElementById("gridwrap");

    function render() {
      grid.style.height = (SLOTS * ROWH) + "px";
      grid.innerHTML = "";
      for (var i = 0; i < SLOTS; i++) {
        var isHour = (slotToMin(i) % 60 === 0);
        var row = document.createElement("div");
        row.className = "slot" + (isHour ? " hour" : "");
        var t = document.createElement("div");
        t.className = "time";
        t.textContent = isHour ? fmt(slotToMin(i)) : "";
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.i = i;
        row.appendChild(t); row.appendChild(cell);
        grid.appendChild(row);
      }
      var layer = document.createElement("div");
      layer.className = "blocks";
      blocks.forEach(function (b) {
        var span = (b.end - b.start + 1);
        var el = document.createElement("div");
        el.className = "block" + (span <= 1 ? " tiny" : "");
        el.style.top = (b.start * ROWH + 1.5) + "px";
        el.style.height = (span * ROWH - 3) + "px";
        el.style.setProperty("--c", labelColor(b.labelId));
        var startM = slotToMin(b.start), endM = slotToMin(b.end + 1);
        el.innerHTML = '<div class="b-title"></div><div class="b-time"></div>';
        el.querySelector(".b-title").textContent = labelById(b.labelId).name;
        el.querySelector(".b-time").textContent = fmt(startM) + " – " + fmt(endM);
        el.addEventListener("click", function (e) { e.stopPropagation(); openSheet(b); });
        layer.appendChild(el);
      });
      grid.appendChild(layer);
      if (isToday(viewDate)) {
        var now = new Date();
        var nowMin = now.getHours()*60 + now.getMinutes();
        if (nowMin >= START_HOUR*60 && nowMin <= END_HOUR*60) {
          var nl = document.createElement("div");
          nl.className = "nowline";
          nl.style.top = (((nowMin - START_HOUR*60) / 30) * ROWH) + "px";
          grid.appendChild(nl);
        }
      }
      if (blocks.length === 0 && pendingStart === null) {
        var hint = document.createElement("div");
        hint.className = "hint";
        hint.style.top = (2 * ROWH) + "px";
        hint.textContent = "Tap a start time, then an end time.";
        grid.appendChild(hint);
      }
      applyPendingClasses();
    }

    function applyPendingClasses() {
      grid.querySelectorAll(".cell").forEach(function (c) { c.classList.remove("start", "preview"); });
      if (pendingStart !== null) {
        var s = grid.querySelector('.cell[data-i="' + pendingStart + '"]');
        if (s) s.classList.add("start");
      }
    }
    function previewTo(i) {
      if (pendingStart === null) return;
      var a = Math.min(pendingStart, i), b = Math.max(pendingStart, i);
      grid.querySelectorAll(".cell").forEach(function (c) {
        var ci = +c.dataset.i;
        if (ci >= a && ci <= b && ci !== pendingStart) c.classList.add("preview");
        else c.classList.remove("preview");
      });
      grid.style.setProperty("--sel", labelColor(activeLabel));
    }
    function occupied(i) {
      for (var k=0;k<blocks.length;k++) if (i >= blocks[k].start && i <= blocks[k].end) return blocks[k];
      return null;
    }

    // ---------- interaction ----------
    grid.addEventListener("click", function (e) {
      var cell = e.target.closest(".cell");
      if (!cell) return;
      var i = +cell.dataset.i;
      var occ = occupied(i);
      if (occ) { openSheet(occ); return; }
      if (pendingStart === null) {
        pendingStart = i; showPill(); applyPendingClasses();
      } else {
        var a = Math.min(pendingStart, i), b = Math.max(pendingStart, i);
        for (var s = a; s <= b; s++) {
          if (occupied(s)) { if (s <= pendingStart) { a = s + 1; } else { b = s - 1; break; } }
        }
        if (a <= b) { blocks.push({ id: idc++, start: a, end: b, labelId: activeLabel }); }
        pendingStart = null; hidePill(); render(); persist();
      }
    });
    grid.addEventListener("mousemove", function (e) {
      if (pendingStart === null) return;
      var cell = e.target.closest(".cell");
      if (cell) previewTo(+cell.dataset.i);
    });

    // ---------- pill ----------
    var pill = document.getElementById("pill");
    var pillTime = document.getElementById("pillTime");
    function showPill() { pillTime.textContent = slotStartLabel(pendingStart); pill.hidden = false; }
    function hidePill() { pill.hidden = true; }
    document.getElementById("pillCancel").addEventListener("click", function () {
      pendingStart = null; hidePill(); render();
    });

    // ---------- chips ----------
    var chipsEl = document.getElementById("chips");
    function renderChips() {
      chipsEl.innerHTML = "";
      LABELS.forEach(function (l) {
        var b = document.createElement("button");
        b.className = "chip";
        b.setAttribute("aria-pressed", l.id === activeLabel ? "true" : "false");
        b.style.setProperty("--c", "var(" + l.css + ")");
        b.innerHTML = '<span class="dot"></span>';
        b.appendChild(document.createTextNode(l.name));
        b.addEventListener("click", function () {
          activeLabel = l.id; renderChips();
          if (pendingStart !== null) grid.style.setProperty("--sel", labelColor(activeLabel));
        });
        chipsEl.appendChild(b);
      });
    }

    // ---------- edit sheet ----------
    var backdrop = document.getElementById("backdrop");
    var sheet = document.getElementById("sheet");
    function openSheet(b) {
      var startM = slotToMin(b.start), endM = slotToMin(b.end + 1);
      sheet.innerHTML =
        '<h3></h3><div class="s-sub"></div>' +
        '<div class="s-lbl">Change label</div><div class="s-chips"></div>' +
        '<div class="s-actions"><button class="btn danger" id="delBtn">Delete</button><button class="btn" id="closeBtn">Done</button></div>';
      sheet.querySelector("h3").textContent = labelById(b.labelId).name;
      sheet.querySelector(".s-sub").textContent = fmt(startM) + " – " + fmt(endM);
      var sc = sheet.querySelector(".s-chips");
      LABELS.forEach(function (l) {
        var c = document.createElement("button");
        c.className = "chip";
        c.setAttribute("aria-pressed", l.id === b.labelId ? "true" : "false");
        c.style.setProperty("--c", "var(" + l.css + ")");
        c.innerHTML = '<span class="dot"></span>';
        c.appendChild(document.createTextNode(l.name));
        c.addEventListener("click", function () { b.labelId = l.id; render(); persist(); closeSheet(); });
        sc.appendChild(c);
      });
      backdrop.hidden = false;
      document.getElementById("delBtn").addEventListener("click", function () {
        blocks = blocks.filter(function (x) { return x.id !== b.id; });
        render(); persist(); closeSheet();
      });
      document.getElementById("closeBtn").addEventListener("click", closeSheet);
    }
    function closeSheet() { backdrop.hidden = true; sheet.innerHTML = ""; }
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeSheet(); });

    // ---------- date nav ----------
    var dayName = document.getElementById("dayName");
    var dateSub = document.getElementById("dateSub");
    function renderDate() {
      var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      var mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var today = new Date(); today.setHours(0,0,0,0);
      var vd = new Date(viewDate); vd.setHours(0,0,0,0);
      var diff = Math.round((vd - today) / 86400000);
      if (diff === 0) dayName.textContent = "Today";
      else if (diff === 1) dayName.textContent = "Tomorrow";
      else if (diff === -1) dayName.textContent = "Yesterday";
      else dayName.textContent = days[viewDate.getDay()];
      dateSub.textContent = days[viewDate.getDay()].slice(0,3) + ", " + mon[viewDate.getMonth()] + " " + viewDate.getDate();
    }
    async function changeDay(delta) {
      viewDate.setDate(viewDate.getDate() + delta);
      pendingStart = null; hidePill(); renderDate(); await loadDay();
    }
    document.getElementById("prevDay").addEventListener("click", function () { changeDay(-1); });
    document.getElementById("nextDay").addEventListener("click", function () { changeDay(1); });

    // ---------- login ----------
    var loginEl = document.getElementById("login");
    function showLogin() { loginEl.hidden = false; setTimeout(function () { var i = document.getElementById("pw"); if (i) i.focus(); }, 50); }
    function hideLogin() { loginEl.hidden = true; }
    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var err = document.getElementById("loginErr"); err.textContent = "";
      var pwEl = document.getElementById("pw");
      var ok = await apiLogin(pwEl.value);
      if (ok) { pwEl.value = ""; hideLogin(); await boot2(); }
      else { err.textContent = "Wrong password"; pwEl.value = ""; pwEl.focus(); }
    });

    // ---------- toast ----------
    var toastTimer;
    function toast(msg) {
      var t = document.getElementById("toast");
      t.textContent = msg; t.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2500);
    }

    // ---------- boot ----------
    renderChips(); renderDate();
    async function boot2() {
      await loadDay();
      var target = isToday(viewDate) ? (new Date().getHours()*60 + new Date().getMinutes() - START_HOUR*60 - 60) : (2*60);
      gridwrap.scrollTop = Math.max(0, (target / 30) * ROWH);
    }
    (async function boot() {
      var authed = await apiMe();
      if (!authed) { showLogin(); return; }
      await boot2();
    })();
  })();
  </script>
</body>
</html>
```

## Appendix B — `public/favicon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#5b5ef0"/><rect x="8" y="8" width="16" height="4" rx="2" fill="#fff"/><rect x="8" y="14" width="16" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="8" y="20" width="10" height="4" rx="2" fill="#fff" opacity=".45"/></svg>
```

## Appendix C — `src/worker/index.ts`

```ts
/**
 * index.ts — Hono entry-point for the timeblock Worker.
 *
 *   POST /auth/login          → set session cookie (password gate)
 *   POST /auth/logout         → clear cookie
 *   GET  /api/me              → { authenticated }
 *   GET  /api/day?date=YYYY-MM-DD → { date, blocks }        (auth)
 *   PUT  /api/day             → { date, blocks } upsert     (auth)
 *   GET  *                    → serve static assets (public/) via ASSETS
 */
import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import { normalizeDay } from './validate'

const app = new Hono<{ Bindings: Env }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

app.get('/api/day', async (c) => {
  const date = c.req.query('date') ?? ''
  if (!DATE_RE.test(date)) return c.json({ error: 'bad date' }, 400)
  const raw = await c.env.BLOCKS_KV.get(`day:${date}`)
  let parsed: unknown = []
  if (raw) { try { parsed = JSON.parse(raw) } catch { parsed = [] } }
  return c.json({ date, blocks: normalizeDay(parsed) })
})

app.put('/api/day', async (c) => {
  const body = await c.req.json<{ date?: string; blocks?: unknown }>().catch(() => ({}) as { date?: string; blocks?: unknown })
  const date = body.date ?? ''
  if (!DATE_RE.test(date)) return c.json({ error: 'bad date' }, 400)
  const blocks = normalizeDay(body.blocks)
  await c.env.BLOCKS_KV.put(`day:${date}`, JSON.stringify(blocks))
  return c.json({ ok: true, blocks })
})

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
```

## Appendix D — `src/worker/auth.ts` (copied from `apps/lists-app/src/worker/auth.ts`, two changes)

Copy `apps/lists-app/src/worker/auth.ts` verbatim, then make ONLY these two changes:
1. Replace the `Env` type with the block below (KV binding instead of `DB`).
2. Change `const COOKIE_NAME = 'lists_session'` to `const COOKIE_NAME = 'tb_session'`.

Everything else (the HMAC signing, `makeToken`/`verifyToken`, `login`/`logout`/`me`/`requireAuth`, constant-time compare) stays exactly as in lists-app. Resulting `Env`:

```ts
export type Env = {
  ASSETS: Fetcher
  BLOCKS_KV: KVNamespace
  APP_PASSWORD: string
  SESSION_SECRET: string
}
```

For reference, the full expected file (post-edit):

```ts
/**
 * auth.ts
 * Single-password gate with a stateless, signed session cookie.
 * No KV/DB lookups: cookie is `${exp}.${HMAC-SHA256(exp)}`, signed with SESSION_SECRET.
 * (Ported from apps/lists-app — house pattern, decisions.md 2026-07-01.)
 */
import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

export type Env = {
  ASSETS: Fetcher
  BLOCKS_KV: KVNamespace
  APP_PASSWORD: string
  SESSION_SECRET: string
}

const COOKIE_NAME = 'tb_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64url(new Uint8Array(sig))
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function makeToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS)
  return `${exp}.${await hmac(secret, exp)}`
}
async function verifyToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 1) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^\d+$/.test(exp)) return false
  if (Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmac(secret, exp))
}
function isSecure(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:'
}
export async function login(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req.json<{ password?: string }>().catch(() => ({}) as { password?: string })
  const password = body.password ?? ''
  const expected = c.env.APP_PASSWORD ?? ''
  const ok = expected.length > 0 &&
    safeEqual(await hmac(c.env.SESSION_SECRET, password), await hmac(c.env.SESSION_SECRET, expected))
  if (!ok) return c.json({ error: 'Wrong password' }, 401)
  setCookie(c, COOKIE_NAME, await makeToken(c.env.SESSION_SECRET), {
    httpOnly: true, secure: isSecure(c), sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_MS / 1000,
  })
  return c.json({ ok: true })
}
export function logout(c: Context<{ Bindings: Env }>): Response {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
}
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const token = getCookie(c, COOKIE_NAME)
  if (!(await verifyToken(c.env.SESSION_SECRET, token))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}
export async function me(c: Context<{ Bindings: Env }>): Promise<Response> {
  const token = getCookie(c, COOKIE_NAME)
  return c.json({ authenticated: await verifyToken(c.env.SESSION_SECRET, token) })
}
```

## Appendix E — `src/worker/constants.ts`

```ts
// Grid: 6:00 AM–midnight in 30-min slots → 36 slots (indices 0..35).
export const SLOTS = 36
// Keep in sync with the LABELS array in public/index.html (no build step shares them).
export const LABEL_IDS = ['deep', 'meeting', 'gym', 'break', 'personal'] as const
```

## Appendix F — `src/worker/validate.ts`

```ts
import { SLOTS, LABEL_IDS } from './constants'

export interface Block { id: number; start: number; end: number; labelId: string }

/**
 * Storage guard: coerce arbitrary input into a clean, non-overlapping,
 * start-sorted Block[]. Drops anything malformed, out of range, unknown-label,
 * or overlapping a previously accepted block. Reassigns ids 1..n.
 */
export function normalizeDay(input: unknown): Block[] {
  if (!Array.isArray(input)) return []
  const labels = new Set<string>(LABEL_IDS as readonly string[])
  const cleaned: Block[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const start = o.start, end = o.end, labelId = o.labelId
    if (typeof start !== 'number' || typeof end !== 'number' || typeof labelId !== 'string') continue
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue
    if (start < 0 || end < start || end >= SLOTS) continue
    if (!labels.has(labelId)) continue
    cleaned.push({ id: 0, start, end, labelId })
  }
  cleaned.sort((a, b) => a.start - b.start)
  const out: Block[] = []
  let lastEnd = -1
  for (const b of cleaned) {
    if (b.start <= lastEnd) continue // overlaps previously accepted block
    out.push(b)
    lastEnd = b.end
  }
  out.forEach((b, i) => { b.id = i + 1 })
  return out
}
```

## Appendix G — `test/validate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { normalizeDay } from '../src/worker/validate'

describe('normalizeDay', () => {
  it('returns [] for non-array input', () => {
    expect(normalizeDay(null)).toEqual([])
    expect(normalizeDay('nope')).toEqual([])
    expect(normalizeDay(42)).toEqual([])
  })
  it('keeps valid blocks and assigns ids 1..n in start order', () => {
    const out = normalizeDay([
      { start: 10, end: 12, labelId: 'gym' },
      { start: 2, end: 3, labelId: 'deep' },
    ])
    expect(out).toEqual([
      { id: 1, start: 2, end: 3, labelId: 'deep' },
      { id: 2, start: 10, end: 12, labelId: 'gym' },
    ])
  })
  it('drops out-of-range slots', () => {
    expect(normalizeDay([{ start: -1, end: 2, labelId: 'deep' }])).toEqual([])
    expect(normalizeDay([{ start: 0, end: 36, labelId: 'deep' }])).toEqual([]) // end must be < 36
  })
  it('drops unknown labels', () => {
    expect(normalizeDay([{ start: 0, end: 1, labelId: 'sleep' }])).toEqual([])
  })
  it('drops end < start', () => {
    expect(normalizeDay([{ start: 5, end: 3, labelId: 'deep' }])).toEqual([])
  })
  it('drops non-integer / wrong-typed fields', () => {
    expect(normalizeDay([{ start: 1.5, end: 3, labelId: 'deep' }])).toEqual([])
    expect(normalizeDay([{ start: '1', end: 3, labelId: 'deep' }])).toEqual([])
  })
  it('drops a block overlapping an earlier accepted one, keeps adjacent', () => {
    const out = normalizeDay([
      { start: 0, end: 3, labelId: 'deep' },
      { start: 2, end: 5, labelId: 'gym' },   // overlaps → dropped
      { start: 4, end: 6, labelId: 'break' }, // adjacent to first (starts at 4 > 3) → kept
    ])
    expect(out.map((b) => [b.start, b.end])).toEqual([[0, 3], [4, 6]])
  })
})
```

## Appendix H — `test/api.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/worker/index'

function memKV() {
  const m = new Map<string, string>()
  return {
    get: async (k: string) => (m.has(k) ? m.get(k)! : null),
    put: async (k: string, v: string) => { m.set(k, v) },
    delete: async (k: string) => { m.delete(k) },
  } as unknown as KVNamespace
}
function env() {
  return {
    APP_PASSWORD: 'testpw',
    SESSION_SECRET: 'super-secret-session-key-1234567890',
    BLOCKS_KV: memKV(),
    ASSETS: {} as unknown as Fetcher,
  }
}
async function loginCookie(ENV: ReturnType<typeof env>): Promise<string> {
  const res = await app.request('/auth/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'testpw' }) }, ENV)
  const setc = res.headers.get('set-cookie') || ''
  const m = setc.match(/tb_session=([^;]+)/)
  return m ? m[1] : ''
}

describe('timeblock API', () => {
  it('rejects wrong password', async () => {
    const res = await app.request('/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'nope' }) }, env())
    expect(res.status).toBe(401)
  })
  it('accepts correct password and sets tb_session cookie', async () => {
    const ENV = env()
    const res = await app.request('/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'testpw' }) }, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') || '').toContain('tb_session=')
  })
  it('blocks /api/day without a cookie', async () => {
    const res = await app.request('/api/day?date=2026-07-09', { method: 'GET' }, env())
    expect(res.status).toBe(401)
  })
  it('round-trips a day: PUT then GET returns normalized blocks', async () => {
    const ENV = env()
    const token = await loginCookie(ENV)
    const put = await app.request('/api/day',
      { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `tb_session=${token}` },
        body: JSON.stringify({ date: '2026-07-09', blocks: [{ start: 4, end: 6, labelId: 'deep' }] }) }, ENV)
    expect(put.status).toBe(200)
    const get = await app.request('/api/day?date=2026-07-09', { headers: { Cookie: `tb_session=${token}` } }, ENV)
    expect(get.status).toBe(200)
    const j = await get.json() as { blocks: Array<{ start: number; end: number; labelId: string }> }
    expect(j.blocks).toEqual([{ id: 1, start: 4, end: 6, labelId: 'deep' }])
  })
  it('rejects a bad date', async () => {
    const ENV = env()
    const token = await loginCookie(ENV)
    const res = await app.request('/api/day?date=notadate', { headers: { Cookie: `tb_session=${token}` } }, ENV)
    expect(res.status).toBe(400)
  })
})
```

## Appendix I — `package.json`

Create this file, then run `npm install` (it resolves current versions; do NOT hand-pin
if a version fails — let npm pick the latest that satisfies the caret range).

```json
{
  "name": "timeblock",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "check": "tsc --noEmit && vitest run",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "hono": "^4"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "typescript": "^5",
    "vitest": "^2",
    "wrangler": "^3"
  }
}
```

> If `npm install` or the build complains about the `wrangler`/`vitest` major, install
> the current latest instead: `npm install -D wrangler@latest vitest@latest` and re-run
> `npm run check`. Pinned majors here are a floor, not a hard requirement.

## Appendix J — `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "test"]
}
```

## Appendix K — `wrangler.toml`

```toml
name = "timeblock"
main = "src/worker/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

# Static frontend (public/index.html) served by the Worker via the ASSETS binding.
[assets]
directory = "./public"
binding = "ASSETS"

# One JSON blob per day: key `day:YYYY-MM-DD`. The id is filled in AFTER the owner
# runs `npx wrangler kv namespace create BLOCKS_KV` — the placeholder below is fine
# for `wrangler dev` (local mode simulates KV).
[[kv_namespaces]]
binding = "BLOCKS_KV"
id = "PLACEHOLDER_run_wrangler_kv_namespace_create_BLOCKS_KV"

# Custom domain — Cloudflare auto-provisions DNS + SSL on the agrolloo.com zone.
[[routes]]
pattern = "timeblock.agrolloo.com"
custom_domain = true

# APP_PASSWORD + SESSION_SECRET are secrets (never committed):
#   npx wrangler secret put APP_PASSWORD
#   npx wrangler secret put SESSION_SECRET
```

## Appendix L — `.dev.vars.example`

```
APP_PASSWORD=changeme
SESSION_SECRET=replace-with-a-long-random-string-at-least-32-chars
```

## Appendix M — `.gitignore`

```
node_modules/
.dev.vars
.wrangler/
dist/
```

## Appendix P — `.npmrc`

```
registry=https://registry.npmjs.org/
always-auth=false
```

## Appendix N — `README.md`

```md
# timeblock

Fast personal day-planner: block time in **two taps**. Live at
`timeblock.agrolloo.com` (password-gated). Built because Google Calendar is too
slow to block time on mobile — too many taps and dragging to set the range.

## What it does

- Single-day grid, 6:00 AM–midnight, 30-min slots, with a live "now" line and
  `‹ ›` day nav.
- Pick a label chip (Deep work / Meeting / Gym / Break / Personal — it stays
  active), then **tap a start time and an end time** → a colored block appears.
  Tap the same cell twice for a 30-min block. Tap a block to relabel or delete it.
- No dragging, no save button, no dialogs. Not a Google Calendar client — it has
  its own store and does not sync anywhere.

## Stack

- Cloudflare Worker (Hono) serving a single static `public/index.html` (no build step).
- Data in **KV** (`BLOCKS_KV`), one JSON blob per day (`day:YYYY-MM-DD`).
- Auth: stateless signed-cookie password gate (HMAC over expiry, `SESSION_SECRET`) —
  the same house pattern as `lists-app`. Secrets: `APP_PASSWORD`, `SESSION_SECRET`.

## Local dev

```bash
npm install
cp .dev.vars.example .dev.vars   # then set a real APP_PASSWORD + SESSION_SECRET
npm run dev                      # http://localhost:8787 (local KV is simulated)
```

## Test

```bash
npm run check    # tsc --noEmit + vitest (offline, no Cloudflare account needed)
```

## Deploy (one-time setup, then `npm run deploy`)

```bash
npx wrangler kv namespace create BLOCKS_KV   # paste the printed id into wrangler.toml
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy                               # custom_domain auto-provisions DNS+SSL
```

## Notes

- The label set is duplicated in `public/index.html` (`LABELS`) and
  `src/worker/constants.ts` (`LABEL_IDS`) — keep them in sync (no build shares them).
- `src/worker/validate.ts` (`normalizeDay`) is the storage guard: it drops malformed,
  out-of-range, unknown-label, and overlapping blocks server-side.
```

## Appendix O — `CLAUDE.md`

```md
# timeblock — operating notes

Personal tap-to-block day planner at `timeblock.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Stack**: Cloudflare Worker (Hono) + single static `public/index.html` (NO build
  step — do not add Vite/React/a bundler). Data in KV (`BLOCKS_KV`), one JSON blob
  per day keyed `day:YYYY-MM-DD`.
- **Auth guardrail**: stateless signed-cookie gate (HMAC-SHA256 over expiry,
  `SESSION_SECRET`). Ported from `lists-app`. **Do NOT replace with OAuth/KV-session/DB.**
- **Not a calendar client**: no Google Calendar sync, no recurring blocks,
  no drag-to-resize, no notifications, no multi-user. Speed over features — if a
  change adds taps to the create flow, it's wrong.
- **Secrets**: `.dev.vars` (local) + Wrangler secrets (remote): `APP_PASSWORD`,
  `SESSION_SECRET`.
- **Label sync**: labels live in two places (`public/index.html` `LABELS` +
  `src/worker/constants.ts` `LABEL_IDS`); edit both together.

## Run / deploy

```bash
npm install
npm run dev      # local (http://localhost:8787), needs .dev.vars
npm run check    # tsc + vitest (merge gate)
npm run deploy   # after one-time KV + secret setup (see README)
```
```
