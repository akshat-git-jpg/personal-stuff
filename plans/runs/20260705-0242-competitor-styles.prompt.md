You are the executor for a batch of two implementation plans in the repo
`/Users/kbtg/codebase/personal-stuff`. Work them strictly in order:

1. `plans/012-competitor-styles-ingest.md`
2. `plans/013-yt-style-skill.md`

## How to work

- Read each ENTIRE plan file first, including its executor-instructions
  header, before touching anything.
- Run each plan's **drift check** command before starting that plan.
- Do the steps in order. Run every **Verify** command and confirm the expected
  result before moving to the next step.
- Commit per stage (rollback granularity), staging files by explicit path
  only. The tree contains unrelated uncommitted changes (tutorial-pipeline v3
  files) — NEVER `git add -A` or `git add .`, and leave those files exactly as
  they are.
- Branch: create `advisor/012-competitor-styles` from current HEAD for plan
  012; plan 013 continues on the SAME branch (no new branch).
- Honor **STOP conditions** literally: stop and report, do not work around.
- Cap self-fix attempts at 5 per plan. If Done criteria still fail after 5 fix
  attempts, write `BLOCKED: done criteria unreachable after 5 attempts` to the
  run log and stop. Never loop indefinitely.
- Do NOT push. Do not add AI/generator footers to commits.
- When a plan is done, flip its row to `DONE` in `plans/README.md`.

## Run log (append-only ledger)

Append your progress to `plans/runs/20260705-0242-competitor-styles.md`
(it already has its header line). Format, timestamps as [HH:MM:SS]:

```
[HH:MM:SS] RUN START
[HH:MM:SS] PLAN 012 START
[HH:MM:SS] PLAN 012 HEARTBEAT <short note>        <- at least every 3 minutes
[HH:MM:SS] PLAN 012 DONE  verify: <results>  files: <changed files>
[HH:MM:SS] PLAN 013 START
...
[HH:MM:SS] PLAN 013 DONE  verify: <results>  files: <changed files>
[HH:MM:SS] RUN DONE                                <- final line, only on success
```

On a STOP condition or unreachable Done criteria write
`[HH:MM:SS] PLAN NNN BLOCKED: <reason>` and stop the whole run (no RUN DONE).

## Decisions already made — do not re-litigate

- `ingest.py` is stdlib-only Python shelling out to the system `yt-dlp`
  binary. No third-party packages, no venv, no YouTube Data API, no cookies or
  proxies.
- The `clean_vtt` and `select` functions, the transcript file format, and the
  full SKILL.md content are specified verbatim in the plans — transcribe them
  exactly; do not "improve" them.
- The skill registers in `manifest/personal.txt` ONLY (not work.txt).
- The smoke-test pack `channels/_smoke/` gets deleted before commit, never
  committed.
