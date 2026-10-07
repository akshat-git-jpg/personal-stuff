---
name: personal-stuff-architecture-contract
description: Maps the personal-stuff repo and states its contract — where things live (the one placement table), which doc owns which fact, the invariants that must hold (redirector→clicks-db money chain, tracker-app, pipelines Python runtime, media/secrets policy, hardcoded paths), why it is designed this way, and what is fragile now. Use when orienting, placing or moving a folder, or changing anything load-bearing.
---

# personal-stuff architecture contract

## Contents

- Orientation
- Placement — the one table
- Docs of record
- Invariants (must not break)
- Load-bearing design decisions (the WHY)
- Known weak points
- Moving or renaming anything: STOP first
- When NOT to use this skill

## Orientation

`personal-stuff` is a personal monorepo operated largely BY Claude: independent Cloudflare Worker apps, VPS Docker apps, VPS crons, a shared-Python business workspace, Claude skills/CLIs/MCP servers, and a governance layer (decisions log + plans workflow + `context/` second brain). **Route by the question, not by browsing** — the root `CLAUDE.md` "Find it fast" table is the map; grepping the whole repo to orient is the anti-pattern.

- `README.md` orients a **human**; `CLAUDE.md` tells **Claude how to operate there**. Every new folder gets both from day one.
- Sub-folder `CLAUDE.md` files are NOT auto-loaded — the root map only links them. Open the folder's `CLAUDE.md` (or README) before working in it; `pipelines/` runs on its own Python-workspace guide.

## Placement — the one table

The placement rule (decided 2026-07-04). Other skills link here instead of restating it.

| It is a… | It goes to… | Register in |
|---|---|---|
| Personal product (someone uses it), incl. every deployable Worker even when a pipeline drives it (rule set by the redirector) | `apps/<kebab-name>/` | inventories — **personal-stuff-hosting-inventory** triple-update |
| Money-making / business project | `pipelines/<name>/` (shared-Python workspace) | `pipelines/CLAUDE.md` folder map |
| Skill for driving work with Claude | `.claude/skills/<name>/`, or `pipelines/.claude/skills/<name>/` if pipelines-only | nothing — the folder is the registration |
| CLI / MCP for driving work with Claude | `tooling/` (`cli/`, `mcp/`, `boss/`, `maintainer/`) | **personal-stuff-diagnostics-and-tooling** router |
| Docker compose, VPS watchdog, secrets, escrow | `infra/` | `INFRA.md` |
| Scheduled job | code in `personal-stuff`, wrapper in the `vps-crons` repo | `VPS-CRONS.md` lifecycle |
| Voice/avatar reference asset | asset hubs `pipelines/video/tts/` / `pipelines/video/heygen/` (2026-07-12); generated media OUTSIDE the repo in `~/kb-scratch/video/{tts,heygen}/<pipeline>/` | hub manifest (`OUTPUTS.md` / `RENDERS.md`); domain knowledge: `pipelines/video/CLAUDE.md` |
| Repo-wide script | `scripts/` (also holds the external-path-dependency list) | `scripts/README.md` |
| Cross-project research, spec, handoff | `docs/` | `docs/README.md` |
| Executor plan | `plans/` (+ `plans/runs/` ledgers) | `plans/README.md` (boss-owned on main) |
| Owner profile, bets, product inventory, idea backlog | `context/` | `context/CLAUDE.md` |
| DSA / study notes | `learning/` | — |

Full idea→live lifecycle: **personal-stuff-idea-to-shipped**.

## Docs of record

One home per fact. The table of docs, their contracts and formats lives in **personal-stuff-docs-and-writing**; that skill also has the "where does this fact go?" disambiguator.

## Invariants (must not break)

Owner-confirmed load-bearing set (2026-07-05). Important but not critical: VPS crons (daily digests, repo-sync) and personal PWAs (gym, docs, lists, founders). Archived — do not build on: `pipelines/archive/hyperframes-vs-remotion/`, `pipelines/archive/rvc-flow/` (superseded by IndexTTS-2, 2026-07-12), anything decommissioned in **personal-stuff-failure-archaeology**.

| Invariant | Rationale / what breaks if violated |
|---|---|
| **Money-attribution chain stays intact:** `apps/redirector` (go.agrolloo.com) → D1 `clicks-db` → `apps/analytics-app` dashboard + `pipelines/youtube/yt-analysis/sync_clicks.py` | This is how YouTube affiliate revenue is attributed. Break any link and clicks stop being recorded or readable — silent, unrecoverable data loss on the income the repo exists to grow. |
| **tracker-app is production** (`apps/tutorial-tracker-app`, tutorials-tracker.agrolloo.com) | Real freelancers work in it daily. A bad deploy blocks a paid team, not just the owner. Engine changes require the guard tests (see **personal-stuff-validation-and-qa**). |
| **Single Python runtime in `pipelines/`** — one `venv/` + `requirements.txt` at `pipelines/` root; `common/env.py` loads `pipelines/.env` on import, resolved from the repo root; no per-folder venv/env/credentials, ever (`pipelines/CLAUDE.md`) | Per-folder environments fork silently and break every consumer of `common/`. Scripts assume the shared env is already loaded — a stray local `.env` shadows real credentials. |
| **Generated media never enters the repo.** Reference assets + manifests are tracked in the asset hubs `pipelines/video/{tts,heygen}`; outputs go to `~/kb-scratch/video/{tts,heygen}/<consuming-pipeline>/` (decisions.md 2026-07-04 media policy + 2026-07-12 hubs) | The working tree once hit 18GB and every agent search walked it. Committing one render re-opens that door. Browse the hub folders directly (`~/kb-scratch/video/`); the media-board skill was retired 2026-08-25. |
| **Browser UIs are component apps, not template strings** (decisions.md 2026-07-31). Any UI with more than one view/route, any state that SAVES, or realistic growth beyond a few hundred lines is a Vite+React+TS app — one component per concern, co-located CSS on the repo's CSS vars, `dist/` gitignored and served by its owning backend. Exemplars: `apps/tutorial-tracker-app` (product) and `pipelines/video/visuals-flow/board-ui` (pipeline tool). Hand-rolled HTML template strings are for trivial single-view static reports ONLY. | The review board grew 2900 lines of server-emitted HTML strings across 15 incremental plans because each plan imitated the surrounding idiom — ending in triple-defined components, CSS scoped to the wrong page, and a full rewrite (plans 169–174). "Match the neighboring code" propagates an architecture forever; this invariant is what new UI work matches instead. |
| **Secrets never committed.** `.gitignore` blocks `**/secrets/*`, `**/.env`, `**/credentials.json`, `**/token*.json` (templates via `!infra/secrets/*.example`); recovery is the monthly gpg escrow to Drive (`infra/escrow/`) | A committed secret in a repo agents grep constantly is an instant leak. Escrow, not git, is the backup — see **personal-stuff-config-and-secrets**. |
| **Folder moves are gated on `scripts/README.md`'s external-touchpoints list** | External systems hardcode paths here (list below). A rename that skips the list breaks crons and skill loading silently. |
| **decisions.md is append-only and executor-untouchable.** `.gitattributes` sets `merge=union`; crewmates/executors never edit it — the orchestrator appends after landing (decisions.md 2026-07-07) | It is the repo's why-log; parallel branches editing it rebase-conflict, and executor edits corrupt the record. Check it before proposing an approach — it encodes house-rejected ones. |
| **One brain, one router.** Root `CLAUDE.md`'s find-it-fast table is the only routing layer | A second theme-grouped brain (the old `ty/`) meant every lookup twice and drifting docs; dissolving it (2026-07-04) was the costliest confirmed cleanup. |

## Load-bearing design decisions (the WHY)

| Decision | Why (decisions.md date) |
|---|---|
| Orchestrator/executor split: expensive model writes self-contained plans into `plans/`, cheaper models execute | Design intelligence is the scarce resource; plans make it reusable by cheap executors (2026-07-04, refined v2.1–v2.3 2026-07-05). |
| PR-driven landing via boss + greenlight; dirty-main check ENFORCED at dispatch | Passive "remember to check" got skipped and a dirty main silently parked two whole batches (2026-07-07, 2026-07-08); the dispatch path now refuses. `tooling/captain/` was deleted 2026-08-23 — boss is the successor. |
| The main checkout is read-only; every kept edit happens in a claimed `pp-work` workspace, and each commit lands on main by itself (`pp-land`) | Two sessions sharing one checkout interleaved commits across branches — the 054/055 tangle, 40+ cherry-pick conflicts (2026-07-10). Enforced by `.claude/hooks/no-history-in-main.sh`, `no-edits-in-main.sh`, `no-writes-in-main.sh` (root `CLAUDE.md`). Boss crews still use the `wt` pool. |
| Pattern-B crons: project code in this repo's VPS clone, orchestration wrappers in the separate `vps-crons` repo, wrappers `git pull` per run | Deploy = push; the box never holds unpushed logic. Mechanics: `VPS-CRONS.md`. |
| Skills are repo-scoped (`.claude/skills/`, `pipelines/.claude/skills/`); no account store, no manifest (decisions.md 2026-08-25) | What loads no longer depends on which account is logged in. Descriptions ≤500 chars, guarded by `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` (run inside `scripts/relink.sh`). Model and audit: `tooling/maintainer/jobs/skills/runbook.md`. |
| `README.md` orients a human; `CLAUDE.md` tells Claude how to operate there | Two audiences, two docs; every new folder gets both from day one (2026-07-04). |

## Known weak points (verified 2026-07-12)

1. **Security backlog SEC-02..SEC-07 is real and unplanned** — rate-limit-free password gates, hyperframes-render SSRF + `changeme` default, tracker `DEV_AUTH` header bypass, constant session tokens, unbounded R2 uploads. Home: `plans/README.md` "Findings NOT turned into plans".
2. **INFRA.md drifts.** It lags launches structurally (the triple-update rule slips); the 2026-06/07 drift was repaired 2026-07-12, but treat it as a lagging index — the regression check (`scripts/verify-inventory.sh`) and drift protocol live in **personal-stuff-hosting-inventory**; on DRIFT trust `apps/*/wrangler.*` + `VPS-CRONS.md` + `my-hosted-sites.md` over it.
3. **plans/README.md status column lies.** Table rows for 043 and 056–059 still say TODO though all landed via boss; the `## boss-landed` section at the bottom + `git log` are authoritative, the table cells are advisory. TWO plan batches both claim numbers 044/045 — disambiguate by slug, never by number.
4. **Stale paths.** `apps/redirector/CLAUDE.md` still references pre-restructure `workers/redirector` paths; several `pipelines/` docs (`archive/rvc-flow/CLAUDE.md`, pinterest/PLAN.md, cf-email README) still say `ty/` or `TY/` — `ty/` was dissolved into `pipelines/` on 2026-07-04. Decoder: **personal-stuff-failure-archaeology**.
5. **`pipelines/.env.example` under-lists the real key set** — never rebuild an env from the example alone; the authoritative key list lives in **personal-stuff-config-and-secrets**.
6. **gym-app and kushal-docs** deploy from a Vite-generated `dist/<name>/wrangler.json` that strips routes (and kushal-docs' R2 binding); each app's `scripts/patch-routes.mjs` re-injects them during `npm run deploy` — never bare `wrangler deploy` there (details: **cloudflare-and-vps-reference**).

## Moving or renaming anything: STOP first

External systems hardcode paths in this repo: the VPS clones (`/srv/projects/personal-stuff/`, pulled every 15 min), `vps-crons` run.sh wrappers, `~/.zshrc` git-identity + aliases, the Codex skill mirror (`~/.codex/skills/`, from `.claude/codex-skills.txt`), the private `work-skills` plugin copy of the shared skills, `.mcp.json`, the `github-router` skill. **Check `scripts/README.md`'s "External touchpoints" list before any move**, then re-run `./scripts/relink.sh` and `./scripts/regen-mcp-json.sh` after.

## When NOT to use this skill

- Gating a specific change (plan? decision entry?) → **personal-stuff-change-control**
- Cloudflare/VPS mechanics, bindings, deploy quirks → **cloudflare-and-vps-reference**
- Validating a new tool/engine/approach before adopting it → **personal-stuff-research-methodology**
- Deploying or operating something → **personal-stuff-deploy-and-operate**
- A live URL question → **personal-stuff-hosting-inventory**
- Debugging a failure → **personal-stuff-debugging-playbook**
- What to work on next → **personal-stuff-frontier**
