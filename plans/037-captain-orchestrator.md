# Plan 037: `captain` — multi-session orchestrator with pluggable lanes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- tooling/captain/ CLAUDE.md`
> (Changes from plans 033–036 under `tooling/cli/` and `.claude/skills/` are
> expected. Anything else: STOP.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 033 (`wt`), 034 (`greenlight`); 035 optional
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: tricky
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

The owner wants "an orchestrator below me": one session they talk to that
runs many tasks across projects in parallel — spawning workers in isolated
worktrees, watching them token-free, landing finished work through
greenlight, and asking the owner only what needs the owner. Adapted from
`kunchenguid/firstmate` (studied 2026-07-06 in source). Kept: the captain IS
an agent session whose operating manual is a CLAUDE.md; tmux windows as
addressable crewmate containers; Stop-hook turn-end markers; append-only
status logs; the "absorb a wake only when the crew shows positive evidence of
work" policy. Our spin: a **pluggable lane registry** (owner requirement
2026-07-06 — adding an executor is one script, no core change) with
propose-and-confirm routing, Antigravity as a first-class cheap lane, and
`wt`'s stdout-path lease replacing firstmate's pane-cwd polling (simpler and
race-free).

## Current state

- `wt get --holder <label>` prints ONLY the worktree path on stdout
  (`tooling/cli/wt/README.md`); `wt return <path>` releases.
- `greenlight run --branch <b> --intent "<text>" [--skip review]
  [--reviewer-model sonnet]` lands or parks (`tooling/cli/greenlight/README.md`).
- Antigravity dispatch already exists:
  `.claude/skills/orchestrate/scripts/ag-handoff.sh <prompt-file>` (pbcopy →
  focus app → paste → Enter) and `watch-run.sh <run-log> [timeout-min]`
  (blocks; exit 0 done / 2 blocked / 3 stale / 4 never started). Known
  Antigravity quirks are in `plans/runs/LESSONS.md` — notably: it skips
  run-log heartbeats on long GUI runs, so file mtimes + git log are the real
  liveness signal.
- Session-launch mechanics proven in `tooling/cli/yt-claude/relay.py`
  (lines 122–197): write a prompt file, launch
  `claude --dangerously-skip-permissions "$(cat <prompt>)"` via a generated
  zsh script; a `CAP_LAUNCH_CMD` env override enables plumbing tests without
  a real TUI (relay.py's `YT_CLAUDE_CMD` trick).
- Claude Code Stop hooks: a worktree-local `.claude/settings.local.json`
  containing
  `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"touch <abs-marker-path>"}]}]}}`
  fires after every assistant turn. Keep the file out of git via
  `.git/info/exclude` in the worktree.
- tmux (`brew install tmux` if absent — check `command -v tmux` first):
  `tmux new-session -d -s captain`, `tmux new-window -d -t captain -n cap-<id>
  -c <dir>`, `tmux send-keys -t captain:cap-<id> -l '<text>'` then a separate
  `send-keys ... Enter`, `tmux capture-pane -p -t captain:cap-<id> -S -40`.
  Busy regex for Claude panes: `esc (to )?interrupt|Working\.\.\.` (firstmate's,
  verified). Submit protocol: type once; on a swallowed Enter retry **Enter
  only, never retype**.
- This repo's projects the captain should know at birth: personal-stuff
  (this repo), `~/printing-press/library/*` (Go CLIs). Registry is data, not
  code.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| tmux present | `command -v tmux` | a path (else `brew install tmux`) |
| Syntax | `for f in tooling/captain/bin/*.sh; do bash -n "$f" || exit 1; done` | exit 0 |
| Self-test | `bash tooling/captain/test-captain.sh` | `ALL TESTS PASSED`, exit 0 |

## Scope

**In scope** (all new unless noted):
- `tooling/captain/CLAUDE.md` — the captain's operating manual
- `tooling/captain/bin/cap-spawn.sh`, `cap-state.sh`, `cap-watch.sh`,
  `cap-send.sh`, `cap-teardown.sh`, `cap-session-start.sh`
- `tooling/captain/lanes.d/claude-tmux.sh`, `claude-headless.sh`,
  `antigravity.sh`
- `tooling/captain/data/projects.md`, `data/rules.md` (seed content)
- `tooling/captain/state/.gitkeep` + `.gitignore` (state is machine-local)
- `tooling/captain/test-captain.sh`, `tooling/captain/README.md`
- Root `CLAUDE.md`: one routing row

**Out of scope**: the orchestrate skill (the captain CALLS ag-handoff/watch
scripts, never edits them); `wt`/`greenlight`/`overnight` sources; any
existing skill except the CLAUDE.md routing row.

## Git workflow

- Branch: `advisor/037-captain`
- Commit per step: `feat(captain): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Lane registry

Each lane = one executable `lanes.d/<lane>.sh` implementing three verbs
(called as `<script> <verb> <task-id> [args...]`, task metadata read from
`state/<task-id>.meta`):

- `dispatch <task-id> <brief-path>` — start the work; record lane-specific
  fields into the meta file.
- `alive <task-id>` — exit 0 if provably working, 1 if finished/silent,
  2 if dead.
- `collect <task-id>` — print final state: `done|blocked|dead` plus a one-line
  detail.

Implementations (all decided):
- **claude-tmux**: dispatch = ensure `tmux` session `captain` exists; window
  `cap-<id>` with cwd = the task worktree; install the Stop hook (marker
  `tooling/captain/state/<id>.turn-ended`, absolute path; hook file added to
  the worktree's `.git/info/exclude`); launch
  `${CAP_LAUNCH_CMD:-claude} --dangerously-skip-permissions "$(cat <brief>)"`
  via send-keys (literal text, 0.3s sleep, Enter separately). alive = pane
  busy-regex match. collect = pane not busy AND turn-ended marker newer than
  dispatch → `done`.
- **claude-headless**: dispatch = `nohup claude -p "$(cat <brief>)"
  --output-format json --dangerously-skip-permissions > state/<id>.out 2>&1 &`
  with cwd = worktree; record PID. alive = `kill -0 <pid>`. collect = parse
  `.result` presence → `done`, else `dead`.
- **antigravity**: dispatch = create run-log `plans/runs/<id>.md` header +
  `ag-handoff.sh <brief>`; alive = worktree file mtimes or git log advanced
  in last 10 min (LESSONS.md: don't trust its heartbeats); collect =
  `runlog-status.sh` word, with git-commit fallback.

**Verify**: `for f in tooling/captain/lanes.d/*.sh; do bash -n "$f" || exit 1; done` → exit 0

### Step 2: Task lifecycle scripts

- `cap-spawn.sh <id> <project-path> --lane <lane> [--model <m>] [--effort <e>]`:
  refuse duplicate ids; `wt_path=$(wt get --holder cap-<id> --repo <project>)`;
  write `state/<id>.meta` (`lane= project= worktree= model= created=`); write
  the brief the CAPTAIN already saved at `data/<id>/brief.md` is a
  precondition — spawn fails loudly if missing; call the lane's `dispatch`.
- `cap-state.sh [<id>]`: for one/all tasks print `id lane state detail` where
  state = lane `alive`/`collect` reconciled with the last line of
  `state/<id>.status` (append-only log; terminal verbs `done:` `failed:`
  `needs-decision:` `blocked:`). The LIVE lane check wins over a stale log
  line (firstmate's rule).
- `cap-send.sh <id> "<text>"`: claude-tmux lane only — the submit protocol
  from Current state. Other lanes: exit 1 `lane not interactive`.
- `cap-teardown.sh <id> [--force]`: refuse if `cap-state` says working (unless
  `--force`); if the task branch has commits not on main, print the
  greenlight invocation instead of losing them; kill the tmux window (tmux
  lane); `wt return <worktree>`; archive `state/<id>.*` into
  `state/archive/`.
- `cap-watch.sh`: infinite loop (30s cadence): for each non-archived task,
  compare lane liveness + turn-ended marker mtimes against
  `state/<id>.last-seen`; on a change that means "needs attention" (finished,
  died, or turn ended while status has no terminal verb) append a line to
  `state/.wake-queue` — but ONLY if the lane does not show positive evidence
  of ongoing work (absorb rule). Never calls any model. Runs as a background
  Bash task from the captain session.

**Verify**: `bash -n` all five → exit 0

### Step 3: The operating manual — `tooling/captain/CLAUDE.md`

This file turns a Claude session started in `tooling/captain/` into the
captain. Author it with these sections (the intelligence lives here — write
it complete, not as stubs):

1. **Identity & tone**: you are the captain; talk outcomes, not mechanics
   ("landing the pinterest fix" not "spawning a crewmate"). One-line
   narration per action.
2. **Session start**: run `bin/cap-session-start.sh` (drains
   `state/.wake-queue`, prints fleet digest: every task's `cap-state` line +
   `data/backlog.md` + parked greenlight runs). Reconcile dead tmux windows
   against metas before anything else.
3. **Intake checklist** (per owner ask): resolve project (`data/projects.md`);
   classify ship (code) vs scout (research → report at `data/<id>/report.md`);
   split into tasks — same repo + overlapping area = serialize, else
   parallel; check `data/rules.md` for a routing rule; **no rule match →
   PROPOSE lane+model and ask the owner in one short line** (owner decision:
   propose-and-confirm); a confirmed novel routing gets appended to
   `data/rules.md` by you.
4. **Dispatch**: write `data/<id>/brief.md` (self-contained: intent,
   constraints, verify commands, "commit on a branch cap/<id>, never push,
   never merge"); `bin/cap-spawn.sh`. Ship-task briefs end with: run nothing
   destructive; the pipeline lands your work.
5. **Waking**: when `cap-watch` queues a wake — `cap-state` first; crewmate
   `done` on a ship task → `greenlight run --branch cap/<id> --intent
   "$(cat data/<id>/brief.md)"` (full review — crewmate work is un-planned;
   plan-batch lanes pass `--skip review`); parked greenlight → surface the
   findings to the owner verbatim; scout done → read the report, summarize
   in 3 lines.
6. **Owner interaction rules**: batch questions; never block on one task
   while others can advance; `status` = the fleet table; every landed/parked
   event already ntfy'd by greenlight — don't repeat pings.
7. **Boundaries**: plan-shaped batches go to the orchestrate skill (invoke
   it), not hand-rolled here; never edit skills from worktrees; deploys stay
   owner-run on the main checkout; one greenlight land at a time (it locks
   the main checkout by design).

Seed `data/projects.md` (personal-stuff + printing-press library rows:
path, default lane, test command) and `data/rules.md` (two starter rules:
`plan-batch → antigravity`, `scout/research → claude-headless sonnet`).

**Verify**: `grep -c "propose" tooling/captain/CLAUDE.md` ≥ 1;
`test -s tooling/captain/data/projects.md` → exit 0

### Step 4: Self-test

`test-captain.sh`: stub `wt`, `tmux`, `claude`, `greenlight` on PATH +
`CAP_LAUNCH_CMD=echo`. Assert: (a) spawn writes meta + calls lane dispatch
with the brief; (b) duplicate id refused; (c) spawn without a brief fails
loudly; (d) cap-state reports `done` when the stub marks turn-ended and
not-busy; (e) teardown refuses while stub reports busy, succeeds with
`--force`, returns the lease (stub `wt` records the call); (f) wake-queue
gets exactly one line per state change (absorb rule: no line while stub
reports busy); (g) antigravity lane's alive check uses mtime/git fallback
(stub a stale run-log + fresh file mtime → alive). Print `ALL TESTS PASSED`.

**Verify**: `bash tooling/captain/test-captain.sh` → `ALL TESTS PASSED`, exit 0

### Step 5: README + routing row

README: what the captain is, quickstart (`cd tooling/captain && claude`),
the lane registry contract (three verbs — "adding an executor is one script"),
data/state file map, provenance (adapted from kunchenguid/firstmate; changed:
lane registry + wt stdout-lease instead of pane-cwd polling + Antigravity
lane; dropped: secondmates, away-mode daemon, multi-harness support).
Root `CLAUDE.md` "Find it fast" row:
`| Delegate parallel work across projects (captain) | tooling/captain/README.md |`.

**Verify**: `test -s tooling/captain/README.md` → exit 0;
`grep -c "captain" CLAUDE.md` ≥ 1

## Test plan

Stub-driven self-test (Step 4). Live smoke (real tmux window with
`CAP_LAUNCH_CMD=echo`) is included in the self-test ONLY if tmux is
installed; otherwise skip with a printed `SKIP: tmux not installed` line —
do not install tmux yourself if `brew install tmux` fails.

## Done criteria

- [ ] Self-test `ALL TESTS PASSED`; all scripts pass `bash -n`
- [ ] Lane registry: 3 lane scripts each implementing dispatch/alive/collect
- [ ] CLAUDE.md manual covers all 7 sections; propose-and-confirm routing present
- [ ] `state/` gitignored except `.gitkeep`; `./scripts/check-apps.sh` exit 0

## STOP conditions

- You want to modify `.claude/skills/orchestrate/**` or any existing skill —
  STOP (routing row in root CLAUDE.md is the only existing-file edit).
- The real `claude` binary gets launched during tests (quota) — STOP; stubs
  and `CAP_LAUNCH_CMD=echo` only.
- tmux scripting behaves differently than specced (send-keys/capture-pane
  flags rejected) — STOP and report the tmux version + failing command.

## Maintenance notes

- The lane contract (dispatch/alive/collect) is the extension point — a new
  executor must not require core edits; if it does, the contract is wrong.
- The captain's CLAUDE.md is an operating manual like firstmate's AGENTS.md —
  expect it to grow from real-use corrections, exactly like the repo's other
  memory files.
- Follow-up candidate (deliberately not in this plan): teach orchestrate to
  run batches inside `wt` worktrees and offer /plan-review at its gate.
