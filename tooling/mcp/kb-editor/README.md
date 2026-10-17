# kb-editor MCP

Lets any Claude session in this repo drive the kb-editor app (`/Users/kbtg/codebase/kb-editor`),
so one yt-video-edit session runs a video from plan to export
(`pipelines/.claude/skills/yt-video-edit/SKILL.md`, "Edit in kb-editor").

- `shim.mjs` runs the app's own stdio shim (`<user data>/WeftCut/cli/weftcut-mcp.cjs`, installed
  by the app on its first launch) with plain `node`. No machine path is in git; `.mcp.json` gets
  the entry from `scripts/regen-mcp-json.sh`.
- `launch_weftcut` starts the installed app (`/Applications/kb-editor.app`, Windows
  `%LOCALAPPDATA%\Programs\kb-editor\kb-editor.exe`), else on the Mac `start-dev.sh`
  (`npm run dev` in `KB_EDITOR_DIR`, default `~/codebase/kb-editor`; log
  `~/Library/Logs/kb-editor-dev.log`). `WEFTCUT_APP` overrides both.
- The `kb_*` tools appear only while the app is running (the shim sends `tools/list_changed`).

Windows has no dev path: it needs the installed app. Her `.mcp.json` entry is the same
(`node <repo>/tooling/mcp/kb-editor/shim.mjs`).
