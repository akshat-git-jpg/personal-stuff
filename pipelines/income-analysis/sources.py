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
                "amount": (p.get("amount") or 0) / 100,
                "currency": p.get("currency"),
                "status": p.get("status"),
            }
            for p in payouts
        ],
        "rewards": [
            {
                "key": r.get("key"),
                "date": iso_day(r.get("created_at")),
                "amount": (r.get("amount") or 0) / 100,
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
    """One call per month — the report has no month dimension on this endpoint."""
    out = {}
    for m in months:
        y, mo = int(m[:4]), int(m[5:7])
        last = (dt.date(y + (mo == 12), (mo % 12) + 1, 1) - dt.timedelta(days=1)).day
        got = fetch_impact(f"{m}-01", f"{m}-{last:02d}")
        if got:
            out[m] = got["programs"]
    return out


# ── preflight ───────────────────────────────────────────────────────────────

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
