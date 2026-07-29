// Single source of truth for cue-pass constraints.
// lib/lint-cues.mjs enforces these; lib/build-prompt.mjs renders them into
// steps/030-pick-or-propose-graphics-llm/cue-pass-prompt.md; lib/check-rulebook.mjs fails if
// the rendered block and these values disagree. Never restate a number in
// prose — add it here and regenerate.
export const CUE_CONSTANTS = {
  CAP_FULLFRAME:          { value: 3,    rule: 'Any non-structural fullframe card may be used at most 3 times per video (lint E3). Structural cards (catalog `structural: true`) are exempt.' },
  CAP_STAT_HIT:           { value: 3,    rule: 'overlay/stat-hit: at most 3 per video (lint E2).' },
  SPACING_STAT_HIT:       { value: 90,   rule: 'Consecutive overlay/stat-hit cues must start at least 90s apart (lint E2).' },
  ZONE_END:               { value: 20,   rule: 'No cue may END in the last 20s of the video except the end-card slugs listed below (lint E4 — a HARD ERROR, not a preference).' },
  GAP_FULLFRAME_MIN:      { value: 12,   rule: 'Breathing room, not sparsity — fullframe starts at least 12s apart, measured START to START across narration time (lint W1).' },
  GAP_FULLFRAME_MAX:      { value: 45,   rule: 'Consecutive fullframe cues must start no more than 45s apart, measured START to START across narration time (lint W1).' },
  DENSITY_OVERLAY_MAX:    { value: 4,    rule: 'At most 4 overlay cues may START within any 60s window (lint W2).' },
  DENSITY_OVERLAY_WINDOW: { value: 60,   rule: null }, // referenced by the rule above
  TARGET_RATE_MIN:        { value: 1.5,  rule: 'Total cue count must be at least 1.5 per minute of video (lint W3).' },
  TARGET_RATE_MAX:        { value: 4.0,  rule: 'Total cue count must be at most 4.0 per minute of video (lint W3). For a 20-minute video that is 30-80 cues in total — budget before you place.' },
  BARE_GAP_MAX:           { value: 50,   rule: 'Within demo segments (segments.json), no stretch longer than 50s may pass without a cue START (lint W6).' },
  HOLD_EXTEND_CAP:        { value: 20,   rule: 'A fullframe card\'s exposure may auto-extend at most 20s past its computed end to reach the next base event (resolver post-pass).' },
  GAP_ABSORB:             { value: 12,   rule: 'On base:screen videos, a gap to the next base event of at most 12s is absorbed by extending the previous fullframe card; larger gaps intentionally show the screen recording.' },
  NARRATION_BARE_GAP_MAX: { value: 20,   rule: 'Within narration segments (segments.json), no stretch longer than 20s may pass without a cue START (lint W7). Demo segments keep BARE_GAP_MAX.' },
  MOTIF_MIN:              { value: 2,    rule: 'If concept.json exists, at least 2 cues must carry `motif: true` (the through-line must recur) (lint W8).' },
  VARIANT_REPEAT_WINDOW: { value: 1, desc: "A specific variant of a card cannot be used again until {value} other variants or cards have appeared." },
  ENACTED_FIRST:          { value: 1,    rule: 'A fullframe cue on a non-structural legacy (non-`enacted/`) card without `legacy_why` warns (lint W10).' },
  BEAT_GAP_MAX:           { value: 15,   rule: 'Consecutive beats within one cue must anchor no more than 15s apart. Beats narrate one continuous passage; a larger gap means the anchor text matched a later repeat of the same words, and the reveal fires against the wrong sentence (resolver error).' },
  // EXPOSURE_TAIL was retired 2026-07-28. Plan 155 stopped adding its 0.4s pad
  // (a tail past a sentence boundary lands inside the NEXT sentence in
  // contiguous speech — the very defect it was meant to avoid), leaving a
  // constant with zero live consumers whose only remaining job was to inject
  // its rule text into the cue-pass prompt. That sentence now lives on
  // MAX_FULLFRAME_ONSCREEN, which the resolver actually reads, so the guidance
  // the model receives stays attached to a number that is real.
  MAX_FULLFRAME_ONSCREEN: {
    value: 12,
    rule: 'A fullframe card stays on screen until the sentence it illustrates has finished being spoken, ending ON that sentence boundary with no trailing pad — card exposure follows the narration, never a fixed per-card default. It may hold the screen for at most 12s: exposure extends to the last sentence boundary that fits inside this window, and past it the footage takes the frame back.',
  },
  HOST_VISIBLE_BY: {
    value: 15,
    rule: 'The presenter must be visible within the first 15s. A tutorial that opens on wall-to-wall graphics has no one on screen to trust.',
  },
  OPENING_HOST_MIN: {
    value: 3,
    rule: 'At least 3s of the opening window must be free of fullframe cards, so the presenter actually lands rather than flashing between cards.',
  },
  SECTION_FOOTAGE_MIN:    { value: 4,    rule: 'A section opener must be followed by at least 4s of footage before the next fullframe card, so every tool section reads as "opener, then the tool on screen" (lint W11).' },
};

export const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/', 'like-subscribe/'];
