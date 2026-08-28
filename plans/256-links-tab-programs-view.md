<!-- boss frontmatter -->
---
executor: codex
model: gpt-5.6-terra
test_cmd: cd apps/tutorial-tracker-app && npm test
ui: true
deploy:
needs: ["255 must land first: this plan consumes /api/programs"]
needs_prs: [216]
touches: [apps/tutorial-tracker-app/package.json, apps/tutorial-tracker-app/vite.config.ts, apps/tutorial-tracker-app/src/client/LinksTab.tsx, apps/tutorial-tracker-app/src/client/ProgramForm.tsx, apps/tutorial-tracker-app/src/client/programsApi.ts, apps/tutorial-tracker-app/src/client/Board.tsx, apps/tutorial-tracker-app/test/programs-ui.test.tsx, apps/tutorial-tracker-app/test/setup-dom.ts]

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 256: Links tab — Programs view, Add and Edit

## Summary

- **Problem statement**: The affiliate catalogue is edited in a Google Sheet with
  no validation, so a bad value is only discovered weeks later by a crash page or
  a missing payout. Plan 255 put a validated `programs` table behind an API; that
  table currently has no user interface, so the sheet is still the only way to
  work.
- **Goals**:
  - Rebuild the existing admin `Links` tab as three sub-views: **Programs**,
    **Tracking links** (plan 257), **Health** (plan 258). This plan ships
    Programs and the shells for the other two.
  - Add and Edit forms for both program types, with the verdict shown **before**
    save is possible.
  - Leave `PROGRAMS_BACKEND` at `"sheets"`. The flip belongs to plan 257, which
    is where the minting path also starts reading the table — flipping it here
    would claim the catalogue moved while link minting still read the sheet.
  - Give the app its first component-test setup, so UI behaviour is verifiable.
- **Decisions confirmed** (owner, this session):
  - Edit must exist for every program, not just Add -> Edit reuses the Add form
  - Dashboard credentials -> ONE plain text field, **no masking**
  - Coupons -> `coupon_code`, `coupon_url`, `coupon_terms` as separate fields
  - Dashboard -> `dashboard_url` and `dashboard_credentials` as separate columns
  - UI tests -> add `jsdom` + `@testing-library/react` and write real ones
  - Sheet cutover -> behind `PROGRAMS_BACKEND`, flipped in 257 not here
  - No AI/LLM anywhere in this feature
- **Executor proposed**: `codex` / `gpt-5.6-terra` (owner instruction 2026-08-28:
  every plan in this batch runs on codex terra). Escalate to `gpt-5.6-sol` only
  if this plan fails a round on terra (`tooling/boss/data/rules.md` line 22).
- **Done criteria**: `npm test` green with the new `.tsx` suite present and a
  minimum test count; Programs list renders from the API; a refused URL disables
  Save; a screenshot is committed
- **Stop conditions**: a test assertion would have to be weakened to pass; the
  form would let a refused URL be saved
- **Test / verification for success**: `@testing-library/react` component tests
  that render the real components against a stubbed `fetch`, asserting on
  rendered text — not on internal state
- **Open points for plan readiness**: none

## Executor instructions

**Drift check — run this FIRST:**

```bash
git diff --stat 3e730698..HEAD -- apps/tutorial-tracker-app/
```

`src/worker/programs.ts` and `migrations/0005_programs.sql` MUST exist (plan 255).
If they do not, STOP — this plan cannot run before 255 lands.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: low-medium (first component-test setup in this app; no runtime path
  changes until plan 257 flips PROGRAMS_BACKEND)
- **Depends on**: plan 255
- **Category**: feature
- **Planned-at SHA**: `3e730698`
- **Difficulty**: standard

## Why this matters

The owner's own diagnosis of why the sheet must go: *"if I'm directly adding in
the sheet then it will be more difficult because you'll need to write some script
which checks them on the go while writing the URL itself."* That is exactly right.
In a spreadsheet, checking happens after the damage. In a form, checking happens
before the value can be saved.

The 2026-08-28 audit found two failure classes a spreadsheet structurally cannot
prevent: a cell holding prose instead of a link (`clickfunnels`, approved since
February, never publishable), and a cell whose invisible second value points at a
different company (`skool` -> `affiliate.gohighlevel.com`). Both are impossible
once the value is typed into a validated field with one visible truth.

## Current state

### The tab already exists — you are rebuilding it, not adding it

`src/client/Board.tsx` builds its own tab set and already has a `links` tab,
already admin-gated:

```tsx
// src/client/Board.tsx:76-84
const tabs: { key: TabKey; label: string }[] = [];
if (hasMyWork) tabs.push({ key: "my-work", label: "My work" });
if (isAdmin) {
  tabs.push({ key: "pipeline", label: "All videos" });
  tabs.push({ key: "team", label: "Team" });
  tabs.push({ key: "links", label: "Links" });
}
const defaultTab: TabKey = isAdmin ? "pipeline" : "my-work";
const [tab, setTab] = useState<TabKey>(defaultTab);
```

```tsx
// src/client/Board.tsx:260 — the ONE line you replace
{activeTab === "links" && <LinksTab rows={rows} onSaved={reload} />}
```

```tsx
// src/client/Board.tsx:14 — the import you repoint
import { LinksTab } from "./LinkDrift";
```

`src/client/LinkDrift.tsx` exports two things:

```tsx
// src/client/LinkDrift.tsx:8
export function LinkDriftPanel() { ... }
// src/client/LinkDrift.tsx:129
export function LinksTab({ rows, onSaved }: { rows: BoardRow[]; onSaved: () => void }) { ... }
```

The old `LinksTab` is a per-video minting picker. Plan 257 moves that
functionality into the new Tracking-links sub-view. **This plan does not delete
`LinkDrift.tsx`** — it renders the existing `LinkDriftPanel` inside the new
Tracking-links shell so nothing is lost between plans.

### The API you consume (landed in plan 255)

```
GET    /api/programs                  -> { programs: ProgramRow[], vocab: {...} }
POST   /api/programs/validate         -> { ok, value, error, warnings }
POST   /api/programs                  -> { ok, program, warnings }   (create AND update)
DELETE /api/programs/:slug            -> { ok: true }
POST   /api/programs/import-from-sheet-> { ok, imported, issues, droppedCells }
```

Vocabularies, exported from `src/worker/programs.ts` — render exactly these:

```ts
NETWORKS          = ["website","impact","partnerstack","paykickstart","network","other"]
APPROVAL_STATUSES = ["approved","applied","to_apply","rejected","unknown"]
COUPON_STATUSES   = ["received","occasional","none","needed","applied","unknown"]
KINDS             = ["affiliate","external"]
```

`NETWORK_LABELS`, `APPROVAL_LABELS`, `COUPON_LABELS` in the same file give the
display strings. Import them; do not re-write them in the client.

### Conventions to match

- **Exemplar component**: `src/client/TeamPanel.tsx` — a full admin panel with a
  table, a dialog form, loading and error states. Match its structure and its
  Tailwind idiom.
- **Exemplar API module**: `src/client/api.ts`. It has private helpers
  `throwOnError(res)` (line 87) and `postJSON(url, body)` (line 117), plus typed
  error classes `UnauthorizedError` / `ForbiddenError` / `ConflictError`.
- **shadcn components available** (`src/components/ui/`): `badge`, `button`,
  `card`, `dialog`, `input`, `scroll-area`, `select`, `separator`, `tooltip`.
  **There is no `table`, `tabs`, `textarea` or `switch` component.** Build the
  table as a plain `<table>` with Tailwind classes (as `TeamPanel.tsx` does), the
  sub-tabs as `<button>`s (as `Board.tsx` does), notes as a plain `<textarea>`
  with the `input.tsx` classes, and `probe_enabled` as a checkbox.
- **`erasableSyntaxOnly` is ON** in this app's tsconfig. So: no TypeScript
  `enum`, and no constructor parameter properties. `api.ts:22` carries a comment
  about exactly this — declare plain fields instead.
- Design reference (owner-approved 2026-08-28):
  `https://claude.ai/code/artifact/ef5c97da-f174-4dd6-8c51-a13a60d6d45d`
  Artboards `Main`, `AddAffiliate`, `AddExternal`, `Refused`. Match its
  information hierarchy; the app's own tokens win over anything in the canvas.

## Commands you will need

```bash
cd apps/tutorial-tracker-app

npm install
npm test                    # vitest — THE MERGE GATE
npm run typecheck           # tsc -b, exit 0, no output
npm run build               # tsc -b && vite build — must succeed
npm run dev                 # vite dev server, for the screenshot
```

Baseline after plan 255: `npm test` prints `Test Files  13 passed` and at least
`Tests  285 passed`. Your work must ADD to that.

## Scope

**In scope:**

- `package.json` — add THREE devDependencies only (see Step 1)
- `vite.config.ts` — add the `jsdom` test environment + setup file
- `test/setup-dom.ts` (new)
- `src/client/programsApi.ts` (new)
- `src/client/LinksTab.tsx` (new — the three-sub-view shell + Programs view)
- `src/client/ProgramForm.tsx` (new — Add and Edit, both kinds)
- `src/client/Board.tsx` — change the import on line 14 and the render on line 260 ONLY
- `test/programs-ui.test.tsx` (new)

**Out of scope — do not touch:**

- `src/client/LinkDrift.tsx` — plan 257 owns its retirement. Render
  `LinkDriftPanel` from the new shell; do not edit or delete the file.
- `src/client/LinkStudio.tsx`, `src/client/CardDetail.tsx` — plan 257 moves these.
- `src/worker/**` — plan 255 finished the backend. If you need an endpoint that
  does not exist, STOP and report rather than adding one.
- `src/worker/linkhealth.ts`, `src/worker/programs.ts` — import only.
- Any other `src/client/*` file.

## Steps

### Step 1 — component-test setup

This app has no DOM test environment. Add exactly these devDependencies:

```bash
cd apps/tutorial-tracker-app
npm install -D jsdom@^25 @testing-library/react@^16 @testing-library/dom@^10
```

Add the test environment to `vite.config.ts`. The current block is:

```ts
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
```

Replace it with:

```ts
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // jsdom only for .tsx suites; the existing worker/logic suites stay in node,
    // which keeps them fast and free of DOM globals they never asked for.
    environmentMatchGlobs: [['test/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./test/setup-dom.ts'],
  },
```

Create `test/setup-dom.ts`:

```ts
/**
 * DOM test setup. Runs for every suite; the jsdom-only bits are guarded so the
 * node-environment worker suites are unaffected.
 */
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document !== "undefined") {
    document.body.innerHTML = "";
  }
});
```

**Verify:**

```bash
npm test        # must still print the plan-255 baseline, nothing broken
npm run typecheck
```

### Step 2 — the client API module

Create `src/client/programsApi.ts`. Keep it thin; it mirrors `api.ts`'s idiom but
lives in its own file so `api.ts` stays untouched.

```ts
/**
 * programsApi.ts
 * Client calls for the affiliate/external catalogue (plan 255's endpoints).
 * Separate from api.ts so the board's API surface is not disturbed.
 */

import type { ProgramRow, Kind } from "../worker/programs";

export interface ProgramsPayload {
  programs: ProgramRow[];
  vocab: {
    kinds: readonly string[];
    networks: readonly string[];
    approvalStatuses: readonly string[];
    couponStatuses: readonly string[];
  };
}

export interface LinkWarning { code: string; message: string }

export interface ValidateResult {
  ok: boolean;
  value: string;
  error: string | null;
  warnings: LinkWarning[];
}

async function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchPrograms(): Promise<ProgramsPayload> {
  const res = await fetch("/api/programs", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Could not load programs (${res.status})`);
  return res.json() as Promise<ProgramsPayload>;
}

/** What the form calls as you type. Never saves anything. */
export async function validateTarget(target_url: string, kind: Kind): Promise<ValidateResult> {
  const res = await postJSON("/api/programs/validate", { target_url, kind });
  if (!res.ok) throw new Error(`Validation call failed (${res.status})`);
  return res.json() as Promise<ValidateResult>;
}

export async function saveProgram(
  input: Record<string, unknown>,
): Promise<{ ok: boolean; program: ProgramRow; warnings: LinkWarning[] }> {
  const res = await postJSON("/api/programs", input);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || `Could not save (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; program: ProgramRow; warnings: LinkWarning[] }>;
}

export async function deleteProgram(slug: string): Promise<void> {
  const res = await fetch(`/api/programs/${encodeURIComponent(slug)}`, {
    method: "DELETE", credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`Could not delete (${res.status})`);
}
```

**Verify:** `npm run typecheck` exits 0.

### Step 3 — the form (Add AND Edit, both kinds)

Create `src/client/ProgramForm.tsx`. This is the heart of the plan: it must make
a refused value unsavable.

Required behaviour, exactly:

1. Props: `{ initial: ProgramRow | null; kind: Kind; onClose: () => void; onSaved: () => void }`.
   `initial === null` = Add. `initial !== null` = Edit, fields pre-filled, `slug`
   read-only (it is in live short links).
2. The URL field validates **on blur and 500 ms after the last keystroke**, by
   calling `validateTarget`. Never on every keystroke.
3. Render the verdict beneath the field:
   - `ok === false` -> the `error` string, and **Save is `disabled`**.
   - `ok === true` with `warnings.length > 0` -> each warning's `message`, Save
     **enabled** (warnings are advisory by design — some programmes credit via a
     path, and a wrong block would drop a real earning link).
   - `ok === true`, no warnings -> `Checks passed`, Save enabled.
   - `value !== ` the typed text -> show `Saving as: {value}` so an auto-added
     `https://` is visible, never silent.
4. An EMPTY URL is valid (an approved programme with no link yet is a real state).
   Save enabled, and show `No link yet — this programme cannot be published.`
5. `kind === "external"` hides the coupon block and the approval-status field, and
   shows the line: `No affiliate programme, so no code check runs — a plain
   homepage is correct here.`
6. Fields, in this order. Every one is a plain controlled input.

| Field | Control | Notes |
|---|---|---|
| `name` | `Input` | required |
| `slug` | `Input` | auto-derived from name while Adding; read-only when Editing |
| `kind` | `Select` | `affiliate` / `external` |
| `target_url` | `Input` | the validated one |
| `network` | `Select` | `NETWORK_LABELS` |
| `approval_status` | `Select` | `APPROVAL_LABELS`; affiliate only |
| `coupon_status` | `Select` | `COUPON_LABELS`; affiliate only |
| `coupon_code` | `Input` | affiliate only |
| `coupon_url` | `Input` | affiliate only |
| `coupon_terms` | `Input` | affiliate only |
| `dashboard_url` | `Input` | |
| `dashboard_credentials` | `textarea` | plain text, NOT masked (owner decision) |
| `notes` | `textarea` | 4 rows |
| `probe_enabled` | checkbox | default checked |

7. Slug derivation while Adding must match the server's `toSlug`. Import it:
   `import { toSlug } from "../worker/programs";` — do not re-implement it.
8. On submit: call `saveProgram`, then `onSaved()` then `onClose()`. On throw,
   render the error message above the buttons and stay open.

**Verify:** `npm run typecheck` exits 0, `npm run build` succeeds.

### Step 4 — the tab shell + Programs view

Create `src/client/LinksTab.tsx`, exporting `LinksTab`. Same props as the old one
so `Board.tsx` needs no other change:

```tsx
export function LinksTab({ rows, onSaved }: { rows: BoardRow[]; onSaved: () => void })
```

Structure:

1. Three sub-tab buttons: `Programs` / `Tracking links` / `Health`, styled like
   `Board.tsx`'s tab buttons. Default `programs`. Each label carries a count:
   Programs shows `programs.length`; Tracking links and Health show nothing until
   plans 257/258 fill them.
2. `programs` sub-view — this plan's work:
   - Load via `fetchPrograms()` on mount.
   - **Loading**: `Loading programs…`
   - **Error**: the error message plus a `Retry` button.
   - **Empty** (`programs.length === 0`): the line `No programs yet.` plus a
     button `Import from the old sheet` calling
     `POST /api/programs/import-from-sheet`, which on success shows
     `Imported N affiliate + M external.` and any `issues` as a list. This is the
     one-time migration path; it must be reachable from the UI.
   - **Loaded**: a plain `<table>` with these columns, in this order:
     `Program` · `Type` · `Destination` · `Affiliate code` · `Coupon` ·
     `Approval` · `Last checked` · (actions)
   - Actions per row: `Edit` (opens `ProgramForm` with `initial=row`) and
     `Delete` (a `Dialog` confirm; never delete on first click).
   - An `Add` control offering the two catalogue types, opening `ProgramForm`
     with `initial={null}` and the chosen `kind`.
   - Row tint: a row whose `last_status` is `no_credit` or `dead` gets
     `bg-destructive/5`; `unverifiable` gets `bg-warning/10`. `last_status` is
     null until plan 258 runs, so untinted is the normal state now.
   - **Affiliate code column** — the encoding, inlined so it cannot be
     reinterpreted. Compute from `target_url` only:

     ```ts
     // Exactly this table. Do not extend or reorder it.
     // 1. empty target_url                      -> "—",            muted
     // 2. kind === "external"                   -> "not expected", muted
     // 3. a ?via= / ?ref= / ?fpr= / ?aff= style param present
     //    OR the host ends in a known network domain
     //                                          -> that token,     success
     // 4. otherwise                             -> "none found",   warning
     ```
     Use `creditWarnings(target_url, kind)` from `src/worker/linkhealth.ts` for
     case 3 vs 4: `warnings.some(w => w.code === "no_credit_marker")` means
     case 4. Do NOT write a new regex in the client.
3. `tracking-links` sub-view — a shell for plan 257. Render the existing
   `<LinkDriftPanel />` under the heading `Link drift` plus the line
   `Per-video link minting moves here in the next change.`
4. `health` sub-view — a shell for plan 258: the line
   `Link health checks arrive with the guard.` Nothing else.

**Degraded/empty state per sub-view** (required — an un-enumerated empty state
gets invented behaviour):

| Sub-view | Backing data absent | What renders | Actions then |
|---|---|---|---|
| Programs | `/api/programs` 403 | `You need the Admin role to manage links.` | Add + Import hidden |
| Programs | `/api/programs` 5xx | error text + `Retry` | Add + Import disabled, `title` = "Programs could not load" |
| Programs | zero rows | `No programs yet.` | `Import from the old sheet` enabled; Add enabled |
| Tracking links | n/a this plan | `LinkDriftPanel` + the note | as today |
| Health | n/a this plan | the one line | none |

**Lifecycle** (required): the sub-tab selection is component-local `useState` and
resets when `LinksTab` unmounts. Do not lift it to a module-level variable or a
store — a module-level value would survive a tab switch and reopen on the wrong
sub-view.

**Verify:** `npm run build` succeeds.

### Step 5 — wire it into Board.tsx

Two edits, nothing else in this file.

```tsx
// line 14 — was: import { LinksTab } from "./LinkDrift";
import { LinksTab } from "./LinksTab";
```

Line 260 stays byte-identical (`<LinksTab rows={rows} onSaved={reload} />`) —
the new component takes the same props on purpose.

**Verify:**

```bash
grep -n 'from "./LinksTab"' src/client/Board.tsx     # -> 1 hit on line 14
grep -c 'from "./LinkDrift"' src/client/Board.tsx    # -> 0
npm run build
```

### Step 6 — the component tests

Create `test/programs-ui.test.tsx`. These must render the REAL components and
assert on rendered text (LESSONS 2026-08-23: asserting on internals or on an API
200 misses the bug the user actually sees).

Stub `fetch` per test; never hit the network.

Required cases — at least these thirteen:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LinksTab } from "../src/client/LinksTab";
import { ProgramForm } from "../src/client/ProgramForm";

const PROGRAM = {
  slug: "openart", name: "OpenArt", kind: "affiliate",
  target_url: "https://openart.ai/home/?via=seema", network: "website",
  approval_status: "approved", coupon_status: "received", coupon_code: "AGROLLO",
  coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "",
  notes: "", probe_enabled: 1, last_checked_at: null, last_status: null,
  last_final_url: null, previous_final_url: null,
  created_at: 0, updated_at: 0, updated_by: "",
};
const VOCAB = { kinds: ["affiliate","external"], networks: ["website","other"],
  approvalStatuses: ["approved","unknown"], couponStatuses: ["received","unknown"] };

function stubFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find(k => String(url).startsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    return { ok: true, status: 200, json: async () => routes[key] } as unknown as Response;
  });
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("LinksTab — Programs", () => {
  it("1 renders a program row from the API", async () => { /* assert "OpenArt" and "via=seema" appear */ });
  it("2 shows the three sub-tabs and opens Programs by default", async () => {});
  it("3 shows the empty state with an Import button when there are no programs", async () => {});
  it("4 shows a Retry button when the API 5xx's", async () => {});
  it("5 shows the Admin-role message on 403 and hides Add", async () => {});
  it("6 tints a no_credit row and labels the code as lost", async () => {});
  it("7 labels an external row's code column 'not expected'", async () => {});
  it("8 switching to Tracking links renders the drift panel, not the table", async () => {});
});

describe("ProgramForm", () => {
  it("9 disables Save and shows the reason when the URL is refused", async () => {
    // stub /api/programs/validate -> { ok:false, error:"Not a usable web address..." }
    // assert the error text renders AND the Save button has the disabled attribute
  });
  it("10 shows the auto-added https:// as 'Saving as' and keeps Save enabled", async () => {
    // stub -> { ok:true, value:"https://openart.ai/home/?via=seema", warnings:[] }
  });
  it("11 keeps Save enabled for a warning, and renders the warning text", async () => {
    // stub -> { ok:true, value:"https://bookbolt.io/", warnings:[{code:"no_credit_marker",message:"No affiliate code found..."}] }
  });
  it("12 hides the coupon block for kind=external", async () => {});
  it("13 makes slug read-only when editing", async () => {});
});
```

Fill in each body. Every assertion must be on text or on an attribute the user's
browser would show — `screen.getByText`, `getByRole("button", {name:"Save program"})`,
`toBeDisabled`-style attribute checks. No snapshot tests.

**Verify:**

```bash
npm test
#   -> "Test Files  14 passed"
#   -> Tests count >= 298
test -s test/programs-ui.test.tsx && echo UI_SUITE_PRESENT
```

### Step 7 — the screenshot (the `ui: true` merge gate)

boss REJECTS this branch unless it commits an image.

```bash
cd apps/tutorial-tracker-app
npm run dev     # then open http://localhost:5173, sign in, Links tab
```

Capture the Programs view with at least one row and the Add menu open. Commit it
as `apps/tutorial-tracker-app/docs/screenshots/256-links-programs.png`.

**Verify:** `test -s docs/screenshots/256-links-programs.png && echo SHOT_OK`

## Test plan

| File | Follows | Covers |
|---|---|---|
| `test/programs-ui.test.tsx` (new) | first of its kind; model on `test/rbac.test.ts` for table-driven style | the 13 cases in Step 6 |
| `test/setup-dom.ts` (new) | — | DOM cleanup between tests |

The existing 13 suites stay in the node environment and must remain green.

## Done criteria

```bash
cd apps/tutorial-tracker-app

npm test
#   -> "Test Files  14 passed", Tests >= 298

test -s test/programs-ui.test.tsx && test -s test/setup-dom.ts && echo SUITES_PRESENT
#   -> SUITES_PRESENT     (LESSONS 2026-08-17: vitest exits 0 when a named suite is absent)

npm test 2>&1 | grep -qE "programs-ui\.test\.tsx" && echo UI_SUITE_RAN
#   -> UI_SUITE_RAN       (present AND actually executed)

npm run typecheck        # exit 0, no output
npm run build            # succeeds

grep -q 'PROGRAMS_BACKEND = "sheets"' wrangler.toml && echo FLAG_STILL_SHEETS
grep -q 'from "./LinksTab"' src/client/Board.tsx && echo WIRED
test -f src/client/LinkDrift.tsx && echo LINKDRIFT_INTACT
test -s docs/screenshots/256-links-programs.png && echo SHOT_OK

# ADVISORY, not a gate: a reviewer's pointer that no second URL validator crept
# into the client. linkhealth.ts stays the only authority. A source grep can
# never be a real gate (its mutation would be circular), so read this as a hint.
grep -c 'https\\?://' src/client/ProgramForm.tsx
#   -> expect 0; a non-zero result is a review question, not an automatic failure
```

## STOP conditions

- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping or
  deleting an assertion is a STOP.
- **The form would let a refused URL be saved.** That is the entire point of the
  plan. If you cannot make Save disable on `ok === false`, STOP and report.
- **You need a worker endpoint that does not exist.** STOP and report; do not add
  one. `src/worker/**` is out of scope.
- **You are about to edit or delete `src/client/LinkDrift.tsx`.** STOP — plan 257
  owns it.
- **A test opens an HTTP server or a real timer that is never cleared.** STOP —
  stub `fetch`, use `vi.useFakeTimers`, and clear in `afterEach` (LESSONS
  2026-07-31: such tests hang the runner forever, invisibly).
- **`npm install` wants to add more than the three named devDependencies.** STOP
  and report what it wants.
- **The existing 262 tests would need changing.** They should not. If one breaks,
  you have changed shared behaviour that is out of scope — STOP.

## Maintenance notes

- Every interactive control must be explicitly styled. LESSONS 2026-07-31: a
  UA-default `<select>` (white-on-dark) is a recurring port defect in this repo —
  the `select.tsx` component or explicit classes on a native `<select>`, never
  bare.
- After merge, the owner runs the remote migration and then the in-UI
  `Import from the old sheet` button once. Until then the `programs` table is
  empty and the Programs view correctly shows its empty state.
- `PROGRAMS_BACKEND` stays `"sheets"` after this plan. Plan 257 flips it once the
  minting path reads the table too, so the flag never lies about what is live.
- Plan 257 replaces the Tracking-links shell and retires `LinkDrift.tsx` /
  `LinkStudio.tsx`. Plan 258 fills the Health shell.
- A reviewer should scrutinise: that Save is genuinely `disabled` (not merely
  styled as such), and that the affiliate-code column derives from
  `creditWarnings`, not from a second regex.
