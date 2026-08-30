#!/usr/bin/env python3
"""Tie every bank credit back to the tool that earned it.

The bank is the truth. Network reports exist only to explain bank credits, never
to add to them. So the output of this module always satisfies:

    sum(tool amounts) + untraced == bank total, for every month

Four passes, strongest evidence first, so a strong claim always wins a contested
credit:

    1. PayPal      exact     PayPal names the program for each payout
    2. PartnerStack matched  a dated payout lines up with an Airwallex credit
    3. impact.com  inferred  a credit resembles a month's earnings, with a lag
    4. remainder   untraced  recorded with dates and a reason

**When a credit has more than one plausible explanation, it stays untraced.** A
wrong attribution silently corrupts a source of truth; an honest gap does not.

Pure functions over already-fetched data. No network calls live here.
"""

import datetime as dt
import itertools
import json
import pathlib
import re
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"

# PartnerStack pays USD; the bank receives INR. A credit is only a candidate if
# the implied rate is plausible — this is what stops a coincidental amount match.
FX_MIN, FX_MAX = 78.0, 96.0
# A payout takes a few days to clear into the account.
PAYOUT_WINDOW_DAYS = 10
# impact.com reports INR and pays INR, so no FX — but it pays on a lag.
IMPACT_LAG_MIN_DAYS, IMPACT_LAG_MAX_DAYS = 10, 80
IMPACT_TOLERANCE = 0.02
# Two credits that sum to one payout is common; three is the practical ceiling
# before subset-matching starts finding coincidences.
MAX_SUBSET = 3
PAISE = 0.02  # amounts are rupees-and-paise, so compare with a small epsilon


def parse_day(s):
    """Bank statements use dd/mm/yyyy; the network files use yyyy-mm-dd."""
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def month_of(d):
    return f"{d.year:04d}-{d.month:02d}"


# ── inputs ──────────────────────────────────────────────────────────────────

# Bank reference inside a credit's remarks. This is a transaction identifier, not
# a person: quoting it to the bank is how the owner asks "who sent this?", which
# is the whole point of surfacing it on an untraced row.
REF_RE = re.compile(r"(?:IMPS-?\s*IN/(\d+)|NEFT_IN:\d*(CITIN\d+)|/([A-Z]{4}[A-Z0-9]{8,}))")


def extract_ref(remarks):
    m = REF_RE.search(remarks or "")
    if not m:
        return None
    return next((g for g in m.groups() if g), None)


def load_bank_credits(rails):
    """Income-rail credits from every parsed statement, newest last.

    Each carries a stable id so a pass can claim it and later passes can see it
    is spoken for, plus the bank reference so an untraced credit can be chased
    rather than just reported.
    """
    out = []
    for f in sorted((DATA / "parsed").glob("*.json")):
        for i, t in enumerate(json.loads(f.read_text())):
            if t["type"] != "CR" or t["rail"] not in rails:
                continue
            d = parse_day(t["date"])
            if not d:
                continue
            out.append({
                "id": f"{f.stem}:{i}",
                "date": d,
                "amount": round(t["amount"], 2),
                "rail": t["rail"],
                "ref": extract_ref(t.get("remarks")),
            })
    return sorted(out, key=lambda c: (c["date"], c["amount"]))


def load_json(path, default=None):
    p = pathlib.Path(path)
    return json.loads(p.read_text()) if p.exists() else default


# ── pass 0: what the owner has confirmed by hand ───────────────────────────

def pass_manual(credits, manual):
    """Attributions the owner established himself, from rules.json.

    This is the exit route for untraced money. When he rings the bank about a
    reference, or spots a payout in a network dashboard, he records it once here
    and the credit is named forever after — no heuristic can undo it, because
    this pass runs before every other and its claims are marked `confirmed`.

    An entry matches on date + amount, which is unique in a passbook:

        { "date": "19/03/2026", "amount": 22084.36,
          "tool": "Base44", "route": ["impact.com", "Airwallex"],
          "note": "confirmed in the impact.com dashboard, 2026-09-02" }
    """
    claims = []
    for entry in manual or []:
        d = parse_day(entry.get("date"))
        amt = round(float(entry.get("amount", 0)), 2)
        hit = next((c for c in credits
                    if not c.get("claimed") and c["date"] == d
                    and abs(c["amount"] - amt) <= PAISE), None)
        if not hit:
            continue
        hit["claimed"] = True
        claims.append({
            "tool": entry["tool"],
            "amount": hit["amount"],
            "month": month_of(hit["date"]),
            "route": entry.get("route") or [],
            "confidence": "confirmed",
            "credit_ids": [hit["id"]],
        })
    return claims


# ── pass 1: PayPal ──────────────────────────────────────────────────────────

def subset_matching(target, credits, max_n=MAX_SUBSET):
    """Smallest set of unclaimed credits summing to target, or None.

    Prefers a 1:1 match, then pairs, then triples — a payout split across two
    NEFT credits is normal, but the more credits a subset needs the more likely
    it is a coincidence, so the search stops early.
    """
    for n in range(1, max_n + 1):
        for combo in itertools.combinations(credits, n):
            if abs(sum(c["amount"] for c in combo) - target) <= PAISE:
                return list(combo)
    return None


def pass_paypal(credits, paypal_months):
    """Attribute PayPal-rail credits to the programs PayPal names.

    PayPal reports per-program settlement grouped by the month the money was
    EARNED, while the bank shows when it LANDED. Matching on amount recovers the
    landed date, which is what the dashboard reports on.
    """
    pool = [c for c in credits if c["rail"] == "paypal" and not c.get("claimed")]
    claims = []

    programs = []
    for m in paypal_months:
        for p in m.get("programs", []):
            amt = round(float(p.get("bank_amount") or 0), 2)
            if amt > 0:
                programs.append({"tool": p["program"], "amount": amt})
    # Largest first: a big payout has fewer coincidental subsets than a small one.
    programs.sort(key=lambda p: -p["amount"])

    for prog in programs:
        avail = [c for c in pool if not c.get("claimed")]
        hit = subset_matching(prog["amount"], avail)
        if not hit:
            continue
        prog["done"] = True
        for c in hit:
            c["claimed"] = True
        # A payout split across credits in different months is booked to the
        # month each part actually landed.
        for c in hit:
            claims.append({
                "tool": prog["tool"],
                "amount": c["amount"],
                "month": month_of(c["date"]),
                "route": ["PayPal"],
                "confidence": "exact",
                "credit_ids": [c["id"]],
            })

    claims += _paypal_grouped(pool, [p for p in programs if not p.get("done")])
    return claims


def _paypal_grouped(pool, programs):
    """Second phase: one batch of credits settling several programs at once.

    PayPal often clears four programs across two NEFT credits. Matching one
    program to one credit subset cannot see that, and leaves the whole batch
    untraced — which is how June 2026 read as 3% traced on the first pass.

    Here we go the other way: take a month's unclaimed credits and look for a set
    of unclaimed programs that sums to them. The month is then exact even though
    which credit paid which program is not, so these are marked `grouped`, a
    weaker claim than `exact`.
    """
    claims = []
    by_month = defaultdict(list)
    for c in pool:
        if not c.get("claimed"):
            by_month[month_of(c["date"])].append(c)

    for m, credits in sorted(by_month.items()):
        target = round(sum(c["amount"] for c in credits), 2)
        avail = [p for p in programs if not p.get("done")]
        # Bounded search: a batch of more than six programs is rare, and the
        # wider the search the more likely a coincidental sum.
        hit = None
        for n in range(2, min(len(avail), 6) + 1):
            for combo in itertools.combinations(avail, n):
                if abs(sum(p["amount"] for p in combo) - target) <= PAISE:
                    hit = list(combo)
                    break
            if hit:
                break
        if not hit:
            continue
        for p in hit:
            p["done"] = True
        for c in credits:
            c["claimed"] = True
        for p in hit:
            claims.append({
                "tool": p["tool"],
                "amount": p["amount"],
                "month": m,
                "route": ["PayPal"],
                "confidence": "grouped",
                "credit_ids": [c["id"] for c in credits],
            })
    return claims


# ── pass 2: PartnerStack ────────────────────────────────────────────────────

def split_by_reward(payout_usd, payout_date, rewards, used):
    """Which tools a payout covers, as {tool: share of 1.0}.

    PartnerStack does not say which rewards a payout settled, so model it the way
    the money actually moves: oldest unpaid rewards first, until the payout
    amount is covered.
    """
    avail = sorted(
        (r for r in rewards
         if r.get("date") and r["key"] not in used
         and parse_day(r["date"]) and parse_day(r["date"]) <= payout_date),
        key=lambda r: r["date"],
    )
    taken, total = [], 0.0
    for r in avail:
        if total >= payout_usd - 0.01:
            break
        taken.append(r)
        total += r["amount"]
    if not taken:
        return None
    for r in taken:
        used.add(r["key"])
    by_tool = defaultdict(float)
    for r in taken:
        by_tool[r["tool"] or "Unknown"] += r["amount"]
    return {t: v / total for t, v in by_tool.items()} if total else None


def pass_partnerstack(credits, ps):
    """Match dated PartnerStack payouts to Airwallex credits."""
    if not ps:
        return [], []
    claims, notes = [], []
    used_rewards = set()

    for payout in sorted(ps.get("payouts", []), key=lambda p: p["date"] or ""):
        pd = parse_day(payout.get("date"))
        if not pd or payout.get("currency") != "USD":
            continue
        cands = [
            c for c in credits
            if c["rail"] == "airwallex" and not c.get("claimed")
            and 0 <= (c["date"] - pd).days <= PAYOUT_WINDOW_DAYS
            and FX_MIN <= c["amount"] / payout["amount"] <= FX_MAX
        ]
        if not cands:
            notes.append({"payout": payout["key"], "reason": "no_candidate"})
            continue
        if len(cands) > 1:
            # Refusing to guess is the whole point. Say so and move on.
            notes.append({"payout": payout["key"], "reason": "ambiguous",
                          "candidates": len(cands)})
            continue

        credit = cands[0]
        shares = split_by_reward(payout["amount"], pd, ps.get("rewards", []), used_rewards)
        if not shares:
            notes.append({"payout": payout["key"], "reason": "no_rewards_to_split"})
            continue

        credit["claimed"] = True
        fx = round(credit["amount"] / payout["amount"], 2)
        for tool, share in shares.items():
            claims.append({
                "tool": tool,
                "amount": round(credit["amount"] * share, 2),
                "month": month_of(credit["date"]),
                "route": ["PartnerStack", "Airwallex"],
                "confidence": "matched",
                "implied_fx": fx,
                "credit_ids": [credit["id"]],
            })
    return claims, notes


# ── pass 3: impact.com ──────────────────────────────────────────────────────

def month_end(m):
    y, mo = int(m[:4]), int(m[5:7])
    return dt.date(y + (mo == 12), (mo % 12) + 1, 1) - dt.timedelta(days=1)


def pass_impact(credits, impact):
    """Infer which Airwallex credits settled a month of impact.com earnings.

    impact.com will not expose payout dates (its invoices endpoint 403s for this
    key), so this pass reasons from amount plus a payment lag. It is labelled
    `inferred` for exactly that reason and must never be presented as proven.
    """
    if not impact:
        return [], []
    claims, notes = [], []

    for m in sorted(impact):
        programs = impact[m]
        total = sum(p["amount"] for p in programs)
        if total <= 0:
            continue
        end = month_end(m)
        cands = [
            c for c in credits
            if c["rail"] == "airwallex" and not c.get("claimed")
            and IMPACT_LAG_MIN_DAYS <= (c["date"] - end).days <= IMPACT_LAG_MAX_DAYS
            and abs(c["amount"] - total) / total <= IMPACT_TOLERANCE
        ]
        if not cands:
            notes.append({"month": m, "reason": "no_candidate",
                          "earned": round(total, 2)})
            continue
        if len(cands) > 1:
            notes.append({"month": m, "reason": "ambiguous",
                          "candidates": len(cands)})
            continue

        credit = cands[0]
        credit["claimed"] = True
        for p in programs:
            claims.append({
                "tool": p["tool"],
                "amount": round(credit["amount"] * (p["amount"] / total), 2),
                "month": month_of(credit["date"]),
                "route": ["impact.com", "Airwallex"],
                "confidence": "inferred",
                "credit_ids": [credit["id"]],
            })
    return claims, notes


# ── leads ───────────────────────────────────────────────────────────────────

LEAD_WINDOW_DAYS = 45


def leads_for(credit, ps, ps_notes, impact, im_notes):
    """Network activity near an untraced credit, as investigation leads.

    Not a claim — a starting point. If PartnerStack sent a payout a week before a
    credit landed but the rate was off, that payout is the first thing to check
    in the dashboard. Ranked nearest-first so the top lead is the likeliest.
    """
    out = []
    unmatched_payouts = {n["payout"] for n in (ps_notes or [])}
    for p in (ps or {}).get("payouts", []):
        if p["key"] not in unmatched_payouts:
            continue
        pd = parse_day(p.get("date"))
        if not pd:
            continue
        gap = (credit["date"] - pd).days
        if 0 <= gap <= LEAD_WINDOW_DAYS:
            out.append({
                "source": "PartnerStack",
                "what": f"payout {p['currency']} {p['amount']:.2f} on {p['date']}",
                "gap_days": gap,
                "implied_fx": round(credit["amount"] / p["amount"], 1) if p["amount"] else None,
            })

    unmatched_months = {n["month"] for n in (im_notes or []) if "month" in n}
    for m in sorted(unmatched_months):
        total = sum(x["amount"] for x in (impact or {}).get(m, []))
        if total <= 0:
            continue
        gap = (credit["date"] - month_end(m)).days
        if 0 <= gap <= LEAD_WINDOW_DAYS:
            out.append({
                "source": "impact.com",
                "what": f"INR {total:,.2f} earned in {m}, payout date unknown",
                "gap_days": gap,
                "implied_fx": None,
            })

    return sorted(out, key=lambda x: x["gap_days"])[:3]


# ── assembly ────────────────────────────────────────────────────────────────

def attribute(rails, paypal_months, ps=None, impact=None, sources_absent=(),
              manual=None, rail_labels=None):
    """Run every pass and fold the result into per-month totals."""
    credits = load_bank_credits(set(rails))
    rail_labels = rail_labels or {}

    claims = pass_manual(credits, manual)
    claims += pass_paypal(credits, paypal_months or [])
    ps_claims, ps_notes = pass_partnerstack(credits, ps)
    im_claims, im_notes = pass_impact(credits, impact)
    claims += ps_claims + im_claims

    months = defaultdict(lambda: {"bank_total": 0.0, "rails": defaultdict(float),
                                  "tools": defaultdict(lambda: None),
                                  "untraced": {"amount": 0.0, "reasons": [], "credits": []}})

    for c in credits:
        m = months[month_of(c["date"])]
        m["bank_total"] = round(m["bank_total"] + c["amount"], 2)
        m["rails"][c["rail"]] = round(m["rails"][c["rail"]] + c["amount"], 2)

    # Merge claims for the same tool+route+confidence inside a month.
    merged = defaultdict(float)
    meta = {}
    for cl in claims:
        k = (cl["month"], cl["tool"], tuple(cl["route"]), cl["confidence"])
        merged[k] += cl["amount"]
        meta.setdefault(k, {}).update(
            {x: cl[x] for x in ("implied_fx",) if x in cl})

    for (m, tool, route, conf), amt in merged.items():
        months[m]["tools"][(tool, route, conf)] = round(amt, 2)

    # Untraced is whatever the passes could not claim. Never render it as a bare
    # "unknown": we always know the rail it came in on and its bank reference, and
    # often which network payouts were nearby but failed to match. That is the
    # material the owner needs to chase it down, so it all travels with the row.
    for c in credits:
        if c.get("claimed"):
            continue
        m = months[month_of(c["date"])]
        u = m["untraced"]
        u["amount"] = round(u["amount"] + c["amount"], 2)
        u["credits"].append({
            "date": c["date"].strftime("%d/%m/%Y"),
            "amount": c["amount"],
            "rail": c["rail"],
            "rail_label": rail_labels.get(c["rail"], c["rail"]),
            "ref": c.get("ref"),
            "leads": leads_for(c, ps, ps_notes, impact, im_notes),
        })

    out = {}
    for m in sorted(months):
        d = months[m]
        tools = [
            {"tool": t, "amount": a, "route": list(r), "confidence": conf,
             **({"implied_fx": meta[(m, t, r, conf)]["implied_fx"]}
                if meta.get((m, t, r, conf), {}).get("implied_fx") else {})}
            for (t, r, conf), a in sorted(d["tools"].items(), key=lambda kv: -kv[1])
        ]
        untraced = d["untraced"]
        reasons = []
        if untraced["amount"] > PAISE:
            # The rail is the single most useful thing we know about untraced
            # money, so it leads. "Arrived over Airwallex" beats "unknown".
            reasons = sorted({c["rail_label"] for c in untraced["credits"]})
            if sources_absent:
                reasons.append("source_not_connected")
        out[m] = {
            "bank_total": round(d["bank_total"], 2),
            "rails": {k: v for k, v in sorted(d["rails"].items())},
            "tools": tools,
            "untraced": {
                "amount": round(untraced["amount"], 2),
                "reasons": reasons,
                "credits": untraced["credits"],
            },
        }
        # The invariant this whole module exists to hold.
        traced = sum(t["amount"] for t in tools)
        drift = abs(traced + untraced["amount"] - d["bank_total"])
        assert drift <= 1.0, f"{m}: tools+untraced off bank total by {drift:.2f}"

    return out, {"partnerstack": ps_notes, "impact": im_notes}
