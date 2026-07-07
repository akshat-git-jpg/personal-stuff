# HANDOVER — tutorial-pipeline-2 (for a fresh Claude session)

## What this is
A linear pipeline that turns a topic into a **published-ready tutorial draft cut**:
research brief → freelancer screen recording → clean script → brand-voice voiceover →
avatar clips → rendered graphics → auto-assembled cut. As of the v3 flow (2026-07-05) the
editor role is optional QC: assembly is deterministic (see the timing spine in `PIPELINE.md`
and the design in `SPEC.md`).

- **Location:** `personal-stuff/pipelines/youtube/tutorial-pipeline-2/` (tracked in git).
- **Read first:** `PIPELINE.md` (the ordered map), then `SPEC.md` (v3 design). Each step folder has a `README.md`.
- **v3 build status:** new steps 105/125/135/162 are stubs; `plans/011-tutorial-pipeline-v3.md`
  (repo root) implements them plus 040's segment-map output.

## The pipeline (24 steps, 000–170)
**The full step list is in `PIPELINE.md`** — the canonical map. Not duplicated here so the two
docs can't drift. Actor suffix on each folder: `-run` (script) · `-antigravity` (paste prompt) ·
`-sonnet` (Claude Code on Sonnet) · `-human` (gate). The shape, in one breath:

- **000** research brief (Antigravity) → **010** Drive folders → **015** freelancer records per the brief
- **020–040** transcribe / clean / polish script **+ segment map** → **050** approve script
- **060–070** plan + approve avatar blocks (pre-spend gate) → **080** synthesize voice → **090** plan corner parts
- **100** trim → **105** voice auto-QC → **110** approve flagged chunks → **120** timestamps → **125** assembly plan
- **130–140** plan + build + approve graphics, in parallel with **150–160** HeyGen submit + download
- **162** auto-assemble draft cut → **165** QC the cut (fix flags only) → **170** package for handoff

## Architecture & conventions
- **Each step owns its `output/`**; a step reads `../<prev>/output/…` and writes `./output/…`.
- **×10 numbering (010, 020, …, 170)** — zero-padded 3 digits so folders sort in run order; insert a
  `015-…` between 010 and 020 without renumbering. Add `<NNN>/` with a `README.md` + `run.py` or
  `rulebook.md` + `output/`, add a PIPELINE.md row. Done.
- **`lib/`** (importable; each `run.py` does `sys.path.insert(0, ROOT)` then `from lib import …`):
  `audio.py` (dur/mmss/to_mp3/concat), `asr.py` (Groq), `chunking.py` (sentence-pack + avatar-aware
  `chunk_segments`), `modal_tts.py` (the Modal call), `heygen.py` (submit/fetch client),
  `drive.py` (pp-drive wrappers — steps 010 + 160 + 170).
- **`shared/`**: `pronunciation-map.md` (grows), `ref/jamila-30s.wav` (brand voice),
  `heygen_config.py` (the editable HeyGen knobs), `heygen-session.json` (gitignored creds you supply).
- **Two avatars, two flows:** **A4** = full-screen HeyGen 4 (short impactful blocks; intro, verdicts,
  conclusion; ~5-min budget, U-curve). **A3** = corner Avatar III talking-head over the *whole* video.

## Key decisions (why it's built this way)
- **Avatar blocks decided BEFORE TTS (step 060+070)** because each block's audio is extracted
  separately, so synthesis must break on block boundaries (`chunk_segments`). Corner parts decided
  AFTER synth (step 090) by grouping real chunk durations — no estimation risk.
- **Corner chunking = group whole TTS chunks (sentence boundaries), NOT silence detection.** We
  generate the audio so we already know clean boundaries. Silence detection was tried and removed
  (TTS only has ~0.1–0.16s gaps; unreliable).
- **Corner cap = 7 min (420s)** — a QUALITY guard (long continuous avatar renders hallucinate), not
  the API limit (Avatar III = 30 min on Creator). Config: `heygen_config.py FLOWS['a3']['max_render_seconds']`.
- **HeyGen via WEB SESSION for BOTH flows** (official API has limits that make it useless here).
  Ban-risky → heavy anti-ban: concurrency 1, randomized human gaps, settle breaks, optional
  `max_per_run` cap, one reused session, **no polling**, back-off.
- **Submit (150) and download (160) are separate steps.** Step 150 submits & stops; you eyeball
  HeyGen; step 160 (a HUMAN gate, since there's no polling) downloads the finished `.mp4`s —
  `check.py` is the per-render checklist, `download.py` the scripted fetch once the API is wired.
  Submit only depends on steps 080/090, so it can start as soon as the voice is approved (110).
- **Parts kept SEPARATE** (no stitching) — the editor combines in their NLE.
- **Drive folder creation (010) is split from upload (170).** Step 010 makes the empty tree up front;
  step 170 `--drive` only uploads files into it (creates nothing). Pass the SAME `--title` to both.

## CURRENT STATE
**Verified working (local only — no GPU/HeyGen spend):**
- All step scripts parse; `lib` + `shared` imports resolve; Modal app path resolves.
- Steps 080/090/100/120 ran on a real video (**BODY_2**). Step 090 grouped 21:30 → 4 parts (≤7 min).
- Step 170 builds the Drive-style local tree (tested).
- **Drive CLI** (`personal-stuff/tooling/cli/drive/pp_drive.py` + `pp-drive` wrapper) works:
  authed accounts include **kushalbakliwal25@gmail.com**; `find-folder "video production"` = empty.
- **Renumbered to ×10 (010–170)** and **renamed the top folder → `tutorial-pipeline-2`**
  (2026-06-30). All paths/refs updated; everything still compiles.

**STUBBED — needs you to fill from a HAR (search `TODO[HNS]` in `lib/heygen.py`):**
- `WebSessionBackend.submit` — the unlimited render-submit endpoint (NEVER captured; Preserve-log
  was off in old HARs). Needs the api2.heygen.com render POST + payload + session headers.
- `WebSessionBackend.fetch` — status/download by video_id (used by step 160 `download.py`).
- Also set real `avatar_id`s in `shared/heygen_config.py` (currently `REPLACE_WITH_…`), and drop your
  session export at `shared/heygen-session.json`.

**Drive flow (DONE — folder creation split out from upload):**
- **Step 010 `create-drive-folders`** creates the empty handoff tree in Drive under `video production/<title>/`
  and writes `output/<title>.drive-folders.json` (relpath → folder id). Run first, with `--title`.
- **Step 170 `--drive`** reads that manifest and uploads each produced file INTO the existing folders —
  it creates no folders (errors with the exact step-010 command if the manifest is missing). Pass the
  SAME `--title` to both. Both shell out via `lib/drive.py` → `pp-drive`.
- Verified locally: both compile, step 010/170 `--help`, local-tree build, and the missing-manifest
  error path. NOT yet run live against Drive (creates folders + uploads ~54MB) — needs your OK.

**Avatar submit/download split (DONE):**
- Step 150 submits only (no `--mode download` anymore). Step 160 owns downloading: `check.py`
  (manifest checklist) + `download.py` (scripted fetch, blocked on the `fetch` stub). Step 170 reads
  the avatar `.mp4`s from step 160's `output/videos/`.

## Important constraints / gotchas
- **Don't run TTS (step 080, Modal GPU ≈ $0.45–0.50/run) or HeyGen submit without explicit OK** —
  both cost money / carry ban risk. Local steps (chunking, trim, packaging) are free.
- **BODY_2's existing outputs predate the avatar-aware flow** — it was synthed before step 060/080
  avatar segmentation existed, so `080/output/avatar-audio/` (A4 per-block) does NOT exist for it.
  A3 corner parts DO exist (step 090 ran). A fresh video through 060→070→080 produces both.
- Modal is authed (profile `akshatpatidar17`); IndexTTS-2 weights volume `indextts2-models` is
  populated (one-time download already done).
- `RUNLOG.md` (in step 080) logs synth cost/time per video.
- Groq key lives in `~/.zshenv` (non-interactive shells read it). It was once pasted in chat —
  worth rotating.

## Likely next tasks
1. Live-test the Drive flow (with OK): step 010 `--title …` to create folders, then step 170 `… --drive` to upload into them.
2. Fill the two HeyGen `TODO[HNS]` stubs from a Preserve-log HAR; set avatar_ids + session file.
3. Run a fresh video end-to-end through the avatar-aware flow (060→070→080→090) to produce A4 per-block audio.
4. Consider committing `TY/youtube/` (currently untracked).
