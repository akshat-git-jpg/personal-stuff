# cred-probe

Verifies every Google OAuth refresh token still refreshes, avoiding silent token death (e.g. the 2026-06 incident where a token failed for 5 weeks unnoticed).

## Crontab

`30 23 * * * /srv/crons/cred-probe/run.sh >> /srv/crons/cred-probe/logs/cron.log 2>&1`
(05:00 IST daily — before the 06:00 IST digests, so a dead token alerts before the digests fail).

## Post-merge wiring steps
1. Copy `run.sh.example` to `vps-crons/cred-probe/run.sh`
2. Create `.env` with Telegram creds
3. Add crontab line
4. Smoke-test once
