# 050 · review graphics · [LLM]

This step runs the storyboard self-audit (the "mute test"). It runs AFTER 040 resolve+lint, and BEFORE the 080 owner board.

- **Inputs**: `resolved.json`, `transcript.json`, catalog slug-purpose pairs
- **Output**: `audit.json` (committed)
- **Role**: A `labelled` verdict is advisory — the owner decides on the board (displayed in plan 140).
- **Format**: `audit.json` contains items like `{ "id": "c01", "verdict": "labelled", "fix": { "card": "slug", "how": "..." } }`.
