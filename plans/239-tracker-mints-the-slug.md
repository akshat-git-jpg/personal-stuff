---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm test
ui: true
deploy:
needs: []
needs_prs: []
touches: [apps/tutorial-tracker-app/src/shared/slug.ts, apps/tutorial-tracker-app/src/shared/columns.ts, apps/tutorial-tracker-app/src/shared/engine/types.ts, apps/tutorial-tracker-app/src/worker/datastore.ts, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/src/client/NewVideoDialog.tsx, apps/tutorial-tracker-app/migrations/0003_card_slug.sql, apps/tutorial-tracker-app/test/slug.test.ts]

mutation_apply: python3 -c "import io;p='apps/tutorial-tracker-app/src/shared/slug.ts';s=io.open(p,encoding='utf-8').read();s=s.replace('if (s.length > MAX) {','if (false) {',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: npm test
mutation_expect: tested-7-ai-video-generators-2026
mutation_cwd: apps/tutorial-tracker-app
mutation_timeout: 600
---

# Plan 239: the tracker mints a video's canonical slug

## Summary

- **Problem statement**: a video has four different identities across the tracker, the
  video-registry, `yt-script-desk` and `clicks-db`, and nothing mints one canonical name.
  The tracker creates the card first, so it is the only place a single identity can start.
- **Goals**:
  - Add a pure, deterministic `slugify(title)` to the tracker — no LLM, no API call.
  - Add a `slug` column to `cards`, and a **create-only** `slug` field to the new-video
    form, pre-filled from the title.
  - Make it structurally impossible to edit a slug after the card exists.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the algorithm is written out
  verbatim below and verified against six cases; nothing is left to judgement.
- **Done criteria** (terse): `npm test` green with `test/slug.test.ts` present and at least
  12 slug assertions; `slug` in `COLUMNS`, in `DEFAULT_CREATE_FIELDS`, in `cardCols`, and in
  migration `0003`; `slug` absent from every `briefFields` array.
- **Stop conditions** (terse): do not call Gemini; do not add `slug` to any
  `StageDef.briefFields`; do not weaken a failing assertion; do not add rename-on-retitle.
- **Test / verification for success**: unit tests on the pure function, plus shape
  assertions that `slug` is on the create surface and not on the edit surface.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e45ff9e7..HEAD -- apps/tutorial-tracker-app/src/shared/ apps/tutorial-tracker-app/src/worker/datastore.ts apps/tutorial-tracker-app/migrations/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e45ff9e7`, 2026-08-25

## Why this matters

Design: `docs/specs/2026-08-25-video-identity-design.md`. Read its §3 and §4.1 before
starting; this plan implements §4.1 only.

The slug is an **identity**, not a label. A title is what a viewer reads and it changes
often — the CTR loop in `.claude/skills/personal-stuff-video-automation-campaign/` exists
to rewrite titles. So the slug is minted once and frozen. If it tracked the title, every
retitle would have to rename folders in two pipelines, rename render output, rewrite the
registry, and fix every doc and ledger naming the old path, atomically. The tracker is a
Cloudflare Worker and cannot touch the repo at all, so it could only change its own field
and leave everything else inconsistent.

`apps/tutorial-tracker-app` is load-bearing
(`.claude/skills/personal-stuff-architecture-contract/`). This change is deliberately
**additive**: a new nullable column and a new create-form field. No existing behaviour is
altered.

## Current state

### Where the card's columns are declared

`src/shared/columns.ts:14` — `COLUMNS` is the full logical column set, `as const`. Its
header comment states that Sheets I/O is keyed by header name, so a column added here is
appended to the sheet by the migration without disturbing existing data. Current first
line:

```ts
export const COLUMNS = [
  "video_title","video_notes","video_description","category","subcategory","topic_status","topic_date","admin_email",
```

### Where the new-video form fields come from

`src/shared/engine/types.ts:134`:

```ts
const DEFAULT_CREATE_FIELDS: CreateField[] = [
  { col: "video_title", label: "Title", type: "text" },
  { col: "video_notes", label: "Notes / brief", type: "textarea" },
];

/** The new-video form fields for a pipeline (its brief stage's, or the default). */
export function createFieldsOf(p: PipelineDef): CreateField[] {
  return p.stages[0]?.createFields ?? DEFAULT_CREATE_FIELDS;
}
```

`src/shared/engine/definitions/standard.ts` declares **no** `createFields`, so it uses
`DEFAULT_CREATE_FIELDS`. **The slug field therefore goes in `DEFAULT_CREATE_FIELDS`, not
in `standard.ts`** — every pipeline needs video identity, and copying the default list into
one pipeline invites drift.

The `CreateField` type (`types.ts:25`):

```ts
export interface CreateField {
  col: string;
  label: string;
  type: "text" | "textarea" | "combo";
  options?: "category" | "subcategory";
}
```

### Two different things are called `briefFields` — do not confuse them

- **`StageDef.briefFields`** (`types.ts:77`) — "Brief-only: which card meta fields this
  stage shows/collects (Topic)". This is the **edit** surface. `standard.ts:21` sets it to
  `["video_title", "video_notes", "video_description", "topic_date"]`.
- **A local variable** inside `requiredToCreate` (`types.ts:149`) that is merely the
  `createFields` column list.

They are separate arrays. "In `createFields`, absent from `StageDef.briefFields`" is a real
mechanism, not a contradiction.

### The consequence you must accept, not work around

`types.ts:148`:

```ts
export function requiredToCreate(p: PipelineDef): string[] {
  const briefFields = createFieldsOf(p).map((f) => f.col);
  const doerStages = p.stages.slice(1);
  return [...briefFields, ...doerStages.map((s) => colOf(s, "assignee"))];
}
```

Every `createFields` column is required to create a card. So adding `slug` makes a slug
**required** to create a video. That is intended — a video without identity should not
exist. Since the field is pre-filled from the title, the only way to hit the error is an
empty title, which is already refused.

### Where an insert lists its columns

`src/worker/datastore.ts:172`:

```ts
const cardCols = ["id", "pipeline_id", "title", "notes", "description", "category", "subcategory", "extra_json", "created_at", "updated_at", "status_since"];
```

### Migrations

`migrations/` contains only `0002_card_events.sql`. The `cards` table itself was created
outside this directory, so **do not attempt to recreate it** — add a column with `ALTER
TABLE`. Existing migration style, for reference:

```sql
CREATE TABLE IF NOT EXISTS card_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);
CREATE INDEX IF NOT EXISTS idx_card_events_card ON card_events (card_id, id);
```

### Test conventions

`test/` holds nine vitest files. `test/affiliate.test.ts` is the exemplar for a pure-function
suite — **match its shape**:

```ts
import { describe, it, expect, vi } from "vitest";
import { normalizeToolName, loadAffiliateRecords } from "../src/worker/affiliate";

describe("normalizeToolName", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeToolName("Invideo Studio")).toBe("invideo-studio");
  });
```

**`normalizeToolName` already exists and is NOT what you want.** It slugifies an affiliate
*tool name*: no stop-word removal, no length cap, no accent folding. Do not reuse it, do
not extend it, do not refactor it. `slugify` is a separate function with different rules.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `cd apps/tutorial-tracker-app && npm test` | exit 0 (`npm install && vitest run`) |
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Lint | `cd apps/tutorial-tracker-app && npm run lint` | exit 0 |
| Test file exists | `test -f apps/tutorial-tracker-app/test/slug.test.ts` | exit 0 |

## Scope

**In scope**:
- `apps/tutorial-tracker-app/src/shared/slug.ts` (new)
- `apps/tutorial-tracker-app/src/shared/columns.ts`
- `apps/tutorial-tracker-app/src/shared/engine/types.ts`
- `apps/tutorial-tracker-app/src/worker/datastore.ts`
- `apps/tutorial-tracker-app/migrations/0003_card_slug.sql` (new)
- `apps/tutorial-tracker-app/test/slug.test.ts` (new)
- One screenshot of the new-video form (the `ui: true` gate requires a committed image)

**Out of scope**:
- `src/worker/affiliate.ts` and `normalizeToolName` — looks related, is not. Different rules.
- `src/worker/gemini.ts` — an LLM must not be involved in minting a slug.
- `src/worker/clickstore.ts` and `index.ts`'s `/api/link-preview` — `video_code` is plan 241.
- `pipelines/video-registry/` — carrying the slug into the repo is plan 240.
- `src/shared/engine/definitions/standard.ts` — the field goes in `DEFAULT_CREATE_FIELDS`.
  Editing `standard.ts` for this is wrong.
- Any rename of an existing video folder. Forbidden (`decisions.md` 2026-08-09).

## Git workflow

- Branch: `advisor/239-tracker-mints-the-slug`
- Commit: `feat(tracker): mint a canonical video slug` — no AI footers. Do NOT push.

## Steps

### Step 1: Write the pure slugify function

Create `src/shared/slug.ts` with **exactly** this content. It was executed against the six
cases in Step 2 and all six pass; do not "improve" it.

```ts
/**
 * slug.ts
 * Deterministic video slug from a title. Pure, no deps, no API call.
 * Minted ONCE at card creation and frozen — see
 * docs/specs/2026-08-25-video-identity-design.md.
 *
 * NOT the same as worker/affiliate.ts normalizeToolName (tool names have no
 * stop-word removal and no length cap).
 */

const STOP = new Set([
  "a","an","the","and","or","but","so","to","of","for","from",
  "you","your","i","me","my","we","our","it","its",
  "is","are","was","be","been","this","that","these","those",
  "have","has","had","do","does","did","dont","wont","cant",
  "will","just","very","really",
]);

const MAX = 40;

/** Deterministic slug, or "" when the title has no usable characters. */
export function slugify(title: string): string {
  let s = title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/['\u2019]/g, "")                          // don't -> dont, not don-t
    .replace(/[^a-z0-9]+/g, "-")                        // everything else -> dash
    .replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (s.length > MAX) {
    // A word containing a digit is never dropped: 2026, 7, v2 carry meaning.
    s = s.split("-").filter((w) => /\d/.test(w) || !STOP.has(w)).join("-");
  }
  if (s.length > MAX) {
    const cut = s.lastIndexOf("-", MAX);
    s = cut > 0 ? s.slice(0, cut) : s.slice(0, MAX);
  }
  return s;
}

/**
 * The slug actually stored on a card: unique, and never empty.
 * `taken` is every slug already in use.
 */
export function mintSlug(title: string, taken: Set<string>, cardId: string): string {
  const base = slugify(title) || `video-${cardId}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
```

Note `how`, `why`, `what`, `best`, `vs`, `without`, `free` are deliberately **not** stop
words — they carry the topic.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0.

### Step 2: Write the unit tests

Create `test/slug.test.ts`, matching `test/affiliate.test.ts`'s shape. It must contain **at
least these 12 assertions**:

```ts
import { describe, it, expect } from "vitest";
import { slugify, mintSlug } from "../src/shared/slug";

describe("slugify", () => {
  it("passes a short title through", () => {
    expect(slugify("Best AI Video Generator")).toBe("best-ai-video-generator");
  });
  it("keeps vs", () => {
    expect(slugify("OpusClip vs Submagic")).toBe("opusclip-vs-submagic");
  });
  it("keeps how-to and does not truncate at 38 chars", () => {
    expect(slugify("How To Make A Consistent AI Influencer"))
      .toBe("how-to-make-a-consistent-ai-influencer");
  });
  it("drops stop words but keeps digit words when over the cap", () => {
    expect(slugify("I Tested 7 AI Video Generators So You Don't Have To (2026)"))
      .toBe("tested-7-ai-video-generators-2026");
  });
  it("folds accents", () => {
    expect(slugify("Café Recipes")).toBe("cafe-recipes");
  });
  it("deletes apostrophes rather than splitting the word", () => {
    expect(slugify("Don't Panic")).toBe("dont-panic");
  });
  it("returns empty string when nothing usable remains", () => {
    expect(slugify("🔥🔥🔥")).toBe("");
  });
  it("never exceeds 40 characters", () => {
    const s = slugify("The Absolutely Enormous And Very Comprehensive Guide To Everything Ever");
    expect(s.length).toBeLessThanOrEqual(40);
  });
  it("never ends or starts with a dash", () => {
    expect(slugify("  ...Hello World!!  ")).toBe("hello-world");
  });
});

describe("mintSlug", () => {
  it("returns the plain slug when free", () => {
    expect(mintSlug("Best AI Video Generator", new Set(), "abc123"))
      .toBe("best-ai-video-generator");
  });
  it("appends -2 then -3 on collision", () => {
    const taken = new Set(["best-ai-video-generator", "best-ai-video-generator-2"]);
    expect(mintSlug("Best AI Video Generator", taken, "abc123"))
      .toBe("best-ai-video-generator-3");
  });
  it("falls back to video-<cardId> when the title yields nothing", () => {
    expect(mintSlug("🔥🔥🔥", new Set(), "abc123")).toBe("video-abc123");
  });
});
```

**Verify**: `cd apps/tutorial-tracker-app && npm test` -> exit 0, and the output reports at
least 12 more passing tests than before your change.

A "write these tests" step is unverifiable by `npm test` alone — vitest exits 0 when a
specified test file is simply absent (LESSONS 2026-08-17, plan 204 shipped zero UI tests
with a green gate). That is why the Done criteria assert the file **and** a count.

### Step 3: Declare the column

In `src/shared/columns.ts`, add `"slug"` to `COLUMNS`. Put it immediately after
`"video_title"` so the sheet header lands next to the title it derives from:

```ts
export const COLUMNS = [
  "video_title","slug","video_notes","video_description","category","subcategory","topic_status","topic_date","admin_email",
```

Also add a label in `COLUMN_LABELS` so the form and gate messages agree (that map is the
single source for a column's human name):

```ts
  slug: "Slug",
```

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0.

### Step 4: Put the field on the create surface only

In `src/shared/engine/types.ts`, add one entry to `DEFAULT_CREATE_FIELDS`:

```ts
const DEFAULT_CREATE_FIELDS: CreateField[] = [
  { col: "video_title", label: "Title", type: "text" },
  { col: "slug", label: "Slug", type: "text" },
  { col: "video_notes", label: "Notes / brief", type: "textarea" },
];
```

**Do not** add `slug` to any `StageDef.briefFields` array. Its absence there is the entire
locking mechanism: the field does not exist on the edit surface of a card that already
exists, so there is nothing to enforce.

**Verify**:
```bash
cd apps/tutorial-tracker-app && grep -rn 'briefFields' src/ | grep -c '"slug"'
```
-> `0`

### Step 5: Carry it on insert

In `src/worker/datastore.ts:172`, add `"slug"` to `cardCols`:

```ts
const cardCols = ["id", "pipeline_id", "title", "slug", "notes", "description", "category", "subcategory", "extra_json", "created_at", "updated_at", "status_since"];
```

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0.

### Step 6: The migration

Create `migrations/0003_card_slug.sql`:

```sql
-- The canonical video identity, minted once at card creation and never edited.
-- Nullable: cards created before this migration have no slug until backfilled.
ALTER TABLE cards ADD COLUMN slug TEXT;

-- Unique across non-null values only, so existing NULL rows do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_slug ON cards (slug) WHERE slug IS NOT NULL;
```

Do **not** try to recreate the `cards` table — its DDL is not in `migrations/`, so a
recreate would drop columns this plan cannot see.

**Verify**: the file exists and contains both statements:
```bash
grep -c 'ADD COLUMN slug TEXT' apps/tutorial-tracker-app/migrations/0003_card_slug.sql
```
-> `1`

### Step 7: Wire minting into card creation

Find the route that creates a card (it calls `requiredToCreate` and then the store's
insert — `src/worker/index.ts` around line 886 iterates `createFieldsOf(pipe)`). Where the
submitted `slug` value is read:

- if the client sent a non-empty `slug`, pass it through `mintSlug(submitted, taken, id)`
  so a collision still resolves;
- if it is empty, call `mintSlug(title, taken, id)`.

`taken` is every existing slug:
```ts
const taken = new Set(
  (await c.env.TRACKER_DB.prepare("SELECT slug FROM cards WHERE slug IS NOT NULL").all<{ slug: string }>())
    .results?.map((r) => r.slug) ?? [],
);
```

Guard it so the `DATA_BACKEND="sheets"` path does not crash: if `TRACKER_DB` is not bound,
use an empty set.

**Verify**: `cd apps/tutorial-tracker-app && npm test && npm run typecheck && npm run lint`
-> all exit 0.

### Step 8: Pre-fill the field in the form

In `src/client/NewVideoDialog.tsx`, as the title input changes, set the `slug` field to
`slugify(title)` **only while the user has not edited the slug field themselves** (track a
boolean `slugTouched`, set true on the slug input's first change). The user must be able to
shorten it.

**Verify**: `cd apps/tutorial-tracker-app && npm run build` -> exit 0.

### Step 9: Screenshot the form (the `ui: true` gate)

`ui: true` is a real merge gate — boss rejects the branch unless it commits an image. Run
the app, open the New Video dialog, and commit one PNG showing the Slug field pre-filled
from a typed title.

Put it at `apps/tutorial-tracker-app/docs/shots/new-video-slug.png` (that directory already
holds `write-view.png`).

**Verify**: `test -f apps/tutorial-tracker-app/docs/shots/new-video-slug.png` -> exit 0.

The image must show the actual rendered dialog. A screenshot proves an image exists, not
that the UI works — so also confirm by eye that the Slug value matches what `slugify` would
produce for the title you typed.

### Step 10: Commit

```bash
git add apps/tutorial-tracker-app/src/shared/slug.ts \
        apps/tutorial-tracker-app/src/shared/columns.ts \
        apps/tutorial-tracker-app/src/shared/engine/types.ts \
        apps/tutorial-tracker-app/src/worker/datastore.ts \
        apps/tutorial-tracker-app/src/worker/index.ts \
        apps/tutorial-tracker-app/src/client/NewVideoDialog.tsx \
        apps/tutorial-tracker-app/migrations/0003_card_slug.sql \
        apps/tutorial-tracker-app/test/slug.test.ts \
        apps/tutorial-tracker-app/docs/shots/new-video-slug.png
git commit -m "feat(tracker): mint a canonical video slug"
```

Stage explicitly. Never `git add -A`. Do not push.

## Test plan

- `test/slug.test.ts` — 12 assertions on the pure function, listed verbatim in Step 2.
- Shape assertion — `slug` appears in no `briefFields` array (Step 4's verify). This is a
  shape check, not a wording check.
- The existing nine test files must all still pass unchanged. If any breaks, the change was
  not additive; stop and report rather than editing that test.

The mutation gate disables the stop-word branch in `slugify`, which must make the
`"I Tested 7 AI Video Generators…"` assertion fail printing the expected slug. Without it a
green suite would not prove the length/stop-word logic runs at all.

## Done criteria

- [ ] `cd apps/tutorial-tracker-app && npm test` -> exit 0
- [ ] `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0
- [ ] `cd apps/tutorial-tracker-app && npm run lint` -> exit 0
- [ ] `cd apps/tutorial-tracker-app && npm run build` -> exit 0
- [ ] `test -f apps/tutorial-tracker-app/test/slug.test.ts` -> exit 0
- [ ] `npm test 2>&1 | grep -qE 'Tests +[0-9]+ passed'` and the passing count is at least
      12 higher than on `e45ff9e7`
- [ ] `grep -c '"slug"' apps/tutorial-tracker-app/src/shared/columns.ts` -> at least `1`
- [ ] `grep -rn 'briefFields' apps/tutorial-tracker-app/src/ | grep -c '"slug"'` -> `0`
- [ ] `grep -c 'ADD COLUMN slug TEXT' apps/tutorial-tracker-app/migrations/0003_card_slug.sql` -> `1`
- [ ] `grep -c '"slug"' apps/tutorial-tracker-app/src/worker/datastore.ts` -> at least `1`
- [ ] `test -f apps/tutorial-tracker-app/docs/shots/new-video-slug.png` -> exit 0
- [ ] `grep -rc 'gemini' apps/tutorial-tracker-app/src/shared/slug.ts` -> `0`
- [ ] No file outside the In-scope list is modified:
      `git diff --name-only e45ff9e7..HEAD | grep -v '^apps/tutorial-tracker-app/' ; test $? -ne 0`

## STOP conditions

- **A gate assertion fails and you are tempted to change it.** Fix the code or the fixture.
  Weakening, swapping or deleting an assertion is a STOP (LESSONS 2026-07-31, 2026-07-24).
- **You are about to call Gemini, or any API, to produce a slug.** The function is pure by
  design. An API call that can fail while creating a card is worse than a pre-filled field.
- **You are about to add `slug` to a `StageDef.briefFields` array.** That is the lock. Adding
  it there makes the slug editable and breaks the whole design.
- **You are about to make the slug follow the title on edit.** Explicitly rejected: a Worker
  cannot rename the repo folders that would have to move with it.
- **You are about to recreate the `cards` table.** Its DDL is not in `migrations/`; a
  recreate silently drops columns.
- **One of the nine existing test files fails.** The change was meant to be additive. Report
  it; do not edit that test to accommodate.
- **`npm run build` fails on the client change** and the fix would mean restructuring
  `NewVideoDialog.tsx`. Report instead — Step 8 should be a small local change.
- **A test hangs.** Do not wait it out. Any test opening a server needs a `test.after` that
  force-closes it (LESSONS 2026-07-31: an assertion firing before `server.close()` hangs
  the runner forever at 0% CPU with no output).

## Maintenance notes

- Existing cards get `slug = NULL`. Backfill is plan 240's job (`vreg sync` reads them), not
  this plan's.
- The unique index is partial (`WHERE slug IS NOT NULL`) precisely so the NULL rows coexist.
  Do not make it a plain unique index later without backfilling first.
- `slugify` is intentionally duplicated nowhere. Plan 240's CLI reads slugs and never mints
  one, so the algorithm stays in this one file.
- A reviewer should scrutinise two things: that `slug` really is absent from every
  `briefFields` array, and that Step 7's `taken` set is read from the DB rather than assumed
  empty (an empty set silently disables collision handling).
