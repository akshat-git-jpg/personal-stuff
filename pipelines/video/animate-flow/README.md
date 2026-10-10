# animate-flow

Custom motion graphics for a YouTube video, designed per moment in a swappable design system.

```
bash run.sh my-video intake --audio vo.wav --screen screen.mp4 --title "My video"
bash run.sh my-video transcribe
bash run.sh my-video plan-moments
bash run.sh my-video storyboard
bash run.sh my-video storyboard-review   # approve or reject each panel at http://127.0.0.1:4331/
bash run.sh my-video author-moments
bash run.sh my-video review-frames
bash run.sh my-video render-moments
bash run.sh my-video assemble
bash run.sh my-video review          # comment on the cut at http://127.0.0.1:4330/
```

On Windows, swap `bash run.sh` for `node lib/run.mjs`. Details: [PIPELINE.md](PIPELINE.md);
operating rules: [CLAUDE.md](CLAUDE.md).
