# Tutorials Tracker — pre-engine history (superseded)

Everything below describes the app BEFORE the 2026-06-30 pipeline-engine
refactor and the D1 cutover. It is kept for archaeology only — the current
architecture is in [CLAUDE.md](CLAUDE.md)'s READ FIRST section. Do not follow
anything here when changing code.

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

## Roadmap (from the product audit at `../../pipelines/docs/specs/2026-05-29-tracker-product-audit.md`)
- Done: focused review card, clickable links, reviewer-defaults-to-queue, email notifications, names, timestamps, admin Overview/Pipeline/filters, collapsed Done lane, collapsible stage sections, in-app "new video", in-app go.agrolloo link + description generation, **Readiness column** (topic_status-backed first stage in the Pipeline matrix; topic lanes renamed "Readiness in progress"/"Ready"), **click-to-sort on every Pipeline column** (Topic A–Z; stages by done→active→pending), **pending cells show a cross** (not a dot), **per-row delete** (Admin), **teammate-picker assignment** (assignment fields are dropdowns of the team, not free-text email), **admin Team tab** (manage the `Employes` tab in-app — add/edit roles/remove), **Thumbnail stage** (Thumbnail Maker, between Editing and Upload), **per-stage reviewers + optional review** (per-stage `*_reviewer_email`; blank reviewer ⇒ stage auto-completes on submit), **per-stage ETAs** (`*_eta` countdown badges).
- Next: **search by title** (admin scale), **archive** old published, mobile list view, wiring the `Access` tab as the live RBAC source. (The yt-analytics dashboard — App B — now exists in `personal-stuff/apps/analytics-app/`)
