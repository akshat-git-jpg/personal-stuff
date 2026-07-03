"""Interactive orchestrator for the YT analysis pipeline.

Asks the user which sync operations to run, then calls the corresponding
helper modules (sync_metadata, sync_views, sync_clicks) and prints a
summary at the end.

Rank analysis is intentionally not handled here — see sync_rankings.py.
"""

import os
import sys

# Make `from common.x import y` work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
# Make sibling modules in this folder importable by name
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sync_clicks  # noqa: E402
import sync_metadata  # noqa: E402
import sync_views  # noqa: E402

OPTIONS = [
    ("Metadata sync (tracker → Analysis sheet, filtered by yt_upload_status=uploaded)", "metadata"),
    ("Views (YouTube API → 'views' column in Analysis sheet)", "views"),
    ("Affiliate link clicks (D1 → 'affiliate_link_clicks' column with rich format)", "clicks"),
    ("Rank analysis", "rank"),
]


def parse_selection(text: str, n_options: int) -> set[int]:
    """Parse user input '1', '1,2,3', or 'all' into a set of option numbers.

    Raises ValueError for invalid input.
    """
    text = text.strip().lower()
    if not text:
        raise ValueError("Empty selection")
    if text == "all":
        return set(range(1, n_options + 1))
    out: set[int] = set()
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit():
            raise ValueError(f"Not a number: {part!r}")
        n = int(part)
        if n < 1 or n > n_options:
            raise ValueError(f"Out of range: {n}")
        out.add(n)
    if not out:
        raise ValueError("No valid selections")
    return out


def prompt_user() -> set[int]:
    print("\nWhat do you want to sync?\n")
    for i, (label, _) in enumerate(OPTIONS, start=1):
        print(f"  {i}. {label}")
    print('\nEnter numbers (e.g. "1,2"), or "all".')
    while True:
        try:
            raw = input("> ")
            return parse_selection(raw, len(OPTIONS))
        except ValueError as e:
            print(f"Invalid input: {e}. Try again.")


def run_selected(selection: set[int]) -> None:
    summary: dict[str, object] = {}

    if 1 in selection:
        print("\n→ Syncing metadata...")
        try:
            summary["metadata"] = sync_metadata.sync_metadata()
            print("  ✓ metadata sync done")
        except Exception as e:
            summary["metadata"] = f"ERROR: {e}"
            print(f"  ✗ metadata sync failed: {e}", file=sys.stderr)

    if 2 in selection:
        print("\n→ Fetching views...")
        try:
            summary["views"] = sync_views.sync_views()
            print("  ✓ views sync done")
        except Exception as e:
            summary["views"] = f"ERROR: {e}"
            print(f"  ✗ views sync failed: {e}", file=sys.stderr)

    if 3 in selection:
        print("\n→ Refreshing affiliate link clicks...")
        try:
            summary["clicks"] = sync_clicks.sync_clicks()
            print("  ✓ clicks sync done")
        except Exception as e:
            summary["clicks"] = f"ERROR: {e}"
            print(f"  ✗ clicks sync failed: {e}", file=sys.stderr)

    if 4 in selection:
        print("\n→ Rank analysis: not part of this script.")
        print("  Run `python3 yt-analysis/sync_rankings.py` separately.")
        summary["rank"] = "deferred (run sync_rankings.py)"

    print("\n========== SUMMARY ==========")
    for key, val in summary.items():
        print(f"{key}: {val}")


def main() -> int:
    selection = prompt_user()
    run_selected(selection)
    return 0


if __name__ == "__main__":
    sys.exit(main())
