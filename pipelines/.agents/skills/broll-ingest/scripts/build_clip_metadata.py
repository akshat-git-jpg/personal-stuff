#!/usr/bin/env python3
"""
build_clip_metadata.py — the standard "keep 3 things" pass for the b-roll library.

For every clip in a trip folder's _catalog.json, produce a two-tier metadata set:
  TIER 1 (lean, bulk-feedable): _meta/planning_feed.md  — description + timecoded transcript per clip
  TIER 2 (rich, on-demand):     _meta/sidecars/<clip>.json — word-level transcript + still timecodes
                                _meta/filmstrips/<clip>.jpg — timecoded contact strip of the clip
Transcription: VAD-gated (faster-whisper silero) so wind/ambient clips are skipped; speech clips
transcribed with mlx-whisper large-v3 (Apple-Silicon GPU, correct NL/EN detection, word timestamps).
Resumable: skips clips whose sidecar already exists. Usage: python3 build_clip_metadata.py <TRIP_DIR>
"""
import json, os, sys, subprocess, time, tempfile, shutil

TRIP = sys.argv[1] if len(sys.argv)>1 else "/Users/luukalleman/Library/CloudStorage/GoogleDrive-luuk@alleman.nl/My Drive/Media/broll-library/canoe-trip-2026-07"
MEDIA = TRIP.rsplit("/broll-library",1)[0]
META = f"{TRIP}/_meta"
STEP = 4.0                      # seconds between filmstrip frames
MLX_REPO = "mlx-community/whisper-large-v3-mlx"
MIN_SPEECH_S = 1.5             # below this -> treat as no speech
os.makedirs(f"{META}/sidecars", exist_ok=True)
os.makedirs(f"{META}/filmstrips", exist_ok=True)
LOG=f"{META}/_build.log"
def log(m):
    open(LOG,"a").write(m+"\n"); print(m, flush=True)

cat = json.load(open(f"{TRIP}/_catalog.json"))

def has_audio(f):
    return subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip()!=''
def dur(f):
    return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip() or 0)

def filmstrip(clip,f,d):
    tmp=tempfile.mkdtemp()
    stills=[]; t=0.0; i=0
    while t < d:
        p=f"{tmp}/{i:03d}.jpg"
        subprocess.run(['ffmpeg','-nostdin','-v','error','-ss',str(t),'-i',f,'-frames:v','1',
                        '-vf',f"scale=300:-1,drawtext=text='{t:.0f}s':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7:boxborderw=5",p,'-y'],stdin=subprocess.DEVNULL)
        if os.path.exists(p): stills.append({"t":round(t,1)})
        t+=STEP; i+=1
    # tile 6-wide, rows sized to the actual frame count (no black padding tail)
    import math
    rows=max(1, math.ceil(len(stills)/6))
    subprocess.run(['ffmpeg','-nostdin','-v','error','-pattern_type','glob','-i',f"{tmp}/*.jpg",
                    '-vf',f'tile=6x{rows}:margin=6:padding=4:color=0x111111',f"{META}/filmstrips/{clip}.jpg",'-y'],stdin=subprocess.DEVNULL)
    shutil.rmtree(tmp, ignore_errors=True)
    return stills

# lazy-load heavy deps only when first needed
_vad=None
def speech_seconds(f):
    global _vad
    if _vad is None:
        from faster_whisper.audio import decode_audio
        from faster_whisper.vad import get_speech_timestamps
        _vad=(decode_audio,get_speech_timestamps)
    decode_audio,get_speech_timestamps=_vad
    audio=decode_audio(f, sampling_rate=16000)
    ts=get_speech_timestamps(audio)
    return sum((t['end']-t['start']) for t in ts)/16000.0

def transcribe(f):
    import sys as _sys, os as _os
    # Locate the loop-studio engine relative to this skill so it works under ANY
    # agent's skills dir (~/.claude/skills for Claude Code, ~/.agents/skills for Codex).
    _here = _os.path.dirname(_os.path.abspath(__file__))              # .../broll-ingest/scripts
    _root = _os.path.dirname(_os.path.dirname(_here))                 # .../<skills-root>
    _cands = [_os.path.join(_root, "loop-studio/core/engine"),
              _os.path.expanduser("~/.claude/skills/loop-studio/core/engine"),
              _os.path.expanduser("~/.agents/skills/loop-studio/core/engine")]
    _sys.path.insert(0, next((p for p in _cands if _os.path.isdir(p)), _cands[0]))
    from ls_platform import transcribe as _ls_transcribe   # cross-OS transcription
    r=_ls_transcribe(f, word_timestamps=True)
    segs=[]
    for s in r.get('segments',[]):
        txt=s['text'].strip()
        if not txt or s.get('no_speech_prob',0)>0.8: continue
        words=[{"w":w['word'].strip(),"s":round(w['start'],2),"e":round(w['end'],2)} for w in s.get('words',[])]
        segs.append({"in":round(s['start'],2),"out":round(s['end'],2),"text":txt,"words":words})
    return r.get('language'), segs, " ".join(s['text'] for s in segs)

t_start=time.time(); done=0; spoke=0
for e in cat:
    clip=e['clip']; sc_path=f"{META}/sidecars/{clip}.json"
    if os.path.exists(sc_path): done+=1; continue
    f=f"{MEDIA}/{e['library_path']}"
    if not os.path.exists(f): log(f"MISSING {clip}"); continue
    d=dur(f)
    stills=filmstrip(clip,f,d)
    has_speech=False; lang=None; segs=[]; transcript=""
    if has_audio(f):
        try:
            sp=speech_seconds(f)
            if sp>=MIN_SPEECH_S:
                lang,segs,transcript=transcribe(f)
                has_speech=len(segs)>0
        except Exception as ex:
            log(f"  WARN transcribe {clip}: {ex}")
    sc={"clip":clip,"library_path":e['library_path'],"shoot_date":e.get('shoot_date'),
        "duration_s":round(d,1),"category":e['category'],"rating":e.get('rating'),
        "orientation":"horizontal","description":e.get('description',''),"tags":e.get('tags',[]),
        "has_speech":has_speech,"language":lang if has_speech else None,
        "transcript_text":transcript,"segments":segs,
        "filmstrip":f"_meta/filmstrips/{clip}.jpg","stills_every_s":STEP,"stills":stills}
    json.dump(sc, open(sc_path,"w"), indent=1)
    done+=1; spoke+= 1 if has_speech else 0
    log(f"[{done}/{len(cat)}] {clip} speech={has_speech} segs={len(segs)} stills={len(stills)}")

# rebuild planning_feed.md from all sidecars + refresh _catalog.json speech flags
sides=[json.load(open(f"{META}/sidecars/{e['clip']}.json")) for e in cat if os.path.exists(f"{META}/sidecars/{e['clip']}.json")]
by={s['clip']:s for s in sides}
for e in cat:
    s=by.get(e['clip'])
    if s: e['has_speech']=s['has_speech']; e['transcript_text']=s['transcript_text']
json.dump(cat, open(f"{TRIP}/_catalog.json","w"), indent=1)

import collections
lines=["# Canoe Trip 2026-07 — planning feed",
 f"_{len(sides)} clips. Lean whole-corpus layer: description + timecoded transcript. Word timings, stills & filmstrips in _meta/sidecars + _meta/filmstrips (on-demand)._",""]
bycat=collections.defaultdict(list)
for s in sides: bycat[s['category']].append(s)
for c in ['freedom','place','people','details','grind','product']:
    for s in sorted(bycat.get(c,[]), key=lambda x:x['clip']):
        head=f"## {s['clip']} [{s['category']} · ★{s['rating']} · {s['duration_s']:.0f}s · speech={s['has_speech']}]"
        lines.append(head); lines.append(f"desc: {s['description']}")
        if s['has_speech']:
            lines.append(f"transcript ({s['language']}):")
            for seg in s['segments']: lines.append(f"  [{seg['in']:.0f}-{seg['out']:.0f}] {seg['text']}")
        lines.append("")
open(f"{META}/planning_feed.md","w").write("\n".join(lines))
log(f"\n=== DONE {done} clips, {spoke} with speech, {time.time()-t_start:.0f}s. planning_feed.md ~{len(open(f'{META}/planning_feed.md').read())//4} tokens ===")
