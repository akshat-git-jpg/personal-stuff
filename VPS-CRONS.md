# VPS Cron Architecture (Pattern B)

Operational reference for every scheduled job running on the Hostinger VPS (`srv1377177.hstgr.cloud` / `72.61.241.170`). For what runs where overall, see [INFRA.md](./INFRA.md).

This file is mirrored to three locations so it's findable wherever you are:
- `akshat-git-jpg/personal-stuff` → `VPS-CRONS.md` (root)
- `akshat-git-jpg/vps-crons` → `VPS-CRONS.md` (root)
- VPS → `/root/VPS-CRONS.md` (for quick reference when SSH'd in)

Last updated: 2026-07-11.

---

## TL;DR

| | |
|---|---|
| Architecture | **Pattern B** — project code lives in `personal-stuff`, cron orchestration in `vps-crons`. Wrappers `git pull` the project repo on every run. |
| VPS code path | `/srv/projects/personal-stuff/` (clone of personal-stuff, read-only deploy key) |
| VPS cron path | `/srv/crons/` (clone of vps-crons, read-write deploy key) |
| Canonical crontab | `/srv/crons/crontab.txt` (version-controlled) |
| Telegram delivery | Each cron has its own `.env` with `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| Auth model for LLM crons | Personal Claude Pro plan (`kushalbakliwal25@gmail.com`) via `claude -p` |

## The decision rule (read this first)

**Code = git. Wiring = SSH.**

Every cron's `run.sh` starts with `git pull` of `personal-stuff`. So the VPS picks up your latest code automatically on every cron run — no manual pull needed.

You only have to SSH to the VPS in exactly these **5 situations**:

| Situation | One-time SSH action |
|---|---|
| 🆕 Adding a brand-new cron | create `.env`, set up `.venv`, `crontab /srv/crons/crontab.txt` |
| ⏰ Changing a cron's schedule (`crontab.txt` edited) | `ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'` |
| 📦 New pip dep added (changed `requirements.txt`) | `ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'` |
| 🔐 Secret changed (Telegram token, OAuth token expired) | edit `.env` or scp the new token |
| 🗑️ Removing/disabling a cron | edit `crontab.txt`, run `crontab /srv/crons/crontab.txt` |

Anything else — code, prompts, preferences, new files inside a project — is **just `git push` on the Mac**. The VPS catches up on the next cron tick.

---

## The mental model

Three computers in play:

```
┌────────────────────────────┐              ┌────────────────────────────────┐
│  Mac                       │              │  VPS (Hostinger, always on)    │
│  ~/codebase/personal-stuff │  push        │  /srv/projects/personal-stuff  │
│  (project code — Pattern B │ ──── GH ───► │  ← clone of personal-stuff     │
│   source of truth)         │              │     (read-only deploy key)     │
│                            │              │                                │
│  ~/codebase/vps-crons      │  push        │  /srv/crons/                   │
│  (cron orchestration)      │ ──── GH ───► │  ← clone of vps-crons          │
│                            │              │     (read-write deploy key)    │
└────────────────────────────┘              └────────────────────────────────┘
```

GitHub is the bridge. The Mac never SSHes code into the VPS — everything goes through `git push` / `git pull`.

### Why two repos, not one?

| Concern | Where it lives |
|---|---|
| Project code (Python/JS/whatever) — also runnable on Mac without cron | `personal-stuff` |
| Project preferences (workout-routine.json, email-preferences.md) | `personal-stuff` |
| MCP servers — shared across many crons | `personal-stuff/tooling/mcp/` |
| Cron schedule + crontab line | `vps-crons/crontab.txt` |
| Cron wrapper (`run.sh`) — orchestrates one cron run | `vps-crons/<job>/run.sh` |
| Telegram bot token + chat_id (per-cron, may differ per job) | `vps-crons/<job>/.env` (gitignored) |
| Claude prompt (for LLM crons) | `vps-crons/<job>/prompt.md` |
| MCP config wired for the cron environment | `vps-crons/<job>/.mcp.json` |
| OAuth tokens, venvs, secrets that the project needs | next to the project code in `/srv/projects/personal-stuff/` (gitignored) |

The split keeps "what does the work" separate from "when and how it's triggered."

---

## Repo: `personal-stuff`

Public name: `akshat-git-jpg/personal-stuff` (private).

Layout (only the cron-relevant pieces):

```
personal-stuff/
├── README.md                          ← repo map (start here)
├── INFRA.md                           ← what runs where
├── VPS-CRONS.md                       ← this file (one of three copies)
├── apps/
│   ├── telegram-my-planner/
│   │   ├── tools/daily-digest/        ← kb-daily-planner project lives here
│   │   │   ├── notifier.py, renderer.py, auth.py, config.py, …
│   │   │   ├── exercise-routine.json  ← prefs lives next to code
│   │   │   ├── requirements.txt
│   │   │   ├── .venv/                 ← (gitignored — per-machine)
│   │   │   └── token.json             ← (gitignored — vendored OAuth)
│   │   ├── exercise-routine/
│   │   └── preferences-tasks-akshatpatidar17@gmail.com.md
│   └── telegram-email-assistant/      ← gmail-digest prefs + digest.sh
│       └── email-preferences-kushalbakliwal25@gmail.com.md
├── tooling/
│   └── mcp/                           ← MCP servers + shared OAuth (used by Claude-driven crons)
│       ├── gmail-mcp-server/
│       ├── google-task-mcp-server/
│       ├── google-shared/             ← shared OAuth code + tokens (tokens gitignored)
│       └── ...
└── infra/
    └── secrets/                       ← gitignored
```

Naming convention: **all directory names are hyphenated, no spaces.** Top level is grouped into `apps/`, `tooling/`, `infra/`, `learning/`, `docs/`, `scripts/` (see the repo `README.md`).

---

## Repo: `vps-crons`

Public name: `akshat-git-jpg/vps-crons` (private).

```
vps-crons/
├── README.md                            ← index of all crons + how to add one
├── VPS-CRONS.md                         ← this file (one of three copies)
├── crontab.txt                          ← canonical cron table
├── .gitignore
├── _shared/
│   ├── telegram.sh                      ← send_telegram() — reads TELEGRAM_BOT_TOKEN + CHAT_ID from env
│   └── claude-env.sh                    ← CLAUDE_BIN + claude_run() helper
├── _template/                           ← copy this when scaffolding a new cron
│   ├── README.md
│   ├── run.sh                           ← thin-wrapper template (Pattern B)
│   ├── prompt.md
│   ├── .mcp.json
│   └── .env.example
├── my-planner/                            ← project: kb-daily-planner
│   ├── README.md
│   ├── run.sh                           ← sources .env, git-pulls personal-stuff, execs notifier.py
│   ├── .env                             ← (gitignored) — Telegram bot + chat
│   ├── .env.example
│   └── logs/                            ← cron stderr/stdout
└── gmail-digest/                        ← scaffolded, not yet enabled
    ├── README.md
    ├── run.sh
    ├── prompt.md
    ├── .mcp.json
    ├── .env.example
    └── logs/
```

---

## VPS setup

### File-system layout

```
/srv/projects/personal-stuff/             ← clone of personal-stuff
/srv/crons/                               ← clone of vps-crons
/docker/n8n/                              ← n8n (separate concern)
/root/.claude/                            ← Claude Code creds (Pro plan, kushalbakliwal25@gmail.com)
/root/.local/bin/claude                   ← Claude Code binary
/root/.ssh/                               ← SSH keys (see below)
/root/VPS-CRONS.md                        ← this file (one of three copies)
```

### SSH keys (on the VPS)

Three keys, three purposes:

| File | Purpose |
|---|---|
| `/root/.ssh/hostinger_vps`* | Mac → VPS SSH (your laptop's key, lives on Mac at `~/.ssh/hostinger_vps`) |
| `/root/.ssh/github_vps` | VPS → GitHub (`vps-crons` repo, **read-write**) |
| `/root/.ssh/github_personal_stuff` | VPS → GitHub (`personal-stuff` repo, **read-only**) |

\* The pub half lives in `/root/.ssh/authorized_keys`; the priv half is on your Mac.

### SSH config (`/root/.ssh/config`)

Host aliases pick the right key per repo:

```
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/github_vps
  IdentitiesOnly yes

Host github-personal-stuff
  HostName github.com
  User git
  IdentityFile /root/.ssh/github_personal_stuff
  IdentitiesOnly yes
```

So:
- `git clone git@github.com:akshat-git-jpg/vps-crons.git`              → uses `github_vps`
- `git clone git@github-personal-stuff:akshat-git-jpg/personal-stuff.git` → uses `github_personal_stuff`

### Cron daemon

- Standard Ubuntu `cron` service (`systemctl is-active cron`).
- Runs as `root`.
- VPS timezone is **UTC**. IST = UTC+5:30 (no DST). Convert when writing schedules.

### Claude Code (for LLM-driven crons)

- Binary: `/root/.local/bin/claude` (symlink to `/root/.local/share/claude/versions/<v>`)
- Auth: `claude.ai` subscription, plan **Pro**, account `kushalbakliwal25@gmail.com`
- Credentials file: `~/.claude/.credentials.json` (chmod 600)
- Why personal Pro and not Zluri Team: cron usage burns through Anthropic quotas, kept off the work seat for visibility/optics
- Verify: `claude auth status`

`/srv/crons/_shared/claude-env.sh` sets `CLAUDE_BIN=/root/.local/bin/claude` so cron's stripped PATH still finds it. Sourced by any LLM-driven `run.sh` via `claude_run` helper.

---

## The Pattern B contract

Every cron's `run.sh` follows this shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$JOB_DIR"

# 1. Per-cron secrets — Telegram bot/chat (can differ per cron)
[[ -f .env ]] && set -a && source .env && set +a

# 2. Shared helpers
source /srv/crons/_shared/telegram.sh
source /srv/crons/_shared/claude-env.sh        # only for LLM crons

# 3. Pull latest project code (soft-fail: keep old checkout if git hiccups)
PROJECT_REPO="/srv/projects/personal-stuff"
PROJECT_DIR="$PROJECT_REPO/<path-to-project>"
git -C "$PROJECT_REPO" pull --quiet 2>>"$JOB_DIR/logs/git.log" \
  && echo "git pull: ok" || echo "git pull: failed; using existing checkout"

# 4. Invoke the project
cd "$PROJECT_DIR"
exec ./.venv/bin/python main.py          # Python project, or:
# claude_run --mcp-config "$JOB_DIR/.mcp.json" --add-dir "$PROJECT_DIR" "$(cat prompt.md)"
```

Four invariants:
1. **Wrapper owns secrets**, project doesn't see them in code.
2. **Wrapper owns the schedule**, project doesn't know about cron.
3. **Wrapper owns delivery** (Telegram), project just outputs.
4. **Project owns the work** — `notifier.py`, `main.py`, Claude prompts. Runnable on Mac without any cron involvement.

---

## Adding a new cron (full lifecycle)

### 1. On Mac — build the project

```bash
cd ~/codebase/personal-stuff
mkdir -p apps/<my-new-tool>  # (or pipelines/… per the placement rule in the repo CLAUDE.md)
cd apps/<my-new-tool>

# Build it. Make it runnable locally:
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./run-locally.sh   # or whatever
```

Test it. Confirm it works directly on the Mac, no cron involved.

### 2. On Mac — push project code

```bash
cd ~/codebase/personal-stuff
git add apps/<my-new-tool>
git commit -m "Add my-new-tool"
git push
```

### 3. On Mac — scaffold the cron wrapper

```bash
cd ~/codebase/vps-crons       # (clone separately if you haven't yet)
cp -r _template my-new-tool
cd my-new-tool
```

Edit:
- `README.md` — describe what it does, schedule, where the real code lives
- `run.sh` — set `PROJECT_DIR="$PROJECT_REPO/apps/<my-new-tool>"` and replace the `# replace below` block with the actual command
- `.env.example` — schema (typically just Telegram)
- `prompt.md` + `.mcp.json` — only if it's a Claude-driven cron
- Root `README.md` — add a row in the index table
- `crontab.txt` — add the schedule line:
  ```
  0 4 * * * /srv/crons/my-new-tool/run.sh >> /srv/crons/my-new-tool/logs/cron.log 2>&1
  ```
  *(remember: VPS time is UTC; 09:30 IST = 04:00 UTC)*

```bash
git add . && git commit -m "Add my-new-tool cron" && git push
```

### 4. On VPS — one-time setup for this cron

```bash
ssh root@72.61.241.170

# Pull both repos
cd /srv/crons && git pull
cd /srv/projects/personal-stuff && git pull

# Create cron-side .env
cd /srv/crons/my-new-tool
cp .env.example .env
nano .env             # fill in TELEGRAM_BOT_TOKEN, CHAT_ID
chmod 600 .env

# Set up project-side venv (if Python)
cd /srv/projects/personal-stuff/apps/<my-new-tool>
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Place any tokens/credentials the project needs (gitignored, scp'd from Mac)
# scp credentials/token from Mac as needed

# Smoke test
/srv/crons/my-new-tool/run.sh
# expected: see the work happen, Telegram message arrive

# Activate
crontab /srv/crons/crontab.txt
crontab -l            # verify new line is present
```

### 5. Future tweaks

Code changes: edit on Mac → push → no further action; the next cron tick `git pull`s automatically.
Schedule changes: edit `crontab.txt` on Mac → push → SSH and `crontab /srv/crons/crontab.txt`.
Secret rotation: edit `.env` on the VPS directly (not in git).

---

## Common operations

### Apply schedule or dependency changes

To apply changes to `crontab.txt` or a `requirements.txt`, you don't need manual steps. Just run:
```bash
ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'
```

### Manual run a cron (without waiting for schedule)

```bash
ssh root@72.61.241.170
/srv/crons/<job>/run.sh
```

### Check what cron did

```bash
ssh root@72.61.241.170
tail -50 /srv/crons/<job>/logs/cron.log
```

### Disable a cron temporarily

Edit `crontab.txt`, comment the line:
```
# 30 0 * * * /srv/crons/my-planner/run.sh ...
```
Then `crontab /srv/crons/crontab.txt`. Commit + push so the disable is durable across machines.

### Remove a cron permanently

1. Delete line from `crontab.txt`, run `crontab /srv/crons/crontab.txt`.
2. `rm -rf /srv/crons/<job>/` on VPS.
3. Remove from index table in root `README.md`.
4. Commit + push from Mac.
5. (Optional) clean up the project code in `personal-stuff` if it was cron-only.

### Update Python deps for a project

Mac:
```bash
cd ~/codebase/personal-stuff/<path>
# update requirements.txt
.venv/bin/pip install -r requirements.txt   # local
git add requirements.txt && git commit -m "..." && git push
```
VPS:
```bash
ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'
```

### Rotate a Google OAuth token

If the project's `token.json` expires (rare — refresh tokens are long-lived but can be revoked):

Mac:
```bash
# Re-run consent flow on Mac via tooling/mcp/google-shared/setup_auth.py
python3 tooling/mcp/google-shared/setup_auth.py
# This writes tooling/mcp/google-shared/tokens/<email>.json
```

VPS:
```bash
# Copy fresh token to wherever the project expects it
scp /Users/kbtg/codebase/personal-stuff/tooling/mcp/google-shared/tokens/akshatpatidar17@gmail.com.json \
    root@72.61.241.170:'/srv/projects/personal-stuff/apps/telegram-my-planner/tools/daily-digest/token.json'
```

### View the active crontab

```bash
ssh root@72.61.241.170 'crontab -l'
```

Should always match `/srv/crons/crontab.txt`. If it diverges, someone edited via `crontab -e` directly — undo by re-running `crontab /srv/crons/crontab.txt`.

---

## Active crons

### my-planner

- **What:** Calendar + workout digest → Telegram image album
- **When:** 06:00 IST daily (`30 0 * * *` UTC)
- **Wrapper:** `/srv/crons/my-planner/run.sh`
- **Project code:** `/srv/projects/personal-stuff/apps/telegram-my-planner/tools/daily-digest/`
- **Account:** Google Calendar for `akshatpatidar17@gmail.com` (OAuth via vendored `token.json`)
- **Telegram dest:** `@hermes_kb_pa_bot`, chat_id `1912944391` (set in `.env`)

This is the canonical Pattern B example. Read its `run.sh` + `README.md` if you want a working reference.

### gmail-digest

- **What:** Two-part Gmail digest via Claude Code + Gmail MCP → Telegram text
- **When:** 06:00 IST daily (`30 0 * * *` UTC)
- **Wrapper:** `/srv/crons/gmail-digest/run.sh`
- **Project code:** `/srv/projects/personal-stuff/apps/telegram-email-assistant/digest.sh` (+ `digest-prompt.md`)
- **MCP:** Gmail MCP at `/srv/projects/personal-stuff/tooling/mcp/gmail-mcp-server/server.py` running under shared venv at `/srv/projects/personal-stuff/tooling/mcp/.venv/`
- **OAuth:** `/srv/projects/personal-stuff/tooling/mcp/google-shared/credentials.json` + `tokens/<email>.json` per account (gitignored, scp'd from Mac)
- **Accounts:** all four — `kushalbakliwal25`, `seankerman25`, `jessicap123k`, `akshatpatidar17` (@gmail.com) — set via space-separated `DIGEST_EMAILS` in `.env`; one Telegram message per account, per-account soft-fail, "no emails in window" sends a 📭 note instead of an error
- **Telegram dest:** `@hermes_kb_pa_bot`, chat_id `1912944391` (same as my-planner)
- **Output format:** Part 1 (Claude's judgment of what matters) + Part 2 (matches against "Digest focus areas" in the per-account preferences file)

### repo-sync

- **What:** keeps the VPS current for **interactive** Claude (Remote Control / Claude mobile) — `git pull` `personal-stuff` + rebuild `~/.claude/skills` from `manifest/personal.txt`
- **When:** every 15 min (`*/15 * * * *` UTC)
- **Wrapper:** `/srv/crons/repo-sync/run.sh`
- **Project code:** `/srv/projects/personal-stuff/scripts/vps-sync.sh`
- **Why separate from the digests:** the digest crons only pull when they fire (06:00). This keeps code + skills fresh all day so Claude mobile isn't stale. Push from the Mac → live on the VPS within 15 min.

### d1-backup

- **What:** nightly export of all 5 D1 databases → owned `.sql` dumps in MinIO (`d1-backups/<YYYYMMDD>/`, 30-day retention). Backs up money (clicks-db) + team (tracker-db) data that Cloudflare time-travel only holds ~30 days.
- **When:** 01:00 IST daily (`30 19 * * *` UTC)
- **Wrapper:** `/srv/crons/d1-backup/run.sh`
- **Project code:** `/srv/projects/personal-stuff/pipelines/backups/d1_export.py`
- **MinIO:** localhost `127.0.0.1:9000`, bucket `d1-backups`; upload + prune via `mc`
- **Alerting:** silent on success; shared `alert.sh` → Telegram on any export/upload failure

### site-probe

- **What:** GET every URL in `my-hosted-sites.md`; Telegram on any down site.
- **When:** Hourly (`15 * * * *` UTC)
- **Wrapper:** `/srv/crons/site-probe/run.sh`

### cred-probe

- **What:** daily Google-token + claude-auth health check (plan 057); silent on success, Telegram on failure.
- **When:** 05:00 IST (`30 23 * * *` UTC)
- **Wrapper:** `/srv/crons/cred-probe/run.sh`
- **Project code:** `/srv/projects/personal-stuff/infra/cred-probe/`

### route-audit

- **What:** weekly read-only routing-drift audit via `claude -p` → Telegram report (the autonomy pilot).
- **When:** Sunday 08:00 IST (`30 2 * * 0` UTC)
- **Wrapper:** `/srv/crons/route-audit/run.sh`
- **Project code:** `/srv/projects/personal-stuff/infra/route-audit/`

---

## Gotchas / things to remember

### 1. VPS is UTC

```
IST hour − 5.5 = UTC hour
```
- 06:00 IST → 00:30 UTC → `30 0 * * *`
- 07:30 IST → 02:00 UTC → `0 2 * * *`
- 09:00 IST → 03:30 UTC → `30 3 * * *`
- 21:00 IST → 15:30 UTC → `30 15 * * *`

If you forget which way to subtract: India is *ahead* of UTC, so a 6am IST cron fires at UTC's `00:30`, not at `11:30`.

### 2. Cron has a stripped PATH

When a cron line fires, `$PATH` is typically `/usr/bin:/bin`. Anything you need from `/root/.local/bin/`, `nvm`, `homebrew`, etc. must be referenced by absolute path or sourced explicitly.

Why `_shared/claude-env.sh` exists: to set `CLAUDE_BIN=/root/.local/bin/claude` so LLM crons don't fail with "claude: command not found."

### 3. Secrets never go to git

`.env`, `token.json`, `credentials.json`, `*.venv/` are all gitignored. They live on the VPS only. If the VPS dies, you must rebuild secrets from your Mac sources (`scp` tokens, recreate venvs).

### 4. The cron pulls; it does not push

`/srv/projects/personal-stuff/` is cloned with a read-only deploy key. Any `git commit` on the VPS for that repo will succeed but `git push` will be rejected. This is intentional — production crons should never write back to the project source.

`/srv/crons/` has read-write so emergency fixes from the VPS are possible — but the convention is "edit on Mac, push, pull on VPS."

### 5. Pro plan rate limits apply to cron use

Cron jobs running `claude -p` count against the personal Pro plan limits (`kushalbakliwal25@gmail.com`). A few daily cron invocations are noise; aggressive sub-hourly LLM crons would throttle. If you ever build a cron that's heavy on Claude usage, watch quota.

### 6. The personal-Pro account is on the VPS, the work-Team account is on the Mac

`claude auth status` on each:
- **VPS** (`ssh root@72.61.241.170 'export PATH=/root/.local/bin:$PATH; claude auth status'`) → `kushalbakliwal25@gmail.com`, `subscriptionType: pro`
- **Mac** → `kushal.b@zluri.com`, `subscriptionType: team`

This is deliberate. Personal automation never touches the Zluri Team seat.

---

## Reference: useful one-liners

```bash
# SSH in
ssh root@72.61.241.170

# Pull both repos
ssh root@72.61.241.170 'cd /srv/crons && git pull && cd /srv/projects/personal-stuff && git pull'

# Apply changed crontab
ssh root@72.61.241.170 'crontab /srv/crons/crontab.txt && crontab -l'

# Tail my-planner cron log
ssh root@72.61.241.170 'tail -f /srv/crons/my-planner/logs/cron.log'

# Manually trigger my-planner now
ssh root@72.61.241.170 '/srv/crons/my-planner/run.sh'

# Verify Claude auth on VPS
ssh root@72.61.241.170 'export PATH=/root/.local/bin:$PATH; claude auth status'

# List active deploy keys on a repo
gh repo deploy-key list --repo akshat-git-jpg/vps-crons
gh repo deploy-key list --repo akshat-git-jpg/personal-stuff
```
