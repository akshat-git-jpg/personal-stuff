from __future__ import annotations
import asyncio
import re
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

BASE_DIR = Path(__file__).parent

app = Server("google-docs")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_docs_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("docs", "v1", credentials=creds)


def get_drive_service(account: str):
    """delete_doc needs Drive (Docs API has no delete)."""
    from auth import get_credentials
    creds = get_credentials(account)
    return build("drive", "v3", credentials=creds)


_URL_ID_RE = re.compile(r"/document/d/([a-zA-Z0-9-_]+)")


def _extract_id(doc: str) -> str:
    """Accept a raw document ID or a pasted URL."""
    s = doc.strip()
    m = _URL_ID_RE.search(s)
    return m.group(1) if m else s


def _doc_to_plain_text(doc: dict) -> str:
    """Flatten a Docs API document into plain text."""
    out_parts: list[str] = []
    for element in doc.get("body", {}).get("content", []):
        para = element.get("paragraph")
        if not para:
            # Could be a table, sectionBreak, etc. Skip for plain-text purposes.
            continue
        for el in para.get("elements", []):
            text_run = el.get("textRun")
            if text_run:
                out_parts.append(text_run.get("content", ""))
    return "".join(out_parts)


def _body_end_index(doc: dict) -> int:
    """Index just before the trailing newline at the end of the body.
    Inserting at this index appends text to the existing body."""
    content = doc.get("body", {}).get("content", [])
    if not content:
        return 1
    last = content[-1]
    # Google Docs always has a final empty paragraph; insert at its start.
    end = last.get("endIndex", 1)
    return max(1, end - 1)


def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

_ACCT = {
    "type": "string",
    "description": "Full email address of the Google account to act as. Required.",
}
_DOC = {"type": "string", "description": "Document ID or full URL"}


def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {"account": _ACCT, **props},
        "required": ["account", *required],
    }


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_doc",
            description=(
                "Creates a new empty Google Doc and returns its ID and URL. "
                "Optionally writes 'body' as the initial content."
            ),
            inputSchema=_schema(
                {
                    "title": {"type": "string"},
                    "body": {
                        "type": "string",
                        "description": "Optional initial body text to insert after creation.",
                    },
                },
                ["title"],
            ),
        ),
        types.Tool(
            name="get_doc",
            description="Returns the plain-text body of a Google Doc.",
            inputSchema=_schema({"doc": _DOC}, ["doc"]),
        ),
        types.Tool(
            name="append_text",
            description="Appends text to the end of a document's body.",
            inputSchema=_schema(
                {"doc": _DOC, "text": {"type": "string"}},
                ["doc", "text"],
            ),
        ),
        types.Tool(
            name="replace_text",
            description=(
                "Replaces every occurrence of 'find' with 'replace' across the document. "
                "Use this for targeted edits (find a marker phrase + replace with new content)."
            ),
            inputSchema=_schema(
                {
                    "doc": _DOC,
                    "find": {"type": "string"},
                    "replace": {"type": "string"},
                    "match_case": {"type": "boolean", "default": True},
                },
                ["doc", "find", "replace"],
            ),
        ),
        types.Tool(
            name="delete_doc",
            description="Deletes a Google Doc (moves it to trash in Drive).",
            inputSchema=_schema({"doc": _DOC}, ["doc"]),
        ),
    ]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

def _handle(name: str, args: dict) -> list[types.TextContent]:
    account = args.get("account")
    if not account:
        return _text("Error: 'account' is required (full email of the Google account to use).")

    if name == "create_doc":
        docs = get_docs_service(account)
        result = docs.documents().create(body={"title": args["title"]}).execute()
        doc_id = result["documentId"]
        url = f"https://docs.google.com/document/d/{doc_id}/edit"
        # Optional initial body
        if args.get("body"):
            docs.documents().batchUpdate(
                documentId=doc_id,
                body={"requests": [{
                    "insertText": {
                        "location": {"index": 1},
                        "text": args["body"],
                    },
                }]},
            ).execute()
        return _text(f"Created '{args['title']}'.\nID: {doc_id}\nURL: {url}")

    if name == "get_doc":
        docs = get_docs_service(account)
        doc_id = _extract_id(args["doc"])
        doc = docs.documents().get(documentId=doc_id).execute()
        text = _doc_to_plain_text(doc)
        title = doc.get("title", "(untitled)")
        return _text(f"{title} ({doc_id}) — {len(text)} chars\n---\n{text}")

    if name == "append_text":
        docs = get_docs_service(account)
        doc_id = _extract_id(args["doc"])
        doc = docs.documents().get(documentId=doc_id, fields="body").execute()
        idx = _body_end_index(doc)
        docs.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": [{
                "insertText": {"location": {"index": idx}, "text": args["text"]},
            }]},
        ).execute()
        return _text(f"Appended {len(args['text'])} chars to {doc_id}.")

    if name == "replace_text":
        docs = get_docs_service(account)
        doc_id = _extract_id(args["doc"])
        result = docs.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": [{
                "replaceAllText": {
                    "containsText": {
                        "text": args["find"],
                        "matchCase": bool(args.get("match_case", True)),
                    },
                    "replaceText": args["replace"],
                },
            }]},
        ).execute()
        rep = result.get("replies", [{}])[0].get("replaceAllText", {})
        return _text(
            f"Replaced {rep.get('occurrencesChanged', 0)} occurrence(s) of "
            f"'{args['find']}' in {doc_id}."
        )

    if name == "delete_doc":
        drive = get_drive_service(account)
        doc_id = _extract_id(args["doc"])
        drive.files().delete(fileId=doc_id).execute()
        return _text(f"Deleted doc {doc_id} (moved to Drive trash).")

    return _text(f"Unknown tool: {name}")


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        return _handle(name, arguments)
    except HttpError as e:
        return _text(f"Google API error: {e}")
    except ValueError as e:
        return _text(f"Error: {e}")
    except Exception as e:  # noqa: BLE001 — surface, never crash the tool call
        return _text(f"Unexpected error: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="google-docs",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
