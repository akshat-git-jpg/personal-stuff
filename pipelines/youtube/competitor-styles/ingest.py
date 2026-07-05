#!/usr/bin/env python3
"""Ingest a competitor YouTube channel's transcripts into a style pack folder.

Usage:
    python3 ingest.py <channel-url> [--limit 30] [--slug <slug>]

Zero API keys. Catalog listing via catalog.py (system `yt-dlp` binary);
transcript text via the repo's pp-yt-transcript CLI (cached, uses
youtube-transcript-api's timedtext endpoint — more reliable than yt-dlp's
caption extractor, and no VTT cleanup needed). Never downloads media.
Stdlib-only — no venv needed. Re-running skips already-fetched transcripts,
so it doubles as "pick up the channel's new uploads". Run from the Mac
(residential IP) — YouTube blocks transcript fetches from datacenter IPs.
Independent of fetch_video.py — run this even if you never run that.
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from catalog import fetch_catalog, select, update_channel_json

HERE = Path(__file__).resolve().parent
# HERE = <repo>/pipelines/youtube/competitor-styles → parents[2] = <repo>
TRANSCRIPT_CLI = HERE.parents[2] / "tooling" / "cli" / "youtube" / "pp-yt-transcript"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    slug, ch_dir, entries = fetch_catalog(args.channel_url, args.slug)
    tdir = ch_dir / "transcripts"
    tdir.mkdir(exist_ok=True)
    (ch_dir / "exemplars").mkdir(exist_ok=True)
    (ch_dir / "output").mkdir(exist_ok=True)

    todo = [e for e in select(entries, args.limit) if not (tdir / f"{e['id']}.md").exists()]
    print(f"{len(entries)} videos in catalog; fetching {len(todo)} transcripts")

    ok = skipped = 0
    for i, e in enumerate(todo, 1):
        vid = e["id"]
        print(f"[{i}/{len(todo)}] {vid}  {(e.get('title') or '')[:60]}")
        t = subprocess.run([str(TRANSCRIPT_CLI), "get", vid],
                           capture_output=True, text=True)
        text = t.stdout.strip()
        if t.returncode != 0 or len(text.split()) < 100:
            reason = t.stderr.strip()[-120:] if t.returncode != 0 else "under 100 words"
            print(f"   no usable transcript — skipped ({reason})")
            skipped += 1
            if ok == 0 and skipped >= 5:
                sys.exit("First 5 videos all failed — YouTube may be blocking "
                         "this IP. Run from the Mac and retry later; do not "
                         "add cookies or proxies.")
            continue
        # metadata is best-effort; fall back to the flat-playlist entry
        m = subprocess.run(
            ["yt-dlp", "-J", "--skip-download",
             f"https://www.youtube.com/watch?v={vid}"],
            capture_output=True, text=True,
        )
        info = json.loads(m.stdout) if m.returncode == 0 else {}
        up = info.get("upload_date") or ""
        up = f"{up[:4]}-{up[4:6]}-{up[6:]}" if len(up) == 8 else ""
        title = (info.get("title") or e.get("title") or "").replace('"', "'")
        header = (
            "---\n"
            f"id: {vid}\n"
            f'title: "{title}"\n'
            f"views: {info.get('view_count') or e.get('view_count') or 0}\n"
            f"upload_date: {up}\n"
            f"duration: {info.get('duration_string') or ''}\n"
            f"url: https://www.youtube.com/watch?v={vid}\n"
            "---\n\n"
        )
        (tdir / f"{vid}.md").write_text(header + text + "\n")
        ok += 1
        time.sleep(2)

    update_channel_json(
        ch_dir, key="transcripts",
        fields={
            "last_ingest": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "count": len(list(tdir.glob("*.md"))),
        },
    )
    print(f"Done: {ok} new transcripts, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not TRANSCRIPT_CLI.exists():
        sys.exit(f"pp-yt-transcript not found at {TRANSCRIPT_CLI}")
    main()
