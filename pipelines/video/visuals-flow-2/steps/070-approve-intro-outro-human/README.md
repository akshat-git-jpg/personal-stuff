# 070 · approve intro + outro · [HUMAN]

**What you approve**: the cards planned for the intro and conclusion, each marked EXISTING or NEW-to-build, plus the one-line spec of any proposed new card.

**Why here**: the build-vs-reuse call is cheapest before anything renders.

**How**: `bash run.sh <slug> zone-plan`, then the Zone Plan tab on the board.

**What it blocks**: `render.mjs` refuses until `zone-plan.json` has `approved: true`.

**Not a checklist**: what belongs in an intro is a judgment call about that script; the gate checks that cards were *chosen deliberately*, not that particular slots are filled (owner ruling, `decisions.md` 2026-07-28).

**Say why, not just yes or no.** Every card on this tab has a note box, and each zone has one for the zone as a whole. Notes written here are tagged `zone` and fold into `steps/035-place-intro-outro-llm/RULEBOOK.md` — the intro/conclusion rulebook — and never into the body's. Until 2026-07-29 this gate recorded only `approved: true|false`, so rejecting a card taught the pipeline nothing and the same card came back on the next video.

**What it feeds**: the zone pass at step 035, which authors these cards against its own rules (`lib/zone-rules.mjs`, `lib/zone-constants.mjs`) and its own lints (`W15` gap, `W16` motion, `W17` rate, `W18` stillness, `W19` authorship).
