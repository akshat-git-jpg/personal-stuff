# STATUS: LIVE — wired into .mcp.json (regen-mcp-json.sh)
from __future__ import annotations
import asyncio
import io
import json
import mimetypes
import re
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

BASE_DIR = Path(__file__).parent

app = Server("google-drive")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("drive", "v3", credentials=creds)


_URL_ID_RE = re.compile(r"/(?:file/d|folders|document/d|spreadsheets/d|presentation/d)/([a-zA-Z0-9-_]+)")

# Google-native MIME types and their best export targets for download
GOOGLE_EXPORT_MIME = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "image/png",
}


def _extract_id(value: str) -> str:
    """Accept a raw file/folder ID or a pasted Drive URL."""
    s = value.strip()
    m = _URL_ID_RE.search(s)
    return m.group(1) if m else s


def _file_summary(f: dict) -> dict:
    return {
        "id": f.get("id"),
        "name": f.get("name"),
        "mimeType": f.get("mimeType"),
        "size": f.get("size"),
        "modifiedTime": f.get("modifiedTime"),
        "parents": f.get("parents"),
        "owners": [o.get("emailAddress") for o in f.get("owners", []) if o.get("emailAddress")],
        "webViewLink": f.get("webViewLink"),
    }


def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


_FILE_FIELDS = "id,name,mimeType,size,modifiedTime,parents,owners(emailAddress),webViewLink"


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

_ACCT = {
    "type": "string",
    "description": "Full email address of the Google account to act as. Required.",
}
_FILE = {"type": "string", "description": "File ID or full Drive URL"}


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
            name="search_files",
            description=(
                "Searches Drive using Drive query syntax. Examples: "
                "`name contains 'invoice'`, `mimeType = 'application/vnd.google-apps.document'`, "
                "`'<folder_id>' in parents`, `modifiedTime > '2026-01-01T00:00:00'`. "
                "Defaults: trashed=false."
            ),
            inputSchema=_schema(
                {
                    "query": {"type": "string", "description": "Drive search query"},
                    "max_results": {"type": "integer", "default": 25},
                    "include_trashed": {"type": "boolean", "default": False},
                },
                ["query"],
            ),
        ),
        types.Tool(
            name="list_folder",
            description="Lists files in a folder (one level, not recursive).",
            inputSchema=_schema(
                {
                    "folder_id": {
                        "type": "string",
                        "description": "Folder ID or URL. Use 'root' for the user's My Drive root.",
                    },
                    "max_results": {"type": "integer", "default": 50},
                },
                ["folder_id"],
            ),
        ),
        types.Tool(
            name="get_metadata",
            description="Returns full metadata for a single file or folder.",
            inputSchema=_schema({"file": _FILE}, ["file"]),
        ),
        types.Tool(
            name="upload_file",
            description=(
                "Uploads a local file to Drive. Auto-detects MIME type from the path "
                "unless 'mime_type' is given. Optionally place under 'folder_id'."
            ),
            inputSchema=_schema(
                {
                    "local_path": {"type": "string", "description": "Absolute local path"},
                    "name": {"type": "string", "description": "Drive name (default = basename of path)"},
                    "folder_id": {"type": "string", "description": "Optional parent folder ID/URL"},
                    "mime_type": {"type": "string"},
                },
                ["local_path"],
            ),
        ),
        types.Tool(
            name="download_file",
            description=(
                "Downloads a Drive file to a local path. Google-native files "
                "(Docs/Sheets/Slides) are exported (Docs→text, Sheets→CSV, Slides→PDF, "
                "Drawings→PNG); pass 'export_mime' to override. Binary files download as-is."
            ),
            inputSchema=_schema(
                {
                    "file": _FILE,
                    "local_path": {"type": "string", "description": "Absolute local path to write to"},
                    "export_mime": {
                        "type": "string",
                        "description": "Optional export MIME type (Google-native files only)",
                    },
                },
                ["file", "local_path"],
            ),
        ),
        types.Tool(
            name="create_folder",
            description="Creates a new folder.",
            inputSchema=_schema(
                {
                    "name": {"type": "string"},
                    "parent_id": {"type": "string", "description": "Optional parent folder ID/URL"},
                },
                ["name"],
            ),
        ),
        types.Tool(
            name="move",
            description="Moves a file/folder into a target folder (replaces existing parents).",
            inputSchema=_schema(
                {"file": _FILE, "target_folder_id": {"type": "string"}},
                ["file", "target_folder_id"],
            ),
        ),
        types.Tool(
            name="rename",
            description="Renames a file or folder.",
            inputSchema=_schema(
                {"file": _FILE, "new_name": {"type": "string"}},
                ["file", "new_name"],
            ),
        ),
        types.Tool(
            name="share",
            description=(
                "Shares a file/folder with someone by email. Role is 'reader' "
                "(default), 'commenter', or 'writer'. Sends a notification email by default."
            ),
            inputSchema=_schema(
                {
                    "file": _FILE,
                    "email": {"type": "string"},
                    "role": {
                        "type": "string",
                        "enum": ["reader", "commenter", "writer"],
                        "default": "reader",
                    },
                    "notify": {"type": "boolean", "default": True},
                    "message": {"type": "string", "description": "Optional notification message"},
                },
                ["file", "email"],
            ),
        ),
        types.Tool(
            name="delete",
            description="Permanently deletes a file/folder (does NOT go to trash — use carefully).",
            inputSchema=_schema({"file": _FILE}, ["file"]),
        ),
    ]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

def _handle(name: str, args: dict) -> list[types.TextContent]:
    account = args.get("account")
    if not account:
        return _text("Error: 'account' is required (full email of the Google account to use).")
    service = get_service(account)

    if name == "search_files":
        q = args["query"]
        if not args.get("include_trashed"):
            q = f"({q}) and trashed = false"
        result = service.files().list(
            q=q,
            pageSize=int(args.get("max_results", 25)),
            fields=f"files({_FILE_FIELDS})",
        ).execute()
        files = [_file_summary(f) for f in result.get("files", [])]
        return _text(f"{len(files)} match(es)\n" + json.dumps(files, indent=2, ensure_ascii=False))

    if name == "list_folder":
        folder_id = _extract_id(args["folder_id"])
        result = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            pageSize=int(args.get("max_results", 50)),
            fields=f"files({_FILE_FIELDS})",
            orderBy="folder,name",
        ).execute()
        files = [_file_summary(f) for f in result.get("files", [])]
        return _text(f"{len(files)} item(s) in {folder_id}\n" + json.dumps(files, indent=2, ensure_ascii=False))

    if name == "get_metadata":
        file_id = _extract_id(args["file"])
        f = service.files().get(fileId=file_id, fields=_FILE_FIELDS).execute()
        return _text(json.dumps(_file_summary(f), indent=2, ensure_ascii=False))

    if name == "upload_file":
        local_path = Path(args["local_path"]).expanduser()
        if not local_path.is_file():
            raise ValueError(f"Local file not found: {local_path}")
        name_in_drive = args.get("name") or local_path.name
        mime = args.get("mime_type") or mimetypes.guess_type(str(local_path))[0] or "application/octet-stream"
        metadata: dict = {"name": name_in_drive}
        if args.get("folder_id"):
            metadata["parents"] = [_extract_id(args["folder_id"])]
        media = MediaFileUpload(str(local_path), mimetype=mime, resumable=True)
        result = service.files().create(
            body=metadata, media_body=media, fields=_FILE_FIELDS,
        ).execute()
        return _text(
            f"Uploaded '{name_in_drive}' ({mime}).\n"
            + json.dumps(_file_summary(result), indent=2, ensure_ascii=False)
        )

    if name == "download_file":
        file_id = _extract_id(args["file"])
        local_path = Path(args["local_path"]).expanduser()
        local_path.parent.mkdir(parents=True, exist_ok=True)
        meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()
        src_mime = meta["mimeType"]
        is_google_native = src_mime.startswith("application/vnd.google-apps")
        if is_google_native:
            export_mime = args.get("export_mime") or GOOGLE_EXPORT_MIME.get(src_mime)
            if not export_mime:
                raise ValueError(
                    f"Don't know how to export '{src_mime}'. Pass an export_mime."
                )
            request = service.files().export_media(fileId=file_id, mimeType=export_mime)
            mode_note = f"exported as {export_mime}"
        else:
            request = service.files().get_media(fileId=file_id)
            mode_note = f"binary ({src_mime})"
        buf = io.FileIO(str(local_path), "wb")
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        buf.close()
        return _text(
            f"Downloaded '{meta['name']}' -> {local_path} ({mode_note}, {local_path.stat().st_size} bytes)."
        )

    if name == "create_folder":
        metadata: dict = {
            "name": args["name"],
            "mimeType": "application/vnd.google-apps.folder",
        }
        if args.get("parent_id"):
            metadata["parents"] = [_extract_id(args["parent_id"])]
        result = service.files().create(body=metadata, fields=_FILE_FIELDS).execute()
        return _text(
            f"Created folder '{args['name']}'.\n"
            + json.dumps(_file_summary(result), indent=2, ensure_ascii=False)
        )

    if name == "move":
        file_id = _extract_id(args["file"])
        target = _extract_id(args["target_folder_id"])
        existing = service.files().get(fileId=file_id, fields="parents").execute()
        prev_parents = ",".join(existing.get("parents", []) or [])
        result = service.files().update(
            fileId=file_id,
            addParents=target,
            removeParents=prev_parents,
            fields=_FILE_FIELDS,
        ).execute()
        return _text(f"Moved '{result['name']}' into folder {target}.")

    if name == "rename":
        file_id = _extract_id(args["file"])
        result = service.files().update(
            fileId=file_id, body={"name": args["new_name"]}, fields=_FILE_FIELDS,
        ).execute()
        return _text(f"Renamed to '{result['name']}' (id {file_id}).")

    if name == "share":
        file_id = _extract_id(args["file"])
        perm = {
            "type": "user",
            "role": args.get("role", "reader"),
            "emailAddress": args["email"],
        }
        params = dict(
            fileId=file_id,
            body=perm,
            sendNotificationEmail=bool(args.get("notify", True)),
            fields="id,role,emailAddress",
        )
        if args.get("message"):
            params["emailMessage"] = args["message"]
        result = service.permissions().create(**params).execute()
        return _text(
            f"Shared {file_id} with {args['email']} as {result.get('role')}."
        )

    if name == "delete":
        file_id = _extract_id(args["file"])
        service.files().delete(fileId=file_id).execute()
        return _text(f"Permanently deleted {file_id}.")

    return _text(f"Unknown tool: {name}")


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        return _handle(name, arguments)
    except HttpError as e:
        return _text(f"Drive API error: {e}")
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
                server_name="google-drive",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
