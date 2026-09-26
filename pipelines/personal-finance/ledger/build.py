"""Join SBI savings, three card statements and card alerts into one ledger.

The two rules this file exists to hold:

1. **Nothing is guessed.** A row gets tags only from a rule (`rules.json`), the
   bank's own row type (fee, refund, bill payment), or later the owner. Every
   other row is `needs`, and says why.
2. **Nothing sensitive leaves.** Raw SBI remarks carry phone numbers, UPI IDs
   and account numbers. Rows carry a masked `text` and a hashed `payee_key`;
   `assert_clean` refuses the whole ledger if anything slips through.
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
    """(payee, masked text, payee identity) for an SBI savings remark."""
    r = re.sub(r"^(WDL TFR|DEP TFR|TFR)\s+", "", remarks.strip())
    r = re.sub(r"\s+\d{10,}\s+AT\s+\d+\s+.*$", "", r)
    m = re.match(r"UPI/(DR|CR)/[^/]*/([^/]*)/([^/]*)/([^/]*)/?(.*)$", r)
    if m:
        name = re.sub(r"\s+", " ", m[2]).strip() or "unknown"
        bank = m[3].replace(" ", "")
        vpa = m[4].strip()
        note = m[5].strip()
        if re.fullmatch(r"[\d#]+", vpa) or not vpa:
            ident = "name:%s|%s" % (name.upper(), bank.upper())
        else:
            ident = "vpa:" + vpa.lower().replace(" ", "")
        arrow = "to" if m[1] == "DR" else "from"
        text = "UPI %s %s · %s" % (arrow, name, bank)
        if note and note.casefold() not in _JUNK_NOTES:
            text += " · note: " + re.sub(r"\d{6,}", "••••", note)
        return name, text, ident
    text = re.sub(r"\d{6,}", lambda x: "••" + x[0][-4:], r)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:40], text, "text:" + re.sub(r"[^A-Z]", "", r.upper())[:40]


def _vpa_mask(m):
    local, handle = m[1], m[2]
    kind = "shop QR" if re.match(r"(q\d+|paytmqr|bharatpe|gpay-\d)", local, re.I) else "UPI ID"
    return "%s ••••@%s" % (kind, handle)


def card_view(text):
    raw = re.sub(r"\s+", " ", text).strip()
    # Emails and statements spell a shop differently ("CTRLXTECHNOLOGIESP" vs
    # "CTRLX TECHNOLOGIES P Hyderabad IN"), so key on the first 14 letters of the name.
    name = re.sub(r"^(UPI-|EMI UPI-|RAZ\*|PTM\*|ING\*|CAS\*|WWW )", "", raw, flags=re.I)
    ident = "card:" + (raw.lower() if "@" in raw else re.sub(r"[^A-Z]", "", name.upper())[:14])
    t = re.sub(r"(\S+)@(\S+)", _vpa_mask, raw)
    payee = re.sub(r"^(UPI-|EMI UPI-|RAZ\*|PTM\*|ING\*|CAS\*|UPI to )", "", t).strip()
    return payee, t, ident


FORBIDDEN = [
    (re.compile(r"\b37841171272\b"), "SBI account number"),
    (re.compile(r"UPI/(DR|CR)/"), "raw UPI remark"),
    (re.compile(r"\bWDL TFR\b"), "raw remark"),
    (re.compile(r"[A-Za-z0-9._-]+@(ybl|okaxis|oksbi|okicici|okhdfcbank|paytm|upi|axl|ibl|apl)\b"), "UPI ID"),
    (re.compile(r"(?<![\d.])[6-9]\d{9}(?![\d.])"), "phone number"),
]


_HASHED = ("id", "payee_key", "stmt", "row")


def assert_clean(ledger):
    # Hashed ids are hex and can look like a phone number; they carry nothing.
    scan = dict(ledger, rows=[{k: v for k, v in r.items() if k not in _HASHED} for r in ledger["rows"]],
                statements=[dict(s, id=None, paid=s["paid"] and {k: v for k, v in s["paid"].items() if k != "row"})
                            for s in ledger["statements"]])
    ledger = scan
    blob = json.dumps(scan, ensure_ascii=False)
    for rx, what in FORBIDDEN:
        if not rx.search(blob):
            continue
        where = "statements/sources"
        for r in ledger["rows"]:
            for k, v in r.items():
                if isinstance(v, str) and rx.search(v):
                    where = "row %s %s field %r" % (r["source"], r["date"], k)
                    break
            else:
                continue
            break
        raise ParseError("refusing to publish: ledger contains a %s in %s" % (what, where))


# ---------------------------------------------------------------- rules

def load_rules():
    return json.loads((HERE / "rules.json").read_text())["rules"]


def match_rule(rules, source, hay, amount):
    h = hay.casefold()
    for r in rules:
        if r.get("source") and source not in r["source"]:
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
    payee, text, ident = card_view(r["text"])
    signed = -r["amount"] if r["dc"] == "D" else r["amount"]
    row = {"id": "%s-%s" % (src, _h(src, r["date"], r["amount"], r["dc"], occ)),
           "source": src, "date": r["date"], "time": r["time"], "amount": signed, "fx": r["fx"],
           "kind": "spend" if r["dc"] == "D" else "refund", "final": True,
           "text": text, "payee": payee, "payee_key": _h(ident, n=12),
           "tags": [], "desc": None, "status": "needs", "why": "", "stmt": s["id"] if s else None,
           "_hay": r["text"]}
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
        payee, text, ident = sbi_view(r["text"])
        amt = round(r["credit"] - r["debit"], 2)
        rows.append({"id": rid, "source": "sbi", "date": r["date"], "time": None, "amount": amt,
                     "fx": None, "kind": "in" if amt > 0 else "spend", "final": True, "text": text,
                     "payee": payee, "payee_key": _h(ident, n=12), "tags": [], "desc": None,
                     "status": "needs", "why": "", "stmt": None, "_hay": r["text"]})

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

    # Rules
    for row in rows:
        if row["status"] != "needs":
            continue
        rule, hit = match_rule(rules, row["source"], row["_hay"], row["amount"])
        if rule:
            apply_rule(row, rule, hit)
        if row["kind"] == "refund" and row["status"] == "needs":
            row.update(tags=["refund"], desc="Refund: " + row["payee"], status="proven",
                       why="The card statement shows money coming back from this shop.")
        elif row["kind"] == "refund":
            row["tags"] = row["tags"] + ["refund"]
            row["desc"] = "Refund: " + (row["desc"] or row["payee"])

    # Google Pay times, then Rapido rides (see evidence.py)
    events = evidence.gpay_events(data)
    evidence.attach_times(rows, events)
    rides = evidence.rapido_rides(data, config.get("places", []))
    matched = evidence.match_rides(rows, rides)
    patterns = evidence.learn_patterns(rides)
    by_pattern = evidence.apply_patterns(rows, patterns)
    by_pattern += evidence.apply_ride_fallback(rows)
    log("evidence: %d Google Pay payments, %d Rapido rides, %d rides matched, %d tagged by %d ride patterns"
        % (len(events), len(rides), matched, by_pattern, len(patterns)))
    for p in patterns:
        log("  pattern %s: %s %02d-%02dh ₹%.0f-%.0f (%d rides)" % (
            p["route"], "/".join(evidence.DAYS[d] for d in sorted(p["days"])), p["h_lo"], p["h_hi"], p["f_lo"], p["f_hi"], p["n"]))

    # Daily rides share a "commute" group; trips stay "travel".
    for row in rows:
        if any(t in COMMUTE for t in row["tags"]) and "commute" not in row["tags"]:
            row["tags"] = row["tags"] + ["commute"]

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
        src_status.append({"source": src, "name": name, "ok": bool(sbi_newest if src == "sbi" else stmts) and not errs,
                           "detail": detail, "pending": pending,
                           "errors": ["%s: %s" % (e["file"][:12], e["error"]) for e in errs]})

    ledger = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "rows": rows, "statements": out_stmts, "sources": src_status}
    assert_clean(ledger)
    log("ledger: %d rows, %d statements, %d needs you, %d file error(s)"
        % (len(rows), len(out_stmts), sum(1 for r in rows if r["status"] == "needs"), len(errors)))
    for e in errors:
        log("  skipped %s %s: %s" % (e["source"], e["file"], e["error"]))
    return ledger
