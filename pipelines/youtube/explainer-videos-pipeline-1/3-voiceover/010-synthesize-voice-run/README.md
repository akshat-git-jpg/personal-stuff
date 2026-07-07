# 3/010 · synthesize-voice  ·  [RUN]

TTS via Modal IndexTTS-2, using the fixed reference voice at
`../../shared/ref/owner-30s.wav`. Core subset only — no avatar-block chunking
(this pipeline has no avatar/talking-head output).

- **In:** `../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`
- **Out:** `output/<base>.voice.wav` + `output/<base>.work/` (clips, chunks.json, index.txt)
- **Hard-stop:** if `shared/ref/owner-30s.wav` is missing, stops with a clear message.
- **Redo loop:** `python3 run.py <input> --only 0042,0043` re-synths just those chunks.
- **Next:** step 020 (trim-silence)
