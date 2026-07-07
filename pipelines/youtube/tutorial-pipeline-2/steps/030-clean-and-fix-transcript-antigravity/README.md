# 030 · clean-and-fix-transcript  ·  [ANTIGRAVITY]

Fix what TTS gets wrong: spell out numbers/versions, correct names via the pronunciation map,
remove stutters/fillers, add punctuation for prosody.

- **In:** `../020-transcribe-video-to-text-run/output/<base>.transcript.txt`
- **Out:** `output/<base>.clean.txt`
- **How:** Claude applies `rulebook.md` (judgment, not a script). Uses `../../shared/pronunciation-map.md` (grows).
- **Next:** step 040 reads the `.clean.txt`
