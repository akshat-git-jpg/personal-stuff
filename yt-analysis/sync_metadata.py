"""Sync metadata from YT tracker (Master tab) into the Analysis sheet
("Per video cost,views and clicks" tab).

Only syncs source rows where yt_upload_status="uploaded".

Match by video_title:
  - Source row found in dest -> update mapped cols
  - Source row NOT in dest    -> append a new row
  - Dest row not in source    -> left alone (preserves manual entries)

Re-runnable; safe to call repeatedly.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from common.sheets import col_letter, extract_sheet_id, get_gspread_client  # noqa: E402

SOURCE_TAB = "Master"
DEST_TAB = "Per video cost,views and clicks"

# Source header -> dest header mapping (only fields we copy)
FIELD_MAP = [
    ("video_title", "video_title"),
    ("video_notes", "video_notes"),
    ("video_description", "video_description"),
    ("category", "category"),
    ("subcategory", "sub_category"),
    ("yt_upload_status", "yt_upload_status"),
    ("yt_upload_date", "yt_upload_date"),
    ("yt_link", "yt_link"),
]

# Dropdowns to copy from source to dest, by (source_header, dest_header).
# Pulls the data validation rule from row 2 of the source column and applies
# it to the dest column for rows 3 through DROPDOWN_END_ROW.
DROPDOWN_FIELDS = [
    ("category", "category"),
    ("subcategory", "sub_category"),
]
DROPDOWN_END_ROW = 500  # apply down this far so manually-added rows also get the dropdown


def is_uploaded(status: str) -> bool:
    return (status or "").strip().lower() == "uploaded"


def read_tab(ws):
    rows = ws.get_all_values()
    if not rows:
        return [], []
    return rows[0], rows[1:]


def read_source_dropdowns(client, src_idx, source_sheet_id):
    """Fetch the data validation rule for each source dropdown column.
    Returns dict: source_header -> validation rule dict (Sheets API shape) or None.
    """
    cols_letters = sorted({col_letter(src_idx[h]) for h, _ in DROPDOWN_FIELDS if h in src_idx})
    if not cols_letters:
        return {}
    # Read row 2 of each source dropdown column (the first data row, where the rule lives)
    ranges = [f"{SOURCE_TAB}!{c}2" for c in cols_letters]
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{source_sheet_id}"
    params = [("includeGridData", "true"), ("fields", "sheets.data(startColumn,rowData.values.dataValidation)")]
    for r in ranges:
        params.append(("ranges", r))
    resp = client.http_client.request("get", url, params=params)
    data = resp.json()
    rules_by_col = {}
    for sheet_data in data.get("sheets", [{}])[0].get("data", []):
        start_col = sheet_data.get("startColumn", 0)
        row_data = sheet_data.get("rowData", [{}])[0]
        cells = row_data.get("values", [{}])
        if cells and "dataValidation" in cells[0]:
            rules_by_col[start_col] = cells[0]["dataValidation"]
    return {h: rules_by_col.get(src_idx[h]) for h, _ in DROPDOWN_FIELDS if src_idx[h] in rules_by_col}


def sync_dropdowns(client, src_idx, dst_idx, dst_sheet_gid, source_sheet_id, dest_sheet_id):
    rules_by_src_header = read_source_dropdowns(client, src_idx, source_sheet_id)
    requests = []
    applied = []
    for src_h, dst_h in DROPDOWN_FIELDS:
        rule = rules_by_src_header.get(src_h)
        if not rule:
            continue
        di = dst_idx[dst_h]
        requests.append({
            "setDataValidation": {
                "range": {
                    "sheetId": dst_sheet_gid,
                    "startRowIndex": 2,                # row 3 (0-indexed; skips header + stray row 2)
                    "endRowIndex": DROPDOWN_END_ROW,
                    "startColumnIndex": di,
                    "endColumnIndex": di + 1,
                },
                "rule": rule,
            }
        })
        applied.append(dst_h)
    if requests:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{dest_sheet_id}:batchUpdate"
        client.http_client.request("post", url, json={"requests": requests})
    return applied


def read_source_cell_formats(client, src_idx, mapped_src_headers, source_sheet_id):
    """Read userEnteredFormat for source row 1 (header) and row 2 (sample data row)
    for each mapped column. Returns dict: src_header -> {"header": fmt, "data": fmt}.
    """
    cols = sorted({src_idx[h] for h in mapped_src_headers if h in src_idx})
    if not cols:
        return {}
    ranges = [f"{SOURCE_TAB}!{col_letter(c)}1:{col_letter(c)}2" for c in cols]
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{source_sheet_id}"
    params = [("includeGridData", "true"), ("fields", "sheets.data(startColumn,rowData.values.userEnteredFormat)")]
    for r in ranges:
        params.append(("ranges", r))
    resp = client.http_client.request("get", url, params=params)
    data = resp.json()
    result = {}
    by_col = {}
    for sheet_data in data.get("sheets", [{}])[0].get("data", []):
        sc = sheet_data.get("startColumn", 0)
        rows = sheet_data.get("rowData", [])
        header_fmt = (rows[0].get("values", [{}])[0].get("userEnteredFormat") if len(rows) > 0 else None)
        data_fmt = (rows[1].get("values", [{}])[0].get("userEnteredFormat") if len(rows) > 1 else None)
        by_col[sc] = {"header": header_fmt, "data": data_fmt}
    for h in mapped_src_headers:
        c = src_idx.get(h)
        if c is not None and c in by_col:
            result[h] = by_col[c]
    return result


def sync_formatting(client, src_idx, dst_idx, dst_sheet_gid, source_sheet_id, dest_sheet_id):
    """Mirror source's per-column header + data-row formatting onto dest's mapped cols.
    Header range: dest row 1 of each mapped col.
    Data range:   dest rows 3..DROPDOWN_END_ROW of each mapped col (skips header + stray row 2).
    """
    src_headers_used = [s for s, _ in FIELD_MAP]
    fmts = read_source_cell_formats(client, src_idx, src_headers_used, source_sheet_id)
    requests = []
    fields = "userEnteredFormat(backgroundColor,backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,padding,textFormat)"
    for src_h, dst_h in FIELD_MAP:
        col_fmts = fmts.get(src_h, {})
        di = dst_idx[dst_h]
        if col_fmts.get("header"):
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": dst_sheet_gid,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": di,
                        "endColumnIndex": di + 1,
                    },
                    "cell": {"userEnteredFormat": col_fmts["header"]},
                    "fields": fields,
                }
            })
        if col_fmts.get("data"):
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": dst_sheet_gid,
                        "startRowIndex": 2,                  # row 3 onward (skip header + stray row 2)
                        "endRowIndex": DROPDOWN_END_ROW,
                        "startColumnIndex": di,
                        "endColumnIndex": di + 1,
                    },
                    "cell": {"userEnteredFormat": col_fmts["data"]},
                    "fields": fields,
                }
            })
    if requests:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{dest_sheet_id}:batchUpdate"
        client.http_client.request("post", url, json={"requests": requests})
    return len(requests)


def sync_metadata() -> dict:
    # Resolve env vars inside the function so import doesn't crash when vars are unset
    source_sheet_id = extract_sheet_id(os.getenv("YT_TRACKER_SHEET_URL", ""))
    dest_sheet_id = extract_sheet_id(os.getenv("ANALYSIS_INCOME_SHEET_URL", ""))

    client = get_gspread_client()

    src_ws = client.open_by_key(source_sheet_id).worksheet(SOURCE_TAB)
    dst_ws = client.open_by_key(dest_sheet_id).worksheet(DEST_TAB)

    src_header, src_rows = read_tab(src_ws)
    dst_header, dst_rows = read_tab(dst_ws)

    # Validate: every mapped field must exist in both headers
    src_idx = {h: i for i, h in enumerate(src_header)}
    dst_idx = {h: i for i, h in enumerate(dst_header)}
    for src_h, dst_h in FIELD_MAP:
        if src_h not in src_idx:
            raise RuntimeError(f"source missing column {src_h!r}")
        if dst_h not in dst_idx:
            raise RuntimeError(f"dest missing column {dst_h!r}")

    src_title_col = src_idx["video_title"]
    dst_title_col = dst_idx["video_title"]

    # Build dest map: video_title -> 1-based row number (relative to whole sheet)
    dst_title_to_row = {}
    for i, row in enumerate(dst_rows, start=2):  # row 2 onward
        if len(row) > dst_title_col:
            title = row[dst_title_col].strip()
            if title:
                dst_title_to_row[title] = i

    # Find current max row containing any data, so new rows append cleanly below
    next_free_row = 1 + max(
        (i for i, r in enumerate(dst_rows, start=2) if any(c.strip() for c in r)),
        default=1,
    )

    updates = []        # list of {"range", "values"} for batch_update (matched rows)
    new_row_count = 0   # count of titles that didn't exist in dest
    skipped_not_uploaded = 0

    for src_row in src_rows:
        if not any(c.strip() for c in src_row):
            continue

        # Filter: only process rows where yt_upload_status == "uploaded"
        upload_status = src_row[src_idx["yt_upload_status"]] if src_idx["yt_upload_status"] < len(src_row) else ""
        if not is_uploaded(upload_status):
            skipped_not_uploaded += 1
            continue

        title = src_row[src_title_col].strip() if len(src_row) > src_title_col else ""
        if not title:
            continue

        if title in dst_title_to_row:
            row_num = dst_title_to_row[title]
        else:
            row_num = next_free_row
            next_free_row += 1
            new_row_count += 1

        for src_h, dst_h in FIELD_MAP:
            si = src_idx[src_h]
            di = dst_idx[dst_h]
            v = src_row[si] if si < len(src_row) else ""
            cell = f"{col_letter(di)}{row_num}"
            updates.append({"range": cell, "values": [[v]]})

    if updates:
        dst_ws.batch_update(updates, value_input_option="USER_ENTERED")

    applied_dropdowns = sync_dropdowns(client, src_idx, dst_idx, dst_ws.id, source_sheet_id, dest_sheet_id)
    fmt_request_count = sync_formatting(client, src_idx, dst_idx, dst_ws.id, source_sheet_id, dest_sheet_id)

    total_non_empty = len([r for r in src_rows if any(c.strip() for c in r)])
    matched_count = total_non_empty - skipped_not_uploaded - new_row_count

    return {
        "matched": matched_count,
        "appended": new_row_count,
        "skipped_not_uploaded": skipped_not_uploaded,
        "total_scanned": total_non_empty,
        "dropdowns_applied": applied_dropdowns,
        "formatting_requests": fmt_request_count,
    }


def main():
    try:
        summary = sync_metadata()
    except RuntimeError as e:
        print(f"ERROR: {e}")
        return 2

    print(f"Matched & updated rows:    {summary['matched']}")
    print(f"Appended new rows:         {summary['appended']}")
    print(f"Skipped (not uploaded):    {summary['skipped_not_uploaded']}")
    print(f"Total source rows scanned: {summary['total_scanned']}")
    print(f"Dropdowns applied to dest: {summary['dropdowns_applied'] or '(none)'}")
    print(f"Formatting requests sent:  {summary['formatting_requests']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
