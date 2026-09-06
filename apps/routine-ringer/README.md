# routine-ringer

Fires a **persistent iPhone alert** every time a Google Calendar event starts, so a routine block never slips by unnoticed.

Two channels per event:
- **Bark push** to iPhone — sound loops for 30s, bypasses silent + DND (uses `call=1&level=critical`).
- **Telegram message** (optional) — routine name lands in a chat so there is a scrollable log.

## Why not just an iOS alarm?

Alarms are truly persistent but have no dynamic label from a source of truth. This tool reads the calendar every minute, so any change on Google Calendar (from your phone, laptop, another tool) is reflected within a minute with no re-sync.

## Design at a glance

```
Google Calendar (kushalbakliwal25@gmail.com, primary)
        │  events.list [now-2m, now+6m]
        ▼
     ring.py  (runs every minute via VPS cron)
        │  for each event with start ∈ [now-30s, now+60s]
        │  not already in state.json
        ├──► Bark  https://api.day.app/<key>/<title>/<body>?call=1&level=critical&sound=<name>
        └──► Telegram sendMessage (optional)
        │
        ▼
    state.json  (fired event ids, pruned after 3 days)
```

## Setup

1. Copy the shared Google token in place (one-time):
   ```
   cp ../../tooling/mcp/google-shared/tokens/kushalbakliwal25@gmail.com.json token.json
   ```

2. Copy env template and fill in your Bark URL (from the Bark iOS app):
   ```
   cp .env.example .env
   $EDITOR .env
   ```

3. Install deps into a venv:
   ```
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

4. Test-run once:
   ```
   .venv/bin/python ring.py
   ```
   Should print `[ok] HH:MM:SS no events in fire window` unless an event is genuinely due.

5. Deploy to VPS cron (Pattern B) — see `VPS-CRONS.md` at repo root. Cron entry:
   ```
   * * * * * /srv/projects/personal-stuff/apps/routine-ringer/run.sh >> /var/log/routine-ringer.log 2>&1
   ```

## Custom ringtone

Bark plays a built-in sound by default. To match your iPhone's ringtone:
1. Convert your ringtone MP3 to `.caf` (max 30s, per Apple's rule).
2. Open the Bark app on iPhone → "Sounds" section → import the file.
3. Set `BARK_SOUND=<filename-without-ext>` in `.env`.

## Files

| File | Purpose |
|---|---|
| `ring.py` | The whole thing — read calendar, fire alerts, dedupe. |
| `token.json` | Vendored OAuth token (gitignored). |
| `state.json` | Fired event ids (gitignored, auto-created). |
| `.env` | Real config (gitignored). |
| `.env.example` | Template. |
| `run.sh` | Cron wrapper that git-pulls + runs the venv. |
