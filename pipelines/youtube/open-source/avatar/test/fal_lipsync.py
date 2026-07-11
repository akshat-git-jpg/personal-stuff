"""Throwaway de-risk harness: run fal LatentSync on a base video + audio.
Usage: python3 fal_lipsync.py <video> <audio> <out.mp4>
Reads FAL_KEY from infra/secrets/fal.env.
"""
import os, sys, json, urllib.request
import fal_client

ENV = "/Users/kbtg/codebase/personal-stuff/infra/secrets/fal.env"
for line in open(ENV):
    if line.startswith("FAL_KEY="):
        os.environ["FAL_KEY"] = line.strip().split("=", 1)[1]

video, audio, out = sys.argv[1], sys.argv[2], sys.argv[3]

print("uploading video...", file=sys.stderr)
video_url = fal_client.upload_file(video)
print("uploading audio...", file=sys.stderr)
audio_url = fal_client.upload_file(audio)

def cb(update):
    for l in getattr(update, "logs", None) or []:
        msg = l.get("message") if isinstance(l, dict) else str(l)
        if msg:
            print("  " + msg, file=sys.stderr)

print("submitting fal-ai/latentsync ...", file=sys.stderr)
result = fal_client.subscribe(
    "fal-ai/latentsync",
    arguments={"video_url": video_url, "audio_url": audio_url},
    with_logs=True,
    on_queue_update=cb,
)
print(json.dumps(result, indent=2))
url = result["video"]["url"]
print("result url: " + url, file=sys.stderr)
import httpx
try:
    r = httpx.get(url, timeout=180, follow_redirects=True)
    r.raise_for_status()
except Exception as e:
    print("secure download failed (%s); retrying insecure (local proxy cert)" % e, file=sys.stderr)
    r = httpx.get(url, timeout=180, follow_redirects=True, verify=False)
    r.raise_for_status()
open(out, "wb").write(r.content)
print("saved -> %s (%d bytes)" % (out, len(r.content)), file=sys.stderr)
