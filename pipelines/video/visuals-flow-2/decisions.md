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

- **2026-07-30**: The gate numbering above is superseded. There are **THREE**
  human gates, not two, and gate 1 is no longer the storyboard:
  **Gate 1 = 037 card plan** (which cards, EXISTING vs NEW-to-build, body and
  zones together — approved before anything is built or rendered),
  **Gate 2 = 080 storyboard** (composition, with the real cards playing),
  **Gate 3 = 120 final cut** (motion and sound, judged on the assembled draft).
  The 2026-07-25 entry's reasoning still holds in full — plan defects are cheap
  on a storyboard and expensive in a final cut — 037 just pushes the cheapest
  class of them (wrong card, or a card that should exist and doesn't) one step
  earlier still, to before the card is built. `070-approve-intro-outro-human`
  was absorbed into 037 and deleted: it was this gate scoped to the zones only,
  which left the body's build-vs-reuse call unmade by anybody.
  See the root `decisions.md` entry of the same date for the full rationale.

- **2026-07-31**: The review board UI is a **React/Vite SPA** (`board-ui/`,
  plans 169–174), served as a locally-built bundle by the same
  `lib/board.mjs` Node server — owner decision 2026-07-30, chosen over
  componentizing the server-rendered template strings in place. One shared
  sticky header owns tabs + the single video picker + a right-aligned action
  slot holding every gate approve (Final Cut's approve moved there from the
  Comments panel); secondary controls live in a second header row. The legacy
  server-rendered pages are deleted: `/` serves the SPA, `/list` and
  `/calibrate` 302 to `/#storyboard` / `/#calibrate`. Server data/gate/media
  routes are unchanged (`/api/board-data` is the SPA's contract, plan 169).
  Rendered-truth gate: `scripts/board-ui-smoke.mjs` (real server + headless
  Chrome + a `probe=layout` meta) runs inside `scripts/check.sh` and asserts
  the chrome's y-position is identical on every tab. `board-ui/dist` is
  gitignored; `steps/080-approve-storyboard-human/run.sh` rebuilds it when
  stale. Tab hash + `?video=` URL semantics are unchanged and regression-pinned.
