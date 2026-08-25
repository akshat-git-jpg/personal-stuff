---
executor: codex
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (PR#203) must land first — these add two job folders to its frame"]
needs_prs: [203]
touches: [tooling/maintainer/jobs/claude-health/README.md, tooling/maintainer/jobs/claude-health/check.sh, tooling/maintainer/jobs/token-budget/README.md, tooling/maintainer/jobs/token-budget/check.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/token-budget/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('SESSION-STEP','SESSION-STEPP',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: token-budget check must mark the context breakdown as a session step
mutation_timeout: 300
---

# Plan 249: the claude-health and token-budget jobs

## Summary

- **Problem statement**: nothing checks whether the Claude Code install is healthy, and
  nothing looks at where tokens are being wasted — despite `rtk` already collecting exactly
  that data and nobody reading it.
- **Goals**: add `jobs/claude-health/` (is the install healthy) and `jobs/token-budget/`
  (where are tokens going).
- **Executor proposed**: `codex` / gpt-5.6-sol — both wrap CLIs that already exist; the
  verification is exit codes and output shape.
- **Done criteria** (terse): `test-maintainer.sh` exit 0; `discover_jobs` finds both;
  token-budget marks the `/context` breakdown as a session step rather than faking it.
- **Stop conditions** (terse): never `claude update`, never install or remove a plugin, never
  claim `/context` ran from a script.
- **Test / verification for success**: both checks run with **stubbed CLIs on PATH**, the
  same technique `test-boss.sh` uses; no real binary is launched.
- **Open points for plan readiness**: none. Design open point 3 (`/context` has no CLI form)
  is resolved below by making it an explicit session step.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 36b2519..HEAD -- tooling/maintainer/`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 242
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

`rtk` has processed **39,689 commands** and saved **325.9M tokens (94.8%)**, and it also ships
`rtk discover` — *"Discover missed RTK savings from Claude Code history"*. Nobody runs it. The
data for "where are tokens being wasted" already exists and is simply never read.

On the health side, `claude doctor` exists as a real CLI command and nothing schedules it.

## Current state

### What is scriptable (verified 2026-08-25)

| Command | Scriptable | Gives |
|---|---|---|
| `claude doctor` | **yes** — a real CLI subcommand | install health |
| `claude mcp` | yes | configured servers (job 4 owns this) |
| `claude plugin` | yes | plugin state |
| `rtk gain` | yes | totals: commands, tokens saved, percentage |
| `rtk discover` | yes | missed savings from Claude Code history |
| `ccusage` | yes — installed at `~/.npm-global/bin/ccusage` | per-account usage |
| `/context` | **no CLI form** | the context breakdown: skills, tools, MCP, memory |

`claude doctor`'s own help says: *"Check the health of your Claude Code installation. …
For a full checkup that can also fix issues, run /doctor in a session."*

So the split is forced and honest: the CLI half goes in `check.sh`; `/context` and `/doctor`'s
fixing mode are **session steps**, and the check must say so rather than omitting them
silently.

### Per-account usage

`ccusage` reads per-account data via `CLAUDE_CONFIG_DIR`. This machine has two account dirs,
`~/.claude-work` and `~/.claude-personal`, and `~/.claude` is a legacy dir that is **not** the
work account. Getting that wrong reports the wrong numbers.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run health | `bash tooling/maintainer/bin/run-job.sh claude-health` | exit 0 or 1, never 2 |
| Run token budget | `bash tooling/maintainer/bin/run-job.sh token-budget` | exit 0 or 1, never 2 |
| Install health | `claude doctor` | a health report |
| Savings totals | `rtk gain` | totals table |
| Missed savings | `rtk discover` | opportunities from history |

## Scope

**In scope**:
- `tooling/maintainer/jobs/claude-health/{README.md,runbook.md,check.sh}` (new)
- `tooling/maintainer/jobs/token-budget/{README.md,runbook.md,check.sh}` (new)
- `tooling/maintainer/CLAUDE.md` — flip both rows to live
- `tooling/maintainer/test-maintainer.sh` — assertions for both

**Out of scope**:
- **`claude update`, `claude install`, `claude plugin install/uninstall`.** Reporting only.
  Upgrading the tool you are running from inside itself is not a hygiene check.
- MCP server checks — job 4 owns those (plan 245). Do not duplicate them here.
- Skill description budgets — job 1 owns those. Do not duplicate.
- `rtk`'s own configuration or its hook.
- Neither job gets a `fix.sh`.

## Git workflow

- Branch: `advisor/249-maintainer-claude-health-and-token-budget`
- Commit: `feat(maintainer): the claude-health and token-budget jobs` — no AI footers.
  Do NOT push.

## Steps

### Step 1: `jobs/claude-health/check.sh`

```bash
#!/bin/bash
# claude-health — is the Claude Code install healthy.
# Reports; never updates, never installs, never removes.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

found=0
note() { echo "- $1"; found=1; }

echo "# claude-health findings — $(today)"
echo

if ! command -v claude >/dev/null 2>&1; then
  echo "- claude CLI not on PATH; nothing to check"
  exit 0
fi

echo "## 1. claude doctor"
if out="$(claude doctor 2>&1)"; then
  echo "$out" | "$SED" 's/^/    /'
else
  note "claude doctor exited non-zero — read the output above"
  echo "$out" | "$SED" 's/^/    /'
fi
echo

echo "## 2. version"
echo "    $(claude --version 2>&1 | head -1)"
echo

echo "## 3. the full checkup is a SESSION-STEP"
echo "    claude doctor is the read-only CLI form. The fuller checkup, which can also FIX"
echo "    issues, is /doctor inside a session — it has no CLI equivalent. Run it yourself"
echo "    and record anything it reports. This script deliberately does not pretend to."

exit $found
```

### Step 2: `jobs/token-budget/check.sh`

```bash
#!/bin/bash
# token-budget — where are tokens going.
# Reports; changes no configuration.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

found=0
note() { echo "- $1"; found=1; }

echo "# token-budget findings — $(today)"
echo

echo "## 1. rtk savings so far"
if command -v rtk >/dev/null 2>&1; then
  rtk gain 2>&1 | "$SED" 's/^/    /'
else
  note "rtk not on PATH — every shell command is costing full tokens"
fi
echo

echo "## 2. missed savings (rtk discover)"
if command -v rtk >/dev/null 2>&1; then
  rtk discover 2>&1 | head -40 | "$SED" 's/^/    /'
  echo "    (truncated to 40 lines; run 'rtk discover' for the rest)"
else
  echo "    skipped — rtk not on PATH"
fi
echo

echo "## 3. per-account usage"
if command -v ccusage >/dev/null 2>&1; then
  for acct in "$HOME/.claude-work" "$HOME/.claude-personal"; do
    [ -d "$acct" ] || continue
    echo "    --- $(basename "$acct") ---"
    CLAUDE_CONFIG_DIR="$acct" ccusage 2>&1 | head -12 | "$SED" 's/^/    /'
  done
  echo "    (~/.claude is a LEGACY dir, not the work account — do not read it as one)"
else
  echo "    skipped — ccusage not installed"
fi
echo

echo "## 4. context breakdown — SESSION-STEP, not automatable"
echo "    /context has no CLI form. It is the only thing that shows how much of the window"
echo "    the system prompt, tools, MCP servers, skills and memory files each consume."
echo "    Run /context in a session and paste the breakdown into the proposal. This script"
echo "    will not fake it, and an absent breakdown must read as 'not measured', never as"
echo "    'nothing to report'."

exit $found
```

Both `SESSION-STEP` markers are the point: a check that quietly omits what it cannot do is
indistinguishable from one that found nothing. That is the failure LESSONS 2026-08-02 records
— *"the gate announced a failure loudly while silently testing nothing"* — in its quiet form.

### Step 3: READMEs, runbooks, CLAUDE.md rows

- `claude-health/README.md` — the two halves (CLI vs `/doctor` in-session), and that this job
  never upgrades anything.
- `token-budget/README.md` — the four sections, and that `/context` is a session step.
- Each `runbook.md` — the procedure, the exact commands, and how to read the output. The
  token-budget runbook records the current baseline (39,689 commands, 325.9M tokens saved,
  94.8%) so a later run can see movement.
- Flip both rows in `tooling/maintainer/CLAUDE.md` to live.

**Verify**:
```bash
bash tooling/maintainer/bin/session-start.sh | grep -q '^claude-health'
bash tooling/maintainer/bin/session-start.sh | grep -q '^token-budget'
```

### Step 4: Tests, with stubbed CLIs

Use the `test-boss.sh` technique: put stubs in `$STUB_DIR` and prepend it to `PATH`, so no
real binary runs.

```bash
# --- claude-health + token-budget: stubbed CLIs -----------------------------
cat > "$STUB_DIR/claude" <<'EOF'
#!/bin/bash
case "$1" in
  doctor)    echo "stub doctor: all good"; exit 0 ;;
  --version) echo "1.2.3 (stub)"; exit 0 ;;
esac
exit 0
EOF
cat > "$STUB_DIR/rtk" <<'EOF'
#!/bin/bash
case "$1" in
  gain)     echo "Tokens saved: 999 (99.9%)"; exit 0 ;;
  discover) echo "stub: 2 missed opportunities"; exit 0 ;;
esac
exit 0
EOF
chmod +x "$STUB_DIR/claude" "$STUB_DIR/rtk"

out="$(PATH="$STUB_DIR:$PATH" bash "$MAINTDIR/jobs/claude-health/check.sh" 2>&1)"
echo "$out" | grep -q 'stub doctor: all good' || fail "claude-health did not run claude doctor"
echo "$out" | grep -q 'SESSION-STEP'          || fail "claude-health must mark /doctor as a session step"

out="$(PATH="$STUB_DIR:$PATH" bash "$MAINTDIR/jobs/token-budget/check.sh" 2>&1)"
echo "$out" | grep -q 'Tokens saved'          || fail "token-budget did not run rtk gain"
echo "$out" | grep -q 'missed opportunities'  || fail "token-budget did not run rtk discover"
echo "$out" | grep -q 'SESSION-STEP'          || fail "token-budget check must mark the context breakdown as a session step"

# neither job may mutate anything
for j in claude-health token-budget; do
  grep -qE '\bclaude (update|install)\b|\bplugin (install|uninstall)\b' "$MAINTDIR/jobs/$j/check.sh" \
    && fail "$j check.sh contains a mutating command"
done
```

The `token-budget check must mark the context breakdown as a session step` string is what the
mutation gate asserts on. Do not reword it.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 5: Commit

```bash
git add tooling/maintainer/jobs/claude-health tooling/maintainer/jobs/token-budget \
        tooling/maintainer/CLAUDE.md tooling/maintainer/test-maintainer.sh
git commit -m "feat(maintainer): the claude-health and token-budget jobs"
```

Do not push.

## Test plan

Both checks run with **stubbed `claude` and `rtk` on PATH**, the same technique `test-boss.sh`
uses, so no real binary is launched and the assertions do not depend on this machine's state.

Two assertions are the deliverable: each job must actually invoke its CLI, and each must
**mark what it cannot do as a session step**. The second is what stops a check quietly
reporting less than it should.

A third scans both scripts for mutating commands, so a future edit cannot slip in a
`claude update`.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`
- [ ] `discover_jobs` includes `claude-health` and `token-budget`
- [ ] `bash tooling/maintainer/bin/run-job.sh claude-health` -> exit 0 or 1, never 2
- [ ] `bash tooling/maintainer/bin/run-job.sh token-budget` -> exit 0 or 1, never 2
- [ ] `grep -c 'SESSION-STEP' tooling/maintainer/jobs/token-budget/check.sh` -> at least `1`
- [ ] `grep -c 'SESSION-STEP' tooling/maintainer/jobs/claude-health/check.sh` -> at least `1`
- [ ] `grep -rcE '\bclaude (update|install)\b|plugin (install|uninstall)' tooling/maintainer/jobs/claude-health/ tooling/maintainer/jobs/token-budget/` -> `0`
- [ ] `grep -c 'CLAUDE_CONFIG_DIR' tooling/maintainer/jobs/token-budget/check.sh` -> at least `1`
- [ ] `grep -c 'LEGACY' tooling/maintainer/jobs/token-budget/check.sh` -> at least `1`
      (the `~/.claude` trap is named)
- [ ] Neither job has a `fix.sh`
- [ ] Running both modifies nothing: `git status --porcelain` clean afterwards

## STOP conditions

- **You are about to run `claude update`, `claude install`, or install/remove a plugin.**
  Reporting only. A hygiene check that upgrades the tool it runs inside is not a hygiene
  check.
- **You are about to claim `/context` or `/doctor`'s fixing mode ran from a script.** Neither
  has a CLI form. Say `SESSION-STEP` and leave it for the session.
- **You are about to read `~/.claude` as the work account.** It is a legacy directory. The
  accounts are `~/.claude-work` and `~/.claude-personal`.
- **You are about to duplicate job 1's or job 4's checks here.** Skills and MCP have their own
  jobs. Two homes for one check is the drift this agent exists to catch.
- **You are about to let `rtk discover`'s full output into the findings file unbounded.** It
  reads the whole Claude Code history. Truncate, and say you truncated.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** The check broke. Never report it clean.

## Maintenance notes

- The baseline recorded in the token-budget runbook (39,689 commands, 325.9M tokens saved,
  94.8%, as of 2026-08-25) is what makes a later run meaningful. Update it when the owner
  reviews, and keep the old line — a trend is worth more than a number.
- `/context` is the only source for "how much of the window do my skills cost", and it stays
  human-assisted until Claude Code exposes a CLI form. If one appears, this is the job that
  should adopt it.
- These two jobs are deliberately the cheapest in the agent. If a run ever feels expensive,
  check whether `rtk discover`'s truncation was removed.
