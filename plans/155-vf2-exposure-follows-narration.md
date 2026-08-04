---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 155: Fullframe exposure follows the narration, not `default_duration`

## Summary

- **Problem statement**: A fullframe card's on-screen duration is computed by looking up the sentence in progress at `start + default_duration`. That makes narration coverage depend on an unrelated per-card constant, and the `+EXPOSURE_TAIL` can push the card's end *into* the next sentence — the exact "card exits mid-sentence" defect the block was written to prevent. Changing `enacted/before-after`'s `default_duration` from 8 to 6 (commit `6813379`) silently unwound owner fix `final-v2:5`.
- **Goals**:
  - Exposure derives from sentence boundaries and the next cue, never from `default_duration`.
  - A fullframe content card can never end mid-sentence.
  - A card cannot be pinned on screen indefinitely (new `MAX_FULLFRAME_ONSCREEN` cap).
  - A regression test proves the result is identical for `default_duration` 6 and 8.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully inlined, pure logic + unit tests.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0; new tests pass; c10 resolves to end at 176.23s.
- **Stop conditions** (terse): any existing test fails in a way the plan does not predict; resolving test-03 changes a cue other than c10.
- **Test / verification for success**: unit tests in `lib/resolve.test.mjs` plus a real re-resolve of `videos/test-03`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 64a151b..HEAD -- pipelines/video/visuals-flow/lib/resolve.mjs pipelines/video/visuals-flow/lib/cue-constants.mjs`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `64a151b`, 2026-07-28

## Why this matters

The owner reported this twice. `final-v2:2` ("this motion graphics ends before he completes sentence") and `final-v2:5` ("He completed 'neutral so far' here but motion graphic went away before. If you noticed such timing sync gaps keep happening, **need a better solve here**"). The 2026-07-25 fold added sentence-aware exposure, which appeared to fix it — but only because `enacted/before-after` happened to carry `default_duration: 8`, which landed the lookup inside the right sentence. A later card-capacity commit reduced it to 6 and the fix quietly unwound; nobody noticed because `resolved.json` was committed with the old numbers and never regenerated.

That is the "better solve" the owner asked for: exposure must be a function of the narration and the surrounding cues, so no card-level constant can silently change how much of a sentence the viewer sees.

## Current state

**`pipelines/video/visuals-flow/lib/resolve.mjs`** — resolves anchors to times and computes each cue's duration. The relevant block, verbatim (lines 287–310):

```js
    let duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;

    // Sentence-aware exposure (owner v2:2 / v2:5 2026-07-25, "this motion
    // graphic ends before he completes the sentence ... need a better solve").
    // ...
    if (cat.placement === 'fullframe' && !cat.structural) {
      const sEnd = sentenceEndIfMidSentence(W, start + duration);
      if (sEnd !== null) {
        const wanted = +(sEnd + CUE_CONSTANTS.EXPOSURE_TAIL.value - start).toFixed(2);
        const capped = Math.min(wanted, duration + CUE_CONSTANTS.HOLD_EXTEND_CAP.value);
        if (capped > duration) duration = capped;
      }
    }
```

**Existing helpers in the same file** (lines 195–215), verbatim shape:

```js
export function sentenceEndAfter(W, idx) { ... }
export function sentenceEndIfMidSentence(W, t) {
  ...
  return sentenceEndAfter(W, last);
}
```

`W` is the word-level transcript: an array of `{ text, start, end }`. A sentence ends on a word whose `text` ends with `.`, `?` or `!` — read `sentenceEndAfter` before writing the new helper and reuse its terminator logic rather than inventing a second one.

**`pipelines/video/visuals-flow/lib/cue-constants.mjs`** — every tunable lives here as `{ value, rule }`. Existing keys include `EXPOSURE_TAIL` (0.4), `HOLD_EXTEND_CAP` (20), `GAP_ABSORB` (12), `SECTION_FOOTAGE_MIN` (4).

**The measured defect** (test-03, transcript word times):

| word | start | end |
|---|---|---|
| `off.` | 173.25 | 173.81 |
| `Still,` | 173.81 | 174.95 |
| `far.` | 175.65 | 176.23 |

c10 (`enacted/before-after`, `default_duration: 6`) anchors at 166.07.
- natural end = 166.07 + 6 = **172.07** → inside the sentence ending 173.81
- extension = 173.81 + 0.4 = **174.21** → which is *inside* the next sentence (173.81–176.23)
- so the card ends mid-sentence, and never reaches "Still, neutral so far."

With `default_duration: 8` the natural end was 174.07, landing inside the *next* sentence, extending to 176.63. Same code, different narration coverage, decided by a constant that exists for motion-length reasons.

**Convention to imitate**: `lib/resolve.test.mjs` — Node's built-in test runner (`node:test` + `node:assert/strict`), one `test('...', () => {...})` per behaviour, transcripts built as plain arrays of `{text,start,end}` literals. Match that file's style exactly.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Just resolve tests | `cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs` | all pass |
| Re-resolve test-03 | `cd pipelines/video/visuals-flow && node lib/resolve.mjs test-03` | writes `videos/test-03/resolved.json` |
| Inspect a cue | `cd pipelines/video/visuals-flow && node -e "const r=require('./videos/test-03/resolved.json').resolved;const c=r.find(q=>q.id==='c10');console.log(c.start, c.duration, c.start+c.duration)"` | see Step 5 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/resolve.mjs`
- `pipelines/video/visuals-flow/lib/cue-constants.mjs`
- `pipelines/video/visuals-flow/lib/resolve.test.mjs`
- `pipelines/video/visuals-flow/videos/test-03/resolved.json` (regenerated output only)

**Out of scope**:
- `lib/lint-cues.mjs` — the static-hold cap is plan 156's job; do not add lint here.
- `lib/assemble.mjs` — consumes `resolved.json` unchanged.
- `extendExposure` (the `base:none` / `GAP_ABSORB` post-pass at the bottom of `resolve.mjs`) — it operates on gaps between fullframes and is governed by owner rule v2:4 (section openers must hand over to footage). Leave it exactly as is.
- Any `catalog.json` `default_duration` value. The whole point is that these stop mattering for narration coverage. **Do not "fix" this by setting `before-after` back to 8.**

## Git workflow

- Branch: `advisor/155-vf2-exposure-follows-narration`
- Commit: `fix(visuals-flow): exposure follows sentence boundaries and the next cue, not default_duration` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the `MAX_FULLFRAME_ONSCREEN` constant

In `lib/cue-constants.mjs`, add a new entry alongside the others (match the existing `{ value, rule }` shape and the file's ordering style — put it directly after `EXPOSURE_TAIL`):

```js
  MAX_FULLFRAME_ONSCREEN: {
    value: 12,
    rule: 'A fullframe card may hold the screen for at most 12s. Exposure extends to the last sentence boundary that fits inside this window; past it the footage takes the frame back.',
  },
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/cue-constants.mjs').then(m=>console.log(m.CUE_CONSTANTS.MAX_FULLFRAME_ONSCREEN.value))"` -> `12`

### Step 2: Add the `lastSentenceBoundaryAtOrBefore` helper

In `lib/resolve.mjs`, directly below `sentenceEndIfMidSentence`, add and export this function. Use the SAME sentence-terminator test that `sentenceEndAfter` already uses — read it first and mirror it; do not introduce a second definition of "what ends a sentence".

```js
// The latest sentence end at or before time `t`, or null when no sentence ends
// in [0, t]. Exposure lands the card here so it can never stop mid-sentence:
// a boundary is the only safe place to take the frame away from a thought.
export function lastSentenceBoundaryAtOrBefore(W, t) {
  let best = null;
  for (const w of W) {
    if (w.end > t) break;
    if (/[.?!]["')\]]*$/.test(w.text)) best = w.end;
  }
  return best;
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "
import('./lib/resolve.mjs').then(async m=>{
  const fs=await import('node:fs');
  const W=JSON.parse(fs.readFileSync('videos/test-03/transcript.json','utf8'));
  console.log(m.lastSentenceBoundaryAtOrBefore(W,178.07), m.lastSentenceBoundaryAtOrBefore(W,174.0));
})"` -> `176.23 173.81`

### Step 3: Precompute every cue's start before the duration loop

The new rule needs to know where the NEXT cue starts. Anchor resolution does not depend on duration, so all starts can be computed first.

In `resolveCues`, before the loop that computes durations, build an array of the resolved start time of every cue that resolves successfully, in ascending order, e.g. `const allStarts = [...]`. Inside the loop, for the current `start`, the next cue start is:

```js
const nextStart = allStarts.find((s) => s > start + 0.001) ?? null;
```

Do not change how starts themselves are computed. If the existing code resolves anchors inside the same loop, hoist ONLY the anchor→time resolution into a first pass and keep the rest of the loop intact.

**Verify**: `cd pipelines/video/visuals-flow && node lib/resolve.mjs test-03 && node -e "const r=require('./videos/test-03/resolved.json').resolved;console.log(r.length)"` -> `14`

### Step 4: Replace the exposure block

Replace the block quoted in "Current state" with exactly this:

```js
    // Exposure follows the NARRATION, not `default_duration` (owner v2:5,
    // "need a better solve here"). The old rule looked up the sentence in
    // progress at `start + default_duration`, so a card's narration coverage
    // depended on a per-card motion constant: reducing before-after's
    // default_duration 8 -> 6 (commit 6813379) silently unwound the fix and
    // the card went back to vanishing mid-sentence. It also added
    // EXPOSURE_TAIL past the sentence end, which in contiguous speech lands
    // INSIDE the next sentence — the very defect the block existed to stop.
    //
    // Now: hold the frame until the last sentence boundary that fits before
    // the next cue and before MAX_FULLFRAME_ONSCREEN. Ending exactly on a
    // boundary means the card can never cut a thought in half, and nothing
    // about the card's own duration constant enters the result.
    // Structural section openers stay exempt: their job is to announce and
    // hand over to footage of the tool (owner v2:4).
    if (cat.placement === 'fullframe' && !cat.structural) {
      const hardStop = Math.min(
        nextStart ?? Infinity,
        start + CUE_CONSTANTS.MAX_FULLFRAME_ONSCREEN.value,
      );
      const boundary = lastSentenceBoundaryAtOrBefore(W, hardStop);
      if (boundary !== null) {
        const wanted = +(boundary - start).toFixed(2);
        const capped = Math.min(wanted, duration + CUE_CONSTANTS.HOLD_EXTEND_CAP.value);
        if (capped > duration) duration = capped;
      }
    }
```

Note `EXPOSURE_TAIL` is deliberately no longer used here — ending ON the boundary is the fix. Leave the constant defined (other code may read it); do not delete it.

**Verify**: `cd pipelines/video/visuals-flow && node --check lib/resolve.mjs && echo SYNTAX_OK` -> `SYNTAX_OK`

### Step 5: Re-resolve test-03 and confirm the owner's item is covered

```bash
cd pipelines/video/visuals-flow && node lib/resolve.mjs test-03
node -e "const r=require('./videos/test-03/resolved.json').resolved;const c=r.find(q=>q.id==='c10');console.log(JSON.stringify({start:c.start,duration:c.duration,end:+(c.start+c.duration).toFixed(2)}))"
```

**Verify**: prints `{"start":166.07,"duration":10.16,"end":176.23}` — the card now covers "Still, neutral so far." which ends at 176.23.

If `end` is anything other than `176.23`, STOP and report; do not adjust constants to force the number.

### Step 6: Add the regression tests

Append to `lib/resolve.test.mjs`, matching the existing file's style:

```js
test('exposure ends on a sentence boundary, never mid-sentence', () => {
  const W = [
    { text: 'Alpha', start: 0.0, end: 0.5 },
    { text: 'beta.', start: 0.5, end: 1.0 },
    { text: 'Gamma', start: 1.0, end: 1.5 },
    { text: 'delta.', start: 1.5, end: 3.0 },
    { text: 'Epsilon', start: 3.0, end: 4.0 },
  ];
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 2.0), 1.0);
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 3.5), 3.0);
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 0.2), null);
});

test('exposure is independent of the card default_duration', () => {
  // Same cue, same transcript, two different card default_durations.
  // The resolved END must be identical — this is the regression that
  // commit 6813379 introduced by changing before-after 8 -> 6.
  const W = [
    { text: 'One', start: 0.0, end: 1.0 },
    { text: 'two.', start: 1.0, end: 2.0 },
    { text: 'Three', start: 2.0, end: 3.0 },
    { text: 'four.', start: 3.0, end: 4.0 },
    { text: 'Five', start: 4.0, end: 20.0 },
  ];
  const cues = [{ id: 'c1', card: 'x/y', anchor: 'One', lead: 0, hold: 0, beats: [], variables: {} }];
  const mk = (dd) => [{ slug: 'x/y', kind: 'single', placement: 'fullframe', default_duration: dd, variables: {} }];
  const a = resolveCues(cues, W, mk(2), '.', '.');
  const b = resolveCues(cues, W, mk(3), '.', '.');
  const endA = a.resolved[0].start + a.resolved[0].duration;
  const endB = b.resolved[0].start + b.resolved[0].duration;
  assert.equal(+endA.toFixed(2), +endB.toFixed(2));
  assert.equal(+endA.toFixed(2), 4.0); // the last boundary inside the 12s window
});
```

Import `lastSentenceBoundaryAtOrBefore` and `resolveCues` at the top of the test file if not already imported. If `resolveCues`'s signature differs from the call above, adapt the CALL to the real signature — read it first. Do not change the function to fit the test.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs 2>&1 | tail -5` -> `# fail 0`

### Step 7: Full gate

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

## Test plan

Two new unit tests in `lib/resolve.test.mjs` (Step 6): one pinning the boundary helper, one pinning the property that motivated the whole plan — *the resolved end does not move when `default_duration` moves*. That second test is the regression guard; without it this bug returns the next time a card's capacity is retuned.

Plus the live check in Step 5 against the real test-03 transcript, which is the owner-reported case.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `node --test lib/resolve.test.mjs` reports `# fail 0`
- [ ] c10 in `videos/test-03/resolved.json` ends at exactly `176.23`
- [ ] `grep -c "EXPOSURE_TAIL" lib/resolve.mjs` shows the constant is no longer used in the exposure block (0 occurrences inside it)
- [ ] No `default_duration` value in `pipelines/video/card-library/catalog.json` was changed (`git diff --stat` shows catalog.json untouched)

## STOP conditions

- c10 resolves to any end other than `176.23` — report the actual number and stop. Do NOT tune `MAX_FULLFRAME_ONSCREEN` or `HOLD_EXTEND_CAP` to reach it.
- Re-resolving test-03 changes the `start` or `duration` of any cue other than c10. The new rule should only lengthen non-structural fullframes that were being cut short; a change elsewhere means the hoist in Step 3 altered anchor resolution. Report which cues moved.
- Any existing test in `scripts/check.sh` fails. Report the failing test name and its assertion; do not delete or weaken an existing test to go green.
- `resolveCues`'s real signature cannot accommodate the Step 6 test without changing production code — report and stop.

## Maintenance notes

- The load-bearing property is "a card's on-screen end is a function of the transcript and the neighbouring cues only." Any future change that reintroduces a card-level constant into that computation reintroduces this bug class. The `default_duration`-independence test is what pins it.
- `MAX_FULLFRAME_ONSCREEN` (12s) is the seam plan 156 builds on: 156 adds a lint that flags a card *frozen* on screen, and both should read the same constant rather than each inventing a threshold.
- Reviewers should scrutinise Step 3. Hoisting anchor resolution out of the duration loop is the only change that can affect cues other than c10, and the STOP condition above is aimed squarely at it.
