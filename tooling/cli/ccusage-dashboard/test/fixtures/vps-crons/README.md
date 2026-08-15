# VPS crons

| Job | Schedule (IST) | UTC cron | Real code path (in `personal-stuff` repo) | Status |
|---|---|---|---|---|
| site-probe | hourly | `0 * * * *` | `scripts/probe-sites.sh` | active |
| d1-backup | 03:00 daily | `30 21 * * *` | `apps/x/backup.sh` | active |
