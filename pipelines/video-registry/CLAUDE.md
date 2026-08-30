# video-registry — how to operate here

The authority on **what a video is called**. One key per video, minted once,
shared by every pipeline that touches it.

## What problem this solves

A video passes through at least two pipelines — `youtube/yt-script/` writes the
outline and script, `video/visuals-flow/` builds the edit. Before this existed,
each one derived a folder name from whatever title string it was handed, weeks
apart. The same video ended up as
`yt-script/videos/ai-video-tools-comparison/` and
`visuals-flow/videos/best-ai-video-generator/`, and nothing recorded that they
were one video.

**A content hash of the title does not fix this** and was explicitly rejected:
the title legitimately drifts between the script stage and the edit stage, so the
same video hashes differently in the two pipelines and nobody notices. Identity
has to be *minted once and looked up*, not derived on demand.

## The key is the slug

Nothing about paths changed. The key is the same readable kebab-case string the
folders always used:

```
youtube/yt-script/videos/<key>/
video/visuals-flow/videos/<key>/
Drive: Output/<key>-final.mp4
```

The only difference is where it comes from.

## Both pipelines call ONE verb

```bash
KEY=$(node bin/vreg.mjs ensure <name> --title "<working title>")
```

`ensure` is **idempotent and symmetric**:

- name is new → mints it, returns it
- name already resolves (as a key *or* an alias) → returns the existing key,
  **writes nothing**

Whichever pipeline reaches a video first mints; the other finds it and reuses.
Neither pipeline "owns" naming — that is the point. If you ever add a third
pipeline (thumbnails, publishing), it calls `ensure` too and adds its slot to
`PIPELINE_VIDEO_ROOTS` in `lib/registry.mjs`.

**Never add a "primary" pipeline that owns naming.** The moment one does, the
other starts re-slugifying, which is the bug this folder exists to kill.

## Commands

| Command | Does |
|---|---|
| `vreg ensure <name> [--title "..."]` | The verb pipelines call. Prints the canonical key on stdout (so `$(...)` works); the human note goes to stderr. |
| `vreg resolve <name>` | Canonical key, exit 1 if unknown. |
| `vreg where <name>` | Which pipelines already have a folder for this video, and what each folder is named on disk. |
| `vreg list` | Every registered video. |
| `vreg check` | Exits 1 listing any `videos/` directory the registry does not know. |
| `vreg mint <key> [--title]` | Register a new key; fails if the name is taken. `ensure` is usually what you want. |
| `vreg alias <key> <other-name>` | Point another name at an existing key. |
| `vreg sync [--dry-run]` | Seed registry from the tracker. |
| `vreg migrate-keys [--dry-run\|--apply]` | Make the canonical key the primary key in clicks-db and the script desk. **Dry run is the default**; `--apply` writes, and boss runs it as a plan's deploy step, never a crew. |

`vreg where` is the cross-pipeline question answered:

```
$ node bin/vreg.mjs where ai-video-tools-comparison
best-ai-video-generator
  [x] script   …/yt-script/videos/ai-video-tools-comparison  (folder named "ai-video-tools-comparison")
  [x] visuals  …/visuals-flow/videos/best-ai-video-generator
```

## Aliases are a legacy bridge, not a feature

An alias exists for exactly one reason: two pipelines already had folders on disk
for the same video, picked independently, before this registry existed.

**A newly-minted video has zero aliases and should stay that way.** If you find
yourself adding an alias to a video minted after 2026-08-09, something upstream
skipped `ensure`.

### The registry NEVER renames a directory

This is the hard rule. `visuals-flow` video workdirs carry render caches,
assembly caches and run-log ledger keys that embed the slug — plan 199 had to
migrate ledger slug keys once and it was painful (decisions.md 2026-08-07).
Aliasing exists precisely so no folder has to move. `whereIs()` therefore looks
under the canonical key *and* every alias, because the folder genuinely may be
sitting under the old name.

## How consumers resolve

`resolveKey()` returns **`null`** for a name it does not know. It never throws.
Callers treat `null` as "not registered" and behave exactly as they did before
this folder existed.

**Nothing in a consuming pipeline may hard-fail on a missing registry entry.**
`visuals-flow`'s `lib/workdir.mjs` is the model: it consults the registry only
when the directory is not already on disk, wraps the call in a `try`, and falls
through to the unchanged path when anything is missing. It has to — the same
function builds the path for workdirs that do not exist yet, and
`scripts/test-run-sh.sh` drives every verb with the literal slug `.`.

`vreg check` is the natural follow-up gate and is deliberately **not** wired into
any `test_cmd` yet: a scratch workdir would turn a merge gate red. Once the
`ensure` habit is established, adding it to a gate is a one-line change.

## Layout

```
videos.json            the registry — tracked, hand-editable, sorted by key
lib/registry.mjs       resolveKey / ensure / mint / addAlias / whereIs / unregisteredDirs
lib/migrate-keys.mjs   the pure D1 statement planners + the invariant guard
bin/vreg.mjs           the CLI
registry.test.mjs      node --test registry.test.mjs
```

No dependencies, `node:` built-ins only. Do not add a `package.json` with deps —
`pipelines/` has no shared Node package root.

## migrate-keys: the statement order is load-bearing

`lib/migrate-keys.mjs` emits, per clicks-db video, exactly three statements in
exactly this order:

```
1. INSERT INTO videos ... SELECT ... WHERE video_code = <old>
2. UPDATE links SET video_code = <new> WHERE video_code = <old>
3. DELETE FROM videos WHERE video_code = <old>
```

clicks-db has exactly **one** foreign key: `links.video_code -> videos.video_code`.
Insert-then-repoint-then-delete keeps that constraint satisfied at every single
step: after (1) both rows exist, after (2) every child points at a row that is
already there, and (3) removes a row nothing references any more.

**Any other order transiently violates the foreign key.** The order is chosen
precisely so that no `PRAGMA foreign_keys` and no `defer_foreign_keys` is needed
anywhere. If a refactor makes you want to add a pragma, the order was changed —
put it back instead. `registry.test.mjs` pins the order, and the plan-241 merge
gate reverses the emitted array to prove those assertions actually run.

Three more things this verb will never do: write to `clicks`, change a
`links.slug` (those strings are inside published YouTube descriptions), or
change a desk `videos.token` (shared desk links resolve by it). `--apply` reads
the `INVARIANT_QUERIES` counts before and after and **exits non-zero** on any
drift, because boss runs it unattended.

Where the mapping comes from: `cards.slug` is a real tracker column, but
`video_code` is not — the tracker stores it inside the card's `extra_json` blob,
so the verb `json_extract`s it out.

## channel — which channel a video belongs to (plan 264)

Every entry carries `"channel": "<id>"`, the `config/channels.json` id the video
belongs to. `channelOf(key, reg)` is the getter: an entry with no `channel` field, or
a key the registry does not know at all, resolves to the channel registry's default —
it **never throws**, matching `resolveKey`'s contract. `list()` always fills the field
in via `channelOf`, so a caller never sees it missing even on an older entry.

`mint`/`ensure` default `channel` to the registry default when not given; `vreg ensure
--channel <id>` validates the id BEFORE minting, so an unknown channel exits non-zero
(`CHANNEL_UNKNOWN`) rather than minting an entry that points nowhere.

`visuals-flow`'s brand resolution reads a video's channel to pick its `profile.brand`
— see `config/README.md`'s **Profiles** section and `visuals-flow/PIPELINE.md`.

## Traps

- **Do not add a `stages`, `paths`, `published`, `stage`, `yt_id`, or `flows` field to an entry.** The paths are derivable
  from the key; recording them creates a second source of truth that drifts. `card_id`
  and `channel` are the only permitted new fields — `card_id` links the tracker,
  `channel` links `config/channels.json`.
- **Name similarity is not evidence that two videos are one video.**
  `ai-avatar-generators` (HeyGen/Synthesia talking heads) and
  `consistent-ai-influencer` (Nano Banana/Flux image consistency) look like a
  pair and are two different videos. Check the transcript and the outline before
  aliasing anything.
- **`ensure` prints the key on stdout and everything else on stderr.** That is
  what makes `KEY=$(vreg ensure …)` safe. Do not add stdout chatter.
