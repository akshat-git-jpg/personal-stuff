"""
Fetches today's Google Calendar events, renders a schedule image, and sends
it to Telegram. Phase 1: run manually. Phase 2: cron-scheduled each morning.
"""
from __future__ import annotations

import datetime
import requests
from zoneinfo import ZoneInfo
from googleapiclient.discovery import build

from auth import get_credentials
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TIMEZONE, CALENDAR_ID
import renderer

DAY_START_HOUR = 6


def get_todays_events() -> tuple[list[dict], str]:
    tz  = ZoneInfo(TIMEZONE)
    now = datetime.datetime.now(tz)
    sod = now.replace(hour=0, minute=0, second=0, microsecond=0)
    eod = now.replace(hour=23, minute=59, second=59, microsecond=0)

    creds   = get_credentials()
    service = build("calendar", "v3", credentials=creds)

    cal_info     = service.calendarList().get(calendarId=CALENDAR_ID).execute()
    cal_color_id = cal_info.get("colorId", "")

    result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=sod.isoformat(),
        timeMax=eod.isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    return result.get("items", []), cal_color_id


def parse_events(
    events: list[dict],
    cal_color_id: str,
) -> tuple[
    list[tuple[datetime.datetime, datetime.datetime, str, str]],
    list[tuple[str, str]],
]:
    tz     = ZoneInfo(TIMEZONE)
    today  = datetime.datetime.now(tz).date()
    timed  = []
    allday = []

    for event in events:
        start    = event.get("start", {})
        end      = event.get("end", {})
        title    = event.get("summary", "(No title)")
        color_id = event.get("colorId") or cal_color_id

        if "date" in start:
            allday.append((title, color_id))
            continue

        start_dt = datetime.datetime.fromisoformat(start["dateTime"]).astimezone(tz)
        end_dt   = datetime.datetime.fromisoformat(end["dateTime"]).astimezone(tz)

        if start_dt.date() != today or start_dt.hour < DAY_START_HOUR:
            continue

        timed.append((start_dt, end_dt, title, color_id))

    timed.sort(key=lambda x: x[0])
    return timed, allday


def send_photo(png_bytes: bytes) -> None:
    if not TELEGRAM_CHAT_ID:
        raise ValueError("TELEGRAM_CHAT_ID not set in config.py")
    url  = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    resp = requests.post(url, data={"chat_id": TELEGRAM_CHAT_ID},
                         files={"photo": ("schedule.png", png_bytes, "image/png")})
    result = resp.json()
    if not result.get("ok"):
        raise RuntimeError(f"Telegram error: {result}")
    print(f"  Photo sent ({len(png_bytes) // 1024} KB)")


if __name__ == "__main__":
    tz       = ZoneInfo(TIMEZONE)
    now      = datetime.datetime.now(tz)
    date_str = now.strftime("%A, %d %b %Y")

    print("Fetching events...")
    events, cal_color_id = get_todays_events()
    print(f"  {len(events)} event(s) from API")

    timed, allday = parse_events(events, cal_color_id)
    print(f"  {len(timed)} timed  |  {len(allday)} all-day  (after 6 AM filter)")

    print("Rendering image...")
    png = renderer.render(timed, allday, date_str, len(timed) + len(allday))

    print("Sending to Telegram...")
    send_photo(png)
