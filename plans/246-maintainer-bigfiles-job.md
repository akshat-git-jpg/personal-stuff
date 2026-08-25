---
executor: agy
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (PR#203) must land first — this adds a job folder to its frame"]
needs_prs: [203]
touches: [tooling/maintainer/jobs/bigfiles/README.md, tooling/maintainer/jobs/bigfiles/runbook.md, tooling/maintainer/jobs/bigfiles/check.sh, tooling/maintainer/jobs/bigfiles/rewrite-plan.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/bigfiles/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('BIG-TRACKED','BIG-TRACKT',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: bigfiles check did not report the seeded oversized tracked file
mutation_timeout: 300
---

# Plan 246: the bigfiles job — and a history rewrite that is planned, never improvised

## Summary

- **Problem statement**: `.git` is **610 MB** while HEAD is only **157 MB**. About **450 MB**
  is history-only — blobs already deleted from HEAD that still ship in every clone. Nothing
  watches what gets committed, and nothing measures the bloat.
- **Goals**:
  - Report oversized or wrong-type files tracked at HEAD, and untracked local junk.
  - Report the history bloat with exact numbers, every run, without ever rewriting.
  - Provide a **generator** that emits a complete, reviewed `git-filter-repo` plan plus an
    impact checklist — owner-triggered, never scheduled, and never executed by this job.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — it reasons about what is safe to
  strip, so it goes to the executor with the landed track record.
- **Done criteria** (terse): `test-maintainer.sh` exit 0; `discover_jobs` finds `bigfiles`;
  the check reports a seeded oversized file; the rewrite generator writes a plan and rewrites
  nothing.
- **Stop conditions** (terse): **never run `git filter-repo`, `filter-branch` or BFG**; never
  `rm` a gitignored media file; never rewrite history.
- **Test / verification for success**: the check runs against a **fixture git repo** in
  `mktemp -d` with a seeded oversized file.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 36b2519..HEAD -- tooling/maintainer/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 242
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

Measured 2026-08-25:

| | Size |
|---|---|
| `.git` pack | **610 MB** |
| tracked at HEAD | **157 MB** across 5,863 files |
| history-only | **~450 MB** |

The biggest blob ever committed is a **14.5 MB** `kling-base.mp4` that is *already gone from
HEAD*. So **deleting files from HEAD does not shrink a clone**. Understanding that is the
whole reason this job has two halves, and why the second one is a generator rather than an
action.

Tracked media at HEAD today: 210 `.png`, 28 `.wav`, 24 `.mp4`, 21 `.jpg`, 5 `.jpeg`,
2 `.mp3`, 1 `.pdf`. Largest single tracked file is a 4.9 MB PNG.

`pp-push` already refuses any single path over 4 MB, so new arrivals are mostly blocked. This
job covers what is already in, and what sits untracked on disk.

## Current state

### The frame

`bin/lib.sh` gives `GREP`, `FIND`, `SED`, `AWK`, `STAT`, `DATE`, `REPO_ROOT`, `today()`,
`die()`, and `ARCHIVE_ROOT="$HOME/pp-maintainer-archive"`.

### Where media legitimately lives

Not everything large is wrong. These are deliberate and must **not** be flagged as defects:

- `pipelines/video/heygen/characters/*/source.jpeg` — the character registry's source images
- `pipelines/video/tts/references/*.wav` — reference voices
- `pipelines/.agents/skills/**` — vendor skill packs (their `.gitignore` already excludes
  `*.mp4|mov|wav|mp3`)
- `apps/*/public/**` and `apps/*/docs/shots/*.png` — shipped assets and UI screenshots
- `plans/runs/evidence/*.png` — the `ui: true` gate's committed screenshots

A finding here is a **candidate**, and the runbook must carry this allowlist so the session
does not propose deleting the character registry.

### The measuring commands (verified 2026-08-25)

```bash
git count-objects -vH | grep size-pack
git ls-tree -r -l HEAD | awk '{s+=$4} END {printf "%.1f MB across %d files\n", s/1048576, NR}'
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '$1=="blob"' | sort -k3 -n -r | head -15
```

The third is slow on a 610 MB pack — measured at tens of seconds. Guard it behind a flag so
the routine run stays fast.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run the job | `bash tooling/maintainer/bin/run-job.sh bigfiles` | exit 0 or 1, never 2 |
| Deep history scan | `BIGFILES_HISTORY=1 bash tooling/maintainer/jobs/bigfiles/check.sh` | adds the top-15 blob table |
| Emit a rewrite plan | `bash tooling/maintainer/jobs/bigfiles/rewrite-plan.sh` | writes a plan file, rewrites nothing |

## Scope

**In scope**:
- `tooling/maintainer/jobs/bigfiles/{README.md,runbook.md,check.sh,rewrite-plan.sh}` (new)
- `tooling/maintainer/CLAUDE.md` — flip the bigfiles row to live
- `tooling/maintainer/test-maintainer.sh` — bigfiles assertions

**Out of scope**:
- **Running any history rewrite.** No `git filter-repo`, no `filter-branch`, no BFG, not even
  on a copy. The deliverable is a plan file.
- **Deleting anything at all.** This job reports; the session archives after approval.
- `.gitignore` — tightening it is a separate, reviewable change.
- `pp-push` and its 4 MB refusal — already works.
- Any other `jobs/<name>/` folder.

Note this job has **no `fix.sh`**. There is no repair here that needs zero judgement.

## Git workflow

- Branch: `advisor/246-maintainer-bigfiles-job`
- Commit: `feat(maintainer): the bigfiles job` — no AI footers. Do NOT push.

## Steps

### Step 1: `jobs/bigfiles/check.sh`

```bash
#!/bin/bash
# bigfiles — the mechanical half. Reports; deletes nothing, rewrites nothing.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# BIGFILES_ROOT points at a fixture repo. BIGFILES_HISTORY=1 adds the slow scan.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${BIGFILES_ROOT:-$REPO_ROOT}"
MAXKB="${BIGFILES_MAX_KB:-4096}"          # pp-push refuses a single path over 4 MB
cd "$ROOT" || die "cannot reach $ROOT"
git rev-parse --git-dir >/dev/null 2>&1 || die "$ROOT is not a git repo"

found=0
note() { echo "- $1"; found=1; }

echo "# bigfiles findings — $(today)"
echo

echo "## 1. sizes"
pack="$(git count-objects -vH | "$GREP" size-pack || true)"
head_size="$(git ls-tree -r -l HEAD | "$AWK" '{s+=$4} END {printf "%.1f MB across %d files", s/1048576, NR}')"
echo "- .git $pack"
echo "- tracked at HEAD: $head_size"
echo "- anything in the pack but not at HEAD is history-only. Deleting from HEAD does NOT"
echo "  shrink a clone; only a history rewrite does, and this job never performs one."
echo

echo "## 2. tracked files over ${MAXKB} KB"
git ls-tree -r -l HEAD | while read -r _ _ _ size path; do
  case "$size" in ''|*[!0-9]*) continue ;; esac
  if [ "$size" -gt $((MAXKB * 1024)) ]; then
    echo "- BIG-TRACKED $path ($((size / 1024)) KB)"
  fi
done
echo

echo "## 3. tracked media — A CANDIDATE LIST, NEVER A VERDICT"
echo "(the character registry, reference voices, vendor packs, app assets and the ui:true"
echo " screenshots are all committed ON PURPOSE. See runbook.md for the allowlist.)"
for e in png jpg jpeg mp4 mov wav mp3 pdf zip; do
  n=$(git ls-files "*.$e" | wc -l | tr -d ' ')
  [ "$n" != "0" ] && echo "- tracked .$e: $n"
done
echo

echo "## 4. untracked local junk (candidates for the archive, NOT for rm)"
git status --porcelain --ignored 2>/dev/null | "$AWK" '$1=="!!"{print $2}' | while read -r p; do
  [ -f "$p" ] || continue
  kb=$(( $("$STAT" -f %z "$p" 2>/dev/null || echo 0) / 1024 ))
  [ "$kb" -gt "$MAXKB" ] && echo "- LOCAL-JUNK $p (${kb} KB, gitignored)"
done
echo
echo "  A gitignored file has NO copy in git. Removing one is a MOVE to"
echo "  $ARCHIVE_ROOT/<date>-bigfiles/, never an rm."
echo

if [ "${BIGFILES_HISTORY:-0}" = "1" ]; then
  echo "## 5. biggest blobs in ALL history (slow — tens of seconds on a 610 MB pack)"
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | "$AWK" '$1=="blob"' | sort -k3 -n -r | head -15 \
    | "$AWK" '{printf "- %8.1f MB  %s\n", $3/1048576, $4}'
else
  echo "## 5. history scan skipped (set BIGFILES_HISTORY=1 — it is slow)"
fi

exit $found
```

Only section 2 calls `note`. Sections 3, 4 and 5 print without setting the exit code: a
tracked `.png` count and a gitignored render are facts to look at, not defects. Making them
findings would turn every run red forever.

**Verify**: `bash tooling/maintainer/bin/run-job.sh bigfiles` -> exit 0 or 1, never 2.

### Step 2: `jobs/bigfiles/rewrite-plan.sh` — it writes a plan, it does not rewrite

```bash
#!/bin/bash
# Emit a REVIEWED history-rewrite plan. This script NEVER rewrites anything.
# It has no --apply, no --force, and no code path that calls git filter-repo.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

out="$STATE_DIR/findings/$(today)-bigfiles-rewrite-plan.md"
mkdir -p "$(dirname "$out")"

{
  echo "# History rewrite plan — $(today)"
  echo
  echo "**Nothing here has been executed.** This is a proposal for the owner to review,"
  echo "then run BY HAND, once, with everything below settled first."
  echo
  echo "## Current cost"
  git count-objects -vH | "$GREP" size-pack
  git ls-tree -r -l HEAD | "$AWK" '{printf "HEAD: %.1f MB across %d files\n", s+=$4, NR}' | tail -1
  echo
  echo "## Candidate paths (biggest history-only blobs)"
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | "$AWK" '$1=="blob"' | sort -k3 -n -r | head -30 \
    | "$AWK" '{printf "- %8.1f MB  %s\n", $3/1048576, $4}'
  echo
  echo "## The command (DO NOT RUN UNTIL THE CHECKLIST BELOW IS COMPLETE)"
  echo '```'
  echo "git filter-repo --invert-paths --path <path> [--path <path> ...]"
  echo '```'
  echo
  echo "## Impact checklist — every box must be ticked first"
  echo
  echo "A rewrite changes EVERY commit SHA. That means:"
  echo
  echo "- [ ] **Every open boss PR is invalidated.** List them: \`gh pr list --state open\`."
  echo "      Each must be landed or closed and re-raised afterwards."
  echo "- [ ] **Every \`wt\` worktree lease is stale.** \`wt list\`; reap them all first."
  echo "- [ ] **Every \`pp-work\` workspace is stale.** \`pp-work list\`; all work landed first."
  echo "- [ ] **Every existing clone breaks**, including the VPS clone at"
  echo "      \`/srv/projects/personal-stuff/\` (VPS-CRONS.md). It must be re-cloned, or every"
  echo "      cron that pulls it starts failing."
  echo "- [ ] **personal-stuff is PUBLIC.** Any fork keeps the old history; the bytes are not"
  echo "      recalled by rewriting. If the goal is removing something sensitive, rewriting"
  echo "      alone does not achieve it."
  echo "- [ ] **A full backup clone exists** and has been verified restorable."
  echo "- [ ] **The owner has explicitly approved this specific path list.**"
  echo
  echo "If any box is unticked, do not run it. There is no partial version of this."
} > "$out"

echo "rewrite plan written -> $out"
echo "NOTHING was rewritten. Read the impact checklist before acting."
```

**Verify** — the script cannot rewrite, by construction:
```bash
grep -c 'filter-repo' tooling/maintainer/jobs/bigfiles/rewrite-plan.sh   # appears only inside the echoed text
grep -cE '^\s*(git filter-repo|git filter-branch|bfg)' tooling/maintainer/jobs/bigfiles/rewrite-plan.sh   # -> 0
bash tooling/maintainer/jobs/bigfiles/rewrite-plan.sh
git count-objects -vH | grep size-pack   # unchanged
```

### Step 3: README, runbook, CLAUDE.md row

- `README.md` — one screen: the two halves, and the 610/157/450 numbers so nobody re-derives
  them.
- `runbook.md` — the measuring commands, **the allowlist of media that is committed on
  purpose**, and the rule that a local removal is a move to `~/pp-maintainer-archive/`.
- Flip the bigfiles row in `tooling/maintainer/CLAUDE.md` to live.

**Verify**: `bash tooling/maintainer/bin/session-start.sh | grep -q '^bigfiles'` -> exit 0.

### Step 4: Tests, against a fixture git repo

```bash
# --- bigfiles job: a real little git repo with a seeded oversized file ------
BFIX="$TMP/bigfix"; mkdir -p "$BFIX"
( cd "$BFIX" && git init -q && git config user.email t@t && git config user.name t
  mkdir -p sub
  dd if=/dev/zero of=sub/large.bin bs=1024 count=200 2>/dev/null
  printf 'small\n' > sub/small.txt
  git add -A && git commit -qm seed )

out="$(BIGFILES_ROOT="$BFIX" BIGFILES_MAX_KB=100 bash "$MAINTDIR/jobs/bigfiles/check.sh" 2>&1)"
echo "$out" | grep -q 'BIG-TRACKED sub/large.bin' || fail "bigfiles check did not report the seeded oversized tracked file"
echo "$out" | grep -q 'BIG-TRACKED sub/small.txt' && fail "bigfiles check flagged a small file"
echo "$out" | grep -q 'history scan skipped'       || fail "bigfiles check ran the slow scan by default"

# the rewrite generator must not change the pack
before="$(git count-objects -vH | grep size-pack)"
bash "$MAINTDIR/jobs/bigfiles/rewrite-plan.sh" >/dev/null
after="$(git count-objects -vH | grep size-pack)"
[ "$before" = "$after" ] || fail "rewrite-plan.sh changed the pack — it must only write a plan"
```

The `bigfiles check did not report the seeded oversized tracked file` string is what the
mutation gate asserts on. Do not reword it.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 5: Commit

```bash
git add tooling/maintainer/jobs/bigfiles tooling/maintainer/CLAUDE.md tooling/maintainer/test-maintainer.sh
git commit -m "feat(maintainer): the bigfiles job"
```

Do not push.

## Test plan

The check runs against a **real fixture git repo** built in `mktemp -d`, not a mock — the
commands under test are git plumbing, so a fake would test nothing.

Two assertions in both directions: the oversized file is flagged, the small one is not.

One assertion is the safety property: `rewrite-plan.sh` must leave `size-pack` byte-identical.
That is what proves it plans rather than acts.

The mutation gate misspells `BIG-TRACKED`.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`
- [ ] `discover_jobs` includes `bigfiles`
- [ ] `bash tooling/maintainer/bin/run-job.sh bigfiles` -> exit 0 or 1, never 2
- [ ] `grep -cE '^\s*(git filter-repo|git filter-branch|bfg)' tooling/maintainer/jobs/bigfiles/rewrite-plan.sh` -> `0`
- [ ] `grep -c 'pp-maintainer-archive' tooling/maintainer/jobs/bigfiles/check.sh` -> at least `1`
- [ ] `grep -rc ' rm ' tooling/maintainer/jobs/bigfiles/` -> `0`
- [ ] Sections 3, 4, 5 cannot flip the exit code:
      `grep -c 'note ' tooling/maintainer/jobs/bigfiles/check.sh` -> `1`
- [ ] `git count-objects -vH | grep size-pack` unchanged after running both scripts
- [ ] `ls tooling/maintainer/jobs/bigfiles/fix.sh` -> does not exist (no zero-judgement repair here)

## STOP conditions

- **You are about to run `git filter-repo`, `git filter-branch`, or BFG.** Never, not even on
  a copy, not even to "test it". The deliverable is a plan file. A rewrite is a one-time
  owner-triggered operation with a checklist that this plan only *writes*.
- **You are about to `rm` a gitignored file.** It has no copy in git. Move it to
  `$ARCHIVE_ROOT`, and only after approval — this job does not even move.
- **You are about to make tracked-media counts a finding.** The character registry, reference
  voices, vendor packs and `ui: true` screenshots are committed on purpose. Flagging them
  makes every run red and trains you to ignore it.
- **You are about to run the history scan by default.** It takes tens of seconds on a 610 MB
  pack. It stays behind `BIGFILES_HISTORY=1`.
- **You are about to edit `.gitignore` or `pp-push`.** Out of scope; both are separately
  reviewable.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** The check broke. Never report it clean.

## Maintenance notes

- The 610 / 157 / 450 MB split is the fact that shapes this job. If a future contributor
  proposes "clean up HEAD to shrink the repo", that number is the answer: it will not.
- `pp-push` already refuses a single path over 4 MB, so this job is mostly archaeology plus
  local junk. If that gate is ever relaxed, this job becomes load-bearing.
- A reviewer should check exactly one thing: that nothing under `jobs/bigfiles/` can execute
  a rewrite or an `rm`.
