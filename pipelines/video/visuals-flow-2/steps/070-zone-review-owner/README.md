# Step 070: Zone Review (Owner)

**What you approve**: the cards planned for the intro and conclusion, each marked EXISTING or NEW-to-build, plus the one-line spec of any proposed new card.

**Why here**: the build-vs-reuse call is cheapest before anything renders.

**How**: `bash run.sh <slug> zone-plan`, then the Zone Plan tab on the board.

**What it blocks**: `render.mjs` refuses until `zone-plan.json` has `approved: true`.

**Not a checklist**: what belongs in an intro is a judgment call about that script; the gate checks that cards were *chosen deliberately*, not that particular slots are filled (owner ruling, `decisions.md` 2026-07-28).
