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
