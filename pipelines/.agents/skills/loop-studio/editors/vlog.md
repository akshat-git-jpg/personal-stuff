# Editor: VLOG — assemble a cinematic vlog from raw footage + monologue

Use when the input is a shoot's worth of raw clips + talking-head monologue (e.g. the canoe trip).

## Inputs
- Raw clips (ingested via `broll-ingest` → two-tier metadata: lean feed + per-clip sidecars).
- The monologue is the spine (voice-first). No separate script needed — pull it from the transcripts.

## Recipe
1. **Ingest** (`broll-ingest`): transcode to HEVC, build stills + word-level transcript + descriptions.
   Keep horizontal only unless told otherwise.
2. **Read the core first:** `core/brand/brand-book.md` + `video-taste` (`universal.md` + `by-type/vlog.md`
   + `by-subject.md`). Apply to the FIRST cut.
3. **Story:** build a coherent, roughly chronological storyline from ALL the monologue; don't chop
   sentences to fit. Write it into `plan.json` beats (VO clip + text + seg per beat, shots per beat).
4. **Assemble** with the engine (currently `render_film.py` → will move to `core/engine/`):
   voice-first cut, waveform-clean boundaries (`snap_onset`), coverage from real footage capped ~4s/shot,
   per-shot exposure fix on blown clips, word-synced captions, brand grade, ambient muted under VO,
   sidechain-ducked music, end-screen credits.
5. **Review loop** (`video-feedback`): publish, share URL, "feedback done" → fix + check off + ask if vague.
6. **Learn:** fold general lessons into `video-taste`.

## Config (`video.json` — lives next to plan.json; REQUIRED by the engine)
```json
{ "library": "<ingested library root: _catalog.json + _meta/sidecars>",
  "media_root": "<base for catalog library_path entries>",
  "output_dir": ".", "resolution": [1920,1080], "fps": 25,
  "grade": "nordic" | "none" | "<raw ffmpeg filter>",
  "music": { "file": "...", "start": 0, "fade_in": 2, "fade_out": 5 },
  "captions": { "overrides": { "CLIP": ["line1", "line2"] } },
  "end_screen": { "clip": "...", "in": 7.0, "dur": 6.8, "credits": ["..."] },
  "backup_dir": null }
```
Run: `python3 core/engine/vlog/render_film.py <plan.json> <LABEL> [video.json]`
Worked example: `loop-studio/projects/no-signal/` (video.json + plan.json reproduce
Luuk's NO_SIGNAL v17 render byte-for-duration — the generalization acid test).

## Known engine controls (per-shot, in plan.json)
- `hold` (face duration), `in`/`out`, `exposure` (negative darkens a blown shot),
  `dim`/grade presets, `tail_at` (hard VO end), `prebuilt_wav` (spliced VO).

See `video-taste/by-type/vlog.md` for the taste rules specific to this mode.
