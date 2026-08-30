#!/usr/bin/env python3
"""Turn bank passbooks + PayPal into one committed summary of real income.

Drop passbook PDFs into data/raw/, then:

    python3 ingest.py                # bank only
    python3 ingest.py --with-paypal  # also refresh the PayPal side

Reads   data/raw/*.pdf   (password-protected PNB statements)
Writes  data/parsed/*.json   transaction level, has PII, never committed
Writes  summary.json         aggregated numbers only, safe to commit

The PDF password lives in data/config.json (gitignored) or $PASSBOOK_PASSWORD.
"""

import argparse
import collections
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
RAW = DATA / "raw"
PARSED = DATA / "parsed"

# "29/08/2026 14000.0 DR 3365.98 UPI/DR/660790621973/SHRI"
TXN_RE = re.compile(
    r"^\s*(\d{2}/\d{2}/\d{4})\s+([\d,]+\.?\d*)\s+(CR|DR)\s+([\d,]+\.?\d*)\s*(.*)$"
)
PERIOD_RE = re.compile(r"For Period:\s*(\d{2}-\d{2}-\d{4})\s*to\s*(\d{2}-\d{2}-\d{4})")
# Header/footer lines that must never be glued onto a previous txn's remarks.
NOISE = (
    "Branch", "Customer", "City:", "Pin:", "IFSC", "MICR", "Statement", "CKYC", "Date ",
)


def password():
    cfg = DATA / "config.json"
    if cfg.exists():
        p = json.loads(cfg.read_text()).get("pdf_password")
        if p:
            return p
    p = os.environ.get("PASSBOOK_PASSWORD")
    if p:
        return p
    sys.exit(
        "No PDF password. Create data/config.json with {\"pdf_password\": \"...\"} "
        "or set $PASSBOOK_PASSWORD."
    )


def pdf_text(path, pw):
    try:
        import pypdf
    except ImportError:
        sys.exit("pypdf missing. Run: pip3 install pypdf")
    reader = pypdf.PdfReader(str(path))
    if reader.is_encrypted and not reader.decrypt(pw):
        sys.exit(f"Wrong password for {path.name}")
    return "\n".join(page.extract_text() for page in reader.pages)


def parse_statement(text):
    """Pull transactions out of the extracted text.

    Remarks wrap across lines, so a line that is not itself a transaction and is
    not header noise gets appended to the transaction above it.
    """
    txns, cur = [], None
    for line in text.split("\n"):
        m = TXN_RE.match(line)
        if m:
            if cur:
                txns.append(cur)
            cur = {
                "date": m.group(1),
                "amount": float(m.group(2).replace(",", "")),
                "type": m.group(3),
                "balance": float(m.group(4).replace(",", "")),
                "remarks": m.group(5).strip(),
            }
        elif cur and line.strip() and not line.strip().startswith(NOISE):
            cur["remarks"] += " " + line.strip()
    if cur:
        txns.append(cur)
    for t in txns:
        t["remarks"] = re.sub(r"\s+", " ", t["remarks"]).strip()
    return txns


def classify(remarks, rules):
    up = remarks.upper()
    for rail in rules["income_rails"]:
        if any(p.upper() in up for p in rail["match"]):
            return rail["id"], True
    for rule in rules["non_income"]:
        if any(p.upper() in up for p in rule["match"]):
            return rule["id"], False
    return "personal", False


def month_of(ddmmyyyy):
    return f"{ddmmyyyy[6:10]}-{ddmmyyyy[3:5]}"


def redact_filename(name):
    """Mask the account fragment a bank puts in its export filename.

    summary.json is committed to a PUBLIC repo. PNB names its exports
    PNBONE_STMT_XX8619_30082026.pdf, where XX8619 is the last four digits of the
    account. Keep the provenance, drop the digits.
    """
    return re.sub(r"(?i)(XX)\d+", r"\1****", name)


def paypal_by_month():
    """Ask the PayPal CLI for money received, grouped by month then program."""
    creds = pathlib.Path.home() / ".config/paypal-txns-pp-cli/creds.env"
    env = dict(os.environ)
    if creds.exists():
        for line in creds.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    start = "2026-01-01"
    end = dt.date.today().isoformat()
    out = subprocess.run(
        ["paypal-txns-pp-cli", "income", "--start", start, "--end", end, "--json"],
        capture_output=True, text=True, env=env,
    )
    if out.returncode != 0:
        print(f"  ! PayPal pull failed: {out.stderr.strip()[:200]}", file=sys.stderr)
        return None
    try:
        return json.loads(out.stdout[out.stdout.index("{"):])
    except (ValueError, json.JSONDecodeError):
        print("  ! PayPal returned unreadable JSON", file=sys.stderr)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-paypal", action="store_true",
                    help="also refresh the PayPal earned-side numbers")
    args = ap.parse_args()

    rules = json.loads((HERE / "rules.json").read_text())
    pw = password()
    PARSED.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(RAW.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"No PDFs in {RAW}. Drop your passbooks there first.")

    statements, all_txns = [], []
    for pdf in pdfs:
        text = pdf_text(pdf, pw)
        txns = parse_statement(text)
        period = PERIOD_RE.search(text)
        for t in txns:
            rail, is_income = classify(t["remarks"], rules)
            t["rail"], t["is_income"] = rail, is_income
        (PARSED / f"{pdf.stem}.json").write_text(json.dumps(txns, indent=1))
        statements.append({
            "file": redact_filename(pdf.name),
            "transactions": len(txns),
            "period_start": period.group(1) if period else None,
            "period_end": period.group(2) if period else None,
        })
        all_txns.extend(txns)
        print(f"  {pdf.name}: {len(txns)} transactions")

    # Aggregate credits by month and rail. Nothing below carries a name or an
    # account number, which is what makes summary.json safe to commit.
    months = collections.defaultdict(lambda: collections.defaultdict(float))
    for t in all_txns:
        if t["type"] == "CR":
            months[month_of(t["date"])][t["rail"]] += t["amount"]

    summary = {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "statements": statements,
        "rails": {r["id"]: r["label"] for r in rules["income_rails"]},
        "bank_by_month": {
            m: {k: round(v, 2) for k, v in sorted(months[m].items())}
            for m in sorted(months)
        },
    }

    if args.with_paypal:
        pp = paypal_by_month()
        if pp:
            summary["paypal"] = pp.get("results", pp)

    out = HERE / "summary.json"
    out.write_text(json.dumps(summary, indent=2))

    income = sum(
        v for m in months.values()
        for k, v in m.items()
        if k in summary["rails"]
    )
    print(f"\n  wrote {out.relative_to(HERE.parent.parent)}")
    print(f"  real income across {len(months)} months: INR {income:,.2f}")


if __name__ == "__main__":
    main()
