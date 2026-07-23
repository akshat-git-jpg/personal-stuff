---
executor: agy
model:
test_cmd: cd apps/tutorial-vo && npm install --no-audit --silent && npm run check && cd ../../pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh
ui: true
deploy: cd apps/tutorial-vo && npx wrangler deploy
needs: [129, 130, 131]
---

# Plan 132: tutorial-vo — the tutorial maker's self-serve TTS Worker UI (v1)

## Summary

- **Problem statement**: the VO-first pipeline needs its centerpiece: a web UI where
  the freelancer sees the script in sections, generates/regens per-section TTS
  (capped), respells, plays, and LOCKS takes — without the owner in the loop.
  Nothing exists.
- **Goals**:
  - New Cloudflare Worker `apps/tutorial-vo/` at `vo.agrolloo.com`
    (house pattern: hono + ASSETS single-file SPA + D1 + R2, token auth).
  - Admin API (publish script / read state / read locked audio) for the pipeline.
  - Freelancer API + SPA (view sections, generate/regen via the plan-131 Modal
    endpoint, respell, play, lock) with a hard 4-takes cap and Telegram alert on
    cap hit.
  - Local pipeline steps in tutorial-pipeline-3: `publish-ui` and `pull-ui`.
- **Executor proposed**: agy (Gemini 3.1 Pro High — agy default). Every schema,
  policy, and non-trivial snippet is inlined; the SPA has an acceptance checklist.
- **Done criteria** (terse): both test gates green (`npm run check` in the app,
  `scripts/check.sh` in the pipeline); policy rules provably enforced by vitest.
- **Stop conditions** (terse): NO `wrangler deploy|secret|d1|r2` commands, no live
  network calls; drift check fails; deps (129/130 files) missing.
- **Test / verification for success**: vitest on Worker logic (publish merge, caps,
  lock, token) + node:test on the two pipeline CLIs with injected fetch mocks.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ff940f0..HEAD -- apps/tutorial-vo/ pipelines/youtube/tutorial-pipeline-3/lib/publish-ui.mjs pipelines/youtube/tutorial-pipeline-3/lib/pull-ui.mjs`
> Expected: `apps/tutorial-vo/` does not exist yet; the two lib files do not exist
> yet. Also confirm deps landed: `ls pipelines/youtube/tutorial-pipeline-3/lib/state.mjs`
> must succeed, else STOP (plans 129/130 not landed).

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 129, 130 (contract + state rules), 131 (endpoint contract)
- **Category**: feature
- **Difficulty**: standard (fully specified below)
- **Planned at**: commit `ff940f0`, 2026-07-23

## Why this matters

The processor (owner) serializing every video through manual admin sessions is the
throughput cap on the whole video business (final-workflow open problem #1). This
Worker removes the owner from the TTS loop: publish once, freelancer self-serves,
state flows back. The lock semantics here are the anti-desync mechanism — treat the
policy rules below as law, they mirror `lib/state.mjs` (plan 130).

## Current state

- Exemplar Worker: `apps/timeblock/` — imitate its layout and conventions:
  `wrangler.toml` (ASSETS binding to `./public`, custom_domain route, placeholder
  binding ids with a comment that the owner fills real ids), `src/worker/*.ts`
  (hono ^4, `auth.ts` uses `crypto.subtle.importKey('raw', …, {name:'HMAC',
  hash:'SHA-256'}, …)` + `crypto.subtle.sign`), `test/*.test.ts` (vitest),
  `package.json` scripts `{ dev, typecheck, test, check: "tsc --noEmit && vitest run", deploy }`,
  `.dev.vars.example`, tsconfig, `.npmrc`.
- Modal endpoint (plan 131): `POST $MODAL_TTS_URL` with header
  `Authorization: Bearer $MODAL_TTS_TOKEN`, JSON body
  `{ id, text, interval_silence?, emo_text? }` → 200 `audio/wav` bytes, or JSON
  `{error}` with 400/401/500/503. First call after idle can take 1–2 min (GPU cold
  start).
- Pipeline side (plans 129/130): `videos/<slug>/script.json` per the PIPELINE.md
  contract; `lib/set-stage.mjs <slug> <stage>`; stage must be `"tts"` to publish.
  `scripts/check.sh` runs an explicit `node --test` list — APPEND, never rewrite.
- Existing infra names in use (do NOT collide): Workers redirector, kushal-tools,
  kushal-gym, kushal-docs, yt-tutorials-tracker, yt-analytics, lists-app,
  founders-tracker, timeblock, keto-kitchen, bridebestie, vps-watchdog.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| App gate | `cd apps/tutorial-vo && npm install --no-audit --silent && npm run check` | exit 0 |
| Pipeline gate | `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` | exit 0 |
| One vitest file | `cd apps/tutorial-vo && npx vitest run test/logic.test.ts` | pass |

## Scope

**In scope**:
- CREATE `apps/tutorial-vo/` — `wrangler.toml`, `package.json`, `tsconfig.json`,
  `.npmrc` (copy timeblock's), `.gitignore`, `.dev.vars.example`, `README.md`,
  `CLAUDE.md`, `migrations/0001_init.sql`, `src/worker/{index.ts,auth.ts,logic.ts,
  tts.ts,telegram.ts,types.ts}`, `public/index.html`, `test/{logic.test.ts,
  auth.test.ts,publish.test.ts}`.
- CREATE `pipelines/youtube/tutorial-pipeline-3/lib/{env.mjs,publish-ui.mjs,pull-ui.mjs}`
  + `lib/{publish-ui.test.mjs,pull-ui.test.mjs,env.test.mjs}`
- CREATE `pipelines/youtube/tutorial-pipeline-3/steps/050-publish-ui/README.md`
- EDIT `pipelines/youtube/tutorial-pipeline-3/scripts/check.sh` (append 3 test files)
- EDIT `pipelines/youtube/tutorial-pipeline-3/run.sh` (add verbs `publish`, `pull`)
- EDIT `pipelines/youtube/tutorial-pipeline-3/PIPELINE.md` (env-vars section, Step 8)

**Out of scope**: INFRA.md and my-hosted-sites.md rows (owner updates at deploy
time), all other apps, the Modal app (plan 131 owns it), visuals-flow.

## Git workflow

- Branch: `advisor/132-tutorial-vo-worker-ui`
- Commit per step. Do NOT push. NEVER run wrangler against the real account.

## Design (decisions — the executor obeys, never re-decides)

**Names**: worker `tutorial-vo`, domain `vo.agrolloo.com`, D1 database
`tutorial-vo-db` (binding `DB`), R2 bucket `tutorial-vo-audio` (binding `AUDIO`).

**Secrets** (in `.dev.vars.example` with dummy values; owner sets real ones):
`ADMIN_TOKEN`, `LINK_SECRET`, `MODAL_TTS_URL`, `MODAL_TTS_TOKEN`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

**D1 schema** (`migrations/0001_init.sql`):

```sql
CREATE TABLE videos (
  slug TEXT PRIMARY KEY,
  script_json TEXT NOT NULL,       -- the published script.json, verbatim
  drive_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE sections (
  slug TEXT NOT NULL,
  id TEXT NOT NULL,                -- s01..
  version INTEGER NOT NULL,        -- section.version at publish time
  demo INTEGER NOT NULL,           -- 0/1
  spoken_text TEXT NOT NULL,       -- live copy (respell edits land here)
  takes_used INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  take_key TEXT,                   -- R2 key of the current take
  updated_at TEXT NOT NULL,
  PRIMARY KEY (slug, id)
);
```

**Policy constants** (`src/worker/logic.ts`): `TAKES_MAX = 4` (1 initial + 3
regens), `SPOKEN_MAX = 1200`.

**Token auth (freelancer)**: `token(slug) = hex(HMAC_SHA256(LINK_SECRET, slug)).slice(0, 32)`,
implemented in `auth.ts` with `crypto.subtle` exactly like timeblock's; compare
with a constant-time loop. Freelancer link: `https://vo.agrolloo.com/v/<slug>?t=<token>`.
Every `/api/*` non-admin route requires a valid `t` query param for its slug.
Admin routes require header `Authorization: Bearer <ADMIN_TOKEN>` (constant-time
compare too).

**R2 key**: `take(slug, id, version, n)` → `"<slug>/<id>/v<version>-t<n>.wav"`.

**Routes** (hono):

| Route | Auth | Behavior |
|---|---|---|
| `POST /api/admin/publish/:slug` | admin | Body `{ script, drive_url? }` where `script` is a full script.json with `stage: "tts"` (else 400 `stage must be tts`). Upsert `videos`. Per section, apply the MERGE RULE below. Responds `{ ok, sections: n, link }` where link is the freelancer URL. |
| `GET /api/admin/state/:slug` | admin | `{ slug, drive_url, sections: [{ id, version, demo, spoken_text, takes_used, locked, take_key }] }` |
| `GET /api/admin/audio/:slug/:id` | admin | Streams the take from R2 — only if `locked=1`, else 409. |
| `GET /api/admin/link/:slug` | admin | `{ link }` |
| `GET /v/:slug` | none | Serves `public/index.html` via ASSETS (the SPA reads `?t=` itself). |
| `GET /api/video/:slug?t=` | token | Sections joined for the SPA: from `videos.script_json` take id/demo/display_text/notes; from `sections` take spoken_text/takes_used/locked/take_key(bool); plus `drive_url`. |
| `POST /api/tts/:slug/:id?t=` | token | Generate/regen — see TTS FLOW below. |
| `POST /api/respell/:slug/:id?t=` | token | Body `{ spoken_text }`. 409 if locked. 400 if empty, > SPOKEN_MAX, or contains `[VERIFY:` / `[FILL:`. Updates `sections.spoken_text`. |
| `POST /api/lock/:slug/:id?t=` | token | 409 if `take_key` null. Sets `locked=1`. Idempotent. |
| `GET /api/audio/:slug/:id?t=` | token | Streams current take from R2, 404 if none. |

**MERGE RULE (publish)** — pure function `mergePublish(existingRow | null,
incomingSection)` in `logic.ts`:
- No existing row → insert fresh (takes_used 0, locked 0, take_key null,
  spoken_text from incoming).
- Existing row with `version === incoming.version` → PRESERVE takes_used, locked,
  take_key, spoken_text (respells survive a re-publish of unchanged text).
- Existing row with different version → RESET like a fresh insert (this is
  plan 130's rule 1 crossing the wire: a text edit invalidates takes and locks).

**TTS FLOW (`POST /api/tts/:slug/:id`)**:
1. 409 `{error:"locked"}` if locked.
2. 429 `{error:"cap reached"}` if `takes_used >= TAKES_MAX`; on the FIRST time a
   section hits the cap, fire-and-forget a Telegram message (see below) via
   `c.executionCtx.waitUntil`.
3. Call Modal: `fetch(MODAL_TTS_URL, { method:"POST", headers:{ authorization:
   "Bearer "+MODAL_TTS_TOKEN, "content-type":"application/json" }, body:
   JSON.stringify({ id, text: spoken_text }) })`. Non-200 → 502 with the upstream
   error text. (No Worker-side timeout tricks; cold start is the SPA's problem to
   display.)
4. Put bytes to R2 at `take(slug,id,version,takes_used+1)`, update
   `takes_used += 1`, `take_key = <key>`.
5. Respond `{ ok, takes_used, takes_max: TAKES_MAX }`.

**Telegram** (`telegram.ts`): `notifyCapHit(env, slug, id)` → POST
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with
`{ chat_id: TELEGRAM_CHAT_ID, text: "tutorial-vo: <slug>/<id> hit the TTS take cap (4)" }`.
Failures swallowed (alerting must never break the request).

**SPA** (`public/index.html`, single file, no framework, no build — timeblock
house pattern). Required elements (this is the review rubric):
1. Header: video slug, progress `X/Y locked`, and a `Recordings folder` button
   linking `drive_url` (hidden when empty).
2. One card per section, in order: id + `DEMO`/`TALK` chip, display_text, notes
   line (when present), takes counter `t/4`, and buttons: `Generate` (label
   becomes `Regenerate` once takes_used > 0), `Play` (an `<audio>` element wired
   to `/api/audio/...`), `Respell` (toggles a textarea prefilled with
   spoken_text + Save), `Lock`.
3. Lock requires a `confirm()` with exactly this text: `Locking freezes this
   audio — you will record to it. There is no unlock.` Locked cards show a LOCK
   badge, hide Generate/Respell, keep Play.
4. While a generate request is in flight show `Generating… first request can
   take up to 2 minutes (engine warm-up)` on the card; disable the button.
5. Cap reached (429) → card shows `Take limit reached — the owner has been
   notified`.
6. Errors render inline on the card, never as `alert()`.
7. Mobile-usable: single column, buttons ≥ 40px tall, no horizontal scroll at
   375px width.
8. Demo sections additionally show `Record this section` in the card footer;
   talk sections show `No recording needed`.

**Pipeline CLIs** (tutorial-pipeline-3, node, mirror existing lib style):
- `lib/env.mjs`: `loadEnv(rootDir)` — parse `pipelines/.env` (`KEY=VALUE` lines,
  `#` comments, no quotes handling beyond trimming) merged under `process.env`
  (process.env wins). ~15 lines.
- `lib/publish-ui.mjs`: `node lib/publish-ui.mjs <slug> [--drive-url URL] [--root d]`
  — loads script.json, requires `stage === "tts"` (exit 1 otherwise), POSTs to
  `${VO_UI_URL}/api/admin/publish/<slug>` with `Authorization: Bearer
  ${VO_UI_ADMIN_TOKEN}`, prints the returned freelancer link. Export
  `publishScript(script, opts, fetchImpl)` so tests inject a mock fetch.
- `lib/pull-ui.mjs`: `node lib/pull-ui.mjs <slug> [--root d]` — GETs
  `/api/admin/state/<slug>`, merges into script.json: per section set
  `tts.regens_used = max(0, takes_used - 1)`, `tts.locked`, `tts.take = take_key`,
  and `spoken_text` from the live row; writes the file; if every section locked,
  prints `all locked — run: node lib/set-stage.mjs <slug> locked`. Export
  `mergeState(script, state)` pure for tests.

## Steps

### Step 1: scaffold `apps/tutorial-vo/`

Copy timeblock's `tsconfig.json` and `.npmrc` verbatim; `package.json` same shape
(name `tutorial-vo`, deps hono ^4; devDeps @cloudflare/workers-types ^4,
typescript ^5, vitest ^2, wrangler ^3; scripts dev/typecheck/test/check/deploy
identical to timeblock). `wrangler.toml`:

```toml
name = "tutorial-vo"
main = "src/worker/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"
binding = "ASSETS"

# Owner fills the real id after `npx wrangler d1 create tutorial-vo-db`;
# placeholder is fine for `wrangler dev` (local simulation).
[[d1_databases]]
binding = "DB"
database_name = "tutorial-vo-db"
database_id = "00000000-0000-0000-0000-000000000000"

# Owner creates with `npx wrangler r2 bucket create tutorial-vo-audio`.
[[r2_buckets]]
binding = "AUDIO"
bucket_name = "tutorial-vo-audio"

[[routes]]
pattern = "vo.agrolloo.com"
custom_domain = true

# Secrets (never committed): ADMIN_TOKEN, LINK_SECRET, MODAL_TTS_URL,
# MODAL_TTS_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — via `npx wrangler secret put`.
```

Also `.dev.vars.example` listing all six with dummy values, `.gitignore`
(`node_modules/`, `.wrangler/`, `.dev.vars`), `migrations/0001_init.sql` (SQL
above), `README.md` (what it is, owner setup: d1 create + `npx wrangler d1
migrations apply tutorial-vo-db --remote`, r2 create, 6 secrets, deploy;
freelancer-link explanation), `CLAUDE.md` (operate notes: policy constants live in
logic.ts; publish merge rule summary; "the pipeline side lives in
tutorial-pipeline-3 steps 050").

**Verify**: `cd apps/tutorial-vo && npm install --no-audit --silent && npx tsc --noEmit`
→ exit 0 (will pass once src compiles in later steps; run it after Step 3 if the
scaffold alone doesn't compile).

### Step 2: `logic.ts`, `auth.ts`, `types.ts` + tests

`types.ts`: `Env` (DB: D1Database, AUDIO: R2Bucket, ASSETS: Fetcher + the six
secret strings), `SectionRow`, `PublishBody`.

`logic.ts` (pure, no I/O):

```ts
export const TAKES_MAX = 4;
export const SPOKEN_MAX = 1200;
export const FLAG_MARKER = /\[(VERIFY|FILL):/;

export function takeKey(slug: string, id: string, version: number, n: number): string {
  return `${slug}/${id}/v${version}-t${n}.wav`;
}

export type MergeResult = { action: "insert" | "preserve" | "reset"; row: SectionRow };
export function mergePublish(existing: SectionRow | null, incoming: {
  id: string; version: number; demo: boolean; spoken_text: string;
}, slug: string, now: string): MergeResult { /* MERGE RULE verbatim */ }

export function canGenerate(row: SectionRow): { ok: true } | { ok: false; status: 409 | 429; error: string } { /* locked → 409, cap → 429 */ }

export function validateRespell(text: string, locked: boolean):
  { ok: true } | { ok: false; status: 400 | 409; error: string } { /* rules above */ }
```

`auth.ts`: `sectionToken(secret, slug)` (crypto.subtle HMAC-SHA256, hex,
slice 32 — same pattern as `apps/timeblock/src/worker/auth.ts`), and
`timingSafeEqual(a, b)` (length check + XOR loop).

Vitest `test/logic.test.ts` + `test/auth.test.ts`, minimum: merge insert /
preserve (same version keeps takes+lock+respelled spoken_text) / reset (new
version zeroes everything); canGenerate locked→409, at cap→429, ok below cap;
respell rejects flag markers, oversize, empty, locked; takeKey format; token is
stable, 32 hex chars, differs across slugs; timingSafeEqual true/false.

**Verify**: `npx vitest run test/logic.test.ts test/auth.test.ts` → pass.

### Step 3: `index.ts` routes + `tts.ts` + `telegram.ts` + `test/publish.test.ts`

Hono app implementing the route table exactly. Keep handlers thin — D1 reads/
writes inline, all decisions via `logic.ts`. `tts.ts` exports
`synthesize(env, id, text): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false;
status: number; error: string }>` wrapping the Modal fetch so tests can mock it.
`test/publish.test.ts`: drive the publish handler's merge behavior through the
pure `mergePublish` on a 3-section fixture including one version bump (this is a
logic-level test — do NOT stand up miniflare).

**Verify**: `cd apps/tutorial-vo && npm run check` → exit 0.

### Step 4: `public/index.html` (the SPA)

Single file, vanilla JS + inline CSS, implementing every numbered item in the SPA
rubric above. Visual bar: clean utilitarian tool, dark background, system font
stack, generous tap targets — this is an internal tool for one freelancer, not a
marketing page. No external assets of any kind (self-contained).

**Verify**: `node -e "const s=require('fs').readFileSync('apps/tutorial-vo/public/index.html','utf8');
for (const m of ['Generate','Respell','Lock','Recordings folder','no unlock'.toLowerCase()]) {
  if (!s.toLowerCase().includes(m.toLowerCase())) { console.error('missing: '+m); process.exit(1); } }
console.log('spa markers ok')"` → `spa markers ok`.

### Step 5: pipeline CLIs + step doc + wiring

Create `lib/env.mjs`, `lib/publish-ui.mjs`, `lib/pull-ui.mjs` + their three test
files (node:test; fetch injected as a function argument, never global-patched;
temp-dir script.json fixtures). `steps/050-publish-ui/README.md`: env vars
(`VO_UI_URL`, `VO_UI_ADMIN_TOKEN` in `pipelines/.env`), run order
(`set-stage tts` → `run.sh <slug> publish [--drive-url]` → send the printed link
to the freelancer → later `run.sh <slug> pull`). `run.sh`: add `publish` and
`pull` verbs. `scripts/check.sh`: append the three test files. `PIPELINE.md`: add
an "Environment" section naming the two env vars.

**Verify**: `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` →
exit 0.

## Test plan

- Worker: vitest — policy (merge/caps/lock/respell), auth token, publish merge
  fixture; `tsc --noEmit` for types. No miniflare, no network.
- Pipeline: node:test — publish/pull CLIs against mock fetch + temp fixtures;
  env parser.
- SPA: marker check (Step 4 verify) + the rubric is re-checked by the human at
  first deploy.

## Done criteria

- [ ] `cd apps/tutorial-vo && npm install --no-audit --silent && npm run check` → exit 0.
- [ ] `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` → exit 0.
- [ ] Vitest proves: same-version publish preserves takes/lock/respell; version
      bump resets; locked→409; cap→429; respell guards.
- [ ] SPA marker check passes; all 8 rubric items present by inspection of the file.
- [ ] No wrangler command was executed against the Cloudflare account.

## STOP conditions

- Any command `wrangler deploy`, `wrangler secret`, `wrangler d1`, `wrangler r2`,
  or any live HTTP call to Modal/Telegram/Cloudflare — owner-only, post-merge.
- `pipelines/youtube/tutorial-pipeline-3/lib/state.mjs` missing (deps not landed).
- The app-side `npm install` fails on the `.npmrc` registry — report, do not
  change `.npmrc`.

## Maintenance notes

- Policy constants (TAKES_MAX, SPOKEN_MAX) exist in exactly one file (logic.ts);
  the Modal endpoint is deliberately policy-free (plan 131) — never add a second
  cap there.
- Publish merge rule mirrors `lib/state.mjs` rule 1. If the state machine
  changes, change both together (PIPELINE.md is the spec's single home).
- Owner deploy checklist lives in the app README (d1 create + migrate, r2
  create, 6 secrets, deploy, then INFRA.md + my-hosted-sites.md rows — owner
  does the doc rows at deploy time, deliberately out of executor scope).
- v2 (flag editing in the UI, per-section upload with instant intake QC) is a
  future plan; do not scaffold for it.
