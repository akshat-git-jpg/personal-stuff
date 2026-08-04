---
executor: claude-p
model:
test_cmd: cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs lib/transcript-beats.test.mjs && node lib/check-rulebook.mjs && bash scripts/check.sh
ui:
deploy:
needs: ["shares lib/lint-cues.mjs with 175 and 179, lib/cue-rules.mjs with 179, lib/resolve.mjs with 176, and card-library/catalog.json with nobody else. Expect append-region conflicts on lint-cues.mjs; boss resolves the concat."]
---

# Plan 177: visuals-flow transcript-derived beats for enumeration cards

## Summary

- **Problem statement**: A beat reveal fires at the FIRST word of its anchor phrase, and `findPhrase` rejects anchors under 3 words. When the voiceover rattles off a list ("OpenArt, Higgsfield, Synthesia, HeyGen and Arcads" is 7 words in 6 seconds), five non-overlapping 3-word anchors cannot exist, so per-item beat cards cannot be synced at all.
- **Goals**: Give beat cards a way to take their timing from the transcript instead of hand-written anchors, the same way `kind: "word-sync"` already does for kinetic sentences.
- **Executor proposed**: claude-p, sonnet — contained change to one resolver path with a clear test surface.
- **Done criteria** (terse): `tool-icon/roster-pop` pops each tool within 0.15s of the word being spoken, proven by a test over the real transcript fixture.
- **Stop conditions** (terse): any existing video's `resolved.json` beat times change.
- **Test / verification for success**: unit tests over a transcript fixture, plus a re-resolve of `best-ai-video-generator` showing z02's five beats land on the five spoken names.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow/lib/resolve.mjs pipelines/video/card-library/catalog.json`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

The owner has now reported beat drift twice.

The first time was 2026-07-24 ("Workflow and Pricing not syncing with voice ... pls tell long term fix"). That produced the `BEAT_GAP_MAX` guard in `lib/resolve.mjs`, which catches an anchor matching a LATER repeat of the same words. It does not touch the timing model itself.

The second time is 2026-08-02, `best-ai-video-generator` z02: "voice not syncing with beats.. Why this happened?" That card is `tool-icon/roster-pop`, built one round earlier at the owner's own request so each tool tile pops as its name is spoken. It cannot do its job. Measured against the transcript:

| tool | spoken at | tile popped at | error |
|---|---|---|---|
| OpenArt | 15.76 | 14.83 | 0.93s early |
| Higgsfield | 17.33 | 17.33 | correct |
| Synthesia | 18.94 | 21.19 | 2.25s late |
| HeyGen | 20.49 | 22.26 | 1.77s late |
| Arcads | 21.61 | 23.32 | 1.71s late |

Synthesia's tile lights up while the voiceover is saying "Arcads".

Two mechanisms combine to make this unfixable by hand:

1. `resolve.mjs` line ~344 pushes `at: m.start`, and `m.start` is the time of the anchor phrase's first word. An anchor of "looking at OpenArt" fires on "looking".
2. `findPhrase` (line 15) errors on any anchor under 3 words, and after a match the cursor advances past the WHOLE phrase (`cursor = m.idx + m.len`), so anchors cannot overlap. Five names inside seven words leaves no room for five anchors.

The precedent for the fix is already in the codebase. `lib/kinetic-sentence.mjs` exists because "hand-anchoring 12 words per sentence is not viable" — it walks the transcript forward from the cue anchor with a small lookahead and derives a time per word. An enumeration card needs exactly that, one match per item label instead of one per sentence word.

## Current state

- `lib/resolve.mjs` — `findPhrase` (line 13), the word-sync branch (line 316), the beat-anchor branch (lines 321-362).
- `lib/kinetic-sentence.mjs` — `wordSyncBeats(cue, W, anchorIdx, start)`, the forward-walk-with-lookahead pattern to copy.
- `pipelines/video/card-library/catalog.json` — `tool-icon/roster-pop` currently declares `beat_source: "beat"` and `beat_shape.name`.
- `lib/lint-cues.mjs` and `lib/resolve.mjs` line 124 require a beat card to carry at least one beat; a transcript-sourced card authors none.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit tests | `cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs lib/transcript-beats.test.mjs` | exit 0 |
| Re-resolve the fixture video | `node lib/resolve.mjs best-ai-video-generator` | exit 0 |
| Inspect z02's beat times | `node -e "console.log(JSON.stringify(require('./videos/best-ai-video-generator/resolved.json').resolved.find(q=>q.id==='z02').variables.beats))"` | five beats |
| Rulebook | `node lib/check-rulebook.mjs` | `rulebook ok` |
| Repo gate | `bash scripts/check.sh` | `visuals-flow check OK` |

## Scope

**In scope**:
- A new `beat_source: "transcript"` mode in the catalog contract and in `resolve.mjs`.
- `lib/transcript-beats.mjs` plus its tests.
- Switching `tool-icon/roster-pop` to the new mode and dropping z02's hand-written beats.
- The cue rulebook sentence telling the model not to hand-anchor an enumeration card.

**Out of scope**:
- Changing how `word-sync` cards work.
- Changing `findPhrase`'s 3-word floor for CUE anchors (it is doing useful work there).
- Any other card.

## Git workflow

- Branch: `advisor/177-vf2-transcript-derived-beats`
- Commit: `feat(visuals-flow): derive beat times from the transcript for enumeration cards` — no AI footers. Do NOT push.

## Steps

### Step 1: Write the failing test first

Create `lib/transcript-beats.test.mjs`. Build a word list fixture from the real sentence, with the real timings:

```
Today[14.08] we[14.28] are[14.48] looking[14.83] at[15.52] OpenArt[15.76]
Higgsfield[17.33] Synthesia[18.94] HeyGen[20.49] and[21.19] Arcads[21.61]
```

Assert that `transcriptBeats()` given `platforms` of the five tool names and an anchor index at "Today" returns five beats whose absolute times are 15.76, 17.33, 18.94, 20.49, 21.61 (within 0.01).

**Verify**: `node --test lib/transcript-beats.test.mjs` -> fails, because the module does not exist yet.

### Step 2: Implement `lib/transcript-beats.mjs`

Export `transcriptBeats(cue, cat, W, anchorIdx, start)`.

- Read the item list from `cue.variables[cat.beat_items]` (a new catalog field naming which variable holds the items, e.g. `"platforms"`).
- Read the label key from the single required field of `cat.beat_shape` (e.g. `name`).
- For each item, walk W forward from the current position looking for the item's label, normalized with `normWord`. Multi-word labels must match as a phrase.
- Bound the search with a lookahead so a missing name cannot silently match something far away. Model it on `kinetic-sentence.mjs`'s `LOOKAHEAD = 8`, but scale it: an enumeration can have filler between items, so use a per-item window of 40 words and return an error naming the item if it is not found.
- Return `{ beats, cursor }` where each beat is `{ [labelKey]: item[labelKey], at: +(W[found].start - start).toFixed(2) }`, or `{ err }`.

Items that never appear in the transcript are an ERROR, not a silent drop. A roll-call card whose script does not name every item is the wrong card for that moment.

**Verify**: `node --test lib/transcript-beats.test.mjs` -> passes.

### Step 3: Wire it into the resolver

In `lib/resolve.mjs`, inside the beat branch, add a case ahead of the hand-anchored path:

```js
} else if (cat.beat_source === 'transcript') {
  const r = transcriptBeats(cue, cat, W, a.idx, start);
  if (r.err) { errors.push(`${cue.id}: ${r.err}`); continue; }
  beats.push(...r.beats);
  cursor = r.cursor;
}
```

Placement matters. A transcript-sourced card's own anchor still fixes its start, so do NOT apply the "first beat fixes placement" override at lines 346-360 to it — the card is on screen from its anchor with the whole lineup dimmed, which is the point.

Then relax the two "a beat card needs at least 1 beat" assertions (`resolve.mjs` line 124 and the matching one in `lib/lint-cues.mjs`) so they skip cards whose `beat_source` is `"transcript"`.

**Verify**: `node --test lib/resolve.test.mjs` -> passes, including the existing beat tests unchanged.

### Step 4: Prove no existing video moved

Before changing any catalog entry, re-resolve the fixture video and diff the beat times.

```bash
cp videos/best-ai-video-generator/resolved.json /tmp/before.json
node lib/resolve.mjs best-ai-video-generator
node -e "
const a=require('/tmp/before.json').resolved, b=require('./videos/best-ai-video-generator/resolved.json').resolved;
const key=r=>r.id+':'+JSON.stringify(r.variables.beats||[]);
const diff=b.filter((r,i)=>key(r)!==key(a[i]));
console.log('cues whose beats moved:', diff.length, diff.map(r=>r.id).join(' '));
"
```

**Verify**: `cues whose beats moved: 0`. If it is not zero, STOP — the new branch is firing for cards it should not touch.

### Step 5: Switch roster-pop over

In `pipelines/video/card-library/catalog.json`, change `tool-icon/roster-pop`:

- `"beat_source": "transcript"`
- add `"beat_items": "platforms"`
- keep `beat_shape` as the contract for what a derived beat looks like
- update `note` to say beats are derived, never authored

Then remove z02's hand-written `beats` array in `videos/best-ai-video-generator/cues.json` and re-resolve.

**Verify**:

```bash
node lib/resolve.mjs best-ai-video-generator
node -e "
const w=require('./videos/best-ai-video-generator/transcript.json');
const W=Array.isArray(w)?w:w.words;
const z=require('./videos/best-ai-video-generator/resolved.json').resolved.find(q=>q.id==='z02');
const spoken={OpenArt:15.76,Higgsfield:17.33,Synthesia:18.94,HeyGen:20.49,Arcads:21.61};
let bad=0;
for(const b of z.variables.beats){
  const abs=z.start+b.at, err=Math.abs(abs-spoken[b.name]);
  console.log(b.name, abs.toFixed(2), 'vs spoken', spoken[b.name], 'err', err.toFixed(2));
  if(err>0.15) bad++;
}
console.log(z.variables.beats.length===5 && !bad ? 'PASS' : 'FAIL');
"
```

-> five lines, every error under 0.15, `PASS`.

### Step 6: Mutation-proof the gate

Deliberately break it and confirm the test suite goes red, so we know the gate can fail:

- In `lib/transcript-beats.mjs`, temporarily return `W[found].start + 2` instead of `W[found].start`.
- Run `node --test lib/transcript-beats.test.mjs` -> MUST fail.
- Revert.

Record in the PR body that this was done and what the failure looked like.

**Verify**: the mutated run fails, the reverted run passes.

### Step 7: Teach the rulebook

In `lib/cue-rules.mjs`, extend `R_STRUCTURAL` or add a short rule: a card declaring `beat_source: "transcript"` takes NO hand-written beats — supply the item list and let the resolver find each name in the voiceover. Then regenerate and check:

```bash
node lib/build-prompt.mjs && node lib/check-rulebook.mjs
```

**Verify**: `rulebook ok`, and `grep -c "beat_source" steps/030-pick-or-propose-graphics-llm/cue-pass-prompt.md` is at least 1.

## Test plan

`lib/transcript-beats.test.mjs` covers: the five-tool happy path against the real timings; a label that never appears (error, not silent drop); a multi-word label; an item appearing twice (first match after the cursor wins); an empty item list (error).

`lib/resolve.test.mjs` gains one case asserting that a `beat_source: "transcript"` cue keeps its anchor-derived start rather than being yanked by the first beat.

Step 4 is the regression proof for every existing video.

## Done criteria

- [ ] `lib/transcript-beats.mjs` exists with tests, and the tests fail when the timing is mutated (Step 6)
- [ ] Step 4 reports `cues whose beats moved: 0` before roster-pop is switched over
- [ ] Step 5's verification prints `PASS` with all five errors under 0.15s
- [ ] `tool-icon/roster-pop` declares `beat_source: "transcript"` and z02 carries no hand-written beats
- [ ] `node lib/check-rulebook.mjs` -> `rulebook ok`
- [ ] `bash scripts/check.sh` -> `visuals-flow check OK`

## STOP conditions

- Step 4 shows any existing cue's beat times changing. The new path is leaking into hand-anchored cards.
- A tool name cannot be found in the transcript. Do not widen the lookahead to force a match — report it; it means the script does not enumerate the roster and roster-pop is the wrong card there.
- The change requires touching `findPhrase`'s 3-word floor. That floor protects cue anchors; if the design needs it gone, stop and re-plan.

## Maintenance notes

- The 3-word floor and the cursor-advance rule are safety mechanisms with their own scars (`BEAT_GAP_MAX`, owner 2026-07-24). This plan works around them for one card class rather than weakening them globally, and that is deliberate.
- If a second enumeration card appears later, it should reuse `beat_source: "transcript"` rather than growing another mode.
