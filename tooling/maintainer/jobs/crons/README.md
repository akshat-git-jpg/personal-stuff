# crons

This job checks whether documented launchd agents are loaded and whether their logs were
written in the last 14 days. It says when the VPS half was not checked.

Run the local check:

```bash
bash tooling/maintainer/bin/run-job.sh crons
```

VPS access is never automatic. Set `CRONS_SSH=1` only when you intend to follow the
read-only SSH procedure in `runbook.md`. This job reports problems; it never restarts,
reloads, installs, or repairs a scheduled job.
