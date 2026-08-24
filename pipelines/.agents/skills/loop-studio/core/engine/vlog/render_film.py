#!/usr/bin/env python3
"""Loop Studio vlog engine — voice-first beat render, config-driven.
Usage: render_film.py <plan.json> <OUTPUT_LABEL> [video.json]
Config (video.json, default: next to the plan) — every project supplies its own:
  library      (REQUIRED) ingested library root: contains _catalog.json + _meta/sidecars/
  media_root   base dir that catalog `library_path` entries are relative to (default: parent of library)
  output_dir   where <LABEL>.mp4 lands (default: the plan's directory)
  resolution   [w,h] default [1920,1080] · fps default 25
  grade        "nordic" | "none" | raw ffmpeg filter string (default "nordic")
  music        {file, start=0, fade_in=2, fade_out=5} or null for no music bed
  captions     {overrides: {CLIP: [lines...]}} burned-subtitle overrides (default none)
  end_screen   {clip, in, dur, credits:[lines...]} or null to skip
  backup_dir   optional second copy of the final render
"""
import json, subprocess, tempfile, os, sys
PLAN=os.path.abspath(sys.argv[1]); NAME=sys.argv[2]
CFG_PATH=sys.argv[3] if len(sys.argv)>3 else os.path.join(os.path.dirname(PLAN),"video.json")
if not os.path.isfile(CFG_PATH):
    sys.exit(f"video.json not found at {CFG_PATH} — every project needs one (see engine docstring)")
CFG=json.load(open(CFG_PATH, encoding="utf-8"))
TRIP=os.path.expanduser(CFG["library"]); META=f"{TRIP}/_meta"
MEDIA=os.path.expanduser(CFG.get("media_root") or os.path.dirname(TRIP))
OUT=os.path.expanduser(CFG.get("output_dir") or os.path.dirname(PLAN))
plan=json.load(open(PLAN)); cat={e['clip']:e for e in json.load(open(f"{TRIP}/_catalog.json"))}
tmp=tempfile.mkdtemp(); print("tmp",tmp,flush=True)
_RW,_RH=CFG.get("resolution",[1920,1080]); _FPS=CFG.get("fps",25)
VF=f"scale={_RW}:{_RH}:force_original_aspect_ratio=decrease,pad={_RW}:{_RH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={_FPS},format=yuv420p"
def dim_filter(ev):
    """Per-shot exposure fix. ev<0 tames an overexposed/blown shot: pull highlights down + darken."""
    b=round(ev*0.5,3); top=round(max(0.6,1+ev*1.2),3); mid=round(0.75*(1+ev*0.5),3); sat=round(1-ev*0.3,3)
    return f"curves=all='0/0 0.75/{mid} 1/{top}',eq=brightness={b}:saturation={sat}"
SUB_EN=CFG.get("captions",{}).get("overrides",{})
def P(c): return f"{MEDIA}/{cat[c]['library_path']}"
def dur(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout or 0)
def hasA(f): return subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip()!=''
def run(c): subprocess.run(c,stdin=subprocess.DEVNULL,check=False)
def snap_sentence(clip,seg_in,seg_out):
    sc=json.load(open(f"{META}/sidecars/{clip}.json")); W=[w for s in sc['segments'] for w in s['words']]
    if not W: return max(0,seg_in-0.1),seg_out+0.4
    inside=[w for w in W if w['e']>seg_in-0.3 and w['s']<seg_out+0.3]
    if not inside: return max(0,seg_in-0.1),seg_out+0.4
    i0=W.index(inside[0]); i1=W.index(inside[-1]); END=('.','!','?','…','."','?"')
    j=i0; st=0
    while j>0 and st<5 and not W[j-1]['w'].rstrip().endswith(END): j-=1; st+=1
    i0=j; j=i1; st=0
    while j<len(W)-1 and st<8 and not W[j]['w'].rstrip().endswith(END): j+=1; st+=1
    i1=j
    return max(0.0,W[i0]['s']-0.15), min(W[i1]['e']+0.5, seg_out+5.0)

import re as _re
def match_span(clip, text, hint):
    """Locate the EXACT clean words of `text` in the clip's transcript -> tight (in,out),
    so surrounding false-starts/retakes are excluded."""
    sc=json.load(open(f"{META}/sidecars/{clip}.json")); W=[w for s in sc['segments'] for w in s['words']]
    if not W: return None
    def nz(s): return _re.sub(r'[^a-z0-9]','',s.lower())
    Wn=[nz(w['w']) for w in W]; toks=[nz(t) for t in text.split() if nz(t)]
    if not toks: return None
    L=len(toks); hi=hint if hint is not None else 0.0; best_i=0; best=-1e9
    for i in range(0, max(1,len(W)-L+1)):
        m=sum(1 for a,b in zip(Wn[i:i+L],toks) if a==b)
        score=m-abs(W[i]['s']-hi)*0.02
        if score>best: best=score; best_i=i
    i=best_i; j=min(len(W)-1, i+L-1)
    # LEAD: ALWAYS drop the previous word's tail (start at/after prev-word end), but keep a
    # hair of lead so the first word's onset isn't clipped. Fixes "does..."/"people..." bleed.
    if i>0: a = min(W[i]['s']-0.005, max(W[i-1]['e']+0.01, W[i]['s']-0.10))
    else:   a = W[i]['s']-0.12
    # TAIL: keep the last word WHOLE including its release; only stop early if there's a real pause.
    if j<len(W)-1:
        gn=W[j+1]['s']-W[j]['e']
        b = min(W[j]['e']+0.55, W[j+1]['s']-0.03) if gn>=0.12 else (W[j+1]['s']+0.12)
    else:
        b=W[j]['e']+0.55
    b=max(b, W[j]['e']+0.30)                       # hard floor: never clip the last word / its decay
    return max(0.0,a), b

def _silences(wav, noise=-34, d=0.055):
    r=subprocess.run(['ffmpeg','-nostdin','-i',wav,'-af',f'silencedetect=noise={noise}dB:d={d}','-f','null','-'],capture_output=True,text=True).stderr
    reg=[]; cs=None
    for m in _re.finditer(r'silence_(start|end):\s*(-?[0-9.]+)',r):
        if m.group(1)=='start': cs=float(m.group(2))
        elif cs is not None: reg.append((max(0.0,cs),float(m.group(2)))); cs=None
    return reg

def snap_onset(clip, a):
    """WAVEFORM-snap the VO start. Whisper word-starts are unreliable (can be ~0.7s early),
    leaving a sub-word fragment of the PREVIOUS word + a pause before the real onset. Look at the
    actual source audio near `a` and start right after the last real pause that precedes sustained
    speech -> only the words we want, clean cut."""
    f=P(clip); w0=max(0.0, a-0.30); wl=1.20
    sw=f"{tmp}/snap_{round(a*1000)}.wav"
    run(['ffmpeg','-nostdin','-v','error','-ss',str(round(w0,3)),'-i',f,'-t',str(wl),'-vn','-ar','48000','-ac','1',sw,'-y'])
    reg=_silences(sw)
    # Walk pauses in order. Skip any pause that sits at/before `a` (the normal pre-sentence gap).
    # The FIRST pause after `a` that is preceded by only a SHORT speech blip (<0.28s) is a leading
    # sub-word fragment -> start right after it. If the first speech run is long, it's a real word: leave it.
    for (ss,se) in reg:
        ss_abs=w0+ss; se_abs=w0+se
        if se_abs <= a+0.05:                 # pause before the sentence -> not our fragment
            continue
        lead=ss_abs-a                        # speech length between a and this pause
        if (se-ss)>=0.10 and (wl-se)>=0.15 and lead<0.28:
            return round(se_abs-0.02,3)       # drop the fragment: begin after this pause
        break                                 # first real speech run reached -> keep `a`
    return a

def tighten_vo(clip, a, b, bi, protect=2.8):
    """Extract VO, then COMPRESS real silences (detected from audio) to a short beat — kills dead air
    even when Whisper baked a pause inside a word's duration."""
    f=P(clip); vo_wav=f"{tmp}/vo_{bi}.wav"; raw=f"{tmp}/vraw_{bi}.wav"
    run(['ffmpeg','-nostdin','-v','error','-ss',str(round(a,3)),'-i',f,'-t',str(round(b-a,3)),'-vn','-ar','48000','-ac','2',raw,'-y'])
    D=dur(raw); KEEP=0.16
    # detect silence regions from the actual audio
    r=subprocess.run(['ffmpeg','-nostdin','-i',raw,'-af','silencedetect=noise=-32dB:d=0.35','-f','null','-'],capture_output=True,text=True)
    log=r.stderr; sil=[]; cs=None
    for m in _re.finditer(r'silence_(start|end):\s*([0-9.]+)',log):
        if m.group(1)=='start': cs=float(m.group(2))
        elif cs is not None: sil.append((cs,float(m.group(2)))); cs=None
    if not sil:  # nothing to compress
        run(['ffmpeg','-nostdin','-v','error','-i',raw,'-af','highpass=f=70,loudnorm=I=-16:TP=-1.5',vo_wav,'-y']); return vo_wav,dur(vo_wav),a
    # build pieces: speech spans kept full; each silence capped to KEEP
    parts=[]; t=0.0; idx=0
    def add(s,e):
        nonlocal idx
        L=round(e-s,3)
        if L<0.02: return
        fd=round(min(0.008, L/3),4)                    # micro-fade each piece to zero at both ends -> no click on splice
        af=f"afade=t=in:st=0:d={fd},afade=t=out:st={round(L-fd,3)}:d={fd}"
        pw=f"{tmp}/vp_{bi}_{idx}.wav"; run(['ffmpeg','-nostdin','-v','error','-ss',str(round(s,3)),'-i',raw,'-t',str(L),'-af',af,pw,'-y']); parts.append(pw); idx+=1
    for (ss,se) in sil:
        tk=min(0.12,(se-ss)*0.5)         # KEEP the word's decay: silencedetect fires on soft releases,
        add(t, ss+tk)                    # so treat the first ~120ms of each "silence" as speech tail
        ps=ss+tk
        if ps < protect:                 # while his FACE is on screen -> keep pause natural (lip-sync)
            add(ps, se)
        else:
            add(ps, ps+min(KEEP, se-ps)) # pause over b-roll -> compress to a short beat
        t=se
    add(t, D)
    open(f"{tmp}/vpl_{bi}.txt","w").write("\n".join(f"file '{x}'" for x in parts))
    run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',f"{tmp}/vpl_{bi}.txt",f"{tmp}/vcat_{bi}.wav",'-y'])
    run(['ffmpeg','-nostdin','-v','error','-i',f"{tmp}/vcat_{bi}.wav",'-af','highpass=f=70,loudnorm=I=-16:TP=-1.5',vo_wav,'-y'])
    return vo_wav, dur(vo_wav), a

beat_videos=[]; beat_ambs=[]; beat_durs=[]; vo_infos=[]
EXP={s['clip']:float(s['exposure']) for b in plan['beats'] for s in b['shots'] if s.get('exposure') is not None}  # per-shot exposure fixes
for bi,beat in enumerate(plan['beats']):
    vo=beat.get('vo'); shots=beat['shots']; vo_wav=None; vo_dur=0.0; vo_in=None
    if vo and vo.get('prebuilt_wav'):
        # pre-spliced VO (e.g. word-swap they->we); play over b-roll only, no face/lip-sync
        vo_wav=vo['prebuilt_wav']; vo_dur=round(dur(vo_wav),3); vo_in=None
    elif vo:
        ms=match_span(vo['clip'], vo.get('text',''), vo.get('seg_in')) if vo.get('text') else None
        a,b = ms if ms else snap_sentence(vo['clip'],vo['seg_in'],vo['seg_out'])
        if ms: a=snap_onset(vo['clip'], a)          # waveform-clean the start (drop sub-word fragment)
        a += float(vo.get('lead_extra',0.0))        # manual nudge: start later (drop a leading word)
        if vo.get('tail_at') is not None: b=min(b, float(vo['tail_at']))   # hard-cut the end (drop a trailing word)
        b=min(b,dur(P(vo['clip'])))
        # protect the on-face window from pause-compression so lips stay synced
        fs=shots[0] if shots and shots[0].get('kind')=='face' else None
        def _fl(s): return float(s.get('hold', min(2.6,max(1.8,float(s['out'])-float(s['in'])))))
        protect=(_fl(fs)+0.3) if fs else 2.8
        vo_wav,vo_dur,vo_in=tighten_vo(vo['clip'],a,b,bi,protect); vo_dur=round(vo_dur,3)
    # --- coverage-aware shots: FILL the VO with REAL footage (extend into source clips), never freeze ---
    specs=[]  # (clip, ain, aout, kind)
    face_shot = shots[0] if (vo and shots and shots[0].get('kind')=='face' and shots[0]['clip']==vo['clip'] and vo_in is not None) else None
    brolls = shots[1:] if face_shot else shots
    if face_shot:
        fl=float(face_shot.get('hold', min(2.6,max(1.8,float(face_shot['out'])-float(face_shot['in'])))))
        specs.append((face_shot['clip'], vo_in, vo_in+fl, 'face'))
    if vo:
        target=vo_dur+0.30
        used=(specs[0][2]-specs[0][1]) if specs else 0.0
        remaining=max(0.0, target-used); n=len(brolls)
        if n>0:
            CAP=4.2                               # never let ONE b-roll run longer than this (anti-monotony)
            base=min(CAP, remaining/n); deficit=0.0
            for s in brolls:
                D=dur(P(s['clip'])); ai=float(s['in'])
                if ai<0.8: ai=0.8
                if ai > D-0.7: ai=max(0.3, D-3.0)   # guard: in-point at/past clip end -> pull back into real footage
                want=min(CAP, base+deficit); avail=max(0.6, D-ai-0.05); take=min(want,avail); deficit=max(0.0,(base)-take)
                specs.append((s['clip'], ai, ai+take, 'broll'))
            gi=len(specs)-1                       # soak leftover into shots with source headroom (still capped)
            while deficit>0.15 and gi>0:
                clip,ai,ao,k=specs[gi]
                if k=='broll':
                    room=min(max(0.0, dur(P(clip))-ao-0.05), max(0.0, CAP-(ao-ai)))
                    add=min(room,deficit); specs[gi]=(clip,ai,ao+add,k); deficit-=add
                gi-=1
            if deficit>0.2:                       # short on footage -> fill from the clip with the MOST
                # source headroom (real footage beats a freeze-frame), even if it exceeds CAP a little
                order=sorted([g for g in range(len(specs)) if specs[g][3]=='broll'],
                             key=lambda g: dur(P(specs[g][0]))-specs[g][2], reverse=True)
                for gi in order:
                    clip,ai,ao,k=specs[gi]
                    add=min(max(0.0, dur(P(clip))-ao-0.05), deficit); specs[gi]=(clip,ai,ao+add,k); deficit-=add
                    if deficit<=0.2: break
    else:
        for s in brolls:
            D=dur(P(s['clip'])); ai=float(s['in']); ao=float(s['out'])
            if ai<0.8: sh=0.8-ai; ai+=sh; ao+=sh
            specs.append((s['clip'], ai, min(D,ao), 'broll'))
    vlist=[]; alist=[]
    for si,(clip,ai,ao,k) in enumerate(specs):
        f=P(clip); L=round(max(0.6,ao-ai),3); v=f"{tmp}/v_{bi}_{si}.mp4"
        vfx=VF+(','+dim_filter(EXP[clip]) if clip in EXP else '')   # per-shot exposure fix for blown clips
        run(['ffmpeg','-nostdin','-v','error','-ss',str(round(ai,3)),'-i',f,'-t',str(L),'-an','-vf',vfx,'-c:v','libx264','-crf','19','-preset','veryfast',v,'-y']); vlist.append(v)
        aw=f"{tmp}/a_{bi}_{si}.wav"; amb_ok=(k!='face' and hasA(f) and not cat[clip].get('has_speech'))
        if amb_ok:
            afd=round(min(0.03, L/3),4)   # fade ambient at shot edges -> smooth, no click between nature shots
            run(['ffmpeg','-nostdin','-v','error','-ss',str(round(ai,3)),'-i',f,'-t',str(L),'-vn','-ar','48000','-ac','2','-af',f'volume=0.6,afade=t=in:st=0:d={afd},afade=t=out:st={round(L-afd,3)}:d={afd}',aw,'-y'])
        else: run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-t',str(L),'-i','anullsrc=r=48000:cl=stereo',aw,'-y'])
        alist.append(aw)
    bv=f"{tmp}/beat_v_{bi}.mp4"; ba=f"{tmp}/beat_a_{bi}.wav"
    open(f"{tmp}/vl_{bi}.txt","w").write("\n".join(f"file '{x}'" for x in vlist)); run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',f"{tmp}/vl_{bi}.txt",'-c','copy',bv,'-y'])
    open(f"{tmp}/al_{bi}.txt","w").write("\n".join(f"file '{x}'" for x in alist)); run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',f"{tmp}/al_{bi}.txt",'-c','copy',ba,'-y'])
    S=dur(bv)
    if vo and S < vo_dur+0.15:                    # last-resort micro-hold, capped at 0.8s (no more long freezes)
        pad=min(round(vo_dur+0.15-S,3),0.8); bv2=f"{tmp}/beat_vp_{bi}.mp4"; ba2=f"{tmp}/beat_ap_{bi}.wav"
        run(['ffmpeg','-nostdin','-v','error','-i',bv,'-vf',f'tpad=stop_mode=clone:stop_duration={pad}','-c:v','libx264','-crf','19','-preset','veryfast',bv2,'-y'])
        run(['ffmpeg','-nostdin','-v','error','-i',ba,'-af',f'apad=pad_dur={pad}',ba2,'-y']); bv,ba=bv2,ba2; S=dur(bv)
    beat_videos.append(bv); beat_ambs.append(ba); beat_durs.append(S)
    if vo: vo_infos.append((bi,vo_wav,vo_dur))
    print(f"beat {bi} [{beat['section']}] dur={S:.1f}s vo={'y' if vo else '-'}({vo_dur:.1f}s)",flush=True)

# ============ END SCREEN: behind-the-scenes laughing clip + credits ============
CFG_ES=CFG.get("end_screen")
ES_START=round(sum(beat_durs),3)
if CFG_ES:
  ES_CLIP=CFG_ES["clip"]; ES_IN=float(CFG_ES.get("in",0)); ES_DUR=float(CFG_ES.get("dur",6.0))
  esf=P(ES_CLIP); esv=f"{tmp}/es_v.mp4"; esa=f"{tmp}/es_a.wav"
  run(['ffmpeg','-nostdin','-v','error','-ss',str(ES_IN),'-i',esf,'-t',str(ES_DUR),'-an','-vf',VF,'-c:v','libx264','-crf','18','-preset','medium',esv,'-y'])
  if hasA(esf):
    run(['ffmpeg','-nostdin','-v','error','-ss',str(ES_IN),'-i',esf,'-t',str(ES_DUR),'-vn','-ar','48000','-ac','2','-af',f'volume=0.7,afade=t=in:st=0:d=0.3,afade=t=out:st={ES_DUR-1.8}:d=1.8',esa,'-y'])
  else:
    run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-t',str(ES_DUR),'-i','anullsrc=r=48000:cl=stereo',esa,'-y'])
  beat_videos.append(esv); beat_ambs.append(esa); beat_durs.append(dur(esv))
  print(f"end screen dur={dur(esv):.1f}s @ {ES_START:.1f}s",flush=True)

T=round(sum(beat_durs),3); print("TOTAL",T,flush=True)
offs=[round(sum(beat_durs[:i]),3) for i in range(len(beat_durs))]
open(f"{tmp}/bv.txt","w").write("\n".join(f"file '{x}'" for x in beat_videos)); run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',f"{tmp}/bv.txt",'-c','copy',f"{tmp}/video_raw.mp4",'-y'])
open(f"{tmp}/ba.txt","w").write("\n".join(f"file '{x}'" for x in beat_ambs)); run(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',f"{tmp}/ba.txt",'-c','copy',f"{tmp}/ambient.wav",'-y'])
# color grade (custom Nordic cinematic — teal shadows, warm highlights, gentle film curve) + subtitles
_GRADES={"nordic":"curves=all='0/0.02 0.25/0.22 0.5/0.5 0.75/0.78 1/0.985',eq=contrast=1.06:saturation=1.13,colorbalance=rs=-0.05:bs=0.06:rm=0.02:bm=-0.02:rh=0.06:bh=-0.05","none":"null"}
GRADE=_GRADES.get(CFG.get("grade","nordic"), CFG.get("grade"))
# --- cinematic captions on EVERY VO line (phrase-paced, clean outline, transcription fixed) ---
def cap_clean(t):
    t=" "+t+" "
    for a,b in [(" plot "," Claude "),(" Plot "," Claude "),("Quake Dopamine","quick dopamine"),("quake dopamine","quick dopamine"),
                ("chat GPT","ChatGPT"),("Chat GPT","ChatGPT"),("chatGPT","ChatGPT"),("chat gpt","ChatGPT"),("ChatGPT","ChatGPT")]: t=t.replace(a,b)
    return t.strip()
def dt_esc(t): return t.replace('\\','').replace(':','\\:').replace("'","’").replace('%','\\%').replace('—','-')
def cap_wrap(t,width=44):
    words=t.split()
    if len(t)<=width or len(words)<2: return [t]        # keep on ONE line when it fits (no orphans)
    best=None                                            # else split into TWO BALANCED lines
    for k in range(1,len(words)):
        l1=" ".join(words[:k]); l2=" ".join(words[k:])
        diff=abs(len(l1)-len(l2))+ (200 if max(len(l1),len(l2))>width+6 else 0)
        if best is None or diff<best[0]: best=(diff,l1,l2)
    return [best[1],best[2]]
def cap_phrases(t):
    # break into readable ~7-word cards; prefer to break at punctuation, else chunk words.
    # (the VO transcript is mostly unpunctuated, so we CANNOT rely on sentence splits.)
    clauses=[c.strip() for c in _re.split(r'[,.;?!]+', t) if c.strip()]; out=[]
    for cl in clauses:
        w=cl.split()
        if len(w)<=8: out.append(cl)
        else:
            for i in range(0,len(w),7):
                chunk=w[i:i+7]
                if len(chunk)<=2 and out: out[-1]=out[-1]+" "+" ".join(chunk)   # don't leave a 1-2 word orphan
                else: out.append(" ".join(chunk))
    return out
vd_by_beat={bi:vd for bi,_w,vd in vo_infos}
wav_by_beat={bi:w for bi,w,_ in vo_infos}
# --- DOCUMENTARY caption style: DIN Condensed Bold, tall UPPERCASE ---
import shutil as _sh
FONT=f"{tmp}/cap_font.ttf"; _sh.copy("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf", FONT)
FS=56
def _wordtimes(wav):
    # transcribe the FINAL VO wav -> real per-word timings so captions sync to the actual speech
    try:
        import sys as _sys, os as _os
        _sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..'))
        from ls_platform import transcribe as _ls_transcribe   # cross-OS: mlx on Apple Silicon, faster-whisper elsewhere
        r=_ls_transcribe(wav, word_timestamps=True)
        return [(w['start'],w['end']) for seg in r.get('segments',[]) for w in seg.get('words',[])]
    except Exception: return []
vf=GRADE
for bi,beat in enumerate(plan['beats']):
    vo=beat.get('vo')
    if not vo: continue
    phs=cap_phrases(cap_clean(vo['text']))
    if not phs: continue
    vd=vd_by_beat.get(bi, beat_durs[bi]); base=offs[bi]
    wt=_wordtimes(wav_by_beat.get(bi)) if wav_by_beat.get(bi) else []
    wcs=[max(1,len(p.split())) for p in phs]
    # build each card's [start,end]: from REAL word timings when available, else linear-by-wordcount
    spans=[]; ok = wt and abs(len(wt)-sum(wcs))<=max(3,sum(wcs)//5)
    if ok:
        idx=0
        for wcnt in wcs:
            j0=min(idx,len(wt)-1); j1=min(idx+wcnt-1,len(wt)-1)
            spans.append((base+wt[j0][0], base+wt[j1][1])); idx+=wcnt
    else:
        t0=base+0.12; t1=base+max(1.0,vd)-0.02; tot=sum(wcs); st=t0
        for wcnt in wcs: en=st+(t1-t0)*wcnt/tot; spans.append((st,en)); st=en
    for pi,ph in enumerate(phs):
        st,en=spans[pi]; wl=cap_wrap(ph.upper(), width=30)
        for li,line in enumerate(wl):
            y=f"h-{162+(len(wl)-1-li)*64}"
            vf+=(f",drawtext=fontfile='{FONT}':text='{dt_esc(line)}':fontcolor=white:fontsize={FS}:"
                 f"borderw=3:bordercolor=black@0.85:shadowcolor=black@0.55:shadowx=0:shadowy=2:"
                 f"x=(w-tw)/2:y={y}:enable='between(t,{st:.2f},{en:.2f})'")
# --- end-screen credits over the BTS laughing clip (dark overlay + fading credit stack) ---
_CREDITS=(CFG_ES or {}).get("credits") or []
if CFG_ES and _CREDITS:
  _e0=ES_START; _e1=ES_START+ES_DUR; _enab=f"between(t,{_e0:.2f},{_e1:.2f})"
  vf+=f",drawbox=x=0:y=0:w=iw:h=ih:color=black@0.5:t=fill:enable='{_enab}'"
  _fade=f"if(lt(t,{_e0+0.4}),0,min(1,(t-{_e0+0.4})/0.9))"
  _layout=[(-235,66)]+[(-70+105*i,52) for i in range(len(_CREDITS)-1)]
  for _txt,(_yoff,_fsz) in zip(_CREDITS,_layout):
    _yy=f"(h/2){'+' if _yoff>=0 else '-'}{abs(_yoff)}"
    vf+=(f",drawtext=fontfile='{FONT}':text='{_txt}':fontcolor=white:fontsize={_fsz}:borderw=2:bordercolor=black@0.7:"
         f"x=(w-tw)/2:y={_yy}:alpha='{_fade}':enable='{_enab}'")

run(['ffmpeg','-nostdin','-v','error','-i',f"{tmp}/video_raw.mp4",'-vf',vf,'-c:v','libx264','-crf','18','-preset','medium',f"{tmp}/video.mp4",'-y'])
# VO track
inp=[]; fl=[]
for k,(bi,wav,vd) in enumerate(vo_infos):
    off=int(offs[bi]*1000); inp+=['-i',wav]; fl.append(f"[{k}]adelay={off}|{off}[d{k}]")
fl.append("".join(f"[d{k}]" for k in range(len(vo_infos)))+f"amix=inputs={len(vo_infos)}:normalize=0[m]"); fl.append(f"[m]apad=whole_dur={T},atrim=0:{T}[vo]")
run(['ffmpeg','-nostdin','-v','error',*inp,'-filter_complex',";".join(fl),'-map','[vo]',f"{tmp}/vo_full.wav",'-y'])
# music single cue Canon in D
_M=CFG.get("music")
if _M and _M.get("file"):
    run(['ffmpeg','-nostdin','-v','error','-ss',str(_M.get("start",0)),'-i',os.path.expanduser(_M["file"]),'-t',str(T),'-ar','48000','-ac','2','-af',f"afade=t=in:st=0:d={_M.get('fade_in',2)},afade=t=out:st={T-float(_M.get('fade_out',5))}:d={_M.get('fade_out',5)},atrim=0:{T}",f"{tmp}/music.wav",'-y'])
else:  # no music bed configured -> silence keeps the mix graph identical
    run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-t',str(T),'-i','anullsrc=r=48000:cl=stereo',f"{tmp}/music.wav",'-y'])
mixf=("[1]volume=0.20[amb];[2]volume=0.20[mus];[amb][mus]amix=inputs=2:normalize=0[bed];"
      "[bed][0]sidechaincompress=threshold=0.04:ratio=4:attack=20:release=650[bd];"
      "[0]volume=1.0[vo];[vo][bd]amix=inputs=2:normalize=0[mx];[mx]loudnorm=I=-14:TP=-1.0[out]")
run(['ffmpeg','-nostdin','-v','error','-i',f"{tmp}/vo_full.wav",'-i',f"{tmp}/ambient.wav",'-i',f"{tmp}/music.wav",'-filter_complex',mixf,'-map','[out]',f"{tmp}/final_audio.wav",'-y'])
final=f"{OUT}/{NAME}.mp4"
run(['ffmpeg','-nostdin','-v','error','-i',f"{tmp}/video.mp4",'-i',f"{tmp}/final_audio.wav",'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-shortest',final,'-y'])
# optional second copy (config backup_dir) so a local cleanup can't eat it
_BK=CFG.get("backup_dir")
drive_out=os.path.expanduser(_BK) if _BK else None
if drive_out: os.makedirs(drive_out,exist_ok=True)
if drive_out: run(['cp',final,f"{drive_out}/{NAME}.mp4"])
print("DONE",round(dur(final),1),"->",final,(f"+ backup {drive_out}" if drive_out else ""),flush=True)
