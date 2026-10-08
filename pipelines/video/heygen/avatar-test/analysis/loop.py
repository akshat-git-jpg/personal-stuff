"""Does the motion timeline loop? Compare the first 10 s of a render against every later 10 s window."""
import subprocess, sys, numpy as np
clip, crop = sys.argv[1], sys.argv[2]
W, H, FPS = 96, 48, 5
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", clip, "-vf", f"crop={crop},scale={W}:{H},format=gray", "-r", str(FPS), "-f", "rawvideo", "-"],
                     capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
f = f - f.mean((1, 2), keepdims=True)
win = 10 * FPS
head = f[:win]
scores = [(lag / FPS, np.abs(f[lag:lag + win] - head).mean()) for lag in range(FPS, len(f) - win)]
best = sorted(scores, key=lambda s: s[1])[:6]
print("closest matches to render seconds 0-10:", ", ".join(f"{t:.1f}s ({d:.2f})" for t, d in best))
print("typical diff:", round(float(np.median([d for _, d in scores])), 2))
