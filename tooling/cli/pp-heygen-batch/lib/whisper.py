#!/usr/bin/env python3
import sys
import json
import argparse
import os
import tempfile
import wave
import contextlib

def get_wav_duration(path):
    with contextlib.closing(wave.open(path, 'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        return frames / float(rate)

def transcribe_mlx(wav_path):
    import mlx_whisper
    # mlx_whisper produces a dict with "text" and "segments" if we ask for word timestamps.
    # Actually, word timestamps in mlx_whisper might require specific args.
    # Typically `mlx_whisper.transcribe(wav_path, word_timestamps=True)`
    res = mlx_whisper.transcribe(wav_path, path_or_hf_repo="mlx-community/whisper-large-v3-mlx", word_timestamps=True)
    words = []
    for segment in res.get("segments", []):
        for w in segment.get("words", []):
            words.append({
                "start": w["start"],
                "end": w["end"],
                "word": w["word"].strip()
            })
    return words

def transcribe_faster(wav_path):
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(wav_path, word_timestamps=True)
    words = []
    for segment in segments:
        for w in segment.words:
            words.append({
                "start": w.start,
                "end": w.end,
                "word": w.word.strip()
            })
    return words

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", help="Input wav path")
    parser.add_argument("out", help="Output json path")
    parser.add_argument("--engine", choices=["mlx", "faster"], help="Force engine")
    args = parser.parse_args()

    engine = args.engine
    if not engine:
        try:
            import mlx_whisper
            engine = "mlx"
        except ImportError:
            try:
                from faster_whisper import WhisperModel
                engine = "faster"
            except ImportError:
                print("Error: Neither mlx_whisper nor faster_whisper is installed.", file=sys.stderr)
                sys.exit(1)

    duration = get_wav_duration(args.wav)

    if engine == "mlx":
        words = transcribe_mlx(args.wav)
    else:
        words = transcribe_faster(args.wav)

    out_data = {
        "duration_sec": round(duration, 3),
        "words": words
    }

    fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(args.out) or ".", suffix=".json")
    with os.fdopen(fd, 'w') as f:
        json.dump(out_data, f, indent=2)
    os.rename(temp_path, args.out)

if __name__ == "__main__":
    main()
