"""Motion-clock check: does the head/eye motion follow render time or the words?

For two clips, compare frame N of A with frame N of B over the upper face (hair, forehead, eyes; the mouth
is left out because it follows the audio by design). Low difference = the same movement at that moment.
Usage: clock_metric.py <crop w:h:x:y> label=fileA@ssA,fileB@ssB ...
"""
import subprocess, sys, numpy as np
DUR, W, H = 18.0, 96, 48

def frames(path, ss, crop):
    vf = f"crop={crop},scale={W}:{H},format=gray"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ss), "-i", path, "-t", str(DUR), "-vf", vf, "-r", "25", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    return (f - f.mean((1, 2), keepdims=True))  # ignore global brightness

crop = sys.argv[1]
for spec in sys.argv[2:]:
    label, pair = spec.split("=", 1)
    (fa, sa), (fb, sb) = [p.rsplit("@", 1) for p in pair.split(",")]
    a, b = frames(fa, float(sa), crop), frames(fb, float(sb), crop)
    n = min(len(a), len(b))
    d = np.abs(a[:n] - b[:n]).mean((1, 2))
    print(f"{label:52s} mean diff {d.mean():5.2f}   (frames {n})")
