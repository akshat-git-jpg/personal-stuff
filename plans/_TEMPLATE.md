<!-- boss frontmatter — fill for plans that boss will run; delete this block for non-boss plans. -->
---
executor: claude-p       # claude-p | agy
model:                   # blank = executor default (claude-p: sonnet)
test_cmd:                # REQUIRED for boss: one command, exit 0 = pass (this is the merge gate)
ui:                      # true if this plan touches user-facing UI — crew must attach a screenshot to the PR (test_cmd alone can't judge how it looks)
deploy:                  # blank = no deploy; else the deploy command boss runs after merge
needs: []                # optional notes (shared target, ordering)
---

# Plan <NNN>: <Title>

## Summary

- **Problem statement**: <what's broken/missing, 1-2 sentences>
- **Goals**: <bulleted, what this plan achieves>
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
