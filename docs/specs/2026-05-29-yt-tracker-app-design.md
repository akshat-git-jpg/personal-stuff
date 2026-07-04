# YT Tracker App — Design Spec

**Date:** 2026-05-29
**Status:** Draft for review
**Goal:** Replace the App Script UI on the "YT tracker" sheet with a custom, visually pleasing, role-aware web app (Kanban board + RBAC), while keeping the Google Sheet as the source of truth so existing Python automations keep working unchanged.

---

## 1. Problem

The "YT tracker" Google Sheet drives day-to-day video production. Role-based column visibility and edit-locking are currently implemented in Google App Script, which:

- has no public API / MCP — every change is manual clicking in the App Script editor,
- is brittle and hard to evolve,
- has an unappealing UI.

We want a custom app that is editable as code (via Claude/MCP), looks good (Kanban/drag-drop), and enforces role-based access at both **column** and **row** level.

## 2. Core requirements

1. **Role-based access (RBAC), enforced server-side:**
   - **Column visibility** — a role only receives columns it's allowed to see.
   - **Column edit-lock** — a role can see some columns read-only (e.g. Editor sees tutorial columns but can't edit them).
   - **Row filter** — a role only sees rows assigned to them (by email).
2. **Kanban board** with drag-drop to change a status.
3. **Google login**; identity matched to a role via the existing `Employes` tab. No mapping = no access.
4. **Sheet stays the source of truth.** Existing scripts (`process_yt_tracker.py`, `yt_analysis`) keep reading/writing the `Master` tab unchanged.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Data store | Google Sheet (`Master` tab) remains source of truth |
| **Dev/test target** | A **copy** of the live sheet — `YT tracker (TEST COPY - app dev)`, ID `1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI` (owned by `akshatpatidar17`). The live sheet (`1_r0MchKeAyWlp_g4ESe3IlxZJ1Djx0WAOMTeVWjh_4E`) is **not touched** until tested and approved. Cut over by swapping one env var. |
| Auth | Sign in with Google → verified email → role from `Employes` tab |
| v1 priority | RBAC-first foundation, Kanban board on top |
| Hosting | Cloudflare (free tier): Pages/static SPA + Worker + KV |
| Stack | Vite + React SPA, Hono on Cloudflare Workers, KV for sessions, `dnd-kit` for drag-drop |
| RBAC policy storage | JSON config in the git repo (editable as code; admin UI later) |
| Row addressing | Add a hidden stable `row_id` column to `Master` (one-time migration) |

## 4. Data model (current `Master` tab)

Columns (24):
`video_title, video_notes, video_description, category, subcategory, topic_status, topic_date, tutorial_maker_email, tutorial_instruction, tutorial_link, tutorial_status, video_editor_email, video_editor_instruction, video_editor_link, video_editor_status, (blank), yt_upload_status, yt_upload_date, yt_link, short_links, actual_links, (blank), reviewer_email, admin_email`

Logical groups:
- **Topic/meta:** `video_title, video_notes, video_description, category, subcategory, topic_status, topic_date`
- **Tutorial:** `tutorial_maker_email, tutorial_instruction, tutorial_link, tutorial_status`
- **Editor:** `video_editor_email, video_editor_instruction, video_editor_link, video_editor_status`
- **Publish:** `yt_upload_status, yt_upload_date, yt_link, short_links, actual_links`
- **Assignment:** `reviewer_email, admin_email`

`Employes` tab (access list): `Name, Email, Role` with roles `Admin, Editor, Tutorial Maker` (+ `Reviewer` implied by `reviewer_email`).

**Migration:** add a hidden `row_id` column to `Master`; backfill once with stable unique IDs. The app addresses rows by `row_id`, not by sheet row number (which shifts on insert/sort).

## 5. RBAC policy

A JSON config in the repo, one entry per role:

```jsonc
{
  "Admin":         { "visible": "*", "editable": "*", "rows": "all" },
  "Reviewer":      { "visible": "*", "editable": ["yt_upload_status","yt_upload_date","yt_link","topic_status"], "rows": { "match": "reviewer_email" } },
  "Tutorial Maker":{ "visible": ["topic/meta","tutorial"], "editable": ["tutorial_link","tutorial_status"], "rows": { "match": "tutorial_maker_email" } },
  "Editor":        { "visible": ["topic/meta","tutorial","editor"], "readonly": ["tutorial"], "editable": ["video_editor_link","video_editor_status"], "rows": { "match": "video_editor_email" } }
}
```

(Group names expand to their columns from §4. Final field-level list pinned during implementation.)

Key behaviors:
- **Tutorial Maker** never receives Editor or Publish columns.
- **Editor** sees Tutorial columns **read-only** (context) and edits only Editor columns.
- Enforcement is **server-side** in the Worker — a role's hidden columns never leave the server; edit attempts on locked columns are rejected.

## 6. Kanban model

Each role's board is driven by **the status column that role owns**:

| Role | Board lanes (fixed, in order) | Drag flips |
|---|---|---|
| Tutorial Maker | `To Do → In Progress → In Review → Done` (from `tutorial_status`) | `tutorial_status` |
| Editor | `To Do → In Progress → In Review → Done` (from `video_editor_status`) | `video_editor_status` |
| Reviewer | `To Do → Draft → Uploaded` (from `yt_upload_status`) | `yt_upload_status` |
| Admin | switchable across the above + `To Do → To Process → To Review` (`topic_status`) | the selected status |

Lanes are a **fixed config**, not derived from sheet data — values that don't match a lane (e.g. stray/typo statuses) surface in an "Other / needs fixing" bucket rather than creating ad-hoc lanes.

Cards = videos (rows). A card shows the fields that role is allowed to see. Dragging a card to another lane writes the new status value back to the sheet for that `row_id`. A card detail panel lets the role edit its other editable fields (e.g. `tutorial_link`).

This makes the board itself express RBAC: you can only drag the status you're permitted to edit.

## 7. Architecture

```
Browser (React SPA, dnd-kit)
   │  Sign in with Google (OAuth)
   ▼
Cloudflare Worker (Hono)
   ├─ /auth/*      OAuth callback; verify email; look up role in Employes; create session in KV
   ├─ /api/board   read Master via Sheets API → apply RBAC (filter rows + strip/lock cols) → return
   ├─ /api/update  validate the field is editable for this role → write cell(s) by row_id → Sheets API
   └─ session check on every /api/* call (KV)
   ▼
Google Sheets API  ──▶  "YT tracker" → Master tab  (source of truth)
                              ▲
                              └─ Python scripts (process_yt_tracker.py, yt_analysis) — unchanged
```

**Modules (one job each):**
- `auth` — OAuth flow + session (KV).
- `sheets-adapter` — the only code that talks to the Sheets API (read all, write cell by `row_id`). Everything else is sheet-agnostic.
- `rbac` — pure function: `(role, rows, columns) → filtered/locked view`; and `canEdit(role, field) → bool`.
- `board` / `update` — HTTP handlers wiring the above.
- frontend `Board`, `Card`, `CardDetail` components.

**Caching/latency:** read-through with a short KV cache (~15–30s) to smooth Sheets API latency; writes go straight to the sheet and bust the cache. Fine for ~5 users.

**Auth infra:** needs a Google OAuth client + consent screen (console-UI step) in project `n8n-workflows-454504` (owned by akshatpatidar17). Sheets access via existing service account / shared OAuth.

## 8. Out of scope (v1)

- Editing the RBAC policy from a UI (it's JSON in the repo for now).
- Realtime multi-user live updates (poll/refresh is fine at this scale).
- Mobile-native app (responsive web is enough).
- Touching the `Existing` / `Formulas` tabs or the Analysis/Affiliate sheets.

## 9. Risks / open questions

- **Sheets API rate limits** — fine at this scale, but the read-through cache matters.
- **Concurrent edits** — last-write-wins per cell; acceptable for a 5-person team. Stable `row_id` prevents cross-row corruption.
- **OAuth consent screen** — one-time manual console step (no API for it).
- ~~Reviewer row scope~~ — **resolved:** Reviewer sees only rows where `reviewer_email` = them.
- ~~Kanban lanes~~ — **resolved:** fixed lane sets per role (see §6).
