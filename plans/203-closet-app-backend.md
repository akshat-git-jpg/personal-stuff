---
executor: agy
model:
test_cmd: cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [apps/closet-app/package.json, apps/closet-app/wrangler.toml, apps/closet-app/schema.sql, apps/closet-app/src/worker/index.ts, apps/closet-app/src/worker/auth.ts, apps/closet-app/src/worker/db.ts, apps/closet-app/scripts/smoke.sh, apps/closet-app/README.md, apps/closet-app/CLAUDE.md, apps/local-apps.md, plans/README.md]

mutation_apply: node -e "const f='apps/closet-app/src/worker/db.ts';const fs=require('fs');let s=fs.readFileSync(f,'utf8');const b='.bind(ev.prev_wears, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)';if(!s.includes(b))throw new Error('mutation anchor missing');s=s.replace(b,'.bind(ev.prev_wears + 1, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)');fs.writeFileSync(f,s)"
mutation_command: bash scripts/smoke.sh
mutation_expect: "SMOKE FAIL: wear-undo did not restore wears"
mutation_cwd: apps/closet-app
mutation_timeout: 600
---

# Plan 203: closet-app backend — schema, Worker API, photo store, smoke gate

## Summary

- **Problem statement**: The owner has no way to track how many times a garment
  has been worn since its last wash, and no catalogue of outfit photos. Nothing
  exists yet — `apps/` has no closet app.
- **Goals**:
  - Scaffold `apps/closet-app/` from `apps/lists-app` (same stack, same auth).
  - Ship the D1 schema: `clothes`, `looks`, `tags`, `item_tags`, `events`.
  - Ship the Hono Worker API: auth gate, `GET /api/state`, cloth + look CRUD,
    R2-backed photo upload/serve/delete, `wear` / `wash` / `undo`.
  - Ship `scripts/smoke.sh` — boots a real `wrangler dev` against local D1 + R2
    and exercises every route. This is the merge gate.
  - No UI in this plan. `index.html` renders a placeholder; plan 204 builds the SPA.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every schema, snippet and
  command is inlined below, which is `tooling/boss/data/rules.md`'s default row.
  Greenfield Worker apps are agy's proven sweet spot (LESSONS 2026-07-09, plan 054).
- **Done criteria** (terse — full list below): `npm ci && npm run build && npm test
  && bash scripts/smoke.sh` exits 0 from `apps/closet-app`; the mutation recipe
  above makes the smoke FAIL; no UI files beyond the placeholder.
- **Stop conditions** (terse — full list below): needing `wrangler login` or any
  remote Cloudflare resource; weakening a smoke assertion to get green; changing
  `apps/lists-app`.
- **Test / verification for success**: vitest unit tests over the auth gate and the
  pure tag/undo logic, plus `scripts/smoke.sh` — a real Worker on a real local D1
  and R2, asserted by curl. Routing bugs are invisible to pure-logic tests
  (LESSONS 2026-07-23 agy), so the smoke is mandatory, not optional.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cfa259f7..HEAD -- apps/closet-app apps/lists-app apps/local-apps.md`
> Expected: **empty** (`apps/closet-app` does not exist yet). If `apps/lists-app`
> has drifted, re-read the files this plan quotes before copying them.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW — a brand-new folder; nothing else depends on it yet
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cfa259f7`, 2026-08-17

## Why this matters

The owner re-wears jeans, hoodies, shirts and jackets several times before
washing them, and currently keeps the count in their head. The design was
brainstormed and approved on 2026-08-17. Two deliberate design decisions
shape this plan, and **the executor must not re-litigate them**:

1. **There is no wash limit and no threshold colour.** A garment shows a raw
   count. The owner decides when to wash by eye. Tiles sort highest-count-first
   so whatever needs washing surfaces on its own. Do not add a `wash_limit`
   column, a "needs wash" boolean, or red/green states.
2. **Looks are a plain gallery.** A look is a photo plus tags. There is **no**
   join between a look and the clothes in it, and no "I wore this look" action.
   The owner rejected that feature explicitly.

Intent, so a judgment call lands right: every tap must be cheap and reversible.
The owner logs a wear one-handed at night, so a mis-tap has to cost one more tap
to fix — that is why every mutation writes an `events` row and returns its id.

## Current state

`apps/closet-app` does not exist. The template is **`apps/lists-app`** — a
single-user, password-gated Vite + React 19 + Tailwind v4 SPA served by Hono on
a Cloudflare Worker, with D1 for data. Its layout:

```
apps/lists-app/
  index.html            SPA entry
  package.json          scripts + deps (quoted in Step 1)
  wrangler.toml         Worker + assets + D1 + custom domain
  schema.sql            idempotent CREATE TABLE IF NOT EXISTS
  vite.config.ts        react + tailwind plugins, /api + /auth proxy to :8787
  eslint.config.js
  tsconfig.json  tsconfig.app.json  tsconfig.node.json  tsconfig.worker.json
  .npmrc                registry=https://registry.npmjs.org/  (required — see below)
  .dev.vars.example
  src/worker/index.ts   Hono routes
  src/worker/auth.ts    HMAC signed-cookie password gate
  src/worker/db.ts      thin typed D1 helpers, no ORM
  src/client/*          React SPA
  test/auth.test.ts     vitest over app.request() with a mock env
```

**Conventions to imitate** (exemplar: `apps/lists-app/src/worker/db.ts` for data
access, `apps/lists-app/src/worker/index.ts` for routes):

- Thin typed helpers over `env.DB.prepare(...)`. **No ORM.** Explicit column
  lists in every SELECT.
- Ids are `crypto.randomUUID()`. Timestamps are `Date.now()` integers (ms).
- Multi-statement writes go through `env.DB.batch([...])`.
- Cascades are done by hand; foreign-key enforcement is not relied upon.
- Route handlers validate with a local `clean()` helper and return
  `c.json({ error: '...' }, 400)` on bad input.

**Auth guardrail — do NOT redesign.** `apps/lists-app/CLAUDE.md` states: the gate
is a stateless signed cookie (HMAC-SHA256 over an expiry, keyed by
`SESSION_SECRET`); replacing it with OAuth/KV/a DB lookup is forbidden
(`decisions.md` 2026-07-01). Copy `src/worker/auth.ts` verbatim and change only
what Step 4 says.

**R2 exemplar**: `apps/tutorial-vo` binds a bucket and uses it directly —
`await c.env.AUDIO.put(key, bytes)` / `c.env.AUDIO.get(key)`
(`apps/tutorial-vo/src/worker/index.ts:100,157,207`). Its `wrangler.toml` binds:

```toml
[[r2_buckets]]
binding = "AUDIO"
bucket_name = "tutorial-vo-audio"
```

**`.npmrc` is load-bearing.** The machine's global npm config points at a private
CodeArtifact registry; without a per-app `.npmrc` forcing the public registry,
`npm ci` fails with 401.

**Hono gotcha, already hit in this repo** (LESSONS 2026-07-23 agy):
`c.req.param()` returns `undefined` inside an `app.use('/api/*')` wildcard
middleware. `lists-app` therefore reads `c.req.path` there. Keep that shape.

**Local Cloudflare emulation is verified for this plan.** These were dry-run
against `apps/lists-app` on 2026-08-17 and all worked with **no `wrangler login`
and no cloud resources**:

- `npx wrangler d1 execute <db> --local --persist-to <dir> --file=./schema.sql`
  → `"success": true`.
- `npx wrangler dev --port 8799 --persist-to <dir> --var APP_PASSWORD:smokepw --var SESSION_SECRET:...`
  → serving in **3 seconds**; `--var` **overrides** any value in `.dev.vars`,
  so the smoke script never has to touch the owner's local secrets file.
- curl against it: `/api/me` → `{"authenticated":false}`; wrong password → `401`;
  correct password → `{"ok":true}` + cookie; authenticated POST created a row.

There is **no `--local` flag on `wrangler dev`** in wrangler 4 — local is the
default. `wrangler d1 execute` **does** need `--local`.

## Commands you will need

Run from `apps/closet-app` unless stated otherwise.

| Purpose | Command | Expected |
|---|---|---|
| Install | `npm ci` | exit 0 (after Step 1's `npm install` created the lockfile) |
| Typecheck | `npm run typecheck` | exit 0, no output |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0, writes `dist/` |
| Unit tests | `npm test` | exit 0, all tests pass |
| Local D1 schema | `npm run db:local` | JSON with `"success": true` |
| Full smoke (the gate) | `bash scripts/smoke.sh` | exit 0, last line `SMOKE OK` |
| Merge gate (repo root) | `cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh` | exit 0 |

## Scope

**In scope** — create these files under `apps/closet-app/`:

```
.gitignore  .npmrc  .dev.vars.example
package.json  package-lock.json  wrangler.toml  schema.sql
index.html  vite.config.ts  eslint.config.js
tsconfig.json  tsconfig.app.json  tsconfig.node.json  tsconfig.worker.json
src/main.tsx  src/client/globals.css        (placeholder only — plan 204 owns the SPA)
src/worker/index.ts  src/worker/auth.ts  src/worker/db.ts
test/auth.test.ts  test/logic.test.ts
scripts/smoke.sh
README.md  CLAUDE.md
```

Plus these two edits outside the app folder:

- `apps/local-apps.md` — add a `## closet (apps/closet-app)` run-notes section.
- `plans/README.md` — flip this plan's row to `DONE`.

**Out of scope** — looks related, do not touch:

- `apps/lists-app/**` — it is the template, read-only. Copying a file is fine;
  editing one is a STOP.
- **The React SPA.** Plan 204 builds every tab, tile, sheet and chip. This plan's
  `src/main.tsx` renders one `<h1>closet-app API online</h1>` placeholder and
  nothing more. Do not build UI "while you're in there".
- `INFRA.md`, `my-hosted-sites.md`, `decisions.md` — the owner updates these after
  the first real deploy, not at build time.
- Creating the remote D1 database, the remote R2 bucket, secrets, or the DNS
  record. All remote provisioning is the owner's deploy gate (README documents it).

## Git workflow

- Branch: `advisor/203-closet-app-backend`
- Commit per step, message `feat(closet-app): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold the app folder and dependencies

Create `apps/closet-app/` and copy these files **byte-for-byte** from
`apps/lists-app/`: `vite.config.ts`, `eslint.config.js`, `tsconfig.json`,
`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json`, `.npmrc`,
`.gitignore`.

Write `apps/closet-app/package.json`. Dependency versions are copied from
`apps/lists-app/package.json` (known-good on this machine); `@dnd-kit/*` and
`tailwind-merge` are dropped because nothing here drags or merges class strings:

```json
{
  "name": "closet-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run",
    "preview": "vite preview",
    "dev:api": "wrangler dev --port ${API_PORT:-8787}",
    "dev:web": "vite",
    "dev:local": "concurrently -k -n api,web -c blue,magenta \"npm:dev:api\" \"npm:dev:web\"",
    "db:local": "wrangler d1 execute closet-db --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute closet-db --remote --file=./schema.sql",
    "smoke": "bash scripts/smoke.sh",
    "deploy": "npm run build && wrangler deploy"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.2.5",
    "clsx": "^2.1.1",
    "hono": "^4.12.23",
    "lucide-react": "^1.22.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260529.1",
    "@eslint/js": "^10.0.1",
    "@tailwindcss/vite": "^4.3.2",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "concurrently": "^10.0.3",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "tailwindcss": "^4.3.2",
    "tw-animate-css": "^1.4.0",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12",
    "vitest": "^4.1.9",
    "wrangler": "^4.95.0"
  }
}
```

Write `apps/closet-app/.dev.vars.example`:

```
# Copy to .dev.vars (gitignored) for local dev. Never commit .dev.vars.
APP_PASSWORD=change-me
SESSION_SECRET=at-least-32-random-characters-goes-here
```

Write `apps/closet-app/index.html` (mobile-first; plan 204 adds the PWA manifest
tags, so keep this minimal):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Closet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write the placeholder `src/main.tsx` and `src/client/globals.css`:

```tsx
// src/main.tsx — placeholder. Plan 204 replaces this with the real SPA.
import { createRoot } from 'react-dom/client'
import './client/globals.css'

createRoot(document.getElementById('root')!).render(<h1>closet-app API online</h1>)
```

```css
/* src/client/globals.css */
@import 'tailwindcss';
```

Then `cd apps/closet-app && npm install` (creates `package-lock.json` — commit it).

**Verify**: `cd apps/closet-app && npm run build` → exit 0 and `dist/index.html` exists.

### Step 2: Write the schema

Write `apps/closet-app/schema.sql` exactly as below. It is idempotent, matching
`apps/lists-app/schema.sql`'s style.

Note what is **absent on purpose**: no `wash_limit`, no `needs_wash`, no
`look_clothes` join table. See "Why this matters".

```sql
-- closet-app schema. Idempotent — safe to re-run.
--
-- No wash limit and no threshold flag: a garment carries a raw wear count and
-- the owner decides when to wash it (design decision, 2026-08-17).
-- `looks` is a plain tagged gallery — it deliberately has NO link to `clothes`.

CREATE TABLE IF NOT EXISTS clothes (
  id             TEXT    PRIMARY KEY,
  name           TEXT    NOT NULL,
  photo_key      TEXT,                       -- R2 object key, NULL until a photo is set
  wears          INTEGER NOT NULL DEFAULT 0, -- wears since the last wash
  last_worn_at   INTEGER,                    -- ms epoch, NULL if never worn
  last_washed_at INTEGER,                    -- ms epoch, NULL if never washed
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS looks (
  id         TEXT    PRIMARY KEY,
  name       TEXT,                           -- optional; a look may be photo + tags only
  photo_key  TEXT,
  created_at INTEGER NOT NULL
);

-- One shared tag vocabulary across BOTH tabs. `name` is normalised
-- (trimmed, lowercased, inner whitespace collapsed) before it is stored.
CREATE TABLE IF NOT EXISTS tags (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Many-to-many: one photo can carry any number of tags.
CREATE TABLE IF NOT EXISTS item_tags (
  item_type TEXT NOT NULL,                   -- 'cloth' | 'look'
  item_id   TEXT NOT NULL,
  tag_id    TEXT NOT NULL,
  PRIMARY KEY (item_type, item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);

-- Append-only-ish log of wear/wash taps. This is what powers Undo:
-- `prev_wears` is the count BEFORE the event, so reversing it is exact
-- (a wash-undo restores the real number instead of guessing).
CREATE TABLE IF NOT EXISTS events (
  id         TEXT    PRIMARY KEY,
  cloth_id   TEXT    NOT NULL,
  type       TEXT    NOT NULL,               -- 'wear' | 'wash'
  prev_wears INTEGER NOT NULL,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_cloth ON events(cloth_id, at);
```

**Verify**: `cd apps/closet-app && npm run db:local` → JSON containing `"success": true`.

### Step 3: Write `wrangler.toml`

The `database_id` below is a **placeholder**. `apps/lists-app/wrangler.toml`'s own
comment confirms a placeholder is fine for `--local` dev, and everything this plan
verifies is local. The owner swaps in the real id at deploy time (Step 9's README).

```toml
name = "closet-app"
main = "src/worker/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

# SPA built into dist/, served by the Worker via the ASSETS binding.
[assets]
directory = "./dist"
binding = "ASSETS"

# Clothes, looks, tags, events. The owner replaces database_id with the real one
# from `npx wrangler d1 create closet-db` before the first remote deploy;
# a placeholder is correct for `--local` dev and for the smoke gate.
[[d1_databases]]
binding = "DB"
database_name = "closet-db"
database_id = "00000000-0000-0000-0000-000000000000"

# Garment + outfit thumbnails. Owner creates with
# `npx wrangler r2 bucket create closet-photos`.
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "closet-photos"

[[routes]]
pattern = "closet.agrolloo.com"
custom_domain = true

# APP_PASSWORD + SESSION_SECRET are secrets (never committed):
#   npx wrangler secret put APP_PASSWORD
#   npx wrangler secret put SESSION_SECRET
```

**Verify**: `cd apps/closet-app && npx wrangler d1 execute closet-db --local --file=./schema.sql`
→ `"success": true` (proves the toml parses and the binding resolves).

### Step 4: Copy the auth gate

Copy `apps/lists-app/src/worker/auth.ts` to `apps/closet-app/src/worker/auth.ts`
and make exactly **three** edits. Change nothing else — the HMAC scheme,
`safeEqual`, the hash-both-sides login compare and the 30-day TTL are all
deliberate.

1. `const COOKIE_NAME = 'lists_session'` → `const COOKIE_NAME = 'closet_session'`
2. Add the R2 binding to `Env`:

```ts
export type Env = {
  DB: D1Database
  PHOTOS: R2Bucket
  ASSETS: Fetcher
  APP_PASSWORD: string
  SESSION_SECRET: string
}
```

3. Update the file's header comment to say `closet-app`.

**Verify**: `cd apps/closet-app && grep -c "closet_session" src/worker/auth.ts` → `1`,
and `grep -c "lists_session" src/worker/auth.ts` → `0`.

### Step 5: Write `src/worker/db.ts`

This step contains the plan's load-bearing logic. **Use these snippets as
written** — the tag-resolution race handling and the `prev_wears` undo are the
two places a re-derivation would go subtly wrong.

```ts
/**
 * db.ts
 * D1 data access for clothes, looks, tags and the wear/wash event log.
 * Thin, typed helpers — no ORM. Follows apps/lists-app/src/worker/db.ts.
 */

import type { Env } from './auth'

export interface Cloth {
  id: string
  name: string
  photo_key: string | null
  wears: number
  last_worn_at: number | null
  last_washed_at: number | null
  created_at: number
}

export interface Look {
  id: string
  name: string | null
  photo_key: string | null
  created_at: number
}

export interface Tag {
  id: string
  name: string
  created_at: number
}

export interface ItemTag {
  item_type: 'cloth' | 'look'
  item_id: string
  tag_id: string
}

export interface ClothEvent {
  id: string
  cloth_id: string
  type: 'wear' | 'wash'
  prev_wears: number
  at: number
}

export interface AppState {
  clothes: Cloth[]
  looks: Look[]
  tags: Tag[]
  item_tags: ItemTag[]
}

const CLOTH_COLS = 'id, name, photo_key, wears, last_worn_at, last_washed_at, created_at'
const LOOK_COLS = 'id, name, photo_key, created_at'

/**
 * The whole app state in one round trip. The owner has tens of items, not
 * thousands, so tag filtering happens in the browser — the same call the
 * lists-app makes ("Search filters items already loaded in the browser").
 * Clothes come back highest-count-first, which is the order the UI shows.
 */
export async function getState(env: Env): Promise<AppState> {
  const [clothes, looks, tags, itemTags] = await Promise.all([
    env.DB.prepare(`SELECT ${CLOTH_COLS} FROM clothes ORDER BY wears DESC, name COLLATE NOCASE`).all<Cloth>(),
    env.DB.prepare(`SELECT ${LOOK_COLS} FROM looks ORDER BY created_at DESC`).all<Look>(),
    env.DB.prepare('SELECT id, name, created_at FROM tags ORDER BY name').all<Tag>(),
    env.DB.prepare('SELECT item_type, item_id, tag_id FROM item_tags').all<ItemTag>(),
  ])
  return {
    clothes: clothes.results ?? [],
    looks: looks.results ?? [],
    tags: tags.results ?? [],
    item_tags: itemTags.results ?? [],
  }
}

export function getCloth(env: Env, id: string): Promise<Cloth | null> {
  return env.DB.prepare(`SELECT ${CLOTH_COLS} FROM clothes WHERE id = ?`).bind(id).first<Cloth>()
}

export function getLook(env: Env, id: string): Promise<Look | null> {
  return env.DB.prepare(`SELECT ${LOOK_COLS} FROM looks WHERE id = ?`).bind(id).first<Look>()
}

// ── Tags ───────────────────────────────────────────────────────────────────

/**
 * Canonical tag spelling. One vocabulary is shared across both tabs, so
 * "Office ", "office" and "OFFICE" must land on ONE row or the chip list
 * grows duplicates that filter differently.
 */
export function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Map raw tag strings to tag ids, creating the ones that don't exist yet.
 * Two D1 reads on purpose: INSERT OR IGNORE can lose a race with a concurrent
 * request, so the table is re-read afterwards instead of trusting the ids we
 * generated. Returns ids in the caller's (de-duplicated) order.
 */
export async function resolveTagIds(env: Env, raw: string[]): Promise<string[]> {
  const names = [...new Set(raw.map(normaliseTag).filter((n) => n.length > 0))]
  if (names.length === 0) return []

  const holes = names.map(() => '?').join(',')
  const read = () =>
    env.DB.prepare(`SELECT id, name FROM tags WHERE name IN (${holes})`)
      .bind(...names)
      .all<{ id: string; name: string }>()

  const found = await read()
  const byName = new Map((found.results ?? []).map((r) => [r.name, r.id]))
  const missing = names.filter((n) => !byName.has(n))

  if (missing.length > 0) {
    const now = Date.now()
    await env.DB.batch(
      missing.map((name) =>
        env.DB.prepare('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)')
          .bind(crypto.randomUUID(), name, now),
      ),
    )
    const after = await read()
    for (const r of after.results ?? []) byName.set(r.name, r.id)
  }

  return names.map((n) => byName.get(n)).filter((id): id is string => typeof id === 'string')
}

/** Replace an item's tag set with exactly `tagIds`. */
export async function setItemTags(
  env: Env,
  itemType: 'cloth' | 'look',
  itemId: string,
  tagIds: string[],
): Promise<void> {
  const stmts = [
    env.DB.prepare('DELETE FROM item_tags WHERE item_type = ? AND item_id = ?').bind(itemType, itemId),
    ...tagIds.map((tagId) =>
      env.DB.prepare('INSERT OR IGNORE INTO item_tags (item_type, item_id, tag_id) VALUES (?, ?, ?)')
        .bind(itemType, itemId, tagId),
    ),
  ]
  await env.DB.batch(stmts)
}

/**
 * Drop tags nothing references any more. Called after every tag-set change and
 * every delete, so the chip row only ever shows tags that can actually filter
 * something.
 */
export async function pruneOrphanTags(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM item_tags)').run()
}

// ── Clothes ────────────────────────────────────────────────────────────────

export async function createCloth(
  env: Env,
  name: string,
  photoKey: string | null,
  tagIds: string[],
): Promise<Cloth> {
  const cloth: Cloth = {
    id: crypto.randomUUID(),
    name,
    photo_key: photoKey,
    wears: 0,
    last_worn_at: null,
    last_washed_at: null,
    created_at: Date.now(),
  }
  await env.DB.prepare(
    'INSERT INTO clothes (id, name, photo_key, wears, last_worn_at, last_washed_at, created_at) VALUES (?, ?, ?, 0, NULL, NULL, ?)',
  )
    .bind(cloth.id, cloth.name, cloth.photo_key, cloth.created_at)
    .run()
  await setItemTags(env, 'cloth', cloth.id, tagIds)
  return cloth
}

/**
 * Patch a cloth. Only the fields present in `patch` change — `undefined` means
 * "leave it alone", which is why photo_key uses a two-state check (a caller CAN
 * send null to clear the photo).
 */
export async function updateCloth(
  env: Env,
  id: string,
  patch: { name?: string; photo_key?: string | null; tagIds?: string[] },
): Promise<Cloth | null> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE clothes SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.photo_key !== undefined) {
    await env.DB.prepare('UPDATE clothes SET photo_key = ? WHERE id = ?').bind(patch.photo_key, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'cloth', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  return getCloth(env, id)
}

export async function deleteCloth(env: Env, id: string): Promise<void> {
  // Cascade by hand — FK enforcement isn't relied upon (same as lists-app).
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE cloth_id = ?').bind(id),
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'cloth' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM clothes WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
}

// ── Wear / wash / undo ─────────────────────────────────────────────────────

async function record(
  env: Env,
  clothId: string,
  type: 'wear' | 'wash',
): Promise<{ cloth: Cloth; event_id: string } | null> {
  const cur = await env.DB.prepare('SELECT wears FROM clothes WHERE id = ?').bind(clothId).first<{ wears: number }>()
  if (!cur) return null

  const now = Date.now()
  const eventId = crypto.randomUUID()
  const update =
    type === 'wear'
      ? env.DB.prepare('UPDATE clothes SET wears = wears + 1, last_worn_at = ? WHERE id = ?').bind(now, clothId)
      : env.DB.prepare('UPDATE clothes SET wears = 0, last_washed_at = ? WHERE id = ?').bind(now, clothId)

  await env.DB.batch([
    env.DB.prepare('INSERT INTO events (id, cloth_id, type, prev_wears, at) VALUES (?, ?, ?, ?, ?)')
      .bind(eventId, clothId, type, cur.wears, now),
    update,
  ])

  const cloth = await getCloth(env, clothId)
  return cloth ? { cloth, event_id: eventId } : null
}

export const recordWear = (env: Env, clothId: string) => record(env, clothId, 'wear')
export const recordWash = (env: Env, clothId: string) => record(env, clothId, 'wash')

/**
 * Reverse one event and delete it.
 *
 * `prev_wears` (the count BEFORE the event) makes this exact for both kinds:
 * a wash-undo restores the real number rather than guessing. Timestamps are
 * re-derived from the events that REMAIN, so undoing the only wear leaves
 * last_worn_at NULL instead of a stale time. A mis-tap should vanish from
 * history, so the row is hard-deleted rather than flagged.
 */
export async function undoEvent(env: Env, eventId: string): Promise<Cloth | null> {
  const ev = await env.DB.prepare('SELECT id, cloth_id, type, prev_wears, at FROM events WHERE id = ?')
    .bind(eventId)
    .first<ClothEvent>()
  if (!ev) return null

  await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run()

  const lastWorn = await env.DB
    .prepare("SELECT MAX(at) AS at FROM events WHERE cloth_id = ? AND type = 'wear'")
    .bind(ev.cloth_id)
    .first<{ at: number | null }>()
  const lastWashed = await env.DB
    .prepare("SELECT MAX(at) AS at FROM events WHERE cloth_id = ? AND type = 'wash'")
    .bind(ev.cloth_id)
    .first<{ at: number | null }>()

  await env.DB.prepare('UPDATE clothes SET wears = ?, last_worn_at = ?, last_washed_at = ? WHERE id = ?')
    .bind(ev.prev_wears, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)
    .run()

  return getCloth(env, ev.cloth_id)
}

// ── Looks ──────────────────────────────────────────────────────────────────

export async function createLook(
  env: Env,
  name: string | null,
  photoKey: string | null,
  tagIds: string[],
): Promise<Look> {
  const look: Look = { id: crypto.randomUUID(), name, photo_key: photoKey, created_at: Date.now() }
  await env.DB.prepare('INSERT INTO looks (id, name, photo_key, created_at) VALUES (?, ?, ?, ?)')
    .bind(look.id, look.name, look.photo_key, look.created_at)
    .run()
  await setItemTags(env, 'look', look.id, tagIds)
  return look
}

export async function updateLook(
  env: Env,
  id: string,
  patch: { name?: string | null; photo_key?: string | null; tagIds?: string[] },
): Promise<Look | null> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE looks SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.photo_key !== undefined) {
    await env.DB.prepare('UPDATE looks SET photo_key = ? WHERE id = ?').bind(patch.photo_key, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'look', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  return getLook(env, id)
}

export async function deleteLook(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'look' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM looks WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
}
```

**Verify**: `cd apps/closet-app && npm run typecheck` → exit 0.

### Step 6: Write `src/worker/index.ts`

Endpoint contract — implement exactly this surface:

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/login` | no | `{password}` → `{ok:true}` + cookie, or `401 {error}` |
| POST | `/auth/logout` | no | → `{ok:true}` |
| GET | `/api/me` | no | → `{authenticated:boolean}` |
| GET | `/api/state` | yes | → `{clothes,looks,tags,item_tags}` |
| POST | `/api/photos` | yes | raw image bytes → `201 {key}` |
| GET | `/api/photos/:key` | yes | → image bytes, or `404` |
| POST | `/api/clothes` | yes | `{name,tags?,photo_key?}` → `201` Cloth |
| PATCH | `/api/clothes/:id` | yes | `{name?,tags?,photo_key?}` → Cloth, or `404` |
| DELETE | `/api/clothes/:id` | yes | → `{ok:true}` |
| POST | `/api/clothes/:id/wear` | yes | → `{cloth,event_id}`, or `404` |
| POST | `/api/clothes/:id/wash` | yes | → `{cloth,event_id}`, or `404` |
| POST | `/api/events/:id/undo` | yes | → `{cloth}`, or `404` |
| POST | `/api/looks` | yes | `{name?,tags?,photo_key?}` → `201` Look |
| PATCH | `/api/looks/:id` | yes | `{name?,tags?,photo_key?}` → Look, or `404` |
| DELETE | `/api/looks/:id` | yes | → `{ok:true}` |
| GET | `*` | no | SPA via `ASSETS` |

Rules the code must encode:

- `tags` in a request body is an **array of raw strings**, not ids. The Worker
  normalises and resolves them (`resolveTagIds`). The client never sees tag ids
  when writing, only when reading `/api/state`.
- Photo upload cap: **400 KB**. The client downscales before sending (plan 204),
  so anything larger is a bug or a bad actor → `413`.
- Replacing or clearing a photo, and deleting an item, must **delete the old R2
  object**. Orphan objects cost money and never get cleaned up otherwise.
- `/api/photos/:key` sets `Cache-Control: public, max-age=31536000, immutable` —
  keys are UUIDs, so an object never changes under a key.
- The wildcard auth middleware reads `c.req.path`, **not** `c.req.param()`
  (LESSONS 2026-07-23 agy: the param is `undefined` there).

```ts
/**
 * index.ts
 * Hono entry-point for the closet-app Worker. Route table lives in
 * plans/203-closet-app-backend.md; see that plan before adding an endpoint.
 */

import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import * as db from './db'

const app = new Hono<{ Bindings: Env }>()

const MAX_PHOTO_BYTES = 400 * 1024

// ── Auth ───────────────────────────────────────────────────────────────────
app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)

// Everything under /api except /api/me needs a valid session.
// NOTE: c.req.param() is undefined inside a wildcard middleware — use c.req.path.
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const tagList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [])

app.get('/api/state', async (c) => c.json(await db.getState(c.env)))

// ── Photos (R2) ────────────────────────────────────────────────────────────

app.post('/api/photos', async (c) => {
  const type = c.req.header('content-type') ?? ''
  if (!type.startsWith('image/')) return c.json({ error: 'Expected an image body' }, 415)

  const body = await c.req.arrayBuffer()
  if (body.byteLength === 0) return c.json({ error: 'Empty body' }, 400)
  if (body.byteLength > MAX_PHOTO_BYTES) return c.json({ error: 'Photo too large' }, 413)

  const key = `${crypto.randomUUID()}.jpg`
  await c.env.PHOTOS.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } })
  return c.json({ key }, 201)
})

app.get('/api/photos/:key', async (c) => {
  const object = await c.env.PHOTOS.get(c.req.param('key'))
  if (!object) return c.json({ error: 'Not found' }, 404)
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

/** Drop an R2 object we are about to stop referencing. Never throws. */
async function dropPhoto(c: { env: Env }, key: string | null | undefined): Promise<void> {
  if (!key) return
  await c.env.PHOTOS.delete(key).catch(() => undefined)
}

// ── Clothes ────────────────────────────────────────────────────────────────

app.post('/api/clothes', async (c) => {
  const body = await c.req.json<{ name?: string; tags?: unknown; photo_key?: string }>().catch(() => ({}))
  const name = clean(body.name)
  if (!name) return c.json({ error: 'Name is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  return c.json(await db.createCloth(c.env, name, clean(body.photo_key) || null, tagIds), 201)
})

app.patch('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getCloth(c.env, id)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req
    .json<{ name?: string; tags?: unknown; photo_key?: string | null }>()
    .catch(() => ({}) as { name?: string; tags?: unknown; photo_key?: string | null })

  const patch: { name?: string; photo_key?: string | null; tagIds?: string[] } = {}

  if (body.name !== undefined) {
    const name = clean(body.name)
    if (!name) return c.json({ error: 'Name is required' }, 400)
    patch.name = name
  }
  if (body.photo_key !== undefined) {
    const next = body.photo_key === null ? null : clean(body.photo_key) || null
    if (next !== existing.photo_key) await dropPhoto(c, existing.photo_key)
    patch.photo_key = next
  }
  if (body.tags !== undefined) {
    patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  }

  return c.json(await db.updateCloth(c.env, id, patch))
})

app.delete('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getCloth(c.env, id)
  if (existing) {
    await dropPhoto(c, existing.photo_key)
    await db.deleteCloth(c.env, id)
  }
  return c.json({ ok: true })
})

app.post('/api/clothes/:id/wear', async (c) => {
  const res = await db.recordWear(c.env, c.req.param('id'))
  return res ? c.json(res) : c.json({ error: 'Not found' }, 404)
})

app.post('/api/clothes/:id/wash', async (c) => {
  const res = await db.recordWash(c.env, c.req.param('id'))
  return res ? c.json(res) : c.json({ error: 'Not found' }, 404)
})

app.post('/api/events/:id/undo', async (c) => {
  const cloth = await db.undoEvent(c.env, c.req.param('id'))
  return cloth ? c.json({ cloth }) : c.json({ error: 'Not found' }, 404)
})

// ── Looks ──────────────────────────────────────────────────────────────────

app.post('/api/looks', async (c) => {
  const body = await c.req.json<{ name?: string; tags?: unknown; photo_key?: string }>().catch(() => ({}))
  const photoKey = clean(body.photo_key) || null
  if (!photoKey) return c.json({ error: 'photo_key is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  return c.json(await db.createLook(c.env, clean(body.name) || null, photoKey, tagIds), 201)
})

app.patch('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getLook(c.env, id)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req
    .json<{ name?: string | null; tags?: unknown; photo_key?: string }>()
    .catch(() => ({}) as { name?: string | null; tags?: unknown; photo_key?: string })

  const patch: { name?: string | null; photo_key?: string | null; tagIds?: string[] } = {}
  if (body.name !== undefined) patch.name = body.name === null ? null : clean(body.name) || null
  if (body.photo_key !== undefined) {
    const next = clean(body.photo_key) || null
    if (next && next !== existing.photo_key) {
      await dropPhoto(c, existing.photo_key)
      patch.photo_key = next
    }
  }
  if (body.tags !== undefined) patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))

  return c.json(await db.updateLook(c.env, id, patch))
})

app.delete('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getLook(c.env, id)
  if (existing) {
    await dropPhoto(c, existing.photo_key)
    await db.deleteLook(c.env, id)
  }
  return c.json({ ok: true })
})

// ── SPA fallback ───────────────────────────────────────────────────────────
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
```

**Verify**: `cd apps/closet-app && npm run typecheck && npm run lint` → both exit 0.

### Step 7: Write the vitest tests

`test/auth.test.ts` — copy `apps/lists-app/test/auth.test.ts` and make these
changes: cookie name `closet_session`, add `PHOTOS: {} as unknown as R2Bucket` to
`ENV`, and point the unauthorised check at `/api/state`. Keep all four cases
(wrong password 401, correct password sets cookie + `/api/me` true, `/api/state`
401 without cookie, `/api/me` false when anonymous).

`test/logic.test.ts` — new, pure-function coverage of `normaliseTag`. This is
where tag-vocabulary drift would show up first:

```ts
import { describe, it, expect } from 'vitest'
import { normaliseTag } from '../src/worker/db'

describe('normaliseTag', () => {
  it('folds case, trims and collapses inner whitespace', () => {
    expect(normaliseTag('  Office ')).toBe('office')
    expect(normaliseTag('OFFICE')).toBe('office')
    expect(normaliseTag('smart   casual')).toBe('smart casual')
  })

  it('maps every spelling of one tag to a single key', () => {
    const spellings = ['Office', 'office', ' OFFICE ', 'oFFice']
    expect(new Set(spellings.map(normaliseTag)).size).toBe(1)
  })

  it('yields an empty string for whitespace-only input, so callers can drop it', () => {
    expect(normaliseTag('   ')).toBe('')
  })
})
```

**Verify**: `cd apps/closet-app && npm test` → exit 0, 7 tests pass.

### Step 8: Write `scripts/smoke.sh` — the merge gate

This is the only check that sees routing, D1 and R2 together. Pure-logic vitest
cannot catch a Worker routing bug (LESSONS 2026-07-23 agy), so this script is the
real gate. It was designed against a verified dry-run — the mechanism is known to
work (see "Current state").

Non-obvious requirements, all satisfied below:

- **Never touch the owner's `.dev.vars`.** Pass secrets with `--var`, which was
  verified to override `.dev.vars`.
- **Never delete the owner's `.wrangler/state`.** Use a `mktemp -d` persist dir,
  which also guarantees a clean DB per run.
- **Kill the server even on failure.** A `trap` on `EXIT`, or a failed assertion
  leaves a `wrangler dev` alive forever and the failure invisible
  (LESSONS 2026-07-31: exactly this hung a whole suite at 0% CPU).
- **No `jq` dependency.** JSON is read with a small `node -e` helper.
- **One distinct `SMOKE FAIL:` string per assertion**, so `mutation_expect` can
  name the exact one it needs.

```bash
#!/usr/bin/env bash
#
# smoke.sh — boot a real `wrangler dev` against a throwaway local D1 + R2 and
# exercise every route. This is closet-app's merge gate: unit tests cannot see
# routing, D1 or R2 (LESSONS 2026-07-23).
#
# Safe to run while the owner has their own dev server going:
#   - secrets come from --var, so .dev.vars is never read or written
#   - state lives in a mktemp dir, so .wrangler/state is never deleted
#   - SMOKE_PORT overrides the port if 8799 is taken
#
# Usage: bash scripts/smoke.sh
set -uo pipefail

cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-8799}"
BASE="http://127.0.0.1:${PORT}"
PW="smoke-password"
SECRET="smoke-secret-at-least-32-characters-long"

STATE="$(mktemp -d)"
LOG="$(mktemp)"
JAR="$(mktemp)"
IMG="$(mktemp)"
PID=""

cleanup() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f "$LOG" "$JAR" "$IMG" 2>/dev/null || true
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*"
  echo "--- last 40 lines of wrangler output ---"
  tail -40 "$LOG" 2>/dev/null
  exit 1
}

# Read a top-level JSON field from stdin without needing jq.
jget() {
  node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const o = JSON.parse(s)
        const v = process.argv[1].split(".").reduce((a, k) => (a == null ? a : a[k]), o)
        process.stdout.write(v === undefined || v === null ? "" : String(v))
      } catch {
        process.stdout.write("")
      }
    })
  ' "$1"
}

# ── Fresh local database ────────────────────────────────────────────────────
npx wrangler d1 execute closet-db --local --persist-to "$STATE" --file=./schema.sql >"$LOG" 2>&1 \
  || fail "could not apply schema.sql to the local D1"

# ── Boot the Worker ────────────────────────────────────────────────────────
npx wrangler dev --port "$PORT" --persist-to "$STATE" \
  --var "APP_PASSWORD:${PW}" --var "SESSION_SECRET:${SECRET}" >"$LOG" 2>&1 &
PID=$!

UP=0
for _ in $(seq 1 90); do
  if curl -fsS "${BASE}/api/me" >/dev/null 2>&1; then UP=1; break; fi
  kill -0 "$PID" 2>/dev/null || fail "wrangler dev exited during startup"
  sleep 1
done
[ "$UP" = 1 ] || fail "server never came up on port ${PORT}"

# ── Auth gate ──────────────────────────────────────────────────────────────
[ "$(curl -sS "${BASE}/api/me" | jget authenticated)" = "false" ] \
  || fail "/api/me should report false before login"

CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' -d '{"password":"definitely-wrong"}')"
[ "$CODE" = "401" ] || fail "bad password was not rejected (got ${CODE})"

CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/state")"
[ "$CODE" = "401" ] || fail "unauthenticated /api/state was not 401 (got ${CODE})"

curl -fsS -c "$JAR" -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PW}\"}" >/dev/null \
  || fail "login with the correct password failed"

AUTH=(-b "$JAR")

# ── Photo upload + serve (R2) ──────────────────────────────────────────────
# 1x1 pixel JPEG, base64-decoded to a real file so curl sends real bytes.
printf '%s' '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICAkKDA8MCgsOCQgIDRENDg8QEBEQCgwSExIQEBD/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/2gAIAQEAAD8AS//Z' \
  | base64 --decode > "$IMG" 2>/dev/null || fail "could not build the test JPEG"

KEY="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/photos" \
  -H 'Content-Type: image/jpeg' --data-binary "@${IMG}" | jget key)"
[ -n "$KEY" ] || fail "photo upload returned no key"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY}")"
[ "$CODE" = "200" ] || fail "photo serve did not return 200 (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/nope.jpg")"
[ "$CODE" = "404" ] || fail "missing photo did not 404 (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/photos" \
  -H 'Content-Type: application/json' -d '{}')"
[ "$CODE" = "415" ] || fail "non-image photo upload was not rejected (got ${CODE})"

# A second key, so the cloth and the look never share one R2 object. Sharing a
# key would make the "delete removed the photo" assertion below ambiguous.
KEY2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/photos" \
  -H 'Content-Type: image/jpeg' --data-binary "@${IMG}" | jget key)"
[ -n "$KEY2" ] || fail "second photo upload returned no key"
[ "$KEY2" != "$KEY" ] || fail "two uploads returned the same key — keys must be unique"

# ── Cloth CRUD ─────────────────────────────────────────────────────────────
CLOTH="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Blue jeans\",\"tags\":[\"Jeans\",\" casual \"],\"photo_key\":\"${KEY}\"}")"
CID="$(printf '%s' "$CLOTH" | jget id)"
[ -n "$CID" ] || fail "cloth create returned no id"
[ "$(printf '%s' "$CLOTH" | jget wears)" = "0" ] || fail "a new cloth should start at 0 wears"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/clothes" \
  -H 'Content-Type: application/json' -d '{"name":"   "}')"
[ "$CODE" = "400" ] || fail "a blank cloth name was accepted (got ${CODE})"

# ── Wear, then undo the wear ───────────────────────────────────────────────
W1="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$(printf '%s' "$W1" | jget cloth.wears)" = "1" ] || fail "wear did not increment to 1"
EV1="$(printf '%s' "$W1" | jget event_id)"
[ -n "$EV1" ] || fail "wear returned no event_id, so Undo is impossible"

W2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$(printf '%s' "$W2" | jget cloth.wears)" = "2" ] || fail "second wear did not increment to 2"
EV2="$(printf '%s' "$W2" | jget event_id)"

U1="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EV2}/undo")"
[ "$(printf '%s' "$U1" | jget cloth.wears)" = "1" ] \
  || fail "wear-undo did not restore wears (wanted 1, got $(printf '%s' "$U1" | jget cloth.wears))"

U2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EV1}/undo")"
[ "$(printf '%s' "$U2" | jget cloth.wears)" = "0" ] \
  || fail "wear-undo did not restore wears (wanted 0, got $(printf '%s' "$U2" | jget cloth.wears))"
[ -z "$(printf '%s' "$U2" | jget cloth.last_worn_at)" ] \
  || fail "undoing the only wear left a stale last_worn_at"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/events/${EV1}/undo")"
[ "$CODE" = "404" ] || fail "undoing an already-undone event was not 404 (got ${CODE})"

# ── Wash, then undo the wash ───────────────────────────────────────────────
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null

WASH="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wash")"
[ "$(printf '%s' "$WASH" | jget cloth.wears)" = "0" ] || fail "wash did not reset wears to 0"
EVW="$(printf '%s' "$WASH" | jget event_id)"

UW="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EVW}/undo")"
[ "$(printf '%s' "$UW" | jget cloth.wears)" = "3" ] \
  || fail "wash-undo did not restore the exact count (wanted 3, got $(printf '%s' "$UW" | jget cloth.wears))"

# ── Looks + the shared tag vocabulary ──────────────────────────────────────
LOOK="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/looks" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Friday office\",\"tags\":[\"Office\",\"CASUAL\",\"winter\"],\"photo_key\":\"${KEY2}\"}")"
LID="$(printf '%s' "$LOOK" | jget id)"
[ -n "$LID" ] || fail "look create returned no id"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/looks" \
  -H 'Content-Type: application/json' -d '{"name":"no photo"}')"
[ "$CODE" = "400" ] || fail "a look without photo_key was accepted (got ${CODE})"

STATE_JSON="$(curl -sS "${AUTH[@]}" "${BASE}/api/state")"

# "casual" was typed as " casual " on the cloth and "CASUAL" on the look.
# One shared, normalised vocabulary means that is ONE tag row used twice.
printf '%s' "$STATE_JSON" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    const names = st.tags.map((t) => t.name).sort()
    const casual = st.tags.filter((t) => t.name === "casual")
    if (casual.length !== 1) {
      console.error(`expected exactly one "casual" tag, got ${casual.length}: ${JSON.stringify(names)}`)
      process.exit(1)
    }
    const id = casual[0].id
    const types = st.item_tags.filter((r) => r.tag_id === id).map((r) => r.item_type).sort()
    if (JSON.stringify(types) !== JSON.stringify(["cloth", "look"])) {
      console.error(`"casual" should be attached to one cloth and one look, got ${JSON.stringify(types)}`)
      process.exit(1)
    }
    const upper = st.tags.filter((t) => t.name !== t.name.trim().toLowerCase())
    if (upper.length > 0) {
      console.error(`tags are not normalised: ${JSON.stringify(upper)}`)
      process.exit(1)
    }
  })
' || fail "tag vocabulary is not shared and normalised across both tabs"

# Multi-tag: the look carries three tags at once.
COUNT="$(printf '%s' "$STATE_JSON" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    const look = st.looks[0]
    process.stdout.write(String(st.item_tags.filter((r) => r.item_type === "look" && r.item_id === look.id).length))
  })
')"
[ "$COUNT" = "3" ] || fail "look should carry 3 tags, carries ${COUNT}"

# Clothes come back highest-count-first — that ordering IS the wash cue.
curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes" -H 'Content-Type: application/json' \
  -d '{"name":"Grey hoodie","tags":["hoodie"]}' >/dev/null
ORDER="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(st.clothes.map((c) => `${c.name}:${c.wears}`).join(","))
  })
')"
[ "$ORDER" = "Blue jeans:3,Grey hoodie:0" ] \
  || fail "clothes are not ordered highest-wears-first (got ${ORDER})"

# ── Tag pruning ────────────────────────────────────────────────────────────
curl -fsS "${AUTH[@]}" -X PATCH "${BASE}/api/looks/${LID}" -H 'Content-Type: application/json' \
  -d '{"tags":["office"]}' >/dev/null
LEFT="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(st.tags.map((t) => t.name).sort().join(","))
  })
')"
# "winter" was only ever on that look, so it is gone. "casual" survives on the cloth.
[ "$LEFT" = "casual,hoodie,jeans,office" ] || fail "orphan tag was not pruned (tags left: ${LEFT})"

# ── Delete cascades, including the R2 object ───────────────────────────────
curl -fsS "${AUTH[@]}" -X DELETE "${BASE}/api/clothes/${CID}" >/dev/null
CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$CODE" = "404" ] || fail "a deleted cloth still accepts a wear (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY}")"
[ "$CODE" = "404" ] || fail "deleting a cloth left its R2 photo behind (got ${CODE})"

curl -fsS "${AUTH[@]}" -X DELETE "${BASE}/api/looks/${LID}" >/dev/null
CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY2}")"
[ "$CODE" = "404" ] || fail "deleting a look left its R2 photo behind (got ${CODE})"

FINAL="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(`${st.clothes.length}/${st.looks.length}/${st.tags.length}`)
  })
')"
[ "$FINAL" = "1/0/1" ] || fail "final state should be 1 cloth, 0 looks, 1 tag; got ${FINAL}"

echo "SMOKE OK"
```

Make it executable: `chmod +x scripts/smoke.sh`.

**Verify**: `cd apps/closet-app && bash scripts/smoke.sh` → exit 0, last line `SMOKE OK`.

**Then prove the gate can fail** (this is what boss re-runs as the mutation gate;
do it yourself before declaring the step done):

```bash
cd apps/closet-app
node -e "const f='src/worker/db.ts';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace('.bind(ev.prev_wears, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)','.bind(ev.prev_wears + 1, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)');fs.writeFileSync(f,s)"
bash scripts/smoke.sh; echo "exit=$?"    # MUST print "SMOKE FAIL: wear-undo did not restore wears" and exit 1
git checkout -- src/worker/db.ts
bash scripts/smoke.sh                    # MUST print SMOKE OK again
```

If the mutated run still prints `SMOKE OK`, the gate is decorative — that is a
STOP condition, not something to work around.

### Step 9: Write the docs

`apps/closet-app/README.md` — human-facing. Must contain:

- One-line purpose: *track how many times a garment has been worn since its last
  wash, plus a tagged gallery of outfit photos.*
- Setup: `npm install`, copy `.dev.vars.example` → `.dev.vars`, `npm run db:local`,
  `npm run dev:local`, and "use **:5173** for UI work" (the `lists-app` convention).
- The endpoint table from Step 6, verbatim.
- The schema, with the two design decisions called out: **no wash limit**, and
  **looks do not link to clothes**.
- A **"First remote deploy (owner only)"** section, exactly this checklist —
  every item needs `wrangler login` and creates a billable resource, so none of it
  runs during a plan:
  1. `npx wrangler d1 create closet-db` → paste the real `database_id` into `wrangler.toml`
  2. `npx wrangler r2 bucket create closet-photos`
  3. `npm run db:remote`
  4. `npx wrangler secret put APP_PASSWORD` and `npx wrangler secret put SESSION_SECRET`
  5. `npm run deploy` → Cloudflare auto-provisions DNS + SSL for `closet.agrolloo.com`
  6. Add the app to `INFRA.md` and `my-hosted-sites.md`

`apps/closet-app/CLAUDE.md` — operating notes, modelled on
`apps/lists-app/CLAUDE.md`. Must state:

- **Stack**: Vite + React 19 + Tailwind v4 SPA, Hono on a Cloudflare Worker,
  D1 `closet-db` (binding `DB`), R2 `closet-photos` (binding `PHOTOS`).
- **Auth guardrail**: stateless HMAC signed cookie. Do NOT replace with
  OAuth/KV/a DB check (`decisions.md` 2026-07-01).
- **Design guardrails**: no wash limit / no threshold colour; looks are a plain
  gallery with no link to clothes. Both were owner decisions on 2026-08-17.
- **Gotchas**: `bash scripts/smoke.sh` is the merge gate and unit tests cannot
  replace it; `c.req.param()` is undefined in wildcard middleware; tags are
  normalised lowercase and pruned when orphaned; `--var` beats `.dev.vars`.

`apps/local-apps.md` — append a section following the existing style:

```markdown
## closet (apps/closet-app)

Wear counter + tagged outfit gallery. Password-gated, single user.

```bash
cd /Users/kbtg/codebase/personal-stuff/apps/closet-app
npm install
npm run db:local        # apply schema to local D1 (once)
npm run dev:local       # Vite :5173 (UI) + wrangler :8787 (API). Use :5173.
bash scripts/smoke.sh   # full API smoke against a throwaway local D1 + R2
```

Local password is in `.dev.vars` (`APP_PASSWORD`). Deploy: `npm run deploy` →
closet.agrolloo.com. See the app README for first-time remote provisioning.
```

**Verify**: `cd apps/closet-app && test -s README.md && test -s CLAUDE.md && grep -q "closet-app" ../local-apps.md && echo docs-ok`
→ `docs-ok`.

### Step 10: Full gate on a fresh checkout

Crews verify inside worktrees that already carry their own build artifacts, so
build-order problems only surface on a pristine tree (LESSONS 2026-07-31).

```bash
cd "$(git rev-parse --show-toplevel)"
git status --porcelain apps/closet-app     # expect: empty (everything committed)
T="$(mktemp -d)"
git clone --no-hardlinks -q . "$T/fresh"
cd "$T/fresh" && git checkout -q advisor/203-closet-app-backend
cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh
```

**Verify**: the last command exits 0 and prints `SMOKE OK`.

## Test plan

| Layer | File | Catches |
|---|---|---|
| Auth unit | `test/auth.test.ts` | wrong password, cookie issue, 401 on `/api/state`, anonymous `/api/me` |
| Pure logic | `test/logic.test.ts` | tag normalisation drift (the thing that splits one tag into two) |
| Integration | `scripts/smoke.sh` | routing, D1 writes, R2 put/get/delete, wear/wash/undo arithmetic, shared tag vocabulary, multi-tag, sort order, orphan pruning, cascade deletes |
| Gate integrity | Step 8's mutation drill | that the smoke can actually fail |
| Fresh tree | Step 10 | build-order and gitignored-artifact dependencies |

No UI tests — there is no UI in this plan. Plan 204 owns those.

## Done criteria

- [ ] `cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh` exits 0 and prints `SMOKE OK`.
- [ ] `cd apps/closet-app && npm run typecheck && npm run lint` both exit 0.
- [ ] Step 8's mutation drill makes the smoke print `SMOKE FAIL: wear-undo did not restore wears` and exit non-zero; reverting restores `SMOKE OK`.
- [ ] Step 10's fresh-clone run exits 0.
- [ ] `git diff --name-only cfa259f7..HEAD` lists only paths from the "In scope" list.
- [ ] `grep -rn "wash_limit\|needs_wash\|look_clothes" apps/closet-app/` returns nothing (the two rejected features stayed out).
- [ ] `src/main.tsx` is still the placeholder — no tabs, tiles, sheets or chips were built.
- [ ] `apps/closet-app/README.md` and `CLAUDE.md` exist and are non-empty; `apps/local-apps.md` has a `closet` section.
- [ ] `git status --porcelain` is clean, with no stray scratch files (LESSONS 2026-07-05: executors leave debug dumps behind).
- [ ] `plans/README.md` row for 203 says `DONE`.

## STOP conditions

- **Any step needs `wrangler login`, a real Cloudflare account, or a remote D1/R2
  resource.** Everything in this plan runs locally. Stop and report.
- **A smoke assertion fails and the honest fix is unclear.** Fix the code or the
  fixture. Weakening, swapping or deleting an assertion to reach green is a STOP —
  crews reliably soften assertions instead of fixing causes (LESSONS 2026-07-31,
  2026-07-24).
- **The mutation drill in Step 8 still prints `SMOKE OK`.** A gate that cannot
  fire is worse than no gate. Stop and report.
- **Any edit to `apps/lists-app/**`.** It is read-only here. Copying is fine.
- **The temptation to build UI.** If a step seems to need a real screen to verify,
  it does not — stop and report instead of starting plan 204's work.
- **`npm install` fails with a 401.** That means `.npmrc` is missing or wrong.
  Fix `.npmrc`; do not add a token or edit any global npm config.
- **You find yourself adding a wash limit, a threshold colour, or a look→clothes
  link.** All three were explicitly rejected by the owner. Stop and report.

## Maintenance notes

- **Plan 204 depends on this plan's API surface.** The endpoint table in Step 6 is
  the contract; changing a path or payload later means changing the SPA too.
- **`/api/state` returns everything.** That is correct at tens of items and
  matches `lists-app`. If the wardrobe ever reaches thousands of rows, add
  server-side filtering then — not now.
- **Photo lifecycle is the fragile part.** Every path that stops referencing a
  `photo_key` must delete the R2 object. The smoke covers replace-and-delete;
  a reviewer should check any new write path for the same.
- **`events.prev_wears` is what makes undo exact.** A future "history" screen can
  read the same table. Do not switch undo to `wears - 1` arithmetic — a wash-undo
  would then guess.
- **A reviewer should scrutinise**: the auth diff (should be 3 lines vs
  `lists-app`), the `dropPhoto` call sites, and whether `scripts/smoke.sh` still
  fails under the mutation.
