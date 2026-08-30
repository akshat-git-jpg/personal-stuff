---
executor: agy
model:
test_cmd: (cd apps/tutorial-tracker-app && npm test) && node --test config/channels.test.mjs
ui: true
deploy: cd apps/tutorial-tracker-app && . ../../scripts/node22-path.sh && npx wrangler d1 migrations apply tracker-db --remote && npm run deploy
needs: ["261 must land first: this plan imports config/channels.mjs and writes clicks-db.videos.channel_id"]
needs_prs: [261]
touches: [apps/tutorial-tracker-app/migrations/0007_cards_channel.sql, apps/tutorial-tracker-app/src/worker/channels.ts, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/src/worker/clickstore.ts, apps/tutorial-tracker-app/src/worker/datastore.ts, apps/tutorial-tracker-app/src/client/api.ts, apps/tutorial-tracker-app/src/client/NewVideoDialog.tsx, apps/tutorial-tracker-app/src/client/Filters.tsx, apps/tutorial-tracker-app/src/client/Card.tsx, apps/tutorial-tracker-app/src/client/CardDetail.tsx, apps/tutorial-tracker-app/scripts/seed-local.ts, apps/tutorial-tracker-app/test/channels.test.ts, apps/tutorial-tracker-app/CLAUDE.md]

mutation_apply: node -e "const fs=require('fs');const f='apps/tutorial-tracker-app/src/worker/channels.ts';let s=fs.readFileSync(f,'utf8');const o=s;s=s.replace(/export function linkDomainFor[\s\S]*?\n\}/, 'export function linkDomainFor(){ return \"go.agrolloo.com\" }');if(s===o){console.error('MUTATION_NOT_APPLIED');process.exit(1)}fs.writeFileSync(f,s)"
mutation_command: cd apps/tutorial-tracker-app && npm test
mutation_expect: CHANNEL_DOMAIN_NOT_RESOLVED
mutation_cwd:
mutation_timeout:
---

# Plan 262: The tracker learns which channel a video belongs to

## Summary

- **Problem statement**: Every card in the tracker is implicitly `@AgrolloReviews`.
  `cards` has no channel column, the board has no channel filter, and link minting
  reads a single `LINK_DOMAIN` var — so a video made for a second channel would mint
  `go.agrolloo.com` links and land in the same undifferentiated board.
- **Goals**:
  - Add `channel_id` to `cards`, backfilled to `agrollo`.
  - Pick a channel when creating a video; show it on the card and card detail; filter
    the board by it.
  - Mint links onto the CARD'S channel domain, not a global env var, and stamp
    `clicks-db.videos.channel_id` at mint time.
- **Decisions confirmed**:
  - Tracker model -> a `channel_id` field on cards, NOT one `PipelineDef` per channel.
    Workflows stay shared; only the channel label is new.
  - Programs and team -> the affiliate Programs catalogue stays SHARED across all
    channels; team membership stays scoped per system exactly as it already is.
  - Registry home -> `config/channels.json` (landed by plan 261).
  - Seeding -> `agrollo` only.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every schema change, endpoint
  and UI behaviour is inlined below; `rules.md` default row.
- **Done criteria** (terse): migration applied and backfilled, `/api/channels` serves
  the registry, minting uses the card's domain, board filters by channel, new tests
  exist and pass, one screenshot committed.
- **Stop conditions** (terse): any change to an existing minted slug or short URL;
  any attempt to split the Programs catalogue; weakening a gate assertion.
- **Test / verification for success**: vitest unit tests including a channel-domain
  resolution gate, plus a Playwright screenshot of the board showing the channel chip.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ddc5f4dd..HEAD -- apps/tutorial-tracker-app config`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — touches link minting, which is the money path. Minting changes are
  domain-selection only; slug shape and code generation are untouched.
- **Depends on**: plan 261 (the registry and `clicks-db.videos.channel_id`).
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ddc5f4dd`, 2026-08-30

## Why this matters

The tracker is where a video is born, so it is where the channel has to be chosen. If
the channel is not attached here, nothing downstream can attach it either: the short
link gets minted on the wrong domain, the click row has no channel, and the analytics
dashboard can never split the numbers.

The tracker is already a generic multi-system engine — but a "system" is a *workflow*
(which stages exist, who reviews), not a *channel*. Two channels running the same
`standard` flow are indistinguishable today. That is the exact gap this plan closes,
and it closes it with one column rather than by cloning the pipeline definitions.

## Current state

### The engine, and why channel is NOT a new PipelineDef

From `apps/tutorial-tracker-app/CLAUDE.md`:

> The app is now a **generic multi-system pipeline engine**. […] Each "system"
> (video-production flow) is one `PipelineDef` in `src/shared/engine/definitions/`
> (`standard.ts` = the original 6-stage flow; `tut-2.ts` = "Tut 2", a 7-stage avatar
> flow with an Admin-owned **Processing** stage).

> **System-scoped team (2026-06-30).** People are now scoped to a system, not global.
> The `employees` table is membership-grained — one row per **(email, system_id)**.

A channel is orthogonal to all of that: the same 6-stage `standard` flow will run on
every channel. Cloning `standard.ts` per channel would duplicate the stage list, the
role roster and the access grid N times, and every future stage fix would have to be
applied N times. Hence: one column on `cards`.

**Do not touch `src/shared/engine/`.** Channel is not a stage, not a status, not a
field widget, and not an access dimension. Adding it there would collide with the
documented two-source-of-truth trap:

> **Two-source-of-truth trap (2026-08-13).** `control.ts` decides what a card SHOWS;
> `derive.ts` decides what a role may SEE. […] a column shown by one and withheld by
> the other silently vanishes from the card — no lock, no error.

### `cards` schema (from `scripts/migrate-to-engine.ts:51`)

```sql
CREATE TABLE cards (
  id TEXT PRIMARY KEY, pipeline_id TEXT NOT NULL,
  title TEXT, notes TEXT, description TEXT, category TEXT, subcategory TEXT,
  extra_json TEXT, created_at TEXT, updated_at TEXT, status_since TEXT
);
```

A later migration added `slug`. Existing migrations directory:
`0002_card_events.sql`, `0003_card_slug.sql`, `0004_backfill_card_slugs.sql`,
`0005_programs.sql`, `0006_link_checks.sql`. **This plan adds `0007`.**

### Video creation — `src/worker/index.ts:927`

```ts
app.post("/api/video", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);

  let body: Record<string, string>;
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }

  // Which system this video runs on (defaults to standard).
  const pipe = getPipeline((body.pipeline ?? DEFAULT_PIPELINE_ID).trim());
  ...
```

Note the existing pattern: `body.pipeline` with a default constant. Channel follows the
same shape — `body.channel_id` defaulting to the registry's `default_channel_id`.

### Link minting — `src/worker/index.ts`, three uses of `c.env.LINK_DOMAIN`

`/api/link-preview` (around line 1113):

```ts
  const items = buildPlan(resolved, videoCode, c.env.LINK_DOMAIN);
  const description = renderDescription(title, items);
  try {
    validateDescription(description, items, c.env.LINK_DOMAIN);
  } catch (err: any) {
    return c.json({ error: "validation", message: err.message }, 500);
  }
```

`/api/link-confirm` (around line 1170):

```ts
  const finalItems = buildPlan(resolved, finalVideoCode, c.env.LINK_DOMAIN);
  const description = renderDescription(title, finalItems);
  validateDescription(description, finalItems, c.env.LINK_DOMAIN);
```

`c.env.LINK_DOMAIN` is `"go.agrolloo.com"` in `wrangler.toml:44`. All three call sites
must resolve the domain from the CARD's channel instead.

### Video-code reservation, same file

```ts
    videoCode = generateVideoCode(await clickstore.existingCodes(c.env.DB));
    await clickstore.insertVideo(c.env.DB, videoCode, title);
```

and in confirm:

```ts
  if (finalVideoCode === "(new)") {
    finalVideoCode = generateVideoCode(await clickstore.existingCodes(db));
    await clickstore.insertVideo(db, finalVideoCode, title);
    codeUpdates.video_code = finalVideoCode;
  }
```

`insertVideo` in `src/worker/clickstore.ts`:

```ts
    .prepare("INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)")
```

`videos.channel_id` exists after plan 261. `insertVideo` must write it.

**`generateVideoCode` stays exactly as it is.** It checks candidates against the whole
`videos` table, so codes are already unique across every channel. Adding a per-channel
prefix would be wrong and would change published URLs.

### Client files you will touch

| File | Role |
|---|---|
| `src/client/NewVideoDialog.tsx` | The create-video modal. Already carries a **type picker** for the system; the channel picker sits beside it. |
| `src/client/Filters.tsx` | Board filter controls. |
| `src/client/Card.tsx` | The board card. Already renders a **system chip**; the channel chip matches its styling. |
| `src/client/CardDetail.tsx` | The detail panel. |
| `src/client/api.ts` | Typed client for the Worker API. |

Exemplar to match for the chip: the existing system chip in `Card.tsx`. Match its
markup and Tailwind classes exactly, then vary only the label and colour.

### Test conventions

`test/` holds 23 vitest files. `test/programs-ui.test.tsx` and
`test/tracking-links-ui.test.tsx` are the exemplars for component tests (they use
`test/setup-dom.ts`). `test/linkgen.test.ts` is the exemplar for pure-function tests.
`npm test` is `vitest run`.

E2E lives in `e2e/*.spec.ts` and every spec logs in through `/dev-login`, which needs
`DEV_AUTH=1` in `.dev.vars`. **A fresh worktree has no `.dev.vars`** — see Gotchas.

### Gotchas that will cost you a round if ignored

From `apps/tutorial-tracker-app/CLAUDE.md`, verbatim:

> **A leased `wt` worktree has no `.dev.vars`, and every e2e test needs it.** […]
> Fix: write `DEV_AUTH=1` into `<worktree>/apps/tutorial-tracker-app/.dev.vars` before
> any e2e run.

> **Kill any `:5173` listener before a run you intend to trust.**
> `playwright.config.ts` pins port 5173 with `reuseExistingServer: true`, so a stale
> dev server […] is silently reused and the tests run against the WRONG code or env.

> **`wrangler dev` serves a STALE snapshot of `dist/`.** After ANY client (SPA) rebuild
> you MUST **restart `wrangler dev`**.

> **Link generation needs the D1 schema in the LOCAL D1.** […] seed it once:
> `npx wrangler d1 execute clicks-db --local --file=../redirector/migrations/0001_init.sql`

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `cd apps/tutorial-tracker-app && npm install` | exit 0 (local `.npmrc` pins public registry) |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | exit 0 |
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Lint | `cd apps/tutorial-tracker-app && npm run lint` | exit 0 |
| Build SPA | `cd apps/tutorial-tracker-app && npm run build` | exit 0, writes `dist/` |
| Seed local D1 | `cd apps/tutorial-tracker-app && npm run seed:local` | exit 0 |
| Seed clicks schema locally | `cd apps/tutorial-tracker-app && npx wrangler d1 execute clicks-db --local --file=../redirector/migrations/0001_init.sql` | exit 0 |
| Local dev (UI work) | `cd apps/tutorial-tracker-app && npm run dev:local` | Vite on :5173, API on :8787 |
| Screenshot | `cd apps/tutorial-tracker-app && npm run shot -- admin` | writes a PNG |
| Migration local | `cd apps/tutorial-tracker-app && npx wrangler d1 execute tracker-db --local --file=migrations/0007_cards_channel.sql` | exit 0 |
| Migration remote | `cd apps/tutorial-tracker-app && npx wrangler d1 execute tracker-db --remote --file=migrations/0007_cards_channel.sql` | exit 0 |
| Merge gate | `(cd apps/tutorial-tracker-app && npm test) && node --test config/channels.test.mjs` | exit 0 |

## Scope

**In scope**:
- `apps/tutorial-tracker-app/migrations/0007_cards_channel.sql` (new)
- `apps/tutorial-tracker-app/src/worker/channels.ts` (new)
- `apps/tutorial-tracker-app/src/worker/index.ts` (edit)
- `apps/tutorial-tracker-app/src/worker/clickstore.ts` (edit)
- `apps/tutorial-tracker-app/src/worker/datastore.ts` (edit)
- `apps/tutorial-tracker-app/src/client/{api.ts,NewVideoDialog.tsx,Filters.tsx,Card.tsx,CardDetail.tsx}` (edit)
- `apps/tutorial-tracker-app/scripts/seed-local.ts` (edit)
- `apps/tutorial-tracker-app/test/channels.test.ts` (new)
- `apps/tutorial-tracker-app/test/channels-ui.test.tsx` (new)
- `apps/tutorial-tracker-app/e2e/channel-picker.spec.ts` (new)
- `apps/tutorial-tracker-app/CLAUDE.md` (edit)
- `apps/tutorial-tracker-app/wrangler.toml` (edit — comment on `LINK_DOMAIN` only)

**Out of scope** — looks related, do not touch:
- `src/shared/engine/**` — channel is not a stage, status, field widget or access
  dimension. Editing the engine risks the documented two-source-of-truth trap for zero
  benefit.
- `src/shared/{pipeline,control,rbac,policy,lifecycle}.ts` — legacy, superseded.
- The `programs` table and `ProgramsView.tsx` — the catalogue is deliberately SHARED
  across channels (owner decision).
- The `employees` table and `TeamPanel.tsx` — team scoping already works per system and
  needs no change.
- `generateVideoCode` and the slug shape — published URLs are permanent.
- `apps/analytics-app/**` (plan 263), `pipelines/**` (plan 264).

## Git workflow

- Branch: `advisor/262-tracker-channel-aware`
- Commit per step. One conventional-commit line each, no body, no AI footers. Do NOT push.

## Steps

### Step 1: The migration

Create `apps/tutorial-tracker-app/migrations/0007_cards_channel.sql`:

```sql
-- Which YouTube channel a card's video is for. Until now every card was implicitly
-- @AgrolloReviews.
--
-- Channel is deliberately a COLUMN, not a new PipelineDef: a "system" here is a
-- workflow (which stages exist, who reviews), and every channel runs the same
-- workflows. Cloning standard.ts per channel would duplicate the stage list, the role
-- roster and the access grid, and every future stage fix would need applying N times.
--
-- Ids come from config/channels.json. 'agrollo' = @AgrolloReviews.
-- Additive and nullable so a read path that predates this column keeps working.

ALTER TABLE cards ADD COLUMN channel_id TEXT;

UPDATE cards SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cards_channel ON cards(channel_id);
```

**Verify (local)**: `cd apps/tutorial-tracker-app && npx wrangler d1 execute tracker-db --local --file=migrations/0007_cards_channel.sql` -> exit 0
**Verify (remote)**: apply with `--remote`, then
`npx wrangler d1 execute tracker-db --remote --command "SELECT COUNT(*) AS n FROM cards WHERE channel_id IS NULL"` -> `n = 0`

### Step 2: The Worker-side channel module

Create `apps/tutorial-tracker-app/src/worker/channels.ts`. This is the ONLY place the
tracker resolves a channel; every call site goes through it.

```ts
/**
 * channels.ts — the tracker's view of config/channels.json.
 *
 * The registry is a repo-root file (plan 261); a Worker bundles it directly. This
 * module is the single resolution point: no other file may read the JSON or hardcode
 * a link domain.
 *
 * WHY THE DOMAIN COMES FROM HERE AND NOT env.LINK_DOMAIN: a short link is minted onto
 * the domain of the channel that will publish the video. One env var can only ever be
 * right for one channel, and minting onto the wrong domain produces a link that
 * resolves (KV is one flat namespace) while attributing the click to nobody.
 */
import registry from "../../../../config/channels.json";

export interface ChannelProfile {
  voice_slug: string;
  avatar_slug: string;
  brand: string;
  taste_file: string;
  style_dna: string | null;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
  profile: ChannelProfile;
}

const ALL = registry.channels as Channel[];

export const DEFAULT_CHANNEL_ID: string = registry.default_channel_id;

/** Non-archived channels, in registry order. What a picker shows. */
export function listChannels(channels: Channel[] = ALL): Channel[] {
  return channels.filter((c) => !c.archived);
}

/**
 * Includes archived channels, so an old card still resolves.
 *
 * The `channels` parameter exists so tests can pass a SYNTHETIC channel list. That is
 * not decoration: with only one channel in the shipped registry, a hardcoded
 * `linkDomainFor` would return the one correct answer and every assertion against the
 * real file would pass. The gate has to resolve a channel that is not in the file.
 */
export function getChannel(id: string, channels: Channel[] = ALL): Channel {
  const found = channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: ${JSON.stringify(id)} is not in config/channels.json`);
  return found;
}

/** A card's channel id, tolerating rows written before 0007. */
export function channelIdOf(row: { channel_id?: string | null }): string {
  const id = (row.channel_id ?? "").trim();
  return id || DEFAULT_CHANNEL_ID;
}

/**
 * The short-link domain for a channel. The gate in test/channels.test.ts asserts this
 * really reads the registry — a hardcoded return here would let every channel mint on
 * go.agrolloo.com and nothing else would notice.
 */
export function linkDomainFor(id: string, channels: Channel[] = ALL): string {
  return getChannel(id, channels).link_domain;
}
```

You may need `"resolveJsonModule": true` in `tsconfig.worker.json`. Add it if the
compiler asks; do not add it speculatively.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 3: The channel-resolution gate

Create `apps/tutorial-tracker-app/test/channels.test.ts`. The last test is the gate the
mutation recipe fires: it proves `linkDomainFor` reads the registry rather than
returning a constant.

```ts
import { describe, expect, it } from "vitest";
import registry from "../../../config/channels.json";
import { DEFAULT_CHANNEL_ID, channelIdOf, getChannel, linkDomainFor, listChannels } from "../src/worker/channels";

describe("channel resolution", () => {
  it("lists at least the default channel", () => {
    expect(listChannels().length).toBeGreaterThan(0);
  });

  it("hides archived channels from the picker but still resolves them", () => {
    const archived = registry.channels.filter((c) => c.archived).map((c) => c.id);
    for (const id of archived) {
      expect(listChannels().map((c) => c.id)).not.toContain(id);
      expect(getChannel(id).id).toBe(id);
    }
  });

  it("throws on an unknown channel id", () => {
    expect(() => getChannel("does-not-exist")).toThrow(/CHANNEL_UNKNOWN/);
  });

  it("treats a card with no channel_id as the default channel", () => {
    expect(channelIdOf({})).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: null })).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: "  " })).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: "agrollo" })).toBe("agrollo");
  });

  // GATE. linkDomainFor must READ the registry, not return a constant.
  //
  // Asserting only against the shipped file would be VACUOUS while one channel is
  // seeded: a hardcoded "go.agrolloo.com" is the one right answer. So the gate
  // resolves a SYNTHETIC channel that is not in the file and cannot be guessed.
  it("resolves each channel's own link domain from the registry", () => {
    for (const c of registry.channels) {
      expect(
        linkDomainFor(c.id),
        `CHANNEL_DOMAIN_NOT_RESOLVED: linkDomainFor(${c.id}) must return ${c.link_domain}`,
      ).toBe(c.link_domain);
    }

    const probe = { ...registry.channels[0], id: "__probe__", link_domain: "go.probe.test" };
    const synthetic = [...registry.channels, probe];
    expect(
      linkDomainFor("__probe__", synthetic),
      "CHANNEL_DOMAIN_NOT_RESOLVED: linkDomainFor must read the channel it is given, not a constant",
    ).toBe("go.probe.test");
    expect(
      linkDomainFor(registry.channels[0].id, synthetic),
      "CHANNEL_DOMAIN_NOT_RESOLVED: resolution must stay per-channel",
    ).toBe(registry.channels[0].link_domain);
  });
});
```

**Verify**: `cd apps/tutorial-tracker-app && npm test -- channels` -> exit 0, 5 tests pass

### Step 4: Prove the gate fires

Temporarily edit `src/worker/channels.ts` so `linkDomainFor` returns the literal
`"go.agrolloo.com"`, run the tests, confirm the failure names
`CHANNEL_DOMAIN_NOT_RESOLVED`, then revert.

> This is the check that would have caught a vacuous gate. Run it exactly as written;
> if the tests still PASS with the hardcoded return, the gate is worthless — fix the
> test before continuing, and say so in the run log.

**Verify**: `cd apps/tutorial-tracker-app && npm test` -> FAILS, output contains `CHANNEL_DOMAIN_NOT_RESOLVED`
**Verify after revert**: `git diff --exit-code src/worker/channels.ts` -> exit 0
**Verify after revert**: `cd apps/tutorial-tracker-app && npm test` -> exit 0

### Step 5: `clickstore.insertVideo` stamps the channel

In `src/worker/clickstore.ts`, change `insertVideo` to take and write `channelId`:

```ts
    .prepare("INSERT INTO videos (video_code, video_title, channel_id, created_at) VALUES (?, ?, ?, ?)")
```

Update the signature to `insertVideo(db, videoCode, videoTitle, channelId)` and update
its doc comment to note that `channel_id` is what lets the analytics dashboard split
clicks per channel.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0 (both call
sites in `index.ts` will now be compile errors until Step 6 — that is expected and is
the point of doing this step first)

### Step 6: The Worker endpoints

1. **`GET /api/channels`** (any signed-in user). Returns
   `{ channels: [{id, name, handle, link_domain}], default_channel_id }` from
   `listChannels()`. Do NOT leak `owner_account` to the client — it is an account
   identity, not display data.

2. **`POST /api/video`** — accept `body.channel_id`, mirroring the existing
   `body.pipeline` pattern:

```ts
  // Which system this video runs on (defaults to standard).
  const pipe = getPipeline((body.pipeline ?? DEFAULT_PIPELINE_ID).trim());
  // Which channel will publish it (defaults to the registry's default channel).
  const channelId = (body.channel_id ?? DEFAULT_CHANNEL_ID).trim();
  getChannel(channelId); // throws CHANNEL_UNKNOWN on a bad id — reject, never guess
```

   Return `400 {error: "unknown_channel", message}` when `getChannel` throws, rather
   than letting a 500 escape. Persist `channel_id` on the new card via the datastore.

3. **Board rows carry the channel.** Wherever a row is assembled for `GET /api/board`,
   include `channel_id` (using `channelIdOf`) so the client never has to guess. This is
   plain card data, not a stage column — do NOT route it through the engine's
   access/derive layers.

4. **Minting uses the card's channel.** In `/api/link-preview` and `/api/link-confirm`,
   replace all three `c.env.LINK_DOMAIN` uses:

```ts
  const channelId = channelIdOf(target as { channel_id?: string | null });
  const linkDomain = linkDomainFor(channelId);
  const items = buildPlan(resolved, videoCode, linkDomain);
  const description = renderDescription(title, items);
  validateDescription(description, items, linkDomain);
```

   and pass `channelId` to both `clickstore.insertVideo` calls.

5. **`wrangler.toml`** — leave `LINK_DOMAIN` in place (other code may still read it)
   but add above it:

```toml
# DEPRECATED for minting. Short-link domains now come from config/channels.json via
# src/worker/channels.ts, because one var can only ever be right for one channel.
LINK_DOMAIN = "go.agrolloo.com"
```

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck && npm test` -> exit 0
**Verify**: `cd apps/tutorial-tracker-app && npm run lint` -> exit 0

### Step 7: The datastore

In `src/worker/datastore.ts`, include `channel_id` in the cards INSERT and in the
SELECT that assembles rows. Follow the existing `pipeline_id` handling exactly — where
`pipeline_id` is read or written, `channel_id` goes beside it.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 8: Seed data

In `scripts/seed-local.ts`, add `channel_id` to the recreated `cards` table and give
every seeded card `'agrollo'`. Add ONE seeded card on a second synthetic channel only
if the registry contains one — it does not today, so with the shipped registry every
seeded card is `agrollo`.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local` -> exit 0
**Verify**: `cd apps/tutorial-tracker-app && npx wrangler d1 execute tracker-db --local --command "SELECT channel_id, COUNT(*) AS n FROM cards GROUP BY channel_id"` -> one row, `agrollo`

### Step 9: The client

1. **`src/client/api.ts`** — add `channel_id` to the row type, add the
   `getChannels()` call, and add `channel_id` to the new-video payload type.

2. **`NewVideoDialog.tsx`** — a **Channel** select beside the existing type picker.
   Options come from `/api/channels`. Default = `default_channel_id`. When exactly ONE
   non-archived channel exists, render it as a disabled select showing that channel's
   name (not hidden — the operator should see which channel they are publishing to),
   with `title="Only one channel is configured. Add channels in config/channels.json."`

3. **`Card.tsx`** — a channel chip next to the existing system chip, matching its
   markup and classes. Show it only when more than one non-archived channel exists;
   with a single channel the chip is noise on every card.

4. **`CardDetail.tsx`** — show the channel name in the detail header, always (even with
   one channel), beside the system name. Read-only: a card's channel is set at creation
   and is not editable here.

5. **`Filters.tsx`** — a channel filter, matching the existing filter controls'
   markup. `All channels` is the default. Show the control only when more than one
   non-archived channel exists.

**Degraded and empty states — implement each explicitly:**

| Situation | What renders | What actions do |
|---|---|---|
| `/api/channels` returns an error or is unreachable | Dialog shows the channel select disabled, labelled with `default_channel_id`, plus an inline `Couldn't load channels — using the default.` | Create still works and sends no `channel_id`; the Worker defaults it. Never block creation on this. |
| Exactly one non-archived channel | Disabled select in the dialog; **no** chip on cards; **no** filter control; channel name still shown in card detail | Create sends that channel's id |
| A card's `channel_id` is not in the registry (channel deleted from the file) | Chip and detail render the raw id with a `?` suffix, title `This channel is no longer in config/channels.json` | Minting on that card is DISABLED with that same title. Never mint onto a guessed domain. |
| A card with `channel_id` NULL (predates 0007) | Renders as the default channel | Behaves as the default channel |

**Verify**: `cd apps/tutorial-tracker-app && npm run build && npm run lint` -> exit 0

### Step 10: Component tests

Create `apps/tutorial-tracker-app/test/channels-ui.test.tsx`, following
`test/programs-ui.test.tsx` for setup and render style. Cover, one test each:

1. The dialog renders a Channel select with the default preselected.
2. With one channel, the select is disabled and no filter control renders.
3. With two channels (mock the API response), the filter renders and choosing one
   narrows the visible cards.
4. A card whose `channel_id` is unknown renders the raw id with the `?` suffix and its
   mint action is disabled.
5. A failed `/api/channels` fetch still lets the dialog submit.

**Verify**: `cd apps/tutorial-tracker-app && npm test` -> exit 0
**Verify (artifact, not just green)**: `test -f test/channels-ui.test.tsx && test -f test/channels.test.ts` -> exit 0
**Verify (count)**: `cd apps/tutorial-tracker-app && npm test 2>&1 | grep -E "Tests +[0-9]+ passed"` -> the number is at least 10 higher than on `ddc5f4dd`

> Why the artifact check: vitest exits 0 when a specified test file is simply absent.
> Plan 204 shipped with zero of its 11 specified component tests and the merge gate was
> green (LESSONS 2026-08-17).

### Step 11: E2E and the screenshot

1. Write `DEV_AUTH=1` into `apps/tutorial-tracker-app/.dev.vars` if the file is absent.
2. `pkill -f "vite" ; pkill -f "wrangler dev"` — kill any stale :5173 / :8787 listener.
3. Seed: `npm run seed:local` and seed the local clicks schema (see Commands).
4. Create `e2e/channel-picker.spec.ts` following `e2e/new-video-setup.spec.ts`: log in
   as admin, open the new-video dialog, assert the Channel select exists and shows
   `Agrollo Reviews`, submit, and assert the created card's detail shows that channel.
5. Take the screenshot the `ui: true` gate requires and COMMIT it:
   `npm run shot -- admin`. It must show the board with the card detail open on a card
   whose channel is visible.

**Verify**: `cd apps/tutorial-tracker-app && npm run e2e` -> exit 0
**Verify**: `git status --porcelain | grep -E "\.png$"` -> the screenshot is staged/committed

### Step 12: Documentation

1. `apps/tutorial-tracker-app/CLAUDE.md` — add a **Channels** section under the
   READ-FIRST block recording: channel is a COLUMN on `cards`, not a `PipelineDef`, and
   why; `src/worker/channels.ts` is the single resolution point; minting reads the
   card's channel domain and `env.LINK_DOMAIN` is deprecated for minting; the Programs
   catalogue is shared across channels by decision; team scoping is unchanged.
2. Append one dated line to `decisions.md`:
   `- 2026-08-30 — **A channel is a column on `cards`, not a PipelineDef.** ...` Record
   that systems are workflows and channels are publication targets, that cloning
   `standard.ts` per channel would duplicate the stage list/role roster/access grid N
   times, and that the Programs catalogue stays shared while team stays per-system.
3. Update the plan's row in `plans/README.md`.

**Verify**: `grep -q "Channels" apps/tutorial-tracker-app/CLAUDE.md && grep -q "2026-08-30" decisions.md` -> exit 0

### Step 13: Fresh-checkout gate run

```bash
git clean -xdf apps/tutorial-tracker-app/node_modules apps/tutorial-tracker-app/dist 2>/dev/null || true
(cd apps/tutorial-tracker-app && npm install && npm test) && node --test config/channels.test.mjs
```

**Verify**: exit 0

## Test plan

- `test/channels.test.ts` (5 tests) — resolution, archived handling, unknown ids, NULL
  tolerance, and the `CHANNEL_DOMAIN_NOT_RESOLVED` gate. Step 4 proves the gate fires.
- `test/channels-ui.test.tsx` (5 tests) — picker, single-channel degradation, filtering,
  unknown-channel card, failed-fetch fallback.
- `e2e/channel-picker.spec.ts` — the real create flow through a real Worker.
- Live D1 count queries confirm both backfills left zero NULLs.
- Existing suites (`engine.test.ts`, `rbac.test.ts`, `linkgen.test.ts`) must stay green.
  They are the proof that channel did not leak into the engine.

## Done criteria

- [ ] `cd apps/tutorial-tracker-app && npm test` exits 0, and the passing-test count is
      at least 10 higher than at `ddc5f4dd`.
- [ ] `test -f apps/tutorial-tracker-app/test/channels.test.ts && test -f apps/tutorial-tracker-app/test/channels-ui.test.tsx && test -f apps/tutorial-tracker-app/e2e/channel-picker.spec.ts && test -f apps/tutorial-tracker-app/src/worker/channels.ts && test -f apps/tutorial-tracker-app/migrations/0007_cards_channel.sql` exits 0.
- [ ] `npm run typecheck` and `npm run lint` both exit 0.
- [ ] `npm run e2e` exits 0.
- [ ] Step 4 was executed: the tests were observed FAILING with
      `CHANNEL_DOMAIN_NOT_RESOLVED`, and `git diff --exit-code src/worker/channels.ts`
      exits 0 afterwards.
- [ ] `wrangler d1 execute tracker-db --remote --command "SELECT COUNT(*) AS n FROM cards WHERE channel_id IS NULL"` returns `n = 0`.
- [ ] `rtk proxy grep -rn "env.LINK_DOMAIN" apps/tutorial-tracker-app/src` returns no
      hits inside `/api/link-preview` or `/api/link-confirm`.
- [ ] A screenshot PNG is committed on the branch.
- [ ] `git diff --stat ddc5f4dd..HEAD -- apps/tutorial-tracker-app` lists only In-scope files.
- [ ] `git diff --stat ddc5f4dd..HEAD -- apps/tutorial-tracker-app/src/shared/engine` is EMPTY.

## STOP conditions

- **A gate assertion fails and the obvious fix is to weaken it.** Fix the code or the
  fixture. Weakening, swapping or deleting an assertion is a STOP.
- **You are about to edit `src/shared/engine/`.** Channel is not a stage, status, field
  widget or access dimension. If something seems to require an engine change, stop and
  report what and why — this is where the two-source-of-truth trap lives.
- **You are about to change `generateVideoCode`, a slug, or an existing short URL.**
  Those are published inside YouTube descriptions and are permanent.
- **You are about to give `programs` a `channel_id`, or split the catalogue.** The
  owner decided the catalogue stays shared. Stop and report.
- **A card's channel id is not in the registry and you are tempted to fall back to the
  default for MINTING.** Rendering falls back; minting must not. Disable the action.
- **The remote migration errors, or the NULL count is not 0 afterwards.** Do not
  hand-patch rows; stop and report the exact error.
- **E2E fails inside `loginAs` at `page.waitForURL`, or a screenshot is a blank white
  page reading "Not found".** That is the missing `.dev.vars` / `DEV_AUTH=1` trap, not
  your code. Fix the env and re-run; if it persists, stop and report.
- **Done criteria still fail after 5 fix attempts.** Write
  `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- `src/worker/channels.ts` is the single resolution point. If a second file starts
  reading `config/channels.json` or hardcoding a domain, that is the bug to fix.
- The `CHANNEL_DOMAIN_NOT_RESOLVED` gate exists because a hardcoded `linkDomainFor`
  would let every channel mint onto `go.agrolloo.com` while every other test stayed
  green. Never soften it.
- `env.LINK_DOMAIN` survives as a deprecated var. A future cleanup can remove it once
  nothing reads it; check with `rtk proxy grep -rn LINK_DOMAIN apps/`.
- Plan 263 (analytics) reads `videos.channel_id`, which this plan is the only writer
  of. If minting stops stamping it, the dashboard silently under-reports — exactly the
  failure class of the 2026-08-28 `yt_video_id` gap, where 54 of 69 clicks were
  invisible for months because nothing wrote the column.
- A reviewer should scrutinise: that the engine directory is untouched; that all three
  `LINK_DOMAIN` call sites moved; that both `insertVideo` calls pass a channel; and
  that Step 4 was really executed.
