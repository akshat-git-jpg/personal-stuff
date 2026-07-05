Fix-up round for the run logged in
`plans/runs/20260705-0242-competitor-styles.md` (repo
`/Users/kbtg/codebase/personal-stuff`). First append this line to that log,
then proceed:

```
[HH:MM:SS] ROUND 2 START  fixes: plan 012 revised — transcripts now via pp-yt-transcript, not yt-dlp subtitles (429 root cause)
```

## What happened

Plan 012 blocked at Step 3: the previous ingest.py fetched subtitles through
yt-dlp with `--sub-langs "en.*,en"`, which requests every auto-translated
English variant per video and self-inflicts HTTP 429. The orchestrator has
REVISED `plans/012-competitor-styles-ingest.md` — re-read the whole plan file
now; it is the single source of truth and supersedes the code you wrote in
round 1.

## What to do

1. Append the ROUND 2 START line, then `PLAN 012 START` (fresh timestamps).
2. Overwrite BOTH files you created in round 1 with the revised plan's
   content, exactly as specified there:
   - `pipelines/youtube/competitor-styles/ingest.py` (Step 2 — transcripts now
     come from `tooling/cli/youtube/pp-yt-transcript` via subprocess; there is
     no clean_vtt function anymore)
   - `pipelines/youtube/competitor-styles/CLAUDE.md` (Step 1 — the Commands
     paragraph changed)
3. Resume the plan from its Step 2 verify (`py_compile`), then Step 3 (smoke
   test — the orchestrator verified pp-yt-transcript works from this machine
   just now), Step 4, Done criteria, README status flip.
4. Then execute `plans/013-yt-style-skill.md` unchanged, per the original
   batch prompt (`plans/runs/20260705-0242-competitor-styles.prompt.md`) —
   same branch `advisor/012-competitor-styles`, same run-log format, commit
   per stage by explicit path only, never `git add -A`, do not push.
5. Finish with `RUN DONE` as the final log line (or `PLAN NNN BLOCKED: reason`
   and stop).

All round-1 rules still apply: honor STOP conditions literally, cap self-fix
attempts at 5 per plan, heartbeat at least every 3 minutes, no AI footers in
commits, don't re-litigate decisions recorded in the plans.
