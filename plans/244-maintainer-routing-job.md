---
executor: agy
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (PR#203) must land first — this adds a job folder to its frame"]
needs_prs: [203]
touches: [tooling/maintainer/jobs/routing/README.md, tooling/maintainer/jobs/routing/runbook.md, tooling/maintainer/jobs/routing/check.sh, tooling/maintainer/jobs/routing/fix.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh, infra/route-audit/prompt.md, infra/route-audit/README.md, .claude/skills/audit-repo-route/SKILL.md, .claude/skills/personal-stuff-docs-and-writing/SKILL.md, CLAUDE.md]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/routing/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('UNMAPPED','UNMAPPT',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: routing check did not report the seeded unmapped folder
mutation_timeout: 300
---

# Plan 244: the routing job — three copies of one check become one

## Summary

- **Problem statement**: the routing-drift checks exist in **two** hand-synced copies —
  `.claude/skills/audit-repo-route/SKILL.md` and `infra/route-audit/prompt.md`, whose first
  line literally reads *"adapted from .claude/skills/audit-repo-route v1.1.0; keep in sync"*.
  A third copy in the maintainer would make it worse.
- **Goals**:
  - Make `jobs/routing/runbook.md` the **single source** for the routing checks.
  - Point the live weekly VPS cron at that runbook instead of its own copy.
  - Delete the `audit-repo-route` skill and every reference to it.
  - Add the half that did not exist: **proposing routes that should exist**, not just finding
    broken ones.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — it deletes a skill and rewires a
  live cron, so it goes to the executor with the landed track record.
- **Done criteria** (terse): `test-maintainer.sh` exit 0; `discover_jobs` finds `routing`;
  the skill folder is gone with no dangling reference; `infra/route-audit/run-audit.sh` still
  runs unchanged.
- **Stop conditions** (terse): do not break the VPS cron; do not let the routing job write
  during a cron run; do not auto-edit `decisions.md`; do not delete the skill before its
  content is in the runbook.
- **Test / verification for success**: the check runs against a **fixture repo** in
  `mktemp -d` with a seeded unmapped folder and a seeded dead link.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 36b2519..HEAD -- tooling/maintainer/ infra/route-audit/ .claude/skills/audit-repo-route/ CLAUDE.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 242
- **Category**: refactor
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

This job is the agent auditing itself. The routing checks were written once, then copied
into a cron prompt with a "keep in sync" comment — which is precisely the drift that job 3
exists to catch. Consolidating them is the point, not a side effect.

There is also a **live weekly cron** already running these checks. After this plan it becomes
a scheduled, report-only run of job 3, so the maintainer's "scheduled later" story is already
half-built.

## Current state

### The live cron (VPS-CRONS.md:486)

```
### route-audit
- **What:** weekly read-only routing-drift audit via `claude -p` → Telegram report (the autonomy pilot).
- **When:** Sunday 08:00 IST (`30 2 * * 0` UTC)
- **Wrapper:** `/srv/crons/route-audit/run.sh`
- **Project code:** `/srv/projects/personal-stuff/infra/route-audit/`
```

`infra/route-audit/run-audit.sh` — **do not change this file**:

```bash
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --disallowedTools "Edit,Write,NotebookEdit,Bash(git commit:*),Bash(git push:*),Bash(rm:*)" \
  <<< "$(cat "$SCRIPT_DIR/prompt.md")"
```

It `cat`s `prompt.md` into `claude -p`. So a `prompt.md` that *points at* the runbook works
without touching the runner: the session reads the file itself.

The tool denylist plus a read-only deploy key on the VPS clone are what make the cron safe.
Both stay exactly as they are.

### The four checks, from `.claude/skills/audit-repo-route/SKILL.md`

| # | Check | Action |
|---|---|---|
| 1 | **Unmapped folder** — a top-level or notable project folder with no row in the intent table and not covered by the README map | auto-fix: add a row |
| 2 | **Dead link or false structural claim** — a link whose target no longer exists, or prose asserting structure that is not there | auto-fix if relocated; flag if deleted |
| 3 | **Missing operate-doc** — a project sub-folder with neither `CLAUDE.md` nor `README.md` while its siblings have one | auto-fix: scaffold a `README.md` stub |
| 4 | **Stale `decisions.md`** — an entry contradicted by the current structure | **flag only, never auto-edit** |

Exemptions (not projects, never audited): `plans/runs/`, any `fixtures/`, `venv/`,
`node_modules/`, `archive/`, and dot-folders.

`infra/route-audit/prompt.md` restates all four, plus one rule the skill does not spell out
as clearly and which **must survive into the runbook**:

> *"superseded ≠ stale (an entry overridden by a LATER entry is settled history, not drift)"*

### Every reference to the skill (measured)

`git grep -ln "audit-repo-route"` returns:

| File | What to do |
|---|---|
| `.claude/skills/audit-repo-route/SKILL.md` | delete the folder |
| `.claude/skills/personal-stuff-docs-and-writing/SKILL.md` | repoint to the job |
| `infra/route-audit/prompt.md` | rewrite to point at the runbook |
| `CLAUDE.md` | repoint the intent-table row if one exists |
| `decisions.md` | **leave** — settled history, not a stale pointer |
| `docs/skill-library-and-infra-handoff.md` | repoint |
| `docs/specs/2026-08-25-repo-maintainer-design.md` | leave — it describes this change |
| `pipelines/tools/big-comparison-util/README.md` | repoint or drop the mention |
| `plans/002`, `plans/007`, `plans/008` | **leave** — landed plans are history |

Also check `.claude/codex-skills.txt`: if `audit-repo-route` is listed, remove it, or Codex
gets a dangling global link. `relink.sh` **cannot** prune a link resolving outside the repo —
that stranded links twice (`jobs/skills/runbook.md` §7).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run the job | `bash tooling/maintainer/bin/run-job.sh routing` | exit 0 or 1, never 2 |
| The cron, dry-run on the Mac | `bash infra/route-audit/run-audit.sh` | a plain-text report, no writes |
| Skill is gone | `test ! -d .claude/skills/audit-repo-route` | exit 0 |

## Scope

**In scope**:
- `tooling/maintainer/jobs/routing/{README.md,runbook.md,check.sh,fix.sh}` (new)
- `tooling/maintainer/CLAUDE.md` — flip the routing row to live
- `tooling/maintainer/test-maintainer.sh` — routing assertions
- `infra/route-audit/prompt.md` — rewrite to point at the runbook
- `infra/route-audit/README.md` — say where the checks now live
- **delete** `.claude/skills/audit-repo-route/`
- repoint the references listed above

**Out of scope**:
- **`infra/route-audit/run-audit.sh`** — the runner, its `--disallowedTools` denylist, and
  its heredoc all stay byte-identical. Changing it risks the cron's read-only guarantee.
- **`VPS-CRONS.md`'s route-audit entry** — the cron's schedule, wrapper and code path do not
  change. Only what `prompt.md` contains changes.
- `decisions.md`, `plans/002`, `plans/007`, `plans/008` — landed history.
- Any other `jobs/<name>/` folder.
- The auto-fixes themselves during a **cron** run — see STOP.

## Git workflow

- Branch: `advisor/244-maintainer-routing-job`
- Commit: `refactor(maintainer): routing job absorbs the route audit` — no AI footers.
  Do NOT push.

## Steps

### Step 1: Write `jobs/routing/runbook.md` — the single source

Merge both existing copies into one document. It must contain, in this order:

1. **What the map is** — the root `CLAUDE.md` "Find it fast" intent table plus the README
   map; `decisions.md` as the decision log; sub-folders expected to carry `CLAUDE.md`
   and/or `README.md`.
2. **The four checks**, exactly as tabulated in Current state above.
3. **The exemptions** list, verbatim.
4. **`superseded ≠ stale`** — an entry overridden by a LATER entry is settled history, not
   drift. This currently lives only in `prompt.md` and must not be lost.
5. **The new fifth check — proposing routes** (Step 2 below).
6. **Report-only mode** — the contract the VPS cron relies on: no edits, no git writes, no
   waiting for input, output is a plain-text report on stdout.

**Verify**:
```bash
grep -c 'superseded' tooling/maintainer/jobs/routing/runbook.md      # >= 1
grep -c 'report-only' tooling/maintainer/jobs/routing/runbook.md     # >= 1
```

### Step 2: The half that did not exist — propose routes

Add a fifth check to the runbook. It produces `improve` findings, never `fix`:

> **5. Missing routes.** A question someone would plausibly ask that the intent table cannot
> answer. Three shapes, and only these three:
>
> - **an unanswerable question** — a folder is mapped, but no row phrases the intent someone
>   would actually search for
> - **a row too vague to route on** — the destination is right but the "If the ask is
>   about…" text would not match a real question
> - **a row pointing at a file where a folder is the real home**, or the reverse
>
> A missing route is an **improvement, never a defect.** It is reported under `improve` and
> is never auto-fixed. Do not propose a row for anything on the exemptions list.

**Why this must stay separate from check 1.** Check 1 finds a folder with *no* row — that is
a defect. Check 5 finds a row that exists and is *weak* — a judgement call. Mixing them
buries "this link is dead" under "this could be phrased better", which is exactly what the
proposal format forbids.

**Verify**: `grep -c 'improve' tooling/maintainer/jobs/routing/runbook.md` -> at least 1.

### Step 3: `jobs/routing/check.sh` — only what a script can decide

Checks 4 and 5 need judgement, so the script does not attempt them. It says so in its output
rather than silently omitting them.

```bash
#!/bin/bash
# routing — the mechanical half. Checks 1-3 only; 4 and 5 need judgement.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# ROUTING_ROOT lets the test point this at a fixture repo.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${ROUTING_ROOT:-$REPO_ROOT}"
cd "$ROOT" || die "cannot reach $ROOT"
[ -f CLAUDE.md ] || die "no CLAUDE.md at $ROOT"

EXEMPT='^(plans/runs|.*/fixtures|.*/venv|.*/node_modules|.*/archive|\..*)$'

found=0
note() { echo "- $1"; found=1; }

echo "# routing findings — $(today)"
echo

echo "## 1. unmapped top-level folders"
for d in */; do
  name="${d%/}"
  echo "$name" | "$GREP" -qE "$EXEMPT" && continue
  "$GREP" -q "$name" CLAUDE.md || note "UNMAPPED $name (no row in the Find it fast table)"
done
echo

echo "## 2. dead links in CLAUDE.md"
"$GREP" -oE '\]\(([^)]+)\)' CLAUDE.md | "$SED" 's/^](//;s/)$//' | sort -u | while read -r target; do
  case "$target" in http*|\#*) continue ;; esac
  t="${target%%#*}"
  [ -e "$t" ] || echo "- DEAD LINK $t (referenced from CLAUDE.md)"
done
echo

echo "## 3. project sub-folders with no operate-doc"
for d in apps/*/ pipelines/*/ tooling/*/; do
  [ -d "$d" ] || continue
  echo "$d" | "$GREP" -qE "$EXEMPT" && continue
  if [ ! -f "$d/README.md" ] && [ ! -f "$d/CLAUDE.md" ]; then
    note "NO OPERATE-DOC $d (siblings have one)"
  fi
done
echo

echo "## 4. stale decisions.md entries — NOT CHECKED HERE"
echo "(needs judgement, and superseded is not stale: an entry overridden by a LATER entry"
echo " is settled history. The session does this against runbook.md check 4.)"
echo
echo "## 5. routes that SHOULD exist — NOT CHECKED HERE"
echo "(an improvement, not a defect. The session does this against runbook.md check 5.)"

exit $found
```

The dead-link loop deliberately prints directly rather than calling `note` — it runs inside a
pipeline subshell, so a `found=1` there would be lost. The findings still appear; the exit
code is driven by checks 1 and 3. **Do not "fix" this by restructuring the pipeline** without
also proving the exit code still works.

**Verify**: `bash tooling/maintainer/bin/run-job.sh routing` -> exit 0 or 1, never 2.

### Step 4: Repoint the cron's prompt at the runbook

Rewrite `infra/route-audit/prompt.md` to hold **no copy of the checks**:

```markdown
You are an automated, unattended weekly auditor. This is a **REPORT-ONLY** run: you MUST NOT
edit, create, or delete any file, run any git write command, or attempt any fix. Your only
output is a plain-text drift report printed to stdout. There is no user to ask; never wait
for input.

## What to do

Read `tooling/maintainer/jobs/routing/runbook.md` and perform every check it lists, against
the repository at the current working directory.

That runbook is the single source for these checks. This file deliberately contains no copy
of them — the previous version did, with a "keep in sync" comment, and that is the exact
drift this audit exists to find.

## Output

A plain-text report, grouped by the runbook's check numbers. For each finding give the file
or folder, what is wrong, and the one-line fix you would propose. Propose; never apply.

If a check finds nothing, say so in one line. If the runbook is missing, say that and stop.
```

Update `infra/route-audit/README.md` to say the checks live in the runbook now.

**Do not touch `run-audit.sh`.** It still `cat`s this file into `claude -p` with the same
denylist.

**Verify**:
```bash
grep -c 'jobs/routing/runbook.md' infra/route-audit/prompt.md   # >= 1
grep -c 'Unmapped folders' infra/route-audit/prompt.md          # 0 — no copy left
git diff --name-only -- infra/route-audit/run-audit.sh          # empty
```

### Step 5: Delete the skill and repoint every reference

```bash
git rm -r .claude/skills/audit-repo-route
```

Then repoint, per the Current-state table: `personal-stuff-docs-and-writing/SKILL.md`, root
`CLAUDE.md`, `docs/skill-library-and-infra-handoff.md`,
`pipelines/tools/big-comparison-util/README.md`.

**Leave** `decisions.md` and `plans/002`, `plans/007`, `plans/008` — landed history is not a
stale pointer.

Check the Codex mirror list:
```bash
grep -n 'audit-repo-route' .claude/codex-skills.txt || echo "not listed, nothing to do"
```
If listed, remove the line and prune any dangling `~/.codex/skills/audit-repo-route` link by
hand — `relink.sh` cannot prune a link resolving outside the repo.

**Verify**:
```bash
test ! -d .claude/skills/audit-repo-route
git grep -n 'audit-repo-route' -- ':!decisions.md' ':!plans' ':!docs/specs' ; test $? -ne 0
```

### Step 6: `README.md`, `fix.sh`, and the CLAUDE.md row

`jobs/routing/README.md` — one screen: the five checks, which are mechanical and which need
judgement, and that check 4 is flag-only.

`jobs/routing/fix.sh` — the two safe auto-fixes from the skill: scaffold a missing
`README.md` stub (check 3), and correct a link whose target clearly relocated (check 2). It
must **refuse to touch `decisions.md`** under any circumstance.

Flip the routing row in `tooling/maintainer/CLAUDE.md` to live.

**Verify**: `bash tooling/maintainer/bin/session-start.sh | grep -q '^routing'` -> exit 0.

### Step 7: Tests, against a fixture repo

```bash
# --- routing job: fixture repo with a seeded unmapped folder + dead link ----
RFIX="$TMP/routefix"
mkdir -p "$RFIX/apps/mapped-app" "$RFIX/totally-unmapped" "$RFIX/apps/no-doc-app"
printf '# x\n' > "$RFIX/apps/mapped-app/README.md"
cat > "$RFIX/CLAUDE.md" <<'EOF'
| If the ask is about… | Go to |
|---|---|
| the mapped app | [apps/mapped-app](apps/mapped-app) |
| something deleted | [gone/thing.md](gone/thing.md) |
EOF

out="$(ROUTING_ROOT="$RFIX" bash "$MAINTDIR/jobs/routing/check.sh" 2>&1)"
echo "$out" | grep -q 'UNMAPPED totally-unmapped' || fail "routing check did not report the seeded unmapped folder"
echo "$out" | grep -q 'DEAD LINK gone/thing.md'   || fail "routing check did not report the seeded dead link"
echo "$out" | grep -q 'NO OPERATE-DOC'            || fail "routing check did not report the missing operate-doc"
echo "$out" | grep -q 'NOT CHECKED HERE'          || fail "routing check must say checks 4 and 5 need judgement"
```

Plus: the cron prompt carries no copy of the checks, and `run-audit.sh` is unmodified.

The `routing check did not report the seeded unmapped folder` string is what the mutation
gate asserts on. Do not reword it.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 8: Commit

```bash
git add tooling/maintainer/jobs/routing tooling/maintainer/CLAUDE.md \
        tooling/maintainer/test-maintainer.sh infra/route-audit CLAUDE.md \
        .claude/skills/personal-stuff-docs-and-writing/SKILL.md \
        docs/skill-library-and-infra-handoff.md \
        pipelines/tools/big-comparison-util/README.md
git add -u .claude/skills
git commit -m "refactor(maintainer): routing job absorbs the route audit"
```

Do not push.

## Test plan

The check runs against a **fixture repo** in `mktemp -d` seeded with an unmapped folder, a
dead link and a doc-less sub-folder, so assertions do not depend on the real repo's current
tidiness.

Two assertions protect the consolidation itself: `prompt.md` must contain **no** copy of the
checks, and `run-audit.sh` must be byte-identical. Those are what stop the three-copies
problem coming back.

The mutation gate misspells the `UNMAPPED` marker, which must make
`routing check did not report the seeded unmapped folder` fire.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`
- [ ] `bash -c 'source tooling/maintainer/bin/lib.sh; discover_jobs' | sort | tr '\n' ' '`
      -> includes `routing`
- [ ] `bash tooling/maintainer/bin/run-job.sh routing` -> exit 0 or 1, never 2
- [ ] `test ! -d .claude/skills/audit-repo-route`
- [ ] `git grep -n 'audit-repo-route' -- ':!decisions.md' ':!plans' ':!docs/specs'` -> no match
- [ ] `git diff --name-only 36b2519..HEAD -- infra/route-audit/run-audit.sh` -> **empty**
- [ ] `grep -c 'jobs/routing/runbook.md' infra/route-audit/prompt.md` -> at least `1`
- [ ] `grep -c 'keep in sync' infra/route-audit/prompt.md` -> `0`
- [ ] `grep -c 'superseded' tooling/maintainer/jobs/routing/runbook.md` -> at least `1`
- [ ] `grep -ci 'decisions.md' tooling/maintainer/jobs/routing/fix.sh` -> at least `1`
      (it must name the file it refuses to touch)
- [ ] `bash infra/route-audit/run-audit.sh` still starts without error (may be interrupted;
      it must not fail on a missing prompt or a bad path)

## STOP conditions

- **You are about to modify `infra/route-audit/run-audit.sh`.** Its `--disallowedTools`
  denylist plus the VPS clone's read-only deploy key are what make an unattended weekly
  `claude -p` safe. Only `prompt.md` changes.
- **You are about to delete the skill before its content is in the runbook.** Write the
  runbook first, verify it carries all four checks plus the exemptions and
  `superseded ≠ stale`, then delete.
- **You are about to auto-edit `decisions.md`.** Check 4 is flag-only, in the skill, in the
  cron prompt, and here. `fix.sh` must refuse.
- **You are about to make `fix.sh` runnable during a cron run.** The cron is report-only.
  Auto-fixes are applied by a session after approval, never by the scheduled run.
- **You are about to fold check 5 into check 1.** A missing row is a defect; a weak row is an
  improvement. They approve differently.
- **You are about to leave `audit-repo-route` in `.claude/codex-skills.txt`.** That strands a
  global Codex link that `relink.sh` cannot prune — it has happened twice.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** The check broke. Never report it as clean.

## Maintenance notes

- After this, the weekly VPS cron is a **scheduled report-only run of job 3**. That is the
  maintainer's "scheduled later" story already working for one job; the other jobs can copy
  the shape.
- The dead-link loop prints inside a pipeline subshell, so it cannot set `found`. The exit
  code comes from checks 1 and 3. If a future change makes dead links the only finding, the
  exit code will be wrong — fix it then by collecting into a temp file, and add a test first.
- Checks 4 and 5 are permanently the session's work. If a later plan tries to automate check
  4, re-read why check 4 was flag-only from the start.
- A reviewer should check two things: that `run-audit.sh` is untouched, and that `prompt.md`
  contains no copy of the checks.
