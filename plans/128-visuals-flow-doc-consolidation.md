<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["Independent — cites only surfaces that exist today"]
---

# Plan 128: Delete the doc copies that already drifted

## Summary

- **Problem statement**: Three documents carry content that is superseded, duplicated or self-contradictory: `EDITOR-STYLE-GUIDE.md` teaches a density philosophy the owner reversed on 2026-07-21 and defines a colour that exists in no palette; `visuals-flow/decisions.md` is a one-line orphan while every citation means the root file; `HANDOFF.md`'s rules map is headed "five surfaces" and lists seven.
- **Goals**:
  - Delete the superseded density section rather than merging it.
  - Make `card-library/DESIGN.md` the only home for palette values, enforced by a check.
  - Delete the orphan `decisions.md` and repoint its citations.
  - Fix the HANDOFF map to one accurate line per surface.
- **Executor proposed**: `claude-p` / `sonnet` — docs the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): no hex colour in the style guide absent from DESIGN.md, enforced by a check; the density section is gone; the orphan file is gone; the HANDOFF count matches its list; `bash scripts/check.sh` green.
- **Stop conditions** (terse — full list below): suite red before starting; a citation whose target you cannot find in root `decisions.md`.
- **Test / verification for success**: a palette-drift check in `check-cards.sh` that fails on an induced stray hex value.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat be36087..HEAD -- pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/decisions.md pipelines/video/card-library/DESIGN.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: mechanical
- **Planned at**: commit `be36087`, 2026-07-22

## Why this matters

Each of these is a document that will actively mislead someone. The style guide is the worst: a human editor reading it today is told to skip graphics during demos and target one fullframe every 45 to 90 seconds, when the linter now enforces 35 to 60 and the rulebook says motion graphics are "a near-constant presence, not a rare garnish". It was never updated in the fold that reversed the stance, because nothing connected the two.

## Current state

### `EDITOR-STYLE-GUIDE.md:22` verbatim

```
| Accent light | `#FDBA74` | secondary accent when two accent levels are needed |
```

`#FDBA74` appears nowhere else in the repository. Verified 2026-07-22 with `grep -rn 'FDBA74' visuals-flow card-library`, one hit, this line. `card-library/DESIGN.md:17-25` owns the palette and does not contain it.

Both files already admit the duplication: `DESIGN.md:3-4` and `EDITOR-STYLE-GUIDE.md:8-9` each tell the reader to keep them in sync.

### `EDITOR-STYLE-GUIDE.md:78-79` and `:88-92` verbatim

```
The default is NO graphic: the screen recording or presenter carries the video
```

```
Rough rhythm: one fullframe beat every 45-90 seconds... If in doubt during demo stretches, skip the graphic
```

Root `decisions.md:157` records the reversal. The live numbers are `GAP_FULLFRAME_MIN: 35` and `GAP_FULLFRAME_MAX: 60` in `lib/cue-constants.mjs:11-12`.

### `visuals-flow/decisions.md`, the complete file

```
- Removed implicit effects from the assembly loop; implemented an explicit effects registry and effects.json manifest. This decouples aesthetic decisions from structural planning.
```

One line, undated. Meanwhile `HANDOFF.md:1` and `:67-68` cite "decisions.md 2026-07-17/18/20/21", entries that live in the ROOT `decisions.md`, tagged `(visuals-flow, owner)`.

### `HANDOFF.md:146` verbatim

```
## Where the rules live (five surfaces)
```

The list that follows runs to item 7, ending at line 171.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, ends `visuals-flow check OK` |
| Card checks | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Find stray hex values | `cd pipelines/video && grep -o '#[0-9A-Fa-f]\{6\}' visuals-flow/EDITOR-STYLE-GUIDE.md \| sort -u` | every value also in DESIGN.md |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md`
- `pipelines/video/visuals-flow/HANDOFF.md`
- `pipelines/video/visuals-flow/decisions.md` (deleted)
- `pipelines/video/card-library/DESIGN.md` (gains the single-source note only)
- `pipelines/video/card-library/scripts/check-cards.sh` (gains the palette check)

**Out of scope**:
- Root `decisions.md`. Do not add, edit or reorder entries there. This plan only repoints citations at it.
- `steps/020-cue-pass-llm/RULEBOOK.md` — a separate plan owns its trimming. Do not edit it here even though it is a rules surface.
- `EFFECTS.md`, `INTEGRATION.md`, `PIPELINE.md`, `tests/TESTS.md`. Each has a distinct job; leave them.
- Any card `index.html`. Changing the palette is not in scope; this plan only stops it being defined twice.
- `videos/**` — never touch a video workdir.

## Git workflow

- Branch: `advisor/128-visuals-flow-doc-consolidation`
- Commit: `visuals-flow: delete the doc copies that drifted` — no AI footers. Do NOT push.

## Steps

### Step 1: Delete the superseded density section from `EDITOR-STYLE-GUIDE.md`

Remove lines 76-92 entirely. Replace with exactly:

```md
## Density and placement

Not your call, and not in this guide. Which graphic fires when, and how often,
is decided by the pipeline: the rules live in
`steps/020-cue-pass-llm/cue-pass-prompt.md`, the numbers in
`lib/cue-constants.mjs`, and `lib/lint-cues.mjs` enforces both.
This guide covers only how a hand-built graphic should LOOK.
```

Do not merge, soften or preserve any of the old text. It is wrong, not merely outdated.

**Verify**: `cd pipelines/video && grep -c '45-90' visuals-flow/EDITOR-STYLE-GUIDE.md` -> `0`

### Step 2: Single-source the palette

In `EDITOR-STYLE-GUIDE.md`, delete the `Accent light | #FDBA74` row outright: it names a token no card uses.

For the remaining palette rows, keep the table (the editor needs the values to hand) but replace the "keep in sync" note at lines 8-9 with:

```md
Palette values below are owned by `card-library/DESIGN.md`. They are checked:
`scripts/check-cards.sh` fails if this file names a colour DESIGN.md does not.
```

In `DESIGN.md`, replace its own cross-reference at lines 3-4 with a single line stating it owns the palette and that `EDITOR-STYLE-GUIDE.md` is checked against it.

**Verify**: `cd pipelines/video && grep -c 'FDBA74' visuals-flow/EDITOR-STYLE-GUIDE.md` -> `0`

### Step 3: Enforce it in `check-cards.sh`

Add a section, matching the file's existing `echo "==> ..."` style, that extracts every 6-digit hex value from `../visuals-flow/EDITOR-STYLE-GUIDE.md` and fails if any is absent from `DESIGN.md`. Compare case-insensitively: the two files differ in case today.

```sh
echo "==> style-guide palette matches DESIGN.md"
for hex in $(grep -o '#[0-9A-Fa-f]\{6\}' ../visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u); do
  if ! grep -qi -- "$hex" DESIGN.md; then
    err "$hex is in EDITOR-STYLE-GUIDE.md but not DESIGN.md — DESIGN.md owns the palette"
  fi
done
```

Use whatever the file's existing error helper is named; `err` above is a placeholder to match to the real one.

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0. Then add a fake `#ABCDEF` row to the style guide, re-run, confirm it fails naming that value, and remove the row.

### Step 4: Delete the orphan `decisions.md`

`git rm pipelines/video/visuals-flow/decisions.md`.

Its single line records the effects-registry decision. Before deleting, confirm that decision is represented in root `decisions.md`; if it is not, STOP and report rather than losing it.

Then repoint every citation. Search the folder for `decisions.md` references and make each one explicit about which file it means:

```
cd pipelines/video/visuals-flow && grep -rn 'decisions.md' --include='*.md' .
```

Rewrite each as `the root decisions.md (entries tagged (visuals-flow, owner))`.

**Verify**: `cd pipelines/video/visuals-flow && ls decisions.md` -> `No such file or directory`, and `grep -rn 'decisions.md' --include='*.md' . | grep -v 'root decisions.md'` -> no output

### Step 5: Fix the HANDOFF rules map

Change the heading at line 146 to `## Where the rules live (seven surfaces)`, and rewrite items 1-7 so each is ONE line naming that surface's single job. Use exactly these jobs:

1. `steps/020-cue-pass-llm/cue-pass-prompt.md` — the operative ruleset the cue-pass model reads. Its constraints block is generated; never hand-edit between the markers.
2. `lib/cue-constants.mjs` — the numbers. The single source for every threshold.
3. `lib/lint-cues.mjs` — enforcement. Turns the constants into pass/fail.
4. `card-library/catalog.json` — the per-card contract: schema, capacity, placement, `structural`.
5. `card-library/DESIGN.md` — the visual rules every card obeys, and the palette.
6. `steps/020-cue-pass-llm/RULEBOOK.md` — the judgment archive. Dated owner folds and the WHY.
7. `steps/070-shot-pass-llm/` + `lib/lint-shots.mjs` — the avatar-span equivalents of 1 to 3.

Move the `EFFECTS.md` entry out of this list into its own short paragraph below it: assembly effects are a different domain from cue selection, and listing them together is part of why this section grew confusing.

**Verify**: `cd pipelines/video/visuals-flow && grep -A1 'Where the rules live' HANDOFF.md` -> heading says `seven surfaces`

## Test plan

Step 3's palette check is the only durable guard here; the rest is deletion. Verify it by induced failure as described in Step 3.

## Done criteria

- [ ] `EDITOR-STYLE-GUIDE.md` contains no density guidance and no `45-90`
- [ ] `#FDBA74` appears nowhere in the repository
- [ ] `check-cards.sh` fails on a hex value absent from DESIGN.md
- [ ] `visuals-flow/decisions.md` is deleted and no citation is ambiguous
- [ ] `HANDOFF.md`'s count matches its list, one line per surface
- [ ] `bash scripts/check.sh` exits 0
- [ ] `bash scripts/check-cards.sh` exits 0

## STOP conditions

- `bash scripts/check.sh` is already red before you start. Report and stop.
- The effects-registry decision in the orphan `decisions.md` is NOT represented in root `decisions.md`. Stop and report; do not delete the only copy of a decision.
- A `decisions.md` citation points at a dated entry you cannot find in the root file. Stop and report that citation rather than guessing.
- Removing a palette row would leave a card's colour undocumented. Stop: this plan removes duplicate definitions, never live values.
- You find yourself editing anything under `videos/`. Stop immediately.

## Maintenance notes

- This plan deliberately cites only surfaces that exist today, so it can land in any order. Plan 124 adds `lib/cue-rules.mjs` as a routing-rule source; when it lands, add it to the HANDOFF list from Step 5 and to the style guide's density pointer from Step 1. That is a two-line follow-up, not a dependency.
- The palette check is intentionally crude, string presence rather than parsing. It catches the drift class that actually occurred without needing a token format nobody has agreed on.
