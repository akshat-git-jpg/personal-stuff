#!/usr/bin/env python3
"""125 build-assembly-plan: per-segment retime math for the auto-assembled cut.

In:  ../040-polish-script-for-delivery-sonnet/output/<base>.segments.json
       [{seg_id, raw_start, raw_end, script_text, kind: "screen"|"a4_block"}]
     ../120-make-timestamped-transcript-run/output/<base>.json (VO word timings)
     ../080-synthesize-voice-run/output/<base>.work/chunks.json (chunk -> segment ids)
Out: ./output/<base>.assembly-plan.json
       [{seg_id, src_in, src_out, target_dur, speed, freeze_pad, overlay: [...], flag, reason}]

Rules:
  - target_dur = summed VO duration of the segment's chunks.
  - speed = (src_out - src_in) / target_dur, clamped to SPEED_BAND. Remainder handled by
    freeze-extending the slice's last frame (short footage) or flagging (footage too long
    to fit even at max speed).
  - kind == "a4_block" segments produce no screen slice; they reserve the span for the
    fullscreen avatar clip from step 160.
  - Every flag carries a human-readable reason; flags are the editor's entire remaining job.
"""
import sys, os, json, argparse, re, pathlib

SPEED_BAND = (0.85, 1.18)

def normalize(text):
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    num_map = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
    for d, w in num_map.items():
        text = text.replace(d, w)
    return text.split()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--fixture-dir", help="For tests")
    args = parser.parse_args()

    if args.fixture_dir:
        seg_file = pathlib.Path(args.fixture_dir) / "segments.json"
        vo_file = pathlib.Path(args.fixture_dir) / "fixture.json"
        out_dir = pathlib.Path(args.fixture_dir)
    else:
        root = pathlib.Path(__file__).resolve().parents[1]
        seg_file = root / "040-polish-script-for-delivery-sonnet" / "output" / f"{args.base}.segments.json"
        vo_file = root / "120-make-timestamped-transcript-run" / "output" / f"{args.base}.json"
        out_dir = pathlib.Path(__file__).resolve().parent / "output"

    out_dir.mkdir(exist_ok=True, parents=True)
    out_file = out_dir / f"{args.base}.assembly-plan.json"

    with open(seg_file) as f:
        segments = json.load(f)
    with open(vo_file) as f:
        vo_data = json.load(f)

    words = vo_data.get("words", [])
    audio_end = words[-1]["end"] if words else 0.0

    word_idx = 0
    plan = []

    for i, seg in enumerate(segments):
        kind = seg.get("kind", "screen")
        seg_id = seg["seg_id"]
        raw_start = seg.get("raw_start", 0.0)
        raw_end = seg.get("raw_end", 0.0)
        script_words = normalize(seg.get("script_text", ""))

        if kind == "a4_block":
            plan.append({
                "seg_id": seg_id,
                "src_in": raw_start,
                "src_out": raw_end,
                "target_dur": 0.0,
                "speed": 1.0,
                "freeze_pad": 0.0,
                "overlay": [],
                "flag": False,
                "reason": ""
            })
            continue

        match_count = 0
        vo_start = None
        vo_end = None
        
        while word_idx < len(words) and match_count < len(script_words):
            w_obj = words[word_idx]
            w_text = normalize(w_obj["word"])
            if w_text:
                if vo_start is None:
                    vo_start = w_obj["start"]
                vo_end = w_obj["end"]
                match_count += len(w_text)
            word_idx += 1

        if vo_start is None: vo_start = 0.0
        if vo_end is None: vo_end = vo_start
        
        target_dur = vo_end - vo_start
        
        if i == len(segments) - 1:
            target_dur = audio_end - vo_start

        if target_dur <= 0:
            target_dur = 0.1

        footage_dur = raw_end - raw_start
        speed = footage_dur / target_dur
        
        flag = False
        reason = ""
        freeze_pad = 0.0

        if speed > SPEED_BAND[1]:
            speed = SPEED_BAND[1]
            flag = True
            reason = "footage exceeds VO at max speed"
        elif speed < SPEED_BAND[0]:
            speed = SPEED_BAND[0]
            freeze_pad = target_dur - (footage_dur / speed)

        plan.append({
            "seg_id": seg_id,
            "src_in": raw_start,
            "src_out": raw_end,
            "target_dur": target_dur,
            "speed": round(speed, 2),
            "freeze_pad": round(max(0.0, freeze_pad), 2),
            "overlay": [],
            "flag": flag,
            "reason": reason
        })

    with open(out_file, "w") as f:
        json.dump(plan, f, indent=2)
        
    print(f"Assembly plan written for {len(plan)} segments.")

if __name__ == "__main__":
    main()
