<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && node --test
ui:
deploy:
needs: ["Edits lib/lint-cues.mjs — land after 116"]
---

# Plan 117: Segment map — stop fullframe graphics from covering live demo footage

## Summary

- **Problem statement**: The cue pass is told "never cover a demo the screen already shows" in prose, while lint rule W1 *warns on every run* unless a fullframe card fires every 35–60s. An enforced rule always beats a prose rule, so models reliably place fullframe cards over live screen-recording demos — replacing the exact footage the tutorial exists to show.
- **Goals**:
  - Introduce a per-video **segment map** classifying the timeline as `narration` / `demo` / `playback`.
  - Make fullframe placement inside `demo`/`playback` a **hard lint error**, so the demo rule stops being advisory.
  - Measure W1 cadence and W6 bare-stretch **only across `narration`**, so the linter stops demanding cards where cards are forbidden.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — schema, detector heuristics and lint changes are fully inlined below.
- **Done criteria** (terse — full list below): `node --test` green; `segments.mjs --propose` produces a valid map for `opusclip-tutorial`; a fullframe cue inside a demo segment produces an ERROR; W1/W6 skip non-narration.
- **Stop conditions** (terse — full list below): suite red before starting; a committed video gaining errors that are not genuine demo-coverage.
- **Test / verification for success**: unit tests over a synthetic segment map plus a real proposal run against `opusclip-tutorial`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/visuals-flow/lib/lint-cues.mjs pipelines/video/visuals-flow/lib/segments.mjs pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 116 (both edit `lib/lint-cues.mjs`)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Owner review of `opusclip-tutorial` on 2026-07-21 rejected cues `c10` and `c15` — both `checklist/icon-pills`, both `fullframe`, running 23.5s and 15.7s over live product-demo footage. Owner verdict: *"This is supposed to be something which the tutorial maker is showing on the screen. Why would you show a motion graphic?"*

The cue-pass session that produced them recorded the conflict in its own reasoning — it identified the placement as "echoes on-screen steps → banned-ish" and did it anyway, because W1 demanded a fullframe in that window. That is not a model defect to be prompted away; it is a rule-precedence defect.

The prompt makes it worse by prescribing fullframe cards as the remedy for a bare demo:

> Demos & step narration (mandatory): do NOT lay a redundant graphic over a click the screen already shows … But do NOT leave a long demo stretch bare either: punctuate it with … a `statement/keyword-statement`/`slate/kinetic-sentence` of the point …

Both suggested cards are `placement: fullframe` in `catalog.json`. Following the prompt literally covers the demo. `checklist/icon-pills` compounds it — its documented trigger is "enumerating features/capabilities", with no exception for capabilities the screen is currently displaying.

The durable fix is to give the linter the one fact it lacks: **which parts of this video are carried by the recording**.

## Current state

### `lib/lint-cues.mjs` — the rules that need segment awareness

Constants (lines 14–20):

```js
const GAP_FULLFRAME_MAX = 60;
const GAP_FULLFRAME_MIN = 35;
const DENSITY_OVERLAY_WINDOW = 60;
const DENSITY_OVERLAY_MAX = 3;
const TARGET_RATE_MIN = 1.0;
const TARGET_RATE_MAX = 1.9;
const BARE_GAP_MAX = 50;
```

W1 (lines 93–108) walks consecutive fullframes and warns when `curr.start - prev.start` falls outside `[35, 60]`. W6 (lines 148–155) warns when `curr.start - (prev.start + prev.duration) > 50`. Neither knows what is on screen.

### The resolved shape lint consumes

`videos/<slug>/resolved.json` → `{ resolved: [ { id, card, placement, start, duration, variables } ] }`. Placement comes from the catalog: `fullframe` replaces the screen, anything else overlays it.

### Evidence from the rejected video

`c10` starts 244.84s, duration 23.48s. `c15` starts 374.57s, duration 15.70s. Both fall inside the Submagic/OpusClip walkthrough, roughly 190s–497s, where the narration is "click here / select this / go over to". Between 497s and 552s the video plays a generated sample clip whose audio is not the presenter at all.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full suite (merge gate) | `cd pipelines/video/visuals-flow && node --test` | exit 0, `# fail 0` |
| Propose a segment map | `cd pipelines/video/visuals-flow && node lib/segments.mjs opusclip-tutorial --propose` | writes `videos/opusclip-tutorial/segments.json` |
| Lint a video | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs opusclip-tutorial` | prints findings |
| Transcript as text | `cd pipelines/video/visuals-flow && node lib/transcript-text.mjs opusclip-tutorial` | plain text |

Never author a `test_cmd` as `node --test <dir>/` (`plans/runs/LESSONS.md`, 2026-07-09).

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/segments.mjs` (new)
- `pipelines/video/visuals-flow/lib/segments.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow/lib/lint.test.mjs`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` and `RULEBOOK.md` (the demo rule wording)
- `pipelines/video/visuals-flow/PIPELINE.md`, `HANDOFF.md` (document the artifact)
- `videos/opusclip-tutorial/segments.json` (generated + hand-corrected)

**Out of scope**:
- The storyboard board (`lib/board.mjs`). Editing segments on the board is a later plan; for now `segments.json` is hand-edited.
- `test-01` / `test-02` — do **not** author segment maps for them. Absent map = current behaviour (see Step 3).
- Any `cues.json`.
- The shot pass (`070`) and its `shots.json`, which has its own notion of spans.

## Git workflow

- Branch: `advisor/117-segment-map`
- Commit per step. Message style: `feat(visuals-flow): segment map + demo-safe placement`. No AI footers. Do NOT push.

## Steps

### Step 1: Define the schema

`videos/<slug>/segments.json`:

```json
{
  "video": "opusclip-tutorial",
  "confirmed": false,
  "segments": [
    { "kind": "narration", "start": 0,     "end": 189.8, "note": "cold open + overview" },
    { "kind": "demo",      "start": 189.8, "end": 497.0, "note": "both tools walked through on screen" },
    { "kind": "playback",  "start": 497.0, "end": 552.1, "note": "generated sample clips play" },
    { "kind": "narration", "start": 552.1, "end": 1074.8 }
  ]
}
```

Rules:
- Segments are contiguous and non-overlapping; the first starts at 0 and the last ends at the transcript's final word time.
- `kind` is one of `narration` | `demo` | `playback`.
- `confirmed` is set to `true` by the owner after checking the boundaries. Lint treats `confirmed: false` as advisory (warnings) and `confirmed: true` as binding (errors). This is what stops a bad auto-proposal from hard-failing a run.

### Step 2: Write the proposer

Create `lib/segments.mjs`. It reads `transcript.json` (a flat array of `{text,start,end}`) and proposes boundaries from demo-language density.

```js
// Phrases that indicate the presenter is driving a UI on screen. Deliberately
// narrow: a false `demo` classification suppresses graphics, so prefer misses
// over false positives — the owner corrects boundaries by hand.
const DEMO_CUES = [
  'click on', 'clicking on', 'go over to', 'going to go over', 'over here',
  'right here', 'as you can see', 'you can see that', 'let\'s go with',
  'select your', 'i\'m going to go with', 'upload', 'on this side',
  'go ahead with that', 'move over to',
];

const WINDOW = 30;   // s — rolling window the density is measured over
const MIN_HITS = 2;  // hits inside a window to call it demo
const MIN_SEG = 20;  // s — shorter runs are merged into their neighbour
```

Algorithm (write it exactly):
1. Build the lowercased word stream with times.
2. Slide a `WINDOW`-second window in 5s steps; a window is `demo` when it contains `>= MIN_HITS` distinct cue phrases.
3. Collapse consecutive same-kind windows into runs; anything not `demo` is `narration`.
4. Drop runs shorter than `MIN_SEG` by merging into the preceding run.
5. Never emit `playback` automatically — it cannot be detected from a transcript alone. Emit it only as a `note` on any `demo` run longer than 40s: `"check for sample-clip playback inside this range"`.
6. Write `segments.json` with `confirmed: false`.

CLI: `node lib/segments.mjs <slug> --propose` writes the file; `node lib/segments.mjs <slug>` prints the current map as a table.

**Verify**: `cd pipelines/video/visuals-flow && node lib/segments.mjs opusclip-tutorial --propose && node -e "const s=require('./videos/opusclip-tutorial/segments.json');const ok=s.segments.every((x,i,a)=>i===0||x.start===a[i-1].end);console.log(ok?'contiguous ok':'GAPS')"` -> `contiguous ok`

### Step 3: Teach lint the segment map

In `lib/lint-cues.mjs`, load `segments.json` from the workdir if present.

**When the file is absent**: behave exactly as today, and push one warning:
`W7 no-segment-map: no segments.json — cadence rules assume the whole video is narration; run 'node lib/segments.mjs <slug> --propose'`.
This keeps `test-01`/`test-02` green and makes adoption progressive.

**When present**, add:

```js
// E5 demo-coverage — a fullframe card replaces the screen. Inside a demo or
// playback stretch the recording IS the content, so replacing it is never
// correct; overlays remain legal. Prose could not hold this line against W1
// (owner rejection 2026-07-21, cues c10/c15), so it is enforced here.
const kindAt = (t) => (segments.find(s => t >= s.start && t < s.end) ?? {}).kind ?? 'narration';

for (const r of sortedResolved) {
  const cat = bySlug[r.card];
  if (!cat || cat.placement !== 'fullframe') continue;
  const k = kindAt(r.start);
  if (k === 'demo' || k === 'playback') {
    const msg = `E5 demo-coverage: ${r.id} (${r.card}, fullframe, ${r.duration}s) starts at ${r.start.toFixed(1)}s inside a ${k} segment — a fullframe card replaces the screen recording. Use an overlay card, or move the cue into a narration stretch.`;
    (confirmed ? errors : warnings).push(msg);
  }
}
```

Then make W1 and W6 segment-aware:
- **W1**: build the fullframe list, then drop any pair whose gap is *spanned* by a non-narration segment, and skip cadence checks entirely for pairs whose midpoint is non-narration. Simplest correct implementation: compute `narrationGap(prev, curr)` = the seconds of `narration` between the two starts, and compare *that* against `[35, 60]` instead of raw elapsed time.
- **W6**: same substitution — measure only the `narration` seconds in the gap.

This is the change that makes the two rules stop contradicting each other: a 300s demo no longer counts as 300s of missing cadence.

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs opusclip-tutorial` -> prints `E5 demo-coverage` warnings naming `c10` and `c15` (warnings, because the map is not yet `confirmed`)

### Step 4: Confirm the map for the rejected video

Hand-correct `videos/opusclip-tutorial/segments.json` to the four segments shown in Step 1 (the proposer will not find the `playback` range), set `confirmed: true`, and commit it as the worked example.

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs opusclip-tutorial; echo "EXIT=$?"` -> `EXIT=1` with `E5 demo-coverage` errors for `c10` and `c15`

This failure is the plan succeeding: the linter now rejects exactly what the owner rejected by eye.

### Step 5: Fix the prompt's self-contradiction

In `steps/020-cue-pass-llm/cue-pass-prompt.md`, rewrite the "Demos & step narration" rule so its remedies are placement-legal:

- State that during a demo/playback stretch **only `placement: overlay` cards may be used**, and that this is enforced (lint E5).
- Remove `statement/keyword-statement` and `slate/kinetic-sentence` from the demo-punctuation list — both are `fullframe`. Replace with `overlay/callout`, `overlay/lower-third`, `overlay/tip-banner`, `overlay/stat-hit`, `overlay/verdict-chips`.
- Add to the `checklist/icon-pills` trigger: "…unless the screen is currently showing those capabilities being set — during a demo this card is illegal (fullframe)."
- State that fullframe cadence is measured over narration only, so a long demo is not a cadence failure.

Mirror the same edits into `RULEBOOK.md` (the fold README requires both surfaces to move together).

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` -> `rulebook ok`

### Step 6: Tests

In `lib/segments.test.mjs`:
1. A synthetic transcript with a dense run of demo cues yields one `demo` run covering it.
2. Segments come back contiguous, ordered, and covering `[0, lastWordEnd]`.
3. A run shorter than `MIN_SEG` is merged, not emitted.

In `lib/lint.test.mjs`:
4. `confirmed: true` + fullframe cue inside `demo` → **error** containing `E5 demo-coverage`.
5. Same, but `confirmed: false` → **warning**, not error.
6. An **overlay** cue inside `demo` → neither.
7. Two fullframes 300s apart with a 260s `demo` between them → **no** W1 max-gap warning (narration gap is only 40s).

Test 7 is the direct regression for the rule-conflict this plan exists to resolve.

**Verify**: `cd pipelines/video/visuals-flow && node --test` -> exit 0, `# fail 0`

### Step 7: Document

- `PIPELINE.md`: add a `segments.json` row to the `videos/<slug>/` layout block and a line to the step table (segment map is produced before the cue pass).
- `HANDOFF.md`: add the `segments.mjs --propose` command to the command list.

**Verify**: `grep -c "segments.json" pipelines/video/visuals-flow/PIPELINE.md` -> at least `1`

## Test plan

Unit tests only, in the existing `node:test` suite. No fixtures beyond small inline transcripts. The real-video check in Step 4 is the acceptance evidence and is recorded in the commit message.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0 with `# fail 0`
- [ ] `node lib/segments.mjs opusclip-tutorial --propose` writes a contiguous, ordered map
- [ ] `videos/opusclip-tutorial/segments.json` is committed with `confirmed: true`
- [ ] `node lib/lint-cues.mjs opusclip-tutorial` reports `E5 demo-coverage` for `c10` and `c15`
- [ ] `node lib/lint-cues.mjs test-01` and `test-02` exit 0 with only the new `W7 no-segment-map` added
- [ ] `node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] The prompt's demo-punctuation list contains no `fullframe` card
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope list

## STOP conditions

- **The suite is red before you start.**
- **`test-01` or `test-02` gains any ERROR.** They have no segment map, so they must be unaffected apart from `W7`. An error there means the absent-map path is wrong — stop and report.
- **The proposer classifies more than ~60% of a video as `demo`.** That means the cue list is too broad; stop and report rather than widening `MIN_HITS` until the number looks nice.
- **You are tempted to edit `cues.json` to clear an E5 error.** The errors on `c10`/`c15` are the expected, correct output of this plan. Leave them for the owner.

## Maintenance notes

- `DEMO_CUES` is deliberately conservative. Adding phrases suppresses graphics, so additions should follow an owner-confirmed miss, never a hunch.
- `playback` cannot be auto-detected from a transcript. If sample-clip detection is ever wanted, the signal is in the audio (speaker change), not the words — that is a separate plan.
- Once the board grows a segment lane, `confirmed` becomes a button; the schema is already shaped for it.
- Reviewers should check that W1's narration-only measurement did not silently disable cadence for videos with no map — the `?? 'narration'` default is what preserves it.
