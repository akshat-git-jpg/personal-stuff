# Problem statement — voice↔video sync for TTS voiceover

Handoff for a fresh session. Read `CLAUDE.md` (pipeline) and this file before working.

## The system (one paragraph)
We replace a tutorial maker's male narration with a clean female TTS voice and mux it back
into the screen-recording video. Chosen engine: **IndexTTS-2**, run on **Modal GPU**
(`modal/indextts2_app.py` — the only GPU step; transcribe/chunk/assemble/mux run locally).
Pipeline: Whisper transcript → clean text → chunk → synth (clone a reference voice) →
`assemble.py` (trim + anchor + fit) → mux. Reference voice = `~/Desktop/my-ref-voices/
30-sec-soft-women/jamila-walking-30s.wav`. Last full run: `work/finaltest/` (first 8 min of a
software demo) → `engines/indextts2/output/FINAL_8min_jamila.mp4`.

## THE PROBLEM (big, unsolved)
**The voiceover does not sync with on-screen actions.** In click-along tutorials the narrator
says "click here / click there", but the new TTS voice says it a beat off from when the click
actually happens on screen. The voiceover *quality* is good; the *timing* against the video is
the blocker. This must be solved at the workflow level.

## Why it happens (root cause)
The visuals have **fixed-time events** (cursor clicks, menus appearing). The original narration
was recorded simultaneously, so it was auto-glued to those events. The instant we swap in TTS,
that glue is gone — the new phrase plays at whatever time the pipeline puts it. **TTS speech is
a different length than the original** (measured ~6% SLOWER → voiceover ran 167s vs a 158s
video), so phrases drift LATE and accumulate.

## What's already built (and its ceiling)
`assemble.py` currently does: per-clip trim (kills onset breath), **anchor each ~22s CHUNK to its
original timestamp**, **gap-normalize** (clamp inter-chunk silence to [0.18s, 0.42s]), and
**`--fit`** (one UNIFORM pitch-preserving `atempo` so the last word lands within the video length).
This gives roughly **±1–2s global** alignment — good enough for talking-over-screen, **NOT tight
enough for click-along.** It operates on CHUNKS (merged sentences) and fits GLOBALLY, which is too
coarse for per-action sync.

## Two facts that constrain any fix (learned the hard way)
1. **"Slow down the TTS" makes sync WORSE.** The voice is already slower than the original;
   slowing it pushes every phrase later → bigger click-lag. (Slowing only helps clarity, not sync.)
2. **Gaps are one-directional.** Adding silence pushes a phrase later (easy, natural). Pulling a
   phrase EARLIER only works until the gap hits zero — and since TTS runs long, "earlier" is the
   direction we mostly need. So gaps must be paired with a tiny targeted speed-up (NOT global slow).

## Solution options (all perspectives, pros/cons)

**A. Warp audio to the video — per-sentence sync (no recording change)**
Anchor EACH original sentence to its own timestamp (we have word-level timestamps from Whisper in
`work/*/transcript.json`; `segments.json` already has per-sentence start/end). Early → pad gap;
late → remove silence, then a tiny capped per-sentence `atempo`.
- ✅ Fully automated, spokesperson changes nothing. ✅ Sync ±2s → ~±0.3s (sentence-level).
- ❌ Not frame-perfect: a click MID-sentence can still be slightly off (TTS sets its own
  word pace within a sentence). ❌ Per-sentence tempo varies slightly; more seams than chunking.

**B. Warp the video to the audio**
Keep the voice pristine; insert micro **freeze-frames** or trim dead screen-time between actions so
visuals wait for the voice.
- ✅ Best audio (no stretching). ✅ Invisible on static screens.
- ❌ Changes video length; needs safe cut-point detection (non-trivial build).

**C. VO-first — record the screen TO the finished voiceover (recording change)**
Lock the script → generate final TTS → spokesperson plays it in headphones and performs the clicks
to match. Human matches machine.
- ✅ **Frame-perfect sync.** ✅ Best audio. ✅ Kills transcript/pronunciation errors (script locked
  first → Whisper drops out of the pipeline entirely).
- ❌ Changes how the spokesperson records; re-record screen if script changes. ❌ Needs scriptable
  content (tutorials usually are).

**D. Word-level anchoring**
Detect the action word ("click") in both original (Whisper word timestamps) and TTS output, pin it
to the exact event time, warp locally.
- ✅ Tightest automation. ❌ Fragile, complex, artifact-prone.

## Recommendation (from the prior session)
Build **A + B (per-sentence sync)** as the automated baseline — biggest improvement, zero
disruption to recording — and **re-render the `work/finaltest/` video** to compare against the
current `FINAL_8min_jamila.mp4`. Then judge:
- Sentence-level tight enough → done.
- Still need frame-tight clicks → adopt **C (VO-first)**; it is the ONLY thing that gets truly
  word-perfect, and it also removes the transcript-error class.

User leans toward keeping the current dub flow (option A), but the honest ceiling of any automated
approach is sentence-level. Frame-perfect ⇒ C.

## Where to build it
- `pipeline/assemble.py` — today anchors CHUNKS + global `--fit`. For per-sentence sync, anchor at
  the SEGMENT level (feed `segments.json`, not `chunks.json`, to synth so each sentence is its own
  clip), and replace global fit with asymmetric per-sentence correction (pad-if-early /
  trim+micro-speed-if-late). Seams handled by existing `trim_clip` + fades.
- `pipeline/chunk_segments.py` — chunking trades sync tightness for fewer seams; per-sentence sync
  wants finer granularity, so this may be bypassed or set to 1-sentence chunks.
- `modal/indextts2_app.py` — synth is per-segment already (`{id,text}` contract); supports
  `interval_silence` (use 80ms) and `emo_text`. Re-synthing `segments.json` instead of
  `chunks.json` = more clips but enables per-sentence anchoring.
- Inputs for the test: `work/finaltest/segments.json` (93 segs, cleaned), `transcript.json`
  (word-level timestamps), `video.mp4` (480s).

## Open question for the user
Will the spokesperson record the screen TO a finished voiceover (enables C, frame-perfect), or must
we keep the record-then-dub flow (caps us at A, sentence-level)? This single answer determines the
ceiling.
