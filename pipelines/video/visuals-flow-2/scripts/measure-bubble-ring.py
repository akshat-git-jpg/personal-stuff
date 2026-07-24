#!/usr/bin/env python3
"""Measure the corner bubble's ring proportions off a rendered frame.

The bubble ring is two layers (see lib/effects/bubble.mjs): a thin constant
hairline plus a wider travelling bloom. What the eye reads is the WIDTH RATIO
between them — three separate tuning attempts failed because the ratio was
wrong while each layer looked individually plausible.

Closed-form gaussian FWHM overestimates what `gblur ... steps=2` actually
renders, so the constants cannot be derived on paper. Render, measure here,
adjust, repeat.

Reference targets, measured off a high-zoom still of vPqSgj8Ta3Y (circle
d=432px): hairline 1.16% of D, gleam 2.78% of D, ratio 2.40x.

Usage:
  python3 scripts/measure-bubble-ring.py FRAME.png --cx 1164 --cy 116 --r 100

cx/cy/r are the bubble centre and radius in the frame. For a 720p draft with
default constants that is cx = OX+R, cy = OY+R, r = R — print them with:
  node -e "import('./lib/effects/bubble.mjs').then(m=>console.log(m.bubbleGeometry(1280,720)))"
"""
import argparse
import math
import statistics
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow required: pip install pillow')

REF_HAIRLINE_PCT = 1.16
REF_GLEAM_PCT = 2.78
REF_RATIO = 2.40


def build(path, cx, cy, r):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()

    def luma_at(radius, angle):
        x = int(round(cx + radius * math.cos(math.radians(angle))))
        y = int(round(cy + radius * math.sin(math.radians(angle))))
        if 0 <= x < w and 0 <= y < h:
            R, G, B = px[x, y]
            return 0.299 * R + 0.587 * G + 0.114 * B
        return None

    return luma_at


def brightest_angle(luma_at, r):
    best = (-1.0, 0)
    for a in range(0, 360, 5):
        vals = [v for dr in (-3, -1, 0, 1, 3) if (v := luma_at(r + dr, a)) is not None]
        if vals and statistics.mean(vals) > best[0]:
            best = (statistics.mean(vals), a)
    return best[1]


def fwhm(luma_at, r, angles):
    """Full width at half maximum of the ring's radial luma profile, in px."""
    prof = {}
    for i in range(-48, 48):
        dr = i * 0.25
        vals = []
        for a in angles:
            for da in (-4, -2, 0, 2, 4):
                v = luma_at(r + dr, a + da)
                if v is not None:
                    vals.append(v)
        if vals:
            prof[dr] = statistics.mean(vals)
    if not prof:
        sys.exit('no samples — check cx/cy/r')
    peak = max(prof.values())
    base = statistics.median([prof[d] for d in prof if abs(d) > 8])
    half = (peak + base) / 2
    keys = sorted(prof)
    lo = next((d for d in keys if prof[d] >= half), None)
    hi = next((d for d in reversed(keys) if prof[d] >= half), None)
    return (hi - lo) if lo is not None and hi is not None else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('frame')
    ap.add_argument('--cx', type=int, required=True)
    ap.add_argument('--cy', type=int, required=True)
    ap.add_argument('--r', type=int, required=True)
    args = ap.parse_args()

    luma_at = build(args.frame, args.cx, args.cy, args.r)
    d = args.r * 2
    ga = brightest_angle(luma_at, args.r)

    gleam = fwhm(luma_at, args.r, [ga - 10, ga, ga + 10])
    hair = fwhm(luma_at, args.r, [ga + 150, ga + 180, ga + 210])
    if hair <= 0:
        sys.exit('could not measure the hairline')

    hp, gp, ratio = 100 * hair / d, 100 * gleam / d, gleam / hair
    print(f'gleam found at {ga}deg')
    print(f'OURS       hairline={hp:.2f}% of D   gleam={gp:.2f}% of D   ratio={ratio:.2f}x')
    print(f'REFERENCE  hairline={REF_HAIRLINE_PCT:.2f}% of D   gleam={REF_GLEAM_PCT:.2f}% of D   ratio={REF_RATIO:.2f}x')
    print()
    print(f'  hairline {hp / REF_HAIRLINE_PCT:.2f}x reference   '
          f'gleam {gp / REF_GLEAM_PCT:.2f}x reference   '
          f'ratio {ratio / REF_RATIO:.2f}x reference')
    if abs(ratio - REF_RATIO) > 0.4:
        print('\nWARNING: width ratio is off — this is the thing the eye reads.')


if __name__ == '__main__':
    main()
