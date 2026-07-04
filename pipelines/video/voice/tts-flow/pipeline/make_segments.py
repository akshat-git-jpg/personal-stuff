#!/usr/bin/env python3
"""Convert a faster-whisper transcript.json into the engine-contract segments.json.

Usage: make_segments.py <transcript.json> <segments.json>
Input  : {"segments": [{"start","end","text"}, ...]}
Output : [{"id","text","start","end"}, ...]   (engines use id+text; start/end kept for sync)
"""
import sys, json, pathlib

def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.loads(pathlib.Path(src).read_text())
    segs = data["segments"] if isinstance(data, dict) else data
    out = [
        {"id": f"{i:04d}", "text": s["text"].strip(),
         "start": s.get("start"), "end": s.get("end")}
        for i, s in enumerate(segs) if s.get("text", "").strip()
    ]
    pathlib.Path(dst).write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"{len(out)} segments -> {dst}")

if __name__ == "__main__":
    main()
