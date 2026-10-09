# 120 · make-timestamped-transcript  ·  [RUN]

Re-transcribe the FINAL voiceover with Groq Whisper (word + segment timestamps) so the editor can
scrub to any line. Timestamps match the real trimmed audio.

- **In:** `../100-trim-silence-run/output/<base>.voice.trim.wav`
- **Out:** `output/<base>.srt` (drag into any NLE) · `.timestamps.txt` (`[mm:ss]`) · `.timestamps.json`
- **Run:** `python3 run.py`
- **Next:** step 130 reads `.timestamps.txt`

Uses `lib/asr.py`. ~$0.02/video.
