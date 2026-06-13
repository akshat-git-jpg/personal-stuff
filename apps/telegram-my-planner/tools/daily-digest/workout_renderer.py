"""
Renders today's workout plan as a color-coded card PNG, styled to match the
daily schedule image (renderer.py). Driven by exercise-routine.json: exercises are
grouped by muscle and tinted with that muscle's color.

Run directly to preview a day:  python workout_renderer.py [Weekday]
"""
from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont

# ── Palette (matches renderer.py schedule card) ────────────────────────────────
BG          = (13, 13, 23)
TEXT_WHITE  = (255, 255, 255)
TEXT_DIM    = (150, 150, 180)
TEXT_MUTED  = (95,  95,  125)
DIVIDER     = (40,  40,  64)
DEFAULT_CLR = (121, 134, 203)

# ── Layout ─────────────────────────────────────────────────────────────────────
W          = 720       # canvas width (matches schedule for a tidy album)
PAD_L      = 28
PAD_R      = 28
HEADER_H   = 118
GROUP_H    = 40        # muscle-group header row
ROW_H      = 34        # exercise row
GROUP_GAP  = 10        # gap after each group
DIV_H      = 30        # divider before "Daily extras"
EXTRA_H    = 30        # daily-extra row
REST_H     = 124       # rest-day banner block
FOOTER_PAD = 26
ACCENT_W   = 5         # left accent bar
CORNER     = 8


# ── Fonts ───────────────────────────────────────────────────────────────────────
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
            "h1":    ImageFont.truetype(base, 40),
            "sub":   ImageFont.truetype(base, 21),
            "group": ImageFont.truetype(base, 20),
            "ex":    ImageFont.truetype(base, 19),
            "extra": ImageFont.truetype(base, 18),
            "rest":  ImageFont.truetype(base, 46),
        }
    fb = ImageFont.load_default()
    return {k: fb for k in ("h1", "sub", "group", "ex", "extra", "rest")}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _blend(c: tuple, f: float = 0.20) -> tuple:
    """Tint a color toward the background for subtle row fills."""
    return tuple(int(BG[i] + (c[i] - BG[i]) * f) for i in range(3))


def _trunc(text: str, font, max_w: int) -> str:
    if font.getlength(text) <= max_w:
        return text
    while text and font.getlength(text + "…") > max_w:
        text = text[:-1]
    return text + "…"


def _color_for(muscle: str, palette: dict) -> tuple:
    """Side/Rear/Front Delts all share the 'Delts' color; others match by name."""
    key = "Delts" if "Delts" in muscle else muscle
    return palette.get(key, palette.get(muscle, DEFAULT_CLR))


def _group(exercises: list[dict]) -> list[tuple[str, list[str]]]:
    """Group consecutive exercises by muscle label, preserving order."""
    groups: list[tuple[str, list[str]]] = []
    for ex in exercises:
        muscle, name = ex["muscle"], ex["name"]
        if groups and groups[-1][0] == muscle:
            groups[-1][1].append(name)
        else:
            groups.append((muscle, [name]))
    return groups


# ── Main renderer ───────────────────────────────────────────────────────────────
def render(
    weekday: str,
    day: dict,
    daily_extras: list[dict],
    palette_hex: dict,
) -> bytes:
    fonts   = _fonts()
    palette = {k: _hex_to_rgb(v) for k, v in palette_hex.items()}

    is_rest = bool(day.get("rest"))
    groups  = [] if is_rest else _group(day.get("exercises", []))

    # ── Measure canvas height ──
    h = HEADER_H
    h += REST_H if is_rest else sum(GROUP_H + ROW_H * len(n) + GROUP_GAP
                                    for _, n in groups)
    if daily_extras:
        h += DIV_H + GROUP_H + EXTRA_H * len(daily_extras)
    canvas_h = h + FOOTER_PAD

    img  = Image.new("RGB", (W, canvas_h), BG)
    draw = ImageDraw.Draw(img)

    # ── Header ──
    draw.text((PAD_L, 22), weekday.upper(), font=fonts["h1"], fill=TEXT_WHITE)
    if not is_rest:
        sub = day.get("focus", "")
        loc = day.get("location")
        if loc:
            sub = f"{sub}  ·  {loc}" if sub else loc
        draw.text((PAD_L, 76), sub, font=fonts["sub"], fill=TEXT_DIM)

    y = HEADER_H

    # ── Body ──
    if is_rest:
        draw.text((PAD_L, y + 18), "REST DAY", font=fonts["rest"], fill=TEXT_DIM)
        draw.text((PAD_L, y + 78), "Recover & grow.", font=fonts["sub"], fill=TEXT_MUTED)
        y += REST_H
    else:
        for muscle, names in groups:
            color = _color_for(muscle, palette)
            # group header: colored chip + label
            draw.rounded_rectangle([PAD_L, y + 9, PAD_L + 14, y + 27], radius=3, fill=color)
            draw.text((PAD_L + 26, y + 6), muscle.upper(), font=fonts["group"], fill=color)
            y += GROUP_H
            for name in names:
                x0, x1 = PAD_L, W - PAD_R
                ry0, ry1 = y + 2, y + ROW_H - 4
                draw.rounded_rectangle([x0, ry0, x1, ry1], radius=CORNER, fill=_blend(color))
                # left accent bar
                draw.rounded_rectangle([x0, ry0, x0 + ACCENT_W + CORNER, ry1],
                                       radius=CORNER, fill=color)
                draw.rectangle([x0 + CORNER, ry0, x0 + ACCENT_W + CORNER, ry1], fill=color)
                tx = x0 + ACCENT_W + CORNER + 10
                draw.text((tx, ry0 + 5), _trunc(name, fonts["ex"], x1 - tx - 10),
                          font=fonts["ex"], fill=TEXT_WHITE)
                y += ROW_H
            y += GROUP_GAP

    # ── Daily extras ──
    if daily_extras:
        draw.line([(PAD_L, y + 14), (W - PAD_R, y + 14)], fill=DIVIDER, width=1)
        y += DIV_H
        draw.text((PAD_L, y + 6), "DAILY EXTRAS", font=fonts["group"], fill=TEXT_MUTED)
        y += GROUP_H
        for ex in daily_extras:
            color = _color_for(ex["muscle"], palette)
            cy = y + EXTRA_H // 2
            draw.ellipse([PAD_L + 1, cy - 5, PAD_L + 11, cy + 5], fill=color)
            draw.text((PAD_L + 24, y + 4), ex["name"], font=fonts["extra"], fill=TEXT_DIM)
            y += EXTRA_H

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── Manual preview ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import datetime
    import json
    import os
    import sys
    from zoneinfo import ZoneInfo

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "exercise-routine.json"), encoding="utf-8") as f:
        routine = json.load(f)

    try:
        from config import TIMEZONE
        today = datetime.datetime.now(ZoneInfo(TIMEZONE)).strftime("%A")
    except Exception:
        today = "Monday"

    weekday = sys.argv[1] if len(sys.argv) > 1 else today
    day = routine["week"].get(weekday, {"rest": True})
    png = render(weekday, day, routine.get("daily_extras", []), routine["muscle_colors"])

    out = os.path.join(here, "workout_preview.png")
    with open(out, "wb") as f:
        f.write(png)
    print(f"Wrote {out} ({len(png) // 1024} KB) for {weekday}")
