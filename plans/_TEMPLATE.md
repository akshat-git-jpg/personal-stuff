# Plan <NNN>: <Title>

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
- **Executor**: <antigravity | sonnet | opus — user's call wins; unstated → sonnet, tricky → opus>
- **Difficulty**: <mechanical | standard | tricky>
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
