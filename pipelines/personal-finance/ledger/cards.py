"""Credit card statement parsers: SBI Card, HDFC Tata Neu Infinity, Amazon Pay ICICI.

Each parser takes the PDF's extracted text and returns one statement dict:

    {source, period_from, period_to, stmt_date, due_date,
     prev, purchases, fees, payments, due, rows: [...]}

and each row is {date, time, text, amount, dc, fx, fee}. `dc` is "D" (money spent)
or "C" (payment or refund). Dates are ISO strings.

Every parser checks its own rows against the statement's printed totals and
raises ParseError on a mismatch. A statement that does not add up is refused,
never half-used.
"""

from __future__ import annotations

import datetime as dt
import re

from .pdfs import ParseError

MON = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def money(s):
    return round(float(s.replace(",", "")), 2)


def _d(y, m, d):
    return dt.date(int(y), int(m), int(d)).isoformat()


def _dmy_short(s):
    """'13 Sep 26' or '13 Sep 2026' -> ISO."""
    d, m, y = s.split()
    y = int(y)
    return _d(y + 2000 if y < 100 else y, MON[m[:3].title()], d)


def _long(s):
    """'September 3, 2026' -> ISO."""
    return dt.datetime.strptime(s.strip(), "%B %d, %Y").date().isoformat()


def _check(src, what, got, want, tol=0.05):
    if abs(got - want) > tol:
        raise ParseError("%s: %s add up to %.2f but the statement says %.2f"
                         % (src, what, got, want))


# ---------------------------------------------------------------- SBI Card

_SBIC_START = re.compile(r"^\d\d [A-Z][a-z]{2} \d\d ")
_SBIC_ROW = re.compile(r"^(\d\d [A-Z][a-z]{2} \d\d) (.+?) ([\d,]+\.\d\d) ([CD])$")
_SBIC_FEE = re.compile(r"^([A-Z].*?(?:MARKUP|GST|FEE|CHARGE|INTEREST|LATE PAY).*?) ([\d,]+\.\d\d) ([CD])$")
_FX = re.compile(r"\s+([\d,]+\.\d\d)\s+([A-Z]{3})\s*$")


def parse_sbicard(text):
    per = re.search(r"Statement Period: (\d\d \w{3} \d\d) to (\d\d \w{3} \d\d)", text)
    summ = re.search(r"([\d,]+\.\d\d)\n([\d,]+\.\d\d)\n([\d,]+\.\d\d)\n"
                     r"(\d\d \w{3} \d{4})\n(\d\d \w{3} \d{4})\n([\d,]+\.\d\d)\n([\d,]+\.\d\d)", text)
    if not per or not summ:
        raise ParseError("sbic: statement period or summary block not found")
    payments, purchases, fees = money(summ[1]), money(summ[2]), money(summ[3])
    stmt_date, due_date = _dmy_short(summ[4]), _dmy_short(summ[5])
    outstanding, prev = money(summ[6]), money(summ[7])
    due_m = re.search(r"\n([\d,]+\.\d\d)\n[\d,]+\.\d\d\n[\d,.]+\n[\d,.]+\n[\d,.]+\n[\d,.]+\n" + re.escape(summ[1]), text)
    rows = []
    lines = [l.strip() for l in text.splitlines()]
    for i, line in enumerate(lines):
        # A long description wraps: "... 35.00  USD (Pay in" / "EMIs) 3,160.84 D".
        if _SBIC_START.match(line) and not _SBIC_ROW.match(line) and i + 1 < len(lines):
            line = line + " " + lines[i + 1]
            lines[i + 1] = ""
        m = _SBIC_ROW.match(line)
        if m:
            desc = re.sub(r"\s+", " ", m[2].replace("(Pay in EMIs)", "")).strip()
            fx = None
            f = _FX.search(desc)
            if f:
                fx = "%s %s" % (f[2], f[1])
                desc = desc[:f.start()].strip()
            desc = desc.replace("(Pay in EMIs)", "").strip()
            fee = bool(re.search(r"\b(ANNUAL FEE|RENEWAL FEE|LATE PAY|FINANCE CHARGE|MARKUP|IGST|CGST|SGST)\b", desc))
            rows.append({"date": _dmy_short(m[1]), "time": None, "text": desc,
                         "amount": money(m[3]), "dc": m[4], "fx": fx, "fee": fee})
            continue
        m = _SBIC_FEE.match(line)
        if m:
            rows.append({"date": stmt_date, "time": None, "text": re.sub(r"\s+", " ", m[1]),
                         "amount": money(m[2]), "dc": m[3], "fx": None, "fee": True})
    if not rows:
        raise ParseError("sbic: no rows found")
    _check("sbic", "purchases", sum(r["amount"] for r in rows if r["dc"] == "D" and not r["fee"]), purchases)
    _check("sbic", "fees", sum(r["amount"] for r in rows if r["dc"] == "D" and r["fee"]), fees)
    _check("sbic", "payments", sum(r["amount"] for r in rows if r["dc"] == "C"), payments)
    _check("sbic", "balance", prev + purchases + fees - payments, outstanding, tol=1.0)
    return {"source": "sbic", "period_from": _dmy_short(per[1]), "period_to": _dmy_short(per[2]),
            "stmt_date": stmt_date, "due_date": due_date, "prev": prev, "purchases": purchases,
            "fees": fees, "payments": payments,
            "due": money(due_m[1]) if due_m else outstanding, "rows": rows}


# ---------------------------------------------------------------- HDFC Tata Neu

_HDFC_START = re.compile(r"^\d\d/\d\d/\d{4}\| \d\d:\d\d ")
_HDFC_ROW = re.compile(r"^(\d\d)/(\d\d)/(\d{4})\| (\d\d:\d\d) (.+?)\s+(\+\s+)?C\s?([\d,]+\.\d\d)\s*l?$")


def parse_hdfc(text):
    per = re.search(r"(\d\d \w{3}, \d{4}) - (\d\d \w{3}, \d{4})", text)
    summ = re.search(r"FINANCE CHARGES\s*\n\s*C([\d,.]+) C([\d,.]+) C([\d,.]+) C([\d,.]+)", text)
    due = re.search(r"TOTAL AMOUNT DUE\s*\nC([\d,.]+)", text)
    due_date = re.search(r"DUE DATE\s*\n(\d\d \w{3}, \d{4})", text)
    if not (per and summ and due and due_date):
        raise ParseError("hdfc: billing period or summary block not found")
    iso = lambda s: _dmy_short(s.replace(",", ""))
    prev, payments, purchases, fin = (money(x) for x in summ.groups())
    lines = [l.strip() for l in text.splitlines()]
    rows, i = [], 0
    while i < len(lines):
        line = lines[i]
        if _HDFC_START.match(line):
            joined, j = line, i
            # A long description wraps onto the next line or two.
            while not _HDFC_ROW.match(joined) and j + 1 < len(lines) and j - i < 2 \
                    and not _HDFC_START.match(lines[j + 1]):
                j += 1
                joined += " " + lines[j]
            m = _HDFC_ROW.match(joined)
            if not m:
                raise ParseError("hdfc: row did not parse: %s" % line[:60])
            rows.append({"date": _d(m[3], m[2], m[1]), "time": m[4],
                         "text": re.sub(r"\s+", " ", m[5]).strip(), "amount": money(m[7]),
                         "dc": "C" if m[6] else "D", "fx": None, "fee": False})
            i = j + 1
            continue
        i += 1
    if not rows:
        raise ParseError("hdfc: no rows found")
    _check("hdfc", "purchases", sum(r["amount"] for r in rows if r["dc"] == "D"), purchases + fin)
    _check("hdfc", "payments", sum(r["amount"] for r in rows if r["dc"] == "C"), payments)
    total = money(due[1])
    _check("hdfc", "balance", prev + purchases + fin - payments, total, tol=1.0)
    return {"source": "neu", "period_from": iso(per[1]), "period_to": iso(per[2]),
            "stmt_date": iso(per[2]), "due_date": iso(due_date[1]), "prev": prev,
            "purchases": purchases, "fees": fin, "payments": payments, "due": total, "rows": rows}


# ---------------------------------------------------------------- Amazon Pay ICICI

_ICICI_START = re.compile(r"(\d\d)/(\d\d)/(\d{4}) (\d{11}) ")
_ICICI_BODY = re.compile(r"^(.+?) (-?\d+) (?:([\d,]+\.\d\d) ([A-Z]{3}) )?([\d,]+\.\d\d)( CR)?(?=\s|$)")


def parse_icici(text):
    per = re.search(r"Statement period : (\w+ \d+, \d{4}) to (\w+ \d+, \d{4})", text)
    summ = re.search(r"Previous Balance Purchases / Charges Cash Advances Payments / Credits\s*\n"
                     r"\D?([\d,.]+) \D?([\d,.]+) \D?([\d,.]+) \D?([\d,.]+)", text)
    tail = re.search(r"\D([\d,]+\.\d\d)\n\D([\d,]+\.\d\d)\nSPENDS OVERVIEW", text)
    dates = re.findall(r"^([A-Z][a-z]+ \d{1,2}, \d{4})$", text, re.M)
    if not (per and summ and tail and len(dates) >= 2):
        raise ParseError("icici: statement period or summary block not found")
    prev, purchases, cash, payments = (money(x) for x in summ.groups())
    flat = re.sub(r"\s+", " ", text)
    starts = list(_ICICI_START.finditer(flat))
    rows = []
    for k, s in enumerate(starts):
        chunk = flat[s.end(): starts[k + 1].start() if k + 1 < len(starts) else len(flat)]
        m = _ICICI_BODY.match(chunk)
        if not m:
            raise ParseError("icici: row did not parse: %s" % chunk[:60])
        rows.append({"date": _d(s[3], s[2], s[1]), "time": None, "text": m[1].strip(),
                     "amount": money(m[5]), "dc": "C" if m[6] else "D",
                     "fx": ("%s %s" % (m[4], m[3])) if m[4] else None, "fee": False})
    if not rows:
        raise ParseError("icici: no rows found")
    _check("icici", "purchases", sum(r["amount"] for r in rows if r["dc"] == "D"), purchases + cash)
    _check("icici", "payments", sum(r["amount"] for r in rows if r["dc"] == "C"), payments)
    total = money(tail[2])
    _check("icici", "balance", prev + purchases + cash - payments, total, tol=1.0)
    return {"source": "icici", "period_from": _long(per[1]), "period_to": _long(per[2]),
            "stmt_date": _long(dates[0]), "due_date": _long(dates[1]), "prev": prev,
            "purchases": purchases + cash, "fees": 0.0, "payments": payments, "due": total,
            "rows": rows}


PARSERS = {"sbic": parse_sbicard, "neu": parse_hdfc, "icici": parse_icici}
