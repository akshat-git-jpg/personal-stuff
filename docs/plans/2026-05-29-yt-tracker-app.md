# YT Tracker App — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This plan favors working-code-first + manual smoke tests (per repo style), with unit tests only on the RBAC engine.

**Goal:** A Cloudflare-hosted web app that shows the YT tracker as a role-aware Kanban board, with Google login and server-enforced column/row RBAC, reading/writing a copy of the Google Sheet.

**Architecture:** React SPA (Vite + dnd-kit) served by a Hono app on Cloudflare Workers. The Worker handles Google OAuth (sessions in KV), reads/writes the Sheet via the Google Sheets API, and applies a pure RBAC policy server-side before any data leaves. The Sheet is the source of truth; dev targets a test copy.

**Tech Stack:** TypeScript, Vite, React, `dnd-kit`, Hono, Cloudflare Workers + KV, Google Sheets API v4, Google OAuth 2.0.

**Project location:** `youtube/tracker-app/` in the TY repo.

**Build target sheet:** `1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI` (`YT tracker (TEST COPY - app dev)`). Live sheet untouched until cutover.

---

## File structure (what gets built)

```
youtube/tracker-app/
├── package.json, tsconfig.json, vite.config.ts, wrangler.toml   # scaffold + CF config
├── .dev.vars                          # local secrets (gitignored): OAuth client, sheet id
├── src/
│   ├── shared/
│   │   ├── columns.ts                 # column groups + the 24 Master columns
│   │   ├── policy.ts                  # the RBAC policy config (role → visible/readonly/editable/rows)
│   │   └── rbac.ts                    # PURE functions: filterRows, projectColumns, canEdit
│   ├── worker/
│   │   ├── index.ts                   # Hono app: routes + session middleware
│   │   ├── auth.ts                    # Google OAuth flow + KV session create/verify
│   │   ├── sheets.ts                  # ONLY module that calls the Sheets API
│   │   └── roles.ts                   # read Employes tab → email→role lookup (cached in KV)
│   └── client/
│       ├── main.tsx, App.tsx          # SPA bootstrap + auth gate
│       ├── api.ts                     # fetch wrappers for /api/*
│       ├── Board.tsx                  # dnd-kit board: lanes + cards
│       ├── Card.tsx, CardDetail.tsx   # card + editable detail panel
│       └── lanes.ts                   # fixed lane config per role
└── test/
    └── rbac.test.ts                   # unit tests for the pure RBAC engine
```

---

## Task 1: Scaffold the project + Cloudflare config

**Files:**
- Create: `youtube/tracker-app/package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.toml`, `.gitignore`, `.dev.vars.example`

- [ ] **Step 1: Scaffold**

```bash
cd /Users/kbtg/codebase/TY/youtube
npm create vite@latest tracker-app -- --template react-ts
cd tracker-app
npm install
npm install hono @hono/vite-dev-server dnd-kit @dnd-kit/core @dnd-kit/sortable
npm install -D wrangler @cloudflare/workers-types
```

- [ ] **Step 2: `wrangler.toml`** — Worker + KV binding + static assets

```toml
name = "yt-tracker-app"
main = "src/worker/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"

[[kv_namespaces]]
binding = "SESSIONS"
id = "REPLACE_AFTER_kv_create"
```

- [ ] **Step 3: Create the KV namespace**

```bash
npx wrangler kv namespace create SESSIONS
# paste the returned id into wrangler.toml
```

- [ ] **Step 4: `.dev.vars.example`** (copy to `.dev.vars`, gitignored)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback
SHEET_ID=1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI
SESSION_SECRET=
GOOGLE_SA_JSON=        # service-account JSON (one line) for Sheets read/write
```

- [ ] **Step 5: Commit**

```bash
git add youtube/tracker-app
git commit -m "feat(tracker-app): scaffold vite+react+hono on cloudflare workers"
```

---

## Task 2: Column model + RBAC policy (shared, pure)

**Files:**
- Create: `src/shared/columns.ts`, `src/shared/policy.ts`

- [ ] **Step 1: `columns.ts`** — the 24 Master columns and their groups

```ts
export const COLUMNS = [
  "row_id","video_title","video_notes","video_description","category","subcategory",
  "topic_status","topic_date","tutorial_maker_email","tutorial_instruction","tutorial_link",
  "tutorial_status","video_editor_email","video_editor_instruction","video_editor_link",
  "video_editor_status","yt_upload_status","yt_upload_date","yt_link","short_links",
  "actual_links","reviewer_email","admin_email",
] as const;
export type Column = typeof COLUMNS[number];

export const GROUPS: Record<string, Column[]> = {
  meta:     ["video_title","video_notes","video_description","category","subcategory","topic_status","topic_date"],
  tutorial: ["tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status"],
  editor:   ["video_editor_email","video_editor_instruction","video_editor_link","video_editor_status"],
  publish:  ["yt_upload_status","yt_upload_date","yt_link","short_links","actual_links"],
  assign:   ["reviewer_email","admin_email"],
};
```

- [ ] **Step 2: `policy.ts`** — role → access (matches the spec table)

```ts
import { Column, GROUPS } from "./columns";
type RowRule = "all" | { match: Column };
export interface RolePolicy {
  visibleGroups: (keyof typeof GROUPS)[] | "*";
  readonlyGroups: (keyof typeof GROUPS)[];
  editable: Column[];          // explicit editable columns ("*"-Admin handled in rbac)
  rows: RowRule;
  laneStatus: Column;          // which status column drives this role's board
}
export const POLICY: Record<string, RolePolicy> = {
  "Admin":          { visibleGroups: "*", readonlyGroups: [], editable: [], rows: "all",                       laneStatus: "topic_status" },
  "Reviewer":       { visibleGroups: "*", readonlyGroups: [], editable: ["yt_upload_status","yt_upload_date","yt_link","topic_status"], rows: { match: "reviewer_email" }, laneStatus: "yt_upload_status" },
  "Tutorial Maker": { visibleGroups: ["meta","tutorial"], readonlyGroups: ["meta"], editable: ["tutorial_link","tutorial_status"], rows: { match: "tutorial_maker_email" }, laneStatus: "tutorial_status" },
  "Editor":         { visibleGroups: ["meta","tutorial","editor"], readonlyGroups: ["meta","tutorial"], editable: ["video_editor_link","video_editor_status"], rows: { match: "video_editor_email" }, laneStatus: "video_editor_status" },
};
```

- [ ] **Step 3: Commit** — `git commit -m "feat(tracker-app): column model + RBAC policy"`

---

## Task 3: RBAC engine (pure) + unit tests

**Files:**
- Create: `src/shared/rbac.ts`, `test/rbac.test.ts`

- [ ] **Step 1: `rbac.ts`** — pure functions

```ts
import { Column, COLUMNS, GROUPS } from "./columns";
import { POLICY } from "./policy";
export type Row = Record<Column, string>;

export function visibleColumns(role: string): Column[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.visibleGroups === "*") return [...COLUMNS];
  const set = new Set<Column>(["row_id"]);
  for (const g of p.visibleGroups) GROUPS[g].forEach(c => set.add(c));
  return COLUMNS.filter(c => set.has(c));
}
export function canEdit(role: string, col: Column): boolean {
  const p = POLICY[role]; if (!p) return false;
  if (p.visibleGroups === "*" && p.editable.length === 0) return true; // Admin
  return p.editable.includes(col);
}
export function filterRows(role: string, email: string, rows: Row[]): Row[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.rows === "all") return rows;
  const col = p.rows.match;
  return rows.filter(r => (r[col] || "").trim().toLowerCase() === email.toLowerCase());
}
export function projectRow(role: string, row: Row): Partial<Row> {
  const cols = visibleColumns(role);
  const out: Partial<Row> = {};
  for (const c of cols) out[c] = row[c];
  return out;
}
```

- [ ] **Step 2: `test/rbac.test.ts`** — the cases that matter

```ts
import { describe, it, expect } from "vitest";
import { visibleColumns, canEdit, filterRows } from "../src/shared/rbac";

describe("RBAC", () => {
  it("Tutorial Maker cannot see editor columns", () => {
    expect(visibleColumns("Tutorial Maker")).not.toContain("video_editor_link");
  });
  it("Editor sees tutorial columns but cannot edit them", () => {
    expect(visibleColumns("Editor")).toContain("tutorial_status");
    expect(canEdit("Editor", "tutorial_status")).toBe(false);
    expect(canEdit("Editor", "video_editor_status")).toBe(true);
  });
  it("Admin can edit anything", () => {
    expect(canEdit("Admin", "tutorial_status")).toBe(true);
  });
  it("unknown role gets nothing", () => {
    expect(visibleColumns("Nope")).toEqual([]);
    expect(canEdit("Nope", "video_title")).toBe(false);
  });
  it("row filter matches assignee email case-insensitively", () => {
    const rows = [{ tutorial_maker_email: "A@x.com" }, { tutorial_maker_email: "b@x.com" }] as any;
    expect(filterRows("Tutorial Maker", "a@x.com", rows)).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run** — `npx vitest run` → all pass.
- [ ] **Step 4: Commit** — `git commit -m "feat(tracker-app): RBAC engine + tests"`

---

## Task 4: Sheets adapter

**Files:**
- Create: `src/worker/sheets.ts`

- [ ] **Step 1: `addRowIds` migration helper** — one-time, ensures a `row_id` column exists in Master and every data row has a stable id. (Run once against the test sheet via a small script or an admin route; idempotent.)

- [ ] **Step 2: `readRows()`** — GET `Master!A1:W999`; map header → array of `Row` objects keyed by column name.

- [ ] **Step 3: `updateCell(rowId, col, value)`** — find the row index by `row_id`, compute the A1 cell from the column position, PUT the value. Returns the updated row.

- [ ] **Step 4: Auth** — use the service-account JSON (`GOOGLE_SA_JSON`) to mint a Sheets access token inside the Worker (JWT → token exchange; cache token in KV until expiry).

- [ ] **Step 5: Smoke test** — a `/api/_debug/rows` route (admin-only, removed later) that returns row count. Run `npx wrangler dev`, hit it, confirm it reads the test sheet.
- [ ] **Step 6: Commit** — `git commit -m "feat(tracker-app): sheets adapter (read/update by row_id)"`

---

## Task 5: Google OAuth + sessions + role lookup

**Files:**
- Create: `src/worker/auth.ts`, `src/worker/roles.ts`, `src/worker/index.ts`

- [ ] **Step 1: OAuth client** — create an OAuth 2.0 **Web** client + consent screen in project `n8n-workflows-454504` (manual console step — see "Manual steps" below). Authorized redirect: `http://localhost:8787/auth/callback` (dev) and the prod Worker URL.

- [ ] **Step 2: `auth.ts`** — `/auth/login` (redirect to Google), `/auth/callback` (exchange code, fetch verified email, create session in KV with `{email, role}`, set HttpOnly cookie), `requireSession` middleware.

- [ ] **Step 3: `roles.ts`** — read `Employes!A:C`, build `email → role` map (cache in KV ~5 min). Email not in map → session denied (no access).

- [ ] **Step 4: `index.ts`** — Hono app: mount auth routes, session middleware on `/api/*`, serve SPA via `ASSETS`.

- [ ] **Step 5: Smoke test** — `wrangler dev`, log in with `akshatpatidar17@gmail.com` (an Editor in Employes), confirm session cookie + role resolved; log in with a non-listed email → denied.
- [ ] **Step 6: Commit** — `git commit -m "feat(tracker-app): google oauth + sessions + role lookup"`

---

## Task 6: Board API (RBAC-enforced)

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: `GET /api/board`** — read rows → `filterRows(role,email,rows)` → `projectRow(role,...)` each → return `{ role, columns: visibleColumns(role), rows }`. Restricted columns never leave the Worker.

- [ ] **Step 2: `POST /api/update`** — body `{ row_id, col, value }`. Reject if `!canEdit(role, col)` (403). Else `sheets.updateCell(...)`, return the re-projected row. Bust any board cache.

- [ ] **Step 3: Short read cache** — wrap `readRows` with a ~15s KV cache; `/api/update` clears it.

- [ ] **Step 4: Smoke test** — as Editor, `GET /api/board` returns only their rows and no editor-hidden columns for Tutorial Maker; `POST /api/update` on `tutorial_status` as Editor → 403; on `video_editor_status` → 200 and the test sheet cell changes.
- [ ] **Step 5: Commit** — `git commit -m "feat(tracker-app): RBAC-enforced board + update API"`

---

## Task 7: Kanban UI

**Files:**
- Create: `src/client/api.ts`, `lanes.ts`, `Board.tsx`, `Card.tsx`, `CardDetail.tsx`; Modify: `App.tsx`, `main.tsx`

- [ ] **Step 1: `lanes.ts`** — fixed lanes per `laneStatus`:

```ts
export const LANES: Record<string, string[]> = {
  tutorial_status:     ["To Do","In Progress","In Review","Done"],
  video_editor_status: ["To Do","In Progress","In Review","Done"],
  yt_upload_status:    ["To Do","Draft","Uploaded"],
  topic_status:        ["To Do","To Process","To Review"],
};
export const OTHER = "Other / needs fixing";
```

- [ ] **Step 2: `App.tsx`** — on load call `/api/board`; if 401 show "Sign in with Google" (link to `/auth/login`); else render `<Board>`.

- [ ] **Step 3: `Board.tsx`** — group rows into lanes by `row[laneStatus]` (unmatched → OTHER). `dnd-kit` columns; on drop, `POST /api/update {row_id, col: laneStatus, value: newLane}` (optimistic update, revert on error). Admin gets a status-column switcher.

- [ ] **Step 4: `Card.tsx` / `CardDetail.tsx`** — card shows visible meta fields; clicking opens a panel with editable fields (inputs only for `canEdit` cols, derived from the `columns`+role the API returned; read-only fields shown greyed).

- [ ] **Step 5: Smoke test** — `npm run build && wrangler dev`. Log in as each role; verify columns/rows match the policy, drag changes status in the test sheet, locked fields aren't editable.
- [ ] **Step 6: Commit** — `git commit -m "feat(tracker-app): role-aware kanban UI"`

---

## Task 8: Deploy to Cloudflare + end-to-end check

- [ ] **Step 1: Secrets** — `npx wrangler secret put GOOGLE_CLIENT_ID` (and SECRET, SESSION_SECRET, GOOGLE_SA_JSON). Set `SHEET_ID` as a var.
- [ ] **Step 2: Add the prod Worker URL** to the OAuth client's authorized redirect URIs.
- [ ] **Step 3: `npm run build && npx wrangler deploy`.**
- [ ] **Step 4: E2E** — open the deployed URL, sign in as a Tutorial Maker and an Editor (real teammates if possible), confirm RBAC + drag-drop against the **test** sheet end-to-end.
- [ ] **Step 5: Commit** — `git commit -m "chore(tracker-app): deploy config + prod redirect"`

---

## Cutover (after you're satisfied)

- [ ] Run `addRowIds` against the **live** sheet (`1_r0MchK…`).
- [ ] Change `SHEET_ID` secret to the live sheet, redeploy.
- [ ] Add real teammate emails + roles to the live `Employes` tab.

---

## Manual steps (no API — you do these once)

1. **OAuth consent screen + Web client** in Google Cloud project `n8n-workflows-454504`: APIs & Services → Credentials → Create OAuth client (Web). Add redirect URIs (localhost dev + prod Worker URL). Copy client id/secret into secrets. (Consent screen: External, add your team emails as test users, or publish.)
2. **Service account access:** the existing `n8n-google-sa@…` service account must be shared as Editor on the test sheet (and later the live sheet) — already shared on live; confirm on the copy.

---

## Notes
- **Security:** all column/row restrictions enforced in the Worker; the client only ever receives permitted data. `canEdit` re-checked on every write.
- **Out of scope (v1):** editing the policy from a UI (it's `policy.ts` for now), realtime sync (15s cache + refresh), the `Existing`/`Formulas` tabs.
