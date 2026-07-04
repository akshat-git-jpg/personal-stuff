#!/usr/bin/env python3
"""Assemble per-chunk TTS wavs into one clean voiceover, then optionally mux into video.

Usage:
    assemble.py <chunks.json> <wav_dir> <out> [video_in] [--fit SECONDS]
      out .wav/.mp3  -> writes the voiceover track only (for review)
      out .mp4       -> also needs <video_in>; muxes the track in, replacing audio
      --fit SECONDS  -> proper sync: uniformly speed clips (pitch-preserving atempo) by the
                        smallest factor so the last word lands within SECONDS. With an .mp4
                        out and no explicit value, fits to the video's own duration.

Three principles applied:
  1) chunks (caller already merged segments -> fewer seams / stable pacing)
  2) per-clip hygiene: trim the leading onset artifact (~200ms breath) + trailing breath,
     with short fades, so every clip starts/ends clean (kills the "tsh")
  3) silence-absorbed placement: anchor each chunk at its original start time. We never
     stretch a clip to force-fit one slot; --fit applies one UNIFORM mild tempo so pacing
     stays even and pitch is unchanged, then re-anchors.

Needs: numpy, soundfile, ffmpeg/ffprobe.
"""
import sys, json, subprocess, tempfile, pathlib
import numpy as np
import soundfile as sf

THR = 0.02          # below this = breath/silence (onset artifact peaks ~0.019)
LEAD_KEEP = 0.010   # keep 10ms before speech onset
TAIL_KEEP = 0.060   # keep 60ms after last speech (natural decay), trims trailing breath
FADE_IN = 0.015
FADE_OUT = 0.020
MIN_GAP = 0.18      # floor: silence between chunks
MAX_GAP = 0.42      # ceiling: never leave more than this much dead air before a chunk
MAX_SPEED = 1.15    # cap the fit speed-up so it stays imperceptible

def ffprobe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else None

def atempo(clip, sr, factor):
    """Pitch-preserving tempo change via ffmpeg atempo. factor>1 = faster/shorter."""
    if abs(factor - 1.0) < 1e-3:
        return clip
    with tempfile.TemporaryDirectory() as td:
        src, dst = pathlib.Path(td) / "i.wav", pathlib.Path(td) / "o.wav"
        sf.write(str(src), clip, sr)
        subprocess.run(["ffmpeg", "-y", "-i", str(src), "-filter:a", f"atempo={factor:.5f}",
                        str(dst), "-loglevel", "error"], check=True)
        a, _ = sf.read(str(dst))
        return a.astype(np.float32)

def trim_clip(path):
    a, sr = sf.read(path)
    if a.ndim > 1:
        a = a.mean(axis=1)
    a = a.astype(np.float32)
    mask = np.abs(a) > THR
    if not mask.any():
        return a, sr
    onset = int(np.argmax(mask))
    last = len(a) - int(np.argmax(mask[::-1]))
    s = max(0, onset - int(LEAD_KEEP * sr))
    e = min(len(a), last + int(TAIL_KEEP * sr))
    clip = a[s:e].copy()
    # fades to avoid edge clicks
    fi, fo = int(FADE_IN * sr), int(FADE_OUT * sr)
    if fi and len(clip) > fi:
        clip[:fi] *= np.linspace(0, 1, fi)
    if fo and len(clip) > fo:
        clip[-fo:] *= np.linspace(1, 0, fo)
    return clip, sr

def place(items, sr, speed):
    """items=[(id, anchor, clip)]; sped clip length = len/speed. Returns (placed, end_of_last_word).

    Anchor each chunk to its original start, but normalize the silence before it to
    [MIN_GAP, MAX_GAP] so we never inherit an unnatural dead hole from the source timing.
    """
    placed, prev_end, last_end = [], None, 0.0
    for cid, anchor, clip in items:
        L = (len(clip) / sr) / speed
        if prev_end is None:
            at = max(anchor, 0.0)
        else:
            lo, hi = prev_end + MIN_GAP, prev_end + MAX_GAP
            at = min(max(anchor, lo), hi)   # clamp the gap into a natural range
        placed.append((cid, anchor, at, clip))
        prev_end = at + L
        last_end = prev_end
    return placed, last_end

def main():
    args = [a for a in sys.argv[1:]]
    fit = None
    if "--fit" in args:
        k = args.index("--fit")
        # optional numeric value after --fit
        if k + 1 < len(args) and not args[k + 1].endswith((".mp4", ".wav", ".mp3", ".json")):
            try:
                fit = float(args[k + 1]); args.pop(k + 1)
            except ValueError:
                fit = "video"
        else:
            fit = "video"
        args.pop(k)
    if len(args) < 3:
        print(__doc__); sys.exit(1)
    chunks_path, wav_dir, out = args[0], pathlib.Path(args[1]), args[2]
    video_in = args[3] if len(args) > 3 else None
    chunks = json.loads(pathlib.Path(chunks_path).read_text())

    # discover sr from first clip
    first = next((wav_dir / f"{c['id']}.wav" for c in chunks
                  if (wav_dir / f"{c['id']}.wav").exists()), None)
    if first is None:
        print("no wavs found"); sys.exit(1)
    sr = sf.info(str(first)).samplerate

    # trim every clip once (independent of speed)
    items = []
    for c in chunks:
        wp = wav_dir / f"{c['id']}.wav"
        if not wp.exists():
            continue
        clip, _ = trim_clip(str(wp))
        items.append((c["id"], float(c.get("start") or 0.0), clip))

    # --fit: find smallest uniform speed so the last word lands within target
    speed = 1.0
    if fit is not None:
        target = ffprobe_dur(video_in) if fit == "video" else float(fit)
        _, nat_end = place(items, sr, 1.0)
        if nat_end > target:
            lo, hi = 1.0, MAX_SPEED
            for _ in range(24):
                mid = (lo + hi) / 2
                _, end = place(items, sr, mid)
                if end <= target:
                    hi = mid
                else:
                    lo = mid
            speed = hi
            _, end = place(items, sr, speed)
            note = "" if end <= target + 0.05 else "  (hit MAX_SPEED cap; still long)"
            print(f"  fit: video {target:.1f}s, natural {nat_end:.1f}s -> speed {speed:.3f} "
                  f"=> ends {end:.1f}s{note}", flush=True)
        else:
            print(f"  fit: already within {target:.1f}s (natural {nat_end:.1f}s), no change", flush=True)

    # apply the chosen speed to the actual audio, then place
    items = [(cid, anchor, atempo(clip, sr, speed)) for cid, anchor, clip in items]
    placed, last_end = place(items, sr, 1.0)  # clips already sped; place at speed 1
    for cid, anchor, at, clip in placed:
        print(f"  {cid} anchor {anchor:6.2f}s -> placed {at:6.2f}s  ({len(clip)/sr:.1f}s)", flush=True)
    total = (placed[-1][2] + len(placed[-1][3]) / sr + MIN_GAP) if placed else 0.0
    canvas = np.zeros(int(total * sr) + sr, dtype=np.float32)
    for cid, anchor, at, clip in placed:
        i = int(round(at * sr)); j = min(i + len(clip), len(canvas))
        canvas[i:j] += clip[: j - i]
    canvas = canvas[: int(total * sr)]

    with tempfile.TemporaryDirectory() as td:
        track = str(pathlib.Path(td) / "track.wav")
        sf.write(track, canvas, sr)
        if out.lower().endswith((".wav", ".mp3")):
            if out.lower().endswith(".wav"):
                sf.write(out, canvas, sr)
            else:
                subprocess.run(["ffmpeg", "-y", "-i", track, "-b:a", "192k", out,
                                "-loglevel", "error"], check=True)
            print(f"DONE (voiceover only) -> {out}  [{total:.1f}s]")
        else:
            if not video_in:
                print("mp4 output needs <video_in>"); sys.exit(1)
            subprocess.run([
                "ffmpeg", "-y", "-i", video_in, "-i", track,
                "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
                "-b:a", "192k", "-shortest", out, "-loglevel", "error"], check=True)
            print(f"DONE (muxed) -> {out}")

if __name__ == "__main__":
    main()
