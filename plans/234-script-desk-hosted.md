---
executor: claude-p
model: sonnet
test_cmd: cd apps/yt-script-desk && npm run typecheck && npm test
ui:
deploy:
needs: ["233 lands the full script view"]
needs_prs: [194]
touches: [apps/yt-script-desk, pipelines/youtube/yt-script/.gitignore]

mutation_apply: perl -0pi -e "s/const LINK_TOKEN_IS_REQUIRED = true/const LINK_TOKEN_IS_REQUIRED = false/" apps/yt-script-desk/src/worker/auth.ts
mutation_command: cd apps/yt-script-desk && npm test
mutation_expect: TOKEN_BYPASSED
mutation_cwd:
mutation_timeout: 900
---

# Plan 234: script desk — hosted Worker, D1, secret link, publish and pull

## Summary

- **Problem statement**: The desk only runs on the owner's machine. The freelancer is remote and needs one URL. Nothing yet carries the outline out to a hosted store or brings his typed words back into the yt-script pipeline.
- **Goals**:
  - A Cloudflare Worker + D1 backend serving the same API shape the local server serves, gated by a secret link token.
  - `bin/desk.mjs publish <key>` — push a snapshot of the parsed beats to D1 and print the one URL to send.
  - `bin/desk.mjs pull <key>` — bring his answers back down and write `videos/<key>/script-draft.md` in the shape step 3 of the yt-script skill already reads.
  - Files stay the source of truth: `outline.md` in git is upstream, D1 is a copy, `script-draft.md` is the record that comes back.
- **Executor proposed**: `claude-p` / Claude Sonnet
- **Done criteria** (terse): `npm run typecheck && npm test` exit 0; `desk.mjs pull` against a local fixture writes a `script-draft.md` that `diff`s clean against the expected fixture.
- **Stop conditions** (terse): you are about to create cloud resources, deploy, or put a secret in a tracked file.
- **Test / verification for success**: Vitest unit tests over the Worker's pure route handlers and the CLI's markdown emitter, run against an in-memory D1 stub.
- **Open points for plan readiness**: none. D1 creation and deploy are owner steps, listed under "Post-merge (owner)".

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ca36925c..HEAD -- apps/yt-script-desk/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 233
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ca36925c`, 2026-08-23

## Why this matters

The whole point is one URL the owner can send. Everything else — the two tracks, the toggles, the confirmation — only pays off if the freelancer can reach it from his own machine and the words come back without anyone emailing a file.

**The direction of truth is the load-bearing decision.** `outline.md` in git is upstream; publishing copies a parsed snapshot into D1; his typed words come back down into `script-draft.md`, which the yt-script skill already treats as the team member's verbatim draft (decisions.md 2026-08-18). D1 is never the source of anything. That is what keeps the skill, the git history and the existing step-3 polish pass working unchanged.

## Current state

### The app after plans 232 and 233

`apps/yt-script-desk/` is a Vite + React + TS app with:
- `src/api.ts` — `getVideo`, `putDraft`, `putSay`, `restoreSay`, `postFinish`, all against `/api/...`
- `src/types.ts` — `Beat`, `Edit`, `VideoDoc`
- `server/local.mjs` — the local Node backend, port 4327, reading `pipelines/youtube/yt-script/videos/<key>/outline.md` via `buildBeats` and persisting `desk-draft.json`
- resolution order for a beat's spoken text: `says[num]` → `say` → `draft[num]`

### The exemplar Worker

`apps/tutorial-tracker-app/wrangler.toml` shows the house shape: `main = "src/worker/index.ts"`, `compatibility_flags = ["nodejs_compat"]`, an `[assets]` block binding `./dist`, `[[d1_databases]]` bindings, and a `[[routes]]` block with `custom_domain = true` on the `agrolloo.com` zone. Follow it.

### What step 3 of the yt-script skill expects

`pipelines/.claude/skills/yt-script/SKILL.md` step 3 reads `videos/<key>/script-draft.md` as "the team member's completed draft, stored verbatim". It then diffs it against the sent artifact. Your `pull` must produce a file in that same markdown idiom so the existing step keeps working: a `#` title, `## PART …` headings, `#### <num> · <title>` beat headings, and each beat's spoken lines as a `>` blockquote.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/yt-script-desk && npm run typecheck` | exit 0 |
| Unit tests | `cd apps/yt-script-desk && npm test` | exit 0, `fail 0` |
| Build | `cd apps/yt-script-desk && npm run build` | exit 0 |
| Local worker (needs a local D1) | `cd apps/yt-script-desk && npx wrangler dev --local --port 8788` | serves on 8788 |
| Pull against a fixture | `cd apps/yt-script-desk && node bin/desk.mjs pull --fixture test/fixtures/pulled.json --out /tmp/sd.md` | writes the file, exit 0 |
| The merge gate | `cd apps/yt-script-desk && npm run typecheck && npm test` | exit 0 |

## Scope

**In scope**:
- `apps/yt-script-desk/wrangler.toml` (new)
- `apps/yt-script-desk/migrations/0001_init.sql` (new)
- `apps/yt-script-desk/src/worker/index.ts`, `auth.ts`, `routes.ts`, `db.ts` (new)
- `apps/yt-script-desk/bin/desk.mjs` (new)
- `apps/yt-script-desk/src/api.ts` — token-aware base path
- `apps/yt-script-desk/.dev.vars.example`, `.gitignore`
- `apps/yt-script-desk/test/` — worker and CLI tests plus fixtures
- `pipelines/youtube/yt-script/.gitignore` — one line, see Step 6

**Out of scope**:
- Creating the D1 database, putting secrets, deploying, DNS — owner steps, listed under "Post-merge (owner)". Boss runs them only when the owner says "deploy".
- `pipelines/.claude/skills/yt-script/SKILL.md`, `apps.json`, `my-hosted-sites.md`, `INFRA.md` — plan 235.
- `decisions.md` — the orchestrator appends after landing. Never write it from a plan branch.
- Any change to `render-worksheet.mjs`, `render-outline.mjs` or `lib/beats.mjs`.

## Git workflow

- Branch: `advisor/234-script-desk-hosted`
- Commit: `feat(script-desk): hosted worker, secret link, publish and pull` — no AI footers. Do NOT push.

## Steps

### Step 1: `wrangler.toml`

```toml
name = "yt-script-desk"
main = "src/worker/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"

[[d1_databases]]
binding = "DESK_DB"
database_name = "script-desk-db"
database_id = "PLACEHOLDER-SET-BY-OWNER"

[[routes]]
pattern = "script-desk.agrolloo.com"
custom_domain = true
```

Leave `database_id` as the literal placeholder. The owner fills it after `wrangler d1 create`. Add a comment above it saying exactly that.

`.dev.vars.example` (tracked) with `DESK_ADMIN_TOKEN=change-me`; `.dev.vars` (gitignored) is the owner's local copy.

**Verify**: `grep -c PLACEHOLDER-SET-BY-OWNER apps/yt-script-desk/wrangler.toml` → `1`. `git check-ignore apps/yt-script-desk/.dev.vars` → exit 0.

### Step 2: `migrations/0001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS videos (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  beats_json  TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  finished    INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  video_key TEXT NOT NULL,
  beat_num  TEXT NOT NULL,
  text      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (video_key, beat_num)
);

CREATE TABLE IF NOT EXISTS say_edits (
  video_key TEXT NOT NULL,
  beat_num  TEXT NOT NULL,
  original_json TEXT NOT NULL,
  lines_json    TEXT NOT NULL,
  edited_at TEXT NOT NULL,
  PRIMARY KEY (video_key, beat_num)
);

CREATE INDEX IF NOT EXISTS idx_videos_token ON videos(token);
```

Republishing a video **replaces** its `videos` row and **preserves** its `answers` and `say_edits` rows — the maker's work survives an outline re-render. That is a `INSERT … ON CONFLICT(key) DO UPDATE` on `videos` only.

**Verify**: a test applies the migration to an in-memory stub and asserts all three tables exist.

### Step 3: `src/worker/auth.ts` — the secret link

```ts
// Single mutation target: setting this to false serves any video to any request,
// which is the defect the gate must catch. Do not inline it.
const LINK_TOKEN_IS_REQUIRED = true

export async function resolveVideoKey(db: D1Database, token: string): Promise<string | null> {
  if (!LINK_TOKEN_IS_REQUIRED) return firstVideoKey(db)   // unreachable in production
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null
  const row = await db.prepare('SELECT key FROM videos WHERE token = ?').bind(token).first<{ key: string }>()
  return row?.key ?? null
}
```

Rules:
- Tokens are 43 characters of base64url from 32 random bytes (`crypto.getRandomValues`). Minted once per video at first publish and **reused** on republish, so a link the owner already sent keeps working.
- Every `/api/d/:token/...` route resolves the key from the token. **No route ever accepts a `key` parameter from the client.** A wrong or unknown token is a flat `404` with `{error:'not found'}` — never `401`, never a message distinguishing "no such token" from "no such video".
- `/d/:token` serves the SPA shell from `ASSETS`; the SPA reads its token from `location.pathname`.
- The admin routes (`POST /api/admin/publish`, `GET /api/admin/pull`) require header `x-desk-admin: <DESK_ADMIN_TOKEN>` compared with a **constant-time** comparison, and return `404` on mismatch.
- No route logs a token.

**Verify**: tests 1–4 in Step 7.

### Step 4: `src/worker/routes.ts` — the same API shape

Serve exactly the local server's contract, prefixed with the token:

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/d/:token/video` | the `VideoDoc` — beats from `beats_json`, `draft` from `answers`, `says`/`edits` from `say_edits`, `finished` from `videos.finished` |
| PUT | `/api/d/:token/beat/:num` | upsert `answers`; `409 {error:'finished'}` when finished |
| PUT | `/api/d/:token/beat/:num/say` | first edit stores `original_json` from the parsed beat and never overwrites it; later edits update `lines_json` only |
| POST | `/api/d/:token/beat/:num/restore` | delete the `say_edits` row, return the parsed `say` |
| POST | `/api/d/:token/finish` | set `videos.finished = 1` |
| POST | `/api/admin/publish` | body `{key, title, beats}` — upsert `videos`, mint the token if absent, return `{token, url}` |
| GET | `/api/admin/pull?key=` | return `{key, title, draft, says, edits, finished}` |

`:num` is validated against `^[0-9A-Za-z][0-9A-Za-z.]{0,15}$` and must match a beat in `beats_json`; anything else is `400`.

Update `src/api.ts` so the base path is `/api/d/${token}` when `location.pathname` starts with `/d/`, and `/api` otherwise. **The call shapes do not change** — that is the point of having one contract.

**Verify**: `npm run typecheck` exits 0 and the local server still works: `npm run dev:local` and load `?key=character-consistency-ai`.

### Step 5: `bin/desk.mjs` — publish and pull

Zero-dependency Node CLI, run from the repo root or the app folder.

```
node bin/desk.mjs publish <key> [--base https://script-desk.agrolloo.com]
node bin/desk.mjs pull    <key> [--base ...]
node bin/desk.mjs pull    --fixture <file.json> --out <file.md>     # offline, for tests
```

`publish`:
1. reads `pipelines/youtube/yt-script/videos/<key>/outline.md`, runs `buildBeats`;
2. `POST {base}/api/admin/publish` with the admin token from `$DESK_ADMIN_TOKEN` (error out clearly if unset — never read it from a tracked file);
3. prints the URL on its own line and nothing else on stdout, so it can be piped.

`pull`:
1. `GET {base}/api/admin/pull?key=<key>`;
2. re-reads the local `outline.md` so beat order and titles come from the source of truth, not from the snapshot;
3. writes `pipelines/youtube/yt-script/videos/<key>/script-draft.md`;
4. prints, to **stderr**, one line per beat whose locked copy was edited: `edited <num> · <title>`;
5. refuses to overwrite an existing `script-draft.md` without `--force`, because that file is the team member's verbatim record.

The emitted markdown — author it exactly like this:

```markdown
# <title> — script draft

<!-- pulled from the script desk on <ISO date>. His words, verbatim. -->

## PART A — INTRODUCTION

#### A1 · Cold open — the drift

> "Perfect face. Perfect outfit."
>
> "Scene two. Different person."

#### B4 · Five scenes, five tools

> So I built one character and ran her through five scenes.
```

Rules for the emitter:
- Part headings come from `beat.part`, deduplicated, in first-appearance order.
- Spoken text resolves `says[num]` → `say` → `draft[num]`, the same order the UI uses.
- A beat with no text at all is emitted with the heading and a single `> [not written]` line, so a gap is visible rather than silent.
- An edited locked line gets one HTML comment above its blockquote: `<!-- edited by the maker; original: "<first original line>" -->`. Nothing else marks it — step 3 of the skill does the reporting.
- Blank strings inside a lines array become a bare `>`.

**Verify**: `node bin/desk.mjs pull --fixture test/fixtures/pulled.json --out /tmp/sd.md && diff /tmp/sd.md test/fixtures/expected-draft.md` → no output, exit 0.

### Step 6: One gitignore line

Add to `pipelines/youtube/yt-script/.gitignore`:

```
# Local-mode desk scratch. The record that matters is script-draft.md, pulled with desk.mjs.
videos/*/desk-draft.json
```

This reverses plan 232's note that `desk-draft.json` is tracked: once `pull` exists, `script-draft.md` is the record and the JSON is scratch. If plan 232 committed any `desk-draft.json`, `git rm --cached` it in this commit.

**Verify**: `git check-ignore pipelines/youtube/yt-script/videos/character-consistency-ai/desk-draft.json` → exit 0. `git ls-files 'pipelines/youtube/yt-script/videos/*/desk-draft.json'` → no output.

### Step 7: Tests

Write a tiny in-memory D1 stub (`test/d1-stub.mjs`) implementing `prepare().bind().first()/all()/run()` over a `Map`-backed store — enough for these routes. Do not pull in a real SQLite dependency.

`src/worker/__tests__/auth.test.ts`
1. a valid token resolves its video key.
2. an unknown token returns `null`, and the route returns `404` with body `{"error":"not found"}` — not 401, and not a different message from an unpublished key.
3. a malformed token (too short, wrong charset) returns `null` without touching the database.
4. **with `LINK_TOKEN_IS_REQUIRED` false, a request with a bogus token must NOT reach a video** — assertion message contains `TOKEN_BYPASSED`. This is the mutation gate.
5. the admin routes reject a wrong `x-desk-admin` with `404`.

`src/worker/__tests__/routes.test.ts`
6. `GET video` composes a `VideoDoc` with the same keys the local server returns — assert the key set matches `src/types.ts`'s `VideoDoc` exactly.
7. republishing replaces the `videos` row and leaves `answers` rows intact.
8. republishing reuses the existing token.
9. the first `say` edit stores the original; a second edit leaves `original_json` unchanged.
10. `restore` deletes the row and returns the parsed lines.
11. `PUT beat` on a finished video returns `409 {error:'finished'}`.
12. an unknown `:num` returns `400`.

`bin/__tests__/emit.test.mjs`
13. the fixture pull output equals `expected-draft.md` byte for byte.
14. a beat with no text emits `> [not written]`.
15. an edited beat emits exactly one `<!-- edited by the maker` comment.
16. a blank string inside a lines array emits a bare `>`.
17. resolution order is `says` → `say` → `draft`.

**Verify**: `cd apps/yt-script-desk && npm test` → `fail 0`, at least 42 tests total across all three plans.

### Step 8: Fresh-tree check

```bash
cd apps/yt-script-desk && rm -rf node_modules dist && npm install && npm run typecheck && npm run lint && npm test && npm run build
```

**Verify**: all exit 0.

## Post-merge (owner)

Boss runs these only when the owner explicitly says "deploy" for this item. Do **not** run them as part of executing the plan.

```bash
cd apps/yt-script-desk
npx wrangler d1 create script-desk-db          # copy the returned id into wrangler.toml
npx wrangler d1 migrations apply script-desk-db --remote
npx wrangler secret put DESK_ADMIN_TOKEN       # 32+ random chars, also export it locally
npm run build && npx wrangler deploy
```

Then the first real use: `DESK_ADMIN_TOKEN=… node bin/desk.mjs publish character-consistency-ai` prints the URL to send.

## Test plan

17 new tests over the Worker's route and auth logic (against an in-memory D1 stub) and the CLI's markdown emitter (against committed fixtures). The mutation-shaped invariant is that the link token actually gates access (`TOKEN_BYPASSED`). Byte-identity of the emitted `script-draft.md` is locked by a committed fixture, because that file feeds step 3 of the yt-script skill.

## Done criteria

- [ ] `cd apps/yt-script-desk && npm run typecheck` exits 0.
- [ ] `cd apps/yt-script-desk && npm test` exits 0, `fail 0`, at least 42 tests.
- [ ] `cd apps/yt-script-desk && npm run lint && npm run build` both exit 0.
- [ ] `node bin/desk.mjs pull --fixture test/fixtures/pulled.json --out /tmp/sd.md && diff /tmp/sd.md test/fixtures/expected-draft.md` produces no output.
- [ ] `grep -rn 'DESK_ADMIN_TOKEN=' apps/yt-script-desk --include='*.toml' --include='*.ts' --include='*.mjs'` finds no literal value (only `.dev.vars.example`'s `change-me`).
- [ ] `git ls-files apps/yt-script-desk/.dev.vars` returns nothing.
- [ ] `git ls-files 'pipelines/youtube/yt-script/videos/*/desk-draft.json'` returns nothing.
- [ ] Flipping `LINK_TOKEN_IS_REQUIRED` to `false` makes `npm test` fail printing `TOKEN_BYPASSED`; reverting makes it pass.
- [ ] `grep -c TOKEN_BYPASSED` on a clean passing run returns `0`.
- [ ] A fresh `rm -rf node_modules dist && npm install && npm run typecheck && npm run lint && npm test && npm run build` exits 0 at every step.
- [ ] `wrangler.toml` still contains `PLACEHOLDER-SET-BY-OWNER` — you did not create or wire a real database.

## STOP conditions

- **You are about to run `wrangler d1 create`, `wrangler secret put`, `wrangler deploy`, or any command that creates or changes a Cloudflare resource.** Those are owner-gated. Stop.
- **You are about to write a real token, admin secret or database id into a tracked file.** Stop.
- You are about to make D1 the source of truth — regenerating `outline.md` from a snapshot, or pulling beat titles from `beats_json` instead of the local outline. Stop; the file is upstream.
- You are about to overwrite an existing `script-draft.md` without `--force`. That file is the team member's verbatim record. Stop.
- **If a gate assertion fails, fix the code or the fixture; weakening, swapping, or deleting the assertion is a STOP.**
- A test starts a server or a worker and you cannot guarantee teardown. Restructure with `try/finally`; never ship a suite that can hang.
- You want to return `401` or a descriptive error for a bad token. Stop — a flat `404` is deliberate, so the URL space cannot be probed.

## Maintenance notes

- The API shape is duplicated in `server/local.mjs` and `src/worker/routes.ts` on purpose: one reads the repo, one reads D1. Test 6 pins them to the same `VideoDoc` key set — if you change the shape, change both and that test.
- `expected-draft.md` is the contract with step 3 of the yt-script skill. Changing the emitter's markdown is a breaking change for that step.
- Republish preserves answers by design. If a beat is renumbered in the outline, its old answer is orphaned in `answers` — surfacing that is worth a future plan; today `pull` simply will not find it.
- Tokens are minted once and reused, so a sent link survives republishing. Rotating a link means deleting the `videos` row.
