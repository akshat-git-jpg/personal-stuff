# video-registry — how to operate here

The authority on **what a video is called**. One key per video, minted once,
shared by every pipeline that touches it.

## What problem this solves

A video passes through at least two pipelines — `youtube/yt-script-2/` writes the
outline and script, `video/visuals-flow/` builds the edit. Before this existed,
each one derived a folder name from whatever title string it was handed, weeks
apart. The same video ended up as
`yt-script-2/videos/ai-video-tools-comparison/` and
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
youtube/yt-script-2/videos/<key>/
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

`vreg where` is the cross-pipeline question answered:

```
$ node bin/vreg.mjs where ai-video-tools-comparison
best-ai-video-generator
  [x] script   …/yt-script-2/videos/ai-video-tools-comparison  (folder named "ai-video-tools-comparison")
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
bin/vreg.mjs           the CLI
registry.test.mjs      node --test registry.test.mjs
```

No dependencies, `node:` built-ins only. Do not add a `package.json` with deps —
`pipelines/` has no shared Node package root.

## Traps

- **Do not add a `stages` or `paths` field to an entry.** The paths are derivable
  from the key; recording them creates a second source of truth that drifts.
- **Name similarity is not evidence that two videos are one video.**
  `ai-avatar-generators` (HeyGen/Synthesia talking heads) and
  `consistent-ai-influencer` (Nano Banana/Flux image consistency) look like a
  pair and are two different videos. Check the transcript and the outline before
  aliasing anything.
- **`ensure` prints the key on stdout and everything else on stderr.** That is
  what makes `KEY=$(vreg ensure …)` safe. Do not add stdout chatter.
