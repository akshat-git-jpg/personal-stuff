# Session Handoff — build the "routing audit" (dream-sequence) VPS cron

> Read this whole doc first, then `/Users/kbtg/codebase/personal-stuff/VPS-CRONS.md`
> before touching anything. This is a cross-repo task (TY + personal-stuff + vps-crons).

## Where it started

User watched two YouTube videos on building a Claude "second brain". We diagnosed
that their real pain is a **Level 1 routing/discovery problem** (Claude takes too
long to find things; user has to manually point at MD files/folders). We fixed the
routing this session, then evaluated the second video and concluded the one
genuinely additive idea is a **"dream sequence"** — a scheduled self-audit that
keeps the routing from rotting. The task now: build that as a **VPS Pattern B
cron**, report-only, weekly, delivered to Telegram. NOT auto-editing, NOT cloud
routines — stay inside the existing documented cron architecture.

## Decisions locked + what shipped (this session)

**Routing fixes — DONE, already on disk:**
- `/Users/kbtg/codebase/TY/CLAUDE.md` — added a "How to operate here" block (route-by-question, read sub-folder CLAUDE.md first, log decisions) + a "Find it fast" intent table mapping questions → folders. Existing folder map left intact.
- `/Users/kbtg/codebase/personal-stuff/CLAUDE.md` — same operating block + intent table; kept the `@README.md` import.
- `/Users/kbtg/codebase/TY/decisions.md` — NEW, append-only decisions log (newest-first, dated).
- `/Users/kbtg/codebase/personal-stuff/decisions.md` — NEW, same.

**yt-claude bypass-permissions — DONE, already on disk:**
- `/Users/kbtg/codebase/personal-stuff/tooling/cli/yt-claude/relay.py` — added `LAUNCH_FLAGS` env var (default `--dangerously-skip-permissions`), appended to the per-video launch command (`launch = f"{LAUNCH_CMD} {LAUNCH_FLAGS}".strip()`). Compile-verified.
- `/Users/kbtg/codebase/personal-stuff/tooling/cli/yt-claude/README.md` — documented `YT_CLAUDE_FLAGS` in the config table.

**The cron design — AGREED, NOT yet built:**
- Job name: `kb-routing-audit`, lives in the `vps-crons` repo (`akshat-git-jpg/vps-crons`).
- Pattern B LLM cron, modeled on the existing `gmail-digest` cron.
- **Read-only + report-only:** Claude reads the repos, finds routing drift, sends findings to Telegram. It does NOT edit/commit anything (matches the VPS read-only deploy-key model — see VPS-CRONS.md gotcha #4).
- Schedule: weekly (trivial against the personal Pro quota).
- Audits `personal-stuff` (already on VPS) and `TY` (needs a one-time clone — see user steps).
- What it checks: new folders not in the `CLAUDE.md` intent table, dead links in the map, sub-folders missing a `CLAUDE.md`, stale/contradictory entries in `decisions.md`.

## Key files for next session

- `/Users/kbtg/codebase/personal-stuff/VPS-CRONS.md` — **read first.** Pattern B contract, the `_template/` shape, the `gmail-digest` worked example (the closest analog — Claude prompt + MCP + Telegram), the deploy-key model, UTC cron conversion, gotchas.
- `/Users/kbtg/codebase/TY/CLAUDE.md` + `/Users/kbtg/codebase/personal-stuff/CLAUDE.md` — the routers the audit checks freshness against.
- `/Users/kbtg/codebase/TY/decisions.md` + `/Users/kbtg/codebase/personal-stuff/decisions.md` — the decision logs the audit scans for staleness.
- The `vps-crons` repo — separate from the files above. Expected local clone `~/codebase/vps-crons`; **existence NOT confirmed** (the check command was interrupted). Confirm before scaffolding.

## Running state

- Background processes: none.
- Dev servers / ports: none.
- Open worktrees / branches: none.

## Verification — how to confirm prior changes still work

- `python3 -m py_compile /Users/kbtg/codebase/personal-stuff/tooling/cli/yt-claude/relay.py` — exits 0 (the bypass-flag edit compiles).
- Open `/Users/kbtg/codebase/TY/CLAUDE.md` — the "Find it fast" table is present near the top.

## Deferred + open questions

- Deferred: scaffolding `vps-crons/kb-routing-audit/` (`run.sh`, `prompt.md`, `README.md`, `.env.example`, crontab line). Interrupted before starting.
- Open: is `vps-crons` cloned locally at `/Users/kbtg/codebase/vps-crons`? (interrupted check)
- Open: TY's exact GitHub remote (`git -C /Users/kbtg/codebase/TY remote -v`) — needed for the TY deploy-key/clone step.
- Open: user has NOT yet restarted the yt-claude launchd relay, so the bypass flag isn't live in the running relay yet (see user steps).

## What the USER must do (manual — cannot be automated by the agent)

These require SSH / interactive auth and are the user's to run:

1. **Restart the yt-claude relay** so the bypass-permissions change goes live:
   ```sh
   launchctl unload ~/Library/LaunchAgents/com.kushal.yt-claude-relay.plist
   launchctl load   ~/Library/LaunchAgents/com.kushal.yt-claude-relay.plist
   ```
2. **Add TY to the VPS** (one-time, only needed to include TY in the audit): create a read-only GitHub deploy key for the TY repo, add a `Host github-ty` block in `/root/.ssh/config` mirroring the existing `github-personal-stuff` alias, then `git clone` TY to `/srv/projects/TY/` on the VPS.
3. **After the agent scaffolds the cron + pushes:** on the VPS, `cd /srv/crons && git pull`, create `kb-routing-audit/.env` (Telegram token + chat_id, `chmod 600`), smoke-test `/srv/crons/kb-routing-audit/run.sh`, then `crontab /srv/crons/crontab.txt` to activate.

## Pick up here

Confirm `vps-crons` is cloned locally and get TY's git remote, then scaffold
`vps-crons/kb-routing-audit/` from `_template/` following the `gmail-digest`
pattern — read-only, report-to-Telegram, weekly.
