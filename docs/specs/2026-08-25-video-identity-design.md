# Video identity — design

**Date:** 2026-08-25
**Status:** design approved, plan not yet written
**Supersedes nothing. Amends:** `decisions.md` 2026-08-09 (the video-registry entry).

One video should have one name, from the moment its card is created to the row that
counts its affiliate clicks. Today it has four, and nothing records that they are
the same video.

---

## 1. The problem

A video passes through, at minimum:

| Space | Key | Origin |
|---|---|---|
| tracker `cards` (tracker-db) | `id` | internal row id |
| `pipelines/video-registry` | the kebab key | minted by whichever pipeline arrives first |
| `yt-script-desk.videos` | `key` | set when a script publishes to the desk |
| `clicks-db.videos` | `video_code` | **random 6-char BASE62** |

`pipelines/video-registry/` already unified the two pipeline *folder* spaces
(`yt-script/videos/` and `visuals-flow/videos/`). The other three are unlinked.

### What is NOT wrong (checked 2026-08-25)

An earlier draft of this design claimed a live attribution bug in the affiliate chain.
**That claim was wrong.** The check is recorded here so nobody re-derives it.

**The live path is guarded.** `apps/tutorial-tracker-app/src/worker/index.ts:1025`:

```ts
let videoCode = (target.video_code as string)?.trim();
if (!videoCode) {
  const dbCode = await clickstore.videoCodeForTitle(c.env.DB, title);
  if (dbCode) { videoCode = dbCode; }
  else {
    videoCode = generateVideoCode(await clickstore.existingCodes(c.env.DB));
    await clickstore.insertVideo(c.env.DB, videoCode, title);
  }
  await getStore(c.env).updateCells(rowId, { video_code: videoCode });
}
```

The card persists its own `video_code` and it is read back **first**. The title lookup
in `clickstore.ts:15` fires only for a card that has no code yet — a backfill path for
cards predating the column. Once a code is assigned it is written back to the card, so
**a retitle cannot fork a video into two rows.**

**And `process_yt_tracker.py` is deprecated dead code.** Its own header says so
(`DEPRECATED (2026-06-15)` … "retained for reference only and is no longer
maintained"), its logic was ported to the Worker as `linkgen.ts`, and
`.claude/skills/personal-stuff-failure-archaeology/SKILL.md:19` records the whole
Sheets backend as **SETTLED**, with the instruction "never code against it".

**What remains is a cleanup, not a fix.** Once `video_code` IS the canonical slug, the
`videoCodeForTitle` fallback has nothing left to resolve and can be deleted.

**Lesson for the next design in this repo:** the failure-archaeology skill exists for
exactly this. Run it before asserting anything here is broken.

---

## 2. What already exists (read this before designing anything)

`pipelines/video-registry/` is the authority on what a video is called. It has
`videos.json`, `lib/registry.mjs`, `bin/vreg.mjs`, and `registry.test.mjs`.

`decisions.md` 2026-08-09 records its design and, importantly, what it rejected:

| Rejected | Why |
|---|---|
| content hash of the title | the title drifts between script stage and edit stage, so the same video hashes differently in each pipeline and nobody notices |
| date-prefixed / numbered keys | the key **is** the folder name and appears in Drive filenames and the board UI, so it must stay readable |
| renaming folders on disk | visuals-flow workdirs carry render caches, assembly caches, and run-log ledger keys that embed the slug; plan 199 migrated ledger slug keys once and it was painful |

Aliases exist so that no folder has to move. `best-ai-video-generator` already carries
the alias `ai-video-tools-comparison`, so the script-side and edit-side folders for that
video are already recorded as one video.

**This design does not re-litigate any of the above.** It adds an origin upstream of the
registry and links the two databases to it.

---

## 3. The decision

**The tracker mints the slug at card creation. It flows unchanged through every
downstream system. Existing folders are never renamed.**

| | Decision |
|---|---|
| new videos | tracker mints; pipelines pick it up via `vreg ensure`, exactly as today |
| the 11 existing folders | left in place; aliases already link them |
| `clicks-db` and the desk | migrated to the canonical key (no folder is touched) |
| minting on first arrival | still works as a fallback when `vreg sync` has not run |

---

## 4. Design

### 4.1 Minting, in the tracker

Five changes to `apps/tutorial-tracker-app/`:

| # | File | Change |
|---|---|---|
| 1 | `src/shared/slug.ts` *(new)* | pure `slugify(title)` — no deps, no API call |
| 2 | `src/shared/columns.ts` | add `"slug"` to `COLUMNS`; the Sheets fallback gets the header for free (the file's own comment: the migration appends missing headers) |
| 3 | `migrations/0003_card_slug.sql` *(new)* | `ALTER TABLE cards ADD COLUMN slug TEXT;` plus a unique index on non-null slugs |
| 4 | `src/worker/datastore.ts:172` | add `"slug"` to `cardCols` so inserts carry it |
| 5 | `src/shared/engine/definitions/standard.ts` | `slug` in the Topic stage's `createFields`, pre-filled live from the title as you type |

**The slug is create-only.** It lives in `createFields` and is **absent from
`briefFields`**. It is not "locked" by a rule — it simply does not exist on the edit
surface of a card that already exists. Structurally impossible rather than forbidden.

**The slug never changes after minting.** A title edit does not touch it. The reason is
mechanical, not stylistic: keeping a slug matching its title would require renaming
folders in two pipelines, renaming render output, rewriting the registry, and fixing
every doc and ledger naming the old path — atomically. The tracker is a Cloudflare
Worker and cannot touch the repo at all, so it could only change its own field and leave
everything else inconsistent. A title is a label; a slug is an identity.

A slug can be renamed deliberately, as a rare hand-triggered maintainer operation that
does every move in one workspace and lands one reviewable commit. Never automatically,
and never off a title edit.

#### The slugify algorithm

Deterministic, no LLM. The tracker does have Gemini (`src/worker/gemini.ts`,
`gemini-2.5-flash`) but it is not used here: an API call that can fail while you are
creating a card is a worse trade than typing four words into a pre-filled field.

```ts
const STOP = new Set([
  "a","an","the","and","or","but","so","to","of","for","from",
  "you","your","i","me","my","we","our","it","its",
  "is","are","was","be","been","this","that","these","those",
  "have","has","had","do","does","did","dont","wont","cant",
  "will","just","very","really",
]);
const MAX = 40;

export function slugify(title: string): string {
  let s = title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip accents
    .replace(/['\u2019]/g, "")                          // don't -> dont, not don-t
    .replace(/[^a-z0-9]+/g, "-")                        // everything else -> dash
    .replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (s.length > MAX) {                                 // drop stop words
    s = s.split("-").filter(w => /\d/.test(w) || !STOP.has(w)).join("-");
  }
  if (s.length > MAX) {                                 // cut on a word boundary
    const cut = s.lastIndexOf("-", MAX);
    s = cut > 0 ? s.slice(0, cut) : s.slice(0, MAX);
  }
  return s;
}
```

Rules worth stating explicitly:

- A word containing a digit is **never** dropped. `2026`, `7`, `v2` carry meaning.
- `how`, `why`, `what`, `best`, `vs`, `without`, `free` are **not** stop words. They are
  the topic.
- Apostrophes are deleted before the general punctuation rule, so `don't` becomes `dont`
  rather than `don-t`.

Uniqueness and the empty-guard stay **out** of this function, because they need a
database read. `mintSlug(title, existingSlugs)` in the worker appends `-2`, `-3` on
collision and falls back to `video-<card-id>` when `slugify` returns an empty string (a
title of only emoji or only CJK). Keeping `slugify` pure is what makes it unit-testable.

| Title | Slug |
|---|---|
| `Best AI Video Generator` | `best-ai-video-generator` |
| `OpusClip vs Submagic` | `opusclip-vs-submagic` |
| `How To Make A Consistent AI Influencer` | `how-to-make-a-consistent-ai-influencer` |
| `I Tested 7 AI Video Generators So You Don't Have To (2026)` | `tested-7-ai-video-generators-2026` |
| `Café Recipes` | `cafe-recipes` |
| `🔥🔥🔥` | `video-a1b2c3` |

The first two reproduce existing folder names exactly.

### 4.2 Carrying the key into the repo

A Worker cannot write to `videos.json`, so the key needs a carrier.

**New verb: `vreg sync`.** Reads tracker cards; for every card carrying a slug with no
registry entry, mints one. Runs on main and commits the file. Later it becomes a
maintainer job.

`vreg ensure` is unchanged and remains the only verb pipelines call. If `sync` has not
run, `ensure` mints locally exactly as it does today. Nothing in a consuming pipeline
hard-fails on a missing registry entry — the registry's own operating rule, and
`resolveKey()` still returns `null` rather than throwing.

Auth for `sync`: reuse `POST /api/login` with the shared password from the pipelines
`.env`, then the signed cookie — the same flow a browser performs. No new endpoint and
no new secret. A token-guarded read-only `GET /api/videos.json` on the tracker is
cleaner long-term and is deliberately deferred.

### 4.3 One new registry field

```json
"best-ai-video-generator": {
  "title": "...",
  "minted": "2026-07-31",
  "aliases": ["ai-video-tools-comparison"],
  "card_id": "row_17"
}
```

`card_id` and nothing else.

**No `stage`, no `published`, no `flows`, no `paths`.** The registry's `CLAUDE.md`
forbids exactly this ("creates a second source of truth that drifts") and it is correct.
Published state is read live from the tracker by whoever asks. "Which pipelines have a
folder for this video" is already answered by `whereIs()`.

### 4.4 The database migrations

**clicks-db:**

```
videos(video_code PK, video_title, created_at, yt_id)
links (slug PK, video_code FK, tool, target_url, created_at)
clicks(id, slug, clicked_at, ip_hash, ua_hash, referer)
```

`clicks` does **not** reference `video_code`. It references `links.slug`, the short-URL
slug. So changing `video_code` touches `videos.video_code` and `links.video_code` only:

- click history is untouched
- short URLs do not change, so every `go.agrolloo.com/...` already sitting in a
  published YouTube description keeps working

**yt-script-desk:**

```
videos(key PK, title, beats_json, token UNIQUE, finished, published_at)
answers(video_key, beat_num) / say_edits(video_key, beat_num)
```

Shared desk links resolve by **`token`**, not `key` (`src/worker/auth.ts:16`, plus
`idx_videos_token`). Renaming `key` breaks no link anyone was given.

| DB | Column | New value |
|---|---|---|
| clicks-db | `videos.video_code` | the canonical key |
| clicks-db | `links.video_code` | the canonical key |
| desk | `videos.key` | the canonical key |
| desk | `answers.video_key` | the canonical key |
| desk | `say_edits.video_key` | the canonical key |

Untouched: `clicks`, `links.slug`, `videos.token`.

**Mechanics.** A primary-key change uses *new table, copy with the mapping applied,
drop, rename* — not an in-place `UPDATE`, which trips foreign-key enforcement
mid-statement. D1 enforces foreign keys; whether `PRAGMA defer_foreign_keys` is
honoured inside a D1 batch must be **verified against D1's current behaviour, not
assumed**.

**Then the title lookup goes away.** `clickstore.videoCodeForTitle` becomes
unreachable once `video_code` IS the canonical key, and is deleted. This is a dead-path
removal, not a behaviour change — see the check in §1.

### 4.5 Existing state

**No folder is renamed.** Measured cost of doing so: 179 files reference the 11 slugs
from outside their own folders, and run-log ledger keys would need migrating again.
`consistent-ai-influencer` alone has 45 external references and live ledger entries
(`decisions.md` 2026-08-08).

**Two folders are drifting today** — `ai-avatar-generator-comparison` and
`character-consistency-ai` have folders but no registry entry. `vreg check` flags both.

Backfilling them is **content work, not name matching**. `decisions.md` 2026-08-09 is
explicit: `ai-avatar-generators` (HeyGen/Synthesia talking heads) and
`consistent-ai-influencer` (Nano Banana/Flux image consistency) look like a pair and are
two different videos. `ai-avatar-generator-comparison` looks like it belongs to
`ai-avatar-generators`, which is precisely the trap. Read the outline and the transcript
before aliasing anything.

`test-01` is a pipeline test fixture with no tracker card. It is left alone.

---

## 5. Testing

| # | Thing | How |
|---|---|---|
| 1 | `slugify` | unit table: the six worked examples plus accents, apostrophes, emoji-only, over-length, digit preservation |
| 2 | slug is create-only | **shape assertion** — present in `createFields`, absent from `briefFields`. Never a wording assertion |
| 3 | slug uniqueness | the index rejects a duplicate insert |
| 4 | `vreg sync` | mints when missing; no write when present; skips a card with no slug; second run is a no-op |
| 5 | a retitle does not create a second `videos` row | pins the guard the card-stored `video_code` already provides, so a refactor cannot lose it |

`test_cmd` extends `scripts/check.sh`, the existing repo-wide gate, rather than adding a
parallel runner.

### What cannot be unit-tested

The two live database migrations. They get a written verification with exact queries,
run by hand, results recorded in the plan's run ledger:

```sql
SELECT COUNT(*) FROM videos;              -- before and after must match
SELECT COUNT(*) FROM links;               -- before and after must match
SELECT COUNT(*) FROM clicks;              -- must be IDENTICAL; never touched
SELECT COUNT(DISTINCT slug) FROM links;   -- short URLs must not change
```

If `clicks` or `links.slug` moves by a single row, the migration is wrong and is rolled
back.

### Mutation recipe

Required by house standard — the registry work itself was mutation-verified
(`decisions.md` 2026-08-09: "disabling the alias loop fails 6 tests"). Two documented
traps apply:

- **`mutation_apply` must be a single line** (`decisions.md` 2026-08-07). `fm_get` is
  awk-based and returns only the first line of a frontmatter value, so a heredoc reaches
  the gate as a bare `python3 -` that changes nothing, and boss then blames the plan.
  Durable form: `python3 -c "import base64;exec(base64.b64decode('<B64>'))"`.
- **`mutation_expect` must name text appearing ONLY on failure** (`decisions.md`
  2026-08-07). Not a test name — TAP echoes names on pass. Use the assertion message.

---

## 6. Deliberately not done

| Not doing | Why |
|---|---|
| renaming any existing folder | render caches, assembly caches, and ledger keys embed the slug; 179 external references |
| a Gemini slug suggestion | a pre-filled editable field already solves it; an API call that can fail at card creation is worse |
| storing published state in `videos.json` | the registry's own trap: a second source of truth that drifts |
| wiring `vreg check` into a merge gate | a scratch workdir would turn the gate red (2026-08-09). The maintainer reports on it instead |
| a token-guarded read API on the tracker | the existing login + cookie flow is enough for v1 |
| `pp-video`, a new CLI | `bin/vreg.mjs` already exists and is the right home |
| a slug rename that follows a title edit | the rename cascade a Worker cannot perform |

---

## 7. What this changes in `decisions.md`

One rule is amended and needs its own dated entry:

> **2026-08-09:** "Minting is symmetric on purpose … the moment one pipeline 'owns'
> naming, the other starts re-slugifying, which is the bug."

The tracker is **not** a pipeline. It sits upstream of both and mints before either sees
the video, so neither ever re-slugifies. This is strictly stronger than the current
behaviour, where the first pipeline to arrive still slugifies whatever working title it
was handed. Symmetric `ensure` remains the fallback path.

The rule against a *pipeline* owning naming stands unchanged.

---

## 8. Open points for plan readiness

1. ~~Does `process_yt_tracker.py` re-run for an already-processed video?~~
   **Resolved 2026-08-25.** It is deprecated dead code, and the live Worker path is
   already guarded by the card-stored `video_code`. See §1.
2. **Does D1 honour `PRAGMA defer_foreign_keys` inside a batch?** Decides the exact
   migration mechanics in §4.4.
3. **Backfill for the two unregistered folders** needs a content read (outline plus
   transcript), not a name guess.

None of these block writing the plan. All three are first-step tasks inside it.

---

## Related

- `decisions.md` 2026-08-09 — the video-registry decision this amends
- `pipelines/video-registry/CLAUDE.md` — operating rules, alias policy, traps
- `plans/200-shared-video-registry.md` — the plan that built the registry
- `.claude/skills/personal-stuff-architecture-contract/` — read before touching
  tracker-app or the redirector→clicks-db chain
- Project B (not yet designed) — the repo-maintainer agent that will run `vreg sync`,
  `vreg check`, and the published-artifact cleanup
