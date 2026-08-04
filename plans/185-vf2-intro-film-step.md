---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/run-config.mjs, pipelines/video/visuals-flow/lib/run-config.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/scripts/check.sh, pipelines/video/visuals-flow/PIPELINE.md, pipelines/video/visuals-flow/CLAUDE.md]

mutation_apply: cd pipelines/video/visuals-flow && sed -i '' "s/intro: 'cards'/intro: 'film'/" lib/run-config.mjs
mutation_command: cd pipelines/video/visuals-flow && node --test lib/run-config.test.mjs
mutation_expect: not ok 7 - intro must default to cards
mutation_timeout: 300
---

# Plan 185: visuals-flow — the bespoke intro film as a step that is OFF by default

## Summary

- **Problem statement**: `pipelines/video/intro-studio` builds a video's intro as one bespoke authored composition and it now works, but it lives outside `visuals-flow` and re-derives its own inputs. It re-transcribes the intro and put four of five tool names wrong on screen ("Hejian", "Arcad", "Open Art", "Higgs Field") when visuals-flow's `010-transcribe-run` quality pass already had them right. It also invents its own visual motif, while visuals-flow's `concept.json` throughline already says the roster "opens as five blank, equal candidate cards in the intro roll call".
- **Goals**:
  - Add `intro: "cards" | "film"` to the existing step-005 kickoff config, defaulting to `"cards"`.
  - Add step `025-author-intro-film-llm` between `020-choose-concept-llm` and `030-pick-or-propose-graphics-llm`, producing `videos/<slug>/intro-film/out/intro.mp4` from visuals-flow's own `transcript.json`, `segments.json` and `concept.json`.
  - Port the proven intro-studio libraries (screenplay lint, pre-render review, style gate, film gate, asset linking) into `lib/intro-film/`.
  - Guarantee **no template contamination**: the step reads `card-library/DESIGN.md` and `card-library/logos/registry.json`, and never `catalog.json` or any card template.
  - Guarantee **inertness**: with the default `intro: "cards"`, visuals-flow behaves exactly as it does today, proven by a test rather than assumed.
- **Executor proposed**: `claude-p` / `sonnet` — this is a multi-file port the executor re-expresses rather than places, plus two taste-judged content files (AUTHORING.md, TASTE.md). Per `tooling/boss/data/rules.md` both of those rows route to sonnet, not the agy default.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` green with the new test files registered in it; a default-config video's step list is byte-identical to today's; the contamination test proves the step never names `catalog.json`.
- **Stop conditions** (terse — full list below): any live HeyGen call; any write under `card-library/`; any edit to the six files the concurrent branch holds; weakening a gate assertion to get green.
- **Test / verification for success**: `node --test` unit tests for the config flag, the contamination invariant and every ported lib, plus the repo gate `scripts/check.sh`. No rendering is required to pass this plan.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6817afed..HEAD -- pipelines/video/visuals-flow pipelines/video/intro-studio`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW — everything this plan adds is unreachable unless a video opts in via `run-config.json`.
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard (routed to sonnet by the port rider, not by difficulty)
- **Planned at**: commit `6817afed`, 2026-08-03

## Why this matters

The owner's intros are the weak part of his videos and the card pipeline is not
the tool for them. `intro-studio` proved a bespoke authored film is better, then
proved something more useful: the first film failed for input reasons, not
approach reasons. It was authored against `brand.json` (five colour tokens, zero
typography) and shipped with a largest-text of 54px in Helvetica; it
re-transcribed its own audio and got four of five product names wrong; it
invented a motif that would have broken the seam into the body.

Every one of those inputs already exists, correct, inside `visuals-flow`. That
is the whole reason to move the step here.

The owner's constraint is equally specific and is the thing most likely to be
got wrong: *"just make sure that it's not using templatized things for intro and
those templates are not influencing this intro creation anyway. That context
should not come in intro."* The distinction this plan encodes is that the card
**catalog** is a template set and must stay out, while `DESIGN.md` and the logo
registry are the **brand** and must come in. Getting that backwards in either
direction fails the plan: reading the catalog contaminates the creative freedom,
and not reading DESIGN.md reproduces the 54px Helvetica film.

This plan deliberately stops short of letting the film reach the cut. Nothing in
visuals-flow consumes `intro-film/out/intro.mp4` yet — see Maintenance notes.

## Current state

### The kickoff config this hooks into

`pipelines/video/visuals-flow/lib/run-config.mjs` already carries the owner's
per-video choices and already has the exact "safe default" shape this plan
needs. Current head of the file:

```js
const DEFAULTS = { engine: 'heygen3', review: 'full' };
const ENGINES = ['heygen3', 'heygen4'];
const REVIEWS = ['full', 'express'];

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  if (!ENGINES.includes(cfg.engine)) throw new Error(`run-config.json: engine must be one of ${ENGINES.join('|')}, got "${cfg.engine}"`);
  if (!REVIEWS.includes(cfg.review)) throw new Error(`run-config.json: review must be one of ${REVIEWS.join('|')}, got "${cfg.review}"`);
  return cfg;
}
```

Its CLI `main()` parses `--engine`, `--review`, `--drive-folder`,
`--drive-account` and rejects anything else with `unknown argument: <a>`.

A real `videos/best-ai-video-generator/run-config.json`:

```json
{
  "engine": "heygen4",
  "review": "express",
  "drive_folder": "1H2Ffkqw_xWMUR20EWLWQ7ydTGAQ-rZoL",
  "drive_account": "kushalbakliwal25@gmail.com",
  "decided_at": "2026-08-01T09:25:34.650Z"
}
```

### The inputs the step reads

`videos/<slug>/segments.json` — `structure` gives the measured intro span:

```json
{ "structure": [ { "part": "intro", "start": 0, "end": 86.733 },
                 { "part": "body",  "start": 86.733, "end": 1769.695 },
                 { "part": "conclusion", "start": 1769.695, "end": 1927.695 } ] }
```

`videos/<slug>/transcript.json` — a flat ARRAY of word objects (5971 entries on
the real video), NOT an object:

```json
[ { "text": "5", "start": 0.4, "end": 0.48 },
  { "text": "AI", "start": 0.48, "end": 0.53 } ]
```

`videos/<slug>/concept.json` — keys `video`, `thesis`, `frame`, `throughline`,
`registers`. Its `throughline.evolution` begins *"Opens as five blank, equal
candidate cards in the intro roll call"*, which is why the film must read it.

### What is being ported

All of these are working and green at `origin/main` `6817afed` under
`pipelines/video/intro-studio/`:

| Source file | Role |
|---|---|
| `lib/lint-screenplay.mjs` + `lib/screenplay-schema.mjs` | screenplay lint E1–E7 / W1–W4 |
| `lib/review-film.mjs` | pre-render review: `hyperframes check --at-transitions` + 3 snapshots per beat + `REVIEW.md` |
| `lib/film-assets.mjs` | links workdir media into `film/assets/` |
| `lib/check-film-style.mjs` | DESIGN.md type contract + per-beat motion coverage |
| `lib/film-gate.mjs` + `lib/frames.mjs` + `lib/intake.mjs` | post-render gate G1–G5 |
| `lib/workdir.mjs` | slug → workdir resolution |
| `TASTE.md` | 10 numbered owner-feedback rules |
| `steps/030-author-film-llm/AUTHORING.md` | the authoring contract |

Three behaviours in that code are load-bearing and non-obvious. Preserve them
verbatim; each was a real failure:

1. **`film-assets.mjs` exists because `check` was silently vacuous.** A `../`
   asset path is a hyperframes lint ERROR, and when lint errors, the layout and
   contrast passes never sample. `check` reported `layout: ok` with an empty
   samples array. After linking media into the project it samples 498 times and
   finds real occlusions. If you ever see a suspiciously clean report, check the
   sample count.
2. **`lint-screenplay.mjs` E2 is CONTAINMENT, not endpoint matching.** Speech has
   pauses and E3 tiles beats without gaps, so some beat must absorb each pause; a
   0.72s pause made the two rules jointly unsatisfiable. A beat must cover its
   clause and may lead or trail it by at most `LEAD_MAX = 1.5`.
3. **`film-gate.mjs` G1 measures the VIDEO stream duration, not the container's.**
   A container's duration is its longest stream and the audio encoder pads to its
   own packet size, so format duration overstates the picture by tens of
   milliseconds even when every frame is correct.

### The conventions to match

- **Exemplar for a lib + test pair**: `pipelines/video/visuals-flow/lib/run-config.mjs`
  and `lib/run-config.test.mjs`. Match its comment density: this repo explains
  *why* a value exists and cites the owner decision that set it.
- **Exemplar for a step folder**: `steps/005-configure-run-human/README.md`.
- **`scripts/check.sh` enumerates its test files by hand.** A new
  `lib/**/*.test.mjs` that is not added to that list DOES NOT RUN. This is the
  single most likely way for this plan to land half-verified, and it is exactly
  LESSONS 2026-07-21 ("a plan's `test_cmd` must execute in EVERY directory the
  plan writes to").

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo gate (the merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, final line `visuals-flow check OK` |
| Run one test file | `cd pipelines/video/visuals-flow && node --test lib/run-config.test.mjs` | exit 0 |
| Run the new intro-film tests | `cd pipelines/video/visuals-flow && node --test "lib/intro-film/*.test.mjs"` | exit 0 |
| Inspect config for a slug | `cd pipelines/video/visuals-flow && node lib/run-config.mjs best-ai-video-generator` | JSON incl. `"intro": "cards"` |
| Driver usage | `cd pipelines/video/visuals-flow && bash run.sh` | exit 2, usage listing `intro-film` |
| Source of the port | `ls pipelines/video/intro-studio/lib/` | the files in the port table |

## Scope

**In scope** (the only files to create or edit):

- `pipelines/video/visuals-flow/lib/run-config.mjs` (+ `.test.mjs`)
- `pipelines/video/visuals-flow/lib/intro-film/` — NEW directory, all ported libs and their tests
- `pipelines/video/visuals-flow/steps/025-author-intro-film-llm/` — NEW (`README.md`, `AUTHORING.md`)
- `pipelines/video/visuals-flow/TASTE-INTRO.md` — NEW
- `pipelines/video/visuals-flow/run.sh`
- `pipelines/video/visuals-flow/scripts/check.sh`
- `pipelines/video/visuals-flow/PIPELINE.md`, `CLAUDE.md`, `.gitignore`
- `plans/README.md` (status row only)

**Out of scope** — looks related, do NOT touch:

- `lib/avatar-render.mjs`, `lib/export-timeline.mjs(+test)`, `lib/lint-shots.mjs(+test)`,
  `lib/resolve-shots.mjs`, `lib/shot-constants.mjs`, `lib/sound/build-mix.mjs`,
  `steps/060-place-avatar-llm/shot-pass-prompt.md`, `steps/140-davinci-export-run/README.md`,
  `tests/TESTS.md` — **a concurrent session holds 8 unmerged commits on these**
  (branch `chore/boss-hardening-2026-08-02`). Editing them creates a merge conflict
  with live work.
- `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, `lib/assemble.mjs`, `lib/lint-cues.mjs`
  — these make visuals-flow stand down on the intro. That is the FOLLOW-UP plan, not this one.
  This plan's film is produced and then sits there; nothing consumes it.
- `pipelines/video/card-library/**` — READ-ONLY, always.
- `pipelines/video/intro-studio/**` — the source of the port. Copy from it; do not
  edit it. It stays working and standalone.

## Git workflow

- Branch: `advisor/185-vf2-intro-film-step`
- Commit per step: `feat(visuals-flow): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the `intro` flag to the kickoff config

Edit `lib/run-config.mjs`:

- Add `intro: 'cards'` to `DEFAULTS` (it must be the LAST key so the existing
  object's diff stays readable).
- Add `const INTROS = ['cards', 'film'];`
- In `loadRunConfig`, after the `REVIEWS` check, add:
  ```js
  if (!INTROS.includes(cfg.intro)) throw new Error(`run-config.json: intro must be one of ${INTROS.join('|')}, got "${cfg.intro}"`);
  ```
- In `main()`, add `else if (a === '--intro') cfg.intro = rest.shift();` alongside
  the existing flag parsing, plus the matching validation before write:
  ```js
  if (!INTROS.includes(cfg.intro)) { console.error(`intro must be ${INTROS.join('|')}`); process.exit(1); }
  ```
- Extend the closing log line to `run-config: engine=${cfg.engine} review=${cfg.review} intro=${cfg.intro}`.
- When `cfg.intro === 'film'`, print this note to stderr:
  ```js
  if (cfg.intro === 'film') console.error('note: intro=film authors a bespoke intro composition at step 025. Nothing consumes it yet — the cut still uses zone cards until the follow-up plan lands.');
  ```

Write the doc comment above `DEFAULTS` in the file's existing voice, stating
that `cards` is every video before this existed and that `film` is a POC.

**Verify**: `cd pipelines/video/visuals-flow && node lib/run-config.mjs best-ai-video-generator` → JSON containing `"intro": "cards"` (that video's `run-config.json` has no `intro` key, so this proves the default applies to existing videos).

### Step 2: Test the flag, including the default-off invariant

Add to `lib/run-config.test.mjs`, following the file's existing test style:

- `intro defaults to cards when run-config.json is absent`
- `intro defaults to cards when run-config.json exists without the key` — this is
  the real-world case: every existing video's config predates this field.
- `an unknown intro value throws` — assert the message matches `/intro must be one of/`.
- **`intro must default to cards`** — assert `DEFAULTS.intro === 'cards'` via
  `loadRunConfig` on an empty temp dir. **This test's failure message must contain
  the exact string `intro must default to cards`** — the merge-time mutation gate
  flips the default and requires that string in the failure output.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/run-config.test.mjs` → exit 0.

**Verify the gate actually fires** (do this yourself, do not assume):
`sed -i '' "s/intro: 'cards'/intro: 'film'/" lib/run-config.mjs && node --test lib/run-config.test.mjs; git checkout lib/run-config.mjs`
→ the run must FAIL and print `intro must default to cards`. If it passes, the
test is not gating anything — fix the test, do not proceed.

### Step 3: Port the libraries into `lib/intro-film/`

Create `pipelines/video/visuals-flow/lib/intro-film/` and copy each file from
the port table in Current state, WITH its tests. For each file:

- Keep every explanatory comment. They encode failures that cost real debugging
  time; a port that strips them re-opens those bugs.
- Change only what the new location requires: import paths, and
  `workdir.mjs`'s `ROOT` so it resolves `visuals-flow/videos/<slug>`.
- The film's working directory is `videos/<slug>/intro-film/`. Inside it the
  layout matches intro-studio: `screenplay.json`, `film/index.html`,
  `film/assets/`, `review/`, `renders/`, `out/`.

Two adaptations are required and are the only behavioural changes:

1. **`intake.mjs` must not re-derive the intro.** In intro-studio it cut
   `input/intro.mp4` into `vo.mp3` + `screen.mp4` and transcribed it. Here the
   intro span comes from `segments.json` and the words from `transcript.json`.
   Replace its intake path with this exact function, in a new
   `lib/intro-film/inputs.mjs`:

   ```js
   // The whole reason this step moved into visuals-flow. intro-studio transcribed the
   // intro itself and put four of five product names wrong on screen; 010's
   // quality pass already has them right, and 015 already measured where the
   // intro ends. Deriving either one again here would re-open both bugs.
   import fs from 'node:fs';
   import path from 'node:path';

   export function introSpan(workdir) {
     const segs = JSON.parse(fs.readFileSync(path.join(workdir, 'segments.json'), 'utf8'));
     const intro = (segs.structure ?? []).find((p) => p.part === 'intro');
     if (!intro) throw new Error('segments.json has no "intro" part — run `run.sh <slug> segments` first');
     if (!(intro.end > intro.start)) throw new Error(`segments.json intro span is not positive: ${intro.start}..${intro.end}`);
     return { start: intro.start, end: intro.end, duration: intro.end - intro.start };
   }

   // transcript.json is a flat ARRAY of {text,start,end} words, not an object.
   export function introWords(workdir) {
     const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
     if (!Array.isArray(words)) throw new Error('transcript.json must be an array of words');
     const { start, end } = introSpan(workdir);
     return words.filter((w) => w.start >= start && w.end <= end);
   }
   ```

2. **`film-gate.mjs` G1 compares against `introSpan().duration`**, not an
   `intake.json`. Everything else about the gate is unchanged.

**Verify**: `cd pipelines/video/visuals-flow && node --test "lib/intro-film/*.test.mjs"` → exit 0, and the test count is at least the 80 that pass in intro-studio today (`cd pipelines/video/intro-studio && node --test "lib/*.test.mjs"` reports `# pass 80`). A materially lower number means tests were dropped in the port.

### Step 4: Register the new tests in the repo gate

`scripts/check.sh` lists every test file explicitly. Add the intro-film tests.
Because they live in a subdirectory, add them as their own line AFTER the
existing `node --test lib/...` line:

```sh
node --test "lib/intro-film/"*.test.mjs
```

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh 2>&1 | grep -c "intro-film"` → at least 1, proving the new tests are actually inside the gate.

### Step 5: The step folder and the authoring contract

Create `steps/025-author-intro-film-llm/`:

**`README.md`** — in the voice of `steps/005-configure-run-human/README.md`:
what the step is, that it only runs when `run-config.json` has `intro: "film"`,
its inputs (`transcript.json`, `segments.json`, `concept.json`, DESIGN.md, the
logo registry), its output (`intro-film/out/intro.mp4`), and that nothing
downstream consumes that file yet.

**`AUTHORING.md`** — port `pipelines/video/intro-studio/steps/030-author-film-llm/AUTHORING.md`
wholesale, then make these changes:

- Materials become `assets/vo.mp3` / `assets/avatar.mp4` from the visuals-flow workdir;
  keep the existing warning that a `../` path is a lint error that silently
  disables the layout pass.
- Add a **"What you may and may not read"** section, stated this plainly:

  > **Read in full**: `../card-library/DESIGN.md` and
  > `../card-library/logos/registry.json`. The design system and the real logos
  > are the BRAND. The first film was authored against `brand.json` — five colour
  > tokens, no typography — and shipped a largest-text of 54px in Helvetica with
  > invented colours.
  >
  > **Never read**: `catalog.json`, or any card under `../card-library/<slug>/`.
  > The card catalog is a TEMPLATE SET. The owner's requirement is that templates
  > do not influence the intro at all: *"just make sure that it's not using
  > templatized things for intro and those templates are not influencing this
  > intro creation anyway. That context should not come in intro."* The intro has
  > full creative freedom; a catalog in scope quietly removes it.

- Add: read `concept.json`'s `throughline` and `registers` and enact them. The
  body inherits the same through-line, so a film that invents its own motif
  breaks the seam.
- Add: read `TASTE-INTRO.md` before authoring.
- Keep the render gotchas verbatim: `PRODUCER_EXPERIMENTAL_FAST_CAPTURE=false`;
  root needs `data-composition-id` + `data-start="0"` + `data-width`/`data-height`;
  `window.__timelines[<id>]` must be registered or every worker stalls 45s.

Copy `pipelines/video/intro-studio/TASTE.md` to
`pipelines/video/visuals-flow/TASTE-INTRO.md` unchanged apart from any path
references.

**Verify**: `cd pipelines/video/visuals-flow && test -f steps/025-author-intro-film-llm/AUTHORING.md && grep -q "Never read" steps/025-author-intro-film-llm/AUTHORING.md && echo ok` → `ok`

### Step 6: The contamination invariant, as a test

Create `lib/intro-film/no-template-contamination.test.mjs`. It asserts that the
step's authoring context never names the card catalog:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The owner's hard constraint: the card catalog is a TEMPLATE SET and must not
// reach the intro's context, or it removes the creative freedom that is the
// entire point of authoring the intro rather than assembling it. DESIGN.md and
// the logo registry are the BRAND and are required reading — this test must
// never be "fixed" by also banning those.
const BANNED = ['catalog.json', 'card-plan.json', 'cues.json'];

test('the 025 authoring context never names the card catalog', () => {
  const dir = path.join(ROOT, 'steps', '025-author-intro-film-llm');
  for (const file of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const banned of BANNED) {
      // "Never read: catalog.json" is the one legitimate mention: the
      // prohibition itself. Allow it only on a line that forbids it.
      const offending = text.split('\n').filter(
        (l) => l.includes(banned) && !/never read|do not read|must not/i.test(l),
      );
      assert.deepEqual(offending, [], `${file} references ${banned} outside a prohibition`);
    }
  }
});

test('the 025 authoring context requires DESIGN.md and the logo registry', () => {
  const a = fs.readFileSync(path.join(ROOT, 'steps', '025-author-intro-film-llm', 'AUTHORING.md'), 'utf8');
  assert.match(a, /DESIGN\.md/, 'the brand contract is required reading');
  assert.match(a, /logos\/registry\.json/, 'real logos are required');
});

test('no intro-film library imports the catalog', () => {
  const dir = path.join(ROOT, 'lib', 'intro-film');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!src.includes('catalog.json'), `${f} must not read catalog.json`);
  }
});
```

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-film/no-template-contamination.test.mjs` → exit 0.

**Verify the gate fires**: add the line `Consult catalog.json for ideas.` to
`steps/025-author-intro-film-llm/AUTHORING.md`, re-run → must FAIL with
`references catalog.json outside a prohibition`. Remove the line.

### Step 7: Driver verbs

Edit `run.sh`. Add to the `usage()` list, positioned after `concept-pass` so the
list reflects execution order:

```
  intro-film
  intro-review
  intro-render
```

Add three `case` arms. Each must refuse immediately when the video is not opted
in, using this exact guard so the message is identical across all three:

```sh
  intro-film|intro-review|intro-render)
    intro_mode=$(node -e "import('./lib/run-config.mjs').then(m=>console.log(m.loadRunConfig('videos/$slug').intro))")
    if [[ "$intro_mode" != "film" ]]; then
      echo "intro=$intro_mode — this video does not use the bespoke intro film."
      echo "Opt in with: bash run.sh $slug configure --intro film"
      exit 1
    fi
    ...
    ;;
```

- `intro-film` prints the authoring prompt (read `steps/025-author-intro-film-llm/AUTHORING.md`, substitute the slug), matching how `run.sh` emits other LLM-step prompts.
- `intro-review` runs the ported review pass over `videos/<slug>/intro-film/film/index.html`.
- `intro-render` runs the ported render + gate.

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh 2>&1 | grep -c "intro-film"` → 1.

**Verify the guard**: `cd pipelines/video/visuals-flow && bash run.sh best-ai-video-generator intro-film; echo "exit=$?"` → prints `intro=cards — this video does not use the bespoke intro film.` and `exit=1`. That video is configured `review: express` with no `intro` key, so this proves an existing video cannot accidentally enter the new path.

### Step 8: Ignore generated film artifacts

Add to `pipelines/video/visuals-flow/.gitignore`, following the file's
existing per-video pattern:

```
videos/*/intro-film/film/assets/
videos/*/intro-film/review/
videos/*/intro-film/renders/
videos/*/intro-film/out/
```

`screenplay.json` and `film/index.html` are authored content and stay tracked.

**Verify**: `cd pipelines/video/visuals-flow && git check-ignore -q videos/x/intro-film/renders/a.mp4 && echo ignored` → `ignored`

### Step 9: Documentation

- `PIPELINE.md`: add a row between `020-choose-concept-llm` and
  `030-pick-or-propose-graphics-llm`:

  `| `025-author-intro-film-llm` | [LLM] (OFF by default) | `transcript.json` + `segments.json` + `concept.json` + `card-library/DESIGN.md` → `intro-film/out/intro.mp4`. Runs only when `run-config.json` has `intro: "film"`. Reads the design system and the logo registry, NEVER `catalog.json` — the intro keeps full creative freedom. Nothing consumes the output yet |`

- `CLAUDE.md`: add a short section stating that the intro film step exists, is
  off by default, and that its one hard rule is no catalog in scope.

**Verify**: `cd pipelines/video/visuals-flow && grep -c "025-author-intro-film-llm" PIPELINE.md` → at least 1.

### Step 10: Prove inertness on a fresh checkout

The last step runs the gate on a pristine tree, because crews verify in
worktrees carrying their own build artifacts (LESSONS 2026-07-31).

```sh
cd "$(git rev-parse --show-toplevel)"
git worktree add --detach /tmp/185-fresh HEAD
cd /tmp/185-fresh/pipelines/video/visuals-flow && bash scripts/check.sh
```

Then prove the default path is unchanged:

```sh
cd /tmp/185-fresh/pipelines/video/visuals-flow
node -e "import('./lib/run-config.mjs').then(m=>{const c=m.loadRunConfig('videos/best-ai-video-generator');if(c.intro!=='cards')throw new Error('not inert: '+c.intro);console.log('inert')})"
```

Clean up: `git worktree remove --force /tmp/185-fresh`

**Verify**: both commands exit 0; the second prints `inert`.

## Test plan

New tests, all under `pipelines/video/visuals-flow/`:

- `lib/run-config.test.mjs` — four new cases (Step 2), including the
  mutation-gated default-off assertion.
- `lib/intro-film/*.test.mjs` — the ported suites, at parity with intro-studio's 80.
- `lib/intro-film/inputs.test.mjs` — NEW: `introSpan` throws when `segments.json`
  has no intro part; `introWords` filters the flat word array to the span and
  throws when transcript.json is not an array.
- `lib/intro-film/no-template-contamination.test.mjs` — NEW (Step 6).

Every one of these must be reachable from `scripts/check.sh` (Step 4).

No rendering is required to pass this plan. Rendering needs an avatar clip,
which is owner-run.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`
- [ ] `bash scripts/check.sh 2>&1 | grep -c "intro-film"` ≥ 1 — the new tests are inside the gate
- [ ] `node lib/run-config.mjs best-ai-video-generator` reports `"intro": "cards"`
- [ ] `bash run.sh best-ai-video-generator intro-film` exits 1 with the opt-in message
- [ ] `node --test lib/intro-film/no-template-contamination.test.mjs` exits 0, and manually adding a `catalog.json` reference to AUTHORING.md makes it FAIL
- [ ] Flipping `DEFAULTS.intro` to `'film'` makes `node --test lib/run-config.test.mjs` FAIL printing `intro must default to cards`
- [ ] `node --test "lib/intro-film/*.test.mjs"` reports at least 80 passing
- [ ] `git diff --name-only 6817afed..HEAD` contains none of the six concurrent-branch files listed in Out of scope
- [ ] The fresh-checkout run in Step 10 passes and prints `inert`

## STOP conditions

- **Any live HeyGen or other paid API call.** Avatar generation is owner-run. If a
  step seems to need one, stop and report.
- **Any write under `pipelines/video/card-library/`.** It is read-only from here,
  permanently.
- **Any edit to the six concurrent-branch files** listed in Out of scope. If the
  work appears to require one, stop — that is the follow-up plan, and touching
  them now conflicts with live work.
- **Gate integrity**: if an assertion fails, fix the code or the fixture.
  Weakening, swapping, or deleting an assertion is a STOP. This includes
  "relaxing" the contamination test by adding entries to an allow-list.
- **If the ported test count comes out materially below 80**, stop and report
  which suites were dropped rather than proceeding with a thinner port.
- **If `check.sh` cannot be made to run the new tests** without touching
  `tests/TESTS.md` (a concurrent-branch file), stop and report.

## Maintenance notes

**This plan deliberately produces an orphan.** `intro-film/out/intro.mp4` is
generated and nothing reads it. That is intentional so this lands with zero risk
to the working pipeline, but it means the owner still drops the file into the
edit by hand, exactly as with standalone intro-studio.

Two follow-up plans complete the feature and must NOT be folded into this one:

1. **visuals-flow stands down on the intro when `intro: "film"`.** Five surfaces currently
   process the intro span and would double-treat it:
   - `035-pick-or-propose-intro-outro-llm` must author the CONCLUSION ONLY
     (`ZONE_PARTS = ['intro','conclusion']` in `lib/zone-constants.mjs`).
   - `R_ZONE_LINK_CTA` in `lib/zone-rules.mjs` is **positional across the whole
     video**: the first "link in the description" mention gets the scrim and
     later ones get pills. If the film owns the intro it owns the first mention,
     so the conclusion must switch to pills. This is the subtle one — the same
     rule was already got backwards once (owner fold 2026-08-01).
   - Zone lint W15 and E13 assume the intro has cues.
   - `lib/lint-shots.mjs` E8 `INTRO_HOST` demands the host on screen by 15s in a
     span the film would own.
   - `lib/assemble.mjs` and `lib/export-timeline.mjs` must splice the film.

   **`lint-shots.mjs` and `export-timeline.mjs` are on the concurrent branch.**
   That plan is blocked until `chore/boss-hardening-2026-08-02` merges.

2. **An owner review for the intro on the board.** The owner asked for this
   explicitly (2026-08-03). It follows the existing tab pattern in
   `board-ui/src/tabs/` (`StoryboardTab.tsx`, `CardPlanTab.tsx`) and would surface
   the review pass's beat frames and contact sheets plus an approve gate, in the
   shape of `080-approve-storyboard-human`. That plan is `ui: true`, so boss will
   require a committed screenshot at merge.

**What a reviewer should scrutinise here**: that the port kept its comments, that
`check.sh` really runs the new tests (run it and grep), and that the
contamination test fails when it should — a gate that cannot fire reads as
coverage and is worse than no gate.
