---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: []
needs_prs: [194, 195, 196]
touches: [pipelines/video/visuals-flow/lib/intro-film/film-assets.mjs, pipelines/video/visuals-flow/lib/intro-film/film-assets.test.mjs, pipelines/video/visuals-flow/lib/intro-film/render-film.mjs, pipelines/video/visuals-flow/lib/avatar-plan.mjs, pipelines/video/visuals-flow/lib/avatar-plan.test.mjs, pipelines/video/visuals-flow/lib/avatar-render.mjs, pipelines/video/visuals-flow/lib/run-config.mjs, pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/board-ui/src/lib/router.ts, pipelines/video/visuals-flow/board-ui/src/tabs/AvatarTab.tsx, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps]

mutation_apply: python3 - <<'PY'
p='pipelines/video/visuals-flow/lib/avatar-render.mjs'
s=open(p).read()
marker='requireAvatarPlanApproved'
assert marker in s, 'marker missing — plan 197 Step 6 did not land'
s = s.replace('requireAvatarPlanApproved(workdir);', '// requireAvatarPlanApproved(workdir);')
open(p,'w').write(s)
PY
mutation_command: cd pipelines/video/visuals-flow && node --test lib/avatar-plan.test.mjs
mutation_expect: UNAPPROVED-AVATAR-SPEND
mutation_cwd:
mutation_timeout:
---

# Plan 197: visuals-flow — gate the intro idea and the avatar spend; stand in a still until render

## Summary

- **Problem statement**: three decisions are made with no owner checkpoint at the
  moment they matter. (1) The intro's **visual idea** is invented inside the
  screenplay pass, simultaneously with every beat and timing, so the first time
  the owner judges it is after a composition has been built and encoded — which
  is how a progress-spinner seal shipped (2026-08-07). (2) The **HeyGen model** is
  chosen at kickoff via `run-config.engine`, twenty steps before any avatar is
  planned, pre-authorising metered spend against a number nobody has computed.
  (3) Real avatar video is baked in from the very first intro render, so every
  review cycle re-encodes megabytes of talking head to judge motion graphics.
- **Goals**:
  - Split the intro's idea from its execution: a prose **idea pass** with its own
    cheap gate, before any beat is written.
  - Add an **avatar spend gate**: propose character + model + clip count + cost;
    generate nothing until the owner confirms. Remove `engine` from kickoff.
  - Use a **static image stand-in** for the avatar everywhere before the render
    phase, and add an explicit intro re-render once the real clips exist.
  - Gate it: `UNAPPROVED-AVATAR-SPEND` fails if HeyGen can be reached unapproved.
- **Executor proposed**: `claude-p` / sonnet — the intro-idea step is a
  quality-setting **authoring contract** (prompt + rubric prose the owner judges
  by taste), which `tooling/boss/data/rules.md` routes away from the agy default.
- **Done criteria** (terse — full list below): `check.sh` exits 0; `engine` is
  gone from `run-config`; `avatar-plan.json` gates every HeyGen submission; the
  intro renders with a still stand-in and re-renders after 4xx.
- **Stop conditions** (terse — full list below): a stand-in that renders as an
  empty box; a HeyGen call reachable unapproved; any renumbering.
- **Test / verification for success**: `scripts/check.sh`, a new
  `lib/avatar-plan.test.mjs`, a rendered-frame inspection of the stand-in, and a
  mutation proving the spend gate can fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/board-ui`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 194 (run-config shape), 195 (board tab surface), 196 (step-declaration schema and the `checks/` report contract)
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

**The intro idea.** `steps/025-author-intro-film-llm/AUTHORING.md` sends the
model straight from inputs to `screenplay.json` — the central object, its
transformations and the motif vocabulary are decided in the same pass as every
timing. The owner's only checkpoint is after the composition is built. On
2026-08-07 that produced a seal drawn as a progressively-filling accent arc:
the screenplay itself asked for *"an arc that is clearly incomplete by the end of
the beat"*, which is the construction every loading spinner uses. A one-page
idea gate would have cost a minute to reject. Instead it cost a build, an encode
and a round of owner review. Text is the cheapest thing to reject, and nothing
in this pipeline currently rejects text.

**The avatar spend.** `run-config.engine` is documented as the authorisation
itself: *"heygen4 (Avatar IV, METERED vs the monthly second-pool; setting it here
IS the owner's explicit authorization for this video)"*. It is set at step 005,
before `shots.json` exists, so the authorisation is given against an unknown
number of clips and seconds. The owner's instruction is explicit: *"always ask
before rendering which avatar and which heygen model you are using (propose),
after confirmation only, make avatar videos from heygen."*

**The stand-in.** The intro composition composites a real `avatar.mp4` today, so
every review render carries her. The owner reviews motion graphics far more often
than performance, and the one avatar defect this film hit — a daylight-lit room
against a near-black field — is a *lighting and grade* mismatch a still shows
just as well as video. Owner decision 2026-08-07: static image everywhere until
the render phase.

## Current state

All paths relative to `pipelines/video/visuals-flow/` unless noted.

### How the film gets its avatar

`lib/intro-film/film-assets.mjs` symlinks the workdir's media into the
composition so hyperframes' checks are not vacuous:

```js
export const FILM_MEDIA = ['vo.mp3', 'avatar.mp4'];

export function linkFilmMedia(slug, { media = FILM_MEDIA } = {}) {
  const workdir = resolveWorkdir(slug);
  const assets = filmAssetsDir(slug);
  fs.mkdirSync(assets, { recursive: true });
  const linked = [];
  const missing = [];
  for (const name of media) {
    const src = path.join(workdir, '..', name);
    if (!fs.existsSync(src)) { missing.push(name); continue; }
    const dest = path.join(assets, name);
    if (fs.lstatSync(dest, { throwIfNoEntry: false })) fs.rmSync(dest);
    fs.symlinkSync(path.resolve(src), dest);
    linked.push(name);
  }
  return { linked, missing, dir: assets };
}
```

The composition references `assets/avatar.mp4` and **must keep doing so** —
`<video id="avatar" src="assets/avatar.mp4">` is authored per video, and the
comment in `film-assets.mjs` is explicit that a path traversing above the project
root makes every hyperframes check vacuous.

**Design consequence**: the stand-in must appear at `assets/avatar.mp4` as a
*video file*, not as an image, or every composition breaks. A 1-frame looped
still encoded to mp4 satisfies both.

### The engine decision

`lib/run-config.mjs` (post-194) keeps `engine: 'heygen3'` in `DEFAULTS` and
validates it. `lib/avatar-render.mjs` lines ~138–148 cross-checks it:

```js
    const runCfg = loadRunConfig(workdir);
    if (runCfg.configured) {
      const want = runCfg.engine === 'heygen4' ? 'production' : 'test';
      if (shotsFile.engineMode !== want) {
        console.error(`run-config engine=${runCfg.engine} expects engineMode "${want}" but shots.json says "${shotsFile.engineMode}" — align them (edit shots.json, re-run resolve-shots) before submitting`);
        process.exit(1);
      }
    }
```

This cross-check exists because two spellings of one decision drifted. Moving the
decision to a single approved artifact removes the need for it entirely.

### The character registry

`pipelines/video/heygen/registry.json` at `2e2dd69d`:

```json
{
  "girl-1":      { "template_id": "7629dffbebe141eb8f701630948bd707", "description": "Girl — soft-voice tutorial template (avatar bubble + background), 16:9. THE girl template (owner 2026-08-02)." },
  "specs-man":   { "template_id": "403f1f8c49d64c58bd3168f99a58bb0a", "image": "characters/specs-man/source.jpeg", "description": "Man with Specs Black Shirt — THE man template (owner 2026-07-28, reaffirmed 2026-08-02)." },
  "side-avatar": { "image": "characters/side-avatar/source.jpeg", "description": "Side-view 'working at laptop' woman for the fal-lipsync flow" }
}
```

The registry is read by the **avatar plan** (Step 6) to list selectable
characters. It is NOT the source of the stand-in image: `girl-1` carries no
`image`, and rather than making the stand-in depend on per-character art, Step 4
hardcodes one photograph for every video (owner 2026-08-07 — *"use any avatar
image, hardcode it. doesn't matter"*). Four real photographs already exist under
`pipelines/video/heygen/characters/`: `bearded-man-1`, `side-avatar`,
`specs-man`, `woman-laptop`, each `source.jpeg`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, `visuals-flow check OK` |
| Avatar plan tests | `cd pipelines/video/visuals-flow && node --test lib/avatar-plan.test.mjs` | exits 0 |
| Film assets tests | `cd pipelines/video/visuals-flow && node --test lib/intro-film/film-assets.test.mjs` | exits 0 |
| Registry doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exits 0 |
| Build a stand-in by hand | `ffmpeg -loop 1 -i <img> -t 1 -r 30 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -pix_fmt yuv420p -y assets/avatar.mp4` | writes a 1s 1920x1080 mp4 |
| Inspect a rendered frame | `ffmpeg -ss <t> -i <mp4> -frames:v 1 -y /tmp/f.png` then LOOK at it | a frame you have actually viewed |

## Scope

**In scope**:
- New `lib/avatar-plan.mjs` + `lib/avatar-plan.test.mjs`
- `lib/avatar-render.mjs` (gate on the plan; delete the `engine` cross-check)
- `lib/run-config.mjs` (remove `engine`)
- `lib/intro-film/film-assets.mjs` + its test (stand-in mode)
- `lib/intro-film/render-film.mjs` (accept a stand-in; label the output a proof)
- New step folders: `026-propose-intro-idea-llm`, `028-approve-intro-idea-human`,
  `102-propose-avatar-human`, `108-rerender-intro-film-run`
- `steps/025-author-intro-film-llm/AUTHORING.md` (consume the approved idea)
- `lib/board.mjs` + `board-ui` (an Avatar tab for the 102 gate; the Intro tab
  gains the idea gate)
- `run.sh`, `PIPELINE.md` (regenerated)

**Out of scope** — looks related, do not touch:
- **Renumbering.** Plan 198 owns every number and rename, in one pass, with the
  ledger migration. The numbers here (026, 028, 102, 108) are free slots chosen
  only so they sort correctly; they are temporary.
- **The screenplay schema** (`lib/intro-film/screenplay-schema.mjs`). The idea
  pass writes a NEW artifact; it does not change the screenplay's shape.
- **The film composition** of any existing video. `videos/*/intro-film/film/index.html`
  is authored content. The stand-in works precisely because the composition's
  `assets/avatar.mp4` contract does not change.
- **`shots.json`'s `engineMode` field.** Leave the field; only the run-config
  cross-check goes. Plan 198 may retire it.
- **The 120 final-cut gate.**

## Git workflow

- Branch: `advisor/197-vf-intro-idea-gate-and-avatar-spend-gate`
- Commit per step, message `plan 197 step N: <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm a green baseline

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exits 0. If red before you change anything, STOP.

### Step 2: `026-propose-intro-idea-llm` — the idea pass

Create `steps/026-propose-intro-idea-llm/step.json`:

```json
{
  "number": "026",
  "slug": "026-propose-intro-idea-llm",
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
  "summary": "`transcript.json` + `segments.json` + `concept.json` -> `intro-film/idea.json`: 2-3 competing visual directions for the intro, one page each. Prose only — no beats, no timings, no code. The cheapest place to reject an intro."
}
```

Create `steps/026-propose-intro-idea-llm/IDEA-PASS.md`, the authoring contract.
It must require, per direction:

- **the central object** — the one thing on stage that carries the film, and what
  it IS (a card, a frame, a column). One noun.
- **its arc** — how that object transforms across the intro's beats, in three to
  five clauses. This is the idea; everything else is decoration.
- **the motif vocabulary** — the two or three visual moves the film is allowed to
  reuse, named.
- **how it enacts the through-line** from `concept.json`, quoted.
- **what it deliberately does NOT do** — the nearest obvious treatment it rejects,
  and why.

And it must carry this prohibition verbatim, because it is the specific defect
this step exists to catch:

> **Never propose a form whose meaning is "not finished".** A dashed outline
> means "drop content here". A grey figure means "no avatar set". An arc filling
> a ring means "loading". These are the agreed signs for *nothing is here yet*,
> and used as final art they tell the viewer the film is unfinished whatever you
> intended. This includes a gesture deliberately left incomplete for a later beat
> to finish: **every visual form of "incomplete" is a placeholder or a wait
> state** — that is what incomplete means. If a beat needs a payoff, give the
> later beat a NEW object to deliver, never the completion of a half-drawn one.
> (Owner, three times on one film: dashed sponsor wells and grey silhouettes
> 2026-08-06, the drawing seal 2026-08-07. See `TASTE-INTRO.md` T12.)

`idea.json` shape — inline it in the contract:

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

Add a `run.sh` case dispatching `intro-idea` to print the contract, mirroring how
`intro-film` prints its authoring prompt.

**Verify**: `node lib/steps.mjs verbs | grep -c "^intro-idea$"` → `1`

### Step 3: `028-approve-intro-idea-human` — the gate

Create `steps/028-approve-intro-idea-human/step.json`:

```json
{
  "number": "028",
  "slug": "028-approve-intro-idea-human",
  "title": "approve the intro idea",
  "actor": "human",
  "actorLabel": "[OWNER]",
  "verbs": [],
  "consumes": ["intro-film/idea.json"],
  "produces": [],
  "gate": { "file": "intro-film/idea.json", "field": "approved", "label": "Intro Idea" },
  "tab": "intro",
  "external": false,
  "optional": false,
  "nextHint": "read intro-film/idea.json, then approve a direction on the board's Intro tab  (HUMAN GATE — 028 intro idea)",
  "summary": "`intro-film/idea.json` -> `approved: true` plus `chosen: \"<id>\"` (HUMAN GATE: Intro Idea). Reject all three and the idea pass runs again. A page of prose is the cheapest rejection in the pipeline."
}
```

On the board's **Intro tab**, render the directions when `idea.json` exists and
`approved` is false, with one button per direction that POSTs
`/approve-intro-idea` with the chosen id. Approving sets **both** `chosen` and
`approved: true` — an approval with no `chosen` is meaningless, so write them in
one operation and reject a POST with no id.

Then make `025` consume the decision: add `intro-film/idea.json` to its
`consumes`, and add to `AUTHORING.md` — near the top, before "Your job":

> **Read `intro-film/idea.json` first and take the direction whose `id` equals
> `chosen`.** Its central object, arc and motif vocabulary are decided; you are
> writing beats that enact them, not choosing a new treatment. If the chosen
> direction cannot carry a beat, say so and STOP — do not quietly substitute
> another idea, which is how the idea and its execution collapsed into one
> unreviewable pass in the first place.

**Verify**: `node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps().find(x=>x.number==='028');console.log(s.gate.label, s.tab)})"`
→ `Intro Idea intro`

### Step 4: one hardcoded stand-in image

The stand-in exists so the owner can judge **layout, framing and grade** before
any HeyGen second is spent. Which face it shows does not matter and must not
become a decision — owner, 2026-08-07: *"use any avatar image, hardcode it.
doesn't matter"*.

So: one constant, one real photograph already in the repo. Add to
`lib/intro-film/film-assets.mjs`:

```js
// The avatar stand-in used by every pre-render intro build. Deliberately ONE
// hardcoded real photograph rather than a per-character lookup: the stand-in is
// judged for framing, size and grade against the design, never for who it is
// (owner 2026-08-07 — "use any avatar image, hardcode it. doesn't matter").
// A real photo and not a generated grey figure, because a grey figure is the
// "no avatar set" icon and gets reviewed as final art (owner, three times:
// 2026-08-06 silhouettes and dashed wells, 2026-08-07 the drawing seal).
export const STAND_IN_IMAGE = path.resolve(
  import.meta.dirname, '..', '..', '..', 'heygen', 'characters', 'side-avatar', 'source.jpeg',
);
```

Verify that path resolves from `lib/intro-film/` — the file is at
`pipelines/video/heygen/characters/side-avatar/source.jpeg` and this module lives
at `pipelines/video/visuals-flow/lib/intro-film/`, so it is three levels up to
`pipelines/video/`. Three other images exist under `heygen/characters/`
(`bearded-man-1`, `specs-man`, `woman-laptop`) if this one turns out to be
unusable; pick another and move on rather than stopping.

**No registry change.** `pipelines/video/heygen/registry.json` is not touched by
this plan.

**Verify**: `node -e "import('./lib/intro-film/film-assets.mjs').then(async m=>{const fs=await import('node:fs');console.log(fs.existsSync(m.STAND_IN_IMAGE))})"`
→ `true`

### Step 5: `film-assets.mjs` — stand-in mode

Add to `lib/intro-film/film-assets.mjs`:

```js
import { execFileSync } from 'node:child_process';

// The avatar is a STILL until the render phase (owner 2026-08-07). Every review
// before 4xx judges motion graphics, and the one avatar defect this film hit —
// a daylight-lit room against a near-black field — is a grade mismatch a still
// shows as well as video. So we do not spend HeyGen seconds to review a card.
//
// It is encoded to mp4 rather than linked as an image ON PURPOSE: the
// composition references `assets/avatar.mp4` in a <video> element, and that
// contract is authored per video. A 1-second still video keeps every
// composition, every hyperframes check and every selector working unchanged.
export function buildAvatarStandIn(slug, imagePath) {
  const dest = path.join(filmAssetsDir(slug), 'avatar.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.lstatSync(dest, { throwIfNoEntry: false })) fs.rmSync(dest);
  execFileSync('ffmpeg', [
    '-loop', '1', '-i', imagePath, '-t', '1', '-r', '30',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
    '-pix_fmt', 'yuv420p', '-y', dest,
  ], { stdio: 'pipe' });
  return dest;
}
```

`linkFilmMedia` gains an option: when `avatar.mp4` is **missing** from the
workdir, and a `standInImage` is supplied, build the stand-in instead of
reporting it missing. Return it in a new `standIn: true|false` field so callers
can tell the two apart — a caller that cannot distinguish a real avatar from a
stand-in will eventually ship one.

**Verify**: `node --test lib/intro-film/film-assets.test.mjs` → exits 0, with a
new test asserting `standIn === true` when the workdir has no `avatar.mp4`, and
that the produced file is a readable mp4 of the expected dimensions
(`ffprobe -v error -show_entries stream=width,height` → `1920`/`1080`).

### Step 6: `lib/avatar-plan.mjs` — the spend gate

Create `lib/avatar-plan.mjs` exporting:

- `buildAvatarPlan({ workdir, shotsResolved, registry })` → an object:

```js
{
  video, character: null, model: null,
  clips: <count>, seconds: <total>,
  candidates: [{ id, description, hasTemplate, hasImage }],
  models: ['heygen3', 'heygen4'],
  approved: false,
}
```

`clips` and `seconds` come from `shots.resolved.json` — the real numbers, which is
the entire reason this decision moved here from kickoff.

- `requireAvatarPlanApproved(workdir)` — throws unless `avatar-plan.json` exists
  with `approved === true`, a non-null `character` and a non-null `model`. The
  message must name what is missing.

In `lib/avatar-render.mjs`, inside the `if (opts.submit)` block and **before any
network call**, call `requireAvatarPlanApproved(workdir);`. Then **delete** the
`runCfg.engine` / `engineMode` cross-check quoted in Current state and the
`loadRunConfig` import if nothing else uses it — the plan is now the single
spelling of the decision, so there is nothing left to disagree with.

Remove `engine` from `lib/run-config.mjs`'s `DEFAULTS`, its `ENGINES` validator,
and the `--engine` flag in `main()`'s usage. After this, `run-config.json` holds
only the source/delivery fields.

**Verify**: `grep -c "loadRunConfig" lib/avatar-render.mjs` → `0`;
`node -e "import('./lib/run-config.mjs').then(m=>console.log(JSON.stringify(m.loadRunConfig('videos/consistent-ai-influencer'))))"`
→ no `engine`, no `review`, no `intro` key

### Step 7: `102-propose-avatar-human` — the gate declaration and its tab

`steps/102-propose-avatar-human/step.json`:

```json
{
  "number": "102",
  "slug": "102-propose-avatar-human",
  "title": "propose the avatar and model",
  "actor": "human",
  "actorLabel": "[OWNER]",
  "verbs": ["avatar-plan"],
  "consumes": ["shots.resolved.json"],
  "produces": ["avatar-plan.json"],
  "gate": { "file": "avatar-plan.json", "field": "approved", "label": "Avatar Spend" },
  "tab": "avatar",
  "external": false,
  "optional": false,
  "nextHint": "run.sh <slug> avatar-plan, then pick a character and model on the board's Avatar tab  (HUMAN GATE — 102 avatar spend)",
  "summary": "`shots.resolved.json` + the character registry -> `avatar-plan.json`: which character, which HeyGen model, how many clips and how many seconds. HARD STOP — nothing is submitted to HeyGen until this is approved. Avatar IV is metered against the monthly second-pool, and this is where that spend is authorised, against real numbers rather than at kickoff against none."
}
```

Add an `avatar` tab: a row in `board-ui/src/lib/router.ts`'s `TAB_TABLE` (after
`storyboard`), a `board-ui/src/tabs/AvatarTab.tsx` listing candidates with their
clip/second totals and cost implication, and a `POST /approve-avatar-plan` route
in `lib/board.mjs` that writes `character`, `model` and `approved: true`
together. A POST missing either field must be refused.

**Degraded state, required**: when `shots.resolved.json` does not exist yet the
tab renders "the storyboard has not been resolved yet — run `run.sh <slug>
storyboard-check`" and **every button is disabled with a `title` explaining why**.
An enabled button over absent data is the recurring board defect
(LESSONS 2026-07-24).

**Verify**: `cd board-ui && npx vitest run` → exits 0; `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`

### Step 8: `108-rerender-intro-film-run` — swap the still for the real clip

`steps/108-rerender-intro-film-run/step.json`:

```json
{
  "number": "108",
  "slug": "108-rerender-intro-film-run",
  "title": "re-render the intro film with the real avatar",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["intro-rerender"],
  "consumes": ["avatar.mp4", "intro-film/screenplay.json"],
  "produces": ["intro-film/out/intro.mp4"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": false,
  "summary": "the real `avatar.mp4` + the approved screenplay -> a final `intro-film/out/intro.mp4`. The intro approved at the 1xx gate was rendered against a static stand-in; this is the encode that ships. Fails if the workdir still has no real avatar."
}
```

`run.sh`'s `intro-rerender)` case runs the existing render with stand-in mode
**off**, and must fail non-zero when `videos/<slug>/avatar.mp4` is absent.

In `lib/intro-film/render-film.mjs`, when the render used a stand-in, print a
clearly-marked line — `note: rendered with a STATIC avatar stand-in; run.sh <slug> intro-rerender after 103` —
and record `standIn: true` in whatever result artifact it writes, so a reviewer
cannot mistake the proof for the deliverable.

**Verify**: `node lib/steps.mjs verbs | grep -c "^intro-rerender$"` → `1`

### Step 9: regenerate, gate, inspect, and prove the spend gate fails

```bash
cd pipelines/video/visuals-flow
node scripts/gen-pipeline-table.mjs
bash scripts/check.sh
```

**Render-and-look (required — agy/visual rider).** Build a stand-in from the
`girl-1` image, render `consistent-ai-influencer`'s intro against it, extract
frames at 0.5s, 22s and 88s, and **look at them**. The presenter must appear as a
still image composed into the design — not a black rectangle, not a stretched
frame, not a grey box. Commit those three frames as the `ui: true` evidence.

Then run the frontmatter mutation: comment out `requireAvatarPlanApproved`,
confirm `node --test lib/avatar-plan.test.mjs` **fails** printing
`UNAPPROVED-AVATAR-SPEND`, revert, confirm green.

**Verify**: `check.sh` exits 0; three frames committed and viewed; mutation fails
with the expected string.

## Test plan

- `lib/avatar-plan.test.mjs`: `requireAvatarPlanApproved` throws when the file is
  absent, when `approved` is false, and when `character` or `model` is null; and
  passes when all three are set. Every assertion message carries
  `UNAPPROVED-AVATAR-SPEND`.
- `lib/intro-film/film-assets.test.mjs`: a new test asserting `standIn: true` when
  the workdir lacks `avatar.mp4`, `standIn: false` when it has one, and that the
  generated stand-in is a 1920x1080 mp4.
- The board-ui vitest suite plus `board-ui-smoke.mjs` cover the two new tabs and
  the disabled-button degraded state.
- Frame inspection covers the one thing no assertion can: that the stand-in
  actually looks like a person composed into the design.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `node -e "const c=require('./videos/consistent-ai-influencer/run-config.json'); const m=require('./lib/run-config.mjs')"` — `loadRunConfig` returns no `engine`, `review` or `intro` key
- [ ] `grep -c "engineMode" lib/avatar-render.mjs` → `0` for the run-config cross-check (the `shots.json` field itself may remain)
- [ ] `node --test lib/avatar-plan.test.mjs lib/intro-film/film-assets.test.mjs` exits 0
- [ ] `ls steps/ | grep -c "026-propose-intro-idea-llm\|028-approve-intro-idea-human\|102-propose-avatar-human\|108-rerender-intro-film-run"` → `4`
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0
- [ ] Three inspected intro frames committed showing the still stand-in composed into the design
- [ ] The frontmatter mutation makes `avatar-plan.test.mjs` fail printing `UNAPPROVED-AVATAR-SPEND`; reverting restores green

## STOP conditions

- **1. The stand-in renders as a black, grey or empty frame.** If the ffmpeg encode
  produces something the composition renders as an empty box, STOP. A stand-in
  the owner cannot judge is worse than no stand-in.
- **2. Any renumbering or renaming of an existing step folder.** Plan 198 owns
  every rename in one pass with the ledger migration.
- **3. A HeyGen call can be reached without an approved plan.** If any code path
  in `avatar-render.mjs` submits before `requireAvatarPlanApproved`, STOP — that
  is the whole point of the plan.
- **4. Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, `skip`-ing or deleting an assertion is a STOP.
- **5. `--force` becomes a spend bypass.** `--force` exists for the storyboard
  gates. It must NOT skip `requireAvatarPlanApproved`; metered spend is not a
  developer convenience. If the existing `--force` plumbing makes that awkward,
  STOP and report rather than wiring it through.

## Maintenance notes

- **Plan 4 of 5** (194 → 195 → 196 → **197** → 198). The numbers used here
  (026, 028, 102, 108) are temporary free slots; plan 198 renumbers everything
  into `0xx`–`6xx` phase buckets and migrates the ledgers.
- **The intro is approved against a stand-in.** That is a deliberate owner
  decision, and `108` is what makes it safe. If `108` is ever skipped, the video
  ships with a still where the presenter should be — so its declaration is
  `optional: false` on purpose and must stay that way.
- **`TASTE-INTRO.md` T12** is the prose source for Step 2's prohibition. If T12
  changes, the idea-pass contract must change with it — they are two copies of
  one rule, and the contract is the one the model actually reads.
- **A reviewer should scrutinise**: that the avatar plan's `seconds` figure is
  derived from `shots.resolved.json` rather than estimated (an authorisation
  against a made-up number is no better than the kickoff flag it replaces), and
  that `linkFilmMedia`'s new `standIn` field is actually consumed rather than
  merely returned.
