# runbook: crons

## Local launchd check

```bash
bash tooling/maintainer/bin/run-job.sh crons
```

The job reads the Logs table in `MAC-LAUNCHD.md`. It reports a missing log, a log older
than 14 days, or a documented launchd label absent from `launchctl list`. Override the age
with `CRONS_STALE_DAYS=<days>` when a schedule needs a different window.

## VPS check

The default run prints `NOT CHECKED` and makes no connection. When VPS access is deliberate,
request the gated half and inspect the active crontab with the documented read-only command:

```bash
CRONS_SSH=1 bash tooling/maintainer/bin/run-job.sh crons
ssh root@72.61.241.170 'crontab -l'
```

The active crontab should match `/srv/crons/crontab.txt`. Each cron redirects output to its
job log under `/srv/crons/<job>/logs/cron.log`; wrappers may also write Git update failures
to `/srv/crons/<job>/logs/git.log`. Inspect a job without changing it:

```bash
ssh root@72.61.241.170 'tail -50 /srv/crons/<job>/logs/cron.log'
```

This job only reports. Never restart, reload, install, or repair cron or launchd work from
this check.
