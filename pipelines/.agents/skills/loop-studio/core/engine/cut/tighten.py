#!/usr/bin/env python3
"""Remove dead air AND enforce a minimum section length.
- Compress every silence > MIN_DUR down to KEEP (ripple-cut A+V).
- NEVER create an output section (speech between two cuts) shorter than MIN_SECTION:
  a silence is only cut if the speech both before AND after it is >= MIN_SECTION; otherwise
  the pause is left intact so a tiny clip is never isolated between two jump-cuts.
Usage: tighten.py IN.mp4 OUT.mp4 [KEEP] [THRESH_dB] [MIN_DUR] [MIN_SECTION]"""
import sys, subprocess, re
inp, out = sys.argv[1], sys.argv[2]
KEEP  = float(sys.argv[3]) if len(sys.argv)>3 else 0.15
THR   = sys.argv[4] if len(sys.argv)>4 else "-32dB"
MIN   = float(sys.argv[5]) if len(sys.argv)>5 else 0.30
MINSEC= float(sys.argv[6]) if len(sys.argv)>6 else 1.0
dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nk=1:nw=1",inp],capture_output=True,text=True).stdout)
r = subprocess.run(["ffmpeg","-nostdin","-hide_banner","-i",inp,"-af",f"silencedetect=n={THR}:d={MIN}","-f","null","-"],capture_output=True,text=True)
sil=[]; cs=None
for line in r.stderr.splitlines():
    m=re.search(r"silence_start:\s*(-?\d+\.?\d*)",line)
    if m: cs=float(m.group(1))
    m=re.search(r"silence_end:\s*(-?\d+\.?\d*)",line)
    if m and cs is not None: sil.append((max(0.0,cs),float(m.group(1)))); cs=None
# build alternating speech/silence timeline
segs=[]; pos=0.0
for s,e in sil:
    if s>pos: segs.append([pos,s,"sp"])
    segs.append([s,e,"si"]); pos=e
if pos<dur: segs.append([pos,dur,"sp"])
# decide which silences to CUT: only if the speech accumulated in the current section >= MINSEC
# AND the next speech run >= MINSEC. Otherwise leave the pause intact (merge tiny clip into neighbour).
sp_idx=[i for i,g in enumerate(segs) if g[2]=="sp"]
def next_speech_len(i):
    for j in range(i+1,len(segs)):
        if segs[j][2]=="sp": return segs[j][1]-segs[j][0]
    return 0.0
cutouts=[]; acc=0.0
LEAD=0.10   # leading/trailing silence is NEVER wanted -> always trim to this
if segs and segs[0][2]=="si" and (segs[0][1]-segs[0][0])>LEAD+0.03:
    cutouts.append((segs[0][0], segs[0][1]-LEAD))           # trim dead air before first word
if segs and segs[-1][2]=="si" and (segs[-1][1]-segs[-1][0])>LEAD+0.03:
    cutouts.append((segs[-1][0]+LEAD, segs[-1][1]))         # trim dead air after last word
for i,g in enumerate(segs):
    if i==0 or i==len(segs)-1: continue                     # ends handled above
    if g[2]=="sp": acc+=g[1]-g[0]; continue
    L=g[1]-g[0]
    if L>KEEP+0.02 and acc>=MINSEC and next_speech_len(i)>=MINSEC:
        pad=KEEP/2.0; cutouts.append((g[0]+pad, g[1]-pad)); acc=0.0
    # else: keep the pause intact; section continues to grow (acc unchanged, includes coming speech)
# keep-segments = complement of cutouts
cutouts.sort(); keep=[]; pos=0.0
for a,b in cutouts:
    if a>pos: keep.append((pos,a))
    pos=b
if pos<dur: keep.append((pos,dur))
keep=[(a,b) for a,b in keep if b-a>0.02]
n=len(keep); p=[]; vl=[]; al=[]
for i,(a,b) in enumerate(keep):
    p.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{i}]")
    p.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS[a{i}]")
    vl.append(f"[v{i}]"); al.append(f"[a{i}]")
fg=";".join(p)+";"+"".join(vl[i]+al[i] for i in range(n))+f"concat=n={n}:v=1:a=1[v][a]"
subprocess.run(["ffmpeg","-nostdin","-v","error","-y","-i",inp,"-filter_complex",fg,"-map","[v]","-map","[a]",
    "-c:v","libx264","-crf","20","-preset","veryfast","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart",out],check=True)
removed=sum((b-a) for a,b in cutouts)
newdur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nk=1:nw=1",out],capture_output=True,text=True).stdout)
print(f"{inp.split('/')[-1]}: cut {len(cutouts)} gaps (min-section {MINSEC}s), removed {removed:.1f}s -> {dur:.1f}s to {newdur:.1f}s")
