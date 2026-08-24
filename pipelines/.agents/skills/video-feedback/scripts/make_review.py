#!/usr/bin/env python3
"""Generate / update a frame.io-style review tool for a video PROJECT with version control.
Usage: make_review.py <video_path> [--project NAME] [--label vN] [--dir OUTDIR] [--open]

One reviewer folder per PROJECT: OUTDIR/<project>-Review/. Each call ADDS the video as a
version (newest first) — a dropdown in the tool switches versions, and EACH version keeps
its own comments. Re-run on every new render; the URL/port stays the same per project.
Luuk scrubs, types timestamped notes, clicks "Copy for Claude" (or Download .txt), pastes back."""
import sys, os, subprocess, argparse, json, hashlib, shutil, stat, re, time

AS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

def probe(path, key, stream=False):
    sel=['-select_streams','v:0'] if stream else []
    return subprocess.run(['ffprobe','-v','error',*sel,'-show_entries',key,'-of','default=nk=1:nw=1',path],
                          capture_output=True,text=True).stdout.strip()
def fps_of(path):
    r=probe(path,'stream=r_frame_rate',stream=True) or "30/1"
    try: n,d=r.split('/'); return round(float(n)/float(d),3)
    except Exception: return 30.0
def link(src,dst):
    if os.path.islink(dst) or os.path.exists(dst): os.remove(dst)
    try: os.symlink(src,dst)
    except OSError: shutil.copy2(src,dst)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--project"); ap.add_argument("--label")
    ap.add_argument("--dir",default=os.path.expanduser("~/Downloads")); ap.add_argument("--open",action="store_true")
    a=ap.parse_args()
    video=os.path.abspath(os.path.expanduser(a.video))
    if not os.path.isfile(video): sys.exit(f"no such video: {video}")
    base=os.path.splitext(os.path.basename(video))[0]
    m=re.search(r'[_-]?(v\d+)$', base)
    project=a.project or (base[:m.start()] if m else base).rstrip('_-') or base
    label=a.label or (m.group(1) if m else "v1")
    # URL-safe filename slug — the label may contain ? · → spaces etc. which break the video URL
    slug=re.sub(r'-{2,}','-', re.sub(r'[^A-Za-z0-9._-]+','-', label)).strip('-_') or "v"
    fps=fps_of(video); dur=probe(video,'format=duration')
    port=8778+(int(hashlib.sha1(project.encode()).hexdigest(),16)%400)     # stable per PROJECT
    outdir=os.path.join(os.path.expanduser(a.dir), f"{project}-Review"); os.makedirs(os.path.join(outdir,"versions"),exist_ok=True)
    # add this version's media (pretty label for display, safe slug for the file/URL)
    link(video, os.path.join(outdir,"versions",f"{slug}.mp4"))
    # upsert versions.json (newest first)
    vpath=os.path.join(outdir,"versions.json")
    try: vers=json.load(open(vpath, encoding="utf-8"))
    except Exception: vers=[]
    vers=[v for v in vers if v.get("label")!=label]
    vers.insert(0, {"label":label, "file":f"versions/{slug}.mp4", "fps":fps, "added":int(time.time())})
    json.dump(vers, open(vpath,"w", encoding="utf-8"), indent=1)
    # (re)write html/server/launcher (idempotent)
    html=open(os.path.join(AS,"review.template.html"), encoding="utf-8").read()
    html=(html.replace("__LABEL__",project).replace("__FPS__",str(fps))
              .replace("__LABEL_JSON__",json.dumps(project)).replace("__PROJECT_JSON__",json.dumps(project))
              .replace("__SEED_JSON__","[]"))
    open(os.path.join(outdir,"review.html"), "w", encoding="utf-8").write(html)
    open(os.path.join(outdir,"serve.py"), "w", encoding="utf-8").write(open(os.path.join(AS,"serve.template.py"), encoding="utf-8").read().replace("__PORT__",str(port)))
    cmd=os.path.join(outdir,"Open Review.command")
    open(cmd, "w", encoding="utf-8").write(open(os.path.join(AS,"Open Review.command.template"), encoding="utf-8").read().replace("__PORT__",str(port)))
    os.chmod(cmd, os.stat(cmd).st_mode|stat.S_IEXEC|stat.S_IXGRP|stat.S_IXOTH)
    # Windows launcher (cross-platform reviewer: same folder works on any OS)
    bat=os.path.join(outdir,"Open Review.bat")
    open(bat, "w", encoding="utf-8").write(open(os.path.join(AS,"Open Review.bat.template"), encoding="utf-8").read().replace("__PORT__",str(port)))
    print(f"project '{project}' — added version {label}  ({len(vers)} versions total, newest first: {[v['label'] for v in vers]})")
    print(f"  folder: {outdir}   fps={fps}  dur={dur}s  port={port}")
    print(f"  URL: http://localhost:{port}/review.html   (double-click 'Open Review.command' to serve+open)")
    if a.open: subprocess.Popen(['bash',cmd]); print("  launching...")

if __name__=="__main__": main()
