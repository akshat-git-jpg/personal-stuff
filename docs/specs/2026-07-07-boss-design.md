# boss design spec

**Date:** 2026-07-07
**Status:** design approved, pre-implementation
**Supersedes (deprecates):** `tooling/captain/` (frozen, not deleted)

## Problem

The current orchestrator, `captain`, does intake, brainstorming, routing, dispatch,
token-free watching, and merging in one long-lived session. Three things hurt:

1. It does too much.
2. Its session bloats when several tasks run in parallel.
3. Worst: brainstorming happens *inside* the captain session, so captain holds all
   that context and then re-passes it to the officer/crew it dispatches, so the
   same context gets paid for twice.

The goal is a PR-driven split that pays for context once, keeps the orchestrator
lean forever, and stays simple enough to run long-term at low token cost.

## Shape

Brainstorming leaves the orchestrator entirely. It happens in throwaway Claude
sessions whose only output is a **PR carrying a plan**. That PR is the handoff
boundary, written once and read once. Three roles:

| Role | Is a… | Job | Holds |
|---|---|---|---|
| **secretary** | skill, invocable in any session | `raise` a well-formed PR from a brainstorm; `groom` open PRs (retire stale ones) | brainstorm context (disposable) |
| **boss** | session in `tooling/boss/` | route ready PRs → dispatch crew → verify → merge → deploy | routing state only, never plan/code |
| **crew** | executor (`claude-p`, `agy`) | implement one PR in an isolated worktree, test it, report | the implementation (isolated) |

Boss never brainstorms, never plans, never writes product code. That is what keeps
it lean: it reads machine-parseable fields off each PR and routes on them, never the
plan prose.

## The PR contract

A unit of work is a GitHub PR in **personal-stuff** whose branch carries a committed
plan file `plans/<name>.md`. The plan opens with YAML frontmatter and then prose:

```yaml
---
executor: claude-p        # claude-p | agy   (orchestrate stamps this from rules.md defaults; secretary & boss only read it)
model: sonnet             # per-executor override; blank = executor default
test_cmd: "npm test"      # REQUIRED. exit 0 = pass. this is the CI.
deploy: "wrangler deploy" # optional. blank = no deploy step.
needs: []                 # optional notes (shared target, ordering)
---
```
```markdown
## Problem statement
## Goals
## Success criteria
## What to test + how
```

Rules:

- **`test_cmd` is mandatory and must be an executable command** (exit 0 = pass).
  This repo has no CI, so boss's re-run of `test_cmd` *is* the CI. Secretary
  never refuses to raise over a missing `test_cmd` — it raises anyway and labels
  the PR `gap:test-cmd` instead of `boss:ready`, so boss's queue naturally never
  sees it (label-as-lock; no PR is ever blocked from existing).
- **UI work gets a separate signal, not folded into `test_cmd`.** A plan sets
  `ui: true` in frontmatter; boss's dispatch brief then requires the crew to
  render the changed view, commit one screenshot, and post it as an inline PR
  comment before finishing. `test_cmd` still only asserts build/lint/tests —
  nobody claims an exit code can judge how something looks.
- **Boss reads only the frontmatter** (via a shell grep), never the plan body. That
  keeps per-PR token cost near zero.

### Labels

- Type (awareness): `type:feature` · `type:bug` · `type:refactor` · `type:chore`
- State (also the concurrency lock, see below):
  `boss:ready` → `boss:in-progress` → `boss:done` / `boss:blocked`
- Gap (readiness, mutually exclusive with `boss:ready`): `gap:test-cmd` ·
  `gap:open-points` — secretary raises the PR anyway and applies these instead
  of `boss:ready`; boss ignores anything without `boss:ready`. `groom` audits
  and promotes gap PRs once the plan is fixed.
- Absent state label, or a draft PR = still being brainstormed; boss ignores it.

## The loop

```
[non-boss session]  brainstorm → /secretary raise → boss:ready PR (or gap:* PR if incomplete)
[boss session start] print terminal-state ledger (merged/blocked since last session)
                     + list boss:ready PRs with age + reconcile in-flight from worktrees
   → BATCH confirm: "N ready, dispatching on their frontmatter executor/model, object now"
   → for each PR:  flip boss:ready → boss:in-progress  (claims it; see label-as-lock)
                   merge latest main into the branch, lease a wt worktree
                   dispatch crew; crew reads the plan file itself (no re-narration)
   → crew implements → commits early/often on the branch → runs test_cmd
                   → reports final result as a PR comment
   → at MERGE time (serialized, oldest PR first):
                   rebase/merge onto current main
                   if main moved → re-run test_cmd
                   conflict → ONE fix-up dispatch to the same crew → else boss:blocked
                   clean + green → merge via greenlight → notify → archive plan
   → if frontmatter.deploy set → HARD-GATE: ask owner → deploy on main checkout → notify
   → teardown worktree → next
[periodically] /secretary groom → audit boss:ready + gap:* + draft PRs, promote fixed
                     gap PRs to boss:ready, retire the stale
```

Only **one** confirmation gate exists for implementation: the batch confirm at session
start (the `boss:ready` label is already the owner's approval; re-confirming each
dispatch is the babysitting captain suffered from). Merges are *not* gated but are
*notified* and run in deterministic order. **Deploys are hard-gated**, the one
irreversible step.

## Executors

An executor is one script in `tooling/boss/executors/` implementing three verbs:

```
<executor>.sh dispatch <pr#> <worktree> <plan-path>   # start the work
<executor>.sh alive    <pr#>                           # 0 working, 1 done/idle, 2 dead
<executor>.sh collect  <pr#>                            # print "done|blocked|dead <detail>"
```

Adding an executor is one script, no core change. **v1 ships two:**

- **`claude-p`**: backgrounded `claude -p ... --output-format json` with a
  `--max-turns` + timeout cost cap. Default model `sonnet` (override `opus`).
  Real process: PID liveness; done = result envelope present. The workhorse.
- **`agy`**: headless Antigravity CLI, same AI Pro sub. Default model
  `gemini-3-pro-high` (override to any agy model incl. Claude). Cheap tokens.
  **Its `collect` verb MUST assert HEAD advanced on the expected branch before
  reporting done**, because Antigravity has a wrong-checkout habit (the reason captain
  needed a global lock), and a false `done` would make the label state lie.

(`subagent` was considered and dropped: its report returns into boss's context and
its lifetime is coupled to boss's, both against the lean-boss goal. A third executor
is added later only when a task the two handle badly appears.)

## Routing: one source of truth

`data/rules.md` is an append-only `task-type/label → executor + model` map. It is
**orchestrate's input, not boss's**: when orchestrate authors a plan (Step 3.5) it
reads the defaults and *stamps* `executor`+`model` into the plan's frontmatter.
secretary raises the PR as-is (it never re-derives routing) and boss reads only the
frontmatter. By the time the PR exists, routing is fixed in the frontmatter, so
there is no runtime precedence question — rules.md was consumed at plan-authoring
time. A per-dispatch `boss-dispatch.sh --executor/--model` flag can still override
for a one-off.

## State model: GitHub is the store

No background daemon and no wake-queue. Durable state lives in GitHub:

- **Labels** carry status (`boss:ready`/`in-progress`/`done`/`blocked`).
- **The crew's final report** is a PR comment.
- `tooling/boss/state/` holds only a throwaway PID cache for polling headless crews.

**Label-as-lock (prevents the groom/boss race):** groom owns `boss:ready` + draft
PRs; boss owns `boss:in-progress` onward. Boss flips `ready → in-progress` *before*
dispatch; groom refuses to touch anything not in `ready`/draft. The two processes are
non-overlapping by construction, so they can't double-close a PR or dispatch
against a closed one.

**Resume truth = the worktree + `test_cmd`, never a cached poll result.** If boss dies
mid-flight, headless crews keep running; on restart boss re-derives done-ness from the
worktree (HEAD advanced + `test_cmd` passes), not from a missed poll event. Because
crews commit early/often, a lost worktree costs at most the last increment.

## Verification, merge, deploy

- **Verification** is `test_cmd` (a `bash -c`, not an LLM's self-grade). Crew runs it;
  boss re-runs it once before merge as the safety net that catches a false go-ahead.
- **Merge** is serialized (oldest PR first, so re-runs are predictable), rebased onto
  current main, done via `greenlight`. Every merge fires a notify so the owner can
  intervene even though there's no per-merge gate.
- **Deploy** is a serialized post-merge step, **hard-gated** on owner confirm, run on
  the main checkout. Crew never deploys (deploying from parallel worktrees is the
  clobber path). Serialized merges ⇒ serialized deploys ⇒ concurrent crews touching
  the same shared target (e.g. a VPS service) can't clobber. **Deploy failure:**
  notify + leave the code merged, no auto-rollback.

## Failure & retry policy

- Crew reports blocked, or boss's `test_cmd` re-run fails, or merge conflicts →
  **one** fix-up dispatch to the same crew (it has the context) → still failing →
  `boss:blocked` + notify + move to the next PR. No unbounded retries.
- Crew dead / timed out (no completion after the cap) → teardown → `boss:blocked` →
  next.
- **notify is best-effort over a guaranteed surface:** boss session-start always
  prints the full merged/blocked ledger since the last session, so a silently-dropped
  Telegram message never hides stuck work.

## Concurrency

2 to 3 crews at once. Boss stays lean because crews hold the implementation context, not
boss. Merges and deploys serialize; dispatch and implementation parallelize.

## Secretary

A skill invocable in any session, two modes:

- **`raise`**: from a finished plan file, create a branch, commit the plan, push,
  open the PR, apply `type:*` and `boss:ready`. The frontmatter arrives already
  stamped by orchestrate; secretary only reads it. **Never refuses**: a missing
  `test_cmd` or an unresolved open point becomes a `gap:test-cmd` / `gap:open-points`
  label instead of `boss:ready`, so the PR still exists but stays out of boss's queue
  until `groom` promotes it.
- **`groom`**: on demand, audit `boss:ready` + draft PRs (never in-progress ones),
  surface each one's age, and with the owner retire the stale: update the plan, drop
  `boss:ready`, or close. This is a deliberate sweep that can *edit* plans, which is
  why it stays separate from boss's lightweight session-start age display.

## Boundaries

- Boss never brainstorms, plans, or writes product code; crew never deploys.
- **personal-stuff repo only** for now (multi-repo is deferred).
- Boss holds no plan/brainstorm context; it reads frontmatter, routes, and forgets.
- `tooling/captain/` gets a DEPRECATED banner and is frozen; boss shares **no code**
  with it (rebuilt clean), so captain can be deleted later without touching boss.
- Boss reuses the standalone leaf tools `greenlight` (merge) and `wt` (worktree
  lease) from `tooling/cli/`; these are not captain code and survive its removal.

## Relationship to existing work

The crew stage is close to the repo's existing orchestrator-executor `plans/` loop
(`plans/WORKFLOW.md`): a self-contained plan, an executor, `test_cmd` verification,
one fix-up round. boss differs by being **PR-driven** (the plan rides a GitHub PR and
labels, not a `plans/README.md` status cell) and by splitting brainstorming out into
secretary. Where practical, boss's crew brief should reuse the executor discipline
already proven there (drift check, run every verification, stop on STOP conditions).

## File layout

```
tooling/boss/
  CLAUDE.md              # boss's operating manual (the session reads this)
  README.md              # human orientation
  bin/
    boss-session-start.sh   # ledger + list boss:ready (with age) + reconcile in-flight
    boss-dispatch.sh        # flip label, merge main into branch, lease wt, invoke executor
    boss-state.sh           # status of one/all in-flight PRs (derived from GitHub + worktree)
    boss-merge.sh           # rebase + test_cmd re-run + greenlight merge + archive + notify
    boss-deploy.sh          # gated post-merge deploy on main checkout + notify
  executors/
    claude-p.sh  agy.sh     # 3 verbs each (dispatch/alive/collect)
  data/
    rules.md             # task-type → executor+model defaults (secretary's input)
  state/                 # gitignored: PID cache only
```

Secretary ships as a skill alongside the owner's other skills (not inside
`tooling/boss/`), since `raise` runs inside brainstorm sessions.

## Deferred to v2

- A third executor, added only when `claude-p`/`agy` handle a task badly.
- Multi-repo support (boss operating on PRs outside personal-stuff).
```
