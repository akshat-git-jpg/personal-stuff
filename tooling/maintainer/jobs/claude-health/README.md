# claude-health

This job checks the Claude Code installation without changing it. The automated half runs
`claude doctor` and records the installed version. The full `/doctor` checkup has no CLI
equivalent, so the findings mark it as a `SESSION-STEP` to run inside a Claude session.

Run the automated check with:

```bash
bash tooling/maintainer/bin/run-job.sh claude-health
```

This job reports only. It never upgrades Claude Code and never installs or removes plugins.
