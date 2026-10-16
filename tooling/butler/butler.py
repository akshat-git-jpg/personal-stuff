#!/usr/bin/env python3
"""butler month-end tracker: which monthly jobs are due, and which are done."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "monthly.json"


def state_file() -> Path:
    return Path(os.environ.get("BUTLER_STATE_DIR") or HERE / "state") / "done.json"


def load_jobs() -> list[dict]:
    return json.loads(CONFIG.read_text())["jobs"]


def load_done() -> dict[str, list[str]]:
    f = state_file()
    return json.loads(f.read_text()) if f.exists() else {}


def save_done(done: dict[str, list[str]]) -> None:
    f = state_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(done, indent=2, sort_keys=True) + "\n")


def in_window(day: int, from_day: int, to_day: int) -> bool:
    if from_day <= to_day:
        return from_day <= day <= to_day
    return day >= from_day or day <= to_day


def period_for(today: date, from_day: int, to_day: int) -> str:
    # A wrapping window (25th-5th) is for this month once it opens, else the month just ended.
    if from_day > to_day and today.day >= from_day:
        return f"{today.year:04d}-{today.month:02d}"
    y, m = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    return f"{y:04d}-{m:02d}"


def find_job(job_id: str) -> dict:
    for job in load_jobs():
        if job["id"] == job_id:
            return job
    print(f"unknown job: {job_id}", file=sys.stderr)
    sys.exit(2)


def cmd_status(today: date) -> None:
    done = load_done()
    shown = False
    for job in load_jobs():
        if not in_window(today.day, job["from_day"], job["to_day"]):
            continue
        shown = True
        period = period_for(today, job["from_day"], job["to_day"])
        if period in done.get(job["id"], []):
            print(f"DONE  {job['id']}  (for {period})")
        else:
            print(f"DUE   {job['id']}  (for {period})  run: /{job['skill']}")
            for item in job["inputs"]:
                print(f"      - {item}")
    if not shown:
        print("No month-end jobs due.")


def cmd_done(job_id: str, today: date, undo: bool) -> None:
    job = find_job(job_id)
    period = period_for(today, job["from_day"], job["to_day"])
    done = load_done()
    periods = done.setdefault(job_id, [])
    if undo:
        if period in periods:
            periods.remove(period)
        save_done(done)
        print(f"unmarked {job_id} for {period}")
    else:
        if period not in periods:
            periods.append(period)
        save_done(done)
        print(f"marked {job_id} done for {period}")


def main() -> None:
    p = argparse.ArgumentParser(description="butler month-end tracker")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("status", "done", "undo"):
        sp = sub.add_parser(name)
        if name != "status":
            sp.add_argument("job")
        sp.add_argument("--today", type=date.fromisoformat, default=date.today())
    a = p.parse_args()
    if a.cmd == "status":
        cmd_status(a.today)
    else:
        cmd_done(a.job, a.today, undo=a.cmd == "undo")


if __name__ == "__main__":
    main()
