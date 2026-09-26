"""Extra evidence that turns "Needs you" rows into proven ones.

- Google Pay Takeout (`data/raw/gpay/**/My Activity.html`): the exact time of
  each UPI payment and which account paid it. SBI statements carry no time.
- Rapido receipts (`data/inbox/rapido/*.pdf`, emailed on request): ride time,
  fare, vehicle and both addresses.

A ride proves a payment only when the fare matches and the payment follows the
ride start within the window below, or, with no time known, when it is the only
payment of that fare on that day. Nothing is matched on a hunch.
"""

from __future__ import annotations

import datetime as dt
import html
import logging
import re
from pathlib import Path

import pypdf

logging.getLogger("pypdf").setLevel(logging.ERROR)

# The owner pays the captain after the ride: seen 3 to 36 minutes after start.
AFTER_MIN, AFTER_MAX = -10, 120


def gpay_events(data):
    """[{ts, amount, to, source}] for every Paid/Sent entry, deduped across exports."""
    seen, out = set(), []
    for f in sorted((data / "raw" / "gpay").glob("**/My Activity.html")):
        t = f.read_text(errors="ignore")
        for c in re.findall(r'<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">(.*?)</div>', t, re.S):
            x = html.unescape(re.sub(r"<[^>]+>", " ", c.replace("<br>", " | ")))
            m = re.match(r"\s*(Paid|Sent)\s+₹([\d,]+\.\d\d)(?: to (.+?))?(?: using Bank Account (\S+))?\s*\|\s*"
                         r"(\w{3} \d{1,2}, \d{4}, [\d:]+\s?[AP]M)", x)
            if not m:
                continue
            ts = dt.datetime.strptime(m[5].replace(" ", " "), "%b %d, %Y, %I:%M:%S %p")
            acct = m[4] or ""
            src = "neu" if acct.startswith("6529") else "sbi" if acct.endswith("1272") else None
            key = (ts, m[2], acct)
            if src and key not in seen:
                seen.add(key)
                out.append({"ts": ts, "amount": float(m[2].replace(",", "")), "to": (m[3] or "").strip(),
                            "source": src, "kind": m[1]})
    return out


def _locality(addr):
    """The area just before 'Bengaluru', e.g. 'Fraser Town'. Never the street address."""
    if "560300" in addr or "Kempegowda" in addr:
        return "airport"
    parts = [p.strip() for p in addr.split(",")]
    for i, p in enumerate(parts):
        if p.startswith("Bengaluru") and i > 0:
            return parts[i - 1]
    return "somewhere"


def _place(addr, places):
    for key, label, pats in places:
        if any(p.lower() in addr.lower() for p in pats):
            return label
    return _locality(addr)


def rapido_rides(data, places):
    rides = {}
    for f in sorted((data / "inbox" / "rapido").glob("*.pdf")):
        try:
            t = "\n".join(p.extract_text() or "" for p in pypdf.PdfReader(str(f)).pages)
            t = t.replace("\ufb01", "fi").replace("\ufb02", "fl")  # PDF ligatures: "Whiteﬁeld"
        except Exception:
            continue
        rid = re.search(r"(RD\d{10,})", t)
        tm = re.search(r"(\w{3}) (\d{1,2})\w\w (\d{4}), (\d{1,2}:\d\d [AP]M)", t)
        price = re.search(r"₹\s*([\d,.]+)", t)
        if not (rid and tm and price) or rid[1] in rides:
            continue
        lines = t.splitlines()
        head = [l.strip() for l in lines[:lines.index("Booking History")]] if "Booking History" in lines else []
        i = next(k for k, l in enumerate(lines) if l.strip().startswith("₹"))
        body = " ".join(lines[i + 1:])
        body = re.sub(r"This document is issued.*?purposes\.", "|", body)
        body = re.sub(r"\*Selected Price.*?range", "|", body)
        parts = [p.strip() for p in body.split("|") if p.strip()]
        if len(parts) < 2:
            continue
        name = Path(f).name.upper()
        mode = "auto" if "AUTO_RECEIPT" in name else "cab" if "CAB_RECEIPT" in name else "bike taxi"
        # The receipt prints the drop address first, then the pickup.
        rides[rid[1]] = {"id": rid[1], "mode": mode, "price": float(price[1].replace(",", "")),
                         "ts": dt.datetime.strptime("%s %s %s %s" % tm.groups(), "%b %d %Y %I:%M %p"),
                         "to": _place(parts[0], places), "from": _place(parts[1], places),
                         "driver": head[2] if len(head) > 2 else "", "vehicle": head[3] if len(head) > 3 else "",
                         "drop": parts[0], "pickup": parts[1]}
    return sorted(rides.values(), key=lambda r: r["ts"])


def attach_times(rows, events):
    """Give SBI savings / Tata Neu rows the Google Pay time of the same payment."""
    pool = {}
    for e in events:
        pool.setdefault((e["source"], round(e["amount"], 2)), []).append(e)
    used = set()
    for r in rows:
        if r["source"] not in ("sbi", "neu") or r["amount"] is None or r["amount"] >= 0:
            continue
        d = dt.date.fromisoformat(r["date"])
        cands = [e for e in pool.get((r["source"], round(-r["amount"], 2)), [])
                 if id(e) not in used and abs((e["ts"].date() - d).days) <= 1]
        if not cands:
            continue
        # Same calendar day first, then the nearest day.
        e = min(cands, key=lambda e: (e["ts"].date() != d, abs((e["ts"].date() - d).days)))
        used.add(id(e))
        if not r["time"]:
            r["time"] = e["ts"].strftime("%H:%M")
        r.setdefault("details", []).append("Google Pay: %s%s at %s" % (
            e["kind"], " to " + e["to"] if e["to"] else "", e["ts"].strftime("%-d %b %H:%M")))
        r["_ts"] = e["ts"]
        r["_gkind"] = e["kind"]


def match_rides(rows, rides):
    """Tag the payment each Rapido ride was paid with. Returns the number matched."""
    n = 0
    open_rows = [r for r in rows if r["status"] == "needs" and r["amount"] is not None and r["amount"] < 0
                 and r["source"] in ("sbi", "neu")]
    taken = set()
    for ride in rides:
        timed = [r for r in open_rows if r["id"] not in taken and r.get("_ts") and abs(-r["amount"] - ride["price"]) < 0.01
                 and AFTER_MIN <= (r["_ts"] - ride["ts"]).total_seconds() / 60 <= AFTER_MAX]
        how = None
        if timed:
            row = min(timed, key=lambda r: abs((r["_ts"] - ride["ts"]).total_seconds()))
            mins = int((row["_ts"] - ride["ts"]).total_seconds() / 60)
            how = "paid %d min after the ride started" % mins
        else:
            day = ride["ts"].date().isoformat()
            same = [r for r in open_rows if r["id"] not in taken and r["date"] == day
                    and abs(-r["amount"] - ride["price"]) < 0.01]
            rides_same = [x for x in rides if x["ts"].date() == ride["ts"].date() and x["price"] == ride["price"]]
            if len(same) == 1 and len(rides_same) == 1:
                row = same[0]
                how = "the only ₹%.0f payment that day" % ride["price"]
        if not how:
            continue
        taken.add(row["id"])
        route = "%s → %s" % (ride["from"], ride["to"])
        row.setdefault("details", []).extend([
            "Rapido ride %s at %s, driver %s, vehicle %s" % (ride["id"], ride["ts"].strftime("%-d %b %H:%M"),
                                                            ride.get("driver") or "?", ride.get("vehicle") or "?"),
            "From: " + ride.get("pickup", ride["from"]), "To: " + ride.get("drop", ride["to"])])
        row.update(tags=[ride["mode"], "commute", route], desc="Rapido %s: %s" % (ride["mode"], route),
                   status="proven",
                   why="Rapido receipt %s: %s ride at %s, fare ₹%.0f, %s." % (
                       ride["id"][-6:], ride["mode"], ride["ts"].strftime("%-d %b %H:%M"), ride["price"], how))
        n += 1
    return n


# ---------------------------------------------------------------- ride patterns
#
# Owner decision 2026-09-27: payments with no receipt may be tagged from the ride
# pattern the receipts show. Rows tagged this way carry the "pattern" tag and say
# so in "why", so they can be filtered and checked. A row is tagged only when
# exactly one route fits; anything ambiguous stays "Needs you".

MIN_RIDES = 5          # a route needs this many receipts before it becomes a pattern
PAY_LAG_H = 1          # payment lands up to an hour after the ride starts
MAX_PAYEE_SEEN = 3     # captains rarely repeat; a payee paid more often is someone else


def learn_patterns(rides):
    by = {}
    for r in rides:
        by.setdefault((r["from"], r["to"]), []).append(r)
    out = []
    for (a, b), rs in by.items():
        if len(rs) < MIN_RIDES or a == b:
            continue
        days = {d for d in range(7) if sum(1 for r in rs if r["ts"].weekday() == d) >= 2}
        hours = sorted(r["ts"].hour for r in rs)
        lo, hi = hours[len(hours) // 10], hours[-1 - len(hours) // 10]
        fares = sorted(r["price"] for r in rs)
        modes = {}
        for r in rs:
            modes[r["mode"]] = modes.get(r["mode"], 0) + 1
        out.append({"route": "%s → %s" % (a, b), "days": days, "h_lo": lo, "h_hi": hi + PAY_LAG_H,
                    "f_lo": fares[0], "f_hi": fares[-1], "n": len(rs),
                    "mode": max(modes, key=modes.get)})
    return out


DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def apply_patterns(rows, patterns):
    seen = {}
    for r in rows:
        seen[r["payee_key"]] = seen.get(r["payee_key"], 0) + 1
    n = 0
    for r in rows:
        if (r["status"] != "needs" or r["source"] not in ("sbi", "neu") or r["amount"] is None
                or r["amount"] >= 0 or not r.get("_ts") or seen[r["payee_key"]] > MAX_PAYEE_SEEN):
            continue
        ts, fare = r["_ts"], -r["amount"]
        fits = [p for p in patterns if ts.weekday() in p["days"] and p["h_lo"] <= ts.hour <= p["h_hi"]
                and p["f_lo"] <= fare <= p["f_hi"]]
        if len(fits) != 1:
            continue
        p = fits[0]
        r.update(tags=[p["mode"], "commute", p["route"], "pattern"], desc="%s: %s (no receipt)" % (p["mode"].capitalize(), p["route"]),
                 status="confirmed",
                 why="No receipt. It fits your %s pattern: %s, %02d:00–%02d:59, ₹%.0f–%.0f, learned from %d Rapido receipts. "
                     "Pattern tagging approved by you on 27 Sep." % (
                         p["route"], "/".join(DAYS[d] for d in sorted(p["days"])), p["h_lo"], p["h_hi"],
                         p["f_lo"], p["f_hi"], p["n"]))
        n += 1
    return n


RIDE_FARE = (40, 100)   # the fare band the receipts show for autos and bike taxis


def apply_ride_fallback(rows):
    """Owner decision 2026-09-27: a small QR payment to a one-off person is a ride,
    route unknown. Only after the route patterns had their turn."""
    seen = {}
    for r in rows:
        seen[r["payee_key"]] = seen.get(r["payee_key"], 0) + 1
    n = 0
    for r in rows:
        if (r["status"] == "needs" and r["source"] in ("sbi", "neu") and r.get("_gkind") == "Paid"
                and r["amount"] is not None and RIDE_FARE[0] <= -r["amount"] <= RIDE_FARE[1]
                and seen[r["payee_key"]] <= 2):
            r.update(tags=["ride", "commute", "pattern"], desc="Ride, route unknown (no receipt)", status="confirmed",
                     why="No receipt. ₹%.0f paid by QR to a one-off payee, inside your ₹%d–%d ride fares. "
                         "Assumed a ride, as you approved on 27 Sep." % (-r["amount"], RIDE_FARE[0], RIDE_FARE[1]))
            n += 1
    return n


# ---------------------------------------------------------------- Uber

UBER_TIP = 15          # the owner rounds a cash fare up (₹65.76 paid as ₹70)
UBER_LAG = (-10, 60)   # minutes after the ride ends


def _uber_parse(t):
    """Both Uber receipt layouts -> (total, method, day, start, end, vehicle, km, plate, pickup, drop, driver)."""
    total = re.search(r"Total ₹([\d,]+\.?\d*)", t)
    plate = re.search(r"License Plate: (\S+)", t)
    driver = re.search(r"You rode with (.+?) \d\.\d\d", t)
    # Three layouts seen: "Payments Cash ₹65.76 9/26/26 2:57 pm", "Payments Cash ₹76.02 11/15/25 9:16 PM"
    # and "Payments Cash 9/10/25 12:55 AM ₹84.10"; trip details with "kilometres," or "kilometers |".
    hm = r"\d{1,2}:\d\d [apAP][mM]"
    pay = re.search(r"Payments (.+?) (?:₹[\d,.]+ )?(\d{1,2})/(\d{1,2})/(\d\d) " + hm, t)
    end = r"(?=\d{1,2}:\d\d [apAP][mM]|You rode with|Report lost item|Contact support)"
    det = re.search(r"Trip details (.+?) ([\d.]+) kilomet(?:re|er)s, ((?:\d+ hours? )?\d+) minutes(?: License Plate: \S+)? "
                    r"(" + hm + r") (.+?) (" + hm + r") (.+?) " + end, t)
    if not det:
        det = re.search(r"(\w+(?: \w+)?) ([\d.]+) kilometers \| ((?:\d+ hours? )?\d+) minutes (" + hm + r") (.+?) (" + hm + r") (.+?) " + end, t)
    if not (total and pay and det):
        return None
    day = dt.date(2000 + int(pay[4]), int(pay[2]), int(pay[3]))
    return (float(total[1].replace(",", "")), pay[1].strip(), day, det[4], det[6], det[1], det[2],
            plate[1] if plate else "", det[5].strip(), det[7].strip(), driver[1].strip() if driver else "")


def uber_rides(data, places):
    import json
    out = []
    for f in sorted((data / "inbox" / "uber").glob("*.json")):
        got = _uber_parse(json.loads(f.read_text())["text"])
        if not got:
            continue
        price, method, day, t0, t1, vehicle, km, plate, pickup, drop, driver = got
        at = lambda hm: dt.datetime.combine(day, dt.datetime.strptime(hm.upper(), "%I:%M %p").time())
        start, end = at(t0), at(t1)
        if end < start:
            start -= dt.timedelta(days=1)
        v = vehicle.lower()
        mode = "auto" if "auto" in v else "bike taxi" if ("bike" in v or "moto" in v) else "cab"
        out.append({"id": f.stem, "mode": mode, "price": price, "ts": start, "end": end, "method": method,
                    "pickup": pickup, "drop": drop, "vehicle": plate, "km": km, "driver": driver,
                    "from": _place(pickup, places), "to": _place(drop, places)})
    return sorted(out, key=lambda r: r["ts"])


def match_uber(rows, rides):
    n = 0
    taken = set()
    for u in rides:
        route = "%s → %s" % (u["from"], u["to"])
        facts = ["Uber %s %s–%s, %s km, driver %s, plate %s, paid by %s" % (
                     u["mode"], u["ts"].strftime("%-d %b %H:%M"), u["end"].strftime("%H:%M"), u["km"],
                     u["driver"] or "?", u["vehicle"] or "?", u["method"]),
                 "From: " + u["pickup"], "To: " + u["drop"]]
        if u["method"].lower() == "cash":
            cands = [r for r in rows if r["id"] not in taken and r["status"] == "needs" and r.get("_ts")
                     and r["amount"] is not None and u["price"] - 0.01 <= -r["amount"] <= u["price"] + UBER_TIP
                     and UBER_LAG[0] <= (r["_ts"] - u["end"]).total_seconds() / 60 <= UBER_LAG[1]]
            if cands:
                row = min(cands, key=lambda r: abs((r["_ts"] - u["end"]).total_seconds()))
                why = "Uber receipt: %s ride, fare ₹%.2f paid in cash; this ₹%.0f UPI to the driver came %d min after the ride ended." % (
                    u["mode"], u["price"], -row["amount"], int((row["_ts"] - u["end"]).total_seconds() / 60))
            else:
                # No payment time known: accept only the one payment that day in the fare range.
                day = [r for r in rows if r["id"] not in taken and r["status"] == "needs" and not r.get("_ts")
                       and r["source"] in ("sbi", "neu") and r["date"] == u["end"].date().isoformat()
                       and r["amount"] is not None and u["price"] - 0.01 <= -r["amount"] <= u["price"] + UBER_TIP]
                if len(day) != 1:
                    continue
                row = day[0]
                why = "Uber receipt: %s ride, fare ₹%.2f paid in cash; this ₹%.0f UPI is the only payment that day in that range." % (
                    u["mode"], u["price"], -row["amount"])
        else:
            cands = [r for r in rows if r["id"] not in taken and r["amount"] is not None and abs(-r["amount"] - u["price"]) < 0.01
                     and abs((dt.date.fromisoformat(r["date"]) - u["ts"].date()).days) <= 1 and "uber" in r.get("_hay", "").lower()]
            if not cands:
                continue
            row = cands[0]
            why = "Uber receipt: %s ride, fare ₹%.2f paid by %s." % (u["mode"], u["price"], u["method"])
        taken.add(row["id"])
        row.update(tags=[u["mode"], "commute"], desc="Uber %s: %s" % (u["mode"], route), status="proven", why=why)
        row.setdefault("details", []).extend(facts)
        n += 1
    return n
