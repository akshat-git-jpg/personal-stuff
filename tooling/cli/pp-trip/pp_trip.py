#!/usr/bin/env python3
"""
pp-trip — CLI to manage trip pins for apps/trip-planner.

Design notes:
- Truth lives in `apps/trip-planner/trips/<slug>.json` (git-tracked).
- `pp-trip deploy` mirrors a trip into the Worker's KV.
- `pp-trip add` geocodes via Nominatim (free) when no --lat/--lon given.
  Respects Nominatim's 1 req/sec + user-agent policy.
- Reads the write token from env `PP_TRIP_TOKEN`, then apps/trip-planner/.dev.vars,
  so the same CLI works from any session without extra flags.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# --- paths -----------------------------------------------------------------

def repo_root() -> Path:
    # Assume this file lives at <repo>/tooling/cli/pp-trip/pp_trip.py.
    return Path(__file__).resolve().parents[3]

def trips_dir() -> Path:
    return repo_root() / "apps" / "trip-planner" / "trips"

def trip_file(slug: str) -> Path:
    return trips_dir() / f"{slug}.json"

def dev_vars_path() -> Path:
    return repo_root() / "apps" / "trip-planner" / ".dev.vars"

# --- config ----------------------------------------------------------------

DEFAULT_URL = "https://trips.agrolloo.com"

def base_url() -> str:
    return os.environ.get("PP_TRIP_URL") or DEFAULT_URL

def admin_token() -> str:
    tok = os.environ.get("PP_TRIP_TOKEN")
    if tok:
        return tok
    p = dev_vars_path()
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line.startswith("ADMIN_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("no admin token: set PP_TRIP_TOKEN or add ADMIN_TOKEN= to apps/trip-planner/.dev.vars", file=sys.stderr)
    sys.exit(2)

# --- slug helpers ----------------------------------------------------------

SLUG_RE = re.compile(r"^[a-z0-9-]{1,64}$")

def check_slug(slug: str) -> None:
    if slug == "__index" or not SLUG_RE.match(slug):
        print(f"bad slug: {slug!r} (a-z, 0-9, dash, 1-64 chars)", file=sys.stderr)
        sys.exit(2)

def make_pin_id(name: str, category: str, existing: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "pin"
    stem = f"{category[:5]}-{base}"[:40]
    cand = stem
    i = 2
    while cand in existing:
        cand = f"{stem}-{i}"
        i += 1
    return cand

# --- io --------------------------------------------------------------------

def read_trip(slug: str) -> dict:
    p = trip_file(slug)
    if not p.exists():
        print(f"no such trip: {slug} (looked at {p})", file=sys.stderr)
        sys.exit(1)
    return json.loads(p.read_text())

def write_trip(trip: dict) -> None:
    trip["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    p = trip_file(trip["slug"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(trip, indent=2, ensure_ascii=False) + "\n")

# --- geocode (Nominatim, free, no key) -------------------------------------

_last_nominatim_hit = 0.0

def nominatim_search(query: str, viewbox: str | None = None) -> tuple[float, float, str] | None:
    """Return (lat, lon, display_name) or None.

    Uses curl to sidestep macOS Python's missing SSL cert bundle.
    Rate-limited to ~1 req/sec per Nominatim policy. If `viewbox` is given
    (format: 'W,N,E,S' as lon/lat pairs), the search is bounded to it — this
    is what stops "Kappil Beach" in Varkala from resolving to a beach 500 km
    away in Kasaragod.
    """
    global _last_nominatim_hit
    wait = 1.05 - (time.time() - _last_nominatim_hit)
    if wait > 0:
        time.sleep(wait)
    _last_nominatim_hit = time.time()

    params = {"q": query, "format": "json", "limit": "1"}
    if viewbox:
        params["viewbox"] = viewbox
        params["bounded"] = "1"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    r = subprocess.run(
        ["curl", "-sS", "-H", "User-Agent: pp-trip/1.0 (kushal.b@zluri.com)", url],
        capture_output=True, timeout=20,
    )
    try:
        data = json.loads(r.stdout.decode("utf-8", errors="replace") or "[]")
    except json.JSONDecodeError:
        print(f"nominatim: bad response: {r.stdout[:200]!r}", file=sys.stderr)
        return None
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"]), data[0].get("display_name", "")

# --- deploy / http ---------------------------------------------------------

def _curl(url: str, method: str, token: str, body: bytes | None) -> tuple[int, str]:
    """Use curl to sidestep macOS Python's missing SSL cert bundle."""
    cmd = [
        "curl", "-sS", "-X", method,
        "-H", f"x-admin-token: {token}",
        "-o", "-", "-w", "\n__HTTP_STATUS__:%{http_code}",
        url,
    ]
    if body is not None:
        cmd += ["-H", "content-type: application/json", "--data-binary", "@-"]
    r = subprocess.run(cmd, input=body, capture_output=True)
    out = r.stdout.decode("utf-8", errors="replace")
    marker = "\n__HTTP_STATUS__:"
    if marker in out:
        body_txt, code_txt = out.rsplit(marker, 1)
        try:
            return int(code_txt.strip()), body_txt
        except ValueError:
            return 0, out
    return 0, out or r.stderr.decode("utf-8", errors="replace")

def http_put_json(url: str, body: dict, token: str) -> tuple[int, str]:
    return _curl(url, "PUT", token, json.dumps(body).encode("utf-8"))

def http_delete(url: str, token: str) -> tuple[int, str]:
    return _curl(url, "DELETE", token, None)

# --- commands --------------------------------------------------------------

def cmd_new(a: argparse.Namespace) -> None:
    check_slug(a.slug)
    p = trip_file(a.slug)
    if p.exists() and not a.force:
        print(f"already exists: {p} (use --force to overwrite)", file=sys.stderr)
        sys.exit(1)
    trip = {
        "slug": a.slug,
        "name": a.name or a.slug.replace("-", " ").title(),
        "dates": a.dates or "",
        "pins": [],
        "updatedAt": "",
    }
    write_trip(trip)
    print(f"created {p}")

def cmd_list_trips(_a: argparse.Namespace) -> None:
    d = trips_dir()
    if not d.exists():
        print("(no trips yet)")
        return
    for f in sorted(d.glob("*.json")):
        try:
            t = json.loads(f.read_text())
        except Exception:
            continue
        print(f"{t.get('slug'):30s}  {t.get('name','')}  ({len(t.get('pins',[]))} pins)  {t.get('dates','')}")

def cmd_list_pins(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    for p in t["pins"]:
        loc = f"{p['lat']:.4f},{p['lon']:.4f}"
        print(f"{p['id']:32s}  {p.get('emoji','·')}  {p['category']:9s}  {loc}  {p['name']}")

def cmd_add(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    if a.lat is not None and a.lon is not None:
        lat, lon = a.lat, a.lon
    else:
        q = a.query or a.name
        vb = a.viewbox or t.get("viewbox")
        print(f"geocoding: {q}" + (f"  (viewbox {vb})" if vb else ""), file=sys.stderr)
        got = nominatim_search(q, viewbox=vb)
        if not got:
            print(
                "geocode failed. NEVER GUESS COORDS. Do one of:\n"
                "  1) pass --lat / --lon (right-click the exact spot in Google Maps -> click the coords to copy)\n"
                "  2) refine with --query \"<name> <landmark or town>\"\n"
                "  3) add a `viewbox` to the trip JSON to bound future searches\n"
                "  4) grep an Overpass bbox dump for a SUBSTRING of the name -- OSM\n"
                "     spelling often differs (Sarwaa vs Sarva, Kurakkanni vs Kurakanni)\n"
                "  5) the place may be on Google and genuinely absent from OSM. That is\n"
                "     allowed as a last resort: see 'Using a coordinate that only Google\n"
                "     has' in .claude/skills/pp-trip/SKILL.md, then pass --lat / --lon\n"
                "     and record the provenance in --note.",
                file=sys.stderr,
            )
            sys.exit(1)
        lat, lon, display = got
        print(f"nominatim -> {lat:.5f},{lon:.5f}  |  {display[:120]}", file=sys.stderr)
        if not a.yes:
            print("verify the address above looks right, then re-run with --yes to save.", file=sys.stderr)
            sys.exit(3)
    existing = {p["id"] for p in t["pins"]}
    pin_id = a.id or make_pin_id(a.name, a.category, existing)
    if pin_id in existing:
        print(f"pin id already exists: {pin_id}", file=sys.stderr)
        sys.exit(1)
    pin = {
        "id": pin_id,
        "name": a.name,
        "emoji": a.emoji or DEFAULT_EMOJI.get(a.category, "📍"),
        "category": a.category,
        "lat": lat,
        "lon": lon,
    }
    if a.note:
        pin["note"] = a.note
    if a.gmaps_query:
        pin["gmapsQuery"] = a.gmaps_query
    t["pins"].append(pin)
    write_trip(t)
    print(f"added {pin_id}  ({lat:.4f},{lon:.4f})")

def cmd_remove(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    before = len(t["pins"])
    t["pins"] = [p for p in t["pins"] if p["id"] != a.pin_id]
    if len(t["pins"]) == before:
        print(f"no such pin: {a.pin_id}", file=sys.stderr)
        sys.exit(1)
    write_trip(t)
    print(f"removed {a.pin_id}")

def cmd_deploy(a: argparse.Namespace) -> None:
    slugs = [a.slug] if a.slug != "all" else [f.stem for f in sorted(trips_dir().glob("*.json"))]
    token = admin_token()
    url = base_url()
    fail = 0
    for slug in slugs:
        t = read_trip(slug)
        code, body = http_put_json(f"{url}/api/trips/{urllib.parse.quote(slug)}", t, token)
        ok = code == 200
        print(f"{slug:30s}  {code}  {'OK' if ok else 'FAIL'}  {body[:120]}")
        if not ok:
            fail += 1
    sys.exit(1 if fail else 0)

def cmd_delete_remote(a: argparse.Namespace) -> None:
    token = admin_token()
    url = base_url()
    code, body = http_delete(f"{url}/api/trips/{urllib.parse.quote(a.slug)}", token)
    print(f"{code}  {body}")
    sys.exit(0 if code == 200 else 1)

# --- defaults --------------------------------------------------------------

DEFAULT_EMOJI = {
    "stay": "🏠",
    "transport": "🚌",
    "beach": "🏖️",
    "sight": "🌅",
    "food": "☕",
    "utility": "🏧",
}
CATEGORIES = list(DEFAULT_EMOJI.keys())

# --- parser ----------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pp-trip", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    new = sub.add_parser("new", help="Create a new trip JSON.")
    new.add_argument("slug")
    new.add_argument("--name")
    new.add_argument("--dates")
    new.add_argument("--force", action="store_true")
    new.set_defaults(func=cmd_new)

    trips_ls = sub.add_parser("trips", help="List every trip file.")
    trips_ls.set_defaults(func=cmd_list_trips)

    ls = sub.add_parser("list", help="List pins in a trip.")
    ls.add_argument("slug")
    ls.set_defaults(func=cmd_list_pins)

    add = sub.add_parser("add", help="Add a pin (geocodes via Nominatim if lat/lon missing).")
    add.add_argument("slug")
    add.add_argument("--name", required=True)
    add.add_argument("--category", choices=CATEGORIES, required=True)
    add.add_argument("--emoji")
    add.add_argument("--lat", type=float)
    add.add_argument("--lon", type=float)
    add.add_argument("--query", help="Geocoding query if --lat/--lon are not given (defaults to --name)")
    add.add_argument("--note")
    add.add_argument("--id")
    add.add_argument("--gmaps-query", dest="gmaps_query")
    add.add_argument("--viewbox", help="Bound the geocoder to this bbox 'W,N,E,S' (lon,lat pairs). Defaults to the trip's `viewbox` field if set.")
    add.add_argument("--yes", action="store_true", help="Skip the geocode confirmation step (only after the printed display_name has been verified).")
    add.set_defaults(func=cmd_add)

    rm = sub.add_parser("remove", help="Remove a pin by id.")
    rm.add_argument("slug")
    rm.add_argument("pin_id")
    rm.set_defaults(func=cmd_remove)

    dep = sub.add_parser("deploy", help="Push a trip (or 'all') from JSON to the Worker's KV.")
    dep.add_argument("slug", help="trip slug, or 'all' for every JSON in trips/")
    dep.set_defaults(func=cmd_deploy)

    dele = sub.add_parser("delete-remote", help="Delete a trip from the Worker's KV.")
    dele.add_argument("slug")
    dele.set_defaults(func=cmd_delete_remote)

    return p

def main() -> None:
    args = build_parser().parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
