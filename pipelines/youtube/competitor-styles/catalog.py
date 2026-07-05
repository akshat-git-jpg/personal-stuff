#!/usr/bin/env python3
"""Shared channel-catalog fetch + selection, used by both ingest.py
(transcripts) and fetch_video.py (video analysis). Neither pipeline depends
on the other having run — whichever runs first creates the catalog; the
other reuses it.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "channels"


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


def fetch_catalog(channel_url, slug=None):
    """Lists the channel's uploads, ensures channels/<slug>/ exists, (re)writes
    videos.json with the full catalog, and merges identity fields into
    channel.json. Returns (slug, channel_dir, entries).
    """
    url = channel_url.rstrip("/")
    if not url.endswith("/videos"):
        url += "/videos"

    print(f"Listing uploads: {url}")
    playlist = run_json(["yt-dlp", "--flat-playlist", "-J", url])
    entries = [e for e in (playlist.get("entries") or []) if e and e.get("id")]
    if not entries:
        sys.exit("No videos found — is that URL a channel page?")

    handle = playlist.get("uploader_id") or playlist.get("channel") or "channel"
    slug = slug or re.sub(r"[^a-z0-9-]", "", handle.lower().lstrip("@"))
    ch_dir = BASE / slug
    ch_dir.mkdir(parents=True, exist_ok=True)

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

    channel_name = playlist.get("channel") or playlist.get("uploader")
    path = ch_dir / "channel.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data["slug"] = slug
    data["channel_url"] = channel_url
    data["channel_name"] = channel_name
    path.write_text(json.dumps(data, indent=2))

    return slug, ch_dir, entries


def update_channel_json(ch_dir, key, fields):
    """Merges `fields` under channel.json[key] (e.g. "transcripts" or
    "video"), preserving the other pipeline's key and the identity fields
    fetch_catalog() already set.
    """
    path = ch_dir / "channel.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data[key] = fields
    path.write_text(json.dumps(data, indent=2))
