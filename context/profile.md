# Profile

This profile outlines what is known about the owner's identity, working style, and active tools based on the repository code and architecture.

## Who I am
- **Owner**: Akshat Patidar (evidenced by email `akshatpatidar17@gmail.com` and admin user `akshat` on the `ntfy` server).
- **Domains & Brands**: 
  - `agrolloo.com` (Main personal brand and hub for custom tools/services).
  - `bridebestie.com` (Wedding-niche brand and affiliate landing page).
- <!-- TODO(owner interview): Add professional background, core focus areas, and personal bio details. -->

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
- <!-- TODO(owner interview): Add productivity preferences, communication styles, and coding/lifestyle habits. -->

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
- <!-- TODO(owner interview): List other crucial SaaS tools, developer tools, or hardware specs in use. -->
