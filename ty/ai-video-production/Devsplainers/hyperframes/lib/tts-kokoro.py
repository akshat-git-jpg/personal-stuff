#!/usr/bin/env python3
"""tts-kokoro.py — step 040. Free, local, offline TTS (Kokoro), one clip per beat.

Run from the project root:
    python3 lib/tts-kokoro.py --video <slug> [--voice af_heart] [--lang a] [--speed 1.0]

Reads  videos/<slug>/tts-lines.md  — one beat per line: "NN. <text>"  (also NN) / NN:).
Writes videos/<slug>/audio/beatNN.wav  (24 kHz mono).

One-time setup (first run also downloads the ~350 MB model):
    pip install kokoro soundfile
Common voices: af_heart, af_bella (US female) · am_michael, am_adam (US male)
              · bm_george (UK male). Full list: https://github.com/hexgrad/kokoro
"""
import argparse, os, re, sys

SR = 24000

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default="test")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--lang", default="a", help="Kokoro lang_code: a=US-EN, b=UK-EN")
    ap.add_argument("--speed", type=float, default=1.0)
    args = ap.parse_args()

    root = os.getcwd()
    lines_path = os.path.join(root, "videos", args.video, "tts-lines.md")
    if not os.path.exists(lines_path):
        sys.exit(f"no tts-lines: videos/{args.video}/tts-lines.md (step 030 produces it)")

    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError:
        sys.exit("Kokoro not installed. Run:  pip install kokoro soundfile\n"
                 "(first synth also downloads the ~350 MB model, one time)")

    # parse "NN. text" beats, in order
    beats = []
    for raw in open(lines_path, encoding="utf-8"):
        m = re.match(r"^\s*(\d+)[.):]\s*(.+?)\s*$", raw)
        if m:
            beats.append((int(m.group(1)), m.group(2)))
    if not beats:
        sys.exit("no 'NN. text' beat lines found in tts-lines.md")

    out_dir = os.path.join(root, "videos", args.video, "audio")
    os.makedirs(out_dir, exist_ok=True)
    pipe = KPipeline(lang_code=args.lang)

    for n, text in beats:
        chunks = [audio for _, _, audio in pipe(text, voice=args.voice, speed=args.speed)]
        if not chunks:
            print(f"  ! beat{n:02d}: no audio produced, skipping"); continue
        wav = np.concatenate(chunks)
        path = os.path.join(out_dir, f"beat{n:02d}.wav")
        sf.write(path, wav, SR)
        print(f"  beat{n:02d}: {len(wav)/SR:.1f}s -> {os.path.relpath(path, root)}")
    print(f"synthesized {len(beats)} beat(s) with voice '{args.voice}' -> videos/{args.video}/audio/")

if __name__ == "__main__":
    main()
