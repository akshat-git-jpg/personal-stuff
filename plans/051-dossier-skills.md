<!-- boss frontmatter -->
---
executor: agy
model: "Gemini 3.1 Pro (High)"
test_cmd: python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q
ui: false
deploy:
needs: ["owner's explicit choice: executor agy, model Gemini 3.1 Pro (High) — do not substitute"]
---

# Plan 051: Dossier skills — transcript fallback chain + per-tool research dossiers

## Summary

- **Problem statement**: Screen-recorded comparison/tutorial videos cover many tools each; research today is redone per video even though tool overlap across videos is high. There is also no shared transcript-fetching code — Groq Whisper transcription is duplicated byte-for-byte across two pipelines.
- **Goals**:
  - One shared `pipelines/common/transcribe.py`: a transcript fallback chain (native captions → Groq Whisper → local Whisper), replacing the duplicated Groq-calling code.
  - `pipelines/youtube/dossiers/`: a global per-video transcript store plus per-tool persistent "dossiers" (pricing, strengths, weaknesses, quirks, demos, comparisons, verdicts — every claim cited to a video + timestamp), built by three Claude Code skills (`transcribe`, `dossier-transcripts`, `dossier-build`) instead of a search-driven Python pipeline.
  - Extraction discovers every tool a video mentions in one pass (not one tool per call); merging is per-tool, idempotent, and guarded against bad model output.
- **Executor proposed**: `agy`, model `Gemini 3.1 Pro (High)` — owner's explicit choice (see frontmatter `needs`).
- **Done criteria** (terse): `test_cmd` exits 0 (23 tests across both suites); all 3 skills + their symlinks exist; both `asr.py` duplicates now re-export from `common.transcribe`; no non-stdlib imports outside the pre-existing `groq` dependency.
- **Stop conditions** (terse): `pipelines/youtube/dossiers/` already exists with content; `tooling/cli/youtube/pp-yt-transcript` missing; either `lib/audio.py` diverges beyond `to_mp3`; a quoted excerpt doesn't match the file on disk.
- **Test / verification for success**: pytest — `transcribe.py`'s fallback chain and `registry.py`'s parse contract / merge guard / tool matching, all with mocked `subprocess`, no network, no API keys.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`. Stage this plan file with
> your commit (`git add plans/…`). Keep ALL writes inside the repo working tree.
>
> **Drift check (run first)**: `git diff --stat 5826cf0..HEAD -- pipelines/common pipelines/youtube/dossiers pipelines/.claude/skills/transcribe pipelines/.claude/skills/dossier-transcripts pipelines/.claude/skills/dossier-build .claude/skills/transcribe .claude/skills/dossier-transcripts .claude/skills/dossier-build pipelines/youtube/tutorial-pipeline-2/lib/asr.py pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py` (expect: no output — none of these touched yet, and `pipelines/youtube/dossiers/` must not exist)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard — every decision (schemas, prompts, guard rules, dispatch mechanics) is fully specified below; nothing is left to the executor's judgment.
- **Planned at**: commit `5826cf0`, 2026-07-08

## Why this matters

The owner's format is screen-recorded software comparisons (5-25 tools per video). Research should compound per-tool, not reset per-video: the 5th video that mentions Hostinger should start already researched. `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` is the full design (already brainstormed and independently reviewed — this plan translates it 1:1 into buildable steps, no new decisions). Design highlights this plan implements exactly:
- A video is fetched **once**, globally, regardless of how many tools it mentions (`pipelines/youtube/dossiers/videos/<id>/`).
- Extraction discovers **every** tool a transcript mentions in one call, not one tool per call.
- Per-video, per-tool status tracking (`extracted`, `merged_into.<tool>`) so a 5-tool video can feed 5 dossiers independently, at different times, without re-fetching or re-analyzing.
- Extraction/merge are dispatched to `agy` or a Claude Code subagent only — never a direct paid API call (the owner's explicit instruction; see the design spec's "Deliberate trade-off" note).

## Current state

- **`pipelines/common/`** already exists as a proper package (`pipelines/common/__init__.py` present, side-effect-loads `pipelines/.env` on import). Existing modules there (`sheets.py`, `gemini.py`, `llm.py`, ...) are the convention `pipelines/common/transcribe.py` joins.
- **The two Groq-transcription duplicates are confirmed byte-identical** (verified during design review): `pipelines/youtube/tutorial-pipeline-2/lib/asr.py` and `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py`, both currently:
  ```python
  """Groq Whisper transcription. Used by step 020 (video->text) and step 120 (timestamped transcript).

  Reuses the GROQ_API_KEY from ~/.zshenv. `word_timestamps=True` asks for word + segment
  granularities (step 120); default returns segment-level verbose_json (step 020).
  """
  import os, json
  from .audio import to_mp3


  def groq_transcribe(path, model="whisper-large-v3-turbo", word_timestamps=False):
      if not os.environ.get("GROQ_API_KEY"):
          raise SystemExit("✖ GROQ_API_KEY not set (it lives in ~/.zshenv)")
      from groq import Groq
      mp3 = to_mp3(path, suffix=".asr.mp3")
      kwargs = dict(model=model, response_format="verbose_json")
      if word_timestamps:
          kwargs["timestamp_granularities"] = ["segment", "word"]
      with open(mp3, "rb") as f:
          r = Groq().audio.transcriptions.create(file=(mp3.name, f.read()), **kwargs)
      mp3.unlink(missing_ok=True)
      if isinstance(r, dict):
          return r
      if hasattr(r, "model_dump"):
          return r.model_dump()
      return json.loads(str(r))
  ```
- **Their sibling `lib/audio.py` files are NOT fully deduped by this plan** — `to_mp3()` is used directly by `pipelines/youtube/tutorial-pipeline-2/2-recording/020-transcribe-video-to-text-run/run.py:83` (`audio.to_mp3(video, suffix=".16k.mp3")`), separately from `asr.py`. `audio.py` also carries `dur()`, `mmss()`, `concat()`, used by many other callers across both pipelines (voiceover steps, avatar-clip steps). **Do not touch either `audio.py` file** — only `asr.py` is deduped (see Step 4). `pipelines/common/transcribe.py` gets its own copy of `to_mp3()` (it needs one internally for the Groq path) rather than importing the pipeline-local one, keeping the shared module dependency-free of pipeline-specific code.
- **`tooling/cli/youtube/pp-yt-transcript`** (verified live): `pp-yt-transcript get <url-or-11-char-id> [--format text|json|srt|vtt] [--timestamps] [--no-cache] [--no-fallback]`. Default format is `text` (one flowing block); `--timestamps` prefixes each line `[mm:ss]`. It already has its own internal `yt-dlp` fallback for captions (disable with `--no-fallback` — not used here, default behavior is what we want). Non-zero exit = no usable captions.
- **`yt-dlp` is an available system binary** (already used by `pipelines/youtube/competitor-styles/fetch_video.py` to download video).
- **`npx hyperframes transcribe`** (local Whisper, part of the `hyperframes-media` skill, `pipelines/.agents/skills/hyperframes-media/SKILL.md`): `npx hyperframes transcribe <file> --model small [--language <code>]`. **Never use a `.en`-suffixed model unless the audio is confirmed English** — `.en` models mistranslate instead of transcribing. Output shape is a flat JSON array of word objects: `[{"id": "w0", "text": "Hello", "start": 0.0, "end": 0.5}, ...]`. The skill's docs show no `--output`/`-o` flag for `transcribe` (unlike `tts`/`remove-background`, which do have one) and no documented default output filename — Step 2 below discovers the produced file defensively (before/after directory diff) rather than assuming an unverified flag or filename.
- **`tooling/boss/executors/agy.sh`** (read in full during design review) is built for boss's own async crew/PR/worktree workflow: it leases a `wt` worktree, requires a git commit to detect completion, and polls `dispatch`/`alive`/`collect`. It is **not** used by this plan — `dossier-build` calls `agy` directly (`agy -p "<prompt>" --output-format json --model "<model>"`), reusing only its `--output-format json` envelope shape (`{"status": "SUCCESS"|"ERROR", "response": "...", ...}`), which is agy's real, already-documented output contract.
- **`plans/_TEMPLATE.md`/`plans/WORKFLOW.md`** define this repo's plan contract (already followed by this file). **`plans/runs/LESSONS.md`** has two directly relevant lessons: (1) 2026-07-05 — always check `tooling/cli/` for an existing fetcher before speccing new fetch code (this plan does: `pp-yt-transcript`); (2) 2026-07-06/07 (agy) — headless `agy` print mode requires `--add-dir <workspace>` (cwd is not bound automatically) and a generous `--print-timeout` for real runs, and a `--model` request against a quota-exhausted account can return `status:SUCCESS` with an **empty** `response` and 0 tokens — indistinguishable from success unless checked. `registry.parse_agy_envelope()` (Step 5) treats an empty `response` on `SUCCESS` as a parse failure specifically because of this lesson.
- **No `pipelines/venv/`** exists on this machine; system `python3 -m pytest` is the house pattern (matches `pipelines/youtube/competitor-styles/`, the closest same-domain precedent). The `groq` package is already a runtime dependency of the existing `asr.py` files (imported lazily inside the function) — this plan doesn't add it, just moves the import.
- **House test convention** (`pipelines/youtube/yt-analysis/tests/conftest.py`, read in full):
  ```python
  """Add myproj root to sys.path so `from common.x import y` works in tests."""

  import os
  import sys

  ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
  if ROOT not in sys.path:
      sys.path.insert(0, ROOT)
  ```
  (that file's `tests/` sits 3 levels under `pipelines/`; `pipelines/common/tests/` sits 2 levels under `pipelines/`, so its `conftest.py` uses `"..", ".."` — see Step 3.)
- **Pipelines-domain skills are symlinked individually** from `.claude/skills/<name>` to `../../pipelines/.claude/skills/<name>` (verified: `.claude/skills/yt-style-copy -> ../../pipelines/.claude/skills/yt-style-copy`). There is no automated relink step for `pipelines/.claude/skills/` (unlike `tooling/claude-skills/`, which `scripts/relink.sh` handles) — each new skill's symlink is created by hand (Step 10).
- **Design spec** (read in full, source of truth for exact prompt/schema/guard text used verbatim below): `docs/superpowers/specs/2026-07-08-dossier-skills-design.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests (repo root) | `python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q` | exit 0 |
| transcribe.py CLI help | `python3 -m pipelines.common.transcribe --help` (run from repo root) or `cd pipelines && python3 -m common.transcribe --help` | usage, exit 0 |
| pp-yt-transcript sanity | `tooling/cli/youtube/pp-yt-transcript get --help` | usage, exit 0 (already verified working) |

## Scope

**In scope**:
- `pipelines/common/transcribe.py` (new)
- `pipelines/common/tests/conftest.py`, `pipelines/common/tests/test_transcribe.py` (new)
- `pipelines/youtube/tutorial-pipeline-2/lib/asr.py` (rewritten to re-export)
- `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py` (rewritten to re-export)
- `pipelines/youtube/dossiers/` (new): `.gitignore`, `registry.py`, `prompts.py`, `CLAUDE.md`, `tests/test_registry.py`, `tests/test_prompts.py`
- `pipelines/.claude/skills/transcribe/SKILL.md` (new)
- `pipelines/.claude/skills/dossier-transcripts/SKILL.md` (new)
- `pipelines/.claude/skills/dossier-build/SKILL.md` (new)
- `.claude/skills/transcribe`, `.claude/skills/dossier-transcripts`, `.claude/skills/dossier-build` (new symlinks)
- `plans/README.md` (status row only)

**Out of scope**:
- `pipelines/youtube/tutorial-pipeline-2/lib/audio.py`, `pipelines/youtube/explainer-videos-pipeline-1/lib/audio.py` — do not touch (see Current state).
- The deferred brief-assembly skill (skill 3 from the original ask) — not built now.
- Any search/discovery step — the owner supplies links directly.
- `pipelines/youtube/yt-research/**`, `pipelines/youtube/competitor-styles/**`, `pipelines/youtube/yt-script/**`, root `CLAUDE.md`, `docs/README.md`.

## Git workflow

- Branch: `advisor/051-dossier-skills`
- Commit: `feat(dossiers): transcript fallback chain + dossier-building skills` — no AI footers. Do NOT push.

## Steps

### Step 1: `pipelines/common/transcribe.py`

Create the file:

```python
#!/usr/bin/env python3
"""Transcript fetching with a fallback chain: native YouTube captions ->
Groq Whisper -> local Whisper. Shared by the dossiers pipeline and (via
groq_transcribe) by tutorial-pipeline-2 and explainer-videos-pipeline-1's
lib/asr.py.

CLI:
    python3 -m common.transcribe fetch <youtube-url-or-id> --out-dir <dir> [--method auto|captions|groq|local]

No venv - stdlib + the `groq` package (already required by callers that use
Groq transcription) + system binaries `yt-dlp`, `ffmpeg`, `ffprobe`, `npx`.
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

MIN_WORDS = 300
HERE = Path(__file__).resolve().parent                       # pipelines/common
REPO_ROOT = HERE.parents[1]                                   # <repo>
PP_YT_TRANSCRIPT = REPO_ROOT / "tooling" / "cli" / "youtube" / "pp-yt-transcript"

VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})")


def video_id_from(url_or_id):
    """Extract an 11-char YouTube video id from a URL, or pass a bare id through."""
    m = VIDEO_ID_RE.search(url_or_id)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url_or_id):
        return url_or_id
    raise ValueError(f"can't parse a YouTube video id from: {url_or_id}")


def _word_count(text):
    return len(text.split())


def to_mp3(src, dst_dir="/tmp", suffix=".mp3"):
    """Downsample any audio/video to 16 kHz mono mp3. Returns the output path."""
    dst = Path(dst_dir) / (Path(src).stem + suffix)
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000",
                    "-b:a", "64k", str(dst)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def groq_transcribe(path, model="whisper-large-v3-turbo", word_timestamps=False):
    """One Groq Whisper call on a local audio/video file. Returns the parsed
    verbose_json response as a plain dict."""
    if not os.environ.get("GROQ_API_KEY"):
        raise SystemExit("✗ GROQ_API_KEY not set (it lives in ~/.zshenv)")
    from groq import Groq
    mp3 = to_mp3(path, suffix=".asr.mp3")
    kwargs = dict(model=model, response_format="verbose_json")
    if word_timestamps:
        kwargs["timestamp_granularities"] = ["segment", "word"]
    with open(mp3, "rb") as f:
        r = Groq().audio.transcriptions.create(file=(mp3.name, f.read()), **kwargs)
    mp3.unlink(missing_ok=True)
    if isinstance(r, dict):
        return r
    if hasattr(r, "model_dump"):
        return r.model_dump()
    return json.loads(str(r))


def fetch_youtube_audio(video_id, dst_dir):
    """yt-dlp pulls the best available audio track to dst_dir. Returns the
    downloaded file's path (native container - pass through to_mp3() before
    transcribing)."""
    out_template = str(Path(dst_dir) / f"{video_id}.%(ext)s")
    subprocess.run(["yt-dlp", "-f", "bestaudio", "--no-playlist",
                    "-o", out_template, f"https://youtu.be/{video_id}"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    matches = list(Path(dst_dir).glob(f"{video_id}.*"))
    if not matches:
        raise RuntimeError(f"yt-dlp reported success but no file matched {video_id}.*")
    return matches[0]


def _timestamp_line(start_seconds, text):
    return f"[{int(start_seconds) // 60}:{int(start_seconds) % 60:02d}] {text.strip()}"


def _try_captions(video_id):
    r = subprocess.run([str(PP_YT_TRANSCRIPT), "get", video_id, "--format", "text", "--timestamps"],
                        capture_output=True, text=True)
    if r.returncode != 0:
        return None
    text = r.stdout
    return text if _word_count(text) >= MIN_WORDS else None


def _try_groq(video_id, work_dir):
    audio_path = fetch_youtube_audio(video_id, work_dir)
    try:
        result = groq_transcribe(audio_path, word_timestamps=True)
    finally:
        audio_path.unlink(missing_ok=True)
    segments = result.get("segments") or []
    text = "\n".join(_timestamp_line(s["start"], s["text"]) for s in segments)
    return text if _word_count(text) >= MIN_WORDS else None


def _try_local_whisper(video_id, work_dir):
    audio_path = fetch_youtube_audio(video_id, work_dir)
    before = set(Path(work_dir).glob("*"))
    try:
        subprocess.run(["npx", "hyperframes", "transcribe", str(audio_path), "--model", "small"],
                       check=True, cwd=work_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        audio_path.unlink(missing_ok=True)
    after = set(Path(work_dir).glob("*"))
    new_json = [p for p in (after - before) if p.suffix == ".json"]
    if not new_json:
        return None
    data = json.loads(new_json[0].read_text())
    new_json[0].unlink(missing_ok=True)
    words = data if isinstance(data, list) else (data.get("segments") or data.get("words") or [])
    text = "\n".join(_timestamp_line(w.get("start", 0), w.get("text", "")) for w in words)
    return text if _word_count(text) >= MIN_WORDS else None


_CHAIN_STEPS = {
    "captions": lambda video_id, wd: _try_captions(video_id),
    "groq": lambda video_id, wd: _try_groq(video_id, wd),
    "local": lambda video_id, wd: _try_local_whisper(video_id, wd),
}
_AUTO_ORDER = ["captions", "groq", "local"]


def fetch(video_id_or_url, method="auto", out_dir=None):
    """Fetch a transcript by the fallback chain (or a forced single method).
    Returns (transcript_text, method_used). Raises RuntimeError if every
    attempted method fails or returns under MIN_WORDS."""
    video_id = video_id_from(video_id_or_url)
    order = _AUTO_ORDER if method == "auto" else [method]
    if any(m not in _CHAIN_STEPS for m in order):
        raise ValueError(f"unknown method: {method}")
    with tempfile.TemporaryDirectory() as tmp:
        wd = out_dir or tmp
        for name in order:
            text = _CHAIN_STEPS[name](video_id, wd)
            if text is not None:
                return text, name
    raise RuntimeError(f"all methods failed for {video_id} (method={method})")


def main():
    p = argparse.ArgumentParser(prog="transcribe")
    sub = p.add_subparsers(dest="cmd", required=True)
    fetch_p = sub.add_parser("fetch")
    fetch_p.add_argument("video")
    fetch_p.add_argument("--method", choices=["auto", "captions", "groq", "local"], default="auto")
    fetch_p.add_argument("--out-dir", default=None)
    args = p.parse_args()
    text, method_used = fetch(args.video, method=args.method, out_dir=args.out_dir)
    out_dir = Path(args.out_dir) if args.out_dir else Path(".")
    out_dir.mkdir(parents=True, exist_ok=True)
    vid = video_id_from(args.video)
    out_path = out_dir / "transcript.md"
    out_path.write_text(text)
    print(json.dumps({"video_id": vid, "path": str(out_path), "method": method_used}))


if __name__ == "__main__":
    main()
```

**Verify**: `cd pipelines && python3 -m common.transcribe --help` -> usage listing the `fetch` subcommand, exit 0.

### Step 2: `pipelines/common/tests/conftest.py`

```python
"""Add pipelines root to sys.path so `from common.x import y` works in tests."""

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
```

**Verify**: `python3 -c "import ast; ast.parse(open('pipelines/common/tests/conftest.py').read())"` -> no output, exit 0.

### Step 3: `pipelines/common/tests/test_transcribe.py`

Mock `subprocess.run` so no network/binaries are needed:

```python
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from common import transcribe


def test_video_id_from_variants():
    assert transcribe.video_id_from("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert transcribe.video_id_from("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert transcribe.video_id_from("dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_fetch_auto_uses_captions_when_long_enough():
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=long_text) as cap, \
         patch("common.transcribe._try_groq") as groq:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "captions"
    assert text == long_text
    cap.assert_called_once()
    groq.assert_not_called()


def test_fetch_auto_falls_through_to_groq_when_captions_too_short():
    short_text = "word " * 50
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=short_text), \
         patch("common.transcribe._try_groq", return_value=long_text) as groq, \
         patch("common.transcribe._try_local_whisper") as local:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "groq"
    assert text == long_text
    groq.assert_called_once()
    local.assert_not_called()


def test_fetch_auto_falls_through_to_local_when_captions_and_groq_fail():
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=None), \
         patch("common.transcribe._try_groq", return_value=None), \
         patch("common.transcribe._try_local_whisper", return_value=long_text) as local:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "local"
    local.assert_called_once()


def test_fetch_raises_when_all_methods_fail():
    with patch("common.transcribe._try_captions", return_value=None), \
         patch("common.transcribe._try_groq", return_value=None), \
         patch("common.transcribe._try_local_whisper", return_value=None):
        try:
            transcribe.fetch("dQw4w9WgXcQ", method="auto")
            assert False, "expected RuntimeError"
        except RuntimeError:
            pass


def test_try_captions_rejects_thin_output():
    fake = MagicMock(returncode=0, stdout="too short")
    with patch("common.transcribe.subprocess.run", return_value=fake):
        assert transcribe._try_captions("dQw4w9WgXcQ") is None


def test_try_captions_accepts_long_output():
    fake = MagicMock(returncode=0, stdout="word " * 400)
    with patch("common.transcribe.subprocess.run", return_value=fake):
        assert transcribe._try_captions("dQw4w9WgXcQ") is not None


def test_fetch_explicit_method_skips_chain(tmp_path):
    long_text = "word " * 400
    with patch("common.transcribe._try_groq", return_value=long_text) as groq, \
         patch("common.transcribe._try_captions") as cap:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="groq", out_dir=str(tmp_path))
    assert method == "groq"
    cap.assert_not_called()
```

**Verify**: `python3 -m pytest pipelines/common/tests/test_transcribe.py -v` -> 8 passed.

### Step 4: Dedupe `lib/asr.py` in both pipelines

Replace the full contents of **both** `pipelines/youtube/tutorial-pipeline-2/lib/asr.py` and `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py` (they were byte-identical) with:

```python
"""Groq Whisper transcription. Used by step 020 (video->text) and step 120 (timestamped transcript).

Thin re-export of the shared pipelines/common/transcribe.py implementation
(deduped 2026-07-08 - this file and its sibling in the other pipeline were
byte-identical copies of the same Groq-calling code).
"""
import sys
from pathlib import Path

_PIPELINES_ROOT = Path(__file__).resolve().parents[3]
if str(_PIPELINES_ROOT) not in sys.path:
    sys.path.insert(0, str(_PIPELINES_ROOT))

from common.transcribe import groq_transcribe  # noqa: E402,F401
```

Do **not** modify either `lib/audio.py` (see Current state — `to_mp3` there has other direct callers).

**Verify**: `python3 -c "
import sys
sys.path.insert(0, 'pipelines/youtube/tutorial-pipeline-2')
from lib import asr
assert callable(asr.groq_transcribe)
sys.path.insert(0, 'pipelines/youtube/explainer-videos-pipeline-1')
import importlib
sys.modules.pop('lib', None); sys.modules.pop('lib.asr', None)
sys.path.insert(0, 'pipelines/youtube/explainer-videos-pipeline-1')
from lib import asr as asr2
assert callable(asr2.groq_transcribe)
print('ok')
"` -> `ok`

### Step 5: `pipelines/youtube/dossiers/registry.py`

Create the directory and file:

```python
"""Pure bookkeeping for the dossiers pipeline: per-video meta.json, the
extraction output-parse contract, and the merge sanity guard. No LLM calls,
no subprocess - fully unit-testable.
"""
import difflib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent            # pipelines/youtube/dossiers
VIDEOS_DIR = HERE / "videos"
TOOLS_DIR = HERE / "tools"

CITATION_RE = re.compile(r"\([A-Za-z0-9_-]{11} @")


# ---- per-video meta.json ----------------------------------------------

def meta_path(video_id):
    return VIDEOS_DIR / video_id / "meta.json"


def load_meta(video_id):
    return json.loads(meta_path(video_id).read_text())


def save_meta(video_id, data):
    meta_path(video_id).parent.mkdir(parents=True, exist_ok=True)
    meta_path(video_id).write_text(json.dumps(data, indent=2, sort_keys=True))


def all_video_ids():
    if not VIDEOS_DIR.exists():
        return []
    return sorted(p.parent.name for p in VIDEOS_DIR.glob("*/meta.json"))


def pending_extraction():
    """Video ids that are fetched but not yet extracted."""
    return [vid for vid in all_video_ids() if not load_meta(vid).get("extracted")]


def pending_merge_for_tool(tool_slug):
    """Video ids whose merged_into[tool_slug] is still false."""
    out = []
    for vid in all_video_ids():
        m = load_meta(vid)
        if m.get("extracted") and m.get("merged_into", {}).get(tool_slug) is False:
            out.append(vid)
    return out


def all_pending_tools():
    """Every tool slug with at least one video where merged_into[slug] is false."""
    tools = set()
    for vid in all_video_ids():
        m = load_meta(vid)
        for slug, done in m.get("merged_into", {}).items():
            if not done:
                tools.add(slug)
    return sorted(tools)


# ---- extraction output parse contract ----------------------------------

class ParseError(Exception):
    pass


def parse_extraction_output(raw_text):
    """Extract + validate the fenced ```json block an extraction call must
    return. Raises ParseError with a human-readable reason on any failure."""
    fence = re.search(r"```json\s*(.*?)\s*```", raw_text, re.DOTALL)
    if not fence:
        raise ParseError("no fenced ```json block found in output")
    try:
        data = json.loads(fence.group(1))
    except json.JSONDecodeError as e:
        raise ParseError(f"fenced block is not valid JSON: {e}")
    tools = data.get("tools")
    if not isinstance(tools, list) or not tools:
        raise ParseError("'tools' key missing or empty")
    for i, t in enumerate(tools):
        if not isinstance(t, dict) or not t.get("tool_name"):
            raise ParseError(f"tools[{i}] missing required 'tool_name'")
    return data


def parse_agy_envelope(raw_stdout):
    """Unwrap agy's --output-format json envelope, confirm status SUCCESS
    with a non-empty response (see plans/runs/LESSONS.md 2026-07-07: a
    quota-exhausted model request can return SUCCESS with an empty response),
    then run parse_extraction_output on the embedded response text."""
    try:
        envelope = json.loads(raw_stdout)
    except json.JSONDecodeError as e:
        raise ParseError(f"agy envelope is not valid JSON: {e}")
    if envelope.get("status") != "SUCCESS":
        raise ParseError(f"agy status was {envelope.get('status')!r}, not SUCCESS")
    response = envelope.get("response", "")
    if not response:
        raise ParseError("agy returned status SUCCESS but an empty response (0-token failure mode)")
    return parse_extraction_output(response)


# ---- merge sanity guard -------------------------------------------------

def merge_guard(old_dossier_text, new_dossier_text, batch_video_ids):
    """Four checks from the design spec. Returns (ok: bool, reason: str)."""
    if not new_dossier_text.startswith("# "):
        return False, "response doesn't start with '# '"
    if len(new_dossier_text) < len(old_dossier_text) / 2:
        return False, "response is under half the current dossier's length"
    old_citations = len(CITATION_RE.findall(old_dossier_text))
    new_citations = len(CITATION_RE.findall(new_dossier_text))
    if new_citations < old_citations:
        return False, f"citation count dropped ({old_citations} -> {new_citations})"
    missing = [vid for vid in batch_video_ids if vid not in new_dossier_text]
    if missing:
        return False, f"source video id(s) missing from output: {missing}"
    return True, ""


# ---- tool identity matching ---------------------------------------------

def normalize_name(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def load_tool(slug):
    return json.loads((TOOLS_DIR / slug / "tool.json").read_text())


def all_tool_slugs():
    if not TOOLS_DIR.exists():
        return []
    return sorted(p.parent.name for p in TOOLS_DIR.glob("*/tool.json"))


def match_tool(tool_name, aliases=None, near_threshold=0.82):
    """Match a discovered tool_name against existing tool folders.
    Returns ('exact', slug) | ('near', slug) | ('none', normalize_name(tool_name))."""
    aliases = aliases or []
    candidate_names = [tool_name] + list(aliases)
    candidate_slugs = {normalize_name(n) for n in candidate_names}
    for slug in all_tool_slugs():
        existing = load_tool(slug)
        existing_names = [existing.get("name", "")] + existing.get("aliases", [])
        existing_slugs = {normalize_name(n) for n in existing_names}
        if candidate_slugs & existing_slugs:
            return "exact", slug
    best_slug, best_ratio = None, 0.0
    for slug in all_tool_slugs():
        existing = load_tool(slug)
        existing_names = [existing.get("name", "")] + existing.get("aliases", [])
        for cn in candidate_names:
            for en in existing_names:
                ratio = difflib.SequenceMatcher(None, normalize_name(cn), normalize_name(en)).ratio()
                if ratio > best_ratio:
                    best_slug, best_ratio = slug, ratio
    if best_slug and best_ratio >= near_threshold:
        return "near", best_slug
    return "none", normalize_name(tool_name)
```

Also create `pipelines/youtube/dossiers/.gitignore` with one line:
```
videos/*/transcript.md
```

**Verify**: `python3 -c "
import sys; sys.path.insert(0, 'pipelines/youtube/dossiers')
import registry
print(registry.normalize_name('Hostinger VPS!'))
"` -> `hostinger-vps`

### Step 6: `pipelines/youtube/dossiers/tests/test_registry.py`

```python
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import registry


def _write_meta(base, video_id, **overrides):
    data = {
        "id": video_id, "extracted": False, "merged_into": {},
    }
    data.update(overrides)
    d = base / "videos" / video_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "meta.json").write_text(json.dumps(data))


def test_pending_extraction_and_merge(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "VIDEOS_DIR", tmp_path / "videos")
    _write_meta(tmp_path, "AAAAAAAAAAA", extracted=False)
    _write_meta(tmp_path, "BBBBBBBBBBB", extracted=True, merged_into={"hostinger": False, "bluehost": True})
    assert registry.pending_extraction() == ["AAAAAAAAAAA"]
    assert registry.pending_merge_for_tool("hostinger") == ["BBBBBBBBBBB"]
    assert registry.pending_merge_for_tool("bluehost") == []
    assert registry.all_pending_tools() == ["hostinger"]


def test_parse_extraction_output_happy_path():
    raw = 'Here you go:\n```json\n{"tools": [{"tool_name": "Hostinger", "strengths": []}]}\n```\n'
    data = registry.parse_extraction_output(raw)
    assert data["tools"][0]["tool_name"] == "Hostinger"


def test_parse_extraction_output_no_fence_raises():
    try:
        registry.parse_extraction_output("just prose, no json block")
        assert False, "expected ParseError"
    except registry.ParseError:
        pass


def test_parse_extraction_output_missing_tool_name_raises():
    raw = '```json\n{"tools": [{"strengths": []}]}\n```'
    try:
        registry.parse_extraction_output(raw)
        assert False, "expected ParseError"
    except registry.ParseError:
        pass


def test_parse_agy_envelope_empty_response_is_failure():
    raw = json.dumps({"status": "SUCCESS", "response": ""})
    try:
        registry.parse_agy_envelope(raw)
        assert False, "expected ParseError"
    except registry.ParseError as e:
        assert "empty response" in str(e)


def test_merge_guard_passes():
    old = "# Hostinger\n(AAAAAAAAAAA @ 1:00, Jan 2026)\n"
    new = "# Hostinger\n" + "x" * len(old) + "(AAAAAAAAAAA @ 1:00, Jan 2026) (BBBBBBBBBBB @ 2:00, Feb 2026)\n"
    ok, reason = registry.merge_guard(old, new, ["AAAAAAAAAAA", "BBBBBBBBBBB"])
    assert ok, reason


def test_merge_guard_rejects_missing_source_video():
    old = "# Hostinger\n(AAAAAAAAAAA @ 1:00, Jan 2026)\n" * 5
    new = "# Hostinger\n" + old  # long enough, citation count fine, but BBBBBBBBBBB never appears
    ok, reason = registry.merge_guard(old, new, ["AAAAAAAAAAA", "BBBBBBBBBBB"])
    assert not ok
    assert "missing" in reason


def test_merge_guard_rejects_short_response():
    old = "# Hostinger\n" + ("x" * 500)
    new = "# Hostinger\nshort"
    ok, reason = registry.merge_guard(old, new, [])
    assert not ok
    assert "half" in reason


def test_match_tool_exact_and_none(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    d = tmp_path / "tools" / "hostinger"
    d.mkdir(parents=True)
    (d / "tool.json").write_text(json.dumps({"name": "Hostinger", "aliases": ["Hostinger VPS"]}))
    assert registry.match_tool("Hostinger") == ("exact", "hostinger")
    assert registry.match_tool("Hostinger VPS") == ("exact", "hostinger")
    kind, slug = registry.match_tool("Totally Different Tool")
    assert kind == "none"


def test_match_tool_near_duplicate(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    d = tmp_path / "tools" / "hostinger"
    d.mkdir(parents=True)
    (d / "tool.json").write_text(json.dumps({"name": "Hostinger", "aliases": []}))
    kind, slug = registry.match_tool("Hostinger Cloud")
    assert kind == "near"
    assert slug == "hostinger"
```

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests/test_registry.py -v` -> 10 passed.

### Step 7: `pipelines/youtube/dossiers/prompts.py`

```python
"""Extraction and merge prompts for the dossiers pipeline. Verbatim from
docs/superpowers/specs/2026-07-08-dossier-skills-design.md - do not edit
these without updating the design spec to match.
"""

EXTRACTION_PROMPT = '''You are analyzing a YouTube video transcript to extract factual claims and
opinions about every distinct software product, tool, or service it discusses.

Video: {video_id} | "{title}" | channel: {channel} | published: {published}
Transcript lines are prefixed with [mm:ss] timestamps.

Identify every distinct tool discussed with real content (ignore a tool named
only in passing with no claims about it).

For EACH tool identified, extract:
- identity_notes: what it is, who it's for
- pricing_claims: plan, price, detail - copied exactly as spoken, never rounded or converted
- strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
- demos: things the creator actually DID on screen (not just described)
- comparisons: explicit head-to-head claims against other tools named in this video
- verdict: the creator's ranking or recommendation, with their stated reasoning

Every item carries "ts": the [mm:ss] of the transcript line supporting it.
Empty arrays are fine. NEVER invent or infer beyond the transcript.

Output ONLY a single fenced json code block, no prose before or after it,
containing an object of this shape:

{{"tools": [{{"tool_name", "aliases", "identity_notes", "pricing_claims",
"strengths", "weaknesses", "quirks", "demos", "comparisons", "verdict"}}, ...]}}

TRANSCRIPT:
{transcript}
'''

TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "tool_name": {"type": "string"},
        "aliases": {"type": "array", "items": {"type": "string"}},
        "identity_notes": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "pricing_claims": {"type": "array", "items": {"type": "object", "properties": {"plan": {"type": "string"}, "price": {"type": "string"}, "detail": {"type": "string"}, "ts": {"type": "string"}}, "required": ["price", "ts"]}},
        "strengths": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "weaknesses": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "quirks": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "demos": {"type": "array", "items": {"type": "object", "properties": {"what": {"type": "string"}, "ts": {"type": "string"}}, "required": ["what", "ts"]}},
        "comparisons": {"type": "array", "items": {"type": "object", "properties": {"vs": {"type": "string"}, "claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["vs", "claim", "ts"]}},
        "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}},
    },
    "required": ["tool_name", "identity_notes", "pricing_claims", "strengths", "weaknesses", "quirks", "demos", "comparisons"],
}

MERGE_PROMPT = '''You maintain a software DOSSIER: the single source of truth used to script YouTube comparison videos.

Tool: {tool_name}
Today: {date}

Below are (1) the CURRENT dossier and (2) {n} NEW extraction files, each distilled from one video (its publish date is in its header).

Rewrite the FULL dossier, folding in the new extractions.

Rules:
- Keep EXACTLY the section skeleton of the current dossier (same headings, same order).
- Every claim line ends with its citation: (video-id @ mm:ss, MMM YYYY) where MMM YYYY is the source video's publish month.
- Pricing: the newest source wins the table row; a conflicting older price moves to "Conflicts & open questions" with both citations. Every pricing row's As-of = publish month of its source.
- Non-pricing contradictions: keep BOTH claims in "Conflicts & open questions" with citations. Do not pick a winner.
- The same claim from 2+ videos becomes ONE line with all citations (corroboration strengthens it).
- "Screen-worthy moments": keep the most concrete, demonstrable ones, max 10, each describing what happens on screen.
- If the folded dossier would exceed ~4,000 words: prioritize corroborated (multi-video) claims; prune single-source claims from "Quirks & gotchas" and "Weaknesses" first, never from "Pricing," "Identity," or "Verdicts heard."
- Never drop a cited claim unless directly superseded; never add text without a citation.
- Update the header line: today's date, source count {total_sources}, newest source month.

Output ONLY the dossier markdown, nothing else.

CURRENT DOSSIER:
{dossier}

NEW EXTRACTIONS:
{extractions}
'''

DOSSIER_SKELETON = '''# {tool_name} - dossier
Updated: {date} · Sources: {n} videos (newest: {newest})

## Identity

## Pricing
| Plan | Price | Notes | As-of | Source |
|---|---|---|---|---|

## Strengths

## Weaknesses

## Quirks & gotchas

## Screen-worthy moments

## Head-to-head

## Verdicts heard

## Conflicts & open questions
'''
```

**Verify**: `python3 -c "
import sys; sys.path.insert(0, 'pipelines/youtube/dossiers')
import prompts
assert '{transcript}' in prompts.EXTRACTION_PROMPT
assert 'tool_name' in prompts.TOOL_SCHEMA['required']
assert 'Screen-worthy moments' in prompts.DOSSIER_SKELETON
assert 'max 10' in prompts.MERGE_PROMPT
print('ok')
"` -> `ok`

### Step 8: `pipelines/youtube/dossiers/tests/test_prompts.py`

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import prompts


def test_extraction_prompt_has_placeholders():
    for ph in ("{video_id}", "{title}", "{channel}", "{published}", "{transcript}"):
        assert ph in prompts.EXTRACTION_PROMPT


def test_extraction_prompt_formats_cleanly():
    out = prompts.EXTRACTION_PROMPT.format(
        video_id="AAAAAAAAAAA", title="T", channel="C", published="2026-01-01", transcript="hi")
    assert "AAAAAAAAAAA" in out


def test_tool_schema_required_fields():
    required = set(prompts.TOOL_SCHEMA["required"])
    assert required == {"tool_name", "identity_notes", "pricing_claims", "strengths",
                         "weaknesses", "quirks", "demos", "comparisons"}


def test_merge_prompt_formats_cleanly():
    out = prompts.MERGE_PROMPT.format(
        tool_name="Hostinger", date="2026-07-08", n=2, dossier="# old", extractions="stuff",
        total_sources=3)
    assert "Hostinger" in out


def test_dossier_skeleton_formats_cleanly():
    out = prompts.DOSSIER_SKELETON.format(tool_name="Hostinger", date="2026-07-08", n=0, newest="—")
    assert out.startswith("# Hostinger")
    assert "As-of" in out
```

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests/test_prompts.py -v` -> 5 passed.

### Step 9: `pipelines/youtube/dossiers/CLAUDE.md`

Create with exactly:

````markdown
# dossiers - persistent per-software research library

One transcript is fetched once (`videos/<id>/`); one dossier per tool
(`tools/<slug>/dossier.md`) accumulates cited facts from every video that
has mentioned it. Full design: `docs/superpowers/specs/2026-07-08-dossier-skills-design.md`.

## The three skills

1. **`transcribe`** - fallback-chain transcript fetch (captions -> Groq Whisper -> local Whisper). Callable standalone; also used by `dossier-transcripts`.
2. **`dossier-transcripts`** - batch-fetch links into `videos/<id>/` (mechanical, skips anything already fetched).
3. **`dossier-build`** - one trigger that extracts every pending video (discovering all tools it mentions) and merges the results into every affected tool's dossier, in one pass. Asks once per run which execution method (`agy` or a subagent) and model to use - never a direct paid API call.

## Layout

```
videos/<id>/       meta.json (fetch status, extracted flag, merged_into per tool) · transcript.md (gitignored) · extraction.md
tools/<slug>/      tool.json (canonical name + aliases) · dossier.md
```

## Status model

- `fetched` - transcript exists (global, independent of which tools it mentions).
- `extracted` - every tool the video mentions has been pulled into `extraction.md`; `merged_into` seeded per discovered tool.
- `merged_into.<tool>` - true once that tool's dossier has folded this video in.

A video mentioning 5 tools is fetched and analyzed ONCE; each of its 5 tools can be merged into its dossier independently, at different times.

## Hard rules

- Extraction/merge calls go through `agy` or a Claude Code subagent only - never a direct paid API.
- A tool folder is only auto-created on a genuinely new name; a near-duplicate name is held pending and flagged for the owner, never silently merged or split.
- `dossier.md` is written before `merged_into` is flipped - a crash between the two is safe to retry (see `registry.py`'s merge_guard and the `dossier-build` skill).
````

**Verify**: `grep -c "Hard rules" pipelines/youtube/dossiers/CLAUDE.md` -> `1`

### Step 10: The three skills + their symlinks

Create `pipelines/.claude/skills/transcribe/SKILL.md`:

```markdown
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
```

Create `pipelines/.claude/skills/dossier-transcripts/SKILL.md`:

```markdown
---
name: dossier-transcripts
description: Fetch transcripts for a batch of YouTube links into the shared dossiers video store (pipelines/youtube/dossiers/videos/), skipping anything already fetched. Feeds dossier-build. Triggers on "fetch transcripts for these videos", "get transcripts:", "dossier-transcripts".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# dossier-transcripts - batch transcript intake

Not an LLM task - mechanical. Input: any number of YouTube links or ids
(typically 10-25, no hard cap).

For each link:

1. Compute the video id via `common.transcribe.video_id_from(link)`.
2. If `pipelines/youtube/dossiers/videos/<id>/meta.json` already exists, skip -- note it as "already fetched" in the summary. Do not re-fetch.
3. Otherwise call the `transcribe` skill's fetch (`cd pipelines && python3 -m common.transcribe fetch <link> --out-dir youtube/dossiers/videos/<id>`), then write `pipelines/youtube/dossiers/videos/<id>/meta.json`:

   ```json
   {
     "id": "<id>",
     "url": "<original link as given>",
     "title": "",
     "channel": "",
     "published": "",
     "fetched_at": "<today, YYYY-MM-DD>",
     "transcript_method": "<captions|groq|local, from the fetch call's JSON output>",
     "extracted": false,
     "merged_into": {}
   }
   ```

   `title`/`channel`/`published` are best-effort: leave them empty strings if
   not available from the link alone -- `dossier-build`'s extraction step
   reads them from the transcript itself and doesn't require them pre-filled.

4. If the fetch call fails (all 3 transcribe methods failed), record the link as a hard failure with the error message; do not create a `meta.json` for it; move to the next link.

## Final report

One summary: `N new fetched (method used per video), M skipped (already had), K failed (reason)`.

## Related

- `transcribe` -- the fallback-chain fetch this skill calls.
- `dossier-build` -- the next step; picks up every video this skill fetches.
```

Create `pipelines/.claude/skills/dossier-build/SKILL.md`:

```markdown
---
name: dossier-build
description: Analyze every fetched-but-unprocessed video transcript (discovering every tool/software each one mentions), then fold the results into each affected tool's persistent dossier under pipelines/youtube/dossiers/tools/. One trigger does the full catch-up pass -- extract then merge, always together. Triggers on "build dossiers", "update dossiers", "dossier-build".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# dossier-build - analyze + merge, one pass

Full design: `pipelines/youtube/dossiers/CLAUDE.md`. Every invocation does
BOTH steps below, always together -- there is no separate "just extract" or
"just merge" trigger.

## Step 1 -- pick execution method + model, confirm

Check pending videos via `registry.pending_extraction()` (`pipelines/youtube/dossiers/registry.py`).

If the list is non-empty, ask the owner (one message): execution method --
`agy` or a Claude Code subagent -- and which model. Show the last choice used
(if `pipelines/youtube/dossiers/.last-method.json` exists, read
`{"method": "...", "model": "..."}` from it) as the suggested default. State
the pending video count and confirm before proceeding. After the owner
answers, write their choice back to `.last-method.json` for next time.

Never call a raw paid API directly (no direct Gemini/OpenAI REST calls) --
only `agy` or a subagent, both subscription-backed.

## Step 2 -- extract

For each video id in `registry.pending_extraction()`:

1. Read `pipelines/youtube/dossiers/videos/<id>/transcript.md` and `meta.json` (for `title`/`channel`/`published`).
2. Build the prompt: `prompts.EXTRACTION_PROMPT.format(video_id=id, title=meta["title"], channel=meta["channel"], published=meta["published"], transcript=transcript_text)`.
3. Run it with the chosen method:
   - **agy**: `agy -p "<prompt>" --output-format json --model "<model>"` (direct CLI call -- NOT `tooling/boss/executors/agy.sh`, which is built for boss's async worktree/PR workflow and doesn't fit a synchronous single-prompt call). Capture stdout, pass to `registry.parse_agy_envelope(stdout)`.
   - **subagent**: dispatch a Task/Agent-tool subagent with the prompt and the chosen model; take its final text message, pass to `registry.parse_extraction_output(text)`.
4. On a `registry.ParseError`: print one error line with the reason, leave this video's `extracted` as `false`, continue to the next video -- don't block the batch.
5. On success: write `pipelines/youtube/dossiers/videos/<id>/extraction.md` -- one `##` section per tool in the parsed `tools[]` array, using `prompts.TOOL_SCHEMA`'s field names as subheadings, one bullet per item with its `ts` leading (e.g. `- [12:34] plan: VPS 1 -- price: $4.99/mo`). For each tool in `tools[]`, call `registry.match_tool(tool_name, aliases)`:
   - `("exact", slug)` -- this video mentions `slug`.
   - `("near", slug)` -- hold this tool's data out of `merged_into` for now; add it to the run's "near-duplicate" list (candidate name + matched slug) instead of seeding a status entry.
   - `("none", slug)` -- new tool; note it in the run's "new tools" list; this video mentions `slug`.
6. Update `meta.json`: `extracted: true`, `merged_into` seeded `false` for every exact/none-matched tool slug from this video (never for near-duplicates, which stay pending until the owner resolves them -- re-run `dossier-build` after that to pick them up).

## Step 3 -- merge

For each tool slug in `registry.all_pending_tools()`:

1. Gather `pending = registry.pending_merge_for_tool(slug)`.
2. Read each pending video's `extraction.md`, take only that tool's section.
3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if the tool folder is new (create `tools/<slug>/tool.json` with `{"name", "aliases"}` from the first video's `tools[]` entry for this slug).
4. Build the prompt: `prompts.MERGE_PROMPT.format(tool_name=..., date=today, n=len(pending), dossier=current_text, extractions=concatenated_sections, total_sources=...)`.
5. Run it with the same method+model chosen in Step 1 (agy direct CLI or subagent, same as extraction). Take the raw markdown response.
6. Run `registry.merge_guard(current_text, response, pending)`. If it fails: print the reason, leave `merged_into[slug]` unchanged for every video in `pending`, move to the next tool.
7. If it passes: **write `dossier.md` first**, then flip `merged_into[slug] = true` for every video in `pending` (write-then-flip order -- a crash between these two steps just means the next run re-detects and safely re-merges those videos; the merge prompt's corroboration rule collapses a re-seen claim rather than duplicating it).

## Step 4 -- report

One summary: videos extracted (N), dossiers updated (tool names), new tool
folders created this run (for a quick accuracy scan), near-duplicate tool
names flagged (name -> matched slug, needs an owner decision), anything
skipped or failed with its reason.

## Related

- `dossier-transcripts` -- populates the videos this skill consumes.
- `pipelines/youtube/dossiers/prompts.py` -- `EXTRACTION_PROMPT`, `TOOL_SCHEMA`, `MERGE_PROMPT`, `DOSSIER_SKELETON`.
- `pipelines/youtube/dossiers/registry.py` -- all the bookkeeping/parsing/guard functions referenced above.
```

Symlink each into the root skills directory, matching the existing `yt-style-copy` pattern (`.claude/skills/yt-style-copy -> ../../pipelines/.claude/skills/yt-style-copy`):

```bash
cd /Users/kbtg/codebase/personal-stuff
ln -s ../../pipelines/.claude/skills/transcribe .claude/skills/transcribe
ln -s ../../pipelines/.claude/skills/dossier-transcripts .claude/skills/dossier-transcripts
ln -s ../../pipelines/.claude/skills/dossier-build .claude/skills/dossier-build
```

**Verify**: `readlink .claude/skills/transcribe .claude/skills/dossier-transcripts .claude/skills/dossier-build` -> three lines, each `../../pipelines/.claude/skills/<name>`.

### Step 11: Register status

Add a row for this plan to `plans/README.md`'s status table (match the existing row format) and flip it to `DONE` once Done criteria pass.

**Verify**: `grep "051-dossier-skills" plans/README.md` -> one line, status `DONE`.

## Test plan

Steps 3, 6, and 8 are the test plan. All model calls (Groq, agy, subagent) and all subprocess calls (`pp-yt-transcript`, `yt-dlp`, `ffmpeg`, `npx hyperframes`) are mocked in tests -- no network, no API keys, no venv required, matching the design spec's stated testing boundary (extraction/merge model-call *correctness* is verified behaviorally by the owner after a real run, not by pytest).

## Done criteria

- [ ] `python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q` exits 0 (23 tests: 8 in `test_transcribe.py` + 10 in `test_registry.py` + 5 in `test_prompts.py`).
- [ ] `cd pipelines && python3 -m common.transcribe --help` exits 0.
- [ ] Both `lib/asr.py` files import cleanly and expose `groq_transcribe`; neither `lib/audio.py` file was modified (`git diff --stat` shows no changes to either).
- [ ] All 3 `SKILL.md` files exist under `pipelines/.claude/skills/` with matching symlinks under `.claude/skills/`.
- [ ] No non-stdlib imports anywhere in the new code except `groq` (already a pre-existing dependency, imported lazily).
- [ ] `plans/README.md` row for 051 added and marked DONE.

## STOP conditions

- `pipelines/youtube/dossiers/` already exists with content -- stop and report.
- `tooling/cli/youtube/pp-yt-transcript` is missing or its `get --help` output no longer matches what's quoted in Current state -- stop; don't write a replacement fetcher (see `plans/runs/LESSONS.md` 2026-07-05).
- Either `lib/audio.py` file differs from the version read during planning in a way that affects `to_mp3` -- stop and report; do not modify `audio.py`.
- A file to edit doesn't contain the excerpt quoted in Current state -- stop; don't guess a new anchor.
- Any prompt/schema/guard rule seems wrong for a case encountered while testing -- stop and report; redesign is the orchestrator's job, not the executor's.
- A non-stdlib package other than `groq` is needed -- stop; stdlib-only (aside from that pre-existing dependency) is a design decision.

## Maintenance notes

- Tuning knobs: `MIN_WORDS` and `_AUTO_ORDER` (`transcribe.py`), `near_threshold` in `match_tool` (`registry.py`), the merge prompt's ~4,000-word ceiling and max-10-screen-worthy-moments cap (`prompts.py`).
- The deferred brief-assembly skill (consuming `tools/<slug>/dossier.md`) is the next planned addition -- it should read dossiers only, never `extraction.md` or `transcript.md` directly (see `CLAUDE.md`'s hard rules).
- If `npx hyperframes transcribe`'s actual default output-file convention is later documented explicitly, `_try_local_whisper`'s before/after directory-diff discovery in `transcribe.py` can be simplified to read a known filename directly -- it's written defensively now specifically because that convention wasn't confirmed during planning (see Current state).
- `agy`'s `--model` flag is not reliably honored when the requested model's quota is exhausted (returns `status:SUCCESS` with an empty response instead of erroring -- see `plans/runs/LESSONS.md` 2026-07-07). `registry.parse_agy_envelope()` already guards against this; if it fires often in practice, checking the Antigravity quota meter before a `dossier-build` run is the next mitigation.
