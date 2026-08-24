#!/usr/bin/env python3
"""Loop Studio — THE talking-head cutter (the ONLY approved method).

Validated 2026-07-15 head-to-head vs mlx-native / Fish / naive auto-collapse: this is
the exact method that produced a perfect cut (250s of retake-heavy raw -> 50s, ZERO
leftover retakes, every sentence complete). Read METHOD.md before using.

The recipe = precise word timestamps (Whisper literal + MMS_FA forced alignment)
             + LLM TAKE-SELECTION (you, Claude, pick the ONE clean take per line)
             + gap-snapped concat cut
             + verify (re-transcribe, fail on any repeat).

The transcription model is interchangeable; the TAKE-SELECTION step is what makes it
Descript-grade. Default transcription is LOCAL (no API key, private, free) via
ls_platform — mlx-whisper on Apple Silicon, faster-whisper elsewhere.

Subcommands:
  prep   RAW WORKDIR              extract audio, transcribe (literal) + forced-align,
                                  write WORKDIR/words.json, and PRINT the pause-grouped
                                  transcript for you to select takes from.
  render RAW KEEPERS OUT.mp4      concat-cut the chosen takes (hard cuts inside the gaps).
  verify OUT.mp4                  re-transcribe the output; FAIL on any repeated phrase.

Between prep and render, YOU author WORKDIR/keepers.json per METHOD.md's take-selection rules.
"""
import json, os, re, subprocess, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)          # for ls_platform
import ls_platform


def _sh(*a):
    subprocess.run(a, check=True)


def prep(raw, workdir):
    os.makedirs(workdir, exist_ok=True)
    wav = f"{workdir}/audio16k.wav"
    _sh("ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", wav)
    # literal transcription (exposes disfluencies so you don't pick a flawed take)
    r = ls_platform.transcribe(wav, word_timestamps=True)
    lit = [{"word": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3)}
           for seg in r["segments"] for w in seg.get("words", []) if w["word"].strip()]
    json.dump(lit, open(f"{workdir}/words_lit.json", "w"), indent=0)
    # forced alignment -> sample-accurate word boundaries (this is what makes cuts land in the gap)
    _sh(sys.executable, f"{HERE}/align.py", wav, f"{workdir}/words_lit.json", f"{workdir}/words.json", "0")
    words = json.load(open(f"{workdir}/words.json"))
    # print pause-grouped transcript for take-selection
    print(f"\n# {len(words)} words. Group boundaries at gaps > 0.45s. Pick the ONE clean take per line.\n")
    prev = None; line = []
    for x in words:
        g = x["start"] - prev if prev is not None else 0
        if g > 0.45 and line:
            print(f"{line[0][0]:7.2f}-{line[-1][1]:7.2f} | " + " ".join(t[2] for t in line))
            line = []
        line.append((x["start"], x["end"], x["word"])); prev = x["end"]
    if line:
        print(f"{line[0][0]:7.2f}-{line[-1][1]:7.2f} | " + " ".join(t[2] for t in line))
    print(f"\n# Now write {workdir}/keepers.json : [{{'cs','ce','label'}}] (chronological). See METHOD.md.")


def _refine_edges(raw, ks, lead=0.05, tail=0.13):
    """Snap each keeper's cut points to the ACTUAL waveform. whisper word times
    drift ~0.5s from the audio, so trimming at word.start-pad leaves LEADING SILENCE
    (the next line "starts too late") and word.end+pad CLIPS the release ("cut off
    too soon"). Fix per edge (2026-07-17 MKB-ads lesson):
      HEAD forward-only — if cs is in silence, move to the true onset (drop the lead
        silence); if cs is already in speech, LEAVE it (walking back would pull the
        previous word / a false-start in). cs = onset - lead.
      TAIL through the release — extend to the true end of the last word's release
        (stop at 0.08s of real silence), so no consonant/vowel tail is chopped. ce = end + tail.
    Result: uniform ~lead lead + ~tail tail at every seam. Set LS_NO_REFINE=1 to skip."""
    import wave, tempfile
    import numpy as np
    wav = tempfile.mktemp(suffix=".wav")
    _sh("ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", wav)
    wf = wave.open(wav, "rb"); sr = wf.getframerate()
    sig = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768.0
    HOP = 0.005; hp = int(HOP*sr); n = len(sig)//hp
    rms = np.sqrt(np.array([np.mean(sig[i*hp:(i+1)*hp]**2) for i in range(n)]) + 1e-9)
    peak = float(rms.max()); floor = float(np.percentile(rms, 12)); REL = max(floor*2.5, peak*0.015)
    TSIL = int(0.08/HOP)
    def fi(t): return max(0, min(n-1, int(t/HOP)))
    def sp(f): return rms[f] > REL
    def sust(f): return sp(f) and np.mean(rms[f:f+8] > REL) > 0.7
    def head(cs):
        c = fi(cs)
        if sp(c): return cs                              # already at the word -> leave
        f, lim = c, fi(cs+1.3)
        while f < lim and not sust(f): f += 1            # in silence -> forward to onset
        return f*HOP if f < lim else cs
    def toff(ce):
        c = fi(ce)
        if not sp(c):
            f, lim = c, fi(ce-0.9)
            while f > lim and not sp(f): f -= 1
            return f*HOP
        f, lim, last = c, fi(ce+0.6), c
        while f < lim:
            if sp(f): last = f; f += 1; continue
            run, g = 0, f
            while g < n and not sp(g) and run < TSIL: run += 1; g += 1
            if run >= TSIL: break
            f = g
        return last*HOP
    out = []
    for k in ks:
        cs = round(head(float(k["cs"])) - lead, 3); ce = round(toff(float(k["ce"])) + tail, 3)
        if ce <= cs + 0.15: ce = round(cs + 0.15, 3)
        out.append({**k, "cs": cs, "ce": ce})
    try: os.remove(wav)
    except OSError: pass
    return out


def render(raw, keepers, out):
    ks = json.load(open(keepers))
    if not os.environ.get("LS_NO_REFINE"):
        ks = _refine_edges(raw, ks)                      # snap edges to the waveform
    n = len(ks)
    p, vl, al = [], [], []
    for i, k in enumerate(ks):
        cs, ce = float(k["cs"]), float(k["ce"])
        p.append(f"[0:v]trim={cs:.3f}:{ce:.3f},setpts=PTS-STARTPTS,fps=25,setsar=1[v{i}]")
        p.append(f"[0:a]atrim={cs:.3f}:{ce:.3f},asetpts=PTS-STARTPTS,"
                 f"aformat=sample_rates=48000:channel_layouts=stereo[a{i}]")
        vl.append(f"[v{i}]"); al.append(f"[a{i}]")
    fg = ";".join(p) + ";" + "".join(vl[i] + al[i] for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]"
    _sh("ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-filter_complex", fg,
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nk=1:nw=1", out], capture_output=True, text=True).stdout.strip()
    print(f"wrote {out}  ({dur}s, {n} takes)")


def _wave_report(out):
    """WAVEFORM gate (R5/R8): leading dead air + inter-clip gaps from the RMS envelope — the
    signal the transcript CAN'T give you. A keeper opening on ASR-drift silence shows here as a
    lead >0.1s or a gap >0.45s -> wave_snap it (R2)."""
    import wave as _wv, tempfile
    import numpy as _np
    wav = tempfile.mktemp(suffix=".wav")
    _sh("ffmpeg", "-nostdin", "-v", "error", "-y", "-i", out, "-vn", "-ac", "1", "-ar", "16000", wav)
    wf = _wv.open(wav); sr = wf.getframerate()
    x = _np.frombuffer(wf.readframes(wf.getnframes()), _np.int16).astype(_np.float32) / 32768.0
    try: os.remove(wav)
    except OSError: pass
    HOP = int(0.02 * sr); env = _np.array([_np.sqrt(_np.mean(x[i*HOP:(i+1)*HOP]**2) + 1e-9) for i in range(len(x)//HOP)])
    peak = float(env.max()); thr = peak * 0.06; sp = env > thr
    segs = []; cur = None
    for i, s in enumerate(sp):
        if s and cur is None: cur = i
        if (not s) and cur is not None: segs.append([cur*0.02, i*0.02]); cur = None
    if cur is not None: segs.append([cur*0.02, len(sp)*0.02])
    segs = [s for s in segs if s[1]-s[0] > 0.05]
    if not segs: print("WAVEFORM: no speech detected?!"); return
    m = [segs[0]]
    for a, b in segs[1:]:
        if a - m[-1][1] < 0.12: m[-1][1] = b
        else: m.append([a, b])
    lead = m[0][0]; gaps = [round(m[i+1][0]-m[i][1], 2) for i in range(len(m)-1) if m[i+1][0]-m[i][1] > 0.45]
    print(f"WAVEFORM: lead={lead:.2f}s (want <0.10), gaps>0.45s: {gaps or 'none'}"
          + ("  FAIL" if (lead > 0.12 or gaps) else "  ok"))
    if lead > 0.12: print("   -> leading dead air: wave_snap the opening keeper / re-run finish.py (R2/R5).")
    if gaps: print("   -> inter-clip dead air: a keeper opens on ASR-drift silence -> wave_snap (R2).")


def verify(out):
    _wave_report(out)
    # WORD-LEVEL re-transcription. Plain-text transcription silently COLLAPSES a
    # repeated false-start ("Als ondernemer, als ondernemer" -> one), so the
    # 5-gram check alone MISSES leaked doublings and cannot see internal pauses.
    # (2026-07-17 MKB-ads lesson.) The hard gate is still repeated 5-grams; word
    # timings add a dead-air WARNING you must eyeball (a gap AT a take-seam is
    # fine/expected — a gap or stretched word INSIDE one spoken take is a halting
    # pause to fix). This still can't catch a false-start whisper collapses in the
    # OUTPUT too — the real defense is authoring keepers from a LITERAL prep
    # transcript of the ACTUAL audio, never a clean/de-duplicated one.
    r = ls_platform.transcribe(out, word_timestamps=True)
    t = re.sub(r"[^a-z ]", " ", r["text"].lower()); w = t.split()
    grams = [" ".join(w[i:i + 5]) for i in range(len(w) - 4)]
    reps = [(g, c) for g, c in collections.Counter(grams).items() if c > 1]
    if reps:
        print(f"FAIL — {len(reps)} repeated phrase(s) still in the cut (retakes leaked):")
        for g, c in reps[:5]:
            print(f"   x{c}: {g}")
        print("Fix your take-selection (you kept >1 attempt of a line) and re-render.")
        sys.exit(1)
    words = [x for seg in r.get("segments", []) for x in seg.get("words", []) if x.get("word", "").strip()]
    warns = []
    for i, x in enumerate(words):
        wl = x["word"].strip()
        if (x["end"] - x["start"]) > 1.35 and len(wl.strip(" .,?!")) < 12:
            warns.append(f"dead-air in '{wl}' ({x['end']-x['start']:.1f}s)")
        if i and (x["start"] - words[i-1]["end"]) > 0.6:
            warns.append(f"{x['start']-words[i-1]['end']:.1f}s gap before '{wl}'")
    if warns:
        print(f"CONTENT: no repeats, but {len(warns)} pause(s) to eyeball (seam-gaps are OK, interior pauses are not):")
        for m in warns[:8]:
            print(f"   ~ {m}")
        return
    print("CONTENT: clean — no repeated phrases, no long pauses. (Still do one listen for nuance.)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "prep":     prep(sys.argv[2], sys.argv[3])
    elif cmd == "render": render(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "verify": verify(sys.argv[2])
    else:
        print(__doc__); sys.exit(1)
