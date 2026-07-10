# Tutorials Tracker — project guide

A role-aware **Kanban web app** for the YouTube tutorial-production pipeline: server-enforced role-based access (column + row level), an approval/QC flow, email notifications, and admin dashboards.

> **Status:** **deployed** at https://tutorials-tracker.agrolloo.com (Cloudflare Worker, custom domain). Backend: **Cloudflare D1 only** (the Sheets fallback was removed). Live as of 2026-06-30.

---

## ⚠️ READ FIRST — config-driven pipeline engine (2026-06-30 refactor)

The app is now a **generic multi-system pipeline engine**. It is NO LONGER the single hardcoded `STAGES` array described further down — those older sections describe the pre-refactor design and are kept only for history. **The engine is the source of truth.**

- **Definitions = data-as-typed-code.** Each "system" (video-production flow) is one `PipelineDef` in `src/shared/engine/definitions/` (`standard.ts` = the original 6-stage flow; `tut-2.ts` = "Tut 2", a 7-stage avatar flow with an Admin-owned **Processing** stage). Registered in `src/shared/engine/registry.ts`.
- **Everything derives from the definition** — column access, the show/edit/required grid, gates, board lanes, the role roster, emails. **To add a system: write one typed `PipelineDef` + add it to `PIPELINES` in registry.ts + deploy. Nothing else.** (Boundaries that need engine code, not just a def: a new status word, non-linear flow, multiple assignees per stage, or a new field widget type.)
- **Engine modules** (`src/shared/engine/`): `lifecycle.ts` (4 status templates: review / approveOnly / task / terminal), `types.ts` (PipelineDef/StageDef + resolution helpers), `registry.ts` (PIPELINES + lookups + `validatePipelines()`), `control.ts` (derives show/edit/mustFill from conventions + sparse `overrides`), `derive.ts` (per-pipeline lookups + statusOf/isGateOpen), `rbac.ts` (pipeline-aware authority — the single enforcement point), `card.ts` (flat `Row` ⇄ normalized records), `labels.ts` (field labels from defs).
- **Storage is NORMALIZED D1** (`tracker-db`): `pipelines` (definitions seed) + `cards` (one per video, carries `pipeline_id`) + `card_stages` (one row per stage: status/assignee/reviewer/work_link/instruction/eta/feedback/extra_json) + `employees`. The old wide `cards` table is gone. The flat `Row` the app speaks is **assembled** from cards+card_stages by `card.ts`; each row carries `row.pipeline`.
- **Client is pipeline-aware** via the `src/client/stages.ts` facade (resolves each card's pipeline + re-exports engine helpers). UI: new-video **type picker**, Board **per-system work tabs** (only shown where the user has a card; suffixed with the system name only when genuinely cross-system), **Pipeline-matrix type selector**, per-system assignment defaults, a **system chip** on cards/review-queue/detail.
- **Legacy `src/shared/{pipeline,control,rbac,policy,lifecycle}.ts` are SUPERSEDED** by the engine. They remain only because `test/rbac.test.ts` still parity-checks the old `rbac.ts`, and a few type/const re-exports are still imported (`Column`/`COLUMNS`/`DATE_COLUMNS`/`ETA_COLUMNS` from `columns.ts`, `NEW_VIDEO_FIELDS` from `control.ts`, `Row`/`Transition` types from `rbac.ts`). **Do not edit the legacy modules for behavior — edit the engine.**
- **System-scoped team (2026-06-30).** People are now scoped to a system, not global. The `employees` table is membership-grained — one row per **(email, system_id)**, where `role` is the comma-joined roles that person holds **in that system**. Any role — doer or **Reviewer** — may be held in any number of systems (e.g. Scriptwriter in both Standard and Tut 2); **Admin** is a cross-system `"*"` membership (founder only, auto-preserved). The engine collapses a user's `Memberships` to **effective roles for one card's system** (`src/shared/engine/memberships.ts` → `effectiveRoles`), and the worker feeds those to the unchanged role-based RBAC — so authority stays per-card-correct without rewriting the brain. Assignment dropdowns + a server guard in `/api/update` scope assignable people to the card's system (`holdsRoleInSystem`); the Team tab is system-tabbed; `assignment_defaults` is keyed by `pipeline_id`. Adding a future system (e.g. an Amazon channel) is still just one `PipelineDef` — the team/assignment UI scales automatically. **Migration:** `scripts/migrate-system-scoping.ts` (employees → memberships + `assignment_defaults` gains `pipeline_id`; run once on prod, see header).
- **Migration:** `scripts/migrate-to-engine.ts` produced the wide→normalized cutover (already applied to prod). Project memory: `tracker-pipeline-engine.md`.
- **Pre-engine history** (old STAGES pipeline, Sheets backend, legacy file map, shipped roadmap): [HISTORY.md](HISTORY.md). Never code against it.
---

## Stack & where it runs

- **Frontend:** Vite + React + TypeScript SPA (`dnd-kit` for drag-drop).
- **Backend:** [Hono](https://hono.dev) app on a **Cloudflare Worker**; `SESSIONS` **KV** namespace for login sessions + a short board-rows cache.
- **Data backend:** Cloudflare D1 only (`tracker-db`, binding `TRACKER_DB`), via `src/worker/datastore.ts` (one `DataStore`; `getStore` always returns the D1 store). Tables: `pipelines` + `cards` + `card_stages` + `employees` (normalized — see the engine section above). The Sheets fallback was **removed**; `DATA_BACKEND` is vestigial. (`GOOGLE_SA_JSON` is still used elsewhere only for the affiliate-programs sheet read in link-gen.)
- **Auth:** Google OAuth **Web** client (project `n8n-workflows-454504`); verified email → role looked up in the active backend (D1 `employees` table, or the sheet's `Employes` tab in fallback mode).
- **Email:** Gmail API using `seankerman25@gmail.com`'s OAuth refresh token (from the shared `mcp/google-shared` setup).
- Served as one Worker: API on `/api/*` + `/auth/*`, everything else serves the built SPA from `dist/` via the `ASSETS` binding.


## Roles & RBAC (current — engine-backed)

- Roles derive from the pipeline defs (`allRoles()` in the engine registry):
  stage-owner roles + cross-cutting `Reviewer` + `Admin`. Multi-role = union.
  People/roles are managed ONLY in the admin **Team** tab (D1 `employees`,
  membership-grained per system); resolved live on every request.
- **Single enforcement point:** `authorizeWrite(...)` in
  `src/shared/engine/rbac.ts` is the only authorization the worker calls;
  its `{ok, reason}` reason string becomes the UI lock tooltip.
- Everything is **enforced server-side**: restricted columns never leave the
  Worker, and each board row carries `_stages`/`_actions`/`_locks` so the
  client never re-derives permissions (admin "view as" can't diverge).
- Review is per-stage and optional: blank stage reviewer ⇒ submit goes
  straight to Done. Doers move To Do→In Progress→In Review; only the stage's
  reviewer (never on their own submission) sets Done / Need Changes, and
  Need Changes always writes feedback atomically.


## API (all behind a session except auth/auth-mode)

- `GET /api/board[?asUser=email]` → `{roles, stages, columns, rows, names, viewingAs, readOnly}`. Each row carries `_stages` (lane membership), `_actions` (allowed transitions), `_locks` (col→reason). Admin `asUser` is a **pure read-only mirror** (no edit elevation; `readOnly:true`) → identical to the real user's view.
- `POST /api/update {row_id, col, value, prev?}` → single check `authorizeWrite`; doer status transitions + content edits; `prev` enables optimistic-concurrency (409 on conflict). Fires submit/assign emails.
- `POST /api/review {row_id, stage, action, feedback?}` → card's assigned reviewer (or admin) only; `stage` = a reviewable stage id (topic|script|recording|editing|thumbnail); approve→Done, sendback→Need Changes (feedback required, written atomically); emails the submitter.
- `GET /api/review-queue` → cards In-Review that THIS user is the assigned reviewer for (admins see all), with submitter name + stage.
- `POST /api/video {video_title, video_notes?, category?, subcategory?}` → Admin-only; appends a Master row, returns `{row_id}`.
- `POST /api/delete {row_id}` → Admin-only; deletes the Master row (`deleteRowById` → Sheets `deleteDimension`), busts the board cache. Surfaced as a per-row 🗑 button in the admin Pipeline matrix.
- `POST /api/link-preview {row_id}` → Admin-only; LLM-free, admin selects catalog rows; returns `{ video_code, items, description, warnings, blocked, plan_hash }`. Zero writes.
- `POST /api/link-confirm {row_id, plan_hash}` → Admin-only; mints go.agrolloo short links into `CLICKS_KV` + `clicks-db` D1, writes `video_description`/`actual_links`/`short_links` back.
- `GET /api/link-drift` → Admin-only; lists URL/approval drift for minted links.
- `POST /api/link-resync {slug}` → Admin-only; updates a drifted link's target in D1+KV.
- `GET /api/affiliate-catalog` → Admin-only; returns `[{slug, displayName, isApproved, hasCoupon}]`.
- `GET /api/team` (admin/approver), `GET /api/roles` (valid role names), `GET /api/me`, `GET /api/auth-mode`.
- `POST /api/team {name, email, roles[]}` → Admin-only; upsert a teammate in the `Employes` tab (by email). `POST /api/team/delete {email}` → Admin-only; remove one. Both bust the board cache. Backs the admin **Team** tab (`TeamPanel.tsx`). Editing the `Employes` tab IS editing both assignment options and login access.
- `GET /auth/login` · `GET /auth/callback` · `POST /auth/logout` · `GET /dev-login?email=…` (dev only).

## Notifications (email)

Sent from `seankerman25@gmail.com` (display "Tutorials Tracker") on: **submitted** (→ reviewer/admin), **approved** & **sent-back** (→ freelancer, with feedback), **assigned** (→ assignee). Best-effort (never blocks the action). `NOTIFY_REDIRECT` (set during testing) routes all mail to one address; **unset it in production** to reach real recipients.

---

## Run locally

**Canonical local-dev + design loop: see [`LOCAL-DEV.md`](./LOCAL-DEV.md).** It documents the fast path — `npm run seed:local` (local D1 with dev personas + demo cards across both pipelines and every status) then `npm run dev:local` (Vite HMR on **:5173** + wrangler API on **:8787**), plus `npm run shot -- <persona>` for Playwright screenshots and `npm run e2e` for smoke specs. Use **:5173** for UI work (instant reload); `:8787` serves the built `dist/` and needs a rebuild+restart.

Bare-worker check (no HMR, exercises the real Worker serving `dist/`):

```bash
cd apps/tutorial-tracker-app
npm install                 # uses the local .npmrc → public npm registry (avoids Zluri CodeArtifact 401)
npm run build               # builds the SPA into dist/
npx wrangler dev --port 8787
# open http://localhost:8787
```

- **`.dev.vars`** (gitignored) holds all secrets/config: `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `SHEET_ID`, `SESSION_SECRET`, `GOOGLE_SA_JSON`, `DEV_AUTH=1`, `GMAIL_*`, `NOTIFY_REDIRECT`, `APP_URL`.
- **`DEV_AUTH=1`** enables the **dev preview login** (per-person buttons on the sign-in screen + an `X-Dev-Roles` header bypass) so you can test any role without real Google login. **Must be OFF in production.**
- **`npm test`** → `vitest run` (49 tests; includes `test/engine.test.ts` — validation, round-trip, routing).

### ⚠️ Gotchas
- **`wrangler dev` serves a STALE snapshot of `dist/`.** After ANY client (SPA) rebuild you MUST **restart `wrangler dev`** (`pkill -f "wrangler dev"`; `npm run build`; restart) or the browser shows old UI. Worker-only changes hot-reload fine. (This is why design work uses `npm run dev:local`'s Vite :5173 — see `LOCAL-DEV.md`.)
- The local `.npmrc` pins the public registry — keep it (home `~/.npmrc` points at Zluri CodeArtifact which 401s on public packages).
- Sheets read range is bounded (`A1:…999`); fine now, but archive/scale needed past ~1000 rows.
- **Link generation needs the D1 schema in the LOCAL D1.** `wrangler dev` uses an empty *local* D1, not the remote `clicks-db`, so `/api/generate-links` errors with `no such table: videos` until you seed it once: `npx wrangler d1 execute clicks-db --local --file=../redirector/migrations/0001_init.sql`. Production uses the remote `clicks-db` (already has the tables from the redirector in `apps/redirector/` (same repo)).

## Deploy (only on owner's "final")

1. `npm run build`.
2. `npx wrangler deploy` → get the `*.workers.dev` URL.
3. Add `<url>/auth/callback` to the OAuth client's **Authorized redirect URIs** (Google Cloud console — manual, no API).
4. Set secrets: `npx wrangler secret put GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SESSION_SECRET|GOOGLE_SA_JSON|GMAIL_*`; set `SHEET_ID`, `GOOGLE_REDIRECT_URI`. **Do NOT set `DEV_AUTH` or `NOTIFY_REDIRECT`** in prod.
5. **Schema migration (run once per sheet, idempotent):** `npx tsx scripts/migrate-pipeline.ts` (reads `SHEET_ID` + `GOOGLE_SA_JSON` from `.dev.vars`, or `SHEET_ID=<id> npx tsx …`). It adds the new columns, maps legacy statuses (`topic_status` Ready→Done; `yt_upload_status` Published→Uploaded/Draft→In Progress), renames legacy roles (`Script Writer`→`Scriptwriter`, `Tutorial Maker`→`Recorder`), and regenerates the `Access` tab. After migrating, assign the new **Ideator**/**Uploader** roles to people via the admin Team tab.
6. **Cutover to the live sheet:** run `ensureRowIds` then `scripts/migrate-pipeline.ts` against the live sheet, point `SHEET_ID` at it, redeploy.


## Access / onboarding

Login = Google OAuth → email verified → roles looked up in the `Employes` tab; no row with a valid role = "no access yet". Manage people via the admin **Team** tab (or the `Employes` tab directly). The OAuth app (project `n8n-workflows-454504`) is **already published / "In production"** with only non-sensitive scopes (`openid email profile`), so onboarding is *just* adding the person to the team — no GCP console step. The console's "requires verification" banner does NOT apply to non-sensitive scopes (no review needed, no user cap). Don't click "Back to testing" — that re-locks logins to console test-users.
