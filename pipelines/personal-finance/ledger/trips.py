"""Trips from the trip planner (trips.agrolloo.com): the trip runs from the first
bus/train/flight departure or check-in to the last arrival or check-out.

Owner decision 2026-09-27: the planner is the one place trips are kept.
"""

from __future__ import annotations

import datetime as dt
import json
import re

URL = "https://trips.agrolloo.com/api/trips"
BOOK_DAYS = 30  # travel bookings this many days before the trip count as the trip
MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
STARTS, ENDS = ("departs", "check in"), ("arrives", "check out")


def _when(value, year, first_month):
    """"Thu 10 Sep · 17:15" -> datetime. "before 11:00" / "14:00-23:30" take the first time."""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})", value)
    if not m or m[2].lower() not in MONTHS:
        return None
    month = MONTHS[m[2].lower()]
    y = year + 1 if month < first_month else year  # a trip over new year
    t = re.search(r"(\d{1,2}):(\d{2})", value[m.end():])
    hh, mm = (int(t[1]), int(t[2])) if t else (0, 0)
    return dt.datetime(y, month, int(m[1]), hh, mm)


def parse(trip):
    """One planner trip -> {"name", "from", "to", "start", "end", "book_from"}, or None."""
    dates = trip.get("dates") or ""
    ym = re.search(r"(\d{4})", dates)
    fm = re.search(r"\b([A-Za-z]{3})[a-z]*\b", dates)
    if not ym:
        return None
    year = int(ym[1])
    first_month = MONTHS.get((fm[1] if fm else "").lower(), 1)
    starts, ends = [], []
    for b in trip.get("bookings") or []:
        for f in b.get("fields") or []:
            label = f.get("label", "").strip().lower()
            if label in STARTS + ENDS:
                w = _when(f.get("value", ""), year, first_month)
                if w:
                    (starts if label in STARTS else ends).append(w)
    if not starts or not ends:
        # No bookings: fall back to the whole days in "10-16 Sep 2026".
        d = re.match(r"\s*(\d{1,2})\s*(?:([A-Za-z]{3})[a-z]*)?\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3})", dates)
        if not d:
            return None
        m2 = MONTHS.get(d[4].lower())
        m1 = MONTHS.get((d[2] or d[4]).lower())
        if not (m1 and m2):
            return None
        starts = [dt.datetime(year if m1 <= m2 else year - 1, m1, int(d[1]))]
        ends = [dt.datetime(year, m2, int(d[3]), 23, 59)]
    start, end = min(starts), max(ends)
    name = re.sub(r"-(%s)[a-z]*-\d{4}$" % "|".join(MONTHS), "", trip.get("slug") or "").strip("-")
    return {"name": name or trip.get("slug"), "from": start.date().isoformat(), "to": end.date().isoformat(),
            "start": start.strftime("%Y-%m-%d %H:%M"), "end": end.strftime("%Y-%m-%d %H:%M"),
            "book_from": (start.date() - dt.timedelta(days=BOOK_DAYS)).isoformat()}


def fetch(get):
    """Every planner trip, full JSON. `get(url)` returns parsed JSON."""
    return [get("%s/%s" % (URL, t["slug"])) for t in get(URL)]


def load(path, config_trips):
    """Planner trips saved at `path`, plus config.json trips the planner does not have."""
    planner = []
    if path.exists():
        planner = [t for t in (parse(x) for x in json.loads(path.read_text())) if t]
    names = {t["name"] for t in planner}
    return planner + [t for t in config_trips if t["name"] not in names]
