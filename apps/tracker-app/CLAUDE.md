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
- **Migration:** `scripts/migrate-to-engine.ts` produced the wide→normalized cutover (already applied to prod). Project memory: `tracker-pipeline-engine.md`.

---

## Stack & where it runs

- **Frontend:** Vite + React + TypeScript SPA (`dnd-kit` for drag-drop).
- **Backend:** [Hono](https://hono.dev) app on a **Cloudflare Worker**; `SESSIONS` **KV** namespace for login sessions + a short board-rows cache.
- **Data backend:** Cloudflare D1 only (`tracker-db`, binding `TRACKER_DB`), via `src/worker/datastore.ts` (one `DataStore`; `getStore` always returns the D1 store). Tables: `pipelines` + `cards` + `card_stages` + `employees` (normalized — see the engine section above). The Sheets fallback was **removed**; `DATA_BACKEND` is vestigial. (`GOOGLE_SA_JSON` is still used elsewhere only for the affiliate-programs sheet read in link-gen.)
- **Auth:** Google OAuth **Web** client (project `n8n-workflows-454504`); verified email → role looked up in the active backend (D1 `employees` table, or the sheet's `Employes` tab in fallback mode).
- **Email:** Gmail API using `seankerman25@gmail.com`'s OAuth refresh token (from the shared `mcp/google-shared` setup).
- Served as one Worker: API on `/api/*` + `/auth/*`, everything else serves the built SPA from `dist/` via the `ASSETS` binding.

---

## The pipeline (single source of truth: `src/shared/pipeline.ts`)

The whole app is **derived from `STAGES` in `src/shared/pipeline.ts`** — column access, row gates, the lifecycle state machine, allowed transitions, lane bucketing, and the auto-generated `Access` tab. Change a stage there; everything follows. Nothing about stages/roles is hardcoded elsewhere.

```
Topic     (Admin)         gate: —                       reviewable  (assignee = admin_email)
  → Script    (Scriptwriter)   gate: topic_status == "Done"          reviewable
  → Recording (Recorder)       gate: script_status == "Done"         reviewable
  → Editing   (Video Editor)   gate: tutorial_status == "Done"       reviewable
  → Thumbnail (Thumbnail Maker) gate: video_editor_status == "Done"  reviewable
  → Upload    (Uploader)       gate: thumbnail_status == "Done"      TERMINAL (no review)
```

**Review is per-stage and optional.** Each reviewable stage has its own `*_reviewer_email` (`topic_reviewer_email`, `script_reviewer_email`, `tutorial_reviewer_email`, `video_editor_reviewer_email`, `thumbnail_reviewer_email`), assigned on the Topic card. If a stage's reviewer is **blank**, submitting that stage skips `In Review` and goes **straight to `Done`** ("Submit & complete") — no review step. `stageHasReviewer` / the auto-complete branch in `transitionsForStage` (rbac.ts) drive this. The legacy single `reviewer_email` column is kept only for back-compat/migration seed.

- **Uniform lifecycle** on every reviewable stage: `To Do → In Progress → In Review → Done`, with `Need Changes` as the bounce-back. Upload is terminal: `To Do → In Progress → Uploaded`.
- **Gated handoffs:** a stage opens only once the previous stage is `Done` (Upload is `Uploaded`). `isGateOpen` / `prevStage` in `pipeline.ts`.
- **Total lane normalization:** `normalizeStatus` maps blank/unknown → `To Do`, NEVER `Need Changes`. Fresh cards are created explicitly at `Topic=To Do`. This is why a new card can't mysteriously land in "Requires Fix".

## Roles & RBAC

Roles (from the `Employes` tab `Role` column, **comma-separated for multi-role**), all derived from the pipeline:
`Scriptwriter`, `Recorder`, `Video Editor`, `Thumbnail Maker`, `Uploader`, `Reviewer`, `Admin` (no Ideator — Topic is the Admin's job). A person can hold any combination; their view is the union of all roles. Person→role assignment lives ONLY in the admin **Team** tab, resolved **live on every request** (auth.ts) so changes apply with no re-login.

**Who does what:** the **Admin** creates topics, writes the description/links, and **assigns everyone** (all doer + per-stage `*_reviewer_email` columns) — assigning is admin-only. A stage's assigned **Reviewer** writes the per-stage **starting instructions** (`*_instruction`, granted `edit` in `reviewerAccess`) and reviews In-Review items → Done / Need Changes; reviewers do NOT assign people. Reviewing requires the Reviewer role + being that stage's assigned reviewer (NOT an Admin default) and never on your own submission (`canReview`).

- **Column access** per role is **generated** from `STAGES` in `src/shared/policy.ts` (`POLICY[role].access`; `Admin` = all). Don't hand-edit per-role access.
- **Row access:** `POLICY[role].rows` = `"all"` or `{match: <assignee email col>, gate?}`.
- **Per-stage reviewer (optional):** each reviewable stage has its own `*_reviewer_email`. **Approving / requesting changes is stage-specific** — only that stage's assigned reviewer (or Admin) can, and never on work they submitted themselves (`canReview` in `rbac.ts`). A blank stage reviewer ⇒ that stage auto-completes on submit (no review).
- **Submit vs approve:** doers move `To Do→In Progress→In Review` (and `Need Changes→…`); only the reviewer sets `Done` / `Need Changes` (`APPROVER_ONLY_VALUES`). `Need Changes` writes status + feedback atomically, so a card in Need Changes ALWAYS carries its reason.
- **Single enforcement point:** `authorizeWrite(roles, email, col, value, row)` in `rbac.ts` is the only authorization the worker calls; it returns `{ok, reason}` and the reason is surfaced in the UI as the lock tooltip.
- **Transitions as data:** `transitionsForStage` / `transitionsForCard` return the allowed status moves for a (user, card); the client renders its action buttons straight from these. `fieldLockReason` drives disabled-with-reason inputs.
- **Multi-role union** helpers in `rbac.ts` (`visibleColumnsForRoles`, `filterRowsForRoles`, `cardStagesForUser`, `reviewQueueForUser`, …).

Everything is **enforced server-side** — restricted columns never leave the Worker (`projectRowForRoles`), and the board response carries per-row `_stages` / `_actions` / `_locks` so the **client never re-derives permissions** (one rendering path → admin "view as" can't diverge from the real user).

---

## The Google Sheet (fallback backend)

> Now the **fallback** backend — used only when `DATA_BACKEND=sheets`. D1 is the default. The D1 `cards`/`employees` tables mirror the `Master`/`Employes` tabs below; the one-time Sheets→D1 copy is `scripts/migrate-to-d1.ts`.

- **TEST copy (current target):** `1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI` ("YT tracker (TEST COPY - app dev)", owned by `akshatpatidar17`). The SA is shared as writer.
- **LIVE sheet (untouched until cutover):** `1_r0MchKeAyWlp_g4ESe3IlxZJ1Djx0WAOMTeVWjh_4E`.
- **Tabs:**
  - `Master` — one row per video. 34 columns (see `src/shared/columns.ts`). Each stage has exactly one assignee column (`ideator_email`, `script_writer_email`, `tutorial_maker_email`, `video_editor_email`, `uploader_email`) and a feedback column (`topic_feedback`, `script_feedback`, `tutorial_feedback`, `editor_feedback`); `reviewer_email` is the single card-level reviewer. All Sheets I/O is keyed by **header name**, so column order is irrelevant and `ensureColumns` can append new headers without disturbing data. A hidden stable `row_id` (`r0001…`) addresses rows; `last_updated` stamps every change. Title-less rows are ignored.
  - `Employes` — `Name, Email, Role` (Role comma-separated for multi-role). This is the **access list**: no row = no access.
  - `Access` — a read-only **mirror** of the code policy, **auto-generated** by `scripts/migrate-pipeline.ts` (one row per column, one Hidden/View/Edit cell per role). The app reads `policy.ts` (which is itself derived from `pipeline.ts`); regenerate the Access tab by re-running the migration. Do not hand-edit it.
  - `Existing`, `Formulas` — not used by the app.
- **Column groups** (Master): Topic/meta · Script (`script_*`) · Tutorial/recording (`tutorial_*`) · Editing (`video_editor_*` + `editor_feedback`) · Publish (`yt_*`, `short_links`, `actual_links`, `reviewer_email`) · system (`row_id`, `last_updated`).

---

## File map

```
src/shared/        # pure, runs in both Worker and Node — the RBAC brain
  pipeline.ts      # ★ SINGLE SOURCE OF TRUTH: STAGES, roles, lifecycle states, gates,
                   #   normalizeStatus, statusOf, isGateOpen. Everything else derives from this.
  columns.ts       # COLUMNS (34) + Column type
  policy.ts        # POLICY/APPROVER_ONLY_VALUES/STAGE_OF_COL — all DERIVED from pipeline.ts
  rbac.ts          # union helpers + authorizeWrite (single enforcement) + transitionsFor*
                   #   + canReview + cardStagesForUser + reviewQueueForUser + fieldLockReason
src/worker/        # Cloudflare Worker (Hono)
  index.ts         # routes: /api/board, /api/update, /api/review, /api/approvals, /api/team, /api/me
  auth.ts          # Google OAuth + KV sessions (store {email, roles[]}), requireSession, /dev-login
  roles.ts         # Employes → email→roles[] (parseRoles, lookupRoles, loadTeam)
  sheets.ts        # the ONLY Sheets API caller: readRows, updateCell, touchRow, ensureRowIds, appendRow
  google-jwt.ts    # service-account JWT mint (RS256 via WebCrypto), base64url helpers
  notify.ts        # Gmail send (refresh-token flow) + NOTIFY_REDIRECT safety
  gemini.ts        # minimal Gemini REST client (generateText/generateJSON) — link-gen
  prompts.ts       # detect-tools + describe prompt templates (ported from common/prompts/tracker/)
  affiliate.ts     # Affiliate Programs sheet reader + normalizeToolName
  clickstore.ts    # native D1/KV adapters (videos/links tables in clicks-db) for link-gen
  linkgen.ts       # process_yt_tracker.py port: detect → resolve → mint code → KV+D1 → describe
src/client/        # React SPA — RENDER-ONLY. No drag-drop; status changes via action buttons.
  App.tsx          # auth gate, sign-in + dev preview, topbar, read-only view-as picker
  Board.tsx        # role-adaptive tabs (My work / Review queue / Board / Pipeline / Team);
                   #   lane boards group by status; cards render server `_actions` as buttons
  Card.tsx         # status pill + Need-Changes banner + inline next-action button(s)
  CardDetail.tsx   # stage sections; fields editable or disabled-with-reason (from `_locks`);
                   #   action buttons (from `_actions`); reviewer approve/request-changes
  ReviewQueue.tsx  # reviewer inbox (who submitted what, on which stage)
  PipelineBoard.tsx, Filters.tsx   # admin matrix (one col per STAGE) + filters
  TeamPanel.tsx    # the ONLY place roles are assigned to people (Employes tab)
  api.ts           # fetch wrappers, applyTransition, BoardRow/Transition types
  status.ts        # STATUS_META (label + colour tone) + legend — one colour system everywhere
  labels.ts        # FIELD_LABELS + stage maps, all derived from STAGES
  lanes.ts         # lanesFor(statusCol) + groupByLane (total: blank→To Do)
  pipeline.ts      # admin matrix helpers (progress/activeStage/isStuck) derived from STAGES
test/              # vitest: rbac.test.ts (new-model authority), affiliate, linkgen
scripts/           # migrate-pipeline.ts (idempotent 2026 migration) + `npx tsx scripts/<x>.ts`
```

## API (all behind a session except auth/auth-mode)

- `GET /api/board[?asUser=email]` → `{roles, stages, columns, rows, names, viewingAs, readOnly}`. Each row carries `_stages` (lane membership), `_actions` (allowed transitions), `_locks` (col→reason). Admin `asUser` is a **pure read-only mirror** (no edit elevation; `readOnly:true`) → identical to the real user's view.
- `POST /api/update {row_id, col, value, prev?}` → single check `authorizeWrite`; doer status transitions + content edits; `prev` enables optimistic-concurrency (409 on conflict). Fires submit/assign emails.
- `POST /api/review {row_id, stage, action, feedback?}` → card's assigned reviewer (or admin) only; `stage` = a reviewable stage id (topic|script|recording|editing|thumbnail); approve→Done, sendback→Need Changes (feedback required, written atomically); emails the submitter.
- `GET /api/review-queue` → cards In-Review that THIS user is the assigned reviewer for (admins see all), with submitter name + stage.
- `POST /api/video {video_title, video_notes?, category?, subcategory?}` → Admin-only; appends a Master row, returns `{row_id}`.
- `POST /api/delete {row_id}` → Admin-only; deletes the Master row (`deleteRowById` → Sheets `deleteDimension`), busts the board cache. Surfaced as a per-row 🗑 button in the admin Pipeline matrix.
- `POST /api/generate-links {row_id}` → Admin-only; ports `process_yt_tracker.py` — detects tools (Gemini), mints go.agrolloo short links into `CLICKS_KV` + `clicks-db` D1, writes `video_description`/`actual_links`/`short_links` back, returns `{description, links, non_affiliate_tools}`.
- `GET /api/team` (admin/approver), `GET /api/roles` (valid role names), `GET /api/me`, `GET /api/auth-mode`.
- `POST /api/team {name, email, roles[]}` → Admin-only; upsert a teammate in the `Employes` tab (by email). `POST /api/team/delete {email}` → Admin-only; remove one. Both bust the board cache. Backs the admin **Team** tab (`TeamPanel.tsx`). Editing the `Employes` tab IS editing both assignment options and login access.
- `GET /auth/login` · `GET /auth/callback` · `POST /auth/logout` · `GET /dev-login?email=…` (dev only).

## Notifications (email)

Sent from `seankerman25@gmail.com` (display "Tutorials Tracker") on: **submitted** (→ reviewer/admin), **approved** & **sent-back** (→ freelancer, with feedback), **assigned** (→ assignee). Best-effort (never blocks the action). `NOTIFY_REDIRECT` (set during testing) routes all mail to one address; **unset it in production** to reach real recipients.

---

## Run locally

```bash
cd youtube/tracker-app
npm install                 # uses the local .npmrc → public npm registry (avoids Zluri CodeArtifact 401)
npm run build               # builds the SPA into dist/
npx wrangler dev --port 8787
# open http://localhost:8787
```

- **`.dev.vars`** (gitignored) holds all secrets/config: `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `SHEET_ID`, `SESSION_SECRET`, `GOOGLE_SA_JSON`, `DEV_AUTH=1`, `GMAIL_*`, `NOTIFY_REDIRECT`, `APP_URL`.
- **`DEV_AUTH=1`** enables the **dev preview login** (per-person buttons on the sign-in screen + an `X-Dev-Roles` header bypass) so you can test any role without real Google login. **Must be OFF in production.**
- **`npm test`** → `vitest run` (49 tests; includes `test/engine.test.ts` — validation, round-trip, routing).

### ⚠️ Gotchas
- **`wrangler dev` serves a STALE snapshot of `dist/`.** After ANY client (SPA) rebuild you MUST **restart `wrangler dev`** (`pkill -f "wrangler dev"`; `npm run build`; restart) or the browser shows old UI. Worker-only changes hot-reload fine.
- The local `.npmrc` pins the public registry — keep it (home `~/.npmrc` points at Zluri CodeArtifact which 401s on public packages).
- Sheets read range is bounded (`A1:…999`); fine now, but archive/scale needed past ~1000 rows.
- **Link generation needs the D1 schema in the LOCAL D1.** `wrangler dev` uses an empty *local* D1, not the remote `clicks-db`, so `/api/generate-links` errors with `no such table: videos` until you seed it once: `npx wrangler d1 execute clicks-db --local --file=../../../TY/workers/redirector/migrations/0001_init.sql`. Production uses the remote `clicks-db` (already has the tables from the redirector in the sibling TY repo at `TY/workers/redirector`).

## Deploy (only on owner's "final")

1. `npm run build`.
2. `npx wrangler deploy` → get the `*.workers.dev` URL.
3. Add `<url>/auth/callback` to the OAuth client's **Authorized redirect URIs** (Google Cloud console — manual, no API).
4. Set secrets: `npx wrangler secret put GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SESSION_SECRET|GOOGLE_SA_JSON|GMAIL_*`; set `SHEET_ID`, `GOOGLE_REDIRECT_URI`. **Do NOT set `DEV_AUTH` or `NOTIFY_REDIRECT`** in prod.
5. **Schema migration (run once per sheet, idempotent):** `npx tsx scripts/migrate-pipeline.ts` (reads `SHEET_ID` + `GOOGLE_SA_JSON` from `.dev.vars`, or `SHEET_ID=<id> npx tsx …`). It adds the new columns, maps legacy statuses (`topic_status` Ready→Done; `yt_upload_status` Published→Uploaded/Draft→In Progress), renames legacy roles (`Script Writer`→`Scriptwriter`, `Tutorial Maker`→`Recorder`), and regenerates the `Access` tab. After migrating, assign the new **Ideator**/**Uploader** roles to people via the admin Team tab.
6. **Cutover to the live sheet:** run `ensureRowIds` then `scripts/migrate-pipeline.ts` against the live sheet, point `SHEET_ID` at it, redeploy.

## Roadmap (from the product audit at `../../../TY/docs/specs/2026-05-29-tracker-product-audit.md` in the sibling TY repo)
- Done: focused review card, clickable links, reviewer-defaults-to-queue, email notifications, names, timestamps, admin Overview/Pipeline/filters, collapsed Done lane, collapsible stage sections, in-app "new video", in-app go.agrolloo link + description generation, **Readiness column** (topic_status-backed first stage in the Pipeline matrix; topic lanes renamed "Readiness in progress"/"Ready"), **click-to-sort on every Pipeline column** (Topic A–Z; stages by done→active→pending), **pending cells show a cross** (not a dot), **per-row delete** (Admin), **teammate-picker assignment** (assignment fields are dropdowns of the team, not free-text email), **admin Team tab** (manage the `Employes` tab in-app — add/edit roles/remove), **Thumbnail stage** (Thumbnail Maker, between Editing and Upload), **per-stage reviewers + optional review** (per-stage `*_reviewer_email`; blank reviewer ⇒ stage auto-completes on submit), **per-stage ETAs** (`*_eta` countdown badges).
- Next: **search by title** (admin scale), **archive** old published, mobile list view, wiring the `Access` tab as the live RBAC source. (The yt-analytics dashboard — App B — now exists in `personal-stuff/apps/analytics-app/`.)

## Access / onboarding

Login = Google OAuth → email verified → roles looked up in the `Employes` tab; no row with a valid role = "no access yet". Manage people via the admin **Team** tab (or the `Employes` tab directly). The OAuth app (project `n8n-workflows-454504`) is **already published / "In production"** with only non-sensitive scopes (`openid email profile`), so onboarding is *just* adding the person to the team — no GCP console step. The console's "requires verification" banner does NOT apply to non-sensitive scopes (no review needed, no user cap). Don't click "Back to testing" — that re-locks logins to console test-users.
