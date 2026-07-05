# Executor handoff — agentic-workflow batch (plans 033 → 034 → 035 → 036 → 037 → 038)

You are the executor for six implementation plans in
`/Users/kbtg/codebase/personal-stuff`. Work them **strictly in this order**:

1. `plans/033-worktree-pool-manager.md`
2. `plans/034-greenlight-validation-pipeline.md`
3. `plans/035-overnight-capped-loops.md`
4. `plans/036-plan-review-skill.md`
5. `plans/037-captain-orchestrator.md`
6. `plans/038-printing-press-axi-alignment.md`

## Ground rules (non-negotiable)

- **Read each ENTIRE plan file first**, including its executor-instructions
  header, before touching anything. The plan is the source of truth; this
  prompt only sequences the batch.
- **Run each plan's drift check before starting it.** Unexpected drift →
  write `BLOCKED: drift — <detail>` to the run-log and STOP the run.
- **Commit per step** using each plan's Git workflow section (its branch
  name, its commit style, no AI footers). After finishing a plan, merge its
  branch into the batch's working branch line by continuing work on top —
  do NOT delete plan branches.
- **Run every Verify command** and confirm the expected result before moving
  to the next step. Run each plan's Done criteria before declaring it done.
- **Self-fix cap: 5 attempts per plan.** If Done criteria still fail after 5
  fix attempts, write `BLOCKED: done criteria unreachable after 5 attempts`
  to the run-log and STOP the whole run. Never loop past the cap.
- **Honor every STOP condition literally** — stop and report, do not work
  around.
- **Never push. Never run the real `claude` binary** (all tests use stubs /
  `CAP_LAUNCH_CMD=echo` as the plans spec). Never create or merge branches
  other than the plans' own `advisor/03X-*` branches. Never touch
  `.claude/settings.json`.
- **`git add` the run-log and any files you create under `plans/runs/`
  yourself** when committing — orchestrator-authored docs must not stay
  untracked.

## Run-log discipline

Append to `plans/runs/20260706-0325-agentic-workflow.md`:

- `[HH:MM:SS] PLAN NNN START` before each plan
- `[HH:MM:SS] HEARTBEAT <one-line status>` at least every 3 minutes while working
- `[HH:MM:SS] PLAN NNN DONE  verify: <one-line results>  files: <changed files>`
  after each plan's Done criteria pass
- `[HH:MM:SS] BLOCKED: <reason>` then STOP the run, if blocked
- `[HH:MM:SS] RUN DONE` as the final line after plan 038

Update each plan's row in `plans/README.md` (TODO → DONE, or BLOCKED with a
one-line reason) as you finish it.

## Load-bearing decisions (already made — do not re-litigate)

- Worktrees are lease-only via `wt`; no PID tracking, no daemon (033).
- greenlight lands by merging to local main AND pushing origin/main **at
  runtime** — but YOU never push while building it; the self-test uses a
  stub remote (034).
- Reviewer model defaults to sonnet; `--skip review` is a first-class path (034).
- High-risk always parks — hard-coded, not configurable (034).
- The agent in overnight loops is FORBIDDEN to commit; the orchestrator
  commits (035).
- 036 adopts `lavish-axi` via `npx -y` — do not vendor it.
- The captain's lane contract is dispatch/alive/collect, one script per lane;
  core must not special-case lanes (037).
- 038 edits skill REFERENCES only; the Go module cache is read-only; no
  cloning upstream.

## Human-only preconditions

None — no secrets, no pushes, no deploys are needed to complete this batch.
If tmux is absent and `brew install tmux` fails (037), print the SKIP line as
the plan specs rather than blocking.
