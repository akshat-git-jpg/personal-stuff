---
executor: agy
model:
test_cmd: (cd apps/analytics-app && npm test) && node --test config/channels.test.mjs
ui: true
deploy:
needs: ["261 must land first: this plan imports config/channels.mjs and reads clicks-db.videos.channel_id"]
needs_prs: [261]
touches: [apps/analytics-app/package.json, apps/analytics-app/vitest.config.ts, apps/analytics-app/src/worker/channels.ts, apps/analytics-app/src/worker/analytics.ts, apps/analytics-app/src/worker/rankings.ts, apps/analytics-app/src/worker/auth.ts, apps/analytics-app/src/worker/index.ts, apps/analytics-app/src/client/App.tsx, apps/analytics-app/src/client/api.ts, apps/analytics-app/src/client/RankingsView.tsx, apps/analytics-app/src/client/UploadsView.tsx, apps/analytics-app/migrations/0002_rankings_channel.sql, apps/analytics-app/wrangler.toml, apps/analytics-app/test/channels.test.ts, apps/analytics-app/CLAUDE.md]

mutation_apply: node -e "const fs=require('fs');const f='apps/analytics-app/src/worker/channels.ts';let s=fs.readFileSync(f,'utf8');const o=s;s=s.replace(/export function uploadsPlaylistFor[\s\S]*?\n\}/, 'export function uploadsPlaylistFor(){ return \"UUXuXNNuyhtdsiw9bZr0pUxw\" }');if(s===o){console.error('MUTATION_NOT_APPLIED');process.exit(1)}fs.writeFileSync(f,s)"
mutation_command: cd apps/analytics-app && npm test
mutation_expect: CHANNEL_PLAYLIST_NOT_RESOLVED
mutation_cwd:
mutation_timeout:
---

# Plan 263: The analytics dashboard gets a channel switcher

## Summary

- **Problem statement**: `apps/analytics-app` has one channel baked into
  `wrangler.toml` as `CHANNEL_ID = "UCXuXNNuyhtdsiw9bZr0pUxw"`. It can only ever show
  `@AgrolloReviews`. Rankings rows carry no channel either, so keyword history from
  different channels would pile into one undifferentiated list.
- **Goals**:
  - Drive the video list from `config/channels.json` instead of one env var.
  - Add a channel switcher that scopes all three tabs (Clicks, Uploads, Rankings).
  - Tag `keywords` rows with `channel_id`, backfilled to `agrollo`.
  - Make the shared-quota reality visible instead of surprising.
- **Decisions confirmed**:
  - API quota -> keep ONE shared `YT_API_KEY`. All channels split 10,000 units/day,
    so the UI must say so rather than fail mysteriously.
  - Registry home -> `config/channels.json` (landed by plan 261).
  - Seeding -> `agrollo` only.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — schema, endpoints and UI
  behaviour are inlined below; `rules.md` default row.
- **Done criteria** (terse): a test suite exists at all (the app has none today),
  the playlist gate fires, `/api/channels` serves the registry, all three tabs scope
  by channel, migration backfilled, one screenshot committed.
- **Stop conditions** (terse): writing to `clicks-db`; rebuilding the `keywords`
  table; weakening a gate assertion; burning quota in a test.
- **Test / verification for success**: new vitest suite including a
  `CHANNEL_PLAYLIST_NOT_RESOLVED` gate, plus a committed screenshot of the switcher.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ddc5f4dd..HEAD -- apps/analytics-app config`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — the app reads the money database. It must stay strictly read-only
  there, and this plan adds its first automated tests.
- **Depends on**: plan 261 (registry + `clicks-db.videos.channel_id`). Runs in
  parallel with 262 — they share no files.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ddc5f4dd`, 2026-08-30

## Why this matters

This dashboard is the only place the owner sees whether a video worked. With several
channels it becomes the only place he can compare them — and today it cannot show a
second channel at all. Worse, it would not *fail*: it would keep showing Agrollo's
uploads while click rows from every other channel sat in `clicks-db` unseen.

That exact failure already happened here once. From `apps/analytics-app/src/worker/analytics.ts`:

> This existed unnoticed for months: on 2026-08-28 the dashboard showed 2 of 69
> recorded clicks, and four videos holding 54 clicks rendered as "No links for this
> video" — indistinguishable from a video that genuinely has none.

The lesson taken from that is the shape of this plan: data that cannot be attributed
must be *shown as unattributed*, never silently dropped.

## Current state

### The app has NO tests

`apps/analytics-app/package.json` has no `test` script and no test runner:

```json
  "scripts": {
    "dev": ". ../../scripts/node22-path.sh && vite",
    "build": ". ../../scripts/node22-path.sh && tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": ". ../../scripts/node22-path.sh && tsc -b",
    "preview": ". ../../scripts/node22-path.sh && vite preview",
    "deploy": ". ../../scripts/node22-path.sh && npm run build && wrangler deploy"
  },
```

This plan adds vitest and the first suite. Without it there is no merge gate.

### One channel, one var — `wrangler.toml`

```toml
[vars]
LINK_DOMAIN = "go.agrolloo.com"
# Channel whose PUBLIC uploads are the source of truth for the video list
# (@AgrolloReviews). Uploads playlist is derived as "UU" + id.slice(2).
CHANNEL_ID = "UCXuXNNuyhtdsiw9bZr0pUxw"
```

### `src/worker/analytics.ts:107` — where the channel enters

```ts
export async function getVideoStats(env: Env): Promise<VideoStatsResult> {
  // D1 link/click data, keyed by YouTube video id. D1 is the click source only.
  const { byYt: linksByYt, unmatched } = await loadLinksByYouTubeId(env);

  // YouTube uploads are the source of truth for which videos exist.
  if (!env.YT_API_KEY || !env.CHANNEL_ID) {
    return {
      videos: [],
      youtube_ok: false,
      unmatched,
      youtube_error: "YouTube isn't configured (missing API key or channel id).",
    };
  }

  // Uploads playlist id = channel id with the "UC" prefix swapped to "UU".
  const uploadsPlaylist = "UU" + env.CHANNEL_ID.slice(2);
```

and at line 236 the short URL is built from the other var:

```ts
      short_url: `https://${env.LINK_DOMAIN}/${slug}`,
```

### `src/worker/auth.ts:20` — the Env type

```ts
  DB: D1Database;
  /** This app's own DB for keyword rank tracking (read + write). */
  RANKINGS_DB: D1Database;
  LINK_DOMAIN: string;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  /** YouTube Data API key — used to list the channel's uploads + fetch views. Required for the video list. */
  YT_API_KEY?: string;
  /** YouTube channel id (UC…) whose public uploads are the source of truth for the video list. */
  CHANNEL_ID?: string;
};
```

### `migrations/0001_rankings.sql` — this app's own DB

```sql
CREATE TABLE IF NOT EXISTS keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  yt_video_id TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (yt_video_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keywords_video ON keywords (yt_video_id);

CREATE TABLE IF NOT EXISTS rank_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords (id) ON DELETE CASCADE,
  rank       INTEGER,
  not_in_top INTEGER NOT NULL DEFAULT 0,
  checked_at INTEGER NOT NULL
);
```

**The `UNIQUE (yt_video_id, keyword)` constraint does not need changing.** A YouTube
video id belongs to exactly one channel, so `channel_id` on `keywords` is purely for
filtering — an additive nullable column, no table rebuild.

### `clicks-db` is READ ONLY here

From `apps/analytics-app/CLAUDE.md`:

> Binds the redirector's `clicks-db` D1 […] This app ONLY reads `videos`/`links`/`clicks`
> and ONLY for click data — never INSERT/UPDATE/migrate here.

After plan 261, `videos.channel_id` exists. Read it. Never write it.

### Quota, and why the owner chose one key

Also from that CLAUDE.md:

> **Quota**: each keyword check = 1 `search.list` = **100 units** (vs 1 unit for the
> videos.list calls); default daily quota 10,000 ≈ 100 checks/day. So checks are manual
> + per-video by design, never on page load. A 403 quotaExceeded stops the run, keeps
> partial results, and flags `quota_exhausted` for the UI.

The owner chose to keep ONE shared key. That is a valid call, but it means all channels
divide ~100 checks/day between them. The UI must say that plainly (Step 8) so an
exhausted quota reads as "the budget is shared" and not "the dashboard is broken".

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `cd apps/analytics-app && npm install` | exit 0 |
| Unit tests | `cd apps/analytics-app && npm test` | exit 0 |
| Typecheck | `cd apps/analytics-app && npm run typecheck` | exit 0 |
| Lint | `cd apps/analytics-app && npm run lint` | exit 0 |
| Build | `cd apps/analytics-app && npm run build` | exit 0 |
| Local dev | `cd apps/analytics-app && npm run build && npx wrangler dev --local` | serves :8787 |
| Rankings migration local | `cd apps/analytics-app && npx wrangler d1 migrations apply yt-rankings --local` | exit 0 |
| Rankings migration remote | `cd apps/analytics-app && npx wrangler d1 migrations apply yt-rankings --remote` | exit 0 |
| Backfill check | `cd apps/analytics-app && npx wrangler d1 execute yt-rankings --remote --command "SELECT COUNT(*) AS n FROM keywords WHERE channel_id IS NULL"` | `n = 0` |
| Merge gate | `(cd apps/analytics-app && npm test) && node --test config/channels.test.mjs` | exit 0 |

## Scope

**In scope**:
- `apps/analytics-app/package.json` (add vitest + `test` script)
- `apps/analytics-app/vitest.config.ts` (new)
- `apps/analytics-app/test/channels.test.ts` (new)
- `apps/analytics-app/test/analytics-scope.test.ts` (new)
- `apps/analytics-app/src/worker/channels.ts` (new)
- `apps/analytics-app/src/worker/{analytics.ts,rankings.ts,auth.ts,index.ts}` (edit)
- `apps/analytics-app/src/client/{App.tsx,api.ts,RankingsView.tsx,UploadsView.tsx}` (edit)
- `apps/analytics-app/migrations/0002_rankings_channel.sql` (new)
- `apps/analytics-app/wrangler.toml` (edit)
- `apps/analytics-app/CLAUDE.md` (edit)

**Out of scope** — looks related, do not touch:
- Any write to `clicks-db`. Read-only, by contract. Its schema lives in
  `apps/redirector/migrations/`.
- The click de-duplication logic. It must stay byte-identical to
  `pipelines/youtube/yt-analysis/sync_clicks.py` or the dashboard and the sheet
  disagree.
- The auth model. Shared password + signed cookie stays exactly as it is; channel is
  not an access dimension.
- `apps/tutorial-tracker-app/**` (plan 262), `pipelines/**` (plan 264).
- Obtaining a second API key. The owner chose one shared key.

## Git workflow

- Branch: `advisor/263-analytics-channel-switcher`
- Commit per step. One conventional-commit line each, no body, no AI footers. Do NOT push.

## Steps

### Step 1: Give the app a test runner

Add to `package.json`:

```json
    "test": ". ../../scripts/node22-path.sh && npm install && vitest run",
```

and `vitest` plus `jsdom` and `@testing-library/react` to `devDependencies` (match the
versions used in `apps/tutorial-tracker-app/package.json` so the two apps do not drift).

Create `apps/analytics-app/vitest.config.ts` mirroring the tracker's vitest setup.

**Verify**: `cd apps/analytics-app && npm install && npm test` -> exit 0 (no tests yet
is fine at this step only; the next step adds them)

### Step 2: The Worker-side channel module

Create `apps/analytics-app/src/worker/channels.ts`:

```ts
/**
 * channels.ts — the dashboard's view of config/channels.json.
 *
 * The registry is a repo-root file (plan 261); a Worker bundles it directly. This is
 * the single resolution point: no other file may read the JSON or hardcode a channel
 * id, a playlist id or a link domain.
 */
import registry from "../../../../config/channels.json";

export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
}

const ALL = registry.channels as Channel[];

export const DEFAULT_CHANNEL_ID: string = registry.default_channel_id;

export function listChannels(channels: Channel[] = ALL): Channel[] {
  return channels.filter((c) => !c.archived);
}

/**
 * The `channels` parameter exists so tests can pass a SYNTHETIC channel list. That is
 * not decoration: with one channel in the shipped registry, a hardcoded playlist id is
 * the one right answer, so a gate that only checks the real file passes vacuously.
 */
export function getChannel(id: string, channels: Channel[] = ALL): Channel {
  const found = channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: ${JSON.stringify(id)} is not in config/channels.json`);
  return found;
}

/**
 * The uploads playlist for a channel: the channel id with "UC" swapped for "UU".
 * The gate in test/channels.test.ts asserts this really reads the registry — a
 * hardcoded playlist would show one channel's uploads under every channel's name.
 */
export function uploadsPlaylistFor(id: string, channels: Channel[] = ALL): string {
  return "UU" + getChannel(id, channels).youtube_channel_id.slice(2);
}

export function linkDomainFor(id: string, channels: Channel[] = ALL): string {
  return getChannel(id, channels).link_domain;
}
```

Add `"resolveJsonModule": true` to `tsconfig.worker.json` if the compiler asks.

**Verify**: `cd apps/analytics-app && npm run typecheck` -> exit 0

### Step 3: The channel gate

Create `apps/analytics-app/test/channels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import registry from "../../../config/channels.json";
import { DEFAULT_CHANNEL_ID, getChannel, linkDomainFor, listChannels, uploadsPlaylistFor } from "../src/worker/channels";

describe("channel resolution", () => {
  it("the default channel is listed", () => {
    expect(listChannels().map((c) => c.id)).toContain(DEFAULT_CHANNEL_ID);
  });

  it("throws on an unknown channel id", () => {
    expect(() => getChannel("does-not-exist")).toThrow(/CHANNEL_UNKNOWN/);
  });

  it("resolves each channel's own link domain", () => {
    for (const c of registry.channels) {
      expect(linkDomainFor(c.id)).toBe(c.link_domain);
    }
  });

  // GATE. uploadsPlaylistFor must READ the registry. A hardcoded playlist would show
  // one channel's uploads under every channel's name, with no error anywhere.
  //
  // Asserting only against the shipped file would be VACUOUS while one channel is
  // seeded: the hardcoded value IS agrollo's playlist. So the gate resolves a
  // SYNTHETIC channel that is not in the file and cannot be guessed.
  it("derives each channel's uploads playlist from its own YouTube id", () => {
    for (const c of registry.channels) {
      const expected = "UU" + c.youtube_channel_id.slice(2);
      expect(
        uploadsPlaylistFor(c.id),
        `CHANNEL_PLAYLIST_NOT_RESOLVED: uploadsPlaylistFor(${c.id}) must be ${expected}`,
      ).toBe(expected);
    }

    const probe = { ...registry.channels[0], id: "__probe__", youtube_channel_id: "UCzzzzzzzzzzzzzzzzzzzzzz" };
    const synthetic = [...registry.channels, probe];
    expect(
      uploadsPlaylistFor("__probe__", synthetic),
      "CHANNEL_PLAYLIST_NOT_RESOLVED: uploadsPlaylistFor must read the channel it is given, not a constant",
    ).toBe("UUzzzzzzzzzzzzzzzzzzzzzz");
    expect(
      uploadsPlaylistFor(registry.channels[0].id, synthetic),
      "CHANNEL_PLAYLIST_NOT_RESOLVED: resolution must stay per-channel",
    ).toBe("UU" + registry.channels[0].youtube_channel_id.slice(2));
  });
});
```

**Verify**: `cd apps/analytics-app && npm test` -> exit 0, 4 tests pass

### Step 4: Prove the gate fires

Temporarily change `uploadsPlaylistFor` to `return "UUXuXNNuyhtdsiw9bZr0pUxw";`, run the
tests, confirm the failure names `CHANNEL_PLAYLIST_NOT_RESOLVED`, then revert.

> This is the check that would have caught a vacuous gate. Run it exactly as written;
> if the tests still PASS with the hardcoded return, the gate is worthless — fix the
> test before continuing, and say so in the run log.

**Verify**: `cd apps/analytics-app && npm test` -> FAILS, output contains `CHANNEL_PLAYLIST_NOT_RESOLVED`
**Verify after revert**: `git diff --exit-code src/worker/channels.ts` -> exit 0
**Verify after revert**: `cd apps/analytics-app && npm test` -> exit 0

### Step 5: The rankings migration

Create `apps/analytics-app/migrations/0002_rankings_channel.sql`:

```sql
-- Which channel a tracked keyword belongs to, so the Rankings tab can scope to the
-- selected channel. Until now every keyword was implicitly @AgrolloReviews.
--
-- Additive and nullable. The UNIQUE (yt_video_id, keyword) constraint deliberately
-- does NOT change: a YouTube video id belongs to exactly one channel, so channel_id
-- here is a filter, not part of identity. Rebuilding the table to widen the key would
-- risk the rank_checks foreign key for no gain.
--
-- Channel ids come from config/channels.json. 'agrollo' = @AgrolloReviews.

ALTER TABLE keywords ADD COLUMN channel_id TEXT;

UPDATE keywords SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_keywords_channel ON keywords (channel_id, yt_video_id);
```

**Verify (local)**: `cd apps/analytics-app && npx wrangler d1 migrations apply yt-rankings --local` -> exit 0
**Verify (remote)**: same with `--remote` -> exit 0
**Verify (backfill)**: `npx wrangler d1 execute yt-rankings --remote --command "SELECT COUNT(*) AS n FROM keywords WHERE channel_id IS NULL"` -> `n = 0`

### Step 6: The Worker endpoints

1. **`src/worker/auth.ts`** — remove `CHANNEL_ID?: string` from `Env` and update the
   `LINK_DOMAIN` doc comment to say it is superseded by the registry. Keep
   `YT_API_KEY` exactly as it is: one shared key, by decision.

2. **`GET /api/channels`** (auth-gated, like the other routes). Returns
   `{ channels: [{id, name, handle}], default_channel_id }`. Do NOT return
   `owner_account` or `youtube_channel_id` — the client needs neither.

3. **`getVideoStats(env, channelId)`** in `analytics.ts`:
   - Replace `env.CHANNEL_ID` with the `channelId` argument.
   - Replace `"UU" + env.CHANNEL_ID.slice(2)` with `uploadsPlaylistFor(channelId)`.
   - Replace `env.LINK_DOMAIN` at line 236 with `linkDomainFor(channelId)`.
   - Change the unconfigured branch: it now fires only on a missing `YT_API_KEY`, and
     the message becomes `"YouTube isn't configured (missing API key)."`
   - Scope the D1 read to the channel: filter `videos` by
     `channel_id = ? OR channel_id IS NULL` when the requested channel is the default,
     and by `channel_id = ?` otherwise. **Reason:** rows written before plan 261's
     backfill, or by an older code path, are NULL and belong to the original channel.
     A NULL row must never disappear from every view.

4. **`GET /api/videos?channel=<id>`** — default to `DEFAULT_CHANNEL_ID` when absent.
   An unknown id returns `400 {error: "unknown_channel"}`. Never silently fall back:
   showing Agrollo's numbers under another channel's name is the failure this plan
   exists to prevent.

5. **`rankings.ts`** — every read filters by the requested channel; every keyword
   INSERT stamps `channel_id`. `POST /api/rankings/check` stays per-video and manual.

**Verify**: `cd apps/analytics-app && npm run typecheck && npm run lint && npm test` -> exit 0

### Step 7: Scope test

Create `apps/analytics-app/test/analytics-scope.test.ts`. Extract the D1 WHERE-clause
builder into a small exported pure function if it is not already one, then test:

1. The default channel's filter matches rows with `channel_id = 'agrollo'` AND rows
   with `channel_id IS NULL`.
2. A non-default channel's filter matches only its own rows and NOT NULL rows.
3. An unknown channel id throws rather than returning an unfiltered query.

**Verify**: `cd apps/analytics-app && npm test` -> exit 0, at least 7 tests total
**Verify**: `test -f apps/analytics-app/test/analytics-scope.test.ts` -> exit 0

### Step 8: The client

1. **`api.ts`** — add `getChannels()`; add `channel` to the videos and rankings calls.

2. **`App.tsx`** — a channel switcher in the header, above the tab row, so it reads as
   scoping everything below it rather than belonging to one tab. Selection persists to
   `localStorage` under `yta.channel`, wrapped in try/catch (private windows throw).
   An unknown or stale stored id falls back to `default_channel_id`.

3. All three tabs (Clicks, `UploadsView.tsx`, `RankingsView.tsx`) refetch on change.

4. **The shared-quota line.** In `RankingsView.tsx`, near the Check control, render:
   `Rank checks cost 100 API units each and all channels share one 10,000/day budget
   (~100 checks a day in total).` When the API flags `quota_exhausted`, the banner must
   name the shared budget and say partial results were kept — not "check failed".

**Degraded and empty states — implement each explicitly:**

| Situation | What renders | What actions do |
|---|---|---|
| `/api/channels` errors | Switcher hidden; the app loads the default channel; a one-line `Couldn't load the channel list — showing <name>.` | Everything else works |
| Exactly one non-archived channel | Switcher renders as static text showing the channel name, not a dropdown | n/a |
| Selected channel has no uploads | Existing empty state, plus the channel name so it reads as "this channel has none" rather than "loading failed" | n/a |
| `youtube_ok: false` | The existing banner, now naming the selected channel | Rankings Check disabled with a title explaining why |
| `quota_exhausted` | Banner naming the shared budget; partial results kept and shown | Check disabled until the next day |
| `unmatched` links (clicks with no YouTube id) | Keep the existing unattributed section. It must remain visible on the default channel | n/a |

**Verify**: `cd apps/analytics-app && npm run build && npm run lint` -> exit 0

### Step 9: Screenshot and deployed-path check

1. `npm run build && npx wrangler dev --local` on :8787.
2. Open the app in a headless browser, log in, and assert the RENDERED text contains
   the channel name — not just that the HTTP request returned 200.

> Why: `curl` returned 200 on three separately broken versions of the script desk
> because the shell HTML always loads (LESSONS 2026-08-23). A status code proves
> nothing about a SPA.

3. Capture a screenshot showing the switcher and the Clicks tab, and COMMIT it. The
   `ui: true` frontmatter makes boss reject the branch without an image.

**Verify**: the headless assertion passes on rendered text
**Verify**: `git status --porcelain | grep -E "\.png$"` -> the screenshot is staged/committed

### Step 10: Config and documentation

1. **`wrangler.toml`** — delete the `CHANNEL_ID` var and its comment. Replace the
   `LINK_DOMAIN` comment with a note that both now come from `config/channels.json`.
   Leave the `LINK_DOMAIN` value itself in place if anything still reads it; if nothing
   does, delete it too and say so in the commit.
2. **`apps/analytics-app/CLAUDE.md`** — rewrite the "Source of truth" section: the
   video list is the SELECTED channel's uploads; `CHANNEL_ID` is gone; `channel_id`
   filtering treats NULL as the default channel and why; the quota is shared across
   channels by decision; the app now HAS tests and `npm test` is the gate.
3. Append one dated line to `decisions.md`:
   `- 2026-08-30 — **The analytics dashboard is channel-scoped, on one shared API key.** ...`
   Record that a NULL `channel_id` is read as the default channel so no pre-backfill row
   vanishes, and that one shared key means ~100 rank checks/day across ALL channels.
4. Update the plan's row in `plans/README.md`.

**Verify**: `! rtk proxy grep -q "CHANNEL_ID" apps/analytics-app/wrangler.toml` -> exit 0
**Verify**: `grep -q "2026-08-30" decisions.md` -> exit 0

### Step 11: Fresh-checkout gate run

```bash
git clean -xdf apps/analytics-app/node_modules apps/analytics-app/dist 2>/dev/null || true
(cd apps/analytics-app && npm install && npm test) && node --test config/channels.test.mjs
```

**Verify**: exit 0

## Test plan

- `test/channels.test.ts` (4 tests) — resolution, unknown ids, link domain, and the
  `CHANNEL_PLAYLIST_NOT_RESOLVED` gate. Step 4 proves the gate fires.
- `test/analytics-scope.test.ts` (3 tests) — NULL rows belong to the default channel;
  a non-default channel sees only its own rows; unknown ids throw.
- A headless render assertion on the deployed local Worker, not a curl status check.
- Live D1 count query confirms the rankings backfill left zero NULLs.

## Done criteria

- [ ] `cd apps/analytics-app && npm test` exits 0 with at least 7 passing tests.
- [ ] `test -f apps/analytics-app/test/channels.test.ts && test -f apps/analytics-app/test/analytics-scope.test.ts && test -f apps/analytics-app/src/worker/channels.ts && test -f apps/analytics-app/migrations/0002_rankings_channel.sql && test -f apps/analytics-app/vitest.config.ts` exits 0.
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` all exit 0.
- [ ] Step 4 was executed: tests observed FAILING with `CHANNEL_PLAYLIST_NOT_RESOLVED`,
      and `git diff --exit-code src/worker/channels.ts` exits 0 afterwards.
- [ ] `rtk proxy grep -rn "CHANNEL_ID" apps/analytics-app/src apps/analytics-app/wrangler.toml` returns no hits.
- [ ] `wrangler d1 execute yt-rankings --remote --command "SELECT COUNT(*) AS n FROM keywords WHERE channel_id IS NULL"` returns `n = 0`.
- [ ] The headless render check asserted the channel name in rendered text and passed.
- [ ] A screenshot PNG is committed on the branch.
- [ ] `git diff --stat ddc5f4dd..HEAD -- apps/analytics-app` lists only In-scope files.
- [ ] No INSERT, UPDATE, DELETE or migration against `clicks-db` appears anywhere in
      the diff: `! rtk proxy grep -rniE "(insert|update|delete) .*(videos|links|clicks)\b" apps/analytics-app/src` exits 0.

## STOP conditions

- **A gate assertion fails and the obvious fix is to weaken it.** Fix the code or the
  fixture. Weakening, swapping or deleting an assertion is a STOP.
- **You are about to write to `clicks-db`** — INSERT, UPDATE, DELETE or a migration.
  That database's schema is owned by `apps/redirector/migrations/`. Stop and report.
- **You are about to rebuild the `keywords` table** to widen the UNIQUE constraint.
  Additive column only; a rebuild risks the `rank_checks` foreign key. Stop and report.
- **An unknown channel id is about to fall back to the default in a DATA path.** Return
  a 400. Showing one channel's numbers under another channel's name is the exact
  failure this plan exists to prevent.
- **You are about to change the click de-duplication.** It must stay byte-identical to
  `pipelines/youtube/yt-analysis/sync_clicks.py`.
- **A test would call the real YouTube API.** Rank checks cost 100 units each against a
  shared 10,000/day budget. Tests mock `fetch`; they never spend quota. Stop and report
  if a test seems to need a live call.
- **You are about to make rank checks run on page load.** They are manual and
  per-video by design.
- **Done criteria still fail after 5 fix attempts.** Write
  `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- `src/worker/channels.ts` is the single resolution point here, mirroring the tracker's
  module of the same name. The two are deliberately separate files reading one registry
  — do not try to share code across Worker apps.
- NULL `channel_id` meaning "the default channel" is a compatibility rule, not a
  permanent design. It exists so no row written before plan 261 disappears. When the
  column has been NOT-NULL in practice for a long time, that branch can go.
- The shared-quota line in the UI is load-bearing. With one key and several channels,
  an exhausted quota is normal operation, and a user who reads it as breakage will file
  a bug against a working dashboard. If the owner later adds a key per channel, the
  registry is where `yt_api_key_secret` would go, and that line changes.
- A reviewer should scrutinise: that `clicks-db` is still read-only; that no data path
  silently falls back to the default channel; that the NULL-row rule is actually
  implemented (a channel filter that drops NULLs would re-create the 2026-08-28 bug
  where 54 of 69 clicks were invisible); and that Step 4 was really executed.
