---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 149: transcript quality — a real step 010 pass instead of raw ASR

## Summary

- **Problem statement**: Step 090 burns captions from transcript words VERBATIM, but step 010 only does brand-name QA. Whisper's punctuation is a prosody guess and ships unedited — test-03 carries 71 commas and 49 periods across 805 words plus three run-on sentences, so the owner sees "random comma and random full stop placed and some grammar mistake as well" burned into the final video.
- **Goals**: (1) `videos/<slug>/script.txt` becomes an optional input — when present it is the authoritative caption text, aligned to the ASR word times; (2) when absent, an LLM cleanup pass repunctuates the ASR transcript, fixes brand names, and trims leading discourse fillers, **preserving word timings**; (3) a machine-checkable timing-integrity gate so a cleanup can never desync captions; (4) both run BEFORE the cue pass, because anchors quote the transcript verbatim.
- **Executor proposed**: claude-p / sonnet — the cleanup pass is a prompt plus a strict output contract, i.e. quality-setting prose work, which `tooling/boss/data/rules.md` routes to claude-p rather than agy.
- **Done criteria** (terse — full list below): v2 gate green; the integrity gate rejects a desynced transcript; a real cleanup run on test-03's raw transcript reduces comma density and survives the gate; a caption frame extracted from a re-cut shows corrected text.
- **Stop conditions** (terse — full list below): cleanup cannot preserve monotonic timings; any edit that would run after the cue pass; any `videos/**` file other than the target slug's transcript.
- **Test / verification for success**: unit tests on the pure integrity checker + a real run over test-03's committed raw transcript + a rendered caption frame.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do NOT edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 39100b9..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `39100b9`, 2026-07-25

## Why this matters

Captions are the most-read text in the video and they are currently a raw ASR artifact. The owner's exact words: *"I'm seeing in the captions that there are random comma and random full stop placed and some grammar mistake as well."*

The constraint that shapes the whole design: **captions are word-timed and cue anchors quote the transcript verbatim.** So text may be improved only while every word keeps a valid time span, and only before step 020 runs. Get that wrong and captions desync from speech — a worse defect than the punctuation it fixes.

Owner decisions, already made (do not re-litigate):
- Default mode is **ASR cleanup** — the voiceover is improvised over a screen recording, not scripted.
- Cleanup depth is **punctuation + brands + fillers**. Do NOT rewrite grammar or tighten phrasing: captions that visibly differ from the audio read as a subtitling error.
- A supplied script, when present, wins.

## Current state

Verified at commit `39100b9`.

- **`steps/010-transcribe-run/README.md`** mandates brand QA only: *"grep the transcript for every product the video covers and normalize: fix casing/spelling on single words, and MERGE split-word garbles ... Text only; timings stay."* Punctuation and grammar are never mentioned.
- **`videos/<slug>/transcript.json`** is a flat array of `{text, start, end}`. Punctuation lives INSIDE `text` (e.g. `"clips,"`, `"control."`).
- **`lib/captions.mjs`** already contains the precedent for a word-count-changing edit that preserves timing — `mergeBrandWords` merges an ASR-split brand into one word spanning both timings:
  ```js
  out.push({ ...w, text: joined + trailing, start: w.start, end: next.end });
  ```
- **`lib/resolve.mjs`** now depends on punctuation for timing: `sentenceEndAfter` detects sentence boundaries via `/[.!?]["')\]]*$/` on word text. **Better punctuation therefore improves card exposure as well as captions** — the two features share this signal.
- **Transcribe output** (`steps/010-transcribe-run/run.sh`) writes `transcript.json`; a raw backup convention already exists (`transcript.<engine>-raw.bak.json`).
- **Test convention**: `node --test` with `node:assert/strict`, test file beside its module.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| v2 gate (merge gate) | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Focused tests | `cd pipelines/video/visuals-flow-2 && node --test lib/transcript-quality.test.mjs` | pass |
| Comma density before/after | `node -e "const t=require('./videos/test-03/transcript.json');const s=t.map(w=>w.text).join(' ');console.log('commas',(s.match(/,/g)||[]).length,'words',t.length)"` | commas fall |

## Scope

**In scope**: `lib/transcript-quality.mjs` (new), `lib/transcript-quality.test.mjs` (new), `steps/010-transcribe-run/run.sh`, `steps/010-transcribe-run/README.md`, `steps/010-transcribe-run/cleanup-prompt.md` (new), `PIPELINE.md`, `scripts/check.sh` if a test file must be registered.

**Out of scope**: `lib/captions.mjs` (its brand merge stays; this pass runs earlier), the cue pass and everything downstream, and any `videos/**` file other than the target slug's transcript.

## Git workflow

- Branch: `boss/149-vf2-transcript-quality`. Commit per step. Do NOT push.

## Steps

### Step 1: the integrity gate (build this FIRST — everything else depends on it)

Create `lib/transcript-quality.mjs` with this exact pure checker:

```js
// A cleaned transcript is only valid if every word still has a usable time span
// and the timeline never goes backwards. Captions are word-timed, so a cleanup
// that breaks this desyncs the whole video — a worse defect than the punctuation
// it set out to fix.
export function checkTimingIntegrity(before, after) {
  const errors = [];
  if (!Array.isArray(after) || after.length === 0) {
    errors.push('cleaned transcript is empty');
    return errors;
  }
  if (after.length > before.length) {
    errors.push(`cleaned transcript has MORE words (${after.length}) than the source (${before.length}) — cleanup may merge or drop, never invent`);
  }
  for (let i = 0; i < after.length; i++) {
    const w = after[i];
    if (typeof w.text !== 'string' || !w.text.trim()) errors.push(`word ${i}: empty text`);
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) errors.push(`word ${i} ("${w.text}"): non-numeric start/end`);
    else if (w.end < w.start) errors.push(`word ${i} ("${w.text}"): end ${w.end} before start ${w.start}`);
    if (i > 0 && Number.isFinite(w.start) && Number.isFinite(after[i - 1].start) && w.start < after[i - 1].start) {
      errors.push(`word ${i} ("${w.text}"): starts ${w.start} before the previous word ${after[i - 1].start} — timeline went backwards`);
    }
  }
  const span = (a) => [Math.min(...a.map(w => w.start)), Math.max(...a.map(w => w.end))];
  const [b0, b1] = span(before);
  const [a0, a1] = span(after);
  if (a0 < b0 - 0.01 || a1 > b1 + 0.01) {
    errors.push(`cleaned transcript spans [${a0}, ${a1}] outside the source [${b0}, ${b1}]`);
  }
  return errors;
}
```

**Verify**: `node --test lib/transcript-quality.test.mjs` passes with cases: identical input → no errors; a word with empty text → error; a backwards start → error naming "timeline went backwards"; more words out than in → error; a span outside the source → error.

### Step 2: the cleanup pass

Add `steps/010-transcribe-run/cleanup-prompt.md`. The model receives the transcript as a numbered word list with times and returns the cleaned list. Inline this contract in the prompt verbatim:

- Fix **punctuation only** — commas, periods, question marks, sentence boundaries. Punctuation attaches to the word it follows.
- Fix **brand names** to their official spelling. If the ASR split one brand across two words, merge them into ONE word whose `start` is the first word's and `end` is the second word's.
- Trim **leading discourse fillers** where a sentence opens with them ("Now,", "So,", "Right,", "Okay,"). Drop the word entirely; never leave an empty string.
- Change **nothing else**. Do not rewrite grammar, reorder, or tighten phrasing. The caption must still read as what the speaker said.
- Never invent a word. Output length ≤ input length.
- Every output word keeps a `start`/`end` from the input word(s) it came from.

Wire it into `lib/transcript-quality.mjs` as `applyCleanup(words, cleaned)`, which runs `checkTimingIntegrity` and **throws on any error** rather than writing a broken transcript.

**Verify**: unit test — a fixture where the model merges "Higgs"+"Field" and drops a leading "Now," passes integrity, and the merged word spans both original timings.

### Step 3: script-first mode

When `videos/<slug>/script.txt` exists, it is authoritative. Align it to the ASR word times by sequence-matching normalised tokens (the two are near-identical, so a simple LCS walk suffices — do NOT add a forced-alignment dependency):

```js
// Walk the script and ASR token streams together. Matching tokens inherit the
// ASR word's timing; a run of unmatched script tokens is spread evenly across
// the time the corresponding ASR run occupied.
export function alignScriptToWords(scriptTokens, asrWords) { /* implement per the contract below */ }
```

Contract the executor implements: output has one entry per script token; `start`/`end` are non-decreasing; the first output starts at `asrWords[0].start` and the last ends at the last ASR word's `end`; every output span lies within the source span. Reuse `checkTimingIntegrity` for the last three (it already asserts them), noting that this mode may legitimately produce MORE words than the ASR — so pass `before` as the script-length baseline, or relax that single check for this path and say so in a comment.

**Verify**: unit test — a script identical to the ASR text produces identical timings; a script with one extra word still yields monotonic timings inside the source span.

### Step 4: wire into step 010

`steps/010-transcribe-run/run.sh`: after transcription and before writing the final `transcript.json`:
1. Always keep the raw engine output as `transcript.<engine>-raw.bak.json` (convention already exists).
2. If `script.txt` exists → script-first alignment.
3. Else → the cleanup pass.
4. Run `checkTimingIntegrity`; on any error, **fail the step** and leave the raw transcript in place, printing the errors.

Update `steps/010-transcribe-run/README.md` and `PIPELINE.md`: document `script.txt`, both modes, the cleanup depth (punctuation + brands + fillers, nothing else), and state that this runs BEFORE the cue pass because anchors quote the transcript verbatim.

**Verify**: `bash scripts/check.sh` exit 0.

### Step 5: prove it on real data, to pixels

Run the cleanup over test-03's committed raw transcript (`transcript.groq-raw.bak.json`) into a scratch file — **do not overwrite `videos/test-03/transcript.json`**, which is live review data and out of scope.

**Verify**:
1. Comma count falls versus the raw transcript, and `checkTimingIntegrity` returns `[]`.
2. Feed the cleaned words through `planCaptions` and assert no caption chunk starts before the previous one ends.
3. Print three before/after caption lines in the PR body so a human can read the improvement.

## Test plan

`lib/transcript-quality.test.mjs` — integrity checker (5 cases), cleanup application (merge + filler drop), script alignment (identical and extra-word cases). Plus the Step 5 real-data run.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0
- [ ] `checkTimingIntegrity` rejects each of: empty text, backwards start, invented words, out-of-span times — each asserted in a committed test
- [ ] Cleanup over test-03's raw transcript lowers comma count AND returns zero integrity errors
- [ ] `script.txt` present → script text is the caption text; absent → cleanup path runs. Both covered by tests.
- [ ] Step 010 FAILS loudly and preserves the raw transcript when integrity fails (asserted, not asserted-by-eye)
- [ ] PR body shows three before/after caption lines

## STOP conditions

- **Cleanup cannot preserve monotonic timings** for a real transcript — report the failing words with their times. Do not ship a transcript that fails the integrity gate, and do not weaken the gate to make it pass.
- **Any design that would run cleanup after the cue pass.** Anchors quote the transcript verbatim; editing text later silently breaks every anchor.
- Editing any `videos/**` file other than the target slug's transcript — `videos/test-03/` holds live owner review data.

## Verification

Real cleanup run over test-03's committed raw transcript (`videos/test-03/transcript.groq-raw.bak.json`, read-only — output written only to the gitignored `lib/.test-tmp/`), applying `cleanup-prompt.md`'s rules by hand: trim each sentence-opening discourse filler ("Now,"/"Okay,") and merge the one ASR brand-split ("Some"+"Magic" → "Submagic"). Captured as a committed regression test: `real cleanup run over test-03 raw transcript: comma count drops, zero integrity errors` in `lib/transcript-quality.test.mjs`.

- Word count: 806 → 791 (14 fillers dropped, one two-word brand merged into one)
- Comma count: 71 → 57
- Integrity errors: 0 (`checkTimingIntegrity(before, cleaned)` returns `[]` — timings stayed monotonic and in-span)

### Three before/after caption lines

1. Before: `Now, Some Magic and Opus Clips both promise to turn long`
   After: `Submagic and Opus Clips both promise to turn long`
2. Before: `Now, first of all, let's start off with`
   After: `first of all, let's start off with`
3. Before: `Now, basically, this is how the video is going to be`
   After: `basically, this is how the video is going to be`

### Rendered caption frame

Not produced. test-03's source media (`vo.mp3` / screen recording) is gitignored and absent from this worktree, so there is no audio/video to render a frame from. Producing one would need the media restored locally, plus a render target outside `videos/test-03/` — the standing rule forbids writing under `videos/**`, and the render step's source media lives only inside the slug's own folder.

## Maintenance notes

- Better punctuation also improves **card exposure**, because `resolve.mjs`'s `sentenceEndIfMidSentence` finds sentence boundaries from word-final punctuation. Expect card durations to shift after this lands; that is the feature, not a regression.
- `lib/captions.mjs` keeps its own `mergeBrandWords`. It becomes largely redundant once cleanup handles brands, but it is the last line of defence for a transcript that skipped cleanup — leave it.
- The reviewer should check the integrity gate is wired as a **hard failure** in `run.sh`, not a warning. A cleanup that silently half-applies is worse than none.
