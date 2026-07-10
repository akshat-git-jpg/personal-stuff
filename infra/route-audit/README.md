# route-audit

This is the autonomy pilot: a weekly self-triggered, read-only repo-drift audit reporting to Telegram.
By policy, self-triggered runs are report-only.

**Autonomy policy pointer**: See the `decisions.md` entry of the landing date — self-triggered runs are read-only.

## VPS Cron

**Crontab line** (Sunday 08:00 IST):
```
30 2 * * 0 /srv/crons/route-audit/run.sh >> /srv/crons/route-audit/logs/cron.log 2>&1
```

## Wiring Steps

1. Copy `run.sh.example` to `/srv/crons/route-audit/run.sh` on the VPS.
2. Ensure it is executable (`chmod +x run.sh`).
3. Add the crontab line to the VPS crontab.
4. Note for the record: `VPS-CRONS.md` is mirrored to `vps-crons/VPS-CRONS.md` and `/root/VPS-CRONS.md`; the owner syncs those two copies during post-merge wiring.
