#!/usr/bin/env python3
"""
Free local Whisper test.
Usage:
    transcribe.py <video-url-or-local-file> [model]

- Downloads audio (if URL) via yt-dlp, extracts mono 16kHz wav via ffmpeg.
- Transcribes with faster-whisper (default large-v3) entirely locally — no API, $0.
- Writes timestamped transcript: sentence-level + word-level JSON.
"""
import sys, os, subprocess, json, tempfile, pathlib

def run(cmd):
    print("  $", " ".join(cmd))
    subprocess.run(cmd, check=True)

def get_audio(src, workdir):
    wav = os.path.join(workdir, "audio.wav")
    if src.startswith("http"):
        raw = os.path.join(workdir, "raw.m4a")
        run(["yt-dlp", "-f", "bestaudio", "-o", raw, src])
        run(["ffmpeg", "-y", "-i", raw, "-ac", "1", "-ar", "16000", wav,
             "-loglevel", "error"])
    else:
        run(["ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", "16000", wav,
             "-loglevel", "error"])
    return wav

def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:05.2f}"

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "large-v3"
    here = pathlib.Path(__file__).parent
    workdir = here / "work"
    workdir.mkdir(exist_ok=True)

    print(f"[1/3] getting audio from: {src}")
    wav = get_audio(src, str(workdir))

    # Prefer a local model folder (no HuggingFace) if it exists.
    local_model = here / "models" / model_name
    model_ref = str(local_model) if (local_model / "model.bin").exists() else model_name
    print(f"[2/3] loading whisper model from: {model_ref}")
    from faster_whisper import WhisperModel
    # int8 = the VPS production setting (2-core, no-GPU, no-swap friendly).
    # Mirrors exactly what the editor will get on the VPS. Tiny accuracy cost vs float32.
    # cpu_threads=2 mirrors the VPS's 2 vCPU so timing here ~ timing there.
    model = WhisperModel(model_ref, device="cpu", compute_type="int8", cpu_threads=2)

    print("[3/3] transcribing (word timestamps on)...")
    segments, info = model.transcribe(wav, word_timestamps=True, vad_filter=True)
    print(f"  detected language: {info.language} (p={info.language_probability:.2f})")

    seg_list, words = [], []
    txt_lines = []
    for seg in segments:
        seg_list.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
        txt_lines.append(f"[{fmt(seg.start)} -> {fmt(seg.end)}] {seg.text.strip()}")
        print(txt_lines[-1])
        if seg.words:
            for w in seg.words:
                words.append({"start": w.start, "end": w.end, "word": w.word})

    (here / "transcript.txt").write_text("\n".join(txt_lines), encoding="utf-8")
    (here / "transcript.json").write_text(
        json.dumps({"language": info.language, "segments": seg_list, "words": words},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    dur = seg_list[-1]["end"] if seg_list else 0
    print(f"\nDONE. {len(seg_list)} segments, {len(words)} words, ~{dur/60:.1f} min audio.")
    print("  transcript.txt  (readable, sentence timestamps)")
    print("  transcript.json (word-level timestamps for the sync pipeline)")

if __name__ == "__main__":
    main()
