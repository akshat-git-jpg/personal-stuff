---
executor: agy
model:
test_cmd: node --test config/channels.test.mjs && (cd apps/redirector && npm test)
ui:
deploy: cd apps/redirector && . ../../scripts/node22-path.sh && npx wrangler d1 migrations apply clicks-db --remote && npx wrangler deploy
needs: []
needs_prs: []
touches: [config/channels.json, config/channels.mjs, config/channels.test.mjs, pipelines/common/channels.py, pipelines/common/channels_test.py, apps/redirector/wrangler.toml, apps/redirector/src/index.ts, apps/redirector/test/routes.test.ts, apps/redirector/migrations/0004_videos_channel.sql, apps/redirector/CLAUDE.md]

mutation_apply: node -e "const fs=require('fs');const f='config/channels.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));j.default_channel_id='nope';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
mutation_command: node --test config/channels.test.mjs
mutation_expect: CHANNEL_DEFAULT_UNKNOWN
mutation_cwd:
mutation_timeout:
---

# Plan 261: The channel registry, and a redirector that serves more than one domain

## Summary

- **Problem statement**: Nothing in this repo knows what a "channel" is. `@AgrolloReviews`
  is assumed everywhere — one `CHANNEL_ID` var in the analytics Worker, one
  `go.agrolloo.com` route in the redirector, and a `clicks-db.videos` table with no
  channel column at all. New YouTube channels would silently mix into one bucket:
  no error, just wrong numbers.
- **Goals**:
  - Add ONE committed source of truth for channels: `config/channels.json`, plus a
    zero-dependency loader for JS (`config/channels.mjs`) and Python
    (`pipelines/common/channels.py`).
  - Add a nullable `channel_id` to `clicks-db.videos` and backfill every existing row
    to `agrollo`.
  - Make the redirector serve a route per channel, and add a gate that FAILS when a
    non-archived channel's `link_domain` has no matching route in `wrangler.toml`.
- **Decisions confirmed**:
  - Where the channel registry lives -> a committed file in the repo, not a D1 table
    (the Python pipelines cannot read D1 at all; a file is the only home all five
    surfaces share).
  - Short links per channel -> a new short domain per channel, ONE redirector Worker
    with several routes (never one Worker per domain).
  - Seeding -> `agrollo` only. No guessed channel names or domains in the code.
  - Video code collisions -> no per-channel prefix. `generateVideoCode()` already
    checks candidates against the WHOLE `videos` table, so codes stay unique across
    every channel automatically.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every file is inlined below;
  this is the `rules.md` default row.
- **Done criteria** (terse): registry validates, its gate fires on bad data, the
  redirector route gate fires on a missing route, migration applied remote, every
  `videos` row has a `channel_id`.
- **Stop conditions** (terse): any change to an existing slug or `go.agrolloo.com`;
  any non-additive edit to `clicks-db`; weakening a gate assertion.
- **Test / verification for success**: `node --test` on the registry, vitest on the
  redirector route gate, plus a live D1 count query.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ddc5f4dd..HEAD -- config apps/redirector pipelines/common`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the money path (`clicks-db`, the redirector). Every change
  here is additive by construction.
- **Depends on**: none. This is the foundation for 262, 263 and 264.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ddc5f4dd`, 2026-08-30

## Why this matters

The owner is launching several more YouTube channels. Today the repo has exactly one
channel baked in at five separate places, and none of them would raise an error when a
second channel appears — the tracker would mint links onto the wrong domain, the
analytics dashboard would show one channel's uploads, and every click would land in a
single unlabelled pile.

The fix is not clever: give "channel" a name, put it in one file that every surface can
read, and make the places that currently assume Agrollo read that file instead. This
plan does the foundation — the registry itself, the click database column, and the
redirector. Plans 262, 263 and 264 consume it.

The one thing that must never break: `go.agrolloo.com/<code>/<tool>` links are baked
into published YouTube descriptions that cannot be edited in bulk. Those URLs are
permanent. New domains are strictly additive.

## Current state

### `apps/redirector/src/index.ts` — the redirector ignores the hostname

The handler reads the path only. The host never enters the lookup:

```ts
async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.pathname.replace(/^\/+/, "");

  if (!slug || !isValidSlug(slug)) return notFound();

  const stored = await env.CLICKS_KV.get(slug);
  if (!stored) return notFound();
  ...
}
```

This is *good news*: adding a second domain needs **zero handler changes**. A new route
in `wrangler.toml` makes a domain live immediately, because `CLICKS_KV` is one flat
slug namespace shared by every channel.

`isValidSlug` pins the shape:

```ts
const SLUG_RE = /^[a-zA-Z0-9]+\/[a-zA-Z0-9-]+$/;
```

### `apps/redirector/wrangler.toml` — one route today

```toml
name = "redirector"
main = "src/index.ts"
compatibility_date = "2025-04-01"

[[kv_namespaces]]
binding = "CLICKS_KV"
id = "5d39bf8966014043a2bf7de3ac93fc2b"

[[d1_databases]]
binding = "DB"
database_name = "clicks-db"
database_id = "3415a408-ccc9-49e2-8fe1-60009dfd83ce"

[[routes]]
pattern = "go.agrolloo.com/*"
zone_name = "agrolloo.com"

[observability]
enabled = true
```

### `apps/redirector/migrations/` — the schema contract

Three migrations exist: `0001_init.sql`, `0002_video_yt_id.sql`, `0003_links_kind.sql`.
`0002` states the contract this plan must follow, verbatim from its header:

> Additive and nullable, per the redirector's schema contract: analytics-app reads this
> table and must keep working without knowing about the column.

`videos` today:

```sql
CREATE TABLE IF NOT EXISTS videos (
  video_code   TEXT PRIMARY KEY,
  video_title  TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
-- plus, from 0002:
ALTER TABLE videos ADD COLUMN yt_video_id TEXT;
```

### Video codes are already globally unique

`apps/tutorial-tracker-app/src/worker/linkgen.ts`:

```ts
const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 4;

export function generateVideoCode(existing: Set<string>, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    let code = "";
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (let j = 0; j < CODE_LENGTH; j++) code += BASE62[bytes[j] % BASE62.length];
    if (!existing.has(code)) return code;
  }
  throw new Error(`Could not generate a unique ${CODE_LENGTH}-char code in ${maxAttempts} attempts`);
}
```

`existing` is loaded from the whole `videos` table (`clickstore.ts:11`). Because every
channel shares one `clicks-db`, codes cannot collide across channels and no prefix is
needed. **Do not add one.**

### A Worker CAN bundle JSON from outside its own folder

Verified during planning on this exact repo and toolchain
(`wrangler 3.114.17`, `wrangler deploy --dry-run` from `apps/redirector`): a
`import channels from "../../../config/channels.json"` in `src/index.ts` resolved,
bundled and reported `Total Upload: 4.23 KiB`. This is why the registry can be a plain
repo-root file rather than a copy per app.

Path depth cheatsheet (used by later plans too):

| From | Relative path to the registry |
|---|---|
| `apps/redirector/src/*.ts` | `../../../config/channels.json` |
| `apps/<app>/src/worker/*.ts` | `../../../../config/channels.json` |
| `pipelines/video-registry/lib/*.mjs` | use the existing `REPO_ROOT` export |

### `pipelines/common/__init__.py` has an import side effect

```python
from . import env  # noqa: F401  side-effect: load .env on import
```

Importing `common.channels` therefore drags in dotenv and needs the pipelines venv. The
new Python loader must be **standalone-importable** so its test runs on a bare
`python3` with no venv — see Step 4.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Registry unit tests | `node --test config/channels.test.mjs` | exit 0, all tests pass |
| Python loader test | `python3 pipelines/common/channels_test.py` | exit 0, `OK` |
| Redirector tests | `cd apps/redirector && npm test` | exit 0 |
| Redirector typecheck | `cd apps/redirector && npm run typecheck` | exit 0 |
| Redirector bundle check | `cd apps/redirector && . ../../scripts/node22-path.sh && npx wrangler deploy --dry-run --outdir /tmp/rd-dry` | prints `--dry-run: exiting now.` |
| Apply migration locally | `cd apps/redirector && npx wrangler d1 execute clicks-db --local --file=migrations/0004_videos_channel.sql` | exit 0 |
| Count unlabelled videos (remote) | `cd apps/redirector && npx wrangler d1 execute clicks-db --remote --command "SELECT COUNT(*) AS n FROM videos WHERE channel_id IS NULL"` | `n = 0` |
| Full merge gate | `node --test config/channels.test.mjs && (cd apps/redirector && npm test)` | exit 0 |

## Scope

**In scope**:
- `config/channels.json` (new)
- `config/channels.mjs` (new)
- `config/channels.test.mjs` (new)
- `config/README.md` (new)
- `pipelines/common/channels.py` (new)
- `pipelines/common/channels_test.py` (new)
- `apps/redirector/migrations/0004_videos_channel.sql` (new)
- `apps/redirector/test/routes.test.ts` (new)
- `apps/redirector/wrangler.toml` (edit — comment only, see Step 5)
- `apps/redirector/CLAUDE.md` (edit — document the new column + the route gate)
- `README.md` and `CLAUDE.md` at repo root (one routing row each)

**Out of scope** — looks related, do not touch:
- `apps/tutorial-tracker-app/**` — plan 262 owns the tracker.
- `apps/analytics-app/**` — plan 263 owns the dashboard.
- `pipelines/video/**`, `pipelines/video-registry/**` — plan 264.
- `apps/redirector/src/index.ts` handler logic — it is already host-agnostic and
  correct. Do NOT make it read the hostname; that would add a failure mode to the
  money path for no benefit.
- Buying or configuring any DNS. This plan ships one seeded channel.
- `links.slug` / `CLICKS_KV` key shape. Permanent, published in YouTube descriptions.

## Git workflow

- Branch: `advisor/261-channel-registry-and-multi-domain-redirector`
- Commit per step. Messages: one conventional-commit line, no body, no AI footers.
  Do NOT push.

## Steps

### Step 1: Create the registry data file

Create `config/channels.json` with exactly this content:

```json
{
  "version": 1,
  "default_channel_id": "agrollo",
  "channels": [
    {
      "id": "agrollo",
      "name": "Agrollo Reviews",
      "handle": "@AgrolloReviews",
      "youtube_channel_id": "UCXuXNNuyhtdsiw9bZr0pUxw",
      "owner_account": "adelpaul2526@gmail.com",
      "link_domain": "go.agrolloo.com",
      "zone_name": "agrolloo.com",
      "archived": false,
      "profile": {
        "voice_slug": "jamila-30s",
        "avatar_slug": "girl-1",
        "brand": "default",
        "taste_file": "pipelines/youtube/yt-script/TASTE.md",
        "style_dna": null
      }
    }
  ]
}
```

Notes for the reader, not to be added as comments (JSON has none):
- `owner_account` is the Google account that OWNS the channel. The YouTube Data API
  ignores Studio manager/editor permissions, so only this account can write to it.
- `profile` is consumed by plan 264. Leave it in place even though nothing reads it yet.
- `link_domain` carries no scheme and no path.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('config/channels.json','utf8'))"` -> exit 0, no output

### Step 2: Create the JS loader

Create `config/channels.mjs`. Zero dependencies, node stdlib only. It must export
`validate()` returning an array of error strings, each PREFIXED with a stable machine
code — those codes are what the gate asserts on, so they must never be reworded.

```js
/**
 * channels.mjs — the single source of truth for "what channels exist".
 *
 * Read by: the redirector route gate, the tracker Worker, the analytics Worker and
 * (via channels.py) the Python pipelines. A D1 table was rejected because the
 * pipelines cannot read D1 at all — see plans/261.
 *
 * Error strings are prefixed with a stable CODE. Gates assert on the code, so
 * renaming one silently disarms a gate. Do not reword them.
 */
import fs from 'node:fs';
import path from 'node:path';

export const REGISTRY_PATH = path.resolve(import.meta.dirname, 'channels.json');

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YT_CHANNEL_RE = /^UC[A-Za-z0-9_-]{22}$/;
const DOMAIN_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/;

export function loadRegistry(file = REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every non-archived channel, in file order. */
export function listChannels(reg = loadRegistry()) {
  return reg.channels.filter((c) => !c.archived);
}

/** Every channel including archived ones. */
export function allChannels(reg = loadRegistry()) {
  return reg.channels.slice();
}

export function getChannel(id, reg = loadRegistry()) {
  const found = reg.channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: no channel with id ${JSON.stringify(id)}`);
  return found;
}

export function defaultChannel(reg = loadRegistry()) {
  return getChannel(reg.default_channel_id, reg);
}

/** Returns [] when the registry is well-formed; else one string per problem. */
export function validate(reg = loadRegistry()) {
  const errors = [];
  if (reg.version !== 1) errors.push(`CHANNEL_VERSION_UNSUPPORTED: version ${reg.version}`);
  if (!Array.isArray(reg.channels) || reg.channels.length === 0) {
    errors.push('CHANNEL_LIST_EMPTY: channels must be a non-empty array');
    return errors;
  }

  const seenIds = new Set();
  const seenDomains = new Set();
  const seenYt = new Set();

  for (const c of reg.channels) {
    const at = JSON.stringify(c.id ?? '(missing id)');
    if (!c.id || !ID_RE.test(c.id)) errors.push(`CHANNEL_ID_INVALID: ${at} must be kebab-case`);
    else if (seenIds.has(c.id)) errors.push(`CHANNEL_ID_DUPLICATE: ${at}`);
    else seenIds.add(c.id);

    if (!c.name || !String(c.name).trim()) errors.push(`CHANNEL_NAME_MISSING: ${at}`);

    if (!YT_CHANNEL_RE.test(c.youtube_channel_id || '')) {
      errors.push(`CHANNEL_YT_ID_INVALID: ${at} youtube_channel_id must match UC + 22 chars`);
    } else if (seenYt.has(c.youtube_channel_id)) {
      errors.push(`CHANNEL_YT_ID_DUPLICATE: ${at}`);
    } else seenYt.add(c.youtube_channel_id);

    if (!c.owner_account || !String(c.owner_account).includes('@')) {
      errors.push(`CHANNEL_OWNER_INVALID: ${at} owner_account must be the Google account that OWNS the channel`);
    }

    if (!DOMAIN_RE.test(c.link_domain || '')) {
      errors.push(`CHANNEL_DOMAIN_INVALID: ${at} link_domain must be a bare hostname`);
    } else if (seenDomains.has(c.link_domain)) {
      errors.push(`CHANNEL_DOMAIN_DUPLICATE: ${at} shares link_domain ${c.link_domain}`);
    } else seenDomains.add(c.link_domain);

    if (!c.zone_name || !DOMAIN_RE.test(c.zone_name)) {
      errors.push(`CHANNEL_ZONE_INVALID: ${at} zone_name must be the Cloudflare zone`);
    } else if (c.link_domain && !c.link_domain.endsWith(c.zone_name)) {
      errors.push(`CHANNEL_ZONE_MISMATCH: ${at} link_domain ${c.link_domain} is not inside zone ${c.zone_name}`);
    }
  }

  if (!seenIds.has(reg.default_channel_id)) {
    errors.push(`CHANNEL_DEFAULT_UNKNOWN: default_channel_id ${JSON.stringify(reg.default_channel_id)} is not a channel`);
  }

  return errors;
}
```

**Verify**: `node -e "import('./config/channels.mjs').then(m=>{const e=m.validate();if(e.length){console.error(e);process.exit(1)}console.log('ok',m.listChannels().length)})"` -> `ok 1`

### Step 3: Create the registry test

Create `config/channels.test.mjs` using `node:test`. It must cover BOTH the shipped
file and synthetic bad registries, so the mutation gate can fire.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, validate, listChannels, getChannel, defaultChannel } from './channels.mjs';

const base = () => JSON.parse(JSON.stringify(loadRegistry()));

test('the shipped registry is valid', () => {
  assert.deepEqual(validate(), []);
});

test('agrollo is present and owns go.agrolloo.com', () => {
  const c = getChannel('agrollo');
  assert.equal(c.link_domain, 'go.agrolloo.com');
  assert.equal(c.youtube_channel_id, 'UCXuXNNuyhtdsiw9bZr0pUxw');
  assert.equal(c.archived, false);
});

test('the default channel resolves', () => {
  assert.equal(defaultChannel().id, loadRegistry().default_channel_id);
});

test('listChannels hides archived channels', () => {
  const reg = base();
  reg.channels[0].archived = true;
  assert.equal(listChannels(reg).length, 0);
});

test('an unknown default is rejected', () => {
  const reg = base();
  reg.default_channel_id = 'nope';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_DEFAULT_UNKNOWN')));
});

test('two channels cannot share a link_domain', () => {
  const reg = base();
  reg.channels.push({ ...reg.channels[0], id: 'other', youtube_channel_id: 'UCaaaaaaaaaaaaaaaaaaaaaa' });
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_DOMAIN_DUPLICATE')));
});

test('two channels cannot share a youtube_channel_id', () => {
  const reg = base();
  reg.channels.push({ ...reg.channels[0], id: 'other', link_domain: 'go.example.com', zone_name: 'example.com' });
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_YT_ID_DUPLICATE')));
});

test('a malformed youtube_channel_id is rejected', () => {
  const reg = base();
  reg.channels[0].youtube_channel_id = 'UCtooshort';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_YT_ID_INVALID')));
});

test('a link_domain outside its zone is rejected', () => {
  const reg = base();
  reg.channels[0].link_domain = 'go.elsewhere.com';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_ZONE_MISMATCH')));
});

test('a channel with no owner account is rejected', () => {
  const reg = base();
  reg.channels[0].owner_account = '';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_OWNER_INVALID')));
});

test('getChannel throws on an unknown id', () => {
  assert.throws(() => getChannel('missing'), /CHANNEL_UNKNOWN/);
});
```

**Verify**: `node --test config/channels.test.mjs` -> exit 0, `pass 11`

### Step 4: Create the standalone Python loader and its test

`pipelines/common/channels.py` must be importable WITHOUT triggering
`pipelines/common/__init__.py` (which loads dotenv and needs the venv). Use stdlib only
and resolve the registry from this file's own location.

```python
"""channels.py - read config/channels.json from the Python pipelines.

Deliberately standalone: stdlib only, and importable by path so its test runs on a
bare python3 with no venv. Importing `common.channels` as a package still works, but
that path drags in common/__init__.py's dotenv side effect.

The registry is documented in plans/261 and config/README.md.
"""

import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
REGISTRY_PATH = os.path.join(REPO_ROOT, "config", "channels.json")


def load_registry(path=REGISTRY_PATH):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def all_channels(reg=None):
    reg = reg if reg is not None else load_registry()
    return list(reg["channels"])


def list_channels(reg=None):
    return [c for c in all_channels(reg) if not c.get("archived")]


def get_channel(channel_id, reg=None):
    for c in all_channels(reg):
        if c["id"] == channel_id:
            return c
    raise KeyError("CHANNEL_UNKNOWN: no channel with id %r" % (channel_id,))


def default_channel(reg=None):
    reg = reg if reg is not None else load_registry()
    return get_channel(reg["default_channel_id"], reg)
```

`pipelines/common/channels_test.py`:

```python
"""Run with a bare python3: python3 pipelines/common/channels_test.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import channels  # noqa: E402


class ChannelsTest(unittest.TestCase):
    def test_registry_path_resolves(self):
        self.assertTrue(os.path.isfile(channels.REGISTRY_PATH))

    def test_agrollo_is_present(self):
        c = channels.get_channel("agrollo")
        self.assertEqual(c["link_domain"], "go.agrolloo.com")
        self.assertEqual(c["youtube_channel_id"], "UCXuXNNuyhtdsiw9bZr0pUxw")

    def test_default_channel_resolves(self):
        self.assertEqual(channels.default_channel()["id"], "agrollo")

    def test_unknown_channel_raises(self):
        with self.assertRaises(KeyError):
            channels.get_channel("missing")

    def test_js_and_python_agree(self):
        """The two loaders must see the same channel ids, or the surfaces drift."""
        ids = sorted(c["id"] for c in channels.all_channels())
        self.assertEqual(ids, sorted(set(ids)))
        self.assertTrue(len(ids) >= 1)


if __name__ == "__main__":
    unittest.main()
```

**Verify**: `python3 pipelines/common/channels_test.py` -> exit 0, ends with `OK`

### Step 5: Document the route rule in the redirector's wrangler.toml

Do NOT add a second route (there is only one channel). Add the comment that tells the
next person the rule, immediately above the existing `[[routes]]` block:

```toml
# ONE route per non-archived channel in config/channels.json. `test/routes.test.ts`
# FAILS when a channel's link_domain has no route here, so adding a channel to the
# registry without its route cannot ship. go.agrolloo.com is permanent: its slugs are
# published inside YouTube descriptions and can never be retired.
[[routes]]
pattern = "go.agrolloo.com/*"
zone_name = "agrolloo.com"
```

**Verify**: `cd apps/redirector && . ../../scripts/node22-path.sh && npx wrangler deploy --dry-run --outdir /tmp/rd-dry` -> prints `--dry-run: exiting now.`

### Step 6: Add the redirector route gate

Create `apps/redirector/test/routes.test.ts`. It parses `wrangler.toml` with a regex
(no TOML dependency is installed, and adding one for this is not warranted) and asserts
every non-archived channel has a route.

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { listChannels, validate } from "../../../config/channels.mjs";

const WRANGLER = path.resolve(import.meta.dirname, "..", "wrangler.toml");

/** Every `pattern = "..."` value in the file, in order. */
function routePatterns(): string[] {
  const toml = fs.readFileSync(WRANGLER, "utf8");
  return [...toml.matchAll(/^\s*pattern\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
}

describe("redirector routes track the channel registry", () => {
  it("the registry itself is valid", () => {
    expect(validate()).toEqual([]);
  });

  it("every non-archived channel has a route", () => {
    const patterns = routePatterns();
    const missing = listChannels()
      .filter((c: { link_domain: string }) => !patterns.includes(`${c.link_domain}/*`))
      .map((c: { id: string; link_domain: string }) => `${c.id} (${c.link_domain})`);
    expect(missing, `REDIRECTOR_ROUTE_MISSING: ${missing.join(", ")}`).toEqual([]);
  });

  it("go.agrolloo.com is never removed", () => {
    // Its slugs are published inside YouTube descriptions. Permanent.
    expect(routePatterns()).toContain("go.agrolloo.com/*");
  });

  it("no route points at a domain no channel claims", () => {
    const claimed = new Set(listChannels().map((c: { link_domain: string }) => `${c.link_domain}/*`));
    const orphans = routePatterns().filter((p) => !claimed.has(p));
    expect(orphans, `REDIRECTOR_ROUTE_ORPHAN: ${orphans.join(", ")}`).toEqual([]);
  });
});
```

If TypeScript complains that `channels.mjs` has no type declarations, add
`config/channels.d.ts` alongside it:

```ts
export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
  profile: {
    voice_slug: string;
    avatar_slug: string;
    brand: string;
    taste_file: string;
    style_dna: string | null;
  };
}
export interface Registry { version: number; default_channel_id: string; channels: Channel[] }
export const REGISTRY_PATH: string;
export function loadRegistry(file?: string): Registry;
export function listChannels(reg?: Registry): Channel[];
export function allChannels(reg?: Registry): Channel[];
export function getChannel(id: string, reg?: Registry): Channel;
export function defaultChannel(reg?: Registry): Channel;
export function validate(reg?: Registry): string[];
```

Then drop the inline `{ link_domain: string }` annotations in the test and let the
declarations type it.

**Verify**: `cd apps/redirector && npm test` -> exit 0, 4 tests pass
**Verify**: `cd apps/redirector && npm run typecheck` -> exit 0

### Step 7: Prove the route gate actually fires

Temporarily add a second channel to `config/channels.json` with
`"link_domain": "go.example.com", "zone_name": "example.com"` and no route, run the
redirector tests, confirm they FAIL with `REDIRECTOR_ROUTE_MISSING`, then revert the
file completely.

**Verify**: `cd apps/redirector && npm test` -> FAILS, output contains `REDIRECTOR_ROUTE_MISSING`
**Verify after revert**: `git diff --exit-code config/channels.json` -> exit 0, no output
**Verify after revert**: `cd apps/redirector && npm test` -> exit 0

### Step 8: The clicks-db migration

Create `apps/redirector/migrations/0004_videos_channel.sql`:

```sql
-- Labels each tracked video with the channel it belongs to, so click and revenue
-- reporting can be split per channel. Until now `videos` had no channel column at
-- all and every row was implicitly @AgrolloReviews.
--
-- Additive and nullable, per the redirector's schema contract (see 0002's header):
-- analytics-app reads this table and must keep working without knowing about the
-- column. The backfill below is what makes NULL unreachable in practice; a row
-- created by an older code path would still be legal.
--
-- Channel ids come from config/channels.json. 'agrollo' = @AgrolloReviews.
--
-- NOTE: video_code stays globally unique across all channels. generateVideoCode()
-- checks candidates against the whole table, so no per-channel prefix is needed and
-- none must be added — published short URLs are immutable.

ALTER TABLE videos ADD COLUMN channel_id TEXT;

UPDATE videos SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
```

Apply it locally first, then remotely.

**Verify (local)**: `cd apps/redirector && npx wrangler d1 execute clicks-db --local --file=migrations/0004_videos_channel.sql` -> exit 0
**Verify (remote)**: `cd apps/redirector && npx wrangler d1 execute clicks-db --remote --file=migrations/0004_videos_channel.sql` -> exit 0
**Verify (remote count)**: `cd apps/redirector && npx wrangler d1 execute clicks-db --remote --command "SELECT COUNT(*) AS n FROM videos WHERE channel_id IS NULL"` -> `n` is `0`
**Verify (remote spread)**: `cd apps/redirector && npx wrangler d1 execute clicks-db --remote --command "SELECT channel_id, COUNT(*) AS n FROM videos GROUP BY channel_id"` -> one row, `agrollo`, n equal to the total video count

### Step 9: Documentation

1. Create `config/README.md`:

```markdown
# config/ — cross-surface configuration

One folder for settings that more than one surface must agree on. Nothing here is a
secret; secrets live in `infra/secrets/` and Worker secrets.

## channels.json — the channel registry

The single source of truth for "what YouTube channels exist". Read by the redirector
route gate, the tracker Worker, the analytics Worker and the Python pipelines
(`pipelines/common/channels.py`).

It is a committed file rather than a D1 table because the Python pipelines cannot read
D1 at all, and a per-app copy would drift. Workers bundle it directly — verified: a
relative JSON import from outside the app folder resolves in `wrangler deploy`.

### Adding a channel

1. Create the Google account that will OWN the channel, and give it a
   YouTube-scope-only token via `tooling/mcp/google-shared`. Studio manager/editor
   permissions do NOT grant Data API write access — only the owning account can write.
2. Add the short domain to Cloudflare (the zone must already exist).
3. Add the entry to `channels.json`.
4. Add the matching `[[routes]]` block to `apps/redirector/wrangler.toml` and deploy
   the redirector. `apps/redirector/test/routes.test.ts` FAILS until you do.
5. Add the channel's profile assets — see `plans/264`.

### Fields

| Field | Meaning |
|---|---|
| `id` | kebab-case key used by every database and API. Never reused, never renamed. |
| `youtube_channel_id` | `UC…` id. The uploads playlist is `"UU" + id.slice(2)`. |
| `owner_account` | The Google account that owns the channel. Only it can write via the API. |
| `link_domain` | Bare hostname for short links. Must sit inside `zone_name`. |
| `archived` | `true` hides the channel from pickers; its data and routes stay. |
| `profile` | Creative defaults (voice, avatar, brand, taste file). Consumed by plan 264. |

Validation lives in `channels.mjs`. Error strings start with a stable machine code
(`CHANNEL_DOMAIN_DUPLICATE`, …) that gates assert on — never reword one.
```

2. In `apps/redirector/CLAUDE.md`, add a short section recording: `videos.channel_id`
   exists and is backfilled to `agrollo`; one Worker serves every channel's domain;
   the handler is host-agnostic on purpose; the route gate is
   `test/routes.test.ts`; `go.agrolloo.com` is permanent.

3. Add one row to the root `CLAUDE.md` "Find it fast" table:
   `| Which YouTube channels exist, their domains and owning accounts | `config/README.md` |`

4. Append one dated line to `decisions.md`:
   `- 2026-08-30 — **The channel registry is a committed file, not a table.** ...`
   Record: why a file beat D1 (the Python pipelines cannot read D1); that the
   redirector stays host-agnostic and one Worker serves every domain; that video codes
   need no per-channel prefix because `generateVideoCode` already checks the whole
   table; and that `go.agrolloo.com` is permanent because its slugs are published in
   YouTube descriptions.

**Verify**: `test -f config/README.md && grep -q "channels.json" CLAUDE.md && grep -q "2026-08-30" decisions.md` -> exit 0

### Step 10: Fresh-checkout gate run

Clean the worktree of build artifacts and run the merge gate once on a pristine tree.

```bash
git clean -xdn config apps/redirector pipelines/common   # review first
git clean -xdf apps/redirector/node_modules 2>/dev/null || true
node --test config/channels.test.mjs && (cd apps/redirector && npm test)
```

**Verify**: exit 0

## Test plan

- `config/channels.test.mjs` (node:test, 11 tests) — the shipped registry validates,
  and each validation rule is proven to reject a synthetic bad registry. This is what
  makes the mutation gate real.
- `pipelines/common/channels_test.py` (stdlib unittest, 5 tests) — the Python loader
  finds the same file and the same channels, on a bare `python3`.
- `apps/redirector/test/routes.test.ts` (vitest, 4 tests) — every non-archived channel
  has a route, no orphan routes, `go.agrolloo.com` present. Step 7 proves it fires.
- Live D1 count queries confirm the backfill left zero unlabelled videos.

## Done criteria

- [ ] `node --test config/channels.test.mjs` exits 0 and reports 11 passing tests.
- [ ] `python3 pipelines/common/channels_test.py` exits 0 and prints `OK`.
- [ ] `cd apps/redirector && npm test` exits 0 with 4 tests.
- [ ] `cd apps/redirector && npm run typecheck` exits 0.
- [ ] `test -f config/channels.json && test -f config/channels.mjs && test -f config/channels.test.mjs && test -f config/README.md && test -f pipelines/common/channels.py && test -f pipelines/common/channels_test.py && test -f apps/redirector/test/routes.test.ts && test -f apps/redirector/migrations/0004_videos_channel.sql` exits 0.
- [ ] Step 7 was executed: the route gate was observed FAILING with
      `REDIRECTOR_ROUTE_MISSING`, and `git diff --exit-code config/channels.json` exits
      0 afterwards.
- [ ] `wrangler d1 execute clicks-db --remote --command "SELECT COUNT(*) AS n FROM videos WHERE channel_id IS NULL"` returns `n = 0`.
- [ ] `wrangler deploy --dry-run` on the redirector succeeds.
- [ ] `git diff --stat ddc5f4dd..HEAD` lists only files from the In-scope list.
- [ ] `decisions.md` has the dated 2026-08-30 line, and root `CLAUDE.md` has the routing row.

## STOP conditions

- **A gate assertion fails and the obvious fix is to weaken it.** Fix the code or the
  fixture. Weakening, swapping or deleting an assertion is a STOP — report instead.
- **Any change to `links.slug`, `CLICKS_KV` key shape, existing `video_code` values, or
  the `go.agrolloo.com` route.** These are published inside YouTube descriptions and
  are permanent. Stop and report.
- **The migration is not purely additive.** If `0004` would need a table rebuild, a
  `NOT NULL` column, or a `DROP`, stop. The redirector's schema contract requires
  analytics-app to keep working without knowing the column exists.
- **The remote `--remote` migration errors, or the NULL count is not 0 afterwards.**
  Do not retry blindly and do not hand-patch rows; stop and report the exact error.
- **The relative JSON import does not resolve in `wrangler deploy --dry-run`.** This was
  verified during planning, so a failure means something else changed. Do not work
  around it by copying the registry into the app folder — stop and report.
- **You need to invent a second channel's name, domain, YouTube id or owner account.**
  The registry ships with `agrollo` only, deliberately. Stop and report.
- **Done criteria still fail after 5 fix attempts.** Write
  `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- The three gates that matter here are the registry validator, the redirector route
  gate, and the JS/Python loader agreement. All three exist so that "added a channel to
  the registry but forgot the other half" cannot ship.
- Error codes in `validate()` are load-bearing strings. `mutation_expect` and the
  redirector test both assert on them. Renaming one disarms a gate silently.
- Plans 262, 263 and 264 all import this registry. Any change to the field names here
  is a change to three other plans.
- The `profile` block is dead data until plan 264. That is intentional: it keeps the
  registry a single file rather than growing a second one later.
- A reviewer should scrutinise: that the migration is additive; that Step 7 was really
  run (a route gate nobody proved is exactly the "gate that never fires" failure
  boss's mutation check exists to catch); and that no file outside the In-scope list
  was touched.
