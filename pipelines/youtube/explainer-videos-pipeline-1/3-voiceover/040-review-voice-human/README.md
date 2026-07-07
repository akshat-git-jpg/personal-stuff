# 3/040 · review-voice  ·  [HUMAN gate]

Listen to the finished voiceover before it drives motion-graphics timing.
This is where the redo loop lives.

- **Review:** `../020-trim-silence-run/output/<base>.voice.trim.wav`, prioritizing
  any chunk flagged by `030-voice-autoqc-run`.
- **You approve → proceed to step 050 (timestamped transcript).**

## Checklist
- [ ] No mispronounced names / wrong numbers (check `../../shared/pronunciation-map.md`
      for known fixes, add new ones as you find them).
- [ ] No garbled/robotic chunk.
- [ ] Pacing/pauses feel natural.

## If something's wrong — fix upstream, re-synth just that bit
1. Find the timestamp; open `../010-synthesize-voice-run/output/<base>.work/index.txt` → the chunk id.
2. Fix the cause: a name → `../../shared/pronunciation-map.md` + the script; a wrong
   word → the script (back at `2-scripting`); a glitchy-but-correct read → no edit, just re-roll.
3. Re-synth only that chunk: `010-synthesize-voice-run/run.py <input> --only 0042`.

When it sounds right, say **approved**.
