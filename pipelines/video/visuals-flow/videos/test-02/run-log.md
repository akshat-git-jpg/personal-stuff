# test-02 run log

Video: 5-tool automation comparison (n8n / Make / Zapier / LangChain / Flowise), 36:09 VO.
Source: Drive folder `1-ECopO9eU_cvLjvmNwC1LkiSXJ73C4rC` (intro/body/conclusion.mp4, 1080p30, main voice embedded).
Screen recording is PROVISIONAL — boundary-motion re-record will replace screen.mp4 later (same VO).

## Step timings (2026-07-20)

| step | wall clock | duration | notes |
|---|---|---|---|
| Drive download (155MB, 3 files) | 10:26–10:28 | ~2 min | via google-drive MCP |
| concat + vo.mp3 extract | 10:28–10:29 | ~1 min | stream-copy concat had a DTS glitch at join 1 — discarded |
| 010 transcribe (local whisper fallback) | 10:29–10:31 | ~2 min | Groq rejected own output (1 word, 60ms overlap) → small.en fallback, 5526 words |
| screen.mp4 re-encode concat | 10:31–10:35 | ~4 min | h264_videotoolbox 8Mbps, 30fps, 710MB; boundaries decode clean |
| logo seeding (5 slugs) | 10:37–10:39 | ~2 min | n8n, make, zapier, langchain, flowise via fetch-logo.mjs; visually verified |
| Groq transcript retries | 10:45–11:31 | ~45 min elapsed (mostly quota waits) | 3 windows: socket drop → clamp-cap too strict (61 tiny overlaps vs cap 10; response discarded, fix: cache raw + cap 2%) → SUCCESS 11:31 (5543 words, 61 clamps ≤0.52s) |
| brand normalization | 11:31–11:34 | ~3 min | 67 single words + 7 pair-merges (flow wise→Flowise, lang chain→LangChain, Chad/chat GPT→ChatGPT) + 12 singles (CHIGBT, FlowEyes, Langsmith); text only, timings untouched, pre-cue-pass; raw kept at transcript.groq-raw.bak.json |
| 020 cue pass (in-session, Fable) | 11:34–11:42 | ~8 min | 33 cues drafted → 3 lint rounds → 32 cues clean (1 overlap fixed, 1 exclusion-zone drop) |

## Token usage (estimates — measured where possible)

| item | estimate | basis |
|---|---|---|
| 020 cue-pass input | ~13k tokens | prompt ~1.5k + catalog ~5k + transcript 5526 words ~7k |
| 020 cue-pass output | ~4.4k tokens | cues.json 17.6KB / 4 |
| board feedback fold (4 items → rules + cards + lint) | ~30 min | 5 rule surfaces edited, 4 cards patched, W5 lint added, transcribe-groq hardened; gates: rulebook ok, 28 lib tests pass, beat-smoke OK ×2 |
| card re-render + frame verify (c01/c24/c29/c33) | ~2.5 min | 4 cards rendered with real vars, frames inspected — logos + units + populated tables + dual trophy all confirmed |
| r2: title glass chips + Make transparent SVG logo | ~15 min | aurora-wave white boxes → dark glass; logos-inline gained SVG support; frame-verified |
| r2: NEW winners-podium card (scalable 2-4) | ~25 min | built + cataloged + linted; frame-verified at 2/3/4 winners; c32/c33 merged into one co-winner cue; beat-smoke counts bumped; all gates green |
| r3: Make logo board-break fix | ~5 min | SVG data-URI failed in board browser → rasterized to transparent PNG (rsvg-convert); fixes title/table/section/podium at once |
| r3: podium timing + confetti wrap | ~5 min | both co-winners re-anchored to reveal ~2s/4s (was only n8n in-window); confetti wraps + 20s timeline; frame-verified |
| r3: intro → cinematic-float, uniform tiles | ~10 min | c01 moved to cinematic-float; glass tiles + registry logos + fixed 58% logo footprint = identical rectangles; frame-verified |
| r3b: board restart + confetti bounds | ~5 min | board was serving stale enrichLogos (logos → text) + old slice; restarted, verified via curl (5 logos injected, slice 18.14s); podium confetti clamped strictly inside frame → no overflow badge |
| r3c: labeled tiles (logo + name) | ~5 min | cinematic-float tiles show logo box + tool name, uniform 196x218, symmetrical, generic/scalable; frame-verified |
| 050 graphics render (32 clips) | started ~13:30 | in progress | full-quality clips → renders/ + manifest.md |
| --corner-range flag build + test | ~10 min | avatar-render.mjs gains --corner-range start:end (renders corner bubble for a window, not whole VO); 2 tests added, 7/7 pass |
| shot plan (corner-only) | ~2 min | shots.json = zero full-screen spans (owner: no full-video avatar for this test), approved; resolve+lint clean |
| 050 graphics render COMPLETE | done | 32 clips (19 fullframe mp4 + 13 overlay mov), all ffprobe-valid; manifest.md at videos/test-02/ (NOT renders/ — path gotcha) |
| avatar corner submit + download | done | corner-01 specs-man test mode, meter UNLIMITED (free); HeyGen completed 100%; clip 180s/1080p/126MB, verified = specs-man avatar |
| 090 draft assembly (provisional screen + bubble) | done | final-draft.mp4 36:09/720p; bubble ✓ intro-tiles ✓ dual-winner podium ✓; FOUND caption bug (0,0,0,, garbage) |
| caption ASS Format bug fix | done | assemble.mjs [Events] Format was 5 fields vs 10-field Dialogue rows → libass rendered margin fields as text; fixed to standard 10-field Format, verified standalone. NOT re-assembled yet (holding for owner effects review) |
| 070 shot-pass input | n/a this video | owner opted out of full-screen spans; corner bubble only |

Session-level token totals aren't directly meterable from inside the session;
per-pass input/output sizes are logged here as chars/4 estimates.

## Decisions / deviations

- Transcript: Groq output has correct brand spellings (local whisper garbles
  "Flowise"→"Flowwise" 29x, "LangChain"→"lang chain" 15x, and captions burn
  transcript words verbatim). Groq's only defect is one 60ms non-monotonic word
  start that the GFX-04 validator rejects outright — one-off clamp applied via
  session script, same validation re-run after. Local transcript kept at
  transcript.local-whisper.bak.json. FOLD CANDIDATE: validator should clamp
  tiny (<0.25s) overlaps instead of rejecting the whole transcript.
- FOLD CANDIDATE: cue-pass-prompt "Seeded slugs" line hard-codes test-01's
  logos; should derive from logos/registry.json. This run: list extended
  in-session at paste time, committed prompt untouched.
- HeyGen: HeyGen 3 only (standing hard rule; engineMode "test").
- Template (owner-confirmed 2026-07-20): `specs-man` — owner supplied template
  id ac366a12ded942989d22735c23f3794d ("man with specs"); registered on the
  existing specs-man entry in pipelines/video/heygen/registry.json.
- Corner bubble (owner-decided 2026-07-20): 3-minute TEST ONLY at the start of
  the body section (~1:54-4:54 VO time), not the full-VO corner track — owner
  reviews the bubble look before committing render minutes to 36 min of corner
  chunks. planCornerChunks() has no range option (always full VO), so the test
  clip will be hand-sliced + submitted via heygen-web directly and its job row
  appended to avatar-jobs.json with correct start/end (bubbleSlices() handles
  partial corner coverage by design — it only composites where clips overlap).
  FOLD CANDIDATE: --corner-range flag for avatar-render.mjs.
- Bubble review (owner, 2026-07-20): first draft REJECTED — read as a rectangle
  with a small, lifeless circle inside. Root causes + fixes in decisions.md
  (clipped glow canvas, half-size bubble from a misread reference measurement,
  invisible-because-too-thin rotating ring). Retuned to the Youri proportion
  (D 150→300, inset 40→24, glow sigma 6→3 and now height-scaled).
- Bubble pass 2 (owner, 2026-07-20): owner compared against a high-zoom
  reference still; ring re-measured there (NOT off the moment contact sheets,
  which blur a hairline into ~10px). Ring 10→5px, split into crisp core + bloom,
  gleam sharpened to a localised ~±40° bloom, and framing un-deferred — zoom 1.3
  + focus-point crop puts the head at ~73% of the circle like the reference.
  Details in decisions.md. Owner reviewed and chose: KEEP brand orange (the
  green ring is a deliberate difference, not a gap), and HOLD re-rendering
  until the sample look is signed off.
  For review: `~/kb-scratch/video/visuals-flow/test-02/bubble-sample-20s.mp4`
  + `bubble-vs-reference.png` (side-by-side at matched scale).
  AVATAR_ZOOM/FOCUS are tuned for `specs-man`; retune for other templates.
- Bubble pass 3 (owner, 2026-07-20): pass 2 REJECTED — owner spotted the actual
  structure: reference is a THIN circle with a THICK soft curved bloom moving
  around it, where passes 1-2 both made the gleam a colour shift inside a
  fixed-width ring (so the ring never varied in width and never read as
  motion). Confirmed by radial profiles at the gleam angle vs away from it —
  two different shapes, see decisions.md. Ring is now two layers: constant
  hairline + a ~2x wider alpha-shaped travelling bloom.
  For review: `bubble-sample-20s.mp4`, `bubble-vs-reference.png` (side-by-side),
  `bubble-gleam-cycle.png` (4 frames = one full 4s rotation), all in
  `~/kb-scratch/video/visuals-flow/test-02/`.
- Bubble pass 4 (owner, 2026-07-20): pass 3 still looked off. Measured the
  RENDER rather than reading the code: hairline was 2.3x too thick, so the
  gleam/hairline width ratio was 1.19x vs the reference's 2.40x. Fixed the
  band-width bug (`R-RING-1..R+1` is RING+2 wide) and stopped rounding ring
  widths to whole pixels. Now 2.50x vs 2.40x — matched. `scripts/measure-bubble-ring.py`
  is checked in; re-run it after touching any ring constant.
  NOT DONE: neither the 3-min corner test nor the 36-min draft has been
  re-assembled with the new bubble — waiting on owner sign-off of the sample.
