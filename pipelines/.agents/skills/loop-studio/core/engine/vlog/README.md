# Vlog engine (promoted from the canoe-trip edit, v17 state)

`render_film.py` — voice-first vlog assembler. Proven on NO_SIGNAL (17 versions).
Usage: `python3 render_film.py <plan.json> <OUTPUT_LABEL>`

What it does: waveform-clean VO cuts (snap_onset, gap-aware boundaries), coverage-aware
b-roll fill capped ~4s/shot, per-shot `exposure` fix, word-synced captions, grade, ambient
mute on speech clips, sidechain-ducked music, end screen. Per-shot knobs in the plan:
`in/out`, `hold`, `exposure`, `tail_at`, `prebuilt_wav`. See `example_plan.json`.

## ⚠️ NOT YET GENERALIZED — do this on the next vlog, not speculatively
Still hardcoded from the canoe edit: MEDIA path + _catalog.json location, the nordic GRADE,
music file, 16:9/25fps, caption style. Generalization = move these into projects/<name>/video.json
and read brand defaults from core/brand/brand-book.md. Test against a REAL second vlog.
