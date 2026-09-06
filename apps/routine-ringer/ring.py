#!/usr/bin/env python3
"""
routine-ringer: fires a Bark push (persistent iOS critical alert) + Telegram
message when a Google Calendar event starts.

Runs every minute via VPS cron. Reads events from the primary calendar of the
account whose OAuth token lives at ./token.json (vendored copy of the
mcp/google-shared token for kushalbakliwal25@gmail.com).

For each event whose start_time is within [now-30s, now+60s]:
  1. Bark push with call=1 + level=critical -> iPhone ringtone loops for 30s,
     bypasses silent + DND. Title = event summary.
  2. Optional Telegram message with the same summary as backup label.
  3. Event id recorded in state.json so we never double-fire.

Env (.env next to this file):
  BARK_URL              Full device URL, e.g. https://api.day.app/<key>
  BARK_SOUND            Sound name (default: alarm)
  TIMEZONE              IANA tz, default Asia/Kolkata
  CALENDAR_ID           Calendar id (default: primary)
  TELEGRAM_BOT_TOKEN    Optional. If set with chat id, sends label message.
  TELEGRAM_CHAT_ID      Optional.
"""
from __future__ import annotations

import datetime
import json
import os
import sys
import urllib.parse
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request as AuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE = Path(__file__).parent
TOKEN_FILE = BASE / "token.json"
STATE_FILE = BASE / "state.json"
load_dotenv(BASE / ".env")

TIMEZONE = os.environ.get("TIMEZONE", "Asia/Kolkata")
BARK_URL = os.environ.get("BARK_URL", "").rstrip("/")
BARK_SOUND = os.environ.get("BARK_SOUND", "alarm")
CALENDAR_ID = os.environ.get("CALENDAR_ID", "primary")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

# Fire if event.start is in [now - PAST_WINDOW, now + FUTURE_WINDOW].
# Cron runs every minute; this 90s window guarantees no event is missed
# regardless of the second at which cron actually fires.
PAST_WINDOW = 30
FUTURE_WINDOW = 60

# Look-ahead window for the calendar query itself. Kept larger than the fire
# window so we still see events for logging even when they are not yet due.
QUERY_LOOKBACK_MIN = 2
QUERY_LOOKAHEAD_MIN = 6

# Keep fired-id entries around for 3 days, then prune. Longer than any
# realistic double-fire risk but keeps the state file small.
STATE_RETENTION_SECONDS = 3 * 86400


def get_credentials() -> Credentials:
    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"token.json missing at {TOKEN_FILE}. Copy from "
            "tooling/mcp/google-shared/tokens/kushalbakliwal25@gmail.com.json"
        )
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if creds.expired and creds.refresh_token:
        creds.refresh(AuthRequest())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"fired": {}}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"fired": {}}


def save_state(state: dict) -> None:
    cutoff = datetime.datetime.now(datetime.timezone.utc).timestamp() - STATE_RETENTION_SECONDS
    state["fired"] = {k: v for k, v in state["fired"].items() if v > cutoff}
    STATE_FILE.write_text(json.dumps(state, indent=2))


def upcoming_events(tz: ZoneInfo) -> tuple[list[dict], datetime.datetime]:
    now = datetime.datetime.now(tz)
    lo = now - datetime.timedelta(minutes=QUERY_LOOKBACK_MIN)
    hi = now + datetime.timedelta(minutes=QUERY_LOOKAHEAD_MIN)
    creds = get_credentials()
    svc = build("calendar", "v3", credentials=creds, cache_discovery=False)
    resp = svc.events().list(
        calendarId=CALENDAR_ID,
        timeMin=lo.isoformat(),
        timeMax=hi.isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()
    return resp.get("items", []), now


def event_start(ev: dict, tz: ZoneInfo) -> datetime.datetime | None:
    s = ev.get("start", {})
    if "dateTime" in s:
        raw = s["dateTime"].replace("Z", "+00:00")
        return datetime.datetime.fromisoformat(raw).astimezone(tz)
    # All-day events (only "date" field) are skipped by convention — those
    # are usually context markers, not routine slots.
    return None


def fire_bark(title: str, body: str) -> None:
    if not BARK_URL:
        raise RuntimeError("BARK_URL is not set")
    tp = urllib.parse.quote(title, safe="")
    bp = urllib.parse.quote(body, safe="")
    url = f"{BARK_URL}/{tp}/{bp}"
    r = requests.get(
        url,
        params={"call": "1", "level": "critical", "sound": BARK_SOUND},
        timeout=10,
    )
    r.raise_for_status()


def fire_telegram(text: str) -> None:
    if not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
        return
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        data={"chat_id": TELEGRAM_CHAT_ID, "text": text},
        timeout=10,
    )


def main() -> int:
    tz = ZoneInfo(TIMEZONE)
    state = load_state()
    events, now = upcoming_events(tz)
    fired = 0

    # Collect every event whose start falls in the fire window and hasn't
    # been fired yet. Merge these into a SINGLE Bark push so simultaneous
    # events (e.g. Commute Office + Talk to Dadiji both at 10:30) don't
    # trigger a burst of pushes whose sounds fight each other on the phone.
    due: list[tuple[dict, datetime.datetime, str]] = []
    for ev in events:
        eid = ev.get("id")
        if not eid:
            continue
        start = event_start(ev, tz)
        if start is None:
            continue

        # Dedupe by (event_id, start_time) — not id alone. A rescheduled event
        # keeps the same id with a new start; deduping by id alone would
        # silently skip the new time. Recurring instances already have unique
        # ids from singleEvents=True, so this only kicks in for edits.
        dedupe_key = f"{eid}:{start.isoformat()}"
        if dedupe_key in state["fired"]:
            continue

        delta = (start - now).total_seconds()
        if not (-PAST_WINDOW <= delta <= FUTURE_WINDOW):
            continue

        due.append((ev, start, dedupe_key))

    if due:
        titles = [ev.get("summary", "(no title)") for (ev, _, _) in due]
        n = len(due)
        body = " | ".join(titles) if n > 1 else titles[0]
        push_title = f"🔔 Routine Time ({n})" if n > 1 else "🔔 Routine Time"
        first_start = due[0][1]
        try:
            fire_bark(push_title, body)
            fire_telegram(f"⏰ {first_start.strftime('%H:%M')} — {body}")
            now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
            for (_, _, dedupe_key) in due:
                state["fired"][dedupe_key] = now_ts
            fired = n
            print(f"[fired] {first_start.strftime('%H:%M')} {n} event(s): {body}", flush=True)
        except Exception as e:
            print(f"[error] fire failed: {e}", file=sys.stderr, flush=True)

    save_state(state)
    if fired == 0:
        print(f"[ok] {now.strftime('%H:%M:%S')} no events in fire window", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
