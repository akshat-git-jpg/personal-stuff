#!/usr/bin/env python3
"""Merge fine Whisper segments into longer chunks for fewer seams + stable pacing.

Usage: chunk_segments.py <segments.json> <chunks.json> [target_span_seconds=22]

Each chunk spans up to ~target seconds of ORIGINAL timeline, breaking only at segment
boundaries. Output keeps the chunk's original start/end so it can still be anchored.
"""
import sys, json, pathlib

def main():
    src, dst = sys.argv[1], sys.argv[2]
    target = float(sys.argv[3]) if len(sys.argv) > 3 else 22.0
    segs = json.loads(pathlib.Path(src).read_text())

    chunks, cur = [], None
    for s in segs:
        if not s.get("text", "").strip():
            continue
        if cur is None:
            cur = {"texts": [s["text"].strip()], "start": s["start"], "end": s["end"]}
            continue
        # would extending past target? close the chunk.
        if (s["end"] - cur["start"]) > target:
            chunks.append(cur)
            cur = {"texts": [s["text"].strip()], "start": s["start"], "end": s["end"]}
        else:
            cur["texts"].append(s["text"].strip())
            cur["end"] = s["end"]
    if cur:
        chunks.append(cur)

    out = [{"id": f"c{i:03d}", "text": " ".join(c["texts"]),
            "start": c["start"], "end": c["end"]} for i, c in enumerate(chunks)]
    pathlib.Path(dst).write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"{len(segs)} segments -> {len(out)} chunks (target {target:.0f}s)")
    for c in out:
        print(f"  {c['id']}: {c['start']:.1f}-{c['end']:.1f}s ({c['end']-c['start']:.1f}s) {len(c['text'])} chars")

if __name__ == "__main__":
    main()
