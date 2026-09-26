"""Join SBI savings, three card statements and card alerts into one ledger.

The two rules this file exists to hold:

1. **Nothing is guessed silently.** A row gets tags only from a rule (`rules.json`),
   the bank's own row type (fee, refund, bill payment), receipts, patterns the owner
   approved (tagged `pattern`), or the owner. Every other row is `needs`, and says why.
2. **Nothing is hidden from the owner.** Rows carry the bank's full text plus a
   `details` list (UPI ID, bank, note, Google Pay payee, Rapido driver) so each
   payment can be identified. Owner decision 2026-09-27; the data stays in the
   gitignored data/ folder and the password-gated app.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from . import alerts as alerts_mod
from . import cards, evidence, savings
from .pdfs import ParseError, read_text

HERE = Path(__file__).resolve().parent
SOURCES = {"sbi": "SBI savings", "sbic": "SBI Card", "neu": "Tata Neu Infinity",
           "icici": "Amazon Pay ICICI"}
CARD_NAMES = {"sbic": "SBI Card", "neu": "Tata Neu", "icici": "ICICI"}
MISC_MAX, MISC_BEFORE = 200, "2026-06-01"
UNIDENTIFIED_UNTIL = "2026-05-31"  # owner: no misc for recent payments; newer unknowns stay "Needs you"
COMMUTE = {"cab", "auto", "metro", "bike taxi", "ride"}
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _h(*parts, n=16):
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:n]


def _nice(iso):
    d = dt.date.fromisoformat(iso)
    return "%d %s" % (d.day, MON[d.month - 1])


def rupees(v):
    s = "{:,.2f}".format(abs(v)).rstrip("0").rstrip(".")
    return "₹" + s


# ---------------------------------------------------------------- masking

_JUNK_NOTES = {"upi", "upiin", "upiint", "pay", "paym", "payme", "payment", "pay v", "upiintent", "rem"}


def sbi_view(remarks):
    """(payee, full text, payee identity, details) for an SBI savings remark.

    Owner decision 2026-09-27: nothing is masked. The data lives only in the
    gitignored data/ folder and the password-gated app, and the full remark is
    what identifies a payment."""
    raw = re.sub(r"\s+", " ", remarks).strip()
    r = re.sub(r"^(WDL TFR|DEP TFR|TFR)\s+", "", raw)
    r = re.sub(r"\s+\d{10,}\s+AT\s+\d+\s+.*$", "", r)
    m = re.match(r"UPI/(DR|CR)/([^/]*)/([^/]*)/([^/]*)/([^/]*)/?(.*)$", r)
    if m:
        name = m[3].strip() or "unknown"
        bank, vpa, note = m[4].replace(" ", ""), m[5].strip(), m[6].strip()
        if re.fullmatch(r"[\d#]+", vpa) or not vpa:
            ident = "name:%s|%s" % (name.upper(), bank.upper())
        else:
            ident = "vpa:" + vpa.lower().replace(" ", "")
        details = ["UPI %s %s" % ("to" if m[1] == "DR" else "from", name), "Bank: " + bank]
        if vpa:
            details.append("UPI ID (as the bank prints it): " + vpa)
        if note and note.casefold() not in _JUNK_NOTES:
            details.append("Note: " + note)
        details.append("UPI ref: " + m[2].strip())
        return name, r, ident, details
    return r[:40], r, "text:" + re.sub(r"[^A-Z]", "", r.upper())[:40], []


def card_view(text):
    raw = re.sub(r"\s+", " ", text).strip()
    ident = "card:" + (raw.lower() if "@" in raw else re.sub(r"[^A-Z]", "", re.sub(
        r"^(UPI-|EMI UPI-|RAZ\*|PTM\*|ING\*|CAS\*|WWW )", "", raw, flags=re.I).upper())[:14])
    payee = re.sub(r"^(UPI-|EMI UPI-|RAZ\*|PTM\*|ING\*|CAS\*|UPI to )", "", raw).strip()
    return payee, raw, ident, []


# ---------------------------------------------------------------- rules

def load_rules():
    return json.loads((HERE / "rules.json").read_text())["rules"]


def match_rule(rules, source, hay, amount, date=None):
    h = hay.casefold()
    for r in rules:
        if r.get("source") and source not in r["source"]:
            continue
        if date and (date < r.get("from", "0000") or date > r.get("until", "9999")):
            continue
        if "amount" in r and amount is not None and abs(abs(amount) - r["amount"]) > 0.01:
            continue
        for m in r["match"]:
            if m.casefold() in h:
                return r, m
    return None, None


def apply_rule(row, rule, hit):
    hit = re.sub(r"\d{6,}", lambda x: "••" + x[0][-4:], hit.strip())
    row["tags"] = list(rule["tags"])
    row["desc"] = rule.get("desc") or row["payee"]
    if rule.get("kind"):
        row["kind"] = rule["kind"]
    if rule["by"] == "owner":
        row["status"] = "confirmed"
        row["why"] = "Your rule: \"%s\" in the bank text is %s." % (hit, ", ".join(rule["tags"]))
    else:
        row["status"] = "proven"
        row["why"] = "The bank text names %s (\"%s\"), so it is %s." % (
            row["desc"], hit, ", ".join(rule["tags"]))


def _month_span(a, b):
    return (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7]) + 1


# ---------------------------------------------------------------- loading

def load_savings(data, password, errors):
    files = sorted((data / "inbox" / "statements" / "sbi").glob("*.pdf")) + sorted((data / "raw").glob("*.pdf"))
    rows = {}
    newest = None
    for f in files:
        try:
            text = read_text(f, [password])
            got = savings.parse_estatement(text) if savings.is_estatement(text) else savings.parse_download(f, password)
        except (ParseError, Exception) as e:  # one bad file must not sink the rest
            errors.append({"source": "sbi", "file": f.name, "error": str(e)[:160]})
            continue
        for r in got:
            rid = "sbi-" + _h(r["date"], r["debit"], r["credit"], r["balance"])
            old = rows.get(rid)
            if not old or len(r["text"]) > len(old["text"]):
                rows[rid] = r
            if not newest or r["date"] > newest:
                newest = r["date"]
    return rows, newest


def load_cards(data, passwords, errors):
    stmts, copies = {}, []
    for src in cards.PARSERS:
        for f in sorted((data / "inbox" / "statements" / src).glob("*.pdf")):
            try:
                text = read_text(f, passwords.get(src, []))
                old = re.search(r"Statement for HDFC Bank Credit Card\s*Statement\s*Date:(\d\d)/(\d\d)/(\d{4})", text)
                if src == "neu" and old:
                    # HDFC re-sends old statements in its older layout; the monthly one is used.
                    copies.append((f.name, "%s-%s-%s" % (old[3], old[2], old[1])))
                    continue
                s = cards.PARSERS[src](text)
            except (ParseError, Exception) as e:
                errors.append({"source": src, "file": f.name, "error": str(e)[:160]})
                continue
            s["id"] = "%s-%s" % (src, s["period_to"])
            stmts[s["id"]] = s  # the same statement from two files collapses
    for name, day in copies:
        if "neu-" + day not in stmts:
            errors.append({"source": "neu", "file": name,
                           "error": "an HDFC statement of %s in the older layout, and no monthly copy of it" % day})
    return sorted(stmts.values(), key=lambda s: (s["source"], s["period_to"]))


def load_alerts(data):
    msgs = [json.loads(p.read_text()) for p in sorted((data / "inbox" / "alerts").glob("*.json"))]
    return alerts_mod.rows_from(msgs)


# ---------------------------------------------------------------- build

def _card_row(src, s, r, occ):
    payee, text, ident, details = card_view(r["text"])
    signed = -r["amount"] if r["dc"] == "D" else r["amount"]
    row = {"id": "%s-%s" % (src, _h(src, r["date"], r["amount"], r["dc"], occ)),
           "source": src, "date": r["date"], "time": r["time"], "amount": signed, "fx": r["fx"],
           "kind": "spend" if r["dc"] == "D" else "refund", "final": True,
           "text": text, "payee": payee, "payee_key": _h(ident, n=12),
           "tags": [], "desc": None, "status": "needs", "why": "", "stmt": s["id"] if s else None,
           "details": details + (["Foreign amount: " + r["fx"]] if r.get("fx") else []), "_hay": r["text"]}
    if r.get("fee"):
        kind = ("Annual fee" if "ANNUAL" in text.upper() else "Foreign-currency markup" if "MARKUP" in text.upper()
                else "GST on fees" if "GST" in text.upper() else "Card fee")
        row.update(tags=["fees"], desc=kind, status="proven",
                   why="A fee printed on the %s statement." % CARD_NAMES[src])
    elif r["dc"] == "C" and re.search(r"PAYMENT RECEIVED|BBPS PAYMENT|CC PAYMENT|BPPY", r["text"], re.I):
        row.update(kind="payment", tags=["card bill"], desc="Bill payment received", status="proven",
                   why="The card statement shows this as your bill payment. Hidden from spending: "
                       "the purchases it paid for are already rows.")
    return row


# Everyday money that is not part of a trip even when it falls on trip days.
TRIP_KINDS = ("stay", "food", "bus", "auto", "metro")
NOT_TRIP = {"rent", "cook", "family", "loan", "subscription", "bills", "card bill", "work tools", "education",
            "salary", "interest", "fees", "refund"}
STAY = re.compile(r"ibibo|goibibo|makemytrip|airbnb|oyo|hostel|homestay|hotel|molly", re.I)
BUS = re.compile(r"redbus|irctc|abhibus|ksrtc|bus", re.I)


def tag_trips(rows, trips):
    """Owner decision 2026-09-27: trip spending gets "trip" plus "<trip>-stay/food/bus/auto/misc".
    Trips live in data/config.json: [{"name", "from", "to", "book_from"}]."""
    for t in trips:
        for r in rows:
            if r["kind"] != "spend" or set(r["tags"]) & NOT_TRIP:
                continue
            during = t["from"] <= r["date"] <= t["to"]
            booking = t.get("book_from", t["from"]) <= r["date"] < t["from"] and "travel" in r["tags"]
            if not (during or booking):
                continue
            hay = "%s %s %s" % (r.get("_hay", ""), r["text"], r["desc"] or "")
            kind = ("stay" if STAY.search(hay) else "bus" if BUS.search(hay) else
                    "auto" if set(r["tags"]) & {"taxi", "auto", "cab", "bike taxi", "ride"} else
                    "metro" if "metro" in r["tags"] else
                    "food" if set(r["tags"]) & {"food", "grocery"} else None)
            note = "Part of your %s trip (%s to %s)." % (t["name"].capitalize(), _nice(t["from"]), _nice(t["to"]))
            # Unknown trip spending stays "Needs you": the owner picks stay/food/bus/auto.
            r["tags"] = r["tags"] + ["trip"] + (["%s-%s" % (t["name"], kind)] if kind else [])
            r["trip"] = t["name"]
            if r["status"] == "needs":
                r["why"] = note + " What was it: stay, food, bus or auto?"
            else:
                r["why"] = r["why"] + " " + note


# Owner decision 2026-09-27: every row gets ONE main tag and at most one sub-tag,
# tags = [main] or [main, sub]. Fine detail (route, person) stays in the description.
MAINS = ["food", "grocery", "commute", "trip", "travel", "shopping", "subscription", "work", "home", "bills",
         "health", "personal care", "fitness", "entertainment", "family", "education", "bank", "income", "misc"]

# old tag -> (main, fixed sub or None = derive the sub from the description)
MAIN_OF = {
    "taxi": ("commute", "taxi"), "auto": ("commute", "taxi"), "cab": ("commute", "taxi"),
    "bike taxi": ("commute", "taxi"), "ride": ("commute", "taxi"), "metro": ("commute", "metro"),
    "rent": ("home", "rent"), "cook": ("home", "cook"), "home services": ("home", None),
    "loan": ("bank", "loan"), "card bill": ("bank", "card bill"), "fees": ("bank", "fees"),
    "salary": ("income", "salary"), "interest": ("bank", "interest"), "refund": ("income", "refund"),
    "protein": ("fitness", "protein"), "fitness": ("fitness", "gym"), "work tools": ("work", None),
    "personal care": ("personal care", None), "wallet": ("bank", "wallet"), "fuel": ("travel", "fuel"),
}

# Sub-tag from the description, per main. First keyword hit wins; None = no sub-tag.
SUBS = {
    "food": [("ownly", "ownly"), ("swiggy", "swiggy"), ("zomato", "zomato"), ("eatclub", "eatclub"), ("eatsure", "eatsure"),
             ("swish", "swish"), ("rebel foods", "rebel foods"), ("domino", "dominos"), ("kfc", "kfc"),
             ("", "eating out")],
    "grocery": [("instamart", "instamart"), ("zepto", "zepto"), ("blinkit", "blinkit"), ("amazon", "amazon fresh"),
                ("flipkart", "flipkart minutes"), ("akshayakalpa", "milk"), ("bigbasket", "bigbasket"), ("", "store")],
    "shopping": [("amazon", "amazon"), ("flipkart", "flipkart"), ("meesho", "meesho"), ("myntra", "myntra"),
                 ("ajio", "ajio"), ("nykaa", "nykaa"), ("lenskart", "eyewear"), ("decathlon", "sports"),
                 ("book", "books"), ("jewel", "jewellery"), ("", "clothes")],
    "health": [("dermat", "dermatologist"), ("physio", "physio"), ("pharmeasy", "pharmacy"), ("apollo", "pharmacy"),
               ("1mg", "pharmacy"), ("aster", "hospital"), ("", "clinic")],
    "personal care": [("barber", "barber"), ("mcaffeine", "cosmetics"), ("", None)],
    "home": [("plumber", "plumber"), ("livpure", "water purifier"), ("urban company", "urban company"), ("", None)],
    "bills": [("jio", "jio"), ("vi ", "vi"), ("vi recharge", "vi"), ("airtel", "airtel"), ("bescom", "electricity"),
              ("act ", "internet"), ("cred", "recharge"), ("", None)],
    "entertainment": [("movie", "movie"), ("bookmyshow", "movie"), ("cineplex", "movie"), ("", None)],
    "work": [("upwork", "upwork"), ("meta ads", "ads"), ("", None)],
}


def _sub_for(main, desc, fixed):
    if fixed:
        return fixed
    d = re.sub(r"^refund: ", "", (desc or "").lower())
    if main == "subscription":
        name = re.sub(r"\s*\(.*?\)", "", d).replace(" premium", "").replace(" autopay", "").strip()
        return (name + " sub") if name else None
    if main == "travel":
        return re.sub(r"\s*\(.*?\)", "", d).strip() or None
    for key, sub in SUBS.get(main, []):
        if key in d:
            return sub
    return None


def normalize_tags(row):
    tags = [t for t in row["tags"] if t not in ("commute", "pattern")]
    if "pattern" in row["tags"]:
        row["inferred"] = True
    if "trip" in tags:
        trip_sub = next((t for t in tags if "-" in t and t.rsplit("-", 1)[1] in TRIP_KINDS), None)
        if not trip_sub and "thailand" in (row["desc"] or "").lower():
            trip_sub = "thailand"
        trip_sub = trip_sub or row.get("trip")
        row["tags"] = ["trip"] + ([trip_sub] if trip_sub else [])
        return
    if not tags:
        row["tags"] = []
        return
    main, fixed = MAIN_OF.get(tags[0], (tags[0], None))
    if main not in MAINS:
        main, fixed = "misc", None
    sub = _sub_for(main, row["desc"], fixed)
    row["tags"] = [main] + ([sub] if sub else [])


def _slack(due):
    """CRED knocks a few rupees off a bill, so allow a small, bounded gap."""
    return min(50.0, max(2.0, due * 0.005))


def build(data, config, today=None, log=print):
    today = today or dt.date.today().isoformat()
    errors = []
    rules = load_rules()
    pw = config["password"]
    passwords = {k: (v if isinstance(v, list) else [v]) for k, v in config.get("passwords", {}).items()}

    sb, sbi_newest = load_savings(data, pw, errors)
    stmts = load_cards(data, passwords, errors)
    al = load_alerts(data)

    rows = []
    # SBI savings
    for rid, r in sb.items():
        payee, text, ident, details = sbi_view(r["text"])
        amt = round(r["credit"] - r["debit"], 2)
        rows.append({"id": rid, "source": "sbi", "date": r["date"], "time": None, "amount": amt,
                     "fx": None, "kind": "in" if amt > 0 else "spend", "final": True, "text": text,
                     "payee": payee, "payee_key": _h(ident, n=12), "tags": [], "desc": None,
                     "status": "needs", "why": "", "stmt": None, "details": details, "_hay": r["text"]})

    # Card statements
    last_to = {}
    for s in stmts:
        occ = Counter()
        for r in s["rows"]:
            k = (r["date"], r["amount"], r["dc"])
            occ[k] += 1
            rows.append(_card_row(s["source"], s, r, occ[k]))
        last_to[s["source"]] = max(last_to.get(s["source"], ""), s["period_to"])

    # Alerts after each card's last statement
    for src, arows in al.items():
        occ = Counter()
        for a in arows:
            if a["date"] <= last_to.get(src, ""):
                continue
            k = (a["date"], a["amount"] if a["amount"] is not None else a["fx"], "D")
            occ[k] += 1
            r = {"date": a["date"], "time": a["time"], "text": a["text"],
                 "amount": a["amount"] if a["amount"] is not None else 0.0, "dc": "D", "fx": a["fx"]}
            row = _card_row(src, None, r, occ[k])
            row["final"] = False
            if a["amount"] is None:
                row["amount"] = None
            row["maybe_dup"] = a["maybe_dup"]
            rows.append(row)

    # Google Pay first: its payee name ("Paid to LEON GRILL") is evidence the rules can read.
    events = evidence.gpay_events(data)
    evidence.attach_times(rows, events)
    for row in rows:
        if row.get("_gpay_to"):
            row["_hay"] += " | gpay:%s;" % row["_gpay_to"]

    # Rules
    for row in rows:
        if row["status"] != "needs":
            continue
        rule, hit = match_rule(rules, row["source"], row["_hay"], row["amount"], row["date"])
        if rule:
            apply_rule(row, rule, hit)
        if row["kind"] == "refund" and row["status"] == "needs":
            row.update(tags=["refund"], desc="Refund: " + row["payee"], status="proven",
                       why="The card statement shows money coming back from this shop.")
        elif row["kind"] == "refund":
            row["tags"] = row["tags"] + ["refund"]
            row["desc"] = "Refund: " + (row["desc"] or row["payee"])

    # Rapido rides (see evidence.py)
    rides = evidence.rapido_rides(data, config.get("places", []))
    matched = evidence.match_rides(rows, rides)
    ubers = evidence.uber_rides(data, config.get("places", []))
    uber_matched = evidence.match_uber(rows, ubers)
    log("evidence: %d Uber receipts, %d matched" % (len(ubers), uber_matched))
    tips = evidence.match_tips(rows)
    patterns = evidence.learn_patterns(rides)
    by_pattern = evidence.apply_patterns(rows, patterns)
    by_pattern += evidence.apply_ride_fallback(rows)
    log("evidence: %d Google Pay payments, %d Rapido rides, %d rides matched, %d tagged by %d ride patterns"
        % (len(events), len(rides), matched, by_pattern, len(patterns)))
    for p in patterns:
        log("  pattern %s: %s %02d-%02dh ₹%.0f-%.0f (%d rides)" % (
            p["route"], "/".join(evidence.DAYS[d] for d in sorted(p["days"])), p["h_lo"], p["h_hi"], p["f_lo"], p["f_hi"], p["n"]))

    # Owner decision 2026-09-27: small untagged payments before August are "misc" for now.
    for row in rows:
        if (row["status"] == "needs" and row["kind"] == "spend" and row["amount"] is not None
                and -MISC_MAX <= row["amount"] < 0 and row["date"] < MISC_BEFORE):
            row.update(tags=["misc"], desc="Small payment (temporary misc)", status="confirmed",
                       why="Untagged small payment before %s, marked temporary misc as you asked on 27 Sep." % _nice(MISC_BEFORE))

    # Owner, 27 Sep: every Flipkart payment is grocery by default (mostly Flipkart Minutes).
    for row in rows:
        if row["desc"] == "Flipkart order" and row["amount"] is not None and row["amount"] < 0:
            row.update(tags=["grocery"], desc="Flipkart Minutes", status="confirmed",
                       why="Your default: Flipkart payments are groceries. Change it if this was a normal Flipkart order.")
    fk = evidence.flipkart_orders(data)
    log("evidence: %d Flipkart orders, %d matched to payments" % (len(fk), evidence.match_flipkart(rows, fk)))

    tag_trips(rows, config.get("trips", []))

    # Owner decision 2026-09-27: what was still unknown on that day, the owner could not place.
    for row in rows:
        if row["status"] == "needs" and row["kind"] in ("spend", "in") and row["date"] <= UNIDENTIFIED_UNTIL:
            row.update(tags=["misc"], desc="Unidentified: %s" % row["payee"], status="confirmed",
                       why="You could not identify this when we went through the list on 27 Sep, so it is misc.")


    # Card bills: match each statement to the SBI payment that settled it
    bills = [r for r in rows if r["source"] == "sbi" and r["kind"] == "bill"]
    used = set()
    for s in stmts:
        s["paid"] = None
    for s in sorted(stmts, key=lambda s: s["stmt_date"]):
        if s["paid"]:
            continue  # already settled by a combined payment
        if s["due"] <= 1:
            s["paid"] = {"date": None, "amount": 0, "note": "Nothing to pay"}
            continue
        lo, hi = s["stmt_date"], (dt.date.fromisoformat(s["stmt_date"]) + dt.timedelta(days=45)).isoformat()
        cands = [b for b in bills if lo <= b["date"] <= hi and b["id"] not in used]
        hit = next((b for b in cands if abs(-b["amount"] - s["due"]) <= _slack(s["due"])), None)
        combo = None
        if not hit:
            for b in cands:
                for o in stmts:
                    if o is s or o["source"] == s["source"] or o.get("paid"):
                        continue
                    if abs(-b["amount"] - s["due"] - o["due"]) <= _slack(s["due"] + o["due"]) and lo <= b["date"]:
                        hit, combo = b, o
                        break
                if hit:
                    break
        if not hit:
            continue
        name = CARD_NAMES[s["source"]]
        if combo:
            used.add(hit["id"])
            both = "%s + %s" % (name, CARD_NAMES[combo["source"]])
            hit.update(desc="Card bills: %s" % both, status="proven",
                       why="One CRED payment of %s paid the %s bill (%s) and the %s bill (%s). The ₹%.0f gap is a CRED discount."
                           % (rupees(hit["amount"]), name, rupees(s["due"]), CARD_NAMES[combo["source"]],
                              rupees(combo["due"]), abs(-hit["amount"] - s["due"] - combo["due"])))
            for x in (s, combo):
                x["paid"] = {"date": hit["date"], "amount": -hit["amount"], "note": "Paid with %s in one CRED payment" % both, "row": hit["id"]}
        else:
            used.add(hit["id"])
            gap = abs(-hit["amount"] - s["due"])
            hit.update(desc="%s bill (statement %s)" % (name, _nice(s["stmt_date"])), status="proven",
                       why="Matches the %s statement total (%s)%s." % (name, rupees(s["due"]),
                           "" if gap < 1 else "; the %s gap is a CRED discount" % rupees(gap)))
            s["paid"] = {"date": hit["date"], "amount": -hit["amount"], "note": "Paid in full", "row": hit["id"]}
    for b in bills:
        if b["id"] in used:
            continue
        if re.search(r"SBI ?CARDS?", b["text"], re.I):
            b.update(status="proven", desc="SBI Card bill",
                     why="Paid straight to SBI Card. Its statement is not on file, so the amount is not cross-checked.")
        elif any(b["date"] < min((s["stmt_date"] for s in stmts if s["source"] == src), default="9999")
                 for src in cards.PARSERS):
            # Some card's statements start after this payment, so there is nothing to match it to.
            b.update(status="proven", desc="Card bill via CRED",
                     why="A CRED card bill payment from before the statements on file start, so it is not cross-checked.")
        else:
            b["status"] = "needs"
            b["why"] = "A CRED payment that matches no card statement total. Which bill was it?"

    # Needs-you reasons, from what the history can honestly say
    seen = Counter(r["payee_key"] for r in rows)
    first = {}
    for r in sorted(rows, key=lambda r: r["date"]):
        first.setdefault(r["payee_key"], r["date"])
    for r in rows:
        if r.get("maybe_dup"):
            r["status"] = "needs"
            r["why"] = ("Two emails for the same amount at the same shop on the same day. It may be one "
                        "payment sent twice. The statement will settle it.")
        elif r["status"] == "needs" and not r["why"]:
            n = seen[r["payee_key"]]
            d = dt.date.fromisoformat(first[r["payee_key"]])
            r["why"] = ("First payment to this payee. Nothing proves what it was." if n == 1 else
                        "Paid %d times since %s %d. Nothing in the bank text says what for." % (n, MON[d.month - 1], d.year))
        if r["fx"] and r["amount"] is None:
            r["why"] += " The email shows only %s: the rupee amount comes with the statement." % r["fx"]
        if not r["final"]:
            r["why"] += " From the purchase email; the next statement confirms it."
        r.pop("_hay", None)
        r.pop("_ts", None)
        r.pop("_gkind", None)
        r.pop("_gpay_to", None)

    for r in rows:
        normalize_tags(r)
    rows.sort(key=lambda r: (r["date"], r["time"] or ""), reverse=True)

    # Statement checks for the Cards page
    alert_rows = {src: rs for src, rs in al.items()}
    out_stmts = []
    for s in stmts:
        purchases = [r for r in s["rows"] if r["dc"] == "D" and not r["fee"]]
        checks = [{"ok": True, "text": "%d rows add up to %s" % (len(purchases), rupees(s["purchases"])),
                   "sub": "Same as the statement total"}]
        if s["fees"] > 0.001:
            fees = [r for r in s["rows"] if r["fee"]]
            checks.append({"ok": True, "text": "Fees found: %s" % rupees(s["fees"]),
                           "sub": " + ".join("%s %s" % (re.sub(r"\s*\(.*?\)", "", f["text"]).title(), rupees(f["amount"])) for f in fees) or "Finance charges"})
        inside = [a for a in alert_rows.get(s["source"], [])
                  if s["period_from"] <= a["date"] <= s["period_to"] and not a["maybe_dup"]]
        if inside:
            pool = [(dt.date.fromisoformat(r["date"]), r["amount"]) for r in purchases]
            matched = 0
            for a in inside:
                ad = dt.date.fromisoformat(a["date"])
                for i, (d, v) in enumerate(pool):
                    if v == a["amount"] and abs((d - ad).days) <= 2:
                        pool.pop(i)
                        matched += 1
                        break
            dups = sum(1 for a in inside if a["maybe_dup"])
            checks.append({"ok": True, "text": "%d of %d purchase emails matched" % (matched, len(inside)),
                           "sub": ("%d repeat email(s) ignored" % dups) if dups else "Emails and statement agree"})
        if s["paid"]:
            checks.append({"ok": True, "text": "Bill %s paid on %s" % (rupees(s["paid"]["amount"]), _nice(s["paid"]["date"])) if s["paid"]["date"] else "Nothing to pay",
                           "sub": s["paid"]["note"] + (" from SBI savings via CRED" if s["paid"]["date"] else "")})
        elif today <= (dt.date.fromisoformat(s["due_date"]) + dt.timedelta(days=3)).isoformat():
            checks.append({"ok": False, "wait": True, "text": "Bill %s not paid yet" % rupees(s["due"]),
                           "sub": "Due %s. We look for it in SBI savings" % _nice(s["due_date"])})
        else:
            checks.append({"ok": False, "wait": False, "text": "No SBI payment matches the %s bill" % rupees(s["due"]),
                           "sub": "Paid another way, or in parts? Check it"})
        out_stmts.append({k: s[k] for k in ("id", "source", "period_from", "period_to", "stmt_date", "due_date",
                                            "prev", "purchases", "fees", "payments", "due", "paid")}
                         | {"rows": len(s["rows"]), "checks": checks})

    # Source status for the Overview
    src_status = []
    for src, name in SOURCES.items():
        errs = [e for e in errors if e["source"] == src]
        if src == "sbi":
            detail = ("Statement rows up to %s. Every balance checks out." % _nice(sbi_newest)) if sbi_newest else "No statement yet"
            pending = 0
        else:
            last = [s for s in stmts if s["source"] == src]
            detail = ("Statement %s adds up." % _nice(last[-1]["stmt_date"])) if last else "No statement yet"
            if last and last[-1]["paid"]:
                detail += " Bill paid."
            pending = sum(1 for r in rows if r["source"] == src and not r["final"])
        note = ""
        if src == "sbi":
            # A locked copy is harmless when the rows we do have leave no month out.
            months = sorted({r["date"][:7] for r in rows if r["source"] == "sbi"})
            locked = [e for e in errs if "no saved password" in e["error"]]
            if locked and months and len(months) == _month_span(months[0], months[-1]):
                errs = [e for e in errs if e not in locked]
                note = "%d older email copies are locked with an old password. Nothing is missing." % len(locked)
        src_status.append({"source": src, "name": name, "ok": bool(sbi_newest if src == "sbi" else stmts) and not errs,
                           "detail": detail, "pending": pending, "note": note,
                           "errors": ["%s: %s" % (e["file"][:12], e["error"]) for e in errs]})

    ledger = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "rows": rows, "statements": out_stmts, "sources": src_status}
    log("ledger: %d rows, %d statements, %d needs you, %d file error(s)"
        % (len(rows), len(out_stmts), sum(1 for r in rows if r["status"] == "needs"), len(errors)))
    for e in errors:
        log("  skipped %s %s: %s" % (e["source"], e["file"], e["error"]))
    return ledger
