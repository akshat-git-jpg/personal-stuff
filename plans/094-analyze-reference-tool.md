---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 094: analyze-reference — full-video effect discovery for any YouTube URL

## Summary

- **Problem statement**: Cloning an effect currently starts from owner-supplied timestamps. The owner wants: give a URL, get a full-video sweep that finds every effect moment automatically and produces the frame sheets + a moments list, so a session can write an "effects we could add" inventory without anyone scrubbing the video by hand.
- **Goals**:
  1. `scripts/analyze-reference.sh <url> [--keep-video]` — downloads the video, detects effect moments two ways (ffmpeg scene-change scores for cuts/whips; per-frame luma-delta spikes for flashes), clusters them, and emits per-moment 30fps contact sheets + whole-video overview sheets + `moments.json` into `~/kb-scratch/video/visuals-flow/_reference/<video-id>/`.
  2. Pure helpers in `lib/reference-moments.mjs` (parse ffmpeg detector output, cluster, classify-hint) — unit-tested offline.
  3. A new `visuals-flow` skill verb: "analyze reference <url>" — run the script, read the sheets, write the committed inventory report `references/<video-id>.md` (moment table: time, type hint, what happens, have-it-already?, candidate?), which feeds EFFECTS.md's adding-a-new-effect recipe.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — script + pure helpers fully inlined; the verb text is provided verbatim below.
- **Done criteria** (terse): `check.sh` exit 0 with the new unit tests; script dry-run mode passes on a local fixture video (no network in tests); skill verb + references/ dir + PIPELINE.md note in place.
- **Stop conditions** (terse): no network calls from any test; no media committed to the repo.
- **Test / verification for success**: unit tests on parsing/clustering with captured-fixture detector output; verifier runs the script once on a real URL end-to-end.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9f5fd51..HEAD -- pipelines/video/visuals-flow pipelines/.claude/skills/visuals-flow` — plan 093's effects-layer changes may appear if it landed first; anything else is drift.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (093 lands the EFFECTS.md this feeds, but does not block)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `9f5fd51`, 2026-07-19

## Why this matters

The 2026-07-19 whip/flash work proved the loop: contact-sheet a reference → reverse-engineer the mechanism → new effect. The manual part was finding WHERE to look. Effect moments are machine-findable: hard cuts and whips spike ffmpeg's scene score; flashes spike frame-to-frame luma. Automating discovery turns "analyze this video" into one command + one session read, and the committed per-video report becomes provenance for EFFECTS.md rows.

## Current state (verified at 9f5fd51)

- Working technique (this is what the script automates), proven on youtu.be/7Ker2Vxs2yM:
  - Download: `yt-dlp --no-plugin-dirs -f "bv*[height<=720]+ba/b[height<=720]" --merge-output-format mp4 -o <out>.mp4 <url>` — **`--no-plugin-dirs` is REQUIRED on this machine**: the installed bgutil PO-token plugin is broken (its files moved; it times out every run).
  - Moment sheet: `ffmpeg -ss <t-0.7> -t 1.4 -i ref.mp4 -vf "fps=30,scale=480:-1,tile=4x11" moment-<mmss>.jpg`
  - Overview: `ffmpeg -i ref.mp4 -vf "fps=1/10,scale=320:-1,tile=6x5" overview-%d.jpg`
- Detectors (verify flags against `ffmpeg -version` 8.1.1, no drawtext/libass — irrelevant here):
  - Scene scores: `ffmpeg -i ref.mp4 -vf "select='gt(scene,0.25)',metadata=print" -an -f null - 2>&1` prints `pts_time` + `lavfi.scene_score` lines.
  - Luma series: `ffprobe -v error -f lavfi -i "movie=ref.mp4,signalstats" -show_entries frame=pts_time:frame_tags=lavfi.signalstats.YAVG -of csv=p=0` → `time,yavg` rows.
- Media policy (pipelines/CLAUDE.md): generated media never lands in the repo → all video/sheets go to `~/kb-scratch/video/visuals-flow/_reference/<video-id>/`. Committed text (the report) is fine in-repo.
- Skill source of truth: `pipelines/.claude/skills/visuals-flow/SKILL.md` (root-level copy is a symlink — edit the source only).
- CLI/test conventions: `lib/workdir.mjs`-style tiny modules, `node:test` suites listed explicitly in `scripts/check.sh`, fixtures under `lib/fixtures/`.

## Design (decided — do not re-litigate)

- Constants (top of `lib/reference-moments.mjs`): `SCENE_THRESHOLD = 0.25`, `LUMA_DELTA = 22` (YAVG jump per frame flagging a flash), `CLUSTER_GAP = 1.5` (seconds — moments closer than this merge), `SHEET_HALF = 0.7`.
- **`lib/reference-moments.mjs`** (pure, exported, unit-tested):
  - `parseSceneLog(text)` → `[{t, score}]` from the metadata=print output.
  - `parseLumaCsv(text)` → `[{t, yavg}]`; `lumaSpikes(rows, {delta})` → `[{t, jump}]` (abs delta between consecutive rows ≥ delta).
  - `clusterMoments(scenes, spikes, {gap})` → `[{t, kinds: ['cut'|'flash', ...], score}]` — merged, sorted; a moment carrying both kinds hints "whip/flash transition"; `score` = max scene score or luma jump (for ranking).
- **`scripts/analyze-reference.sh <url> [--keep-video]`**: extracts `<video-id>` from the URL (the 11-char YouTube id; bare ids accepted); `OUT=~/kb-scratch/video/visuals-flow/_reference/<video-id>`; downloads (skip if `ref.mp4` exists); runs both detectors; pipes their raw logs to `node lib/reference-moments.mjs --cli` (reads scene log + luma csv paths, writes `moments.json`); renders one `moment-<mmss.s>.jpg` sheet per clustered moment (cap: top 40 by score — `log()` a line when capped) + overview sheets; deletes `ref.mp4` unless `--keep-video`; prints the out-dir and moment count. `set -euo pipefail`, guard `$1` with a usage line (the 010-run.sh lesson).
- **`references/` dir** (new, in visuals-flow, committed): one `<video-id>.md` per analyzed video, written by the SESSION (not the script). PIPELINE.md gets one layout line.
- **Skill verb** (append to `pipelines/.claude/skills/visuals-flow/SKILL.md`, verbatim):

```markdown
## Verb: "analyze reference <url>" / "what effects does this video use"

1. `bash scripts/analyze-reference.sh <url>` — downloads to kb-scratch
   `_reference/<video-id>/`, detects cut/flash moments, writes moments.json +
   per-moment 30fps contact sheets + overview sheets. Nothing lands in git.
2. Read the overview sheets first (video's overall grammar), then each
   moment sheet (they are ranked; read top-score first, batch 4-6 per Read).
3. Write `references/<video-id>.md` (committed): a moment table —
   `| time | kinds | what happens (mechanism: duration in frames, blur/blend/
   slide/zoom) | already have? | candidate? |` — plus a shortlist of NEW
   effect candidates with the EFFECTS.md recipe as next step.
4. Surface the shortlist to the owner; each approved candidate becomes a new
   effect build (EFFECTS.md "Adding a new effect").
Token note: ~20-40 sheets per 10-min video; sheets are ~10x cheaper than
frame-by-frame reads. Do not read moment sheets beyond the top 40.
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Unit tests only | `node --test lib/reference-moments.test.mjs` | all pass |
| Offline script smoke | `bash scripts/analyze-reference.sh --self-test` | `self-test OK` (see Step 2) |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/reference-moments.mjs` (+ test file + `scripts/check.sh` list entry), `scripts/analyze-reference.sh`, `references/README.md` (3 lines: what this dir is), `PIPELINE.md` (one layout line), `pipelines/.claude/skills/visuals-flow/SKILL.md` (the verb, verbatim from Design).

**Out of scope**: EFFECTS.md itself (093 owns it), any effect implementation, yt-dlp installation/config (present and working with `--no-plugin-dirs`), the yt-style-copy skill (whole-style cloning — different tool), committing any media.

## Git workflow

- Branch: `boss/094-analyze-reference-tool`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: pure helpers + unit tests

`lib/reference-moments.mjs` per Design with a small `--cli` mode (args: `--scene-log <f> --luma-csv <f> --out <moments.json>`). Fixtures: craft `lib/fixtures/reference-scene-log.txt` and `reference-luma.csv` by hand in the shapes shown in Current state (a dozen lines each; include one co-located cut+flash and two moments 0.8s apart that must cluster). Tests: parsing both formats, spike detection at the threshold boundary, clustering merges within `CLUSTER_GAP` and unions `kinds`, ranking by score. Add the test file to `scripts/check.sh`.

**Verify**: `bash scripts/check.sh` → exit 0 with the new tests counted.

### Step 2: the script + self-test

`scripts/analyze-reference.sh` per Design. `--self-test` mode: generates a 20s lavfi fixture locally (testsrc2 with two hard cuts via concat of different sources and one white-flash via a 3-frame `color=white` insert), runs the full detector→cluster→sheet pipeline on it (NO network), asserts moments.json contains ≥2 moments including one `flash`, prints `self-test OK`. This is the offline proof the plumbing works.

**Verify**: `bash scripts/analyze-reference.sh --self-test` → `self-test OK`; `bash scripts/check.sh` → exit 0.

### Step 3: docs + skill verb

`references/README.md`, PIPELINE.md layout line, and the SKILL.md verb exactly as inlined in Design (edit the source skill at `pipelines/.claude/skills/visuals-flow/SKILL.md`).

**Verify**: `grep -c "analyze reference" pipelines/.claude/skills/visuals-flow/SKILL.md` (from repo root) → ≥1; `bash scripts/check.sh` → exit 0.

## Test plan

Step 1 unit suite (offline fixtures) + Step 2 self-test (offline lavfi end-to-end). Real-URL run is a VERIFIER step, not a test — network stays out of the gate.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 including `reference-moments.test.mjs`.
- [ ] `bash scripts/analyze-reference.sh --self-test` prints `self-test OK`.
- [ ] Verifier ran the script on one real URL: sheets + moments.json landed under `~/kb-scratch/video/visuals-flow/_reference/<id>/`, nothing new under git status.
- [ ] SKILL.md verb + references/README.md + PIPELINE.md line present.
- [ ] `plans/README.md` row 094 updated to DONE.

## STOP conditions

- Any test or self-test needs network — restructure to fixtures; if impossible, stop.
- Any media file would land inside the repo working tree — stop (kb-scratch only).
- yt-dlp fails even with `--no-plugin-dirs` on the verifier's real-URL run — report the error; do NOT attempt to repair the global yt-dlp/plugin install.

## Maintenance notes

- Detector thresholds (`SCENE_THRESHOLD`, `LUMA_DELTA`, `CLUSTER_GAP`) are the tuning knobs; if a reference video's effects are missed, lower thresholds and re-run — the script is idempotent per video-id.
- The report format in the verb is the contract for EFFECTS.md provenance links; keep `references/<video-id>.md` names stable.
- If the owner starts analyzing weekly, consider a cron-free wrapper verb "compare reference <url> to our effects" that diffs the report against EFFECTS.md rows — future plan, not this one.
