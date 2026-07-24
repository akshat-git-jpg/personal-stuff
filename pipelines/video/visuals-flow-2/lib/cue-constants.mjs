// Single source of truth for cue-pass constraints.
// lib/lint-cues.mjs enforces these; lib/build-prompt.mjs renders them into
// steps/020-cue-pass-llm/cue-pass-prompt.md; lib/check-rulebook.mjs fails if
// the rendered block and these values disagree. Never restate a number in
// prose — add it here and regenerate.
export const CUE_CONSTANTS = {
  CAP_FULLFRAME:          { value: 3,    rule: 'Any non-structural fullframe card may be used at most 3 times per video (lint E3). Structural cards (catalog `structural: true`) are exempt.' },
  CAP_STAT_HIT:           { value: 3,    rule: 'overlay/stat-hit: at most 3 per video (lint E2).' },
  SPACING_STAT_HIT:       { value: 90,   rule: 'Consecutive overlay/stat-hit cues must start at least 90s apart (lint E2).' },
  ZONE_END:               { value: 20,   rule: 'No cue may END in the last 20s of the video except the end-card slugs listed below (lint E4 — a HARD ERROR, not a preference).' },
  GAP_FULLFRAME_MIN:      { value: 35,   rule: 'Consecutive fullframe cues must start at least 35s apart, measured START to START across narration time (lint W1).' },
  GAP_FULLFRAME_MAX:      { value: 60,   rule: 'Consecutive fullframe cues must start no more than 60s apart, measured START to START across narration time (lint W1).' },
  DENSITY_OVERLAY_MAX:    { value: 3,    rule: 'At most 3 overlay cues may START within any 60s window (lint W2).' },
  DENSITY_OVERLAY_WINDOW: { value: 60,   rule: null }, // referenced by the rule above
  TARGET_RATE_MIN:        { value: 1.0,  rule: 'Total cue count must be at least 1.0 per minute of video (lint W3).' },
  TARGET_RATE_MAX:        { value: 1.9,  rule: 'Total cue count must be at most 1.9 per minute of video (lint W3). For a 20-minute video that is 20-38 cues in total — budget before you place.' },
  BARE_GAP_MAX:           { value: 50,   rule: 'Within demo segments (segments.json), no stretch longer than 50s may pass without a cue START (lint W6).' },
  HOLD_EXTEND_CAP:        { value: 20,   rule: 'A fullframe card\'s exposure may auto-extend at most 20s past its computed end to reach the next base event (resolver post-pass).' },
  GAP_ABSORB:             { value: 4,    rule: 'On base:screen videos, a gap to the next base event of at most 4s is absorbed by extending the previous fullframe card; larger gaps intentionally show the screen recording.' },
  NARRATION_BARE_GAP_MAX: { value: 20,   rule: 'Within narration segments (segments.json), no stretch longer than 20s may pass without a cue START (lint W7). Demo segments keep BARE_GAP_MAX.' },
};

export const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/', 'like-subscribe/'];
