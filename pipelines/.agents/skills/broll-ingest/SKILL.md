---
name: broll-ingest
description: Ingest a raw video clip into the b-roll library — pull dense timestamped frame maps, FIND the editorial moments, frame-accurately cut each select, color-grade it with the BuildLoop cinematic LUT, and catalog it. TRIGGER when the user hands a raw clip (or a folder of raws / an SD card) and wants the good moments found, cut, graded, and added to the library — phrases like 'ingest this clip', 'find the interesting parts of this video', 'pull the good moments', 'cut b-roll from this', 'grade and catalog this footage', 'add this to my b-roll library', 'which parts of this are usable'. This is the b-roll SELECTION + GRADE + CATALOG pipeline. It feeds the library that video-edit pulls from. NOT for cutting a talking-head script (that's video-cut) or editing a finished video (that's video-edit).
---

# B-roll Ingest — Find Moments · Cut · Grade · Catalog

Turns a **raw clip** into **ready-to-drop-in b-roll**: dense frame maps → pick the
editorial moments → frame-accurate cut → BuildLoop cinematic grade → catalog entry.
The catalog is the searchable brain that [`video-edit`] queries when it places b-roll.

This is the pipeline that used to be a manual ffmpeg workflow — now packaged so
"ingest this clip" is one flow. The selection bar is non-negotiable: see
[knowledge/selection_rules.md](knowledge/selection_rules.md). Read it before cutting.

## The library (where things live)
```
Media/                                   (~/Library/CloudStorage/GoogleDrive-…/My Drive/Media)
├── raw-ingest/YYYY-MM-DD_<shoot>/        originals, untouched, SACRED
├── broll-library/<category>/            trimmed + graded, ready-to-drop-in
└── _catalog/broll_catalog.json + .md    THE searchable brain
```
Categories are brand-pillar moods (NOT per-campaign): **freedom · grind · machine ·
details · people · place · product**. Specifics live in filenames + catalog tags.
Filename convention: `<category>_<moment-slug>_<sourceID>.mp4`
(e.g. `details_tie-running-shoes_C0415.mp4`).

## Pipeline (repeat per clip)
1. **Probe gamma + orientation.** Check the Sony XML sidecar `CaptureGammaEquation`
   — S-Log3/S-Gamut3.Cine → grade with `--lut slog3`; Rec709/bt709 → `--lut final`.
   NEVER the Rec709 LUT on log footage.
2. **Frame map** — `python3 scripts/frame_map.py RAW.mp4` (1 frame/2.5s, timestamped,
   tiled). Dark/low-contrast footage hides motion → `--dense` (1 fps) and re-map the
   suspected action window at `--fps 3` with `--window START END`.
3. **Find the moments** — review EVERY sheet. Write the story beats, then derive
   selects (one raw → 0–4 selects). Apply [selection_rules.md](knowledge/selection_rules.md):
   open ON the action, contain the apex, split arrive/do/leave arcs, end after the
   payoff. If you can't name the exact second of the moment, you haven't found it.
4. **Cut + grade** (one pass = one upload):
   `python3 scripts/grade.py RAW.mp4 broll-library/<cat>/<name>.mp4 --start S --end E [--lut slog3]`
   Add per-shot fixes BEFORE the LUT when needed: `--exposure -0.4` (blown sky),
   `--warm-fix` (tungsten gym), `--eq 'brightness=-0.05:contrast=1.1'`.
   (Use `scripts/extract_select.py` instead if you want the raw moment ungraded.)
5. **Verify** — eyeball the auto-written `.frame1.jpg` (frame 1 = the action, not an
   empty frame / camera-glance) and the printed YAVG / R−B numbers (re-grade if blown
   or too orange — see the numeric gates).
6. **Stabilize (only if it helps)** — `python3 scripts/shake.py FILE` to score jitter;
   stabilize shaky LOCKED shots, re-score, ship ONLY if jitter dropped. Never on
   deliberate camera moves. Tag `stabilized: true`.
7. **Catalog** — `python3 scripts/catalog_update.py --catalog <…/_catalog/broll_catalog.json>
   --file broll-library/<cat>/<name>.mp4 --raw raw-ingest/<…> --category <cat>
   --desc "…" --tags a,b,c --in S --out E --rating N`. Orientation is probed + recorded
   automatically.

## Scripts
| Script | Does |
|--------|------|
| `scripts/frame_map.py` | Dense timestamped contact sheets to find moments (chunked for long clips, `--dense`/`--window` for dark action) |
| `scripts/extract_select.py` | Frame-accurate raw cut + frame-1 proof grab |
| `scripts/grade.py` | BuildLoop LUT grade (+ optional pre-LUT exposure/WB fix, cut-in-one-pass, `--measure`) |
| `scripts/shake.py` | Phase-correlation jitter scorer + vidstab recipe |
| `scripts/catalog_update.py` | Append a graded select to the catalog; probes orientation |
| `luts/` | The approved grades: `buildloop-FINAL[-soft]` (Rec709), `buildloop-FINAL-slog3[-soft]` (S-Log3) |

## Where this sits in the video stack
- **`video-cut`** — cuts a multi-take talking-head recording to the best takes (script-driven).
- **`broll-ingest`** (this) — finds + cuts + grades + catalogs b-roll MOMENTS from footage.
- **`video-edit`** — edits a pre-cut video end-to-end (captions, templates, zooms,
  music/SFX, its own comp color-grade) and pulls b-roll from the catalog this builds.

## Requirements
`ffmpeg`/`ffprobe` on PATH; Python 3 with `opencv-python` + `numpy` for `shake.py`
(`pip install opencv-python numpy`). The LUTs ship in `luts/` — self-contained.
