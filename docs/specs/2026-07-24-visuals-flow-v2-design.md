# visuals-flow v2 design spec

**Date:** 2026-07-24
**Status:** design approved, pre-implementation
**Supersedes:** `pipelines/video/visuals-flow/` (frozen as fallback once v2 is proven, not deleted)
**Inputs:** `pipelines/video/loop-studio/2026-07-23-critique-and-v2-handoff.md`,
`pipelines/video/loop-studio/how-loop-studio-works.md`, the visuals-flow internals
(PIPELINE.md, HANDOFF.md, EFFECTS.md, lib/), and a source-level study of the installed
Loop Studio product (`~/.claude-personal/skills/loop-studio/` — ideas only, proprietary code).

## Problem

visuals-flow works end to end but the owner finds its output unimpressive next to Loop
Studio's: no sound design, sparse graphics over demo/avatar footage, "orange screen"
exposure between fullframe graphics, wrong/weak template picks, and a storyboard board
that's hard to review a whole video on. Loop Studio ($97, studied 2026-07-23) produces
visibly better video but is bespoke-per-beat, artisanal, and unbounded in model effort —
the opposite of visuals-flow's one-LLM-call scale bet.

## Why Loop Studio looks better (verified in its source — all portable as ideas)

1. **Explicit word-anchored sync at every layer** — word timestamps → screenplay `sync`
   events pinned to spoken words → frame constants → VO-locked durations → frame-exact
   mux. (visuals-flow shares this foundation; its visible gap is a coverage bug, not sync.)
2. **A design doctrine** — Law 0 (name the whole video's ONE idea + a recurring
   through-line motif before authoring), enact-don't-label (a graphic *does* the idea,
   not a labelled card), dark register = problem / light = solution, one accent element
   per frame, one marker word per headline, richness floor.
3. **Continuity between beats** — each beat declares what carries over; the motif is one
   persistent element that evolves.
4. **A sound stage** — semantic SFX (timbre by meaning, pitch contours), music ducked
   under VO, −14 LUFS master. The logic is deterministic Python; samples are commodity.
5. **A falsifiable v1 self-audit** — check pixels at every sync point against the laws;
   "mute audio + hide captions: do the moving objects still communicate the idea?"

**Orange-screen root cause (visuals-flow):** `lib/resolve.mjs` sets a fullframe
graphic's duration to `last beat + 3s hold`; `lib/assemble.mjs` fills gaps with the
screen recording, and where none exists the card stage's burnt-amber background
(`#3a1f08`) is exposed. Nothing extends a graphic to the next cue or fills the gap.

## Decisions (owner, 2026-07-24)

| Decision | Choice |
|---|---|
| Architecture bet | Hybrid, template-first: grow the template/effect library so videos become templates-only over time; bespoke authoring only when no card fits, under the same lint rules |
| Token budget | Still token-lean. Adds ~2 cheap LLM passes (concept pre-pass, storyboard self-audit) on top of the existing cue pass; bespoke costs tokens only when triggered |
| Primary deliverable | **Layered Resolve/FCPXML timeline with everything** — graphics, effects, and the new audio lanes (SFX clips, ducked music, VO) — plus a mastered `final.mp4` for preview/QC |
| v2.0 must-haves | Sound + mix stage; storyboard board upgrade; enacted graphics + through-line. (Orange-screen fix and selection quality in scope regardless) |
| Where v2 lives | **New folder `pipelines/video/visuals-flow-2/`** — spine copied from visuals-flow; v1 frozen as fallback. `card-library/` stays the shared card source for both |
| Music | Pipeline downloads royalty-free beds and picks by mood; owner swaps the track later on the timeline (music is its own lane, so swap is trivial) |
| Enacted-device cards at launch | ~12 core devices; the promotion flywheel grows the rest |
| Formats | **Longform 16:9 only** — no format routing, no shorts rules or vertical card variants. `video.json` still records aspect/format so a future shorts add-on has a slot, but nothing is built for it |
| Deferred / skipped | Loop Studio's cut engine (VO-first ⇒ no takes); full bespoke-per-beat authoring. (The post-render reviewer is no longer deferred — it lands as the board's Final Cut tab, delta I, owner-requested 2026-07-24) |

## Architecture

`pipelines/video/visuals-flow-2/` keeps the proven deterministic spine — transcribe →
cue pass → resolve/lint → board → render (Hyperframes) → shot pass → HeyGen → assemble
(ffmpeg) → layered FCPXML export → feedback fold — and adds six deltas:

### A. Doctrine port + concept pre-pass
A new cheap LLM pre-pass (before the cue pass) writes a `concept` block into the video
folder: core idea (the argument, not the topic), through-line motif, digestible frame,
register map (which sections are problem/dark vs solution/light). The cue pass prompt
receives it and must obey it. Loop Studio's laws become *machine-enforced* rules in
v2's lint surfaces (their weakness was prose rules; visuals-flow's linter is the
advantage to keep): single-accent, marker word, register usage, richness floor, and an
enact-check per cue.

### B. Enacted-device card family + promotion flywheel
~12 new cards in the shared `card-library/` under a new `enacted/` family — devices
that DO ideas rather than reveal text: fill/accumulate, race/compare, counter,
pipeline-flow, before/after, stack, connection, spotlight, timeline, verdict, pricing,
terminal-enact. Each supports register variants (dark/light), a marker word, and a
`continuity` slot that can host the persistent through-line motif (see C's motion
coverage — the motif lives as its own always-alive overlay lane, and cards declare how
they interact with it).
When the cue pass flags "no card fits," the session authors a bespoke Hyperframes
composition under the same lint rules; after owner approval on the board it is
**promoted into card-library with a catalog entry**. Every bespoke spend compounds the
library toward templates-only.

### C. Coverage fix (orange screen) + motion density
Two distinct problems, two rules.

**Background coverage (the orange screen):** the resolver extends a fullframe graphic's
exposure to the next event (hold-until-next with a cap) instead of a fixed 3s hold;
assemble gains a gap filler (hold-last-frame / crossfade) so exposed stage background
becomes structurally impossible; a new lint **error** fires if any timeline second
would be uncovered.

**Motion coverage ("always something going on") — Loop Studio's density model, adopted:**
their screenplay gives *every spoken clause* an object + action; a clause where nothing
happens doesn't exist. v2 drops v1's place-cues-with-gaps sparsity (35–60s fullframe
spacing with inert footage between) in favor of a per-clause beat bar during narration
and avatar spans: every clause must produce a visible event — an overlay beat, a
word-synced caption highlight, or an evolution of the motif element. Three mechanisms:
(1) word-synced karaoke captions become an **always-on default lane** (v1's opt-in
captions effect, promoted); (2) the through-line motif is a **persistent overlay
element** that stays alive and evolves across the whole video, not just a slot carried
cue-to-cue; (3) a motion-coverage lint warns when more than ~5s pass with nothing
moving on screen during narration. Over demo footage the demo itself counts as motion;
overlays there follow re-tuned (denser) spacing constants rather than the per-clause bar.

### D. Selection quality
Catalog metadata gains intent/anti-intent lines per card ("use when… / never when…");
the concept block constrains choices; a cheap storyboard-level self-audit pass runs the
"mute test" per cue (does the visual communicate the clause without audio/captions?)
so bad picks are caught before render.

### E. Sound + mix stage
Improvement over Loop Studio: they frame-diff the render to find events; v2 already
knows every event exactly from `resolved.json` beats + `effects.json` — zero detection
cost, frame-accurate. Port the *placement logic* as our own implementation: timbre by
meaning, pitch contour within a run (rising = accumulation, falling = loss, steady =
counter), run caps, gain jitter, de-clutter, a low drone bed, everything subtle. Source
our own ~20-sound CC0/self-recorded kit (Loop Studio's samples were licensed and never
shipped). Music: a small downloaded royalty-free bed kit, picked by concept-block mood,
looped from its sustained core, sidechain-ducked under VO. Master to −14 LUFS.
Deliverable-aware output: SFX as individual clips on their own FCPXML audio lane,
music as a pre-ducked track on its own lane, VO untouched on its lane — plus the
mastered `final.mp4`.

### F. Effects vocabulary expansion + card variants (zero-token richness)
"More going on in every screen" must come from a bigger deterministic vocabulary, not
from per-video LLM authoring. Two surfaces grow:

**Assembly effects** (v1 ships only whip / punch-ins / captions / drift / bubble):
add a marker family (underline sweep, circle, strike — Loop Studio's signature accent
gestures as reusable overlay effects), plate/label snap-ins (mono label, tag, stat
plate that ride over any footage), more transition types (register switch dark↔light,
crossfade, slide), and tuned punch-ins. All are `lib/effects/*.mjs` modules planned
deterministically into `effects.json` — rendered once as transparent clips, zero
tokens per video.

**Card variants:** template systems risk looking samey where bespoke doesn't. Every
enacted card ships variant axes (layout / motion / register) and the resolver
auto-rotates variants on repeated use of the same card, so the second and third
appearance of a device reads as intentional variation, not a copy-paste. A lint warns
when the same card+variant would repeat back-to-back.

### G. Per-video manifest + brand tokens
Loop Studio front-loads all per-video config into one `video.json` and derives every
scene's look from one swappable `brand.json` — both worth taking. v2 adds
`videos/<slug>/video.json` (aspect, brand, music mood, format, per-video overrides)
and a `brand.json` token file (palette, fonts, caption style, logo) that card-library
cards and effects read instead of hardcoded DESIGN.md values — so a per-channel
re-skin is one file swap, and one video can deviate without touching constants.

### H. Head as a layout element
Loop Studio composites the talking head in three modes — full / panel / hidden — so
graphics constantly share the frame with the person (plates above the head, labels,
marker wipes) instead of cutting away from them. v1 only has full-screen avatar spans
plus a corner-bubble PIP. v2's shot pass gains a `mode` field (full / panel / hidden):
panel shrinks the head into a framed region while an enacted card takes the canvas, and
overlay cues are explicitly allowed over avatar spans. Assemble and the FCPXML export
composite these as separate lanes so the editor can still move them.

### I. Board upgrade — one review dashboard, Loop-Studio-grade
The board stays the single review surface, upgraded to Loop Studio's reviewer
ergonomics across two tabs:

**Storyboard tab (pre-render, keep v1's edge):** inline live card previews (the iframe
IS the render input), per-cue VO playback, minimap lanes — all kept — plus a **global
play-through** of the planned cut (v1's deferred GFX-08): scrub the whole timeline
with cards, captions, motif and effects previewed in sequence against the VO, and the
sound plan audible (SFX/music preview from the planned event list).

**Final Cut tab (post-assemble):** `final.mp4` plays in the same dashboard with
frame.io-style review — this subsumes Loop Studio's standalone `video-feedback` tool
rather than deferring it:
- pause and just start typing → comment pinned to the exact timestamp; click a spot on
  the frame → x/y point-pinned;
- timeline hover shows a live thumbnail + timecode (YouTube-style scrub);
- **version history**: every assemble registers a version (`versions.json`,
  `versions/<label>.mp4`), a dropdown switches versions, comments are kept per
  version;
- comments write into the existing `feedback.json` lifecycle (so the 060 fold sees
  them unchanged);
- **live check-off**: the page polls a status file every few seconds; as the session
  fixes each note and posts status, the owner watches to-dos tick off live;
- the two Loop Studio gates adopted as pipeline rules: every render/assemble prints
  the board URL unprompted (Gate A), and "feedback done" means every note is marked
  fixed/skipped/question with the list ticked off live (Gate B).

## What v2 keeps unchanged from v1 (don't regress)

One cue pass per video; machine-enforced lint + convergence metrics + edit-delta;
pre-render storyboard review; verbatim-anchor sync; Hyperframes rendering (not
Remotion — settled, decisions.md 2026-07-17: one HTML file is both the live board
preview and the render input, so what the owner approves IS what renders; Remotion's
build step would split them. Both render identical Chromium pixels, so the renderer
does not gate the Loop Studio look — owner asked and confirmed 2026-07-24. If a
specific device ever can't be expressed in Hyperframes, the escape hatch is per-card,
never a stack change); HeyGen shot pass with owner gate; native layered Resolve
export; the Opus feedback fold; reference auto-analysis; media in `~/kb-scratch/`,
never in git.

## Token model

Per video: concept pre-pass (small) + cue pass (existing) + storyboard self-audit
(small) + shot pass (existing) ≈ 4 LLM calls, everything else scripted. Bespoke
authoring adds tokens only when triggered, and each occurrence permanently grows the
template library.

## Verification story

Deterministic gates carry over (lint, ffprobe checks, approval freshness). New:
coverage lint (no uncovered second), motion-coverage lint, loudness check (`ffmpeg
loudnorm` print ≈ −14 LUFS), frame-exact A/V check after every mux/master (video
duration == audio duration, both starting at 0 — Loop Studio's drift guarantee),
FCPXML lane-count check, and the storyboard self-audit rubric. End-to-end
proof: re-run v1's test-01 video through v2 and compare on the board.

## Loop Studio coverage matrix (nothing silently missed)

Owner concern (2026-07-24): "I don't want to miss anything Loop Studio has." The
mitigation is not copying its code (proprietary/keyed, wrong stack — Remotion JSX vs
our Hyperframes, and it lacks cards/lint/board/FCPXML entirely); it is this exhaustive
capability matrix plus the reference-reading rule below. Every Loop Studio capability,
with its v2 disposition:

| Loop Studio capability | v2 disposition |
|---|---|
| Step 0 — cut engine (forced-align, best-of-takes for recorded heads) | **Skipped** — VO-first TTS means no messy takes (per critique doc) |
| Step 0 — AI avatar head | **Already have** — HeyGen shot pass |
| Step 1 — Law 0: whole-video concept + through-line | **Adopted** — delta A concept pre-pass |
| Step 2 — format routing (short/longform/intro) | **Skipped by decision** — longform 16:9 only; `video.json` keeps the slot |
| Step 3 — one project folder + `video.json` manifest | **Adopted** — delta G (v1 already had `videos/<slug>/`) |
| Step 4 — screenplay: per-clause object/action/continuity/sync | **Adapted** — per-clause beat bar (C), continuity/motif (C), enacted cards declare object+action (B); word-pinned sync already in v1's anchor resolver |
| Step 5 — `brand.json` swappable tokens | **Adopted** — delta G |
| Step 5 — video-taste (universal vs my-rules split) | **Already stronger** — RULEBOOK + cue-constants + linter + 060 feedback fold (machine-enforced, not prose) |
| Step 5 — creative-standard 10 laws + richness floor | **Adopted as lint** — delta A |
| Step 6a — bespoke per-scene Remotion authoring | **Replaced by design** — cards + variants + flywheel (B, F); bespoke only as escape hatch |
| Step 6a — design system: dark/light registers, Marker wipe, single accent | **Adopted** — deltas A (lint) + F (marker effect family, register transitions) |
| Step 6a — head modes full/panel/hidden | **Adopted** — delta H |
| Step 6a — enacted concept library (`concepts.tsx`) | **Adopted** — delta B (~12 enacted cards, flywheel = their "promote device to library") |
| Step 6a — karaoke word-synced captions | **Adopted** — delta C (always-on lane; v1 had it opt-in) |
| Step 6b — `detect_events.py` frame-diff event detection | **Superseded** — v2 knows exact event times from resolved.json (better than detection) |
| Step 6b — `build_sfx.py` semantic placement (timbre-by-meaning, pitch contours, run caps, drone bed) | **Adopted (logic ported, own CC0 kit)** — delta E |
| Step 6c — mix/master: sidechain duck, music loop-from-core, swells, −14 LUFS, frame-exact A/V verify | **Adopted** — delta E + verification story |
| Step 7 — post-render review tool (timestamped + point-pinned notes, live check-off, versions, Gates A/B) | **Adopted in full** — board upgrade I's Final Cut tab (subsumes their standalone tool: point-pinned notes, hover-thumbnail scrub, version history, live check-off, both gates) |
| Step 8 — fold lessons into taste | **Already have** — 060 feedback fold (stronger: machine-tracked) |
| Flat mastered mp4 delivery | **Replaced by decision** — layered FCPXML for DaVinci + mastered preview mp4 |
| v1 self-audit (pixels at sync points, mute test) | **Adopted** — delta D storyboard mute-test + filmstrip QC (v1) at final render |

**Reference-reading rule for plan authors:** the plans for deltas A, E, and I must be
written with the corresponding Loop Studio sources open as reference specs —
`~/.claude-personal/skills/loop-studio/editors/creative-standard.md` (A),
`.../core/engine/remotion/build_sfx.py` + `build_v26.sh` (E),
`~/.claude-personal/skills/video-feedback/` (I) — porting the logic and rules
faithfully into our stack. Port, never copy source (license).

## Plan decomposition (orchestrate; ordered)

1. **Scaffold visuals-flow-2** — copy spine, wire `run.sh`, prove v1 parity on test-01.
2. **Coverage fix + motion density + head layout modes** (C, H).
3. **Concept pre-pass + doctrine lint rules** (A).
4. **Enacted card family (~12, with variants) + catalog metadata + flywheel promotion
   verb** (B, D).
5. **Effects vocabulary expansion + video.json/brand.json tokens** (F, G).
6. **Sound + mix stage + kit sourcing** (E).
7. **Board upgrade** (I).
8. **Docs + registration** — PIPELINE.md, skill verbs, pipelines/CLAUDE.md row,
   decisions.md entries.

Each is one reviewable plan in `plans/`; 2–8 depend on 1; 5, 6 and 7 are independent
of 3–4.
