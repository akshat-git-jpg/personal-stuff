---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["none — this plan is self-contained and unblocks 189"]
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/intro-film/review-film.mjs, pipelines/video/visuals-flow/lib/intro-film/film-gate.mjs, pipelines/video/visuals-flow/lib/intro-film/render-film.mjs, pipelines/video/visuals-flow/lib/intro-film/render-film.test.mjs, pipelines/video/visuals-flow/lib/intro-film/film-gate.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps/025-author-intro-film-llm/README.md]

mutation_apply: cd pipelines/video/visuals-flow && sed -i '' "s/const verdict = runGate(slug);/const verdict = { pass: true, failures: [] };/" lib/intro-film/film-gate.mjs
mutation_command: cd pipelines/video/visuals-flow && node --test lib/intro-film/film-gate.test.mjs
mutation_expect: intro-render must refuse a film that fails the gate
mutation_timeout: 600
---

# Plan 188: visuals-flow — the intro film's missing render glue

## Summary

- **Problem statement**: Step 025's two diagnostic verbs are silent no-ops. `lib/intro-film/review-film.mjs` and `lib/intro-film/film-gate.mjs` export their work as functions but have **no CLI entry block**, while `run.sh` invokes both as scripts — so `run.sh <slug> intro-review` and `run.sh <slug> intro-render` each exit 0 having done nothing. On top of that, **nothing anywhere renders the film**: no code path produces `intro-film/renders/intro-film.mp4` or `intro-film/out/intro.mp4`, yet `lib/assemble.mjs` hard-requires the latter and names `intro-render` as the way to get it. No `intro: "film"` video can be assembled through the documented interface.
- **Goals**:
  - Give `review-film.mjs` and `film-gate.mjs` real CLI entry blocks so the `run.sh` verbs do what they claim.
  - Add `lib/intro-film/render-film.mjs`: render `film/` → `renders/intro-film.mp4`, run the shipped `runGate()`, and on pass deliver to `out/intro.mp4`.
  - Make `run.sh <slug> intro-render` **exit non-zero** when the render is missing or the gate fails. Today it exits 0 in both cases.
  - Fix the stale claim in `steps/025-author-intro-film-llm/README.md` that nothing consumes the film.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every decision below is inlined, including the exact renderer invocation and the flag that breaks it.
- **Done criteria** (terse): `scripts/check.sh` green; `node lib/intro-film/render-film.mjs` and `film-gate.mjs` and `review-film.mjs` each do real work when run as scripts; `intro-render` exits non-zero on a missing render and on a gate failure.
- **Stop conditions** (terse): changing anything in `assemble.mjs`; weakening a gate assertion; changing `GATE` constants; touching `board-ui/`.
- **Test / verification for success**: unit tests over the new CLI surface plus a gate-refusal test driven by a generated fixture video, armed with the mutation recipe above.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9d94b51b..HEAD -- pipelines/video/visuals-flow/lib/intro-film pipelines/video/visuals-flow/run.sh`
> Expect no changes to `lib/intro-film/review-film.mjs`, `lib/intro-film/film-gate.mjs` or the `intro-film|intro-review|intro-render` block in `run.sh`. If any of those three changed, STOP and report — someone else may have fixed this.

## Status

- **Priority**: P1 — this blocks assembly for every `intro: "film"` video.
- **Effort**: M
- **Risk**: LOW-MEDIUM. Purely additive: two CLI blocks, one new module, one `run.sh` branch. Nothing existing changes behavior except that two verbs stop lying.
- **Depends on**: nothing
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `9d94b51b`, 2026-08-04

## Why this matters

Plans 185, 186 and 187 landed the intro film's authoring step, its review
libraries, its gate logic, its approval gate, and the assembly splice. They did
not land the wiring between the HTML and the mp4. The result is the worst kind
of gap: **the commands report success.**

A session that runs `bash run.sh <slug> intro-review` sees exit 0 and reasonably
concludes the film reviewed clean. It did not review at all. `TASTE.md` T9 exists
precisely because an entire beat's device was invisible on screen while every
mechanical check passed — and that check is the one that silently does not run.

This was found the hard way on 2026-08-03 while producing
`consistent-ai-influencer`. Driving the shipped exports by hand surfaced 7 lint
errors, and because a lint error makes the hyperframes layout and contrast passes
skip sampling entirely, clearing lint then exposed **19 layout errors** that had
been masked. All of that was invisible through the documented interface.

## Current state

### The two modules with no CLI entry

`lib/intro-film/review-film.mjs` ends at its exported function — there is no
`if (import.meta.url === ...)` block anywhere in the file:

```js
export function runReview(slug, { check = true, snapshot = true } = {}) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  if (!fs.existsSync(path.join(filmDir, 'index.html'))) {
    throw new Error(`missing ${filmDir}/index.html — run the author step first`);
  }
  const screenplay = JSON.parse(fs.readFileSync(path.join(workdir, 'screenplay.json'), 'utf8'));
  const media = linkFilmMedia(slug);
  ...
  return { reportFile, reviewDir, findings, samples, media, sheetFiles };
}
```

`lib/intro-film/film-gate.mjs` is the same shape. Its whole job is to judge a
file that must already exist:

```js
export function runGate(slug) {
  const workdir = resolveWorkdir(slug);
  const video = path.join(workdir, 'renders', 'intro-film.mp4');
  if (!fs.existsSync(video)) throw new Error(`missing ${video} — run the render step first`);
  const introDuration = introSpan(path.join(workdir, '..')).duration;
  const renderDuration = probeVideoDuration(video);
  const { width, height } = probeDimensions(video);
  return judge({ renderDuration, introDuration, luma: frameLuma(video), freezes: detectFreezes(video, renderDuration), width, height });
}
```

`judge()` returns `{ pass: boolean, failures: string[] }`. The thresholds it
applies (do **not** change these):

```js
export const GATE = {
  DURATION_TOLERANCE: 0.05,   // seconds
  MAX_FREEZE: 3.0,            // seconds
  MIN_MEAN_LUMA: 4,
  MIN_LUMA_RANGE: 6,
  WIDTH: 1920,
  HEIGHT: 1080,
};
```

### The run.sh verbs, exactly as they are today

`run.sh` lines 254–272:

```bash
  intro-film|intro-review|intro-render)
    intro_mode=$(node -e "import('./lib/run-config.mjs').then(m=>console.log(m.loadRunConfig('videos/$slug').intro))")
    if [[ "$intro_mode" != "film" ]]; then
      echo "intro=$intro_mode — this video does not use the bespoke intro film."
      echo "Opt in with: bash run.sh $slug configure --intro film"
      exit 1
    fi
    if [[ "$step" == "intro-film" ]]; then
      cat steps/025-author-intro-film-llm/AUTHORING.md | sed "s/<slug>/$slug/g"
      exit 0
    elif [[ "$step" == "intro-review" ]]; then
      node lib/intro-film/review-film.mjs "$slug"
      exit 0
    elif [[ "$step" == "intro-render" ]]; then
      node -e "import('./lib/intro-film/approve.mjs').then(m=>m.requireIntroApproved(process.cwd()+'/videos/$slug')).catch(e=>{console.error(e.message);process.exit(1)})"
      node lib/intro-film/film-gate.mjs "$slug"
      exit 0
    fi
    ;;
```

Two bugs are visible here: the two `node lib/intro-film/*.mjs` calls hit modules
with no CLI entry, and `intro-render` never renders anything — it only (would)
judge. The unconditional `exit 0` also swallows any non-zero status.

### Workdir resolution — read this before writing paths

`lib/intro-film/workdir.mjs`:

```js
export function resolveWorkdir(slugOrPath) {
  if (!slugOrPath) throw new Error('resolveWorkdir: slug or path required');
  if (slugOrPath.includes('/')) return path.resolve(slugOrPath);
  return path.join(ROOT, 'videos', slugOrPath, 'intro-film');
}
```

So for a bare slug the intro-film workdir is `videos/<slug>/intro-film`, and the
video's own workdir is its parent. Note the asymmetry already present in
`run.sh`: `approve.requireIntroApproved` is passed `videos/<slug>` (the parent),
while `runGate` takes the slug. Preserve both.

### The renderer, and the flag that breaks it

`review-film.mjs` pins the renderer at the top of the file:

```js
const HYPERFRAMES = 'hyperframes@0.7.88';
```

The render invocation below is **verified working** on 2026-08-03 (2721 frames,
~122s, audio muxed):

```
npx -y hyperframes@0.7.88 render film --fps 30 --format mp4 --quality high -o renders/intro-film.mp4
```

run with cwd = the intro-film workdir.

**`-o` must be a FILENAME, not a directory.** `-o renders` is treated as an
extensionless output file and the run fails at the audio mux with
`Unable to choose an output format for '.../renders'; use a standard extension`
— while still exiting in a way that looks fine. This cost a full render cycle on
2026-08-03. Hardcode the filename.

### Where the film has to end up

`lib/assemble.mjs` around line 1006:

```js
  const filmSpan = filmSpanFor(workdir);
  if (introOwnedByFilm(workdir)) {
    const introFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
    if (!fs.existsSync(introFile)) {
      throw new Error(`missing intro film: ${introFile} — run.sh ${video} intro-render`);
    }
  }
```

`out/` and `renders/` are both gitignored (`videos/*/intro-film/out/`,
`videos/*/intro-film/renders/`), so they are build artifacts — create them, never
commit them.

## Commands you will need

```bash
cd pipelines/video/visuals-flow

bash scripts/check.sh                              # the merge gate; must exit 0
node --test lib/intro-film/film-gate.test.mjs      # focused
node --test lib/intro-film/render-film.test.mjs    # focused (new file)
```

`scripts/check.sh` currently prints `visuals-flow check OK` and exits 0 with 81
tests passing. That is your baseline — it must still be green at the end, with
your new tests added to the count.

## Scope

**In scope** (the only files you may touch):

- `pipelines/video/visuals-flow/lib/intro-film/review-film.mjs` — add a CLI entry block
- `pipelines/video/visuals-flow/lib/intro-film/film-gate.mjs` — add a CLI entry block
- `pipelines/video/visuals-flow/lib/intro-film/render-film.mjs` — **new**
- `pipelines/video/visuals-flow/lib/intro-film/render-film.test.mjs` — **new**
- `pipelines/video/visuals-flow/lib/intro-film/film-gate.test.mjs` — add the refusal test
- `pipelines/video/visuals-flow/run.sh` — the `intro-render` / `intro-review` branches only
- `pipelines/video/visuals-flow/steps/025-author-intro-film-llm/README.md` — the stale paragraph

**Out of scope — do not touch:**

- `lib/assemble.mjs` and `lib/export-timeline.mjs` — they already consume `out/intro.mp4` correctly. This plan produces the file they expect; it does not change them.
- `lib/intro-film/owns-intro.mjs`, `approve.mjs`, `lint-screenplay.mjs`, `check-film-style.mjs` — working as intended.
- `board-ui/` — the board's intro review is plan 189's job.
- `GATE` constants — the thresholds are the owner's, set in plan 182.

## Steps

### 1. CLI entry for `review-film.mjs`

Append to the end of `lib/intro-film/review-film.mjs`. Match the CLI style
already used in `lib/intro-film/lint-screenplay.mjs`:

```js
if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/review-film.mjs <slug-or-path>');
    process.exit(1);
  }
  try {
    const r = runReview(slug);
    const errors = r.findings.filter((f) => f.severity === 'error');
    for (const f of r.findings) {
      console.error(`${f.severity.toUpperCase()} ${f.code} ${f.selector ?? ''} ${f.message ?? ''}`.trim());
    }
    console.log(`review: ${r.samples.length} frames, ${r.findings.length} findings (${errors.length} errors) -> ${r.reportFile}`);
    // A lint error makes hyperframes skip the layout and contrast passes
    // entirely — they then report ok against ZERO samples. Exiting non-zero is
    // what stops a session reading that vacuous green as a real pass.
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
```

**Verify:** `cd pipelines/video/visuals-flow && node lib/intro-film/review-film.mjs 2>&1 | head -1`
prints the usage line and the command exits 1 (`echo $?` → `1`).

### 2. CLI entry for `film-gate.mjs`

Append to the end of `lib/intro-film/film-gate.mjs`. **The variable must be named
`verdict`** — the mutation recipe in this plan's frontmatter seds that exact line:

```js
if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/film-gate.mjs <slug-or-path>');
    process.exit(1);
  }
  try {
    const verdict = runGate(slug);
    if (verdict.pass) {
      console.log('film gate: pass');
      process.exit(0);
    }
    for (const f of verdict.failures) console.error(`film gate: ${f}`);
    process.exit(1);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
```

**Verify:** `node lib/intro-film/film-gate.mjs 2>&1 | head -1` prints usage, exit 1.

### 3. New module `lib/intro-film/render-film.mjs`

Render, gate, deliver. Write this file exactly:

```js
// The glue between the authored composition and the mp4 the assembler needs.
// Plans 185-187 landed the author step, the review libs, the gate and the
// assembly splice, but nothing that turns film/index.html into a video — so
// `run.sh <slug> intro-render` reported success and produced nothing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveWorkdir } from './workdir.mjs';
import { linkFilmMedia } from './film-assets.mjs';
import { runGate } from './film-gate.mjs';

// Same pin as review-film.mjs. Keep the two in lockstep: reviewing on one
// renderer and shipping on another is how a green review ships a broken film.
const HYPERFRAMES = 'hyperframes@0.7.88';

// `-o` MUST be a filename. `-o renders` is read as an extensionless output file
// and the run dies at the audio mux with "Unable to choose an output format".
export function renderArgs(outFile) {
  return ['-y', HYPERFRAMES, 'render', 'film',
    '--fps', '30', '--format', 'mp4', '--quality', 'high',
    '-o', outFile];
}

export function renderFilm(slug) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  if (!fs.existsSync(path.join(filmDir, 'index.html'))) {
    throw new Error(`missing ${filmDir}/index.html — author the film first (step 025)`);
  }

  // Same reason review-film links media: a path above the project root is a
  // hyperframes lint error, and the composition's own media lives one level up.
  linkFilmMedia(slug);

  const rendersDir = path.join(workdir, 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });
  const rel = path.join('renders', 'intro-film.mp4');
  const abs = path.join(workdir, rel);
  fs.rmSync(abs, { force: true });

  const r = spawnSync('npx', renderArgs(rel), { cwd: workdir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed (exit ${r.status})`);
  if (!fs.existsSync(abs)) throw new Error(`render reported success but ${abs} does not exist`);
  return abs;
}

// Render -> gate -> deliver. The film only reaches out/ when the gate passes,
// so assemble.mjs can treat the presence of out/intro.mp4 as "gate passed".
export function renderAndDeliver(slug) {
  const workdir = resolveWorkdir(slug);
  const rendered = renderFilm(slug);
  const verdict = runGate(slug);
  if (!verdict.pass) return { rendered, verdict, delivered: null };

  const outDir = path.join(workdir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const delivered = path.join(outDir, 'intro.mp4');
  fs.copyFileSync(rendered, delivered);
  return { rendered, verdict, delivered };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/render-film.mjs <slug-or-path>');
    process.exit(1);
  }
  try {
    const { verdict, delivered } = renderAndDeliver(slug);
    if (!verdict.pass) {
      for (const f of verdict.failures) console.error(`film gate: ${f}`);
      console.error('intro-render must refuse a film that fails the gate');
      process.exit(1);
    }
    console.log(`film gate: pass -> ${delivered}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
```

**Verify:** `node lib/intro-film/render-film.mjs 2>&1 | head -1` prints usage, exit 1.

### 4. Wire the verbs in `run.sh`

Replace the `intro-review` and `intro-render` branches shown in Current state
with these. The `exit 0` becomes `exit $?`-style propagation — a failing gate
must fail the command:

```bash
    elif [[ "$step" == "intro-review" ]]; then
      node lib/intro-film/review-film.mjs "$slug"
      exit $?
    elif [[ "$step" == "intro-render" ]]; then
      node -e "import('./lib/intro-film/approve.mjs').then(m=>m.requireIntroApproved(process.cwd()+'/videos/$slug')).catch(e=>{console.error(e.message);process.exit(1)})" || exit 1
      node lib/intro-film/render-film.mjs "$slug"
      exit $?
    fi
```

Note the added `|| exit 1` on the approval check: today a refusal there is
printed and then ignored, because the next line runs regardless.

**Verify:** `bash run.sh nonexistent-video intro-render; echo "exit=$?"` → non-zero
(it fails at the run-config read, which is correct).

### 5. Gate-refusal test with a generated fixture

Add to `lib/intro-film/film-gate.test.mjs`, following the file's existing style.
This is the test the mutation recipe arms, so its failure message must contain
the exact string `intro-render must refuse a film that fails the gate`.

Build the fixture with ffmpeg into a temp dir (do not commit a video). A single
still image held for 6s violates `MAX_FREEZE: 3.0`:

```js
// A film that is one frozen picture for 6s must be refused. This asserts on the
// CLI's exit code and stderr, not on source text — a source-text assertion would
// make the mutation circular (LESSONS 2026-08-02).
test('intro-render refuses a film that fails the gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'introgate-'));
  // ... build <dir>/videos/fx/intro-film/{film,renders}, write a minimal
  // segments.json at <dir>/videos/fx with a 6s intro span, and generate
  // renders/intro-film.mp4 with:
  //   ffmpeg -f lavfi -i color=c=gray:s=1920x1080:d=6 -r 30 -pix_fmt yuv420p <file>
  const r = spawnSync('node', [renderFilmCli, path.join(dir, 'videos', 'fx', 'intro-film')], { encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /intro-render must refuse a film that fails the gate/);
});
```

Because `renderAndDeliver` renders first, and you do not want the test to invoke
the real renderer, structure the test to call the **gate + refusal path** rather
than the full render: assert `runGate()` returns `pass: false` with a `G2` freeze
failure on the fixture, and assert the CLI prints and exits 1 when handed a
workdir whose `renders/intro-film.mp4` already exists and is frozen. Add a
`--skip-render` flag to `render-film.mjs`'s CLI **only if** you need it to make
this test hermetic; if you add it, document it in the usage line.

**Verify:** `node --test lib/intro-film/film-gate.test.mjs` → all pass.

**Dry-run the mutation before you finish** (this plan's frontmatter arms it, and
an unproven recipe is the exact 2026-08-02 failure):

```bash
cd pipelines/video/visuals-flow
sed -i '' "s/const verdict = runGate(slug);/const verdict = { pass: true, failures: [] };/" lib/intro-film/film-gate.mjs
node --test lib/intro-film/film-gate.test.mjs   # MUST fail, printing the expect string
git checkout lib/intro-film/film-gate.mjs
node --test lib/intro-film/film-gate.test.mjs   # MUST pass again
```

If the mutation does not make the test fail, the test is not gating what it
claims — fix the test, do not adjust the recipe to match a weak test.

### 6. Fix the stale README

`steps/025-author-intro-film-llm/README.md` ends with:

> **What consumes the output**
> Nothing yet. The owner drops `intro-film/out/intro.mp4` into the edit by hand,
> exactly as with the standalone POC. Making the pipeline consume it — and making
> the zone pass, the cue lints and the assembler stand down on the intro span —
> is a separate plan, because it changes what a normal video produces.

That separate plan is 187 and it **landed**. Replace the paragraph with a short,
accurate one: `assemble.mjs` and `export-timeline.mjs` splice
`intro-film/out/intro.mp4` over the intro span automatically when
`introOwnedByFilm()` is true, and `run.sh <slug> intro-render` is what produces
that file. Also update the Verbs table: `intro-render` now renders, gates and
delivers, and fails non-zero when the gate refuses.

**Verify:** `rtk proxy grep -c "Nothing yet" steps/025-author-intro-film-llm/README.md` → `0`.

## Test plan

| Test | Where | Follows |
|---|---|---|
| gate refuses a frozen fixture, CLI exits 1 with the expect string | `lib/intro-film/film-gate.test.mjs` | the file's existing `judge()` cases |
| `renderArgs()` emits `-o <file>.mp4`, never a bare directory | `lib/intro-film/render-film.test.mjs` (new) | `lib/intro-film/film-assets.test.mjs` |
| `renderFilm()` throws a named error when `film/index.html` is absent | `lib/intro-film/render-film.test.mjs` | same |
| `renderAndDeliver()` does NOT write `out/intro.mp4` when the verdict fails | `lib/intro-film/render-film.test.mjs` | same |

The `renderArgs` test is the cheap guard against the `-o renders` regression:
assert the last two args are `'-o'` and a string ending `.mp4`.

## Done criteria

1. `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, and the test count is higher than the 81 it reports today.
2. `node lib/intro-film/review-film.mjs` with no args → usage on stderr, exit 1.
3. `node lib/intro-film/film-gate.mjs` with no args → usage on stderr, exit 1.
4. `node lib/intro-film/render-film.mjs` with no args → usage on stderr, exit 1.
5. `node --test lib/intro-film/render-film.test.mjs` → all pass.
6. The mutation dry-run in Step 5 fails with `intro-render must refuse a film that fails the gate` and passes again after revert.
7. `rtk proxy grep -c "Nothing yet" steps/025-author-intro-film-llm/README.md` → 0.
8. `git status --porcelain` shows no `videos/*/intro-film/renders/` or `out/` files staged — they are gitignored build artifacts.

## STOP conditions

- **A gate assertion fails and the tempting fix is to soften it.** Fix the code or the fixture; weakening, swapping or deleting an assertion is a STOP.
- Any change to `lib/assemble.mjs`, `lib/export-timeline.mjs`, or the `GATE` constants.
- The mutation dry-run does not make the test fail — that means the test does not gate what it claims. Stop and report rather than adjusting the recipe.
- `scripts/check.sh` was already red before you started (run it first, before any edit).
- You find yourself needing to change `board-ui/` — that is plan 189.

## Maintenance notes

- **The renderer pin appears twice** now (`review-film.mjs` and `render-film.mjs`). They must move together; reviewing on one version and shipping on another is a real hazard. A reviewer should check both when the pin bumps.
- The `-o` filename requirement is a hyperframes CLI behavior, not a hyperframes bug we can fix here — the `renderArgs` test is the guard.
- Once this lands, `out/intro.mp4` existing implies the gate passed. Plan 189's board tab relies on that: it serves that file and nothing else.
- The asymmetric workdir arguments in `run.sh` (`approve` gets `videos/<slug>`, the others get the slug) are pre-existing. Do not "tidy" them in this plan.
