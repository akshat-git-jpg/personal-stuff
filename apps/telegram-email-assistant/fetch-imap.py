#!/usr/bin/env python3
"""Fetch recent mail from a plain IMAP mailbox as digest-ready plain text.

The Gmail side of the digest goes through `tooling/cli/gmail/pp-gmail`, which
speaks the Gmail API and OAuth. Hostinger (and any other non-Gmail host) has
neither, so this reader talks IMAP directly and prints the SAME shape
`pp-gmail get --format plain` prints, so digest.sh can inline either one:

    === sender — subject (date) ===
    <body>

Stdlib only: imaplib, email, html.parser. No installs, no venv.

Usage:
    ./fetch-imap.py <email> [--days N] [--max N] [--accounts PATH]

Credentials come from a gitignored JSON file (default:
apps/telegram-email-assistant/imap-accounts.json):

    {
      "user@example.com": {
        "host": "imap.hostinger.com",
        "port": 993,
        "password": "..."
      }
    }

`port` defaults to 993 (implicit TLS). `password` may instead be given as
"password_env": "SOME_ENV_VAR" to keep the secret out of the file.

Errors print a single "ERROR: " line to stderr and exit 1.
"""

from __future__ import annotations

import argparse
import email
import imaplib
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr
from html.parser import HTMLParser
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
DEFAULT_ACCOUNTS = APP_DIR / "imap-accounts.json"

# Promo mail can carry a 200 KB HTML body. The digest only needs the gist, and
# every extra character is a token in the summarization pass.
BODY_CHAR_CAP = 4000


class _Stripper(HTMLParser):
    """Crude HTML -> text. Good enough for 'what is this email about'."""

    SKIP = {"script", "style", "head", "title"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        elif tag in ("p", "br", "div", "tr", "li", "h1", "h2", "h3"):
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth:
            self._parts.append(data)

    def text(self) -> str:
        raw = "".join(self._parts)
        lines = [ln.strip() for ln in raw.splitlines()]
        return "\n".join(ln for ln in lines if ln)


def _strip_html(html: str) -> str:
    parser = _Stripper()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        return html
    return parser.text()


def _decode(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def _short_from(raw: str) -> str:
    name, addr = parseaddr(_decode(raw))
    return name or addr or raw


def _payload_text(part) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        return payload.decode("utf-8", errors="replace")


def _body(msg: email.message.Message) -> str:
    """Prefer text/plain; fall back to stripped text/html. Mirrors pp-gmail."""
    plain, html = "", ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get_filename():
                continue
            ctype = part.get_content_type()
            if ctype == "text/plain" and not plain:
                plain = _payload_text(part)
            elif ctype == "text/html" and not html:
                html = _payload_text(part)
    else:
        text = _payload_text(msg)
        if msg.get_content_type() == "text/html":
            html = text
        else:
            plain = text

    body = plain.strip() or _strip_html(html).strip()
    if len(body) > BODY_CHAR_CAP:
        body = body[:BODY_CHAR_CAP] + "\n… [truncated]"
    return body


def _load_account(accounts_path: Path, address: str) -> dict:
    if not accounts_path.exists():
        raise SystemExit(
            f"ERROR: no IMAP accounts file at {accounts_path}. "
            "Create it (see the docstring in this file) — it is gitignored."
        )
    try:
        accounts = json.loads(accounts_path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR: {accounts_path} is not valid JSON: {exc}")

    entry = accounts.get(address)
    if not entry:
        raise SystemExit(f"ERROR: no IMAP entry for {address} in {accounts_path}")

    password = entry.get("password")
    if not password and entry.get("password_env"):
        password = os.environ.get(entry["password_env"])
    if not password:
        raise SystemExit(f"ERROR: no password for {address} in {accounts_path}")

    host = entry.get("host")
    if not host:
        raise SystemExit(f"ERROR: no host for {address} in {accounts_path}")

    return {
        "host": host,
        "port": int(entry.get("port", 993)),
        "user": entry.get("user", address),
        "password": password,
        "mailbox": entry.get("mailbox", "INBOX"),
    }


def fetch(address: str, days: int, max_emails: int, accounts_path: Path) -> list[str]:
    acct = _load_account(accounts_path, address)
    # IMAP SINCE is date-granular, so `days` is a floor, not an exact window.
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%d-%b-%Y")

    try:
        conn = imaplib.IMAP4_SSL(acct["host"], acct["port"])
    except Exception as exc:
        raise SystemExit(f"ERROR: cannot reach {acct['host']}:{acct['port']} — {exc}")

    try:
        try:
            conn.login(acct["user"], acct["password"])
        except imaplib.IMAP4.error as exc:
            raise SystemExit(f"ERROR: IMAP login failed for {address} — {exc}")

        status, _ = conn.select(acct["mailbox"], readonly=True)
        if status != "OK":
            raise SystemExit(f"ERROR: cannot open mailbox {acct['mailbox']} for {address}")

        status, data = conn.search(None, "SINCE", since)
        if status != "OK":
            raise SystemExit(f"ERROR: IMAP search failed for {address}")

        uids = data[0].split()
        uids = uids[-max_emails:]  # newest N

        rendered: list[str] = []
        for uid in uids:
            status, msg_data = conn.fetch(uid, "(RFC822)")
            if status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            sender = _short_from(msg.get("From", ""))
            subject = _decode(msg.get("Subject")) or "(no subject)"
            date = _decode(msg.get("Date"))
            block = f"=== {sender} — {subject} ({date}) ==="
            body = _body(msg)
            if body:
                block += "\n" + body
            rendered.append(block)
        return rendered
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("address", help="mailbox address, e.g. you@yourdomain.com")
    ap.add_argument("--days", type=int, default=2, help="look back N days (default 2)")
    ap.add_argument("--max", type=int, default=50, dest="max_emails",
                    help="cap on messages fetched (default 50)")
    ap.add_argument("--accounts", type=Path, default=DEFAULT_ACCOUNTS,
                    help=f"IMAP credentials JSON (default {DEFAULT_ACCOUNTS})")
    ap.add_argument("--count-only", action="store_true",
                    help="print just the number of messages found")
    ap.add_argument("--has-account", action="store_true",
                    help="exit 0 if the address is configured for IMAP, else 1. "
                         "Prints nothing, connects to nothing — this is the routing "
                         "check digest.sh uses to pick a reader.")
    args = ap.parse_args()

    if args.has_account:
        if not args.accounts.exists():
            return 1
        try:
            accounts = json.loads(args.accounts.read_text())
        except (json.JSONDecodeError, OSError):
            return 1
        return 0 if args.address in accounts else 1

    blocks = fetch(args.address, args.days, args.max_emails, args.accounts)

    if args.count_only:
        print(len(blocks))
        return 0

    if not blocks:
        # Wording matters: the cron wrapper (/srv/crons/gmail-digest/run.sh)
        # treats a line starting "ERROR: no emails matched" as benign and sends
        # a 📭 note instead of a failure alert. Keep that prefix.
        print(
            f"ERROR: no emails matched the last {args.days}d window for {args.address}",
            file=sys.stderr,
        )
        return 1

    print("\n\n".join(blocks))
    return 0


if __name__ == "__main__":
    sys.exit(main())
