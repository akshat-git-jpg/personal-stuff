"""Throwaway de-risk harness: Kling 2.5 Turbo Pro image-to-video (base motion clip).
Usage: python3 fal_kling.py <image> <out.mp4> [duration 5|10]
Reads FAL_KEY from infra/secrets/fal.env.
"""
import os, sys, json
import fal_client, httpx

ENV = "/Users/kbtg/codebase/personal-stuff/infra/secrets/fal.env"
for line in open(ENV):
    if line.startswith("FAL_KEY="):
        os.environ["FAL_KEY"] = line.strip().split("=", 1)[1]

image = sys.argv[1]
out = sys.argv[2]
duration = sys.argv[3] if len(sys.argv) > 3 else "5"
tail = sys.argv[4] if len(sys.argv) > 4 else None

print("uploading image...", file=sys.stderr)
image_url = fal_client.upload_file(image)
tail_url = fal_client.upload_file(tail) if tail else image_url
print("tail frame: %s" % ("separate variant" if tail else "same as first"), file=sys.stderr)

def cb(update):
    for l in getattr(update, "logs", None) or []:
        m = l.get("message") if isinstance(l, dict) else str(l)
        if m:
            print("  " + m, file=sys.stderr)

print("submitting kling image-to-video (%ss)..." % duration, file=sys.stderr)
result = fal_client.subscribe(
    "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    arguments={
        "image_url": image_url,
        "tail_image_url": tail_url,  # end frame = micro-shifted side pose -> bounded motion, no frontal drift
        "prompt": (
            "A woman looking at the screen in front of her, eyes level and focused. Subtle "
            "natural idle motion: gentle breathing, slow blinks, small head movements while she "
            "stays focused on the screen. She keeps her eyes at screen level, does not look down "
            "or lower her gaze, and does not turn to face the camera. Mouth closed, not speaking. "
            "Static locked-off camera, fixed framing."
        ),
        "negative_prompt": (
            "looking down, lowering gaze, downcast eyes, head tilted down, looking at lap, "
            "looking at phone, turning toward camera, facing camera, looking at camera, "
            "eye contact, frontal view, talking, mouth moving, open mouth, hands, arms, typing, "
            "keyboard, laptop, computer, monitor, desk, phone, large movement, fast motion, "
            "camera movement, zoom, pan, blur, distort, low quality, extra objects"
        ),
        "duration": duration,
        "cfg_scale": 0.65,
    },
    with_logs=True,
    on_queue_update=cb,
)
print(json.dumps(result, indent=2))
url = result["video"]["url"]
print("result url: " + url, file=sys.stderr)
try:
    r = httpx.get(url, timeout=300, follow_redirects=True); r.raise_for_status()
except Exception as e:
    print("secure download failed (%s); retrying insecure" % e, file=sys.stderr)
    r = httpx.get(url, timeout=300, follow_redirects=True, verify=False); r.raise_for_status()
open(out, "wb").write(r.content)
print("saved -> %s (%d bytes)" % (out, len(r.content)), file=sys.stderr)
