# B-roll Selection Rules (LOCKED — Luuk's bar)

B-roll exists to be dropped into an edit at the exact second the voiceover needs
it. An editor grabs a clip named for a moment and expects frame 1 ≈ that moment.
Every second of dead lead-in is manual trimming later — which defeats the point
of a ready-to-use library. Select MOMENTS, not regions.

## Selection (in order of importance)
1. **Select MOMENTS, not regions.** Per scene ask: what would an editor actually
   use? A rally START, mid-rally exchange, the laugh after, the sit-DOWN, the door
   OPENING. Name the clip after that moment and make the moment the clip.
2. **Open ON the action.** First frame is the action already starting (door
   swinging, foot stepping in) — never an empty frame or wind-up pause. The action
   may begin ~0.2–0.4s in, max.
3. **No camera-glances at the start.** Talent looking into the lens = pre-action
   staging; start after the glance breaks (unless the glance IS the moment).
4. **Cut pauses out of transitions.** Walk-to-chair-then-pause-then-sit: keep a
   short natural beat, re-window or split an awkward hold.
5. **Understand the scene first, then cut.** Write the story beats of each raw
   (who enters, what happens, the punchline); derive selects from beats — never
   "middle 20 seconds looks busy".
6. **Verify frame 1 of every select** (one frame-grab per file — extract_select.py
   writes it automatically) before calling an ingest done. The start is the most
   important frame of the whole clip.

## Hard rules
- **Split-rule:** a sit-down→work→stand-up arc is NEVER one clip. Cut two
  overlapping selects: (1) entry beat (sit-down + work), (2) exit beat (work +
  stand-up). Apply to every arrive/do/leave arc.
- **Apex rule:** any action clip (rep, throw, serve, jump) MUST contain the visible
  apex — chin over bar, ball contact, full extension. If you can't name the apex
  timestamp, you haven't found the moment. Dark footage hides motion → map the
  suspected window at ≥1 fps (3 fps around the action) with `frame_map.py --dense`.
- **The rep IS the clip.** "Walking toward the equipment" / "lying under the bar" /
  "standing near the work" is NOT a select. End the clip AFTER the payoff, never
  just before it (don't cut the moment the jump/ride starts).
- **A camera move can BE the clip.** One deliberate tilt-up-into-the-sun = the
  select is exactly that move, start-to-settle. Not a window containing the move
  plus drift.

## Orientation (HARD RULE)
Every select carries `orientation: vertical|horizontal`. **Vertical clips are
NEVER b-roll in 16:9 horizontal edits** — shorts/reels/vertical ads only.
Horizontal → 9:16 smart-crop is fine; vertical → 16:9 never. `catalog_update.py`
probes and records this automatically (incl. rotation side-data). Filter on
orientation FIRST when assembling any b-roll plan.

## Numeric gates (work even when visual review can't)
- **Exposure:** after grading, `signalstats` YAVG on a mid frame. Bright outdoor
  ~120–155; >180 = blown → `--exposure -0.3..-0.5` BEFORE the LUT, re-measure.
- **White balance:** warm tungsten gyms — R−B mean ~+20–25; +40 = too orange →
  `--warm-fix` (colorbalance) pre-LUT.
- **Shot matching:** harshly lit shots need per-clip eq (brightness/contrast)
  BEFORE the look-LUT. The LUT is the global look, not per-shot correction.

## Stabilization (selective only)
Score every clip with `shake.py` (phase-correlation jitter, px @ 480w):
jitter > 5 = visibly shaky, > 10 = very shaky. Stabilize with two-pass vidstab
(`vidstabdetect=shakiness=8:accuracy=15` → `vidstabtransform=smoothing=14:optzoom=1:
interpol=bicubic:crop=keep,unsharp=5:5:0.6:3:3:0.3,format=yuv420p`) on the already-
graded file (do NOT re-apply the LUT). **CRITICAL: re-score after, ship ONLY if
jitter dropped.** vidstab helps locked/handheld-static shots but HURTS deliberate
camera moves (pan/push-in/walk-follow) — it fights the intended motion and jitter
goes UP. Tag kept clips `stabilized: true`.

## Operational gotchas
- `format=yuv420p` after any `lut3d`/`drawtext` or QuickTime can't open the file.
- ffmpeg/ffprobe in a bash `for` loop need `</dev/null` per call (they eat stdin
  and silently write 0-byte files otherwise). The scripts here already pass
  `stdin=DEVNULL`.
- S-Log3 vs Rec709: check the Sony XML sidecar `CaptureGammaEquation`. Log footage
  → `--lut slog3`; NEVER the plain Rec709 FINAL LUT on log (flat/grey result).
- Cut + grade in ONE pass (`grade.py --start/--end`) so each file uploads to Drive
  exactly once. DriveFS can dematerialize uploaded raws — re-cut from the SD
  original if a raw turns into a tiny stub.
