#!/usr/bin/env python3
"""Fetch a competitor channel's videos just long enough to measure cut
pacing and cache representative frames, into the same style-pack folder
fetch-transcripts uses. Never keeps the raw video.

Usage:
    python3 fetch_video.py <channel-url> [--limit 30] [--slug <slug>]

Needs the system `ffmpeg`/`ffprobe` and `yt-dlp` binaries. Stdlib-only — no
venv. Re-running later picks up new uploads only (skips videos already in
video-metrics.json). Downloads at 720p (legible for on-screen text and
motion graphics, far lighter than source quality) and deletes each raw
video immediately after its cut-metrics and frame cache are written, so
peak disk usage is one video at a time, not the whole catalog. Independent
of ingest.py — run this even if the channel has no script pack.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from catalog import fetch_catalog, select, update_channel_json

INTERVAL = 2.0                # seconds between interior samples in long shots
MIN_SHOT_FOR_INTERVAL = 4.0    # only add interior samples inside shots longer than this
SCENE_THRESHOLD = 0.4          # ffmpeg scene-filter sensitivity


def probe_duration(video_path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def detect_scene_cuts(video_path):
    """Cut timestamps (seconds) via ffmpeg's scene filter + showinfo."""
    result = subprocess.run(
        ["ffmpeg", "-i", str(video_path),
         "-vf", f"select='gt(scene,{SCENE_THRESHOLD})',showinfo",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    return sorted(float(m) for m in re.findall(r"pts_time:([\d.]+)", result.stderr))


def shot_lengths(cuts, duration):
    bounds = [0.0] + cuts + [duration]
    return [round(b - a, 2) for a, b in zip(bounds, bounds[1:]) if b > a]


def extract_frames(video_path, out_dir, cuts, duration):
    """One frame at the start of every shot, plus interior samples every
    INTERVAL seconds for shots longer than MIN_SHOT_FOR_INTERVAL — catches
    animation/motion graphics that unfold without a hard cut, without
    needing perceptual-hash frame deduplication."""
    out_dir.mkdir(parents=True, exist_ok=True)
    bounds = [0.0] + cuts + [duration]
    timestamps = {round(t, 1) for t in bounds[:-1]}
    for a, b in zip(bounds, bounds[1:]):
        if b - a > MIN_SHOT_FOR_INTERVAL:
            t = a + INTERVAL
            while t < b:
                timestamps.add(round(t, 1))
                t += INTERVAL
    kept = []
    for t in sorted(timestamps):
        frame_path = out_dir / f"t{t:07.1f}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(video_path),
             "-frames:v", "1", "-q:v", "4", str(frame_path)],
            capture_output=True,
        )
        if frame_path.exists():
            kept.append(frame_path.name)
    return kept


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    slug, ch_dir, entries = fetch_catalog(args.channel_url, args.slug)
    cache_dir = ch_dir / ".video-cache"
    cache_dir.mkdir(exist_ok=True)

    metrics_path = ch_dir / "video-metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}

    todo = [e for e in select(entries, args.limit) if e["id"] not in metrics]
    print(f"{len(entries)} videos in catalog; fetching {len(todo)} videos")

    ok = skipped = 0
    for i, e in enumerate(todo, 1):
        vid = e["id"]
        print(f"[{i}/{len(todo)}] {vid}  {(e.get('title') or '')[:60]}")
        raw_path = cache_dir / f"{vid}.mp4"
        dl = subprocess.run(
            ["yt-dlp", "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]",
             "--merge-output-format", "mp4", "-o", str(raw_path),
             f"https://www.youtube.com/watch?v={vid}"],
            capture_output=True, text=True,
        )
        if dl.returncode != 0 or not raw_path.exists():
            reason = dl.stderr.strip()[-120:]
            print(f"   download failed — skipped ({reason})")
            skipped += 1
            if ok == 0 and skipped >= 5:
                sys.exit("First 5 videos all failed — YouTube may be blocking "
                         "this IP. Run from the Mac and retry later; do not "
                         "add cookies or proxies.")
            continue

        duration = probe_duration(raw_path)
        cuts = detect_scene_cuts(raw_path)
        frame_dir = cache_dir / vid
        frames = extract_frames(raw_path, frame_dir, cuts, duration)
        raw_path.unlink()

        metrics[vid] = {
            "title": e.get("title"),
            "view_count": e.get("view_count"),
            "duration_s": round(duration, 1),
            "cuts_per_minute": round(len(cuts) / (duration / 60), 2) if duration else 0,
            "shot_lengths_s": shot_lengths(cuts, duration),
            "frame_count": len(frames),
        }
        metrics_path.write_text(json.dumps(metrics, indent=2))
        ok += 1

    update_channel_json(
        ch_dir, key="video",
        fields={
            "last_fetch": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "count": len(metrics),
        },
    )
    print(f"Done: {ok} new videos measured, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("ffmpeg/ffprobe not found — brew install ffmpeg")
    main()
