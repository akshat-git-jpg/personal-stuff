"""SBI savings account statements, in both layouts the bank sends.

- The statement you download, or request by email from YONO: parsed by the
  existing `parse_sbi` module (dd/mm/yyyy dates, debit before credit).
- The monthly e-statement SBI emails on its own: dd-mm-yy dates and
  **credit before debit**. Reading it with the other parser would swap every
  debit into income, so it has its own parser here.

Both return rows {date, text, debit, credit, balance} and walk the balance chain.
"""

from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

from .pdfs import ParseError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import parse_sbi  # noqa: E402

_START = re.compile(r"(?<!on )(\d\d)-(\d\d)-(\d\d) (?=\S)")
_TAIL = re.compile(r"^(.*?)\s(\S+)\s(\d[\d,]*(?:\.\d+)?)\s(\d[\d,]*(?:\.\d+)?)\s(-?[\d,]+\.\d\d)(?=\s|$)")
_HEAD = "Date Transaction Reference Ref.No./Chq.No. Credit Debit Balance"


def _num(s):
    return round(float(s.replace(",", "")), 2)


def is_estatement(text):
    return _HEAD in re.sub(r"\s+", " ", text)


def parse_estatement(text):
    flat = re.sub(r"\s+", " ", text)
    opening = re.search(r"Opening Balance on \d\d-\d\d-\d\d: (-?[\d,]+\.\d\d)", flat)
    first = flat.find(_HEAD)
    if first < 0 or not opening:
        raise ParseError("sbi e-statement: table or opening balance not found")
    body = flat[first:]
    # The loan account's own table follows the savings one; stop before it.
    loan = re.search(r"TRANSACTION DETAILS (?:DL/TL|LOAN|OD)\b", body)
    if loan:
        body = body[:loan.start()]
    starts = list(_START.finditer(body))
    rows = []
    for k, s in enumerate(starts):
        chunk = body[s.end(): starts[k + 1].start() if k + 1 < len(starts) else len(body)]
        m = _TAIL.match(chunk)
        if not m:
            raise ParseError("sbi e-statement: row did not parse: %s" % chunk[:60])
        rows.append({"date": dt.date(2000 + int(s[3]), int(s[2]), int(s[1])).isoformat(),
                     "text": m[1].strip(), "credit": _num(m[3]), "debit": _num(m[4]),
                     "balance": _num(m[5])})
    if not rows:
        raise ParseError("sbi e-statement: no rows")
    bal = _num(opening[1])
    for r in rows:
        bal = round(bal + r["credit"] - r["debit"], 2)
        if abs(bal - r["balance"]) > 0.01:
            raise ParseError("sbi e-statement: balance chain breaks on %s" % r["date"])
    return rows


def parse_download(path, password):
    rows, _meta = parse_sbi.parse(path, password)
    out = []
    for r in rows:
        d, m, y = r["date"].split("/")
        out.append({"date": "%s-%s-%s" % (y, m, d), "text": r["remarks"],
                    "debit": r["debit"], "credit": r["credit"], "balance": r["balance"]})
    return out
