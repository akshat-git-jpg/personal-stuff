"""Read a password-protected SBI account statement into clean rows.

This is the owner's *personal* SBI account, which is a different bank and a
different layout from the PNB passbook the income tally reads
(`pipelines/income-analysis/`). Keep the two parsers apart: they share nothing
but the idea of a row.

The layout, and the trap in it
------------------------------
Each transaction renders as::

    <txn date> <value date> <description...> <ref> <debit> <credit> <balance>

`ref`, `debit` and `credit` all print as ``-`` when empty, so a row ends in
**four** tokens, not three. Reading only three makes the balance look like the
credit — every debit then reads as income, and the statement still "parses".
That silent failure is why :func:`parse` verifies its own arithmetic instead of
trusting the row count.

pypdf only, so this runs unchanged on Windows.
"""

from __future__ import annotations

import re
from pathlib import Path

import pypdf

# A row begins with a transaction date and a value date, side by side.
ROW = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})")

_NUM = r"(?:-|[\d,]+\.\d{2})"
# Deliberately NOT anchored to end-of-string. SBI glues several paragraphs of
# closing boilerplate onto the final transaction, and chasing those phrases is a
# losing game -- they change. The money columns are the last thing in the row
# that looks like "<num> <num> <num> <num>", so take the LAST match instead.
TAIL = re.compile(r"(%s)\s+(%s)\s+(%s)\s+([\d,]+\.\d{2})" % (_NUM, _NUM, _NUM))

# Page furniture that lands mid-row when a transaction straddles a page break.
NOISE = re.compile(r"\d+\s*Page no\.?|\bBalance\b\s*$")


class ParseError(RuntimeError):
    """Raised when the parse cannot be trusted. Never returns partial rows."""


def _money(tok):
    return 0.0 if tok == "-" else float(tok.replace(",", ""))


def read_text(pdf_path, password):
    reader = pypdf.PdfReader(str(pdf_path))
    if reader.is_encrypted and not reader.decrypt(password):
        raise ParseError(
            "wrong password for %s — the SBI statement password is the one the "
            "owner supplies, not the account number" % Path(pdf_path).name)
    return "\n".join(p.extract_text() or "" for p in reader.pages)


def account_meta(text):
    """Whose account, and over what period. Used to label the summary and to
    refuse a statement that was exported for the wrong account."""
    def grab(pattern):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else None

    return {
        "account_number": grab(r"(\d{11,})\s*\n?\s*LOTUS|Account Number\s*:?\s*(\d{9,})"),
        "period_start": grab(r"Statement From\s*:\s*(\d{2}-\d{2}-\d{4})"),
        "period_end": grab(r"Statement From\s*:\s*\d{2}-\d{2}-\d{4}\s*to\s*(\d{2}-\d{2}-\d{4})"),
        "closing_balance": grab(r"([\d,]+\.\d{2})CR"),
    }


def parse(pdf_path, password):
    """Return (rows, meta). Raises ParseError rather than returning a half-read
    statement — a partial parse of a bank statement is indistinguishable from a
    complete one once it reaches a summary."""
    text = read_text(pdf_path, password)
    parts = ROW.split(text)
    blocks = (len(parts) - 1) // 3
    if not blocks:
        raise ParseError("no transactions found in %s" % Path(pdf_path).name)

    rows, unparsed = [], []
    for i in range(1, len(parts), 3):
        txn_date, body = parts[i], parts[i + 2]
        body = NOISE.sub(" ", body)
        body = re.sub(r"\s+", " ", body).strip()
        # A page break can leave the furniture in the middle, so sweep twice.
        body = NOISE.sub(" ", body).strip()
        matches = list(TAIL.finditer(body))
        if not matches:
            unparsed.append((txn_date, body[-80:]))
            continue
        m = matches[-1]
        _ref, debit, credit, balance = m.groups()
        rows.append({
            "date": txn_date,
            "remarks": body[:m.start()].strip(),
            "debit": _money(debit),
            "credit": _money(credit),
            "balance": _money(balance),
        })

    if unparsed:
        detail = "; ".join("%s …%s" % (d, b) for d, b in unparsed[:3])
        raise ParseError(
            "%d of %d rows did not parse (%s). Refusing to summarise a partial "
            "statement." % (len(unparsed), blocks, detail))

    verify(rows)
    return rows, account_meta(text)


def verify(rows):
    """Walk the running balance. The statement carries its own proof, so use it.

    Every row states the balance after it. If our debit/credit reading is right,
    each balance is the previous one plus credit minus debit. A single mis-read
    column breaks the chain immediately, which is the whole point.
    """
    for prev, cur in zip(rows, rows[1:]):
        expected = round(prev["balance"] + cur["credit"] - cur["debit"], 2)
        if abs(expected - cur["balance"]) > 0.01:
            raise ParseError(
                "balance chain breaks at %s: %s + %s − %s = %s, statement says %s"
                % (cur["date"], prev["balance"], cur["credit"], cur["debit"],
                   expected, cur["balance"]))
