# Plan 040: boss agy executor

> **Executor instructions**: Follow step by step. Run every Verify. Honor STOP
> conditions. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 00d3d6c..HEAD -- tooling/boss/executors`
> Expect only `claude-p.sh` present (from plan 039). If `agy.sh` already exists, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (agy's wrong-checkout habit is the real risk; the `collect` guard below is the mitigation)
- **Depends on**: 039 (boss core: `boss-lib.sh`, the executor contract, `state/`)
- **Category**: feature
- **Executor**: agy
- **Difficulty**: mechanical (near-verbatim from the captain agy exemplar + one guard)
- **Planned at**: commit `00d3d6c`, 2026-07-07

## Why this matters

Boss's second executor. Same headless-process model as `claude-p` but runs the
Antigravity CLI (`agy`) — same AI Pro subscription, cheap tokens, per-call model choice.
The one danger (from `plans/runs/LESSONS.md` 2026-07-06 + `docs/specs/2026-07-07-boss-design.md`)
is agy's habit of operating on the wrong checkout, which would let boss's label state
lie ("done" with no commits). The `collect` verb therefore asserts HEAD actually
advanced before reporting done.

## Current state

- Plan 039 created `tooling/boss/executors/claude-p.sh` (the contract to match) and
  `tooling/boss/state/`.
- **Exemplar (READ, do NOT modify)**: `tooling/captain/lanes.d/agy-headless.sh` — the
  full agy invocation, JSON-envelope parse, and meta handling. Copy its structure.
- **agy invocation facts** (from the exemplar + LESSONS.md 2026-07-06):
  `--add-dir <worktree>` is mandatory (print mode does NOT bind cwd — without it agy
  roams `$HOME` under skip-permissions); `--print-timeout 180m` (default 5m kills real
  runs); `--output-format json` gives `status`/`usage`/`conversation_id`; agy reads
  `AGENTS.md`, never `CLAUDE.md` (repo ships an `AGENTS.md -> CLAUDE.md` symlink at root).
- `agy` is at `/Users/kbtg/.local/bin/agy` (add `$HOME/.local/bin` to PATH in the script).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check | `bash -n tooling/boss/executors/agy.sh` | exit 0 |
| Confirm agy present | `command -v agy` | a path |
| Confirm repo AGENTS.md | `test -e AGENTS.md` | exit 0 |
| Self-test | `bash tooling/boss/test-boss.sh` | `ALL TESTS PASSED` |

## Scope

**In scope**: `tooling/boss/executors/agy.sh`; extend `tooling/boss/test-boss.sh` with
one agy assertion; a one-line mention of the agy executor in `tooling/boss/README.md`.
**Out of scope**: `claude-p.sh`, any `bin/` script, `tooling/captain/**`, `tooling/cli/**`.

## Git workflow

- Branch: `advisor/040-boss-agy-executor` (from current branch; do NOT push).
- One commit. Plain message, no AI footers.

## Steps

### Step 1: agy.sh

Create `tooling/boss/executors/agy.sh`. Same 3-verb contract as `claude-p.sh`. `dispatch`
records the pre-run HEAD so `collect` can prove progress; `collect` parses the JSON
envelope AND requires HEAD to have advanced.
```bash
#!/bin/bash
# Executor: agy — backgrounded Antigravity CLI in a worktree.
# Contract: <script> <dispatch|alive|collect> <pr#> [brief-path]
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"   # agy installs here
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"
meta_get() { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set() { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }
verb="${1:?usage: agy.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: agy.sh <verb> <pr#> [brief]}"
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v agy >/dev/null || { echo "ERROR: agy not installed" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="${AGY_DEFAULT_MODEL:-Gemini 3.1 Pro (High)}"
    meta_set "$id" head_before "$(git -C "$worktree" rev-parse HEAD 2>/dev/null || echo none)"
    ( cd "$worktree" || exit 1
      exec agy -p "$(cat "$brief")" \
        --dangerously-skip-permissions --add-dir "$worktree" \
        --output-format json --print-timeout "${AGY_PRINT_TIMEOUT:-180m}" \
        --model "$model"
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
    ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -z "$pid" ] && exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] && [ -s "$out" ] || { echo "dead no output"; exit 0; }
    status=$(python3 - "$out" <<'PY'
import json,sys
raw=open(sys.argv[1]).read().strip()
try: d=json.loads(raw)
except Exception:
    try: d=json.loads(raw.splitlines()[-1])
    except Exception: print("PARSEFAIL"); raise SystemExit
print(d.get("status",""))
PY
)
    # HEAD-advanced guard: agy can operate on the wrong checkout; a SUCCESS with no new
    # commit is NOT done (would make boss's label state lie).
    wt=$(meta_get "$id" worktree); before=$(meta_get "$id" head_before)
    after=$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)
    case "$status" in
      SUCCESS)
        if [ "$after" != "$before" ] && [ "$after" != none ]; then echo "done agy completed, HEAD advanced"
        else echo "blocked agy reported success but HEAD did not advance (wrong-checkout?)"; fi ;;
      ERROR) echo "blocked agy error" ;;
      PARSEFAIL) echo "dead unparseable output" ;;
      *) echo "dead no status in envelope" ;;
    esac ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
```

**Verify**: `bash -n tooling/boss/executors/agy.sh` -> exit 0.

### Step 2: Confirm the repo AGENTS.md symlink exists

agy reads `AGENTS.md`, not `CLAUDE.md`. The repo already ships an `AGENTS.md -> CLAUDE.md`
symlink at root (captain set it up). Confirm it — do NOT create or modify it here.

**Verify**: `test -e AGENTS.md` -> exit 0. If MISSING, add a note to the run-log and
report it (a human creates the symlink on main); do NOT create it from this worktree.

### Step 3: Extend the self-test + README mention

Add one assertion to `tooling/boss/test-boss.sh`: with a stub `agy` on PATH that prints
`{"status":"SUCCESS"}`, `agy.sh dispatch` writes a `pid=`/`head_before=` meta and
`bash -n tooling/boss/executors/agy.sh` passes. Add one line to `tooling/boss/README.md`
listing `agy` as the second executor (default model Gemini 3.1 Pro (High), overridable).

**Verify**: `bash tooling/boss/test-boss.sh` -> `ALL TESTS PASSED`, exit 0.

## Test plan

Self-test with a stubbed `agy` (never launches the real CLI). `bash -n` on the new script.

## Done criteria

- [ ] `tooling/boss/executors/agy.sh` exists; `bash -n` clean.
- [ ] `collect` reports `blocked` (not `done`) when HEAD did not advance (assert in test).
- [ ] `bash tooling/boss/test-boss.sh` prints `ALL TESTS PASSED`.
- [ ] `test -e AGENTS.md` succeeds (or the run-log notes it missing).

## STOP conditions

- `AGENTS.md` missing at repo root → note it, do NOT create it from the worktree.
- Any Verify would launch the real `agy` (no real CLI runs in the test) → STOP.
- You need to touch `claude-p.sh` or any `bin/` script → STOP (out of scope).

## Maintenance notes

- Keep `agy.sh` and `claude-p.sh` identical in the 3-verb shape; only `dispatch`'s launch
  line and `collect`'s completion check differ.
- The HEAD-advanced guard is load-bearing — do not simplify it away; it is the only thing
  standing between agy's wrong-checkout habit and a lying `boss:done` label.
