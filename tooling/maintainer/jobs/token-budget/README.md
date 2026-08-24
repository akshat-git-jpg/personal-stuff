# token-budget

This job reports where Claude Code tokens are going without changing configuration. It has
four sections: total `rtk` savings, bounded `rtk discover` opportunities, `ccusage` totals
for the work and personal account directories, and the context-window breakdown.

Run it with:

```bash
bash tooling/maintainer/bin/run-job.sh token-budget
```

The `/context` command has no CLI form. The fourth section is therefore an explicit
`SESSION-STEP`; an absent breakdown means “not measured,” not “nothing to report.” The
legacy `~/.claude` directory is never treated as the work account.
