#!/usr/bin/env python3
"""
Step 050 — make timestamped transcript from the FINAL voiceover.  [RUN]

  python3 run.py [<voice.trim.wav>]         # default input: step 020's output

Re-transcribes the generated audio with Groq Whisper (word + segment timestamps) and writes
editor-ready artifacts mapped to the REAL audio, so an editor can scrub straight to any line:
  output/<base>.srt             subtitle file — drag into any NLE
  output/<base>.timestamps.txt  readable [mm:ss] lines, one per segment
  output/<base>.timestamps.json raw Groq segments + words (input to step 4-motion-graphics/010, plan-visuals)

Why ASR and not the known script: after the trim step the audio shifted, so only a fresh
transcription gives timestamps that line up with the actual file. Brand-name spelling may drift
— fine here, this is read for timing; the script stays the source of truth for wording.
"""
import sys, re, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import asr                                          # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = ROOT / "3-voiceover/020-trim-silence-run/output"


def die(m): raise SystemExit("✖ " + m)


def ts(sec, srt=False):
    sec = max(0.0, float(sec))
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    if srt:
        ms = int(round((sec - int(sec)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    return f"{m + h*60}:{s:02d}"


def write_srt(segments, out):
    lines = []
    for i, seg in enumerate(segments, 1):
        lines += [str(i), f"{ts(seg['start'], srt=True)} --> {ts(seg['end'], srt=True)}",
                  seg["text"].strip(), ""]
    out.write_text("\n".join(lines))


def write_txt(segments, out):
    out.write_text("\n".join(
        f"[{ts(s['start'])}–{ts(s['end'])}]  {s['text'].strip()}" for s in segments) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav", nargs="?", help="final voiceover (default: step 020's output)")
    a = ap.parse_args()

    wav = pathlib.Path(a.wav) if a.wav else next(iter(sorted(PREV.glob("*.trim.wav"))), None)
    if not wav or not wav.exists():
        die(f"no voiceover found (pass a path, or run step 020 first → {PREV})")
    OUT.mkdir(parents=True, exist_ok=True)
    base = re.sub(r"\.(voice|trim|wav)$", "", wav.stem)
    base = re.sub(r"\.voice$", "", base)

    print(f"→ transcribing {wav.name} with word+segment timestamps…")
    d = asr.groq_transcribe(wav, word_timestamps=True)
    segments = d.get("segments") or []
    if not segments:
        die("no segments came back from Groq — empty/garbled audio?")

    (OUT / f"{base}.timestamps.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
    write_srt(segments, OUT / f"{base}.srt")
    write_txt(segments, OUT / f"{base}.timestamps.txt")

    print(f"✓ {len(segments)} segments, {len(d.get('words') or [])} words, {ts(segments[-1]['end'])} total")
    print(f"  {OUT / f'{base}.srt'}\n  {OUT / f'{base}.timestamps.txt'}\n  {OUT / f'{base}.timestamps.json'}")
    print("→ next: step 4-motion-graphics/010 (plan-visuals) — Claude applies its rulebook to these timestamps")


if __name__ == "__main__":
    main()
