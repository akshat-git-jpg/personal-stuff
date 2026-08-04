---
executor: agy
model:
test_cmd: cd pipelines/video/intro-studio && bash scripts/check.sh
ui:
deploy:
needs: ["depends on 180 (scaffold + transcript). 182 depends on this."]
---

# Plan 181: intro-studio — the screenplay pass

## Summary

- **Problem statement**: An intro built from independent pre-made cards cannot express continuity — nothing carries from one moment to the next, so it reads as a slideshow. Before any HTML is authored, the intro needs a written plan that makes continuity explicit and machine-checkable: what is on screen each second, what persists from the previous beat and how it transforms, when the colour register turns, and where the face is.
- **Goals**:
  - Land `screenplay.json` — the beat-sheet schema, with `carries` as a first-class field so "continuity is the craft" becomes a lint rule instead of a hope.
  - Land `lib/lint-screenplay.mjs` with 7 errors and 4 warnings, all machine-checkable against the transcript.
  - Land the authoring prompt at `steps/020-write-screenplay-llm/screenplay-prompt.md` and the owner review step `025-approve-screenplay-human`.
  - Encode the 7-beat arc as an **adaptable default**, not a rule — deviation is allowed and must be justified in the file.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — **owner's explicit choice, overriding the routing default.** `tooling/boss/data/rules.md` routes "quality-setting CONTENT the owner judges by taste — rulebooks, prompts, prose" to `claude-p`/`sonnet`, and `screenplay-prompt.md` is exactly that. Compensations applied: the prompt's required sections are asserted by a structural gate (`lib/check-prompt.mjs`), every lint rule ships with a unit test that fails on a hand-built bad screenplay, and a worked example screenplay is inlined in this plan so the executor transcribes rather than invents.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0; the lint rejects each of 11 hand-built bad screenplays and accepts the inlined good one; `check-prompt.mjs` passes; nothing under visuals-flow changes.
- **Stop conditions** (terse — full list below): editing visuals-flow or card-library; weakening a lint assertion to get green; adding a required intro formula.
- **Test / verification for success**: `node --test lib/lint-screenplay.test.mjs` — one test per lint rule, each asserting the rule fires on a targeted bad fixture AND stays silent on the good one; plus a structural gate over the prompt file.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/intro-studio pipelines/video/visuals-flow`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 180
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

Loop Studio's intro works because it is one continuous stage: an object introduced in beat 1 does not vanish, it shrinks and moves and stays, and the colour register crossfades dark→light on the turn word. Their `editors/intro.md` names it directly — "continuity is the craft."

visuals-flow's intro cannot do that, and the reason is architectural rather than aesthetic: its unit of authorship is a sealed card that knows nothing about its neighbours. The owner's recorded feedback bears this out — `final-v3:0` "did not like this motion graphic", `final-v3:1` "we could have modified the same motion graphic", `final-v3:2` "this motion graphic decision itself was bad. This is not the correct motion graphic to be used at this place." All three are *selection* failures, which is what you get when the only move available is picking a template.

The screenplay is the artifact that makes the alternative real, and reviewable before anything expensive happens. It is deliberately written and approved BEFORE any HTML exists, because reading a beat sheet costs the owner two minutes and re-rendering a wrong 45-second composition costs far more.

The `carries` field is the load-bearing part. It is the machine-checkable form of continuity: beat 4 must name which earlier beat's object it inherits and how it transforms. A lint that requires most beats to carry something is what structurally prevents this system from degenerating back into a slideshow.

## Current state

After plan 180, `pipelines/video/intro-studio/` contains:

- `lib/workdir.mjs` — `resolveWorkdir(slug)` → `videos/<slug>/`
- `lib/intake.mjs` — `runIntake`, `probeDuration`; writes `intake.json` whose `duration` is the intro's authoritative length
- `lib/transcript.mjs` — `validateTranscript(words)`, `transcriptText(words)`; the transcript contract is a flat array of `{ text, start, end }`, one entry per WORD, times in seconds
- `lib/avatar.mjs` — `checkAvatarClip(slug)`
- `run.sh` with steps `status`, `intake`, `avatar-check`; `screenplay` currently prints `not built yet`
- `scripts/check.sh` running an explicit list of test files

**Do NOT use `node --test <dir>`** — it fails on node 22.14 (LESSONS 2026-07-09). Add new test files to the explicit list in `scripts/check.sh`.

The owner's standing decision on intro structure, from `pipelines/video/visuals-flow/lib/zone-rules.mjs` (`R_ZONE_NO_FORMULA`):

> 'There is deliberately NO required structure for either zone — no mandatory hook slot, no mandatory agenda card, no fixed running order. What an intro needs is a judgment call about THIS script.'
> why: owner 2026-07-28, on encoding a required intro formula: "its subjective. Pls dont make this hardcoded"

The owner reaffirmed on 2026-08-02 that the 7-beat arc is wanted as an **adaptable default with a stated reason for deviation**, not as a hard rule. This plan implements exactly that: the arc is a default ordering, departing from it is legal, and the only requirement is that the departure is explained in the file. **A lint rule that forces the arc would violate a standing owner decision and is a STOP.**

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate | `cd pipelines/video/intro-studio && bash scripts/check.sh` | exit 0, `intro-studio check OK` |
| Lint tests | `cd pipelines/video/intro-studio && node --test lib/lint-screenplay.test.mjs` | exit 0 |
| Prompt gate | `cd pipelines/video/intro-studio && node lib/check-prompt.mjs` | exit 0, `prompt OK` |
| Lint a real screenplay | `cd pipelines/video/intro-studio && node lib/lint-screenplay.mjs <slug>` | exit 0 clean, exit 1 with `E<n>` lines on error |
| Scope check | `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` | EMPTY |

## Scope

**In scope**:
- `pipelines/video/intro-studio/lib/screenplay-schema.mjs`, `lib/lint-screenplay.mjs`, `lib/check-prompt.mjs` and their tests
- `pipelines/video/intro-studio/steps/020-write-screenplay-llm/` and `steps/025-approve-screenplay-human/`
- `pipelines/video/intro-studio/run.sh` — wiring the `screenplay` and `lint` steps only
- `pipelines/video/intro-studio/scripts/check.sh` — adding the new test files
- `plans/README.md` — the 181 row

**Out of scope** (looks related, do NOT touch):
- `pipelines/video/visuals-flow/**` — including `lib/zone-rules.mjs`, which this plan quotes but must not edit
- `pipelines/video/card-library/**`
- Composition authoring, rendering, the critique rubric — all plan 182
- `lib/intake.mjs`, `lib/transcript.mjs` — landed and tested by 176; do not refactor

## Git workflow

- Branch: `advisor/181-intro-studio-screenplay-pass`
- Commit per step: `feat(intro-studio): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: `lib/screenplay-schema.mjs`

Write exactly:

```js
// The screenplay is the intro's plan, written and approved BEFORE any HTML.
// One entry per beat, contiguous, covering the whole intro.
export const INTENTS = ['hook', 'turn', 'scope', 'mech', 'stakes', 'tease', 'button'];
export const REGISTERS = ['dark', 'light'];
export const FACE_MODES = ['full', 'panel', 'none'];
export const TRANSITIONS = ['cut', 'flash', 'crossfade', 'dock', 'push'];

// The DEFAULT arc, in order. It is a starting shape, NOT a requirement:
// a screenplay may drop, merge or reorder beats, and must then say why in
// `deviation_reason`. Owner decision 2026-07-28: intro structure is
// subjective and must not be hardcoded.
export const DEFAULT_ARC = ['hook', 'turn', 'scope', 'mech', 'stakes', 'tease', 'button'];

// A beat:
// {
//   id: "b01",                       // unique, ordered
//   intent: "hook",                  // one of INTENTS
//   clause: "5 AI video tools, 5 very different promises",  // EXACT transcript words
//   t_start: 0.0,
//   t_end: 4.2,
//   register: "dark",                // the colour world this beat lives in
//   face: "full",                    // where the presenter is: full-screen, docked panel, or absent
//   stage: "...",                    // prose: what is on screen and what it does
//   carries: null | { from: "b01", object: "tool-tiles", as: "shrunk into a left rail" },
//   transition_out: "flash",
//   deviation_reason: null | "..."   // REQUIRED when the intent order departs from DEFAULT_ARC
// }

// True when `intents` appears in DEFAULT_ARC order (dropping beats is fine,
// reordering or repeating is a deviation).
export function followsDefaultArc(intents) {
  let cursor = -1;
  for (const intent of intents) {
    const at = DEFAULT_ARC.indexOf(intent, cursor + 1);
    if (at === -1) return false;
    cursor = at;
  }
  return true;
}

// Normalise for verbatim matching against the transcript: lowercase, strip
// punctuation, collapse whitespace. The model writes clauses with natural
// punctuation; the transcript has its own. Neither should decide the match.
export function normaliseClause(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
```

Write `lib/screenplay-schema.test.mjs` covering `followsDefaultArc` (in-order subset → true; reordered → false; repeated intent → false; empty → true) and `normaliseClause` (punctuation stripped, case folded, whitespace collapsed).

**Verify**: `cd pipelines/video/intro-studio && node --test lib/screenplay-schema.test.mjs` → exit 0

### Step 2: `lib/lint-screenplay.mjs` — the rules

Export `lintScreenplay({ screenplay, words, introDuration })` returning `{ errors: [], warnings: [] }`, each entry `{ code, beat, message }`. Implement exactly these rules and no others.

**Errors** (block the step):

| Code | Rule |
|---|---|
| `E1` | Every beat's `clause`, normalised, appears as a contiguous run in the normalised transcript text. |
| `E2` | `t_start`/`t_end` match the transcript word times bounding that clause, within **0.25s** on each end. |
| `E3` | Beats are contiguous and gapless in order: `beats[0].t_start === 0` (±0.05), and each `beats[i].t_start === beats[i-1].t_end` (±0.05). |
| `E4` | Every `id` is unique, and every `carries.from` names an EARLIER beat's id. |
| `E5` | `intent`, `register`, `face`, `transition_out` are each in their enum; `stage` is a non-empty string. |
| `E6` | If `followsDefaultArc(intents)` is false, EVERY beat carries a non-empty `deviation_reason`. (Deviating is legal; deviating silently is not.) |
| `E7` | The last beat's `t_end` equals `introDuration` within 0.1s — the screenplay covers the whole intro. |

**Warnings** (surface, do not block):

| Code | Rule |
|---|---|
| `W1` | At least half of the beats after the first have a non-null `carries`. **This is the continuity rule** — the whole reason this system exists. |
| `W2` | `register` changes at least once across the screenplay. |
| `W3` | At least one of the first two beats has `face: "full"` — the presenter lands early. |
| `W4` | No beat is longer than 12s. |

Notes the implementation must honour:

- E1/E2 share one helper: find the clause's word-index span once, reuse it for both. Return E1 alone when the clause is not found (E2 is meaningless then).
- All comparisons use `normaliseClause`. Never compare raw strings.
- The rules run in code order and a beat can produce several codes.
- W1's threshold is `carriesCount >= Math.ceil((beats.length - 1) / 2)`. With fewer than 2 beats, W1 does not apply.

Also make the file runnable as a CLI: `node lib/lint-screenplay.mjs <slug>` loads `videos/<slug>/screenplay.json`, `transcript.json` and `intake.json`, prints each error as `E<n> <beatId>: <message>` and each warning as `W<n> <beatId>: <message>`, exits 1 if there are any errors, 0 otherwise (warnings never change the exit code).

**Verify**: `cd pipelines/video/intro-studio && node -e "import('./lib/lint-screenplay.mjs').then(m=>console.log(typeof m.lintScreenplay))"` → `function`

### Step 3: The good fixture — transcribe this exactly

Create `lib/fixtures/screenplay-good.json` and `lib/fixtures/transcript-good.json`. These are the reference pair every lint test measures against. Build the transcript by splitting this text on spaces, one word per entry, each word 0.35s long starting at t=0 (so word *i* runs `[i*0.35, i*0.35+0.35]`), and set `introDuration = 8.4` in the tests (24 words × 0.35).

Transcript text (24 words):

```
five AI video tools five very different promises I tested all five across the same brief and one of them was not close
```

`lib/fixtures/screenplay-good.json`:

```json
{
  "slug": "fixture",
  "beats": [
    {
      "id": "b01",
      "intent": "hook",
      "clause": "five AI video tools, five very different promises",
      "t_start": 0.0,
      "t_end": 2.8,
      "register": "dark",
      "face": "full",
      "stage": "Face full-screen in a dark room. Five unlabelled tiles fade up behind the head, staggered, then hold.",
      "carries": null,
      "transition_out": "crossfade",
      "deviation_reason": null
    },
    {
      "id": "b02",
      "intent": "turn",
      "clause": "I tested all five across the same brief",
      "t_start": 2.8,
      "t_end": 5.6,
      "register": "light",
      "face": "panel",
      "stage": "Room lifts to light on the word tested. The five tiles shrink into a left rail and gain names; the face docks to a panel bottom-right.",
      "carries": { "from": "b01", "object": "five tiles", "as": "shrunk into a named left rail" },
      "transition_out": "push",
      "deviation_reason": null
    },
    {
      "id": "b03",
      "intent": "stakes",
      "clause": "and one of them was not close",
      "t_start": 5.6,
      "t_end": 8.4,
      "register": "light",
      "face": "none",
      "stage": "Four rail tiles dim to 20%; the fifth scales up centre-frame and holds. Cut to white on the final word.",
      "carries": { "from": "b02", "object": "left rail", "as": "four dimmed, one promoted centre-frame" },
      "transition_out": "flash",
      "deviation_reason": null
    }
  ]
}
```

This fixture is deliberately arc-compliant (`hook → turn → stakes` is an in-order subset), continuous, and carries on 2 of 2 eligible beats.

**Verify**: `cd pipelines/video/intro-studio && node -e "
const s=require('./lib/fixtures/screenplay-good.json');
if(s.beats.length!==3) throw new Error('beats');
if(s.beats[2].t_end!==8.4) throw new Error('end');
console.log('fixture OK')"` → `fixture OK`

### Step 4: `lib/lint-screenplay.test.mjs` — one test per rule

Write a test file that first asserts the GOOD fixture produces `errors: []` and `warnings: []`, then for each of the 11 rules builds a mutated copy of the good fixture that violates exactly that rule and asserts the corresponding code appears.

The 11 mutations, spelled out so there is nothing to invent:

| Code | Mutation of the good fixture |
|---|---|
| `E1` | `b02.clause = "I tested all six across the same brief"` (word not in transcript) |
| `E2` | `b02.t_start = 1.0` and `b01.t_end = 1.0` (keeps E3 happy, breaks the word-time match) |
| `E3` | `b02.t_start = 3.4` (leaves a 0.6s gap after b01) |
| `E4` | `b02.carries.from = "b03"` (forward reference) |
| `E5` | `b01.register = "moody"` (not in the enum) |
| `E6` | reorder to `[b02(turn), b01(hook), b03(stakes)]` with times reassigned contiguously and every `deviation_reason` left null |
| `E7` | `b03.t_end = 7.0` while `introDuration` stays 8.4 |
| `W1` | `b02.carries = null` and `b03.carries = null` (0 of 2, below the ceil(2/2)=1 threshold) |
| `W2` | set every beat's `register` to `"dark"` |
| `W3` | `b01.face = "none"` and `b02.face = "none"` |
| `W4` | `b03.t_end = 21.0` and `introDuration = 21.0` (a 15.4s beat) |

Each test must assert **both** directions: the expected code IS present in the mutated result, and it is NOT present in the good result. A test that only checks presence passes against a lint that returns every code always.

Add one further test: the E6 mutation with a non-empty `deviation_reason` on every beat produces NO `E6` — deviating with a stated reason is legal. This is the test that protects the owner's 2026-07-28 no-hardcoded-formula decision.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/lint-screenplay.test.mjs` → exit 0, 13 passing

### Step 5: `steps/020-write-screenplay-llm/screenplay-prompt.md`

Write the authoring prompt. It must contain these sections, with these exact `##` headings (the Step 6 gate asserts them):

- `## Your job` — write `videos/<slug>/screenplay.json` for the intro whose transcript follows. You are writing a PLAN, not HTML. Emit JSON only.
- `## What makes an intro good` — one continuous stage rather than a sequence of slides; objects persist and transform instead of vanishing; the colour register turns with the story; the presenter's face is part of the composition, landing early. State plainly that the failure mode being designed against is a slideshow of independent graphics.
- `## The default arc` — the seven intents in order with a one-line description of each, followed by an explicit licence: drop, merge and reorder freely when the script does not support a beat, and write `deviation_reason` on every beat when you do. An intro that fills seven slots badly is worse than one that does three things well.
- `## The schema` — the beat object with every field, its type, and its enum, transcribed from `lib/screenplay-schema.mjs`. State that `clause` must be the EXACT words from the transcript and that `t_start`/`t_end` come from the word timings, not from estimation.
- `## Continuity is the requirement` — `carries` is not decoration. Name which earlier beat's object this beat inherits and how it transforms (shrink, dock, dim, promote, demote). At least half the beats after the first must carry something. If a beat genuinely starts fresh, `carries: null` is honest — but three of those in a row means the intro is a slideshow.
- `## The face` — one avatar clip covers the whole intro, so the face can appear anywhere without sync concerns. `full` is full-screen, `panel` is docked, `none` is absent. It should land in the first two beats: the owner's recorded complaint was that the presenter arrived over two minutes in and it read as a surprise.
- `## Rules you will be linted against` — transcribe the E1-E7 and W1-W4 table from Step 2 verbatim.
- `## Output` — write `screenplay.json` with a top-level `slug` and `beats` array, nothing else. Then stop; the owner reviews before anything is built.

Where the prompt needs the transcript and duration, use the placeholders `{{TRANSCRIPT}}`, `{{INTRO_DURATION}}` and `{{SLUG}}`.

**Verify**: `grep -c '^## ' pipelines/video/intro-studio/steps/020-write-screenplay-llm/screenplay-prompt.md` → `8`

### Step 6: `lib/check-prompt.mjs` — the structural gate

The prompt is prose, so it cannot be unit-tested for quality — but it CAN be tested for completeness, which is where prompts actually rot. Write a script that fails when the prompt loses a required part:

```js
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './workdir.mjs';
import { INTENTS, REGISTERS, FACE_MODES, TRANSITIONS } from './screenplay-schema.mjs';

const PROMPT = path.join(rootDir(), 'steps/020-write-screenplay-llm/screenplay-prompt.md');
const REQUIRED_HEADINGS = [
  '## Your job',
  '## What makes an intro good',
  '## The default arc',
  '## The schema',
  '## Continuity is the requirement',
  '## The face',
  '## Rules you will be linted against',
  '## Output',
];
const REQUIRED_CODES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'W1', 'W2', 'W3', 'W4'];
const REQUIRED_PLACEHOLDERS = ['{{TRANSCRIPT}}', '{{INTRO_DURATION}}', '{{SLUG}}'];

const text = fs.readFileSync(PROMPT, 'utf8');
const missing = [];
for (const h of REQUIRED_HEADINGS) if (!text.includes(h)) missing.push(`heading ${h}`);
for (const c of REQUIRED_CODES) if (!text.includes(c)) missing.push(`lint code ${c}`);
for (const p of REQUIRED_PLACEHOLDERS) if (!text.includes(p)) missing.push(`placeholder ${p}`);
// Every enum value the model must emit has to be named in the prompt, or it
// will invent one and fail E5 at lint time.
for (const v of [...INTENTS, ...REGISTERS, ...FACE_MODES, ...TRANSITIONS]) {
  if (!text.includes(`\`${v}\``)) missing.push(`enum value \`${v}\``);
}
if (missing.length) {
  console.error(`screenplay-prompt.md is missing:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log('prompt OK');
```

This gate is what keeps the prompt and the schema from drifting apart — the failure mode where a lint validates a field the prompt never told the model to write.

**Verify**: `cd pipelines/video/intro-studio && node lib/check-prompt.mjs` → exit 0, `prompt OK`

### Step 7: `steps/025-approve-screenplay-human/README.md`

Write the owner review step. It must say: the owner reads `screenplay.json` and either approves it by setting a top-level `"approved": true`, or edits beats directly and re-runs the lint. Give the exact commands (`bash run.sh <slug> lint`, then the approval edit). State plainly that this is the cheap gate — reading a beat sheet takes two minutes, re-rendering a wrong composition does not — and that plan 182's authoring step refuses to run while `approved` is not `true`.

**Verify**: `test -f pipelines/video/intro-studio/steps/025-approve-screenplay-human/README.md && grep -c 'approved' pipelines/video/intro-studio/steps/025-approve-screenplay-human/README.md` → at least `1`

### Step 8: Wire `run.sh` and `check.sh`

In `run.sh`, replace the `not built yet` stubs for these two steps:

- `bash run.sh <slug> screenplay` — print the rendered prompt (substituting `{{TRANSCRIPT}}` with the transcript text from `transcript.json`, `{{INTRO_DURATION}}` with `intake.json`'s `duration`, `{{SLUG}}` with the slug) to stdout, so the driving session can read it. This step does NOT call an LLM API — a Claude session reads the prompt and writes the file, exactly as visuals-flow's `-llm` steps work.
- `bash run.sh <slug> lint` — `node lib/lint-screenplay.mjs <slug>`, propagating the exit code.

Add to `scripts/check.sh`'s explicit test list: `lib/screenplay-schema.test.mjs lib/lint-screenplay.test.mjs`. Add `node lib/check-prompt.mjs` as a line after the tests.

Extend `scripts/test-run-sh.sh`: `run.sh <slug> screenplay` on a fixture workdir prints text containing `## Your job` and does NOT contain the literal `{{TRANSCRIPT}}` (proving substitution happened), and `run.sh <slug> author` still exits 1 with `not built yet`.

**Verify**: `cd pipelines/video/intro-studio && bash scripts/check.sh` → exit 0, `intro-studio check OK`

### Step 9: Register the plan row

Add the 181 row to `plans/README.md`, status `DONE`.

**Verify**: `grep -c "181-intro-studio-screenplay-pass" plans/README.md` → `1`

## Test plan

- `lib/screenplay-schema.test.mjs` — pure functions.
- `lib/lint-screenplay.test.mjs` — 13 tests: the good fixture clean, 11 targeted mutations each firing their own code, and the deviation-with-reason case producing no `E6`. Every test asserts presence on the bad fixture AND absence on the good one.
- `node lib/check-prompt.mjs` — structural gate over the prompt.
- `scripts/test-run-sh.sh` — driver wiring including placeholder substitution.
- Any test creating directories cleans up in `test.after`.

## Done criteria

- [ ] `cd pipelines/video/intro-studio && bash scripts/check.sh` exits 0 and prints `intro-studio check OK`
- [ ] `node --test lib/lint-screenplay.test.mjs` reports 13 passing
- [ ] `node lib/check-prompt.mjs` exits 0
- [ ] `bash run.sh demo lint` on a workdir with the good fixture exits 0 with no `E` lines
- [ ] Deleting any `## ` heading from `screenplay-prompt.md` makes `check-prompt.mjs` exit 1 (verify once by hand, then restore)
- [ ] `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` prints NOTHING
- [ ] `plans/README.md` carries the 181 row

## STOP conditions

- **Any change to a file under `pipelines/video/visuals-flow/` or `pipelines/video/card-library/`** — including `lib/zone-rules.mjs`, which this plan quotes as reference only.
- **Adding a lint rule that REQUIRES the default arc.** The owner decided on 2026-07-28 that intro structure is subjective and must not be hardcoded; `E6` checks only that a deviation is explained. A rule forcing the arc contradicts a standing decision and the executor cannot know better — stop and report.
- **A gate assertion fails and the tempting fix is to weaken, swap or delete it.** Fix the code or the fixture. Softening an assertion is a STOP.
- The good fixture cannot be made to lint clean — this means a rule is wrong, not that the fixture should be bent to fit. Stop and report which rule and why.
- Any lint rule that needs the rendered video to evaluate. Everything here reads JSON only; pixel-level rules belong in plan 182.

## Maintenance notes

- `check-prompt.mjs` is the anti-drift device: it fails when the schema grows an enum the prompt never mentions. If you add a field to the schema, the gate will tell you to document it. Do not delete it to move faster.
- `W1` (continuity) is the single rule most worth watching over the first few real videos. If real intros routinely warn on W1 while still looking good, the threshold is wrong and should be revisited from evidence — but only after the owner has judged real output, never from theory.
- The lint deliberately has no rule about beat COUNT or cue rate. visuals-flow learned that lesson the hard way: test-03's rejected intro measured 3.57 cues/min against a 2.30/min body — denser than the body and still rejected. Density was never the problem.
