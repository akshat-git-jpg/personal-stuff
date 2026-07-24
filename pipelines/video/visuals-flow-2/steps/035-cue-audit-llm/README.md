# 035-cue-audit-llm

This step runs the storyboard self-audit (the "mute test"). It runs AFTER 030 resolve+lint, and BEFORE the 040 owner board.

- **Inputs**: `resolved.json`, `transcript.json`, catalog slug-purpose pairs
- **Output**: `audit.json` (committed)
- **Role**: A `labelled` verdict is advisory — the owner decides on the board (displayed in plan 140).
