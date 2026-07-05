# Plan 035: `overnight` — capped autonomous improvement loops

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- tooling/cli/overnight/`
> (Changes under `tooling/cli/wt/` and `tooling/cli/greenlight/` are expected
> from plans 033/034. Anything else: STOP.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 033 (`wt`); 034 optional (landing is manual/greenlight later)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

The owner sleeps 7–8 hours; agents don't. `overnight` runs an objective in a
loop — "find the first usability problem a 7-year-old would hit in
tutorial-tracker-app, fix it, repeat" — with **hard caps** so a bad night
can't burn the weekly Claude quota: iteration cap, token cap, stop condition,
consecutive-failure cap. Work lands as commits on an isolated branch for
morning review.

Design adapted from `kunchenguid/gnhf` (studied 2026-07-06). Kept: the
orchestrator owns git and the agent is FORBIDDEN to commit (success commits,
failure hard-resets — atomically enforceable); fresh agent context per
iteration with memory externalized to an orchestrator-only notes file;
`should_fully_stop` evaluated by the same agent that did the work. Dropped:
the moon-phase TUI (this is cron/background-shaped — ntfy replaces watching),
the ACP adapter layer (claude only), the commit-failure repair loop
(we abort preserving work — simpler; see Maintenance).

## Current state

- `wt get --holder <label>` / `wt return <path>` per `tooling/cli/wt/README.md`
  (plan 033). Branch refs created in a worktree survive `wt return`.
- `claude -p "<prompt>" --output-format json` envelope: text at `.result`,
  usage fields as documented in the comment block at the top of
  `tooling/cli/greenlight/greenlight` (plan 034 Step 1 discovered them). If
  034 has not run, do the same discovery probe yourself.
- `pp-ntfy send "<msg>"` for the finish ping.
- Bash conventions: mirror `.claude/skills/orchestrate/scripts/watch-run.sh`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `bash -n tooling/cli/overnight/overnight` | exit 0 |
| Self-test | `bash tooling/cli/overnight/test-overnight.sh` | `ALL TESTS PASSED`, exit 0 |

## Scope

**In scope**: `tooling/cli/overnight/overnight`,
`tooling/cli/overnight/iteration-prompt.md`,
`tooling/cli/overnight/test-overnight.sh`, `tooling/cli/overnight/README.md`
(all new).

**Out of scope**: `wt`, `greenlight` (consume only); any product code; cron
registration (VPS-CRONS is for the VPS — overnight runs on the Mac,
launched manually or by the captain).

## Git workflow

- Branch: `advisor/035-overnight`
- Commit per step: `feat(overnight): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Driver

```
overnight run --repo <path> --objective "<text>"
  [--max-iterations 10] [--max-tokens 1500000] [--stop-when "<condition>"]
  [--max-consecutive-failures 3]
```

Flow (all decided — implement as stated):

1. Run id `<YYYYMMDD-HHMM>-<slug>` (slug: first 20 chars of the objective,
   lowercased, non-alnum → `-`). State dir `~/kb-scratch/overnight/<run-id>/`
   with `notes.md`, `run.log`, `iteration-<n>.json` (raw envelopes),
   `base-commit`, `state`.
2. `path=$(wt get --holder overnight-<run-id>)`; in the worktree create
   branch `overnight/<slug>-<hex6>` (hex6 = first 6 of
   `shasum -a 256 <<<"$objective"`); record `git rev-parse HEAD` to
   `base-commit`. `trap`: on any exit, `wt return "$path"` and write final
   `state`.
3. **Iteration loop** (while iterations < cap AND tokens < cap AND
   consecutive failures < cap AND stop not met):
   - Build the prompt from `iteration-prompt.md` with substitutions:
     `{{OBJECTIVE}}`, `{{ITERATION}}`, `{{NOTES}}` (full current notes.md
     content), `{{STOP_WHEN}}` (or "none set").
   - `claude -p "<prompt>" --output-format json --dangerously-skip-permissions`
     with cwd = worktree. Save raw envelope to `iteration-<n>.json`. Add its
     input+output tokens to the running total.
   - Parse the agent's reply as JSON (retry once on invalid, as greenlight
     does). Required keys: `success` (bool), `summary` (string),
     `key_changes` (array), `key_learnings` (array), `should_fully_stop`
     (bool).
   - `success: true` → the ORCHESTRATOR commits:
     `git add -A && git commit -m "overnight <n>: <summary>"`. If the commit
     itself fails, abort the run with state `commit-failed` — leave the tree
     untouched for human inspection. Append to notes.md:
     `### Iteration <n>\n**Summary:** ...\n**Changes:** ...\n**Learnings:** ...`.
     Reset consecutive-failure counter.
   - `success: false` → `git reset --hard && git clean -fd`; append a
     `### Iteration <n> [FAIL]` notes entry with the learnings; increment
     consecutive failures.
   - `should_fully_stop: true` on a SUCCESSFUL iteration → exit loop with
     state `stop-condition-met`.
4. Exit summary to stdout AND `run.log`: state, iterations (ok/fail), total
   tokens, commit count (`git rev-list --count <base>..<branch>`), branch
   name, and the copy-paste review commands
   `git log --oneline <base>..<branch>` / `git diff --stat <base>..<branch>`.
   Then `pp-ntfy send "overnight: <state>, <k> commits on <branch>, <tokens> tokens"`.

**Verify**: `bash -n tooling/cli/overnight/overnight` → exit 0

### Step 2: The iteration prompt

`iteration-prompt.md` — author exactly this content (adapted from gnhf):

```
You are one iteration of an overnight improvement loop.

## Objective
{{OBJECTIVE}}

## This is iteration {{ITERATION}}
Each iteration makes ONE incremental, individually-verifiable step toward the
objective — not the entire objective.

## Notes from previous iterations (read-only — never edit this file yourself)
{{NOTES}}

## Rules
1. Pick the next smallest logical unit of work that is individually
   verifiable. Avoid what previous iterations already tried and failed.
2. Verify your change works (run the relevant checks/tests; for UI, exercise
   the flow).
3. Make NO git commits — the loop owner commits for you. Do not create
   branches. Do not push.
4. Stop any background processes you started before finishing.
5. If you could not complete a verifiable unit, report success=false with
   honest learnings rather than pivoting endlessly. A no-op iteration is not
   a success.

## Stop condition
{{STOP_WHEN}}
Set should_fully_stop=true ONLY when this stop condition is fully met.

## Final reply
End with ONLY this JSON object (no prose after it):
{"success": true|false, "summary": "<one line>", "key_changes": ["..."],
 "key_learnings": ["..."], "should_fully_stop": true|false}
```

**Verify**: `grep -c "should_fully_stop" tooling/cli/overnight/iteration-prompt.md` → `2`

### Step 3: Self-test

`test-overnight.sh`: throwaway repo + stub `wt`/`claude`/`pp-ntfy` (same
technique as `tooling/cli/greenlight/test-greenlight.sh` — canned envelope
fixtures). Assert: (a) two canned successes → 2 commits on the overnight
branch, notes.md has 2 iteration sections; (b) canned failure → 0 new
commits, worktree clean (reset ran), `[FAIL]` note present; (c) 3 canned
consecutive failures → state `failed`, loop stopped early; (d) canned
success with `should_fully_stop: true` → state `stop-condition-met`;
(e) token cap 1 → loop stops after first iteration with state `token-cap`;
(f) the stub notes that the agent's own `git commit` attempts would be
detectable — assert notes.md was never modified by the stub agent fixture
(orchestrator-only writes). Print `ALL TESTS PASSED`.

**Verify**: `bash tooling/cli/overnight/test-overnight.sh` → `ALL TESTS PASSED`

### Step 4: README

Contract, cap semantics (iteration/token/stop-when/consecutive-failure), the
morning-review protocol (verbatim: "read notes.md and run.log as claims, not
evidence — review the commits"), recommended first objectives
(tutorial-tracker-app usability as a 7-year-old; probe-sites DOWN_SITES
fixes), landing guidance (review then `greenlight run --branch overnight/...`
or cherry-pick), provenance (adapted from kunchenguid/gnhf; dropped TUI +
multi-agent adapters + commit-failure repair).

**Verify**: `test -s tooling/cli/overnight/README.md` → exit 0

## Test plan

Step 3 self-test (stub-driven). Live overnight runs are an owner action, not
an executor verification.

## Done criteria

- [ ] Self-test `ALL TESTS PASSED`; `bash -n` clean
- [ ] Iteration prompt forbids agent commits (`grep -c "NO git commits" iteration-prompt.md` → 1)
- [ ] Caps all enforced in code: grep `max_iterations`, `max_tokens`,
      `consecutive`, `should_fully_stop` each appear in the driver
- [ ] `./scripts/check-apps.sh` exit 0

## STOP conditions

- Envelope usage fields absent/different from greenlight's documentation —
  STOP, report actual envelope (do not guess token accounting).
- Any real personal-stuff branch gets commits during your work — STOP.

## Maintenance notes

- Commit-failure repair (gnhf's cleverest edge case) was cut for simplicity:
  we abort preserving work. If `commit-failed` states show up in practice,
  port gnhf's repair-prompt mechanism.
- The captain (037) may launch overnight runs; the CLI contract is
  load-bearing.
- Token cap default (1.5M) is conservative; the owner tunes per run.
