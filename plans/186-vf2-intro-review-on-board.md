---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: ["185 must land first — this tab reads the review artifacts 185 produces"]
needs_prs: [144]
touches: [pipelines/video/visuals-flow-2/lib/board.mjs, pipelines/video/visuals-flow-2/lib/board-data.mjs, pipelines/video/visuals-flow-2/board-ui/src/lib/router.ts, pipelines/video/visuals-flow-2/board-ui/src/App.tsx, pipelines/video/visuals-flow-2/run.sh, pipelines/video/visuals-flow-2/scripts/check.sh, pipelines/video/visuals-flow-2/PIPELINE.md]

mutation_apply: cd pipelines/video/visuals-flow-2 && sed -i '' "s/if (!intro.approved)/if (false \&\& !intro.approved)/" lib/intro-film/approve.mjs
mutation_command: cd pipelines/video/visuals-flow-2 && node --test lib/intro-film/approve.test.mjs
mutation_expect: not ok 1 - intro approval gate
mutation_timeout: 300
---

# Plan 186: vf2 — owner review of the intro film, on the board

## Summary

- **Problem statement**: Plan 185 makes vf2 produce a bespoke intro film and a pre-render review pack (beat frames, contact sheets, `REVIEW.md`), but the owner can only see it by opening PNGs on disk. Every other owner gate in vf2 — the card plan (037), the storyboard (080), the final cut (120) — is reviewed on the board. The intro has no such gate, so the one artifact whose quality is entirely a matter of the owner's taste is the one he cannot review where he reviews everything else.
- **Goals**:
  - Add an **Intro** tab to `board-ui` following the existing tab pattern, showing the beat frames grouped by beat, each paired with the `stage` line it is supposed to satisfy, plus the mechanical findings from the review pass.
  - Add gate step `027-approve-intro-film-human`: `intro-film/screenplay.json` carries `approved: true`, written by the board, and the render refuses without it.
  - Make the gate honour the existing `review: express` kickoff choice the same way 037/080 do — via `gateWaived`, never by a new mechanism.
- **Executor proposed**: `claude-p` / `sonnet` — React UI work judged by the owner's eye, which `tooling/boss/data/rules.md` routes away from the agy default.
- **Done criteria** (terse — full list below): `scripts/check.sh` green with new tests registered; the tab renders frames grouped by beat; render refuses without approval; a committed screenshot of the tab.
- **Stop conditions** (terse — full list below): touching any of the six concurrent-branch files; hand-rolling a second approval mechanism instead of `gateWaived`; weakening a gate assertion.
- **Test / verification for success**: `node --test` on the pure approval logic and the board route, `scripts/board-ui-smoke.mjs` for the tab, plus a committed screenshot (boss rejects a `ui: true` branch without one).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6817afed..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — the tab is additive and the gate only guards a step that is itself off by default.
- **Depends on**: plan 185 (PR #144). Do not start until it has merged.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `6817afed`, 2026-08-03

## Why this matters

The owner asked for this directly (2026-08-03): *"also i want review step for intro
as well... on storyboard."*

There is a sharper reason than symmetry. The intro film's failures are almost all
of a kind no machine catches. Across three review passes the mechanical checker
was clean while the film had a crown landing on the presenter (arguing the
opposite of the narration), four assessment rails at 2px/20% opacity that were
invisible on screen, and a label doing a graphic's job. Each was found only by a
human or a model LOOKING at a frame and comparing it to what the beat was
supposed to do.

That is exactly why the tab must pair each frame with its `stage` line rather
than being a plain gallery. The comparison is the review.

## Current state

### The tab pattern to follow

`board-ui/src/lib/router.ts` (read it in full before editing — this is the whole file's shape):

```ts
export type Tab = 'run' | 'card-plan' | 'storyboard' | 'final-cut' | 'calibrate';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'card-plan', label: 'Card Plan' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'final-cut', label: 'Final Cut' },
];
const HASH_TAB: Record<string, Tab> = {
  '#card-plan': 'card-plan', '#storyboard': 'storyboard', '#final-cut': 'final-cut', '#calibrate': 'calibrate'
};
export const TAB_HASH: Record<Tab, string> = {
  run: '', 'card-plan': '#card-plan', storyboard: '#storyboard', 'final-cut': '#final-cut', calibrate: '#calibrate'
};
```

Note `calibrate` is in `Tab` and the hash maps but NOT in `TABS` — that is how a
tab is reachable by URL without appearing in the tab bar. Intro must appear in
`TABS`, so add it in all four places.

`board-ui/src/tabs/` holds `RunTab.tsx`, `CardPlanTab.tsx`, `StoryboardTab.tsx`,
`FinalCutTab.tsx`, `CalibrateTab.tsx`, each with an optional sibling `.css`.
**Exemplar: `CardPlanTab.tsx`** — it is the closest shape (a list of items, each
with an approve action) and the smallest of the review tabs at 9.0K.

### The server

`lib/board.mjs` routes by exact pathname. Existing shapes to copy:

```js
if (req.method === 'GET'  && url.pathname === '/api/board-data')     { ... }
if (req.method === 'POST' && url.pathname === '/approve-card-plan')  { ... }
if (req.method === 'GET'  && url.pathname === '/vo.mp3')             { ... }   // binary file serving
```

`/vo.mp3` is the pattern for streaming a file out of the video workdir; the intro
frame route copies it.

### The gate pattern

`lib/run-config.mjs` exports `gateWaived(workdir, gateName)`, which returns
`true` under `review: express` and logs a note. The 037 and 080 gates call it
instead of testing `approved` directly. The 120 final-cut gate deliberately does
NOT route through it. The intro gate is a review gate, so it DOES use
`gateWaived` — it is in the same class as 037/080.

### Artifacts 185 leaves on disk

```
videos/<slug>/intro-film/
  screenplay.json          # beats: id, intent, register, face, clause, stage, t_start, t_end
  review/
    REVIEW.md
    check.json             # the mechanical findings
    frame-NN-at-T.png      # 3 per beat, at 25/55/85% through it
    contact-sheet-N.jpg
```

### Two traps recorded in LESSONS

- **`scripts/check.sh` builds `board-ui/dist` FIRST** because `board.test.mjs`
  fetches `/`, which serves that build. On a fresh checkout `dist` is gitignored,
  so the suite fails without it (found 2026-07-31). Do not reorder check.sh.
- **A `node:test` file that opens an HTTP server hangs the whole suite forever**
  if an assertion fires before `server.close()` — 0% CPU, no output, invisible.
  Any new test that starts the board server needs a `test.after` that
  force-closes tracked servers. `lib/board.test.mjs` already does this; copy it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Board UI unit tests | `cd pipelines/video/visuals-flow-2/board-ui && npx vitest run` | exit 0 |
| Build the board UI | `cd pipelines/video/visuals-flow-2/board-ui && npm run build` | exit 0, writes `dist/` |
| Board smoke | `cd pipelines/video/visuals-flow-2 && node scripts/board-ui-smoke.mjs` | exit 0 |
| Serve the board | `cd pipelines/video/visuals-flow-2 && bash run.sh <slug> board` | server URL printed |

## Scope

**In scope**:
- `board-ui/src/lib/router.ts`, `board-ui/src/App.tsx`
- `board-ui/src/tabs/IntroTab.tsx` + `IntroTab.css` — NEW
- `lib/board.mjs`, `lib/board-data.mjs`
- `lib/intro-film/approve.mjs` (+ `.test.mjs`) — NEW
- `steps/027-approve-intro-film-human/README.md` — NEW
- `run.sh`, `scripts/check.sh`, `PIPELINE.md`
- `docs/` screenshot committed for the `ui: true` gate

**Out of scope** — do NOT touch:
- `lib/avatar-render.mjs`, `lib/export-timeline.mjs(+test)`, `lib/lint-shots.mjs(+test)`,
  `lib/resolve-shots.mjs`, `lib/shot-constants.mjs`, `lib/sound/build-mix.mjs`,
  `steps/060-place-avatar-llm/shot-pass-prompt.md`, `steps/140-davinci-export-run/README.md`,
  `tests/TESTS.md` — held by a concurrent session's unmerged branch.
- `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, `lib/assemble.mjs` — plan 187.
- `pipelines/video/card-library/**` — read-only.

## Git workflow

- Branch: `advisor/186-vf2-intro-review-on-board`
- Commit per step: `feat(vf2): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: The approval gate, as pure logic first

Create `lib/intro-film/approve.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { gateWaived } from '../run-config.mjs';

// The intro film is judged almost entirely by eye. Across three review passes
// the mechanical checker was clean while the film had a crown landing on the
// presenter, rails invisible at 2px/20% opacity, and a label doing a graphic's
// job. None of those is machine-detectable, so the owner gate is the real gate.
//
// This is a REVIEW gate, in the same class as 037 and 080, so express waives it.
// The 120 final-cut gate is the one that never routes through gateWaived.
export function requireIntroApproved(workdir) {
  if (gateWaived(workdir, '027 intro film')) return;
  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the intro film first`);
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!intro.approved) {
    throw new Error(
      'intro film must not render before the owner approves it — open the board, ' +
      'read the Intro tab, and approve there (step 027)',
    );
  }
}

export function approveIntro(workdir, { approved = true } = {}) {
  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  intro.approved = approved;
  intro.approved_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(intro, null, 2) + '\n');
  return intro;
}
```

Wire `requireIntroApproved` into the `intro-render` verb added by plan 185, so
render refuses without approval.

Create `lib/intro-film/approve.test.mjs` covering: refusal with the exact message
`intro film must not render before the owner approves`; pass after `approveIntro`;
waiver under `review: express`; a clear error when `screenplay.json` is missing.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/intro-film/approve.test.mjs` → exit 0.

**Verify the gate fires**: `sed -i '' "s/if (!intro.approved)/if (false \&\& !intro.approved)/" lib/intro-film/approve.mjs && node --test lib/intro-film/approve.test.mjs; git checkout lib/intro-film/approve.mjs` → must FAIL printing `intro film must not render before the owner approves`.

### Step 2: Server data + routes

In `lib/board-data.mjs`, add `introData(workdir)` returning:

```js
{
  present: boolean,          // false when videos/<slug>/intro-film/ does not exist
  approved: boolean,
  beats: [ { id, intent, register, face, clause, stage, t_start, t_end,
             frames: ['frame-00-at-0.91s.png', ...] } ],   // grouped by beat
  findings: [ { severity, code, from, to, selector, text, message } ],
  sheets: ['contact-sheet-1.jpg', ...],
}
```

Match a frame to its beat by the timestamp in its filename falling within
`[t_start, t_end)`. When `intro-film/` is absent, return `{ present: false }` and
nothing else — do not throw. That is the degraded state the tab renders.

In `lib/board.mjs`, add three routes beside the existing ones:

- `GET /api/intro-data` → `introData(workdir)` as JSON
- `GET /intro-frame?f=<name>` → serve the PNG/JPG from
  `videos/<slug>/intro-film/review/`. **Reject any `f` containing `/` or `..`
  with 400** before touching the filesystem; serve only files that exist in that
  directory.
- `POST /approve-intro` → `approveIntro(workdir)`, mirroring `/approve-card-plan`

**Verify**: add a case to `lib/board-api.test.mjs` asserting `/api/intro-data`
returns `{present:false}` for a video with no intro-film dir, and that
`/intro-frame?f=../../etc/passwd` returns 400.
`cd pipelines/video/visuals-flow-2 && node --test lib/board-api.test.mjs` → exit 0.

### Step 3: The Intro tab

Add `intro` to all four places in `board-ui/src/lib/router.ts`: the `Tab` union,
the `TABS` array (label `Intro`, positioned after `Card Plan` so the bar follows
pipeline order), `HASH_TAB` (`'#intro'`), and `TAB_HASH`.

Create `board-ui/src/tabs/IntroTab.tsx`, modelled on `CardPlanTab.tsx`:

- Fetches `/api/intro-data`.
- **`present: false`** → renders a single explanatory line: *"This video does not
  use the bespoke intro film. Opt in with `run.sh <slug> configure --intro film`."*
  The Approve button is **not rendered at all** in this state.
- Otherwise, one section per beat, in timeline order. Each section shows the
  beat's `id · intent · register · face`, its `clause` as a quote, its `stage`
  text, and its three frames in a row (`<img src="/intro-frame?f=...">`).
  **The stage text must sit beside the frames, not behind a toggle** — the
  comparison is the entire point of the tab.
- Mechanical findings render above the beats, errors first, each naming its beat.
- An Approve button posting to `/approve-intro`, disabled when already approved,
  with the approved timestamp shown.

Style in `IntroTab.css`. **Style every interactive control** — a UA-default
`<select>` or `<button>` is a recurring defect in this repo (LESSONS 2026-07-31);
scoped CSS silently misses reused class names, so check each control renders in
the board's theme, not white-on-dark.

Register the tab in `App.tsx` alongside the others.

**Verify**: `cd pipelines/video/visuals-flow-2/board-ui && npx vitest run && npm run build` → exit 0. Then `cd .. && node scripts/board-ui-smoke.mjs` → exit 0.

### Step 4: Step folder, driver, docs

- `steps/027-approve-intro-film-human/README.md` — what the owner is deciding,
  that it is waived by `review: express`, and that it guards `intro-render`.
- `run.sh`: the `intro-render` arm calls `requireIntroApproved` before rendering.
- `PIPELINE.md`: a row for `027-approve-intro-film-human` after the 025 row.
- `scripts/check.sh`: the `lib/intro-film/` line added by plan 185 already globs
  `*.test.mjs`, so `approve.test.mjs` is picked up. **Confirm this rather than
  assuming** — if 185 landed an explicit file list instead, add the new file.

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh 2>&1 | grep -c "approve.test"` → at least 1.

### Step 5: The screenshot (required to merge)

`ui: true` means boss REJECTS this branch unless it commits an image
(enforced 2026-08-02; PR#141 shipped without one).

Start the board on a video with an intro film present, open the Intro tab,
capture a full-page screenshot showing beats with frames and stage text side by
side, and commit it to `docs/screenshots/186-intro-tab.png`.

If no video has an intro film yet, create a minimal fixture workdir with two
beats and two frames so the tab has something real to render, and screenshot
that. **Do not screenshot the empty state and call it done** — the empty state is
not the feature.

**Verify**: `git show --stat HEAD | grep -c "\.png"` → at least 1.

### Step 6: Fresh-checkout gate

```sh
cd "$(git rev-parse --show-toplevel)"
git worktree add --detach /tmp/186-fresh HEAD
cd /tmp/186-fresh/pipelines/video/visuals-flow-2 && bash scripts/check.sh
git worktree remove --force /tmp/186-fresh
```

**Verify**: exit 0. This catches the `board-ui/dist` build-order dependency that
only shows on a pristine tree.

## Test plan

- `lib/intro-film/approve.test.mjs` — NEW, four cases (Step 1), including the
  mutation-gated refusal message.
- `lib/board-api.test.mjs` — extended: `/api/intro-data` degraded state, and the
  `/intro-frame` path-traversal rejection.
- `board-ui` vitest — `introData` → beat-grouping is a pure function; test that a
  frame at 0.91s lands in the beat spanning 0–3.65 and not in the next one.
- `scripts/board-ui-smoke.mjs` — the tab renders.

Any test that starts the board server MUST have a `test.after` force-closing it.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `node --test lib/intro-film/approve.test.mjs` exits 0, and the mutation in Step 1 makes it FAIL with `intro film must not render before the owner approves`
- [ ] `/intro-frame?f=../../etc/passwd` returns 400
- [ ] `/api/intro-data` returns `{present:false}` for a video with no intro film, and the tab renders the opt-in line with no Approve button
- [ ] The Intro tab shows each beat's frames beside its `stage` text
- [ ] `intro-render` refuses when `screenplay.json` has no `approved: true`, and is waived under `review: express`
- [ ] A screenshot is committed under `docs/screenshots/`
- [ ] The fresh-checkout gate in Step 6 passes
- [ ] `git diff --name-only` contains none of the nine out-of-scope files

## STOP conditions

- Any edit to the nine concurrent-branch / plan-187 files in Out of scope.
- **Inventing a second approval mechanism.** The gate uses `gateWaived`; a new
  env var, flag, or config key for the same job is a STOP.
- **Routing the intro gate around `gateWaived` so express cannot waive it.** That
  is the 120 final-cut gate's behaviour and is deliberately not this gate's.
- Gate integrity: if an assertion fails, fix the code or the fixture. Weakening,
  swapping or deleting it is a STOP.
- Any live HeyGen or paid API call.
- If a new `node:test` server test hangs the suite, fix the teardown — do not
  delete the test.

## Maintenance notes

The tab reads only what plan 185's review pass writes. If the review pass changes
its output shape (frame naming, `check.json` structure), `introData` must change
with it — they are coupled by filename convention, which is the weakest part of
this design and the first place to look when frames stop grouping.

Plan 187 (vf2 standing down on the intro) is independent of this one and remains
blocked on branch `chore/boss-hardening-2026-08-02` merging.
