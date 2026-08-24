#!/usr/bin/env python3
"""Take-to-take LEVEL MATCH + final loudnorm, on the engine's own refined edges.
Each keeper is a distinct take at a ~constant level; we bring every take to the
MEDIAN take loudness with a STATIC per-take gain (no dynamic normalizer -> no
pumping), then one loudnorm pass to -14 LUFS. Usage: level_cut.py RAW keepers.json OUT.mp4"""
import json, sys, os, subprocess, tempfile, statistics, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut as CUT  # reuse the EXACT edge-refinement the render uses

raw, kf, out = sys.argv[1], sys.argv[2], sys.argv[3]
ks = CUT._refine_edges(raw, json.load(open(kf)))

def mean_vol(cs, ce):
    r = subprocess.run(["ffmpeg","-nostdin","-hide_banner","-ss",f"{cs:.3f}","-t",f"{ce-cs:.3f}",
        "-i",raw,"-vn","-af","volumedetect","-f","null","-"], capture_output=True, text=True)
    m = re.search(r"mean_volume:\s*(-?\d+\.?\d*) dB", r.stderr)
    return float(m.group(1)) if m else None

vols = [mean_vol(k["cs"], k["ce"]) for k in ks]
tgt = statistics.median([v for v in vols if v is not None])
gains = []
for v in vols:
    g = 0.0 if v is None else max(-6.0, min(6.0, tgt - v))
    gains.append(round(g, 2))
print("per-take mean dB:", [round(v,1) if v else None for v in vols])
print("target dB:", round(tgt,1), " gains:", gains)

n = len(ks); p, vl, al = [], [], []
for i, k in enumerate(ks):
    cs, ce = k["cs"], k["ce"]
    p.append(f"[0:v]trim={cs:.3f}:{ce:.3f},setpts=PTS-STARTPTS,fps=25,setsar=1[v{i}]")
    p.append(f"[0:a]atrim={cs:.3f}:{ce:.3f},asetpts=PTS-STARTPTS,volume={gains[i]}dB,"
             f"aformat=sample_rates=48000:channel_layouts=stereo[a{i}]")
    vl.append(f"[v{i}]"); al.append(f"[a{i}]")
fg = ";".join(p) + ";" + "".join(vl[i]+al[i] for i in range(n)) + f"concat=n={n}:v=1:a=1[v][araw];[araw]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
subprocess.run(["ffmpeg","-nostdin","-v","error","-y","-i",raw,"-filter_complex",fg,
    "-map","[v]","-map","[a]","-c:v","libx264","-crf","20","-preset","veryfast","-pix_fmt","yuv420p",
    "-c:a","aac","-b:a","192k","-movflags","+faststart",out], check=True)
dur = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nk=1:nw=1",out],
    capture_output=True, text=True).stdout.strip()
print(f"wrote {out}  ({dur}s, {n} leveled takes)")
