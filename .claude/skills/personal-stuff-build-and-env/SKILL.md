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

Skills need NO setup on a new machine: they are repo-scoped, so cloning the repo is the install. `relink.sh` only covers what the repo cannot carry — the Codex mirror (`.claude/codex-skills.txt`), the push gate, and the shared memory store.

Dual-account facts that still matter: work config `~/.claude-work`, personal `~/.claude-personal`, one shared memory store linked by `relink.sh`. Use the `claude-work` / `claude-personal` shell functions to target an account — a bare `claude` alias silently hits work (details: **personal-stuff-debugging-playbook**). Which account you use no longer changes which skills load.

### Windows / any machine not running the dual-account scheme

Nothing special is needed any more. A bare `claude` launched inside the repo reads `.claude/skills` like every other account does, so the old "link `personal.txt` into plain `~/.claude/skills`" fallback (decisions.md 2026-08-11) was deleted with the store on 2026-08-25. `relink.sh` step 2 above still applies verbatim for the Codex mirror and the push gate. Two Windows-specific gotchas it does NOT paper over:
- **`python3` may not exist** — a stock python.org install only provides `python.exe`, and the Microsoft Store `python3` alias stub fails with "Python was not found". `relink.sh`'s description-cap guard needs a real `python3` on PATH; fix once with a one-line shim (`printf '#!/bin/sh\nexec python "$@"\n' > ~/.local/bin/python3 && chmod +x ~/.local/bin/python3`) and make sure `~/.local/bin` is on PATH (add to `~/.bashrc` if Git Bash has none yet — a fresh Git Bash install may not source anything by default).
- **`ln -s` on a directory needs admin/Developer Mode privilege**, which most Windows accounts don't have — MSYS silently falls back to an NTFS junction. It works exactly like a symlink for Claude Code (and everything else that just opens paths), but `ls -la`/`[ -L ]` won't show it as one; `skills-status.sh` reports it as `ok(junction)` rather than `ok`, which is correct, not a warning to chase.

## Runtimes and where they're required

| Runtime | Used by | Setup |
|---|---|---|
| Node | all `apps/*` (per-app `npm install`), Node CLIs in `tooling/cli/` | per-folder install; no root workspace |
| Python (one venv) | ALL of `pipelines/` | `cd pipelines && python3 -m venv venv && venv/bin/pip install -r requirements.txt` — **never per-subfolder venvs** |
| Python 3.11 (framework build) | MCP servers | `regen-mcp-json.sh` defaults to `/Library/Frameworks/Python.framework/Versions/3.11/bin/python3`; override with `MCP_PYTHON` |
| Go (1.26.3+) | printing-press CLIs (`~/go/bin/*-pp-cli`, `cli-printing-press`) | reinstall via the `printing-press-catalog` skill |
| pipx | `notebooklm` CLI (`~/.local/bin/notebooklm`) | `pipx install` per the `notebooklm` skill |

Wrangler is a per-app devDependency and versions are deliberately mixed (as of 2026-07-12: v3 in founders-tracker (pinned 3.114.17), gym-app, kushal-docs, redirector, timeblock; v4 in analytics-app, kushal-tools, lists-app, tutorial-tracker-app). There is no single repo-wide wrangler — never install or run a global one; always go through each app's own npm scripts.

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

Verified against `scripts/relink.sh`, `scripts/link-clis.sh`, `scripts/regen-mcp-json.sh`, `scripts/skills-status.sh`, `pipelines/CLAUDE.md`, app package.json wrangler pins, and `VPS-CRONS.md` on 2026-07-12. Re-verify: run `scripts/verify.sh` in this skill dir (offline checks; exit 0 all-pass, exit 1 names the failing check). The VPS layout check needs the network and is opt-in: `VERIFY_VPS=1 scripts/verify.sh` (or manually `ssh root@72.61.241.170 'ls /srv/crons /srv/projects'`) — SSH was unreachable from the 2026-07-12 verifying network, so VPS facts were re-verified against `VPS-CRONS.md` only.
