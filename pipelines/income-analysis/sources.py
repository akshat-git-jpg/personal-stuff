#!/usr/bin/env python3
"""Fetch the affiliate networks that pay the bank directly.

PayPal is handled by ingest.py through its own CLI. This module covers the two
networks whose money arrives over Airwallex, plus the bank passbook's own
counterpart data:

    PartnerStack  Partner API, bearer token  -> payouts, rewards, partnerships
    impact.com    impact-pp-cli              -> per-program earnings by month

Everything written here lands in data/, which is gitignored. Nothing in this
module may write to summary.json.

REDACTION IS NOT OPTIONAL. The PartnerStack payouts response embeds the account
holder's full street address, city, postcode and account last-4 under
provider.meta. This repo is public. strip_pii() runs before anything is written,
and test_sources.py asserts it.
"""

import datetime as dt
import json
import os
import pathlib
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
RAW = DATA / "networks"

PARTNERSTACK_API = "https://api.partnerstack.com/api/v2"
PARTNERSTACK_PAGE = 250

# Keys anywhere in a PartnerStack response that carry personal data we must never
# persist. Matched by key name at any depth, so a shape change upstream cannot
# quietly reintroduce them.
PII_KEYS = {
    "meta",              # provider.meta: address, postcode, account_number_last_4
    "beneficiary_address",
    "account_number_last_4",
    "email",
    "customer",          # hashed, but it is still a per-customer record
}


def repo_root():
    return HERE.parent.parent


def ssl_context():
    """A verifying context that works on a python.org install too.

    Those builds ship without the system CA bundle wired up, so urllib fails
    with CERTIFICATE_VERIFY_FAILED until someone runs Install Certificates.
    certifi's bundle is already on disk as a dependency, so prefer it. We never
    disable verification — this call carries an API key.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def load_env(path):
    """Read a KEY=value .env file without needing python-dotenv.

    Files in infra/secrets/ are written to be `source`d by a shell, so some
    prefix each line with `export`. Strip it, or the key comes back as
    "export IMPACT_ACCOUNT_SID" and the credential silently looks absent.
    """
    out = {}
    p = pathlib.Path(path)
    if not p.exists():
        return out
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def strip_pii(node):
    """Recursively drop PII_KEYS from a decoded JSON structure.

    Returns a new structure; the input is not mutated.
    """
    if isinstance(node, dict):
        return {k: strip_pii(v) for k, v in node.items() if k not in PII_KEYS}
    if isinstance(node, list):
        return [strip_pii(v) for v in node]
    return node


# ── PartnerStack ────────────────────────────────────────────────────────────

def ps_get(endpoint, key):
    """One paged GET against the Partner API, PII stripped before it is returned."""
    items, page, ctx = [], 1, ssl_context()
    while True:
        url = f"{PARTNERSTACK_API}/{endpoint}?limit={PARTNERSTACK_PAGE}&page={page}"
        # A User-Agent is mandatory, not politeness: PartnerStack's WAF answers
        # 403 to the default "Python-urllib/3.x", which reads exactly like a bad
        # API key and sent us chasing the wrong bug once already.
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "yt-income/1.0 (+personal-stuff)",
        })
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
                body = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise SystemExit(
                f"PartnerStack {endpoint} returned HTTP {e.code}. "
                f"Check PARTNERSTACK_API_KEY in infra/secrets/partnerstack.env."
            )
        data = body.get("data", {})
        items.extend(data.get("items", []))
        if not data.get("has_more"):
            break
        page += 1
    return strip_pii(items)


def fetch_partnerstack():
    """Payouts, rewards and partnerships. Returns None when no key is configured."""
    env = load_env(repo_root() / "infra/secrets/partnerstack.env")
    key = env.get("PARTNERSTACK_API_KEY") or os.environ.get("PARTNERSTACK_API_KEY")
    if not key:
        return None

    payouts = ps_get("payouts", key)
    rewards = ps_get("rewards", key)
    partnerships = ps_get("partnerships", key)

    return {
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        # Amounts arrive in minor units (cents); normalise once, here, so no
        # downstream code has to remember.
        "payouts": [
            {
                "key": p.get("key"),
                "date": iso_day(p.get("created_at")),
                "amount": _cents(p.get("amount")),
                "currency": p.get("currency"),
                "status": p.get("status"),
            }
            for p in payouts
        ],
        "rewards": [
            {
                "key": r.get("key"),
                "date": iso_day(r.get("created_at")),
                "amount": _cents(r.get("amount")),
                "currency": r.get("currency"),
                "tool": (r.get("company") or {}).get("name"),
                "status": r.get("status"),
            }
            for r in rewards
        ],
        "tools": sorted({
            (p.get("company") or {}).get("name")
            for p in partnerships
            if (p.get("company") or {}).get("name")
        }),
    }


def iso_day(ms):
    """PartnerStack timestamps are epoch milliseconds."""
    if not ms:
        return None
    return dt.datetime.utcfromtimestamp(ms / 1000).strftime("%Y-%m-%d")


# ── impact.com ──────────────────────────────────────────────────────────────

def impact_env():
    env = dict(os.environ)
    env.update(load_env(repo_root() / "infra/secrets/impact.env"))
    return env


def fetch_impact(start, end):
    """Per-program earnings for a date range.

    impact.com reports from the advertiser's side, so the field holding *our*
    earnings is called Action_Cost. Total_Cost is the same number; Earnings is
    empty on this report. Getting this wrong reads as zero income.
    """
    env = impact_env()
    if not env.get("IMPACT_ACCOUNT_SID") or not env.get("IMPACT_AUTH_TOKEN"):
        return None

    out = subprocess.run(
        ["impact-pp-cli", "reports", "run", "partner_performance_by_program",
         "--start-date", start, "--end-date", end, "--agent"],
        capture_output=True, text=True, env=env,
    )
    if out.returncode != 0:
        print(f"  ! impact.com pull failed: {out.stderr.strip()[:200]}", file=sys.stderr)
        return None
    try:
        body = json.loads(out.stdout[out.stdout.index("{"):])
    except (ValueError, json.JSONDecodeError):
        print("  ! impact.com returned unreadable JSON", file=sys.stderr)
        return None

    programs = []
    for r in body.get("results", {}).get("Records", []):
        amount = float(r.get("Action_Cost") or 0)
        if amount > 0:
            programs.append({"tool": (r.get("Campaign") or "").strip(), "amount": amount})
    return {"start": start, "end": end, "currency": "INR",
            "programs": sorted(programs, key=lambda p: -p["amount"])}


def fetch_impact_by_month(months):
    """One call per month — the report has no month dimension on this endpoint.

    **Fetches only the statement's own months. Do not widen this backwards.**

    Networks pay on a lag, so pulling earlier months looks like it should help an
    unmatched credit find its earnings. It does the opposite. Tried 2026-08-30
    with five months of lookback: the extra months produced *twenty-four* distinct
    subset sums landing within 2% of an untraced credit, several hitting the same
    credit with different combinations. None of that is evidence — it is what
    happens when you let a subset search roam over enough numbers. Acting on any
    of it would have put a wrong tool name on real money, which is the one failure
    this pipeline exists to prevent.

    Owner's call on the same date: start from Jan 2026. Untraced money gets named
    by `manual_attribution` in rules.json, from something he actually confirmed —
    not by a wider guess.
    """
    out = {}
    for m in months:
        y, mo = int(m[:4]), int(m[5:7])
        last = (dt.date(y + (mo == 12), (mo % 12) + 1, 1) - dt.timedelta(days=1)).day
        got = fetch_impact(f"{m}-01", f"{m}-{last:02d}")
        if got:
            out[m] = got["programs"]
    return out


# ── preflight ───────────────────────────────────────────────────────────────

# ── Tolt (per-tool CLI source) ──────────────────────────────────────────────
#
# The template for every future per-tool CLI. Three rules the next one should
# copy:
#
#   1. Shell out to the CLI; never re-implement its auth here. The CLI owns the
#      credential and the redaction, and this file should never be able to leak
#      something the CLI was careful about.
#   2. Normalise minor units to major ONCE, at the boundary. Tolt speaks cents;
#      an amount that reaches attribute.py in cents is a 100x error that looks
#      entirely plausible on a chart.
#   3. Return None -- not {} and not a raise -- when unconfigured. `preflight()`
#      is what tells the owner a source is down; a source that raises takes the
#      whole tally with it.

TOLT_SESSION = pathlib.Path.home() / ".config/tolt-pp-cli/session.env"


def _cents(value):
    """Tolt sends money as a STRING of cents ("17536"), not a number.

    Coerce here rather than trusting the wire type: a spec that says integer and
    a payload that says string is exactly the mismatch that survives a code
    review and dies in production. Returns dollars.
    """
    try:
        return float(value or 0) / 100
    except (TypeError, ValueError):
        return 0.0


def fetch_tolt():
    """OpenArt payouts from the Tolt partner portal. None when not configured.

    Tolt is a payout platform, not a brand: the program behind this portal is
    OpenArt, so every payout is attributed to that tool. When a second Tolt
    program is added, `tool` becomes per-program rather than constant.
    """
    if not shutil.which("tolt-pp-cli") or not TOLT_SESSION.exists():
        return None
    env = load_env(TOLT_SESSION)
    token = env.get("TOLT_SESSION_TOKEN")
    if not token:
        return None

    runenv = dict(os.environ, TOLT_SESSION_COOKIE=token)
    try:
        raw = subprocess.run(
            ["tolt-pp-cli", "data", "list-payouts", "--json", "--no-cache"],
            capture_output=True, text=True, timeout=120, env=runenv, check=True)
        stats_raw = subprocess.run(
            ["tolt-pp-cli", "data", "get-payout-stats", "--json", "--no-cache"],
            capture_output=True, text=True, timeout=120, env=runenv, check=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        # A 401 here means the browser session lapsed. Say so plainly rather
        # than letting OpenArt money silently fall back into Untraced.
        print("  ! Tolt: %s — session may have expired, re-copy the cookie "
              "into %s" % (exc, TOLT_SESSION), file=sys.stderr)
        return None

    try:
        payouts = json.loads(raw.stdout)["results"]["data"]["payouts"]
        stats = json.loads(stats_raw.stdout)["results"]["data"]
    except (ValueError, KeyError) as exc:
        print("  ! Tolt: unexpected response shape (%s)" % exc, file=sys.stderr)
        return None

    return {
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        "program": "OpenArt",
        # Cents -> dollars, once, here.
        "payouts": [
            {
                "key": p.get("id"),
                # Tolt sends an ISO-8601 string, not the epoch millis that
                # iso_day() takes for the other networks. Slice the day off.
                "date": (p.get("created_at") or "")[:10] or None,
                "amount": _cents(p.get("amount")),
                "currency": "USD",
                "tool": "OpenArt",
                "status": p.get("status"),
                # The commission period the payout settles. The bank cannot know
                # this, and it is what lets a payout be reported in the month it
                # was EARNED rather than the month it landed.
                "period": p.get("period"),
                "invoice_id": p.get("invoice_id"),
            }
            for p in payouts
        ],
        "stats": {k: (_cents(v) if k.endswith(
            ("paid", "earned", "amount", "payout")) else v)
            for k, v in stats.items()},
    }


# ── Book Bolt (per-tool CLI source) ─────────────────────────────────────────
#
# The second CLI built to the pp-tolt template. Where Tolt reads a payout
# platform, this reads a single merchant's own affiliate portal.
#
# Book Bolt settles over PayPal, and PayPal already names its payers, so this
# source is not needed to *find* the money. It is needed to *check* it: the
# merchant ledger is the only independent statement of what Book Bolt believes
# it paid, and it is what resolved the payer-of-record question on 2026-08-31
# (payouts arrive from a Bulgarian entity on the digitalworks.net domain, which
# looked for a while like a separate advertiser).

BOOKBOLT_SESSION = pathlib.Path.home() / ".config/bookbolt-pp-cli/session.env"


def fetch_bookbolt():
    """Book Bolt payouts and balance. None when not configured.

    Amounts arrive from the CLI already in DOLLARS -- Book Bolt sends decimal
    strings in major units, and bookbolt-pp-cli normalises at its own boundary.
    Do not divide by 100 here; that is the Tolt shape, not this one.
    """
    if not shutil.which("bookbolt-pp-cli") or not BOOKBOLT_SESSION.exists():
        return None

    def run(*args):
        return subprocess.run(
            ["bookbolt-pp-cli", *args, "--json"],
            capture_output=True, text=True, timeout=180, check=True)

    try:
        payouts_raw = run("payouts")
        stats_raw = run("stats")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        # A rejected password is terminal by design in the CLI -- it will not
        # retry, because five failures lock the account. Surface that loudly
        # rather than letting Book Bolt quietly read as zero income.
        print("  ! Book Bolt: %s — check %s (the CLI will NOT retry a bad "
              "password; five failures lock the account)" % (exc, BOOKBOLT_SESSION),
              file=sys.stderr)
        return None

    try:
        payouts = json.loads(payouts_raw.stdout)
        stats = json.loads(stats_raw.stdout)
    except ValueError as exc:
        print("  ! Book Bolt: unexpected response shape (%s)" % exc, file=sys.stderr)
        return None

    return {
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        "program": "Book Bolt",
        "rail": "paypal",
        "payouts": [
            {
                "key": p.get("key"),
                "date": p.get("date"),
                "amount": p.get("amount"),      # already dollars
                "currency": "USD",
                "tool": "Book Bolt",
                "commissions": p.get("commissions"),
            }
            for p in (payouts.get("payouts") or [])
        ],
        "stats": {
            "total_paid": payouts.get("total_paid"),
            "total_earned": stats.get("total_earned"),
            # Earned but NOT yet sent. This is not income: counting it would
            # double against the month it actually transfers in.
            "current_unpaid": stats.get("current_unpaid"),
            "payout_threshold": stats.get("payout_threshold"),
        },
    }


def preflight():
    """Check every income source before a run, and say what is missing.

    This exists because a missing CLI or an unset credential is otherwise
    invisible: the source simply returns nothing, its money lands in Untraced,
    and the dashboard quietly understates how much it knows. A source that is
    down must be *named* as down, not absorbed.

    Returns a list of {id, label, ok, detail}.
    """
    out = []

    # PayPal — CLI on PATH plus creds outside the repo.
    pp_cli = shutil.which("paypal-txns-pp-cli")
    pp_creds = pathlib.Path.home() / ".config/paypal-txns-pp-cli/creds.env"
    out.append({
        "id": "paypal", "label": "PayPal",
        "ok": bool(pp_cli) and pp_creds.exists(),
        "detail": "ready" if pp_cli and pp_creds.exists()
        else "CLI missing (npx -y @mvanhorn/printing-press-library install paypal-txns --cli-only)"
        if not pp_cli else f"no creds at {pp_creds}",
    })

    # Tolt — per-tool CLI plus a browser session that expires every ~2 weeks.
    tolt_cli = shutil.which("tolt-pp-cli")
    tolt_ok = bool(tolt_cli) and TOLT_SESSION.exists()
    out.append({
        "id": "tolt", "label": "Tolt (OpenArt)",
        "ok": tolt_ok,
        "detail": "ready" if tolt_ok
        else "CLI missing (build from ~/printing-press/library/tolt)" if not tolt_cli
        else f"no session at {TOLT_SESSION} — copy the cookie from a logged-in browser",
    })

    # Book Bolt — per-tool CLI plus a stored password. The portal's session is
    # only two hours, so the CLI logs itself in rather than holding a cookie.
    bb_cli = shutil.which("bookbolt-pp-cli")
    bb_ok = bool(bb_cli) and BOOKBOLT_SESSION.exists()
    out.append({
        "id": "bookbolt", "label": "Book Bolt",
        "ok": bb_ok,
        "detail": "ready" if bb_ok
        else "CLI missing (build from ~/printing-press/library/bookbolt)" if not bb_cli
        else f"no credentials at {BOOKBOLT_SESSION}",
    })

    # impact.com — CLI on PATH plus both env vars from infra/secrets.
    im_cli = shutil.which("impact-pp-cli")
    im_env = load_env(repo_root() / "infra/secrets/impact.env")
    im_ok = bool(im_cli) and bool(im_env.get("IMPACT_ACCOUNT_SID")) and bool(im_env.get("IMPACT_AUTH_TOKEN"))
    out.append({
        "id": "impact", "label": "impact.com", "ok": im_ok,
        "detail": "ready" if im_ok
        else "CLI missing" if not im_cli
        else "infra/secrets/impact.env missing IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN",
    })

    # PartnerStack — a key is all it needs; this module calls the API directly.
    ps_env = load_env(repo_root() / "infra/secrets/partnerstack.env")
    ps_ok = bool(ps_env.get("PARTNERSTACK_API_KEY") or os.environ.get("PARTNERSTACK_API_KEY"))
    out.append({
        "id": "partnerstack", "label": "PartnerStack", "ok": ps_ok,
        "detail": "ready" if ps_ok
        else "infra/secrets/partnerstack.env missing PARTNERSTACK_API_KEY",
    })

    # PayKickstart — deliberately parked; reported so its absence is never a surprise.
    out.append({
        "id": "paykickstart", "label": "PayKickstart", "ok": False,
        "detail": "parked — affiliate accounts have no API access",
    })
    return out


def print_preflight(checks):
    print("  Sources")
    for c in checks:
        mark = "ok  " if c["ok"] else "--  "
        print(f"    {mark}{c['label']:<14} {c['detail']}")
    missing = [c["label"] for c in checks if not c["ok"] and c["id"] != "paykickstart"]
    if missing:
        print(f"\n  !! {', '.join(missing)} unavailable — money from "
              f"{'it' if len(missing) == 1 else 'them'} will show as UNTRACED, "
              f"not as zero.")


# ── entry point ─────────────────────────────────────────────────────────────

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    months = sys.argv[1:] or []

    ps = fetch_partnerstack()
    if ps:
        (RAW / "partnerstack.json").write_text(json.dumps(ps, indent=1, ensure_ascii=False))
        print(f"  PartnerStack: {len(ps['payouts'])} payouts, "
              f"{len(ps['rewards'])} rewards, {len(ps['tools'])} tools")
    else:
        print("  PartnerStack: no key configured, skipped")

    if months:
        im = fetch_impact_by_month(months)
        if im:
            (RAW / "impact.json").write_text(json.dumps(im, indent=1, ensure_ascii=False))
            tools = {p["tool"] for ps_ in im.values() for p in ps_}
            print(f"  impact.com: {len(im)} months, {len(tools)} earning tools")
        else:
            print("  impact.com: no data, skipped")


if __name__ == "__main__":
    main()
