#!/usr/bin/env python3
"""pp-trains — Indian Railways search, seats, route and live status.

Three unofficial public sources, no keys: erail (every train that runs,
including unreserved), ConfirmTkt (fares, seats, confirm chance) and
RailYatri (live running status, sourced from NTES). See README.md.
"""
import argparse
import datetime as dt
import html
import json
import re
import sys
import uuid

try:
    import requests
except ImportError:
    sys.exit("pp-trains needs `requests`: pip3 install --user requests")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
ERAIL = "https://erail.in"
CT = "https://cttrainsapi.confirmtkt.com/api"
CT_HEADERS = {"clientid": "ct-web", "apikey": "ct-web!2$", "Accept": "application/json"}
RY_LIVE = "https://www.railyatri.in/live-train-status/"
CLASS_ORDER = ["1A", "2A", "3A", "3E", "CC", "EC", "SL", "2S"]


def get(url, params=None, headers=None, timeout=40):
    h = {"User-Agent": UA, **(headers or {})}
    r = requests.get(url, params=params, headers=h, timeout=timeout)
    r.raise_for_status()
    return r


def ct_get(path, params):
    return get(f"{CT}{path}", params, {**CT_HEADERS, "deviceid": str(uuid.uuid4())}).json()


def hhmm(s):
    return s.replace(".", ":") if s else s


def mins(s):
    h, m = hhmm(s).split(":")
    return int(h) * 60 + int(m)


def parse_date(s):
    if not s:
        return None
    s = s.strip().lower()
    today = dt.date.today()
    if s == "today":
        return today
    if s == "tomorrow":
        return today + dt.timedelta(1)
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d %b %Y", "%d %b", "%b %d"):
        try:
            d = dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
        if "%Y" not in fmt:
            d = d.replace(year=today.year)
            if d < today:
                d = d.replace(year=today.year + 1)
        return d
    sys.exit(f"pp-trains: can't read date '{s}'. Use 2026-11-01, 01-11-2026 or '1 nov'.")


# --- stations ---------------------------------------------------------------

def suggest(query):
    d = ct_get("/v2/trains/stations/auto-suggestion", {
        "searchString": query, "sourceStnCode": "", "popularStnListLimit": 15,
        "preferredStnListLimit": 6, "channel": "mwebd", "language": "EN"})
    return [{"code": s["stationCode"], "name": s["stationName"], "city": s.get("city"),
             "state": s.get("state")} for s in (d.get("data") or {}).get("stationList", [])]


def resolve(place):
    p = place.strip()
    if re.fullmatch(r"[A-Za-z]{2,5}", p) and p.upper() == p:
        return p.upper()
    hits = suggest(p)
    if not hits:
        sys.exit(f"pp-trains: no station matches '{place}'. Try `pp-trains stations {place}`.")
    # "All stations" groups carry a hub code; prefer a real station that names the query.
    for h in hits:
        if p.lower() in h["name"].lower() and "all stations" not in h["name"].lower():
            return h["code"]
    return hits[0]["code"]


# --- erail: every train that runs --------------------------------------------

def erail_between(a, b):
    txt = get(f"{ERAIL}/rail/getTrains.aspx", {"Station_From": a, "Station_To": b,
              "DataSource": 0, "Language": 0, "Cache": "true"}).text
    trains = []
    for rec in txt.split("^")[1:]:
        f = rec.split("~")
        if len(f) < 40 or not f[0].strip():
            continue
        dep, dur = hhmm(f[10]), hhmm(f[12])
        day_offset = (mins(dep) + mins(dur)) // 1440
        trains.append({
            "number": f[0], "name": f[1], "from": f[7], "to": f[9],
            "depart": dep, "arrive": hhmm(f[11]), "day_offset": day_offset,
            "duration": dur, "run_days": f[13], "type": f[32] or None,
            "unreserved": f[32] == "ORDINARY", "distance_km": f[39] or None,
        })
    return trains


def runs_on(t, date):
    return t["run_days"][date.weekday()] == "1"


def days_text(mask):
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return "daily" if mask == "1111111" else ",".join(n for n, c in zip(names, mask) if c == "1")


# --- ConfirmTkt: fares, seats, confirm chance ---------------------------------

def ct_search(a, b, date):
    d = ct_get("/v1/trains/search", {"sourceStationCode": a, "destinationStationCode": b,
               "dateOfJourney": date.strftime("%d-%m-%Y")})
    out = {}
    for t in (d.get("data") or {}).get("trainList", []):
        seats = {}
        for cls, v in (t.get("availabilityCache") or {}).items():
            seats[cls] = {"fare": int(v["fare"]) if str(v.get("fare") or "").isdigit() else None,
                          "status": v.get("availabilityDisplayName") or None,
                          "chance": v.get("predictionDisplayName") or None}
        out[t["trainNumber"]] = {
            "number": t["trainNumber"], "name": t.get("trainName"),
            "from": t.get("fromStnCode"), "to": t.get("toStnCode"),
            "depart": t.get("departureTime"), "arrive": t.get("arrivalTime"), "seats": seats}
    return out


def search(a, b, date, cls):
    rows = erail_between(a, b)
    if date:
        rows = [t for t in rows if runs_on(t, date)]
        booking = ct_search(a, b, date)
        for t in rows:
            t["seats"] = booking.pop(t["number"], {}).get("seats", {})
        # Booking-only trains leave from a nearby station in the same city group.
        for t in booking.values():
            dep = t["depart"] or "00:00"
            rows.append({"number": t["number"], "name": t["name"], "from": t["from"], "to": t["to"],
                         "depart": dep, "arrive": t["arrive"], "day_offset": None,
                         "duration": None, "run_days": None, "type": None, "unreserved": False,
                         "distance_km": None, "seats": t["seats"], "nearby_station": True})
        if cls:
            for t in rows:
                t["seats"] = {k: v for k, v in t.get("seats", {}).items() if k == cls}
    rows.sort(key=lambda t: mins(t["depart"]))
    return rows


def seats_text(seats, cls):
    parts = []
    for k in sorted(seats, key=lambda c: CLASS_ORDER.index(c) if c in CLASS_ORDER else 99):
        v = seats[k]
        fare = f"₹{v['fare']}" if v["fare"] else ""
        status = v["status"] or ""
        chance = f" {v['chance']}" if v["chance"] and cls else ""
        parts.append(f"{k} {fare} {status}{chance}".replace("  ", " ").strip())
    return " | ".join(parts)


def search_table(a, b, date, cls, rows):
    head = f"{a} to {b}" + (f"  {date:%a %d %b %Y}" if date else "  (all running days)")
    print(head + f"  {len(rows)} trains\n")
    for t in rows:
        arr = (t["arrive"] or "") + (f" +{t['day_offset']}" if t.get("day_offset") else "")
        where = "" if (t["from"], t["to"]) == (a, b) else f" [{t['from']}-{t['to']}]"
        line = f"  {t['depart']:<6}{arr:<9}{t['number']:<6} {t['name'][:22]:<22}{where}"
        if not date:
            line += f"  {days_text(t['run_days'])}"
        if t["unreserved"]:
            line += "  UNRESERVED (buy at counter)"
        elif date:
            s = seats_text(t.get("seats", {}), cls)
            line += f"  {s}" if s else "  no booking data"
        print(line)


# --- route ------------------------------------------------------------------

def train_info(train):
    meta = get(f"{ERAIL}/rail/getTrains.aspx", {"TrainNo": train, "DataSource": 0,
               "Language": 0, "Cache": "true"}).text
    parts = meta.split("^", 1)
    if len(parts) < 2:
        sys.exit(f"pp-trains: train {train} not found.")
    f = parts[1].split("~")
    # Same field layout as a between-stations record; the route id follows the type.
    comp = next((x for x in f if x.startswith(",,En:")), "")
    coaches = [c.split(",")[1] for c in comp.split(":")[1:] if c.count(",") == 2]
    classes = sorted({c.split(",")[2] for c in comp.split(":")[1:] if c.count(",") == 2} & set(CLASS_ORDER),
                     key=CLASS_ORDER.index) or sorted(set(re.findall(r"\b(1A|2A|3A|3E|SL|CC|EC|2S):{3}", parts[1])),
                                                      key=CLASS_ORDER.index)
    return {"number": f[0], "name": f[1], "origin": f[3], "origin_name": f[2],
            "destination": f[5], "destination_name": f[4], "depart": hhmm(f[10]), "arrive": hhmm(f[11]),
            "duration": hhmm(f[12]), "run_days": f[13], "type": f[32] or None,
            "route_id": f[33] if f[33].isdigit() else None,
            "distance_km": f[39] or None, "avg_speed_kmh": f[40] or None,
            "classes": classes, "coaches": coaches}


def route(train):
    info = train_info(train)
    if not info["route_id"]:
        sys.exit(f"pp-trains: no route id for {train}.")
    name, days = info["name"], info["run_days"]
    raw = get(f"{ERAIL}/data.aspx", {"Action": "TRAINROUTE", "Password": "2012", "Data1": info["route_id"],
              "Data2": 0, "Cache": "true"}).text
    stops = []
    # Stop records start after "~^", except the first, which follows "#^".
    for rec in re.split(r"[~#]\^", raw)[1:]:
        s = rec.split("~")
        if len(s) < 8 or not s[1]:
            continue
        stops.append({"n": int(s[0]) if s[0].isdigit() else s[0], "code": s[1], "station": html.unescape(s[2]),
                      "arrive": hhmm(s[3]) if s[3] != "First" else None,
                      "depart": hhmm(s[4]) if s[4] != "Last" else None,
                      "halt_min": s[5] or None, "km": s[6], "day": s[7]})
    return {"number": train, "name": name, "run_days": days, "stops": stops}


# --- live ---------------------------------------------------------------------

def live(train, start_day):
    txt = get(RY_LIVE + train, {"start_day": start_day}).text
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', txt, re.S)
    if not m:
        sys.exit("pp-trains: live page changed shape (no __NEXT_DATA__).")
    lts = json.loads(m.group(1))["props"]["pageProps"].get("ltsData") or {}
    if not lts.get("success"):
        sys.exit(f"pp-trains: no live data for {train}.")
    keep = ["train_number", "train_name", "train_start_date", "title", "new_message", "delay",
            "current_station_code", "current_station_name", "ahead_distance_text", "status_as_of",
            "next_station_code", "next_station_name", "platform_number", "eta", "etd",
            "distance_from_source", "total_distance", "data_from", "update_time"]
    out = {k: lts.get(k) for k in keep if lts.get(k) not in (None, "")}
    if out.get("current_station_name"):
        out["current_station_name"] = out["current_station_name"].rstrip("~")
    out["upcoming"] = [{"code": s.get("station_code"), "station": s.get("station_name"),
                        "sta": s.get("sta"), "eta": s.get("eta"), "delay_min": s.get("arrival_delay"),
                        "platform": s.get("platform_number")}
                       for s in (lts.get("upcoming_stations") or []) if s.get("sta")][:8]
    return out


# --- PNR ----------------------------------------------------------------------

def page_tokens(page):
    page = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", page, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", page))
    return [t.strip() for t in text.split("\n") if t.strip()]


def after(tokens, label, n=1, start=0):
    i = tokens.index(label, start)
    return tokens[i + 1:i + 1 + n]


def pnr(number):
    if not re.fullmatch(r"\d{10}", number):
        sys.exit("pp-trains: a PNR is 10 digits.")
    tok = page_tokens(get(f"https://www.railyatri.in/pnr-status/{number}").text)
    if "CHART STATUS" not in tok:
        sys.exit("pp-trains: PNR not found, or the RailYatri page changed shape.")
    try:
        # Station cells read "MUMBAI CENTRAL | MMCT", then the time.
        frm = after(tok, "FROM", 2)
        to = after(tok, "TO", 2, tok.index("FROM"))
        (fname, fcode), (tname, tcode) = [[x.strip() for x in s[0].rsplit("|", 1)] for s in (frm, to)]
        train = after(tok, "TRAIN NAME :", 2)
        out = {"pnr": number, "status": after(tok, "CURRENT STATUS")[0],
               "chart": after(tok, "CHART STATUS")[0],
               "train": train[0], "train_name": train[1].lstrip("‒- ").strip(),
               "from": fcode, "from_name": fname, "depart": frm[1],
               "to": tcode, "to_name": tname, "arrive": to[1],
               "date": after(tok, "DAY OF BOARDING")[0], "class": after(tok, "CLASS")[0],
               "platform_tentative": after(tok, "PF# (TENTATIVE)")[0]}
    except (ValueError, IndexError):
        sys.exit("pp-trains: couldn't read the PNR page; its layout changed.")
    # Passenger rows are groups of 4 after the COACH/BERTH header: "1.", booking, current, berth.
    rows, i = [], tok.index("COACH/BERTH") + 1
    while i + 3 < len(tok) and re.fullmatch(r"\d+\.", tok[i]):
        rows.append({"n": int(tok[i][:-1]), "booking": tok[i + 1], "current": tok[i + 2],
                     "coach_berth": tok[i + 3]})
        i += 4
    out["passengers"] = rows
    return out


def main():
    p = argparse.ArgumentParser(prog="pp-trains", description=__doc__.splitlines()[0])
    p.add_argument("--table", action="store_true", help="human table instead of JSON")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="trains from ORIGIN to DEST, with seats when DATE is given")
    s.add_argument("origin")
    s.add_argument("dest")
    s.add_argument("date", nargs="?", help="2026-11-01, 01-11-2026, '1 nov', today, tomorrow")
    s.add_argument("--class", dest="cls", help="only this class, e.g. 3A, SL, CC")
    s.add_argument("--available", action="store_true", help="only trains with a bookable seat (AVL/RAC)")
    s.add_argument("--after", help="only trains leaving at or after HH:MM")

    st = sub.add_parser("stations", help="find station codes by name")
    st.add_argument("query")

    r = sub.add_parser("route", help="every stop of a train")
    r.add_argument("train")

    lv = sub.add_parser("live", help="live running status")
    lv.add_argument("train")
    lv.add_argument("--started", default="today", help="today, yesterday, or days ago (0, 1, 2)")

    tr = sub.add_parser("train", help="one train: ends, times, days, classes, coach order")
    tr.add_argument("train")

    pn = sub.add_parser("pnr", help="booking status, coach and berth for a PNR")
    pn.add_argument("number")

    args = p.parse_args()

    if args.cmd == "train":
        t = train_info(args.train)
        if args.table:
            print(f"{t['number']} {t['name']}  ({t['type'] or '?'})")
            print(f"  {t['origin_name']} ({t['origin']}) {t['depart']} -> {t['destination_name']} "
                  f"({t['destination']}) {t['arrive']}  {t['duration']}h, {t['distance_km']} km")
            print(f"  runs {days_text(t['run_days'])}   classes {' '.join(t['classes']) or '?'}")
            if t["coaches"]:
                print(f"  coach order (engine first): {' '.join(t['coaches'])}")
            else:
                print("  coach order: not published for this train")
        else:
            print(json.dumps(t, indent=2, ensure_ascii=False))
        return

    if args.cmd == "pnr":
        d = pnr(args.number)
        if args.table:
            print(f"PNR {d['pnr']}  {d['status']}  chart {d['chart'].lower()}")
            print(f"  {d['train']} {d['train_name']}  {d['date']}  {d['class']}")
            print(f"  {d['from_name']} ({d['from']}) {d['depart']} -> {d['to_name']} ({d['to']}) {d['arrive']}"
                  f"  PF {d['platform_tentative']} (tentative)")
            for r in d["passengers"]:
                print(f"  {r['n']}. {r['current']:<12} {r['coach_berth']:<10} (booked: {r['booking']})")
        else:
            print(json.dumps(d, indent=2, ensure_ascii=False))
        return

    if args.cmd == "stations":
        hits = suggest(args.query)
        if args.table:
            for h in hits:
                print(f"  {h['code']:<6}{h['name']:<32}{h['city'] or ''}, {h['state'] or ''}")
        else:
            print(json.dumps(hits, indent=2, ensure_ascii=False))
        return

    if args.cmd == "route":
        data = route(args.train)
        if args.table:
            print(f"{data['number']} {data['name']}  runs {days_text(data['run_days'])}\n")
            print(f"  {'#':<3}{'CODE':<7}{'STATION':<24}{'ARR':<7}{'DEP':<7}{'KM':<6}DAY")
            for s in data["stops"]:
                print(f"  {s['n']:<3}{s['code']:<7}{s['station'][:22]:<24}{s['arrive'] or '-':<7}"
                      f"{s['depart'] or '-':<7}{s['km']:<6}{s['day']}")
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))
        return

    if args.cmd == "live":
        start = {"today": 0, "yesterday": 1}.get(args.started, args.started)
        data = live(args.train, int(start))
        if args.table:
            print(f"{data.get('train_number')} {data.get('train_name')}  started {data.get('train_start_date')}")
            print(f"  {data.get('title')}. {data.get('new_message', '')}")
            if "delay" in data:
                print(f"  delay: {data['delay']} min")
            if data.get("current_station_name"):
                print(f"  at/near: {data['current_station_name']} ({data.get('ahead_distance_text', '')})"
                      f"  {data.get('status_as_of', '')}")
            if data.get("next_station_name"):
                print(f"  next: {data['next_station_name']}")
            if data.get("platform_number"):
                print(f"  platform: {data['platform_number']}")
            for u in data["upcoming"]:
                print(f"    {u['code']:<6}{u['station'][:22]:<24} sched {u['sta']:<6} eta {u['eta']:<6}"
                      f" +{u['delay_min'] or 0}m  pf {u['platform'] or '-'}")
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))
        return

    a, b = resolve(args.origin), resolve(args.dest)
    date = parse_date(args.date)
    cls = args.cls.upper() if args.cls else None
    rows = search(a, b, date, cls)
    if args.after:
        rows = [t for t in rows if mins(t["depart"]) >= mins(args.after)]
    if args.available:
        rows = [t for t in rows if t["unreserved"] or any(
            (v["status"] or "").startswith(("AVL", "RAC")) for v in t.get("seats", {}).values())]
    if args.table:
        search_table(a, b, date, cls, rows)
    else:
        print(json.dumps({"from": a, "to": b, "date": date.isoformat() if date else None,
                          "results": rows}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
