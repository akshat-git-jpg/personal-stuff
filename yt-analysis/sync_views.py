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
from googleapiclient.discovery import build

from _common import col_letter, extract_video_id, get_gspread_client

DEST_SHEET_ID = "13H88Z_4f58lHB0xsRXKPaZ7qagMyvXxZdJ1S-szH18c"
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


def main():
    yt_api_key = os.getenv("YT_API_KEY")
    if not yt_api_key:
        print("ERROR: YT_API_KEY missing from .env")
        sys.exit(1)

    client = get_gspread_client()
    ws = client.open_by_key(DEST_SHEET_ID).worksheet(DEST_TAB)

    rows = ws.get_all_values()
    if not rows:
        print("Sheet is empty.")
        return
    header = rows[0]
    try:
        link_col = header.index(YT_LINK_HEADER)
        views_col = header.index(VIEWS_HEADER)
    except ValueError:
        print(f"ERROR: missing required header(s). Need {YT_LINK_HEADER!r} and {VIEWS_HEADER!r}.")
        sys.exit(1)

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

    if not row_to_vid:
        print(f"No valid YouTube URLs found in {YT_LINK_HEADER!r} column.")
        print(f"  Rows with link cell filled but unrecognized format: {skipped_invalid}")
        return

    unique_ids = sorted(set(row_to_vid.values()))
    print(f"Fetching view counts for {len(unique_ids)} unique video(s)...")
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

    print(f"Rows scanned:                  {len(rows) - 1}")
    print(f"Valid YouTube links:           {len(row_to_vid)}")
    print(f"Skipped (unrecognized format): {skipped_invalid}")
    print(f"Unique video IDs queried:      {len(unique_ids)}")
    print(f"Views written:                 {written}")
    print(f"Marked N/A (private/deleted):  {na}")


if __name__ == "__main__":
    main()
