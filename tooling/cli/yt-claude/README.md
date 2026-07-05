# yt-claude

Tick YouTube video thumbnails in the browser, hit one button, and each video
opens as **its own terminal tab inside Antigravity** (or a separate macOS Terminal
window), a live `claude` session pre-fed the transcript that prints an instant
summary, then waits for your questions. Switch with `YT_CLAUDE_TARGET`. Any VS
Code fork works as the tab target; Antigravity is just the default.

```
 Browser (Tampermonkey)            Mac (this repo)
 ┌────────────────────┐  POST     ┌──────────────┐
 │ ☑ ☑ ☐ ☑  thumbnails│ ───────▶ │  relay.py     │ ──▶ open -a Terminal
 │   [→ Claude (3)]    │  /queue   │  • title      │     ├─ 🪟 window: yt:<title>  (claude live)
 └────────────────────┘  :7777    │  • transcript │     ├─ 🪟 window: yt:<title>  (claude live)
                                   │  • run.command│     └─ 🪟 window: yt:<title>  (claude live)
                                   └──────────────┘
```

## Pieces

| File | What it is |
|------|-----------|
| `relay.py` | Localhost HTTP server. POST `/queue {urls:[…]}` → per video: fetch title (oembed) + transcript (`pp-yt-transcript`) → either drop a job file in `~/yt-claude/pending/` (IDE target) or `open` a `run.command` Terminal window (terminal target). |
| `ide-extension/` | Editor extension for any VS Code fork (Antigravity, VS Code, Cursor). Watches `~/yt-claude/pending/` and opens an integrated terminal tab per job. Installed at `~/.antigravity/extensions/yt-claude/`. |
| `yt-claude` | Control CLI: `serve`, `ls` (recently opened), `log` (tail relay log). |
| `yt-claude-select.user.js` | Tampermonkey userscript: checkboxes on thumbnails + the floating send button. |
| `com.kushal.yt-claude-relay.plist` | launchd agent to keep the relay alive. Sets `YT_CLAUDE_TARGET=antigravity`. |

## Why these choices

- **One real Terminal window per video** — no tmux navigation; Cmd-Tab / arrange
  them like any other window. (Set `YT_CLAUDE_TERMINAL=iTerm` to use iTerm.)
- **`open` a `.command` file** instead of AppleScript — avoids the macOS
  automation-permission prompt, and works fine from the launchd relay.
- **`#!/bin/zsh -il`** in the script — interactive login shell, so your normal
  `claude` (= `claude-work`) alias, config, and env resolve. `exec zsh -il` at
  the end keeps the window alive as a shell after you quit claude.
- **Dedicated cwd `~/yt-claude/<videoid>/`** holds that video's `transcript.txt`,
  `prompt.txt`, and `run.command`.
- **Transcript runs locally** — `pp-yt-transcript` needs a residential IP, which
  is why processing lives on the Mac. The relay auto-detects a python3 that
  actually has `youtube_transcript_api` (Homebrew's python doesn't).

## Setup

### 1. Run the relay (always-on via launchd)
```sh
cp "cli/yt-claude/com.kushal.yt-claude-relay.plist" ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.kushal.yt-claude-relay.plist
# logs: /tmp/yt-claude-relay.log   ·   foreground instead: cli/yt-claude/yt-claude serve
```
> Edit the `relay.py` path in the plist if you move the repo.

### 2. Install the editor extension (for an IDE target)
```sh
cp -R cli/yt-claude/ide-extension ~/.antigravity/extensions/yt-claude
```
Reload Antigravity (`Cmd-Shift-P` → "Developer: Reload Window") if it doesn't pick
it up automatically. It watches `~/yt-claude/pending/` and opens a terminal tab per
job. On another VS Code fork, copy into that editor's extensions dir instead
(`~/.cursor/extensions/`, `~/.vscode/extensions/`, …). (Skip this step if you set
`YT_CLAUDE_TARGET=terminal`.)

### 3. Install the userscript
1. Install the **Tampermonkey** extension.
2. Dashboard → **＋ Create new script** → paste `yt-claude-select.user.js` → save.
3. Reload YouTube. A checkbox appears top-left of every video thumbnail.

### 4. Use it
- Tick the videos you want (homepage / search / sidebar / channel). A
  **`→ Claude (N)`** pill shows the count.
- Click it. Each video opens as an Antigravity terminal tab (or Terminal window)
  with a summary.
- `cli/yt-claude/yt-claude ls` → list recently opened videos.
- Quit a video's claude (`Ctrl-C` / `/exit`) → the tab drops to a plain shell.

## Config (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `YT_CLAUDE_PORT` | `7777` | relay port (match `RELAY` in the userscript if changed) |
| `YT_CLAUDE_TARGET` | `terminal` | an IDE name (`antigravity`, `cursor`, `editor`, `vscode`, `code`) = integrated editor tabs (needs the extension); `terminal` = macOS Terminal windows. The launchd plist sets this to `antigravity`. |
| `YT_CLAUDE_TERMINAL` | `Terminal` | (terminal target) macOS app to open windows in (e.g. `iTerm`) |
| `YT_CLAUDE_DIR` | `~/yt-claude` | per-video working dirs + `index.log` manifest + `pending/` queue |
| `YT_CLAUDE_CMD` | `claude` | command run per tab/window (set to `echo` to test plumbing) |
| `YT_CLAUDE_FLAGS` | `--dangerously-skip-permissions` | flags appended to `YT_CLAUDE_CMD`; default opens each session in bypass-permissions mode (no approval prompts). Set to `""` to restore normal prompting. |

## Notes

- No transcript (captions off)? The window still opens and Claude is told to try
  the `get_video_transcript` MCP tool, then proceed.
- Convenience: `ln -s "$PWD/cli/yt-claude/yt-claude" ~/.local/bin/yt-claude`.
