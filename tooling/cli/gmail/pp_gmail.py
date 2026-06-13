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
  prefs-set [--account EMAIL] --content TEXT|@file|-     overwrite prefs file
  archive THREAD_ID [THREAD_ID ...] [--account EMAIL]
  count QUERY [--account EMAIL]
  send --to X --subject S --body TEXT|@file|- [--cc] [--bcc] [--attach FILE ...]
  reply THREAD_ID --body TEXT|@file|- [--reply-all] [--attach FILE ...]
  draft --to X --subject S --body TEXT|@file|- [--cc] [--bcc] [--attach FILE ...]
  reply-draft THREAD_ID --body TEXT|@file|- [--reply-all] [--attach FILE ...]
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
from email.message import EmailMessage
from email.utils import getaddresses, parseaddr
from pathlib import Path
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from auth import get_credentials

REPO_ROOT = Path(__file__).resolve().parents[3]  # tooling/cli/gmail -> repo root
PREFS_DIR = REPO_ROOT / "apps" / "email-assistant"


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


def _read_text_arg(raw: str) -> str:
    """Accept inline text, '@path' to read a file, or '-' for stdin."""
    if raw == "-":
        return sys.stdin.read()
    if raw.startswith("@"):
        return Path(raw[1:]).read_text()
    return raw


def _encode_message(msg: EmailMessage) -> str:
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def _build_message(
    to: str,
    subject: str,
    body: str,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    extra_headers: Optional[dict] = None,
    attachments: Optional[list[str]] = None,
) -> EmailMessage:
    msg = EmailMessage()
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc
    msg["Subject"] = subject
    for key, value in (extra_headers or {}).items():
        if value:
            msg[key] = value
    msg.set_content(body)
    for path_str in (attachments or []):
        path = Path(path_str).expanduser().resolve()
        data = path.read_bytes()
        mime_type, _ = mimetypes.guess_type(str(path))
        if mime_type and "/" in mime_type:
            main_type, sub_type = mime_type.split("/", 1)
        else:
            main_type, sub_type = "application", "octet-stream"
        msg.add_attachment(data, maintype=main_type, subtype=sub_type, filename=path.name)
    return msg


def _reply_fields(thread: dict, self_email: str, reply_all: bool) -> dict:
    """Compute To/Cc/Subject and threading headers for a reply to the latest
    message in a thread."""
    messages = thread.get("messages", [])
    if not messages:
        raise ValueError("Thread has no messages to reply to.")
    # prefer the last message NOT sent by self (avoids replying to yourself)
    last = messages[-1]
    for msg in reversed(messages):
        hdrs = msg.get("payload", {}).get("headers", [])
        from_val = next((h["value"] for h in hdrs if h["name"].lower() == "from"), "")
        if self_email.lower() not in from_val.lower():
            last = msg
            break
    headers = last.get("payload", {}).get("headers", [])

    orig_subject = _header(headers, "Subject")
    subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"

    from_addr = _header(headers, "From")
    to_field = from_addr

    cc_field = None
    if reply_all:
        pool = []
        for hname in ("From", "To", "Cc"):
            pool.extend(addr for _, addr in getaddresses([_header(headers, hname)]) if addr)
        seen = set()
        recipients = []
        for addr in pool:
            low = addr.lower()
            if low == self_email.lower() or low in seen:
                continue
            seen.add(low)
            recipients.append(addr)
        if recipients:
            to_field = recipients[0]
            if len(recipients) > 1:
                cc_field = ", ".join(recipients[1:])

    message_id = _header(headers, "Message-ID")
    references = _header(headers, "References")
    new_references = (references + " " + message_id).strip() if message_id else references

    return {
        "to": to_field,
        "cc": cc_field,
        "subject": subject,
        "extra_headers": {
            "In-Reply-To": message_id,
            "References": new_references,
        },
    }


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


def cmd_prefs_set(args: argparse.Namespace) -> int:
    path = PREFS_DIR / f"email-preferences-{args.account}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_read_text_arg(args.content))
    print(f"Preferences saved to {path.name}.")
    return 0


def cmd_send(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    msg = _build_message(
        to=args.to, subject=args.subject, body=_read_text_arg(args.body),
        cc=args.cc, bcc=args.bcc, attachments=args.attachments,
    )
    sent = svc.users().messages().send(
        userId="me", body={"raw": _encode_message(msg)}
    ).execute()
    print(f"Sent. message id={sent.get('id')}, thread id={sent.get('threadId')}.")
    return 0


def cmd_reply(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    thread = svc.users().threads().get(
        userId="me", id=args.thread_id, format="full"
    ).execute()
    fields = _reply_fields(thread, args.account, args.reply_all)
    msg = _build_message(
        to=fields["to"], subject=fields["subject"], body=_read_text_arg(args.body),
        cc=fields["cc"], extra_headers=fields["extra_headers"],
        attachments=args.attachments,
    )
    sent = svc.users().messages().send(
        userId="me", body={"raw": _encode_message(msg), "threadId": args.thread_id}
    ).execute()
    print(
        f"Reply sent to {fields['to']}. message id={sent.get('id')}, "
        f"thread id={sent.get('threadId')}."
    )
    return 0


def cmd_draft(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    msg = _build_message(
        to=args.to, subject=args.subject, body=_read_text_arg(args.body),
        cc=args.cc, bcc=args.bcc, attachments=args.attachments,
    )
    draft = svc.users().drafts().create(
        userId="me", body={"message": {"raw": _encode_message(msg)}}
    ).execute()
    print(f"Draft created (in Gmail Drafts). draft id={draft.get('id')}.")
    return 0


def cmd_reply_draft(args: argparse.Namespace) -> int:
    svc = _service(args.account)
    thread = svc.users().threads().get(
        userId="me", id=args.thread_id, format="full"
    ).execute()
    fields = _reply_fields(thread, args.account, args.reply_all)
    msg = _build_message(
        to=fields["to"], subject=fields["subject"], body=_read_text_arg(args.body),
        cc=fields["cc"], extra_headers=fields["extra_headers"],
        attachments=args.attachments,
    )
    draft = svc.users().drafts().create(
        userId="me",
        body={"message": {"raw": _encode_message(msg), "threadId": args.thread_id}},
    ).execute()
    print(f"Reply draft created (in Gmail Drafts). draft id={draft.get('id')}.")
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

    ps = sub.add_parser("prefs-set", help="Overwrite the email-preferences file for the account.")
    ps.add_argument("--content", required=True, help="Full new content (or @file, or '-' for stdin).")
    ps.set_defaults(func=cmd_prefs_set)

    se = sub.add_parser("send", help="Send a NEW email (only after explicit user approval).")
    se.add_argument("--to", required=True, help="Recipient(s), comma-separated.")
    se.add_argument("--subject", required=True)
    se.add_argument("--body", required=True, help="Body text (or @file, or '-' for stdin).")
    se.add_argument("--cc")
    se.add_argument("--bcc")
    se.add_argument("--attach", action="append", metavar="FILE", dest="attachments", default=[], help="Attach a file (repeat for multiple).")
    se.set_defaults(func=cmd_send)

    rp = sub.add_parser("reply", help="Send a reply in an existing thread (proper threading headers).")
    rp.add_argument("thread_id")
    rp.add_argument("--body", required=True, help="Body text (or @file, or '-' for stdin).")
    rp.add_argument("--reply-all", action="store_true")
    rp.add_argument("--attach", action="append", metavar="FILE", dest="attachments", default=[], help="Attach a file (repeat for multiple).")
    rp.set_defaults(func=cmd_reply)

    dr = sub.add_parser("draft", help="Create a NEW draft in Gmail Drafts (does not send).")
    dr.add_argument("--to", required=True)
    dr.add_argument("--subject", required=True)
    dr.add_argument("--body", required=True, help="Body text (or @file, or '-' for stdin).")
    dr.add_argument("--cc")
    dr.add_argument("--bcc")
    dr.add_argument("--attach", action="append", metavar="FILE", dest="attachments", default=[], help="Attach a file (repeat for multiple).")
    dr.set_defaults(func=cmd_draft)

    rd = sub.add_parser("reply-draft", help="Create a reply draft in an existing thread (does not send).")
    rd.add_argument("thread_id")
    rd.add_argument("--body", required=True, help="Body text (or @file, or '-' for stdin).")
    rd.add_argument("--reply-all", action="store_true")
    rd.add_argument("--attach", action="append", metavar="FILE", dest="attachments", default=[], help="Attach a file (repeat for multiple).")
    rd.set_defaults(func=cmd_reply_draft)

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
