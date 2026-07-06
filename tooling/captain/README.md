# captain

A multi-session orchestrator: one Claude Code session the owner talks to
that runs many tasks across projects in parallel, watches them token-free,
lands finished work through `greenlight`, and asks the owner only what
needs the owner.

## Quickstart

```bash
captain-work        # or: captain-personal  (zshrc functions — opus default,
                    # skip-permissions, the account flows to crewmates)
```

That session reads `CLAUDE.md` in this folder and becomes the captain. It
starts by running `bin/cap-session-start.sh` (captain lock check, fleet
digest, wake-queue drain, orphaned-run scan), then takes the owner's next
ask. **One captain at a time**, either account — they share `state/`.

## The model (v2, 2026-07-06): workers and officers

Every unit of work is a crewmate; the captain only talks, routes, and
supervises. **Workers** = small clear-scope tasks → `greenlight` FULL review.
**Officers** = one per big feature: a long-lived session in its own worktree
that runs the `orchestrate` skill itself (recon → plans → the owner's
/plan-review gate → execution → verification), spawned from
`references/officer-brief-template.md` with the captain-brainstormed
requirements brief pasted in → lands via `greenlight --skip review`.
Officers parallelize (2–3 features in flight is the designed case); only the
owner's attention and the Antigravity IDE lane serialize. Officers' default
executor is **`agy`** (Antigravity CLI — same AI Pro sub, headless, no
lock, per-call model choice incl. Claude 4.6). The IDE lane is for
GUI-assisted work only and needs `bin/cap-aglock.sh` — a GLOBAL lock that
also steers the main checkout onto the executing branch.

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
  mtimes and git-log timestamps over the run-log's own mtime. Plan-batch
  execution on this lane requires `bin/cap-aglock.sh` (see above). Beware:
  a write outside the workspace pops a GUI permission dialog that looks
  exactly like death (2026-07-06 incident) — check the IDE window before
  declaring a task dead.
- **agy-headless** — officers' default executor: a backgrounded
  `agy -p ... --dangerously-skip-permissions --add-dir <worktree>
  --output-format json --print-timeout 180m` run (Antigravity CLI, same AI
  Pro sub as the IDE). Real process: PID liveness, JSON envelope with token
  usage + `conversation_id` (fix-ups resume with full context via
  `--conversation`), no permission dialogs, no lock — fully parallel.
  Default model Gemini 3.1 Pro (High); per-call `--model` incl. Claude
  Sonnet/Opus 4.6. agy reads AGENTS.md not CLAUDE.md — the repo ships an
  `AGENTS.md -> CLAUDE.md` symlink; `.agents/hooks.json` runs a
  secrets-guard hook denying reads of secret paths (live-verified).
  Replaced gemini-headless after Google cut that CLI off from individual
  accounts (2026-06-18) — `references/antigravity-cli-findings.md`.

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
- `cap-session-start.sh` — captain-lock check (warns if another captain
  session looks live), reconciles dead tmux windows, drains the wake-queue,
  prints the fleet table + backlog + in-flight/orphaned orchestrate runs +
  parked `greenlight` runs.
- `cap-aglock.sh acquire <id> <branch> | release <id> | status` — the global
  Antigravity execution lock; acquire steers the main checkout onto the
  officer's branch, release restores it.

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
- **Dropped in v1**: secondmates, the away-mode daemon, multi-harness
  support. **v2 (same day) added officers** — secondmates by another name,
  earned once the owner hit the 3-parallel-features wall v1 serialized.

## Follow-up (not in scope here)

Teach the `orchestrate` skill to run plan-batches inside `wt` worktrees and
offer `/plan-review` at its gate.
