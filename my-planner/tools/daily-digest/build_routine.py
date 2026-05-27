#!/usr/bin/env python3
"""
Generate exercise-routine.json from the human-editable markdown source
(../../exercise routine/exercise-routine.md).

Workflow:  edit the markdown  ->  run this  ->  deploy.sh ships exercise-routine.json.
See the comment block at the top of the markdown for the editing format.

Usage:
    python3 build_routine.py            # regenerate exercise-routine.json
    python3 build_routine.py --check    # parse + validate only, don't write
"""
from __future__ import annotations

import json
import os
import re
import sys

HERE         = os.path.dirname(os.path.abspath(__file__))
MD_PATH      = os.path.normpath(os.path.join(HERE, "..", "..",
                                             "exercise routine", "exercise-routine.md"))
ROUTINE_PATH = os.path.join(HERE, "exercise-routine.json")

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Source of truth for muscle -> card color. Side/Rear/Front Delts all use "Delts".
MUSCLE_COLORS = {
    "Back":     "#60a5fa",
    "Chest":    "#f87171",
    "Biceps":   "#4ade80",
    "Triceps":  "#fb923c",
    "Delts":    "#c084fc",
    "Forearms": "#d6a472",
    "Abs":      "#f472b6",
    "Neck":     "#94a3b8",
    "Cardio":   "#22d3ee",
}

# Legacy support: <span class="m-xxx"> maps to a muscle when a line has no "Muscle - " prefix.
CLASS_MUSCLE = {
    "m-back": "Back", "m-chest": "Chest", "m-biceps": "Biceps", "m-triceps": "Triceps",
    "m-delts": "Delts", "m-forearms": "Forearms", "m-abs": "Abs", "m-neck": "Neck",
    "m-cardio": "Cardio",
}

_TAG_RE   = re.compile(r"<[^>]+>")
_CLASS_RE = re.compile(r'class="(m-[a-z]+)"')
_HEAD_RE  = re.compile(r"^##\s+(.*)$")
_ITEM_RE  = re.compile(r"^\s*(?:[-*]|\d+\.)\s+(.*)$")
_LOC_RE   = re.compile(r"^\s*(?:location:\s*(.+)|\*\*\s*morning\s*\((.+?)\)\s*\*\*)\s*$",
                       re.IGNORECASE)
_HEAD_SPLIT = re.compile(r"(.+?)\s*[—–-]\s*(.*)$")   # "Monday — Back / Delts"
_ITEM_SPLIT = re.compile(r"\s[-—–]\s")               # first " - " splits muscle from name


def _color_key(muscle: str) -> str:
    return "Delts" if "Delts" in muscle else muscle


def _parse_item(text: str) -> tuple[str, str]:
    """Return (muscle, name) from a raw list-item body."""
    cls   = _CLASS_RE.search(text)
    clean = _TAG_RE.sub("", text).strip()
    parts = _ITEM_SPLIT.split(clean, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    muscle = CLASS_MUSCLE.get(cls.group(1), "") if cls else ""
    return muscle, clean


def parse(md_text: str) -> tuple[dict, list[str]]:
    week: dict   = {}
    extras: list = []
    cur_day      = None
    mode         = None          # "day" | "extras" | None
    in_comment   = False

    for raw in md_text.splitlines():
        line = raw.rstrip()

        # skip <!-- ... --> blocks (so example headings inside them are ignored)
        if not in_comment and "<!--" in line:
            in_comment = "-->" not in line
            continue
        if in_comment:
            in_comment = "-->" not in line
            continue
        if not line.strip():
            continue

        head = _HEAD_RE.match(line)
        if head:
            title = head.group(1).strip()
            if title.lower().startswith("daily extras"):
                mode, cur_day = "extras", None
                continue
            m       = _HEAD_SPLIT.match(title)
            weekday = (m.group(1).strip() if m else title).title()
            focus   = (m.group(2).strip() if m else "")
            if weekday not in WEEKDAYS:
                mode, cur_day = None, None      # some other heading; ignore its items
                continue
            cur_day, mode = weekday, "day"
            if not focus or focus.upper() == "REST":
                week[weekday] = {"rest": True}
            else:
                week[weekday] = {"focus": focus, "location": "", "exercises": []}
            continue

        if mode == "day" and cur_day and not week[cur_day].get("rest"):
            loc = _LOC_RE.match(line)
            if loc:
                week[cur_day]["location"] = (loc.group(1) or loc.group(2) or "").strip()
                continue

        item = _ITEM_RE.match(line)
        if not item:
            continue
        muscle, name = _parse_item(item.group(1))
        if not name:
            continue
        if mode == "extras":
            extras.append({"muscle": muscle, "name": name})
        elif mode == "day" and cur_day and not week[cur_day].get("rest"):
            week[cur_day]["exercises"].append({"muscle": muscle, "name": name})

    ordered = {d: week[d] for d in WEEKDAYS if d in week}

    # warn about muscles with no color (renderer falls back to a default)
    warnings: list[str] = []
    seen = {ex["muscle"] for v in ordered.values() for ex in v.get("exercises", [])}
    seen |= {ex["muscle"] for ex in extras}
    for muscle in sorted(seen):
        if muscle and _color_key(muscle) not in MUSCLE_COLORS:
            warnings.append(f"no color defined for muscle '{muscle}' (using default)")

    return {"muscle_colors": MUSCLE_COLORS, "week": ordered, "daily_extras": extras}, warnings


def main() -> int:
    check = "--check" in sys.argv
    if not os.path.exists(MD_PATH):
        print(f"ERROR: markdown source not found: {MD_PATH}", file=sys.stderr)
        return 1

    with open(MD_PATH, encoding="utf-8") as f:
        routine, warnings = parse(f.read())

    week = routine["week"]
    if not week:
        print("ERROR: no day sections parsed — check the markdown headings.", file=sys.stderr)
        return 1

    print(f"Parsed {os.path.relpath(MD_PATH, HERE)}:")
    for d in WEEKDAYS:
        v = week.get(d)
        if v is None:
            print(f"  {d:<9} (missing)")
        elif v.get("rest"):
            print(f"  {d:<9} REST")
        else:
            print(f"  {d:<9} {len(v['exercises'])} exercises  ·  {v.get('focus', '')}")
    print(f"  Daily extras: {len(routine['daily_extras'])}")
    for w in warnings:
        print(f"  WARNING: {w}")

    if check:
        print("Check only — exercise-routine.json not written.")
        return 0

    with open(ROUTINE_PATH, "w", encoding="utf-8") as f:
        json.dump(routine, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {os.path.relpath(ROUTINE_PATH, HERE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
