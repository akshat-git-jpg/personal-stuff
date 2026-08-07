# 036 review cue plan

Checks `cues.json` against `transcript.json` and the card catalog. Run this to find unresolved anchors, missing cards, and timing collisions before actually building any cards.

Fix loop: `node lib/resolve.mjs <slug> --validate-only`

Writes `checks/cue-plan.json` (which is typically gitignored as generated review output).
