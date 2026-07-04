# personal-stuff — Claude Code guide

The full repo map, what-runs-where, and conventions live in the README, imported below.

## How to operate here (read first)

1. **Route by the question, not by browsing.** Match the ask to the "Find it fast" table below, go straight there, and read that folder's `CLAUDE.md`/README before acting. Don't grep the whole repo to orient.
2. **Before working in any sub-folder, open its `CLAUDE.md` (or README) first** — sub-folder files are NOT auto-loaded; the map only links them.
3. **When a non-obvious decision is made** (tool/approach chosen, convention set, a load-bearing "why"), append a dated line to [`decisions.md`](decisions.md). Check there before asking me to re-explain.
4. **Multi-step implementation work gets a plan file** — write it with `plans/_TEMPLATE.md` into `plans/`, register it in `plans/README.md`, and let an executor run it. Don't hand a chat transcript to another model.

## Find it fast (route by intent)

| If the ask is about… | Go to |
|---|---|
| A past decision / why something is done a certain way | [`decisions.md`](decisions.md) |
| What runs where — Cloudflare + VPS + DNS inventory | [`INFRA.md`](INFRA.md) |
| Cron architecture (Pattern B) | [`VPS-CRONS.md`](VPS-CRONS.md) |
| Every live URL across this repo (incl. `ty/`) | [`my-hosted-sites.md`](my-hosted-sites.md) |
| Who I am, active bets, product inventory, idea backlog | `context/` (start at [`context/CLAUDE.md`](context/CLAUDE.md)) |
| A custom Claude skill (source of truth) | `tooling/claude-skills/` |
| CLI tools Claude calls (gmail, sheets, youtube, hostinger, ntfy, rapidapi, yt-claude) | `tooling/cli/` |
| MCP servers (only `drive`, `cloudflare` still used) | `tooling/mcp/README.md` |
| A specific app | apps/<name>/ — full list in the README map below; every app folder has its own CLAUDE.md |
| Anything business / money-making (YouTube pipelines, Pinterest business, video production, income tracking, short links) | [`ty/CLAUDE.md`](ty/CLAUDE.md) — ty/ is a self-governing subtree with its own map, docs, and decisions.md |
| YouTube research / scripts / tutorial pipeline | `ty/youtube/` (via [`ty/CLAUDE.md`](ty/CLAUDE.md)) |
| Voiceover / TTS / RVC / HeyGen avatar pipelines | `ty/video-voice/` |
| Income tracking across platforms | `ty/income-analysis/` |
| Cross-project research notes, design specs, handoff docs | [`docs/`](docs/README.md) |
| Implementation plans for executor agents (write or run one) | [`plans/README.md`](plans/README.md) — convention in [`plans/WORKFLOW.md`](plans/WORKFLOW.md) |
| Infra (docker compose, VPS watchdog, secrets) | `infra/` |
| DSA practice notes/solutions | `learning/DSA/` |
| Repo-wide scripts + external path dependencies | `scripts/README.md` |

@README.md

## Where does a new thing go?

- A personal product (app someone uses) → `apps/<kebab-name>/` (+ README.md + CLAUDE.md from day one).
- A business / money-making project → `ty/<name>/` (register it in `ty/CLAUDE.md`'s map).
- A skill, CLI, or MCP for driving work with Claude → `tooling/` (skills need a manifest entry — see `scripts/relink.sh`).
- A deployable Worker lives with its **domain**, not its tech: the go.agrolloo.com redirector serves the business → it stays in `ty/workers/`.
- `ty/` is deliberately self-governing: its own CLAUDE.md, docs/, decisions.md. Root files never duplicate its detail; they delegate.

## Operating notes

- A folder's `README.md` orients a human; its `CLAUDE.md` (where present) tells Claude how to operate there.
- `INFRA.md` — canonical Cloudflare + VPS + DNS inventory.
- `VPS-CRONS.md` — cron architecture (Pattern B). It's a runbook, not auto-loaded; open it only for cron work.
- `my-hosted-sites.md` — flat index of every live URL across this repo, including `ty/`.
- Skills under `tooling/claude-skills/` are the single source, symlinked into both accounts via `scripts/relink.sh`. Never edit a symlinked copy elsewhere — edit here.
