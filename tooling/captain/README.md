# captain

A multi-session orchestrator: one Claude Code session the owner talks to
that runs many tasks across projects in parallel, watches them token-free,
lands finished work through `greenlight`, and asks the owner only what
needs the owner.

## Quickstart

```bash
cd tooling/captain && claude
```

That session reads `CLAUDE.md` in this folder and becomes the captain. It
starts by running `bin/cap-session-start.sh` (fleet digest + wake-queue
drain), then takes the owner's next ask.

## The lane registry

A lane is one executable in `lanes.d/` implementing three verbs:

```
<lane>.sh dispatch <task-id> <brief-path>   # start the work
<lane>.sh alive    <task-id>                # exit 0 working, 1 finished/silent, 2 dead
<lane>.sh collect  <task-id>                # print "done|blocked|dead <detail>"
```

Task metadata is read from `state/<task-id>.meta`. **Adding an executor is
one script — no core change.** Ship a new `lanes.d/<name>.sh` implementing
the three verbs and it's usable via `cap-spawn.sh <id> <project> --lane
<name>`.

Shipped lanes:

- **claude-tmux** — an interactive Claude Code session in a tmux window
  (`captain` session, `cap-<id>` window). Liveness = pane busy-regex match
  (`esc (to )?interrupt|Working\.\.\.`). Done = pane idle AND its Stop-hook
  turn-ended marker is newer than dispatch.
- **claude-headless** — a backgrounded `claude -p ... --output-format json`
  run. Liveness = `kill -0 <pid>`. Done = `.result` present in the captured
  output.
- **antigravity** — a GUI handoff via the `orchestrate` skill's
  `ag-handoff.sh`. Antigravity skips run-log heartbeats on long GUI runs
  (`plans/runs/LESSONS.md`, 2026-07-05), so liveness trusts worktree file
  mtimes and git-log timestamps over the run-log's own mtime.

## Task lifecycle scripts (`bin/`)

- `cap-spawn.sh <id> <project-path> --lane <lane> [--model <m>] [--effort <e>]`
  — leases a worktree via `wt`, writes `state/<id>.meta`, calls the lane's
  `dispatch`. Refuses a duplicate id or a missing `data/<id>/brief.md`.
- `cap-state.sh [<id>]` — `id lane state detail` for one or all tasks. A
  live lane check always beats a stale status-log line.
- `cap-send.sh <id> "<text>"` — send a line into an interactive
  (claude-tmux) task. Other lanes: `lane not interactive`.
- `cap-teardown.sh <id> [--force]` — refuses while working (unless
  `--force`); warns instead of losing unlanded commits on `cap/<id>`; kills
  the tmux window; returns the `wt` lease; archives state into
  `state/archive/`.
- `cap-watch.sh` — background 30s liveness loop; queues a line in
  `state/.wake-queue` on a state change, but only when the lane does NOT
  show positive evidence of ongoing work (the absorb rule). Never calls a
  model. `CAP_WATCH_ONCE=1` runs a single pass (used by the self-test).
- `cap-session-start.sh` — reconciles dead tmux windows against known
  tasks, drains the wake-queue, prints the fleet table + backlog + parked
  `greenlight` runs.

## Data & state file map

- `data/projects.md` — known projects: path, default lane, test command.
- `data/rules.md` — routing rules (task shape → lane + model),
  append-only once the owner confirms a novel routing.
- `data/backlog.md` — owner-visible backlog (optional; printed at session
  start if present).
- `data/<id>/brief.md` — self-contained crewmate brief (spawn precondition).
- `data/<id>/report.md` — scout-task output.
- `state/` — machine-local, gitignored except `.gitkeep`.
  `<id>.meta` (lane/project/worktree/model), `<id>.status` (append-only
  log), `<id>.turn-ended` (claude-tmux marker), `<id>.out`/`pid=`
  (claude-headless), `.wake-queue`, `<id>.last-seen`, `archive/`.

## Self-test

```bash
bash tooling/captain/test-captain.sh
```

Stubs `wt`, `tmux`, `claude`, `greenlight` on `PATH` and sets
`CAP_LAUNCH_CMD=echo` — the real `claude` binary is never launched. Asserts
spawn/duplicate-refusal/missing-brief/state/teardown/wake-queue/antigravity-
fallback behavior, then prints `ALL TESTS PASSED`. If `tmux` is actually
installed, it also runs a live smoke test (a real tmux window driven
end-to-end with `CAP_LAUNCH_CMD=echo`, under a throwaway session name so it
can't collide with a real `captain` session) — otherwise it prints `SKIP:
tmux not installed` and exits 0.

## Design provenance

Adapted from `kunchenguid/firstmate` (studied 2026-07-06).

- **Kept**: the captain IS an agent session whose manual is a CLAUDE.md;
  tmux windows as addressable crewmate containers; Stop-hook turn-end
  markers; append-only status logs; "absorb a wake only on positive
  evidence of work."
- **Changed**: a pluggable lane registry instead of a fixed executor set
  (owner requirement, 2026-07-06 — adding an executor is one script, no
  core change); propose-and-confirm routing instead of silent guessing;
  Antigravity as a first-class cheap lane; `wt`'s stdout-path lease instead
  of pane-cwd polling (simpler, race-free).
- **Dropped**: secondmates, the away-mode daemon, multi-harness support.

## Follow-up (not in scope here)

Teach the `orchestrate` skill to run plan-batches inside `wt` worktrees and
offer `/plan-review` at its gate.
