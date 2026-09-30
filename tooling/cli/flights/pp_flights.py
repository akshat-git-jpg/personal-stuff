#!/usr/bin/env python3
"""pp-flights — flight search over Skyscanner's website JSON.

Skyscanner is the only source: it lists travel-agent deals, so its prices match
what the booking sites charge. It rate-limits hard per IP, so every search is
one or two requests, spaced out, and can leave from this machine or the VPS.
No API key, no browser. See API-REFERENCE.md.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import time
import uuid

try:
    import requests
except ImportError:
    sys.exit("pp-flights needs `requests`: pip3 install --user requests")

HOST = "https://www.skyscanner.co.in"
SEARCH_URL = f"{HOST}/g/radar/api/v2/web-unified-search/"
SUGGEST_URL = f"{HOST}/g/autosuggest-search/api/v1/search-flight"
CACHE_DIR = os.path.expanduser("~/.cache/pp-flights")
CACHE = os.path.join(CACHE_DIR, "places.json")
RESULTS_DIR = os.path.join(CACHE_DIR, "results")
SKY_LAST = os.path.join(CACHE_DIR, "skyscanner-last")      # time of the last search
SKY_BLOCKED = os.path.join(CACHE_DIR, "skyscanner-blocked")  # blocked-until time
SKY_GAP = 45            # seconds between searches on one route, across processes
SKY_BLOCK_WAIT = 1800   # a 403 blocks that IP for roughly half an hour
RESULT_TTL = 1800       # reuse a search for 30 minutes
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
CABINS = {"economy": "ECONOMY", "premium": "PREMIUM_ECONOMY",
          "business": "BUSINESS", "first": "FIRST"}


class SourceError(Exception):
    pass


def headers(market, currency, locale):
    vid = str(uuid.uuid4())
    return {
        "accept": "application/json",
        "content-type": "application/json",
        "accept-language": locale,
        "user-agent": UA,
        "x-skyscanner-channelid": "website",
        "x-skyscanner-currency": currency,
        "x-skyscanner-locale": locale,
        "x-skyscanner-market": market,
        "x-skyscanner-viewid": vid,
        "x-skyscanner-trustedfunnelid": vid,
        "x-skyscanner-skip-accommodation-carhire": "true",
    }


# --- small file state -----------------------------------------------------

def read_num(path):
    try:
        with open(path) as f:
            return float(f.read().strip())
    except (OSError, ValueError):
        return 0.0


def write_num(path, n):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(str(n))


def result_key(*parts):
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:16]


def cached_result(key):
    path = os.path.join(RESULTS_DIR, key + ".json")
    try:
        if time.time() - os.path.getmtime(path) < RESULT_TTL:
            with open(path) as f:
                return json.load(f)
    except (OSError, ValueError):
        pass
    return None


def store_result(key, value):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, key + ".json"), "w") as f:
        json.dump(value, f)


# --- places ---------------------------------------------------------------

def load_cache():
    try:
        with open(CACHE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_cache(c):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w") as f:
        json.dump(c, f, indent=1, sort_keys=True)


def suggest(query, market, locale):
    """Autosuggest places. GeoId is the entityId the search endpoint wants."""
    r = requests.get(f"{SUGGEST_URL}/{market}/{locale}/{query}",
                     headers={"accept": "application/json", "user-agent": UA},
                     timeout=30)
    r.raise_for_status()
    out = []
    for p in r.json():
        out.append({
            "iata": p.get("PlaceId"),
            "name": p.get("PlaceName"),
            "city": p.get("CityName"),
            "country": p.get("CountryName"),
            "entity_id": p.get("GeoId"),
            "description": p.get("ResultingPhrase"),
        })
    return out


def resolve(place, market, locale):
    """Turn 'BLR' or 'bangalore' into a place with an entity id, caching the answer."""
    key = f"{market}:{place.strip().lower()}"
    cache = load_cache()
    if key in cache:
        return cache[key]
    try:
        hits = suggest(place, market, locale)
    except requests.RequestException as e:
        sys.exit(f"pp-flights: place lookup failed ({e}). A cached IATA code avoids it, e.g. BLR")
    if not hits:
        sys.exit(f"pp-flights: no airport matched {place!r}")
    exact = [h for h in hits if (h["iata"] or "").upper() == place.strip().upper()]
    hit = (exact or hits)[0]
    if not hit["entity_id"]:
        sys.exit(f"pp-flights: {place!r} resolved to {hit['name']} with no entity id")
    cache[key] = hit
    save_cache(cache)
    return hit


# --- dates ----------------------------------------------------------------

MONTHS = {m.lower(): i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def parse_date(s):
    """Accept 2026-08-24, 24-08-2026, '24 aug', '24aug', 'aug 24'."""
    s = s.strip().lower()
    today = dt.date.today()

    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return dt.date(int(m[1]), int(m[2]), int(m[3]))

    m = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", s)
    if m:
        return dt.date(int(m[3]), int(m[2]), int(m[1]))

    m = (re.fullmatch(r"(\d{1,2})\s*([a-z]{3,})", s)
         or re.fullmatch(r"([a-z]{3,})\s*(\d{1,2})", s))
    if m:
        a, b = m[1], m[2]
        day, mon = (a, b) if a.isdigit() else (b, a)
        mon_n = MONTHS.get(mon[:3])
        if mon_n:
            year = today.year
            cand = dt.date(year, mon_n, int(day))
            if cand < today:                      # a bare month/day means the next one
                cand = dt.date(year + 1, mon_n, int(day))
            return cand

    sys.exit(f"pp-flights: cannot read date {s!r}. Try 2026-08-24 or '24 aug'.")


# --- skyscanner -----------------------------------------------------------

def leg(origin_id, dest_id, date):
    return {
        "legOrigin": {"@type": "entity", "entityId": origin_id},
        "legDestination": {"@type": "entity", "entityId": dest_id},
        "dates": {"@type": "date", "year": f"{date.year:04d}",
                  "month": f"{date.month:02d}", "day": f"{date.day:02d}"},
    }


def sky_routes():
    """Where a request can leave from: this machine, then the VPS over SSH.

    Each route is its own IP, so its own rate limit, pacing and block timer.
    PP_FLIGHTS_VPS names the SSH host; empty disables the second route.
    """
    routes = ["local"]
    if os.environ.get("PP_FLIGHTS_VPS", "hostinger-vps"):
        routes.append("vps")
    return routes


def route_file(path, route):
    return path if route == "local" else f"{path}-{route}"


def route_ready_in(route):
    """Seconds until this route may search again (inf while it is blocked)."""
    now = time.time()
    if read_num(route_file(SKY_BLOCKED, route)) > now:
        return float("inf")
    return max(0.0, read_num(route_file(SKY_LAST, route)) + SKY_GAP - now)


def pick_route():
    """The route that can search soonest, waiting for it if needed."""
    routes = sorted(sky_routes(), key=route_ready_in)
    route = routes[0]
    wait = route_ready_in(route)
    if wait == float("inf"):
        left = min(read_num(route_file(SKY_BLOCKED, r)) for r in routes) - time.time()
        raise SourceError(f"Skyscanner is blocking every route for ~{int(left // 60) + 1} more min")
    if wait > 0:
        print(f"pp-flights: waiting {wait:.0f}s before the next Skyscanner search", file=sys.stderr)
        time.sleep(wait)
    write_num(route_file(SKY_LAST, route), time.time())
    return route


def sky_post(route, payload, hdrs):
    """POST the search from this route. Returns (status_code, parsed json or None)."""
    if route == "local":
        r = requests.post(SEARCH_URL, json=payload, headers=hdrs, timeout=90)
        return r.status_code, (r.json() if r.status_code == 200 else None)
    host = os.environ.get("PP_FLIGHTS_VPS", "hostinger-vps")
    remote = ["curl", "-s", "-X", "POST", SEARCH_URL, "--data-binary", "@-",
              "-w", r"\n%{http_code}", "--max-time", "90"]
    for k, v in hdrs.items():
        remote += ["-H", f"{k}: {v}"]
    try:
        p = subprocess.run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host,
                            " ".join(shlex.quote(x) for x in remote)],
                           input=json.dumps(payload), capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise SourceError(f"VPS route failed: {e}")
    if p.returncode != 0 or "\n" not in p.stdout:
        raise SourceError(f"VPS route failed: {p.stderr.strip()[-120:] or 'no output'}")
    body, code = p.stdout.rsplit("\n", 1)
    code = int(code) if code.isdigit() else 0
    return code, (json.loads(body) if code == 200 else None)


def sky_search(origin, dest, depart, ret, adults, cabin, market, currency, locale):
    """One search: a POST, plus one re-POST 10 s later if prices were still loading.

    Skyscanner has no cookie-free poll call, so the only way to wait for more
    prices is to send the search again, and every send counts against the limit.
    """
    legs = [leg(origin["entity_id"], dest["entity_id"], depart)]
    if ret:
        legs.append(leg(dest["entity_id"], origin["entity_id"], ret))
    payload = {"cabinClass": cabin, "childAges": [], "adults": adults, "legs": legs}

    why = []
    for _ in sky_routes():
        route = pick_route()
        data = None
        for attempt in range(2):
            try:
                code, body = sky_post(route, payload, headers(market, currency, locale))
            except (SourceError, requests.RequestException) as e:
                why.append(str(e))
                break
            if code == 403:
                write_num(route_file(SKY_BLOCKED, route), time.time() + SKY_BLOCK_WAIT)
                why.append(f"403 on the {route} route; resting it for 30 min")
                break
            if code != 200:
                why.append(f"HTTP {code} on the {route} route")
                break
            data = body
            if data.get("context", {}).get("status") == "complete" or attempt == 1:
                break
            time.sleep(10)
        if data is not None:
            return {"rows": sky_summarize(data, currency),
                    "status": data.get("context", {}).get("status"), "route": route}
    raise SourceError(" | ".join(why) or "Skyscanner did not answer")


def sky_summarize(data, currency):
    out = []
    for r in data.get("itineraries", {}).get("results", []):
        legs = []
        for lg in r.get("legs", []):
            carriers = [c.get("name") for c in
                        lg.get("carriers", {}).get("marketing", [])]
            stops = [s.get("destination", {}).get("displayCode")
                     for s in lg.get("segments", [])[:-1]]
            flights = [f"{s.get('marketingCarrier', {}).get('alternateId', '')}"
                       f"{s.get('flightNumber', '')}" for s in lg.get("segments", [])]
            legs.append({
                "from": lg.get("origin", {}).get("displayCode"),
                "to": lg.get("destination", {}).get("displayCode"),
                "depart": lg.get("departure"),
                "arrive": lg.get("arrival"),
                "duration_min": lg.get("durationInMinutes"),
                "stops": lg.get("stopCount"),
                "via": stops,
                "airlines": carriers,
                "flights": [f for f in flights if any(ch.isdigit() for ch in f)],
                "day_offset": lg.get("timeDeltaInDays", 0),
            })
        out.append({
            "price": r.get("price", {}).get("raw"),
            "price_formatted": r.get("price", {}).get("formatted"),
            "currency": currency,
            "tags": r.get("tags", []),
            "legs": legs,
        })
    return out


def search_cached(a, origin, dest, depart, ret):
    key = result_key("sky2", origin["iata"], dest["iata"], depart, ret,
                     a.adults, a.cabin, a.currency)
    hit = cached_result(key)
    if hit is not None:
        hit["cached"] = True
        return hit
    res = sky_search(origin, dest, depart, ret, a.adults, CABINS[a.cabin],
                     a.market, a.currency, a.locale)
    store_result(key, res)
    return res


# --- output ---------------------------------------------------------------

def hhmm(iso):
    return iso.split("T")[1][:5] if iso and "T" in iso else "?"


def dur(mins):
    return f"{mins // 60}h{mins % 60:02d}" if isinstance(mins, int) else "?"


def fmt_price(n):
    return f"₹{n:,.0f}" if n is not None else "-"


def table(rows):
    if not rows:
        return "no flights found"
    lines = [f"{'PRICE':>9}  {'AIRLINE':<18} {'FLIGHT':<16} {'DEPART':<6} {'ARRIVE':<8} "
             f"{'TIME':<6} {'STOPS':<10} TAGS"]
    for r in rows:
        for i, lg in enumerate(r["legs"]):
            air = ", ".join(lg["airlines"])[:18]
            fl = "+".join(lg.get("flights") or [])[:16]
            arr = hhmm(lg["arrive"]) + (f" +{lg['day_offset']}" if lg["day_offset"] else "")
            stops = ("direct" if lg["stops"] == 0
                     else f"{lg['stops']} via {'/'.join(lg['via'])}")
            # price and tags belong to the whole trip, so only the first leg carries them
            price = f"{r['price_formatted'] or r['price']:>9}" if i == 0 else " " * 9
            tags = ",".join(r["tags"]) if i == 0 else f"return {lg['from']}-{lg['to']}"
            lines.append(f"{price}  {air:<18} {fl:<16} {hhmm(lg['depart']):<6} {arr:<8} "
                         f"{dur(lg['duration_min']):<6} {stops:<10} {tags}")
    return "\n".join(lines)


def in_window(row, after, before):
    t = hhmm(row["legs"][0]["depart"])
    return (not after or t >= after) and (not before or t <= before)


def shape(rows, direct, sort, limit):
    if direct:
        rows = [r for r in rows if all(l["stops"] == 0 for l in r["legs"])]
    if sort == "cheapest":
        rows.sort(key=lambda r: r["price"] if r["price"] is not None else 1e12)
    elif sort == "fastest":
        rows.sort(key=lambda r: sum(l["duration_min"] or 0 for l in r["legs"]))
    return rows[:limit] if limit else rows


def one_line(r):
    if not r:
        return "-"
    lg = r["legs"][0]
    fl = "+".join(lg.get("flights") or []) or ", ".join(lg["airlines"])
    stops = "direct" if lg["stops"] == 0 else f"via {'/'.join(lg['via'])}"
    arr = hhmm(lg["arrive"]) + (f"+{lg['day_offset']}" if lg["day_offset"] else "")
    return f"{fmt_price(r['price'])} {hhmm(lg['depart'])}-{arr} {stops} {fl}"


# --- cli ------------------------------------------------------------------

def cmd_range(a, origin, dest):
    """Cheapest overall and cheapest direct per date, from one all-stops search each."""
    start, end = parse_date(a.date), parse_date(a.end)
    if end < start:
        sys.exit("pp-flights: end date is before start date")
    days, d = [], start
    while d <= end:
        days.append(d)
        d += dt.timedelta(days=1)

    out = []
    for day in days:
        try:
            res = search_cached(a, origin, dest, day, None)
        except SourceError as e:
            out.append({"date": str(day), "error": str(e)})
            continue
        pool = [r for r in res["rows"] if r["price"] is not None and in_window(r, a.after, a.before)]
        pool.sort(key=lambda r: r["price"])
        direct = [r for r in pool if all(l["stops"] == 0 for l in r["legs"])]
        out.append({"date": str(day), "status": res["status"], "options": len(pool),
                    "cheapest": pool[0] if pool else None,
                    "cheapest_direct": direct[0] if direct else None, "all": pool})

    window = f"  departing {a.after or '00:00'}-{a.before or '23:59'}" if a.after or a.before else ""
    if not a.table:
        print(json.dumps({"origin": origin["iata"], "destination": dest["iata"],
                          "window": window.strip(), "days": out}, indent=2, ensure_ascii=False))
        return
    print(f"{origin['iata']} to {dest['iata']}  {start:%d %b} - {end:%d %b %Y}  all stops searched{window}\n")
    print(f"{'DATE':<11} {'CHEAPEST (any stops)':<44} CHEAPEST DIRECT")
    for r in out:
        day = dt.date.fromisoformat(r["date"])
        if "error" in r:
            print(f"{day:%a %d %b}  not searched: {r['error']}")
            continue
        print(f"{day:%a %d %b}  {one_line(r['cheapest']):<44} {one_line(r['cheapest_direct'])}")


def main():
    ap = argparse.ArgumentParser(prog="pp-flights", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--market", default="IN")
    ap.add_argument("--currency", default="INR")
    ap.add_argument("--locale", default="en-GB")
    ap.add_argument("--table", action="store_true", help="human table instead of JSON")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("origin")
        p.add_argument("destination")
        p.add_argument("date")
        p.add_argument("--adults", type=int, default=1)
        p.add_argument("--cabin", default="economy", choices=list(CABINS))
        p.add_argument("--after", help="departing at or after HH:MM")
        p.add_argument("--before", help="departing at or before HH:MM")
        p.add_argument("--fresh", action="store_true", help="ignore the 30-minute result cache")

    s = sub.add_parser("search", help="search flights on one date")
    common(s)
    s.add_argument("--return", dest="ret", help="return date for a round trip")
    s.add_argument("--direct", action="store_true", help="nonstop only (filtered after the search)")
    s.add_argument("--sort", default="cheapest", choices=["best", "cheapest", "fastest"])
    s.add_argument("--max", type=int, default=10, help="0 for everything")

    r = sub.add_parser("range", help="cheapest and cheapest direct for every date in a range")
    common(r)
    r.add_argument("end", help="last date of the range")

    p = sub.add_parser("places", help="look up airports and their entity ids")
    p.add_argument("query")

    a = ap.parse_args()

    if a.cmd == "places":
        hits = suggest(a.query, a.market, a.locale)
        if a.table:
            for h in hits:
                print(f"{h['iata']:<5} {h['entity_id']:<12} {h['description']}")
        else:
            print(json.dumps(hits, indent=2, ensure_ascii=False))
        return

    if a.fresh:
        global RESULT_TTL
        RESULT_TTL = 0
    origin = resolve(a.origin, a.market, a.locale)
    dest = resolve(a.destination, a.market, a.locale)
    depart = parse_date(a.date)
    if depart < dt.date.today():
        sys.exit(f"pp-flights: {depart} is in the past")

    if a.cmd == "range":
        cmd_range(a, origin, dest)
        return

    ret = parse_date(a.ret) if a.ret else None
    if ret and ret < depart:
        sys.exit("pp-flights: return date is before departure")
    try:
        res = search_cached(a, origin, dest, depart, ret)
    except SourceError as e:
        sys.exit(f"pp-flights: {e}")
    rows = shape([x for x in res["rows"] if in_window(x, a.after, a.before)], a.direct, a.sort, a.max)

    url = (f"{HOST}/transport/flights/{origin['iata'].lower()}/{dest['iata'].lower()}/"
           f"{depart:%y%m%d}/" + (f"{ret:%y%m%d}/" if ret else ""))

    if a.table:
        print(f"{origin['iata']} to {dest['iata']}  {depart:%a %d %b %Y}"
              f"  {a.adults} adult(s)  {a.cabin}")
        if res["status"] != "complete":
            print("warning: Skyscanner was still collecting prices, a few fares may be missing")
        print()
        print(table(rows))
        print(f"\n{url}")
    else:
        print(json.dumps({
            "origin": origin, "destination": dest,
            "depart_date": str(depart), "return_date": str(ret) if ret else None,
            "adults": a.adults, "cabin": a.cabin, "currency": a.currency,
            "search_status": res["status"], "route": res.get("route"),
            "cached": res.get("cached", False), "url": url, "results": rows,
        }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
