---
name: transcribe
description: Fetch a transcript for a YouTube video (or local audio/video file) via a fallback chain -- native captions, then Groq Whisper, then local Whisper -- so callers always get a usable transcript without picking a method by hand. Triggers on "transcribe <link>", "get a transcript for <video>", "fetch transcript".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# transcribe - fallback-chain transcript fetcher

Not an LLM task - mechanical. Given a YouTube link/id, run:

    cd pipelines && python3 -m common.transcribe fetch <youtube-url-or-id> --out-dir <dir> [--method auto|captions|groq|local]

`--method auto` (default) tries native captions (`pp-yt-transcript`) first,
then Groq Whisper (`yt-dlp` + Groq's hosted `whisper-large-v3-turbo`,
`GROQ_API_KEY` from `~/.zshenv`), then local Whisper (`npx hyperframes
transcribe --model small`) -- each result must be at least 300 words
(`MIN_WORDS`) to count as success; a thin/broken result falls through to the
next method instead of being kept.

Writes `<out-dir>/transcript.md` and prints `{"video_id", "path", "method"}`
as JSON.

An explicit `--method` skips straight to that one method (useful to force
Groq/local when captions are known to be missing, or to retry only the
method that failed).

## Consumers

`dossier-transcripts` is the current caller -- see that skill for the
per-video-id global store this feeds. Callable standalone for any other
one-off transcript need.
