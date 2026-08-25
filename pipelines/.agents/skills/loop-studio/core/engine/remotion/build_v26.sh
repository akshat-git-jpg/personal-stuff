#!/bin/zsh
set -e
cd /Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion
TRACK="/Users/luukalleman/Downloads/ES_Melting Glass - Eden Avery.wav"
SRC=public/intros/businessbrain/secondbrain_720.mp4
V=/tmp/var
VFX="highpass=f=80,equalizer=f=250:t=q:w=1.4:g=-2,equalizer=f=3800:t=q:w=1.5:g=3,equalizer=f=11000:t=h:g=2.5,deesser=i=0.3,acompressor=threshold=-18dB:ratio=2.5:attack=12:release=160:makeup=1.2"

echo "=== ensure Act4 raw render (voice-only) ==="
[ -f out/Act4_v26.mp4 ] || SCALE=1 COMP=Act4 OUT=out/Act4_v26.mp4 node render-film.mjs

echo "=== continuous bed (sustained core) ==="
ffmpeg -y -i "$TRACK" -af "atrim=4:182,asetpts=PTS-STARTPTS" $V/core.wav -loglevel error
ffmpeg -y -i $V/core.wav -i $V/core.wav -i $V/core.wav -filter_complex \
  "[0][1]acrossfade=d=6[ab];[ab][2]acrossfade=d=6[abc];[abc]atrim=0:431.4,asetpts=PTS-STARTPTS[bed]" -map "[bed]" $V/bd.wav -loglevel error
ffmpeg -y -i $V/bd.wav -af "atrim=0:18.752,asetpts=PTS-STARTPTS,afade=t=in:d=1.5" $V/bd_in.wav -loglevel error
ffmpeg -y -i $V/bd.wav -af "atrim=18.752:141.909,asetpts=PTS-STARTPTS" $V/bd_a1.wav -loglevel error
ffmpeg -y -i $V/bd.wav -af "atrim=141.909:263.509,asetpts=PTS-STARTPTS" $V/bd_a2.wav -loglevel error
ffmpeg -y -i $V/bd.wav -af "atrim=263.509:377.599,asetpts=PTS-STARTPTS" $V/bd_a3.wav -loglevel error
ffmpeg -y -i $V/bd.wav -af "atrim=377.599:431.4,asetpts=PTS-STARTPTS,afade=t=out:st=51.5:d=2" $V/bd_a4.wav -loglevel error

ffmpeg -y -i "$SRC" -af "atrim=18.00:18.74,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=0.70:d=0.04,volume=0.82" -vn -ac 2 -ar 48000 $V/ans.wav -loglevel error

# mix: vid  bed  sfx  bedVolExpr  out   (music SWELLS via the volume expression)
mix () {
  ffmpeg -y -i "$1" -i "$2" -i "$3" -filter_complex \
    "[0:a]pan=stereo|c0=c1|c1=c1,${VFX},asplit=3[vb1][vb2][vb3];\
     [1:a]volume='$4':eval=frame[m];[m][vb1]sidechaincompress=threshold=0.035:ratio=11:attack=8:release=320[md];[md]volume=0.4[md2];\
     [2:a]volume=0.9[sx];[sx][vb2]sidechaincompress=threshold=0.3:ratio=1.5:attack=5:release=160[sd];\
     [vb3][md2][sd]amix=inputs=3:duration=first:normalize=0[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -video_track_timescale 90000 "$5" -loglevel error
}

echo "=== mix intro (voice + answer-it + swelled bed + sfx19) ==="
ffmpeg -y -i out/intro_v16_nm.mp4 -i $V/bd_in.wav -i out/sfx19_intro.wav -i $V/ans.wav -filter_complex \
  "[0:a]pan=stereo|c0=c1|c1=c1[iv];[3:a]pan=stereo|c0=c1|c1=c1,adelay=18000|18000[an];[iv][an]amix=inputs=2:duration=first:normalize=0,${VFX},asplit=3[vb1][vb2][vb3];\
   [1:a]volume='0.19+0.09*exp(-((t-12.9)/0.9)^2)':eval=frame[m];[m][vb1]sidechaincompress=threshold=0.035:ratio=11:attack=8:release=320[md];[md]volume=0.4[md2];\
   [2:a]volume=0.9[sx];[sx][vb2]sidechaincompress=threshold=0.3:ratio=1.5:attack=5:release=160[sd];\
   [vb3][md2][sd]amix=inputs=3:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -video_track_timescale 90000 out/intro_v26_final.mp4 -loglevel error

echo "=== mix acts (with swells) ==="
mix out/Act1_v20.mp4 $V/bd_a1.wav out/sfx19_act1.wav '0.19+0.09*exp(-((t-4.1)/0.9)^2)' out/Act1_v26_final.mp4
mix out/Act2_v26.mp4 $V/bd_a2.wav out/sfx19_act2.wav '0.19+0.08*exp(-((t-95.7)/1.0)^2)+0.08*exp(-((t-120.3)/0.9)^2)' out/Act2_v26_final.mp4
mix out/Act3_v26.mp4 $V/bd_a3.wav out/sfx19_act3.wav '0.19+0.09*exp(-((t-19.3)/0.9)^2)+0.09*exp(-((t-34.9)/1.0)^2)' out/Act3_v26_final.mp4
mix out/Act4_v26.mp4 $V/bd_a4.wav out/sfx19_act4.wav '0.19+0.10*exp(-((t-39.2)/1.0)^2)+0.09*exp(-((t-51.0)/0.9)^2)' out/Act4_v26_final.mp4

echo "=== stitch v20 + loudness master ==="
cat > $V/concat_v26.txt <<EOF
file '/Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion/out/intro_v26_final.mp4'
file '/Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion/out/Act1_v26_final.mp4'
file '/Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion/out/Act2_v26_final.mp4'
file '/Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion/out/Act3_v26_final.mp4'
file '/Users/luukalleman/.claude/skills/loop-studio/core/engine/remotion/out/Act4_v26_final.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i $V/concat_v26.txt -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:v copy -c:a aac -b:a 256k out/BusinessBrain_FULL_v26.mp4 -loglevel error
cp out/BusinessBrain_FULL_v26.mp4 ~/Downloads/BusinessBrain_FULL_v26.mp4
python3 ~/.claude/skills/video-feedback/scripts/make_review.py ~/Downloads/BusinessBrain_FULL_v26.mp4 --project BusinessBrain >/dev/null 2>&1 || true
cd ~/Downloads/BusinessBrain-Review; curl -s -o /dev/null "http://127.0.0.1:9070/review.html" 2>/dev/null || (nohup python3 serve.py >/tmp/var/rev.log 2>&1 &)
echo "=== DONE ==="
ffprobe -v error -show_entries format=duration -of csv=p=0 ~/Downloads/BusinessBrain_FULL_v26.mp4