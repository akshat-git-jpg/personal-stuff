#!/usr/bin/env python3
"""pp-flights — flight search over Skyscanner's public web API.

No API key, no browser, no scraping of rendered HTML. The website's own
JSON endpoints answer plain HTTPS requests. See API-REFERENCE.md.
"""
import argparse
import datetime as dt
import json
import os
import re
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
CACHE = os.path.expanduser("~/.cache/pp-flights/places.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
CABINS = {"economy": "ECONOMY", "premium": "PREMIUM_ECONOMY",
          "business": "BUSINESS", "first": "FIRST"}


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
    """Turn 'BLR' or 'bangalore' into an entity id, caching the answer."""
    key = f"{market}:{place.strip().lower()}"
    cache = load_cache()
    if key in cache:
        return cache[key]

    hits = suggest(place, market, locale)
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


# --- search ---------------------------------------------------------------

def leg(origin, dest, date):
    return {
        "legOrigin": {"@type": "entity", "entityId": origin["entity_id"]},
        "legDestination": {"@type": "entity", "entityId": dest["entity_id"]},
        "dates": {"@type": "date", "year": f"{date.year:04d}",
                  "month": f"{date.month:02d}", "day": f"{date.day:02d}"},
    }


def search(origin, dest, depart, ret, adults, cabin, market, currency, locale,
           attempts=6, delay=3):
    legs = [leg(origin, dest, depart)]
    if ret:
        legs.append(leg(dest, origin, ret))
    payload = {"cabinClass": cabin, "childAges": [], "adults": adults, "legs": legs}

    data, status = None, None
    for i in range(attempts):
        r = requests.post(SEARCH_URL, json=payload,
                          headers=headers(market, currency, locale), timeout=90)
        if r.status_code == 403:
            sys.exit("pp-flights: 403 from Skyscanner. Note that sending browser "
                     "cookies causes this; this tool sends none by design.")
        r.raise_for_status()
        data = r.json()
        status = data.get("context", {}).get("status")
        if status == "complete":
            break
        if i < attempts - 1:
            time.sleep(delay)
    return data, status


def summarize(data, currency):
    out = []
    for r in data.get("itineraries", {}).get("results", []):
        legs = []
        for lg in r.get("legs", []):
            carriers = [c.get("name") for c in
                        lg.get("carriers", {}).get("marketing", [])]
            stops = [s.get("destination", {}).get("displayCode")
                     for s in lg.get("segments", [])[:-1]]
            legs.append({
                "from": lg.get("origin", {}).get("displayCode"),
                "to": lg.get("destination", {}).get("displayCode"),
                "depart": lg.get("departure"),
                "arrive": lg.get("arrival"),
                "duration_min": lg.get("durationInMinutes"),
                "stops": lg.get("stopCount"),
                "via": stops,
                "airlines": carriers,
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


def hhmm(iso):
    return iso.split("T")[1][:5] if iso and "T" in iso else "?"


def dur(mins):
    return f"{mins // 60}h{mins % 60:02d}" if isinstance(mins, int) else "?"


def table(rows):
    if not rows:
        return "no flights found"
    w = ["PRICE", "AIRLINE", "DEPART", "ARRIVE", "TIME", "STOPS", "TAGS"]
    lines = [f"{w[0]:>9}  {w[1]:<18} {w[2]:<6} {w[3]:<8} {w[4]:<6} {w[5]:<10} {w[6]}"]
    for r in rows:
        for i, lg in enumerate(r["legs"]):
            air = ", ".join(lg["airlines"])[:18]
            arr = hhmm(lg["arrive"]) + (f" +{lg['day_offset']}" if lg["day_offset"] else "")
            stops = ("direct" if lg["stops"] == 0
                     else f"{lg['stops']} via {'/'.join(lg['via'])}")
            # price and tags belong to the whole trip, so only the first leg carries them
            price = f"{r['price_formatted'] or r['price']:>9}" if i == 0 else " " * 9
            tags = ",".join(r["tags"]) if i == 0 else f"return {lg['from']}-{lg['to']}"
            lines.append(f"{price}  {air:<18} "
                         f"{hhmm(lg['depart']):<6} {arr:<8} {dur(lg['duration_min']):<6} "
                         f"{stops:<10} {tags}")
    return "\n".join(lines)


# --- cli ------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(prog="pp-flights", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--market", default="IN")
    ap.add_argument("--currency", default="INR")
    ap.add_argument("--locale", default="en-GB")
    ap.add_argument("--table", action="store_true", help="human table instead of JSON")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="search flights")
    s.add_argument("origin")
    s.add_argument("destination")
    s.add_argument("date")
    s.add_argument("--return", dest="ret", help="return date for a round trip")
    s.add_argument("--adults", type=int, default=1)
    s.add_argument("--cabin", default="economy", choices=list(CABINS))
    s.add_argument("--direct", action="store_true", help="nonstop only")
    s.add_argument("--sort", default="best", choices=["best", "cheapest", "fastest"])
    s.add_argument("--max", type=int, default=10, help="0 for everything")

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

    origin = resolve(a.origin, a.market, a.locale)
    dest = resolve(a.destination, a.market, a.locale)
    depart = parse_date(a.date)
    ret = parse_date(a.ret) if a.ret else None
    if ret and ret < depart:
        sys.exit("pp-flights: return date is before departure")
    if depart < dt.date.today():
        sys.exit(f"pp-flights: {depart} is in the past")

    data, status = search(origin, dest, depart, ret, a.adults, CABINS[a.cabin],
                          a.market, a.currency, a.locale)
    rows = summarize(data, a.currency)

    if a.direct:
        rows = [r for r in rows if all(l["stops"] == 0 for l in r["legs"])]
    if a.sort == "cheapest":
        rows.sort(key=lambda r: r["price"] if r["price"] is not None else 1e12)
    elif a.sort == "fastest":
        rows.sort(key=lambda r: sum(l["duration_min"] or 0 for l in r["legs"]))
    if a.max:
        rows = rows[:a.max]

    url = (f"{HOST}/transport/flights/{origin['iata'].lower()}/{dest['iata'].lower()}/"
           f"{depart:%y%m%d}/" + (f"{ret:%y%m%d}/" if ret else ""))

    if a.table:
        print(f"{origin['iata']} to {dest['iata']}  {depart:%a %d %b %Y}"
              f"  {a.adults} adult(s)  {a.cabin}")
        if status != "complete":
            print(f"warning: Skyscanner returned status={status}, prices may still move")
        print()
        print(table(rows))
        print(f"\n{url}")
    else:
        print(json.dumps({
            "origin": origin, "destination": dest,
            "depart_date": str(depart), "return_date": str(ret) if ret else None,
            "adults": a.adults, "cabin": a.cabin, "currency": a.currency,
            "search_status": status, "url": url, "results": rows,
        }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
