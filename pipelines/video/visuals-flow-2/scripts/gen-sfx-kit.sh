#!/bin/bash
set -e
set -u

mkdir -p assets/sfx
mkdir -p assets/music

echo "Generating SFX kit..."

# tick.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=1800:duration=0.05" -af "afade=t=out:st=0.01:d=0.04,volume=0.35" -ar 48000 -ac 1 assets/sfx/tick.wav

# pop.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=520:duration=0.09" -af "asetrate=48000*1.4,aresample=48000,afade=t=out:st=0.03:d=0.06,volume=0.35" -ar 48000 -ac 1 assets/sfx/pop.wav

# thock.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=180:duration=0.12" -f lavfi -i "anoisesrc=d=0.03:c=pink:a=0.08" -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest,afade=t=out:st=0.02:d=0.1,volume=0.35[out]" -map "[out]" -ar 48000 -ac 1 assets/sfx/thock.wav

# whoosh-up.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anoisesrc=d=0.35:c=pink:a=0.25" -af "highpass=f=400,lowpass=f=6000,afade=t=in:d=0.15,afade=t=out:st=0.2:d=0.15,volume=0.35" -ar 48000 -ac 1 assets/sfx/whoosh-up.wav

# whoosh-down.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anoisesrc=d=0.35:c=pink:a=0.25" -af "highpass=f=400,lowpass=f=6000,afade=t=in:d=0.15,afade=t=out:st=0.2:d=0.15,areverse,volume=0.35" -ar 48000 -ac 1 assets/sfx/whoosh-down.wav

# riser.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=220:duration=0.8" -af "atempo=0.9,afade=t=in:d=0.6,volume=0.35" -ar 48000 -ac 1 assets/sfx/riser.wav

# success.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=660:duration=0.25" -f lavfi -i "sine=frequency=990:duration=0.25" -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest,afade=t=out:st=0.05:d=0.2,volume=0.25[out]" -map "[out]" -ar 48000 -ac 1 assets/sfx/success.wav

# blip.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=1200:duration=0.06" -af "afade=t=out:st=0.01:d=0.05,volume=0.35" -ar 48000 -ac 1 assets/sfx/blip.wav

# impact.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anoisesrc=d=0.15:c=brown:a=0.5" -af "lowpass=f=200,afade=t=out:st=0.03:d=0.12,volume=0.35" -ar 48000 -ac 1 assets/sfx/impact.wav

# swipe.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anoisesrc=d=0.2:c=white:a=0.15" -af "bandpass=f=2500:w=1200,afade=t=in:d=0.05,afade=t=out:st=0.1:d=0.1,volume=0.35" -ar 48000 -ac 1 assets/sfx/swipe.wav

# drone_low.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=55:duration=8" -af "volume=0.06,afade=t=in:d=0.5,afade=t=out:st=7.5:d=0.5" -ar 48000 -ac 1 assets/sfx/drone_low.wav

# tear.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "anoisesrc=d=0.18:c=white:a=0.3" -af "highpass=f=1000,afade=t=in:d=0.02,afade=t=out:st=0.05:d=0.13,volume=0.35" -ar 48000 -ac 1 assets/sfx/tear.wav

echo "Done."
