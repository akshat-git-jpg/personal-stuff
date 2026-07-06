# Plan 041: secretary skill — raise mode

> **Executor instructions**: Follow step by step. Run every Verify. Honor STOP
> conditions. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 00d3d6c..HEAD -- tooling/claude-skills/secretary tooling/claude-skills/manifest`
> Expect empty. If `tooling/claude-skills/secretary/` exists, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (authoring a skill markdown + two manifest lines)
- **Depends on**: 039 (labels, frontmatter contract, branch convention)
- **Category**: feature
- **Executor**: agy
- **Difficulty**: standard (prose skill; the frontmatter contract is pinned below)
- **Planned at**: commit `00d3d6c`, 2026-07-07

## Why this matters

`secretary` is the thin bridge between the `orchestrate` skill (which makes a boss-ready
plan in `plans/`) and `boss` (which implements it). Its `raise` mode turns a finished
plan file into a `boss:ready` GitHub PR: branch, commit the plan, open the PR, apply
labels. It is deliberately mechanical — no brainstorming, no planning. Design:
`docs/specs/2026-07-07-boss-design.md`. (Its `groom` mode is plan 042.)

## Current state

- `tooling/claude-skills/secretary/` does not exist.
- **How skills work here** (verified recon): a cross-repo skill is a folder
  `tooling/claude-skills/<name>/SKILL.md`; register it by adding its name to
  `tooling/claude-skills/manifest/work.txt` and/or `manifest/personal.txt`, then running
  `scripts/relink.sh` (symlinks into both accounts) and restarting sessions.
- **Exemplar frontmatter** (from `.claude/skills/dsa-coach/SKILL.md` — READ it):
  ```yaml
  ---
  name: dsa-coach
  description: <what + when + trigger phrases, <=500 chars, hard cap ~700>
  user-invocable: true
  metadata:
    author: kbtg
    version: 1.0.0
  ---
  ```
  Only these fields are allowed. `name` MUST equal the folder name.
- **The boss PR contract this skill produces** (from plan 039): branch `boss/<NNN-slug>`;
  the plan file `plans/<NNN-slug>.md` is the branch's initial commit; labels
  `type:feature|bug|refactor|chore` + `boss:ready`; the plan's YAML frontmatter must have
  a non-empty `test_cmd`.
- **Account selection**: pushing/opening a PR must use the correct GitHub account. The
  repo has a `github-router` skill that picks the account by repo path — secretary's body
  tells Claude to follow it before any push.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Frontmatter present | `grep -q '^name: secretary' tooling/claude-skills/secretary/SKILL.md` | exit 0 |
| Description length | `awk '/^description:/{print length($0)-13}' .../SKILL.md` | <= ~700 |
| Manifest entries | `grep -qx secretary tooling/claude-skills/manifest/work.txt` (and personal.txt) | exit 0 |

## Scope

**In scope**: `tooling/claude-skills/secretary/SKILL.md`; append `secretary` to
`tooling/claude-skills/manifest/work.txt` AND `manifest/personal.txt`.
**Out of scope**: `scripts/relink.sh` (do NOT run it — it's a manual post-merge step);
any other skill; `tooling/boss/**`.

## Git workflow

- Branch: `advisor/041-secretary-raise` (from current branch; do NOT push).
- One commit. Plain message.

## Steps

### Step 1: Write the skill

Create `tooling/claude-skills/secretary/SKILL.md`. Frontmatter (fill the description,
≤500 chars, with explicit triggers):
```yaml
---
name: secretary
description: Raise a boss:ready GitHub PR from a finished orchestrate plan in plans/ (the bridge to the boss orchestrator). Use to ship a plan for implementation. Triggers on "secretary raise", "raise a boss PR", "raise the PR for this plan", "ship this plan to boss", "/secretary", "secretary".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---
```

Body (`raise` mode) — write these instructions as the skill content:

1. **Identify the plan.** Take the plan file path from the invocation (e.g.
   `plans/043-fix-widget.md`) or ask the owner which plan. Derive `NNN-slug` from the
   filename (strip `plans/` and `.md`).
2. **Precondition — `test_cmd`.** Read the plan's YAML frontmatter (the first `---`…`---`
   block). If `test_cmd` is empty or missing, STOP and tell the owner: boss requires a
   `test_cmd` (one command, exit 0 = pass) — ask them to fill the plan's frontmatter (or
   offer to add it), then re-run. Do NOT raise a PR without it.
3. **Pick the type label** from the plan's `Category` (feature→`type:feature`,
   bug→`type:bug`, refactor→`type:refactor`, else `type:chore`). Ensure the label
   taxonomy exists: `gh label create` each of `type:*` and `boss:*` (idempotent; ignore
   "already exists").
4. **Account.** Follow the `github-router` skill to select the right GitHub account for
   this repo before any push.
5. **Branch + commit + PR:**
   ```bash
   git checkout -b "boss/<NNN-slug>" origin/main
   git add "plans/<NNN-slug>.md"
   git commit -m "plan: <NNN-slug>"
   git push -u origin "boss/<NNN-slug>"
   gh pr create --title "<NNN-slug>: <plan title>" \
     --body "Boss-ready plan. Implemented by boss when picked. See plans/<NNN-slug>.md." \
     --label "<type-label>" --label "boss:ready"
   ```
6. **Report** the PR URL to the owner and stop. Do NOT dispatch or implement — that is
   boss's job.

Keep the body under ~150 lines. No `references/` folder needed.

**Verify**: `grep -q '^name: secretary' tooling/claude-skills/secretary/SKILL.md && grep -q 'boss:ready' tooling/claude-skills/secretary/SKILL.md` -> exit 0.

### Step 2: Register in both manifests

Append `secretary` (as its own line) to BOTH:
- `tooling/claude-skills/manifest/work.txt`
- `tooling/claude-skills/manifest/personal.txt`

Do NOT run `relink.sh` — that plus a session restart is a manual post-merge step (a
worktree can't usefully relink or restart the owner's sessions).

**Verify**: `grep -qx secretary tooling/claude-skills/manifest/work.txt && grep -qx secretary tooling/claude-skills/manifest/personal.txt` -> exit 0.

## Test plan

Static checks only (a skill is prose, not code): frontmatter present and valid, `name`
matches the folder, description within budget, both manifest lines added. There is no
runtime test in the worktree — the skill only takes effect after the manual relink +
restart post-merge.

## Done criteria

- [ ] `tooling/claude-skills/secretary/SKILL.md` exists with valid 5-field frontmatter,
      `name: secretary`, `user-invocable: true`.
- [ ] Description ≤ ~700 chars.
- [ ] `secretary` appears once in each of `manifest/work.txt` and `manifest/personal.txt`.
- [ ] The body covers all six raise steps, including the `test_cmd` precondition and the
      `github-router` account step.

## STOP conditions

- Plan-side `test_cmd` precondition logic is unclear → STOP (do NOT invent a fallback that
  lets a PR be raised without a test_cmd; boss depends on it).
- You are tempted to run `relink.sh` or restart a session from the worktree → STOP (manual
  post-merge step).
- You need to touch any other skill or `tooling/boss/**` → STOP.

## Maintenance notes

- Plan 042 adds the `groom` mode to this same SKILL.md and extends the description.
- **Post-merge manual steps (human, on main — list them in the run report):**
  `scripts/relink.sh` then `scripts/skills-status.sh` (expect `secretary` linked, no
  DANGLING), then restart `claude-work`/`claude-personal` sessions so the skill loads.
