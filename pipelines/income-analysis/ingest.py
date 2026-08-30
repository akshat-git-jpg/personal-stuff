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
NETWORKS = DATA / "networks"

sys.path.insert(0, str(HERE))
import attribute  # noqa: E402
import sources    # noqa: E402

# Every source the dashboard knows about, including ones with no credentials.
# A source that is absent must be *named* as absent — silence reads as zero.
SOURCE_CATALOGUE = [
    {"id": "paypal", "label": "PayPal", "kind": "api"},
    {"id": "bank", "label": "Bank passbook", "kind": "manual"},
    {"id": "impact", "label": "impact.com", "kind": "api"},
    {"id": "partnerstack", "label": "PartnerStack", "kind": "api"},
    {"id": "paykickstart", "label": "PayKickstart", "kind": "api",
     "note": "No credentials. Affiliate accounts have no API access, so any "
             "PayKickstart commission shows up as untraced."},
]


def load_network(name):
    p = NETWORKS / name
    return json.loads(p.read_text()) if p.exists() else None


def source_states(ps, im, pending):
    """Report each source's state so the UI never has to infer it from silence."""
    out = []
    for s in SOURCE_CATALOGUE:
        e = dict(s)
        if s["id"] == "paypal":
            e["state"] = "connected" if pending else "stale"
            e["as_of"] = (pending or {}).get("as_of")
        elif s["id"] == "bank":
            e["state"] = "manual"
        elif s["id"] == "partnerstack":
            e["state"] = "connected" if ps else "absent"
            e["as_of"] = (ps or {}).get("fetched_at")
        elif s["id"] == "impact":
            e["state"] = "connected" if im else "absent"
        else:
            e["state"] = "absent"
        out.append(e)
    return out

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


def paypal_by_month(env):
    """Ask the PayPal CLI for money received, grouped by month then program."""
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


def paypal_balance(env):
    """Money still sitting in PayPal, not yet withdrawn to the bank.

    Snapshotted here rather than read live by the dashboard: the Worker holds no
    PayPal credentials, and the rest of the tab is an ingest-time snapshot too,
    so one freshness story covers everything.
    """
    out = subprocess.run(
        ["paypal-txns-pp-cli", "reporting", "balances-get", "--json"],
        capture_output=True, text=True, env=env,
    )
    if out.returncode != 0:
        print(f"  ! balance pull failed: {out.stderr.strip()[:200]}", file=sys.stderr)
        return None
    try:
        res = json.loads(out.stdout[out.stdout.index("{"):])
        res = res.get("results", res)
    except (ValueError, json.JSONDecodeError):
        print("  ! balance returned unreadable JSON", file=sys.stderr)
        return None

    holdings = [
        {
            "currency": b.get("currency"),
            "total": (b.get("total_balance") or {}).get("value", "0.00"),
            "available": (b.get("available_balance") or {}).get("value", "0.00"),
            "withheld": (b.get("withheld_balance") or {}).get("value", "0.00"),
        }
        for b in res.get("balances", [])
    ]
    return {
        "as_of": res.get("as_of_time"),
        "holdings": holdings,
        "total_any_currency": sum(float(h["total"] or 0) for h in holdings),
    }


def paypal_env():
    creds = pathlib.Path.home() / ".config/paypal-txns-pp-cli/creds.env"
    env = dict(os.environ)
    if creds.exists():
        for line in creds.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def print_tally(months, notes, paypal_months):
    """Print the same tally the dashboard publishes.

    The owner's rule: a discrepancy is reported in both places or in neither.
    Untraced money is loud but never blocking — it is the normal state today, and
    a gate that fails on the normal case gets switched off within a week. Only a
    broken PayPal reconciliation exits non-zero, because that is a real bug.
    """
    print("\n" + "=" * 66)
    print("  REVENUE TALLY — bank credits are the truth")
    print("=" * 66)

    g_bank = g_traced = g_untraced = 0.0
    for m in sorted(months):
        d = months[m]
        traced = sum(t["amount"] for t in d["tools"])
        un = d["untraced"]["amount"]
        g_bank += d["bank_total"]; g_traced += traced; g_untraced += un
        pct = (traced / d["bank_total"] * 100) if d["bank_total"] else 100.0
        mark = "ok " if un <= 1 else "!! "
        print(f"  {mark}{m}  bank {d['bank_total']:>11,.2f}   "
              f"traced {traced:>11,.2f} ({pct:5.1f}%)   untraced {un:>10,.2f}")
        for c in d["untraced"]["credits"]:
            print(f"        untraced credit  {c['date']}  {c['amount']:>10,.2f}  {c['rail']}")

    print("  " + "-" * 64)
    share = (g_untraced / g_bank * 100) if g_bank else 0.0
    print(f"     TOTAL  bank {g_bank:>11,.2f}   traced {g_traced:>11,.2f}   "
          f"untraced {g_untraced:>10,.2f}")
    if g_untraced > 1:
        print(f"\n  !! {share:.1f}% of income cannot be traced to a tool.")
        for src, items in notes.items():
            for n in items[:6]:
                print(f"     {src}: {n}")

    # PayPal reconciliation — the one hard gate.
    settled = sum(float(m.get("bank_amount") or 0) for m in paypal_months)
    on_rail = sum(v for d in months.values() for k, v in d["rails"].items() if k == "paypal")
    diff = round(on_rail - settled, 2)
    if paypal_months:
        print(f"\n  PayPal reconciliation")
        print(f"     bank NEFT from PayPal  {on_rail:>11,.2f}")
        print(f"     PayPal says settled    {settled:>11,.2f}")
        print(f"     difference             {diff:>11,.2f}")
        if abs(diff) > 1.0:
            print("\n  FAIL: PayPal and the bank disagree. Numbers not trustworthy.")
            sys.exit(1)
        print("     tallies")
    print("=" * 66)


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

    rail_ids = [r["id"] for r in rules["income_rails"]]
    bank_months = sorted({month_of(t["date"]) for t in all_txns
                          if t["type"] == "CR" and t["rail"] in rail_ids})

    paypal_months, pending = [], None
    if args.with_paypal:
        env = paypal_env()
        pp = paypal_by_month(env)
        if pp:
            paypal_months = pp.get("results", pp).get("months", [])
        pending = paypal_balance(env)
        if pending:
            print(f"  still in PayPal: USD {pending['total_any_currency']:,.2f}"
                  f" (as of {pending['as_of']})")

        # The networks that pay the bank directly. Failing to reach one is not
        # fatal — its money simply stays untraced and the UI says so.
        try:
            ps = sources.fetch_partnerstack()
            if ps:
                (NETWORKS).mkdir(parents=True, exist_ok=True)
                (NETWORKS / "partnerstack.json").write_text(
                    json.dumps(ps, indent=1, ensure_ascii=False))
                print(f"  PartnerStack: {len(ps['payouts'])} payouts, "
                      f"{len(ps['rewards'])} rewards")
        except SystemExit as e:
            print(f"  ! PartnerStack: {e}", file=sys.stderr)
        im = sources.fetch_impact_by_month(bank_months)
        if im:
            (NETWORKS).mkdir(parents=True, exist_ok=True)
            (NETWORKS / "impact.json").write_text(json.dumps(im, indent=1, ensure_ascii=False))
            print(f"  impact.com: {len(im)} months")

    ps_data = load_network("partnerstack.json")
    im_data = load_network("impact.json")
    absent = [s for s in SOURCE_CATALOGUE
              if s["id"] == "paykickstart"]  # parked: affiliate accounts have no API

    months, notes = attribute.attribute(
        rail_ids, paypal_months, ps_data, im_data, [s["id"] for s in absent],
        manual=rules.get("manual_attribution"),
        rail_labels={r["id"]: r["label"] for r in rules["income_rails"]})

    # Nothing below carries a counterparty, an account number or an address,
    # which is what makes summary.json safe to commit to a public repo.
    summary = {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "coverage": {"from": bank_months[0] if bank_months else None,
                     "to": bank_months[-1] if bank_months else None},
        "statements": statements,
        "rails": {r["id"]: r["label"] for r in rules["income_rails"]},
        "sources": source_states(ps_data, im_data, pending),
        "months": months,
    }
    if pending:
        summary["paypal_pending"] = pending

    out = HERE / "summary.json"
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\n  wrote {out.relative_to(HERE.parent.parent)}")

    print_tally(months, notes, paypal_months)


if __name__ == "__main__":
    main()
