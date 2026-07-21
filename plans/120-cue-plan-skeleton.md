<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && node --test && node lib/check-rulebook.mjs
ui:
deploy:
needs: ["Consumes the segment map (117) and the constants module (118) — land both first"]
---

# Plan 120: Cue-plan skeleton — turn constraint bookkeeping into a generated artifact

## Summary

- **Problem statement**: The cue pass asks one LLM to satisfy eight simultaneous numeric constraints while placing ~30 cues across a 20-minute transcript, holding all of it in working memory. That is bookkeeping, not judgment, and it fails at random per model — a 2026-07-21 session violated the fullframe repetition cap 7-times-over and blew the total-count band twice, despite both rules being stated in the prompt it was following.
- **Goals**:
  - Generate a deterministic **planning skeleton** — legal fullframe slots, per-card budgets, count band, forbidden zones — from the transcript, the segment map and the constants.
  - Feed it to the cue pass so the model **fills slots** instead of inventing a metronome.
  - Make the same skeleton the pre-flight check, so budget violations are visible before an LLM call rather than after.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — generator algorithm fully inlined; pure computation over existing artifacts.
- **Done criteria** (terse — full list below): `plan-skeleton.mjs` emits a slot grid whose every slot is lint-legal by construction; prompt carries `{{SKELETON}}`; `node --test` green.
- **Stop conditions** (terse — full list below): suite red before starting; a generated grid that cannot satisfy both W1 bounds.
- **Test / verification for success**: property test asserting every generated grid satisfies W1/W3/E4 for a range of synthetic durations and segment maps.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 117 (segment map), 118 (constants module)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Plans 115–119 remove whole classes of defect by making rules machine-enforced. This plan removes the remaining one: **rules that are correctly stated and still violated, because satisfying them all at once is arithmetic the model must do by hand.**

Evidence from the 2026-07-21 cue pass on `opusclip-tutorial`, which had the prompt in front of it the whole time:

- `E3 card-repetition`: used `statement/keyword-statement` **7 times** against a cap of 3. The cap is stated in the prompt. The session reached for the same card repeatedly while solving the 35–60s cadence metronome, and only discovered the violation when the linter ran.
- `W3 total-count`: exceeded the band twice in a row (35 cues against a max of 34), correcting by trial.
- Four rounds of resolve/lint were needed to converge, each one re-deriving the same timeline arithmetic.

The skill already describes this step as "form-filling". It is not yet: the model must first *derive the form* — where the legal slots are — and only then fill it. Generating the form is deterministic, costs no tokens, and is identical for every model.

## Current state

- `lib/transcript-text.mjs` emits the plain-text transcript given to the LLM. The raw `transcript.json` is a flat array of `{text,start,end}`.
- `steps/020-cue-pass-llm/cue-pass-prompt.md` has `{{CATALOG}}`, `{{TRANSCRIPT}}`, `{{LOGO_SLUGS}}` placeholders; `lib/check-rulebook.mjs` asserts the first two exist.
- After 117: `videos/<slug>/segments.json` classifies the timeline `narration` / `demo` / `playback`.
- After 118: `lib/cue-constants.mjs` exports `CUE_CONSTANTS` (value + model-facing rule) and `ENDCARD_SLUG_PREFIXES`.
- `catalog.json` carries `placement`, `structural`, and (after 115) object-form variables; `kind` distinguishes `single` / `beat` / `word-sync`.

Constraints the skeleton must encode, all from `cue-constants.mjs`: `GAP_FULLFRAME_MIN/MAX`, `DENSITY_OVERLAY_MAX` per `DENSITY_OVERLAY_WINDOW`, `TARGET_RATE_MIN/MAX`, `BARE_GAP_MAX`, `CAP_FULLFRAME`, `CAP_STAT_HIT` + `SPACING_STAT_HIT`, `ZONE_END`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full suite (merge gate) | `cd pipelines/video/visuals-flow && node --test` | exit 0, `# fail 0` |
| Generate a skeleton | `cd pipelines/video/visuals-flow && node lib/plan-skeleton.mjs opusclip-tutorial` | markdown to stdout |
| Machine form | `cd pipelines/video/visuals-flow && node lib/plan-skeleton.mjs opusclip-tutorial --json` | JSON to stdout |
| Rulebook gate | `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` | `rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/plan-skeleton.mjs` (new)
- `pipelines/video/visuals-flow/lib/plan-skeleton.test.mjs` (new)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` (`{{SKELETON}}`)
- `pipelines/video/visuals-flow/lib/check-rulebook.mjs` (assert the new placeholder)
- `pipelines/video/visuals-flow/HANDOFF.md`, `PIPELINE.md`
- `.claude/skills/visuals-flow/SKILL.md` (the "run graphics" verb gains the generate step)

**Out of scope**:
- Choosing cards. The skeleton says *where* a cue may go and *how many* remain of each kind. Which card and what text stay the model's job — that is the judgment worth paying for.
- `lib/lint-cues.mjs`. The skeleton must agree with lint, never replace it; lint remains the authority.
- The shot pass.
- Any `cues.json`.

## Git workflow

- Branch: `advisor/120-cue-plan-skeleton`
- Commit per step. Message style: `feat(visuals-flow): deterministic cue-plan skeleton`. No AI footers. Do NOT push.

## Steps

### Step 1: Build the slot grid

Create `lib/plan-skeleton.mjs`. Core algorithm — write it as specified:

```js
// A fullframe "slot" is a window in which placing exactly one fullframe cue
// keeps W1 satisfied. Slots are laid only across narration time, because a
// fullframe inside demo/playback is a hard error (lint E5, plan 117).
export function buildSlots(segments, total, C) {
  const MIN = C.GAP_FULLFRAME_MIN.value;   // 35
  const MAX = C.GAP_FULLFRAME_MAX.value;   // 60
  const endZone = total - C.ZONE_END.value;

  // Narration runs, trimmed to the end zone.
  const runs = segments
    .filter(s => s.kind === 'narration')
    .map(s => ({ start: s.start, end: Math.min(s.end, endZone) }))
    .filter(s => s.end - s.start > 0);

  // Walk narration time as one continuous axis: demo/playback stretches are
  // skipped, not counted, so a long demo never manufactures a cadence debt.
  const slots = [];
  let carried = 0;        // narration seconds accumulated since the last slot
  const TARGET = (MIN + MAX) / 2;  // 47.5 — aim mid-band so both bounds hold
  for (const run of runs) {
    let t = run.start;
    while (t < run.end) {
      const need = TARGET - carried;
      if (t + need <= run.end) {
        t += need;
        slots.push({ at: +t.toFixed(1), windowMin: +(t - (TARGET - MIN)).toFixed(1), windowMax: +(t + (MAX - TARGET)).toFixed(1) });
        carried = 0;
      } else {
        carried += run.end - t;
        break;
      }
    }
  }
  return slots;
}
```

Then compute the budget block:

```js
export function buildBudget(total, C) {
  const minCues = Math.round(C.TARGET_RATE_MIN.value * total / 60);
  const maxCues = Math.round(C.TARGET_RATE_MAX.value * total / 60);
  return { minCues, maxCues, capPerFullframeCard: C.CAP_FULLFRAME.value,
           capStatHit: C.CAP_STAT_HIT.value, statHitSpacing: C.SPACING_STAT_HIT.value };
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/plan-skeleton.mjs').then(async m=>{const {CUE_CONSTANTS:C}=await import('./lib/cue-constants.mjs');const s=m.buildSlots([{kind:'narration',start:0,end:600}],600,C);const gaps=s.slice(1).map((x,i)=>x.at-s[i].at);console.log('slots',s.length,'gaps',[...new Set(gaps.map(g=>g.toFixed(1)))].join(','))})"` -> every gap between 35 and 60

### Step 2: Render the skeleton

Default output is markdown for pasting into the prompt. Sections, in order:

1. **Budget** — total duration, cue count band `[min, max]`, fullframe slot count, overlay allowance per minute, per-card caps.
2. **Forbidden zones** — the end zone with its exact boundary time and the allowed end-card prefixes; every `demo`/`playback` segment marked *overlay-only*.
3. **Fullframe slots** — a numbered table: slot #, target time, legal window `[windowMin, windowMax]`, and the transcript sentence nearest the target time (so the model can see what is being said there).
4. **Overlay capacity** — per rolling minute, how many overlays remain available.
5. **Ledger template** — a table with one row per slot and empty `card` / `card-uses-so-far` columns for the model to fill as it goes. This is the mechanism that stops the repetition-cap violation: the count is written down rather than remembered.

Sentence lookup: reuse the sentence-splitting already needed by `transcript-text.mjs` (split on `[.?!]` boundaries in the word stream, keep the start time of the first word).

`--json` emits the same data as `{ budget, zones, slots, overlayCapacity }` for programmatic use.

**Verify**: `cd pipelines/video/visuals-flow && node lib/plan-skeleton.mjs opusclip-tutorial | head -40` -> shows Budget and Fullframe slots with a sentence beside each slot

### Step 3: Wire into the prompt

Add a `{{SKELETON}}` placeholder to `cue-pass-prompt.md`, immediately **before** `{{CATALOG}}`, introduced by:

```
PLAN SKELETON (generated by `node lib/plan-skeleton.mjs <slug>` — the legal
placement grid for THIS video, already consistent with every hard constraint
above). Place one fullframe cue per slot, inside its legal window; if a slot has
nothing worth showing, leave it empty and say so rather than inventing filler.
Fill the ledger as you go — the per-card counts in it are what keep you inside
the repetition cap.
```

Update `lib/check-rulebook.mjs` to `fail()` when `{{SKELETON}}` is missing, matching the existing `{{CATALOG}}` / `{{TRANSCRIPT}}` assertions.

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` -> `rulebook ok`

### Step 4: Update the operating skill

In `.claude/skills/visuals-flow/SKILL.md`, "run graphics for `<slug>`", insert between the transcribe step and the cue-pass step:

> 1b. Generate the placement grid: `node lib/segments.mjs <slug> --propose` (owner
>     confirms boundaries), then `node lib/plan-skeleton.mjs <slug>`. Paste its
>     output as `{{SKELETON}}`. Never hand-derive the cadence — the grid is
>     deterministic and identical for every model.

**Verify**: `grep -c "plan-skeleton" .claude/skills/visuals-flow/SKILL.md` -> at least `1`

### Step 5: Property tests

In `lib/plan-skeleton.test.mjs`:

1. **W1 holds by construction** — for durations 120s…3600s in 60s steps, all-narration, every consecutive slot gap is within `[GAP_FULLFRAME_MIN, GAP_FULLFRAME_MAX]`.
2. **End zone respected** — no slot `at` exceeds `total - ZONE_END`.
3. **Demo skipped** — with a 300s `demo` segment mid-video, no slot falls inside it, and slots either side stay within the W1 bounds measured over *narration* time.
4. **Count plausible** — slot count never exceeds the budget's `maxCues`.
5. **Degenerate input** — a video shorter than `2 × GAP_FULLFRAME_MIN`, and one that is entirely `demo`, both return `[]` without throwing.

Test 3 is the direct check that the skeleton and plan 117's lint agree.

**Verify**: `cd pipelines/video/visuals-flow && node --test` -> exit 0, `# fail 0`

### Step 6: Document

- `PIPELINE.md`: add `plan-skeleton` to the step table as a `[RUN]` producing the placement grid consumed by `020`.
- `HANDOFF.md`: add both commands to the command list.

**Verify**: `grep -c "plan-skeleton" pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/HANDOFF.md` -> both at least `1`

## Test plan

Property-style tests over generated inputs rather than golden fixtures — the guarantee being tested is "every grid this produces is legal", which is a property, not an example. No new dependency; `node:test` loops suffice.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0 with `# fail 0`
- [ ] `node lib/plan-skeleton.mjs opusclip-tutorial` prints Budget, Forbidden zones, Fullframe slots, Overlay capacity, Ledger
- [ ] `--json` emits parseable JSON with the same four sections
- [ ] Every generated grid satisfies W1 bounds for all tested durations (test 1)
- [ ] No slot lands inside a `demo`/`playback` segment (test 3)
- [ ] `{{SKELETON}}` exists in the prompt and `check-rulebook.mjs` enforces it
- [ ] The skill's "run graphics" verb documents the generate step
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope list

## STOP conditions

- **The suite is red before you start.**
- **A grid cannot satisfy both W1 bounds** for some duration — e.g. a narration run shorter than `GAP_FULLFRAME_MIN` sandwiched between demos. Emit the slot and mark it `tight: true` in the JSON; do **not** silently drop it, and do not widen the constants to make the arithmetic work.
- **You are tempted to have the skeleton pick cards.** Out of scope in every case; the skeleton describes placement capacity only.
- **The skeleton disagrees with `lint-cues.mjs`** on any real video — that is a bug in this plan, not in lint. Stop and report which constraint diverges.

## Maintenance notes

- The skeleton must always be *derived* from `cue-constants.mjs`. If a threshold moves, the grid moves with it and no prose needs editing — that is the payoff of plan 118 and the reason this plan depends on it.
- `TARGET = (MIN + MAX) / 2` is deliberate: aiming mid-band leaves headroom on both sides, so a model nudging a cue to a better sentence stays legal. Aiming at either bound would make every nudge a violation.
- The ledger is the cheapest part and probably the highest-value — it converts "remember how many times you used this card" into "read the number in the table". If a future cap is added, add a ledger column for it.
- This plan does not stop a model ignoring the skeleton. Lint remains the backstop; the skeleton only removes the *reason* to get it wrong.
