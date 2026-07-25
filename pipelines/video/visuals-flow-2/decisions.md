# Decisions

- **2026-07-24**: Owner requested captions default-on; VF2 currently relies on sidecar .ass for web players or explicit `--captions` hardsubs. No muxed subtitle track is generated yet.

- **2026-07-25**: Review model = TWO owner gates, neither skippable at any video
  length. This REAFFIRMS the owner's confirmed 2026-07-24 process (root
  decisions.md, third entry that day) rather than replacing it — the vf2 SKILL.md
  had been quoting the FIRST 2026-07-24 entry ("short videos may skip the
  storyboard"), which the owner superseded the same day. Sessions followed the
  stale skill text and drove short videos straight to the cut.
  **Gate 1 = Storyboard (plan review, first)**: the owner finalises avatar
  placement AND avatar variation per span, motion-graphics placement, card
  choice, and on-card text before anything renders. The shot pass (070) moves
  BEFORE the storyboard gate so avatar spans are on the board at review time.
  **Gate 2 = Final Cut (output review)**: the assembled draft must contain
  everything the final video will have — graphics, avatar, effects, sound,
  captions.
  **Why**: the previous rule let short videos skip the storyboard and go
  straight to the cut. Measured on test-01, the expensive comments ("remove this
  template" x4, "overlay on top of motion graphics", "should have been a list
  card") were all card-choice/placement calls — plan-class defects caught only
  after full renders, each costing a re-render and re-cut. Plan defects are
  cheap on a storyboard and expensive in a final cut.
  **Known gap at time of decision**: per-span avatar variation is NOT
  implemented. `lib/resolve-shots.mjs` accepts only `kind: "avatar-full"`;
  `avatar-panel` derives from a video-level `head_layout`; the corner bubble is
  automatic over all screen segments; side view has no HeyGen id (fal-lipsync
  flow only); and there is no mode where the avatar shares a frame with a card.
  Gate 1 cannot offer the variation choice until those modes exist.
