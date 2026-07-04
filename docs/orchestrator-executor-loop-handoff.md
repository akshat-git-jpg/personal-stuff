# Orchestrator to executor loop: automated handoff

Handoff doc. Written 2026-07-05 for a fresh session to implement. Captures the design and, more importantly, the reasons behind each choice so the implementer can make correct judgment calls when a detail turns out wrong.

Status: **BUILT 2026-07-05** (orchestrate skill v2.0.0). The open decisions were resolved: (1) one run-log per batch at `plans/runs/<run-id>.md`; (2) on death/BLOCKED — record + surface only, no auto-retry/notify (policy seam left for later); (3) one Sonnet subagent per plan. Additions beyond this doc: full GUI automation for the Antigravity paste (`scripts/ag-handoff.sh`, pinned to "Antigravity IDE"), verification-driven fix-up rounds (max 2, `ROUND N START` markers in the same run-log), and `scripts/runlog-status.sh` (one-line status parse) + `scripts/test-runlog.sh` (invariant tests over fixtures). Implementation lives in `tooling/claude-skills/orchestrate/` (SKILL.md Step 4 + scripts/) and `plans/WORKFLOW.md` ("Run log" section). This doc remains the design rationale.

## Why we are building this

Today the `orchestrate` skill (tooling/claude-skills/orchestrate/SKILL.md) plans a build with the expensive model, then stops at Step 4 and prints a copy-paste prompt. I take that prompt, paste it into Antigravity by hand, watch it work, and come back later to check what happened. Two costs bother me:

1. Token and money cost. Opus is doing the planning, which is where the intelligence is worth paying for. It should not also be re-reading every diff the executor produces. If the expensive model re-ingests the full output of every executed plan, the savings from using a cheap executor mostly disappear. The point of the split is: expensive model plans, cheap executor implements, and only a thin signal comes back.

2. Manual cost. I am the copy-paste robot right now. I move the prompt into Antigravity, wait, and manually inspect whether it finished or died. I want that loop to run without me sitting in the middle of it.

So the goal is a loop where the orchestrator hands a plan to an executor, the executor implements and verifies its own work, and the orchestrator confirms cheaply and moves on, all in one session, without me shuttling text around.

The whole design bends toward one rule: a lot of context flows into the executor, and only a small signal flows back to the orchestrator.

## What is already here

- `tooling/claude-skills/orchestrate/SKILL.md`: the orchestrator skill. Opus plans, writes self-contained plans into `plans/`, and hands off. Step 4 currently ends with a copy-paste prompt for Antigravity, plus an optional "dispatch a cheaper subagent" execute path. Read this first. This handoff extends Step 4, it does not replace the skill.
- `plans/WORKFLOW.md` and `plans/_TEMPLATE.md`: the orchestrator to executor contract. Every plan already carries machine-checkable Done criteria (commands plus expected output) and per-step Verify commands. That is the hook that makes cheap verification possible, so use it.
- `plans/006-orchestrator-workflow.md`: an earlier orchestrator workflow plan. Read it for prior context and reconcile with it rather than duplicating.
- `plans/README.md`: the static plan index with per-plan status (TODO / IN PROGRESS / DONE).

## Decisions locked in this session

### Two pluggable executors, no Gemini CLI

The handoff supports exactly two backends, chosen per plan:

- Antigravity. GUI app, driven by pasting the handoff prompt into its window. Already configured to run fully autonomous (it will not stop mid-task to ask me anything). Uses my Google AI subscription.
- Sonnet. Opus plans, then a Sonnet executor implements. In session this is a subagent dispatched with the Sonnet model.

We considered Gemini CLI and dropped it. It would have been the cleaner pipe (deterministic exit code, no GUI), but I do not want another tool in the mix. Both chosen executors stay inside tools I already pay for and use.

The plan frontmatter should declare which executor runs it, matching the existing habit of tagging pipeline folders with `-antigravity` and `-sonnet` suffixes. Something like `executor: antigravity` or `executor: sonnet`.

### One session, orchestrator waits without burning tokens

I do not want two Claude sessions with a gap between them, because the context gets lost across the boundary. It has to be one continuous session.

The orchestrator should not sit in a foreground sleep (the harness blocks that anyway). Instead it launches a background watcher (a bash process polling for the run-log terminal signal, or an fswatch on the log file) and the harness re-invokes the same session when that process exits. Same context, nothing lost, and close to zero tokens spent during the wait because the model is not taking turns while the executor works.

### A single running log, shaped so a half-death is legible

Not scattered RESULT.md files. All progress accumulates in one ledger per run. The requirement that drove this: if I fire a batch of plans at Antigravity and it finishes plan 1 but dies halfway through plan 2, I need to open one document and see exactly that. Plan 1 done, plan 2 started and never finished.

The shape that makes this work is append-only, with an explicit START line before each plan and a terminal line (DONE or BLOCKED) after it. A plan with a START and no terminal line is one that died or is still in flight. That is the entire recovery check.

```
plans/runs/<run-id>.md          one ledger per batch

## RUN <run-id> executor: antigravity  plans: 001,002,003  planned-at: <SHA>
[10:02:14] RUN START
[10:02:15] PLAN 001 START
[10:05:40] PLAN 001 DONE  verify: build PASS, playwright 12/12  files: a.tsx, b.ts
[10:05:41] PLAN 002 START
[10:07:03] PLAN 002 HEARTBEAT        touched periodically while working
                                     no DONE line below means it died at or after here
```

Reading rule for recovery: find the last `PLAN NNN START` with no matching DONE or BLOCKED. That is where it died. Everything above it with a DONE is safe. Resume from that plan.

Verify results live inside each DONE line, so the ledger doubles as the result record and stays one document. `plans/README.md` remains the static index. The executor flips its status cell at completion, but the live blow-by-blow goes to the run-log.

### Token-light verification, layered

The executor self-verifies first (its own build then Playwright then fix loop, ending by writing its verify results into the DONE line). The orchestrator's check is a cheap, independent second gate, not the primary one. Three tiers, picked by what the plan produces:

1. For code: after the run-log signals done, the orchestrator runs the plan's own Done-criteria commands (build, tsc, playwright test) and reads only the exit code and last error line. It actually verifies rather than trusting a self-report, at about one command's worth of output. The commands already exist in the plan, so nothing new to invent.
2. For content with no tests: a structural check. File exists, non-empty, has the required sections or headings, word count in range, JSON validates against a schema. Confirms the artifact is well-formed without reading and judging the prose.
3. For subjective quality: dispatch a cheap subagent to read the full artifact and return only a verdict, PASS or FAIL plus up to three issues. The heavy read happens in the subagent's context, so the orchestrator session stays thin.

## How each executor drives the loop

The two backends are asymmetric on purpose, because one gives a process signal and one does not.

Sonnet path (deterministic). The orchestrator dispatches one Sonnet subagent per plan and checkpoints between them. The subagent appends `PLAN NNN START`, does the work, self-verifies, appends DONE, and returns. The orchestrator (still alive) runs the cheap Done-criteria gate, then dispatches the next plan. If a subagent dies, the orchestrator knows at once because the harness surfaces it, and the log shows the last clean plan. Recovery here is nearly free.

Antigravity path (no process signal). I paste the batch once and it works through all the plans unattended, appending START, HEARTBEAT, and DONE per plan. Because a GUI app emits no completion event, death detection leans on two things: a final `RUN DONE` sentinel as the success signal, and a heartbeat plus timeout. If the log goes stale for N minutes with no `RUN DONE`, the watcher declares it dead and reads the log to see how far it got. This is the path where the single-log design earns its keep, because the log is the only visibility I have into a GUI agent.

Both write the identical log format, so I always check one document regardless of which executor ran.

## Open decisions (resolve these in the new session)

These were asked but not answered. My recommendation is given for each so you have a sensible default.

1. Run-log scope. One ledger per run at `plans/runs/<run-id>.md` (my recommendation, stays small, one file per batch, easy to archive), or one global ever-appending document. I said "single doc"; confirm whether that means one-per-batch or one-forever.

2. What the orchestrator does on a detected half-death (a plan died or went BLOCKED):
   - (a) stop and ping me over ntfy or Telegram with "got through 001, 002 died here". Safest, I decide.
   - (b) retry the failed plan once, then stop if it fails again.
   - (c) auto-resume from the failed plan without asking.
   My lean: (a) for Antigravity, since a GUI death usually means something real needs my eyes, and (b) for Sonnet, since transient failures are common and cheap to retry.

3. Sonnet granularity. One subagent per plan with the orchestrator keeping control between plans (my assumption, best recovery), or one subagent that swallows the whole batch. Confirm.

## What to change in the code

- `tooling/claude-skills/orchestrate/SKILL.md`, Step 4. Add the automated handoff: emit the run-log convention, pick the executor from the plan frontmatter, and wire the wait-then-verify loop. Keep the existing copy-paste prompt as a fallback.
- Add the run-log format to `plans/WORKFLOW.md` (or `_TEMPLATE.md`) so both executor paths and every future plan write it identically. This is the contract that makes the single log reliable.
- The handoff prompt the executor receives must instruct it to: write `PLAN NNN START` before each plan, touch a HEARTBEAT periodically, write DONE with verify results or BLOCKED with the reason after each plan, and write `RUN DONE` at the end.
- Build the watcher plus verification wiring (background bash that waits for `RUN DONE` or a stale-heartbeat timeout, then hands control back to the orchestrator, which runs the tiered verification).

## Constraints and gotchas

- The `orchestrate` skill is symlinked into both the work and personal accounts from `tooling/claude-skills/`. Edit only the source here, never a symlinked copy. After editing, run `scripts/relink.sh` and restart the session, since skill discovery is cached.
- Do not modify any `superpowers:*` skill. The orchestrate skill composes brainstorming by invoking it, and a fork would be clobbered on update.
- Antigravity gives no completion event and no exit code. The run-log plus heartbeat plus timeout is the only way to tell "still working" from "died". Do not assume a missing RESULT means still running.
- A single blocking bash call is capped (max ten minutes here), so do not build the wait as one long foreground call. Use the background-watcher plus re-invoke pattern instead.
- A cheerful DONE line can lie. That is why the orchestrator re-runs the plan's Done-criteria itself rather than trusting the executor's self-report.
- There are two Antigravity installs on this machine (`Antigravity.app` and `Antigravity IDE.app`). Pin which one the GUI automation drives.
- Antigravity has no CLI. Driving it means GUI automation (clipboard set with pbcopy, then focus the window, then Cmd+V, then Enter). Clipboard plus Cmd+V is more robust than typing for large prompts.
- Repo rule: skip formal TDD here, write working code with manual smoke tests. But a generic layer like this handoff engine wants invariant tests that loop over both executor paths and the log parser, so a new plan or executor cannot silently break recovery.

## How to start the new session

Point the fresh session at this doc plus `tooling/claude-skills/orchestrate/SKILL.md`, `plans/WORKFLOW.md`, and `plans/006-orchestrator-workflow.md`. Resolve the three open decisions first, then implement the code changes above. Test the recovery path deliberately: run a batch, kill it mid-plan, and confirm the orchestrator reads the run-log and identifies the exact plan that died.
