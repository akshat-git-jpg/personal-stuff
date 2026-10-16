"""pp-cal - read-only agenda from a Google Calendar (default: the owner's personal primary).

  agenda [--days N] [--account EMAIL] [--calendar ID] [--no-routine]

Reuses tooling/mcp/google-shared OAuth, same token cache as pp-gmail.
Exit code 3 when the fetch fails.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
DEFAULT_ACCOUNT = "kushalbakliwal25@gmail.com"


def fetch_events(account: str, calendar: str, start: datetime, end: datetime) -> list[dict]:
    from googleapiclient.discovery import build  # lazy: tests run without google libs
    from auth import get_credentials

    svc = build("calendar", "v3", credentials=get_credentials(account), cache_discovery=False)
    events, token = [], None
    while True:
        resp = svc.events().list(
            calendarId=calendar,
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            pageToken=token,
        ).execute()
        events += resp.get("items", [])
        token = resp.get("nextPageToken")
        if not token:
            return events


def _parse_dt(s: str, tz: ZoneInfo) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(tz)


def format_agenda(events: list[dict], start_date: date, days: int, tz: ZoneInfo = IST,
                  no_routine: bool = False) -> str:
    by_day: dict[date, list[tuple[str, str]]] = {start_date + timedelta(d): [] for d in range(days)}
    for ev in events:
        if ev.get("status") == "cancelled":
            continue
        if no_routine and ev.get("recurringEventId"):  # repeating events are routine
            continue
        title = ev.get("summary") or "(no title)"
        s, e = ev.get("start", {}), ev.get("end", {})
        if "date" in s:
            d = date.fromisoformat(s["date"])
            last = max(date.fromisoformat(e.get("date", s["date"])), d + timedelta(1))  # end is exclusive
            while d < last:
                if d in by_day:
                    by_day[d].append(("", f"  all day      {title}"))
                d += timedelta(1)
        elif "dateTime" in s:
            st = _parse_dt(s["dateTime"], tz)
            en = _parse_dt(e["dateTime"], tz) if "dateTime" in e else st
            if st.date() in by_day:
                by_day[st.date()].append((st.strftime("%H:%M"), f"  {st:%H:%M}-{en:%H:%M}  {title}"))
    out = []
    for d, rows in by_day.items():
        out.append(d.strftime("%a %d %b"))
        out += [r for _, r in sorted(rows, key=lambda x: x[0])] or ["  (nothing)"]
    return "\n".join(out)


def main() -> None:
    p = argparse.ArgumentParser(prog="pp-cal", description="Read a Google Calendar agenda (read-only)")
    sub = p.add_subparsers(dest="cmd", required=True)
    ag = sub.add_parser("agenda", help="events from today for N days")
    ag.add_argument("--days", type=int, default=2)
    ag.add_argument("--account", default=DEFAULT_ACCOUNT)
    ag.add_argument("--calendar", default="primary")
    ag.add_argument("--no-routine", action="store_true", help="hide repeating events")
    a = p.parse_args()

    today = datetime.now(IST).date()
    start = datetime.combine(today, time.min, IST)
    try:
        events = fetch_events(a.account, a.calendar, start, start + timedelta(days=a.days))
    except Exception as e:  # noqa: BLE001
        print(f"calendar fetch failed: {e}", file=sys.stderr)
        sys.exit(3)
    print(format_agenda(events, today, a.days, no_routine=a.no_routine))


if __name__ == "__main__":
    main()
