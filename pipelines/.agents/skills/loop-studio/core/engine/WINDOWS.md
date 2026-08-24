# Windows / any-OS port — status (2026-07-14)

## Done + verified on darwin
- `ls_platform.py` — the ONE adapter module every engine uses:
  - `transcribe()` → mlx-whisper on Apple Silicon, faster-whisper (CUDA→CPU int8) elsewhere; returns the mlx shape everywhere. ✅ end-to-end tested (darwin branch).
  - `hevc_encode_args()` → VideoToolbox / NVENC / libx265 by detection. `h264_delivery_args()` for renders.
  - `doctor()` / `ffmpeg_check()` → per-OS install hints (brew/winget/apt).
- `vlog/render_film.py` + broll-ingest `build_clip_metadata.py` wired to the adapter (no direct mlx imports left).
- Reviewer: `Open Review.bat` template ships from make_review + in the free zip; serve.py/make_review already cross-platform (symlink→copy fallback exists).

## GATE PASSED — 2026-07-14, run 4 on windows-latest (clean Windows 11)
Full buyer flow green: key → keyed download → install → doctor →
faster-whisper transcription → encoder probe (phantom-NVENC correctly
rejected → libx265) → reviewer built → server live on localhost.
Bugs the gate caught and fixed: console ✓-char crash (cp1252), NVENC
listed-but-unusable (now probe-encoded), cp1252 file reads (utf-8 sweep).
CI: .github/workflows/windows-gate.yml (branch ci/windows-gate) — rerun on
every bundle change. Status: WINDOWS BETA (page says so). Residual risk =
consumer-env noise only: Defender prompts, OneDrive homes, non-admin PATH.

## Remaining (hardening, not blockers)
1. Port the 2–3 bash helper scripts (talking-head `build_v*.sh` mix chains) or gate them mac-only for v1.
2. Path normalization sweep (POSIX `~`, `/tmp` → pathlib/tempfile) across engine scripts.
3. Installer doctor: winget branch (ffmpeg, python, faster-whisper pip) + smoke render.
4. **THE GATE: clean-install test on a real Windows machine/VM** — untested branches must not be sold under the 24h-refund guarantee. Luuk to provide the box.
5. Flip the page's Windows FAQ + hero meta line when (4) passes.
