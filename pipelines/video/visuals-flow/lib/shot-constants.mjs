// Single source of truth for shot-pass constraints.
// lib/lint-shots.mjs enforces these; lib/build-shot-prompt.mjs renders them
// into steps/060-place-avatar-llm/shot-pass-prompt.md; lib/check-shot-rulebook.mjs
// fails if the rendered block and these values disagree. Never restate a number
// in prose — add it here and regenerate.
export const SHOT_CONSTANTS = {
  AVATAR_FULL_CAP:    { value: 300, rule: 'Total full-screen avatar time must never exceed 300s (lint error). This is the HeyGen 4 production limit, enforced in both engine modes.' },
  AVATAR_FULL_TARGET: { value: 240, rule: 'Aim for about 240s of total full-screen avatar time, scaled by video length (T/1800); the linter warns below it.' },
  SPAN_MIN:           { value: 10,  rule: 'No avatar span may be shorter than 10s (lint error) — a shorter full-screen moment is not worth a clip.' },
  SPAN_MAX_MID:       { value: 45,  rule: 'A mid-video avatar span longer than 45s drags (lint warning); mid-video bridges should run 10s to 30s.' },
  SPAN_MAX_ZONE:      { value: 120, rule: 'Even an intro or outro host stretch drags past 120s (lint warning).' },
  FRONT_ZONE:         { value: 0.15, rule: 'Expect one avatar span starting within the first 15% of the voiceover (U-curve shape).' },
  INTRO_HOST:         { value: 15,   rule: 'The host must be ON SCREEN within the first 15 seconds (mandatory, lint E8). Two shapes satisfy it and the pass may choose either: (a) a SIDE-mode span overlapping the opening card, so the host sits beside the motion graphic from the top; or (b) a full-screen span starting at or before the 15s mark, after a short opening graphic. This is NOT an "avatar first" rule — opening on a motion graphic is explicitly fine (owner, 2026-08-02: "I don\'t want to put a hard rule that avatar should be the first thing, but it should be in the starting"). The host simply cannot be late. Two earlier bounds were each too loose, which is why this one is an absolute number rather than a proportion or a zone: the first-15%-of-runtime rule permits 4:49 on a 32-minute video, and the old "somewhere before the intro ends" rule permitted 0:59 on an 86.7s intro and was rejected on sight. If every window before the mark is occupied by fullframe cards, take one of them in `side` mode rather than pushing the host later; if no card there is side-capable, shorten a card rather than skip the host.' },
  BACK_ZONE:          { value: 0.15, rule: 'Expect one avatar span starting within the last 15% of the voiceover (U-curve shape).' },
  GAP_AVATAR_MAX:     { value: 180, rule: 'Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.' },
  PANEL_WIDTH_FRAC:   { value: 0.28, rule: 'A panel-mode avatar occupies 28% of canvas width, inset bottom-right, preserving the source clip aspect ratio.' },
  PANEL_INSET_PX:     { value: 32,   rule: 'A panel-mode avatar sits 32px from the right and bottom canvas edges.' },
  PANEL_RADIUS_PX:    { value: 24,   rule: 'A panel-mode avatar is masked to a rounded rectangle of radius 24px.' },
  SIDE_GRAPHICS_W:    { value: 1200, rule: 'In side mode the motion-graphics card renders 1200px wide at x=0, full canvas height.' },
  SIDE_AVATAR_W:      { value: 720,  rule: 'In side mode the host occupies the right 720px of the canvas, full height, cover-cropped from the source clip. The split is a hard edge — no inset, no corner radius.' },
};

// "purpose" says what a rendered avatar file is FOR (a planned host moment vs
// the corner-bubble baseline track vs a side/panel composite) — HeyGen renders
// every job identically, so this is downstream routing, not a render option.
// Renamed from "kind" 2026-07-31 (owner: "kind" vs "mode" was unreadable).
// Lives here (dependency-free module) so avatar-render, assemble and lint-cues
// can all share it without an import cycle. Readers use this accessor so
// legacy artifacts that still say "kind" (older videos, immutable *.llm.json
// snapshots) keep working.
export function jobPurpose(j) {
  return j.purpose ?? j.kind;
}
