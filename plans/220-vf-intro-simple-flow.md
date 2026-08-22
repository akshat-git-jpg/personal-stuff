---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["plan 218 (introMode switch) and plan 219 (the intro kit) must both be merged first"]
needs_prs: [177, 178]
touches: [pipelines/video/visuals-flow/lib/intro-kit/, pipelines/video/visuals-flow/lib/intro-film/approve.mjs, pipelines/video/visuals-flow/lib/assemble.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/, pipelines/video/visuals-flow/steps/125-approve-intro-simple-human/, pipelines/video/visuals-flow/steps/135-render-intro-simple-run/, pipelines/video/visuals-flow/steps/445-rerender-intro-simple-run/, pipelines/video/visuals-flow/steps/_verbs.json, pipelines/video/visuals-flow/PIPELINE.md]

mutation_apply: perl -0pi -e 's/AVATAR_MAX_SHARE = 0\.55/AVATAR_MAX_SHARE = 1.01/' pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.mjs
mutation_command: node --test lib/intro-kit/lint-cutlist.test.mjs
mutation_expect: S1
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 300
---

# Plan 220: the simple intro flow — cut list, pacing lint, three steps

## Summary

- **Problem statement**: plan 218 added the `introMode: simple | complex` switch and
  plan 219 built the 7-card locked kit, but there is still no simple flow. A video
  set to `simple` has an intro track with no steps in it, so nothing builds its
  intro.
- **Goals**:
  - Define `intro-simple/cutlist.json` — a flat list of beats (avatar or card) that
    tiles the measured intro span. The authoring model writes ONLY this file; it
    never writes HTML.
  - Add `lib/intro-kit/lint-cutlist.mjs` — the pacing lint (codes `S1`-`S7`) that
    encodes the ratios measured from the owner's four reference intros.
  - Add `lib/intro-kit/render-simple.mjs` — render each card beat with the existing
    `lib/render.mjs` staging machinery pointed at `intro-kit/`, then cut the beats
    together with the avatar into `intro-film/out/intro.mp4`.
  - Add steps `115` (author), `125` (owner gate), `135` (render), `445` (re-render
    with the real avatar), all `modes: ["simple"]`.
  - Make `requireIntroApproved()` mode-aware so assembly gates on whichever flow
    built the intro.
- **Executor proposed**: `claude-p` / Claude Sonnet — this plan ships an authoring
  rulebook (`SIMPLE-PASS.md`), which `tooling/boss/data/rules.md` routes to
  claude-p sonnet as quality-setting content the owner judges by taste.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` green; the
  pacing lint has 7 codes each with a passing and a failing unit test; a fixture
  cutlist renders end-to-end to an mp4 matching the intro span duration.
- **Stop conditions** (terse — full list below): never change a complex-flow file
  beyond the two shared call sites named in scope; never weaken a lint threshold to
  make a fixture pass; do not touch the board.
- **Test / verification for success**: `node --test` unit tests per lint code plus a
  fixture render whose output duration is asserted. Mutation-gated on `S1`.
- **Open points for plan readiness**: none. (`needs_prs` is filled: PR #177 is plan
  218's and PR #178 is plan 219's; boss will not dispatch this plan until both are
  closed.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 20a2ae62..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/run.sh pipelines/video/intro-kit`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 218 (the `modes` registry key and `introMode()`), plan 219
  (`pipelines/video/intro-kit/` with `kit.json` and 7 cards)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `20a2ae62`, 2026-08-22

## Why this matters

The design decision that makes this flow fast: **the authoring model writes a cut
list, not a composition.** It picks a card slug per beat from a locked kit of 7 and
fills that card's variables. It never invents a treatment, never writes HTML, and
never proposes competing directions. That is the whole difference from the complex
flow, where authoring a bespoke Hyperframes film is the step.

The pacing rules come from measuring the owner's four reference intros this session:

| Reference | Visual changes / 45s | Graphics share |
|---|---|---|
| `_1gFEbL4LdA` | 22 | ~40% |
| `nf5PUM0cg6k` | 24 | ~57% |
| `VQ9R05DqL04` | 20 | ~53% |
| `kO3WtZmDb_A` | 60 | ~73% |

So: a cut roughly every 2 seconds, and the presenter alone for about half the intro
at most. The owner's phrasing was *"more footage to avatar time"*. Those become
`S1`, `S2` and `S3` below — enforced, not suggested, because the whole point is that
no session has to exercise taste about pacing again.

## Current state

### What plan 218 gives you

- `lib/run-config.mjs` exports `INTRO_MODES` (`['simple','complex']`) and
  `DEFAULT_INTRO_MODE` (`'simple'`), and `loadRunConfig()` resolves `introMode`.
- `lib/intro-modes.mjs` exports `introSpan(workdir)` and `introMode(workdir)`.
- `lib/steps.mjs` exports `stepInMode(step, mode)`; `nextStep({..., mode})` skips
  out-of-mode steps; steps 110-160 and 440 carry `modes: ["complex"]`.

### What plan 219 gives you

`pipelines/video/intro-kit/` with `kit.json` (7 cards, each with
`overlay`, `minDuration`, `maxDuration`, `required`, `optional`),
`hyperframes.json`, `meta.json`, and `cards/<slug>/index.html` for
`statement`, `checklist`, `logo-grid`, `shot-float`, `ui-mock`, `chain`,
`lower-third`. `lower-third` is the only card with `"overlay": true`.

### The render machinery to REUSE, not reimplement

`lib/render.mjs` already stages a card and drives the hyperframes CLI. Its
staging block, verbatim:

```js
      fs.cpSync(path.join(cardLibraryRoot, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
      fs.cpSync(path.join(cardLibraryRoot, 'meta.json'), path.join(stagedDir, 'meta.json'));
      const stagedCardDir = path.join(stagedDir, cue.card);
      fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
      fs.cpSync(path.join(cardLibraryRoot, cue.card), stagedCardDir, { recursive: true });
```

It also already exports the helpers this flow needs:

```js
export function hashRenderInputs(stagedDir, args)   // render cache key
export async function runPool(items, nWorkers, fn)  // bounded parallel render
export function rewriteDuration(html, seconds)      // stamps data-duration
export function rewriteCanvas(html, width)
export const DEFAULT_JOBS = 3;
```

**`rewriteDuration` and the kit's own DURATION block are BOTH needed and are not
duplicates.** `rewriteDuration` stamps the `data-duration` attribute so the renderer
encodes the right number of frames. The kit card's internal `DUR` block scales its
motion schedule to that length. Stamping the attribute without scaling the schedule
produces a card whose animation finishes early and then holds still — which trips
plan 219's `E-KIT-DEVICE` frame-delta check, so do not "simplify" one away.

### The approval gate that must become mode-aware

`lib/intro-film/approve.mjs`, verbatim:

```js
export function requireIntroApproved(workdir) {

  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the intro film first`);
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!intro.approved) {
    throw new Error(
      'intro film is not approved — it must not go into the cut until the owner ' +
      'has watched it. Open the board, play it on the Intro tab, and approve ' +
      'there (step 027). Re-rendering after feedback needs no approval.'
    );
  }
}
```

`lib/assemble.mjs` calls it at line 1182 and reads the intro at two places:

```js
728:       src = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
1174:   const filmSpan = introSpan(workdir);
1175:   const introFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
```

**The simple flow writes to that SAME output path**, `intro-film/out/intro.mp4`.
That keeps `assemble.mjs` and `export-timeline.mjs` splice logic completely
unchanged — the only assemble-side change in this plan is the mode-aware approval
call. The path keeps the word "film" for that reason alone; say so in a comment so
nobody renames it and breaks two consumers.

### Conventions to match

- Node ESM `.mjs`, 2-space indent, `node:test` + `node:assert/strict`.
- Lint codes are `S<n>` with a one-line human message, matching the existing
  `lib/lint-cues.mjs` `E<n>` style. Read `lib/lint-cues.mjs` before writing
  `lint-cutlist.mjs` and mirror its report shape (`{ errors: [], warnings: [] }`).
- Step folders carry `step.json` + `README.md`; an `-llm` step also carries its
  authoring prompt as a separate markdown file that `run.sh` cats.
- `check.sh` finds `lib/**/*.test.mjs` by globbing, so a new test file joins the
  gate by existing. Do not add it to a list.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Registry + doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exit 0 |
| Regenerate the table | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs` | rewrites PIPELINE.md |
| Lint unit tests | `cd pipelines/video/visuals-flow && node --test lib/intro-kit/lint-cutlist.test.mjs` | exit 0 |
| Render unit tests | `cd pipelines/video/visuals-flow && node --test lib/intro-kit/render-simple.test.mjs` | exit 0 |
| run.sh verb smoke | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | exit 0 |
| Probe a render duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | seconds |

**Never `node --test <dir>`** — a directory argument fails on node 22.14
(LESSONS 2026-07-09). Name files or use a glob.

## The cut list — `intro-simple/cutlist.json`

This schema is the contract. Inlined here in full so the authoring step and the lint
cannot drift.

```json
{
  "video": "<slug>",
  "mode": "simple",
  "span": { "start": 0.0, "end": 34.2 },
  "approved": false,
  "beats": [
    { "id": "b01", "kind": "avatar", "t_start": 0.0,  "t_end": 4.2 },
    { "id": "b02", "kind": "card", "card": "statement", "t_start": 4.2, "t_end": 7.4,
      "vars": {
        "text": "Quietly making people thousands of dollars a month",
        "accent": "thousands of dollars",
        "beats": [ { "text": "Quietly", "accent": false, "at": 0.0 } ]
      } },
    { "id": "b03", "kind": "overlay", "card": "lower-third", "t_start": 7.4, "t_end": 9.9,
      "vars": { "text": "Hi, my name is Mira", "beats": [] } }
  ]
}
```

Field rules:

- `kind` is one of `avatar` (presenter full frame, no graphic), `card` (full-frame
  graphic, presenter hidden), `overlay` (graphic composited OVER the presenter).
- `card` is required when `kind` is `card` or `overlay`, and must be a slug in
  `intro-kit/kit.json`. A card whose `kit.json` `overlay` is `true` may ONLY be used
  with `kind: "overlay"`, and vice versa.
- `vars` must contain every key in that card's `kit.json` `required` list, and no key
  outside `required` + `optional`.
- Beats tile `span` exactly, in order, with no gaps and no overlaps.
- `approved` is set only by the board at step 125. The authoring step never writes it.

## The pacing lint — `lib/intro-kit/lint-cutlist.mjs`

Seven codes. The three thresholds are module constants so the mutation recipe can
reach them:

```js
// Measured from the owner's four reference intros (2026-08-22) — see plan 220 and
// decisions.md. These are the numbers that replace per-video taste about pacing.
export const AVATAR_MAX_SHARE = 0.55;  // S1
export const AVATAR_MAX_HOLD  = 5.0;   // S2, seconds
export const CUT_MIN          = 1.5;   // S3, seconds
export const CUT_MAX          = 4.0;   // S3, seconds
```

| Code | Rule | Why |
|---|---|---|
| `S1` | avatar share of the span must be `<= AVATAR_MAX_SHARE`. **`overlay` beats count as avatar time**, because the presenter is still on screen. | the owner asked for "more footage to avatar time"; references sat at 27-60% |
| `S2` | no single `kind: "avatar"` beat longer than `AVATAR_MAX_HOLD` | references never hold the presenter alone past ~5s |
| `S3` | every beat's length must be within `[CUT_MIN, CUT_MAX]` | references change something roughly every 2s |
| `S4` | `vars` satisfies the card's `kit.json` `required`/`optional` lists exactly | a missing required var renders an empty card |
| `S5` | beats tile `span` exactly: sorted, contiguous to within 0.01s, first `t_start == span.start`, last `t_end == span.end` | a gap renders as a black hole in the cut |
| `S6` | each card beat's length is within that card's `kit.json` `minDuration`/`maxDuration` | a 2s `chain` cannot finish drawing its lines |
| `S7` | for every card with a `beats[]` word list, each word's `text` must appear in `transcript.json` within `[t_start, t_end]` of the span, in order | the standalone intro POC put 4 of 5 product names wrong on screen; the transcript is the source of truth, never the model's memory |

`S1`, `S2`, `S3`, `S5` are ERRORS. `S6` is an ERROR. `S4` and `S7` are ERRORS.
There are no warnings in this lint — a cut list that violates a pacing rule is the
defect the flow exists to prevent, so nothing here is advisory. (LESSONS 2026-07-24:
*"making an LLM audit advisory means it gets ignored — port doctrine as GATES, not
signals."*)

Report shape, matching `lib/lint-cues.mjs`:

```js
export function lintCutlist({ cutlist, kit, words }) {
  const errors = [];
  // ... push `S1: avatar share 0.71 exceeds 0.55 ...` style strings
  return { errors, warnings: [] };
}
```

Every message starts with its code, so `mutation_expect: S1` can match.

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/intro-kit/` (NEW dir): `lint-cutlist.mjs`,
  `lint-cutlist.test.mjs`, `render-simple.mjs`, `render-simple.test.mjs`,
  `cutlist-schema.mjs`, `inputs.mjs`, and a `fixtures/` dir
- `pipelines/video/visuals-flow/lib/intro-film/approve.mjs` — mode-aware
  `requireIntroApproved` ONLY
- `pipelines/video/visuals-flow/lib/assemble.mjs` — the `requireIntroApproved` call
  site ONLY (pass the mode)
- `pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/` (NEW:
  `step.json`, `README.md`, `SIMPLE-PASS.md`)
- `pipelines/video/visuals-flow/steps/125-approve-intro-simple-human/` (NEW)
- `pipelines/video/visuals-flow/steps/135-render-intro-simple-run/` (NEW)
- `pipelines/video/visuals-flow/steps/445-rerender-intro-simple-run/` (NEW)
- `pipelines/video/visuals-flow/steps/_verbs.json` — the `intro-simple-lint` helper entry only
- `pipelines/video/visuals-flow/run.sh` — four new verbs
- `pipelines/video/visuals-flow/PIPELINE.md` (regenerated)
- `plans/README.md` — this plan's row

**Out of scope**:
- Every file under `steps/1[1-6]0-*/` and `steps/440-*/` — the complex flow. Plan
  218 already tagged their `step.json`; nothing else about them changes, ever, in
  this chain.
- `lib/intro-film/**` except `approve.mjs`. In particular do NOT touch
  `no-template-contamination.test.mjs` — it scans only the 130 folder and
  `lib/intro-film/*.mjs`, so a NEW `lib/intro-kit/` dir is outside it by design.
  That is why the simple flow lives in its own directory.
- `lib/zone-constants.mjs` / `ZONE_PARTS` — both flows own the intro span, so the
  cue passes still author the conclusion only.
- `pipelines/video/intro-kit/**` — plan 219 owns the cards. If a card needs a fix,
  STOP and report.
- `lib/board.mjs`, `board-ui/`, `TASTE-INTRO.md`, the `yt-video-edit` SKILL.md —
  plan 221.

## Git workflow

- Branch: `advisor/220-vf-intro-simple-flow`
- Commit per step. Message form: `feat(vf): <step summary>`. No AI footers. Do NOT push.

## Steps

### Step 1: the schema module and its fixtures

Create `lib/intro-kit/cutlist-schema.mjs` exporting `KINDS = ['avatar','card','overlay']`
and a `validateShape(cutlist)` that checks types and required keys only (not pacing) —
so a malformed file fails with a clear message before the pacing lint runs.

Create `lib/intro-kit/fixtures/`:
- `good.json` — a 34.2s span, 11 beats, avatar share 0.48, every beat 1.8-3.8s,
  passing all seven codes.
- `bad-s1.json` — same span, avatar share 0.71.
- `bad-s2.json` — one 7.5s avatar beat.
- `bad-s3.json` — one 5.5s card beat.
- `bad-s4.json` — a `checklist` beat missing `rows`.
- `bad-s5.json` — a 0.4s gap between two beats.
- `bad-s6.json` — a 2.2s `chain` beat (below its `minDuration` of 3.0).
- `bad-s7.json` — a `statement` whose word list says "Higgs Field" where the
  transcript says something else.
- `words.json` — the transcript word fixture the S7 cases resolve against.

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/intro-kit/cutlist-schema.mjs').then(m=>console.log(m.KINDS.join(',')))"` -> prints `avatar,card,overlay`.

### Step 2: the pacing lint + its tests

Write `lib/intro-kit/lint-cutlist.mjs` exactly as specified above (constants,
`lintCutlist`, `S1`-`S7`).

Write `lib/intro-kit/lint-cutlist.test.mjs` with, at minimum, 15 tests:
- one per code asserting the matching `bad-*.json` fixture produces an error whose
  message STARTS with that code (7 tests);
- one per code asserting `good.json` does NOT produce that code (7 tests);
- one asserting `good.json` produces zero errors (1 test).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-kit/lint-cutlist.test.mjs 2>&1 | grep -q "^# pass 15"` -> exit 0 (a higher count is fine; adjust the grep to the real number and record it in Done criteria).

**Then prove the gate fires**:

```bash
cd pipelines/video/visuals-flow
perl -0pi -e 's/AVATAR_MAX_SHARE = 0\.55/AVATAR_MAX_SHARE = 1.01/' lib/intro-kit/lint-cutlist.mjs
node --test lib/intro-kit/lint-cutlist.test.mjs   # MUST fail, printing S1
git checkout lib/intro-kit/lint-cutlist.mjs
node --test lib/intro-kit/lint-cutlist.test.mjs   # MUST pass again
```

### Step 3: the renderer

Write `lib/intro-kit/render-simple.mjs`. It:

1. reads `intro-simple/cutlist.json`, the kit registry, and `introSpan(workdir)`;
2. refuses to run if `lintCutlist` returns any error (print them, exit non-zero) —
   rendering an unlinted cut list is how a bad intro reaches the owner;
3. renders each `card` and `overlay` beat via the SAME staging approach as
   `lib/render.mjs` (copy `hyperframes.json`, `meta.json` and `cards/<slug>/` from
   `pipelines/video/intro-kit/` into a temp dir, write `vars.json`, invoke the
   hyperframes CLI, `rewriteDuration` to the beat length), through `runPool` with
   `DEFAULT_JOBS`, cached by `hashRenderInputs`;
4. cuts the timeline with ffmpeg into `intro-film/out/intro.mp4`:
   - `avatar` beats: the matching slice of `avatar.mp4` (or the stand-in before 430),
   - `card` beats: the rendered card clip, replacing the presenter entirely,
   - `overlay` beats: the card composited over the avatar slice with
     `overlay=0:0:format=auto` (the card's background is transparent),
   - transitions: a **2-frame white flash** between adjacent beats of different
     `kind`. That is the reference videos' transition and it is the only one this
     flow uses. No crossfades, no blurs.
5. writes `intro-simple/render.json` recording each beat's clip path and duration.

**Prefer refactoring `lib/render.mjs` to accept a `libraryRoot` parameter over
copy-pasting its staging block.** If its internals make that impossible without
touching complex-flow behaviour, duplicate the ~8 staging lines with a comment
naming the original, and say so in your report — a silent copy is a maintenance trap.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-kit/render-simple.test.mjs` -> exit 0. The test must include a full fixture render whose output ffprobe duration is within 0.15s of the fixture span's length.

### Step 4: mode-aware approval

Edit `lib/intro-film/approve.mjs`. Keep the existing behaviour EXACTLY for complex;
add the simple branch:

```js
import { introMode } from '../intro-modes.mjs';

// Which file carries the intro's approval flag, per flow. Both flows render to
// intro-film/out/intro.mp4 — that path is deliberately shared so assemble.mjs and
// export-timeline.mjs never learn about modes. Only the APPROVAL artifact differs.
const APPROVAL_FILE = {
  complex: ['intro-film', 'screenplay.json'],
  simple: ['intro-simple', 'cutlist.json'],
};

export function requireIntroApproved(workdir) {
  const mode = introMode(workdir);
  const p = path.join(workdir, ...APPROVAL_FILE[mode]);
  if (!fs.existsSync(p)) {
    throw new Error(`missing ${p} — author the ${mode} intro first`);
  }
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!intro.approved) {
    throw new Error(
      `intro (${mode}) is not approved — it must not go into the cut until the owner ` +
      'has watched it. Open the board, play it on the Intro tab, and approve there. ' +
      'Re-rendering after feedback needs no approval.'
    );
  }
}
```

`approveIntro(workdir, opts)` gets the same `APPROVAL_FILE` treatment.

Add tests to the existing `lib/intro-film/approve.test.mjs` if it exists, else create
one: a complex workdir gates on `screenplay.json`, a simple workdir gates on
`cutlist.json`, and each throws a message naming its own mode.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-film/approve.test.mjs` -> exit 0.

**Note**: `lib/intro-film/no-template-contamination.test.mjs` asserts no file in
`lib/intro-film/*.mjs` mentions `catalog.json`, `card-plan.json` or `cues.json`.
This edit mentions none of them, so it stays green. Do not add a kit-catalog
reference to this file — put any such logic in `lib/intro-kit/`.

### Step 5: the four step folders

Create each with `step.json` + `README.md`. All four carry `"modes": ["simple"]`.

`115-author-intro-simple-llm` — `track: "intro"`, `actor: "llm"`,
verb `intro-simple`, consumes `transcript.json`, `segments.json`, `concept.json`,
produces `intro-simple/cutlist.json`.

`125-approve-intro-simple-human` — `track: "intro"`, `actor: "human"`, no verbs,
`gate: { file: "intro-simple/cutlist.json", field: "approved", label: "Intro (simple)" }`,
`tab: "intro"`, with a `nextHint` naming the board.

`135-render-intro-simple-run` — `track: "intro"`, `actor: "run"`, verb
`intro-simple-render`, consumes `intro-simple/cutlist.json`, produces
`intro-film/out/intro.mp4`.

`445-rerender-intro-simple-run` — `track: "main"`, `actor: "run"`, verb
`intro-simple-rerender`, consumes `avatar.mp4` + `intro-simple/cutlist.json`,
produces `intro-film/out/intro.mp4`. Mirrors `440` for the complex flow: the intro
approved at 125 was cut against a stand-in avatar; this is the encode that ships.

Then regenerate the table: `node scripts/gen-pipeline-table.mjs`.

**Verify**: `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` -> exit 0, and `node --test lib/intro-mode-switch.test.mjs` (from plan 218) still passes.

### Step 6: `SIMPLE-PASS.md` — the authoring rulebook

Write `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`. This file is what replaces
"full creative freedom", so it must be blunt. It must state:

- **Your only output is `intro-simple/cutlist.json`.** You do not write HTML, you do
  not design a card, you do not propose directions, and you do not invent a visual
  idea. If the kit cannot express a beat, use `statement` — it always works.
- The 7 cards and what each is FOR, as a table (copy from `intro-kit/KIT.md`; do not
  restate their internals).
- Read `intro-kit/kit.json` for each card's required variables. It is the schema.
- The pacing targets, stated as the numbers the lint enforces: avatar share
  `<= 55%`, no avatar hold over `5s`, every beat `1.5-4.0s`. Author to these, do
  not discover them by failing the lint.
- **Every word you put on screen comes from `transcript.json`.** Use `introWords()`
  from `lib/intro-kit/inputs.mjs`. Never type a product name from memory — the
  standalone POC put four of five wrong ("Hejian", "Arcad", "Open Art",
  "Higgs Field") and `S7` exists to catch exactly that.
- The card's `beats[]` word times are transcript times rebased to the beat's start.
- **There is no continuity requirement.** Unlike the complex flow, a card does not
  carry an object from an earlier card. Each beat is independent and disposable.
  Reusing the same card three times in a row is CORRECT, not lazy — the reference
  video `kO3WtZmDb_A` does exactly that.
- Then run `bash run.sh <slug> intro-simple-render` and read the lint output.

Also write `README.md` for the step: in/out table, the verb, what consumes the output.

**Verify**: `test -s pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/SIMPLE-PASS.md` and it contains the strings `cutlist.json`, `S7`, `no continuity` (case-insensitive) -> exit 0.

### Step 7: the run.sh verbs

**A verb is declared in exactly ONE place, and the registry enforces it.**
`lib/steps.test.mjs:71` fails with `_verbs.json declares "<v>", which step <n>
already owns` if a verb appears in both, and `steps/_verbs.json` holds *only*
non-step commands (`kind` is one of the `VERB_KINDS`: meta / helper / composite).
So the four verbs split two ways:

**Three are STEP verbs** — declared in the `verbs` array of the `step.json` you
already wrote in Step 5, and NOT in `_verbs.json`:

| Verb | Owned by | Does |
|---|---|---|
| `intro-simple` | `115-author-intro-simple-llm` | cats `SIMPLE-PASS.md` (the authoring contract) |
| `intro-simple-render` | `135-render-intro-simple-run` | runs `render-simple.mjs` |
| `intro-simple-rerender` | `445-rerender-intro-simple-run` | the same, requiring the real `avatar.mp4` |

**One is a HELPER** — it runs no step and produces no artifact, so it belongs in
`steps/_verbs.json`. Add this entry, matching the shape of the existing
`intro-teasers` entry:

```json
  "intro-simple-lint": {
    "kind": "helper",
    "after": "intro-simple",
    "summary": "prints the S1-S7 pacing report for intro-simple/cutlist.json without rendering anything — the cheap check before a render"
  }
```

Then add a `run.sh` branch for each of the four, following the existing
`intro-idea|intro-film|intro-review|intro-render)` branch pattern. `run.sh:561`
already fails loudly for a verb that is declared in the registry with no branch to
run it, so all four need branches.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh && node --test lib/steps.test.mjs` -> both exit 0.

### Step 8: full gate on a fresh tree

```bash
cd pipelines/video/visuals-flow
git clean -xdn .
bash scripts/check.sh
```

**Verify**: exit 0, prints `visuals-flow check OK`.

## Test plan

- `lib/intro-kit/lint-cutlist.test.mjs` — 15+ tests, one pass and one fail per code.
  Mutation-proven on `S1`.
- `lib/intro-kit/render-simple.test.mjs` — schema refusal on a bad cut list, plus one
  end-to-end fixture render with an ffprobe duration assertion.
- `lib/intro-film/approve.test.mjs` — the mode-aware gate, both branches.
- Plan 218's `lib/intro-mode-switch.test.mjs` must still pass: add a case asserting
  the four new steps carry `modes: ["simple"]` and that a `complex` video never parks
  on 115/125/135.
- `scripts/check.sh` on a fresh, `git clean`-ed tree (LESSONS 2026-07-31: crews
  verify in worktrees carrying their own artifacts).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`.
- [ ] `test -f pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.mjs` and its test file reports at least 15 passing tests: `node --test lib/intro-kit/lint-cutlist.test.mjs 2>&1 | grep -qE "^# pass ([2-9][0-9]|1[5-9])"`.
- [ ] All seven lint codes are reachable: `for c in S1 S2 S3 S4 S5 S6 S7; do grep -q "$c" lib/intro-kit/lint-cutlist.mjs || { echo "missing $c"; exit 1; }; done` exits 0.
- [ ] The four new step folders exist and each `step.json` contains `"simple"`: `for n in 115 125 135 445; do grep -q '"simple"' steps/$n-*/step.json || exit 1; done` exits 0.
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0.
- [ ] An end-to-end fixture render produces an mp4 whose ffprobe duration is within 0.15s of the fixture span length.
- [ ] Mutation proof: raising `AVATAR_MAX_SHARE` to `1.01` makes `node --test lib/intro-kit/lint-cutlist.test.mjs` FAIL printing `S1`; reverting passes.
- [ ] `SIMPLE-PASS.md` exists and contains `cutlist.json`, `S7`, and a statement that there is no continuity requirement.
- [ ] The complex flow is untouched beyond the two named shared files: `git diff --name-only 20a2ae62..HEAD | grep -E 'steps/(1[1-6]0|440)-' | grep -v 'step.json$'` prints nothing, and `git diff --name-only 20a2ae62..HEAD | grep 'lib/intro-film/' | grep -v 'approve' | grep -v 'approve.test'` prints nothing.
- [ ] Punt-marker sweep is clean: `git diff 20a2ae62..HEAD | grep -nEi '(^\+.*)(TODO|FIXME|for now|we can.?t easily|let.?s just|actually,|wait,)'` prints nothing.

## STOP conditions

- **Gate integrity**: if a lint test fails, fix the LINT or the FIXTURE. Raising a
  threshold, adding an exemption, or deleting an assertion is a STOP — report.
- If a kit card from plan 219 renders wrong or is missing a variable this flow needs,
  STOP and report. Do not edit `pipelines/video/intro-kit/`.
- If `requireIntroApproved` cannot be made mode-aware without changing complex-flow
  behaviour, STOP. That gate protects the cut on every existing video.
- If `lib/render.mjs` cannot be parameterised by library root without touching how
  the body pipeline renders, do NOT refactor it — duplicate the staging lines,
  comment the duplication, and report it.
- If `no-template-contamination.test.mjs` fails, STOP. It means kit logic leaked into
  `lib/intro-film/`; move it to `lib/intro-kit/` rather than editing that test.
- Do NOT touch the board, `board-ui/`, `TASTE-INTRO.md` or the skill — plan 221.
- Do NOT add an 8th card, a second transition type, or an eighth lint code without
  reporting first.

## Maintenance notes

- **`intro-film/out/intro.mp4` is shared by both flows on purpose.** Two consumers
  (`assemble.mjs` lines 728 and 1175, plus `export-timeline.mjs`) hardcode it. A
  rename is a four-file change, not a two-file one.
- The lint thresholds are the encoded reference measurements. Changing one is an
  owner decision for `decisions.md`, not a session's tuning.
- `S7` is the expensive check (it needs the transcript). If it ever gets slow, cache
  the word index — do not make it advisory.
- The `overlay` kind counts as avatar time in `S1`. If plan 219's kit ever gains a
  second overlay card, `S1` needs no change, but `kit.json`'s `overlay` flag becomes
  load-bearing for more than one card — worth a test.
- Plan 221 (board tab + skill docs) depends on this plan's step numbers and gate
  file paths. Do not renumber 115/125/135/445 after this lands.
