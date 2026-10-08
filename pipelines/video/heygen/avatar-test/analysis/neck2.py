import subprocess, numpy as np
T = "/Users/kbtg/.claude-work/jobs/dae145ff/tmp"
def motion(path, crop, t=18):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-t", str(t), "-vf", f"crop={crop},scale=96:64,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, 64, 96).astype(np.float32)
    return np.abs(np.diff(f, axis=0)).mean()
sets = {
    "maria bare neck": (f"{T}/maria-a.mp4", {"head": "360:300:800:120", "neck": "240:200:860:470", "shoulders": "600:200:660:650"}),
    "maria turtleneck": (f"{T}/maria-tn.mp4", {"head": "300:300:820:120", "neck": "220:160:860:500", "shoulders": "600:200:660:680"}),
    "helen (reference)": (f"{T}/fillfix.mp4", {"head": "360:300:800:120", "neck": "240:160:860:460", "shoulders": "600:200:660:620"}),
}
for who, (p, c) in sets.items():
    h, n, s = (motion(p, c[k]) for k in ("head", "neck", "shoulders"))
    print(f"{who:18s} head {h:4.2f}  neck {n:4.2f}  shoulders {s:4.2f}   head/shoulders {h/s:3.1f}x   neck/shoulders {n/s:3.1f}x")
lab = "drawtext=text='{t}':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=12"
fc = (f"[0:v]trim=0:18,setpts=PTS-STARTPTS,scale=960:540,{lab.format(t='Maria - bare neck (best take)')}[a];"
      f"[1:v]trim=0:18,setpts=PTS-STARTPTS,scale=960:540,{lab.format(t='Maria - turtleneck')}[b];[a][b]hstack[v]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{T}/maria-a.mp4", "-i", f"{T}/maria-tn.mp4", "-filter_complex", fc, "-map", "[v]", "-map", "0:a",
                "-t", "18", "-c:v", "libx264", "-crf", "16", "-r", "25", "-c:a", "aac", "/Users/kbtg/Downloads/proof-7-maria-neck.mp4"], check=True)
print("ok")
