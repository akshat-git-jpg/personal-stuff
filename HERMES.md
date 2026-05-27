# Hermes Agent — Operational Reference

Personal AI assistant running on the Hostinger VPS. This doc is the source of truth for what Hermes is, where it lives, and how to operate it. If you (or a future Claude session) are about to touch Hermes, read this first.

## What it is

- **Hermes Agent** by [Nous Research](https://github.com/NousResearch/hermes-agent) — open-source, MIT licensed
- Five pillars: **memory**, **skills**, **soul** (personality), **cron** (scheduled automations), **self-improving loop**
- Daily-driver via **Telegram**; complements Claude Code (which stays the desktop driver)
- Set up following Nate Herk's "Hermes Zero to Personal AI Assistant" video, but headless instead of Hostinger Docker Manager UI

## Where it lives

| | |
|---|---|
| VPS | `srv1377177.hstgr.cloud` / `72.61.241.170` (Hostinger KVM 2, Ubuntu 24.04) |
| VM id | `1377177` (Hostinger MCP) |
| SSH | `ssh -i ~/.ssh/hostinger_vps root@72.61.241.170` |
| Compose dir | `/docker/hermes/` (alongside `/docker/n8n/`) |
| Image | `nousresearch/hermes-agent:main` (Docker Hub — **not** GHCR) |
| Containers | `hermes` (gateway) + `hermes-dashboard` |
| Network mode | `host` (shares VPS network stack with n8n's stack) |
| Data volume | `/root/.hermes/` on host ↔ `/opt/data` in container |
| Patch | `/docker/hermes/main-wrapper.sh` bind-mounted over upstream (see Gotchas) |

## How to access it

| Want to... | How |
|---|---|
| Chat with Hermes | DM [`@hermes_kb_pa_bot`](https://t.me/hermes_kb_pa_bot) on Telegram |
| Dashboard (web) | `http://127.0.0.1:9119` — **VPS-local only**; tunnel via `ssh -L 9119:127.0.0.1:9119 ...` |
| CLI inside container | `docker exec -it hermes hermes <subcommand>` |
| Interactive chat in terminal | `docker exec -it hermes hermes chat` |
| Live logs | `docker logs hermes -f` (container stdout) or `docker exec hermes tail -f /opt/data/logs/gateway.log` |

## Configuration

- **LLM provider**: OpenRouter (`https://openrouter.ai/api/v1`)
- **Default model**: `deepseek/deepseek-v4-flash` (paid, $0.10/$0.20 per M tokens, 284B MoE, 1M context)
- **Reasoning effort**: `medium` (was `high` — `high` caused 64k token reservations that hit 402s on low credit)
- **Max tokens / completion tokens**: 4000 (cap output to fit OpenRouter promotional grace; raise after topping up if needed)
- **Agent loop caps**: `max_turns: 15`, `max_iterations: 20` (was 60/50 — runaway loops were burning credit, single setup conversation cost 22 API calls)
- **Auxiliary providers** (vision/title_generation/web_extract): all pinned to `openrouter` (was `auto`, kept trying Nous Inference → unauthorized → noise)
- **Telegram bot**: `@hermes_kb_pa_bot` (token in `.env`)
- **Allowed user**: `1912944391` (Kushal) — only this Telegram user can talk to the bot
- **Home channel** (for cron deliveries): same user ID

### MCP servers
- `google-tasks` — wraps `/opt/data/mcp/google-task-mcp-server/server.py` (mirror of `mcp/google-task-mcp-server/` in personal-stuff repo). 8 tools: `list_task_lists`, `list_tasks`, `add_task`, `move_task`, `complete_task`, `reorder_tasks`, `read_preferences`, `update_preferences`. Defaults all calls to `account="akshatpatidar17@gmail.com"`. Preferences file at `/opt/data/my planner/preferences-tasks-akshatpatidar17@gmail.com.md` drives smart-categorization.

### Google Workspace skill
- Bundled `productivity/google-workspace` skill is authed for `akshatpatidar17@gmail.com`. Token at `/opt/data/google_token.json`, client secret at `/opt/data/google_client_secret.json`. Scopes: Gmail (r/send/modify), Calendar, Drive, Contacts (r), Sheets, Docs. **No Tasks scope here** — Tasks goes via the MCP above, which uses the separate token under `/opt/data/mcp/google-shared/tokens/`.

Secrets live in `/root/.hermes/.env` on host (= `/opt/data/.env` in container):
- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `GITHUB_TOKEN` (classic PAT, `repo` scope)

Non-secret config is in `/opt/data/config.yaml`.

**Switching model / provider:**
```bash
docker exec hermes hermes config set model.default <slug>   # e.g. anthropic/claude-sonnet-4.6
docker exec hermes hermes config set agent.reasoning_effort <low|medium|high>
docker restart hermes
```

## Backup

- **Repo**: `github.com/akshat-git-jpg/hermes-personal-assistant` (private)
- **Cron**: `30 20 * * *` UTC = **02:00 Asia/Kolkata daily**
- **Cron id**: `ce87da005400`
- **Skill name**: `nightly-github-sync`
- **What syncs**: `/opt/data` excluding `.env`, sessions, logs, locks, transient DBs (see `.gitignore` in the backup repo)

```bash
# Force a backup now (smoke test)
docker exec hermes hermes cron run ce87da005400

# List all crons
docker exec hermes hermes cron list
```

## Common ops

```bash
# Status
docker ps --filter name=hermes
docker exec hermes hermes gateway status
docker exec hermes hermes doctor

# Restart after env / config changes
cd /docker/hermes && docker compose restart

# Bring stack down / up
cd /docker/hermes && docker compose down
cd /docker/hermes && docker compose up -d

# Update image (when Nous Research ships a new :main)
cd /docker/hermes && docker compose pull && docker compose up -d

# Hard reset (preserves data volume)
docker compose down && docker compose up -d
```

## Gotchas (learned the hard way)

### 1. `env_file` doesn't reach the gateway out of the box

The image's `/opt/hermes/docker/main-wrapper.sh` ships with `#!/bin/sh` instead of `#!/command/with-contenv sh`. s6-overlay parks Docker env vars in `/run/s6/container_environment/`, but without `with-contenv` they never get re-exported to the supervised `hermes gateway run` process. Symptom: gateway logs say *"No messaging platforms enabled"* even after `hermes config set TELEGRAM_BOT_TOKEN ...`.

**Fix:** we bind-mount our own `main-wrapper.sh` over the upstream one. See `/docker/hermes/main-wrapper.sh` on the VPS — adds `with-contenv` shebang and `export HOME=/opt/data`.

### 2. HOME stays at `/root` for the unprivileged hermes user

`s6-setuidgid hermes` drops privs to UID 10000 but **does not** change `HOME`. So `~/.local/state/hermes/gateway-locks/*.lock` resolves to `/root/.local/...` which UID 10000 can't write → `PermissionError` on Telegram connect.

**Fix:** the patched `main-wrapper.sh` exports `HOME=/opt/data` before `s6-setuidgid`.

### 3. cont-init scripts run as root and create files UID 10000 can't write

After the first `docker compose up`, run `chown -R 10000:10000 /root/.hermes` once. Otherwise the gateway hits `PermissionError: '/opt/data/logs/agent.log'` on startup.

### 4. `:latest` doesn't exist on Docker Hub

Pull `nousresearch/hermes-agent:main`. `ghcr.io/nousresearch/hermes-agent` returns "denied".

### 5. gh CLI returns 404 on this repo from the personal Mac

Cosmetic — write ops (repo create, push via embedded-token URL) work fine. Probably token scope / cache quirk on `gh api repos/...` reads. Verify via `git ls-remote` instead.

## Cost notes

OpenRouter balance check:
```bash
curl -sS https://openrouter.ai/api/v1/credits \
  -H "Authorization: Bearer $(ssh -i ~/.ssh/hostinger_vps root@72.61.241.170 'grep ^OPENROUTER_API_KEY= /root/.hermes/.env | cut -d= -f2-')"
```

Per-message cost on DeepSeek V4 Flash: ~$0.003–0.005. `$5 ≈ 1,400 messages`.

Cheaper-but-smaller fallbacks (will struggle with multi-step agent loops):
- `mistralai/mistral-nemo` — 6x cheaper, 12B params, "good enough" for simple turns
- `inclusionai/ling-2.6-flash` — 8x cheaper, untested for agents
- `meta-llama/llama-3.1-8b-instruct` — 4x cheaper, 8B params

Premium swap (if budget allows):
- `anthropic/claude-sonnet-4.6` — best agentic quality, ~$0.18/msg

## Security posture

- SSH: key-only (`PasswordAuthentication no`), root login key-only (`PermitRootLogin without-password`)
- Hostinger firewall `kb-vps-default` (id 297364) — open ports: 22, 80, 443 only
- Hermes gateway uses Telegram **long polling** — no inbound port exposed
- Dashboard binds 127.0.0.1 only — never reachable from internet
- VPS snapshot taken at end of initial setup (id `95985922`) as restore point
- Container: `restart: unless-stopped`; Docker daemon `enabled` on boot

## Scaling pattern (when adding a second Hermes)

The video covers spinning up additional Hermes agents (e.g., a "Finance Hermes" or "YT Hermes"). Each gets its own Docker container with its own `.env` and skill set — no shared keys. To add one:

1. New compose dir: `/docker/hermes-<role>/`
2. Separate volume: `/root/.hermes-<role>/`
3. Separate Telegram bot via `@BotFather`
4. Mirror the patched `main-wrapper.sh` setup
5. Different ports if dashboard is needed (e.g., 9120)

## Related memory entries (Claude auto-loads)

- `hermes-agent-setup` — quick project summary
- `hermes-agent-docker-gotchas` — the env_file + HOME fix in detail

## Useful links

- Hermes docs: https://hermes-agent.nousresearch.com/docs/
- Hermes GitHub: https://github.com/NousResearch/hermes-agent
- Backup repo: https://github.com/akshat-git-jpg/hermes-personal-assistant
- Source video: https://youtu.be/gb5TlGw6Uks
