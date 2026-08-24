# runbook: uptime

## Default check

```bash
bash tooling/maintainer/bin/run-job.sh uptime
```

The default run compares URLs in `INFRA.md` with `my-hosted-sites.md`. It reports
`IN-INFRA-NOT-SITES` when an infrastructure URL is absent from the flat site index. The
reverse direction is allowed because `my-hosted-sites.md` covers more than infrastructure.

## Opt-in checks

Probe the public URLs only when network access is deliberate:

```bash
UPTIME_PROBE=1 bash tooling/maintainer/bin/run-job.sh uptime
```

Run every app's checks only when the dependency installs and full test suites are wanted:

```bash
UPTIME_APPS=1 bash tooling/maintainer/bin/run-job.sh uptime
```

This job only reports. Reconcile `INFRA.md` and `my-hosted-sites.md` in an approved repo
change after checking which inventory is correct.
