# SPEC — tutorial pipeline v3 (deterministic assembly, local-only)

**Date:** 2026-07-05
**Status:** design approved; step scaffolds in place; implementation via `plans/011-tutorial-pipeline-v3.md`
**Companion docs:** `PIPELINE.md` (run order), `HANDOVER.md` (v2 machinery status)

## 1. Goal

Produce tutorial videos at the current quality bar with three dependencies removed:

1. The owner as human middleware: in v2 every `[CLAUDE]` step waited for him to run it.
2. The editor: in v2 a skilled freelancer synced screen footage to the voiceover and layered
   avatars and motion graphics in an NLE.
3. The recorder's research: in v2 the recording freelancer decided what the video covers.

Constraints set by the owner: everything runs locally (no VPS for now), no LLM API spend.
Antigravity does the grind, Sonnet in Claude Code handles the steps that set quality,
Opus/Fable stays out of per-video work. Quality first: prove one video end to end before
optimizing cost or cadence further.

## 2. The core idea: sync by construction

The v2 editor's main job was syncing. But the voiceover is generated from the recording's
own transcript, so the two are causally linked and the sync problem can be engineered away
instead of edited away:

- ASR (step 020) gives word-level timestamps for the raw recording.
- Script polish (step 040) now also emits `segments.json`: each script block records which
  raw-footage span it came from (`raw_start`/`raw_end`) and its block kind
  (`screen` or `a4_block` for fullscreen-avatar moments).
- TTS output (steps 080–120) gives each block's exact voiceover duration.
- Step 125 turns that into an assembly plan: per block, cut points, a speed factor inside
  a bounded band, freeze-frame padding, and overlay entries. Screen video tolerates mild
  retiming; faces do not, which is why the corner avatar is generated FROM the voiceover
  and never retimed.
- Step 162 executes the plan with ffmpeg. One block = one voiceover span = one screen slice.

Blocks whose footage cannot fit the voiceover inside the speed band are flagged, and the
flag list is the entire remaining human edit job (step 165). The bet: on a disciplined
recording, flags are rare. The recording contract (step 015) exists to make that true:
sections recorded in brief order, 2-second silent pauses between sections, spoken "retake"
markers.

## 3. Actor routing (who runs what, and why)

| Work | Actor | Why |
|---|---|---|
| research brief, transcript clean, avatar-block plan | Antigravity | pattern-following prompt work; sub already paid for |
| script polish + segment map, visual plan, graphics build | Sonnet (Claude Code) | these set the video's quality; 040/135 also need strict output formats and the hyperframes skills, which only exist in Claude Code |
| transcribe, TTS, trim, QC, assembly math, ffmpeg cut, packaging | deterministic scripts | no judgment involved; free |
| recording, five review gates | humans | recording hands; taste checks |

Review gates get cheaper rather than removed: 105 pre-filters voice review down to flagged
chunks; 125/162 turn the edit review into a flag checklist. Gate order and pre-spend logic
from v2 are unchanged.

## 4. Graphics quality (lesson from the Devsplainers PoC)

The Devsplainers PoC (`pipelines/ai-video-production/Devsplainers/hyperframes/`) proved the
timing-spine and actor-split ideas but its scene quality failed on all four axes (static
design, motion, cohesion, sync) with a thin CSS kit driven by Antigravity. v3 therefore
keeps graphics authoring on Sonnet in Claude Code with the pipelines-scoped hyperframes
skill stack (motion-graphics recipes for callouts and stat hits, faceless-explainer shot
blueprints for concept inserts), rendered locally to clips sized exactly to their cue
durations. Antigravity is not in the graphics quality path.

## 5. What stays from v2

The voice and avatar machinery is untouched: IndexTTS-2 on Modal (~$0.50/video), the A4
fullscreen + A3 corner avatar split, HeyGen web-session submit with anti-ban pacing, the
pre-spend gate at 070, Drive folder handoff. The HeyGen `submit`/`fetch` HAR stubs remain
open items from v2 (`TODO[HNS]` in `lib/heygen.py`); until filled, step 160 stays a manual
download gate.

## 6. Risks and mitigations

- Footage/voiceover divergence beyond the retime band: flagged, human fixes only those
  blocks; the recording contract keeps divergence low. If a video produces many flags, the
  fix is recording discipline, not more automation.
- Recorder ignores the contract: the brief's section list doubles as the checklist; a
  noncompliant recording degrades to the v2 manual path (editor package still produced by 170).
- Segment map quality depends on 040 keeping block boundaries at real recording pauses:
  the rulebook update pins boundaries to ASR pause gaps, and 050 (script review) is the
  human catch.
- Retimed screen video with UI motion can look subtly wrong at band edges: the band is
  conservative (0.85–1.18) and freeze-pads prefer natural stills (post-click states).

## 7. Rollout

One video through the full v3 flow, quality-first, before any cadence push. Success = the
draft cut from 162 ships with fixes to flagged blocks only, and total owner time stays
under roughly an hour of gates. If the auto-cut needs real editorial surgery, the editor
package path (170) is the fallback while the retime rules get tuned.
