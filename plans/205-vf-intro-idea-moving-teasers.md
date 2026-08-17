---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/intro-film/teasers.mjs, pipelines/video/visuals-flow/lib/intro-film/teasers.test.mjs, pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/lib/board-data.mjs, pipelines/video/visuals-flow/lib/flow-previews.mjs, pipelines/video/visuals-flow/lib/flow-previews.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps/_verbs.json, pipelines/video/visuals-flow/steps/110-propose-intro-idea-llm, pipelines/video/visuals-flow/decisions.md]

mutation_apply: rm pipelines/video/visuals-flow/lib/intro-film/fixtures/teasers/b/index.html
mutation_command: cd pipelines/video/visuals-flow && node --test lib/intro-film/teasers.test.mjs
mutation_expect: IDEA-PREVIEW-MISSING
mutation_cwd:
mutation_timeout:
---

# Plan 205: visuals-flow — the intro idea gate judges moving teasers, not prose

## Summary

- **Problem statement**: gate 120 asks the owner to approve a *page of prose*, then
  step 130 spends ~18k output tokens building a 64 KB composition from it. Prose
  cannot show a look, so the owner approves words and rejects the film — the exact
  loop the gate was added to prevent. Owner, 2026-08-17: *"i dont like the entire
  intro. i need to do entire intro again from scratch."*
- **Goals**:
  - Every proposed direction ships a real **6-second Hyperframes teaser** that
    compresses that direction's whole arc — real brand, real renderer, real motion.
  - The owner picks a direction by *watching three clips*, not by reading three pages.
  - A direction cannot be approved unless its teaser mp4 exists on disk.
  - Rejecting all directions is a first-class path that carries the owner's note
    forward, so round 2 cannot re-propose what round 1 was rejected for.
  - The Google Flow image-preview path is removed from 110 (superseded by real
    clips) and survives untouched for the 240 new-card gate.
- **Executor proposed**: `claude-p` / `sonnet` — new gate logic plus an authoring
  contract the owner judges by taste; `standard` difficulty but content-setting,
  which is rules.md's `claude-p`/`sonnet` row.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0;
  `node --test lib/intro-film/teasers.test.mjs` exits 0; the mutation recipe makes
  it fail printing `IDEA-PREVIEW-MISSING`; `node lib/flow-previews.mjs` no longer
  reports an intro source.
- **Stop conditions** (terse — full list below): do not touch `card-previews`/240,
  do not weaken a gate assertion to make a suite pass, do not author or edit any
  file under `videos/`.
- **Test / verification for success**: `node:test` units over pure functions with
  inline HTML fixtures plus an on-disk fixture tree, all reached by `check.sh`'s
  `find lib -name '*.test.mjs'` auto-discovery.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6145e4bc..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/run.sh pipelines/video/visuals-flow/steps`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `6145e4bc`, 2026-08-17

## Why this matters

The pipeline's whole gate ladder is built on rejecting cheaply before spending. It
works everywhere except the one place it matters most. 110 was added (plan 197)
because the intro's idea used to be invented inside the screenplay pass, and the
owner's only checkpoint was after a full build and encode. 110 fixed *when* the
gate fires. It did not fix *what the gate holds*.

A page of prose is cheap to reject and useless to judge. Three directions described
in words all sound reasonable; the same three as moving pictures are instantly
distinguishable. The 110 README already concedes this — an owner ask on 2026-08-13
added Google Flow image prompts *"so the owner can SEE each direction"*. That was
the right instinct with the wrong artifact: an AI-generated still is neither the
brand nor the renderer nor the motion, so approving it still tells you very little
about the film you will get.

A six-second teaser built in the real composition system, from the real DESIGN.md
tokens, using the real logos, IS the film in miniature. It costs roughly 2k output
tokens per direction against the ~18k a full authoring pass burns. Killing a wrong
direction at second 6 is the entire point.

## Current state

### The idea pass today

`pipelines/video/visuals-flow/steps/110-propose-intro-idea-llm/` holds `README.md`,
`IDEA-PASS.md` (the authoring contract) and `step.json`. `IDEA-PASS.md` specifies
`intro-film/idea.json`:

```json
{
  "video": "<slug>",
  "chosen": null,
  "directions": [
    {
      "id": "a",
      "name": "<3-5 words>",
      "central_object": "<one noun>",
      "arc": ["<clause>", "<clause>", "<clause>"],
      "motifs": ["<move>", "<move>"],
      "enacts_throughline": "<how, quoting concept.json>",
      "rejects": "<the obvious treatment this refuses, and why>"
    }
  ]
}
```

`step.json` for 110 is exactly:

```json
{
  "number": "110",
  "slug": "110-propose-intro-idea-llm",
  "title": "propose the intro idea",
  "actor": "llm",
  "actorLabel": "[LLM]",
  "verbs": ["intro-idea"],
  "consumes": ["transcript.json", "segments.json", "concept.json"],
  "produces": ["intro-film/idea.json"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": false,
  "summary": "`transcript.json` + `segments.json` + `concept.json` -> `intro-film/idea.json`: 2-3 competing visual directions for the intro, one page each. Prose only — no beats, no timings, no code. The cheapest place to reject an intro.",
  "track": "intro"
}
```

**`produces` and `verbs` stay exactly as they are.** Teaser rendering is a *helper
verb*, not a step, precisely because a step's `produces` list is static and the
teaser filenames depend on how many directions were proposed. `lib/steps.mjs`
validates `produces` and satisfies a step by `produces.every(f => exists(f))`
(`lib/steps.mjs:256`); a dynamic list cannot be declared there. Adding a step here
would fail `E-REG`.

### The gate today

`lib/board.mjs:941` — the approve handler, verbatim at the relevant lines:

```js
async function handleApproveIntroIdea(req, res, workdir) {
  ...
  const ideaPath = path.join(workdir, 'intro-film', 'idea.json');
  if (!fs.existsSync(ideaPath)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'intro-film/idea.json does not exist yet' })); }
  const idea = JSON.parse(fs.readFileSync(ideaPath, 'utf8'));
  if (!(idea.directions || []).some((d) => d.id === chosen)) {
```

It is routed at `lib/board.mjs:1423`:

```js
  if (req.method === 'POST' && url.pathname === '/approve-intro-idea') {
    return handleApproveIntroIdea(req, res, workdir);
```

`lib/board-data.mjs:203` `introData(workdir)` builds what the tab reads. Its idea
block is verbatim:

```js
  try {
    const ideaFile = JSON.parse(fs.readFileSync(path.join(introDir, 'idea.json'), 'utf8'));
    idea = {
      directions: ideaFile.directions || [],
      chosen: ideaFile.chosen ?? null,
      approved: ideaFile.approved === true,
    };
  } catch (e) {
    // ignore — no idea pass yet
  }
```

### The Google Flow path being removed from 110

`lib/flow-previews.mjs` declares:

```js
export const SOURCES = [
  { kind: 'intro', dir: 'intro-film/idea-previews', label: 'intro idea (110)' },
  { kind: 'card', dir: 'card-previews', label: 'new-card look (240)' },
];
```

Only the `intro` row goes. **The `card` row and everything about 240 stay exactly
as they are** — the new-card look gate still approves AI frames before code, which
is a different problem with a different right answer.

### How a Hyperframes composition is rendered

`lib/intro-film/render-film.mjs` is the working example. Its render invocation,
verbatim:

```js
export function renderArgs(outFile) {
  return ['-y', HYPERFRAMES, 'render', 'film',
    '--fps', '30', '--format', 'mp4', '--quality', 'high',
    '-o', outFile];
}
```

with `spawnSync('npx', renderArgs(rel), { cwd: workdir, stdio: 'inherit' })`, where
`'film'` is the composition DIRECTORY NAME relative to `cwd`, and `-o` MUST be a
filename (an extensionless `-o` dies at the audio mux). `HYPERFRAMES` is
`FILM_RENDERER` imported from `../renderer-constants.mjs` — import it the same way,
never hardcode the renderer string.

### The composition root contract

From `steps/130-author-intro-screenplay-llm/AUTHORING.md`, and true for teasers too:
Hyperframes reads the canvas from `data-width`/`data-height` on the root, never from
CSS, and `data-start` is required or lint errors. A missing
`window.__timelines[<data-composition-id>]` registration still renders but stalls 45s
per worker first.

### The convention to imitate

`lib/intro-film/check-film-sync.mjs` (landed 2026-08-17) is the exemplar for this
plan's new module: pure exported functions over strings, a `run<Thing>(slug)` wrapper
that does the file I/O, a `pathToFileURL(process.argv[1])` CLI guard, error objects
`{ code, message }` rather than thrown strings, and every non-obvious line carrying a
comment that names the incident behind it. Match that file's shape.

**Do not** invent a new UI idiom anywhere — this plan touches no React at all
(that is plan 206).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, prints `visuals-flow check OK` |
| New unit suite | `cd pipelines/video/visuals-flow && node --test lib/intro-film/teasers.test.mjs` | exit 0, `# fail 0` |
| Whole intro-film suite | `cd pipelines/video/visuals-flow && node --test lib/intro-film/*.test.mjs` | exit 0, `# fail 0` |
| Step registry | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exit 0, `PIPELINE.md step table up to date` |
| run.sh verb guard | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | exit 0 |
| Flow sources | `cd pipelines/video/visuals-flow && node lib/flow-previews.mjs consistent-ai-influencer` | exit 0, output mentions no intro source |

Note: `node --test <dir>` fails on this node — always pass a file or a glob
(`plans/runs/LESSONS.md`, 2026-07-09).

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/intro-film/teasers.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/teasers.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/fixtures/teasers/` (new fixture tree)
- `pipelines/video/visuals-flow/lib/board.mjs`
- `pipelines/video/visuals-flow/lib/board-data.mjs`
- `pipelines/video/visuals-flow/lib/flow-previews.mjs` + `flow-previews.test.mjs`
- `pipelines/video/visuals-flow/run.sh`
- `pipelines/video/visuals-flow/steps/_verbs.json`
- `pipelines/video/visuals-flow/steps/110-propose-intro-idea-llm/{README.md,IDEA-PASS.md}`
- `pipelines/video/visuals-flow/decisions.md`

**Out of scope** (looks related, do not touch, because…):
- `board-ui/` — the React tab is plan 206. This plan lands the server side only.
- `steps/110-propose-intro-idea-llm/step.json` — `produces`/`verbs` are correct as
  they stand; teasers are a helper verb, and a dynamic `produces` fails `E-REG`.
- `card-previews`, `steps/240-build-cards-llm`, `card-library/DESIGN.md` — the
  240 new-card look gate keeps its Google Flow path unchanged.
- `steps/130-author-intro-screenplay-llm/` — the authoring pass is unchanged; it
  still reads `chosen` from `idea.json`.
- Anything under `videos/` — never author, edit or delete a real video workdir.
- `lib/intro-film/check-film-sync.mjs` — landed separately, leave it alone.

## Git workflow

- Branch: `advisor/205-vf-intro-idea-moving-teasers`
- Commit: one per step, `feat(plan-205): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: The teaser module

Create `pipelines/video/visuals-flow/lib/intro-film/teasers.mjs`. This is the whole
hard part of the plan and it is written for you — place it, do not redesign it.

```js
// The moving half of the intro idea gate.
//
// 110 proposes 2-3 competing directions. Until 2026-08-17 the owner approved one
// of them as PROSE, and 130 then spent ~18k output tokens turning it into a 64 KB
// composition. Prose cannot show a look: three directions described in words all
// sound reasonable, and the owner was rejecting the finished film instead
// ("i dont like the entire intro. i need to do entire intro again from scratch").
//
// So every direction now ships a six-second teaser built in the REAL composition
// system — real DESIGN.md tokens, real logos, real renderer, real motion. It is
// the film in miniature, at roughly 2k output tokens against 18k, and it is what
// gate 120 actually judges.
//
// It compresses the ARC, not beat one. Three directions' opening beats can look
// nearly identical while their arcs differ completely, and the arc IS the
// direction — `idea.json` says so: "Its arc — how that object transforms across
// the intro's beats. This is the idea; everything else is decoration."
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveWorkdir } from './workdir.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

// Six seconds, fixed. Not a knob: the whole value of this gate is that every
// direction is judged on identical terms, and a direction allowed more screen
// time than its rivals wins on runtime rather than on merit.
export const TEASER_SECONDS = 6;
export const TEASER_WIDTH = 1920;
export const TEASER_HEIGHT = 1080;

// Same tolerance and rationale as check-film-sync.mjs: timings are authored to
// 2dp, so half of the last place accepts "6.00" and rejects a real edit.
const EPSILON = 0.005;

export const teasersDir = (workdir) => path.join(workdir, 'intro-film', 'teasers');
export const teaserSrcDir = (workdir, id) => path.join(teasersDir(workdir), id);
export const teaserHtml = (workdir, id) => path.join(teaserSrcDir(workdir, id), 'index.html');
export const teaserMp4 = (workdir, id) => path.join(teasersDir(workdir), `${id}.mp4`);

// One banner per arc clause, in order — the same contract check-film-sync.mjs
// puts on the full film, for the same reason: it is the only thing tying the
// authored composition back to the JSON it was written from.
//
//   /* ---------- m1 : five blank cards snap into a row ---------- */
const MOMENT_RE = /\/\*\s*-*\s*m(\d+)\s*:/g;

export function parseTeaserRoot(html) {
  const rootTag = html.match(/<[^>]*\bdata-composition-id\s*=\s*"[^"]*"[^>]*>/);
  if (!rootTag) return null;
  const attr = (name) => {
    const m = rootTag[0].match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
    return m ? m[1] : null;
  };
  const num = (name) => (attr(name) == null ? null : Number(attr(name)));
  return {
    compositionId: attr('data-composition-id'),
    duration: num('data-duration'),
    start: num('data-start'),
    width: num('data-width'),
    height: num('data-height'),
  };
}

export function parseMomentBanners(html) {
  const out = [];
  MOMENT_RE.lastIndex = 0;
  let m;
  while ((m = MOMENT_RE.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

// `read` is injected so the whole lint is pure and testable against an in-memory
// tree; runLintTeasers supplies the real filesystem. Returning `null` means "no
// such file", which is a finding rather than a crash.
export function lintTeasers({ idea, read }) {
  const errors = [];
  const directions = idea?.directions ?? [];
  if (!directions.length) {
    errors.push({ code: 'IDEA-PREVIEW-MISSING', message: 'idea.json declares no directions' });
    return { errors };
  }

  for (const d of directions) {
    const html = read(d.id);
    if (html == null) {
      errors.push({
        code: 'IDEA-PREVIEW-MISSING',
        id: d.id,
        message: `direction '${d.id}' has no teaser at intro-film/teasers/${d.id}/index.html — `
          + 'every proposed direction must ship one, or the owner is back to judging prose',
      });
      continue;
    }

    const root = parseTeaserRoot(html);
    if (!root) {
      errors.push({ code: 'IDEA-PREVIEW-ROOT', id: d.id, message: `direction '${d.id}' teaser has no data-composition-id root` });
      continue;
    }
    if (root.duration == null || Math.abs(root.duration - TEASER_SECONDS) > EPSILON) {
      errors.push({
        code: 'IDEA-PREVIEW-LENGTH',
        id: d.id,
        message: `direction '${d.id}' teaser is ${root.duration}s, must be exactly ${TEASER_SECONDS}s — `
          + 'a longer teaser wins on runtime rather than on merit',
      });
    }
    if (root.width !== TEASER_WIDTH || root.height !== TEASER_HEIGHT) {
      errors.push({
        code: 'IDEA-PREVIEW-CANVAS',
        id: d.id,
        message: `direction '${d.id}' teaser canvas is ${root.width}x${root.height}, must be ${TEASER_WIDTH}x${TEASER_HEIGHT} `
          + '(Hyperframes reads the canvas from data-width/data-height, never from CSS)',
      });
    }

    // The arc is the idea, so the teaser has to visit every clause of it. A
    // teaser covering 2 of 4 clauses shows a different, smaller direction than
    // the one the owner would be approving.
    const arc = d.arc ?? [];
    const moments = parseMomentBanners(html);
    if (arc.length && moments.length !== arc.length) {
      errors.push({
        code: 'IDEA-PREVIEW-ARC',
        id: d.id,
        message: `direction '${d.id}' has ${arc.length} arc clause(s) but ${moments.length} moment banner(s) — `
          + 'the teaser must visit every clause, one /* --- mN : <clause> --- */ each, in order',
      });
    }
  }

  return { errors };
}

export function runLintTeasers(slug) {
  const workdir = resolveWorkdir(slug);
  const ideaFile = path.join(workdir, 'intro-film', 'idea.json');
  if (!fs.existsSync(ideaFile)) throw new Error(`missing ${ideaFile} — run the idea pass first (110)`);
  const idea = JSON.parse(fs.readFileSync(ideaFile, 'utf8'));
  const read = (id) => {
    const f = teaserHtml(workdir, id);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  return lintTeasers({ idea, read });
}

// `-o` MUST carry an extension (render-film.mjs learned this: an extensionless
// -o is read as an output FILE and the run dies at the audio mux), and the
// positional argument is the composition DIRECTORY relative to cwd.
export function renderArgs(id) {
  return ['-y', FILM_RENDERER, 'render', id,
    '--fps', '30', '--format', 'mp4', '--quality', 'high',
    '-o', `${id}.mp4`];
}

export function renderTeasers(slug) {
  const workdir = resolveWorkdir(slug);
  const { errors } = runLintTeasers(slug);
  // Lint BEFORE spending any encode. A teaser at the wrong length or missing
  // half its arc renders perfectly and misleads the gate, which is worse than
  // not rendering at all.
  if (errors.length) return { rendered: [], errors };

  const idea = JSON.parse(fs.readFileSync(path.join(workdir, 'intro-film', 'idea.json'), 'utf8'));
  const dir = teasersDir(workdir);
  const rendered = [];
  for (const d of idea.directions) {
    const out = teaserMp4(workdir, d.id);
    fs.rmSync(out, { force: true });
    const r = spawnSync('npx', renderArgs(d.id), { cwd: dir, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`hyperframes render failed for direction '${d.id}' (exit ${r.status})`);
    if (!fs.existsSync(out)) throw new Error(`render reported success but ${out} does not exist`);
    rendered.push(out);
  }
  return { rendered, errors: [] };
}

// Which directions the owner can actually WATCH. The gate reads this: approving
// a direction whose teaser was never rendered is approving prose again.
export function playableIds(workdir, idea) {
  return (idea?.directions ?? [])
    .map((d) => d.id)
    .filter((id) => fs.existsSync(teaserMp4(workdir, id)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/teasers.mjs <slug-or-path> [--lint-only]');
    process.exit(1);
  }
  try {
    const lintOnly = process.argv.includes('--lint-only');
    const { errors, rendered } = lintOnly ? { ...runLintTeasers(slug), rendered: [] } : renderTeasers(slug);
    for (const e of errors) console.error(`${e.code} ${e.message}`);
    if (errors.length) process.exit(1);
    console.log(lintOnly ? 'teasers: lint ok' : `teasers: rendered ${rendered.length}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/intro-film/teasers.mjs').then(m => console.log(m.TEASER_SECONDS, typeof m.lintTeasers))"` → `6 function`

### Step 2: The fixture tree and the unit suite

Create `lib/intro-film/fixtures/teasers/` with two direction folders, `a/` and `b/`,
each holding an `index.html`. Both are VALID — the mutation gate is what deletes one.

`lib/intro-film/fixtures/teasers/a/index.html`:

```html
<!DOCTYPE html><html><body>
<div id="root" data-composition-id="teaser-a" data-start="0" data-duration="6"
     data-fps="30" data-width="1920" data-height="1080"></div>
<script>
  /* ---------- m1 : five blank cards snap into a row ---------- */
  /* ---------- m2 : one card fills, the others grey out ---------- */
  /* ---------- m3 : the row collapses into a scored column ---------- */
</script>
</body></html>
```

`lib/intro-film/fixtures/teasers/b/index.html`: identical except
`data-composition-id="teaser-b"` and two moment banners (`m1`, `m2`).

Create `lib/intro-film/teasers.test.mjs`. Match `check-film-sync.test.mjs`'s shape:
`node:test` + `node:assert/strict`, one behaviour per test, a comment on any test
that encodes an incident. It must cover, at minimum:

1. `parseTeaserRoot` reads id/duration/start/width/height; returns `null` with no root.
2. `parseMomentBanners` returns the moment numbers in document order.
3. A valid two-direction idea + fixture tree lints clean.
4. **`IDEA-PREVIEW-MISSING`** when a direction has no teaser — read from the ON-DISK
   fixture tree via `fs`, so deleting `fixtures/teasers/b/index.html` makes this test
   fail. This is the mutation gate; it must not be satisfiable by an inline string.
5. `IDEA-PREVIEW-LENGTH` for a 4s teaser and for a missing `data-duration`.
6. `IDEA-PREVIEW-CANVAS` for a 1080x1920 root.
7. `IDEA-PREVIEW-ARC` when banner count ≠ arc clause count (3 clauses, 2 banners).
8. `renderArgs('a')` returns `['-y', <renderer>, 'render', 'a', '--fps', '30', '--format', 'mp4', '--quality', 'high', '-o', 'a.mp4']`.
9. Trailing-zero formatting (`data-duration="6.00"`) is NOT a length error.

Test 4 must resolve the fixture directory from `import.meta.dirname`, read each
direction's `index.html` with `fs.existsSync`/`fs.readFileSync` exactly as
`runLintTeasers` does, and assert the returned codes include `IDEA-PREVIEW-MISSING`
naming direction `b` when `b/index.html` is absent — and assert the clean tree
produces NO errors when it is present.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-film/teasers.test.mjs` → exit 0, `# fail 0`

**Verify (the gate really fires)**:
```
cd pipelines/video/visuals-flow
mv lib/intro-film/fixtures/teasers/b/index.html /tmp/b.html
node --test lib/intro-film/teasers.test.mjs 2>&1 | grep -c IDEA-PREVIEW-MISSING   # >= 1
mv /tmp/b.html lib/intro-film/fixtures/teasers/b/index.html
node --test lib/intro-film/teasers.test.mjs                                        # exit 0
```

### Step 3: The reject-with-notes round

`idea.json` gains two fields. Write this exact shape — do not invent an alternative:

```json
{
  "video": "<slug>",
  "round": 1,
  "chosen": null,
  "approved": false,
  "directions": [ ... ],
  "rejected": [
    { "round": 1, "note": "<owner's words>", "directions": [ ...the rejected ones... ] }
  ]
}
```

Add to `lib/board.mjs`, beside `handleApproveIntroIdea`:

```js
// Rejecting ALL directions is a first-class outcome, not an absence of approval.
// Without it the owner's only move was to say nothing, 110 re-ran blind, and
// round 2 proposed a near-copy of what round 1 was rejected for.
//
// The rejected directions are MOVED, not deleted: 110 reads them back so it can
// be told what not to do again, and the note is the owner's own words (never a
// session's paraphrase — see 630's "Quote, do not paraphrase" rule).
export const MAX_IDEA_ROUNDS = 3;

async function handleRejectIntroIdea(req, res, workdir) {
  const body = await readJsonBody(req);
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!note) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'a note is required — a rejection with no reason cannot steer the next round' }));
  }
  const ideaPath = path.join(workdir, 'intro-film', 'idea.json');
  if (!fs.existsSync(ideaPath)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'intro-film/idea.json does not exist yet' }));
  }
  const idea = JSON.parse(fs.readFileSync(ideaPath, 'utf8'));
  if (idea.approved === true) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'this idea gate is already approved' }));
  }
  const round = Number.isFinite(idea.round) ? idea.round : 1;
  idea.rejected = [...(idea.rejected || []), { round, note, directions: idea.directions || [] }];
  idea.directions = [];
  idea.chosen = null;
  idea.approved = false;
  idea.round = round + 1;
  fs.writeFileSync(ideaPath, JSON.stringify(idea, null, 2) + '\n');
  res.setHeader('content-type', 'application/json');
  return res.end(JSON.stringify({ ok: true, round: idea.round, exhausted: idea.round > MAX_IDEA_ROUNDS }));
}
```

Use whatever JSON-body helper `handleApproveIntroIdea` already uses in this file —
read it first and call the same one; do not add a second body parser.

Route it next to the existing approve route at `lib/board.mjs:1423`:

```js
  if (req.method === 'POST' && url.pathname === '/reject-intro-idea') {
    return handleRejectIntroIdea(req, res, workdir);
  }
```

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board-api.test.mjs lib/board.test.mjs` → exit 0

### Step 4: Approval requires something watchable

In `handleApproveIntroIdea`, after the existing `directions.some(d => d.id === chosen)`
check and before it writes, add:

```js
  // The whole point of this gate is that the owner WATCHED the direction. A
  // chosen id whose teaser was never rendered means they approved prose again,
  // which is the failure mode this plan exists to end.
  if (!fs.existsSync(teaserMp4(workdir, chosen))) {
    res.statusCode = 400;
    return res.end(JSON.stringify({
      ok: false,
      error: `direction '${chosen}' has no rendered teaser — run: bash run.sh <slug> intro-teasers`,
    }));
  }
```

Import `teaserMp4` from `./intro-film/teasers.mjs` at the top of `board.mjs`,
alongside the existing intro-film imports.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board*.test.mjs` → exit 0

### Step 5: Serve the teasers and surface them in board data

In `lib/board.mjs`, add a `GET /intro-teaser` route. Model it on the existing
`/intro-video` route (`lib/board.mjs:1325`) — **including its Range handling and its
`no-cache` validator behaviour**, because a teaser is rewritten under the same name
by every round and a `<video>` element that gets a bodyless 304 on a Range request
just stalls:

```js
  if (req.method === 'GET' && url.pathname === '/intro-teaser') {
    const id = url.searchParams.get('id');
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      res.statusCode = 400;
      return res.end('invalid direction id');
    }
    const videoPath = teaserMp4(workdir, id);
    ...same body as /intro-video from here down...
  }
```

The id regex is the path-traversal guard — mirror `/intro-frame`'s posture, which
rejects any `/` or `..`.

In `lib/board-data.mjs`, extend `introData`'s idea block so the tab can tell a
watchable direction from an unrendered one and can see the round state:

```js
    idea = {
      directions: ideaFile.directions || [],
      chosen: ideaFile.chosen ?? null,
      approved: ideaFile.approved === true,
      round: Number.isFinite(ideaFile.round) ? ideaFile.round : 1,
      rejected: ideaFile.rejected || [],
      // Which ids have an mp4 on disk. The tab disables approval on the rest
      // rather than letting the owner approve something they cannot watch.
      playable: playableIds(introDir.replace(/\/intro-film$/, ''), ideaFile),
    };
```

`playableIds` takes the WORKDIR, not the intro dir — pass `workdir` directly (it is
already the function's parameter); the `.replace` above is illustrative of the
mistake to avoid, not code to copy. Import `playableIds` from
`./intro-film/teasers.mjs`.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board-api.test.mjs` → exit 0

### Step 6: The verb

In `run.sh`, add an `intro-teasers` verb. Place it immediately after the existing
`intro-idea|intro-film|intro-review|intro-render)` case block, following that
block's exact shape including the `dry` guard:

```bash
  intro-teasers)
    # Renders one 6s teaser per proposed direction so gate 120 judges MOVING
    # pictures. Lints first — a teaser at the wrong length renders fine and
    # misleads the gate, which is worse than not rendering.
    dry "node lib/intro-film/teasers.mjs $slug" && exit 0
    node lib/intro-film/teasers.mjs "$slug"
    ;;
```

Add the verb to `steps/_verbs.json` as a helper (it deliberately is NOT a step —
see Current state):

```json
  "intro-teasers": {
    "kind": "helper",
    "after": "intro-idea",
    "summary": "renders one 6-second teaser per proposed intro direction, so gate 120 judges moving pictures instead of prose"
  }
```

**Verify**: `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check && bash scripts/test-run-sh.sh` → both exit 0

### Step 7: Drop the intro source from the Flow path

In `lib/flow-previews.mjs`, delete the `intro` row from `SOURCES`, leaving:

```js
export const SOURCES = [
  { kind: 'card', dir: 'card-previews', label: 'new-card look (240)' },
];
```

Update the file's header comment: the two-gate framing becomes one gate. State that
110 was removed on 2026-08-17 because real Hyperframes teasers superseded
AI-generated frames — same purpose, but the actual brand, renderer and motion — and
that 240 keeps the Flow path because approving a still IS the right artifact there
(the frames become the visual contract the card is built to match).

Update `lib/flow-previews.test.mjs` for the one-source shape. If any test asserted
two sources or named the intro dir, change the assertion to match the new truth —
this is a deliberate behaviour change, not an assertion being weakened to pass.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/flow-previews.test.mjs` → exit 0
**Verify**: `cd pipelines/video/visuals-flow && node lib/flow-previews.mjs consistent-ai-influencer 2>&1 | grep -ci "intro idea (110)"` → `0`

### Step 8: Rewrite the 110 authoring contract

In `steps/110-propose-intro-idea-llm/IDEA-PASS.md`:

- Keep every existing section — the inputs, "What each direction must carry", and
  especially **the "never propose a form whose meaning is 'not finished'"
  prohibition**, which is owner taste recorded three times on one film. None of that
  is superseded.
- Update the `idea.json` output shape to include `round`, `approved` and `rejected`
  (Step 3's shape).
- Add a section, **"Every direction ships a teaser"**, stating:
  - Author `intro-film/teasers/<id>/index.html` for every direction you propose.
  - Exactly `6` seconds, `1920x1080`, 30fps, `data-composition-id="teaser-<id>"`,
    `data-start="0"`, and a `window.__timelines['teaser-<id>']` registration
    (without it the render still succeeds but stalls 45s per worker).
  - It compresses the **arc**, not beat one: one visual moment per arc clause,
    evenly spaced across the 6 seconds, each opened by a banner comment
    `/* ---------- m1 : <the clause> ---------- */` in order. Banner count must
    equal arc clause count — `lib/intro-film/teasers.mjs` enforces it.
  - Real `card-library/DESIGN.md` tokens and real logos from
    `card-library/logos/registry.json`. No invented palette, no placeholder art.
  - No presenter/avatar and no audio — this gate judges the look and the arc.
  - Then run `bash run.sh <slug> intro-teasers`.
- Add a section, **"If the owner rejects every direction"**: read `rejected` from
  `idea.json` before proposing anything. Every entry's `note` is the owner's own
  words — quote them, do not paraphrase, and do not re-propose a direction that
  the note rules out. If `round` exceeds 3, STOP and ask the owner to describe the
  direction they want directly rather than proposing a fourth set.

In `steps/110-propose-intro-idea-llm/README.md`: replace the "Give the owner a FRAME
per direction" section (the Google Flow ask) with the teaser flow, add
`run.sh <slug> intro-teasers` to the Verbs table, and add
`intro-film/teasers/<id>/index.html` + `<id>.mp4` to the outputs. Keep the "Why it
lives before 025" section as it is.

**Verify**: `cd pipelines/video/visuals-flow && grep -c "idea-previews" steps/110-propose-intro-idea-llm/*.md lib/flow-previews.mjs` → `0` in every file

### Step 9: Record the decision

Prepend an entry to `pipelines/video/visuals-flow/decisions.md` (newest at top,
matching the existing `- **YYYY-MM-DD**:` shape) recording: the idea gate now judges
6-second moving teasers instead of prose; why (prose cannot show a look, so the owner
was approving words and rejecting the finished film); why the teaser compresses the
arc rather than showing beat one (three directions' opening beats can look identical
while their arcs differ, and the arc is the idea); that the fixed 6 seconds is not a
knob (a longer teaser wins on runtime, not merit); that rejection now carries the
owner's own words forward and is capped at 3 rounds; and that the Google Flow image
path was removed from 110 but deliberately kept for the 240 new-card gate.

**Verify**: `cd pipelines/video/visuals-flow && head -3 decisions.md | grep -c "2026-08-17"` → `1` or more

### Step 10: Full gate on a fresh checkout

```bash
cd pipelines/video/visuals-flow
git clean -ndx .        # inspect: nothing you created should be listed as junk
bash scripts/check.sh
```

`check.sh` builds `board-ui/dist` before running the board tests; do not skip it or
work around a failure by reordering it (`plans/runs/LESSONS.md`, 2026-07-31).

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, prints `visuals-flow check OK`

## Test plan

- New: `lib/intro-film/teasers.test.mjs`, following `lib/intro-film/check-film-sync.test.mjs`.
  One test per lint code plus the parsers and `renderArgs`. The
  `IDEA-PREVIEW-MISSING` test reads the on-disk fixture tree so the mutation recipe
  can fire on it.
- New fixture tree: `lib/intro-film/fixtures/teasers/{a,b}/index.html`.
- Changed: `lib/flow-previews.test.mjs` (one source, not two).
- Reached automatically by `check.sh`'s `find lib -name '*.test.mjs'` — do not add
  the new file to any hand-maintained list; that list was deliberately removed.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`
- [ ] `cd pipelines/video/visuals-flow && node --test lib/intro-film/teasers.test.mjs` exits 0 with `# fail 0`
- [ ] Deleting `lib/intro-film/fixtures/teasers/b/index.html` makes that suite FAIL printing `IDEA-PREVIEW-MISSING`; restoring it makes it pass
- [ ] `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` exits 0
- [ ] `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` exits 0
- [ ] `grep -r "idea-previews" pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps` returns nothing
- [ ] `grep -c "card-previews" pipelines/video/visuals-flow/lib/flow-previews.mjs` is ≥ 1 (the 240 path survives)
- [ ] `git status --porcelain pipelines/video/visuals-flow/videos` is EMPTY (no video workdir was touched)

## STOP conditions

- **Gate integrity**: if a gate assertion fails, fix the code or the fixture.
  Weakening, swapping, or deleting the assertion is a STOP. The one sanctioned
  assertion change is `flow-previews.test.mjs`'s source count in Step 7, which is a
  specified behaviour change.
- If `lib/steps.mjs` rejects anything you added with `E-REG`, STOP — do not "fix" it
  by making `intro-teasers` a step. The dynamic `produces` problem is why it is a
  helper verb, and that reasoning is in this plan's Current state.
- If any file under `pipelines/video/visuals-flow/videos/` changes, revert it and
  STOP. Real video workdirs carry render caches and ledger keys.
- If `board.mjs` has no reusable JSON-body helper for POST handlers, STOP and report
  rather than adding a second parser.
- If the mutation recipe cannot be made to fire against the fixture tree, STOP —
  a gate that cannot fire reads as coverage and is worse than no gate.
- If Hyperframes cannot render a 6-second composition from a subdirectory of
  `intro-film/teasers/`, STOP and report the exact command and error; do not
  restructure the output layout to work around it.

## Maintenance notes

- `TEASER_SECONDS` is deliberately not configurable. If it is ever made one, the
  gate stops comparing directions on equal terms.
- The moment-banner contract here is the same mechanism as
  `check-film-sync.mjs`'s beat banners, for the same reason. If one is changed,
  look at the other.
- `MAX_IDEA_ROUNDS = 3` is a backstop, not a policy the board enforces by refusing
  — the server reports `exhausted: true` and 110's contract is what STOPs. Plan 206
  surfaces it in the UI.
- A reviewer should scrutinise: the `/intro-teaser` Range handling (copied from
  `/intro-video` for a real reason), the id regex traversal guard, and whether
  `playableIds` was handed the workdir rather than the intro dir.
