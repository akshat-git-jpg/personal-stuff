# Transcript Maker + Voice Maker — build plan

Spec for two freelancer-facing web tools. Written to be picked up cold in a new session.
Nothing here is built yet; this is the design to execute from.

## Why these exist

Part of a tutorial-video production line. The work splits into three skill tiers:
creative (research + scripting), mechanical (transcript cleanup, TTS), and craft
(video editing). These two tools automate the **mechanical tier** so the creative and
editing people don't burn hours on it, and so non-technical freelancers can run it from a
UI instead of Claude Code.

The pipeline they serve: a tutorial maker records a screen tutorial while freestyling the
voiceover. That rough voice gets transcribed, cleaned, and re-spoken by TTS so the final
audio is consistent regardless of the narrator's accent or English level. **Transcript
Maker** does the transcribe + clean step; **Voice Maker** does the TTS + trim step.

Avatar automation was considered and dropped on purpose: it depends on a brittle HeyGen
session cookie and carries account-ban risk, which is unacceptable for an always-on tool
freelancers touch. Avatar work stays manual for now.

## The two tools

### Transcript Maker — transcript-maker.agrolloo.com

1. User pastes a **video URL** (their own screen recording on YouTube/Drive, or a
   competitor video for research).
2. Backend fetches it (yt-dlp handles YouTube and most hosts; direct download otherwise),
   extracts audio with ffmpeg, runs Whisper.
3. The transcript shows in an editable text box.
4. A **Clean / Fix** button returns a tidied, speakable version. Keep the original visible
   so they can compare and pick.
5. They can download the transcript or hand it to Voice Maker.

### Voice Maker — voice-maker.agrolloo.com

1. User pastes or loads a transcript.
2. **Generate Voice** runs IndexTTS-2 (on Modal) and returns audio with a player.
3. **Trim Silence** tightens the audio (ffmpeg silence detection) into the final `voice.wav`.
4. Re-edit and regenerate as needed, then download.

## Locked decisions

- **Two tools, one codebase, two hub cards.** Simpler to host than two repos.
- **Hosted on the VPS as a Docker container**, like personal-dashboard — not a Cloudflare
  Worker. Workers can't run yt-dlp, ffmpeg, or jobs that take minutes.
- **Auth: one shared password gate**, same as kushal-tools. Per-freelancer logins can come
  later if access needs to be revoked individually; not worth building first.
- **Storage: R2**, same as kushal-docs.
- **Async jobs everywhere.** Submit a job, poll for status, download the result. Nothing is
  request/response; transcription and TTS take minutes.
- **No avatar, no HeyGen.** Out of scope by decision.

## Architecture

- **Backend:** a job API on the VPS (Hono/Node). Job types: `transcribe`, `clean`, `tts`,
  `trim`. A simple sequential queue is fine — volume is a handful of freelancers, not a
  fleet. Job state can live in SQLite or flat JSON; no need for Redis.
- **Compute:** Whisper and IndexTTS-2 run on **Modal** (already wired in the TY repo).
  yt-dlp and ffmpeg run on the VPS itself.
- **Frontend:** a React SPA served from the VPS, behind the existing Cloudflare proxy +
  vps-watchdog. Two routes/pages, surfaced as two cards on the KushalTools hub.
- **Storage:** R2 for audio files and saved transcripts.

## What to reuse (don't rebuild)

- TTS engine + pipeline live in the **TY repo** (separate from this one):
  - `TY/video-voice/tts-flow/modal/indextts2_app.py` — IndexTTS-2 on Modal GPU
  - `TY/video-voice/tts-flow/pipeline/` — `make_segments.py`, `chunk_segments.py`,
    `run.py`, `assemble.py` (transcript → segments → synth → assembled audio)
  - This is a cross-repo dependency. The new app is in personal-stuff; the pipeline it
    calls is in TY. Decide how to invoke it (shell out, shared Modal endpoint, or copy).
- Whisper transcription harness — also under `TY/video-voice/tts-flow/` (the
  "whisper transcription harness" from commit 66d1088).
- Transcript cleaning logic: the `tts-transcript-prep` skill at
  `personal-stuff/tooling/claude-skills/tts-transcript-prep/SKILL.md`. See the gotcha below.
- VPS Docker deploy pattern: copy `apps/personal-dashboard/` (Dockerfile, .env.example,
  compose). Cron/proxy details in `INFRA.md` and `VPS-CRONS.md`.
- Hub card pattern: `apps/kushal-tools/`. R2 wiring pattern: `apps/kushal-docs/`.

## Two things that aren't obvious

1. **"Clean / Fix" is a Claude API call, not a deterministic script.** The transcript-prep
   skill is LLM judgment — normalizing numbers, version strings, units, brand names, and
   pronunciation. The backend has to call the Anthropic API with those rules. It's cheap
   (text only) but it means an API key lives on the VPS, and the output isn't reproducible
   byte-for-byte.
2. **Each job costs GPU money.** Whisper and IndexTTS-2 run on Modal's paid GPUs, so a
   transcript or a generated voice costs a few cents — not free like a Worker. Budget a
   small monthly amount and consider showing freelancers nothing about it.

## Build order

1. Plumbing first: VPS job backend + R2 + one end-to-end job (URL → transcribe → show
   text). This proves the whole stack with the simplest path.
2. Finish Transcript Maker (add the Clean button = the Anthropic API call).
3. Voice Maker (wrap the existing TTS pipeline + an ffmpeg trim job).
4. Hub cards, shared password gate, deploy to the VPS.

## Open items to settle while building

- How the personal-stuff backend invokes the TY TTS pipeline across repos.
- Whisper on Modal vs on the VPS (CPU Whisper is slow for long videos; Modal GPU is faster
  but costs more). Probably Modal.
- File retention: how long uploads/outputs stay in R2 before cleanup.
- Whether the two tools share one login session or each prompts separately.

## References

- `INFRA.md` — Cloudflare + VPS + DNS inventory
- `VPS-CRONS.md` — how VPS jobs are wired
- `apps/personal-dashboard/` — the VPS Docker app to mirror
- `tooling/claude-skills/tts-transcript-prep/` — the cleaning logic
- `TY/video-voice/tts-flow/` — the Whisper + TTS pipeline (other repo)
