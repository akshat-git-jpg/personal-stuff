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

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

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
    non_affiliate_tools: list[str]   # subset of tools that don't have an affiliate program
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


def format_actual_links_block(items: list[tuple[str, str, bool]]) -> str:
    """[(tool, url, has_affiliate), ...] -> per-tool block.

    Affiliate entries:     'tool: url'
    Non-affiliate entries: 'tool: url (no affiliate)'
    """
    lines = []
    for tool, url, has_affiliate in items:
        if has_affiliate:
            lines.append(f"{tool}: {url}")
        else:
            lines.append(f"{tool}: {url} (no affiliate)")
    return "\n".join(lines)


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

    # Resolve target URL + coupon for each detected tool
    resolved: list[dict] = []  # {slug, display_name, target_url, coupon_code, has_affiliate}
    for entry in detected:
        slug = entry["slug"]
        rec = affiliates.get(slug)
        if rec is not None and rec.is_approved and rec.target_url.strip():
            resolved.append({
                "slug": slug,
                "display_name": entry["display_name"] or rec.display_name,
                "target_url": rec.target_url,
                "coupon_code": rec.coupon_code,
                "has_affiliate": True,
            })
        else:
            # Non-affiliate path: prefer sheet URL if available (e.g., "Pending"
            # status with a known URL), else LLM-provided homepage_url.
            fallback_url = (rec.target_url.strip() if rec else "") or entry["homepage_url"]
            if not fallback_url:
                # No URL at all — skip just this tool with a warning to stderr.
                print(
                    f"  WARN: skipping {slug!r} — no URL available "
                    f"(not in affiliate sheet AND LLM provided no homepage_url)",
                    file=sys.stderr,
                )
                continue
            resolved.append({
                "slug": slug,
                "display_name": entry["display_name"],
                "target_url": fallback_url,
                "coupon_code": "",
                "has_affiliate": False,
            })

    if not resolved:
        raise ProcessError("No tools resolved — all detected tools failed URL resolution")

    # Get/generate video_code
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

    actual_items: list[tuple[str, str, bool]] = []  # (tool, url, has_affiliate)
    short_pairs: list[tuple[str, str]] = []
    link_specs: list[dict] = []
    non_affiliate_tools: list[str] = []
    tools_used: list[str] = []

    for r in resolved:
        slug = f"{video_code}/{r['slug']}"
        short = f"https://{link_domain}/{slug}"
        actual_items.append((r["slug"], r["target_url"], r["has_affiliate"]))
        short_pairs.append((r["slug"], short))
        link_specs.append({
            "tool": r["slug"],
            "short_url": short,
            "coupon_code": r["coupon_code"],
        })
        tools_used.append(r["slug"])
        if not r["has_affiliate"]:
            non_affiliate_tools.append(r["slug"])
        if slug in already_present:
            continue
        d1.query(
            "INSERT INTO links (slug, video_code, tool, target_url, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            [slug, video_code, r["slug"], r["target_url"], now],
        )
        kv.put(slug, r["target_url"])

    description = generate_description(video_title, video_notes, link_specs)

    return ProcessResult(
        video_code=video_code,
        is_new_video=is_new_video,
        tools=tools_used,
        non_affiliate_tools=non_affiliate_tools,
        actual_links_text=format_actual_links_block(actual_items),
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
        non_aff_note = ""
        if result.non_affiliate_tools:
            non_aff_note = f" | NON-AFFILIATE (verify URLs): {', '.join(result.non_affiliate_tools)}"
        print(f"  ✓ {result.video_code} — {len(result.tools)} link(s); status → To Review{non_aff_note}")

    print(f"\nProcessed: {processed} | Failed: {failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
