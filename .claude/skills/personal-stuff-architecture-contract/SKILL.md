---
name: personal-stuff-architecture-contract
description: Use before any change that could touch a load-bearing part of personal-stuff — the redirector→clicks-db money chain, tracker-app, the pipelines Python runtime, media/secrets policy, or any path external systems hardcode — and when asking WHY the repo is designed this way (orchestrator/executor split, boss PR landing, Pattern-B crons, skill scoping) or what is currently fragile. States the invariants, the design rationale, and the known-weak points in one place.
---

# personal-stuff architecture contract

## Overview

The one-page contract for this repo: the invariants that must hold, the design decisions they rest on, and where the structure is currently weak. This skill states WHAT must stay true and WHY; mechanics and inventory live in the sibling skills and docs of record it points at.

## Invariants (must not break)

| Invariant | Rationale / what breaks if violated |
|---|---|
| **Money-attribution chain stays intact:** `apps/redirector` (go.agrolloo.com) → D1 `clicks-db` → `apps/analytics-app` dashboard + `pipelines/youtube/yt-analysis/sync_clicks.py` | This is how YouTube affiliate revenue is attributed. Break any link and clicks stop being recorded or readable — silent, unrecoverable data loss on the income the repo exists to grow. |
| **tracker-app is production** (`apps/tutorial-tracker-app`, tutorials-tracker.agrolloo.com) | Real freelancers work in it daily. A bad deploy blocks a paid team, not just the owner. Engine changes require the guard tests (see **personal-stuff-validation-and-qa**). |
| **Single Python runtime in `pipelines/`** — one `venv/` + `requirements.txt` at `pipelines/` root; `common/env.py` loads `pipelines/.env` on import, resolved from the repo root; no per-folder venv/env/credentials, ever (`pipelines/CLAUDE.md`) | Per-folder environments fork silently and break every consumer of `common/`. Scripts assume the shared env is already loaded — a stray local `.env` shadows real credentials. |
| **Generated media never enters the repo.** Reference assets + manifests are tracked in the asset hubs `pipelines/video/{tts,heygen}`; outputs go to `~/kb-scratch/video/{tts,heygen}/<consuming-pipeline>/` (decisions.md 2026-07-04 media policy + 2026-07-12 hubs) | The working tree once hit 18GB and every agent search walked it. Committing one render re-opens that door. Browse via the `media-board` skill. |
| **Secrets never committed.** `.gitignore` blocks `**/secrets/*`, `**/.env`, `**/credentials.json`, `**/token*.json` (templates via `!infra/secrets/*.example`); recovery is the monthly gpg escrow to Drive (`infra/escrow/`) | A committed secret in a repo agents grep constantly is an instant leak. Escrow, not git, is the backup — see **personal-stuff-config-and-secrets**. |
| **Folder moves are gated on `scripts/README.md`'s external-touchpoints list** | External systems hardcode paths here: the VPS clone (`/srv/projects/personal-stuff/`, pulled every 15 min), `vps-crons` run.sh wrappers, per-account skill symlinks, `.mcp.json`, `~/.zshrc` git-identity, the github-router skill. A rename that skips the list breaks crons and skill loading silently. Re-run `relink.sh` + `regen-mcp-json.sh` after any move. |
| **decisions.md is append-only and executor-untouchable.** `.gitattributes` sets `merge=union`; crewmates/executors never edit it — the orchestrator appends after landing (decisions.md 2026-07-07) | It is the repo's why-log; parallel branches editing it rebase-conflict, and executor edits corrupt the record. Check it before proposing an approach — it encodes house-rejected ones. |
| **One brain, one router.** Root `CLAUDE.md`'s find-it-fast table is the only routing layer; sub-folder `CLAUDE.md` files are NOT auto-loaded — open them before working in a folder | A second theme-grouped brain (the old `ty/`) meant every lookup twice and drifting docs; dissolving it (2026-07-04) was the costliest confirmed cleanup. |

## Load-bearing design decisions (the WHY)

| Decision | Why (decisions.md date) |
|---|---|
| Orchestrator/executor split: expensive model writes self-contained plans into `plans/`, cheaper models execute | Design intelligence is the scarce resource; plans make it reusable by cheap executors (2026-07-04, refined v2.1–v2.3 2026-07-05). |
| PR-driven landing via boss + greenlight; dirty-main check ENFORCED at dispatch | Passive "remember to check" got skipped and a dirty main silently parked two whole batches (2026-07-07, 2026-07-08); the dispatch path now refuses. Captain is frozen — boss is the successor. |
| Worktrees for managed runs only (`wt` pool); one writer per main checkout, enforced by `branch-guard.sh` | Two sessions sharing the checkout interleaved commits across branches — the 054/055 tangle, 40+ cherry-pick conflicts (2026-07-10, rule lifted from blanket ban 2026-07-06). |
| Pattern-B crons: project code in this repo's VPS clone, orchestration wrappers in the separate `vps-crons` repo, wrappers `git pull` per run | Deploy = push; the box never holds unpushed logic. Mechanics: `VPS-CRONS.md`. |
| Skill scoping: single-repo skills live at repo level (`.claude/skills/`, `pipelines/.claude/skills/`); the account store keeps only cross-repo skills | Account-level skills tax EVERY session of that account; repo-level loads only where relevant (2026-07-05). Descriptions ≤500 chars, guarded by `scripts/check-skill-descriptions.sh`. |
| `README.md` orients a human; `CLAUDE.md` tells Claude how to operate there | Two audiences, two docs; every new folder gets both from day one (2026-07-04). |

## Known weak points (verified 2026-07-12)

1. **Security backlog SEC-02..SEC-07 is real and unplanned** — rate-limit-free password gates, hyperframes-render SSRF + `changeme` default, tracker `DEV_AUTH` header bypass, constant session tokens, unbounded R2 uploads. Home: `plans/README.md` "Findings NOT turned into plans".
2. **INFRA.md drifts.** It lags launches structurally (the triple-update rule slips); the 2026-06/07 drift was repaired 2026-07-12, but treat it as a lagging index — the regression check and drift protocol live in **personal-stuff-hosting-inventory** (`scripts/verify-inventory.sh`); on DRIFT trust `apps/*/wrangler.*` + `VPS-CRONS.md` over it.
3. **plans/README.md status column lies.** Table rows for 043 and 056–059 still say TODO though all landed via boss; the `## boss-landed` section at the bottom + `git log` are authoritative, the table cells are advisory/human-maintained. Also: TWO plan batches both claim numbers 044/045 — disambiguate by slug, never by number.
4. **Stale-path and under-documented spots** listed in **personal-stuff-repo-map**'s weak-spot section (leftover `ty/` references, `pipelines/.env.example` under-lists real keys, gym-app/kushal-docs deploy quirk) remain live.

## When NOT to use this skill

- Orienting / where does X live → **personal-stuff-repo-map**
- Gating a specific change (plan? decision entry? placement?) → **personal-stuff-change-control**
- Cloudflare/VPS mechanics, bindings, deploy quirks → **cloudflare-and-vps-reference**
- What to work on next → **personal-stuff-frontier**

## Provenance and maintenance

All claims verified against the repo 2026-07-12. Re-verify:
- Money chain: `ls apps/redirector apps/analytics-app pipelines/youtube/yt-analysis/sync_clicks.py`
- Python runtime: `grep -n "venv\|per-folder" pipelines/CLAUDE.md` + `head pipelines/common/env.py`
- Secrets patterns: `head -12 .gitignore`
- Move gate: read `scripts/README.md` "External touchpoints"
- decisions.md union merge: `cat .gitattributes`
- INFRA.md drift: run `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (drift table lives in **personal-stuff-hosting-inventory**)
- Plans staleness: compare the table rows vs `## boss-landed` in `plans/README.md`
