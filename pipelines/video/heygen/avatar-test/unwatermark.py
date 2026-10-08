"""Find and remove the Gemini sparkle watermark from a picture.

usage: python unwatermark.py <in> <out>   (prints JSON: found, score, box, changed_px)

Finds the sparkle by template match in the bottom-right corner at any size, so
screenshots and resized images work too. Only the sparkle's own pixels are refilled
from the area around them; every other pixel is copied unchanged.
Needs: pip install opencv-python numpy
Masks in assets/ are the Gemini alpha captures from GeminiWatermarkTool (MIT).
"""
import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MASK = cv2.imread(os.path.join(HERE, "assets", "gemini-sparkle-96.png")).max(axis=2).astype(np.float32) / 255.0
THRESHOLD = 0.9  # the real sparkle scores ~0.99; clean pictures reached 0.77


def find(img):
    h, w = img.shape[:2]
    rx, ry = int(w * 0.75), int(h * 0.65)
    region = cv2.cvtColor(img[ry:, rx:], cv2.COLOR_BGR2GRAY).astype(np.float32)
    best = (-1.0, None)
    for size in range(20, min(161, region.shape[0], region.shape[1]), 2):
        tpl = cv2.resize(MASK, (size, size), interpolation=cv2.INTER_AREA)
        score = cv2.matchTemplate(region, tpl, cv2.TM_CCOEFF_NORMED)
        _, val, _, loc = cv2.minMaxLoc(score)
        if val > best[0]:
            best = (float(val), (rx + loc[0], ry + loc[1], size))
    return best


def main(src, dst):
    img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f"cannot read {src}")
    if img.ndim == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    score, box = find(img)
    found = score >= THRESHOLD
    out = img
    changed = 0
    if found:
        x, y, s = box
        tpl = cv2.resize(MASK, (s, s), interpolation=cv2.INTER_AREA)
        mask = np.zeros(img.shape[:2], np.uint8)
        mask[y:y + s, x:x + s] = (tpl > 0.05).astype(np.uint8) * 255
        mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
        out = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
        changed = int((mask > 0).sum())
    cv2.imwrite(dst, out)
    print(json.dumps({"found": found, "score": round(score, 3), "box": box if found else None, "changed_px": changed}))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
