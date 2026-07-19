# Mode-structure & density grammar — design

Date: 2026-07-19 · Status: owner-approved (this conversation) · Source
evidence: `pipelines/video/visuals-flow/references/{vPqSgj8Ta3Y,-vwHldNaGPI,PvnJavua0YY}.md`
(frame-level analysis of 3 Youri van Hofwegen videos; the owner wants this
editing grammar cloned).

## Owner decisions (locked in the brainstorm)

1. **One rule surface for all formats** — 9-min reviews and 32-min tutorials
   share one grammar; density scales because rules are per-minute cadences,
   never per-video counts.
2. **Adopt reference density now** — lint/style-guide numbers start at the
   measured reference calibration; the 060 fold tunes from there (supersedes
   HANDOFF open item 8's "wait for owner feedback" for the STARTING point;
   the fold loop itself is unchanged).
3. **Corner avatar bubble un-deferred, reference look** — circle, brand-orange
   ring, top-right.
4. **Canvas mode Level 1 only** — fullframe cards carry canvas beats; the
   windowed-screen treatment (footage in floating title-barred windows on an
   animated gradient) is a backlog prototype row, not part of this design.

## The mode law (what the reference encodes)

- **Full-screen host**: bridges only — intro trust beat, section
  announce/react, conclusion. 10–30s. Never during evidence. (Already our 070
  U-curve + cadence-beats design; validated, not changed here.)
- **Content base**: screen recording / footage carries evidence; host present
  as corner bubble; overlays (chips, pills, captions) accumulate in sync with
  speech.
- **Canvas beats**: when words are the evidence (claim, list, numbers with
  nothing to show on the recording) → fullframe card.
- **Transitions**: wipe/flash INTO content and INTO canvas; hard cut back to
  the host.

## D1 — cadence density + canvas routing

Surfaces (paired edits): `steps/020-cue-pass-llm/RULEBOOK.md` +
`cue-pass-prompt.md`, `lib/lint-cues.mjs` constants,
`EDITOR-STYLE-GUIDE.md` ("When a moment earns a graphic" section).

- Fullframe/canvas beat cadence target: **one per 45–90s of VO** (lint warns
  outside the band; was ~1 per 1–2 min prose rule).
- Overlay burst cap: **≤3 per rolling 60s** (was ≤1/min prose rule); lint
  implements the rolling window; stat-hit's own spacing rule stays.
- Exclusion zones replaced: cold-open beat ALLOWED in first 15s (reference
  opens on a montage); end-card allowed in last 20s.
- New routing rule in 020 (verbatim intent): "Narration makes a claim, lists
  items, or states numbers and the screen does not show it → fullframe canvas
  beat (slate/headline-chips, comparison/table-rows, section slates). The
  screen already shows what is spoken → no graphic (unchanged)."
- "When in doubt, skip" is retained ONLY for demo/walkthrough stretches.

## D2 — corner avatar bubble

Surfaces: step 080 corner track (currently skipped by `--spans-only`),
`lib/assemble.mjs` `planSegmentOverlays` composite (the seam plan 083 noted).

- Look: circular bubble ≈150px @1080p, top-right, 40px inset, 3px `#FB923C`
  ring + soft outer glow. Scale with output height.
- Visibility: over **screen segments only**; hidden during avatar-full spans
  and fullframe graphic segments (reference behavior: his slates drop the
  bubble too).
- Audio: bubble clips are silent; vo.mp3 remains the single audio track.
- Board: no new lane required; bubble presence is derivable (all screen
  segments) — revisit only if the owner asks.

## D3 — TH treatment polish (owner-vetoable after seeing D1+D2)

Surfaces: `lib/effects/whip.mjs` pair routing, `lib/effects/beats.mjs`
constants, `EFFECTS.md` rows.

- Transition asymmetry: drop `screen>avatar` whip (hard cut INTO the host);
  keep `avatar>screen` whip and the 095 flash into graphics.
- Punch-in refresh beats disabled on avatar spans **< 45s** (short bridges
  stay static, per reference); unchanged for longer spans.

## Sequencing & verification

- Plan order: D1 (agy; lint tests + rulebook-sync gate) → D2 (opus; encode
  path; frame-extraction inspection + owner board look) → D3 (agy;
  constants; draft re-assembly + frame extraction). D2/D3 prove on a test-01
  `--draft` re-assembly.
- All rule-number changes land as named constants in lint/effects modules
  with EFFECTS.md / RULEBOOK rows updated in the same commit (rule surfaces
  1, 4, 7).

## Out of scope / backlog

- Windowed-screen canvas prototype (Level 2 look) — backlog row, prototype on
  one real video before any grammar commitment.
- Kinetic-sentence CANVAS interstitial as an assembly mode (covered today by
  slate cards).
- Any change to shot-pass budget rules (≤300s, U-curve) — reference data
  validated them; untouched.
