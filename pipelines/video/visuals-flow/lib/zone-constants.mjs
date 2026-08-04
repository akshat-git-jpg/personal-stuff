import { introOwnedByFilm } from './intro-film/owns-intro.mjs';

// Single source of truth for INTRO/CONCLUSION constraints.
//
// These are deliberately SEPARATE from lib/cue-constants.mjs. The body and the
// zones are authored by different passes against different rulebooks (owner
// decision 2026-07-29: "i want intro conclusion steps to be very explicit and
// not tied with full body — its rules, guidelines, execution should be
// separate"), so a body number can never quietly become a zone number.
//
// lib/lint-cues.mjs enforces these; lib/build-zone-prompt.mjs renders them into
// steps/035-pick-or-propose-intro-outro-llm/zone-pass-prompt.md; lib/check-zone-rulebook.mjs
// fails if the rendered block and these values disagree. Never restate a number
// in prose — add it here and regenerate.
//
// The values come from measuring test-03, whose intro the owner rejected:
//   - 4 fullframe cards, only 1 of them `enacted/` (the rest were text slates)
//   - a 45.7s stretch (c03 -> c06) with no new fullframe, which PASSED because
//     the body's GAP_FULLFRAME_MAX is 45s
//   - 20 consecutive seconds at ~0.01 mean frame delta — a still image
//   - 3.57 cues/min, ALREADY denser than the 2.30/min body
// The last number is why none of these is a rate increase: the intro was never
// short of cues, it was short of MOTION. Raising the rate would have added more
// of what was already failing.
export const ZONE_CONSTANTS = {
  ZONE_GAP_FULLFRAME_MAX: {
    value: 20,
    rule: 'Inside the intro or the conclusion, consecutive fullframe cues must start no more than 20s apart, measured START to START — and the zone\'s first fullframe must start within 20s of the zone opening (lint W15). The body allows 45s; a zone does not, because 45 seconds without a new frame is where the opening loses the viewer.',
  },
  ZONE_ENACTED_FRACTION: {
    value: 0.5,
    rule: 'At least half of a zone\'s fullframe cues must be `enacted/` cards — ones that DO the point rather than title it (lint W16).',
  },
  ZONE_ENACTED_MIN: {
    value: 2,
    rule: 'Every zone with any fullframe cues needs at least 2 `enacted/` cards regardless of the fraction (lint W16). One moving card among static slates reads as an accident, not a style.',
  },
  ZONE_RATE_MIN: {
    value: 3.0,
    rule: 'A zone must carry at least 3.0 cues per minute of its own length (lint W17). This is a regression floor, not a padding target — do not add a cue to reach it; if the zone cannot carry that many, the zone is being under-written and the narration is the thing to fix.',
  },
  ZONE_STILL_MAX: {
    value: 8,
    rule: 'No stretch of a zone may show more than 8s of visually static frame — footage that is not moving, with no card and no avatar over it (lint W18, measured from the footage by lib/stillness.mjs). A frozen frame in the opening is the single defect the owner has called out most.',
  },
  ZONE_STILL_DELTA: {
    value: 0.02,
    rule: null, // the threshold W18 counts as "static"; referenced by the rule above
  },
};

// Cards under this prefix ENACT their point (they animate the idea) rather than
// stating it. W16 counts them. Kept here rather than inferred at the call site
// so the zone rules and the linter can never disagree about what "motion" means.
export const ENACTED_PREFIX = 'enacted/';

export const ZONE_PARTS = ['intro', 'conclusion'];

export function zonePartsFor(workdir) {
  return introOwnedByFilm(workdir) ? ['conclusion'] : ZONE_PARTS;
}
