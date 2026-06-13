# ElevenLabs MCP

Official ElevenLabs MCP server (text-to-speech, voice cloning, sound effects, etc.),
launched via `uvx elevenlabs-mcp` so there's no local install to maintain.

## Setup
1. Put your API key in `.env` (get it at https://elevenlabs.io → Profile → API Keys):
   ```
   ELEVENLABS_API_KEY=sk_...
   ```
2. Registered in `~/.claude-personal/.claude.json` as the `elevenlabs` MCP server
   (command → `run.sh`).
3. Restart the personal Claude Code session (or `/mcp` reconnect) to pick it up.

## How it runs
`run.sh` sources `.env` and execs `uvx elevenlabs-mcp`. The key stays in `.env`
(gitignored), never in Claude's config — same pattern as the hostinger server.
