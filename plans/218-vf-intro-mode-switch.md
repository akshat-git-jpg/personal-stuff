---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/run-config.mjs, pipelines/video/visuals-flow/lib/intro-modes.mjs, pipelines/video/visuals-flow/lib/steps.mjs, pipelines/video/visuals-flow/lib/intro-invariants.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/PIPELINE.md, pipelines/video/visuals-flow/steps/110-propose-intro-idea-llm/step.json, pipelines/video/visuals-flow/steps/120-approve-intro-idea-human/step.json, pipelines/video/visuals-flow/steps/130-author-intro-screenplay-llm/step.json, pipelines/video/visuals-flow/steps/140-review-intro-frames-run/step.json, pipelines/video/visuals-flow/steps/150-approve-intro-film-human/step.json, pipelines/video/visuals-flow/steps/160-render-intro-film-run/step.json, decisions.md]

mutation_apply: perl -0pi -e 's/    if \(!stepInMode\(s, mode\)\) continue;\n//' pipelines/video/visuals-flow/lib/steps.mjs
mutation_command: node --test lib/intro-mode-switch.test.mjs
mutation_expect: INTRO-MODE
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 300
---

# Plan 218: visuals-flow — introMode switch (simple | complex)

## Summary

- **Problem statement**: every video's intro is forced through the bespoke intro-film
  flow (steps 110-160). The owner wants to choose per video: `simple` (a fast,
  locked-kit intro, built by plans 219+220) or `complex` (today's bespoke film,
  unchanged). Today no such switch exists — `lib/run-config.mjs:26` actively
  DELETES any `intro` key, and `lib/intro-invariants.test.mjs` asserts that no
  run-config knob can ever select an intro flow.
- **Goals**:
  - Add an `introMode` field to `run-config.json`, set at step 010 via
    `run.sh <slug> configure --intro simple|complex`. Default `simple`.
  - Add a `modes` field to the step registry (`steps/*/step.json`) and make
    `nextStep()` skip steps that do not belong to the video's current mode.
  - Tag steps 110-160 as `modes: ["complex"]` so a `simple` video never parks on them.
  - Replace the one `intro-invariants` assertion that forbids the knob, keeping
    every other INTRO-ALWAYS-FILM invariant that is still true.
  - Record the owner's reversal of the 2026-08-07 "film only" decision in `decisions.md`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully-inlined mechanical
  registry + config work, agy's strongest lane (LESSONS 2026-07-09).
- **Done criteria** (terse — full list below): `bash scripts/check.sh` green;
  a new `lib/intro-mode-switch.test.mjs` proves a `simple` video's intro track
  skips 110-160 and a `complex` video still parks on 110.
- **Stop conditions** (terse — full list below): do NOT touch any file under
  `steps/1[1-6]0-*/` other than its `step.json`; do NOT weaken an assertion to
  pass a gate; do NOT create any simple-mode step or card (plans 219/220).
- **Test / verification for success**: `node --test` unit tests on the registry +
  config resolution, plus the repo gate `bash scripts/check.sh`. Mutation-gated:
  removing the mode filter must fail the new test with `INTRO-MODE`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 20a2ae62..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/run.sh`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none — this is the first plan of the 218/219/220 chain
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `20a2ae62`, 2026-08-22

## Why this matters

The owner's words, this session: *"I don't want to delete my current intro flow.
I want to switch it in such a way that I can decide which intro flow I want to
do. If I say simple then this flow should run if I say complex then the older
flow should run."*

The reason a simple flow is wanted at all: *"currently intro has full creative
freedom and takes too much time and always tries to make motion graphics from a
new angle.. but this was never my use case."*

This plan builds ONLY the switch. It adds no new intro flow — after this plan,
`introMode: "simple"` is a valid, persisted, registry-honoured mode whose steps
do not exist yet, so a simple video's intro track reports "satisfied" and the
main track runs normally. Plans 219 and 220 then fill the simple lane in. Doing
the switch first means the bespoke flow is never touched by the risky work: its
step folders, its libs, its rulebooks and its tests all stay byte-identical
except for one added `modes` key per `step.json`.

This intentionally reverses a prior owner decision. Plan 194 (2026-08-07) deleted
the `intro: "cards" | "film"` run-config field on the owner's instruction *"i want
film only.., basically intro is bespook"*. The owner has now re-decided. Step 6
records the reversal in `decisions.md` so a future session does not "fix" this
plan by re-deleting the switch.

## Current state

### The field is actively stripped today

`pipelines/video/visuals-flow/lib/run-config.mjs` (lines 19-30, verbatim):

```js
const DEFAULTS = {};

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  delete cfg.intro;
  delete cfg.review;
  delete cfg.engine;
  return cfg;
}
```

Its `main()` accepts only `--drive-folder` and `--drive-account`:

```js
    if (a === '--drive-folder') cfg.drive_folder = rest.shift();
    else if (a === '--drive-account') cfg.drive_account = rest.shift();
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
```

**Keep `delete cfg.intro`.** The legacy `intro` key meant `"cards" | "film"` — a
different vocabulary with a different (deleted) card-based flow behind it. Honouring
a stale `intro: "cards"` from an old video would select a flow that does not exist.
The new field is a NEW name, `introMode`, with values `simple | complex`.

### `lib/intro-modes.mjs` in full (25 lines, the whole file)

```js
import fs from 'node:fs';
import path from 'node:path';

// The intro is ALWAYS the bespoke intro film (owner decision 2026-08-07:
// "i want film only.., basically intro is bespook"). There is no mode to pick,
// so there is no capability query any more — this module answers the one
// question that survives the choice: WHERE is the intro?
//
// This replaced lib/intro-mode-table.mjs + ownsIntroSpan(). ...
//
// Returns null when segments.json has not been written yet, or carries no
// intro part. Callers treat null as "not measured yet", never as "no film".
export function introSpan(workdir) {
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
```

### How a step parks the track — `lib/steps.mjs`

`nextStep()` and `firstUnsatisfied()`, verbatim:

```js
export function nextStep({ steps = null, exists, readFlag } = {}) {
  const all = steps ?? loadSteps();
  const out = {};
  for (const track of TRACKS) {
    out[track] = firstUnsatisfied(all.filter((s) => s.track === track), exists, readFlag);
  }
  return out;
}

function firstUnsatisfied(steps, exists, readFlag) {
  for (const s of steps) {
    if (s.optional) continue;
    if (!s.external && s.produces.length && !s.produces.every((f) => exists(f))) return s;
    if (s.gate && !readFlag(s.gate.file, s.gate.field)) return s;
  }
  return null;
}
```

**This is the whole mechanism.** A step parks the track when its `produces`
artifacts are absent or its `gate` field is false. So without a mode filter, a
`simple` video parks forever on `110-propose-intro-idea-llm` waiting for
`intro-film/idea.json`. Adding the filter here is the single change that makes
the switch real.

Note the existing precedent: `if (s.optional) continue;` — `modes` follows the
exact same shape, one line above it.

The schema validator that must learn the new key (`lib/steps.mjs`, ~line 109):

```js
  for (const k of ['external', 'optional']) {
```

### The step folders to tag (six `step.json` files, `track: "intro"`)

| Step folder | Currently |
|---|---|
| `steps/110-propose-intro-idea-llm` | `"track": "intro"`, produces `intro-film/idea.json` |
| `steps/120-approve-intro-idea-human` | gate on `intro-film/idea.json` field `approved` |
| `steps/130-author-intro-screenplay-llm` | produces `intro-film/screenplay.json` |
| `steps/140-review-intro-frames-run` | produces `intro-film/review/REVIEW.md` |
| `steps/150-approve-intro-film-human` | gate on `intro-film/screenplay.json` field `approved` |
| `steps/160-render-intro-film-run` | produces `intro-film/out/intro.mp4` |

`steps/440-rerender-intro-film-run` is `track: "main"` and ALSO belongs to the
complex flow only — tag it too.

### The test that forbids the switch

`lib/intro-invariants.test.mjs`, final test, verbatim:

```js
test('INTRO-ALWAYS-FILM: no run-config knob can turn the film off', async () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards', review: 'express' }));
  const m = await import('./run-config.mjs');
  const cfg = m.loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-ALWAYS-FILM: run-config must not resolve an `intro` mode — stale keys in old videos are ignored, never honoured');
  assert.equal('gateWaived' in m, false,
    'INTRO-ALWAYS-FILM: express review is gone — gateWaived must not exist');
  fs.rmSync(w, { recursive: true, force: true });
});
```

The two assertions inside it are still BOTH correct and must survive: the legacy
`intro` key stays ignored, and `gateWaived` stays gone. Only the test's NAME and
its comment are now misleading. Do not delete this test.

The other four tests in that file assert `ZONE_PARTS === ['conclusion']`, that E13
open-cover never fires, and `introSpan()` behaviour. **All four stay exactly as
they are** — this plan does not change the zone passes or the span helper, and the
simple flow (plan 219) will own the intro span the same way the film does.

### Conventions to match

- Node ESM `.mjs`, 2-space indent, `node:test` + `node:assert/strict`.
- Every new assertion message carries a grep-able tag. The file's existing tag is
  `INTRO-ALWAYS-FILM`; this plan's new tag is `INTRO-MODE`.
- Exemplar test file to imitate: `lib/intro-invariants.test.mjs` (read above).
- Exemplar registry-consumer: `lib/steps.mjs` `firstUnsatisfied()`.
- Long "why" comments above non-obvious code are the house style. Keep them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo gate (the merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, prints `visuals-flow check OK` |
| Registry + doc consistency | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exit 0 |
| Regenerate PIPELINE.md table | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs` | rewrites the table in PIPELINE.md |
| Run one test file | `cd pipelines/video/visuals-flow && node --test lib/intro-mode-switch.test.mjs` | exit 0 |
| Run the invariants file | `cd pipelines/video/visuals-flow && node --test lib/intro-invariants.test.mjs` | exit 0, 5 tests pass |
| run.sh verb smoke | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | exit 0 |

**Never write `node --test <dir>`** — on node 22.14 a directory argument fails with
`Cannot find module '.../test'` (LESSONS 2026-07-09). Always name a file.

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow/lib/run-config.mjs`
- `pipelines/video/visuals-flow/lib/intro-modes.mjs`
- `pipelines/video/visuals-flow/lib/steps.mjs`
- `pipelines/video/visuals-flow/lib/intro-invariants.test.mjs`
- `pipelines/video/visuals-flow/lib/intro-mode-switch.test.mjs` (NEW)
- `pipelines/video/visuals-flow/lib/run-config.test.mjs`
- `pipelines/video/visuals-flow/lib/steps.test.mjs`
- `pipelines/video/visuals-flow/run.sh`
- `pipelines/video/visuals-flow/PIPELINE.md` (regenerated, not hand-edited)
- `step.json` ONLY, in: `steps/110-propose-intro-idea-llm/`,
  `steps/120-approve-intro-idea-human/`, `steps/130-author-intro-screenplay-llm/`,
  `steps/140-review-intro-frames-run/`, `steps/150-approve-intro-film-human/`,
  `steps/160-render-intro-film-run/`, `steps/440-rerender-intro-film-run/`
- `decisions.md` (repo root) — one appended entry
- `plans/README.md` — the status row for this plan

**Out of scope** (looks related, do not touch, because…):
- Any `README.md`, `AUTHORING.md`, `IDEA-PASS.md` or other prose inside
  `steps/1[1-6]0-*/` — the complex flow's authoring contract is unchanged by this
  plan, and `lib/intro-film/no-template-contamination.test.mjs` scans that folder
  and will fail on unrelated edits.
- Everything under `lib/intro-film/` — the complex flow's libraries. Untouched.
- `lib/zone-constants.mjs` / `ZONE_PARTS` — the simple flow will own the intro span
  the same way the film does, so the zone passes still author the conclusion only.
- `lib/assemble.mjs`, `lib/export-timeline.mjs`, `lib/intro-film/approve.mjs` —
  plan 219 makes the approval gate mode-aware; do not pre-empt it here.
- `lib/board.mjs` and `board-ui/` — plan 220 owns the board.
- `TASTE-INTRO.md`, `pipelines/.claude/skills/yt-video-edit/SKILL.md` — plan 220.
- Any new card, kit folder, or simple-mode step — plan 219.

## Git workflow

- Branch: `advisor/218-vf-intro-mode-switch`
- Commit per step, message form: `feat(vf): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: teach `run-config.mjs` the `introMode` field

Edit `lib/run-config.mjs`.

Add above `loadRunConfig`:

```js
// The two intro flows. `simple` (plans 218-220) drives a locked kit of cards from a
// cut list; `complex` is the bespoke intro film (steps 110-160) that was the only
// flow between 2026-08-07 and 2026-08-22. Default is `simple` (owner, 2026-08-22):
// the fast path is the one you get without asking for it.
//
// This is NOT the legacy `intro: "cards" | "film"` key that plan 194 deleted. That
// vocabulary named a card flow that no longer exists, so a stale `intro` on an old
// video is still stripped below — honouring it would select a missing flow.
export const INTRO_MODES = ['simple', 'complex'];
export const DEFAULT_INTRO_MODE = 'simple';
```

Change `DEFAULTS` and `loadRunConfig`:

```js
const DEFAULTS = { introMode: DEFAULT_INTRO_MODE };

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  delete cfg.intro;
  delete cfg.review;
  delete cfg.engine;
  // An unrecognised introMode is a typo, not a third flow. Falling back silently
  // would run the default flow while run-config.json claims something else.
  if (!INTRO_MODES.includes(cfg.introMode)) {
    throw new Error(
      `run-config.json has introMode "${cfg.introMode}" — must be one of: ${INTRO_MODES.join(' | ')}`
    );
  }
  return cfg;
}
```

In `main()`, add the argument (keep the existing two):

```js
    else if (a === '--intro') {
      const v = rest.shift();
      if (!INTRO_MODES.includes(v)) {
        console.error(`--intro must be one of: ${INTRO_MODES.join(' | ')} (got "${v}")`);
        process.exit(1);
      }
      cfg.introMode = v;
    }
```

Update the usage string on line 36 to:

```js
    console.error('usage: node lib/run-config.mjs <slug> [--intro simple|complex] [--drive-folder <id>] [--drive-account <email>]');
```

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/run-config.test.mjs` -> exit 0.

### Step 2: add `introMode(workdir)` to `lib/intro-modes.mjs`

Append to `lib/intro-modes.mjs` (keep `introSpan` exactly as it is) and replace the
now-wrong file header comment claiming there is no mode to pick:

```js
import { loadRunConfig } from './run-config.mjs';

// WHICH intro flow this video runs. `introSpan()` above answers WHERE the intro is;
// this answers HOW it gets built. Both flows own the same span and both produce
// intro-film/out/intro.mp4, so every consumer downstream of the render is
// mode-blind by construction.
export function introMode(workdir) {
  return loadRunConfig(workdir).introMode;
}
```

Replace the file's opening comment block (the one beginning "The intro is ALWAYS
the bespoke intro film") with:

```js
// Two questions about a video's intro, and nothing else:
//   introSpan(workdir) — WHERE is the intro? (measured, from segments.json)
//   introMode(workdir) — WHICH flow builds it? (simple | complex, from run-config)
//
// History: between 2026-08-07 (plan 194) and 2026-08-22 there was only one flow,
// the bespoke film, so this module held introSpan() alone. The owner restored the
// choice on 2026-08-22 — see decisions.md. The legacy `intro: "cards" | "film"`
// key is NOT what came back; `introMode: simple | complex` is a new vocabulary
// over two flows that both exist. See lib/run-config.mjs.
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/intro-modes.mjs').then(m=>console.log(typeof m.introMode, typeof m.introSpan))"` -> prints `function function`.

### Step 3: add `modes` to the step registry and filter on it

Edit `lib/steps.mjs`.

3a. Teach the schema validator the new key. The array on ~line 109 becomes:

```js
  for (const k of ['external', 'optional']) {
```

…unchanged (those two are booleans). Add a SEPARATE block after it, because `modes`
is an array of strings, not a boolean:

```js
  // `modes` — which intro flows this step belongs to. ABSENT means "every mode",
  // which is what almost every step is; only the two intro lanes declare it.
  // A step out of the video's mode is skipped by firstUnsatisfied(), so a simple
  // video does not park forever waiting for intro-film/idea.json.
  if ('modes' in raw) {
    if (!Array.isArray(raw.modes) || raw.modes.length === 0
        || !raw.modes.every((m) => INTRO_MODES.includes(m))) {
      die(`modes, when present, must be a non-empty array of: ${INTRO_MODES.join(' | ')}`);
    }
    step.modes = raw.modes;
  }
```

Import `INTRO_MODES` at the top of `lib/steps.mjs`:

```js
import { INTRO_MODES } from './run-config.mjs';
```

3b. Add the predicate and thread a `mode` through `nextStep`:

```js
// A step with no `modes` runs in every mode. This default is what keeps the
// registry quiet: only the intro lanes declare a mode.
export function stepInMode(step, mode) {
  return !step.modes || step.modes.includes(mode);
}

export function nextStep({ steps = null, exists, readFlag, mode = DEFAULT_INTRO_MODE } = {}) {
  const all = steps ?? loadSteps();
  const out = {};
  for (const track of TRACKS) {
    out[track] = firstUnsatisfied(all.filter((s) => s.track === track), exists, readFlag, mode);
  }
  return out;
}

function firstUnsatisfied(steps, exists, readFlag, mode) {
  for (const s of steps) {
    if (!stepInMode(s, mode)) continue;
    if (s.optional) continue;
    if (!s.external && s.produces.length && !s.produces.every((f) => exists(f))) return s;
    if (s.gate && !readFlag(s.gate.file, s.gate.field)) return s;
  }
  return null;
}
```

Import `DEFAULT_INTRO_MODE` alongside `INTRO_MODES`.

**The `if (!stepInMode(s, mode)) continue;` line must come FIRST**, before the
`optional` check — an out-of-mode step is not merely optional, it is not part of
this video at all.

3c. Every existing caller of `nextStep()` must pass the video's mode. Find them:

```bash
cd pipelines/video/visuals-flow && grep -rn "nextStep(" lib/*.mjs run.sh scripts/*.mjs | grep -v "steps.mjs"
```

For each call site that has a `workdir` in hand, pass `mode: introMode(workdir)`.
A call site with no workdir (pure unit tests) keeps the default.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/steps.test.mjs` -> exit 0.

### Step 4: tag the complex-flow steps

Add `"modes": ["complex"]` to each of these seven `step.json` files, as the last key
before the closing brace, keeping every existing key byte-identical:

- `steps/110-propose-intro-idea-llm/step.json`
- `steps/120-approve-intro-idea-human/step.json`
- `steps/130-author-intro-screenplay-llm/step.json`
- `steps/140-review-intro-frames-run/step.json`
- `steps/150-approve-intro-film-human/step.json`
- `steps/160-render-intro-film-run/step.json`
- `steps/440-rerender-intro-film-run/step.json`

Then regenerate the doc table:

```bash
cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs
```

**Verify**: `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` -> exit 0.

### Step 5: write `lib/intro-mode-switch.test.mjs` (the gate)

New file. Every assertion message starts with `INTRO-MODE`. This is the test the
mutation recipe attacks, so it must fail if the mode filter is removed.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSteps, nextStep, stepInMode } from './steps.mjs';
import { loadRunConfig, INTRO_MODES, DEFAULT_INTRO_MODE } from './run-config.mjs';

// The introMode switch (plan 218). Tag: INTRO-MODE.
//
// The load-bearing claim is narrow and mechanical: a `simple` video's intro track
// must not park on a complex-flow step. Before the mode filter existed, a simple
// video waited forever on 110-propose-intro-idea-llm for an idea.json nothing
// would ever write.

function tmpWorkdir(cfg) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-mode-'));
  if (cfg) fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify(cfg));
  return w;
}

// Nothing produced yet, no gate passed — the worst case for parking.
const emptyProbes = { exists: () => false, readFlag: () => false };

const COMPLEX_ONLY = ['110', '120', '130', '140', '150', '160', '440'];

test('INTRO-MODE: the seven complex-flow steps declare modes: ["complex"]', () => {
  const steps = loadSteps();
  for (const n of COMPLEX_ONLY) {
    const s = steps.find((x) => x.number === n);
    assert.ok(s, `INTRO-MODE: step ${n} must exist in the registry`);
    assert.deepEqual(s.modes, ['complex'],
      `INTRO-MODE: step ${n} must be tagged modes: ["complex"], got ${JSON.stringify(s.modes)}`);
  }
});

test('INTRO-MODE: a simple video never parks on a complex-flow step', () => {
  const next = nextStep({ ...emptyProbes, mode: 'simple' });
  for (const track of Object.keys(next)) {
    const step = next[track];
    if (!step) continue;
    assert.ok(!COMPLEX_ONLY.includes(step.number),
      `INTRO-MODE: mode "simple" parked the ${track} track on complex-only step ${step.number} ${step.slug} — the mode filter in firstUnsatisfied() is not being applied`);
  }
});

test('INTRO-MODE: a complex video still parks on 110 exactly as before', () => {
  const next = nextStep({ ...emptyProbes, mode: 'complex' });
  assert.equal(next.intro?.number, '110',
    `INTRO-MODE: mode "complex" must still park the intro track on 110 — the bespoke flow is unchanged, got ${next.intro?.number}`);
});

test('INTRO-MODE: an untagged step runs in every mode', () => {
  for (const mode of INTRO_MODES) {
    assert.equal(stepInMode({ number: '210' }, mode), true,
      `INTRO-MODE: a step with no modes key must run in mode "${mode}"`);
  }
});

test('INTRO-MODE: the default mode is simple, and no run-config means simple', () => {
  assert.equal(DEFAULT_INTRO_MODE, 'simple',
    'INTRO-MODE: the owner chose simple as the default (2026-08-22)');
  const w = tmpWorkdir(null);
  assert.equal(loadRunConfig(w).introMode, 'simple',
    'INTRO-MODE: an unconfigured video is simple');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: configure --intro complex is honoured', () => {
  const w = tmpWorkdir({ introMode: 'complex' });
  assert.equal(loadRunConfig(w).introMode, 'complex',
    'INTRO-MODE: an explicit complex must survive loadRunConfig');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: a typo in introMode throws rather than silently defaulting', () => {
  const w = tmpWorkdir({ introMode: 'simpel' });
  assert.throws(() => loadRunConfig(w), /introMode "simpel"/,
    'INTRO-MODE: an unrecognised mode must throw — a silent fallback runs a flow the config does not claim');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: the legacy intro key is still stripped, never honoured', () => {
  const w = tmpWorkdir({ intro: 'cards', introMode: 'simple' });
  const cfg = loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-MODE: the plan-194 `intro` key named a deleted card flow — it stays ignored');
  fs.rmSync(w, { recursive: true, force: true });
});
```

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-mode-switch.test.mjs` -> exit 0, 8 tests pass.

**Then prove the gate can fire** (this is the mutation recipe; run it by hand now):

```bash
cd pipelines/video/visuals-flow
perl -0pi -e 's/    if \(!stepInMode\(s, mode\)\) continue;\n//' lib/steps.mjs
node --test lib/intro-mode-switch.test.mjs   # MUST fail, printing INTRO-MODE
git checkout lib/steps.mjs
node --test lib/intro-mode-switch.test.mjs   # MUST pass again
```

If the mutated run PASSES, the test is not actually gating the filter — fix the
test, do not proceed.

### Step 6: rename the invariant test and record the decision

6a. In `lib/intro-invariants.test.mjs`, rename ONLY the last test and its comment.
Keep both assertions:

```js
test('INTRO-MODE: the legacy intro/review knobs stay dead', async () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards', review: 'express' }));
  const m = await import('./run-config.mjs');
  const cfg = m.loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-MODE: the plan-194 `intro` key named a card flow that no longer exists — stale keys stay ignored. The live switch is `introMode` (simple|complex), see lib/run-config.mjs.');
  assert.equal('gateWaived' in m, false,
    'INTRO-MODE: express review is gone — gateWaived must not exist');
  fs.rmSync(w, { recursive: true, force: true });
});
```

Also update the file's header comment: the line "the intro is ALWAYS the bespoke
film" is no longer true. Replace with:

```js
// The invariants that survive the introMode switch (plan 218). The intro span is
// owned by the intro flow — EITHER flow — so the cue passes still author the
// conclusion only and E13 open-cover still never fires. What changed on
// 2026-08-22 is only WHICH flow builds the intro; that nothing else in the
// pipeline touches the intro span is exactly what these tests hold.
```

Leave the four other tests untouched.

6b. Append to `decisions.md` (repo root), at the end of the file:

```markdown
## 2026-08-22 — the intro has two flows again: `introMode: simple | complex`

Plan 194 (2026-08-07) deleted the intro-mode choice on the owner's instruction
*"i want film only.., basically intro is bespook"*. The owner reversed that today
after reviewing four reference intros (`_1gFEbL4LdA`, `nf5PUM0cg6k`,
`VQ9R05DqL04`, `kO3WtZmDb_A`):

> "currently intro has full creative freedom and takes too much time and always
> tries to make motion graphics from a new angle.. but this was never my use
> case" … "I don't want to delete my current intro flow. I want to switch it in
> such a way that I can decide which intro flow I want to do."

So the bespoke film is KEPT, unchanged, as `introMode: "complex"`, and a new
locked-kit flow ships as `introMode: "simple"` — the default. What the references
actually share, measured: something new on screen every ~2s, the avatar alone
under ~50% of the intro, one accent colour on near-black, and a fixed kit of ~7
card types reused rather than a fresh idea per video.

Mechanics: `introMode` in `run-config.json` (set at 010 by
`run.sh <slug> configure --intro simple|complex`), a `modes` key on
`steps/*/step.json`, and a mode filter in `lib/steps.mjs` `firstUnsatisfied()`.
The legacy `intro: "cards"|"film"` key stays stripped — it named a deleted flow,
and `introMode` is a new vocabulary over two flows that both exist.

Do NOT "simplify" this back to one flow. Both flows are wanted: plans 218-220.
```

6c. Add the plan's row to `plans/README.md` with status `TODO` (and set it `DONE`
when this plan finishes).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-invariants.test.mjs` -> exit 0, 5 tests pass.

### Step 7: expose the switch on `run.sh` and in status output

7a. `run.sh`'s `configure)` branch already forwards `"$@"` to `lib/run-config.mjs`,
so `--intro` works with no change. Update the comment above it to mention the flag.

7b. Make `status` print the mode, so an owner can always see which flow a video is
on. Find the status branch and add a line before the `next:` output, of the form:

```
intro flow: simple   (run.sh <slug> configure --intro complex to switch)
```

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` -> exit 0.

### Step 8: full gate on a fresh tree

```bash
cd pipelines/video/visuals-flow
git clean -xdn .        # review what is untracked scratch before removing anything
bash scripts/check.sh
```

**Verify**: exit 0, prints `visuals-flow check OK`.

## Test plan

- `lib/intro-mode-switch.test.mjs` (NEW, 8 tests) — the mode filter, the default,
  the typo guard, the legacy-key strip, and the seven tagged steps. Joins the gate
  by existing (`check.sh` finds `lib/*.test.mjs`, it does not enumerate them).
- `lib/run-config.test.mjs` — extend with `introMode` default/override/typo cases.
- `lib/steps.test.mjs` — extend with `modes` schema validation: a valid array
  passes, `modes: []` dies, `modes: ["banana"]` dies, `modes: "simple"` (a string,
  not an array) dies.
- `lib/intro-invariants.test.mjs` — unchanged behaviour, renamed final test.
- Mutation proof, run by hand in Step 5 and by boss at merge.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`.
- [ ] `test -f pipelines/video/visuals-flow/lib/intro-mode-switch.test.mjs` and that file's run reports **8 tests passing**: `cd pipelines/video/visuals-flow && node --test lib/intro-mode-switch.test.mjs 2>&1 | grep -q "^# pass 8"`.
- [ ] All seven complex steps carry `modes: ["complex"]`: `cd pipelines/video/visuals-flow && for n in 110 120 130 140 150 160 440; do grep -q '"complex"' steps/$n-*/step.json || { echo "MISSING $n"; exit 1; }; done` exits 0.
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0 (PIPELINE.md regenerated, not hand-edited).
- [ ] Mutation proof: removing the `stepInMode` line makes `node --test lib/intro-mode-switch.test.mjs` FAIL with `INTRO-MODE` in the output, and reverting makes it pass.
- [ ] `decisions.md` contains the heading `## 2026-08-22 — the intro has two flows again`.
- [ ] `git diff --stat 20a2ae62..HEAD --name-only` lists ONLY files from the In-scope list.
- [ ] No file under `steps/1[1-6]0-*/` other than `step.json` appears in the diff: `git diff --name-only 20a2ae62..HEAD | grep -E 'steps/1[1-6]0-' | grep -v 'step.json$'` prints nothing.

## STOP conditions

- **Gate integrity**: if an assertion in `lib/intro-invariants.test.mjs` or any
  other existing test fails, fix the CODE or the FIXTURE. Weakening, swapping,
  skipping or deleting an assertion is a STOP — report instead.
- If `ZONE_PARTS` or E13 open-cover behaviour has to change to make the gate pass,
  STOP. That means the design assumption "both flows own the intro span identically"
  is wrong, and plan 219 needs re-planning.
- If a `nextStep()` call site has no reachable `workdir` and therefore cannot pass a
  mode, STOP and report the call site rather than guessing a mode for it.
- Do NOT create any simple-mode step folder, card, kit directory, or authoring
  prompt — that is plan 219. After this plan a `simple` video's intro track
  correctly reports "satisfied" because the simple steps do not exist yet. That is
  the expected intermediate state, not a bug to fix.
- Do NOT touch `lib/board.mjs`, `board-ui/`, `TASTE-INTRO.md` or the
  `yt-video-edit` SKILL.md — plan 220.
- Do NOT re-delete the switch on the grounds that `decisions.md` once said "film
  only". Step 6b records the reversal; read it.

## Maintenance notes

- **The mode filter is one line** (`if (!stepInMode(s, mode)) continue;` in
  `firstUnsatisfied`). Everything else is plumbing. A reviewer should check that
  line's POSITION — it must precede the `optional` check.
- Any future step added to the intro lanes MUST declare `modes`. A step with no
  `modes` runs in both flows, which for an intro step means a simple video parks
  on a complex artifact. Consider adding a registry assertion later:
  "every `track: intro` step declares `modes`".
- `loadRunConfig` now THROWS on a bad `introMode`. Callers that previously assumed
  it never throws (board request handlers especially) may need a try/catch —
  plan 220 covers the board.
- Plans 219 and 220 depend on this one; both should carry `needs_prs: [<this PR>]`.
