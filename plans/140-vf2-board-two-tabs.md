---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: [after 139-vf2-sound-mix]
---

# Plan 140: v2 board — two-tab review dashboard (storyboard + Final Cut)

## Summary

- **Problem statement**: v1's board reviews cues one at a time — no global play-through (deferred GFX-08), no post-render review at all. The owner wants Loop Studio's reviewer ergonomics: scrub the finished mp4, pause-to-type timestamped comments, click-to-pin a spot on the frame, per-version comment history, and live check-off as fixes land (spec delta I — adopted IN FULL, replacing the deferred standalone reviewer).
- **Goals**: (1) Storyboard tab keeps everything current + gains a master play-through of the planned cut; (2) new Final Cut tab playing the assembled video with timestamp+point comments, versions, and status polling; (3) versions registry written by assemble; (4) comments land in the existing `feedback.json` lifecycle; (5) Gate A (print board URL after render/assemble) + `lib/post-status.mjs` for Gate B live check-off; (6) audit.json (plan 136) verdict chips on storyboard cues; (7) sound-plan audibility on the storyboard tab.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner directive; ui:true (verifier inspects screenshots — agy never self-certifies UI).
- **Done criteria**: check.sh green with extended board tests; both tabs serve; feedback/versions/status JSON round-trips proven by unit tests.
- **Stop conditions**: board.mjs architecture can't serve kb-scratch video with Range without a rewrite; feedback.json schema break.
- **Test / verification for success**: pure-logic unit tests (registry/merge/pin schema) + manual serve smoke + verifier screenshot pass.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. **Before writing any code, read `lib/board.mjs` end to end** — it is the single server this plan extends, and its existing patterns (route table, module caching, save/approve semantics, unsaved-changes guard) are the conventions to match. Run every verification command. If anything in the "STOP conditions" section occurs, stop and report. Do NOT edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2/lib/board.mjs pipelines/video/visuals-flow-2/lib/assemble.mjs`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 134; 136 (audit.json), 138 (brand preview), 139 (sound.json + master.wav) — degrade gracefully when any of those artifacts is absent
- **Category**: feature
- **Difficulty**: standard (large surface, but every behavior is specified below)
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Review is where the owner's time goes, and it was a top pain point ("storyboard not that good to review"). Loop Studio's `video-feedback` tool proved the interaction that works: type while paused → note pinned to the exact timestamp (optionally to an x/y spot), every render is a version with its own notes, and a status file polled every ~2.5s lets the owner watch to-dos tick off live while the session fixes them. v2 folds that INTO the existing board (one dashboard, two tabs) instead of a second tool, and keeps v1's pre-render storyboard advantage (preview-is-render-input — decisions.md 2026-07-17). Reference studied: `~/.claude-personal/skills/video-feedback/` (proprietary — behaviors ported, no code copied).

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- `lib/board.mjs` (~1600 lines): Node http server on 127.0.0.1:4322 (walks ports). Serves the full-script timeline with live card-iframe previews, per-cue VO slices from `videos/<slug>/slices/`, minimap lanes (graphics/avatar/effects), per-block feedback boxes, `/approve`, `/approve-shots`, `/approve-effects` gates; Save writes `feedback.json` and any real edit resets `approved`. Long-running: caches lib modules at startup (restart after lib edits — keep that documented).
- `feedback.json`: `{items: {"<cueId>"|"gap-<mm:ss>"|"_global": [{text, added, context, applied?, folded?}]}}` — the 060 fold consumes it; folded items are read-only history.
- Assembled outputs live OUTSIDE the repo: `~/kb-scratch/video/visuals-flow-2/<slug>/final.mp4` (and `final-draft.mp4`); `master.wav`, bounces (plan 139) beside them.
- `resolved.json`, `effects.json`, `sound.json`, `audit.json`, `concept.json` — all in `videos/<slug>/` (each may be absent on older/partial workdirs).
- `lib/brand-inline.mjs` (plan 138) — inject brand tokens into preview iframes' staged HTML the same way render does.
- Gate A precedent: steps print next-step hints today; render/assemble must end by printing the board URL.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Serve | `node lib/board.mjs <slug>` | prints `http://127.0.0.1:4322/...` |
| Range smoke | `curl -s -o /dev/null -w "%{http_code}" -H "Range: bytes=0-99" http://127.0.0.1:4322/video/current` | `206` |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `lib/board.mjs`, `lib/board.test.mjs`
- `lib/versions.mjs` (new) + test, `lib/post-status.mjs` (new) + test
- `lib/assemble.mjs` (version registration + Gate A print), `lib/render.mjs` (Gate A print)
- `steps/040-storyboard-review-owner/README.md` (two-tab docs), `scripts/check.sh`, `PIPELINE.md`

**Out of scope**: v1, card-library, any cloud/remote serving (localhost only), reverse timeline-diff (still deferred), styling beyond the board's existing look (match it — this is a workhorse tool, not a redesign).

## Git workflow

- Branch: `advisor/140-vf2-board-two-tabs`. Commit per step. Do NOT push.

## Steps

### Step 1: versions registry

`lib/versions.mjs`: exports `registerVersion(kbWorkdir, {label})` — copies `final*.mp4` (whichever was just written; take the path as an arg) to `<kbWorkdir>/versions/<label>.mp4` and upserts `<kbWorkdir>/versions.json`:

```json
{ "versions": [ { "label": "v1", "file": "versions/v1.mp4", "created": "<ISO>", "draft": false } ] }
```

`nextLabel(versionsJson)` → `v1`, `v2`, ... Auto-called at the END of `lib/assemble.mjs`'s successful run (draft flag from `--draft`). Media stays in kb-scratch (never git).

Test (`lib/versions.test.mjs`, tmpdir): label sequence, upsert, copy happens, registry shape.

**Verify**: `node --test lib/versions.test.mjs` → pass.

### Step 2: Final Cut tab — player + Range serving

`lib/board.mjs`:
- Tab bar at the top: `Storyboard` (existing UI unchanged) / `Final Cut`.
- New routes: `GET /video/<label|current>` — streams the version mp4 (or the newest) from kb-scratch with HTTP Range support (206, `Accept-Ranges: bytes`; scrubbing requires it); `GET /versions` → versions.json; `GET /status` → claude_status.json (Step 4); `POST /feedback-final` (Step 3).
- Final Cut tab UI: `<video>` player of the selected version; version dropdown from `/versions` (default newest); timeline hover shows timecode (thumbnail hover is OPTIONAL — implement timecode-only; do not shell out to ffmpeg per hover); comment panel listing this version's notes with their status chips.
- When no versions exist, the tab shows "no assembled version yet — run assemble" (no error).

**Verify**: with a fixture kb-scratch dir containing a tiny mp4 (generate via `ffmpeg -f lavfi -i testsrc=d=1:s=320x180 /tmp/t.mp4` and copy in), the Range smoke command returns 206; `/versions` returns the registry.

### Step 3: timestamped + point-pinned comments → feedback.json

Interaction (Loop Studio ergonomics, exact):
- While the video is PAUSED, typing any character focuses the comment box; Enter saves.
- Clicking a spot ON the video frame sets a pending pin `{x, y}` as PERCENTAGES of the rendered frame (resolution-independent); the next saved comment carries it; a small marker renders at the pin while its comment is selected.
- Saved comment → `POST /feedback-final` → appended to `videos/<slug>/feedback.json` under a new key class `"final-<label>"` (e.g. `"final-v2"`), item shape EXTENDS the existing one: `{text, added, context: "final@<mm:ss.s>", t: <seconds>, x?: <0-100>, y?: <0-100>, applied?, folded?}`. Existing consumers (060 fold, feedback-status) treat unknown extra fields as opaque — verify `lib/feedback-status.mjs` only reads keys it knows; if it hard-fails on the new key class, extend its key filter, nothing else.
- Comment list per version = items under its `final-<label>` key.

Tests (`lib/board.test.mjs` extend, pure functions — extract `appendFinalFeedback(feedback, label, item)` and `pinFromClick(clientX, clientY, rect)` as exported helpers): key naming, shape, percentage math, folded items never mutated.

**Verify**: `node --test lib/board.test.mjs` → pass.

### Step 4: live check-off (Gate B machinery)

- `lib/post-status.mjs`: CLI `node lib/post-status.mjs <slug> '<json>'` where json = `{"<itemKey>": {"status": "fixed"|"skipped"|"question", "message": "..."}}`; itemKey = `final-<label>:<index>`; merges into `videos/<slug>/claude_status.json` `{updated: <ISO>, items: {...}}`.
- Final Cut tab polls `/status` every 2.5s; each comment renders its status chip (open / fixed ✓ strikethrough / skipped / question with the message); the list count updates live.
- Document Gate B in `steps/040-storyboard-review-owner/README.md`: on "feedback done", the session fixes each note and calls post-status per item — the owner watches them tick off; statuses are `fixed`/`skipped`/`question` (question only when genuinely too vague).

Test (`lib/post-status.test.mjs`): merge semantics, bad status rejected, updated timestamp bumps.

**Verify**: `node --test lib/post-status.test.mjs` → pass.

### Step 5: storyboard tab upgrades

- **Master play-through**: a play bar on the storyboard tab that walks the resolved timeline in order — plays each cue's VO slice while showing its existing live preview iframe, auto-advancing (gaps: show the gap block + play its slice when one exists; this is the plan-104 "master player seam" — a TIMING/sequence preview, not final pixels, label it so on the UI).
- **Sound lane preview**: when `sound.json` exists, render its instances as markers on the minimap (one lane) and, during play-through, trigger the matching `assets/sfx/*.wav` via WebAudio at each instance's offset within the current cue (best-effort sync; a "SFX preview" toggle defaults ON).
- **Audit chips**: when `audit.json` exists, each cue block shows its verdict chip (`enacted` subtle / `labelled` warning-colored with the `fix` text on hover/expand).
- **Brand preview**: card preview iframes get `lib/brand-inline.mjs` injection so the board shows branded pixels (reuse the render-side helper).
- **Gate A**: `lib/render.mjs` and `lib/assemble.mjs` end their successful runs by printing `board: node lib/board.mjs <slug>  →  http://127.0.0.1:4322/` (and assemble prints the Final Cut hint).

**Verify**: serve a fixture workdir; storyboard tab shows the play bar, sound markers (with a sound.json fixture), audit chips (with an audit.json fixture); absence of all three artifacts renders the tab exactly as before (graceful).

### Step 6: register + gate + screenshot

check.sh gains `lib/versions.test.mjs`, `lib/post-status.test.mjs`. Take TWO screenshots for the PR (ui:true requirement): storyboard tab with audit chips + sound lane; Final Cut tab with a comment pinned to a frame spot and one item checked off.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Every JSON contract (versions, final feedback, status merge, pin math) is a pure exported function with `node --test` coverage; server behaviors verified by the serve/Range/endpoint smokes; visual verification via the PR screenshots (the render+inspect rule: a human/verifier LOOKS, the executor never self-certifies UI).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] Range smoke → 206; `/versions`, `/status` respond on a fixture workdir
- [ ] `feedback.json` gains `final-<label>` items with `t`/`x`/`y`; 060-fold consumer (`lib/feedback-status.mjs`) still exits 0 on a fixture containing them
- [ ] `node lib/post-status.mjs` merges and the tab reflects it after ≤2.5s (manual smoke)
- [ ] Two PR screenshots attached
- [ ] `grep -n "board:" lib/render.mjs lib/assemble.mjs` → Gate A prints present

## STOP conditions

- board.mjs's request routing can't accommodate the new routes without restructuring its core dispatch — report the structural blocker instead of rewriting the file wholesale.
- `lib/feedback-status.mjs` or `lib/edit-delta.mjs` REJECT the new feedback key class and fixing them requires changing fold semantics — report.
- Any styling framework/dependency addition (the board is dependency-free; keep it that way).

## Maintenance notes

- The Final Cut tab is the owner's primary QC surface now; `scripts/qc-video.sh` filmstrip QC remains the automated complement.
- Versions/media live in kb-scratch only — a `git status` showing mp4s means a path bug.
- Plan 141 documents the two-tab flow in the skill; keep route names stable.
