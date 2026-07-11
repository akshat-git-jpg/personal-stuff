---
name: media-board
description: Open the local media board — a localhost gallery of every generated video/voiceover/image across the tts + heygen asset hubs (~/kb-scratch/video/ + repo reference assets), joined with the RENDERS.md/OUTPUTS.md manifests. Inline players, filters, drag an asset out to Finder or an upload page. Triggers on "open my media board", "show my renders", "show my generated media", "what have I generated", "media cockpit", "media-board".
---

# media-board

Start the server and open the browser:

    node pipelines/.claude/skills/media-board/serve.mjs &
    open http://localhost:4100

Flags: `--port <n>` (default 4100), `--kb-root <path>` (default `~/kb-scratch/video`),
`--repo-root <path>` (default: the repo root resolved from this file's location).
Strictly read-only over media and manifests; the only write action is `open -R` (Reveal in
Finder). Stop it with Ctrl-C / kill; it holds no state.
