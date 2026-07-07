# 030 · write-tts-lines · [ANTIGRAVITY]

**Job:** Turn each beat into a clean, pronunciation-ready line for TTS (spell out symbols/acronyms, natural phrasing).

**In:** `videos/<slug>/beats.md`
**Out:** `videos/<slug>/tts-lines.md` (numbered 1..N, verbatim-speakable)

**Run:** `node lib/handoff.mjs 030 --video <slug>` → paste into Antigravity.
**Then:** Antigravity writes `tts-lines.md` → proceed to 040.

**Cost:** **Antigravity sub.** (If the script is already a clean transcript, this is a near-verbatim split.)
