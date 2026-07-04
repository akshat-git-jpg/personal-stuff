# 080 · synthesize-voice  ·  [RUN]  (the only GPU step)

Synthesize the jamila brand voice with IndexTTS-2 on Modal. Avatar-aware: chunks each segment so
every avatar block is whole chunks, then emits one clean audio clip per block for HeyGen.

- **In:** `../060-plan-avatar-blocks/output/<base>.avatar-segments.json` (or a plain `.improved.txt`)
- **Out:** `output/<base>.voice.wav` · `output/avatar-audio/<seg>.wav` (per block) ·
  `output/<base>.avatar-fullscreen.md` (HeyGen script) · `output/<base>.work/` (clips + timeline)
- **Run:** `python3 run.py` · redo loop: `--only 0042,0043` · timeline: `--index`
- **Next:** step 100 reads `…voice.wav`. Costs ~$0.45–0.50/video (see `RUNLOG.md`).

Uses `lib/chunking.py`, `lib/modal_tts.py`, `lib/audio.py`. Brand voice: `../../shared/ref/jamila-30s.wav`.
