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
                            "source": src})
    return out


def _locality(addr):
    """The area just before 'Bengaluru', e.g. 'Fraser Town'. Never the street address."""
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
                         "to": _place(parts[0], places), "from": _place(parts[1], places)}
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
        r["_ts"] = e["ts"]


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
        row.update(tags=[ride["mode"], "commute", route], desc="Rapido %s: %s" % (ride["mode"], route),
                   status="proven",
                   why="Rapido receipt %s: %s ride at %s, fare ₹%.0f, %s." % (
                       ride["id"][-6:], ride["mode"], ride["ts"].strftime("%-d %b %H:%M"), ride["price"], how))
        n += 1
    return n
