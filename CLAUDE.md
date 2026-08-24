# personal-stuff — Claude Code guide

Routing lives in the table below. The human-facing repo map (per-app one-liners, conventions) is in [README.md](README.md) — open it only when you need the full inventory.

## How to operate here (read first)

1. **Route by the question, not by browsing.** Match the ask to the "Find it fast" table below, go straight there, and read that folder's `CLAUDE.md`/README before acting. Don't grep the whole repo to orient.
2. **Before working in any sub-folder, open its `CLAUDE.md` (or README) first** — sub-folder files are NOT auto-loaded; the map only links them.
3. **When a non-obvious decision is made** (tool/approach chosen, convention set, a load-bearing "why"), append a dated line to [`decisions.md`](decisions.md). Check there before asking me to re-explain.
4. **Multi-step implementation work gets a plan file** — write it with `plans/_TEMPLATE.md` into `plans/`, register it in `plans/README.md`, and let an executor run it. Don't hand a chat transcript to another model.
5. **New-build routing (do not detour):** for a new feature/tool/skill, the entry point is the `orchestrate` skill — it brainstorms when fuzzy, writes the plan into `plans/`, and hands off. Do **NOT** use `superpowers:writing-plans` here (its generic terminal); `orchestrate` is this repo's plan writer. Raise the finished plan with `secretary` (`/secretary raise`) — never hand-roll the branch/commit/PR, because secretary encodes "stage only the plan file, never commit it to `main`." Brainstorm-first (standalone `superpowers:brainstorming`) only when you specifically want a design doc before any plan.

## Find it fast (route by intent)

| If the ask is about… | Go to |
|---|---|
| A past decision / why something is done a certain way | [`decisions.md`](decisions.md) |
| Commit rules in this repo (branch naming, `commit-now` overrides, plan-vs-inline) | `.claude/skills/personal-stuff-change-control/SKILL.md` |
| What runs where — Cloudflare + VPS + DNS inventory | [`INFRA.md`](INFRA.md) |
| Cron architecture (Pattern B) | [`VPS-CRONS.md`](VPS-CRONS.md) |
| Background jobs on the MacBook (launchd agents) | [`MAC-LAUNCHD.md`](MAC-LAUNCHD.md) |
| Every live URL across this repo (incl. `pipelines/`) | [`my-hosted-sites.md`](my-hosted-sites.md) |
| Who I am, active bets, product inventory, idea backlog | `context/` (start at [`context/CLAUDE.md`](context/CLAUDE.md)) |
| A custom Claude skill (source of truth) | cross-repo: `tooling/claude-skills/` (manifest+relink); repo-operating: `.claude/skills/`; pipelines-domain: source in `pipelines/.claude/skills/`, also symlinked into `.claude/skills/` so a root-level session sees them |
| CLI tools Claude calls (gmail, sheets, youtube, hostinger, ntfy, rapidapi, yt-claude, cf-email, drive, heygen-web, local-apps-dashboard, flights, flow-queue) | `tooling/cli/` |
| Printing Press Go CLIs (`paypal-txns-pp-cli`, `impact-pp-cli`, others) and where their source is backed up | `tooling/press-clis/README.md` |
| Session tags in the Claude Code agents view (ctrl+e / tag view unlock, auto-repatch) | `tooling/cli/pp-claude-tags/README.md` |
| Send image-gen prompts to Google Flow from any pipeline (approve-the-look gates) | `tooling/cli/flow-queue/README.md` + the browser extension in `pipelines/video/zapi-flow-ext/` |
| Flight search with live prices | `tooling/cli/flights/README.md` (`pp-flights`) |
| Trains, railway timetables, fares, PNR | [`docs/indian-railways-data-sources.md`](docs/indian-railways-data-sources.md) — read before trusting any train result |
| Phone notifications (Telegram-first) | tooling/cli/notify/README.md |
| Visual plan review before dispatch | .claude/skills/plan-review/SKILL.md |
| MCP servers (only `drive`, `cloudflare` still used) | `tooling/mcp/README.md` |
| Running this repo under Codex (or any non-Claude agent) — path mapping, what doesn't carry over | [`AGENTS.md`](AGENTS.md) + `scripts/mirror-codex-skills.sh` |
| A specific app | apps/<name>/ — full list in the README map below; each app folder carries its own operate-doc (README and/or CLAUDE.md) |
| YouTube / Pinterest / video / income business projects (Python workspace) | [`pipelines/CLAUDE.md`](pipelines/CLAUDE.md) |
| Worktree pool for agent runs (wt) | [`tooling/cli/wt/README.md`](tooling/cli/wt/README.md) |
| PR-driven implementation orchestrator — dispatch a crew, verify, merge, deploy (boss) | `tooling/boss/README.md` |
| YouTube research / scripts / tutorial pipeline | `pipelines/youtube/` |
| Voiceover / TTS (reference voices, engines, voiceover manifest) | `pipelines/video/tts/` |
| Generate / review / lock a voiceover (any pipeline) | `yt-vo` skill (source: `pipelines/.claude/skills/yt-vo`) |
| HeyGen / avatar assets (character registry, renders, fal-lipsync) | `pipelines/video/heygen/` |
| Browse generated media (renders, voiceovers) visually | media-board skill (pipelines/.claude/skills/media-board) |
| Income tracking across platforms | `pipelines/income-analysis/` |
| Cross-project research notes, design specs, handoff docs | [`docs/`](docs/README.md) |
| Implementation plans for executor agents (write or run one) | [`plans/README.md`](plans/README.md) — convention in [`plans/WORKFLOW.md`](plans/WORKFLOW.md) |
| Infra (docker compose, VPS watchdog, secrets, secrets escrow) | `infra/` |
| DSA practice notes/solutions | `learning/DSA/` |
| Repo-wide scripts + external path dependencies | `scripts/README.md` |


## Where does a new thing go?

- A personal product (app someone uses) → `apps/<kebab-name>/` (+ README.md + CLAUDE.md from day one).
- A business / money-making project → `pipelines/<name>/` (register it in `pipelines/CLAUDE.md`'s map).
- A skill, CLI, or MCP for driving work with Claude → `tooling/` (skills need a manifest entry — see `scripts/relink.sh`).
- A deployable Worker lives in `apps/` with the rest of the deployables (e.g. the go.agrolloo.com redirector is `apps/redirector/`), even when a business pipeline drives it.
- `pipelines/` runs on its own CLAUDE.md (Python workspace operating guide); its docs and decisions were merged into the root brain (`docs/`, `decisions.md`) when the ty/ theme-folder was dissolved.

## Operating notes

- **When making technical decisions, don't weight development cost as if humans were writing the code.** Models estimate effort from human training data and implicitly reject good solutions as "too expensive" — an agent builds in minutes what it estimates in weeks. Pick the right design, not the cheap one.

- A folder's `README.md` orients a human; its `CLAUDE.md` (where present) tells Claude how to operate there.
- `INFRA.md` — canonical Cloudflare + VPS + DNS inventory.
- `VPS-CRONS.md` — cron architecture (Pattern B). It's a runbook, not auto-loaded; open it only for cron work.
- `my-hosted-sites.md` — flat index of every live URL across this repo, including `pipelines/`.
- Skills under `tooling/claude-skills/` are the single source, symlinked into both accounts via `scripts/relink.sh`. Never edit a symlinked copy elsewhere — edit here.
- **Changing tracked files? Claim a workspace first.** `cd "$(pp-work claim --kind code --slug <task>)"` — the main checkout refuses to record git history (`.claude/hooks/no-history-in-main.sh`).
- **On main: read, talk, and scratch only.** Any edit you intend to KEEP — including a one-line append to `decisions.md` — claims a workspace FIRST. There is no such thing as a safe "one-off" edit here: you cannot commit it in main, so it sits in a tree two sessions share until someone else's commit sweeps it up (2026-08-22) or you lose track of it. The Stop hook now nags on a dirty main checkout, but by then the work is already in the wrong place.
- **The claim decision gets re-asked when the job grows.** A turn that starts as a question needs no workspace; the moment it turns into an edit you mean to keep, it does. Nothing prompts you at that boundary — 2026-08-23, a PayPal reporting question became a code fix plus two doc edits, all of them landing in main.
