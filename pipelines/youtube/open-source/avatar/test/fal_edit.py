"""Throwaway harness: nano-banana edit -> make a micro-shifted pose variant (tail frame).
Usage: python3 fal_edit.py <image> <num> <out-prefix>
"""
import os, sys, json
import fal_client, httpx

ENV = "/Users/kbtg/codebase/personal-stuff/infra/secrets/fal.env"
for line in open(ENV):
    if line.startswith("FAL_KEY="):
        os.environ["FAL_KEY"] = line.strip().split("=", 1)[1]

image, num, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]

PROMPT = (
    "Same woman, exact same person, identical framing, camera angle, lighting, "
    "hairstyle, freckles and plain white top. Change ONLY her head pose slightly: rotate "
    "her head a few degrees further toward profile (a bit further away from the camera), "
    "keeping her eyes at the SAME vertical level as the original and looking straight ahead "
    "toward her screen. Do NOT tilt her head down. Do NOT lower her gaze. Keep the same eye "
    "level. Mouth closed, calm neutral expression. No hands, no laptop, no desk, no extra "
    "objects. Photorealistic, unchanged background."
)

print("uploading image...", file=sys.stderr)
image_url = fal_client.upload_file(image)
print("submitting nano-banana edit (%d variants)..." % num, file=sys.stderr)
result = fal_client.subscribe(
    "fal-ai/nano-banana/edit",
    arguments={"prompt": PROMPT, "image_urls": [image_url], "num_images": num, "output_format": "png"},
    with_logs=False,
)
print(json.dumps({k: v for k, v in result.items() if k != "images"}, indent=2))
for i, img in enumerate(result.get("images", [])):
    url = img["url"]
    out = "%s-%d.png" % (prefix, i + 1)
    try:
        r = httpx.get(url, timeout=180, follow_redirects=True); r.raise_for_status()
    except Exception:
        r = httpx.get(url, timeout=180, follow_redirects=True, verify=False); r.raise_for_status()
    open(out, "wb").write(r.content)
    print("saved -> %s" % out, file=sys.stderr)
