#!/usr/bin/env bash
# Makes the test videos scripts/e2e.mjs uploads, into .fixtures/ (gitignored). Needs ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .fixtures
F=.fixtures
enc=(-c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart -y -loglevel error)

# 60 s 720p at about 1.2 Mbps: about 10 MB, so several 5 MB parts with PART_MB=5.
[ -f $F/v1.mp4 ] || ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440 -t 60 \
  -b:v 1200k -maxrate 1300k -bufsize 2600k "${enc[@]}" $F/v1.mp4
[ -f $F/v2.mp4 ] || ffmpeg -f lavfi -i smptehdbars=size=1280x720:rate=30 -f lavfi -i sine=frequency=660 -t 20 \
  -b:v 800k "${enc[@]}" $F/v2.mp4
[ -f $F/v3.mp4 ] || ffmpeg -f lavfi -i mandelbrot=size=1280x720:rate=30 -f lavfi -i sine=frequency=880 -t 20 \
  -b:v 800k "${enc[@]}" $F/v3.mp4
# Refused: 1080p.
[ -f $F/big-1080.mp4 ] || ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine -t 5 \
  -b:v 1000k "${enc[@]}" $F/big-1080.mp4
# Refused: 720p but far over 12 MB a minute.
[ -f $F/fat.mp4 ] || ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=30,noise=alls=80:allf=t" -f lavfi -i sine -t 10 \
  -b:v 20M -minrate 20M -maxrate 20M -bufsize 20M "${enc[@]}" $F/fat.mp4
ls -la $F
