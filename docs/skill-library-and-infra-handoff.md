# Skill library + long-term infra handoff

Written 2026-07-05, at the end of the session that built the repo-operating skill library.
Two audiences: the owner (pick items to execute) and the next Claude session (execute them).
Everything here routes through the normal gates — a `decisions.md` line for each decision
taken, and a `plans/` file for anything multi-step (see the `personal-stuff-change-control`
skill).

---

## Part 1 — what was done (2026-07-05)

A 15-skill repo-operating library now lives in `.claude/skills/` (project-level, loaded for
any Claude account working in this repo — deliberately NOT in `tooling/claude-skills/`,
which stays the home for reusable cross-repo skills).

| Skill | One line |
|---|---|
| personal-stuff-repo-map | Orientation: buckets, routing, docs of record, known weak spots |
| personal-stuff-change-control | Gates + every non-negotiable with its rationale and incident |
| cloudflare-and-vps-reference | Workers/D1/R2/KV/domains + VPS facts as used here |
| personal-stuff-deploy-and-operate | Deploy per surface, fleet deploy, cron ops, MinIO |
| personal-stuff-config-and-secrets | The six secret axes; the real 21-key pipelines/.env list |
| personal-stuff-build-and-env | New-machine / broken-env / dead-VPS rebuild sequences |
| personal-stuff-debugging-playbook | 16 real failure modes with discriminating checks |
| personal-stuff-failure-archaeology | 18 settled battles with commit evidence; stale-path decoder |
| personal-stuff-diagnostics-and-tooling | Task→tool router + `scripts/doctor.sh` aggregator |
| personal-stuff-validation-and-qa | The 4-level verification ladder + the guard-test rule |
| personal-stuff-docs-and-writing | Per-doc contracts and the one-home-per-fact rule |
| personal-stuff-hosting-inventory | URL→folder→surface→auth map + triple-update rule |
| personal-stuff-video-automation-campaign | Decision-gated runbook for the video-automation goal |
| personal-stuff-idea-to-shipped | Idea → placed → scaffolded → shipped → retired |
| personal-stuff-frontier | Owner priorities, candidates, first steps (ages fastest) |

Process: five parallel discovery sweeps (apps, pipelines, tooling/scripts, context/plans/docs,
git history), owner interview (4 questions), authoring, then three review passes (factual /
doctrine / usability). All blocking + important findings were fixed. Notable corrections made
during review: `runlog-status.sh` always exits 0 (the exit codes 0/2/3/4 belong to
`watch-run.sh`); gym-app/kushal-docs routes ARE in the source configs (the Vite build strips
them from `dist/<name>/wrangler.json`; `patch-routes.mjs` re-injects); the VPS runs 6
containers, not INFRA.md's stale 5; founders-tracker's non-expiring token is open finding
SEC-05, not settled design.

Known-uncertain (labeled inside the skills): live VPS state (container list, the
`/docker/hyperframes-render` path, crontab), the 47k/2.7k MCP token figures (project memory,
not decisions.md), and `plans/WORKFLOW.md`'s human-gate wording, which lags decisions.md
v2.3.

Not committed as of writing — the files sit untracked in `.claude/skills/` for review.

---

## Part 2 — proposed long-term infra decisions (execute in a new session)

Each item: tick it, do it, append the decision to `decisions.md`. Items marked (plan) are
big enough to deserve a `plans/` file and an orchestrate run.

### Tier 1 — data that cannot be recreated

- [ ] **Nightly D1 exports.** `clicks-db` (money attribution) and `tracker-db` (team work)
  have no owned backup; Cloudflare time-travel covers only ~30 days. Add a Pattern B cron
  that runs `wrangler d1 export` for all five DBs (clicks-db, tracker-db, lists-db,
  founders-db, yt-rankings) into MinIO. Effort S. (plan — touches vps-crons too)
- [ ] **Mac secrets escrow.** The Mac is currently a single point of failure for
  `pipelines/.env`, `pipelines/credentials.json`, `tooling/mcp/google-shared/tokens/*`
  (5 accounts), and `infra/secrets/*` — all gitignored, all nowhere else. Create one
  encrypted archive (age or gpg), refresh monthly (cron or calendar), store in MinIO or
  Drive, passphrase in the password manager. Effort S. This also de-risks the planned
  laptop migration (Part 3).
- [ ] **kushal-docs R2 second copy.** Real personal documents, unencrypted, one copy.
  Enable R2 object versioning and/or periodic sync to MinIO. Effort S–M.

### Tier 2 — resilience of the one VPS

- [ ] **Test a Hostinger backup restore once.** Restore to a scratch VPS, confirm
  containers + crons come up, write the gaps into `VPS-CRONS.md`. Effort M, one-time.
- [ ] **Add swap deliberately.** INFRA.md already flags the risk (n8n + MinIO spikes);
  tts-flow's VPS deploy will require it anyway. Do it before an incident does. Effort S.

### Tier 3 — drift and silent decay

- [ ] **Auth-health probe.** Weekly cron that cheaply exercises each credential class
  (Google tokens per account, VPS Claude login, HeyGen cookies, NotebookLM) and sends an
  ntfy alert on failure — converts silent cron death into a push notification. Effort M. (plan)
- [ ] **Inventory drift check.** Script that diffs `apps/*/wrangler.*` against `INFRA.md`
  (Workers, domains, D1/KV bindings) — fold into `audit-repo-route` or `check-apps.sh`.
  The founders-tracker omission shows the manual convention slips. Effort S–M.
- [ ] **Plan the recorded security backlog.** SEC-02..07 in `plans/README.md` are
  enumerated but unplanned. Start with SEC-05 (founders non-expiring token) and
  rate-limiting on the password-gated apps; the backlog's own estimates are Effort S each. (plan)

### Verify-first items (5 minutes each, doc fix afterward)

- [ ] gmail-digest cron: `VPS-CRONS.md:144` says "scaffolded, not yet enabled" but its
  active-crons section and `tooling/mcp/README.md` say it runs. `ssh root@72.61.241.170
  'crontab -l'` settles it; fix whichever doc is wrong.
- [ ] `INFRA.md` refresh while you're in there: add founders-tracker, the missing D1s
  (founders-db, tracker-db, yt-rankings), the render2 container, and the extra bindings
  (RANKINGS_DB, TRACKER_DB).
- [ ] Rotate the Groq key (`HANDOVER.md` notes it was once pasted in chat) if not already done.

### Deliberately NOT proposed

Second VPS / HA (single-operator scale doesn't justify it); moving off the shared
Cloudflare account; TLS on ntfy (plain-HTTP topic-as-secret is a documented, accepted
trade-off — reopen only if a topic leaks).

---

## Part 3 — memory layout, dual-account reality, laptop migration

### The four memory/instruction layers (as of 2026-07-05)

| Layer | Work account | Personal account | Shared? |
|---|---|---|---|
| Global instructions | `~/.claude-work/CLAUDE.md` (+ `RTK.md`) | `~/.claude-personal/CLAUDE.md` (+ its `RTK.md`) | No — two parallel copies of the same rules (humanizer, rtk) |
| Project instructions | repo `CLAUDE.md`, `decisions.md`, sub-folder CLAUDE.mds, `.claude/skills/` | same files | **Yes — in git, the only truly shared brain** |
| Auto-memory (per project, per account) | `~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff/memory/` — 38 files | `~/.claude-personal/projects/-Users-kbtg-codebase-personal-stuff/memory/` — 12 files | **No — two divergent stores for the same repo** |
| Skills | symlinks from `manifest/work.txt` | symlinks from `manifest/personal.txt` | Yes at the source (`tooling/claude-skills/`), split by manifest |

The structural weakness: because both accounts work on this repo, anything learned as
auto-memory lands in only ONE account's store. The two stores have already diverged (they
don't even share naming conventions). A fact that matters must be promoted into the repo —
CLAUDE.md, decisions.md, or a skill — which is exactly what the 2026-07-05 skill library
did for most of the work account's accumulated memories.

**Recommended policy going forward:** treat per-account auto-memory as a scratch cache.
Any fact worth keeping >1 month gets promoted into the repo brain; memories that duplicate
repo docs get deleted on sight. Also prune the stale personal-account project stores
(`-Users-kbtg-codebase-TY`, `-Users-kbtg-codebase-personal-stuff-my-planner`, the jobs tmp
dir) — they reference pre-restructure paths.

### Laptop migration checklist (what git does NOT carry)

The repo + skill library covers most of the rebuild (`personal-stuff-build-and-env` skill
has the sequence). What must move by hand:

1. `~/.claude-work/` and `~/.claude-personal/` (global CLAUDE.md/RTK.md, settings,
   keybindings, and both `projects/*/memory/` stores).
2. Gitignored secrets: `pipelines/.env`, `pipelines/credentials.json`,
   `tooling/mcp/google-shared/tokens/`, `infra/secrets/`, per-app `.dev.vars`,
   `tooling/cli/hostinger/.env`, `~/.config/` (PayPal creds), `GUMROAD_ACCESS_TOKEN`.
   (The Tier 1 secrets escrow makes this step "restore one archive".)
3. `~/.ssh/` (hostinger_vps key + GitHub keys) and `~/.zshrc` (claude-work/claude-personal
   functions, git-identity rule, `ccu-dash` alias — see `scripts/README.md` external deps).
4. `~/.agents/skills/` (the agents-sourced pp-* skills) and `~/go/bin/` (printing-press
   CLIs — or regenerate via the printing-press-catalog skill).
5. `~/kb-scratch/` (heavy artifacts: whisper models, work dirs) — optional, re-downloadable.
6. After copying: `./scripts/relink.sh` (symlinks store absolute paths),
   `./scripts/regen-mcp-json.sh`, restart sessions, then `./scripts/skills-status.sh` and
   `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/doctor.sh` to verify.

Verdict on the setup: the repo-side brain is genuinely good — checked in, single-source,
audited. The account-side (memory duplication, hand-carried secrets) is the weak half;
the escrow item and the promote-to-repo memory policy close most of it.

---

## Part 4 — target architecture for skills + memory (the call, 2026-07-05)

Principle: **knowledge belongs to the subject (repo), not the seat (account).** Both
accounts are the same person on the same machine; any fact stored per-account will
eventually be missing from the session that needs it. Design every layer so the account
holds only caches and credentials, never the sole copy of knowledge.

### Skills — four tiers (mostly formalizing what exists)

| Tier | What | Home | Rationale |
|---|---|---|---|
| 1. Repo-operating | how to work in one repo | `<repo>/.claude/skills/`, committed to THAT repo | any account that opens the repo gets them free; survives laptop moves via git. personal-stuff now has 15; apply the same pattern to work repos (commit there — team benefits too) |
| 2. Cross-repo reusable | humanizer, commit-now, pp-impact… | `personal-stuff/tooling/claude-skills/` + manifests + `relink.sh` — **keep, but slim it** (scope rule below) | splitting the store would reintroduce the multi-source drift this system was built to kill. Rule: skill bodies carry process + pointers, never Zluri-confidential content (they live in a personal repo) |
| 3. Generated/vendored | `~/.agents/skills` pp-* CLIs' skills, `~/go/bin` binaries | machine-local; NOT in git | include in the escrow archive + record the regen path (printing-press-catalog). Don't git them — they're regenerable artifacts |
| 4. Plugins | superpowers, gsap, etc. | per-account plugin cache | record the install list in the dotfiles repo (below); reinstall on a new machine |

### The scope decision rule (which tier does a skill belong to?)

Three scopes exist, each with a different availability × token-cost profile:

| Scope | Loads when | Description token tax |
|---|---|---|
| Repo level (`<repo>/.claude/skills/`) | any account, session cwd inside that repo | only in that repo's sessions |
| Directory-scoped (`pipelines/.claude/skills/`) | any account, working under that subtree | only under that subtree |
| Account level (manifest + relink) | that account, EVERY session, ANY cwd | every session of the account |

Decide per skill:
1. **Used in exactly one repo → that repo's `.claude/skills/`.** Any account gets it, no
   manifest bookkeeping, no relink, and its description stops taxing every unrelated
   session (the ≤500-char budget exists precisely because account-level descriptions load
   everywhere).
2. **Used across repos or outside any repo → account level.** This is why the store can't
   be dissolved: humanizer/commit-now/github-router/tweet-lookup must work in ANY repo,
   and CLI-wrapper skills (gmail, hostinger…) must work with no repo at all — including
   VPS Remote Control / mobile sessions whose cwd may be nowhere near a repo.
3. **The account split is itself the point → account level regardless.** Zluri-only skills
   on the work seat; personal Google/CLI skills off it. Repo-level skills cannot express
   an account boundary — any account in the repo sees them.

**Migration candidates out of the account store (execute in the new session; after moving:
update manifests, `relink.sh`, restart sessions):**
- → `personal-stuff/.claude/skills/`: `audit-repo-route`, `dsa-coach`, `orchestrate`
  (operates on this repo's `plans/`; re-evaluate if another repo adopts the convention).
- → `pipelines/.claude/skills/`: `yt-style-copy`, `pinterest-make-post`,
  `pinterest-research`, `pinterest-analyze`, `pinterest-board`, `hyperframes-helper`
  (all operate only on `pipelines/` data).
- → the dashboard-api work repo's `.claude/skills/`: `generate-key-maps` (it targets that
  repo's Postgres tables and currently lives in a personal repo).
- Caveat before moving anything VPS-relevant: `vps-sync.sh` links the personal manifest
  into the VPS `~/.claude/skills`; a skill moved to repo level is only visible on the VPS
  when the session cwd is inside `/srv/projects/personal-stuff` — keep anything mobile
  sessions need cwd-independent (e.g. gmail) at account level.

### Memory — shrink its job, don't share it

Auto-memory stays **per-account, per-project, as a scratch cache** — do NOT try to share
the stores across accounts via symlinks (concurrent sessions from two accounts would write
the same files, and harness updates may not tolerate it). Instead make the cache small and
the system of record shared:

1. **System of record = the repo brain**: CLAUDE.md (operating rules), decisions.md
   (whys), `.claude/skills/` (procedures), `context/` (owner-level). Both accounts + the
   VPS read these. The 2026-07-05 skill library is the proof this works.
2. **Promotion rule**: any auto-memory fact still true after ~a month gets promoted to its
   repo home and deleted from the account store. A memory that duplicates a repo doc is
   deleted on sight.
3. **Consolidation ritual**: monthly (or when MEMORY.md exceeds ~40 lines), run a session
   that diffs both accounts' stores for the repo, promotes keepers, prunes the rest.
   Candidate: a small `memory-consolidate` skill in tier 2, same on-demand pattern as
   `audit-repo-route`.
4. **Work repos with Zluri-confidential content**: their memory stays in the work
   account's store only (never in personal git); it rides the encrypted escrow for
   migration.
5. **One-time cleanup now**: the work store's 38 personal-stuff memories are mostly
   promoted into the skill library already — prune the redundant ones; merge the personal
   store's 12 (the heygen/render/VPS references overlap the new skills too); delete the
   stale pre-restructure project dirs under `~/.claude-personal/projects/`.

### Global instructions — one source, two symlinks

`~/.claude-work/CLAUDE.md` and `~/.claude-personal/CLAUDE.md` are hand-maintained
near-duplicates today. Move the shared body (humanizer rule, RTK) into ONE file in the
dotfiles repo and symlink it into both accounts, keeping a small per-account preamble only
if the accounts ever need different rules. Same treatment as skills got with relink.sh.

### The portability spine — a private `claude-setup` (dotfiles) repo + the escrow

Create one small private repo holding: the shared global CLAUDE.md/RTK.md, the plugin
list, zshrc fragments (claude-work/claude-personal functions, git-identity rule, aliases),
and a `bootstrap.sh` that wires everything (symlink globals → run
`personal-stuff/scripts/relink.sh` → `regen-mcp-json.sh` → print the escrow-restore
reminder). Pair it with the Part 2 encrypted secrets escrow (which also carries
`~/.agents/skills`, `~/go/bin` inventory, both accounts' memory stores, and `~/.ssh`).

**New laptop then becomes:** install runtimes → clone repos (`personal-stuff`,
`vps-crons`, work repos, `claude-setup`) → `bootstrap.sh` → decrypt escrow into place →
`skills-status.sh` + `doctor.sh` green. Target: under an hour, nothing reconstructed
from memory.

### Execution order (new session)

1. Secrets escrow (Part 2 Tier 1 — unblocks everything else).
2. `claude-setup` repo + bootstrap.sh + global-CLAUDE.md unification.
3. ~~One-time memory consolidation + stale-store pruning~~ **DONE 2026-07-05**: both
   accounts' personal-stuff stores consolidated (38→0 and 12→1 files, unique facts
   promoted into the skills first: Avatar III rule + usage-diff protocol → campaign;
   Traefik DNS-01 + web-vs-VPS placement → cloudflare-and-vps-reference; render2 deploy
   dir/rsync → deploy-and-operate; claude-rc.env + gcloud limits + gmail filters token →
   config-and-secrets; VPS scraping IP-block → debugging-playbook). Stale project dirs
   removed. **Skill migrations also DONE 2026-07-05** (9 moved in-repo, generate-key-maps
   → dashboard-api, manifests trimmed 43→35/47→37, relink + skills-status green, live
   path references fixed; dashboard-api copy is untracked — commit it there).
4. Optional: `memory-consolidate` skill so the promotion policy becomes a ritual, not a project.
