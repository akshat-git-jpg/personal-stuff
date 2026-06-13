"""
Renders a daily schedule as a timeline PNG (Google Calendar day-view style).
Overlapping events are placed side-by-side, proportional to their duration.
"""
from __future__ import annotations

import datetime
import io

from PIL import Image, ImageDraw, ImageFont

# ── Palette ──────────────────────────────────────────────────────────────────

BG         = (13, 13, 23)
TEXT_WHITE = (255, 255, 255)
TEXT_DIM   = (150, 150, 180)
TEXT_MUTED = (65,  65,  90)
HOUR_LINE  = (32,  32,  52)
HALF_LINE  = (22,  22,  36)

GCAL_COLORS: dict[str, tuple[int, int, int]] = {
    "1":  (121, 134, 203),  # Lavender
    "2":  ( 51, 182, 121),  # Sage
    "3":  (142,  36, 170),  # Grape
    "4":  (230, 124, 115),  # Flamingo
    "5":  (246, 192,  38),  # Banana
    "6":  (245,  81,  29),  # Tangerine
    "7":  (  3, 155, 229),  # Peacock
    "8":  ( 63,  81, 181),  # Blueberry
    "9":  ( 15, 157,  88),  # Basil
    "10": (213,   0,   0),  # Tomato
    "11": ( 97,  97,  97),  # Graphite
}
DEFAULT_COLOR = (3, 155, 229)

# ── Layout ───────────────────────────────────────────────────────────────────

W            = 720      # canvas width
PAD_L        = 20       # left padding
PAD_R        = 20       # right padding
TIME_COL_W   = 72       # width reserved for hour labels
GAP          = 8        # gap between time col and events
EVENT_X      = PAD_L + TIME_COL_W + GAP
EVENT_W      = W - EVENT_X - PAD_R

PX_PER_HR    = 80       # vertical pixels per hour
PX_PER_MIN   = PX_PER_HR / 60.0
DAY_START_H  = 6        # 6 AM

HEADER_H     = 108
FOOTER_H     = 54
CORNER       = 8
ACCENT_W     = 5        # left accent bar width


# ── Fonts ─────────────────────────────────────────────────────────────────────

def _fonts() -> dict:
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Geneva.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    base = None
    for p in candidates:
        try:
            ImageFont.truetype(p, 16)
            base = p
            break
        except Exception:
            pass
    if base:
        return {
            "h1":     ImageFont.truetype(base, 38),
            "date":   ImageFont.truetype(base, 22),
            "axis":   ImageFont.truetype(base, 17),   # hour labels
            "title":  ImageFont.truetype(base, 19),   # event title
            "time":   ImageFont.truetype(base, 14),   # event time range
            "footer": ImageFont.truetype(base, 17),
        }
    fb = ImageFont.load_default()
    return {k: fb for k in ("h1", "date", "axis", "title", "time", "footer")}


# ── Overlap layout algorithm ──────────────────────────────────────────────────

def _cluster(events: list) -> list[list]:
    """Group events into overlap clusters (any two events in a cluster touch)."""
    if not events:
        return []
    s = sorted(events, key=lambda x: x[0])
    clusters, cur, cur_end = [], [s[0]], s[0][1]
    for ev in s[1:]:
        if ev[0] < cur_end:
            cur.append(ev)
            cur_end = max(cur_end, ev[1])
        else:
            clusters.append(cur)
            cur, cur_end = [ev], ev[1]
    clusters.append(cur)
    return clusters


def _assign_lanes(cluster: list) -> list[tuple]:
    """
    Greedy lane assignment within one cluster.
    Returns [(event, lane_index, total_lanes)].
    """
    lane_ends: list[datetime.datetime] = []
    assigned: list[tuple] = []
    for ev in sorted(cluster, key=lambda x: x[0]):
        placed = False
        for i, end in enumerate(lane_ends):
            if end <= ev[0]:
                lane_ends[i] = ev[1]
                assigned.append((ev, i))
                placed = True
                break
        if not placed:
            assigned.append((ev, len(lane_ends)))
            lane_ends.append(ev[1])
    n = len(lane_ends)
    return [(ev, lane, n) for ev, lane in assigned]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _blend(c: tuple, f: float = 0.22) -> tuple:
    return (
        int(BG[0] + (c[0] - BG[0]) * f),
        int(BG[1] + (c[1] - BG[1]) * f),
        int(BG[2] + (c[2] - BG[2]) * f),
    )


def _fmt(dt: datetime.datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


def _trunc(text: str, font, max_w: int) -> str:
    if font.getlength(text) <= max_w:
        return text
    while text and font.getlength(text + "…") > max_w:
        text = text[:-1]
    return text + "…"


def _mins_from_start(dt: datetime.datetime, day_start: datetime.datetime) -> float:
    return (dt - day_start).total_seconds() / 60.0


# ── Main renderer ─────────────────────────────────────────────────────────────

def render(
    timed:      list[tuple[datetime.datetime, datetime.datetime, str, str]],
    allday:     list[tuple[str, str]],
    date_str:   str,
    total:      int,
    force_start: datetime.datetime | None = None,
    force_end:   datetime.datetime | None = None,
) -> bytes:
    fonts = _fonts()

    # ── Determine timeline range ──────────────────────────────────────────────
    if timed:
        tz    = timed[0][0].tzinfo
        today = timed[0][0].date()
    else:
        from zoneinfo import ZoneInfo
        from config import TIMEZONE
        tz    = ZoneInfo(TIMEZONE)
        today = datetime.datetime.now(tz).date()

    day_start = force_start or datetime.datetime(today.year, today.month, today.day,
                                                 DAY_START_H, 0, tzinfo=tz)

    if force_end:
        day_end = force_end
    else:
        midnight   = day_start + datetime.timedelta(hours=(24 - DAY_START_H))
        latest_end = max((e[1] for e in timed), default=midnight)
        day_end    = max(midnight, latest_end) + datetime.timedelta(minutes=30)

    total_mins = _mins_from_start(day_end, day_start)
    timeline_h = int(total_mins * PX_PER_MIN)
    canvas_h   = HEADER_H + timeline_h + FOOTER_H

    # ── Canvas ────────────────────────────────────────────────────────────────
    img  = Image.new("RGB", (W, canvas_h), BG)
    draw = ImageDraw.Draw(img)

    # ── Header ────────────────────────────────────────────────────────────────
    draw.text((PAD_L, 18),  "Good morning!", font=fonts["h1"],   fill=TEXT_WHITE)
    draw.text((PAD_L, 64),  date_str,        font=fonts["date"], fill=TEXT_DIM)

    t_y0 = HEADER_H  # top pixel of timeline

    # ── Hour grid + labels ────────────────────────────────────────────────────
    cur = day_start.replace(minute=0, second=0, microsecond=0)
    while cur <= day_end:
        mins = _mins_from_start(cur, day_start)
        if mins < 0:
            cur += datetime.timedelta(hours=1)
            continue
        y_hr = t_y0 + int(mins * PX_PER_MIN)
        if y_hr > t_y0 + timeline_h:
            break

        # Hour line
        draw.line([(EVENT_X, y_hr), (W - PAD_R, y_hr)], fill=HOUR_LINE, width=1)

        # Half-hour line
        half_mins = mins + 30
        if half_mins < total_mins:
            y_half = t_y0 + int(half_mins * PX_PER_MIN)
            draw.line([(EVENT_X, y_half), (W - PAD_R, y_half)], fill=HALF_LINE, width=1)

        # Hour label — right-aligned in time column
        label = cur.strftime("%I %p").lstrip("0")
        lw = fonts["axis"].getlength(label)
        draw.text((EVENT_X - GAP - lw, y_hr - 10), label, font=fonts["axis"], fill=TEXT_MUTED)

        cur += datetime.timedelta(hours=1)

    # ── Events ────────────────────────────────────────────────────────────────
    for cluster in _cluster(timed):
        for ev, lane, n_lanes in _assign_lanes(cluster):
            start_dt, end_dt, title, color_id = ev
            color = GCAL_COLORS.get(color_id, DEFAULT_COLOR)
            fill  = _blend(color, 0.22)

            sm = _mins_from_start(start_dt, day_start)
            em = _mins_from_start(end_dt,   day_start)

            y0 = t_y0 + int(sm * PX_PER_MIN) + 1
            y1 = t_y0 + int(em * PX_PER_MIN) - 1
            bh = y1 - y0  # block height in pixels

            col_w = EVENT_W / n_lanes
            x0    = int(EVENT_X + lane * col_w) + 1
            x1    = int(EVENT_X + (lane + 1) * col_w) - 2

            # Block fill
            draw.rounded_rectangle([x0, y0, x1, y1], radius=CORNER, fill=fill)

            # Left accent bar
            draw.rounded_rectangle([x0, y0, x0 + ACCENT_W + CORNER, y1], radius=CORNER, fill=color)
            draw.rectangle([x0 + CORNER, y0, x0 + ACCENT_W + CORNER, y1], fill=color)

            # Text — only if block is tall enough
            if bh >= 22:
                tx    = x0 + ACCENT_W + CORNER + 6
                max_w = x1 - tx - 4
                draw.text((tx, y0 + 5),
                          _trunc(title, fonts["title"], max_w),
                          font=fonts["title"], fill=TEXT_WHITE)
            if bh >= 48:
                tx    = x0 + ACCENT_W + CORNER + 6
                max_w = x1 - tx - 4
                draw.text((tx, y0 + 28),
                          _trunc(f"{_fmt(start_dt)} – {_fmt(end_dt)}", fonts["time"], max_w),
                          font=fonts["time"], fill=color)

    # ── Footer ────────────────────────────────────────────────────────────────
    footer = f"{total} event{'s' if total != 1 else ''} today  ·  Have a great day!  🚀"
    draw.text((PAD_L, t_y0 + timeline_h + 16), footer, font=fonts["footer"], fill=TEXT_MUTED)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
