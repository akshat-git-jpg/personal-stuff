# my-planner

Personal planning files plus the daily-digest tool that turns them into a morning Telegram message. A VPS cron runs the digest at 06:00 IST.

- `to-do/todo.md` — the running to-do list.
- `my-daily-routine/` — daily routine.
- `exercise-routine/exercise-routine.md` — workout routine.
- `preferences-tasks-*.md` — per-account task preferences.
- `tools/daily-digest/` — the digest job the cron calls (reads Calendar + the workout routine, sends to Telegram). Referenced by path in `../../VPS-CRONS.md`, so don't move it without updating that.
- `CLAUDE.md` — how Claude should work with these files.

The old `hostinger-vps-srv1377177.md` lived here but was stale; `../../INFRA.md` is the current infra reference.
