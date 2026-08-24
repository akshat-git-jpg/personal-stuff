---
executor: codex
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (PR#203) must land first — this adds a job folder to its frame"]
needs_prs: [203]
touches: [tooling/maintainer/jobs/memory/README.md, tooling/maintainer/jobs/memory/check.sh, tooling/maintainer/jobs/memory/fix.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/memory/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('ORPHAN','ORFAN',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: memory check did not report the seeded orphan
mutation_timeout: 300
---

# Plan 243: the memory job

## Summary

- **Problem statement**: the memory runbook's four proposed automations
  (`jobs/memory/runbook.md` §9) do not exist. Every memory audit is done by hand, so it
  happens once and then lapses — which is exactly how 22 notes piled up in one store.
- **Goals**: add `jobs/memory/` to the maintainer frame, implementing all four §9 automations
  as one `check.sh`: age report, index-sync check, store-count alarm, dead-path check.
- **Executor proposed**: `codex` / gpt-5.6-sol — every command is inlined from the runbook,
  which already contains working bash for three of the four.
- **Done criteria** (terse): `test-maintainer.sh` exit 0 with the memory assertions;
  `discover_jobs` finds `memory`; the check reports a seeded orphan and a seeded dead pointer.
- **Stop conditions** (terse): never delete a note; never write outside `state/`; a grep
  result is a candidate, never a verdict; do not act without a `Decision:` line.
- **Test / verification for success**: the check is run against a **fixture store** in
  `mktemp -d`, seeded with a known orphan and a known dead pointer, so the assertions do not
  depend on the owner's real memory contents.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 36b2519..HEAD -- tooling/maintainer/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 242 (the frame, `bin/lib.sh`, the four-file contract)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

`jobs/memory/runbook.md` §8: *"The promote habit is unenforced. Nothing reminds anyone to
move a month-old fact into the repo. That lapsing is exactly how 22 notes piled up in one
store."*

§9 then lists four automations in value order. This plan builds all four. It deliberately
builds **nothing** for step 4 of the audit (deciding whether a fact still earns its place),
because §9 forbids it: *"Do not try to automate step 4 … the false-positive rate on any
description-matching heuristic was 7 in 8."* That stays the session's work.

## Current state

### The frame (from plan 242, already landed)

`tooling/maintainer/bin/lib.sh` provides `GREP`, `FIND`, `SED`, `AWK`, `STAT`, `DATE` as
absolute paths (rtk fakes output through the hook), plus `MAINT_DIR`, `REPO_ROOT`,
`STATE_DIR`, `today()`, `discover_jobs()`, `die()`.

A job is a folder with a `check.sh`. `discover_jobs` globs `jobs/*/check.sh`, so this plan
adds no registration anywhere.

`jobs/memory/runbook.md` already exists — plan 242 moved it there. This plan adds the other
three files of the four-file contract.

### The store layout (runbook §1)

```
<config dir>/projects/<cwd with / replaced by ->/memory/
├── MEMORY.md          the index — one line per note
├── some-fact.md       one note = one fact
└── another-fact.md
```

`MEMORY.md` is loaded at session start; individual notes are **not** — Claude opens one only
when its index line looks relevant. So an orphan note (present but unindexed) is invisible,
and a dead pointer (indexed but absent) is a broken promise.

### Current real state (runbook §2, as of 2026-08-25)

Two real stores, 26 notes:

| Store | Notes |
|---|---|
| `~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff/memory` | 1 + 6 |
| `~/.claude-work/projects/-Users-kbtg-codebase-dashboard-api/memory` | 1 + 18 |

15 other paths are symlinks into the first. `dashboard-api` is deliberately separate.

### The four automations, from runbook §9

1. **Age report** — notes older than 30 days with their descriptions, so promoting is a
   review rather than a hunt.
2. **Index-sync check** — every note appears in its `MEMORY.md`, and every pointer resolves.
   Runbook §5 step 2 already contains working bash.
3. **Store-count alarm** — warn when a repo has more than one real store, or when a store has
   **no session history** (`*.jsonl`), which means nothing ever reads it. That is how the
   backend-scripts store was found and merged away.
4. **Dead-path check** — warn when a `projects/` entry's source directory no longer exists.
   Ten notes for two deleted repos were found this way.

### Working bash already in the runbook (§5 step 2) — reuse it

```bash
for d in $(find ~/.claude-work ~/.claude-personal -maxdepth 4 -type d -name memory); do
  for f in "$d"/*.md; do b=$(basename "$f"); [ "$b" = MEMORY.md ] && continue
    grep -q "$b" "$d/MEMORY.md" || echo "ORPHAN $d/$b"; done
  grep -oE '\(([a-zA-Z0-9_.-]+\.md)\)' "$d/MEMORY.md" | tr -d '()' | sort -u | while read -r p; do
    [ -f "$d/$p" ] || echo "DEAD POINTER $d/$p"; done
done
```

Two changes it needs here: absolute binary paths, and a `MEMORY_ROOTS` variable so a test can
point it at a fixture instead of the owner's real store.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run the job | `bash tooling/maintainer/bin/run-job.sh memory` | exit 0 or 1, never 2 |
| Job discovered | `bash -c 'source tooling/maintainer/bin/lib.sh; discover_jobs'` | includes `memory` |
| Against a fixture | `MEMORY_ROOTS=<tmpdir> bash tooling/maintainer/jobs/memory/check.sh` | findings from the fixture only |

## Scope

**In scope**:
- `tooling/maintainer/jobs/memory/README.md` (new)
- `tooling/maintainer/jobs/memory/check.sh` (new)
- `tooling/maintainer/jobs/memory/fix.sh` (new)
- `tooling/maintainer/CLAUDE.md` — flip the memory row from planned to live
- `tooling/maintainer/test-maintainer.sh` — add the memory assertions

**Out of scope**:
- `tooling/maintainer/jobs/memory/runbook.md` — plan 242 moved it; do not edit it.
- `tooling/maintainer/bin/` — the frame is done. If you think you need to change `lib.sh`,
  the layout has been broken; stop and report.
- `scripts/relink.sh`, `scripts/test-memory-link.sh` — the check **calls** `relink.sh`'s
  behaviour indirectly by observing its result. Do not modify either.
- **Any file inside a real memory store.** This job reads and reports. It never writes a
  note, never rewrites a `MEMORY.md`, never archives. Those are the session's actions after
  approval.
- Any other `jobs/<name>/` folder.
- `decisions.md`.

## Git workflow

- Branch: `advisor/243-maintainer-memory-job`
- Commit: `feat(maintainer): the memory job` — no AI footers. Do NOT push.

## Steps

### Step 1: `jobs/memory/check.sh`

Write it verbatim. `MEMORY_ROOTS` is what makes it testable.

```bash
#!/bin/bash
# memory — the mechanical half. Reports; never writes to a store.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# MEMORY_ROOTS lets the test point this at a fixture instead of the real stores.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOTS="${MEMORY_ROOTS:-$HOME/.claude-work $HOME/.claude-personal}"
AGE_DAYS="${MEMORY_AGE_DAYS:-30}"

found=0
note() { echo "- $1"; found=1; }

echo "# memory findings — $(today)"
echo

stores="$("$FIND" $ROOTS -maxdepth 4 -type d -name memory 2>/dev/null | sort)"
if [ -z "$stores" ]; then
  echo "no memory stores found under: $ROOTS"
  exit 0
fi

echo "## 1. index sync — every note indexed, every pointer resolving"
for d in $stores; do
  [ -f "$d/MEMORY.md" ] || { note "no MEMORY.md in $d"; continue; }
  for f in "$d"/*.md; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"
    [ "$b" = MEMORY.md ] && continue
    "$GREP" -q "$b" "$d/MEMORY.md" || note "ORPHAN $d/$b (note exists, not in the index, so nothing will ever open it)"
  done
  "$GREP" -oE '\(([a-zA-Z0-9_.-]+\.md)\)' "$d/MEMORY.md" | tr -d '()' | sort -u | while read -r p; do
    [ -f "$d/$p" ] || echo "- DEAD POINTER $d/$p (indexed, file missing)"
  done
done
echo

echo "## 2. notes older than $AGE_DAYS days — promote candidates, NOT deletions"
echo "(runbook §3: any fact still true after about a month gets promoted to its repo home."
echo " This is a review list. Age alone is never a reason to remove anything.)"
for d in $stores; do
  for f in "$d"/*.md; do
    [ -e "$f" ] || continue
    [ "$(basename "$f")" = MEMORY.md ] && continue
    if [ -n "$("$FIND" "$f" -mtime +"$AGE_DAYS" 2>/dev/null)" ]; then
      desc="$("$GREP" -m1 '^description:' "$f" | "$SED" 's/^description: *//')"
      printf -- '- %s  %s :: %s\n' "$("$STAT" -f '%Sm' -t '%Y-%m-%d' "$f")" "$(basename "$f")" "$desc"
    fi
  done
done
echo

echo "## 3. store-count alarm"
n_stores=$(echo "$stores" | wc -l | tr -d ' ')
[ "$n_stores" -gt 2 ] && note "$n_stores real stores found — the design is ONE canonical store per repo (runbook §4)"
for d in $stores; do
  sess="$("$FIND" "$(dirname "$d")" -maxdepth 1 -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')"
  [ "$sess" = "0" ] && note "$d has NO session history — it was written to but never read (how backend-scripts was found)"
done
echo

echo "## 4. dead-path check — a projects/ entry whose source directory is gone"
for root in $ROOTS; do
  [ -d "$root/projects" ] || continue
  for entry in "$root"/projects/*/; do
    [ -d "$entry" ] || continue
    slug="$(basename "$entry")"
    case "$slug" in -*) ;; *) continue ;; esac
    src="$(echo "$slug" | "$SED" 's|-|/|g')"
    [ -e "$src" ] || note "dead path: $slug (source directory $src no longer exists)"
  done
done

exit $found
```

Three properties that must not be changed:

- **Section 2 prints age candidates WITHOUT calling `note`**, so age alone cannot flip the
  exit code. Age is a review list, never a defect. The runbook is explicit that a note still
  true after a month gets **promoted**, not deleted.
- **`MEMORY_ROOTS` defaults to the real stores but is overridable.** Without it the test
  would assert against whatever the owner's memory happens to contain that day.
- **The dead-path reconstruction is naive on purpose.** `-a-b-c` → `/a/b/c` mis-handles a
  directory whose own name contains a dash, so a false positive is possible. That is fine:
  this is a candidate list. Say so in the output rather than trying to be clever.

**Verify**: `bash tooling/maintainer/bin/run-job.sh memory` -> exit 0 or 1, never 2.

### Step 2: `jobs/memory/README.md`

One screen: what the four sections check, what the exit codes mean, and the one rule that
matters most — **archive, never delete; and a grep is a candidate list, never a verdict**
(7 of 8 stale-flags at the last audit were false positives, matching on words like
*unresolved* and *fixed interval*).

Point at `runbook.md` for the full procedure and the traps.

**Verify**: `grep -c 'candidate list' tooling/maintainer/jobs/memory/README.md` -> at least 1.

### Step 3: `jobs/memory/fix.sh`

The only genuinely mechanical repair here is **re-running the link fix**:

```bash
#!/bin/bash
# memory — the repairs needing zero judgement.
# Everything else (promote, archive) is the session's work after approval.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

echo "Re-running the one-store-per-repo link fix (idempotent):"
bash scripts/relink.sh
```

`relink.sh`'s refusals are the important part and they are already pinned by
`scripts/test-memory-link.sh` (11 tests). It refuses a **non-empty real** store with a merge
instruction and leaves it untouched. Do not add a `--force`. Do not touch either script.

**Verify**: `bash tooling/maintainer/jobs/memory/fix.sh` -> exit 0.

### Step 4: Flip the CLAUDE.md row

In `tooling/maintainer/CLAUDE.md`'s job table, change the `memory` row from planned (plan
243) to live. Leave the other eight as planned.

**Verify**: `bash tooling/maintainer/bin/session-start.sh | grep -q '^memory'` -> exit 0.

### Step 5: Tests, against a fixture

Add to `test-maintainer.sh`. **Build a fixture store in `mktemp -d`** — never assert against
the owner's real memory.

```bash
# --- memory job: fixture with a known orphan and a known dead pointer -------
FIX="$TMP/memfix"
mkdir -p "$FIX/projects/-tmp-nonexistent-repo/memory"
M="$FIX/projects/-tmp-nonexistent-repo/memory"
cat > "$M/MEMORY.md" <<'EOF'
# Memory Index
- [Present note](present.md) - indexed and on disk
- [Missing note](missing.md) - indexed but NOT on disk
EOF
printf 'description: a note that is on disk and indexed\n' > "$M/present.md"
printf 'description: a note on disk that nobody indexed\n' > "$M/orphan.md"

out="$(MEMORY_ROOTS="$FIX" bash "$MAINTDIR/jobs/memory/check.sh" 2>&1)"
echo "$out" | grep -q 'ORPHAN' || fail "memory check did not report the seeded orphan"
echo "$out" | grep -q 'DEAD POINTER' || fail "memory check did not report the seeded dead pointer"
echo "$out" | grep -q 'dead path' || fail "memory check did not report the seeded dead path"

# age lines must NOT be able to flip the exit code
MEMORY_ROOTS="$FIX" MEMORY_AGE_DAYS=0 bash "$MAINTDIR/jobs/memory/check.sh" >/dev/null
# (exit 1 here is fine — it comes from the orphan, not from age. The next assertion
#  proves age alone is not a finding.)
CLEAN="$TMP/memclean"
mkdir -p "$CLEAN/projects/-tmp-x/memory"
printf '# Memory Index\n- [Only note](only.md) - fine\n' > "$CLEAN/projects/-tmp-x/memory/MEMORY.md"
printf 'description: fine\n' > "$CLEAN/projects/-tmp-x/memory/only.md"
MEMORY_ROOTS="$CLEAN" MEMORY_AGE_DAYS=0 bash "$MAINTDIR/jobs/memory/check.sh" >/dev/null
rc=$?
[ "$rc" -le 1 ] || fail "memory check exited $rc on a clean fixture"
```

The `memory check did not report the seeded orphan` string is what the mutation gate asserts
on. Do not reword it.

Also assert `discover_jobs` now returns both `memory` and `skills`.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 6: Commit

```bash
git add tooling/maintainer/jobs/memory tooling/maintainer/CLAUDE.md tooling/maintainer/test-maintainer.sh
git commit -m "feat(maintainer): the memory job"
```

Stage explicitly. Never `git add -A`. Do not push.

## Test plan

Every assertion runs against a **fixture** store built in `mktemp -d` and seeded with a known
orphan, a known dead pointer, and a nonexistent source path. So the suite is deterministic
and does not change meaning when the owner's real memory changes.

One assertion exists purely to protect a design property: a clean fixture with
`MEMORY_AGE_DAYS=0` must not fail, proving **age alone is never a finding**.

The mutation gate misspells the `ORPHAN` marker, which must make
`memory check did not report the seeded orphan` fire. Without it, a green suite would not
prove the index-sync scan runs at all.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, prints `ALL PASS`
- [ ] `bash -c 'source tooling/maintainer/bin/lib.sh; discover_jobs' | sort | tr '\n' ' '`
      -> `memory skills `
- [ ] `bash tooling/maintainer/bin/run-job.sh memory` -> exit 0 or 1, never 2
- [ ] `bash tooling/maintainer/bin/session-start.sh | grep -c '^memory'` -> `1`
- [ ] The check contains all four sections: `grep -c '^## [1-4]\.' jobs/memory/check.sh` -> `4`
- [ ] Age lines are not findings:
      `grep -A3 'promote candidates' tooling/maintainer/jobs/memory/check.sh | grep -c 'note '` -> `0`
- [ ] `grep -c 'MEMORY_ROOTS' tooling/maintainer/jobs/memory/check.sh` -> at least `2`
- [ ] `grep -c '/usr/bin/' tooling/maintainer/jobs/memory/check.sh` -> `0`
      (it sources `lib.sh`; it must not hardcode its own paths)
- [ ] No file under any real memory store was modified:
      `git status --porcelain` shows nothing outside `tooling/maintainer/`
- [ ] `bash tooling/maintainer/jobs/memory/fix.sh` -> exit 0

## STOP conditions

- **You are about to delete a memory note.** Never. Runbook rule 1: *"Never delete a memory.
  Archive it."* And this job does not even archive — it reports. Archiving is the session's
  action after approval.
- **You are about to rewrite a `MEMORY.md`.** Same reason. Reporting only.
- **You are about to make the age report a finding** (calling `note`). Age is a promote
  candidate, not a defect. Making it a finding turns every month-old note into an alarm.
- **You are about to treat a grep hit as a verdict.** 7 of 8 stale-flags at the last audit
  were false positives. The output must say `candidate`, and the session verifies against the
  code.
- **You are about to add a `--force` to `relink.sh`** or otherwise weaken its refusal on a
  non-empty real store. That refusal is pinned by 11 tests and is what prevents a merge
  losing notes.
- **You are about to assert against the owner's real memory store.** Use the fixture. A test
  that passes only while the owner's notes happen to be in one state is not a test.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** That means the check broke. Never report it as clean.

## Maintenance notes

- The store-count alarm's "no `*.jsonl`" rule is how the backend-scripts store was found:
  a store written to but never read. Keep it.
- The dead-path slug→path reconstruction cannot handle a directory name containing a dash.
  That is an accepted false-positive source; the output labels it a candidate.
- Step 4 of the runbook's audit — deciding whether a fact still earns its place — is
  deliberately **not** automated here, and must not be added later. Runbook §9 says so with a
  measured 7-in-8 false-positive rate.
- A reviewer should check one thing above all: that the age report cannot flip the exit code.
