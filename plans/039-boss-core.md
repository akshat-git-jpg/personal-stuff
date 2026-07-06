# Plan 039: boss core — PR-driven implementation orchestrator + claude-p executor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 00d3d6c..HEAD -- tooling/boss tooling/captain/README.md tooling/captain/CLAUDE.md plans/_TEMPLATE.md decisions.md`
> Expect empty (nothing under `tooling/boss/` yet). If `tooling/boss/` already
> has content, STOP — a prior run may be in flight.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (foundation). 040/041/042 depend on this.
- **Category**: feature
- **Executor**: agy (owner's call)
- **Difficulty**: standard (scripts inlined near-verbatim from proven captain exemplars)
- **Planned at**: commit `00d3d6c`, 2026-07-07

## Why this matters

`boss` is the PR-driven successor to `captain`. The owner brainstorms and makes a plan
with the `orchestrate` skill (which already writes self-contained, zero-context,
test-gated plans into `plans/`); the `secretary` skill (plan 041) raises a GitHub PR
carrying that plan. `boss` is a lean session that reads only the plan's machine-readable
YAML frontmatter, dispatches a crew (executor) to implement it in an isolated worktree,
verifies via the plan's own `test_cmd`, and lands it with `greenlight`. Boss holds
routing state only, never brainstorm/implementation context — that is what keeps it
cheap. Full design + rationale: `docs/specs/2026-07-07-boss-design.md` (source of truth;
read it first).

This plan builds the boss tool + its first executor (`claude-p`) and adds the boss
frontmatter block to the shared plan template so orchestrate-made plans are born
boss-ready. The `agy` executor is plan 040; the secretary skill is 041/042.

## Current state

- **`tooling/boss/` does not exist yet.** This plan creates it.
- **Exemplars to imitate (READ, do NOT modify):**
  - `tooling/captain/lanes.d/claude-headless.sh` — the exact 3-verb executor pattern
    (`dispatch`/`alive`/`collect`, PID liveness, JSON `"result"` completion,
    `meta_get`/`meta_append`). boss's `claude-p.sh` is this, adapted.
  - `tooling/captain/lanes.d/agy-headless.sh` — same pattern for agy (plan 040).
  - `tooling/captain/{CLAUDE.md,README.md}` — tone/structure for boss's manual. boss's is
    SHORTER: no lane registry, no officers, no tmux.
  - `tooling/captain/test-captain.sh` — the PATH-stub self-test pattern boss copies.
- **Reusable standalone CLIs (`tooling/cli/`, NOT captain code — do NOT reimplement):**
  - `greenlight` — `greenlight run --branch <name> [--repo <path>] --verify "<cmd>"`.
    Rebases onto `origin/main`, runs each `--verify` cmd (non-zero parks), lands with
    `git merge --no-ff` + `git push origin main`, calls `notify`. Parks (never stashes)
    if the main checkout is busy. Contract: `tooling/cli/greenlight/README.md`.
  - `wt` — `wt get --holder <h>` prints an isolated worktree path (detached HEAD, reset
    on acquire); `wt return <path>` releases it. Contract: `tooling/cli/wt/README.md`.
  - `notify` — `notify send "<msg>"` (Telegram-first). Never crashes the caller.
- **`agy` at `/Users/kbtg/.local/bin/agy`; `gh` at `/opt/homebrew/bin/gh`; `claude` is a
  shell alias to `claude-work` (aliases do NOT apply in scripts — call the `claude`
  binary on PATH, overridable via `$BOSS_CLAUDE_CMD`).**
- **Repo has no CI** (`plans/README.md` rejected findings). The plan's `test_cmd` re-run
  by greenlight `--verify` IS the gate.

### Locked conventions (obey as facts; do not re-decide)

1. **Branch**: `boss/<NNN-slug>` (e.g. `boss/043-fix-widget`). **Plan file**:
   `plans/<NNN-slug>.md` — the normal plans location. The plan file rides the PR branch
   (it is the initial commit that makes the PR openable) and lands on merge. There is NO
   `plans/boss/` folder.
2. **Plan frontmatter** (YAML between the first two `---` lines, at the very top of the
   plan file): `executor` (`claude-p`|`agy`), `model` (blank = executor default),
   `test_cmd` (REQUIRED, an executable command, exit 0 = pass), `deploy` (blank = none),
   `needs`. Orchestrate fills these when planning (plan template change, Step 3 below).
3. **Labels**: type `type:feature|type:bug|type:refactor|type:chore`; state
   `boss:ready` → `boss:in-progress` → `boss:done` | `boss:blocked`. boss creates any
   missing label with `gh label create` (idempotent).
4. **State store is GitHub.** `tooling/boss/state/` holds only a per-PR `.meta` PID cache
   (gitignored). Resume truth = the worktree + `test_cmd`, never a cached poll.
5. **`plans/README.md` is the durable record, edited only on MAIN, only by boss, only at
   merge** (serialized → conflict-free). No PR branch touches `plans/README.md`. In-flight
   state lives entirely in GitHub labels.
6. **Label-as-lock**: boss flips `boss:ready → boss:in-progress` BEFORE dispatch.
   Secretary `groom` (plan 042) only ever touches `boss:ready`/draft PRs.
7. **Crew never pushes, merges, or deploys.** It commits on `boss/<NNN-slug>` inside the
   leased worktree and reports. boss lands via greenlight; boss deploys.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Bash syntax check | `bash -n <script>` | exit 0 |
| List ready PRs | `gh pr list --label boss:ready --json number,headRefName,title,createdAt` | JSON array |
| Read plan off a branch | `git show origin/boss/<NNN-slug>:plans/<NNN-slug>.md` | file contents |
| Lease a worktree | `wt get --holder boss-<pr>` | prints a path |
| Land a branch | `greenlight run --branch boss/<NNN-slug> --verify "<test_cmd>"` | exit 0 landed / parks |
| Self-test | `bash tooling/boss/test-boss.sh` | prints `ALL TESTS PASSED` |

## Scope

**In scope**:
- `tooling/boss/CLAUDE.md`, `tooling/boss/README.md`, `tooling/boss/.gitignore`
- `tooling/boss/bin/`: `boss-lib.sh`, `boss-session-start.sh`, `boss-dispatch.sh`,
  `boss-state.sh`, `boss-merge.sh`, `boss-deploy.sh`
- `tooling/boss/executors/claude-p.sh`
- `tooling/boss/data/rules.md`, `tooling/boss/state/.gitkeep`, `tooling/boss/test-boss.sh`
- `plans/_TEMPLATE.md` — add the optional boss frontmatter block (Step 3).
- `tooling/captain/README.md` + `tooling/captain/CLAUDE.md` — DEPRECATED banner.
- `decisions.md` — one dated line.

**Out of scope** (do NOT touch):
- `tooling/cli/greenlight|wt|notify` — reused as-is.
- `tooling/captain/bin`, `lanes.d`, `state` — captain frozen.
- `.claude/skills/orchestrate/**` and any skill file — NOT edited here (the template
  change in Step 3 is enough; orchestrate reads the template).
- `executors/agy.sh` (plan 040); the secretary skill (041/042).

## Git workflow

- Branch: `advisor/039-boss-core` (create from current branch; do NOT push).
- Commit per step. Plain messages, no AI footers. `git add` the plan/run-log/prompt
  files yourself if the run instructions say so.

## Steps

### Step 1: Scaffold + shared lib

Create the tree. `tooling/boss/.gitignore`:
```
state/
!state/.gitkeep
```
`tooling/boss/state/.gitkeep` (empty).

`tooling/boss/bin/boss-lib.sh` (sourced by every script):
```bash
#!/bin/bash
# boss shared helpers. Source, don't execute.
set -uo pipefail
BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$BOSS_BIN/.." && pwd)"
REPO_ROOT="$(cd "$BOSS_HOME/../.." && pwd)"   # tooling/boss -> repo root
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"

meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }

# YAML frontmatter reader: fm_get <key> <plan-file>  (first --- ... --- block)
fm_get() {
  awk -v k="$1" '
    /^---[[:space:]]*$/ { n++; next }
    n==1 && $0 ~ "^"k":" { sub("^"k":[[:space:]]*",""); gsub(/^"|"$/,""); print; exit }
  ' "$2"
}

slug_of()     { echo "${1#boss/}"; }
boss_notify() { "$REPO_ROOT/tooling/cli/notify/notify" send "$1" || true; }
boss_ensure_labels() {
  local l; for l in type:feature type:bug type:refactor type:chore \
                    boss:ready boss:in-progress boss:done boss:blocked; do
    gh label create "$l" >/dev/null 2>&1 || true
  done
}
```

**Verify**: `bash -n tooling/boss/bin/boss-lib.sh` -> exit 0.

### Step 2: claude-p executor

Create `tooling/boss/executors/claude-p.sh` (adapt `tooling/captain/lanes.d/claude-headless.sh`;
add the cost cap `--max-turns`):
```bash
#!/bin/bash
# Executor: claude-p — backgrounded `claude -p` in a worktree.
# Contract: <script> <dispatch|alive|collect> <pr#> [brief-path]
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"
meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }
verb="${1:?usage: claude-p.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: claude-p.sh <verb> <pr#> [brief]}"
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="sonnet"
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$brief")" \
        --model "$model" --max-turns "${BOSS_MAX_TURNS:-60}" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
    ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -z "$pid" ] && exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] || { echo "dead no output file"; exit 0; }
    if grep -q '"result"' "$out" 2>/dev/null; then echo "done headless run completed"
    else echo "dead no result in output"; fi ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
```

**Verify**: `bash -n tooling/boss/executors/claude-p.sh` -> exit 0.

### Step 3: Add the boss frontmatter block to the plan template

Prepend to `plans/_TEMPLATE.md` (ABOVE the existing `# Plan <NNN>: <Title>` line), so
orchestrate-made plans carry a boss-readable header. Read the current file first, then
add exactly:
```
<!-- boss frontmatter — fill for plans that boss will run; delete this block for non-boss plans. -->
---
executor: claude-p       # claude-p | agy
model:                   # blank = executor default (claude-p: sonnet)
test_cmd:                # REQUIRED for boss: one command, exit 0 = pass (this is the merge gate)
deploy:                  # blank = no deploy; else the deploy command boss runs after merge
needs: []                # optional notes (shared target, ordering)
---

```
Do NOT change anything else in the template.

**Verify**: `head -1 plans/_TEMPLATE.md | grep -q 'boss frontmatter'` -> exit 0.

### Step 4: Seed the routing rulebook

`tooling/boss/data/rules.md`:
```markdown
# boss routing rulebook (reference)

The `orchestrate` skill consults these DEFAULTS when it fills a plan's boss frontmatter
(`executor`+`model`). Boss reads only the frontmatter, so this file never contradicts a
live dispatch. Append-only once the owner confirms a novel routing.

| task type / label | executor | model |
|---|---|---|
| default | claude-p | sonnet |
| type:refactor (large) | claude-p | opus |
| type:chore (mechanical) | agy | (agy default) |
```

**Verify**: `test -f tooling/boss/data/rules.md` -> exit 0.

### Step 5: boss-dispatch.sh

Create `tooling/boss/bin/boss-dispatch.sh`. Claims a ready PR, leases a worktree ON the
PR branch (commits update the branch ref — the shared-checkout self-merge trap,
`plans/runs/LESSONS.md` 2026-07-06), writes the crew brief, invokes the executor.
```bash
#!/bin/bash
# boss-dispatch.sh <pr#> [--executor <e>] [--model <m>]
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-dispatch.sh <pr#> [--executor e] [--model m]}"; shift
exec_override=""; model_override=""
while [ $# -gt 0 ]; do case "$1" in
  --executor) exec_override="$2"; shift 2;; --model) model_override="$2"; shift 2;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done

branch=$(gh pr view "$pr" --json headRefName -q .headRefName) || { echo "no such PR $pr" >&2; exit 1; }
case "$branch" in boss/*) ;; *) echo "PR $pr branch '$branch' not boss/* — refusing" >&2; exit 1;; esac
slug=$(slug_of "$branch"); planpath="plans/$slug.md"

git -C "$REPO_ROOT" fetch -q origin "$branch"
plan_tmp="$STATE_DIR/$pr.plan"
git -C "$REPO_ROOT" show "origin/$branch:$planpath" > "$plan_tmp" 2>/dev/null \
  || { echo "PR $pr: $planpath missing on branch" >&2; exit 1; }
executor="${exec_override:-$(fm_get executor "$plan_tmp")}"; [ -n "$executor" ] || executor="claude-p"
model="${model_override:-$(fm_get model "$plan_tmp")}"
test_cmd="$(fm_get test_cmd "$plan_tmp")"
[ -n "$test_cmd" ] || { echo "PR $pr: test_cmd missing in frontmatter — refusing" >&2; exit 1; }
[ -f "$BOSS_HOME/executors/$executor.sh" ] || { echo "no executor '$executor'" >&2; exit 1; }

gh pr edit "$pr" --remove-label boss:ready --add-label boss:in-progress

wt=$(wt get --holder "boss-$pr")
git -C "$wt" fetch -q origin "$branch" main
git -C "$wt" checkout -B "$branch" "origin/$branch"
if ! git -C "$wt" merge --no-edit origin/main; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — stale, main-merge conflict"
  wt return "$wt"; echo "PR#$pr blocked (stale)"; exit 2
fi

: > "$STATE_DIR/$pr.meta"
meta_set "$pr" branch "$branch"; meta_set "$pr" slug "$slug"; meta_set "$pr" worktree "$wt"
meta_set "$pr" executor "$executor"; meta_set "$pr" model "$model"; meta_set "$pr" test_cmd "$test_cmd"
meta_set "$pr" planpath "$planpath"

brief="$STATE_DIR/$pr.brief.md"
cat > "$brief" <<EOF
You are a boss crew member. Implement exactly the plan at $planpath in THIS worktree.

Rules:
- Read $planpath fully. Implement its Goals to satisfy its Success criteria.
- You are on branch $branch. COMMIT early and often on this branch.
- Run the plan's test_cmd and make it pass: $test_cmd
- Do NOT push. Do NOT merge. Do NOT deploy. Do NOT edit files outside this repo.
- Finish with a final commit; the last thing you print is the test_cmd result.
EOF

"$BOSS_HOME/executors/$executor.sh" dispatch "$pr" "$brief"
echo "PR#$pr dispatched: executor=$executor model=${model:-default} worktree=$wt"
```

**Verify**: `bash -n tooling/boss/bin/boss-dispatch.sh` -> exit 0.

### Step 6: boss-state.sh

```bash
#!/bin/bash
# boss-state.sh [<pr#>] — status of one/all in-flight PRs. No model calls.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
report() {
  local pr="$1"; [ -f "$STATE_DIR/$1.meta" ] || return
  local ex; ex=$(meta_get "$pr" executor)
  "$BOSS_HOME/executors/$ex.sh" alive "$pr"; local a=$?
  local live=working; [ $a -eq 1 ] && live=idle/done; [ $a -eq 2 ] && live=dead
  local c; c=$("$BOSS_HOME/executors/$ex.sh" collect "$pr" 2>/dev/null)
  echo "PR#$pr  $ex  alive=$live  collect=[$c]"
}
if [ -n "${1:-}" ]; then report "$1"; else
  for m in "$STATE_DIR"/*.meta; do [ -e "$m" ] || continue; report "$(basename "$m" .meta)"; done
fi
```

**Verify**: `bash -n tooling/boss/bin/boss-state.sh` -> exit 0.

### Step 7: boss-merge.sh

Lands via greenlight, then records DONE in `plans/README.md` on main (serialized).
```bash
#!/bin/bash
# boss-merge.sh <pr#> — land a finished PR via greenlight, record DONE, offer deploy.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-merge.sh <pr#>}"
branch=$(meta_get "$pr" branch); slug=$(meta_get "$pr" slug)
test_cmd=$(meta_get "$pr" test_cmd); wt=$(meta_get "$pr" worktree)

if ! "$REPO_ROOT/tooling/cli/greenlight/greenlight" run --branch "$branch" --verify "$test_cmd"; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — greenlight parked (test_cmd failed or checkout busy)"
  echo "PR#$pr parked by greenlight — see ~/kb-scratch/greenlight/"; exit 2
fi

# Landed on main. Record DONE in the plan registry (main checkout, serialized).
title=$(gh pr view "$pr" --json title -q .title 2>/dev/null)
readme="$REPO_ROOT/plans/README.md"
if ! grep -q "boss:$slug" "$readme" 2>/dev/null; then
  # Append a record row under the status table's last row is fragile; instead append a
  # one-line record to a dedicated "boss-landed" list at end of file (idempotent).
  grep -q '^## boss-landed' "$readme" || printf '\n## boss-landed\n' >> "$readme"
  printf -- '- %s — PR#%s %s — DONE\n' "$slug" "$pr" "${title:-}" >> "$readme"
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" && git push -q origin main )
fi

gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done 2>/dev/null || true
gh pr comment "$pr" --body "Landed on main via greenlight." 2>/dev/null || true
[ -n "$wt" ] && wt return "$wt" 2>/dev/null || true
boss_notify "boss:merged PR#$pr ($slug) landed on main"
echo "PR#$pr merged. If the plan has a deploy, run: tooling/boss/bin/boss-deploy.sh $pr --yes"
```

**Verify**: `bash -n tooling/boss/bin/boss-merge.sh` -> exit 0.

### Step 8: boss-deploy.sh

```bash
#!/bin/bash
# boss-deploy.sh <pr#> --yes — run the plan's deploy cmd on the main checkout.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-deploy.sh <pr#> --yes}"
[ "${2:-}" = "--yes" ] || { echo "refusing: pass --yes (owner-confirmed deploy)"; exit 2; }
slug=$(meta_get "$pr" slug)
plan="$REPO_ROOT/plans/$slug.md"   # landed on main with the merge
dcmd=$(fm_get deploy "$plan"); [ -n "$dcmd" ] || { echo "PR#$pr: no deploy — nothing to do"; exit 0; }
echo "PR#$pr deploying on main: $dcmd"
if ( cd "$REPO_ROOT" && bash -c "$dcmd" ); then
  boss_notify "boss:deployed PR#$pr ($slug)"
else
  boss_notify "boss:deploy-FAILED PR#$pr ($slug) — code stays merged, no rollback"
  echo "deploy failed — merged code left in place (per spec)"; exit 1
fi
```

**Verify**: `bash -n tooling/boss/bin/boss-deploy.sh` -> exit 0.

### Step 9: boss-session-start.sh

```bash
#!/bin/bash
# boss-session-start.sh — the session's catch-up surface.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
boss_ensure_labels
echo "== recently landed / blocked =="
gh pr list --state all  --label boss:done    --limit 10 --json number,title -q '.[] | "  done    #\(.number) \(.title)"' 2>/dev/null
gh pr list --state open --label boss:blocked --limit 20 --json number,title -q '.[] | "  BLOCKED #\(.number) \(.title)"' 2>/dev/null
echo "== boss:ready queue (oldest first) =="
gh pr list --state open --label boss:ready --json number,title,createdAt \
  -q 'sort_by(.createdAt) | .[] | "  ready   #\(.number) \(.title)  (raised \(.createdAt))"' 2>/dev/null
echo "== in-flight =="
for m in "$STATE_DIR"/*.meta; do [ -e "$m" ] || continue; "$BOSS_HOME/bin/boss-state.sh" "$(basename "$m" .meta)"; done
```

**Verify**: `bash -n tooling/boss/bin/boss-session-start.sh` -> exit 0.

### Step 10: boss CLAUDE.md + README.md

`tooling/boss/CLAUDE.md` (boss's manual; a session in this folder IS boss). Tight. Must
state: identity (thin dispatcher, routing state only, never brainstorm/plan/write code);
session start runs `bin/boss-session-start.sh`; the loop (batch-confirm the ready PRs at
start → per PR `boss-dispatch.sh` → watch via `boss-state.sh` → on crew done
`boss-merge.sh` → if the plan's frontmatter has a `deploy`, ASK the owner then
`boss-deploy.sh <pr> --yes`); the ONE implementation gate is the batch confirm at session
start (`boss:ready` is already approval — do NOT re-confirm each dispatch); DEPLOY is the
only hard per-item gate; boss reads only frontmatter, never plan prose; failure policy
(one fix-up dispatch, then `boss:blocked` + notify + next PR); boundaries (never
brainstorm/plan/write product code; crew never deploys; personal-stuff only; shares no
code with captain). Link the spec.

`tooling/boss/README.md` (human orientation: the three roles orchestrate→secretary→boss,
the loop, file map, that it reuses greenlight/wt/notify and shares no code with captain).

**Verify**: `test -s tooling/boss/CLAUDE.md && test -s tooling/boss/README.md` -> exit 0.

### Step 11: Deprecate captain + record the decision

Prepend to BOTH `tooling/captain/README.md` and `tooling/captain/CLAUDE.md` (first lines):
```
> **DEPRECATED (2026-07-07).** Superseded by `tooling/boss/` (PR-driven
> orchestrator). Captain is frozen — do not extend it; it may be removed. New
> orchestration work goes to boss. See `docs/specs/2026-07-07-boss-design.md`.

```

Append to `decisions.md` (match its dated-entry style — read the last lines first):
```
- 2026-07-07 — Built `boss` (tooling/boss/), a PR-driven implementation orchestrator replacing `captain` (frozen/deprecated). Flow: brainstorm + `orchestrate` make a plan in plans/ (with boss YAML frontmatter), `secretary` raises a PR carrying it, boss reads only the frontmatter, dispatches a crew (claude-p/agy) in a wt worktree, and lands via greenlight. GitHub labels are live state; plans/README.md is the record. Boss shares no code with captain. Spec: docs/specs/2026-07-07-boss-design.md.
```

**Verify**: `head -3 tooling/captain/README.md | grep -q DEPRECATED && tail -6 decisions.md | grep -q 'Built .boss'` -> exit 0.

### Step 12: Self-test

`tooling/boss/test-boss.sh` — stub `gh`, `wt`, `greenlight`, `notify`, `claude` on PATH
(pattern from `tooling/captain/test-captain.sh`) and assert:
- `fm_get` extracts `executor`/`model`/`test_cmd` from a fixture plan with frontmatter.
- `boss-dispatch.sh` refuses a non-`boss/*` branch and refuses a plan missing `test_cmd`
  (stub `gh pr view` to return each case).
- `claude-p.sh dispatch` with `BOSS_CLAUDE_CMD=echo` writes `pid=`/`out=` meta; `alive`
  returns a defined code.
- `boss-merge.sh` invokes the greenlight stub with `--branch` and `--verify`.
- `bash -n` passes on every `tooling/boss/**/*.sh`.
Print `ALL TESTS PASSED` (exit 0) or the first failing assertion (exit 1).

**Verify**: `bash tooling/boss/test-boss.sh` -> prints `ALL TESTS PASSED`, exit 0.

## Test plan

`test-boss.sh` is the gate — every external command is stubbed, so no real PR, worktree,
land, or model call happens. It must print `ALL TESTS PASSED`. Plus `bash -n` on all
scripts (folded into the self-test).

## Done criteria

- [ ] `bash -n` passes on all `tooling/boss/**/*.sh` (asserted in the self-test).
- [ ] `bash tooling/boss/test-boss.sh` prints `ALL TESTS PASSED`, exit 0.
- [ ] `tooling/boss/{CLAUDE.md,README.md}` non-empty; `data/rules.md` exists.
- [ ] `head -1 plans/_TEMPLATE.md` contains `boss frontmatter`.
- [ ] `head -3 tooling/captain/README.md` and `...CLAUDE.md` contain `DEPRECATED`.
- [ ] `tail -6 decisions.md` contains the boss line.
- [ ] `git status` shows nothing changed under `tooling/captain/{bin,lanes.d,state}` or
      `.claude/skills/`.

## STOP conditions

- `tooling/boss/` already has content at drift check → STOP.
- Can't put the `claude`/`gh`/`wt`/`greenlight` stubs on PATH in the self-test → STOP
  (never run the real binaries in the test).
- A Verify would require a real `git push`, real `greenlight`, or a real `claude`/`agy`
  launch → STOP (verifies here are `bash -n` + stubbed self-test only).
- You find yourself editing `tooling/cli/**`, `tooling/captain/{bin,lanes.d}`, or any
  file under `.claude/skills/` → STOP (out of scope).

## Maintenance notes

- boss's merge stage is entirely greenlight; if greenlight's contract changes, only the
  single `greenlight run` line in `boss-merge.sh` is affected.
- The 3-verb executor contract (`$STATE_DIR/<pr>.meta`) is shared with plan 040's
  `agy.sh` — keep them identical in shape.
- Reviewer scrutiny: (1) the label-as-lock flip BEFORE work in `boss-dispatch.sh`;
  (2) the `checkout -B "$branch"` inside the leased worktree so commits update the branch
  ref (not a detached HEAD); (3) `plans/README.md` edited only on main at merge.
