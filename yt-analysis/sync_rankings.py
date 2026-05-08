"""
Update YouTube search rankings for video/keyword pairs in the rankings sheet.

Reads:  sheet at GOOGLE_SHEET_URL (.env), first worksheet
  - column with 'url' in name      -> video URL
  - column with 'keyword' in name  -> keyword(s), newline-separated
  - column with 'status' in name   -> processed only when value == "To Check now"

Writes: appends a new dated column 'ranking_<YYYY-MM-DD>' (or with _N suffix
        if that header already exists). Multi-keyword cells produce
        newline-joined results, e.g.  "Rank 3\\nNot in Top 50".

Quota: each ranking lookup = 1 YouTube search.list call = 100 quota units.
       11 rows x 2 keywords = ~22 calls = ~2,200 units (default daily = 10,000).
"""

import os
import sys
from datetime import datetime

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from _common import col_letter, extract_video_id, get_gspread_client

MAX_RESULTS = 50  # YouTube search depth — beyond this we report "Not in Top N"


def get_ranking(yt, keyword, video_url):
    target = extract_video_id(video_url)
    if not target:
        return "Error"
    try:
        resp = (
            yt.search()
            .list(q=keyword, part="id", type="video", maxResults=MAX_RESULTS)
            .execute()
        )
        for i, item in enumerate(resp.get("items", [])):
            if item["id"].get("videoId") == target:
                return f"Rank {i + 1}"
        return f"Not in Top {MAX_RESULTS}"
    except HttpError as e:
        print(f"  API error for {keyword!r}: {e}", file=sys.stderr)
        return "Error"


def main():
    api_key = os.getenv("YT_API_KEY")
    sheet_url = os.getenv("GOOGLE_SHEET_URL")
    if not api_key:
        print("ERROR: YT_API_KEY missing from .env")
        sys.exit(1)
    if not sheet_url:
        print("ERROR: GOOGLE_SHEET_URL missing from .env")
        sys.exit(1)

    yt = build("youtube", "v3", developerKey=api_key, cache_discovery=False)
    client = get_gspread_client()
    ws = client.open_by_url(sheet_url).get_worksheet(0)

    rows = ws.get_all_values()
    if not rows or len(rows) < 2:
        print("Sheet is empty.")
        return

    header = rows[0]
    url_col = next((i for i, h in enumerate(header) if "url" in h.lower()), None)
    kw_col = next((i for i, h in enumerate(header) if "keyword" in h.lower()), None)
    status_col = next((i for i, h in enumerate(header) if "status" in h.lower()), None)

    if url_col is None or kw_col is None:
        print(f"ERROR: could not find 'url' or 'keyword' columns. Found: {header}")
        sys.exit(1)

    rankings = []
    checked = 0
    skipped = 0
    for row in rows[1:]:
        url = row[url_col] if len(row) > url_col else ""
        kws_str = row[kw_col] if len(row) > kw_col else ""
        status = (
            row[status_col] if status_col is not None and len(row) > status_col else "To Check now"
        )

        if status != "To Check now":
            print(f"  Skip {url!r} (status={status!r})")
            rankings.append("")
            skipped += 1
            continue

        if not url.strip() or not kws_str.strip():
            rankings.append("N/A")
            continue

        keywords = [k.strip() for k in kws_str.split("\n") if k.strip()]
        per_kw = []
        for kw in keywords:
            print(f"  Checking {kw!r} for {url}")
            r = get_ranking(yt, kw, url)
            print(f"    -> {r}")
            per_kw.append(r)
            checked += 1
        rankings.append("\n".join(per_kw))

    # Append new column with a unique dated header
    base = f"ranking_{datetime.now().strftime('%Y-%m-%d')}"
    name = base
    n = 1
    while name in header:
        name = f"{base}_{n}"
        n += 1

    new_col_idx = len(header)            # 0-indexed -> next free col
    new_col = col_letter(new_col_idx)
    end_row = 1 + len(rankings)

    ws.update(values=[[name]], range_name=f"{new_col}1", value_input_option="USER_ENTERED")
    if rankings:
        ws.update(
            values=[[r] for r in rankings],
            range_name=f"{new_col}2:{new_col}{end_row}",
            value_input_option="USER_ENTERED",
        )

    print()
    print(f"New column added:  {name}")
    print(f"Rankings checked:  {checked}")
    print(f"Rows skipped:      {skipped}")
    print(f"Rows scanned:      {len(rows) - 1}")


if __name__ == "__main__":
    main()
