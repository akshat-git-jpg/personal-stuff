"""Audio primitives shared across steps (ffmpeg/ffprobe wrappers). No step-specific logic."""
import subprocess, pathlib


def dur(p):
    """Duration of an audio file in seconds (0.0 if ffprobe can't read it)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def mmss(s):
    """Seconds -> M:SS (or H:MM:SS-ish via total minutes)."""
    s = max(0.0, float(s))
    return f"{int(s)//60}:{int(s)%60:02d}"


def to_mp3(src, dst_dir="/tmp", suffix=".mp3"):
    """Downsample any audio/video to 16 kHz mono mp3 (smaller upload, same words). Returns path."""
    dst = pathlib.Path(dst_dir) / (pathlib.Path(src).stem + suffix)
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000",
                    "-b:a", "64k", str(dst)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def concat(wav_paths, out_path):
    """Loss-lessly concatenate wavs in the given order (ffmpeg concat demuxer, -c copy)."""
    wav_paths = list(wav_paths)
    if not wav_paths:
        raise SystemExit("✖ nothing to concatenate")
    lst = pathlib.Path(out_path).with_suffix(".concat.txt")
    lst.write_text("\n".join(f"file '{pathlib.Path(w).resolve()}'" for w in wav_paths))
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c", "copy", str(out_path)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    lst.unlink(missing_ok=True)
    return len(wav_paths)
