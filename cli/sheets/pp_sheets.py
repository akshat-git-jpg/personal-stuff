"""pp-sheets — agent-native CLI for Google Sheets.

Talks to the Sheets API directly (no MCP). Ported 1:1 from
mcp/google-sheets-mcp-server/server.py so all 14 tools survive the
MCP→CLI migration with zero standing context cost.

Reuses mcp/google-shared/ OAuth — same token cache as the MCPs.

Subcommands (all take --account EMAIL; SPREADSHEET is an ID or full URL):
  info SPREADSHEET                       title + every tab's name/dimensions
  read SPREADSHEET RANGE                 values as JSON 2D array
  write SPREADSHEET RANGE --values JSON  overwrite a range
  append SPREADSHEET TAB --values JSON   append rows after last data row
  clear SPREADSHEET RANGE                clear contents, keep formatting
  create TITLE                           new spreadsheet, prints ID + URL
  add-tab SPREADSHEET TITLE
  rename-tab SPREADSHEET OLD NEW
  delete-tab SPREADSHEET TITLE
  insert SPREADSHEET TAB ROWS|COLUMNS START COUNT
  delete-dim SPREADSHEET TAB ROWS|COLUMNS START COUNT
  sort SPREADSHEET RANGE COLUMN [--desc]
  find-replace SPREADSHEET FIND REPLACE [--tab T] [--match-case] [--entire-cell]
  format SPREADSHEET RANGE [--bold/--no-bold] [--bg HEX] [--fg HEX] [--number-format PAT]
  accounts                               list available token accounts
"""
from __future__ import annotations

import argparse
import json
import re
import sys

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from auth import get_credentials, list_accounts


def get_service(account: str):
    return build("sheets", "v4", credentials=get_credentials(account))


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


def _parse_values(raw: str) -> list[list]:
    """--values accepts a JSON 2D array, inline or @file."""
    if raw.startswith("@"):
        with open(raw[1:]) as fh:
            raw = fh.read()
    values = json.loads(raw)
    if not isinstance(values, list) or not all(isinstance(r, list) for r in values):
        raise ValueError("--values must be a JSON 2D array, e.g. '[[\"a\",1],[\"b\",2]]'")
    return values


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_accounts(args) -> str:
    return "\n".join(list_accounts()) or "(no token accounts found)"


def cmd_info(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    meta = _get_meta(service, ssid)
    lines = [f"Spreadsheet: {meta['properties']['title']}", f"ID: {ssid}", "Tabs:"]
    for sheet in meta.get("sheets", []):
        p = sheet["properties"]
        g = p.get("gridProperties", {})
        lines.append(f"  - {p['title']} ({g.get('rowCount', '?')} rows × {g.get('columnCount', '?')} cols)")
    return "\n".join(lines)


def cmd_read(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    result = service.spreadsheets().values().get(spreadsheetId=ssid, range=args.range).execute()
    values = result.get("values", [])
    ncols = max((len(r) for r in values), default=0)
    header = f"{result.get('range', args.range)} — {len(values)} rows × {ncols} cols"
    return header + "\n" + json.dumps(values, ensure_ascii=False)


def cmd_write(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    result = service.spreadsheets().values().update(
        spreadsheetId=ssid,
        range=args.range,
        valueInputOption=args.value_input,
        body={"values": _parse_values(args.values)},
    ).execute()
    return f"Updated {result.get('updatedCells', 0)} cells in {result.get('updatedRange', args.range)}."


def cmd_append(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    result = service.spreadsheets().values().append(
        spreadsheetId=ssid,
        range=args.tab,
        valueInputOption=args.value_input,
        insertDataOption="INSERT_ROWS",
        body={"values": _parse_values(args.values)},
    ).execute()
    u = result.get("updates", {})
    return f"Appended {u.get('updatedRows', 0)} rows to '{args.tab}' (range {u.get('updatedRange', '?')})."


def cmd_clear(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    service.spreadsheets().values().clear(spreadsheetId=ssid, range=args.range, body={}).execute()
    return f"Cleared {args.range}."


def cmd_create(args) -> str:
    service = get_service(args.account)
    result = service.spreadsheets().create(body={"properties": {"title": args.title}}).execute()
    ssid = result["spreadsheetId"]
    url = result.get("spreadsheetUrl", f"https://docs.google.com/spreadsheets/d/{ssid}")
    return f"Created '{args.title}'.\nID: {ssid}\nURL: {url}"


def cmd_add_tab(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    _batch(service, ssid, [{"addSheet": {"properties": {"title": args.title}}}])
    return f"Added tab '{args.title}'."


def cmd_rename_tab(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    sheet_id = _resolve_sheet_id(service, ssid, args.old_title)
    _batch(service, ssid, [{"updateSheetProperties": {
        "properties": {"sheetId": sheet_id, "title": args.new_title},
        "fields": "title",
    }}])
    return f"Renamed '{args.old_title}' → '{args.new_title}'."


def cmd_delete_tab(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    sheet_id = _resolve_sheet_id(service, ssid, args.title)
    _batch(service, ssid, [{"deleteSheet": {"sheetId": sheet_id}}])
    return f"Deleted tab '{args.title}'."


def _dimension_op(args, insert: bool) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    sheet_id = _resolve_sheet_id(service, ssid, args.tab)
    dim = args.dimension.upper()
    if dim not in ("ROWS", "COLUMNS"):
        raise ValueError("dimension must be ROWS or COLUMNS.")
    start, count = args.start_index, args.count
    if count < 1:
        raise ValueError("count must be >= 1.")
    rng = {"sheetId": sheet_id, "dimension": dim, "startIndex": start, "endIndex": start + count}
    if insert:
        _batch(service, ssid, [{"insertDimension": {"range": rng, "inheritFromBefore": start > 0}}])
        return f"Inserted {count} {dim.lower()} at index {start} in '{args.tab}'."
    _batch(service, ssid, [{"deleteDimension": {"range": rng}}])
    return f"Deleted {count} {dim.lower()} from index {start} in '{args.tab}'."


def cmd_insert(args) -> str:
    return _dimension_op(args, insert=True)


def cmd_delete_dim(args) -> str:
    return _dimension_op(args, insert=False)


def cmd_sort(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    gr = _a1_to_gridrange(service, ssid, args.range)
    order = "DESCENDING" if args.desc else "ASCENDING"
    _batch(service, ssid, [{"sortRange": {
        "range": gr,
        "sortSpecs": [{"dimensionIndex": _col_to_index(args.column), "sortOrder": order}],
    }}])
    return f"Sorted {args.range} by column {args.column.upper()} ({order})."


def cmd_find_replace(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    req = {
        "find": args.find,
        "replacement": args.replace,
        "matchCase": args.match_case,
        "matchEntireCell": args.entire_cell,
    }
    if args.tab:
        req["sheetId"] = _resolve_sheet_id(service, ssid, args.tab)
    else:
        req["allSheets"] = True
    result = _batch(service, ssid, [{"findReplace": req}])
    fr = result.get("replies", [{}])[0].get("findReplace", {})
    return f"Replaced {fr.get('occurrencesChanged', 0)} occurrence(s) across {fr.get('sheetsChanged', 0)} sheet(s)."


def cmd_format(args) -> str:
    service = get_service(args.account)
    ssid = _extract_id(args.spreadsheet)
    gr = _a1_to_gridrange(service, ssid, args.range)
    cell_format: dict = {}
    text_format: dict = {}
    fields: list[str] = []
    if args.bold is not None:
        text_format["bold"] = args.bold
        fields.append("userEnteredFormat.textFormat.bold")
    if args.fg:
        text_format["foregroundColor"] = _hex_to_color(args.fg)
        fields.append("userEnteredFormat.textFormat.foregroundColor")
    if text_format:
        cell_format["textFormat"] = text_format
    if args.bg:
        cell_format["backgroundColor"] = _hex_to_color(args.bg)
        fields.append("userEnteredFormat.backgroundColor")
    if args.number_format:
        cell_format["numberFormat"] = {"type": "NUMBER", "pattern": args.number_format}
        fields.append("userEnteredFormat.numberFormat")
    if not fields:
        raise ValueError(
            "No formatting specified. Pass at least one of: --bold/--no-bold, --bg, --fg, --number-format."
        )
    _batch(service, ssid, [{"repeatCell": {
        "range": gr,
        "cell": {"userEnteredFormat": cell_format},
        "fields": ",".join(fields),
    }}])
    return f"Formatted {args.range}."


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-sheets",
        description="Agent-native Google Sheets CLI (shares mcp/google-shared OAuth).",
    )
    sub = p.add_subparsers(dest="command", required=True)

    def common(sp, spreadsheet=True):
        sp.add_argument("--account", required=True, help="Full email of the Google account to act as.")
        if spreadsheet:
            sp.add_argument("spreadsheet", help="Spreadsheet ID or full URL")

    a = sub.add_parser("accounts", help="List available token accounts.")
    a.set_defaults(func=cmd_accounts)

    i = sub.add_parser("info", help="Spreadsheet title and every tab's name/dimensions.")
    common(i)
    i.set_defaults(func=cmd_info)

    r = sub.add_parser("read", help="Read cell values; range is A1 or a bare tab name.")
    common(r)
    r.add_argument("range", help="A1 range like 'Sheet1!A1:D20', or bare tab name")
    r.set_defaults(func=cmd_read)

    w = sub.add_parser("write", help="Overwrite a range with a JSON 2D values array.")
    common(w)
    w.add_argument("range", help="A1 range, e.g. 'Sheet1!A1'")
    w.add_argument("--values", required=True, help="JSON 2D array (or @file.json)")
    w.add_argument("--value-input", choices=["USER_ENTERED", "RAW"], default="USER_ENTERED")
    w.set_defaults(func=cmd_write)

    ap = sub.add_parser("append", help="Append rows after the last row of data in a tab.")
    common(ap)
    ap.add_argument("tab", help="Tab name to append to")
    ap.add_argument("--values", required=True, help="JSON 2D array (or @file.json)")
    ap.add_argument("--value-input", choices=["USER_ENTERED", "RAW"], default="USER_ENTERED")
    ap.set_defaults(func=cmd_append)

    c = sub.add_parser("clear", help="Clear contents of a range, keeping formatting.")
    common(c)
    c.add_argument("range", help="A1 range to clear")
    c.set_defaults(func=cmd_clear)

    cr = sub.add_parser("create", help="Create a new spreadsheet; prints ID and URL.")
    cr.add_argument("--account", required=True, help="Full email of the Google account to act as.")
    cr.add_argument("title")
    cr.set_defaults(func=cmd_create)

    at = sub.add_parser("add-tab", help="Add a new tab to a spreadsheet.")
    common(at)
    at.add_argument("title")
    at.set_defaults(func=cmd_add_tab)

    rt = sub.add_parser("rename-tab", help="Rename a tab.")
    common(rt)
    rt.add_argument("old_title")
    rt.add_argument("new_title")
    rt.set_defaults(func=cmd_rename_tab)

    dt = sub.add_parser("delete-tab", help="Delete a tab and all its data.")
    common(dt)
    dt.add_argument("title")
    dt.set_defaults(func=cmd_delete_tab)

    ins = sub.add_parser("insert", help="Insert blank rows or columns at a 0-based index.")
    common(ins)
    ins.add_argument("tab")
    ins.add_argument("dimension", help="ROWS or COLUMNS")
    ins.add_argument("start_index", type=int, help="0-based insert position")
    ins.add_argument("count", type=int, help="How many to insert")
    ins.set_defaults(func=cmd_insert)

    dd = sub.add_parser("delete-dim", help="Delete rows or columns starting at a 0-based index.")
    common(dd)
    dd.add_argument("tab")
    dd.add_argument("dimension", help="ROWS or COLUMNS")
    dd.add_argument("start_index", type=int, help="0-based start position")
    dd.add_argument("count", type=int, help="How many to delete")
    dd.set_defaults(func=cmd_delete_dim)

    so = sub.add_parser("sort", help="Sort a range by one column (exclude the header row).")
    common(so)
    so.add_argument("range", help="A1 range to sort, e.g. 'Sheet1!A2:D20'")
    so.add_argument("column", help="Sort key column letter, e.g. 'B'")
    so.add_argument("--desc", action="store_true", help="Sort descending (default ascending)")
    so.set_defaults(func=cmd_sort)

    fr = sub.add_parser("find-replace", help="Find and replace text; omit --tab for all tabs.")
    common(fr)
    fr.add_argument("find")
    fr.add_argument("replace")
    fr.add_argument("--tab", help="Limit to this tab; omit for all")
    fr.add_argument("--match-case", action="store_true")
    fr.add_argument("--entire-cell", action="store_true")
    fr.set_defaults(func=cmd_find_replace)

    fm = sub.add_parser("format", help="Apply basic formatting to a range.")
    common(fm)
    fm.add_argument("range", help="A1 range to format")
    bold = fm.add_mutually_exclusive_group()
    bold.add_argument("--bold", dest="bold", action="store_true", default=None)
    bold.add_argument("--no-bold", dest="bold", action="store_false")
    fm.add_argument("--bg", help="Background color hex '#RRGGBB'")
    fm.add_argument("--fg", help="Text color hex '#RRGGBB'")
    fm.add_argument("--number-format", help="Number pattern, e.g. '0.00' or '$#,##0'")
    fm.set_defaults(func=cmd_format)

    return p


def main() -> int:
    args = build_parser().parse_args()
    try:
        print(args.func(args))
        return 0
    except HttpError as e:
        print(f"Google API error: {e}", file=sys.stderr)
        return 1
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
