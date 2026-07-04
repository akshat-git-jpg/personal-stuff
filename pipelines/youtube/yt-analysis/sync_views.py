"""
Fetch YouTube view counts for each yt_link in the Analysis sheet
and write them to the 'views' column.

Reads:  yt_link (whichever column has that header)
Writes: views   (whichever column has that header)

- Always overwrites views with the current API count.
- Skips rows where yt_link is empty or not a recognized YouTube URL.
- Marks "N/A" if the video is private/deleted/region-blocked.
- Batches up to 50 IDs per YouTube API call (1 quota unit each).
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from googleapiclient.discovery import build  # noqa: E402

from common.sheets import col_letter, extract_sheet_id, extract_video_id, get_gspread_client  # noqa: E402

DEST_TAB = "Per video cost,views and clicks"

YT_LINK_HEADER = "yt_link"
VIEWS_HEADER = "views"


def fetch_view_counts(yt_api_key, video_ids):
    """video_id -> int view count, or None if missing/private/deleted."""
    if not video_ids:
        return {}
    yt = build("youtube", "v3", developerKey=yt_api_key, cache_discovery=False)
    out = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        resp = yt.videos().list(part="statistics", id=",".join(chunk)).execute()
        returned = {item["id"]: item for item in resp.get("items", [])}
        for vid in chunk:
            item = returned.get(vid)
            if not item:
                out[vid] = None
                continue
            vc = item.get("statistics", {}).get("viewCount")
            out[vid] = int(vc) if vc is not None else None
    return out


def sync_views() -> dict:
    """
    Fetch YouTube view counts for each yt_link in the Analysis sheet
    and write them to the 'views' column.

    Returns:
        dict with keys: rows_scanned, valid_links, skipped_invalid, unique_ids, views_written, na_marked

    Raises:
        RuntimeError: if required env vars or sheet headers are missing.
    """
    dest_sheet_id = extract_sheet_id(os.getenv("ANALYSIS_INCOME_SHEET_URL", ""))
    if not dest_sheet_id:
        raise RuntimeError("ANALYSIS_INCOME_SHEET_URL missing or invalid in .env")

    yt_api_key = os.getenv("YT_API_KEY")
    if not yt_api_key:
        raise RuntimeError("YT_API_KEY missing from .env")

    client = get_gspread_client()
    ws = client.open_by_key(dest_sheet_id).worksheet(DEST_TAB)

    rows = ws.get_all_values()
    if not rows:
        raise RuntimeError("Sheet is empty.")

    header = rows[0]
    try:
        link_col = header.index(YT_LINK_HEADER)
        views_col = header.index(VIEWS_HEADER)
    except ValueError:
        raise RuntimeError(f"Missing required header(s). Need {YT_LINK_HEADER!r} and {VIEWS_HEADER!r}.")

    row_to_vid = {}
    skipped_invalid = 0
    for i, row in enumerate(rows[1:], start=2):
        url = row[link_col] if len(row) > link_col else ""
        if not url.strip():
            continue
        vid = extract_video_id(url)
        if vid:
            row_to_vid[i] = vid
        else:
            skipped_invalid += 1

    rows_scanned = len(rows) - 1

    if not row_to_vid:
        return {
            "rows_scanned": rows_scanned,
            "valid_links": 0,
            "skipped_invalid": skipped_invalid,
            "unique_ids": 0,
            "views_written": 0,
            "na_marked": 0,
        }

    unique_ids = sorted(set(row_to_vid.values()))
    counts = fetch_view_counts(yt_api_key, unique_ids)

    updates = []
    written = 0
    na = 0
    for row_num, vid in row_to_vid.items():
        cnt = counts.get(vid)
        cell = f"{col_letter(views_col)}{row_num}"
        if cnt is None:
            updates.append({"range": cell, "values": [["N/A"]]})
            na += 1
        else:
            updates.append({"range": cell, "values": [[cnt]]})
            written += 1

    if updates:
        ws.batch_update(updates, value_input_option="USER_ENTERED")

    return {
        "rows_scanned": rows_scanned,
        "valid_links": len(row_to_vid),
        "skipped_invalid": skipped_invalid,
        "unique_ids": len(unique_ids),
        "views_written": written,
        "na_marked": na,
    }


def main() -> int:
    try:
        result = sync_views()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    print(f"Rows scanned:                  {result['rows_scanned']}")
    print(f"Valid YouTube links:           {result['valid_links']}")
    print(f"Skipped (unrecognized format): {result['skipped_invalid']}")
    print(f"Unique video IDs queried:      {result['unique_ids']}")
    print(f"Views written:                 {result['views_written']}")
    print(f"Marked N/A (private/deleted):  {result['na_marked']}")
    return 0


if __name__ == "__main__":
    main()
