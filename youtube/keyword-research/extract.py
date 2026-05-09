"""Stage 1: pull last N videos per competitor channel, extract softwares + topics via Gemini.

Reads:  KEYWORD_RESEARCH_SHEET_URL -> 'Channels' tab, column A (Channel URL).
Writes: 'Videos' tab (append), and output/<run_id>/raw.json (incremental checkpoint).

Run:
  python keyword-research/extract.py                    # 3 videos per channel, all channels
  python keyword-research/extract.py --limit 5
  python keyword-research/extract.py --channels "https://www.youtube.com/@foo,https://www.youtube.com/@bar"
  python keyword-research/extract.py --dry-run         # don't append to sheet
"""

import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from gspread.exceptions import WorksheetNotFound  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from common.sheets import col_letter, get_gspread_client  # noqa: E402

import youtube  # noqa: E402  (sibling module in this folder; on sys.path because we're the entrypoint)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_ROOT = os.path.join(SCRIPT_DIR, "output")
PROMPT_PATH = os.path.join(SCRIPT_DIR, "prompts", "extract.md")

CHANNELS_TAB = "Channels"
VIDEOS_TAB = "Videos"
STATUS_TRIGGER = "to check"  # case-insensitive match against the Status column
VIDEOS_HEADER = [
    "Date Found",
    "Channel Name",
    "Video Title",
    "Video URL",
    "Softwares Used in the video",
    "Softwares affiliated",
    "Video Summary",
    "Topics",
]

EXTRACTION_MODEL = "gemini-2.5-flash"


class Extraction(BaseModel):
    softwares: list[str]
    affiliated_softwares: list[str]
    summary: str
    topics: list[str]


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=3, help="Videos per channel (default 3)")
    p.add_argument("--channels", default=None, help="Comma-separated channel URLs (overrides sheet)")
    p.add_argument("--dry-run", action="store_true", help="Don't write to sheet; raw.json only")
    return p.parse_args()


def load_channel_urls_from_sheet(sheet_url):
    """Read channel URLs from the Channels tab, filtering by Status column if present.

    Header columns are matched by name (case-insensitive substring):
      - 'url'     -> channel URL column (required)
      - 'status'  -> status column (optional)

    If a Status column exists, only rows whose status equals (case-insensitive)
    STATUS_TRIGGER are included. If no Status column exists, all rows are included.
    """
    client = get_gspread_client()
    ss = client.open_by_url(sheet_url)
    ws = ss.worksheet(CHANNELS_TAB)
    rows = ws.get_all_values()
    if len(rows) < 2:
        return []
    header = rows[0]
    url_col = next((i for i, h in enumerate(header) if "url" in h.lower()), None)
    if url_col is None:
        print(f"ERROR: '{CHANNELS_TAB}' tab needs a column with 'URL' in its header.", file=sys.stderr)
        sys.exit(1)
    status_col = next((i for i, h in enumerate(header) if "status" in h.lower()), None)

    selected = []
    skipped = 0
    for r in rows[1:]:
        url = r[url_col].strip() if len(r) > url_col else ""
        if not url:
            continue
        if status_col is not None:
            status = r[status_col].strip() if len(r) > status_col else ""
            if status.lower() != STATUS_TRIGGER:
                skipped += 1
                continue
        selected.append(url)

    if status_col is not None:
        print(f"Filtered by Status='{STATUS_TRIGGER}' (case-insensitive): {len(selected)} included, {skipped} skipped.")
    else:
        print("(No Status column found in Channels tab — processing all rows.)")
    return selected


def get_or_create_videos_ws(sheet_url):
    """Return the Videos worksheet, creating it if needed and clearing prior data rows."""
    client = get_gspread_client()
    ss = client.open_by_url(sheet_url)
    try:
        ws = ss.worksheet(VIDEOS_TAB)
        created = False
    except WorksheetNotFound:
        ws = ss.add_worksheet(title=VIDEOS_TAB, rows=1000, cols=len(VIDEOS_HEADER))
        created = True

    # Always (re)write the header row.
    ws.update(values=[VIDEOS_HEADER], range_name="A1", value_input_option="USER_ENTERED")

    # Wipe-and-rewrite: clear all data rows so each run is a fresh snapshot.
    if not created:
        last_col = col_letter(len(VIDEOS_HEADER) - 1)
        ws.batch_clear([f"A2:{last_col}"])

    return ws


def extract_one_video(gemini_client, prompt_template, title, description):
    """Return Extraction(softwares=..., topics=...). Retries once on failure, then returns empty."""
    from google.genai import types

    prompt = prompt_template.replace("{title}", title or "").replace("{description}", description or "")
    last_err = None
    for attempt in range(2):
        try:
            resp = gemini_client.models.generate_content(
                model=EXTRACTION_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Extraction,
                ),
            )
            parsed = resp.parsed
            if isinstance(parsed, Extraction):
                return parsed
            if isinstance(parsed, dict):
                return Extraction(**parsed)
            # Fallback: parse text manually
            return Extraction(**json.loads(resp.text))
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)
    print(f"    Gemini extraction failed: {last_err}", file=sys.stderr)
    return Extraction(softwares=[], affiliated_softwares=[], summary="", topics=[])


def now_iso():
    """ISO 8601 with local timezone offset, matching the existing sheet format."""
    return datetime.now().astimezone().isoformat(timespec="milliseconds")


def main():
    args = parse_args()

    sheet_url = os.getenv("KEYWORD_RESEARCH_SHEET_URL")
    yt_api_key = os.getenv("YT_API_KEY")
    if not sheet_url:
        print("ERROR: KEYWORD_RESEARCH_SHEET_URL missing from .env", file=sys.stderr)
        sys.exit(1)
    if not yt_api_key:
        print("ERROR: YT_API_KEY missing from .env", file=sys.stderr)
        sys.exit(1)

    if args.channels:
        channel_urls = [u.strip() for u in args.channels.split(",") if u.strip()]
    else:
        print(f"Reading channel URLs from sheet '{CHANNELS_TAB}'...")
        channel_urls = load_channel_urls_from_sheet(sheet_url)
    if not channel_urls:
        print("No channel URLs found.")
        sys.exit(0)
    print(f"Channels to process: {len(channel_urls)}")

    yt_client = youtube.build_yt_client(yt_api_key)
    cache = youtube.load_cache()

    from common.gemini import get_client as get_gemini

    gemini_client = get_gemini()

    with open(PROMPT_PATH) as f:
        prompt_template = f.read()

    run_id = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    run_dir = os.path.join(OUTPUT_ROOT, run_id)

    # Retention: keep only the latest run. Wipe any prior run folders before this one starts.
    if os.path.isdir(OUTPUT_ROOT):
        wiped = 0
        for d in os.listdir(OUTPUT_ROOT):
            path = os.path.join(OUTPUT_ROOT, d)
            if os.path.isdir(path) and d != run_id:
                shutil.rmtree(path)
                wiped += 1
        if wiped:
            print(f"Cleaned up {wiped} previous run folder(s).")

    os.makedirs(run_dir, exist_ok=True)
    raw_path = os.path.join(run_dir, "raw.json")
    date_found = now_iso()

    # Single Date Found timestamp per run, applied to every appended row.
    raw = {
        "run_id": run_id,
        "date_found": date_found,
        "limit_per_channel": args.limit,
        "channels": [],
    }
    _write_raw(raw_path, raw)

    videos_ws = None
    if not args.dry_run:
        videos_ws = get_or_create_videos_ws(sheet_url)

    total_videos = 0
    skipped_channels = 0

    for url in channel_urls:
        print(f"\n[{url}]")
        channel_id, channel_title = youtube.resolve_channel(yt_client, url, cache)
        if not channel_id:
            skipped_channels += 1
            continue
        print(f"  channel_id={channel_id}  title={channel_title!r}")

        video_ids = youtube.fetch_recent_video_ids(channel_id, args.limit)
        if not video_ids:
            print("  (no videos in RSS)")
            continue
        print(f"  RSS returned {len(video_ids)} video(s)")

        snippets = youtube.fetch_video_snippets(yt_client, video_ids)
        if not snippets:
            print("  (videos.list returned nothing)")
            continue

        rows_for_sheet = []
        videos_for_raw = []
        for vid in video_ids:
            sn = snippets.get(vid)
            if not sn:
                continue
            title = sn.get("title", "")
            description = sn.get("description", "")
            print(f"    extracting: {title[:60]}")
            extraction = extract_one_video(gemini_client, prompt_template, title, description)

            video_url = f"https://www.youtube.com/watch?v={vid}"

            rows_for_sheet.append([
                date_found,
                url,
                title,
                video_url,
                ", ".join(extraction.softwares),
                ", ".join(extraction.affiliated_softwares),
                extraction.summary,
                ", ".join(extraction.topics),
            ])
            videos_for_raw.append({
                "video_id": vid,
                "title": title,
                "url": video_url,
                "published_at": sn.get("publishedAt"),
                "softwares": extraction.softwares,
                "affiliated_softwares": extraction.affiliated_softwares,
                "summary": extraction.summary,
                "topics": extraction.topics,
            })

        raw["channels"].append({
            "url": url,
            "channel_id": channel_id,
            "channel_title": channel_title,
            "videos": videos_for_raw,
        })
        _write_raw(raw_path, raw)
        youtube.save_cache(cache)
        total_videos += len(videos_for_raw)

        if videos_ws is not None and rows_for_sheet:
            try:
                videos_ws.append_rows(rows_for_sheet, value_input_option="USER_ENTERED")
                print(f"  appended {len(rows_for_sheet)} row(s) to '{VIDEOS_TAB}'")
            except Exception as e:
                print(f"  ERROR appending to sheet: {e}", file=sys.stderr)
                print(f"  raw.json is intact at {raw_path}", file=sys.stderr)

    print()
    print(f"Run id:           {run_id}")
    print(f"Channels scanned: {len(channel_urls)}")
    print(f"Channels skipped: {skipped_channels}")
    print(f"Videos extracted: {total_videos}")
    print(f"Raw checkpoint:   {raw_path}")
    if args.dry_run:
        print("Dry run: nothing written to sheet.")


def _write_raw(path, payload):
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
