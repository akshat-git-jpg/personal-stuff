---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: [after 134-vf2-scaffold]
---

# Plan 135: v2 coverage fix (orange screen), motion density, head layout modes

## Summary

- **Problem statement**: v1 exposes the card-stage burnt-amber background between fullframe graphics (fixed `hold: 3.0` expires before the next cue; nothing extends or fills the gap), narration stretches go bare up to 50s, and the avatar has only a full-screen mode — graphics cut away from the host instead of layering around them (spec deltas C + H).
- **Goals**: (1) `videos/<slug>/video.json` manifest with a `base` field; (2) resolver extends fullframe exposure to the next event; (3) assemble freeze-frame gap filler + lint error for uncovered seconds on base-less videos; (4) tighter narration density constant + new lint; (5) shots gain `mode: full|panel` with panel compositing + FCPXML transform.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria**: check.sh green including 4 new test files; fixtures prove extension/fill/panel math.
- **Stop conditions**: any change needed in v1 or card-library; ffmpeg filter syntax that fails the smoke command.
- **Test / verification for success**: unit tests over pure planning functions (no rendering, no committed video data — decisions.md 2026-07-20 rule).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md` (boss owns it on main); report status in your run summary.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2`
> (expect only plan-134 scaffold commits; if lib files differ beyond 134's path retarget, report drift.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 134
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

The owner's #1 perceived "sync" defect is actually exposure: `lib/resolve.mjs` computes `duration = lastBeat.at + hold` (hold default 3.0s), and `lib/assemble.mjs#planSegments` fills inter-graphic gaps with `screen.mp4`; when a video has no screen layer (explainer cuts, the board preview), the exposed frames are the stage background `--bg-from #3a1f08` (card-library `DESIGN.md`). Loop Studio never shows this class of gap because durations are locked to the voiceover and every clause has a beat. This plan makes background exposure structurally impossible and adopts the per-clause density bar + head-as-layout-element (spec §C, §H).

## Current state (all paths inside `pipelines/video/visuals-flow-2/` after plan 134)

`lib/resolve.mjs` — the timing core. Relevant excerpt (v1 lines 219–236):

```js
        if (abs.length) start = Math.max(0, +(abs[0].at - BEAT_LEAD_IN).toFixed(2));
        for (const x of abs) beats.push({ ...x.reveal, at: +(x.at - start).toFixed(2) });
      }
    }
    if (failed) continue;
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
    if (cat.placement === 'fullframe' && lastFullframe && start < lastFullframe.start + lastFullframe.duration) {
      errors.push(`${cue.id}: overlaps previous fullframe cue ${lastFullframe.id} ...`);
      continue;
    }
    const entry = {
      id: cue.id, card: cue.card, placement: cat.placement,
      start: +start.toFixed(2), duration,
      variables: { ...cue.variables, ...(beats.length ? { beats } : {}) },
    };
```

`lib/assemble.mjs#planSegments` (v1 lines 60–93): builds the base timeline — `repl` = fullframe graphics + `avatar-full` jobs sorted by start; gaps become `{kind:'screen'}` segments; overlapping base segments throw. `absorbSlivers` (lines 118–162) merges screen slivers ≤2.5s (graphic) / ≤1.0s (avatar) into the neighbor by extending `padStart`/`padEnd`.

`lib/cue-constants.mjs` — single source of numeric rules; `lib/lint-cues.mjs` enforces; `lib/build-prompt.mjs` regenerates the prompt block; `lib/check-rulebook.mjs` fails on prose/constants drift. Current relevant entries: `GAP_FULLFRAME_MIN 35`, `GAP_FULLFRAME_MAX 60`, `BARE_GAP_MAX 50` (lint W6).

`shots.json` schema (v2 `PIPELINE.md` §shots.json): spans `{id, kind:"avatar-full", from_anchor, to_anchor, note, flagged}`; `lib/resolve-shots.mjs` resolves anchors → `shots.resolved.json`; `lib/lint-shots.mjs` + `lib/shot-constants.mjs` gate; `lib/avatar-render.mjs` renders HeyGen clips; `lib/export-timeline.mjs` writes layered FCPXML.

`segments.json` (step 015) classifies the VO into demo vs narration spans — the input for the narration-density lint.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| One test file | `node --test lib/resolve.test.mjs` (from folder root) | pass — NEVER `node --test <dir>` (broken on node 22) |
| ffmpeg freeze-frame smoke | `ffmpeg -f lavfi -i testsrc=d=2:s=320x180:r=30 -vf "tpad=stop_mode=clone:stop_duration=1.5" -f null - 2>&1 \| tail -1` | exits 0 |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `lib/video-manifest.mjs` (new) + `lib/video-manifest.test.mjs` (new)
- `lib/resolve.mjs`, `lib/resolve.test.mjs`
- `lib/cue-constants.mjs`, `lib/lint-cues.mjs`, `lib/lint.test.mjs`
- `lib/assemble.mjs`, `lib/assemble.test.mjs`
- `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/shot-constants.mjs` + their tests
- `lib/export-timeline.mjs`, `lib/export-timeline.test.mjs`
- `steps/020-cue-pass-llm/cue-pass-prompt.md` (regenerated block only, via `node lib/build-prompt.mjs`)
- `steps/070-shot-pass-llm/shot-pass-prompt.md` + `steps/070-shot-pass-llm/RULEBOOK.md` (mode rules)
- `scripts/check.sh` (register new test files in the explicit list — a test not listed silently never runs)
- `PIPELINE.md` (schema additions: video.json, `mode` field)

**Out of scope**:
- `pipelines/video/visuals-flow/**` (v1 frozen), `card-library/**`, board UI (plan 140), sound (139).
- HeyGen API behavior — panel mode reuses existing clips; no new render kinds.

## Git workflow

- Branch: `advisor/135-vf2-coverage-density-headmodes`
- Commit per step. Do NOT push.

## Steps

### Step 1: video.json manifest loader

New `lib/video-manifest.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
export const MANIFEST_DEFAULTS = { base: 'screen', aspect: '16:9', brand: 'default', music: '' };
export function loadVideoManifest(workdir) {
  const p = path.join(workdir, 'video.json');
  if (!fs.existsSync(p)) return { ...MANIFEST_DEFAULTS };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const m = { ...MANIFEST_DEFAULTS, ...raw };
  if (!['screen', 'none'].includes(m.base)) throw new Error(`video.json base must be "screen"|"none", got "${m.base}"`);
  if (m.aspect !== '16:9') throw new Error('video.json aspect: only "16:9" is supported (longform-only, decisions.md 2026-07-24)');
  return m;
}
```

Test `lib/video-manifest.test.mjs`: defaults when file missing (use a tmpdir), merge, bad `base` throws, bad `aspect` throws.

**Verify**: `node --test lib/video-manifest.test.mjs` → pass.

### Step 2: resolver hold-until-next extension

In `lib/cue-constants.mjs` add (keeping the format: value + rule prose):
- `HOLD_EXTEND_CAP: 20` — "A fullframe card's exposure may auto-extend at most 20s past its computed end to reach the next base event (resolver post-pass)."
- `GAP_ABSORB: 4` — "On base:screen videos, a gap to the next base event of at most 4s is absorbed by extending the previous fullframe card; larger gaps intentionally show the screen recording."

In `lib/resolve.mjs` add an exported pure post-pass and call it from `main()` after `resolveCues` (it needs `total` = last transcript word `end` + 1.0, and the manifest):

```js
// Post-pass: kill hold-expiry gaps (spec delta C). Fullframe exposure extends
// to the next base event: always on base:none (up to HOLD_EXTEND_CAP, else E7
// in lint), and only across gaps <= GAP_ABSORB on base:screen.
export function extendExposure(resolved, { base, total }) {
  const fulls = resolved.filter((c) => c.placement === 'fullframe');
  const out = resolved.map((c) => ({ ...c }));
  const byId = Object.fromEntries(out.map((c) => [c.id, c]));
  for (let i = 0; i < fulls.length; i++) {
    const cur = byId[fulls[i].id];
    const end = cur.start + cur.duration;
    const nextStart = i + 1 < fulls.length ? fulls[i + 1].start : total;
    const gap = +(nextStart - end).toFixed(2);
    if (gap <= 0) continue;
    const maxExtend = CUE_CONSTANTS.HOLD_EXTEND_CAP.value;
    const wanted = base === 'none' ? gap : (gap <= CUE_CONSTANTS.GAP_ABSORB.value ? gap : 0);
    const grant = Math.min(wanted, maxExtend);
    if (grant > 0) cur.duration = +(cur.duration + grant).toFixed(2);
  }
  return out;
}
```

(Import `CUE_CONSTANTS` at top; note avatar-full spans are not known at resolve time — they replace screen later, and extension only ever pads INTO what would otherwise be gap/screen, never over another graphic because it stops at `nextStart`. On base:screen the 4s cap keeps demos visible.)

`main()` wiring: `const manifest = loadVideoManifest(workdir);` then `const extended = extendExposure(resolved, { base: manifest.base, total: words[words.length-1].end + 1.0 });` and write `extended` (keep the same output shape).

Tests in `lib/resolve.test.mjs`: (a) base none, two fullframes 8s apart → first extends to second's start; (b) gap 25s on base none → extends exactly 20 (cap); (c) base screen gap 3s → absorbed; (d) base screen gap 10s → unchanged; (e) overlays never modified.

**Verify**: `node --test lib/resolve.test.mjs` → pass.

### Step 3: lint — uncovered-second error + narration density

`lib/cue-constants.mjs` add: `NARRATION_BARE_GAP_MAX: 20` — "Within narration segments (segments.json), no stretch longer than 20s may pass without a cue START (lint W7). Demo segments keep BARE_GAP_MAX." Keep `BARE_GAP_MAX: 50` (now demo-scoped in its prose; update the rule string).

`lib/lint-cues.mjs`:
- **E7** (error, only when `video.json` base is `none`): after applying `extendExposure` math, any instant in `[firstCue.start, total - ZONE_END]` not covered by a fullframe card is an error listing the gap `[from–to]`. (Implement by walking sorted fullframes exactly as `extendExposure` does; lint may import it.)
- **W7** (warning): per narration segment from `segments.json`, gaps between consecutive cue starts (any placement) > `NARRATION_BARE_GAP_MAX` are flagged with the stretch times. W6 (`BARE_GAP_MAX`) now applies only inside demo segments.

Then regenerate the prompt block: `node lib/build-prompt.mjs` (check-rulebook enforces sync).

Tests in `lib/lint.test.mjs`: E7 fires on a synthetic base-none fixture with an unfillable 30s hole; W7 fires on a 25s bare narration stretch and not on 15s; W6 unchanged on demo.

**Verify**: `node --test lib/lint.test.mjs && node lib/check-rulebook.mjs` → both pass.

### Step 4: assemble freeze-frame gap filler (base: none)

In `lib/assemble.mjs`:
- Thread `base` from the video manifest into `planSegments` callers (assemble's main + `lib/effects-plan.mjs` context building).
- New exported `fillGapsWithFreeze(segments, { base })`: when `base === 'none'`, convert every `kind:'screen'` segment into `{ kind: 'freeze', from: <id of previous non-screen segment or next if none>, ...same start/end }`. (After Step 2 these only remain at the head, tail, or where E7 was overridden — belt and braces.)
- In the segment-encode branch, a `freeze` segment encodes from the neighbor graphic's rendered file: last frame via `-sseof -0.05 -i <prev.mp4>` + `tpad=stop_mode=clone:stop_duration=<dur>` (head-gap variant: first frame via `-i <next.mp4> -frames:v 1` + tpad), scaled with the same `VF` chain other segments use, plus a 0.4s `xfade=transition=fade` into the neighbor is NOT required — segments are concat'd; a plain freeze is acceptable v1 behavior.
- `screen.mp4` missing + `base:'screen'` stays the existing error; `base:'none'` must not require screen.mp4 anymore.

Tests (`lib/assemble.test.mjs`, pure planning only — no ffmpeg spawn): freeze conversion on base none; screen segments preserved on base screen; freeze `from` points at the correct neighbor.

**Verify**: `node --test lib/assemble.test.mjs` → pass; run the ffmpeg freeze-frame smoke command from the table → exit 0.

### Step 5: head layout modes (panel)

Schema: spans gain optional `"mode": "full" | "panel"` (default `full`; "hidden" = simply no span — document, don't implement a value).
- `lib/resolve-shots.mjs`: pass `mode` through; default `'full'`; validate enum.
- `lib/shot-constants.mjs`: `PANEL_WIDTH_FRAC: 0.28`, `PANEL_INSET_PX: 32`, `PANEL_RADIUS_PX: 24` (with rule prose).
- `lib/lint-shots.mjs`: panel spans are EXEMPT from the full-screen budget caps (they don't replace the base) but must not overlap another avatar span; error otherwise.
- `lib/assemble.mjs`: panel spans do NOT enter `planSegments` `repl` (only `kind:'avatar-full'` with `mode:'full'` do). Instead they join the overlay compositing path as a scaled rounded-rect PIP: scale to `round(W*0.28/2)*2` wide (keep AR), rounded corners via alpha `geq`:
  `format=yuva444p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lt(hypot(max(abs(X-W/2)-(W/2-R),0),max(abs(Y-H/2)-(H/2-R),0)),R+0.5),255,0)'` with `R=24`, overlaid at `x=main_w-overlay_w-32:y=main_h-overlay_h-32` between the span's start/end (mirror how `lib/effects/bubble.mjs` builds its circular mask + overlay enable window — read that file first; it is the in-repo exemplar for exactly this compositing class).
- `lib/export-timeline.mjs`: panel clips ride the avatar lane with an FCPXML `<adjust-transform scale="0.28 0.28" position="<x> <y>"/>` so the editor can move them (compute position for bottom-right inset 32px on the project canvas; follow the existing lane-authoring code style).
- `steps/070-shot-pass-llm/shot-pass-prompt.md` + RULEBOOK: describe when to pick panel (host reacts while content stays visible; graphics layer over/around the head — spec §H), one paragraph each.

Tests: resolve-shots mode passthrough + bad-enum error; lint-shots overlap error + budget exemption; assemble planSegments excludes panel spans; export-timeline emits adjust-transform for a panel fixture span.

**Verify**: `node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/assemble.test.mjs lib/export-timeline.test.mjs` → pass.

### Step 6: register + full gate

Add `lib/video-manifest.test.mjs` to `scripts/check.sh`'s explicit list. Update `PIPELINE.md`: video.json schema block + `mode` field semantics in the shots schema section.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

All new behavior lands as pure functions with fixture-driven `node --test` suites (no rendering, no `videos/` data, no network). ffmpeg syntax is smoke-checked via lavfi only.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] `grep -n "extendExposure" lib/resolve.mjs lib/lint-cues.mjs` → present in both
- [ ] `grep -n "HOLD_EXTEND_CAP\|GAP_ABSORB\|NARRATION_BARE_GAP_MAX" lib/cue-constants.mjs` → 3 hits
- [ ] `grep -n "mode" lib/resolve-shots.mjs` → passthrough present; `grep -n "adjust-transform" lib/export-timeline.mjs` → present
- [ ] `node lib/check-rulebook.mjs` → exit 0 (prompt regenerated, not hand-edited)

## STOP conditions

- Any edit required in `pipelines/video/visuals-flow/` or `card-library/`.
- The geq rounded-rect or tpad filter fails its lavfi smoke — report the ffmpeg version + error, don't improvise a different visual treatment.
- An existing test's EXPECTED behavior must change beyond the documented constants (a semantics conflict with v1 behavior not described here).

## Maintenance notes

- `extendExposure` runs at resolve time; the board (plan 140) and effects-plan see extended durations automatically via resolved.json.
- Plan 139 (sound) reads the same segment plan; freeze segments must carry no special audio.
- The 060 fold may retune `NARRATION_BARE_GAP_MAX` — it lives in cue-constants like every other number.
