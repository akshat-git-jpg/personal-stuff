# Plan 042: secretary skill — groom mode

> **Executor instructions**: Follow step by step. Run every Verify. Honor STOP
> conditions. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 00d3d6c..HEAD -- tooling/claude-skills/secretary/SKILL.md`
> Expect the file to exist (from plan 041) with a raise section but no groom section.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 041 (the secretary SKILL.md must exist)
- **Category**: feature
- **Executor**: agy
- **Difficulty**: standard (prose; the label-ownership boundary is pinned below)
- **Planned at**: commit `00d3d6c`, 2026-07-07

## Why this matters

Secretary's second mode. `groom` is an on-demand sweep of open PRs that retires the ones
reality has passed by (a plan raised days ago that no longer matches main), so boss never
spends a crew on stale work. The load-bearing rule (from `docs/specs/2026-07-07-boss-design.md`):
**groom only ever touches `boss:ready` or draft PRs — never `boss:in-progress`/`done`/
`blocked`.** That single boundary makes groom and boss non-overlapping by construction, so
they cannot double-close or race a PR (boss owns everything from `in-progress` onward).

## Current state

- `tooling/claude-skills/secretary/SKILL.md` exists (plan 041) with a `raise` section and
  a raise-focused description.
- Label state machine (plan 039): `boss:ready → boss:in-progress → boss:done|boss:blocked`.
  boss flips `ready→in-progress` at dispatch. Groom must respect that as a lock.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| List groomable PRs | `gh pr list --state open --label boss:ready --json number,title,createdAt` | JSON |
| Groom section present | `grep -q 'groom' tooling/claude-skills/secretary/SKILL.md` | exit 0 |

## Scope

**In scope**: edit `tooling/claude-skills/secretary/SKILL.md` — append a `groom` section
to the body and extend the `description` to add groom triggers.
**Out of scope**: `manifest/*` (already done in 041); `relink.sh`; `tooling/boss/**`; any
other skill.

## Git workflow

- Branch: `advisor/042-secretary-groom` (from current branch; do NOT push).
- One commit.

## Steps

### Step 1: Extend the description

Update the `description:` line in the frontmatter to add groom triggers, keeping it
≤ ~700 chars. Append to the existing trigger list, e.g.:
`"secretary groom", "clean up open PRs", "audit boss PRs", "retire stale PRs"`.

**Verify**: `awk '/^description:/{print length($0)}' tooling/claude-skills/secretary/SKILL.md` -> a number ≤ ~713 (700 + `description: `).

### Step 2: Append the groom section to the body

Add a `## groom` section instructing Claude to:

1. **List candidates**: open PRs labelled `boss:ready`, plus draft PRs (still being
   brainstormed). Show each with its age (`createdAt`) and title, oldest first.
2. **Hard boundary — the lock**: NEVER touch a PR labelled `boss:in-progress`,
   `boss:done`, or `boss:blocked`. Those belong to boss. If asked to, refuse and explain.
3. **For each candidate, discuss with the owner** whether it is still relevant. Check how
   far behind `origin/main` its branch is (`git log --oneline origin/main..origin/<branch> | wc -l`
   and the reverse) and whether the plan still matches current code. For each, offer:
   - **keep** — leave it `boss:ready`;
   - **update** — edit the plan file on its branch (commit + push) to match current
     reality, then leave it `boss:ready`;
   - **park** — remove the `boss:ready` label (drops it out of boss's queue without
     closing), for "not now";
   - **close** — `gh pr close <n>` with a one-line reason comment, for dead plans.
4. **Never auto-decide** — groom always acts on the owner's per-PR call. It is a
   discussion sweep, not a batch delete.
5. Follow the `github-router` skill before any push (editing a plan on its branch).

Keep the whole SKILL.md under ~200 lines.

**Verify**: `grep -q '## groom' tooling/claude-skills/secretary/SKILL.md && grep -q 'boss:in-progress' tooling/claude-skills/secretary/SKILL.md` -> exit 0.

## Test plan

Static checks: the groom section exists, names the four owner options (keep/update/park/
close), and states the "never touch in-progress/done/blocked" lock. No runtime test in the
worktree (skill takes effect after the post-merge relink + restart from plan 041).

## Done criteria

- [ ] SKILL.md has a `## groom` section covering list → lock → per-PR discussion →
      keep/update/park/close.
- [ ] The `boss:in-progress`/`done`/`blocked` no-touch lock is stated explicitly.
- [ ] Description extended with groom triggers, still ≤ ~700 chars.

## STOP conditions

- You are tempted to let groom modify a `boss:in-progress`/`done`/`blocked` PR → STOP;
  that violates the lock and can race boss.
- You need to touch `manifest/*`, `tooling/boss/**`, or run `relink.sh` → STOP.

## Maintenance notes

- The groom/boss safety rests entirely on the label-ownership split: groom = `ready`+draft,
  boss = `in-progress` onward. If the label state machine changes in `tooling/boss/`, this
  boundary must be revisited.
- Post-merge (same as 041): `scripts/relink.sh` + restart sessions so the updated skill
  loads. (If 041 and 042 land together, one relink covers both.)
