---
executor: agy
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [tooling/maintainer/CLAUDE.md, tooling/maintainer/README.md, tooling/maintainer/bin/lib.sh, tooling/maintainer/bin/session-start.sh, tooling/maintainer/bin/run-job.sh, tooling/maintainer/bin/propose.sh, tooling/maintainer/bin/apply.sh, tooling/maintainer/jobs/skills/check.sh, tooling/maintainer/test-maintainer.sh, CLAUDE.md, docs/README.md, tooling/cli/pp-land/verify-map.tsv]

mutation_apply: python3 -c "import io;p='tooling/maintainer/bin/lib.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('jobs/*/check.sh','jobs/*/nope.sh',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: job discovery found no jobs
mutation_timeout: 300
---

# Plan 242: the maintainer frame, and the skills job end to end

## Summary

- **Problem statement**: two runbooks written on 2026-08-25 both ask for a repo-maintainer
  agent, and neither has one. The hygiene checks that exist are scattered across `scripts/`
  and nothing runs them; the judgement half has no home at all.
- **Goals**:
  - Build `tooling/maintainer/` as a folder-agent, with **one folder per job** and a uniform
    four-file contract so adding a responsibility means adding a folder.
  - Establish propose → approve → apply, one job at a time, nothing autonomous.
  - Move both existing runbooks into their job folders and fix every pointer.
  - Wire **job 1 (skills)** end to end, so the frame meets a real check on this plan.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every file's content is written out
  below; this is placement plus pointer surgery.
- **Done criteria** (terse): `bash tooling/maintainer/test-maintainer.sh` exit 0; job
  discovery finds `skills`; both runbooks moved with zero dangling references; `verify-map`
  carries a `tooling/maintainer/` row.
- **Stop conditions** (terse): no script may act without an approved proposal; no `rm` on a
  gitignored media file; do not copy a runbook — move it; do not weaken an assertion.
- **Test / verification for success**: `test-maintainer.sh` — shape assertions plus a
  dry-run of the skills check against a stubbed PATH.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 36b2519..HEAD -- tooling/maintainer/ docs/runbooks/ CLAUDE.md docs/README.md tooling/cli/pp-land/verify-map.tsv`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

Design: `docs/specs/2026-08-25-repo-maintainer-design.md`. **Read all of it before starting**
— §3 (layout), §4 (propose/approve/apply) and §7 (the shared rules) are what this plan
builds.

`docs/runbooks/memory-maintenance.md` §8 asks for this agent by name. Its §9 also forbids
automating the judgement half, with a measured false-positive rate of **7 in 8** on any
description-matching heuristic. So the design splits mechanical from judgement, and this
plan builds that split plus the first job.

The structure is the point. The owner will keep adding responsibilities, so **adding a job
must mean adding a folder and nothing else** — no runner to edit, no list to extend.

## Current state

### Nothing exists yet

`tooling/maintainer/` does not exist. `ls tooling/` shows `boss/`, `cli/`, `mcp/`,
`press-clis/`.

### The pattern to copy: `tooling/boss/`

A folder you start a session in: `cd tooling/boss && claude` makes `tooling/boss/CLAUDE.md`
that session's project instructions. Its layout is `CLAUDE.md`, `README.md`, `bin/`,
`data/`, `executors/`, `state/`, `test-boss.sh`.

`tooling/boss/.gitignore` is exactly:

```
state/
!state/.gitkeep
```

`tooling/boss/test-boss.sh` is the test-shape exemplar — **match its idiom**:

```bash
#!/bin/bash
# Self-test for the boss toolkit. Stubs gh/wt/greenlight/notify/claude/agy on PATH.
# The real binaries are NEVER launched here.
set -uo pipefail

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

BOSSDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STUB_DIR="$TMP/stub"
mkdir -p "$STUB_DIR"
```

### The two runbooks that move

| From | To |
|---|---|
| `docs/runbooks/memory-maintenance.md` | `tooling/maintainer/jobs/memory/runbook.md` |
| `docs/runbooks/skill-maintenance.md` | `tooling/maintainer/jobs/skills/runbook.md` |

`docs/runbooks/rotate-gh-token.md` and `windows-custody-setup.md` are **not** maintenance
jobs. They stay where they are.

### Every reference that must be fixed (measured, complete)

`git grep -ln "memory-maintenance\|skill-maintenance"` returns exactly four tracked files,
one of which is the new design doc:

**1. Root `CLAUDE.md`, line 25** — the only runbook row in the intent table:

```
| Auditing or restructuring skills (where they live, why, the recurring audit) | [`docs/runbooks/skill-maintenance.md`](docs/runbooks/skill-maintenance.md) |
```

**There is no row for `memory-maintenance.md` at all.** That is live routing drift; this plan
fixes it while moving both.

**2. `docs/README.md`, line 8** — one long bullet naming all four runbooks:

```
- `runbooks/` — step-by-step operating procedures: `memory-maintenance.md` (2026-08-25 — auditing Claude's file-based memory: …), `skill-maintenance.md` (2026-08-25 — the sibling chapter for skills: …), `rotate-gh-token.md`, `windows-custody-setup.md` (…)
```

**3. `docs/runbooks/skill-maintenance.md`** — three cross-links to its sibling, at lines
**3**, **318** and **336**:

```
3:   Sibling of [`memory-maintenance.md`](memory-maintenance.md). That one governs what an
318:  `memory-maintenance.md` §9 proposes for memory.
336: - [`memory-maintenance.md`](memory-maintenance.md) — the same treatment for memory
```

After the move both files are siblings inside `jobs/`, so a relative link becomes
`../memory/runbook.md`.

**4. `docs/specs/2026-08-25-repo-maintainer-design.md`** — its Related section already
states the destinations. Leave it; it is the design, not a stale pointer.

`docs/runbooks/memory-maintenance.md` has **no** outbound runbook references, so it moves
unedited.

### The verify map

`tooling/cli/pp-land/verify-map.tsv`, TAB-separated `<prefix>\t<command>`. `tooling/boss/`
already has a row:

```
tooling/boss/	bash tooling/boss/test-boss.sh
```

There is no `tooling/maintainer/` row. Without one, `pp-land` never runs this plan's tests.

### `rtk` fakes command output — this is not optional trivia

A `grep` invoked through the rtk hook returned `23 matches in 0 files`, and `prettier`
always reports success. This bit the first memory audit and it bit the session that wrote
this plan, twice. **Every script here calls binaries by absolute path.** `bin/lib.sh` defines
them once.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, prints `ALL PASS` |
| List jobs (runs nothing) | `bash tooling/maintainer/bin/session-start.sh` | a table of jobs, exit 0 |
| Run one job's check | `bash tooling/maintainer/bin/run-job.sh skills` | exit 0 or 1, writes a findings file |
| Existing skills checks | `bash scripts/skills-status.sh` | exit 1 on a real problem |
| Description budget | `bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` | exit 0 under the cap |
| Shared-skill drift | `bash scripts/sync-shared-skills.sh --check` | exit 1 on drift |

## Scope

**In scope** — all new unless marked:

- `tooling/maintainer/CLAUDE.md`, `README.md`, `.gitignore`, `test-maintainer.sh`
- `tooling/maintainer/bin/{lib.sh,session-start.sh,run-job.sh,propose.sh,apply.sh}`
- `tooling/maintainer/jobs/skills/{README.md,runbook.md,check.sh,fix.sh}`
- `tooling/maintainer/jobs/memory/runbook.md` (the moved file; its job lands in plan 243)
- `tooling/maintainer/state/.gitkeep`, `tooling/maintainer/state/ledger.md`
- **edit** `CLAUDE.md` (two intent-table rows)
- **edit** `docs/README.md` (the runbooks bullet)
- **edit** `tooling/cli/pp-land/verify-map.tsv` (one row)
- **delete** `docs/runbooks/memory-maintenance.md`, `docs/runbooks/skill-maintenance.md`
  (they are moved, not copied)

**Out of scope**:

- **The other nine jobs.** Create no other `jobs/<name>/` folder — not even empty. Plans
  243–249 each create their own. An empty folder would make `session-start.sh` advertise a
  job that cannot run.
- `.claude/skills/audit-repo-route/` — plan 244 absorbs and deletes it. Leave it alone.
- `scripts/skills-status.sh`, `check-skill-descriptions.sh`, `sync-shared-skills.sh`,
  `check-repo-hygiene.sh` — this job **calls** them; it does not modify them.
- `docs/runbooks/rotate-gh-token.md`, `windows-custody-setup.md` — not maintenance jobs.
- Any launchd plist or cron. On-demand only for now.
- `decisions.md` — the orchestrator appends the entry.

## Git workflow

- Branch: `advisor/242-maintainer-frame-and-skills-job`
- Commit per step is fine; the final commit message is
  `feat(maintainer): the frame and the skills job` — no AI footers. Do NOT push.

## Steps

### Step 1: The skeleton and `.gitignore`

Create the directory tree. `state/findings/` and `state/proposals/` are gitignored, so they
are created at runtime by `lib.sh`, not committed.

```
tooling/maintainer/
  bin/  jobs/skills/  jobs/memory/  state/
```

`tooling/maintainer/.gitignore`, copying boss's shape exactly:

```
state/
!state/.gitkeep
!state/ledger.md
```

Create `state/.gitkeep` (empty) and `state/ledger.md` with just its header:

```markdown
# Maintainer ledger

One line per job run. `proposed` is what the agent found worth raising; `approved` is what
the owner said yes to. A declined item is kept on purpose — it stops the next run proposing
it again.

| date | job | proposed | approved | applied |
|---|---|---|---|---|
```

**Verify**: `test -f tooling/maintainer/state/ledger.md && test -f tooling/maintainer/state/.gitkeep`
-> exit 0.

### Step 2: `bin/lib.sh` — the shared contract

This file defines job discovery and the rtk-safe binaries. **Write it verbatim.**

```bash
#!/bin/bash
# Shared helpers for the maintainer. Sourced by every bin/ script.
#
# rtk rewrites commands through a hook and FAKES their output: a grep returned
# "23 matches in 0 files" and prettier always reports success. So every binary
# this agent depends on is called by absolute path. Do not "simplify" these.

GREP=/usr/bin/grep
FIND=/usr/bin/find
SED=/usr/bin/sed
AWK=/usr/bin/awk
STAT=/usr/bin/stat
DATE=/bin/date

MAINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$MAINT_DIR/../.." && pwd)"
STATE_DIR="$MAINT_DIR/state"
FINDINGS_DIR="$STATE_DIR/findings"
PROPOSALS_DIR="$STATE_DIR/proposals"
LEDGER="$STATE_DIR/ledger.md"

# Gitignored files can NEVER be recovered from git, so a local removal is a MOVE.
ARCHIVE_ROOT="$HOME/pp-maintainer-archive"

today() { "$DATE" +%Y-%m-%d; }

mkdirs() { mkdir -p "$FINDINGS_DIR" "$PROPOSALS_DIR"; }

# Every job this agent knows, one per line. A job IS a folder with a check.sh —
# there is no registry to update, which is the whole point of the layout.
discover_jobs() {
  local d
  for d in "$MAINT_DIR"/jobs/*/check.sh; do
    [ -f "$d" ] || continue
    basename "$(dirname "$d")"
  done
}

job_dir() { echo "$MAINT_DIR/jobs/$1"; }

findings_file() { echo "$FINDINGS_DIR/$(today)-$1.md"; }
proposal_file() { echo "$PROPOSALS_DIR/$(today)-$1.md"; }

die() { echo "ERROR: $1" >&2; exit 2; }
```

`discover_jobs` globs `jobs/*/check.sh`. That single line is why adding a job needs no
runner change — and why a job folder without a `check.sh` is invisible rather than broken.

**Verify**:
```bash
bash -c 'source tooling/maintainer/bin/lib.sh; discover_jobs'
```
-> prints nothing yet (no `check.sh` exists), exit 0.

### Step 3: `bin/session-start.sh` — it runs NOTHING

```bash
#!/bin/bash
# Lists every job, when it last ran, and whether a proposal is still open.
# It RUNS NOTHING. The owner picks the job; nothing here is autonomous.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

jobs="$(discover_jobs)"
if [ -z "$jobs" ]; then
  echo "job discovery found no jobs — expected at least one jobs/*/check.sh"
  exit 2
fi

printf '%-16s %-12s %s\n' JOB LAST-RUN OPEN-PROPOSAL
for j in $jobs; do
  last="$("$FIND" "$FINDINGS_DIR" -name "*-$j.md" 2>/dev/null | sort | tail -1)"
  prop="$("$FIND" "$PROPOSALS_DIR" -name "*-$j.md" 2>/dev/null | sort | tail -1)"
  last_s="never"; [ -n "$last" ] && last_s="$(basename "$last" | "$SED" "s/-$j\.md//")"
  prop_s="-"
  if [ -n "$prop" ] && ! "$GREP" -q '^Decision:' "$prop"; then prop_s="AWAITING YOU"; fi
  printf '%-16s %-12s %s\n' "$j" "$last_s" "$prop_s"
done

echo
echo "Pick ONE job:  bin/run-job.sh <job>"
```

The `job discovery found no jobs` string is what the mutation gate asserts on. Do not
reword it.

A proposal counts as still open until it carries a `Decision:` line. That is the whole
approval record — no decision line means no approval.

**Verify**: `bash tooling/maintainer/bin/session-start.sh` -> exit 2 with
`job discovery found no jobs` (correct until Step 5 lands the skills check).

### Step 4: `bin/run-job.sh`, `bin/propose.sh`, `bin/apply.sh`

`run-job.sh` — runs exactly one job's check:

```bash
#!/bin/bash
# Run ONE job's mechanical check. Writes findings. Judges nothing, changes nothing.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

job="${1:-}"
[ -n "$job" ] || die "usage: run-job.sh <job>"
check="$(job_dir "$job")/check.sh"
[ -f "$check" ] || die "no such job: $job (have: $(discover_jobs | tr '\n' ' '))"

out="$(findings_file "$job")"
bash "$check" > "$out"
rc=$?
case "$rc" in
  0) echo "$job: clean. findings -> $out" ;;
  1) echo "$job: findings written -> $out"; echo "next: bin/propose.sh $job" ;;
  *) echo "$job: THE CHECK ITSELF FAILED (exit $rc). Do not treat this as clean." >&2 ;;
esac
exit $rc
```

Exit 1 (findings) and exit 2 (the check broke) must never look alike. LESSONS 2026-08-02
records the opposite failure: *"the gate announced a failure loudly while silently testing
nothing."*

`propose.sh` — scaffolds the owner-facing proposal; the **session** fills in the verdicts:

```bash
#!/bin/bash
# Scaffold the proposal the owner reads. The SESSION writes the verdicts —
# this only creates the skeleton and links the raw findings.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

job="${1:-}"
[ -n "$job" ] || die "usage: propose.sh <job>"
f="$(findings_file "$job")"
[ -f "$f" ] || die "no findings for $job today — run bin/run-job.sh $job first"
p="$(proposal_file "$job")"
[ -f "$p" ] && die "a proposal already exists: $p"

{
  echo "# $job — $(today)"
  echo
  echo "_Raw findings: $f_"
  echo
  echo "## Fix (mechanical, no judgement)"
  echo "## Archive (recoverable — moves, nothing is deleted)"
  echo "## Promote (belongs in the repo instead)"
  echo "## Improve (not broken, would be better)"
  echo "## Ask (I will not guess)"
  echo "## Not touching"
  echo
  echo "Approve: all / fix only / by number / none"
  echo
  echo "<!-- The owner's answer goes on ONE line below, starting 'Decision:'."
  echo "     Until that line exists, apply.sh refuses. -->"
} > "$p"
echo "proposal scaffolded -> $p"
```

`apply.sh` — refuses without a recorded decision:

```bash
#!/bin/bash
# Act on an APPROVED proposal. Refuses if the owner has not decided.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

job="${1:-}"
[ -n "$job" ] || die "usage: apply.sh <job>"
p="$(proposal_file "$job")"
[ -f "$p" ] || die "no proposal for $job today"

decision="$("$GREP" -m1 '^Decision:' "$p" || true)"
[ -n "$decision" ] || die "no 'Decision:' line in $p — nothing is approved, refusing to act"
case "$decision" in
  *none*) echo "$job: owner declined everything. Nothing to do."; exit 0 ;;
esac

echo "$job: decision recorded -> $decision"
echo "Apply the approved items in a pp-work workspace, then append to $LEDGER."
echo "Repo edits MUST claim a workspace: cd \"\$(pp-work claim --kind code --slug maintainer-$job)\""
```

`apply.sh` deliberately does not perform edits itself. Every job's actions differ, and repo
edits need a `pp-work` workspace — the main checkout refuses to record git history. Its job
is to be the **gate**: no `Decision:` line, no action.

**Verify**:
```bash
bash tooling/maintainer/bin/run-job.sh nosuchjob; test $? -eq 2
bash tooling/maintainer/bin/apply.sh skills; test $? -eq 2
```
-> both exit 2 (`no such job`, and `no proposal`).

### Step 5: `jobs/skills/check.sh` — the first real job

```bash
#!/bin/bash
# skills — the mechanical half. Writes findings to stdout; run-job.sh captures it.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

found=0
note() { echo "- $1"; found=1; }

echo "# skills findings — $(today)"
echo

echo "## account skill dirs must be EMPTY"
for d in "$HOME/.claude/skills" "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills"; do
  n=$(ls "$d" 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" != "0" ] && note "$d holds $n entries — a skill there reintroduces the account dependency"
done
echo

echo "## dangling symlinks"
for d in "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills" "$HOME/.codex/skills" \
         ".claude/skills" "pipelines/.claude/skills"; do
  [ -d "$d" ] || continue
  for f in "$d"/*; do
    [ -e "$f" ] || note "dangling link: $f"
  done
done
echo

echo "## real duplicates (symlinks skipped — every intentional one looks like a dup)"
for d in .claude/skills pipelines/.claude/skills pipelines/.agents/skills "$HOME/codebase/work-skills/skills"; do
  [ -d "$d" ] || continue
  "$FIND" "$d" -maxdepth 1 -mindepth 1 -type d -exec basename {} \;
done | sort | uniq -d | while read -r dup; do
  case "$dup" in
    claude-router|github-router|humanizer|i-have-adhd|session-handoff) ;;   # the 5 duplicated on purpose
    *) note "unexpected duplicate skill: $dup" ;;
  esac
done
echo

echo "## description budget"
if ! bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh >/dev/null 2>&1; then
  note "description budget check failed — run it directly for the offenders"
fi
echo

echo "## shared-skill drift (repo vs the private plugin)"
if ! bash scripts/sync-shared-skills.sh --check >/dev/null 2>&1; then
  note "the 5 shared skills have drifted from the work-skills plugin"
fi
echo

echo "## reference counts — A CANDIDATE LIST, NEVER A VERDICT"
echo "(skill-maintenance runbook §8: usage data does not exist. 8 skills had zero"
echo " references at the last audit and were correctly KEPT. Zero references means"
echo " 'look at this', not 'delete this'.)"
for s in .claude/skills/*/; do
  name="$(basename "$s")"
  n=$(git grep -l "$name" -- ':!.claude/skills' 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" = "0" ] && echo "- zero repo references: $name"
done

exit $found
```

Three properties that must not be "simplified":

- **The five deliberate duplicates are allowlisted by name.** `claude-router`,
  `github-router`, `humanizer`, `i-have-adhd`, `session-handoff` exist twice on purpose — a
  symlink cannot span a public and a private repo (`skill-maintenance.md` §4).
- **Symlinks are skipped in the duplicate scan.** A plain `ls` across the four homes reports
  51 hits because every intentional symlink looks like a duplicate (`skill-maintenance.md`
  §5 step 4).
- **Reference counts are printed under a header that says they are not a verdict.** They are
  never emitted as `- ` findings, so they cannot flip the exit code.

Also create `jobs/skills/README.md` (one screen: what this job checks and why) and
`jobs/skills/fix.sh` (a stub that exits 0 with `nothing mechanical to fix yet` — plan 244
onward may fill it).

**Verify**:
```bash
bash tooling/maintainer/bin/run-job.sh skills; rc=$?; test $rc -eq 0 -o $rc -eq 1
bash tooling/maintainer/bin/session-start.sh | grep -q '^skills'
```
-> both exit 0.

### Step 6: Move the runbooks with `git mv`, then fix every pointer

```bash
git mv docs/runbooks/skill-maintenance.md tooling/maintainer/jobs/skills/runbook.md
git mv docs/runbooks/memory-maintenance.md tooling/maintainer/jobs/memory/runbook.md
```

Use `git mv`, not copy-then-delete: two homes for one runbook is the drift this whole agent
exists to catch.

Then fix all four reference sites listed in Current state:

1. **Root `CLAUDE.md`** — replace the single line-25 row with **two** rows (memory had none):
```
| Auditing or restructuring skills (where they live, why, the recurring audit) | [`tooling/maintainer/jobs/skills/runbook.md`](tooling/maintainer/jobs/skills/runbook.md) |
| Auditing Claude's file-based memory (what it is for, the four-question test, the audit) | [`tooling/maintainer/jobs/memory/runbook.md`](tooling/maintainer/jobs/memory/runbook.md) |
```
   And add one row for the agent itself:
```
| Repo hygiene — the maintainer agent, its jobs and how to run one | [`tooling/maintainer/README.md`](tooling/maintainer/README.md) |
```

2. **`docs/README.md` line 8** — drop `memory-maintenance.md` and `skill-maintenance.md`
   from the `runbooks/` bullet (keeping `rotate-gh-token.md` and `windows-custody-setup.md`),
   and say the two moved to `tooling/maintainer/jobs/<job>/runbook.md`.

3. **`jobs/skills/runbook.md`** — its three sibling links (originally lines 3, 318, 336) now
   point at `../memory/runbook.md`.

**Verify** — no dangling reference survives:
```bash
git grep -n "docs/runbooks/memory-maintenance\|docs/runbooks/skill-maintenance" -- ':!docs/specs' ; test $? -ne 0
git grep -c "runbooks/" CLAUDE.md ; test $? -ne 0
test -f tooling/maintainer/jobs/memory/runbook.md
test -f tooling/maintainer/jobs/skills/runbook.md
test ! -f docs/runbooks/memory-maintenance.md
```
-> all exit 0.

### Step 7: `CLAUDE.md` and `README.md` for the agent

`tooling/maintainer/CLAUDE.md` is what a session in this folder reads. It must carry:

- **"You are the maintainer"** — one paragraph: you find rot, propose, and act only on
  approval. You build nothing.
- **The job table** — one row per job folder: name, what it asks, its runbook. Only `skills`
  is live; list the other nine as planned with their plan numbers.
- **The four beats** (check → propose → approve → apply), and that `session-start.sh` runs
  nothing.
- **The proposal format**, copied from the design doc §4 including the worked example.
- **The nine shared rules** from design §7, verbatim. In particular:
  - archive, never delete; gitignored files move to `~/pp-maintainer-archive/`
  - a grep is a candidate list, never a verdict (7 of 8 were false positives)
  - repo edits claim a `pp-work` workspace first
  - `rtk` fakes output — absolute binary paths only
  - exit 1 = findings, exit 2 = the check broke
  - one job per cycle; no action without a `Decision:` line
- **How to add a job**: create `jobs/<name>/` with the four files, add one table row. Nothing
  else.

`tooling/maintainer/README.md` is the human orientation: what this is, the file map, and the
three commands.

**Verify**:
```bash
grep -c 'pp-maintainer-archive' tooling/maintainer/CLAUDE.md      # >= 1
grep -c 'candidate list' tooling/maintainer/CLAUDE.md             # >= 1
grep -c 'Decision:' tooling/maintainer/CLAUDE.md                  # >= 1
```

### Step 8: `test-maintainer.sh`

Match `test-boss.sh`'s idiom (`set -uo pipefail`, a `fail()` helper, `mktemp -d` with a
`trap` cleanup, stubs on PATH). Assert **shape**, never wording, except for the two strings
the mutation gate needs.

Required assertions, at least these ten:

1. `discover_jobs` finds `skills`. **Its failure message must be exactly**
   `fail "job discovery found no jobs"` — the mutation gate asserts on that string, so a
   different wording makes the gate unable to fire.
2. `discover_jobs` finds nothing else (proves no empty job folder was created).
3. `session-start.sh` exits 0 and its output contains a `skills` row.
4. `session-start.sh` prints `job discovery found no jobs` and exits 2 when `jobs/` is empty
   (run it against a `mktemp -d` copy with the job folder removed).
5. `run-job.sh` with no argument exits 2.
6. `run-job.sh nosuchjob` exits 2.
7. `run-job.sh skills` exits 0 or 1, never 2, and creates a findings file.
8. `apply.sh skills` exits 2 when no proposal exists.
9. `apply.sh skills` exits 2 when a proposal exists **without** a `Decision:` line — this is
   the no-autonomy gate and it is the most important assertion in the file.
10. `jobs/skills/check.sh` never emits a `- ` finding line for a zero-reference skill (proves
    reference counts cannot flip the exit code).

Print `ALL PASS` on success.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, prints `ALL PASS`.

### Step 9: Wire it into the verify map

Append one **TAB**-separated row to `tooling/cli/pp-land/verify-map.tsv`:

```
tooling/maintainer/	bash tooling/maintainer/test-maintainer.sh
```

**Verify**:
```bash
awk -F'\t' '$1=="tooling/maintainer/" && NF==2 {n++} END {exit !(n==1)}' tooling/cli/pp-land/verify-map.tsv && echo TAB_OK
```
-> prints `TAB_OK`.

### Step 10: Commit

Stage explicitly — never `git add -A`. Include the `git mv` renames and the deletions.

```bash
git add tooling/maintainer CLAUDE.md docs/README.md tooling/cli/pp-land/verify-map.tsv
git add -u docs/runbooks
git commit -m "feat(maintainer): the frame and the skills job"
```

Do not push.

## Test plan

`test-maintainer.sh` is the merge gate and covers the frame's contract: job discovery, the
exit-code split, and above all **the refusal to act without a `Decision:` line**.

Assertion 9 is the one that matters. The owner's requirement is that nothing happens
autonomously; assertion 9 is the machine check for it. If it is ever weakened, the agent can
act unapproved and every other test stays green.

The mutation gate breaks job discovery (`jobs/*/check.sh` -> `jobs/*/nope.sh`), which must
make `session-start.sh` print `job discovery found no jobs` and the suite fail. Without it, a
green suite would not prove discovery runs at all — the exact "gate that cannot fire"
failure `_TEMPLATE.md` warns about.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, prints `ALL PASS`
- [ ] `bash tooling/maintainer/bin/session-start.sh` -> exit 0, output has a `skills` row
- [ ] `bash tooling/maintainer/bin/run-job.sh skills` -> exit 0 or 1 (never 2) and writes
      `state/findings/<today>-skills.md`
- [ ] `bash tooling/maintainer/bin/apply.sh skills` -> exit **2** with no proposal present
- [ ] `bash -c 'source tooling/maintainer/bin/lib.sh; discover_jobs' | sort | tr '\n' ' '`
      -> exactly `skills `
- [ ] `test -f tooling/maintainer/jobs/skills/runbook.md` and
      `test -f tooling/maintainer/jobs/memory/runbook.md`
- [ ] `test ! -f docs/runbooks/skill-maintenance.md` and
      `test ! -f docs/runbooks/memory-maintenance.md`
- [ ] `git grep -n "docs/runbooks/memory-maintenance\|docs/runbooks/skill-maintenance" -- ':!docs/specs'`
      -> no match
- [ ] `git log --diff-filter=R --name-status -1` shows both runbooks as **renames**, not
      add+delete
- [ ] `awk -F'\t' '$1=="tooling/maintainer/" && NF==2' tooling/cli/pp-land/verify-map.tsv`
      -> one row
- [ ] `ls tooling/maintainer/jobs/` -> exactly `memory` and `skills`, no other folder
- [ ] `git status --porcelain tooling/maintainer/state` -> no `findings/` or `proposals/`
      tracked
- [ ] `grep -rn '/usr/bin/grep' tooling/maintainer/bin/lib.sh` -> at least one match
      (rtk-safe paths present)

## STOP conditions

- **You are about to make any script act without an approved proposal.** The owner's
  requirement is that nothing is autonomous. `apply.sh` must refuse with no `Decision:` line,
  and assertion 9 must pass.
- **You are about to `rm` a gitignored media file** (`.mp4`, `.wav`, `.png`, a render, a
  cache). They cannot be recovered from git. Nothing in this plan should delete one at all,
  and later jobs must **move** to `~/pp-maintainer-archive/`.
- **You are about to create a `jobs/<name>/` folder other than `skills` or `memory`.** Plans
  243–249 own those. An extra folder makes `session-start.sh` advertise a job that cannot run.
- **You are about to copy a runbook instead of `git mv`-ing it.** Two homes for one document
  is the drift this agent exists to find.
- **You are about to emit reference counts as findings.** `skill-maintenance.md` §8: usage
  data does not exist; 8 zero-reference skills were correctly kept. They print under a
  not-a-verdict header and must not affect the exit code.
- **You are about to modify a script under `scripts/`.** This job calls them. Changing them
  is out of scope and would break other paths' gates.
- **A gate assertion fails and you want to change it.** Fix the code. Weakening, swapping or
  deleting an assertion is a STOP (LESSONS 2026-07-31, 2026-07-24).
- **A test hangs.** Do not wait it out. Nothing here opens a server; a hang means something
  else. Report it.
- **`check.sh` returns 2 and you are tempted to treat it as clean.** Exit 2 means the check
  broke. A broken check that reads as clean is worse than no check.

## Maintenance notes

- **Adding a job is: create `jobs/<name>/` with the four files, add one row to
  `CLAUDE.md`'s table.** No runner changes, ever. If a future plan edits `lib.sh` to add a
  job, the layout has been broken — `discover_jobs` globs, deliberately.
- `state/findings/` and `state/proposals/` are gitignored working notes. `state/ledger.md` is
  tracked, because what the agent proposed and what the owner declined are worth keeping.
- Only `skills` is live after this plan. `jobs/memory/` holds its runbook but no `check.sh`,
  so discovery correctly ignores it until plan 243.
- A reviewer should check exactly two things: that `apply.sh` cannot act without a
  `Decision:` line, and that both runbooks show as git **renames** rather than a copy plus a
  delete.
