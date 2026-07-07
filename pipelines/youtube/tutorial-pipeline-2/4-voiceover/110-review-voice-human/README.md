# 110 · review-voice-human  ·  [HUMAN gate]

Listen to the finished voiceover before it drives any avatar video. This is where the redo loop lives.

- **Review:** `../100-trim-silence-run/output/<base>.voice.trim.wav` (the full voice) and spot-check
  `../090-plan-corner-render-parts-run/output/corner-parts/*.wav` (the corner parts).
- **You approve → proceed to step 120 (timestamps) and, later, step 150 (generate avatars).**

## Checklist
- [ ] No mispronounced names / wrong numbers (the things TTS gets wrong — e.g. "Veo" vs "Vee-oh").
- [ ] No garbled/robotic chunk.
- [ ] Pacing/pauses feel natural.
- [ ] Corner parts each start/end cleanly on a sentence (they should — they're chunk-aligned).

## If something's wrong — fix upstream, re-synth just that bit
1. Find the timestamp; open `…080-synthesize-voice-run/output/<base>.work/index.txt` → the chunk id.
2. Fix the cause: a name → `shared/pronunciation-map.md` + the script; a wrong word → the script;
   a glitchy-but-correct read → no edit, just re-roll.
3. Re-synth only that chunk: `080-synthesize-voice-run/run.py <input> --only 0042`, then re-run step 090.

When it sounds right, say **approved**. Notes/approval can go in `output/`.
