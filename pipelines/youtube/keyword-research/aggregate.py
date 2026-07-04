"""Stage 2: count softwares + topics from raw.json, run Gemini synthesis, write summary.md.

Reads:  output/<run_id>/raw.json (latest if --input not given)
Writes: output/<run_id>/summary.md

Run:
  python keyword-research/aggregate.py
  python keyword-research/aggregate.py --input output/2026-05-09-103000/raw.json
  python keyword-research/aggregate.py --no-synthesis     # print counts, skip Gemini
"""

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from common.env import MYPROJ_ROOT  # noqa: E402
from common.gemini import generate_text  # noqa: E402

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_ROOT = os.path.join(SCRIPT_DIR, "output")
PROMPT_PATH = os.path.join(MYPROJ_ROOT, "common", "prompts", "keyword-research", "synthesize.md")

SYNTHESIS_MODEL = "gemini-2.5-pro"
TOP_N = 20


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", default=None, help="Path to raw.json (default: latest run)")
    p.add_argument("--no-synthesis", action="store_true", help="Skip Gemini, just print counts")
    return p.parse_args()


def find_latest_raw():
    if not os.path.isdir(OUTPUT_ROOT):
        return None
    runs = sorted(d for d in os.listdir(OUTPUT_ROOT) if os.path.isdir(os.path.join(OUTPUT_ROOT, d)))
    for run in reversed(runs):
        candidate = os.path.join(OUTPUT_ROOT, run, "raw.json")
        if os.path.isfile(candidate):
            return candidate
    return None


def normalize(s):
    return (s or "").strip().lower()


def tally(raw, key):
    """Count channels + videos per item for the given key ('softwares' or 'topics').

    Returns list of {item, channel_count, video_count} sorted by channel_count desc, video_count desc.
    Item display string uses the most common original casing.
    """
    channels_by_norm = defaultdict(set)
    videos_by_norm = Counter()
    casing_by_norm = defaultdict(Counter)  # norm -> Counter(original -> count)

    for ch in raw.get("channels", []):
        ch_url = ch["url"]
        for v in ch.get("videos", []):
            seen_in_video = set()
            for item in v.get(key, []):
                norm = normalize(item)
                if not norm or norm in seen_in_video:
                    continue
                seen_in_video.add(norm)
                channels_by_norm[norm].add(ch_url)
                videos_by_norm[norm] += 1
                casing_by_norm[norm][item.strip()] += 1

    rows = []
    for norm, ch_set in channels_by_norm.items():
        display = casing_by_norm[norm].most_common(1)[0][0]
        rows.append({
            "item": display,
            "channel_count": len(ch_set),
            "video_count": videos_by_norm[norm],
        })
    rows.sort(key=lambda r: (-r["channel_count"], -r["video_count"], r["item"].lower()))
    return rows


def per_channel_breakdown(raw):
    """Return list of {channel, videos, affiliated_softwares, topics} for the synthesis prompt."""
    out = []
    for ch in raw.get("channels", []):
        affiliated = []
        topics = []
        seen_aff = set()
        seen_tp = set()
        videos = []
        for v in ch.get("videos", []):
            videos.append({
                "title": v.get("title", "(untitled)"),
                "url": v.get("url", ""),
                "affiliated_softwares": v.get("affiliated_softwares", []),
            })
            for s in v.get("affiliated_softwares", []):
                k = normalize(s)
                if k and k not in seen_aff:
                    seen_aff.add(k)
                    affiliated.append(s.strip())
            for t in v.get("topics", []):
                k = normalize(t)
                if k and k not in seen_tp:
                    seen_tp.add(k)
                    topics.append(t.strip())
        out.append({
            "channel": ch.get("channel_title") or ch["url"],
            "url": ch["url"],
            "videos": videos,
            "affiliated_softwares": affiliated,
            "topics": topics,
        })
    return out


def format_table(rows, label, top_n=TOP_N):
    lines = [f"| {label} | Channels | Videos |", "| --- | --- | --- |"]
    for r in rows[:top_n]:
        lines.append(f"| {r['item']} | {r['channel_count']} | {r['video_count']} |")
    return "\n".join(lines)


def format_per_channel(breakdown):
    blocks = []
    for ch in breakdown:
        sw = ", ".join(ch["affiliated_softwares"]) or "(none)"
        tp = ", ".join(ch["topics"]) or "(none)"
        video_lines = "\n".join(
            f"    - \"{v['title']}\" ({v['url']}) — affiliated: {', '.join(v['affiliated_softwares']) or 'none'}"
            for v in ch.get("videos", [])
        )
        blocks.append(
            f"- **{ch['channel']}** ({ch['url']})\n"
            f"  - affiliated softwares: {sw}\n"
            f"  - topics: {tp}\n"
            f"  - videos:\n{video_lines}"
        )
    return "\n".join(blocks)


def main():
    args = parse_args()

    raw_path = args.input
    if not raw_path:
        raw_path = find_latest_raw()
        if not raw_path:
            print("ERROR: no raw.json found under output/ — run extract.py first.", file=sys.stderr)
            sys.exit(1)
    if not os.path.isfile(raw_path):
        print(f"ERROR: file not found: {raw_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {raw_path}")
    with open(raw_path) as f:
        raw = json.load(f)

    n_channels = sum(1 for c in raw.get("channels", []) if c.get("videos"))
    n_videos = sum(len(c.get("videos", [])) for c in raw.get("channels", []))
    affiliated = tally(raw, "affiliated_softwares")
    topics = tally(raw, "topics")
    breakdown = per_channel_breakdown(raw)

    print(f"\nChannels: {n_channels}    Videos: {n_videos}")
    print(f"\nTop affiliated softwares ({len(affiliated)} unique):")
    for r in affiliated[:TOP_N]:
        print(f"  {r['channel_count']:3d} chans  {r['video_count']:3d} vids  {r['item']}")
    print(f"\nTop topics ({len(topics)} unique):")
    for r in topics[:TOP_N]:
        print(f"  {r['channel_count']:3d} chans  {r['video_count']:3d} vids  {r['item']}")

    if args.no_synthesis:
        print("\n--no-synthesis: skipping Gemini call.")
        return

    with open(PROMPT_PATH) as f:
        prompt_template = f.read()

    date_str = (raw.get("date_found") or datetime.now().isoformat())[:10]
    prompt = (
        prompt_template
        .replace("{date}", date_str)
        .replace("{run_id}", raw.get("run_id", "(unknown)"))
        .replace("{n_channels}", str(n_channels))
        .replace("{n_videos}", str(n_videos))
        .replace("{affiliated_table}", format_table(affiliated, "Software"))
        .replace("{topic_table}", format_table(topics, "Topic"))
        .replace("{per_channel_block}", format_per_channel(breakdown))
    )

    print(f"\nCalling {SYNTHESIS_MODEL} for synthesis...")
    summary_md = generate_text(SYNTHESIS_MODEL, prompt)

    summary_path = os.path.join(os.path.dirname(raw_path), "summary.md")
    with open(summary_path, "w") as f:
        f.write(summary_md)
    print(f"Wrote {summary_path}")


if __name__ == "__main__":
    main()
