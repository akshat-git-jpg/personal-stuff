#!/usr/bin/env python3
"""pp-bus — local bus timetables, read from routes/*.json.

No live source exists for these regional routes, so each route is a JSON file
transcribed from a printed timetable. See README.md to add one.
"""
import argparse
import datetime as dt
import glob
import json
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
ROUTES_DIR = os.path.join(DIR, "routes")


def load_routes():
    routes = []
    for path in sorted(glob.glob(os.path.join(ROUTES_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            routes.append(json.load(f))
    return routes


def canon(route, name):
    n = name.strip().lower()
    for place, aliases in route["places"].items():
        if n == place or n in aliases:
            return place
    return None


def find(routes, origin, dest):
    for r in routes:
        a, b = canon(r, origin), canon(r, dest)
        if a and b and f"{a}>{b}" in r["trips"]:
            return r, a, b
    return None, None, None


def minutes(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def dur(t):
    d = minutes(t["arrive"]) - minutes(t["depart"])
    return f"{d // 60}h{d % 60:02d}"


def with_duration(trips):
    return [{**t, "duration": dur(t)} for t in trips]


def table(route, a, b, trips):
    print(f"{a.title()} to {b.title()}  ({len(trips)} buses, timetable as of {route['as_of']})\n")
    has_stand = any("stand" in t for t in trips)
    head = f"  {'BUS':<12}" + (f"{'STAND':<10}" if has_stand else "") + f"{'DEPART':<8}{'ARRIVE':<8}TIME"
    print(head)
    for t in trips:
        row = f"  {t['bus']:<12}" + (f"{t.get('stand', ''):<10}" if has_stand else "")
        print(row + f"{t['depart']:<8}{t['arrive']:<8}{t['duration']}")
    print()
    for n in route.get("notes", []):
        print(f"  note: {n}")


def main():
    p = argparse.ArgumentParser(prog="pp-bus", description=__doc__.splitlines()[0])
    p.add_argument("--table", action="store_true", help="human table instead of JSON")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="buses from ORIGIN to DEST")
    s.add_argument("origin")
    s.add_argument("dest")
    s.add_argument("--after", help="only buses leaving at or after HH:MM (or 'now')")
    s.add_argument("--arrive-by", help="only buses arriving by HH:MM")
    s.add_argument("--fastest", action="store_true", help="sort by trip time")

    sub.add_parser("routes", help="every route this tool knows")
    args = p.parse_args()

    routes = load_routes()
    if args.cmd == "routes":
        out = [{"id": r["id"], "places": list(r["places"]), "directions": list(r["trips"]),
                "as_of": r["as_of"], "source": r["source"]} for r in routes]
        if args.table:
            for r in out:
                print(f"  {r['id']:<22}{', '.join(r['directions']):<40}as of {r['as_of']}")
        else:
            print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    route, a, b = find(routes, args.origin, args.dest)
    if not route:
        sys.exit(f"pp-bus: no route for {args.origin} to {args.dest}. Run `pp-bus --table routes`.")

    trips = with_duration(route["trips"][f"{a}>{b}"])
    if args.after:
        after = dt.datetime.now().strftime("%H:%M") if args.after == "now" else args.after
        trips = [t for t in trips if minutes(t["depart"]) >= minutes(after)]
    if args.arrive_by:
        trips = [t for t in trips if minutes(t["arrive"]) <= minutes(args.arrive_by)]
    if args.fastest:
        trips.sort(key=lambda t: minutes(t["arrive"]) - minutes(t["depart"]))

    if args.table:
        table(route, a, b, trips)
    else:
        print(json.dumps({"from": a, "to": b, "as_of": route["as_of"], "source": route["source"],
                          "notes": route.get("notes", []), "results": trips},
                         indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
