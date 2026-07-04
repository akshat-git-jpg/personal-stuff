"""Refresh the Analysis sheet's affiliate_link_clicks column.

For each row with a video_title that matches an entry in D1's videos table:
- Look up that video's slugs (videos JOIN links by video_title)
- Query D1 for last_30d + all_time counts (deduped at query time by ip_hash, ua_hash, hour bucket)
- Build per-tool blocks: "tool, target_url, short_url, count_30d, count_all"
- Write to affiliate_link_clicks column

Re-runnable. Always overwrites with current counts.
"""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from common.cloudflare import D1Client  # noqa: E402
from common.sheets import col_letter, extract_sheet_id, get_gspread_client  # noqa: E402

ANALYSIS_TAB = "Per video cost,views and clicks"
CLICKS_HEADER = "affiliate_link_clicks"
TITLE_HEADER = "video_title"

THIRTY_DAYS_SECONDS = 30 * 86400

SQL_LINKS_FOR_TITLE = """
SELECT l.slug AS slug, l.tool AS tool, l.target_url AS target_url
FROM links l
JOIN videos v ON v.video_code = l.video_code
WHERE v.video_title = ?
ORDER BY l.tool
"""

SQL_30D = """
SELECT COUNT(*) AS n FROM (
  SELECT 1 FROM clicks
  WHERE slug = ? AND clicked_at >= ?
  GROUP BY ip_hash, ua_hash, (clicked_at / 3600)
)
"""

SQL_ALL = """
SELECT COUNT(*) AS n FROM (
  SELECT 1 FROM clicks
  WHERE slug = ?
  GROUP BY ip_hash, ua_hash, (clicked_at / 3600)
)
"""


def count_clicks_for_slug(d1: D1Client, slug: str, now_ts: int) -> tuple[int, int]:
    threshold = now_ts - THIRTY_DAYS_SECONDS
    r30 = d1.query(SQL_30D, [slug, threshold])
    rall = d1.query(SQL_ALL, [slug])
    return (
        int(r30[0]["n"]) if r30 else 0,
        int(rall[0]["n"]) if rall else 0,
    )


def format_clicks_cell(link_data: list[dict]) -> str:
    return "\n".join(
        f"{d['tool']}, {d['target_url']}, {d['short_url']}, {d['count_30d']}, {d['count_all']}"
        for d in link_data
    )


def sync_clicks() -> dict:
    """Refresh the affiliate_link_clicks column. Returns summary dict."""
    link_domain = os.getenv("LINK_DOMAIN")
    sheet_url = os.getenv("ANALYSIS_INCOME_SHEET_URL")
    if not link_domain:
        raise RuntimeError("LINK_DOMAIN not set in .env")
    if not sheet_url:
        raise RuntimeError("ANALYSIS_INCOME_SHEET_URL not set in .env")

    client = get_gspread_client()
    ws = client.open_by_key(extract_sheet_id(sheet_url)).worksheet(ANALYSIS_TAB)
    rows = ws.get_all_values()
    if not rows or len(rows) < 2:
        return {"rows_refreshed": 0, "rows_scanned": 0}

    header = [h.strip() for h in rows[0]]
    title_col = header.index(TITLE_HEADER)
    clicks_col = header.index(CLICKS_HEADER)

    d1 = D1Client()
    now_ts = int(time.time())
    updates = []
    refreshed = 0

    for i, row in enumerate(rows[1:], start=2):
        title = row[title_col].strip() if len(row) > title_col else ""
        if not title:
            continue
        link_rows = d1.query(SQL_LINKS_FOR_TITLE, [title])
        if not link_rows:
            continue

        per_link = []
        for lr in link_rows:
            slug = lr["slug"]
            short_url = f"https://{link_domain}/{slug}"
            c30, call = count_clicks_for_slug(d1, slug, now_ts)
            per_link.append({
                "tool": lr["tool"],
                "target_url": lr["target_url"],
                "short_url": short_url,
                "count_30d": c30,
                "count_all": call,
            })

        cell_text = format_clicks_cell(per_link)
        updates.append({
            "range": f"{col_letter(clicks_col)}{i}",
            "values": [[cell_text]],
        })
        refreshed += 1

    if updates:
        ws.batch_update(updates, value_input_option="USER_ENTERED")

    return {"rows_refreshed": refreshed, "rows_scanned": len(rows) - 1}


def main() -> int:
    try:
        result = sync_clicks()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    print(f"Rows refreshed: {result['rows_refreshed']} / {result['rows_scanned']} scanned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
