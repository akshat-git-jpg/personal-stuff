"""Card purchase alert emails -> rows for the days after the last statement.

These rows are "not final": the next statement replaces them. Three traps, all
seen in real mail:

- SBI Card sends a Transaction Alert AND an e-mandate email for one autopay
  charge. The e-mandate email is used only when no alert has the same date and
  amount.
- A bank sometimes sends the same alert twice, and sometimes two real charges
  look identical (two ₹60 metro rides). Emails alone cannot tell them apart, so
  a repeat is kept and flagged `maybe_dup`, never silently dropped.
- Some alerts give only a foreign amount (USD 23.60). `amount` is then None and
  `fx` carries it; the statement supplies the rupees later. Nothing is guessed.
"""

from __future__ import annotations

import datetime as dt
import re

MON = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def _amt(s):
    return round(float(s.replace(",", "")), 2)


def _row(date, text, amount, fx=None, time=None, flavor="alert"):
    return {"date": date, "time": time, "text": text.strip(), "amount": amount, "fx": fx,
            "flavor": flavor}


def _ymd(y, m, d):
    y = int(y)
    return dt.date(y + 2000 if y < 100 else y, int(m), int(d)).isoformat()


def parse_sbic(text):
    m = re.search(r"(Rs\.|USD)\s?([\d,]+\.?\d*) spent on your SBI Credit Card ending \d+ at (.+?) on (\d\d)/(\d\d)/(\d\d)", text)
    if m:
        cur, v = m[1], _amt(m[2])
        return _row(_ymd(m[6], m[5], m[4]), m[3], v if cur == "Rs." else None,
                    None if cur == "Rs." else "USD %.2f" % v)
    m = re.search(r"Rs\.\s?([\d,]+\.?\d*) done on your credit card ending \d+ .*? at (.+?) on (\d\d) (\w{3}) (\d\d)", text)
    if m:
        return _row(_ymd(m[5], MON[m[4]], m[3]), m[2], _amt(m[1]))
    m = re.search(r"(Rs\.|Transaction of USD|USD)\s?([\d,]+\.?\d*) at (.+?) against E-mandate.*?on (\d\d)-(\d\d)-(\d\d)", text)
    if m:
        v = _amt(m[2])
        rs = m[1] == "Rs."
        return _row(_ymd(m[6], m[5], m[4]), m[3], v if rs else None, None if rs else "USD %.2f" % v,
                    flavor="mandate")
    m = re.search(r"Rs\.\s?([\d,]+\.?\d*) Merchant: (.+?) SiHub ID.*?Date: (\d\d)-(\w{3})-(\d{4})", text)
    if m:
        return _row(_ymd(m[5], MON[m[4]], m[3]), m[2], _amt(m[1]), flavor="mandate")
    return None


def parse_neu(text):
    m = re.search(r"Rs\.\s?([\d,]+\.?\d*) has been debited from your RuPay Credit Card \(ending \d+\) Paid to (\S+) Date: (\d\d)-(\d\d)-(\d\d)", text)
    if not m:
        return None
    return _row(_ymd(m[5], m[4], m[3]), "UPI to " + m[2], _amt(m[1]))


def parse_icici(text):
    m = re.search(r"transaction of (INR|USD) ([\d,]+\.?\d*) on (\w{3}) (\d{1,2}), (\d{4}) at (\d\d:\d\d):\d\d\. Info: (.+?)\.", text)
    if not m:
        return None
    v = _amt(m[2])
    inr = m[1] == "INR"
    return _row(_ymd(m[5], MON[m[3]], m[4]), m[7], v if inr else None, None if inr else "USD %.2f" % v,
                time=m[6])


PARSERS = {"sbic": parse_sbic, "neu": parse_neu, "icici": parse_icici}


def rows_from(messages):
    """messages: [{id, source, ts, text}] -> alert rows per source, deduped as the
    module docstring says. Unparseable mails (offers, OTPs) are skipped."""
    out = {}
    for msg in sorted(messages, key=lambda m: m["ts"]):
        r = PARSERS[msg["source"]](msg["text"])
        if r is None:
            continue
        r["msg_id"] = msg["id"]
        out.setdefault(msg["source"], []).append(r)
    for src, rows in out.items():
        alerts = [r for r in rows if r["flavor"] == "alert"]
        keep = list(alerts)
        for r in rows:
            if r["flavor"] != "mandate":
                continue
            twin = any(a["date"] == r["date"] and (a["amount"] == r["amount"] or a["fx"] and a["fx"] == r["fx"])
                       for a in alerts)
            if not twin and not any(k["date"] == r["date"] and k["amount"] == r["amount"] for k in keep):
                keep.append(r)
        seen = {}
        for r in sorted(keep, key=lambda r: (r["date"], r["time"] or "")):
            key = (r["date"], r["amount"], r["fx"], re.sub(r"[^A-Z0-9]", "", r["text"].upper()))
            r["maybe_dup"] = key in seen
            seen[key] = True
        out[src] = sorted(keep, key=lambda r: (r["date"], r["time"] or ""))
    return out
