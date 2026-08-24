---
executor: agy
model:
test_cmd: cd pipelines/video-registry && node --test registry.test.mjs
ui:
deploy:
needs: ["239 (PR#200) must land first — sync reads cards.slug, which 239 creates"]
needs_prs: [199, 200]
touches: [pipelines/video-registry/lib/registry.mjs, pipelines/video-registry/lib/tracker.mjs, pipelines/video-registry/bin/vreg.mjs, pipelines/video-registry/registry.test.mjs, pipelines/video-registry/README.md, pipelines/video-registry/CLAUDE.md]

mutation_apply: python3 -c "import io;p='pipelines/video-registry/lib/tracker.mjs';s=io.open(p,encoding='utf-8').read();s=s.replace('if (!row.slug) continue;','if (false) continue;',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: node --test registry.test.mjs
mutation_expect: skips a card with no slug
mutation_cwd: pipelines/video-registry
mutation_timeout: 300
---

# Plan 240: `vreg sync` carries the tracker's slug into the registry

## Summary

- **Problem statement**: after plan 239 the tracker mints a canonical slug, but it is a
  Cloudflare Worker and cannot write to `pipelines/video-registry/videos.json`. Nothing
  carries the slug into the repo, and no registry entry records which tracker card owns it.
- **Goals**:
  - Add a `sync` verb to `vreg` that reads `tracker-db` and mints a registry entry for every
    card carrying a slug.
  - Add exactly one new field to a registry entry: `card_id`.
  - Keep `ensure` untouched as the only verb pipelines call, and keep every consumer
    non-failing when an entry is missing.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the HTTP contract, the SQL, the
  merge rules and the test doubles are all written out below.
- **Done criteria** (terse): `node --test registry.test.mjs` green with at least 6 new
  assertions; `sync` is idempotent; no network call happens in any test.
- **Stop conditions** (terse): do not make any pipeline hard-fail on a missing entry; do not
  rename a directory; do not add a `stages`/`paths`/`published` field; no live network call
  from a test.
- **Test / verification for success**: the merge logic is a pure function tested with
  fixture rows; the network shim is separate and never exercised by tests.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e45ff9e7..HEAD -- pipelines/video-registry/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 238 (PR#199 — the registry suite must be green and mapped before this uses
  it as a gate), 239 (`cards.slug` must exist)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e45ff9e7`, 2026-08-25

## Why this matters

Design: `docs/specs/2026-08-25-video-identity-design.md` §4.2 and §4.3. Read those two
sections before starting.

`pipelines/video-registry/` is already the authority on what a video is called
(`decisions.md` 2026-08-09). Today whichever pipeline reaches a video first mints the key by
slugifying whatever working title it was handed. After plan 239 the tracker mints it
earlier and better, so `sync` seeds the registry from the tracker and both pipelines then
find the key already there.

**The rule this amends, deliberately.** `decisions.md` 2026-08-09 says *"minting is
symmetric on purpose … the moment one pipeline 'owns' naming, the other starts
re-slugifying, which is the bug."* The tracker is **not a pipeline** — it sits upstream of
both and mints before either sees the video, so neither ever re-slugifies. Symmetric
`ensure` remains the fallback path and is not removed. This plan therefore strengthens the
invariant rather than breaking it. The orchestrator appends the `decisions.md` entry for
this; you do not.

## Current state

### The registry module

`pipelines/video-registry/lib/registry.mjs` exports `resolveKey`, `ensure`, `mint`,
`addAlias`, `whereIs`, `unregisteredDirs`. No dependencies, `node:` built-ins only.

`pipelines/video-registry/CLAUDE.md` states: **"Do not add a `package.json` with deps —
`pipelines/` has no shared Node package root."** Honour that; the HTTP call uses global
`fetch`, which node 22 provides.

### The registry file shape

`pipelines/video-registry/videos.json`, `version: 1`, sorted by key:

```json
"ai-avatar-online-courses": {
  "title": "Best Realistic AI Avatar Generator for Online Courses & Training",
  "minted": "2026-08-12",
  "aliases": []
}
```

After this plan an entry may also carry `card_id`:

```json
"ai-avatar-online-courses": {
  "title": "Best Realistic AI Avatar Generator for Online Courses & Training",
  "minted": "2026-08-12",
  "aliases": [],
  "card_id": "row_17"
}
```

**`card_id` is the ONLY new field.** `CLAUDE.md`'s Traps section says: *"Do not add a
`stages` or `paths` field to an entry. The paths are derivable from the key; recording them
creates a second source of truth that drifts."* The same reasoning bans `published`,
`stage`, `yt_id` and `flows`. Published state is read live from the tracker by whoever asks;
"which pipelines have a folder" is already answered by `whereIs()`.

### The existing test suite

`pipelines/video-registry/registry.test.mjs`, run with `node --test registry.test.mjs`.
16 tests. **Pass the file, never a directory** — `node --test <dir>` fails on node 22.14
(LESSONS 2026-07-09).

Plan 238 (PR#199) adds `pipelines/video-registry/` to `tooling/cli/pp-land/verify-map.tsv`,
so this suite is the real merge gate for this path. It must be green.

### How the established code reaches D1

`pipelines/common/cloudflare.py` is the house pattern:

```python
CF_API_BASE = "https://api.cloudflare.com/client/v4"

class D1Client:
    def __init__(self) -> None:
        self.account_id = _required_env("CF_ACCOUNT_ID")
        self.token = _required_env("CF_API_TOKEN")
```

`pipelines/.env.example` declares `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`.
`CF_D1_DATABASE_ID` points at **clicks-db**, not the tracker, so do not reuse it.

**`tracker-db`'s database id is `1562469d-ffd1-4cc2-b9f7-7095b84128ad`.** It is already
committed in `apps/tutorial-tracker-app/wrangler.toml`, so it is not a secret — put it in
the code as a named constant with a comment saying where it came from. Only the token and
account id come from the environment.

### Why not the tracker's own HTTP API

The tracker authenticates with **Google OAuth** (`GOOGLE_CLIENT_ID`,
`GOOGLE_REDIRECT_URI=/auth/callback`, sessions in the `SESSIONS` KV namespace, cookie set at
`src/worker/index.ts:223`). There is **no shared password** — that is `analytics-app`, a
different app. A CLI cannot complete an interactive OAuth flow, and the dev-login route is
gated behind `DEV_AUTH === "1"` and returns 404 otherwise. So `sync` reads D1 directly,
read-only, exactly as the Python scripts already do.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `cd pipelines/video-registry && node --test registry.test.mjs` | `# fail 0` |
| Registry self-check | `cd pipelines/video-registry && node bin/vreg.mjs check` | exit 0 |
| List entries | `cd pipelines/video-registry && node bin/vreg.mjs list` | current keys |
| Sync help | `cd pipelines/video-registry && node bin/vreg.mjs sync --help` | usage text, exit 0 |
| Sync dry run | `cd pipelines/video-registry && node bin/vreg.mjs sync --dry-run` | prints planned mints, writes nothing |

## Scope

**In scope**:
- `pipelines/video-registry/lib/tracker.mjs` (new) — the D1 read plus the pure merge
- `pipelines/video-registry/lib/registry.mjs` — accept and preserve `card_id`
- `pipelines/video-registry/bin/vreg.mjs` — the `sync` verb
- `pipelines/video-registry/registry.test.mjs` — new assertions
- `pipelines/video-registry/README.md` and `CLAUDE.md` — document `sync` and `card_id`

**Out of scope**:
- `apps/tutorial-tracker-app/` — plan 239 owns every tracker change. Do not touch it.
- `clicks-db`, `yt-script-desk` — plan 241.
- `pipelines/youtube/yt-script/` and `pipelines/video/visuals-flow/` — no consumer change is
  needed; `ensure` behaves as before.
- **Any directory under a `videos/` tree.** Forbidden: `decisions.md` 2026-08-09, "The
  registry NEVER renames a directory."
- `pipelines/.env` — the executor never writes secrets. Document the two variables in
  `README.md` and stop.
- `decisions.md` — the orchestrator appends the entry.

## Git workflow

- Branch: `advisor/240-vreg-sync-carries-the-slug`
- Commit: `feat(video-registry): sync keys from the tracker` — no AI footers. Do NOT push.

## Steps

### Step 1: The pure merge function

Create `pipelines/video-registry/lib/tracker.mjs`. Write **this** merge function verbatim —
it is the whole intelligence of the plan:

```js
/**
 * tracker.mjs
 * Seeds the registry from tracker-db. The tracker mints a video's slug at card
 * creation (see apps/tutorial-tracker-app/src/shared/slug.ts); a Worker cannot
 * write to this repo, so this carries it across.
 *
 * Design: docs/specs/2026-08-25-video-identity-design.md §4.2.
 */

// tracker-db. Committed in apps/tutorial-tracker-app/wrangler.toml, so not a secret.
export const TRACKER_DB_ID = "1562469d-ffd1-4cc2-b9f7-7095b84128ad";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Decide what a sync would change. PURE — no I/O, no clock, no network.
 *
 * @param rows     [{ id, slug, title }] from tracker-db
 * @param registry the parsed videos.json object
 * @param today    ISO date string used as `minted` for new entries
 * @returns { mints: [{key,title,card_id}], stamps: [{key,card_id}], skipped: [{reason,id}] }
 */
export function planSync(rows, registry, today) {
  const mints = [], stamps = [], skipped = [];
  const known = registry.videos ?? {};

  // Every name already resolvable: a key, or any alias of a key.
  const resolvable = new Map();
  for (const [key, entry] of Object.entries(known)) {
    resolvable.set(key, key);
    for (const a of entry.aliases ?? []) resolvable.set(a, key);
  }

  for (const row of rows) {
    if (!row.slug) continue;                 // a card with no slug is not an error
    const existing = resolvable.get(row.slug);
    if (existing) {
      const entry = known[existing];
      if (!entry.card_id && row.id) stamps.push({ key: existing, card_id: row.id });
      else if (entry.card_id && row.id && entry.card_id !== row.id) {
        skipped.push({ reason: "card_id conflict", id: row.id, key: existing });
      }
      continue;
    }
    mints.push({ key: row.slug, title: row.title ?? "", card_id: row.id, minted: today });
  }
  return { mints, stamps, skipped };
}

/** Read every card that has a slug. Read-only. */
export async function fetchCards(fetchImpl = fetch, env = process.env) {
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  if (!account || !token) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set (see pipelines/.env.example)");
  }
  const url = `${CF_API_BASE}/accounts/${account}/d1/database/${TRACKER_DB_ID}/query`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: "SELECT id, slug, title FROM cards WHERE slug IS NOT NULL ORDER BY id",
    }),
  });
  if (!res.ok) throw new Error(`tracker-db query failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(`tracker-db query failed: ${JSON.stringify(body.errors)}`);
  return body.result?.[0]?.results ?? [];
}
```

Three properties that matter and must not be "simplified":

- **`if (!row.slug) continue;`** — a card without a slug is skipped silently, not an error.
  Cards predating plan 239 have `slug = NULL` and must not break a sync.
- **Aliases count as resolvable.** Checking only canonical keys would re-mint a video that
  already exists under an old name. That exact bug was caught by running it, not by review
  (`decisions.md` 2026-08-09).
- **A `card_id` conflict is reported, never overwritten.** Two cards claiming one key is a
  human problem.

**Verify**: `cd pipelines/video-registry && node -e "import('./lib/tracker.mjs').then(m=>console.log(typeof m.planSync))"`
-> prints `function`.

### Step 2: Let the registry store `card_id`

In `lib/registry.mjs`, make `mint` accept an optional `card_id` and write it onto the entry,
and make every write path **preserve** an existing `card_id` rather than dropping it. Keep
the file sorted by key and keep `aliases` defaulting to `[]`.

**Verify**: `cd pipelines/video-registry && node --test registry.test.mjs` -> `# fail 0`
(existing 16 tests still pass; `card_id` is additive and optional).

### Step 3: The `sync` verb

Add to `bin/vreg.mjs`:

```
vreg sync [--dry-run]
```

- reads rows via `fetchCards()`
- computes `planSync(rows, registry, new Date().toISOString().slice(0, 10))`
- with `--dry-run`: prints the plan and **writes nothing**, exit 0
- otherwise: applies mints and `card_id` stamps, writes `videos.json`, prints a one-line
  summary per change
- prints any `skipped` entry to **stderr** and still exits 0 — a conflict is a report, not a
  failure

**Keep stdout clean.** `CLAUDE.md`: *"`ensure` prints the key on stdout and everything else
on stderr. That is what makes `KEY=$(vreg ensure …)` safe. Do not add stdout chatter."*
`sync` is not used in a `$(...)`, but keep the human summary on stderr anyway so the two
verbs behave alike.

**Verify**: `cd pipelines/video-registry && node bin/vreg.mjs sync --help` -> usage text,
exit 0. And `git diff --stat -- videos.json` after a `--dry-run` -> no change.

### Step 4: Tests — at least 6 new assertions, no network

Append to `registry.test.mjs`. Test `planSync` only; it is pure, so no fetch and no
fixture server is needed.

```js
import { planSync } from "./lib/tracker.mjs";

const REG = {
  version: 1,
  videos: {
    "best-ai-video-generator": { title: "Best AI Video Software", minted: "2026-07-31", aliases: ["ai-video-tools-comparison"] },
    "opusclip-vs-submagic": { title: "OpusClip vs Submagic", minted: "2026-08-04", aliases: [], card_id: "row_9" },
  },
};
const TODAY = "2026-08-25";

test("mints a card whose slug is unknown", () => {
  const p = planSync([{ id: "row_1", slug: "brand-new-video", title: "Brand New" }], REG, TODAY);
  assert.deepStrictEqual(p.mints, [{ key: "brand-new-video", title: "Brand New", card_id: "row_1", minted: TODAY }]);
});

test("does not re-mint a slug that resolves through an ALIAS", () => {
  const p = planSync([{ id: "row_2", slug: "ai-video-tools-comparison", title: "x" }], REG, TODAY);
  assert.deepStrictEqual(p.mints, []);
});

test("stamps card_id onto an existing entry that has none", () => {
  const p = planSync([{ id: "row_2", slug: "best-ai-video-generator", title: "x" }], REG, TODAY);
  assert.deepStrictEqual(p.stamps, [{ key: "best-ai-video-generator", card_id: "row_2" }]);
});

test("skips a card with no slug", () => {
  const p = planSync([{ id: "row_3", slug: null, title: "No slug yet" }], REG, TODAY);
  assert.deepStrictEqual(p, { mints: [], stamps: [], skipped: [] });
});

test("reports a card_id conflict instead of overwriting", () => {
  const p = planSync([{ id: "row_99", slug: "opusclip-vs-submagic", title: "x" }], REG, TODAY);
  assert.strictEqual(p.skipped.length, 1);
  assert.strictEqual(p.skipped[0].reason, "card_id conflict");
  assert.deepStrictEqual(p.stamps, []);
});

test("a second identical sync is a no-op", () => {
  const rows = [{ id: "row_9", slug: "opusclip-vs-submagic", title: "OpusClip vs Submagic" }];
  const p = planSync(rows, REG, TODAY);
  assert.deepStrictEqual(p, { mints: [], stamps: [], skipped: [] });
});
```

**Verify**: `cd pipelines/video-registry && node --test registry.test.mjs` -> `# fail 0` and
at least 22 tests total (16 existing + 6 new).

No test may open a socket or a server. `registry.test.mjs` has no teardown hook, and a test
that opens one and then fails an assertion hangs the runner forever at 0% CPU with no output
(LESSONS 2026-07-31). Testing the pure function avoids the problem entirely — do not
introduce a fixture HTTP server.

### Step 5: Document it

- `README.md` — add `sync` to the command list, and name the two required environment
  variables (`CF_ACCOUNT_ID`, `CF_API_TOKEN`) and where they live (`pipelines/.env`).
- `CLAUDE.md` — under the commands table add `sync`; in the Traps section record that
  `card_id` is the only permitted new field and why (a second source of truth drifts).

**Verify**: `grep -c 'sync' pipelines/video-registry/README.md` -> at least `1`, and
`grep -c 'card_id' pipelines/video-registry/CLAUDE.md` -> at least `1`.

### Step 6: Commit

```bash
git add pipelines/video-registry/lib/tracker.mjs \
        pipelines/video-registry/lib/registry.mjs \
        pipelines/video-registry/bin/vreg.mjs \
        pipelines/video-registry/registry.test.mjs \
        pipelines/video-registry/README.md \
        pipelines/video-registry/CLAUDE.md
git commit -m "feat(video-registry): sync keys from the tracker"
```

Stage explicitly. Never `git add -A`. Do not push.

## Test plan

`planSync` is pure, so all six behaviours above are unit-testable with fixture rows and no
network. `fetchCards` is a thin shim over `fetch` with an injectable `fetchImpl`, and is
deliberately **not** unit-tested — mocking `fetch` would test the mock.

The mutation gate disables the `!row.slug` guard, which must make **"skips a card with no
slug"** fail. That guard is the one thing standing between a pre-239 card and a garbage
registry entry, so it is the right thing to pin.

## Done criteria

- [ ] `cd pipelines/video-registry && node --test registry.test.mjs` -> `# fail 0`, at least 22 tests
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs check` -> exit 0
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs sync --help` -> exit 0
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs sync --dry-run` -> exit 0 and
      `git diff --quiet -- pipelines/video-registry/videos.json` -> exit 0 (wrote nothing)
- [ ] `videos.json` keys still sorted and the file still parses as JSON
- [ ] `grep -c 'package.json' pipelines/video-registry/lib/tracker.mjs` -> `0`, and no
      `pipelines/video-registry/package.json` exists
- [ ] `grep -Ec '"(stages|paths|published|flows|yt_id)"' pipelines/video-registry/lib/tracker.mjs` -> `0`
- [ ] `git diff --name-only e45ff9e7..HEAD | grep -v '^pipelines/video-registry/' ; test $? -ne 0`
- [ ] No `videos/` directory created, renamed, moved or deleted

## STOP conditions

- **A gate assertion fails and you want to change it.** Fix the code. Weakening, swapping or
  deleting an assertion is a STOP (LESSONS 2026-07-31, 2026-07-24).
- **You are about to make `ensure`, `resolveKey` or any consumer throw on a missing entry.**
  `resolveKey` returns `null` by contract and `visuals-flow`'s `lib/workdir.mjs` relies on
  it; `scripts/test-run-sh.sh` drives every verb with the literal slug `.`.
- **You are about to add a `package.json` or any dependency** to `pipelines/video-registry/`.
  Explicitly forbidden by its `CLAUDE.md`.
- **You are about to add a `published`, `stage`, `flows`, `yt_id` or `paths` field.** Only
  `card_id` is permitted.
- **You are about to rename, move or delete a directory.** Forbidden (`decisions.md`
  2026-08-09).
- **A test opens a server or a socket.** Test the pure function instead.
- **`fetchCards` needs a secret you do not have.** Do not invent one, do not write to
  `pipelines/.env`. Report that `--dry-run` and the tests pass and that a live `sync` needs
  the owner to supply `CF_ACCOUNT_ID` and `CF_API_TOKEN`.
- **`cards.slug` does not exist when you query it.** Plan 239 has not landed. Stop and
  report; do not add the column yourself.

## Maintenance notes

- `sync` mints but never renames and never deletes. Removing a stale entry stays a human
  decision.
- Refreshing the registry from the tracker is a natural job for the repo-maintainer agent
  (Project B). This plan deliberately adds no cron and no schedule.
- `vreg check` is still not wired into any merge gate as a standalone command
  (`decisions.md` 2026-08-09: a scratch workdir would turn the gate red). The
  `unregisteredDirs` assertion inside `registry.test.mjs` is the gate.
- A reviewer should scrutinise the alias branch in `planSync`. Checking only canonical keys
  looks correct and silently re-mints videos that already exist under an old name.
