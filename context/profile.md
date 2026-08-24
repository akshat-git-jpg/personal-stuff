# Profile

Who the owner is, how they like to work, and what they drive everything with.
Merged 2026-08-24 from the archived Claude user-memory store (the earlier version of
this file was inferred from repo code alone and named the wrong person).

## Who I am
- **Owner**: Kushal Bakliwal, who goes by **Kola**.
- **Day job**: Senior Software Engineer at **Zluri** (B2B SaaS). Work email `kushal.b@zluri.com`.
- **Personal email**: `kushalbakliwal25@gmail.com`.
- **Personal git/brand identity**: this repo is pushed as GitHub user `akshat-git-jpg`
  (`akshatparty17@gmail.com`); the `ntfy` server admin user is `akshat`. Work repos push as
  `kushal-zluri` - see the `github-router` skill before any commit or push.
- **Professional focus**: HLD and LLD. Wants better solutioning quality and architecture
  decisions, and treats the work as personal learning, not just delivery.
- **Core belief**: automate everything. Long-time n8n builder; uses AI to do more with less
  manual effort.
- **Domains & Brands**:
  - `agrolloo.com` (main personal brand and hub for custom tools/services).
  - `bridebestie.com` (wedding-niche brand and affiliate landing page).

## How I work
- **Multi-Account Claude Agent Workflow**: Uses a dual-account Claude Code setup:
  - **Work Account**: Guided by `~/.claude-work/skills` (configured via [relink.sh](file:///Users/kbtg/codebase/personal-stuff/scripts/relink.sh)).
  - **Personal Account**: Guided by `~/.claude-personal/skills` (configured via [relink.sh](file:///Users/kbtg/codebase/personal-stuff/scripts/relink.sh)).
- **Durable Planning & Decisions**:
  - Code changes follow the **Orchestrator-Executor workflow** (structured plans in `plans/`, registered in `plans/README.md` status table).
  - Important, non-obvious architecture or codebase decisions are recorded in [decisions.md](file:///Users/kbtg/codebase/personal-stuff/decisions.md) to preserve context across chat sessions.
  - Interactive exploration is routed via intent-based tables in root and folder-level `CLAUDE.md` files rather than blanket searches.
- **Git & Media Hygiene**:
  - Keeps working directories clean and compact.
  - Bulky binaries, machine learning models, and work directories are stored externally in `~/kb-scratch/` to avoid bloating the git index or slowing down agent searches.
  - Video and media render outputs are kept out of git tracking via `.gitignore`.
- **Plan before building**: never jump straight to code. Ask the questions needed to
  understand the requirement, propose a plan, discuss until it is agreed, and only then
  build. The owner wants to be convinced by the plan first - implementing off a
  half-agreed direction wastes the effort.
- **Commit style**: single-line conventional subject, no body, no AI mentions. The full
  rule lives in `~/.claude-work/CLAUDE.md` and is enforced by the `commit-now` skill.
- **How replies should read**: explanations and status reports addressed to the owner go
  through the `i-have-adhd` skill - action first, short sentences, exact paths. Anything
  drafted for a third party goes through `humanizer` instead.
- **Cost matters**: batch clarifying questions, avoid re-reading context, and do not
  duplicate the same content across a spec and a plan.

## Tools & Accounts I Drive Everything With
- **Hostinger VPS**: 
  - Ubuntu 24.04 LTS VPS (`srv1377177.hstgr.cloud` / `72.61.241.170`) running Docker containers (Traefik, n8n, MinIO, ntfy, and personal-dashboard).
  - Configured with crons that sync repository skills every 15 minutes, generate daily digests (Telegram alerts), and run automated watchdogs.
- **Cloudflare Edge**:
  - Handles zone DNS and hosts 10+ serverless Cloudflare Workers (like `redirector`, `tutorials-tracker`, `lists-app`, `yt-analytics`, etc.) backed by KV namespaces and D1 SQLite databases.
- **Google Ecosystem**:
  - Integration with Google Sheets, Gmail, Tasks, and YouTube APIs utilizing a shared OAuth token client config (`tooling/mcp/google-shared/`).
- **Affiliate & Payment Platforms**:
  - PayPal (Business API reporting).
  - impact.com (Affiliate reporting).
  - gumroad-pp-cli & skool-pp-cli (Gumroad & Skool CLI scripts).
- **Editors & daily drivers**: Cursor (a VS Code fork) plus Claude Code, used heavily.
  There is no plain VS Code on this Mac and the `code` CLI is not on `PATH` - point
  `$EDITOR`/`$VISUAL` at the full binary path inside the Cursor app bundle. The owner
  dislikes vim.
- **Claude Code setup**: two separate logins driven by `CLAUDE_CONFIG_DIR` in `~/.zshrc` -
  `claude-work` (`~/.claude-work`, the Zluri login) and `claude-personal`
  (`~/.claude-personal`, the Gmail login). Plain `claude` is aliased to `claude-work`.
- **Everyday stack**: TypeScript (backend-focused), PostgreSQL as the read side, MongoDB as
  the source of truth for writes.
- **Automation**: n8n, Claude premium, and the Hostinger VPS above.
