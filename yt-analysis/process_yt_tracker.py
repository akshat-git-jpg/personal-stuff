"""Unified video processor — tracker-driven affiliate link workflow.

Reads YT tracker rows where topic_status="To Process", uses Gemini to
detect tools and generate the YouTube description, registers short URLs in
D1+KV, populates YT tracker columns (video_description, actual_links,
short_links), and transitions status to "To Review".

Re-runnable. Errors leave the row's status unchanged and skip with a stderr
message.
"""

import os
import secrets
import sys
import time
from dataclasses import dataclass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from common.affiliate import load_affiliate_records  # noqa: E402
from common.cloudflare import D1Client, KVClient  # noqa: E402
from common.llm import detect_tools, generate_description  # noqa: E402
from common.sheets import col_letter, extract_sheet_id, get_gspread_client  # noqa: E402

YT_TRACKER_TAB = "Master"
STATUS_TO_PROCESS = "To Process"
STATUS_TO_REVIEW = "To Review"

BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
CODE_LENGTH = 4


class ProcessError(Exception):
    """Raised when a row cannot be processed; the script skips and continues."""


@dataclass
class ProcessResult:
    video_code: str
    is_new_video: bool
    tools: list[str]
    actual_links_text: str
    short_links_text: str
    description: str


def generate_video_code(existing_codes: set[str], max_attempts: int = 100) -> str:
    for _ in range(max_attempts):
        code = "".join(secrets.choice(BASE62) for _ in range(CODE_LENGTH))
        if code not in existing_codes:
            return code
    raise RuntimeError(
        f"Could not generate a unique {CODE_LENGTH}-char code in {max_attempts} attempts"
    )


def format_link_block(items: list[tuple[str, str]]) -> str:
    """[(tool, url), ...] -> 'tool1: url1\\ntool2: url2'."""
    return "\n".join(f"{tool}: {url}" for tool, url in items)


def _existing_video_code_for_title(d1: D1Client, title: str) -> str | None:
    rows = d1.query(
        "SELECT video_code FROM videos WHERE video_title = ? LIMIT 1", [title]
    )
    return rows[0]["video_code"] if rows else None


def _existing_slugs_for_video(d1: D1Client, video_code: str) -> set[str]:
    rows = d1.query("SELECT slug FROM links WHERE video_code = ?", [video_code])
    return {r["slug"] for r in rows}


def _existing_codes(d1: D1Client) -> set[str]:
    rows = d1.query("SELECT video_code FROM videos", [])
    return {r["video_code"] for r in rows}


def process_one_video(
    video_title: str,
    video_notes: str,
    d1: D1Client,
    kv: KVClient,
    link_domain: str,
) -> ProcessResult:
    if not video_title.strip():
        raise ProcessError("video_title is empty")

    affiliates = load_affiliate_records()
    candidates = {slug: rec.display_name for slug, rec in affiliates.items()}

    detected = detect_tools(video_title, video_notes, candidates)
    if not detected:
        raise ProcessError("LLM returned no tools — refine notes and try again")

    unapproved = [t for t in detected if not affiliates[t].is_approved]
    if unapproved:
        raise ProcessError(
            f"Detected tools have approval not Approved: {', '.join(unapproved)}"
        )

    existing_code = _existing_video_code_for_title(d1, video_title)
    if existing_code is not None:
        video_code = existing_code
        is_new_video = False
        already_present = _existing_slugs_for_video(d1, video_code)
    else:
        video_code = generate_video_code(_existing_codes(d1))
        is_new_video = True
        already_present = set()

    now = int(time.time())
    if is_new_video:
        d1.query(
            "INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)",
            [video_code, video_title, now],
        )

    actual_pairs: list[tuple[str, str]] = []
    short_pairs: list[tuple[str, str]] = []
    link_specs: list[dict] = []
    for tool in detected:
        slug = f"{video_code}/{tool}"
        target = affiliates[tool].target_url
        short = f"https://{link_domain}/{slug}"
        actual_pairs.append((tool, target))
        short_pairs.append((tool, short))
        link_specs.append(
            {"tool": tool, "short_url": short, "coupon_code": affiliates[tool].coupon_code}
        )
        if slug in already_present:
            continue
        d1.query(
            "INSERT INTO links (slug, video_code, tool, target_url, created_at) VALUES (?, ?, ?, ?, ?)",
            [slug, video_code, tool, target, now],
        )
        kv.put(slug, target)

    description = generate_description(video_title, video_notes, link_specs)

    return ProcessResult(
        video_code=video_code,
        is_new_video=is_new_video,
        tools=detected,
        actual_links_text=format_link_block(actual_pairs),
        short_links_text=format_link_block(short_pairs),
        description=description,
    )


def main() -> int:
    link_domain = os.getenv("LINK_DOMAIN")
    tracker_url = os.getenv("YT_TRACKER_SHEET_URL")
    if not link_domain or not tracker_url:
        print(
            "ERROR: LINK_DOMAIN and YT_TRACKER_SHEET_URL must be set in .env",
            file=sys.stderr,
        )
        return 2

    client = get_gspread_client()
    ws = client.open_by_key(extract_sheet_id(tracker_url)).worksheet(YT_TRACKER_TAB)
    rows = ws.get_all_values()
    if not rows or len(rows) < 2:
        print("YT tracker has no data rows.")
        return 0

    header = [h.strip() for h in rows[0]]
    try:
        title_col = header.index("video_title")
        notes_col = header.index("video_notes")
        desc_col = header.index("video_description")
        actual_col = header.index("actual_links")
        short_col = header.index("short_links")
        status_col = header.index("topic_status")
    except ValueError as e:
        print(f"ERROR: missing required header in YT tracker: {e}", file=sys.stderr)
        return 2

    d1 = D1Client()
    kv = KVClient()

    processed = 0
    failed = 0
    for i, row in enumerate(rows[1:], start=2):
        status = (row[status_col] if len(row) > status_col else "").strip()
        if status != STATUS_TO_PROCESS:
            continue
        title = row[title_col].strip() if len(row) > title_col else ""
        notes = row[notes_col].strip() if len(row) > notes_col else ""

        print(f"\n→ Row {i}: {title!r}")
        try:
            result = process_one_video(title, notes, d1, kv, link_domain)
        except ProcessError as e:
            print(f"  SKIP: {e}", file=sys.stderr)
            failed += 1
            continue

        ws.batch_update(
            [
                {"range": f"{col_letter(desc_col)}{i}", "values": [[result.description]]},
                {"range": f"{col_letter(actual_col)}{i}", "values": [[result.actual_links_text]]},
                {"range": f"{col_letter(short_col)}{i}", "values": [[result.short_links_text]]},
                {"range": f"{col_letter(status_col)}{i}", "values": [[STATUS_TO_REVIEW]]},
            ],
            value_input_option="USER_ENTERED",
        )

        processed += 1
        print(f"  ✓ {result.video_code} — {len(result.tools)} link(s); status → To Review")

    print(f"\nProcessed: {processed} | Failed: {failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
