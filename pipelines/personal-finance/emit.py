"""Build the dashboard's data file from a categorised statement.

Separate from `summarise.py`'s terminal output on purpose: the terminal is for
the owner reading it now, this is for the app to render later, and the two want
different shapes.

**This output is NOT safe to commit.** It carries counterparty names — real
people the owner pays. `data/` is gitignored in full and the app gitignores its
bundled copy, which is what keeps them off a public repo. Do not "helpfully"
move this file somewhere tidier.
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent

# Everything else is spending. Income is what the tally measures against.
INCOME = ("salary", "interest")
# How many payees to name per month before the rest become one "+N more" row.
TOP_PAYEES = 6


def month_of(ddmmyyyy):
    d, m, y = ddmmyyyy.split("/")
    return "%s-%s" % (y, m)


def payee(remark):
    """A readable counterparty from a UPI remark:
    UPI/DR/<ref>/<NAME>/<BANK>/<vpa>/<note>."""
    bits = [b.strip() for b in remark.split("/") if b.strip()]
    for i, b in enumerate(bits):
        if b in ("DR", "CR") and i + 2 < len(bits):
            return bits[i + 2].strip().title()
    return remark.split()[0][:24] if remark else "unknown"


def build(rows, meta, rules):
    cats = rules["categories"]
    months = collections.defaultdict(lambda: {"in": 0.0, "bal": 0.0,
                                              "cat": collections.defaultdict(float),
                                              "unnamed": collections.defaultdict(float)})
    counts = collections.Counter()

    for r in rows:
        key = r.get("category") or "unnamed"
        m = months[month_of(r["date"])]
        m["bal"] = r["balance"]                      # rows are in statement order
        if key in INCOME or (key == "unnamed" and r["credit"]):
            # A stray credit with no rule is still money in, not negative spend.
            m["in"] = round(m["in"] + r["credit"], 2)
            if key in INCOME:
                counts[key] += 1
            continue
        m["cat"][key] = round(m["cat"][key] + r["debit"], 2)
        counts[key] += 1
        if key == "unnamed":
            m["unnamed"][payee(r["remarks"])] += r["debit"]

    out_months = {}
    for k in sorted(months):
        m = months[k]
        top = sorted(m["unnamed"].items(), key=lambda kv: -kv[1])
        rest = sum(v for _, v in top[TOP_PAYEES:])
        named = [[p, round(v, 2)] for p, v in top[:TOP_PAYEES]]
        if rest:
            named.append(["+%d more" % (len(top) - TOP_PAYEES), round(rest, 2)])
        out_months[k] = {
            "in": m["in"],
            "balance": m["bal"],
            "categories": {c: v for c, v in m["cat"].items() if v},
            "unnamed_payees": named,
        }

    # Only categories that actually occur, so the UI never renders an empty row.
    seen = {c for m in out_months.values() for c in m["categories"]}
    catalogue = {
        c: {"label": cats[c]["label"] if c in cats else "Not named yet",
            "kind": cats[c]["kind"] if c in cats else "unnamed",
            "count": counts[c]}
        for c in sorted(seen)
    }

    total_in = round(sum(m["in"] for m in out_months.values()), 2)
    total_out = round(sum(sum(m["categories"].values()) for m in out_months.values()), 2)

    return {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "account": "State Bank of India",
        "period": {"from": meta.get("period_start"), "to": meta.get("period_end")},
        "months": out_months,
        "categories": catalogue,
        "totals": {"in": total_in, "out": total_out,
                   "net": round(total_in - total_out, 2),
                   "balance": out_months[max(out_months)]["balance"] if out_months else 0.0},
    }


def write(payload, path=None):
    p = pathlib.Path(path) if path else HERE / "data" / "summary.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, indent=1, ensure_ascii=False))
    return p
