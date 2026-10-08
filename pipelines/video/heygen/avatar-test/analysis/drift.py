"""How far each second of a render is from the avatar's source photo (upper face + whole frame)."""
import subprocess, sys, numpy as np
clip, photo, crop = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 96, 48

def gray(args):
    raw = subprocess.run(["ffmpeg", "-v", "error"] + args + ["-vf", f"scale=1920:1080,crop={crop},scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    return f - f.mean((1, 2), keepdims=True)

ref = gray(["-i", photo, "-frames:v", "1"])[0]
f = gray(["-i", clip, "-r", "5"])            # 5 frames per second
d = np.abs(f - ref).mean((1, 2))
per10 = [d[i:i + 50].mean() for i in range(0, len(d), 50)]
print("distance from photo, per 10 s of render:", " ".join(f"{x:4.1f}" for x in per10))
