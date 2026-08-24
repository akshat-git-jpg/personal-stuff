#!/usr/bin/env python3
"""Snap every keeper's LEADING edge (cs) to the WAVEFORM onset — ASR word times drift up to ~2s,
and the engine's edge-snap only reaches 1.3s, so a keeper can open into dead air. This finds the
first SUSTAINED speech energy at/after cs (20ms RMS) and moves cs there, trimming leading silence
however large the drift. LEADING ONLY — the trailing release is handled by the render's _refine_edges;
extending ce here risks grabbing the next take's word. Usage: wave_snap.py RAW keepers.json"""
import sys, json, subprocess, wave, numpy as np
raw, kf = sys.argv[1], sys.argv[2]
LEAD, SUS, MIN_GAP = 0.05, 3, 0.30   # SUS=60ms sustained; only snap when leading silence > MIN_GAP
def snap_cs(cs, ce):
    a=cs-0.05; b=min(ce, cs+4.0)                     # look only within the keeper, cap search at +4s
    subprocess.run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-ss",f"{a:.3f}","-t",f"{b-a:.3f}",
        "-i",raw,"-vn","-ac","1","-ar","16000","/tmp/_ws.wav"],check=True)
    w=wave.open("/tmp/_ws.wav"); sr=w.getframerate()
    x=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768.0
    HOP=int(0.02*sr); n=len(x)//HOP
    env=np.array([np.sqrt(np.mean(x[i*HOP:(i+1)*HOP]**2)+1e-9) for i in range(n)])
    peak=np.percentile(env,95); thr=max(peak*0.05, np.percentile(env,20)*3.0)  # LOW thr: catch soft onsets ("Een","Je")
    on=next((i for i in range(n) if env[i]>thr and np.mean(env[i:i+SUS]>thr)>=0.6), None)
    if on is None: return cs
    onset=a+on*0.02
    if onset-cs < MIN_GAP: return cs                 # small/no leading silence -> leave to _refine_edges (don't clip soft first word)
    return round(onset-LEAD, 3)                       # trim the big leading dead-air the engine's 1.3s snap can't reach
ks=json.load(open(kf)); moved=0
for k in ks:
    ncs=snap_cs(k["cs"], k["ce"])
    if abs(ncs-k["cs"])>0.12: moved+=1
    k["cs"]=ncs                                      # ce untouched
json.dump(ks, open(kf,"w"), indent=1)
print(f"leading-snapped {len(ks)} keepers ({moved} moved >0.12s)")
