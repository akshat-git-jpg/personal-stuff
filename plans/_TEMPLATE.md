<!-- boss frontmatter — fill for plans that boss will run; delete this block for non-boss plans. -->
---
executor: claude-p       # claude-p | agy | codex
model:                   # blank = executor default (claude-p: sonnet, agy: Gemini 3.1 Pro (High), codex: gpt-5.6-sol)
test_cmd:                # REQUIRED for boss: one command, exit 0 = pass (this is the merge gate).
                         # It must be able to FAIL on this plan's own deliverable. A repo-wide
                         # suite that passes while the deliverable is broken is not a gate:
                         # plan 158's `check.sh` reported 314/314 green while the video workdir
                         # it produced failed its own lint (2026-07-28). If the deliverable is a
                         # video workdir, chain the per-video check:
                         #   cd <dir> && bash scripts/check.sh && node lib/lint-cues.mjs <slug>
ui:                      # true if this plan touches user-facing UI. ENFORCED (2026-08-02): boss-merge
                         # REJECTS the branch unless it commits an image. PR#141 shipped without one.
deploy:                  # blank = no deploy; else the deploy command boss runs after merge
needs: []                # free prose for humans — boss CANNOT act on this
needs_prs: []            # STRUCTURED: e.g. [138] — boss refuses to dispatch until each PR is closed.
                         # The 180->181->182 chain was sequenced by hand because `needs` is only prose.
touches: []              # files this plan edits, e.g. [lib/lint-cues.mjs] — boss warns when an
                         # in-flight PR shares one (three plans collided on lint-cues.mjs in one batch)

# --- Mutation gate. ARM THIS ON EVERY PLAN THAT ADDS A GATE (lint code, check, assertion).
# A gate that never fires is worse than none: it reads as coverage. On 2026-08-02 two plans
# shipped gates that could not fire — one asserted on SOURCE TEXT so its mutation was circular,
# the other's code never fired at all — and BOTH passed test_cmd. boss now proves it itself:
# clean must pass -> apply -> must FAIL printing mutation_expect -> revert -> must pass again.
mutation_apply:          # shell that reintroduces the real defect (run at repo root)
mutation_command:        # the command that must then fail
mutation_expect:         # string that must appear in that failure (e.g. the lint code)
mutation_cwd:            # optional: dir to run mutation_command in, relative to repo root
mutation_timeout:        # optional seconds, default 600
---

# Plan <NNN>: <Title>

## Summary

- **Problem statement**: <what's broken/missing, 1-2 sentences>
- **Goals**: <bulleted, what this plan achieves>
- **Decisions confirmed**: <the Step 2.5 checkpoint calls the owner made, one line each as
  `<fork> -> <chosen option>`; an empty list means the checkpoint was skipped, which is a bug>
- **Executor proposed**: <executor AND model, one line, matching Step 3.5's difficulty grading>
- **Done criteria** (terse — full list below): <one line>
- **Stop conditions** (terse — full list below): <one line>
- **Test / verification for success**: <one line naming the verify approach>
- **Open points for plan readiness**: <anything unresolved that keeps this plan from being
  handoff-ready; write "none" for a plan that passed Step 3.5>

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <base_commit>..HEAD -- <file_paths>`

## Status

- **Priority**: <P1 | P2 | P3>
- **Effort**: <S | M | L>
- **Risk**: <LOW | MED | HIGH>
- **Depends on**: <dependencies or none>
- **Category**: <feature | bug | security | tech-debt | dx>
- **Difficulty**: <mechanical | standard | tricky — feeds executor/model selection; the executor+model themselves live in the frontmatter above (`executor:` / `model:`), not here>
- **Planned at**: commit `<commit_hash>`, <YYYY-MM-DD>

## Why this matters

<Describe the problem, background context, and what the change accomplishes.>

## Current state

<Describe files, directories, settings, and code paths relevant to this plan. Include code snippets or references where helpful.>

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| <Purpose> | `<command>` | <Expected exit code or stdout> |

## Scope

**In scope**:
- <What is in scope>

**Out of scope**:
- <What is out of scope>

## Git workflow

- Branch: `advisor/<NNN>-<slug>`
- Commit: `<message>` — no AI footers. Do NOT push.

## Steps

### Step 1: <Description>

<Instructions for changes and commands to run.>

**Verify**: `<command>` -> `<expected output>`

### Step 2: <Description>

<Instructions for changes and commands to run.>

**Verify**: `<command>` -> `<expected output>`

## Test plan

<Summary of verification / testing procedures.>

## Done criteria

- [ ] <Criterion 1>
- [ ] <Criterion 2>

## STOP conditions

- <Condition 1>
- <Condition 2>

## Maintenance notes

- <Notes for future reference.>
