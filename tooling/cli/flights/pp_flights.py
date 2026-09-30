#!/usr/bin/env python3
"""pp-flights — flight search over Google Flights and Skyscanner.

Google Flights (via the `fli` library) is the default: fast, flight numbers,
no blocking seen at personal scale. Skyscanner's website JSON is the second
source: it rate-limits hard, but it also lists travel-agent deals that are
sometimes cheaper. No API key, no browser. See API-REFERENCE.md.
"""
import argparse
import datetime as dt
import hashlib
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
CACHE_DIR = os.path.expanduser("~/.cache/pp-flights")
CACHE = os.path.join(CACHE_DIR, "places.json")
RESULTS_DIR = os.path.join(CACHE_DIR, "results")
SKY_LAST = os.path.join(CACHE_DIR, "skyscanner-last")      # time of the last search
SKY_BLOCKED = os.path.join(CACHE_DIR, "skyscanner-blocked")  # blocked-until time
SKY_GAP = 20            # seconds between Skyscanner searches, across processes
SKY_BLOCK_WAIT = 1800   # a 403 blocks this IP for roughly half an hour
RESULT_TTL = 900        # reuse a search for 15 minutes
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
    """Turn 'BLR' or 'bangalore' into a place with an IATA code, caching it.

    Skyscanner's entity id is only needed for a Skyscanner search, so a bare
    IATA code resolves offline and the entity id is looked up lazily.
    """
    key = f"{market}:{place.strip().lower()}"
    cache = load_cache()
    if key in cache:
        return cache[key]
    code = place.strip().upper()
    if re.fullmatch(r"[A-Z]{3}", code):
        return {"iata": code, "name": code, "entity_id": None}

    try:
        hits = suggest(place, market, locale)
    except requests.RequestException as e:
        sys.exit(f"pp-flights: name lookup failed ({e}). Pass the IATA code instead, e.g. BLR")
    if not hits:
        sys.exit(f"pp-flights: no airport matched {place!r}")
    hit = hits[0]
    cache[key] = hit
    save_cache(cache)
    return hit


def entity_id(place, market, locale):
    if place.get("entity_id"):
        return place["entity_id"]
    cache = load_cache()
    key = f"{market}:{place['iata'].lower()}"
    if key in cache:
        return cache[key]["entity_id"]
    hits = [h for h in suggest(place["iata"], market, locale)
            if (h["iata"] or "").upper() == place["iata"]]
    if not hits or not hits[0]["entity_id"]:
        raise SourceError(f"Skyscanner has no entity id for {place['iata']}")
    cache[key] = hits[0]
    save_cache(cache)
    return hits[0]["entity_id"]


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


# --- google flights -------------------------------------------------------

def google_one_way(origin, dest, date, adults, cabin, direct, currency):
    try:
        from fli.models import (Airport, FlightSearchFilters, FlightSegment,
                                MaxStops, PassengerInfo, SeatType, SortBy)
        from fli.search import SearchFlights
    except ImportError:
        raise SourceError("Google source needs the `flights` package; run through the "
                          "pp-flights wrapper, which installs it, or pip install -r "
                          "tooling/cli/flights/requirements.txt")
    try:
        o, d = Airport[origin["iata"]], Airport[dest["iata"]]
    except KeyError as e:
        raise SourceError(f"Google source does not know airport {e}")
    filters = FlightSearchFilters(
        passenger_info=PassengerInfo(adults=adults),
        flight_segments=[FlightSegment(departure_airport=[[o, 0]], arrival_airport=[[d, 0]],
                                       travel_date=date.isoformat())],
        seat_type=SeatType[cabin],
        stops=MaxStops.NON_STOP if direct else MaxStops.ANY,
        sort_by=SortBy.CHEAPEST)
    partial = False
    try:
        res = SearchFlights().search(filters, currency=currency, language="en", country="IN") or []
    except Exception:  # the library raises its own types on HTTP and parse failures
        res = []
    if not res:
        # The fast call sometimes answers error 13 for a while; the results page still works.
        res, partial = google_page(origin["iata"], dest["iata"], date, adults, cabin, direct, currency), True

    rows = []
    for x in res:
        if not x.price:
            continue
        L = x.legs
        dep, arr = L[0].departure_datetime, L[-1].arrival_datetime
        rows.append({
            "price": float(x.price),
            "price_formatted": f"₹{x.price:,.0f}" if currency == "INR" else f"{x.price:,.0f} {currency}",
            "currency": currency,
            "tags": ["partial_list"] if partial else [],
            "source": "google",
            "legs": [{
                "from": L[0].departure_airport.name,
                "to": L[-1].arrival_airport.name,
                "depart": dep.isoformat(),
                "arrive": arr.isoformat(),
                "duration_min": x.duration,
                "stops": x.stops,
                "via": [l.arrival_airport.name for l in L[:-1]],
                "airlines": sorted({l.airline.value for l in L}),
                "flights": [f"{l.airline.name.lstrip('_')}{l.flight_number}" for l in L],
                "day_offset": (arr.date() - dep.date()).days,
            }],
        })
    return rows


def pb_len(field, payload):
    """One length-delimited protobuf field (all ours are under 128 bytes)."""
    return bytes([field << 3 | 2, len(payload)]) + payload


def pb_int(field, n):
    tag = field << 3
    head = bytes([tag]) if tag < 128 else bytes([tag & 0x7F | 0x80, tag >> 7])
    return head + bytes([n])


def google_page(origin, dest, date, adults, cabin, direct, currency):
    """Read the flights embedded in the Google Flights results page.

    The page only carries the first screen (top ~10 itineraries), so the
    caller marks these rows as a partial list.
    """
    from curl_cffi import requests as creq
    from fli.search._decoders import parse_flight_row
    import base64

    leg_msg = (pb_len(2, date.isoformat().encode())
               + (pb_int(5, 0) if direct else b"")
               + pb_len(13, pb_len(2, origin.encode()))
               + pb_len(14, pb_len(2, dest.encode())))
    seat = {"ECONOMY": 1, "PREMIUM_ECONOMY": 2, "BUSINESS": 3, "FIRST": 4}[cabin]
    tfs = (pb_len(3, leg_msg) + pb_len(8, b"\x01" * adults)
           + pb_int(9, seat) + pb_int(19, 2))
    url = ("https://www.google.com/travel/flights/search?tfs="
           + base64.urlsafe_b64encode(tfs).decode().rstrip("=")
           + f"&hl=en&gl=IN&curr={currency}")
    try:
        page = creq.get(url, impersonate="chrome", timeout=40).text
    except Exception as e:
        raise SourceError(f"Google Flights page failed: {e}")
    m = re.search(r"AF_initDataCallback\(\{key: 'ds:1'.*?data:(.*?), sideChannel: \{\}\}\);</script>",
                  page, re.S)
    if not m:
        raise SourceError("Google Flights answered with no flight data")
    data = json.loads(m.group(1))
    out = []
    for i in (2, 3):
        try:
            rows = data[i][0]
        except (IndexError, TypeError):
            continue
        for row in rows or []:
            try:
                out.append(parse_flight_row(row))
            except Exception:
                continue
    return out


def google_search(origin, dest, depart, ret, adults, cabin, direct, currency):
    """Round trips are two one-way searches; Indian domestic fares price that way."""
    out = google_one_way(origin, dest, depart, adults, cabin, direct, currency)
    back = google_one_way(dest, origin, ret, adults, cabin, direct, currency) if ret else None
    return out, back, "complete"


# --- skyscanner -----------------------------------------------------------

def leg(origin_id, dest_id, date):
    return {
        "legOrigin": {"@type": "entity", "entityId": origin_id},
        "legDestination": {"@type": "entity", "entityId": dest_id},
        "dates": {"@type": "date", "year": f"{date.year:04d}",
                  "month": f"{date.month:02d}", "day": f"{date.day:02d}"},
    }


def sky_gate():
    """Refuse while blocked; otherwise wait out the gap since the last search."""
    left = read_num(SKY_BLOCKED) - time.time()
    if left > 0:
        raise SourceError(f"Skyscanner is blocking this machine for ~{int(left // 60) + 1} more min")
    wait = read_num(SKY_LAST) + SKY_GAP - time.time()
    if wait > 0:
        print(f"pp-flights: waiting {wait:.0f}s before the next Skyscanner search", file=sys.stderr)
        time.sleep(wait)
    write_num(SKY_LAST, time.time())


def sky_search(origin, dest, depart, ret, adults, cabin, market, currency, locale,
               attempts=4, delay=5):
    o_id, d_id = entity_id(origin, market, locale), entity_id(dest, market, locale)
    legs = [leg(o_id, d_id, depart)]
    if ret:
        legs.append(leg(d_id, o_id, ret))
    payload = {"cabinClass": cabin, "childAges": [], "adults": adults, "legs": legs}

    sky_gate()
    data, status = None, None
    # Skyscanner has no cookie-free poll call (a GET on the session id is a 403),
    # so "polling" is re-sending the search. Keep it to a few, spaced out.
    for i in range(attempts):
        r = requests.post(SEARCH_URL, json=payload,
                          headers=headers(market, currency, locale), timeout=90)
        if r.status_code == 403:
            write_num(SKY_BLOCKED, time.time() + SKY_BLOCK_WAIT)
            raise SourceError("Skyscanner returned 403 (rate limit); skipping it for 30 min")
        r.raise_for_status()
        data = r.json()
        status = data.get("context", {}).get("status")
        if status == "complete":
            break
        if i < attempts - 1:
            time.sleep(delay)
    return sky_summarize(data, currency), None, status


def sky_summarize(data, currency):
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
                "flights": [],
                "day_offset": lg.get("timeDeltaInDays", 0),
            })
        out.append({
            "price": r.get("price", {}).get("raw"),
            "price_formatted": r.get("price", {}).get("formatted"),
            "currency": currency,
            "tags": r.get("tags", []),
            "source": "skyscanner",
            "legs": legs,
        })
    return out


# --- combining sources ----------------------------------------------------

def match_key(row):
    return tuple((hhmm(l["depart"]), hhmm(l["arrive"]), l["stops"]) for l in row["legs"])


def merge(google, sky):
    """One row per itinerary, carrying each source's price; price is the lower."""
    rows = {}
    for r in google + sky:
        k = match_key(r)
        cur = rows.get(k)
        if cur is None:
            cur = rows[k] = dict(r, prices={})
        else:
            for a, b in zip(cur["legs"], r["legs"]):
                a["flights"] = a["flights"] or b["flights"]
            cur["tags"] = cur["tags"] or r["tags"]
        if r["price"] is not None:
            # codeshares (AI / AI Express) share a key; keep each source's lowest
            old = cur["prices"].get(r["source"])
            cur["prices"][r["source"]] = r["price"] if old is None else min(old, r["price"])
            if cur["price"] is None or r["price"] < cur["price"]:
                cur["price"], cur["price_formatted"] = r["price"], r["price_formatted"]
    for r in rows.values():
        r["source"] = "+".join(sorted(r["prices"]))
    return list(rows.values())


def run(fn, key, notes):
    hit = cached_result(key)
    if hit is not None:
        return hit
    try:
        out, back, status = fn()
    except SourceError as e:
        notes.append(str(e))
        return None
    value = {"out": out, "back": back, "status": status}
    store_result(key, value)
    return value


# --- output ---------------------------------------------------------------

def hhmm(iso):
    return iso.split("T")[1][:5] if iso and "T" in iso else "?"


def dur(mins):
    return f"{mins // 60}h{mins % 60:02d}" if isinstance(mins, int) else "?"


def fmt_price(n):
    return f"₹{n:,.0f}" if n is not None else "-"


def table(rows, compare=False):
    if not rows:
        return "no flights found"
    head = f"{'PRICE':>9}  "
    if compare:
        head += f"{'GOOGLE':>8} {'SKYSCAN':>8}  "
    head += f"{'AIRLINE':<18} {'FLIGHT':<16} {'DEPART':<6} {'ARRIVE':<8} {'TIME':<6} {'STOPS':<10} TAGS"
    lines = [head]
    for r in rows:
        for i, lg in enumerate(r["legs"]):
            air = ", ".join(lg["airlines"])[:18]
            fl = "+".join(lg.get("flights") or [])[:16]
            arr = hhmm(lg["arrive"]) + (f" +{lg['day_offset']}" if lg["day_offset"] else "")
            stops = ("direct" if lg["stops"] == 0
                     else f"{lg['stops']} via {'/'.join(lg['via'])}")
            # price and tags belong to the whole trip, so only the first leg carries them
            first = i == 0
            line = f"{(r['price_formatted'] or str(r['price'])) if first else '':>9}  "
            if compare:
                p = r.get("prices", {})
                line += (f"{fmt_price(p.get('google')):>8} {fmt_price(p.get('skyscanner')):>8}  "
                         if first else " " * 19)
            tags = (",".join(t for t in r["tags"] if t != "partial_list") if first
                    else f"return {lg['from']}-{lg['to']}")
            line += (f"{air:<18} {fl:<16} {hhmm(lg['depart']):<6} {arr:<8} "
                     f"{dur(lg['duration_min']):<6} {stops:<10} {tags}")
            lines.append(line)
    return "\n".join(lines)


def shape(rows, direct, sort, limit):
    if direct:
        rows = [r for r in rows if all(l["stops"] == 0 for l in r["legs"])]
    if sort == "cheapest":
        rows.sort(key=lambda r: r["price"] if r["price"] is not None else 1e12)
    elif sort == "fastest":
        rows.sort(key=lambda r: sum(l["duration_min"] or 0 for l in r["legs"]))
    return rows[:limit] if limit else rows




def in_window(row, after, before):
    t = hhmm(row["legs"][0]["depart"])
    return (not after or t >= after) and (not before or t <= before)


# --- cli ------------------------------------------------------------------

def collect(a, origin, dest, depart, ret, direct):
    """Ask the chosen sources for one date. Returns rows plus what was asked."""
    base = (origin["iata"], dest["iata"], depart, ret, a.adults, a.cabin, a.currency)
    notes = []
    google = lambda: run(lambda: google_search(
        origin, dest, depart, ret, a.adults, CABINS[a.cabin], direct, a.currency),
        result_key("google", direct, *base), notes)
    sky = lambda: run(lambda: sky_search(
        origin, dest, depart, ret, a.adults, CABINS[a.cabin], a.market, a.currency, a.locale),
        result_key("skyscanner", *base), notes)

    if a.source == "google":
        results = [google()]
    elif a.source == "skyscanner":
        results = [sky()]
    elif a.source == "both":
        results = [google(), sky()]
    else:
        # Google's page fallback is only the first screen and can miss the cheapest
        # itinerary, so a partial Google answer is topped up from Skyscanner.
        g = google()
        partial = g and any("partial_list" in r["tags"] for r in g["out"])
        results = [g, sky()] if partial and not ret else ([g] if g else [sky()])

    got = [r for r in results if r]
    if not got:
        return None
    compare = len(got) == 2
    out = merge(got[0]["out"], got[1]["out"]) if compare else got[0]["out"]
    return {
        "out": out, "back": got[0].get("back"), "notes": notes, "compare": compare,
        "status": "complete" if all(r["status"] == "complete" for r in got) else "incomplete",
        "used": "+".join(sorted({s for r in out for s in r["source"].split("+")})) if out else "none",
        "partial": any("partial_list" in r["tags"] for r in out),
    }


def one_line(r):
    if not r:
        return "-"
    lg = r["legs"][0]
    fl = "+".join(lg.get("flights") or []) or ", ".join(lg["airlines"])
    stops = "direct" if lg["stops"] == 0 else f"via {'/'.join(lg['via'])}"
    arr = hhmm(lg["arrive"]) + (f"+{lg['day_offset']}" if lg["day_offset"] else "")
    return f"{fmt_price(r['price'])} {hhmm(lg['depart'])}-{arr} {stops} {fl}"


def cmd_range(a, origin, dest):
    """Cheapest overall and cheapest direct per date, from one all-stops search each."""
    start, end = parse_date(a.date), parse_date(a.end)
    if end < start:
        sys.exit("pp-flights: end date is before start date")
    days, d = [], start
    while d <= end:
        days.append(d)
        d += dt.timedelta(days=1)

    rows = []
    for day in days:
        c = collect(a, origin, dest, day, None, direct=False)
        if not c:
            rows.append({"date": str(day), "error": "no source answered"})
            continue
        pool = [r for r in c["out"] if r["price"] is not None and in_window(r, a.after, a.before)]
        pool.sort(key=lambda r: r["price"])
        direct = [r for r in pool if all(l["stops"] == 0 for l in r["legs"])]
        rows.append({"date": str(day), "sources": c["used"], "partial": c["partial"],
                     "options": len(pool), "cheapest": pool[0] if pool else None,
                     "cheapest_direct": direct[0] if direct else None, "notes": c["notes"]})

    window = f"  departing {a.after or '00:00'}-{a.before or '23:59'}" if a.after or a.before else ""
    if not a.table:
        print(json.dumps({"origin": origin["iata"], "destination": dest["iata"], "window": window.strip(),
                          "days": rows}, indent=2, ensure_ascii=False))
        return
    print(f"{origin['iata']} to {dest['iata']}  {start:%d %b} - {end:%d %b %Y}  all stops searched{window}\n")
    print(f"{'DATE':<11} {'CHEAPEST (any stops)':<44} {'CHEAPEST DIRECT':<34} SOURCES")
    for r in rows:
        day = dt.date.fromisoformat(r["date"])
        if "error" in r:
            print(f"{day:%a %d %b}  {r['error']}")
            continue
        print(f"{day:%a %d %b}  {one_line(r['cheapest']):<44} {one_line(r['cheapest_direct']):<34} "
              f"{r['sources']}{' (google partial)' if r['partial'] else ''}")


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
        p.add_argument("--source", default="auto", choices=["auto", "google", "skyscanner", "both"],
                       help="auto = Google, topped up from Skyscanner when Google is partial")
        p.add_argument("--fresh", action="store_true", help="ignore the 15-minute result cache")

    s = sub.add_parser("search", help="search flights on one date")
    common(s)
    s.add_argument("--return", dest="ret", help="return date for a round trip")
    s.add_argument("--direct", action="store_true", help="nonstop only")
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
    if ret and a.source == "both":
        sys.exit("pp-flights: --source both is one-way only; pick one source for a round trip")

    c = collect(a, origin, dest, depart, ret, a.direct)
    if not c:
        sys.exit("pp-flights: no source answered")
    keep = lambda rows: [x for x in rows if in_window(x, a.after, a.before)]
    out = shape(keep(c["out"]), a.direct, a.sort, a.max)
    back = shape(keep(c["back"]), a.direct, a.sort, a.max) if c["back"] is not None else None

    url = (f"{HOST}/transport/flights/{origin['iata'].lower()}/{dest['iata'].lower()}/"
           f"{depart:%y%m%d}/" + (f"{ret:%y%m%d}/" if ret else ""))

    if a.table:
        print(f"{origin['iata']} to {dest['iata']}  {depart:%a %d %b %Y}"
              f"  {a.adults} adult(s)  {a.cabin}  source: {c['used']}")
        for n in c["notes"]:
            print(f"note: {n}")
        if c["partial"]:
            print("note: Google's fast call failed, so Google gave its first screen only; "
                  "Skyscanner filled in the rest where it answered")
        if c["status"] != "complete":
            print("warning: Skyscanner returned status=incomplete, prices may still move")
        print()
        print(table(out, c["compare"]))
        if back is not None:
            print(f"\nReturn {dest['iata']} to {origin['iata']}  {ret:%a %d %b %Y}"
                  "  (priced separately; add the two)\n")
            print(table(back))
        print(f"\n{url}")
    else:
        print(json.dumps({
            "origin": origin, "destination": dest,
            "depart_date": str(depart), "return_date": str(ret) if ret else None,
            "adults": a.adults, "cabin": a.cabin, "currency": a.currency,
            "source": c["used"], "notes": c["notes"],
            "search_status": c["status"], "url": url, "results": out,
            "return_results": back,
        }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
