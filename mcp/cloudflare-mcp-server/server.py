"""Cloudflare MCP — D1 SQL + KV operations.

Reads CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_KV_NAMESPACE_ID from
OS env first, falling back to /Users/kbtg/codebase/TY/.env (the source of
truth on this machine — same vars already used by common/cloudflare.py).
"""
from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import quote

import requests

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

CF_API_BASE = "https://api.cloudflare.com/client/v4"

# Source-of-truth .env on this machine. We don't require it — env vars set in
# .mcp.json or the shell override anything found here.
_DEFAULT_ENV_PATH = Path("/Users/kbtg/codebase/TY/.env")


def _load_env_file(path: Path) -> None:
    """Tiny KEY=VALUE loader; only sets vars not already in os.environ."""
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(_DEFAULT_ENV_PATH)


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Add it to {_DEFAULT_ENV_PATH} or the .mcp.json env block."
        )
    return value


def _headers(token: str, content_type: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {token}"}
    if content_type:
        h["Content-Type"] = content_type
    return h


def _cf_request(method: str, url: str, *, token: str, json_body=None, data=None, content_type=None) -> dict:
    resp = requests.request(
        method,
        url,
        headers=_headers(token, content_type),
        json=json_body,
        data=data,
        timeout=20,
    )
    # Most CF endpoints respond with JSON even on error; some (KV value PUT) just 200.
    try:
        body = resp.json()
    except ValueError:
        resp.raise_for_status()
        return {"success": True, "result": resp.text}
    if resp.status_code >= 400 or not body.get("success", True):
        errs = body.get("errors") or []
        msg = "; ".join(e.get("message", "?") for e in errs) or resp.text[:300]
        raise RuntimeError(f"Cloudflare API error ({resp.status_code}): {msg}")
    return body


app = Server("cloudflare")


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": props,
        "required": required,
    }


_DB_OVERRIDE = {
    "type": "string",
    "description": "Optional D1 database ID. Defaults to CF_D1_DATABASE_ID from env.",
}
_NS_OVERRIDE = {
    "type": "string",
    "description": "Optional KV namespace ID. Defaults to CF_KV_NAMESPACE_ID from env.",
}


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        # ----- D1 -----
        types.Tool(
            name="d1_query",
            description=(
                "Executes a parameterized SQL statement against a D1 database. "
                "Use '?' placeholders and pass values in 'params'. Works for "
                "SELECT, INSERT, UPDATE, DELETE, CREATE, etc. Returns the result "
                "rows (empty list for writes) plus meta (rows_read, rows_written, "
                "duration_ms, last_row_id)."
            ),
            inputSchema=_schema(
                {
                    "sql": {"type": "string", "description": "SQL with optional ? placeholders"},
                    "params": {
                        "type": "array",
                        "items": {"type": ["string", "number", "boolean", "null"]},
                        "description": "Values for ? placeholders, in order",
                    },
                    "database_id": _DB_OVERRIDE,
                },
                ["sql"],
            ),
        ),
        types.Tool(
            name="d1_list_tables",
            description="Lists user-defined tables in the D1 database (excludes sqlite_* internals).",
            inputSchema=_schema({"database_id": _DB_OVERRIDE}, []),
        ),
        types.Tool(
            name="d1_describe_table",
            description=(
                "Shows the schema (columns + types) of a table via PRAGMA table_info. "
                "Pass 'table' as the table name."
            ),
            inputSchema=_schema(
                {
                    "table": {"type": "string"},
                    "database_id": _DB_OVERRIDE,
                },
                ["table"],
            ),
        ),
        types.Tool(
            name="d1_list_databases",
            description="Lists all D1 databases on the account.",
            inputSchema=_schema({}, []),
        ),
        # ----- KV -----
        types.Tool(
            name="kv_get",
            description="Reads a value from KV by key. Returns the raw string body (KV stores strings/bytes).",
            inputSchema=_schema(
                {
                    "key": {"type": "string"},
                    "namespace_id": _NS_OVERRIDE,
                },
                ["key"],
            ),
        ),
        types.Tool(
            name="kv_put",
            description=(
                "Writes a key/value to KV. Pass an optional TTL (seconds, min 60) to "
                "auto-expire the entry. Values are stored as text."
            ),
            inputSchema=_schema(
                {
                    "key": {"type": "string"},
                    "value": {"type": "string"},
                    "expiration_ttl": {
                        "type": "integer",
                        "description": "Optional TTL in seconds (>=60). Omit for no expiry.",
                    },
                    "namespace_id": _NS_OVERRIDE,
                },
                ["key", "value"],
            ),
        ),
        types.Tool(
            name="kv_delete",
            description="Deletes a key from KV.",
            inputSchema=_schema(
                {
                    "key": {"type": "string"},
                    "namespace_id": _NS_OVERRIDE,
                },
                ["key"],
            ),
        ),
        types.Tool(
            name="kv_list_keys",
            description=(
                "Lists keys in the namespace, optionally filtered by prefix. "
                "Returns up to 'limit' keys (default 100, max 1000)."
            ),
            inputSchema=_schema(
                {
                    "prefix": {"type": "string"},
                    "limit": {"type": "integer", "default": 100, "minimum": 10, "maximum": 1000},
                    "namespace_id": _NS_OVERRIDE,
                },
                [],
            ),
        ),
        types.Tool(
            name="kv_list_namespaces",
            description="Lists all KV namespaces on the account.",
            inputSchema=_schema({}, []),
        ),
        types.Tool(
            name="show_config",
            description=(
                "Shows which CF_* env vars the server resolved at startup (token is masked). "
                "Useful for confirming the right account/database/namespace is in use."
            ),
            inputSchema=_schema({}, []),
        ),
    ]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


def _d1_url(account_id: str, database_id: str) -> str:
    return f"{CF_API_BASE}/accounts/{account_id}/d1/database/{database_id}/query"


def _kv_value_url(account_id: str, namespace_id: str, key: str) -> str:
    return (
        f"{CF_API_BASE}/accounts/{account_id}"
        f"/storage/kv/namespaces/{namespace_id}/values/{quote(key, safe='')}"
    )


def _d1_run(sql: str, params: list | None, database_id: str | None) -> dict:
    token = _required_env("CF_API_TOKEN")
    account_id = _required_env("CF_ACCOUNT_ID")
    db_id = database_id or _required_env("CF_D1_DATABASE_ID")
    body = {"sql": sql, "params": params or []}
    data = _cf_request("POST", _d1_url(account_id, db_id), token=token, json_body=body)
    # D1 returns result as a list of statements (we only run one); pull the first.
    statements = data.get("result") or []
    first = statements[0] if statements else {}
    return {
        "rows": first.get("results", []),
        "meta": first.get("meta", {}),
        "success": data.get("success", True),
    }


def _handle(name: str, args: dict) -> list[types.TextContent]:
    if name == "show_config":
        token = os.getenv("CF_API_TOKEN", "")
        masked = (token[:4] + "…" + token[-4:]) if token else "(missing)"
        return _text(json.dumps({
            "CF_API_TOKEN": masked,
            "CF_ACCOUNT_ID": os.getenv("CF_ACCOUNT_ID") or "(missing)",
            "CF_D1_DATABASE_ID": os.getenv("CF_D1_DATABASE_ID") or "(missing)",
            "CF_KV_NAMESPACE_ID": os.getenv("CF_KV_NAMESPACE_ID") or "(missing)",
            "env_file_loaded": str(_DEFAULT_ENV_PATH) if _DEFAULT_ENV_PATH.is_file() else "(none)",
        }, indent=2))

    if name == "d1_query":
        out = _d1_run(args["sql"], args.get("params"), args.get("database_id"))
        rows = out["rows"]
        header = f"{len(rows)} row(s) — meta: {json.dumps(out['meta'])}"
        return _text(header + "\n" + json.dumps(rows, indent=2, ensure_ascii=False, default=str))

    if name == "d1_list_tables":
        out = _d1_run(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            None,
            args.get("database_id"),
        )
        return _text(json.dumps([r["name"] for r in out["rows"]], indent=2))

    if name == "d1_describe_table":
        table = args["table"]
        # PRAGMA can't be parameterized; sanitize to identifier-safe chars.
        if not all(c.isalnum() or c == "_" for c in table):
            return _text("Error: table name must be alphanumeric/underscore only.")
        out = _d1_run(f"PRAGMA table_info({table})", None, args.get("database_id"))
        return _text(json.dumps(out["rows"], indent=2, ensure_ascii=False))

    if name == "d1_list_databases":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        url = f"{CF_API_BASE}/accounts/{account_id}/d1/database"
        data = _cf_request("GET", url, token=token)
        dbs = [
            {"name": d.get("name"), "uuid": d.get("uuid"), "version": d.get("version")}
            for d in data.get("result", [])
        ]
        return _text(json.dumps(dbs, indent=2))

    if name == "kv_get":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        ns_id = args.get("namespace_id") or _required_env("CF_KV_NAMESPACE_ID")
        url = _kv_value_url(account_id, ns_id, args["key"])
        resp = requests.get(url, headers=_headers(token), timeout=15)
        if resp.status_code == 404:
            return _text("(key not found)")
        resp.raise_for_status()
        return _text(resp.text)

    if name == "kv_put":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        ns_id = args.get("namespace_id") or _required_env("CF_KV_NAMESPACE_ID")
        url = _kv_value_url(account_id, ns_id, args["key"])
        params = {}
        if args.get("expiration_ttl"):
            params["expiration_ttl"] = int(args["expiration_ttl"])
        resp = requests.put(
            url,
            headers=_headers(token, content_type="text/plain"),
            data=args["value"],
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        return _text(f"Wrote key '{args['key']}' ({len(args['value'])} bytes).")

    if name == "kv_delete":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        ns_id = args.get("namespace_id") or _required_env("CF_KV_NAMESPACE_ID")
        url = _kv_value_url(account_id, ns_id, args["key"])
        resp = requests.delete(url, headers=_headers(token), timeout=15)
        if resp.status_code == 404:
            return _text(f"(key '{args['key']}' did not exist)")
        resp.raise_for_status()
        return _text(f"Deleted key '{args['key']}'.")

    if name == "kv_list_keys":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        ns_id = args.get("namespace_id") or _required_env("CF_KV_NAMESPACE_ID")
        url = (
            f"{CF_API_BASE}/accounts/{account_id}"
            f"/storage/kv/namespaces/{ns_id}/keys"
        )
        # CF rejects limit < 10, caps at 1000.
        params: dict = {"limit": max(10, min(int(args.get("limit", 100)), 1000))}
        if args.get("prefix"):
            params["prefix"] = args["prefix"]
        data = _cf_request("GET", url + "?" + "&".join(f"{k}={quote(str(v))}" for k, v in params.items()), token=token)
        rows = data.get("result", [])
        return _text(f"{len(rows)} key(s)\n" + json.dumps(rows, indent=2))

    if name == "kv_list_namespaces":
        token = _required_env("CF_API_TOKEN")
        account_id = _required_env("CF_ACCOUNT_ID")
        url = f"{CF_API_BASE}/accounts/{account_id}/storage/kv/namespaces"
        data = _cf_request("GET", url, token=token)
        out = [
            {"id": n.get("id"), "title": n.get("title")}
            for n in data.get("result", [])
        ]
        return _text(json.dumps(out, indent=2))

    return _text(f"Unknown tool: {name}")


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        return _handle(name, arguments)
    except requests.HTTPError as e:
        return _text(f"HTTP error: {e} — body: {e.response.text[:500] if e.response else ''}")
    except RuntimeError as e:
        return _text(f"Error: {e}")
    except Exception as e:  # noqa: BLE001
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
                server_name="cloudflare",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
