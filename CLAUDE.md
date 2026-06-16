# personal-stuff — Claude Code guide

The full repo map, what-runs-where, and conventions live in the README, imported below.

@README.md

## Operating notes

- A folder's `README.md` orients a human; its `CLAUDE.md` (where present) tells Claude how to operate there.
- `INFRA.md` — canonical Cloudflare + VPS + DNS inventory.
- `VPS-CRONS.md` — cron architecture (Pattern B). It's a runbook, not auto-loaded; open it only for cron work.
- `my-hosted-sites.md` — flat index of every live URL across this repo and TY.
- Skills under `tooling/claude-skills/` are the single source, symlinked into both accounts via `scripts/relink.sh`. Never edit a symlinked copy elsewhere — edit here.
- Pinterest pin data + landing pages live in the **TY** repo (`TY/pinterest/`); only the Pinterest *skills* live here.
