# Tutorials Tracker — project guide

A role-aware **Kanban web app over the "YT tracker" Google Sheet** for the YouTube tutorial-production pipeline. It replaces a clunky Google App Script UI: nicer board, server-enforced role-based access (column + row level), an approval/QC flow, email notifications, and admin dashboards. The **Google Sheet stays the source of truth** so existing Python automations keep working.

> **Status:** **deployed** at https://tutorials-tracker.agrolloo.com (Cloudflare Worker, custom domain). The Google Sheet stays the source of truth.

---

## Stack & where it runs

- **Frontend:** Vite + React + TypeScript SPA (`dnd-kit` for drag-drop).
- **Backend:** [Hono](https://hono.dev) app on a **Cloudflare Worker**; `SESSIONS` **KV** namespace for login sessions + a short board-rows cache.
- **Data:** Google Sheets API v4 via the **service account** `n8n-google-sa@n8n-workflows-454504.iam.gserviceaccount.com` (creds in repo-root `TY/credentials.json`, passed to the Worker as `GOOGLE_SA_JSON`).
- **Auth:** Google OAuth **Web** client (project `n8n-workflows-454504`); verified email → role looked up in the sheet's `Employes` tab.
- **Email:** Gmail API using `seankerman25@gmail.com`'s OAuth refresh token (from the shared `mcp/google-shared` setup).
- Served as one Worker: API on `/api/*` + `/auth/*`, everything else serves the built SPA from `dist/` via the `ASSETS` binding.

---

## The pipeline (5 stages)

```
Topic (Admin)
  → Script (Script Writer)            gate: topic_status == "Ready"
  → Tutorial / recording (Tutorial Maker)  gate: script_status == "Done"
  → Editing (Video Editor)            gate: tutorial_status == "Done"
  → Upload & Publish (Admin/Reviewer) gate: video_editor_status == "Done"
```

- **Tutorial Maker** = the person who makes the **screen recordings** (NOT the script). The **Script Writer** writes the script. They are separate roles (one person can hold both — see multi-role).
- **Gated handoffs:** a downstream role only sees a video once the upstream stage is approved (`Done`). Implemented in `filterRows*`'s `gate`.
- **One approval per work stage.**

## Roles & RBAC

Roles (from the `Employes` tab `Role` column, **comma-separated for multi-role**, e.g. `Script Writer, Tutorial Maker`):
`Admin`, `Reviewer`, `Script Writer`, `Tutorial Maker`, `Video Editor`.

- **Need-to-know column access** per role lives in `src/shared/policy.ts` (`POLICY[role].access` = `{column: "view"|"edit"}`; `Admin` = `all`). e.g. a Tutorial Maker sees the approved **script** read-only (to record from) + edits the recording fields; she does NOT see the editor/publish columns.
- **Row access:** `POLICY[role].rows` = `"all"` or `{match: <assignee email col>, gate?: {col, equals}}`.
- **Submit vs approve:** doers can move their status up to **"In Review"** only; **"Done" is approver-only** (`APPROVER_ONLY_VALUES` on `script_status`/`tutorial_status`/`video_editor_status`; approvers = `APPROVER_ROLES` = Admin + Reviewer). Enforced server-side in `POST /api/update` + `POST /api/review`.
- **Lock after approval:** once a stage's status is `Done`, its fields are read-only for non-approvers (`isFieldLocked` + `STAGE_OF_COL`). Field-level (multi-role safe).
- **Send-back:** an approver sets status back to `In Progress` and writes the per-stage feedback column (`script_feedback` / `tutorial_feedback` / `editor_feedback`); the freelancer sees it on the card.
- **Multi-role:** a user can hold several roles; the worker uses the **union** helpers in `src/shared/rbac.ts` (`visibleColumnsForRoles`, `canEditForRoles`, `canSetValueForRoles`, `filterRowsForRoles`, `isApproverRoles`, `workerStagesForRoles`, `isFieldLocked`). The board offers a **stage switcher** when a worker holds >1 worker stage.

Everything is **enforced server-side** — restricted columns never leave the Worker (`projectRowForRoles`).

---

## The Google Sheet

- **TEST copy (current target):** `1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI` ("YT tracker (TEST COPY - app dev)", owned by `akshatpatidar17`). The SA is shared as writer.
- **LIVE sheet (untouched until cutover):** `1_r0MchKeAyWlp_g4ESe3IlxZJ1Djx0WAOMTeVWjh_4E`.
- **Tabs:**
  - `Master` — one row per video. 31 columns (see `src/shared/columns.ts`). A hidden stable `row_id` (`r0001…`) addresses rows; `last_updated` is an ISO timestamp the app stamps on every change. Real videos must have a `video_title` (title-less rows are ignored).
  - `Employes` — `Name, Email, Role` (Role comma-separated for multi-role). This is the **access list**: no row = no access.
  - `Access` — a human-readable **mirror** of the RBAC matrix (col A = field label, col B = real column key, then a column per role with Hidden/View/Edit). NOTE: the app currently reads `policy.ts`, not this tab — keep them in sync by hand; wiring the app to read it is a future option.
  - `Existing`, `Formulas` — not used by the app.
- **Column groups** (Master): Topic/meta · Script (`script_*`) · Tutorial/recording (`tutorial_*`) · Editing (`video_editor_*` + `editor_feedback`) · Publish (`yt_*`, `short_links`, `actual_links`, `reviewer_email`) · system (`row_id`, `last_updated`).

---

## File map

```
src/shared/        # pure, runs in both Worker and Node — the RBAC brain
  columns.ts       # COLUMNS (31) + Column type
  policy.ts        # POLICY (per-role access + rows/gates + laneStatus), APPROVER_ROLES,
                   #   APPROVER_ONLY_VALUES, STAGE_OF_COL (field-lock map)
  rbac.ts          # per-role fns + *ForRoles union helpers + isFieldLocked + filter/project
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
src/client/        # React SPA
  App.tsx          # auth gate, sign-in screen + dev preview buttons, topbar
  Board.tsx        # worker kanban + multi-role stage switcher + Admin tab bar (Overview/Pipeline/Board/Awaiting)
  Card.tsx, CardDetail.tsx   # card + collapsible stage-section detail panel (Brief/Script/Recording/Editing/Publish)
  AdminOverview.tsx, PipelineBoard.tsx, Filters.tsx   # admin dashboards (funnel, row-per-topic matrix, filters)
  api.ts           # fetch wrappers + displayName + types
  labels.ts        # FIELD_LABELS, LANE_LABELS, stage maps (STAGE_NAME/ARTIFACT_COL/EMAIL_FOR_STAGE/FEEDBACK_COL), LINK_COLS/HINTS
  lanes.ts         # LANES per status column + groupByLane
  pipeline.ts      # overallStage/progress/isStalled/isStuck (admin Overview + Pipeline)
test/              # vitest: rbac.test.ts, pipeline.test.ts, lanes.test.ts  (129 tests)
scripts/           # one-off Node smoke tests (run with `npx tsx scripts/<x>.ts`)
```

## API (all behind a session except auth/auth-mode)

- `GET /api/board[?asUser=email]` → `{roles, stages, columns, rows, names, viewingAs, readOnly}` (admin `asUser` = read-only "view as that person").
- `POST /api/update {row_id, col, value}` → gated by canEdit + field-lock + canSetValue; stamps `last_updated`; fires submit/assign emails.
- `POST /api/review {row_id, stage, action, feedback?}` → approver-only; `stage` ∈ script|tutorial|editor|upload; approve→Done/Published, sendback→In Progress(+feedback); emails the assignee.
- `GET /api/approvals` → approver queue across Script/Recording/Editing In-Review items.
- `POST /api/video {video_title, video_notes?, category?, subcategory?}` → Admin-only; appends a Master row, returns `{row_id}`.
- `POST /api/generate-links {row_id}` → Admin-only; ports `process_yt_tracker.py` — detects tools (Gemini), mints go.agrolloo short links into `CLICKS_KV` + `clicks-db` D1, writes `video_description`/`actual_links`/`short_links` back, returns `{description, links, non_affiliate_tools}`.
- `GET /api/team` (admin), `GET /api/me`, `GET /api/auth-mode`.
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
- **`npm test`** → `vitest run` (129 tests).

### ⚠️ Gotchas
- **`wrangler dev` serves a STALE snapshot of `dist/`.** After ANY client (SPA) rebuild you MUST **restart `wrangler dev`** (`pkill -f "wrangler dev"`; `npm run build`; restart) or the browser shows old UI. Worker-only changes hot-reload fine.
- The local `.npmrc` pins the public registry — keep it (home `~/.npmrc` points at Zluri CodeArtifact which 401s on public packages).
- Sheets read range is bounded (`A1:…999`); fine now, but archive/scale needed past ~1000 rows.
- **Link generation needs the D1 schema in the LOCAL D1.** `wrangler dev` uses an empty *local* D1, not the remote `clicks-db`, so `/api/generate-links` errors with `no such table: videos` until you seed it once: `npx wrangler d1 execute clicks-db --local --file=../../workers/redirector/migrations/0001_init.sql`. Production uses the remote `clicks-db` (already has the tables from `workers/redirector`).

## Deploy (only on owner's "final")

1. `npm run build`.
2. `npx wrangler deploy` → get the `*.workers.dev` URL.
3. Add `<url>/auth/callback` to the OAuth client's **Authorized redirect URIs** (Google Cloud console — manual, no API).
4. Set secrets: `npx wrangler secret put GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SESSION_SECRET|GOOGLE_SA_JSON|GMAIL_*`; set `SHEET_ID`, `GOOGLE_REDIRECT_URI`. **Do NOT set `DEV_AUTH` or `NOTIFY_REDIRECT`** in prod.
5. **Cutover to the live sheet:** run `ensureRowIds` against the live sheet, add the `last_updated`/`script_*`/feedback columns + the `Employes`/`Access` tabs, then point `SHEET_ID` at the live sheet and redeploy. Add real teammates to `Employes`.

## Roadmap (from the product audit at `TY/docs/specs/2026-05-29-tracker-product-audit.md`)
- Done: focused review card, clickable links, reviewer-defaults-to-queue, email notifications, names, timestamps, admin Overview/Pipeline/filters, collapsed Done lane, collapsible stage sections, in-app "new video", in-app go.agrolloo link + description generation.
- Next: **search by title** (admin scale), **archive** old published, mobile list view, teammate-picker assignment, wiring the `Access` tab as the live RBAC source, separate yt-analytics dashboard (App B: clicks/views/rankings).
