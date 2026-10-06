# Standalone direct-dispatch (Step 4, repos without boss)

Contents
- Executor registry
- 4a — Start the run
- 4b — Dispatch and wait
- 4c — Wake up and verify
- 4d — Fix-up rounds (max 2)
- 4e — On death or BLOCKED

For a repo *without* boss (boss is personal-stuff-only for now): you dispatch and watch the
executor yourself. The governing rule: a lot of context flows INTO the executor; only a thin
signal flows back. You never re-read executor diffs — verification is exit codes, structural
checks, and one-line verdicts. Scripts live in `../scripts/`.

## Executor registry

Pick the executor from each plan's `Executor:` field (ask the user if plans in one batch
disagree). Adding a future executor = one new row here + optionally one dispatch script; the
run-log, verification, and rounds are executor-agnostic. Model choice follows
`tooling/boss/data/rules.md` or the user — never a unilateral pick.

| Executor | Dispatch | Completion signal | Death detection |
|---|---|---|---|
| `antigravity` | `scripts/ag-handoff.sh <prompt-file>` (pbcopy → focus → Cmd+V → Enter; `AG_APP` defaults to "Antigravity IDE") | `RUN DONE` in the run-log, via `scripts/watch-run.sh` | heartbeat staleness (default 10 min) — a GUI app emits no process signal |
| `sonnet` | one Agent-tool subagent **per plan**, `model: sonnet`; orchestrator checkpoints between plans | subagent returns + run-log `PLAN NNN DONE` | harness surfaces a dead subagent immediately |
| `opus` | one Agent-tool subagent **per plan**, `model: opus` — for `tricky` plans only | same as `sonnet` | same as `sonnet` |
| `agy` | background Bash per plan: `agy -p "$(cat <prompt-file>)" --dangerously-skip-permissions --add-dir "<working-tree>" --output-format json --print-timeout 180m [--model "<name>"]` with cwd = the working tree (`--add-dir` is mandatory — print mode does not bind cwd; default timeout is 5m); prompt carries the same run-log rules | process exit + run-log `PLAN NNN DONE`; JSON envelope in the captured file has `status`/`usage`/`conversation_id` (resume fix-ups via `--conversation <id>`) | `kill -0 <pid>` — a real process, exact liveness (no heartbeat guessing) |
| `codex` | background Bash per plan: `codex exec "$(cat <prompt-file>)" --json -o <last-msg-file> --dangerously-bypass-approvals-and-sandbox -C "<working-tree>" -m <model> < /dev/null` wrapped in `gtimeout -k 30 180m` (codex exec has no timeout flag of its own); `-C` is mandatory and `< /dev/null` is mandatory — without it codex waits on stdin forever | process exit code + run-log `PLAN NNN DONE`; the JSONL stream carries `thread.started` (`thread_id`, for `codex exec resume`) and `turn.completed` (`usage`) | `kill -0 <pid>` — a real process, exact liveness |

Notes:
- **Antigravity's internal model is set in the app's own model picker** — the skill cannot
  select or verify it. Antigravity runs on its own subscription, so it's the cheapest choice
  for mechanical batches; `sonnet`/`opus` subagents share the Claude usage pool.
- **`agy` (added 2026-07-06)**: the Antigravity CLI — same engine and subscription as the
  Antigravity IDE, but a real headless process: no GUI permission dialogs, exact death
  detection, parallelizes (per-worktree cwd, no shared IDE workspace), per-call model choice
  (`agy models` — a capability, not a license to pick a model). Prefer it over the
  `antigravity` IDE row for headless plan batches. (The gemini CLI is dead for individual
  accounts since 2026-06-18 — do not spec it.)
- **`codex` (added 2026-08-25)**: the OpenAI Codex CLI on the owner's ChatGPT subscription
  (`auth_mode=chatgpt`), so like agy its tokens do not touch the Claude pool. Real headless
  process, exact death detection, parallelizes per worktree. Its `--json` stream grows
  continuously while the crew works, which makes progress/stall detection honest without an
  `lsof`. Two hard flags: `-C` (the working root is NOT bound by cwd) and `< /dev/null`
  (otherwise it blocks reading stdin). A valid option, never the default (rules.md).
- **One run at a time.** Runs share one working tree and git history — never dispatch a second
  run (any executor) while one is in flight.

## 4a — Start the run

1. Run-id: `<YYYYMMDD-HHMM>-<slug>`. Create `plans/runs/<run-id>.md` containing only the
   header line (format in `plans/WORKFLOW.md` → "Run log"). The executor appends everything
   else.
2. Build the handoff prompt and save it to `plans/runs/<run-id>.prompt.md` (it's the record of
   what was dispatched). The prompt must tell the executor to:
   - read each whole plan first (including its executor-instructions header),
   - run the **drift check** before starting,
   - work plans/steps in order and **commit per stage** (rollback granularity),
   - run every **Verify** and confirm before continuing,
   - **cap self-fix attempts at 5 per plan** — if Done criteria still fail after 5 fix
     attempts, write `BLOCKED: done criteria unreachable after 5 attempts` and stop. Never loop
     indefinitely: a busy loop keeps emitting heartbeats, so it looks alive to the watcher while
     burning budget,
   - honor **STOP conditions** literally (stop and report, don't work around),
   - **write the run-log**: `PLAN NNN START` before each plan, a `HEARTBEAT` line at least
     every 3 minutes, `DONE` with verify results + changed files (or `BLOCKED: reason`, then
     STOP the whole run), and `RUN DONE` as the final line,
   - update each plan's `plans/README.md` row when done,
   - **not push** unless the user says so.

   Also restate the load-bearing decisions the executor must not re-litigate (chosen
   libraries, naming, scope boundaries) and any human-only preconditions (secrets, a decision,
   an SSH/push step).

## 4b — Dispatch and wait (token-free)

**One human gate, placed here.** Before dispatching, show the user the batch in one glance:
plans, routing (executor per plan), run-id. This is the checkpoint where a wrong direction
would invalidate everything downstream — gate here, and don't add approval gates anywhere
later in the loop.

Never wait in a foreground sleep — a single blocking bash call is capped. Per executor:

- **antigravity**: run `scripts/ag-handoff.sh <prompt-file>`, then launch
  `scripts/watch-run.sh <run-log> [timeout-min]` as a **background** Bash task. The session
  idles at ~zero token cost (no model turns) until the watcher exits: `0` = RUN DONE,
  `2` = BLOCKED, `3` = stale/dead, `4` = never started.
- **agy / codex**: launch the registry command as a **background** Bash task (one per plan,
  sequentially — one run at a time) and record its pid. You are woken when the process exits;
  check liveness meanwhile with `kill -0 <pid>`. Then verify (4c) before dispatching plan N+1.
  For agy, judge by commits/files, never by the JSON envelope alone — a 0-token SUCCESS
  envelope is a failure (rules.md rider).
- **sonnet / opus**: dispatch the subagent for plan N with the plan path + run-log
  instructions; it self-verifies, appends its log lines, returns a thin report. Verify (4c)
  before dispatching plan N+1.

## 4c — Wake up and verify (cheap, layered)

First run `scripts/runlog-status.sh <run-log>` — one line tells you done / blocked /
dead-at-plan. Then a **scope check**: `git diff --stat <planned-at SHA>..HEAD` file names must
be a subset of the batch's in-scope lists — catches an executor that "helpfully" touched
out-of-scope files even when tests pass. Then a **punt-marker grep** over the landed diff:
stream-of-consciousness comments ("wait", "actually,", "let's just", "we can't easily",
"TODO/FIXME") mark exactly where the executor hit a requirement it couldn't satisfy and quietly
downgraded it — read those sites before trusting any green gate (2026-07-31: a data-loss punt
announced itself this way while 456 tests passed). Then verify by what each plan produces:

1. **Code** → re-run the plan's own **Done criteria** commands; read only exit codes + the last
   error line. A cheerful `DONE` line can lie; the commands don't.
2. **Content with no tests** → structural check only: file exists, non-empty, required
   sections present, JSON validates. Don't read and judge the prose.
3. **Subjective quality** → dispatch ONE cheap subagent to read the artifact and return only
   PASS/FAIL + up to 3 issues, **scored against the plan's rubric** (readiness gate item 4).
   The heavy read happens in the subagent's context, not yours.

## 4d — Fix-up rounds (max 2)

If verification finds real gaps (failed Done criteria, verdict issues): write a **small fix-up
prompt** — the issues list + pointer back to the plan + run-log instructions. **Append the
`[HH:MM:SS] ROUND N START  fixes: <summary>` line to the run-log YOURSELF, at dispatch time** —
never delegate the marker to the executor. The watcher and `runlog-status.sh` treat everything
after the last round marker as the run's active state, so writing it before dispatch is what
prevents them from misreading the previous round's BLOCKED/RUN DONE lines (a live false-alarm
failure mode, fixed 2026-07-05; regression fixtures in `scripts/fixtures/round2-*.md`). Same
run-log, same dispatch mechanism. **Cap: 2 fix-up rounds**, then stop and surface to the user —
an executor failing twice on the same issue needs human eyes, not more tokens.

**Learn from the run.** After verification (pass or fail), if the run taught something
non-obvious about an executor or the loop — a recurring mistake, a plan-shape fix that
prevented one, a quirk — append ONE line per lesson to `plans/runs/LESSONS.md`
(`YYYY-MM-DD <executor> — <lesson>`). Step 2 reads this file, so lessons compound into better
plans instead of repeat fix-up rounds. Skip the obvious; an empty run teaches nothing and gets
no line.

## 4e — On death or BLOCKED

No auto-retry, no auto-notify (deliberate — policy seam for later). Read `runlog-status.sh`
output + the last few log lines, report to the user exactly how far it got ("001 done and
verified; 002 started 10:05, died at step 2"), and wait for their call. Everything above a
`DONE` line is safe; recovery resumes from the dead plan.

**Fallback:** if the user prefers, or `ag-handoff.sh` fails (no Accessibility permission), stop
at the plan and produce the copy-paste handoff prompt — the prompt content is identical, only
the paste is manual. The watcher + verify loop still runs.
