#!/usr/bin/env python3
"""Personal SBI account: parse the statement, categorise it, print the summary.

    python3 summarise.py                    # newest statement in data/raw
    python3 summarise.py path/to/stmt.pdf   # a specific one

The password lives in `data/config.json` (gitignored) so it is typed once, not
every run. `data/` is entirely gitignored: statements name the account holder,
every counterparty and the running balance.

What this deliberately does NOT do: guess. A payee that matches no rule lands in
`unknown` carrying its remark, so the owner can name it once in `rules.json`.
"""

from __future__ import annotations

import collections
import json
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import emit       # noqa: E402
import parse_sbi  # noqa: E402

DATA = HERE / "data"
RAW = DATA / "raw"
PARSED = DATA / "parsed"
CONFIG = DATA / "config.json"


def load_password():
    if not CONFIG.exists():
        sys.exit("No %s. Create it with: {\"password\": \"...\"}" % CONFIG)
    return json.loads(CONFIG.read_text())["password"]


def newest_statement():
    pdfs = sorted(RAW.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not pdfs:
        sys.exit("No statement in %s. Drop the PDF there and re-run." % RAW)
    return pdfs[0]


def categorise(rows, rules):
    """Attach a category to each row, or leave it unknown.

    First match wins, so order in rules.json is precedence. Matching is
    case-insensitive on the raw remark.
    """
    cats = rules["categories"]
    for row in rows:
        hay = row["remarks"].casefold()
        row["category"] = None
        for key, spec in cats.items():
            if not any(m.casefold() in hay for m in spec["match"]):
                continue
            # An optional exact amount narrows a payee who gets both a standing
            # payment and ad-hoc ones.
            want = spec.get("amount")
            if want is not None and abs((row["debit"] or row["credit"]) - want) > 0.01:
                continue
            row["category"] = key
            break
    return rows


def month_of(ddmmyyyy):
    d, m, y = ddmmyyyy.split("/")
    return "%s-%s" % (y, m)


def payee(remark):
    """A readable payee from a UPI remark: UPI/DR/<ref>/<NAME>/<BANK>/<vpa>/<note>."""
    bits = [b.strip() for b in remark.split("/") if b.strip()]
    for i, b in enumerate(bits):
        if b in ("DR", "CR") and i + 2 < len(bits):
            return bits[i + 2]
    return remark[:40]


def main():
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
    password = load_password()

    if src and src.exists() and src.parent != RAW:
        RAW.mkdir(parents=True, exist_ok=True)
        dest = RAW / src.name
        shutil.copy2(src, dest)
        print("stored  %s -> %s" % (src.name, dest.relative_to(HERE)))
        src = dest
    stmt = src or newest_statement()

    rules = json.loads((HERE / "rules.json").read_text())
    rows, meta = parse_sbi.parse(stmt, password)
    rows = categorise(rows, rules)

    PARSED.mkdir(parents=True, exist_ok=True)
    (PARSED / (stmt.stem + ".json")).write_text(
        json.dumps({"meta": meta, "transactions": rows}, indent=1, ensure_ascii=False))

    # The dashboard's data file. Gitignored: it names real counterparties.
    written = emit.write(emit.build(rows, meta, rules))
    print("wrote   %s" % written.relative_to(HERE))

    render(rows, meta, rules, stmt)


def render(rows, meta, rules, stmt):
    cats = rules["categories"]
    w = 66
    print()
    print("=" * w)
    print("  PERSONAL ACCOUNT (SBI) — %s to %s"
          % (meta.get("period_start"), meta.get("period_end")))
    print("=" * w)

    inc = sum(r["credit"] for r in rows)
    exp = sum(r["debit"] for r in rows)
    print("  money in   %14s   over %d credits" % (f"{inc:,.2f}", sum(1 for r in rows if r["credit"])))
    print("  money out  %14s   over %d debits" % (f"{exp:,.2f}", sum(1 for r in rows if r["debit"])))
    print("  net        %14s" % f"{inc - exp:,.2f}")
    print("  balance    %14s   (statement says %s)"
          % (f"{rows[-1]['balance']:,.2f}", meta.get("closing_balance")))

    # By category, biggest first, split by what the money is doing.
    by = collections.defaultdict(float)
    counts = collections.Counter()
    for r in rows:
        key = r["category"] or "unknown"
        by[key] += r["credit"] + r["debit"]
        counts[key] += 1

    for kind, title in (("income", "MONEY IN"), ("expense", "MONEY OUT"),
                        ("transfer", "TRANSFERS OUT")):
        keys = [k for k in by if k != "unknown" and cats.get(k, {}).get("kind") == kind]
        if not keys:
            continue
        print("\n  " + title)
        for k in sorted(keys, key=lambda k: -by[k]):
            print("    %-16s %14s   %d txns"
                  % (cats[k]["label"], f"{by[k]:,.2f}", counts[k]))

    if "unknown" in by:
        print("\n  NOT YET CATEGORISED   %s   %d txns"
              % (f"{by['unknown']:,.2f}", counts["unknown"]))
        big = collections.defaultdict(float)
        n = collections.Counter()
        for r in rows:
            if r["category"]:
                continue
            p = payee(r["remarks"])
            big[p] += r["credit"] + r["debit"]
            n[p] += 1
        for p, amt in sorted(big.items(), key=lambda kv: -kv[1])[:12]:
            print("      %-22s %13s   %d txns" % (p[:22], f"{amt:,.2f}", n[p]))

    # Month by month, so a one-off is visibly a one-off.
    print("\n  MONTH BY MONTH")
    months = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows:
        months[month_of(r["date"])][r["category"] or "unknown"] += r["credit"] + r["debit"]
    shown = ["salary", "rent", "to_mummy", "credit_card"]
    head = "".join("%12s" % (cats.get(k, {}).get("label", k))[:11] for k in shown)
    print("    %-9s%s" % ("", head))
    for m in sorted(months):
        line = "".join("%12s" % (f"{months[m][k]:,.0f}" if months[m][k] else "—")
                       for k in shown)
        print("    %-9s%s" % (m, line))
    print("=" * w)


if __name__ == "__main__":
    main()
