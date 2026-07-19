# Board effects lane + effects approval gate — design (2026-07-20)

Owner-approved 2026-07-20 (chat brainstorm; "aligned, go ahead"). Implements
HANDOFF open item 1c ("board effects lane — promote to the next brainstorm").
Companion: the smalls sweep (GFX-03/04/13 + the effects.test.mjs hazard) was
scoped in the same brainstorm — see plan 105.

## Problem

The effects layer (6 modules: whip, beats, captions, drift, bubble, + registry)
plans per-instance data into `videos/<slug>/effects.json`, but there is no
visual pre-review: the owner sees effects only as raw JSON or a full draft
render. Instances are already clean per-instance data (`id`, `type`, `at`/
`segId`, `enabled`), so a board lane is pure UI on existing data.

## Owner decisions (do not re-litigate)

1. **Preview fidelity**: CSS-simulated playback, explicitly scoped as a
   **timing/density/selection preview** — NOT final pixels. Rationale: each
   effect's *look* is a global module constant, tuned once and frame-verified
   against references; what varies per video (and what effects.json controls)
   is where/when/how-often effects fire and which are enabled. The sim is
   faithful for exactly that. Captions are the exception where look matters
   per-video (which words go orange) — there the board reuses the REAL
   `planCaptions`/`markKeyword` from `lib/captions.mjs`, so caption preview is
   fully honest. Escape hatch for doubt about a specific instance: a `--draft`
   render (cheap since plan 102). Per-instance ffmpeg micro-previews were
   considered and rejected (duplicate the draft render's job, slowly).
2. **Approval**: effects get their own **third approval gate** ("Approve
   effects" on the board), because the three approvals gate different
   downstream steps at different times: cues → render + shot pass, shots →
   avatar render, effects → **assembly**. One combined approval cannot work
   mechanically. `assemble.mjs` refuses an unapproved `effects.json` with the
   same `--force` override semantics as the existing cues/shots gates. Any
   effects change on the board resets approval (key-order-insensitive
   compare), mirroring cues/shots semantics.
3. **Board-writable fields**: only `enabled` (per instance) and `approved`
   (top-level). Param editing stays in the JSON file; the effects-plan
   regeneration merge already preserves manual fields.

## Design

### Lane UI (board sticky header)

- New minimap lane-row "effects" under the avatar lane: point markers
  (absolute-positioned by `at/total`) for whip and beat instances, plus
  span blocks for drift (needs `start`/`end` — see enrichment below).
  Video-wide instances (captions, bubble) render as header chips, not
  timeline points.
- A wrapping chips row lists every instance with a checkbox: toggling flips
  `enabled` client-side and rides the existing Save. Save payload gains
  `effects: [{id, enabled}]`; the server applies only `enabled` per id.
- "Approve effects" button → new `/approve-effects` endpoint (mirrors
  `/approve-shots`). Banner shows "effects approved — ready for step 090".

### Master playback + sim stage

The board has NO global player today (tiles have per-cue slice audio), so the
sim gets a minimal master transport — deliberately a subset of the deferred
GFX-08 play-through (cards do NOT animate; that stays GFX-08):

- New `/vo.mp3` route streams the full VO; a master `<audio>` sits in the
  sticky header; a playhead line tracks over the minimap lanes.
- A fixed 480×270 sim stage (bottom-right) shows: current context label
  (fullframe cue / avatar span / screen — computed from resolved cues + shot
  spans, which the board already has), the current caption chunk with real
  keyword-orange highlighting (server-side `planCaptions(words)` embedded as
  JSON), and CSS approximations firing at each enabled instance's timestamp:
  flash = orange-white overlay blink, whip blur = blur-slide, beat punch =
  scale pulse, drift = slow zoom while inside the segment, bubble = corner
  circle placeholder shown only in screen context. A permanent small label on
  the stage reads "timing preview — final look is the module's".

### Data enrichment + gate

- `drift.mjs` `plan()` stamps informational `start`/`end` (from the segment)
  onto drift instances so the board can place them; `contribute()` ignores
  the new fields; the effects-plan override merge preserves them.
- `effects-plan.mjs` carries the top-level `approved` flag across
  regeneration: stays `true` only if the regenerated instances are
  canonically identical to the previous file, else resets to `false`.
- `assemble.mjs`: after the shots gate, if `effects.json` exists and
  `approved !== true` and no `--force`, refuse with a board pointer. Missing
  effects.json = no gate (pre-effects / graphics-only videos assemble fine).

## Smalls sweep (same brainstorm, plan 105)

- GFX-03: RULEBOOK rubric line "6 words or fewer" → align to the prompt/lint
  truth "2–6 words".
- GFX-04: `transcribe-groq.mjs` asserts word timestamps are numeric,
  non-negative, end ≥ start, non-decreasing starts before writing
  transcript.json.
- GFX-13: `edit-delta.mjs` gains a shots mode — diff `shots.llm.json` vs
  approved `shots.json` per span id over {kind, from_anchor, to_anchor, note,
  flagged} + added/removed.
- **effects.test.mjs hazard** (found during this brainstorm): the file exists
  but was never wired into check.sh, and as written it is both slow AND
  destructive — it deletes/rewrites the real committed
  `videos/test-01/effects.json` and spawns a full `assemble --draft` that
  clobbers the kb-scratch final-draft.mp4 (this actually bit on 2026-07-20).
  Rewrite it against a temp fixture workdir with no assembly spawn, then wire
  it into check.sh.

Deferred by owner in this brainstorm: GFX-11 (agy cue-pass trial — waits for
video #2), GFX-05 (board edit affordances), GFX-08 (full play-through).
