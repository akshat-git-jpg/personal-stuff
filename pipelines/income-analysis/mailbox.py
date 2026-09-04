"""The mailboxes as an income source.

The bank statement says how much money arrived. The affiliate mailboxes say who
sent it and what for, which is the half the bank cannot supply. Every program
emails on two occasions worth reading:

  * an **accrual** -- "you earned $4.80" -- which names a tool and a date but is
    not money in hand;
  * a **payout** -- "your payment of Rs.20,185.19 has been transferred" -- which
    is money genuinely on its way to a bank.

Only the second kind can ever be matched to a bank credit, and even then only
when the mail states an exact amount in the currency the bank received. Anything
short of that becomes a *lead* on an untraced row, never an attribution. That
split is the whole design: a wrong tool name silently corrupts the one number the
owner treats as truth, while an honest gap merely stays a gap.

Read-only IMAP, stdlib only, so it runs unchanged on Windows.
"""

from __future__ import annotations

import email
import imaplib
import json
import re
from collections import namedtuple
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SECRETS = REPO / "infra" / "secrets" / "hostinger-mail.env"
ACCOUNTS = REPO / "apps" / "telegram-email-assistant" / "imap-accounts.json"

# Hostinger keeps everything under INBOX. Junk is included on purpose: real
# payout notices land there (verified 2026-08-30).
FOLDERS = ("INBOX", "INBOX.Junk")

# Sender domains are what the mail carries; these are what a person calls them.
# A domain in the Source column reads as plumbing, not as an answer.
SOURCE_LABEL = {
    "app.impact.com": "impact.com",
    "impact.com": "impact.com",
    "partnerstackmail.com": "PartnerStack",
    "getrewardful.com": "Rewardful",
    "rewardful.com": "Rewardful",
    "bookbolt.io": "Book Bolt",
    "tolt.com": "Tolt",
    "firstpromoter.com": "FirstPromoter",
}


def label(domain):
    return SOURCE_LABEL.get(domain, domain)


# One row of evidence pulled out of a mail.
Event = namedtuple("Event", "date kind tool amount currency source subject")


# ── plumbing ────────────────────────────────────────────────────────────────

class _Strip(HTMLParser):
    """Crude HTML -> text. Enough to find an amount and a program name."""

    SKIP = {"script", "style", "head", "title"}

    def __init__(self):
        super().__init__()
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)

    def text(self):
        return re.sub(r"\s+", " ", "".join(self.out)).strip()


def _hdr(raw):
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def _body(msg):
    """The longest text part, HTML flattened. Longest wins because the plain-text
    alternative is often a one-line 'view in browser' stub."""
    best = ""
    for part in (msg.walk() if msg.is_multipart() else [msg]):
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            txt = (part.get_payload(decode=True) or b"").decode(
                part.get_content_charset() or "utf-8", "replace")
        except Exception:
            continue
        if ctype == "text/html":
            p = _Strip()
            p.feed(txt)
            txt = p.text()
        else:
            txt = re.sub(r"\s+", " ", txt).strip()
        if len(txt) > len(best):
            best = txt
    return best


def load_secrets(path=SECRETS):
    """Parse KEY=VALUE, tolerating the `export ` prefix these files often carry."""
    out = {}
    if not Path(path).exists():
        return out
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


# ── parsers, one per sender that actually says something useful ─────────────
#
# Each returns (kind, tool, amount, currency) or None. Keep them strict: a
# parser that guesses is worse than no parser, because its output is trusted
# further down. When a program changes its wording the parser should go quiet,
# not start inventing.

def _p_bookbolt(frm, subj, body):
    if "bookbolt.io" not in frm:
        return None
    m = re.search(r"Commission Amount:\s*\$([0-9,.]+)\s*USD", body)
    return ("accrual", "Book Bolt", float(m.group(1).replace(",", "")), "USD") if m else None


def _p_impact(frm, subj, body):
    """impact.com pays in rupees straight to a bank -- the one source whose mail
    states the exact figure the bank will see."""
    if "impact.com" not in frm or "payment processed" not in subj.lower():
        return None
    m = re.search(r"payment of\s*Rs\.?\s*([0-9][0-9,]*\.?[0-9]*)", body)
    return ("payout", None, float(m.group(1).replace(",", "")), "INR") if m else None


def _p_partnerstack(frm, subj, body):
    if "partnerstack" not in frm:
        return None
    m = re.search(r"Payout of\s*\$([0-9,.]+)\s*USD", subj)
    return ("payout", None, float(m.group(1).replace(",", "")), "USD") if m else None


def _p_rewardful_payout(frm, subj, body):
    """Rewardful names the program in the subject but never the amount."""
    if "getrewardful.com" not in frm or "payout is ready" not in subj.lower():
        return None
    m = re.match(r"Your (.+?) payout is ready", subj, re.I)
    if not m:
        return None
    prog = m.group(1)
    prog = re.sub(r"^Friends of\s+", "", prog)
    prog = re.sub(r"\s+Affiliates?$", "", prog).strip()
    return ("payout_undisclosed", prog, None, None)


def _p_rewardful_accrual(frm, subj, body):
    if "affiliates@rewardful.com" not in frm or "earned a commission" not in subj.lower():
        return None
    m = re.search(r"\$([0-9,.]+)", body)
    return ("accrual", None, float(m.group(1).replace(",", "")), "USD") if m else None


PARSERS = (_p_impact, _p_partnerstack, _p_rewardful_payout,
           _p_rewardful_accrual, _p_bookbolt)

# A cheap pre-filter so we only download bodies worth parsing.
INTERESTING = re.compile(
    r"commission|payout|payment processed|earned|paid|withdraw", re.I)


# ── the fetch ───────────────────────────────────────────────────────────────

def fetch_events(since_month="2026-01", accounts_path=ACCOUNTS, secrets_path=SECRETS):
    """Return (events, notes). Never raises: a mailbox that will not open is a
    note, not a crash, because the tally must still run without it."""
    events, notes = [], []
    try:
        cfgs = json.loads(Path(accounts_path).read_text())
    except Exception as exc:
        return [], ["accounts file unreadable: %s" % exc]
    env = load_secrets(secrets_path)
    if not env:
        return [], ["no mailbox passwords at %s -- skipping the mailbox source"
                    % Path(secrets_path).name]

    since = datetime.strptime(since_month + "-01", "%Y-%m-%d")
    imap_since = since.strftime("%d-%b-%Y")

    for addr, cfg in cfgs.items():
        if addr.startswith("_"):
            continue
        pw = env.get(cfg.get("password_env", ""), "")
        if not pw:
            notes.append("%s: no password in escrow" % addr)
            continue
        try:
            events += _scan_one(addr, cfg, pw, imap_since, notes)
        except Exception as exc:
            notes.append("%s: %s" % (addr, exc))

    # The same mail lands in both mailboxes (they are one impact account), so an
    # event seen twice is one event.
    seen, uniq = set(), []
    for e in sorted(events, key=lambda e: (e.date, e.source, e.subject)):
        key = (e.date, e.kind, e.tool, e.amount, e.currency, e.subject)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)
    return uniq, notes


def _scan_one(addr, cfg, pw, imap_since, notes):
    out = []
    M = imaplib.IMAP4_SSL(cfg.get("host", "imap.hostinger.com"), cfg.get("port", 993))
    try:
        M.login(addr, pw)
        for folder in FOLDERS:
            ok, _ = M.select(folder, readonly=True)
            if ok != "OK":
                continue
            ok, data = M.search(None, "SINCE", imap_since)
            if ok != "OK" or not data or not data[0]:
                continue
            ids = data[0].split()
            # Two-step: cheap header sweep, then bodies only for the survivors.
            wanted = []
            for i in range(0, len(ids), 200):
                ok, resp = M.fetch(b",".join(ids[i:i + 200]),
                                   "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])")
                if ok != "OK":
                    continue
                for j, part in enumerate([p for p in resp if isinstance(p, tuple)]):
                    m = email.message_from_bytes(part[1])
                    if INTERESTING.search(_hdr(m.get("Subject")) or ""):
                        wanted.append(ids[i + j])
            for i in range(0, len(wanted), 40):
                ok, resp = M.fetch(b",".join(wanted[i:i + 40]), "(RFC822)")
                if ok != "OK":
                    continue
                for part in resp:
                    if not isinstance(part, tuple):
                        continue
                    ev = _parse(email.message_from_bytes(part[1]))
                    if ev:
                        out.append(ev)
    finally:
        try:
            M.logout()
        except Exception:
            pass
    return out


def _parse(msg):
    frm = parseaddr(_hdr(msg.get("From")))[1].lower()
    subj = _hdr(msg.get("Subject"))
    body = _body(msg)
    for parser in PARSERS:
        got = parser(frm, subj, body)
        if not got:
            continue
        kind, tool, amount, currency = got
        try:
            date = parsedate_to_datetime(msg.get("Date")).date().isoformat()
        except Exception:
            return None
        # The sender domain is the source; the local part is a person's address
        # and never leaves this function.
        return Event(date, kind, tool, amount, currency,
                     frm.split("@")[-1], subj[:120])
    return None


# ── turning events into leads ───────────────────────────────────────────────

def leads_for_credit(credit_date, amount_inr, events, window_days=45):
    """Mail worth reading next to one untraced bank credit.

    Ordered by how strong the evidence is, not by date: an exact-rupee payout is
    an answer, a dated payout is a candidate, and accruals are only ever context.
    """
    try:
        when = datetime.strptime(credit_date, "%d/%m/%Y")
    except ValueError:
        return []
    out = []
    for e in events:
        d = datetime.strptime(e.date, "%Y-%m-%d")
        gap = (when - d).days
        if not (0 <= gap <= window_days):
            continue
        if e.kind == "payout" and e.currency == "INR":
            # The only case where mail alone can settle it.
            exact = abs(e.amount - amount_inr) <= 1.0
            out.append({"strength": 0 if exact else 2, "gap_days": gap,
                        "source": label(e.source), "kind": e.kind,
                        "what": "emailed a payout of Rs.%s%s" % (
                            format(e.amount, ",.2f"),
                            " — exactly this credit" if exact else "")})
        elif e.kind == "payout":
            out.append({"strength": 1, "gap_days": gap, "source": label(e.source),
                        "kind": e.kind,
                        "what": "emailed a payout of %s %s" % (
                            e.currency, format(e.amount, ",.2f"))})
        elif e.kind == "payout_undisclosed":
            out.append({"strength": 2, "gap_days": gap, "source": label(e.source),
                        "kind": e.kind,
                        "what": "released a %s payout (the mail does not state the amount)"
                                % e.tool})
    out.sort(key=lambda x: (x["strength"], x["gap_days"]))
    return out[:4]


def accrual_totals(events):
    """Per tool, per month, what the mail says was *earned*.

    Earned is not received -- Rewardful's Lovable and EverBee commissions have
    been accruing since Feb 2026 behind a blocked Tipalti verification. Useful as
    a sanity check against the tally, never as income.
    """
    out = {}
    for e in events:
        if e.kind != "accrual" or not e.tool or not e.amount:
            continue
        out.setdefault(e.date[:7], {}).setdefault(e.tool, 0.0)
        out[e.date[:7]][e.tool] = round(out[e.date[:7]][e.tool] + e.amount, 2)
    return out
