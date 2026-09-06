# routine-ringer — operate

Small Python script fired every minute by VPS cron. Reads the owner's Google Calendar (`kushalbakliwal25@gmail.com`, primary), and when an event's start time is within `[now-30s, now+60s]` it fires:

- A **Bark** push (`call=1&level=critical`) — iPhone rings for 30s, bypasses silent + DND.
- Optionally a **Telegram** sendMessage — routine name as scrollable log.

Deduped via `state.json` (fired event ids, pruned after 3 days).

## Where things live

- `ring.py` — the whole script. Single file on purpose; no framework, no scheduler (cron does that).
- `token.json` — vendored copy of `tooling/mcp/google-shared/tokens/kushalbakliwal25@gmail.com.json`. Gitignored. Refresh by re-copying when Google rotates or scopes change.
- `.env` — see `.env.example`. Gitignored. `BARK_URL` is the only required var.
- `state.json` — auto-created. Deduplication only; safe to delete (worst case: today's events re-fire once).

## Running

- Local test: `python3 ring.py` (uses `.env` and `token.json` in this folder). Idempotent — safe to run repeatedly.
- VPS: added to `/srv/crons/crontab.txt` as `* * * * *` (every minute). Wrapper: `run.sh` (git-pulls personal-stuff, then runs the venv).

## Design decisions

- **Cron over long-lived daemon.** Cron is Pattern B in this repo and self-healing on crash. A daemon that misses one restart misses a routine.
- **Fire-window `[-30s, +60s]`.** Cron fires at unknown second-offset; a 90s window catches every event exactly once when combined with the state file dedupe.
- **All-day events skipped.** They are usually context markers, not routines. Add a filter later if the owner starts using them for routines.
- **No calendar filter.** Every event on the primary calendar fires. If this gets noisy, add a title-prefix filter or a labelled calendar id.
- **Bark public server (`api.day.app`) not self-hosted yet.** If it goes down, alerts silently stop. Reviewer flagged as first hardening candidate — self-host on Cloudflare Worker (`bark-server` has a Worker template).

## Failure modes to watch

- Token expiry: refresh_token can be revoked if the owner changes Google password. Symptom: cron log shows `invalid_grant`. Fix: re-run `setup_auth.py` for `kushalbakliwal25@gmail.com` and re-vendor.
- iOS critical-alert permission revoked in Settings → Bark. Symptom: pushes arrive silently. No server-side detection; add a daily "sanity fire" at a known time to catch this.
- VPS cron missed (rare). No retry — the event window is 90s wide. A missed minute = missed routine.
- Bark public server outage. Symptom: HTTP 5xx logged; alert not delivered. Fix: self-host, or add a Pushover fallback.

## Related

- `apps/telegram-my-planner/tools/daily-digest/` — same auth pattern (vendored token), same VPS-cron shape. Copy-adapt anything from there.
- `apps/personal-dashboard/src/lib/googleCalendar.js` — Node-side calendar reader, richer parsing if this script ever grows.
