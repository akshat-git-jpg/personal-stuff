from __future__ import annotations

import asyncio
import base64
import json
from email.message import EmailMessage
from email.utils import getaddresses
from pathlib import Path
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

from auth import get_credentials

BASE_DIR = Path(__file__).parent
PROJECT_ROOT = BASE_DIR.parent.parent  # mcp/gmail-mcp-server -> mcp -> project root

app = Server("gmail")


# ---------------------------------------------------------------------------
# Gmail service + small helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    creds = get_credentials(account)
    return build("gmail", "v1", credentials=creds)


def prefs_path(account: str) -> Path:
    return PROJECT_ROOT / f"email-preferences-{account}.md"


def header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def decode_body(payload: dict) -> str:
    """Return the best-effort plain-text body of a Gmail message payload."""

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


def encode_message(msg: EmailMessage) -> str:
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def build_message(
    to: str,
    subject: str,
    body: str,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    extra_headers: Optional[dict] = None,
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
    return msg


def reply_fields(thread: dict, self_email: str, reply_all: bool) -> dict:
    """Compute To/Cc/Subject and threading headers for a reply to the latest
    message in a thread."""
    messages = thread.get("messages", [])
    if not messages:
        raise ValueError("Thread has no messages to reply to.")
    last = messages[-1]
    headers = last.get("payload", {}).get("headers", [])

    orig_subject = header(headers, "Subject")
    subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"

    from_addr = header(headers, "From")
    to_field = from_addr

    cc_field = None
    if reply_all:
        pool = []
        for hname in ("From", "To", "Cc"):
            pool.extend(addr for _, addr in getaddresses([header(headers, hname)]) if addr)
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

    message_id = header(headers, "Message-ID")
    references = header(headers, "References")
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


# ---------------------------------------------------------------------------
# Read tools
# ---------------------------------------------------------------------------

def do_search(service, query: str, max_results: int) -> str:
    listing = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    refs = listing.get("messages", [])
    results = []
    for ref in refs:
        msg = (
            service.users()
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
        results.append(
            {
                "thread_id": msg.get("threadId"),
                "message_id": msg.get("id"),
                "from": header(headers, "From"),
                "to": header(headers, "To"),
                "subject": header(headers, "Subject"),
                "date": header(headers, "Date"),
                "unread": "UNREAD" in msg.get("labelIds", []),
                "snippet": msg.get("snippet", ""),
            }
        )
    return json.dumps({"count": len(results), "messages": results}, indent=2)


def do_get_thread(service, thread_id: str) -> str:
    thread = (
        service.users().threads().get(userId="me", id=thread_id, format="full").execute()
    )
    messages = []
    for msg in thread.get("messages", []):
        payload = msg.get("payload", {})
        headers = payload.get("headers", [])
        messages.append(
            {
                "message_id": msg.get("id"),
                "from": header(headers, "From"),
                "to": header(headers, "To"),
                "cc": header(headers, "Cc"),
                "date": header(headers, "Date"),
                "subject": header(headers, "Subject"),
                "body": decode_body(payload),
            }
        )
    return json.dumps({"thread_id": thread_id, "messages": messages}, indent=2)


# ---------------------------------------------------------------------------
# Send / draft tools
# ---------------------------------------------------------------------------

def do_send_email(service, args: dict) -> str:
    msg = build_message(
        to=args["to"],
        subject=args.get("subject", ""),
        body=args["body"],
        cc=args.get("cc"),
        bcc=args.get("bcc"),
    )
    sent = (
        service.users()
        .messages()
        .send(userId="me", body={"raw": encode_message(msg)})
        .execute()
    )
    return f"Sent. message id={sent.get('id')}, thread id={sent.get('threadId')}."


def do_reply_to_thread(service, args: dict, self_email: str) -> str:
    thread = (
        service.users()
        .threads()
        .get(userId="me", id=args["thread_id"], format="full")
        .execute()
    )
    fields = reply_fields(thread, self_email, args.get("reply_all", False))
    msg = build_message(
        to=fields["to"],
        subject=fields["subject"],
        body=args["body"],
        cc=fields["cc"],
        extra_headers=fields["extra_headers"],
    )
    sent = (
        service.users()
        .messages()
        .send(
            userId="me",
            body={"raw": encode_message(msg), "threadId": args["thread_id"]},
        )
        .execute()
    )
    return (
        f"Reply sent to {fields['to']}. message id={sent.get('id')}, "
        f"thread id={sent.get('threadId')}."
    )


def do_create_draft(service, args: dict) -> str:
    msg = build_message(
        to=args["to"],
        subject=args.get("subject", ""),
        body=args["body"],
        cc=args.get("cc"),
        bcc=args.get("bcc"),
    )
    draft = (
        service.users()
        .drafts()
        .create(userId="me", body={"message": {"raw": encode_message(msg)}})
        .execute()
    )
    return f"Draft created (in Gmail Drafts). draft id={draft.get('id')}."


def do_create_reply_draft(service, args: dict, self_email: str) -> str:
    thread = (
        service.users()
        .threads()
        .get(userId="me", id=args["thread_id"], format="full")
        .execute()
    )
    fields = reply_fields(thread, self_email, args.get("reply_all", False))
    msg = build_message(
        to=fields["to"],
        subject=fields["subject"],
        body=args["body"],
        cc=fields["cc"],
        extra_headers=fields["extra_headers"],
    )
    draft = (
        service.users()
        .drafts()
        .create(
            userId="me",
            body={"message": {"raw": encode_message(msg), "threadId": args["thread_id"]}},
        )
        .execute()
    )
    return f"Reply draft created (in Gmail Drafts). draft id={draft.get('id')}."


# ---------------------------------------------------------------------------
# Preferences tools
# ---------------------------------------------------------------------------

def do_read_preferences(account: str) -> str:
    path = prefs_path(account)
    if not path.exists():
        return "(No preferences set yet.)"
    return path.read_text().strip() or "(No preferences set yet.)"


def do_update_preferences(account: str, content: str) -> str:
    path = prefs_path(account)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return f"Preferences saved to {path.name}."


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

ACCOUNT_PROP = {
    "account": {
        "type": "string",
        "description": "Full email address of the Google account to act as (e.g. 'you@gmail.com'). Required.",
    }
}


def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {**ACCOUNT_PROP, **props},
        "required": ["account", *required],
    }


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search_emails",
            description=(
                "Searches Gmail using Gmail query syntax (e.g. 'is:unread', "
                "'from:x newer_than:2d'). Returns matching message summaries with "
                "thread_id and message_id."
            ),
            inputSchema=_schema(
                {
                    "query": {"type": "string", "description": "Gmail search query"},
                    "max_results": {"type": "integer", "default": 20},
                },
                ["query"],
            ),
        ),
        types.Tool(
            name="get_thread",
            description="Returns a full thread: all messages in chronological order with bodies.",
            inputSchema=_schema({"thread_id": {"type": "string"}}, ["thread_id"]),
        ),
        types.Tool(
            name="send_email",
            description=(
                "Sends a NEW email. Only call after the user has reviewed and "
                "explicitly approved the message."
            ),
            inputSchema=_schema(
                {
                    "to": {"type": "string", "description": "Recipient(s), comma-separated"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                    "cc": {"type": "string"},
                    "bcc": {"type": "string"},
                },
                ["to", "subject", "body"],
            ),
        ),
        types.Tool(
            name="reply_to_thread",
            description=(
                "Sends a reply in an existing thread (proper threading headers, Re: "
                "subject, replies to the last sender). Only call after explicit user "
                "approval."
            ),
            inputSchema=_schema(
                {
                    "thread_id": {"type": "string"},
                    "body": {"type": "string"},
                    "reply_all": {"type": "boolean", "default": False},
                },
                ["thread_id", "body"],
            ),
        ),
        types.Tool(
            name="create_draft",
            description="Creates a NEW draft in Gmail Drafts (does not send).",
            inputSchema=_schema(
                {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                    "cc": {"type": "string"},
                    "bcc": {"type": "string"},
                },
                ["to", "subject", "body"],
            ),
        ),
        types.Tool(
            name="create_reply_draft",
            description="Creates a reply draft in an existing thread (does not send).",
            inputSchema=_schema(
                {
                    "thread_id": {"type": "string"},
                    "body": {"type": "string"},
                    "reply_all": {"type": "boolean", "default": False},
                },
                ["thread_id", "body"],
            ),
        ),
        types.Tool(
            name="read_email_preferences",
            description="Reads the preferences file for an account.",
            inputSchema=_schema({}, []),
        ),
        types.Tool(
            name="update_email_preferences",
            description="Overwrites an account's preferences file with new content.",
            inputSchema=_schema(
                {"content": {"type": "string", "description": "Full new preferences content"}},
                ["content"],
            ),
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    account = arguments.get("account")
    if not account:
        return [types.TextContent(
            type="text",
            text="Error: 'account' is required (full email of the Google account to use).",
        )]
    try:
        if name == "read_email_preferences":
            return [types.TextContent(type="text", text=do_read_preferences(account))]
        if name == "update_email_preferences":
            return [types.TextContent(
                type="text",
                text=do_update_preferences(account, arguments["content"]),
            )]

        service = get_service(account)

        if name == "search_emails":
            text = do_search(service, arguments["query"], arguments.get("max_results", 20))
        elif name == "get_thread":
            text = do_get_thread(service, arguments["thread_id"])
        elif name == "send_email":
            text = do_send_email(service, arguments)
        elif name == "reply_to_thread":
            text = do_reply_to_thread(service, arguments, account)
        elif name == "create_draft":
            text = do_create_draft(service, arguments)
        elif name == "create_reply_draft":
            text = do_create_reply_draft(service, arguments, account)
        else:
            text = f"Unknown tool: {name}"
        return [types.TextContent(type="text", text=text)]

    except HttpError as exc:
        return [types.TextContent(type="text", text=f"Gmail API error: {exc}")]
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        return [types.TextContent(type="text", text=f"Error: {exc}")]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="gmail",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
