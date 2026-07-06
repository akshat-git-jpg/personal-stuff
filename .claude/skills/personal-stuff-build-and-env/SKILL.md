---
name: personal-stuff-build-and-env
description: Use when setting up personal-stuff on a new machine, recovering a broken environment, or wiring a fresh clone — regenerating machine-local runtime (venvs, .mcp.json, symlinked paths), npm installs failing with 401, Go/pipx tool installs, or a dead VPS that needs rebuilding. Also use when anything works on one machine but not another. (Managing which skills/plugins go to which account stays with claude-router.)
---

# Build and environment (from scratch)

## Overview

The repo is code-only; every machine adds gitignored runtime (venvs, tokens, .env files, symlinks, .mcp.json). Rebuild = clone + regenerate runtime per this order. **Skill/plugin management itself is owned by the existing `claude-router` skill — use it for manifest edits; this skill covers everything else.**

## Mac rebuild sequence

```bash
# 1. Clone to the load-bearing path (zshrc git-identity + github-router key on it)
git clone git@github.com:akshat-git-jpg/personal-stuff.git ~/codebase/personal-stuff
git clone git@github.com:akshat-git-jpg/vps-crons.git ~/codebase/vps-crons   # cron orchestration

# 2. Skill symlinks for BOTH Claude accounts (work + personal)
cd ~/codebase/personal-stuff && ./scripts/relink.sh
# then RESTART any open Claude session — skill discovery is cached

# 2b. Repo CLIs (wt, yt-claude) onto PATH via ~/.local/bin
./scripts/link-clis.sh

# 3. Machine-local MCP config (gitignored, absolute paths)
./scripts/regen-mcp-json.sh        # wires google-drive + cloudflare only; MCP_PYTHON overrides interpreter

# 4. Verify
./scripts/skills-status.sh          # membership + symlink health table; exit 1 on any problem
```

Dual-account facts: work config `~/.claude-work`, personal `~/.claude-personal`; manifests `tooling/claude-skills/manifest/{work,personal}.txt`; `relink.sh` resolves each name from the store, else `~/.agents/skills` (the printing-press `pp-*` skills live there). Use the `claude-work` / `claude-personal` shell functions to target an account — a bare `claude` alias silently hits work (details: **personal-stuff-debugging-playbook**).

## Runtimes and where they're required

| Runtime | Used by | Setup |
|---|---|---|
| Node | all `apps/*` (per-app `npm install`), Node CLIs in `tooling/cli/` | per-folder install; no root workspace |
| Python (one venv) | ALL of `pipelines/` | `cd pipelines && python3 -m venv venv && venv/bin/pip install -r requirements.txt` — **never per-subfolder venvs** |
| Python 3.11 (framework build) | MCP servers | `regen-mcp-json.sh` defaults to `/Library/Frameworks/Python.framework/Versions/3.11/bin/python3`; override with `MCP_PYTHON` |
| Go (1.26.3+) | printing-press CLIs (`~/go/bin/*-pp-cli`, `cli-printing-press`) | reinstall via the `printing-press-catalog` skill |
| pipx | `notebooklm` CLI (`~/.local/bin/notebooklm`) | `pipx install` per the `notebooklm` skill |

## The npm 401 trap (work machine)

The work `~/.npmrc` points at Zluri CodeArtifact, which 401s on public packages. Repo apps carry a local `.npmrc` pinning the public registry — **keep it**, and give any NEW nested Node project its own cwd-local `.npmrc` before first `npm install`.

## Secrets restoration

Follow the six axes in **personal-stuff-config-and-secrets**. The two that block everything else:
- Google OAuth: place `tooling/mcp/google-shared/credentials.json`, then `python3 tooling/mcp/google-shared/setup_auth.py <email>` per account (browser consent — Mac only).
- `pipelines/.env`: rebuild from the real key list in the secrets skill, NOT from the stale `.env.example`.

## VPS rebuild (dead-box recovery)

Full detail in `VPS-CRONS.md`; the skeleton: provision Ubuntu 24.04 → restore `/root/.ssh/` keys (`github_vps` read-write for vps-crons, `github_personal_stuff` read-only, host aliases in `~/.ssh/config`) → clone to `/srv/crons/` and `/srv/projects/personal-stuff/` → install Claude Code + `claude auth login` (kushalbakliwal25 Pro; NOT `setup-token`, Remote Control rejects it) → per-cron `.env` + venvs + `scp` tokens from Mac → `crontab /srv/crons/crontab.txt` → restore `/docker/*` compose projects. Hostinger keeps weekly backups — check those before rebuilding by hand.

## After moving/renaming anything in the repo

Symlinks store absolute paths and `.mcp.json` hardcodes them: re-run `./scripts/relink.sh` + `./scripts/link-clis.sh` + `./scripts/regen-mcp-json.sh`, and check `scripts/README.md`'s external-dependency list (zshrc, vps-crons wrappers, VPS mounts, github-router).

## When NOT to use this skill

- Managing which skills go to which account → existing `claude-router` skill
- A single secret/env question → **personal-stuff-config-and-secrets**
- Something broke that used to work (not a fresh machine) → **personal-stuff-debugging-playbook**

## Provenance and maintenance

Verified against `scripts/relink.sh`, `scripts/regen-mcp-json.sh`, `scripts/skills-status.sh`, `pipelines/CLAUDE.md`, `VPS-CRONS.md`, and memory of tool installs on 2026-07-05. Re-verify:
- Script behavior: read the script headers (`sed -n '1,20p' scripts/<name>.sh`)
- Runtime homes: `which rtk; ls ~/go/bin | grep pp-cli; ls ~/.agents/skills`
- VPS layout: `ssh root@72.61.241.170 'ls /srv/crons /srv/projects'`
