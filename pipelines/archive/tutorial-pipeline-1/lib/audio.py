"""Audio primitives for tutorial-pipeline-1 (ffmpeg/ffprobe wrappers). dur()/mmss() mirror
tutorial-pipeline-2/lib/audio.py; extract_audio is new (that pipeline's audio starts as a TTS wav,
this one starts as a video file's audio track)."""
import subprocess, pathlib


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def mmss(s):
    s = max(0.0, float(s))
    return f"{int(s)//60}:{int(s)%60:02d}"


def extract_audio(video_path, dest, sr=16000):
    """Pull the audio track out of a video into a 16kHz mono wav. Returns dest."""
    subprocess.run(["ffmpeg", "-y", "-i", str(video_path), "-vn", "-ac", "1", "-ar", str(sr),
                    str(dest)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dest
