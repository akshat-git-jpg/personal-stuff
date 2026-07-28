---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-cues.mjs test-03
ui: true
deploy:
needs: [plan 164 / PR#122 adds the zone-plan verb and board tab this renumbers — land 164 first]
---

# Plan 167: Renumber the steps to run order, and make the three human reviews explicit

## Summary

- **Problem statement**: Step numbers do not match run order. The shot pass is `070` but runs *before* the `040` storyboard review; the feedback fold is `060` but runs last. Only one of the three human reviews exists as a step at all — the intro/conclusion approval is a board tab with no step, and the Final Cut review is a surface that gates nothing.
- **Goals**:
  - Renumber every step so numeric order **is** run order.
  - Add `070-zone-review-owner` and `120-final-cut-review-owner` as real steps.
  - Make the Final Cut review a **gate**: no full-resolution final and no Resolve export until the owner approves.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — wide but mechanical, plus one small gate.
- **Done criteria** (terse): `check.sh` green; every `run.sh` verb works at its new path; full-res assemble refuses without Final Cut approval.
- **Stop conditions** (terse): a renamed folder loses git history; historical records get rewritten; a code path still points at an old number.
- **Test / verification for success**: `check.sh` + `test-run-sh.sh`, a prompt regeneration at the new path, and a live refusal check.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2350a33..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 164 (PR#122)
- **Category**: dx
- **Difficulty**: mechanical
- **Planned at**: commit `2350a33`, 2026-07-29

## Why this matters

Owner, 2026-07-29: *"fix the numbering pls, steps sequence looks confusing… can we please add explicit steps for human reviewer for intro and conclusion, then each cue on storyboard, then 3rd review of full video on final cut."*

The numbering actively misleads. Anyone reading `steps/` assumes `040` precedes `070`; in reality the shot pass runs first and the board approves cues **and** shots together. And the review model the owner actually works to — three distinct approvals — is invisible in the folder structure: one review exists as a step, one is a board tab being added by plan 164, and one gates nothing at all.

Making the Final Cut a gate closes the last hole: today a video can reach full resolution and be exported with the owner's comments untriaged.

## Current state

**The rename map.** Left is what exists at the planned-at commit; right is the target. Use `git mv` for every one so history follows the folder.

| current | new | what it does |
|---|---|---|
| `010-transcribe-run` | `010-transcribe-run` *(unchanged)* | voiceover → word-timed transcript |
| `018-concept-pass-llm` | `020-concept-pass-llm` | thesis, motif, register map |
| `020-cue-pass-llm` | `030-cue-pass-llm` | which graphic, where, what text |
| `030-resolve-run` | `040-resolve-run` | exact times + exposure |
| `035-cue-audit-llm` | `050-cue-audit-llm` | mute test |
| `070-shot-pass-llm` | `060-shot-pass-llm` | where the avatar speaks full-screen |
| — *(new)* | `070-zone-review-owner` | **REVIEW 1** — intro & conclusion cards |
| `040-storyboard-review-owner` | `080-storyboard-review-owner` | **REVIEW 2** — every cue |
| `050-render-run` | `090-render-run` | render the card clips |
| `080-avatar-render-run` | `100-avatar-render-run` | HeyGen avatar clips |
| `090-assemble-run` | `110-assemble-run` | stitch the cut |
| — *(new)* | `120-final-cut-review-owner` | **REVIEW 3** — the finished video |
| `060-feedback-fold-opus` | `130-feedback-fold-opus` | turn comments into durable rules |
| `095-resolve-export-run` | `140-resolve-export-run` | optional DaVinci timeline |

**Code paths that break on rename** — these are real reads, not comments:

- `lib/build-prompt.mjs`: `export const PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', 'cue-pass-prompt.md');`
- `lib/build-shot-prompt.mjs`: the equivalent for `070-shot-pass-llm/shot-pass-prompt.md`
- `lib/check-rulebook.mjs` and `lib/check-shot-rulebook.mjs` read those same files
- `run.sh`: `bash steps/010-transcribe-run/run.sh`, `bash steps/040-storyboard-review-owner/run.sh`, the `export` verb's `steps/095-...`, plus the `echo` lines naming prompt paths at ~106, 129, 140, 158
- `scripts/test-run-sh.sh` asserts on some of those literal strings

**Comment-only references** (update for accuracy, they do not break anything): `lib/cue-constants.mjs:3`, `lib/cue-rules.mjs:4`, `lib/shot-constants.mjs:3`, `lib/transcript-quality.mjs:3`.

**Draft vs full resolution** — `lib/assemble.mjs`:

```js
  const { w, h } = draft ? { w: 1280, h: 720 } : { w: CANVAS.w, h: CANVAS.h };
...
  const out = opts.out ?? path.join(kbWorkdir, opts.draft ? 'final-draft.mp4' : 'final.mp4');
```

So `--draft` is the review copy and a bare run is the deliverable. That is exactly the seam REVIEW 3 gates.

**The existing gate idiom** — copy it, do not invent one. `lib/assemble.mjs`:

```js
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
```

**Plan 164 (PR#122)** adds `lib/zone-plan.mjs`, a `zone-plan` run.sh verb, a board tab and `zone-plan.json`. It must land first; this plan gives that gate its step folder rather than rebuilding it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| run.sh smoke | `cd pipelines/video/visuals-flow-2 && bash scripts/test-run-sh.sh` | `run.sh test OK` |
| Regenerate prompts | `cd pipelines/video/visuals-flow-2 && node lib/build-prompt.mjs && node lib/check-rulebook.mjs` | `rulebook ok` |
| History check | `git log --oneline --follow pipelines/video/visuals-flow-2/steps/030-cue-pass-llm/README.md \| head -3` | shows pre-rename commits |

## Scope

**In scope**:
- every folder under `pipelines/video/visuals-flow-2/steps/` (renames via `git mv`)
- two new step folders with READMEs
- `lib/build-prompt.mjs`, `lib/build-shot-prompt.mjs`, `lib/check-rulebook.mjs`, `lib/check-shot-rulebook.mjs`
- `lib/assemble.mjs` (the REVIEW 3 refusal), `lib/board.mjs` (the approve control)
- `lib/final-cut.mjs` (new, tiny) + `lib/final-cut.test.mjs`
- `run.sh`, `scripts/test-run-sh.sh`, `scripts/check.sh`
- `PIPELINE.md`, `README.md`, `pipelines/.claude/skills/visuals-flow-2/SKILL.md`

**Out of scope**:
- **`decisions.md`, `plans/*`, `docs/specs/*`, `tests/TESTS.md`.** These are historical records written when the old numbers were current; rewriting them falsifies the record. A note in `PIPELINE.md` carrying the old→new map is how a reader connects them.
- Plan 164's `zone-plan.mjs` / board tab logic — this plan only adds the step folder and renumbers.
- Any change to what a step *does*. This is numbering plus two gates, nothing else.
- `videos/**`.

## Git workflow

- Branch: `advisor/167-vf2-renumber-steps-and-three-reviews`
- Commit: `refactor(vf2): renumber steps to run order; add the three owner review steps` — no AI footers. Do NOT push.

## Steps

### Step 1: Rename the folders, highest number first

Renaming low-to-high collides (e.g. `018`→`020` while `020` still exists). Go **highest to lowest**, using `git mv` so history follows:

```bash
cd pipelines/video/visuals-flow-2/steps
git mv 095-resolve-export-run       140-resolve-export-run
git mv 090-assemble-run             110-assemble-run
git mv 080-avatar-render-run        100-avatar-render-run
git mv 070-shot-pass-llm            060-shot-pass-llm
git mv 060-feedback-fold-opus       130-feedback-fold-opus
git mv 050-render-run               090-render-run
git mv 040-storyboard-review-owner  080-storyboard-review-owner
git mv 035-cue-audit-llm            050-cue-audit-llm
git mv 030-resolve-run              040-resolve-run
git mv 020-cue-pass-llm             030-cue-pass-llm
git mv 018-concept-pass-llm         020-concept-pass-llm
```

`010-transcribe-run` is unchanged. Check for collisions after each command; if `git mv` refuses because the target exists, STOP — the order is wrong.

**Verify**: `ls -d */ | sort` -> exactly `010-transcribe-run 020-concept-pass-llm 030-cue-pass-llm 040-resolve-run 050-cue-audit-llm 060-shot-pass-llm 080-storyboard-review-owner 090-render-run 100-avatar-render-run 110-assemble-run 130-feedback-fold-opus 140-resolve-export-run`

And history survived: `git log --oneline --follow pipelines/video/visuals-flow-2/steps/030-cue-pass-llm/README.md | head -3` -> shows commits from before the rename.

### Step 2: Repoint the code paths

Update every path listed in "Current state":

- `build-prompt.mjs` → `steps/030-cue-pass-llm/cue-pass-prompt.md`
- `build-shot-prompt.mjs` → `steps/060-shot-pass-llm/shot-pass-prompt.md`
- `check-rulebook.mjs`, `check-shot-rulebook.mjs` → the same new paths
- `run.sh` → `steps/080-storyboard-review-owner/run.sh`, `steps/140-resolve-export-run/run.sh`, and the `echo` lines at ~106/129/140/158
- `scripts/test-run-sh.sh` → whatever literals it asserts
- the four comment-only references

**Verify**:
```bash
cd pipelines/video/visuals-flow-2
grep -rn "steps/0[0-9][0-9]-\|steps/1[0-9][0-9]-" lib/*.mjs run.sh scripts/*.sh | grep -vE "010-transcribe-run|020-concept-pass-llm|030-cue-pass-llm|040-resolve-run|050-cue-audit-llm|060-shot-pass-llm|070-zone-review-owner|080-storyboard-review-owner|090-render-run|100-avatar-render-run|110-assemble-run|120-final-cut-review-owner|130-feedback-fold-opus|140-resolve-export-run"
```
-> no output, and `node lib/build-prompt.mjs && node lib/check-rulebook.mjs` -> `rulebook ok`

### Step 3: REVIEW 1 — `070-zone-review-owner/README.md`

Create the folder with a README only (plan 164 already built the mechanism). It must state:

- **What you approve**: the cards planned for the intro and conclusion, each marked EXISTING or NEW-to-build, plus the one-line spec of any proposed new card.
- **Why here**: the build-vs-reuse call is cheapest before anything renders.
- **How**: `bash run.sh <slug> zone-plan`, then the Zone Plan tab on the board.
- **What it blocks**: `render.mjs` refuses until `zone-plan.json` has `approved: true`.
- **Not a checklist**: what belongs in an intro is a judgment call about that script; the gate checks that cards were *chosen deliberately*, not that particular slots are filled (owner ruling, `decisions.md` 2026-07-28).

**Verify**: `test -f steps/070-zone-review-owner/README.md && grep -c "zone-plan" steps/070-zone-review-owner/README.md` -> at least `1`

### Step 4: REVIEW 3 — the Final Cut gate

Create `lib/final-cut.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

// REVIEW 3. The owner approves the assembled cut before it becomes a
// deliverable. Until 2026-07-29 the Final Cut tab collected comments but
// gated nothing, so a video could reach full resolution and be exported with
// the owner's notes untriaged.
export const FINAL_CUT_FILE = 'final-cut.json';

export function readFinalCut(workdir) {
  const p = path.join(workdir, FINAL_CUT_FILE);
  if (!fs.existsSync(p)) return { approved: false, exists: false };
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { approved: d.approved === true, exists: true, version: d.version ?? null };
}

// Approval is per VERSION: a new cut is a new thing to look at, so approving
// v3 must not silently bless v4.
export function isApprovedFor(workdir, version) {
  const fc = readFinalCut(workdir);
  return fc.approved && fc.version === version;
}
```

In `lib/assemble.mjs`, refuse a **full-resolution** run (i.e. `!opts.draft`) when the latest version is not approved, mirroring the existing idiom:

```js
  if (!opts.draft && !opts.force) {
    const fc = readFinalCut(workdir);
    if (!fc.approved) {
      console.error('refusing to build the full-resolution final: final-cut.json approved=false — review the Final Cut tab (node lib/board.mjs <slug>) or pass --force. Use --draft for a review copy.');
      process.exit(1);
    }
  }
```

Apply the same refusal at the top of the `140-resolve-export-run` entry point.

`--draft` stays completely ungated — the owner must be able to produce something to review.

In `lib/board.mjs`, add an **Approve final cut** control on the Final Cut tab that POSTs and writes `{ approved: true, version: <the version being viewed> }`. Only that control may set it.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2
node lib/assemble.mjs test-03 2>&1 | tail -2; echo "exit=$? (expect non-zero)"
node lib/assemble.mjs test-03 --draft --help >/dev/null 2>&1; echo "draft path ungated"
```
-> the full-res run refuses with the message above.

### Step 5: REVIEW 3 — `120-final-cut-review-owner/README.md`

README stating: what you judge (motion, sound, pacing, captions — in motion, not from stills), how (Final Cut tab, timestamped and pinned comments, versions, live check-off), what it blocks (the full-resolution final and the Resolve export), and that `--draft` is always available beforehand. Note that comments feed step `130`.

**Verify**: `test -f steps/120-final-cut-review-owner/README.md` -> exists

### Step 6: Register the new test and update the docs

- add `lib/final-cut.test.mjs` (cases: no file → not approved; `approved:true` with a matching version → approved; `approved:true` with a *different* version → NOT approved) and register it in `scripts/check.sh`
- `PIPELINE.md`: the fourteen-step sequence, the three reviews called out, and an **old→new number map** so historical plans and `decisions.md` remain readable
- `README.md` and `pipelines/.claude/skills/visuals-flow-2/SKILL.md`: update the verb/step table

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/final-cut.test.mjs 2>&1 | tail -4` -> `# fail 0`, and `grep -c "final-cut.test.mjs" scripts/check.sh` -> `1`, and `grep -c "018-concept-pass-llm" PIPELINE.md` -> at least `1` (the old→new map mentions it)

### Step 7: Full gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-cues.mjs test-03` -> both exit 0

## Test plan

Three tests on `final-cut.mjs`, the important one being **approval is per version** — without it, approving v3 would silently bless a re-cut v4, which is the same stale-approval trap plan 164 guards against on the zone plan.

Everything else is verified by existing gates: `check.sh` (which runs `test-run-sh.sh` and the rulebook checks) fails immediately if a renamed path is missed, because the prompt files would no longer be found.

## Done criteria

- [ ] `ls -d steps/*/` lists exactly the fourteen target folders (twelve renamed/kept + two new)
- [ ] `git log --follow` on a renamed README shows pre-rename history
- [ ] no code path or script references an old step number (Step 2 grep is empty)
- [ ] `node lib/build-prompt.mjs && node lib/check-rulebook.mjs` -> `rulebook ok`
- [ ] `bash scripts/check.sh` exits 0 and `node lib/lint-cues.mjs test-03` exits 0
- [ ] full-resolution `assemble` refuses without Final Cut approval; `--draft` is unaffected
- [ ] `node --test lib/final-cut.test.mjs` -> `# fail 0`; registered in `check.sh`
- [ ] `PIPELINE.md` carries the old→new map
- [ ] `git diff --stat` shows NO change to `decisions.md`, `plans/`, `docs/specs/`, or `videos/`

## STOP conditions

- A folder was renamed with `mv` instead of `git mv`, losing history. Redo it.
- `git mv` refuses because a target already exists — you renamed in the wrong order. Go highest-number first.
- You are about to update step numbers inside `decisions.md`, `plans/*`, `docs/specs/*` or `tests/TESTS.md`. Those are historical; the `PIPELINE.md` map is how they stay readable.
- `--draft` assembly becomes gated. The owner must be able to produce a copy to review; gating it makes REVIEW 3 unreachable.
- Any code path sets `final-cut.json` `approved` other than the board control.
- Plan 164's `zone-plan` verb or board tab is missing — 164 has not landed. STOP; do not rebuild it here.

## Maintenance notes

- The rule this encodes: **numeric order is run order.** A future step inserted between two others takes a number between them; if there is no room, renumber the block rather than appending out of sequence. The `018` / `035` / `095` numbers existed precisely because that was avoided before.
- All three reviews now share one shape — a flag in a JSON file that a downstream step refuses to pass, settable only from the board. `zone-plan.json`, `cues.json`/`shots.json`, `final-cut.json`.
- Final Cut approval is per version deliberately. If versions ever stop being labelled, that check silently weakens to "approved at some point", which is the failure it exists to prevent.
