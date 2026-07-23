# 070-handoff-visuals

```bash
bash run.sh <slug> handoff
```

This runs the video plan and builds exactly the two artifacts the visuals flow expects, placing them in `pipelines/video/visuals-flow/videos/<slug>/`:

- `vo.mp3` (the normalized voiceover)
- `screen.mp4` (the aligned spine)

**Next steps**:
From here, operate visuals-flow per its `PIPELINE.md` (transcribe → cues → shots → assembly).
