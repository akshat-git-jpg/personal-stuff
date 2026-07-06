# Cross-run executor lessons

Append-only, one line per non-obvious lesson learned from a run — recurring
executor mistakes, plan-shape fixes that prevented them, quirks. The
orchestrator reads this during recon (orchestrate Step 2) and writes to it
after verification (Step 4d), so every batch compounds instead of
rediscovering failure modes through fix-up rounds.

Format: `YYYY-MM-DD <executor> — <lesson>`

## Lessons

2026-07-05 antigravity — first block was a PLAN defect, not an executor one: specced yt-dlp subtitle fetching with `--sub-langs "en.*,en"`, which bursts a request per auto-translated variant and self-inflicts HTTP 429. Recon should check `tooling/cli/` for an existing fetcher (pp-yt-transcript) before speccing new fetch code.
2026-07-05 loop — watch-run.sh/runlog-status.sh used to grep the whole log, so a round-1 BLOCKED false-alarmed every later round; both are now active-segment-aware (after last `ROUND N START`) and the ORCHESTRATOR must append the round marker at dispatch. Regression fixtures: `scripts/fixtures/round2-*.md`.
2026-07-05 antigravity — behaved well under fix-up: honored STOP condition literally, kept scope exactly to plan file lists, resumed cleanly from a revised plan when told to re-read it as source of truth.
2026-07-05 antigravity — ignores run-log discipline on long GUI runs (no heartbeats, DONE lines late or never) even when the prompt demands them; watcher exit 3/4 is unreliable for it. Verify liveness via file mtimes + git log, size the staleness window generously, and treat commits as the real completion signal.
2026-07-05 antigravity — leaves debug dumps in the working tree (session traces, prompt copies, scratch SQL); sweep untracked files at verification before declaring the tree clean.
- 2026-07-05 (workflow-audit run): a "baseline already red" STOP can be caused by the very defect the plan fixes (stale KNOWN_FAILING mask) — plans that edit verification config must state which pre-existing failure is EXPECTED and carve it out of the STOP condition.
- 2026-07-05 (workflow-audit run): guard-test synthesis must derive the schema FROM the engine (assembleRow), never re-implement slot/column rules in the test — the re-implementation drifted from activeSlots() and produced a false-positive BLOCKED round.
- 2026-07-05 (workflow-audit run): the dispatch prompt must explicitly instruct the executor to `git add` the plan documents + prompt file themselves — executors stage only what the per-plan scope lists, so orchestrator-authored docs stay untracked otherwise.
2026-07-06 antigravity — watch-run.sh exited 4 ("never started") while the run was demonstrably alive (PLAN 033 START logged, commits landing); an mtime+git-log watcher over the repo is the reliable wrapper, with run-log lines only as positive signals, never as absence-evidence.
2026-07-06 antigravity — CORRECTED root cause (owner screenshot next morning): the mid-036 stall was NOT quota death — Antigravity was waiting on a GUI permission dialog ("Allow write access to this path?") because the plan's smoke test wrote OUTSIDE the workspace (~/kb-scratch/). All quota meters were at 100%. Two standing fixes: (1) plans executed by Antigravity must keep every write inside the repo, or the dispatch prompt must warn the owner a permission dialog will appear; (2) before declaring a stalled Antigravity dead, inspect its window (accessibility UI text) — a permission modal produces zero file activity and is indistinguishable from death by mtime signals alone. Also still true: it left an uncommitted partial edit plus a premature edit for a LATER plan (037's CLAUDE.md row) — inspect uncommitted diffs for cross-plan contamination before continuing.
2026-07-06 sonnet — resume prompts must say "branch from the current branch" not a literal branch name: a stale literal name from the batch template confused the 038 handoff (executor correctly deviated, but flagged it). Sonnet subagents otherwise kept perfect run-log discipline and surfaced honest deviations — good fallback lane.
