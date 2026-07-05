# Orchestrator-Executor Workflow

This repository uses a two-role workflow to plan, implement, and review codebase changes: an **Orchestrator** model/role and an **Executor** model/role.

## The Role Split
1. **Orchestrator**: A high-capability, high-ceiling model (e.g., Claude 3 Opus/Fable via Claude Code) that handles codebase audits, architecture design, writing implementation plans, and conducting final diff reviews.
2. **Executor**: A faster, cheaper model/agent (e.g., Antigravity, Sonnet) that implements exactly one plan at a time. The executor is focused entirely on execution.

Plans must be written so they are executable with **zero context** beyond the plan file itself and the repository content.

---

## Plan Lifecycle
1. **Finding**: A codebase gap, security issue, or feature request is identified.
2. **Planning**: The orchestrator drafts a plan file in `plans/NNN-slug.md` (using `plans/_TEMPLATE.md`) and registers it in the `plans/README.md` status table as `TODO`.
3. **Execution**: The executor takes the plan, marks the row as `IN PROGRESS`, performs the steps, and updates the status to `DONE` (or `BLOCKED: reason` if blocked).
4. **Review**: The orchestrator (or repo owner) reviews the git diff against the plan's Done criteria before merging.
5. **Rejection**: If a planned change is decided against, the plan is marked `REJECTED: reason` in the status table and closed.

---

## Rules for Executors
* **Run the drift check first**: Verify that files to be modified haven't drifted from the base commit specified in the plan.
* **Run every verification**: Do not skip compile/test verification steps.
* **Respect the boundaries**: Do not modify files that are explicitly designated as out of scope.
* **Stop on STOP conditions**: Stop and report immediately if any STOP condition is met; do not improvise or proceed.
* **Report plainly**: Summarize changes, validations, and failures clearly without verbose fluff.

---

## Rules for Orchestrators
* **Self-contained plans**: Inline relevant code excerpts, file links, and exact commands so the executor doesn't have to search/guess.
* **Verification story**: Every plan must include explicit test plans or automated/manual verification steps.
* **Durable backlog**: Record audit findings not immediately planned in the `plans/README.md` backlog section to prevent duplicate audits.

---

## Run log (execution ledger)

Every automated execution run writes ONE append-only ledger: `plans/runs/<run-id>.md`, where a **run** is one batch of plans handed to one executor and `<run-id>` is `<YYYYMMDD-HHMM>-<slug>`. The orchestrator creates the file with the header line; the executor appends everything else. Both executor backends (Antigravity, Sonnet subagents) write the identical format — recovery always reads one document.

```
## RUN <run-id>  executor: <antigravity|sonnet|opus>  plans: <NNN,NNN>  planned-at: <SHA>
[HH:MM:SS] RUN START
[HH:MM:SS] PLAN NNN START
[HH:MM:SS] PLAN NNN HEARTBEAT <short note>          ← at least every 3 minutes while working
[HH:MM:SS] PLAN NNN DONE  verify: <results>  files: <changed files>
[HH:MM:SS] PLAN NNN BLOCKED: <reason>               ← then stop the run; do not continue
[HH:MM:SS] ROUND 2 START  fixes: <issue summary>    ← appended by the ORCHESTRATOR at dispatch of a fix-up round
[HH:MM:SS] RUN DONE                                  ← success sentinel, always the last line
```

**Reading rule (recovery):** status is always computed on the **active segment** — everything after the last `ROUND N START` marker (whole file if none); earlier rounds' `BLOCKED`/`RUN DONE` lines are history, not current state. Within that segment, the last `PLAN NNN START` with no matching `DONE`/`BLOCKED` line is where the run died or is still in flight. Everything above it with a `DONE` is safe; resume from the dead plan. `scripts/runlog-status.sh` in the `orchestrate` skill folder encodes this rule — one line of output instead of re-reading the log.

**Who writes what:** verify results go inside the `DONE` line (the ledger doubles as the result record). The executor still flips its plan's status cell in `plans/README.md` at completion — the README stays the static index, the run-log is the live blow-by-blow.

**Lessons:** non-obvious cross-run learnings (executor quirks, plan-shape fixes) accumulate one line each in `plans/runs/LESSONS.md`; the orchestrator reads it before planning and appends after verification.

---

## Source of Plans
Plans can originate from automated repo audits (e.g., the `improve` skill), design spikes, or direct instruction from the owner. One plan represents one reviewable and mergeable unit of work.
