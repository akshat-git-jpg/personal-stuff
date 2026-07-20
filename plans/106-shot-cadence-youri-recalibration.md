---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 106: shot-plan cadence recalibrated to the Youri reference (cap unchanged)

## Summary

- **Problem statement**: The shot-plan numbers (`lib/lint-shots.mjs` + the 070 prompt/RULEBOOK pair) are the 2026-07-18 pre-reference calibration: few, long full-screen host spans spread thin (≤150s spans, ≤300s gaps). The measured Youri reference runs many SHORT bridges on a fast regular cycle (10–30s bridges; TH bridge → wipe → content run → hard cut back). Owner decision 2026-07-20: adopt the reference rhythm, keep the total budget exactly as-is (300s hard cap / 240s scaled target — it encodes HeyGen cost, not style).
- **Goals**: retune the quantitative knobs (span min 12→10, span-length warning split mid 45s / front-back-zone 120s replacing the flat 150s, cadence gap 300→180) and align the 070 prompt + RULEBOOK wording; update lint tests.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — mechanical, fully inlined.
- **Done criteria** (terse): check.sh green; new thresholds asserted by lint-shots tests; cap/target constants byte-unchanged.
- **Stop conditions** (terse): only the four in-scope files; never touch AVATAR_FULL_CAP/AVATAR_FULL_TARGET; stop after 2 failed attempts at any verify.
- **Test / verification for success**: `lib/lint-shots.test.mjs` cases for each new threshold via check.sh.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1ae8b79..HEAD -- pipelines/video/visuals-flow/lib/lint-shots.mjs pipelines/video/visuals-flow/lib/lint-shots.test.mjs pipelines/video/visuals-flow/steps/070-shot-pass-llm/shot-pass-prompt.md pipelines/video/visuals-flow/steps/070-shot-pass-llm/RULEBOOK.md`

## Status

- **Priority**: P1 (rule surface must be right before video #2's shot pass)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (no file overlap with in-flight plans 104/105)
- **Category**: feature
- **Difficulty**: mechanical
- **Planned at**: commit `1ae8b79`, 2026-07-20

## Why this matters

Video #2 is the first video where the Youri grammar fires end-to-end, and the shot pass reads these exact numbers. The 2026-07-19 style-clone wave (plan 099) recalibrated GRAPHICS density to the reference but deliberately left shot numbers at the 2026-07-18 cost-driven calibration. The owner has now split the two concerns: the TOTAL stays cost-capped (HeyGen ~$1/min at production; 300s cap ≈ $5/video), but within that budget the rhythm becomes the reference's — many short bridges cycling fast, instead of few long spans. Same spend, roughly double the host-presence frequency. Reference evidence: `references/PvnJavua0YY.md` ("Full-screen talking head ~25-30%. Fires ONLY as bridges", "The cycle is fast and regular: TH bridge (10-30s) → wipe → content run"); the 25-30% total is explicitly NOT adopted (cost).

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

- `lib/lint-shots.mjs` — the single source for shot numbers (its own header says "Tune constants here, nowhere else"). Verified at `1ae8b79`:

```js
const AVATAR_FULL_CAP = 300;        // s — hard total ceiling (HeyGen 4 limit at production)
const AVATAR_FULL_TARGET = 240;     // s — scaled by video length (T/1800); warn under
const SPAN_MIN = 12;                // s — error: a shorter full-screen moment isn't worth a clip
const SPAN_MAX = 150;               // s — warn: a full-screen host stretch this long drags
const FRONT_ZONE = 0.15;            // U-curve: expect a span starting in the first 15% of the VO
const BACK_ZONE = 0.15;             //          and one in the last 15%
const GAP_AVATAR_MAX = 300;
```

  The rules that consume them:

```js
  // E3 span-min / W1 span-max
  for (const s of spans) {
    if (s.duration < SPAN_MIN) errors.push(`E3 span-min: ${s.id} is ${s.duration.toFixed(1)}s (minimum ${SPAN_MIN}s)`);
    if (s.duration > SPAN_MAX) warnings.push(`W1 span-max: ${s.id} is ${s.duration.toFixed(1)}s (target under ${SPAN_MAX}s)`);
  }
```

```js
  // W4 span-cadence — no stretch without the host longer than GAP_AVATAR_MAX
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i].start - spans[i - 1].end;
    if (gap > GAP_AVATAR_MAX) {
      warnings.push(`W4 span-cadence: ${gap.toFixed(0)}s without full-screen host between ${spans[i - 1].id} and ${spans[i].id} (max ${GAP_AVATAR_MAX}s) — add a short mid-video host beat`);
    }
  }
```

  Span objects in `lintShots` carry `id`, `start`, `end`, `duration`; `T` is the last word's `end`.
- `steps/070-shot-pass-llm/shot-pass-prompt.md` — Rules block, verified lines:
  - Rule 3: `Cadence: never let more than ~5 minutes pass without a full-screen host moment. Fill the middle with SHORT beats (15–30s — a one-line verdict, a reaction, a transition between tools) at natural pauses, never over hands-on narration.`
  - Rule 4: `Total full-screen time: aim near 4 minutes for a ~30-min video, never above 5 minutes total. No span under ~15 seconds; prefer spans under ~2 minutes.`
- `steps/070-shot-pass-llm/RULEBOOK.md` — priority item 5 says `Cadence beats — SHORT mid-video host moments (15–30s: …)`; has a `## Learnings — grows via the 060 feedback fold` table at the bottom (rows: date | what we learned | rule/knob change).
- `lib/lint-shots.test.mjs` — existing node:test suite over `lintShots` with hand-built span/word fixtures; follow its style. Any test asserting the OLD thresholds (150s warn, 300s gap, 12s min) must be updated to the new ones — do not delete coverage, retune it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full verify (merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| One suite while iterating | `cd pipelines/video/visuals-flow && node --test lib/lint-shots.test.mjs` | all pass |

## Scope

**In scope** (the ONLY files to touch):
- `pipelines/video/visuals-flow/lib/lint-shots.mjs`
- `pipelines/video/visuals-flow/lib/lint-shots.test.mjs`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/shot-pass-prompt.md`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/RULEBOOK.md`

**Out of scope** (do NOT touch):
- `AVATAR_FULL_CAP` / `AVATAR_FULL_TARGET` and the W2/E4 budget rules — owner explicitly kept the totals.
- `steps/020-cue-pass-llm/*` (plan 105's surface), `lib/board.mjs`/`lib/assemble.mjs`/`lib/effects*` (plan 104's surface).
- `lib/effects/whip.mjs` / `beats.mjs` — the D3 transition treatment (hard cut in, no punch-ins <45s) already matches the reference; nothing to change.
- `videos/test-01/**` — its approved shot plan predates this recalibration by design; do not re-lint or edit it.

## Steps

### Step 1 — retune the constants and split W1

In `lib/lint-shots.mjs`, replace the three retuned constants and the W1 rule:

```js
const SPAN_MIN = 10;                // s — error: a shorter full-screen moment isn't worth a clip (Youri bridges run 10–30s)
const SPAN_MAX_MID = 45;            // s — warn: a MID-VIDEO bridge this long drags (reference cycle: 10–30s)
const SPAN_MAX_ZONE = 120;          // s — warn: even intro/outro host stretches drag past this
const GAP_AVATAR_MAX = 180;         // s — warn: reference cycles host↔content much tighter than the old 300
```

(`SPAN_MAX` is deleted; keep `FRONT_ZONE`/`BACK_ZONE` and everything else as-is.) Replace the E3/W1 loop body with:

```js
  for (const s of spans) {
    if (s.duration < SPAN_MIN) errors.push(`E3 span-min: ${s.id} is ${s.duration.toFixed(1)}s (minimum ${SPAN_MIN}s)`);
    const inZone = s.start <= T * FRONT_ZONE || s.end >= T * (1 - BACK_ZONE);
    const maxWarn = inZone ? SPAN_MAX_ZONE : SPAN_MAX_MID;
    if (s.duration > maxWarn) {
      warnings.push(`W1 span-max: ${s.id} is ${s.duration.toFixed(1)}s (target under ${maxWarn}s for ${inZone ? 'an intro/outro' : 'a mid-video'} span — Youri bridges run 10–30s)`);
    }
  }
```

Update the header comment block to note the 2026-07-20 Youri recalibration (rhythm adopted, totals kept for cost).

**Verify:** `node --check lib/lint-shots.mjs` → exit 0.

### Step 2 — update the tests

In `lib/lint-shots.test.mjs`:
1. Retune any existing assertions built around the old numbers (a 150s+ span expecting W1, a 300s+ gap expecting W4, an 11s span expecting E3 — adjust fixture durations/expectations to the new thresholds).
2. Add cases (follow the file's existing fixture style; pick `T` so zone boundaries are unambiguous, e.g. T = 1800 → front zone ends 270, back zone starts 1530):
   - mid-video span of 50s → W1 fires with `mid-video` in the message;
   - mid-video span of 30s → no W1;
   - front-zone span (starts ≤ 270) of 100s → no W1;
   - front-zone span of 130s → W1 fires with `intro/outro` in the message;
   - gap of 200s between spans → W4 fires; gap of 170s → no W4;
   - 10.5s span → no E3; 9s span → E3.

**Verify:** `cd pipelines/video/visuals-flow && node --test lib/lint-shots.test.mjs` → all pass.

### Step 3 — align the prompt

In `steps/070-shot-pass-llm/shot-pass-prompt.md`, replace rules 3 and 4 with:

```
3. Cadence: never let more than ~3 minutes pass without a full-screen host
   moment. The cycle is fast and regular — host bridge → content run → back to
   host. Fill the middle with SHORT bridges (10–30s — a one-line verdict, a
   reaction, a transition between tools) at natural pauses, never over
   hands-on narration.
4. Total full-screen time: aim near 4 minutes for a ~30-min video, never above
   5 minutes total. Mid-video spans are 10–30s bridges; only the intro and the
   conclusion may run longer (up to ~2 minutes). No span under ~10 seconds.
```

**Verify:** `grep -c "10–30s" steps/070-shot-pass-llm/shot-pass-prompt.md` ≥ 2; `grep -c "never above" steps/070-shot-pass-llm/shot-pass-prompt.md` → 1.

### Step 4 — align the RULEBOOK

In `steps/070-shot-pass-llm/RULEBOOK.md`:
1. Priority item 5: change `(15–30s: a one-line verdict, a reaction, a "here's what surprised me")` to `(10–30s: a one-line verdict, a reaction, a "here's what surprised me")` and keep the rest of the sentence.
2. Append one row to the Learnings table:

```
| 2026-07-20 | Owner adopted the Youri reference RHYTHM (many short bridges, fast host↔content cycle) while keeping the cost-driven total budget | SPAN_MIN 12→10, W1 split mid 45s / zone 120s (was flat 150s), GAP_AVATAR_MAX 300→180; cap/target unchanged; prompt rules 3–4 rewritten |
```

**Verify:** `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 (check-rulebook validates 020's RULEBOOK sections only, but run the full gate).

## Test plan

Step 2 — retuned + new `lint-shots.test.mjs` cases covering every changed threshold and the zone/mid split, in the file's existing fixture style.

## Done criteria

- `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0.
- `grep -c "AVATAR_FULL_CAP = 300" pipelines/video/visuals-flow/lib/lint-shots.mjs` → 1 and `grep -c "AVATAR_FULL_TARGET = 240" …` → 1 (totals untouched).
- `grep -c "SPAN_MAX_MID = 45" …/lint-shots.mjs` → 1; `grep -c "SPAN_MAX_ZONE = 120" …` → 1; `grep -c "GAP_AVATAR_MAX = 180" …` → 1; `grep -c "SPAN_MIN = 10" …` → 1.
- `git diff 1ae8b79..HEAD --stat` touches only the four in-scope files.

## STOP conditions

- Any temptation to change `AVATAR_FULL_CAP`, `AVATAR_FULL_TARGET`, or the W2/E4 budget rules — stop; the owner explicitly froze the totals.
- Any file outside the in-scope list — stop.
- The same verify failing after 2 fix attempts — stop and report output.

## Maintenance notes

- The 060 feedback fold owns future tuning of these numbers; this plan sets the reference STARTING point (same relationship as plan 099 had to cue density). The Learnings row added in Step 4 is the fold's anchor.
- test-01's approved shot plan (9 spans, 247.7s) predates this and will warn under the new linter if ever re-linted — expected and harmless; it is not re-planned.
- If a future video's shot pass consistently flags W1/W4 noise, the fold adjusts `SPAN_MAX_MID`/`GAP_AVATAR_MAX` — never by an operating session mid-run.
