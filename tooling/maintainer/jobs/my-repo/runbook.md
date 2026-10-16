# runbook: my-repo

## Check

```bash
bash tooling/maintainer/bin/run-job.sh my-repo
```

`STALE` means a skill, CLI, MCP, hook or `curated.json` changed after the last deploy. The fix
is the `my-repo` skill: say "update my-repo", which re-scans and redeploys. "does not have"
means this clone is behind the deploy: `git fetch` and run again.

This job only reports. It makes one network request, to `/api/version`.
