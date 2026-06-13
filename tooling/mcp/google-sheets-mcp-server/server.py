from __future__ import annotations
import asyncio
import json
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

app = Server("google-sheets")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("sheets", "v4", credentials=creds)


_URL_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")
_A1_CELL_RE = re.compile(r"^([A-Za-z]*)(\d*)$")


def _extract_id(spreadsheet: str) -> str:
    """Accept a raw spreadsheet ID or a pasted URL; return the ID."""
    s = spreadsheet.strip()
    m = _URL_ID_RE.search(s)
    return m.group(1) if m else s


def _get_meta(service, ssid: str) -> dict:
    return service.spreadsheets().get(spreadsheetId=ssid).execute()


def _resolve_sheet_id(service, ssid: str, tab_title: str) -> int:
    """Map a tab title to its numeric sheetId; error lists available tabs."""
    meta = _get_meta(service, ssid)
    titles = []
    for sheet in meta.get("sheets", []):
        props = sheet["properties"]
        titles.append(props["title"])
        if props["title"].lower() == tab_title.lower():
            return props["sheetId"]
    raise ValueError(
        f"Tab '{tab_title}' not found. Available tabs: {', '.join(titles) or '(none)'}"
    )


def _col_to_index(letter: str) -> int:
    """Column letter ('A', 'B', 'AA') -> 0-based index."""
    letter = letter.strip().upper()
    if not letter or not letter.isalpha():
        raise ValueError(f"Invalid column '{letter}'. Use a column letter like 'A' or 'C'.")
    idx = 0
    for ch in letter:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _parse_cell(cell: str):
    """'B5' -> (col_index, row_index) 0-based; missing part -> None (open range)."""
    m = _A1_CELL_RE.match(cell.strip())
    if not m:
        raise ValueError(f"Invalid A1 cell reference '{cell}'.")
    col_letters, row_digits = m.group(1), m.group(2)
    col = _col_to_index(col_letters) if col_letters else None
    row = (int(row_digits) - 1) if row_digits else None
    return col, row


def _a1_to_gridrange(service, ssid: str, a1: str) -> dict:
    """Convert an A1 range ('Sheet1!A2:D20', 'Sheet1!A:D', or 'Sheet1') to a GridRange."""
    if "!" not in a1:
        return {"sheetId": _resolve_sheet_id(service, ssid, a1.strip().strip("'"))}
    tab, cells = a1.split("!", 1)
    sheet_id = _resolve_sheet_id(service, ssid, tab.strip().strip("'"))
    gr = {"sheetId": sheet_id}
    start, end = (cells.split(":", 1) + [cells])[:2] if ":" in cells else (cells, cells)
    sc, sr = _parse_cell(start)
    ec, er = _parse_cell(end)
    if sc is not None:
        gr["startColumnIndex"] = sc
    if sr is not None:
        gr["startRowIndex"] = sr
    if ec is not None:
        gr["endColumnIndex"] = ec + 1
    if er is not None:
        gr["endRowIndex"] = er + 1
    return gr


def _hex_to_color(hex_str: str) -> dict:
    """'#RRGGBB' -> Sheets color dict."""
    h = hex_str.strip().lstrip("#")
    if len(h) != 6:
        raise ValueError(f"Color '{hex_str}' must be hex like '#RRGGBB'.")
    return {
        "red": int(h[0:2], 16) / 255.0,
        "green": int(h[2:4], 16) / 255.0,
        "blue": int(h[4:6], 16) / 255.0,
    }


def _batch(service, ssid: str, requests: list[dict]) -> dict:
    return service.spreadsheets().batchUpdate(
        spreadsheetId=ssid, body={"requests": requests}
    ).execute()


def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

_ACCT = {
    "type": "string",
    "description": "Full email address of the Google account to act as (e.g. 'you@gmail.com'). Required for every call.",
}
_SS = {"type": "string", "description": "Spreadsheet ID or full URL"}


def _schema(props: dict, required: list[str]) -> dict:
    """Build an inputSchema that always requires 'account' first."""
    return {
        "type": "object",
        "properties": {"account": _ACCT, **props},
        "required": ["account", *required],
    }


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        # --- Read ---
        types.Tool(
            name="get_spreadsheet_info",
            description="Returns the spreadsheet title and every tab's name and dimensions.",
            inputSchema=_schema({"spreadsheet": _SS}, ["spreadsheet"]),
        ),
        types.Tool(
            name="read_range",
            description=(
                "Reads cell values. 'range' is A1 notation like 'Sheet1!A1:D20', or a bare "
                "tab name ('Sheet1') for the whole tab. Returns a header line plus the values "
                "as a JSON 2D array."
            ),
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "range": {"type": "string", "description": "A1 range or bare tab name"},
                },
                ["spreadsheet", "range"],
            ),
        ),
        # --- Write ---
        types.Tool(
            name="write_range",
            description=(
                "Overwrites a range with the given 2D values array. value_input USER_ENTERED "
                "parses formulas/numbers/dates like the UI; RAW stores them literally."
            ),
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "range": {"type": "string", "description": "A1 range, e.g. 'Sheet1!A1'"},
                    "values": {
                        "type": "array",
                        "items": {"type": "array", "items": {}},
                        "description": "2D array of cell values, row-major",
                    },
                    "value_input": {
                        "type": "string",
                        "enum": ["USER_ENTERED", "RAW"],
                        "default": "USER_ENTERED",
                    },
                },
                ["spreadsheet", "range", "values"],
            ),
        ),
        types.Tool(
            name="append_rows",
            description="Appends rows after the last row of data in a tab.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "tab": {"type": "string", "description": "Tab name to append to"},
                    "values": {
                        "type": "array",
                        "items": {"type": "array", "items": {}},
                        "description": "2D array of rows to append",
                    },
                    "value_input": {
                        "type": "string",
                        "enum": ["USER_ENTERED", "RAW"],
                        "default": "USER_ENTERED",
                    },
                },
                ["spreadsheet", "tab", "values"],
            ),
        ),
        types.Tool(
            name="clear_range",
            description="Clears the contents of a range, keeping formatting.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "range": {"type": "string", "description": "A1 range to clear"},
                },
                ["spreadsheet", "range"],
            ),
        ),
        # --- Structure ---
        types.Tool(
            name="create_spreadsheet",
            description="Creates a new spreadsheet (owned by the account) and returns its ID and URL.",
            inputSchema=_schema({"title": {"type": "string"}}, ["title"]),
        ),
        types.Tool(
            name="add_tab",
            description="Adds a new tab (sheet) to a spreadsheet.",
            inputSchema=_schema(
                {"spreadsheet": _SS, "title": {"type": "string"}},
                ["spreadsheet", "title"],
            ),
        ),
        types.Tool(
            name="rename_tab",
            description="Renames a tab.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "old_title": {"type": "string"},
                    "new_title": {"type": "string"},
                },
                ["spreadsheet", "old_title", "new_title"],
            ),
        ),
        types.Tool(
            name="delete_tab",
            description="Deletes a tab and all its data.",
            inputSchema=_schema(
                {"spreadsheet": _SS, "title": {"type": "string"}},
                ["spreadsheet", "title"],
            ),
        ),
        types.Tool(
            name="insert_dimension",
            description="Inserts blank rows or columns at a 0-based index.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "tab": {"type": "string"},
                    "dimension": {"type": "string", "enum": ["ROWS", "COLUMNS"]},
                    "start_index": {"type": "integer", "description": "0-based insert position"},
                    "count": {"type": "integer", "description": "How many to insert"},
                },
                ["spreadsheet", "tab", "dimension", "start_index", "count"],
            ),
        ),
        types.Tool(
            name="delete_dimension",
            description="Deletes rows or columns starting at a 0-based index.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "tab": {"type": "string"},
                    "dimension": {"type": "string", "enum": ["ROWS", "COLUMNS"]},
                    "start_index": {"type": "integer", "description": "0-based start position"},
                    "count": {"type": "integer", "description": "How many to delete"},
                },
                ["spreadsheet", "tab", "dimension", "start_index", "count"],
            ),
        ),
        # --- Data & format ---
        types.Tool(
            name="sort_range",
            description=(
                "Sorts a range by one column. 'column' is the column letter (e.g. 'B') and must "
                "fall inside 'range'. Exclude the header row from the range (e.g. 'Sheet1!A2:D20')."
            ),
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "range": {"type": "string", "description": "A1 range to sort"},
                    "column": {"type": "string", "description": "Sort key column letter"},
                    "order": {"type": "string", "enum": ["ASC", "DESC"], "default": "ASC"},
                },
                ["spreadsheet", "range", "column"],
            ),
        ),
        types.Tool(
            name="find_replace",
            description="Find and replace text. Omit 'tab' to apply across all tabs.",
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "find": {"type": "string"},
                    "replace": {"type": "string"},
                    "tab": {"type": "string", "description": "Limit to this tab; omit for all"},
                    "match_case": {"type": "boolean", "default": False},
                    "match_entire_cell": {"type": "boolean", "default": False},
                },
                ["spreadsheet", "find", "replace"],
            ),
        ),
        types.Tool(
            name="format_cells",
            description=(
                "Applies basic formatting to a range. Pass at least one of bold, background_color, "
                "text_color (hex '#RRGGBB'), or number_format (a number pattern like '0.00' or '$#,##0')."
            ),
            inputSchema=_schema(
                {
                    "spreadsheet": _SS,
                    "range": {"type": "string", "description": "A1 range to format"},
                    "bold": {"type": "boolean"},
                    "background_color": {"type": "string", "description": "Hex '#RRGGBB'"},
                    "text_color": {"type": "string", "description": "Hex '#RRGGBB'"},
                    "number_format": {"type": "string", "description": "Number pattern, e.g. '0.00'"},
                },
                ["spreadsheet", "range"],
            ),
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

    if name == "get_spreadsheet_info":
        ssid = _extract_id(args["spreadsheet"])
        meta = _get_meta(service, ssid)
        lines = [f"Spreadsheet: {meta['properties']['title']}", f"ID: {ssid}", "Tabs:"]
        for sheet in meta.get("sheets", []):
            p = sheet["properties"]
            g = p.get("gridProperties", {})
            lines.append(f"  - {p['title']} ({g.get('rowCount', '?')} rows × {g.get('columnCount', '?')} cols)")
        return _text("\n".join(lines))

    if name == "read_range":
        ssid = _extract_id(args["spreadsheet"])
        rng = args["range"]
        result = service.spreadsheets().values().get(spreadsheetId=ssid, range=rng).execute()
        values = result.get("values", [])
        ncols = max((len(r) for r in values), default=0)
        header = f"{result.get('range', rng)} — {len(values)} rows × {ncols} cols"
        return _text(header + "\n" + json.dumps(values, ensure_ascii=False))

    if name == "write_range":
        ssid = _extract_id(args["spreadsheet"])
        result = service.spreadsheets().values().update(
            spreadsheetId=ssid,
            range=args["range"],
            valueInputOption=args.get("value_input", "USER_ENTERED"),
            body={"values": args["values"]},
        ).execute()
        return _text(
            f"Updated {result.get('updatedCells', 0)} cells in {result.get('updatedRange', args['range'])}."
        )

    if name == "append_rows":
        ssid = _extract_id(args["spreadsheet"])
        result = service.spreadsheets().values().append(
            spreadsheetId=ssid,
            range=args["tab"],
            valueInputOption=args.get("value_input", "USER_ENTERED"),
            insertDataOption="INSERT_ROWS",
            body={"values": args["values"]},
        ).execute()
        u = result.get("updates", {})
        return _text(f"Appended {u.get('updatedRows', 0)} rows to '{args['tab']}' (range {u.get('updatedRange', '?')}).")

    if name == "clear_range":
        ssid = _extract_id(args["spreadsheet"])
        service.spreadsheets().values().clear(
            spreadsheetId=ssid, range=args["range"], body={}
        ).execute()
        return _text(f"Cleared {args['range']}.")

    if name == "create_spreadsheet":
        result = service.spreadsheets().create(
            body={"properties": {"title": args["title"]}}
        ).execute()
        ssid = result["spreadsheetId"]
        url = result.get("spreadsheetUrl", f"https://docs.google.com/spreadsheets/d/{ssid}")
        return _text(f"Created '{args['title']}'.\nID: {ssid}\nURL: {url}")

    if name == "add_tab":
        ssid = _extract_id(args["spreadsheet"])
        _batch(service, ssid, [{"addSheet": {"properties": {"title": args["title"]}}}])
        return _text(f"Added tab '{args['title']}'.")

    if name == "rename_tab":
        ssid = _extract_id(args["spreadsheet"])
        sheet_id = _resolve_sheet_id(service, ssid, args["old_title"])
        _batch(service, ssid, [{"updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "title": args["new_title"]},
            "fields": "title",
        }}])
        return _text(f"Renamed '{args['old_title']}' → '{args['new_title']}'.")

    if name == "delete_tab":
        ssid = _extract_id(args["spreadsheet"])
        sheet_id = _resolve_sheet_id(service, ssid, args["title"])
        _batch(service, ssid, [{"deleteSheet": {"sheetId": sheet_id}}])
        return _text(f"Deleted tab '{args['title']}'.")

    if name in ("insert_dimension", "delete_dimension"):
        ssid = _extract_id(args["spreadsheet"])
        sheet_id = _resolve_sheet_id(service, ssid, args["tab"])
        dim = args["dimension"].upper()
        start = int(args["start_index"])
        count = int(args["count"])
        if count < 1:
            raise ValueError("count must be >= 1.")
        rng = {"sheetId": sheet_id, "dimension": dim, "startIndex": start, "endIndex": start + count}
        if name == "insert_dimension":
            _batch(service, ssid, [{"insertDimension": {"range": rng, "inheritFromBefore": start > 0}}])
            return _text(f"Inserted {count} {dim.lower()} at index {start} in '{args['tab']}'.")
        _batch(service, ssid, [{"deleteDimension": {"range": rng}}])
        return _text(f"Deleted {count} {dim.lower()} from index {start} in '{args['tab']}'.")

    if name == "sort_range":
        ssid = _extract_id(args["spreadsheet"])
        gr = _a1_to_gridrange(service, ssid, args["range"])
        order = "DESCENDING" if args.get("order", "ASC").upper().startswith("D") else "ASCENDING"
        _batch(service, ssid, [{"sortRange": {
            "range": gr,
            "sortSpecs": [{"dimensionIndex": _col_to_index(args["column"]), "sortOrder": order}],
        }}])
        return _text(f"Sorted {args['range']} by column {args['column'].upper()} ({order}).")

    if name == "find_replace":
        ssid = _extract_id(args["spreadsheet"])
        req = {
            "find": args["find"],
            "replacement": args["replace"],
            "matchCase": bool(args.get("match_case", False)),
            "matchEntireCell": bool(args.get("match_entire_cell", False)),
        }
        if args.get("tab"):
            req["sheetId"] = _resolve_sheet_id(service, ssid, args["tab"])
        else:
            req["allSheets"] = True
        result = _batch(service, ssid, [{"findReplace": req}])
        fr = result.get("replies", [{}])[0].get("findReplace", {})
        return _text(
            f"Replaced {fr.get('occurrencesChanged', 0)} occurrence(s) across {fr.get('sheetsChanged', 0)} sheet(s)."
        )

    if name == "format_cells":
        ssid = _extract_id(args["spreadsheet"])
        gr = _a1_to_gridrange(service, ssid, args["range"])
        cell_format: dict = {}
        text_format: dict = {}
        fields: list[str] = []
        if args.get("bold") is not None:
            text_format["bold"] = bool(args["bold"])
            fields.append("userEnteredFormat.textFormat.bold")
        if args.get("text_color"):
            text_format["foregroundColor"] = _hex_to_color(args["text_color"])
            fields.append("userEnteredFormat.textFormat.foregroundColor")
        if text_format:
            cell_format["textFormat"] = text_format
        if args.get("background_color"):
            cell_format["backgroundColor"] = _hex_to_color(args["background_color"])
            fields.append("userEnteredFormat.backgroundColor")
        if args.get("number_format"):
            cell_format["numberFormat"] = {"type": "NUMBER", "pattern": args["number_format"]}
            fields.append("userEnteredFormat.numberFormat")
        if not fields:
            return _text(
                "No formatting specified. Pass at least one of: bold, background_color, "
                "text_color, number_format."
            )
        _batch(service, ssid, [{"repeatCell": {
            "range": gr,
            "cell": {"userEnteredFormat": cell_format},
            "fields": ",".join(fields),
        }}])
        return _text(f"Formatted {args['range']}.")

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
                server_name="google-sheets",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
