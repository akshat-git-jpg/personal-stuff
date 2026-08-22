---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: ["plan 218 (introMode switch), 219 (intro kit) and 220 (simple flow) must all be merged first"]
needs_prs: [177, 178, 179]
touches: [pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx, pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.css, pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs, pipelines/video/visuals-flow/TASTE-SIMPLE.md, pipelines/video/visuals-flow/docs/two-session-kickoff.md, pipelines/.claude/skills/yt-video-edit/SKILL.md]

mutation_apply: perl -0pi -e 's/data\.cutlist && !data\.cutlist\.approved/false \&\& !data.cutlist.approved/' pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx
mutation_command: bash scripts/check.sh
mutation_expect: SIMPLE-INTRO
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 900
---

# Plan 221: the simple intro's review surface, taste doc, and skill wiring

## Summary

- **Problem statement**: after plans 218-220 a `simple` video can be authored,
  linted and rendered, but the owner cannot REVIEW it. The board's Intro tab only
  knows the complex flow's two artifacts (`idea.json`, `screenplay.json`), so gate
  125 has no surface and `run.sh <slug> board` shows nothing for a simple video. The
  `yt-video-edit` skill also still documents one intro flow.
- **Goals**:
  - Teach `/api/intro-data` about `introMode`, and add a simple-flow branch to
    `IntroTab.tsx`: the rendered intro as a player, the cut list as a beat table, the
    measured pacing numbers, per-beat comments, and one Approve button (gate 125).
  - Write `TASTE-SIMPLE.md` — the accumulated-taste doc for the simple flow, kept
    separate from `TASTE-INTRO.md` so the two flows never inherit each other's rules.
  - Update the `yt-video-edit` SKILL.md: the mode switch, the new verbs, the review
    model table (now mode-dependent), and the guardrail that the intro's creative
    freedom applies to `complex` only.
  - Update `docs/two-session-kickoff.md` — the intro track's step numbers differ by
    mode now.
- **Executor proposed**: `claude-p` / Claude Sonnet — a React review surface judged
  by eye plus two rulebooks, which `tooling/boss/data/rules.md` routes to claude-p
  sonnet rather than the agy default.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` green, the
  board smoke asserts the simple branch renders its player and beat table, a
  screenshot of the simple Intro tab is committed, and SKILL.md documents both flows.
- **Stop conditions** (terse — full list below): do not change the complex flow's two
  existing Intro-tab branches; do not weaken a smoke assertion; do not renumber steps.
- **Test / verification for success**: `board-ui` vitest component tests + the
  existing `scripts/board-ui-smoke.mjs` extended with a simple-mode fixture, plus a
  committed screenshot. Mutation-gated on the simple branch's render condition.
- **Open points for plan readiness**: none. (`needs_prs` is filled: PR #177 = plan
  218, #178 = plan 219, #179 = plan 220; boss will not dispatch until all three
  close.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 20a2ae62..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/board-ui pipelines/.claude/skills/yt-video-edit`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans 218, 219, 220
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `20a2ae62`, 2026-08-22

## Why this matters

Gate 125 is the owner's only look at a simple intro before it enters the cut. Plan
220 declares the gate in the step registry, and `requireIntroApproved()` enforces it
at assembly — but without a board surface the flag can only be flipped by hand-editing
JSON, which is exactly the "a step that is not recorded did not visibly happen"
problem the skill's guardrail 3 warns about.

There is a second reason this plan is separate rather than folded into 220: the
board is the repo's most defect-prone surface. `plans/runs/LESSONS.md` records, for
this exact component tree, a data-loss punt shipped under 456 passing tests
(2026-07-31), UA-default unstyled controls reintroduced by a crew fixing that very
class of bug (2026-07-31), and specced UI behaviours shipping as inert lookalike
stubs under green gates (2026-07-24). Isolating the board work means a failure here
does not force a re-run of the pipeline plans.

## Current state

### `IntroTab.tsx` — the component to extend (367 lines, React + TS)

This is a Vite + React + TS component app, which is the repo's browser-UI standard
(`decisions.md` 2026-07-31). Do NOT rewrite it as template strings.

Its shape today, from its own source:

```tsx
export function IntroTab({ video, onMeta, onActions, onSecondary, onRefetch }: {
```

```tsx
  const [data, setData] = useState<any>(null);
  const [fcItems, setFcItems] = useState<Record<string, ReviewComment>>({});
  const [videoMissing, setVideoMissing] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [frameZoom, setFrameZoom] = useState<Record<string, number>>({});
```

It fetches three things:

```tsx
      const res = await fetch(`/api/intro-data?video=${encodeURIComponent(video)}`);
      const resBd = await fetch(`/api/board-data?video=${encodeURIComponent(video)}`);
      const resVid = await fetch(`/intro-video?video=${encodeURIComponent(video)}`, { headers: { Range: 'bytes=0-0' } });
```

And it has exactly two branches today, both complex-flow:

```tsx
  // Gate 028 — the idea gate, reviewed BEFORE any beat exists. idea.json can
  // be present with no screenplay.json on disk yet; once approved, the tab
  // ...
  if (data.idea && !data.idea.approved) {
```

…which posts to `/approve-intro-idea` or `/reject-intro-idea`; and the film-review
branch below it, which plays `/intro-video` and posts to `/approve-intro`.

**Both branches stay exactly as they are.** This plan adds a THIRD branch, taken
first, when the video's mode is simple.

### The server handlers in `lib/board.mjs`

```js
1061: async function handleApproveIntroIdea(req, res, workdir) {
1568:   if (req.method === 'POST' && url.pathname === '/approve-intro') {
1576:   if (req.method === 'POST' && url.pathname === '/approve-intro-idea') {
1580:   if (req.method === 'POST' && url.pathname === '/reject-intro-idea') {
```

`/approve-intro` already exists and, after plan 220, `approveIntro()` writes to
whichever file the mode dictates. So **no new POST route is needed** — the simple
branch reuses `/approve-intro`. Only `/api/intro-data` needs to learn the mode.

Note from plan 218: `loadRunConfig()` now THROWS on an unrecognised `introMode`. Every
board request handler that reaches it needs a try/catch that returns a 400 with the
message, not a 500 stack — a typo in one video's run-config must not take the board
down for every other video.

### The smoke test

`scripts/board-ui-smoke.mjs` (35.7K) is run by `check.sh` after the vitest+build
step. It loads the built board against fixture workdirs and asserts on the DOM. This
is where the simple-mode assertion goes, tagged `SIMPLE-INTRO`.

`check.sh` already builds the SPA before the node tests, in this order:

```bash
node scripts/gen-pipeline-table.mjs --check
( cd board-ui && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx vitest run && npm run build )
```

so a board-ui change is covered by the merge gate without touching `check.sh`.

### `TASTE-INTRO.md` — 858 lines, complex-flow only from now on

It is the accumulated record of what the owner has rejected on screen for the
bespoke film, as numbered rules (`T1`…`T12`). `lib/intro-film/check-taste-intro.mjs`
checks it and runs in `check.sh`.

**Do not move rules out of it and do not delete any.** The simple flow gets its own
file. Several `TASTE-INTRO` rules are specific to bespoke authoring (continuity, the
register turn, "carries" semantics) and would be nonsense for a locked kit.

The one rule that MUST be carried across, because it is about what a shape MEANS
rather than about authoring, is `T12` — the prohibition on forms that read as
"not finished" (dashed outlines, grey silhouettes, an arc filling a ring). Quote it
into `TASTE-SIMPLE.md` with its provenance rather than cross-referencing it, because
the two files are read by different steps.

### `yt-video-edit` SKILL.md — what is now wrong

Source of truth: `pipelines/.claude/skills/yt-video-edit/SKILL.md` (symlinked into
`.claude/skills/`; **edit the source, never the symlink**).

Statements in it that this chain makes false:

1. Guardrail 9 describes the intro track as steps `110-160`. In simple mode it is
   `115-135`.
2. The Review-model table lists six human steps including `120-approve-intro-idea-human`
   and `150-approve-intro-film-human`. In simple mode those two are replaced by one:
   `125-approve-intro-simple-human`.
3. Guardrail 7b describes gate 110's competing-intro-direction previews. Those exist
   in complex mode only.
4. The Verb Map has no `--intro` flag on `configure`, and no simple-flow verbs.
5. Nothing in it mentions that the intro's "full creative freedom" is now
   mode-specific.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Merge gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Board-ui component tests | `cd pipelines/video/visuals-flow/board-ui && npx vitest run` | exit 0 |
| Build the SPA | `cd pipelines/video/visuals-flow/board-ui && npm run build` | exit 0, writes `dist/` |
| Board smoke only | `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` | exit 0 |
| Open the board by hand | `cd pipelines/video/visuals-flow && bash run.sh <slug> board` | prints a localhost URL |
| Screenshot for the ui gate | drive the running board and save to `docs/img/simple-intro-tab.png` | a committed png |

If `npm ci` fails with `EACCES` on `_cacache`, retry with `--cache ./.npm-cache`.
Never `npm cache clean`.

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/board.mjs` — `/api/intro-data` only, plus the
  `loadRunConfig` try/catch
- `pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx` and `IntroTab.css`
- `pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.test.tsx` (NEW or extended)
- `pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs`
- `pipelines/video/visuals-flow/TASTE-SIMPLE.md` (NEW)
- `pipelines/video/visuals-flow/docs/two-session-kickoff.md`
- `pipelines/video/visuals-flow/docs/img/simple-intro-tab.png` (NEW, the ui evidence)
- `pipelines/.claude/skills/yt-video-edit/SKILL.md`
- `plans/README.md`

**Out of scope**:
- `TASTE-INTRO.md` and `lib/intro-film/check-taste-intro.mjs` — the complex flow's
  taste contract. Read `TASTE-INTRO.md`, quote `T12`, change neither.
- The two existing complex-flow branches inside `IntroTab.tsx`. Add a branch; do not
  refactor theirs.
- `lib/intro-kit/**` and `pipelines/video/intro-kit/**` — plans 219 and 220.
- Any `step.json` — plan 220 set them. Renumbering breaks this plan's own assertions.
- `.claude/skills/yt-video-edit` — that is a SYMLINK. Edit
  `pipelines/.claude/skills/yt-video-edit/SKILL.md`.

## Git workflow

- Branch: `advisor/221-vf-intro-simple-board-and-skill`
- Commit per step. Message form: `feat(vf): <step summary>`. No AI footers. Do NOT push.

## Steps

### Step 1: `/api/intro-data` learns the mode

In `lib/board.mjs`, extend the `/api/intro-data` response with:

```js
  // Which flow built this intro. The Intro tab has three mutually exclusive
  // surfaces and picks by this field, not by guessing from which files exist —
  // a half-built complex video and a simple video can both have no screenplay.
  mode,                 // 'simple' | 'complex', from introMode(workdir)
  cutlist,              // simple only: the parsed intro-simple/cutlist.json, or null
  pacing,               // simple only: { avatarShare, cuts, longestAvatarHold }
```

`pacing` is computed server-side from the cut list so the owner sees the same numbers
the lint enforces:

```js
// Same definitions as lib/intro-kit/lint-cutlist.mjs (S1/S2/S3). Computed here for
// DISPLAY only — the lint is the gate. If these two ever disagree, the lint wins and
// this is the bug.
function pacingSummary(cutlist) {
  const beats = cutlist?.beats ?? [];
  const total = beats.reduce((n, b) => n + (b.t_end - b.t_start), 0) || 1;
  const avatarish = beats.filter((b) => b.kind === 'avatar' || b.kind === 'overlay');
  const holds = beats.filter((b) => b.kind === 'avatar').map((b) => b.t_end - b.t_start);
  return {
    avatarShare: +(avatarish.reduce((n, b) => n + (b.t_end - b.t_start), 0) / total).toFixed(3),
    cuts: beats.length,
    longestAvatarHold: holds.length ? +Math.max(...holds).toFixed(2) : 0,
  };
}
```

Wrap the `loadRunConfig`/`introMode` call in a try/catch that responds
`400 { error: <message> }` — plan 218 made a bad `introMode` throw.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` -> exit 0.

### Step 2: the simple branch in `IntroTab.tsx`

Add as the FIRST branch, before the existing idea-gate branch:

```tsx
  // Gate 125 — the simple intro. One surface: watch the cut, read the beat table,
  // approve. There is no idea gate and no frame contact sheet in this flow, because
  // there is no bespoke composition to review — the cards are locked (plan 219).
  if (data.mode === 'simple' && data.cutlist && !data.cutlist.approved) {
```

The branch renders, in this order:

1. **The player** — the rendered `/intro-video` in a `<video controls>`. If
   `videoMissing` is true, show a disabled Approve with
   `title="render the intro first: run.sh <slug> intro-simple-render"` and the exact
   command as copyable text. **This is the degraded state; it must not render an
   enabled button.**
2. **The pacing strip** — three read-only figures from `data.pacing`:
   `avatar share 48%`, `11 cuts`, `longest hold 4.2s`. Each shows its limit beside it
   (`≤ 55%`, `≤ 5.0s`) so a number near the edge is visible without arithmetic.
3. **The beat table** — one row per beat: `#`, `kind`, `card`, `start`, `length`, and
   the beat's on-screen text (`vars.text`, or the joined `rows[].text` for
   `checklist`, or `appName` for `ui-mock`). An `overlay` row is visually distinct
   from a `card` row, because the difference (presenter still on screen) is the thing
   the owner is judging.
4. **Per-beat comments**, reusing the existing `fcItems` / `ReviewComment` mechanism
   already in this component. Do not invent a second comment store.
5. **One Approve button** posting to the existing `/approve-intro`, then
   `onRefetch()`.

There is deliberately **no Reject button**. The complex flow's idea gate has one
because rejecting an idea restarts a round; here the fix is to edit the cut list and
re-render, which is a session action, not a board action. State that in a comment so
nobody adds one for symmetry.

**Styling**: every interactive control must be styled. `IntroTab.css` scopes rules
by class; a new control reusing an existing class name silently misses scoped CSS.
LESSONS 2026-07-31 records this exact bug being reintroduced by the crew fixing it —
so after building, check EVERY control in the new branch, not just the hero surfaces,
for UA-default white-on-dark rendering.

**Verify**: `cd pipelines/video/visuals-flow/board-ui && npx vitest run` -> exit 0.

### Step 3: component tests for the branch

Add to `board-ui/src/tabs/IntroTab.test.tsx` at least these five cases, each
asserting on rendered output rather than on props:

1. `mode: 'simple'` + an unapproved cutlist renders the beat table with one row per
   beat, and the row count equals `cutlist.beats.length`.
2. `mode: 'simple'` + `videoMissing: true` renders Approve as **disabled** and shows
   the `intro-simple-render` command.
3. `mode: 'simple'` + an approved cutlist does NOT render the gate branch.
4. `mode: 'complex'` + an unapproved `idea.json` still renders the idea gate exactly
   as before (a regression guard on the untouched branch).
5. The pacing strip shows `avatarShare` as a percentage and its limit.

A "write these tests" step is unverifiable by `npx vitest run` alone — vitest exits 0
when a named test file is simply absent (LESSONS 2026-08-17, plan 204 shipped zero UI
tests under a green gate). So Done criteria assert the FILE exists and a minimum test
count.

**Verify**: `cd pipelines/video/visuals-flow/board-ui && npx vitest run 2>&1 | grep -qE "Tests +[0-9]+ passed"` and `test -f src/tabs/IntroTab.test.tsx`.

### Step 4: the smoke assertion (the mutation target)

Extend `scripts/board-ui-smoke.mjs` with a simple-mode fixture workdir
(`run-config.json` with `introMode: "simple"`, an `intro-simple/cutlist.json`, a
stub `intro-film/out/intro.mp4`) and assert on the served DOM:

- the beat table is present and its row count matches the fixture's beat count,
- the pacing strip's avatar-share figure is present,
- the Approve control is present.

Every assertion message starts with `SIMPLE-INTRO`.

**Then prove it fires**:

```bash
cd pipelines/video/visuals-flow
cp board-ui/src/tabs/IntroTab.tsx /tmp/IntroTab.bak
perl -0pi -e 's/data\.cutlist && !data\.cutlist\.approved/false \&\& !data.cutlist.approved/' board-ui/src/tabs/IntroTab.tsx
bash scripts/check.sh          # MUST fail, printing SIMPLE-INTRO
cp /tmp/IntroTab.bak board-ui/src/tabs/IntroTab.tsx
bash scripts/check.sh          # MUST pass again
```

**Verify**: the mutated run exits non-zero with `SIMPLE-INTRO` in its output.

### Step 5: `TASTE-SIMPLE.md`

New file at the visuals-flow root. It is the simple flow's accumulated-taste record,
seeded from the four reference intros. Structure it as numbered `S-T<n>` rules so
later folds can append. Seed rules:

- `S-T1` — Full-screen avatar and full-screen card alternate on hard cuts. The
  presenter is never in a bubble, panel or corner beside a graphic. (Measured across
  all four references, 2026-08-22.)
- `S-T2` — Every card carries the words being spoken, appearing word by word. A card
  with no text on it does not exist in this flow.
- `S-T3` — One accent colour for the whole intro. No register shift, no mood change
  mid-intro.
- `S-T4` — Reusing the same card two or three times in a row is CORRECT. Reference
  `kO3WtZmDb_A` uses one card four times back to back, changing only its icon and two
  rows. Variety is not a goal here; legibility is.
- `S-T5` — No continuity between cards. A card does not carry an object from an
  earlier card. (This is the deliberate inverse of `TASTE-INTRO.md`'s continuity
  rules, which apply to the bespoke film only.)
- `S-T6` — Transitions are a two-frame white flash. Not a crossfade, not a blur, not
  a wipe.
- `S-T7` — quote `TASTE-INTRO.md`'s `T12` verbatim, with its provenance: never use a
  form whose meaning is "not finished" — a dashed outline means "drop content here",
  a grey figure means "no avatar set", an arc filling a ring means "loading". Owner,
  three times on one film: dashed sponsor wells and grey silhouettes 2026-08-06, the
  drawing seal 2026-08-07.

Add a header stating plainly that `TASTE-INTRO.md` governs `complex` and this file
governs `simple`, and that neither inherits the other.

**Verify**: `test -s pipelines/video/visuals-flow/TASTE-SIMPLE.md` and it contains `S-T1` through `S-T7`.

### Step 6: update the `yt-video-edit` skill

Edit `pipelines/.claude/skills/yt-video-edit/SKILL.md` (the SOURCE, not the symlink):

6a. **New guardrail, placed first among the intro guardrails**:

> **The intro has two flows. Check which one before touching an intro step.**
> `bash run.sh <slug> status` prints `intro flow: simple|complex`, and it comes from
> `introMode` in `run-config.json` (set at 010 with
> `configure --intro simple|complex`; the default is **simple**).
> - `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
>   The cards are LOCKED (`pipelines/video/intro-kit/`, 7 of them). You pick and fill;
>   you never design. Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`.
>   Taste: `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`.
> - `complex` — steps 110 → 120 → 130 → 140 → 150 → 160, the bespoke film, unchanged.
>   Rulebooks: `IDEA-PASS.md`, `AUTHORING.md`. Taste: `TASTE-INTRO.md`.
>
> Never run a step from the other flow's lane. The step registry already refuses
> (`modes` in `step.json`), but a session that reads the wrong rulebook wastes the run.

6b. Amend guardrail 7b and guardrail 9 to say they describe `complex` only.

6c. Make the Review-model table mode-aware. Replace the single six-row table with a
shared table plus a per-mode intro block:

| Step | What the owner does | Mode |
|---|---|---|
| `010-configure-run-human` | Engine, Drive folder, **and the intro flow** | both |
| `120-approve-intro-idea-human` | Picks one proposed intro direction | complex |
| `150-approve-intro-film-human` | Approves the built intro film | complex |
| `125-approve-intro-simple-human` | Approves the cut intro (player + beat table) | simple |
| `340-approve-storyboard-human` | Cards, on-card text, avatar placement | both |
| `420-propose-avatar-human` | Picks character + model (**spend gate**) | both |
| `530-approve-final-cut-human` | The assembled cut, judged in motion | both |

So a simple video has **five** human steps and a complex video has **six**.

6d. Add the verbs to the Verb Map:

| Phrase | `run.sh` verb | Gate / behaviour |
|---|---|---|
| "use the simple intro", "use the complex intro" | `configure --intro simple\|complex` | 010; default simple |
| "author the intro", "write the cut list" | `intro-simple` | prints `SIMPLE-PASS.md` (simple mode) |
| "check the intro pacing" | `intro-simple-lint` | S1-S7; errors, not warnings |
| "render the intro" | `intro-simple-render` | 135 |
| "re-render the intro with the real avatar" | `intro-simple-rerender` | 445 |

6e. Update the skill's `description` frontmatter so the new verbs trigger it.

**Verify**: `grep -c "intro-simple" pipelines/.claude/skills/yt-video-edit/SKILL.md` -> at least 5, and `grep -q "125-approve-intro-simple-human" pipelines/.claude/skills/yt-video-edit/SKILL.md`.

### Step 7: kickoff doc + the screenshot

7a. Update `docs/two-session-kickoff.md`: the intro track's steps are `115-135` in
simple mode and `110-160` in complex, and the kickoff prompt must name the mode. The
existing rules (only the main session runs git, one board, the intro session stops
before the shipping encode) hold in both modes — the simple flow's stop point is
**135**, and **445** is `main`.

7b. Run the board against a simple fixture, screenshot the Intro tab, and commit it
as `docs/img/simple-intro-tab.png`. This is the `ui: true` evidence boss requires.
**Look at the screenshot**: every control styled, the beat table populated, the
pacing strip readable, no white-on-dark UA default.

**Verify**: `test -s pipelines/video/visuals-flow/docs/img/simple-intro-tab.png` -> exit 0.

### Step 8: full gate on a fresh tree

```bash
cd pipelines/video/visuals-flow
git clean -xdn .
bash scripts/check.sh
```

**Verify**: exit 0, prints `visuals-flow check OK`.

## Test plan

- `board-ui` vitest: 5+ component cases on the new branch, including one regression
  guard on the untouched complex idea gate.
- `scripts/board-ui-smoke.mjs`: a simple-mode fixture, DOM assertions tagged
  `SIMPLE-INTRO`, mutation-proven.
- `lib/board.test.mjs`: `/api/intro-data` returns `mode`, `cutlist` and `pacing`; a
  bad `introMode` yields 400, not 500.
- Manual: one screenshot, inspected control by control.
- `check.sh` on a `git clean`-ed tree.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`.
- [ ] `test -f pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.test.tsx` and `npx vitest run` reports at least 5 passing tests in that file.
- [ ] `/api/intro-data` returns `mode`, `cutlist` and `pacing`: asserted by a case in `lib/board.test.mjs`.
- [ ] Mutation proof: disabling the simple branch's render condition makes `bash scripts/check.sh` FAIL printing `SIMPLE-INTRO`; reverting passes.
- [ ] `test -s pipelines/video/visuals-flow/TASTE-SIMPLE.md` and it contains `S-T1`…`S-T7`.
- [ ] `test -s pipelines/video/visuals-flow/docs/img/simple-intro-tab.png` (over 20000 bytes).
- [ ] SKILL.md documents both flows: `grep -q "125-approve-intro-simple-human"` and `grep -q "intro flow: simple"` both succeed.
- [ ] `TASTE-INTRO.md` is unchanged: `git diff --name-only 20a2ae62..HEAD | grep -q '^pipelines/video/visuals-flow/TASTE-INTRO.md$'` prints NOTHING (i.e. that grep exits non-zero).
- [ ] No `step.json` was touched: `git diff --name-only 20a2ae62..HEAD | grep 'step.json'` prints nothing.
- [ ] Punt-marker sweep is clean: `git diff 20a2ae62..HEAD | grep -nEi '(^\+.*)(TODO|FIXME|for now|we can.?t easily|let.?s just|actually,|wait,)'` prints nothing.

## STOP conditions

- **Gate integrity**: if a smoke or component assertion fails, fix the COMPONENT.
  Weakening, skipping or deleting the assertion is a STOP — report.
- If the new branch cannot be added without refactoring one of the two existing
  complex-flow branches, STOP and report. Those branches gate every existing video.
- If `TASTE-INTRO.md` needs an edit to make anything pass, STOP. It is the complex
  flow's owner-owned contract.
- If a step number from plan 220 (115/125/135/445) does not match what this plan
  asserts, STOP — do not renumber either side; report the mismatch.
- Do NOT add a Reject button to the simple branch. The fix path is edit-and-re-render,
  by a session, not a board round-trip.
- Do NOT edit `.claude/skills/yt-video-edit` — it is a symlink. Edit the source under
  `pipelines/.claude/skills/`.
- If the board cannot be screenshotted in this environment, STOP and report. Do not
  substitute a hand-drawn mockup or skip the `ui` evidence.

## Maintenance notes

- **Three branches, picked by `data.mode`, not by file presence.** A half-built
  complex video and a simple video both lack a `screenplay.json`, so guessing from
  files is ambiguous. A reviewer should check the branch condition reads `data.mode`.
- `pacingSummary()` in `board.mjs` duplicates the lint's definitions for display. If
  they ever disagree, the LINT is right. Consider importing the lint's constants
  rather than restating the numbers.
- `TASTE-SIMPLE.md` has no automated checker yet (`check-taste-intro.mjs` covers
  `TASTE-INTRO.md` only). A future fold that adds enforceable `S-T` rules should add
  one, mirroring that script.
- After this plan lands, the whole chain (218-221) is complete and the owner can set
  a video to either flow at step 010. The next likely fold is a `TASTE-SIMPLE`
  checker and per-card variable capacity measurement, neither of which is in scope
  anywhere in this chain.
