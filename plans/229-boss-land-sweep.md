<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash tooling/boss/test-boss.sh
ui:
deploy:
needs: []
needs_prs: [184, 189]
touches: [tooling/boss/bin/boss-land-sweep.sh, tooling/boss/bin/boss-session-start.sh, tooling/boss/bin/boss-lib.sh, tooling/boss/test-boss.sh, tooling/boss/CLAUDE.md, tooling/cli/pp-land/pp-land]

mutation_apply: |
  python3 - <<'PY'
  p='tooling/boss/bin/boss-land-sweep.sh'
  s=open(p).read()
  needle='BOSS_STATE_DIR'
  assert needle in s, 'mutation target not found — the separate land store is missing'
  # Reintroduce the real defect: land bookkeeping lands in the DEFAULT state dir, so
  # boss_crews_running reports a land fix-up as a live crew and every boss merge stalls
  # behind it for BOSS_CHROME_WAIT_MIN (45m) against agy's 180m default.
  s=s.replace('BOSS_STATE_DIR=', 'BOSS_STATE_DIR_DISABLED=')
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/boss/test-boss.sh
mutation_expect: "FAIL: a land fix-up was reported as a live boss crew"
mutation_cwd:
mutation_timeout: 600
---

# Plan 229: boss picks up blocked lands, without pretending to be a crew

## Summary

- **Problem statement**: When a land is blocked — a rebase conflict, a failed verify — something
  must resolve it, and the owner has said explicitly that it must not be them and there must be no
  notification. boss is the natural owner because a boss session is always open. But three real
  hazards sit in the way, all verified. `boss_crews_running` (`boss-lib.sh:182-199`) globs
  **every** `"$STATE_DIR"/*.meta` and reports any id whose `pid` is alive — and `agy.sh dispatch`
  writes exactly `pid` and `dispatched_at` — so a land fix-up would be counted as a live crew, and
  `boss-merge.sh` waits `BOSS_CHROME_WAIT_MIN:-45` minutes for live crews while `agy.sh:20`
  defaults `AGY_PRINT_TIMEOUT` to **180m**: one long fix-up stalls **every** boss merge, repeatedly.
  `boss-session-start.sh`'s in-flight loop runs `gh pr view` per meta, and for a non-numeric id
  that fails leaving `$st` empty, which matches no skip branch — so a land entry prints as
  in-flight **forever**. And `boss-dispatch.sh` cannot be used: it leases a **fresh** slot and runs
  `git checkout -B "$branch" "origin/$branch"`, but a blocked land's branch was never pushed, so it
  would force the branch away from the owner's only copy of the commit and then `wt return` would
  wipe the remainder.
- **Goals**: a dedicated sweep that dispatches `agy` **into the existing workspace**, keeps its
  bookkeeping in a separate state namespace so no `state/*.meta` glob ever sees it, classifies
  failures so a transient blip retries and a real failure does not, and is invoked both by
  `pp-land` immediately and by `boss-session-start.sh` as the catch-up path.
- **Executor proposed**: `claude-p` / `opus`. Its own dispatch lock, a per-slug atomic claim, and
  an interaction with boss's crew accounting and Chrome lock — concurrency and a live critical path.
- **Done criteria** (terse — full list below): `bash tooling/boss/test-boss.sh` passes with the new
  cases; a land meta is invisible to `boss_crews_running`; the mutation recipe fails with the
  crew-masquerade marker.
- **Stop conditions** (terse — full list below): the sweep calls `boss-dispatch.sh`, `wt get`, or
  `checkout -B`; it shares `pp-land`'s mutex; it writes into the default `state/`.
- **Test / verification for success**: `tooling/boss/test-boss.sh`, extended with cases that
  assert a land meta is **not** reported by `boss_crews_running`, that the claim is atomic, and
  that the attempt classifier routes each cause correctly.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 69042eb1..HEAD -- tooling/boss/ tooling/cli/pp-land/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — it dispatches an autonomous fix-up that then auto-merges to a public `main`, and
  it touches boss's crew accounting.
- **Depends on**: PRs for plan 223 (`BOSS_STATE_DIR` and a green `test-boss.sh`) and plan 228
  (`pp-land` writes the `.blocked` entries this consumes).
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The owner's constraint is absolute: no notifications, no owner involvement. That turns every
failure in this component into a **silent** failure. A land fix-up that cannot be dispatched, or
whose attempt counter is consumed by a transient blip, means a commit the owner made never reaches
`main` and nothing says so.

That is why the attempt classifier matters as much as the dispatch: getting it wrong in one
direction retries a genuinely broken land forever (the largest token item in the whole design), and
in the other direction abandons a land that would have succeeded on a retry.

## Current state

### Hazard 1 — crew masquerade

`tooling/boss/bin/boss-lib.sh:182-199`, verbatim:

```bash
  local f id pid started dispatched
  for f in "$STATE_DIR"/*.meta; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .meta)
    pid=$(meta_get "$id" pid) || continue
    [ -n "$pid" ] || continue
    kill -0 "$pid" 2>/dev/null || continue
    ...
    echo "$id:$(meta_get "$id" executor)"
  done
```

No filter on the shape of `id`. `boss-merge.sh:105-113` then waits on that output for up to
`BOSS_CHROME_WAIT_MIN:-45` minutes, and `agy.sh:20` is
`--print-timeout "${AGY_PRINT_TIMEOUT:-180m}"`.

Plan 223 made `STATE_DIR="${BOSS_STATE_DIR:-$BOSS_HOME/state}"` — byte-identical when unset. That
override is the fix: running the sweep and **every** related call under
`BOSS_STATE_DIR=$BOSS_HOME/state/lands` means no `state/*.meta` glob sees a land, at any site,
present or future. Patching `boss_crews_running` alone would have missed hazard 2.

### Hazard 2 — the in-flight loop

Plan 223 rewrote it to skip on a local `terminal` marker, but its `gh pr view` path still runs for
any meta without one, and an empty `$st` matches no skip branch and prints. A `land-<slug>` id is
not a PR number, so `gh` fails and it prints forever. The separate store removes it from that glob
entirely.

Confirmed safe already: the orphan check iterates GitHub PRs rather than metas, and the
worktree-lease sweep requires `holder=boss-*` with an all-numeric suffix
(`case "$pr" in ''|*[!0-9]*) continue`), so `land-*` is skipped there.

### Hazard 3 — `boss-dispatch.sh` destroys the commit

Verified in `boss-dispatch.sh`: `wt get --holder "boss-$pr"`, then
`git -C "$wt" checkout -B "$branch" "origin/$branch"`, with `wt return "$wt"` on its error paths.
A blocked land's branch has never been pushed, so `origin/$branch` is absent or stale. This matches
the repo's own recorded lesson (`boss-claudep-maxturns-uncommitted`): fix-ups go via **direct
executor dispatch**, never `boss-dispatch`, which resets the branch.

### The executor's actual interface

`tooling/boss/executors/agy.sh:7-8`:

```bash
verb="${1:?usage: agy.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: agy.sh <verb> <pr#> [brief]}"
```

and line 13:

```bash
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
```

So it takes **no path argument** — it resolves the worktree from `$STATE_DIR/$id.meta`. Line 15
reads `model` (falling back to `AGY_DEFAULT_MODEL`), and line 16 records `head_before`. A blocked
land has no meta, so an unmodified dispatch exits 1 on the **first** attempt, every time. The sweep
must therefore write a synthetic meta first.

Note `meta_set()` is `{ echo "$2=$3" >> "$STATE_DIR/$1.meta"; }` and `meta_get()` ends
`| tail -1`, so appending a field again overrides it — no rewrite logic needed. And
`boss_head_advanced <id>` already exists (`boss-lib.sh:12`+) and is the correct success test.

### Why the sweep must not share `pp-land`'s mutex

`pp-land` holds its mutex across the whole land. A fix-up dispatched *under* it commits, which
fires the `post-commit` dispatcher, which starts a new land — and that land blocks on the mutex its
own dispatcher still holds. So the sweep takes its **own** dispatch lock, and `pp-land` invokes it
only **after** releasing.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The gate | `bash tooling/boss/test-boss.sh` | all pass, exit 0 |
| Syntax-check | `bash -n tooling/boss/bin/boss-land-sweep.sh` | no output, exit 0 |
| Prove the store is separate | `BOSS_STATE_DIR=/tmp/x bash -c 'source tooling/boss/bin/boss-lib.sh >/dev/null 2>&1; echo $STATE_DIR'` | `/tmp/x` |
| Is a branch merged | `git merge-base --is-ancestor <branch> origin/main` | exit 0 = merged |

## Scope

**In scope**:
- `tooling/boss/bin/boss-land-sweep.sh` — new
- `tooling/boss/bin/boss-session-start.sh` — one call to the sweep
- `tooling/boss/bin/boss-lib.sh` — only if a shared helper is genuinely needed; prefer not to touch
- `tooling/boss/test-boss.sh` — new cases
- `tooling/boss/CLAUDE.md` — one subsection
- `tooling/cli/pp-land/pp-land` — one line: invoke the sweep after releasing the mutex

**Out of scope** — looks related, do not touch:
- **`boss-dispatch.sh`.** Never call it for a land, and do not modify it. Hazard 3.
- **`boss_crews_running`.** Do **not** add a `case "$id" in land-*)` filter. The separate store is
  the fix and it covers every glob site; a per-site patch is what let hazard 2 through.
- **`boss-merge.sh`'s crew wait** and its Chrome lock usage — plan 223 hardened the lock; leave the
  wait alone.
- **`pp-land`'s mutex, sequence, or coalescing** — plan 228. This plan adds exactly one call.
- **`wt`** in any form. The sweep never leases a worktree; the workspace already exists.

## Git workflow

- Branch: `advisor/229-boss-land-sweep`
- Commit per step, message style `feat(boss): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Write the sweep

Create `tooling/boss/bin/boss-land-sweep.sh`, `chmod +x`. It takes no arguments and is safe to run
at any time, concurrently, and repeatedly.

```bash
#!/bin/bash
# boss-land-sweep — dispatch a fix-up for every blocked land, into the workspace that
# already exists.
#
# Runs under its OWN state namespace. Without that, `boss_crews_running` (boss-lib.sh
# :182-199) globs every state/*.meta and reports any live pid as a crew, and
# boss-merge.sh waits BOSS_CHROME_WAIT_MIN (45m) for live crews while agy's own timeout
# defaults to 180m — so one long fix-up would stall EVERY boss merge, repeatedly. The
# separate store also keeps land ids out of the session-start in-flight loop, where a
# non-numeric id makes `gh pr view` fail, leaves $st empty, matches no skip branch, and
# prints as in-flight forever.
set -uo pipefail

BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BOSS_STATE_DIR="$(cd "$BOSS_BIN/.." && pwd)/state/lands"
mkdir -p "$BOSS_STATE_DIR"
source "$BOSS_BIN/boss-lib.sh"
```

Then, for each `"$BOSS_STATE_DIR"/land-*.blocked`:

1. **Its own dispatch lock**, never `pp-land`'s mutex — sharing it deadlocks (see Current state).
   Same hardening as the other three locks: `mkdir` lock with a `pid` file, stale-break on a dead
   pid, age-break with no pid, bounded wait, owner-checked release.
2. **Per-slug atomic claim**: `mv "$f" "${f%.blocked}.dispatching"`. A rename within one directory
   is atomic, so two sweepers cannot both take the same slug. If the `mv` fails, another sweeper
   won it — skip.
3. **Skip a live fix-up**: if `"$BOSS_BIN/../executors/agy.sh" alive "land-$slug"` returns 0, put
   the file back and skip.
4. **Read** `workspace=`, `branch=`, `reason=`, `attempts=`, `no_auto_resolve=` from the entry.
5. **Refuse to auto-resolve** when `no_auto_resolve=1` (a deploy-live path — `infra/`, `scripts/`,
   `.github/`, `tooling/boss/`, `apps/*/wrangler.toml`). Restore the `.blocked` name and skip; the
   land waits. This is a deliberate hold, not a failure, so it must **not** consume an attempt.
6. **Classify the reason**, and apply the counters. This table is the whole policy:

   | class | causes | effect |
   |---|---|---|
   | **transient** | landing-mutex stale-break or timeout; push rejected after `LAND_ATTEMPTS`; fetch/network failure; `wt`/pool exhaustion; mechanical dispatch failure (missing meta, `agy` not installed) | **resets** the real-attempt counter; bounded at **5 per slug per 24 h** |
   | **real** | verify failure (**always**, even when it smells flaky); lint failure; hard rebase conflict; a fix-up whose HEAD never advanced | **consumes** an attempt; cap **2** |
   | **never retry** | a `pp-push` gate refusal; the deploy-live refusal; a **second** `cannot detach at origin/main` after the single `clean -xfd` escalation | no dispatch at all; the entry stays listed |

   Verify failures consume an attempt even when they look flaky, deliberately: auto-retrying a
   flaky verify is how red code lands on a repo that `vps-sync.sh` deploys within 15 minutes. A
   `pp-push` refusal never retries because a retry re-attempts publishing a secret to a **public**
   repo — it is a content defect wearing a refusal's clothes.

7. **Write the synthetic meta** — `agy.sh` cannot be handed a path:

   ```bash
   meta_set "land-$slug" worktree "$workspace"   # ABSOLUTE path
   meta_set "land-$slug" model ""                # blank -> agy.sh:15 uses its default
   meta_set "land-$slug" executor agy
   ```

8. **Write the brief to an ABSOLUTE path** — the executor `cd`s into the worktree, so a relative
   brief is unreadable (recorded lesson `boss-fixup-brief-absolute-path`). Put it at
   `$BOSS_STATE_DIR/land-$slug.brief.md`. The brief must state: the workspace path, the branch, the
   parked reason, that the fix is to be made **in that workspace**, that committing there will
   re-trigger the land automatically, and the STOP rule that a gate assertion must never be
   weakened to pass.
9. **Acquire boss's Chrome lock** around any browser-driving verify the fix-up will run, and
   release it after. Hiding land metas from `boss_crews_running` removes the crew-wait heuristic
   that used to prevent Chrome contention (PR#134 lost a merge cycle to 44 live Chrome processes),
   so the lock built for that purpose must be taken explicitly. Plan 223 made
   `boss_chrome_lock_acquire` return non-zero on timeout — **honour it**: if it fails, do not
   release on exit, and treat the cause as **transient**.
10. **Dispatch**: `"$BOSS_BIN/../executors/agy.sh" dispatch "land-$slug" "$abs_brief"`.
11. **Judge by `boss_head_advanced "land-$slug"`**, never by PR labels — there is no PR, and labels
    lie (two MERGED PRs were still labelled `boss:in-progress`).
12. On dispatch failure, restore the `.blocked` name with the counters updated, so the next sweep
    can retry per the policy.

**Verify**: `bash -n tooling/boss/bin/boss-land-sweep.sh` -> no output, exit 0
**Verify**: `grep -c 'BOSS_STATE_DIR' tooling/boss/bin/boss-land-sweep.sh` -> at least `2`
**Verify**: `grep -cE 'boss-dispatch|wt get|checkout -B' tooling/boss/bin/boss-land-sweep.sh` -> `0`

Commit: `feat(boss): land sweep dispatching agy into the existing workspace`

### Step 2: Wire both callers

In `boss-session-start.sh`, add a final section that calls the sweep — this is the catch-up path
that satisfies "if boss is not open, once it opens it takes care of pending work". Match the
existing section style (a `== heading ==` line, then indented output), and list blocked lands even
when none are dispatchable, so a capped land stays visible without being a notification.

In `tooling/cli/pp-land/pp-land`, add **one** line after the mutex is released:

```bash
# After releasing — a fix-up dispatched under the mutex would commit, fire the
# post-commit dispatcher, and that land would block on the mutex its own dispatcher
# still holds.
"$MAIN/tooling/boss/bin/boss-land-sweep.sh" >/dev/null 2>&1 || true
```

That is what makes pending work move immediately whether or not a boss session exists; the
session-start call becomes the backstop for a dead sweep or a reboot.

**Verify**: `bash -n tooling/boss/bin/boss-session-start.sh tooling/cli/pp-land/pp-land` ->
no output
**Verify**: `grep -c 'boss-land-sweep' tooling/boss/bin/boss-session-start.sh` -> `1`
**Verify**: `grep -c 'boss-land-sweep' tooling/cli/pp-land/pp-land` -> `1`

Commit: `feat(boss): sweep blocked lands at session start and after each land`

### Step 3: Tests

Append to `tooling/boss/test-boss.sh`, matching its `fail` / `echo PASS` idiom and its stub `gh`
and stub `wt` on `PATH`. Required cases:

1. **A land meta is invisible to `boss_crews_running`.** Write `state/lands/land-x.meta` with a
   live `pid` and `dispatched_at`, then assert `boss_crews_running` (running with the **default**
   `STATE_DIR`) does not mention `land-x`. Failure message must be exactly
   `FAIL: a land fix-up was reported as a live boss crew`.
2. **The claim is atomic.** Create one `.blocked`, run the sweep twice concurrently, and assert
   exactly one `.dispatching` exists and the executor was invoked once (a stub `agy.sh` counting
   invocations).
3. **`no_auto_resolve=1` is not dispatched**, the `.blocked` name is restored, and the attempt
   counter is **unchanged**.
4. **A transient reason resets the counter; a real reason consumes it.** Drive the classifier
   directly with two entries and assert the resulting counters.
5. **At the real-attempt cap the sweep stops dispatching** but the entry is still listed by
   `boss-session-start.sh`'s new section — visible without a notification.
6. **The transient bound holds**: a 6th transient reset inside 24 h does not dispatch.

Use a stub `agy.sh` on `PATH` so no real executor runs. Bound every wait so a regression fails
rather than hangs.

**Verify**: `bash tooling/boss/test-boss.sh` -> all pass, exit 0

Commit: `test(boss): pin the land sweep's isolation, claim and attempt policy`

### Step 4: Document

Add a subsection to `tooling/boss/CLAUDE.md`: blocked lands live in `state/lands/` under
`BOSS_STATE_DIR`; that namespace exists so `boss_crews_running` and the in-flight loop never see
them; fix-ups are a **direct** `agy.sh` dispatch into the existing workspace, never
`boss-dispatch.sh`; the attempt policy table; and that the sweep is called both by `pp-land` and at
session start.

**Verify**: `grep -c 'state/lands' tooling/boss/CLAUDE.md` -> at least `1`

Commit: `docs(boss): record the land sweep and its attempt policy`

## Test plan

`bash tooling/boss/test-boss.sh` is the gate — green only because plan 223 fixed its `gh` stub, so
this plan depends on it.

Case 1 is the mutation target and the most consequential: it proves the separate namespace is real.
Without it a land fix-up stalls every boss merge for 45 minutes at a time, and nothing reports it.
Case 2 proves the atomic claim, which is what allows `pp-land` and a live boss to both call the
sweep without coordination. Cases 3-6 pin the attempt policy, which is the token-cost backstop:
getting it wrong retries a permanently broken land forever.

## Done criteria

- [ ] `bash tooling/boss/test-boss.sh` passes with the six new cases, exit 0.
- [ ] `test -x tooling/boss/bin/boss-land-sweep.sh` exits 0 (LESSONS 2026-08-17).
- [ ] `bash -n` passes on the sweep, `boss-session-start.sh`, `pp-land`, `test-boss.sh`.
- [ ] `grep -cE 'boss-dispatch|wt get|checkout -B' tooling/boss/bin/boss-land-sweep.sh` -> `0`.
- [ ] `grep -c 'boss_head_advanced' tooling/boss/bin/boss-land-sweep.sh` -> at least `1`.
- [ ] `grep -cE 'gh pr (view|edit)' tooling/boss/bin/boss-land-sweep.sh` -> `0` — a land has no PR
      and labels lie.
- [ ] `grep -c 'case "$id" in land-' tooling/boss/bin/boss-lib.sh` -> `0` — the per-site patch was
      deliberately **not** used.
- [ ] `grep -c 'boss-land-sweep' tooling/boss/bin/boss-session-start.sh` -> `1` and the same for
      `tooling/cli/pp-land/pp-land`.
- [ ] `ls tooling/boss/state/*.meta | wc -l` is still `171` — the sweep created nothing in the
      default store.
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes
      `bash tooling/boss/test-boss.sh` fail printing
      `FAIL: a land fix-up was reported as a live boss crew`; reverting passes again.
- [ ] `git diff --stat` against the branch point touches only the six files in `touches`.

## STOP conditions

- **You are about to call `boss-dispatch.sh`, `wt get`, or `checkout -B` for a land.** STOP. A
  blocked land's branch was never pushed, so `checkout -B "$branch" "origin/$branch"` force-moves
  it away from the owner's only copy of the commit, and `wt return` then wipes the remainder.
- **You are about to add a `case "$id" in land-*)` filter to `boss_crews_running`.** STOP. Use the
  separate store; a per-site patch missed the session-start loop last time.
- **The sweep would share `pp-land`'s mutex.** STOP — that deadlocks: the fix-up commits, the
  post-commit dispatcher starts a land, and that land waits on the mutex its own dispatcher holds.
- **A land meta appears under `tooling/boss/state/` rather than `state/lands/`.** STOP — that is
  hazard 1 reproducing.
- **`boss_chrome_lock_acquire` returns non-zero and you are about to release anyway.** STOP. Plan
  223 made a timeout report itself precisely so a caller does not delete the real holder's lock.
- **A test needs the attempt cap raised or the classifier loosened to pass.** STOP. Fix the
  fixture. Loosening the classifier is how a permanently red land dispatches crews forever, which
  is the single largest token risk in this design.
- **You are about to add a notification, a phone ping, or a prompt for the owner.** STOP. The owner
  ruled that out explicitly; visibility is the session-start listing and `pp-work list`.

## Maintenance notes

- The separate namespace is the load-bearing choice. `boss_crews_running` and the session-start
  in-flight loop are the two `state/*.meta` globs that exist **today**; the store means a third one
  added later is safe by default.
- The attempt policy has three classes, not two. The "never retry" class exists because those three
  causes look transient and are not: a `pp-push` refusal is a content defect, a deploy-live refusal
  is a deliberate hold, and a repeat `cannot detach` after the escalation is a wedged tree.
- Success is `boss_head_advanced`, never a label. Two MERGED PRs were still labelled
  `boss:in-progress`, and a land has no PR at all.
- A reviewer should scrutinise: that the sweep is genuinely re-entrant (it is called by `pp-land`
  and by session start, possibly at once), and that a restored `.blocked` file always carries
  updated counters — a restore that loses the counter turns the cap into an infinite retry.
