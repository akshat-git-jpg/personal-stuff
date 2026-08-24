---
executor: claude-p
model: opus
test_cmd: cd pipelines/video-registry && node --test registry.test.mjs
ui:
deploy:
needs: ["240 (PR#201) must land first — the mapping comes from cards.slug plus the registry card_id"]
needs_prs: [199, 200, 201]
touches: [pipelines/video-registry/lib/migrate-keys.mjs, pipelines/video-registry/bin/vreg.mjs, pipelines/video-registry/registry.test.mjs, pipelines/video-registry/CLAUDE.md]

mutation_apply: python3 -c "import io;p='pipelines/video-registry/lib/migrate-keys.mjs';s=io.open(p,encoding='utf-8').read();s=s.replace('  return stmts;','  return stmts.reverse();',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: node --test registry.test.mjs
mutation_expect: INSERT INTO videos
mutation_cwd: pipelines/video-registry
mutation_timeout: 300
---

# Plan 241: one key in clicks-db and the script desk

## Summary

- **Problem statement**: `clicks-db.videos.video_code` is a random 6-character BASE62 string
  and `yt-script-desk.videos.key` is its own separate name. Neither is the canonical video
  key, so a video's identity still forks three ways once it reaches the affiliate chain and
  the script desk.
- **Goals**:
  - Emit an ordered, foreign-key-safe migration that makes the canonical registry key the
    primary key in both databases.
  - Never touch `clicks`, `links.slug` or `videos.token` — click history and every published
    short URL must survive byte-identical.
  - Delete the now-dead `clickstore.videoCodeForTitle` title lookup.
- **Executor proposed**: `claude-p` / Opus — `tricky` per `tooling/boss/data/rules.md`: this
  is the affiliate-click money chain, flagged load-bearing by the architecture-contract
  skill.
- **Done criteria** (terse): the emitted statement ORDER is unit-pinned; `node --test
  registry.test.mjs` green; a dry run prints the full plan and writes nothing.
- **Stop conditions** (terse): never run the migration against live D1 — that is the owner's
  `deploy` gate; never write to `clicks`; never change a `links.slug`.
- **Test / verification for success**: `planMigration` is pure and emits `{sql, params}` in
  order; tests assert the exact ordering that keeps foreign keys valid.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e45ff9e7..HEAD -- pipelines/video-registry/ apps/redirector/ apps/yt-script-desk/ apps/tutorial-tracker-app/src/worker/clickstore.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 238 (PR#199), 240 (`card_id` and the tracker read)
- **Category**: refactor
- **Difficulty**: tricky
- **Planned at**: commit `e45ff9e7`, 2026-08-25

## Why this matters

Design: `docs/specs/2026-08-25-video-identity-design.md` §4.4. Read it, **and read §1
("What is NOT wrong")** before you form any theory about a bug here — there isn't one, and
an earlier draft of the design wrongly claimed there was.

This is the affiliate-click chain. `.claude/skills/personal-stuff-architecture-contract/`
lists the redirector→clicks-db path as load-bearing. Read that skill before starting.

**You are not fixing a bug.** The live path is already guarded: the tracker card persists
its own `video_code` and reads it back first
(`apps/tutorial-tracker-app/src/worker/index.ts:1025`), so a retitle cannot fork a video
into two rows. This plan makes the key *canonical and readable* and removes one dead
fallback. Treat any temptation to "also fix" something as a STOP.

## Current state

### clicks-db (`apps/redirector/migrations/0001_init.sql`, plus `0002_video_yt_id.sql`)

```sql
CREATE TABLE IF NOT EXISTS videos (
  video_code   TEXT PRIMARY KEY,
  video_title  TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);                                   -- 0002 adds yt_id

CREATE TABLE IF NOT EXISTS links (
  slug         TEXT PRIMARY KEY,
  video_code   TEXT NOT NULL,
  tool         TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (video_code) REFERENCES videos(video_code)
);
CREATE INDEX IF NOT EXISTS idx_links_video_code ON links(video_code);

CREATE TABLE IF NOT EXISTS clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,
  clicked_at   INTEGER NOT NULL,
  ip_hash      TEXT, ua_hash TEXT, referer TEXT
);
```

**`clicks` does not reference `video_code` at all** — it references `links.slug`. That is
what makes this migration safe: click history is untouched, and `links.slug` is the string
inside every published YouTube description, so those URLs keep working.

There is exactly one foreign key: `links.video_code -> videos.video_code`.

### yt-script-desk (`apps/yt-script-desk/migrations/0001_init.sql`)

```sql
CREATE TABLE IF NOT EXISTS videos (
  key TEXT PRIMARY KEY, title TEXT NOT NULL, beats_json TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, finished INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS answers   (video_key TEXT NOT NULL, beat_num TEXT NOT NULL, ..., PRIMARY KEY (video_key, beat_num));
CREATE TABLE IF NOT EXISTS say_edits (video_key TEXT NOT NULL, beat_num TEXT NOT NULL, ..., PRIMARY KEY (video_key, beat_num));
CREATE INDEX IF NOT EXISTS idx_videos_token ON videos(token);
```

**No FOREIGN KEY clause anywhere** — `answers.video_key` and `say_edits.video_key` are plain
columns. So plain `UPDATE`s are safe in any order.

Shared desk links resolve by **`token`** (`src/worker/auth.ts:16`, `idx_videos_token`), not
by `key`. Renaming `key` breaks no link anyone was given. **Never touch `token`.**

### Where the mapping comes from

- **clicks-db**: the tracker card holds both. After plans 239 and 240, `cards` has `slug`,
  and it already has `video_code` (written at
  `apps/tutorial-tracker-app/src/worker/index.ts:1038`). So the pair list is
  `SELECT video_code, slug FROM cards WHERE slug IS NOT NULL AND video_code IS NOT NULL`.
- **desk**: map each existing `videos.key` through `resolveKey(key)` from
  `lib/registry.mjs`. That resolves aliases too, which matters — a desk row may sit under an
  old folder name.

### The dead fallback to delete

`apps/tutorial-tracker-app/src/worker/clickstore.ts:15`:

```ts
export async function videoCodeForTitle(db: D1Database, title: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT video_code FROM videos WHERE video_title = ? LIMIT 1")
    .bind(title).first<{ video_code: string }>();
  return row?.video_code ?? null;
}
```

Its only caller is `index.ts:1028`, inside `if (!videoCode)`. Once `video_code` is the
canonical key it has nothing left to resolve.

LESSONS 2026-07-21 is the warning that applies: *"an escape hatch added 'for progressive
adoption' doubles as a permanent blind spot, so pair it with a gate that fails while the
hatch is still in use."* Delete it, do not leave it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `cd pipelines/video-registry && node --test registry.test.mjs` | `# fail 0` |
| Migration dry run | `cd pipelines/video-registry && node bin/vreg.mjs migrate-keys --dry-run` | prints every statement, writes nothing, exit 0 |
| Tracker suite still green | `cd apps/tutorial-tracker-app && npm test` | exit 0 |
| Tracker typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `pipelines/video-registry/lib/migrate-keys.mjs` (new) — the pure statement planner
- `pipelines/video-registry/bin/vreg.mjs` — a `migrate-keys [--dry-run] [--apply]` verb
- `pipelines/video-registry/registry.test.mjs` — ordering assertions
- `pipelines/video-registry/CLAUDE.md` — document the verb and the ordering invariant
- `apps/tutorial-tracker-app/src/worker/clickstore.ts` — delete `videoCodeForTitle`
- `apps/tutorial-tracker-app/src/worker/index.ts` — drop its one call site

**Out of scope**:
- **Running the migration against live D1.** That is the owner's `deploy` gate. See STOP.
- `clicks` — never written, never read for this.
- `links.slug` — never changed. Those strings are in published video descriptions.
- `videos.token` in the desk — never changed. Shared links resolve by it.
- `apps/redirector/src/` — the redirector reads `links.slug`; nothing there changes.
- `apps/redirector/migrations/` and `apps/yt-script-desk/migrations/` — this migration is
  data, not schema. Do **not** add a migration file that rewrites a table.
- Plans 239 and 240's files.

## Git workflow

- Branch: `advisor/241-one-key-in-clicks-db-and-the-desk`
- Commit: `refactor(video-registry): canonical key in clicks-db and desk` — no AI footers.
  Do NOT push.

## Steps

### Step 1: The pure statement planner

Create `pipelines/video-registry/lib/migrate-keys.mjs`. **The ordering below is the entire
point of this plan** — it keeps the one foreign key valid at every single step, so no
`PRAGMA foreign_keys` and no `defer_foreign_keys` is needed anywhere.

```js
/**
 * migrate-keys.mjs
 * Emits the ordered statements that make the canonical registry key the primary
 * key in clicks-db and in yt-script-desk. PURE — emits SQL, never executes it.
 *
 * Design: docs/specs/2026-08-25-video-identity-design.md §4.4.
 *
 * WHY THE ORDER IS LOAD-BEARING
 * clicks-db has exactly one foreign key: links.video_code -> videos.video_code.
 * Insert-then-repoint-then-delete keeps it satisfied at every step:
 *   1. INSERT the new videos row  -> both old and new exist; links still valid
 *   2. UPDATE links to the new code -> target row already exists; valid
 *   3. DELETE the old videos row  -> nothing references it now; valid
 * Any other order transiently violates the constraint. Do not reorder.
 */

/**
 * @param pairs [{ oldCode, newKey }] for clicks-db
 * @returns [{ sql, params, why }] in the order they must run
 */
export function planClicksDb(pairs) {
  const stmts = [];
  for (const { oldCode, newKey } of pairs) {
    if (!oldCode || !newKey) throw new Error("planClicksDb: oldCode and newKey are required");
    if (oldCode === newKey) continue;                      // already canonical
    // 1. INSERT the new row (copy every column, new primary key)
    stmts.push({
      sql: "INSERT INTO videos (video_code, video_title, created_at, yt_id) " +
           "SELECT ?, video_title, created_at, yt_id FROM videos WHERE video_code = ?",
      params: [newKey, oldCode],
      why: "new row must exist before links can point at it",
    });
    // 2. REPOINT the child rows
    stmts.push({
      sql: "UPDATE links SET video_code = ? WHERE video_code = ?",
      params: [newKey, oldCode],
      why: "insert must precede the links update, or the FK is transiently violated",
    });
    // 3. DELETE the old row, now unreferenced
    stmts.push({
      sql: "DELETE FROM videos WHERE video_code = ?",
      params: [oldCode],
      why: "safe only after every link has been repointed",
    });
  }
  return stmts;
}

/**
 * The desk declares NO foreign keys, so plain updates are safe.
 * token is never touched — shared links resolve by it.
 * @param pairs [{ oldKey, newKey }]
 */
export function planDesk(pairs) {
  const stmts = [];
  for (const { oldKey, newKey } of pairs) {
    if (!oldKey || !newKey) throw new Error("planDesk: oldKey and newKey are required");
    if (oldKey === newKey) continue;
    stmts.push({ sql: "UPDATE videos SET key = ? WHERE key = ?", params: [newKey, oldKey], why: "desk primary key" });
    stmts.push({ sql: "UPDATE answers SET video_key = ? WHERE video_key = ?", params: [newKey, oldKey], why: "answers child rows" });
    stmts.push({ sql: "UPDATE say_edits SET video_key = ? WHERE video_key = ?", params: [newKey, oldKey], why: "say_edits child rows" });
  }
  return stmts;
}

/** The counts that must be identical before and after. */
export const INVARIANT_QUERIES = [
  { label: "clicks rows (must never change)", sql: "SELECT COUNT(*) AS n FROM clicks" },
  { label: "links rows", sql: "SELECT COUNT(*) AS n FROM links" },
  { label: "distinct link slugs (published URLs)", sql: "SELECT COUNT(DISTINCT slug) AS n FROM links" },
  { label: "videos rows", sql: "SELECT COUNT(*) AS n FROM videos" },
];
```

**Verify**: `cd pipelines/video-registry && node -e "import('./lib/migrate-keys.mjs').then(m=>console.log(m.planClicksDb([{oldCode:'aB3xY9',newKey:'best-ai-video-generator'}]).length))"`
-> prints `3`.

### Step 2: Pin the ordering with tests

Append to `registry.test.mjs`. These assertions exist to stop a future refactor reordering
the statements:

```js
import { planClicksDb, planDesk } from "./lib/migrate-keys.mjs";

test("clicks-db: insert must precede the links update", () => {
  const s = planClicksDb([{ oldCode: "aB3xY9", newKey: "best-ai-video-generator" }]);
  assert.strictEqual(s.length, 3);
  assert.match(s[0].sql, /^INSERT INTO videos/);
  assert.match(s[1].sql, /^UPDATE links SET video_code/);
  assert.match(s[2].sql, /^DELETE FROM videos/);
});

test("clicks-db: never writes to clicks and never changes a link slug", () => {
  const s = planClicksDb([{ oldCode: "aB3xY9", newKey: "x" }]);
  for (const st of s) {
    assert.ok(!/\bclicks\b/i.test(st.sql), `statement touches clicks: ${st.sql}`);
    assert.ok(!/SET\s+slug\s*=/i.test(st.sql), `statement rewrites a link slug: ${st.sql}`);
  }
});

test("clicks-db: a code already canonical emits nothing", () => {
  assert.deepStrictEqual(planClicksDb([{ oldCode: "same-key", newKey: "same-key" }]), []);
});

test("desk: updates all three tables and never touches token", () => {
  const s = planDesk([{ oldKey: "old-slug", newKey: "new-slug" }]);
  assert.strictEqual(s.length, 3);
  for (const st of s) assert.ok(!/token/i.test(st.sql), `statement touches token: ${st.sql}`);
});

test("planners refuse an incomplete pair", () => {
  assert.throws(() => planClicksDb([{ oldCode: "", newKey: "x" }]));
  assert.throws(() => planDesk([{ oldKey: "x", newKey: "" }]));
});
```

**Verify**: `cd pipelines/video-registry && node --test registry.test.mjs` -> `# fail 0`.

### Step 3: The verb — dry run is the default

Add `vreg migrate-keys [--dry-run] [--apply]` to `bin/vreg.mjs`:

- builds the clicks-db pairs from
  `SELECT video_code, slug FROM cards WHERE slug IS NOT NULL AND video_code IS NOT NULL`
  (reuse `fetchCards`-style access from plan 240's `lib/tracker.mjs`);
- builds the desk pairs by mapping each desk `videos.key` through `resolveKey`;
- **`--dry-run` is the default when neither flag is given.** It prints every statement with
  its `params` and `why`, prints the `INVARIANT_QUERIES` it would check, and exits 0 having
  written nothing anywhere;
- `--apply` runs them, but **only** after printing the invariant counts, running the
  statements, re-printing the counts, and refusing to finish if `clicks` or
  `COUNT(DISTINCT links.slug)` changed by even one row.

**Verify**: `cd pipelines/video-registry && node bin/vreg.mjs migrate-keys --dry-run` ->
exit 0, statements printed, and `git status --short` shows no modified file.

### Step 4: Delete the dead title lookup

Remove `videoCodeForTitle` from `apps/tutorial-tracker-app/src/worker/clickstore.ts` and its
call site in `index.ts` (inside `if (!videoCode)` around line 1028). The remaining branch is:
card has a `video_code` -> use it; card has none -> generate and store one.

**Verify**:
```bash
grep -rc 'videoCodeForTitle' apps/tutorial-tracker-app/src/    # -> 0
cd apps/tutorial-tracker-app && npm run typecheck && npm test   # -> both exit 0
```

### Step 5: Document the invariant

In `pipelines/video-registry/CLAUDE.md`, add `migrate-keys` to the commands table and a
Traps entry recording that the three-statement order is load-bearing and why (the FK stays
valid at each step; reordering breaks it). Anyone "tidying" this later needs that sentence.

**Verify**: `grep -c 'migrate-keys' pipelines/video-registry/CLAUDE.md` -> at least `1`.

### Step 6: Commit

```bash
git add pipelines/video-registry/lib/migrate-keys.mjs \
        pipelines/video-registry/bin/vreg.mjs \
        pipelines/video-registry/registry.test.mjs \
        pipelines/video-registry/CLAUDE.md \
        apps/tutorial-tracker-app/src/worker/clickstore.ts \
        apps/tutorial-tracker-app/src/worker/index.ts
git commit -m "refactor(video-registry): canonical key in clicks-db and desk"
```

Stage explicitly. Never `git add -A`. Do not push.

## Test plan

`planClicksDb` and `planDesk` are pure and emit `{sql, params, why}`, so the thing that
carries all the risk — **statement order** — is unit-pinned rather than discovered in
production. Two negative assertions back it up: no statement may mention `clicks`, and none
may `SET slug =` or mention `token`.

The live apply is verified by the invariant counts, run by the verb itself, before and after,
with a refusal on any drift.

The mutation gate reverses `planClicksDb`'s returned array, so the DELETE lands first and
the ordering test fails printing the regex `/^INSERT INTO videos/`. That is a real
behaviour change, not an assertion on source text. Without it a green suite would not
prove the ordering assertions run at all.

## Done criteria

- [ ] `cd pipelines/video-registry && node --test registry.test.mjs` -> `# fail 0`
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs migrate-keys --dry-run` -> exit 0,
      and `git status --short` clean afterwards
- [ ] `cd apps/tutorial-tracker-app && npm test` -> exit 0
- [ ] `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0
- [ ] `grep -rc 'videoCodeForTitle' apps/tutorial-tracker-app/src/` -> `0`
- [ ] `grep -Ec '\bclicks\b' pipelines/video-registry/lib/migrate-keys.mjs` -> only inside
      `INVARIANT_QUERIES` (a read), never in a planner's emitted SQL
- [ ] `grep -c 'migrate-keys' pipelines/video-registry/CLAUDE.md` -> at least `1`
- [ ] **No migration was applied to live D1.** `git log --oneline` contains no commit
      claiming a live apply, and the branch contains no captured production output.
- [ ] `git diff --name-only e45ff9e7..HEAD` touches only the In-scope list

## STOP conditions

- **You are about to run the migration against live Cloudflare D1.** Do not. `--apply` exists
  for the owner's `deploy` gate, which is boss's only hard per-item gate
  (`tooling/boss/CLAUDE.md`). Your deliverable is the planner, the verb, the tests and a
  clean `--dry-run`.
- **You are about to write to `clicks`, change a `links.slug`, or change a desk `token`.**
  Each one destroys something irrecoverable: click history, a URL inside a published video
  description, or a link already shared with a freelancer.
- **You are about to add a migration file to `apps/redirector/migrations/` or
  `apps/yt-script-desk/migrations/`** that recreates a table. This migration is data. A
  table recreate would drop columns neither schema file fully lists.
- **You are about to reorder the three clicks-db statements**, or add a `PRAGMA
  foreign_keys` / `defer_foreign_keys`. The order is chosen precisely so no pragma is
  needed. If you believe a pragma is required, stop and report — do not add one.
- **A gate assertion fails and you want to change it.** Fix the code. Weakening, swapping or
  deleting an assertion is a STOP (LESSONS 2026-07-31, 2026-07-24).
- **You find what looks like a bug in the affiliate chain.** Read the design's §1 first: an
  earlier draft claimed one and was wrong. Report what you see; do not fix it here.
- **`cards.slug` or the registry's `card_id` is missing.** Plan 239 or 240 has not landed.
  Stop and report.
- **A pair maps two different old codes onto one new key.** That means two `videos` rows
  claim one video. Report it; do not merge them — merging click history is irreversible.

## Maintenance notes

- After this lands, `video_code` **is** the canonical key, so a new video needs no code
  generation at all. `generateVideoCode` survives only for a card created before its slug
  existed; a later plan can remove it once no such card remains.
- The three-statement order is the one thing a future refactor will get wrong. That is why
  it is pinned by a test and recorded in `CLAUDE.md`.
- Existing repo folders keep their names — no directory is renamed anywhere in this batch
  (`decisions.md` 2026-08-09). The registry's aliases remain the bridge.
- A reviewer should check exactly two things: that no emitted statement mentions `clicks`,
  `links.slug` or `token`; and that the `--apply` path refuses on any invariant drift rather
  than logging and continuing.
