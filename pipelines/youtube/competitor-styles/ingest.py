#!/usr/bin/env python3
"""Ingest a competitor YouTube channel into a style pack folder.

Usage:
    python3 ingest.py <channel-url> [--limit 30] [--slug <slug>]

Zero API keys. Catalog listing + per-video metadata via the system `yt-dlp`
binary; transcript text via the repo's pp-yt-transcript CLI (cached, uses
youtube-transcript-api's timedtext endpoint — more reliable than yt-dlp's
caption extractor, and no VTT cleanup needed). Never downloads media.
Stdlib-only — no venv needed. Re-running skips already-fetched transcripts,
so it doubles as "pick up the channel's new uploads". Run from the Mac
(residential IP) — YouTube blocks transcript fetches from datacenter IPs.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE / "channels"
# HERE = <repo>/pipelines/youtube/competitor-styles → parents[2] = <repo>
TRANSCRIPT_CLI = HERE.parents[2] / "tooling" / "cli" / "youtube" / "pp-yt-transcript"


def run_json(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"{cmd[0]} failed ({out.returncode}): {out.stderr.strip()[-400:]}")
    return json.loads(out.stdout)


def select(entries, limit):
    """First 10 (the /videos tab lists newest-first) + top by views, capped."""
    chosen = {}
    for e in entries[:10]:
        chosen[e["id"]] = e
    by_views = sorted(entries, key=lambda e: e.get("view_count") or 0, reverse=True)
    for e in by_views:
        if len(chosen) >= limit:
            break
        chosen.setdefault(e["id"], e)
    return list(chosen.values())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    url = args.channel_url.rstrip("/")
    if not url.endswith("/videos"):
        url += "/videos"

    print(f"Listing uploads: {url}")
    playlist = run_json(["yt-dlp", "--flat-playlist", "-J", url])
    entries = [e for e in (playlist.get("entries") or []) if e and e.get("id")]
    if not entries:
        sys.exit("No videos found — is that URL a channel page?")

    handle = playlist.get("uploader_id") or playlist.get("channel") or "channel"
    slug = args.slug or re.sub(r"[^a-z0-9-]", "", handle.lower().lstrip("@"))
    ch_dir = BASE / slug
    tdir = ch_dir / "transcripts"
    tdir.mkdir(parents=True, exist_ok=True)
    (ch_dir / "exemplars").mkdir(exist_ok=True)
    (ch_dir / "output").mkdir(exist_ok=True)

    catalog = [
        {
            "id": e["id"],
            "title": e.get("title"),
            "view_count": e.get("view_count"),
            "duration": e.get("duration"),
            "url": f"https://www.youtube.com/watch?v={e['id']}",
        }
        for e in entries
    ]
    (ch_dir / "videos.json").write_text(json.dumps(catalog, indent=2))

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

    (ch_dir / "channel.json").write_text(json.dumps(
        {
            "slug": slug,
            "channel_url": args.channel_url,
            "channel_name": playlist.get("channel") or playlist.get("uploader"),
            "last_ingest": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "transcripts": len(list(tdir.glob("*.md"))),
        },
        indent=2,
    ))
    print(f"Done: {ok} new transcripts, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not TRANSCRIPT_CLI.exists():
        sys.exit(f"pp-yt-transcript not found at {TRANSCRIPT_CLI}")
    main()
