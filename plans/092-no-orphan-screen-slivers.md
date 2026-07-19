---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 092: No orphan screen slivers — plan-time lint + assemble-time absorption

## Summary

- **Problem statement**: test-01's final cut shows 0.4–2s fragments of screen recording sandwiched between avatar spans and graphics (0:00→0:00.4 before s01; 57.5→58.9 between s01 and the section card). They exist because the cue pass and shot pass are planned independently and nothing ever inspects the RESULTING base track — `planSegments` fills any gap with screen, however tiny. Owner verdict (2026-07-19): looks odd; wants a structural solve, not a patch.
- **Goals** (three layers, all deterministic):
  1. `resolve-shots` edge snapping: a span starting <1.5s from t=0 snaps to 0; ending <1.5s from total snaps to total.
  2. New lint-shots rules: E5 (error) screen segment <2.5s between two avatar spans (nothing downstream can absorb it); W5 (warning) screen segment <5s anywhere (planning smell, fix on the board or extend the span).
  3. Assemble-time absorption: a screen sliver ≤2.5s adjacent to a graphic — or ≤1.0s adjacent to an avatar — is absorbed by the neighbor via `tpad` first/last-frame freeze (no content retiming; reveals stay VO-synced).
  4. Rulebook guidance: 070 RULEBOOK + shot-pass-prompt gain a "no orphan screen" rule (spans butt against fullframe cues/video edges or leave ≥8s of screen).
- **Executor proposed**: claude-p / sonnet (rulebook prose is owner-taste content; the code is fully inlined).
- **Done criteria** (terse): `check.sh` exit 0 with new unit tests; `planSegments`+absorption on test-01's real data produces NO screen segment <2.5s; lint W5/E5 fire on synthetic fixtures.
- **Stop conditions** (terse): changes needed to the cues/shots schemas; any board UI work beyond lint already surfacing in the Save banner.
- **Test / verification for success**: unit tests per layer + a test-01-data regression check; verifier renders `--draft` and confirms the 0:00 and 0:58 slivers are gone.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cd858ab..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps/070-shot-pass-llm` — an inline bugfix commit to assemble/captions (flash colorspace, caption text field, driftVF) is expected on top of cd858ab; anything else is drift.

## Status

- **Priority**: P1 (owner-flagged structural defect)
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (coordinate with the in-flight whip/flash bugfix commit — same file)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cd858ab` + pending bugfix commit, 2026-07-19

## Why this matters

The pipeline's editorial grammar is: screen recording is the default bed; avatar spans and fullframe cards replace it. A 0.4s or 1.4s flash of screen between two replacements reads as an editing mistake — the viewer sees the bed for less time than a cut needs to register. The reference channel never does this: their host/graphic blocks butt directly against each other or leave real screen time. Because spans and cues are authored in separate LLM passes against the VO only, the combined base track is emergent — no stage owns its quality. This plan gives every stage a piece: the resolver snaps edges, lint makes slivers visible at plan time (where the owner can fix them with context, feeding the board loop), assembly absorbs what remains mechanically, and the rulebook teaches the shot pass to stop creating them.

## Current state (verify excerpts against HEAD after the bugfix commit; module shapes at `pipelines/video/visuals-flow/`)

- `lib/assemble.mjs` — `planSegments({resolved, avatarJobs, total})` builds the contiguous base track, inserting `{kind:'screen', id:'screen-NN'}` fillers for every gap > EPS (0.05s) with no minimum size. Graphic segments encode with `tpad=stop_mode=clone:stop_duration=30` already appended (safe tail-freeze exists); avatar segments seek clip-local (`['-ss', String(seg.start - job.start + startTrim)]`).
- `lib/resolve-shots.mjs` — resolves `from_anchor`/`to_anchor` to `{id, start, end}` spans via the shared `findPhrase`; no edge snapping. Exports `resolveShots(shotsFile, words)`.
- `lib/lint-shots.mjs` — `lintShots({shotsResolved, resolvedCues, words})` emits `E#`/`W#` strings (E2 fullframe collision, E3 min span, E4 budget, W3 U-curve, W4 cadence); constants at top. The board Save banner and step 070's fix-loop already display whatever this returns — new rules ride free.
- `steps/070-shot-pass-llm/RULEBOOK.md` + `shot-pass-prompt.md` — the judgment surfaces; HANDOFF.md "Where the rules live" row 6 mandates editing BOTH together.
- test-01 real data (the regression fixture): `videos/test-01/shots.resolved.json` spans (s01 starts 0.4 — the t=0 sliver) + `videos/test-01/resolved.json` cues; the 57.5→58.9 sliver sits between s01's end and the following fullframe cue.

## Design (decided — do not re-litigate)

Constants: `SNAP_EDGE = 1.5` (resolve-shots), `SLIVER_GRAPHIC = 2.5`, `SLIVER_AVATAR = 1.0` (assemble), `MIN_SCREEN_ERROR = 2.5`, `MIN_SCREEN_WARN = 5` (lint-shots).

1. **Edge snapping** (`resolve-shots.mjs`): after resolving, `if (span.start < SNAP_EDGE) span.start = 0;` and `if (total - span.end < SNAP_EDGE) span.end = total;` (total = last word end). Snapping is recorded in the span as `snapped: true` for the EDL/tests.
2. **Lint** (`lint-shots.mjs`): import `planSegments` from `./assemble.mjs`; build segments from `{resolvedCues (fullframe only), spans-as-avatarJobs, total}`; for each `screen` segment with `end-start < MIN_SCREEN_ERROR` whose BOTH neighbors are avatar spans → `E5 orphan-screen: <a>s of screen between <idA> and <idB> — extend a span or drop it on the board`; else any screen segment `< MIN_SCREEN_WARN` → `W5 short-screen: ...` (same message shape as existing rules).
3. **Absorption** (`assemble.mjs`): new pure `absorbSlivers(segments, { graphicMax = SLIVER_GRAPHIC, avatarMax = SLIVER_AVATAR } = {})`, applied in `runAssembly` right after `planSegments` (BEFORE beat-splitting and transitions): for each screen segment shorter than the applicable threshold, delete it and extend a neighbor's window over it — preference order: graphic neighbor (either side, threshold `graphicMax`), else avatar neighbor (threshold `avatarMax`), else keep the sliver. Extended segments carry `padStart` / `padEnd` (seconds of freeze needed at that edge). Encode wiring: a `padStart` on a graphic/avatar segment prepends `tpad=start_mode=clone:start_duration=<padStart>` to its chain and does NOT shift its source seek (frame 0 freezes over the sliver — reveals stay VO-synced); `padEnd` extends `-t` (the existing `stop_mode=clone` tail covers it). The EDL lists absorbed windows as part of the extended segment (id unchanged); transitions/beats operate on the post-absorption list, so a whip lands on the new (earlier) boundary — exactly the wanted look.
4. **Rulebook** (070 RULEBOOK.md + shot-pass-prompt.md, edit BOTH): add the rule: "A span must either start/end flush against a fullframe cue boundary or the video edge, or leave at least 8 seconds of screen recording on that side. Never leave 0.5–5s screen fragments — lint W5/E5 rejects them." Match each doc's existing voice and structure; this is an owner-directed rule addition (2026-07-19 feedback), the fold-channel equivalent.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| test-01 regression probe | `node -e "…(inline in Step 3)…"` | no screen segment < 2.5s |
| Draft render (verifier only) | `bash steps/090-assemble-run/run.sh test-01 --draft` | no sliver at 0:00 / 0:58 |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/assemble.mjs`, their three test files, `steps/070-shot-pass-llm/RULEBOOK.md`, `steps/070-shot-pass-llm/shot-pass-prompt.md`, `PIPELINE.md` (one line in the shots.json field semantics noting edge snapping).

**Out of scope**: `videos/test-01/**` committed artifacts (do NOT re-run resolve-shots on test-01 — its avatar clips are already rendered against the 0.4s start; absorption handles it at assemble time); the cue pass surfaces; the board UI; `planAvatarBeats`/whip/flash internals (only their input segment list changes).

## Git workflow

- Branch: `boss/092-no-orphan-screen-slivers`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: `absorbSlivers` + encode wiring + unit tests

Add the pure function and the `padStart`/`padEnd` encode handling per Design. Unit tests (assemble.test.mjs, planner-test style): (a) 1.4s sliver between avatar and graphic → absorbed into the graphic with `padStart=1.4`; (b) 0.4s sliver at t=0 before an avatar → absorbed with `padStart=0.4`; (c) 2s sliver between two avatars → NOT absorbed (over avatarMax); (d) 6s screen segment untouched; (e) output remains contiguous 0→total. Integration: extend an existing runAssembly case with a 1s sliver and assert segment count and final duration.

**Verify**: `node --test lib/assemble.test.mjs` → all pass.

### Step 2: edge snapping + lint rules + unit tests

Per Design items 1–2, with tests in `resolve-shots.test.mjs` (snap at both edges; `snapped` flag; no snap at 1.6s) and `lint-shots.test.mjs` (E5 between avatars <2.5s; W5 <5s; clean plan silent).

**Verify**: `node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs` → all pass.

### Step 3: test-01 regression probe + rulebook edits

Probe (also add as a permanent test using the committed test-01 JSON as fixture data):
```bash
node -e "
const { planSegments, absorbSlivers } = await import('./lib/assemble.mjs');
const r = JSON.parse(require('fs').readFileSync('videos/test-01/resolved.json','utf8')).resolved;
const s = JSON.parse(require('fs').readFileSync('videos/test-01/shots.resolved.json','utf8')).spans.map(x=>({...x, kind:'avatar-full'}));
const segs = absorbSlivers(planSegments({ resolved: r, avatarJobs: s, total: 1927.588 }));
const bad = segs.filter(x=>x.kind==='screen' && x.end-x.start<2.5);
console.log(bad.length === 0 ? 'OK no slivers' : bad);
" --input-type=module
```
Expected: `OK no slivers`. Then apply the rulebook/prompt edits (Design item 4) and the PIPELINE.md line.

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Steps 1–3 as above; the test-01 fixture test is the load-bearing one — it pins the exact owner-reported defect.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] test-01 probe prints `OK no slivers`.
- [ ] E5/W5 fire on synthetic fixtures; resolve-shots snaps edges with `snapped: true`.
- [ ] RULEBOOK + prompt both carry the no-orphan rule (grep `orphan` in both files → ≥1 hit each).
- [ ] `plans/README.md` row 092 updated to DONE.

## STOP conditions

- Absorption changing any reveal timing (a graphic's content must start at exactly its original VO-anchored time — freeze frames only). If the tpad approach can't guarantee that, stop and report.
- The lint import of `planSegments` creates a circular dependency — restructure by moving `planSegments` to a shared module ONLY if trivial; else stop and report.
- Any needed change to committed test-01 artifacts.

## Maintenance notes

- Verifier: render test-01 `--draft` and check 0:00 (video should OPEN on the avatar, no screen blink) and ~0:58 (avatar → card with no screen between) — the two owner-reported sites.
- Future videos get triple protection: snapping prevents edge slivers, lint surfaces mid-video ones at plan time (board Save banner), absorption cleans up what slips through. The rulebook edit reduces how often the latter two fire.
- The corner-bubble feature (deferred) makes brief screen moments less jarring (host stays visible) — but the sliver rules stay correct regardless.
