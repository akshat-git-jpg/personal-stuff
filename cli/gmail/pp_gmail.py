"""pp-gmail — agent-native CLI for Gmail.

Talks to Gmail's API directly (no MCP, no Claude in the loop). Designed so
bash crons can fetch/filter mail and pipe compact text into a single
`claude -p` call for the LLM-bound steps (or skip Claude entirely for
deterministic crons like auto-archive).

Reuses mcp/google-shared/ OAuth — same token cache as the gmail MCP.

Subcommands:
  search QUERY [--account EMAIL] [--max N] [--format ids|short|json]
  get THREAD_ID [THREAD_ID ...] [--account EMAIL] [--format plain|json]
  prefs [--account EMAIL]
  archive THREAD_ID [THREAD_ID ...] [--account EMAIL]
  count QUERY [--account EMAIL]
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from email.utils import getaddresses, parseaddr
from pathlib import Path
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from auth import get_credentials

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PREFS_DIR = REPO_ROOT / "email-assistant"


def _service(account: str):
    return build("gmail", "v1", credentials=get_credentials(account))


def _header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _decode_body(payload: dict) -> str:
    def walk(part: dict) -> Optional[str]:
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if mime == "text/plain" and data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        for sub in part.get("parts", []) or []:
            found = walk(sub)
            if found:
                return found
        return None

    text = walk(payload)
    if text is not None:
        return text.strip()
    data = payload.get("body", {}).get("data")
    if data:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace").strip()
    return ""


def _short_from(addr: str) -> str:
    name, email = parseaddr(addr)
    if name:
        return name
    return email or addr


def cmd_search(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    resp = (
        svc.users()
        .messages()
        .list(userId="me", q=args.query, maxResults=args.max)
        .execute()
    )
    refs = resp.get("messages", []) or []

    rows = []
    for ref in refs:
        msg = (
            svc.users()
            .messages()
            .get(
                userId="me",
                id=ref["id"],
                format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"],
            )
            .execute()
        )
        headers = msg.get("payload", {}).get("headers", [])
        rows.append(
            {
                "thread_id": msg.get("threadId"),
                "message_id": msg.get("id"),
                "from": _header(headers, "From"),
                "to": _header(headers, "To"),
                "subject": _header(headers, "Subject"),
                "date": _header(headers, "Date"),
                "unread": "UNREAD" in msg.get("labelIds", []),
                "snippet": msg.get("snippet", ""),
            }
        )

    if args.format == "json":
        json.dump({"count": len(rows), "messages": rows}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    elif args.format == "ids":
        for r in rows:
            print(r["thread_id"])
    else:  # short
        for r in rows:
            tag = " [UNREAD]" if r["unread"] else ""
            sender = _short_from(r["from"])
            subj = (r["subject"] or "(no subject)")[:80]
            print(f"{r['thread_id']}\t{r['date']}\t{sender}\t{subj}{tag}")
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    threads = []
    for tid in args.thread_ids:
        thread = (
            svc.users().threads().get(userId="me", id=tid, format="full").execute()
        )
        messages = []
        for msg in thread.get("messages", []):
            payload = msg.get("payload", {})
            headers = payload.get("headers", [])
            messages.append(
                {
                    "message_id": msg.get("id"),
                    "from": _header(headers, "From"),
                    "to": _header(headers, "To"),
                    "cc": _header(headers, "Cc"),
                    "date": _header(headers, "Date"),
                    "subject": _header(headers, "Subject"),
                    "body": _decode_body(payload),
                }
            )
        threads.append({"thread_id": tid, "messages": messages})

    if args.format == "json":
        json.dump(
            {"threads": threads} if len(threads) > 1 else threads[0],
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
    else:  # plain
        for t in threads:
            for i, m in enumerate(t["messages"]):
                subj = m["subject"] or "(no subject)"
                sender = _short_from(m["from"])
                marker = "===" if i == 0 else "---"
                print(f"{marker} {sender} — {subj} ({m['date']}) {marker}")
                if m["body"]:
                    print(m["body"])
                print()
    return 0


def cmd_prefs(args: argparse.Namespace) -> int:
    path = PREFS_DIR / f"email-preferences-{args.account}.md"
    if not path.exists():
        print(f"ERROR: no preferences file at {path}", file=sys.stderr)
        return 1
    sys.stdout.write(path.read_text())
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    for tid in args.thread_ids:
        svc.users().threads().modify(
            userId="me", id=tid, body={"removeLabelIds": ["INBOX"]}
        ).execute()
        print(f"archived {tid}")
    return 0


def cmd_count(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    total = 0
    page_token = None
    while True:
        resp = (
            svc.users()
            .messages()
            .list(userId="me", q=args.query, maxResults=500, pageToken=page_token)
            .execute()
        )
        total += len(resp.get("messages", []) or [])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    print(total)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-gmail",
        description="Agent-native Gmail CLI (shares OAuth with the gmail MCP).",
    )
    p.add_argument(
        "--account",
        default="kushalbakliwal25@gmail.com",
        help="Gmail account email (default: kushalbakliwal25@gmail.com).",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="Search Gmail with a Gmail query string.")
    s.add_argument("query", help="Gmail query, e.g. 'newer_than:2d is:unread'.")
    s.add_argument("--max", type=int, default=30, help="Max results (default 30).")
    s.add_argument(
        "--format",
        choices=["short", "ids", "json"],
        default="short",
        help="Output format. short: tab-separated lines (default). ids: thread_ids only. json: same shape as the MCP.",
    )
    s.set_defaults(func=cmd_search)

    g = sub.add_parser("get", help="Fetch full bodies of one or more threads.")
    g.add_argument("thread_ids", nargs="+", help="Thread IDs from `search --format ids`.")
    g.add_argument(
        "--format",
        choices=["plain", "json"],
        default="plain",
        help="plain: human/LLM-readable bodies (default). json: structured.",
    )
    g.set_defaults(func=cmd_get)

    pr = sub.add_parser("prefs", help="Print the email-preferences file for the account.")
    pr.set_defaults(func=cmd_prefs)

    a = sub.add_parser("archive", help="Remove INBOX label from one or more threads.")
    a.add_argument("thread_ids", nargs="+")
    a.set_defaults(func=cmd_archive)

    c = sub.add_parser("count", help="Count messages matching a Gmail query.")
    c.add_argument("query")
    c.set_defaults(func=cmd_count)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except HttpError as e:
        print(f"ERROR: gmail api: {e}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
