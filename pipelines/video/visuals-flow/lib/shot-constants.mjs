// Single source of truth for shot-pass constraints.
// lib/lint-shots.mjs enforces these; lib/build-shot-prompt.mjs renders them
// into steps/070-shot-pass-llm/shot-pass-prompt.md; lib/check-shot-rulebook.mjs
// fails if the rendered block and these values disagree. Never restate a number
// in prose — add it here and regenerate.
export const SHOT_CONSTANTS = {
  AVATAR_FULL_CAP:    { value: 300, rule: 'Total full-screen avatar time must never exceed 300s (lint error). This is the HeyGen 4 production limit, enforced in both engine modes.' },
  AVATAR_FULL_TARGET: { value: 240, rule: 'Aim for about 240s of total full-screen avatar time, scaled by video length (T/1800); the linter warns below it.' },
  SPAN_MIN:           { value: 10,  rule: 'No avatar span may be shorter than 10s (lint error) — a shorter full-screen moment is not worth a clip.' },
  SPAN_MAX_MID:       { value: 45,  rule: 'A mid-video avatar span longer than 45s drags (lint warning); mid-video bridges should run 10s to 30s.' },
  SPAN_MAX_ZONE:      { value: 120, rule: 'Even an intro or outro host stretch drags past 120s (lint warning).' },
  FRONT_ZONE:         { value: 0.15, rule: 'Expect one avatar span starting within the first 15% of the voiceover (U-curve shape).' },
  BACK_ZONE:          { value: 0.15, rule: 'Expect one avatar span starting within the last 15% of the voiceover (U-curve shape).' },
  GAP_AVATAR_MAX:     { value: 180, rule: 'Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.' },
};
