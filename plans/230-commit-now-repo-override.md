<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: bash scripts/check-skill-descriptions.sh && bash scripts/check-repo-hygiene.sh
ui:
deploy:
needs: []
needs_prs: [187, 188]
touches: [tooling/claude-skills/commit-now/SKILL.md, .claude/skills/personal-stuff-change-control/SKILL.md, CLAUDE.md]
mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 230: teach `commit-now` about workspaces — without changing it for the work repos

## Summary

- **Problem statement**: `commit-now` is listed in **both** `tooling/claude-skills/manifest/
  personal.txt` and `manifest/work.txt`, so it is live in the owner's ZluriHQ work repos. Four of
  its rules now conflict with this repo's workspace model: hard constraint #7 says branch names
  MUST be `feature/<small-name>` **always**, but workspace branches are named by `pp-work`
  (`work/<slug>`, `subject/<slug>`); "After commit, **stop**. Do not push" is still true of the
  skill but no longer true of the outcome, since a `post-commit` hook lands the commit; the skill
  runs `git add` and `git commit`, which the wall denies in the main checkout; and its
  "Merge & conflict-resolution commits" section describes work that now belongs to `pp-land` and
  the boss land sweep.
- **Goals**: exactly **one** line added to the shared skill — repo-local overrides win where they
  exist — with all personal-stuff specifics living in this repo. ZluriHQ behaviour byte-identical.
- **Executor proposed**: `claude-p` / `sonnet`. Per `tooling/boss/data/rules.md`, *quality-setting
  content the owner judges by taste* routes here: this is skill prose that shapes how every commit
  in two accounts is made, and the risk is a wording change that silently alters work-repo
  behaviour.
- **Done criteria** (terse — full list below): the shared skill gains exactly one line; the
  personal-stuff override exists and covers all four conflicts; both check scripts pass.
- **Stop conditions** (terse — full list below): any existing hard constraint in the shared skill
  is reworded, renumbered or removed; the override tells the model to skip the checks; a
  work-repo behaviour changes.
- **Test / verification for success**: `scripts/check-skill-descriptions.sh` (the repo's existing
  skill gate) plus `scripts/check-repo-hygiene.sh`, and a **diff-size assertion** on the shared
  skill — the strongest available check that work-repo behaviour did not move.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/claude-skills/commit-now/ .claude/skills/`

## Status

- **Priority**: P2 — the system works without it, but every commit in this repo hits the friction.
- **Effort**: S
- **Risk**: MED — the blast radius is the owner's **work** repos, which must not change at all.
- **Depends on**: PRs for plan 226 (`pp-work claim`) and plan 227 (the wall). Landing this earlier
  would document commands and a guard that do not exist yet.
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The owner's constraint was explicit: this workflow applies to `personal-stuff` only, and the
ZluriHQ work repos must be completely unaffected. `commit-now` is the one shared component that
straddles both, so it is the one place where a careless edit reaches the work account.

The cheapest safe shape is therefore a single line of indirection in the shared skill, and all the
specifics in a repo-local document. That way the shared file's diff is one line, which is itself
the strongest available evidence that nothing moved for work.

## Current state

### The four conflicts, quoted from the shared skill

Hard constraint #7, verbatim:

> **Branch naming: `feature/{small-name}` always.** Whenever a branch is created (or renamed) as
> part of the commit flow, it MUST be `feature/<small-name>` — a short, lowercase, kebab-case slug
> […] No `fix/`, `bugfix/`, `chore/`, or long descriptive slugs, regardless of change type.

Workspace branches are `work/<slug>` and `subject/<slug>`, created by `pp-work claim`, not by the
commit flow.

Step 5, verbatim:

> After commit, **stop**. Do not push. Do not open a PR. Do not amend.

Still correct **for the skill** — but in this repo a `post-commit` hook now lands the commit, so a
reader must not conclude that nothing further happens.

Hard constraint #1 allows `git add <specific files>` and `git commit`. In this repo the wall
(`.claude/hooks/no-history-in-main.sh`) denies both in the **main** checkout, so the skill must
claim a workspace first rather than hit the guard and reach for `GUARD_OK=1`.

The "Merge & conflict-resolution commits" section instructs the model to finish a conflicted merge
itself. In this repo merges and conflict resolution belong to `pp-land` and the boss land sweep.

### Verified sharing

`grep -rn "commit-now" tooling/claude-skills/manifest/*.txt` returns a line in **both**
`personal.txt` and `work.txt`. So any change to the shared file is a change to the work account.

### The right home for the specifics

`.claude/skills/` holds this repo's operating skills, including
`personal-stuff-change-control`, which already owns "how change gets made here". That is where the
specifics belong — not a new skill, which would need a manifest entry and would be one more thing
to keep in sync.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Skill gate | `bash scripts/check-skill-descriptions.sh` | exit 0 |
| Hygiene gate | `bash scripts/check-repo-hygiene.sh` | prints `repo hygiene OK`, exit 0 |
| Shared-skill diff size | `git diff --numstat tooling/claude-skills/commit-now/SKILL.md` | `1 0 …` |
| Confirm the sharing | `grep -c commit-now tooling/claude-skills/manifest/work.txt` | `1` |

## Scope

**In scope**:
- `tooling/claude-skills/commit-now/SKILL.md` — **exactly one added line**
- `.claude/skills/personal-stuff-change-control/SKILL.md` — a new subsection
- `CLAUDE.md` — at most one added line, only if the routing table needs it

**Out of scope** — looks related, do not touch:
- **Every existing hard constraint, step, example and edge case in the shared skill.** Do not
  reword, renumber, reorder or delete any of them. Constraint #7 in particular stays exactly as
  written — the override *supersedes* it in this repo; it does not edit it.
- **`manifest/work.txt` and `manifest/personal.txt`.** No membership change.
- **Any other skill** under `tooling/claude-skills/`.
- **`--no-verify`.** It needs no change: measured, it skips `pre-commit` but still runs
  `post-commit`, so the landing trigger is unaffected.
- The wall, `pp-work`, `pp-land` — earlier plans own them.

## Git workflow

- Branch: `advisor/230-commit-now-repo-override`
- Commit per step, message style `docs(skill): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Add exactly one line to the shared skill

In `tooling/claude-skills/commit-now/SKILL.md`, inside the "Hard constraints" section, add **one**
line as a new final constraint. Use this wording:

```markdown
8. **Repo-local overrides win.** If the repository being committed to ships its own commit-flow rules (in `.claude/skills/` or its root `CLAUDE.md`), read them first and follow them where they differ from this skill — a repo may own its branch naming, its staging location, and what happens after the commit.
```

Nothing else in the file changes. That one line is what keeps the work repos byte-identical.

**Verify**: `git diff --numstat tooling/claude-skills/commit-now/SKILL.md` -> `1	0	…`
(exactly one insertion, zero deletions)
**Verify**: `grep -c 'Repo-local overrides win' tooling/claude-skills/commit-now/SKILL.md` -> `1`

Commit: `docs(skill): commit-now defers to repo-local overrides`

### Step 2: Write the personal-stuff specifics

Add a subsection to `.claude/skills/personal-stuff-change-control/SKILL.md` titled
**"commit-now in this repo"**, covering exactly these four points and nothing more:

1. **Branch naming is not yours.** `pp-work claim` creates and names the branch (`work/<slug>` or
   `subject/<slug>`). Do not rename it to `feature/<name>`, and do not create a branch as part of
   the commit flow. Shared constraint #7 does not apply here.
2. **Claim a workspace before staging.** The main checkout refuses history-recording git verbs
   (`.claude/hooks/no-history-in-main.sh`). So run
   `cd "$(pp-work claim --kind code --slug <task>)"` first and commit there. **Do not reach for
   `GUARD_OK=1`** — every use of it trains the override on, and there are deliberately zero call
   sites in the repo.
3. **The commit still does not push — but it does land.** `commit-now` never pushes, exactly as
   the shared skill says. A `post-commit` hook then verifies and merges the commit to `main` on its
   own. So do not push, do not open a PR, and do not treat "not pushed" as "not going anywhere".
4. **Merges and conflicts are not yours.** `pp-land` performs the merge and the boss land sweep
   resolves a blocked one. The shared skill's "Merge & conflict-resolution commits" section does
   not apply here; do not finish a conflicted merge by hand in a workspace unless a land brief
   explicitly asks for it.

Keep it to the file's existing terse style. Every sentence must be actionable — this text loads in
sessions, so prose that only explains costs tokens without changing behaviour.

**Verify**: `grep -c 'pp-work claim' .claude/skills/personal-stuff-change-control/SKILL.md` ->
at least `1`
**Verify**: `grep -c 'GUARD_OK' .claude/skills/personal-stuff-change-control/SKILL.md` -> `1`
(the instruction **not** to use it)
**Verify**: `bash scripts/check-skill-descriptions.sh` -> exit 0

Commit: `docs(skill): commit-now rules for this repo`

### Step 3: Route to it, if needed

Read `CLAUDE.md`'s "Find it fast" table. If no existing row would lead someone to the
change-control skill for a commit question, add **one** row. If a suitable row already exists,
change nothing and say so in your report.

Plan 227 already added a two-line rule to `CLAUDE.md` naming `pp-work claim`; do not duplicate it.

**Verify**: `bash scripts/check-repo-hygiene.sh` -> prints `repo hygiene OK`
**Verify**: the `CLAUDE.md` diff is **0 or 1** added lines —
`git diff --numstat CLAUDE.md | awk '{print $1}'` -> `0` or `1`

Commit: `docs: route commit questions to change-control` *(skip this commit entirely if Step 3
changed nothing)*

## Test plan

There is no code here, so the verification is structural and diff-shaped:

- `scripts/check-skill-descriptions.sh` — the repo's existing gate on skill files.
- `scripts/check-repo-hygiene.sh` — proves this plan did not disturb the ignore rules.
- **The one-line diff assertion on the shared skill.** This is the real test. The risk this plan
  carries is a change leaking into the ZluriHQ work account, and there is no test suite in this
  repo that can observe a work repo. A one-insertion-zero-deletion diff is the strongest available
  evidence that nothing moved for work, so it is a Done criterion rather than a nicety.

No mutation gate: this plan adds no gate, lint code or assertion, so there is nothing that could
silently fail to fire. The frontmatter's mutation fields are deliberately blank.

## Done criteria

- [ ] `git diff --numstat tooling/claude-skills/commit-now/SKILL.md` shows exactly **1 insertion,
      0 deletions**.
- [ ] `grep -c 'Repo-local overrides win' tooling/claude-skills/commit-now/SKILL.md` returns `1`.
- [ ] `grep -c 'feature/{small-name}' tooling/claude-skills/commit-now/SKILL.md` returns the same
      count as before the change — constraint #7 is untouched.
- [ ] `.claude/skills/personal-stuff-change-control/SKILL.md` contains all four points: a
      `pp-work claim` instruction, the "do not use `GUARD_OK`" instruction, the
      "does not push but does land" clarification, and the "merges are not yours" rule.
- [ ] `bash scripts/check-skill-descriptions.sh` exits 0.
- [ ] `bash scripts/check-repo-hygiene.sh` prints `repo hygiene OK`.
- [ ] `git diff --numstat CLAUDE.md` shows 0 or 1 added lines.
- [ ] `git diff --name-only` against the branch point lists at most the three files in `touches`.
- [ ] No file under `tooling/claude-skills/` other than `commit-now/SKILL.md` is modified.

## STOP conditions

- **The shared skill's diff is more than one added line.** STOP and report. The whole safety
  argument for this plan is that diff size.
- **You are about to reword, renumber, reorder or delete any existing hard constraint**, step,
  example or edge case in `commit-now/SKILL.md`. STOP. The override supersedes; it does not edit.
- **You are about to change `manifest/work.txt` or `manifest/personal.txt`.** STOP — membership is
  not this plan's business.
- **You are about to write an override that tells the model to skip `commit-now`'s checks**
  (format, lint, typecheck, build) or to use `--no-verify` more freely. STOP. The override changes
  *where* work is committed and *what happens after*, never *whether it is checked*.
- **You are about to add a `GUARD_OK=1` example.** STOP. Even as an illustration, an example is a
  call site — the override's job is to say do not use it.
- **You cannot find `.claude/skills/personal-stuff-change-control/SKILL.md`.** STOP and report
  rather than creating a new skill; a new skill needs a manifest entry and becomes one more file to
  keep in sync.

## Maintenance notes

- The one-line indirection is the pattern to reuse for any future shared skill that needs
  repo-specific behaviour: one line in the shared file, all specifics in the repo. It keeps the
  work account's blast radius at exactly one line.
- `commit-now` is in both manifests. Anyone editing it should check
  `grep -rn commit-now tooling/claude-skills/manifest/*.txt` first and treat every change as a
  change to the owner's work repos.
- If shared constraint #7 is ever renumbered upstream, this plan's constraint #8 moves with it —
  the override text refers to behaviour, not to a number, so no cross-reference breaks.
- `--no-verify` remains safe and needs no note in either file: it skips `pre-commit`, not
  `post-commit`, so the landing trigger fires either way. Measured, not assumed.
