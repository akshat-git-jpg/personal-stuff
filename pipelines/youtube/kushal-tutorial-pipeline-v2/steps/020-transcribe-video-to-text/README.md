# 020 · transcribe-video-to-text  ·  [RUN]

Turn a Google Drive tutorial recording into a raw transcript.

- **In:** a Drive video URL (shared "anyone with the link")
- **Out:** `output/<base>.transcript.txt` (readable) + `.transcript.json` (segments)
- **Run:** `python3 run.py "<drive_url>" [--engine groq|openai|local]`  (default groq, ~$0.02/30 min)
- **Next:** step 030 reads the `.txt`

Uses `lib/asr.py` (Groq) + `lib/audio.py` (downsample). `pip install gdown groq`; `GROQ_API_KEY` in `~/.zshenv`.
