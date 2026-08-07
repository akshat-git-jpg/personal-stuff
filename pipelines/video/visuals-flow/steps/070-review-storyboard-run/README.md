# 070 review storyboard

Resolves shot spans and runs every pre-render check in one pass: shot lint, W18 stillness, and the audit gate.

Fix loop: `run.sh <slug> storyboard-check`

Writes `shots.resolved.json` and `checks/shots.json`, `checks/stillness.json`, `checks/audit-gate.json` (which are typically gitignored as generated review output).
