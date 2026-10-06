# Skill provenance and maintenance notes

Where each skill's facts were verified, when, and the commands that re-verify them.
Moved out of the skills themselves in the 2026-10-06 skill audit, so a skill body carries
only what an agent needs to act. One section per skill. Update a section when you re-verify
that skill; dates inside a section are the dates of that verification.

## Contents

- [cloudflare-and-vps-reference](#cloudflare-and-vps-reference)
- [orchestrate](#orchestrate)
- [personal-stuff-architecture-contract](#personal-stuff-architecture-contract)
- [personal-stuff-build-and-env](#personal-stuff-build-and-env)
- [personal-stuff-change-control](#personal-stuff-change-control)
- [personal-stuff-config-and-secrets](#personal-stuff-config-and-secrets)
- [personal-stuff-debugging-playbook](#personal-stuff-debugging-playbook)
- [personal-stuff-deploy-and-operate](#personal-stuff-deploy-and-operate)
- [personal-stuff-diagnostics-and-tooling](#personal-stuff-diagnostics-and-tooling)
- [personal-stuff-docs-and-writing](#personal-stuff-docs-and-writing)
- [personal-stuff-failure-archaeology](#personal-stuff-failure-archaeology)
- [personal-stuff-frontier](#personal-stuff-frontier)
- [personal-stuff-hosting-inventory](#personal-stuff-hosting-inventory)
- [personal-stuff-idea-to-shipped](#personal-stuff-idea-to-shipped)
- [personal-stuff-repo-map](#personal-stuff-repo-map)
- [personal-stuff-research-methodology](#personal-stuff-research-methodology)
- [personal-stuff-validation-and-qa](#personal-stuff-validation-and-qa)
- [personal-stuff-video-automation-campaign](#personal-stuff-video-automation-campaign)

## cloudflare-and-vps-reference

Re-verified 2026-07-12 against all `apps/*/wrangler.*` (incl. `apps/pinterest-landing-pages/*/`), `infra/vps-watchdog/wrangler.jsonc`, live SSH (`docker ps`: 6 containers then, 5 since ntfy was retired 2026-08-30; `crontab -l`: 7 active crons matching `VPS-CRONS.md`), and `VPS-CRONS.md`. Added timeblock (`BLOCKS_KV`) — was missing from the KV list and Worker-shape examples here. Cloudflare MCP `d1_list_databases`/`kv_list_namespaces` errored server-side (`NameError: _DEFAULT_ENV_PATH`) on 2026-07-12 — D1/KV counts rest on wrangler configs + the d1-backup cron ("all 5 D1 databases"). Re-verify:
- Worker/domain list: `grep -rn "custom_domain\|zone_name\|pattern" apps/*/wrangler.* apps/pinterest-landing-pages/*/wrangler.* infra/vps-watchdog/wrangler.jsonc`
- INFRA.md-vs-reality drift: `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (the drift table lives in **personal-stuff-hosting-inventory**)
- D1/KV live state: cloudflare MCP `d1_list_databases` / `kv_list_namespaces` (fix the MCP server first if it still NameErrors)
- VPS containers: `ssh root@72.61.241.170 'docker ps --format "{{.Names}}"'`
- Crontab: `ssh root@72.61.241.170 'crontab -l'` (must match `/srv/crons/crontab.txt`)

## orchestrate

Workflow, registry, and routing verified on 2026-07-12 against
`plans/WORKFLOW.md`, `plans/_TEMPLATE.md`, `tooling/boss/data/rules.md`,
`tooling/boss/README.md`, `docs/specs/2026-07-07-boss-design.md`, and this
skill's `scripts/`. Executor/model routing lives in `tooling/boss/data/rules.md`
— this skill has NO `data/` dir of its own. Owner rule (confirmed 2026-07-12):
never pick the executor model unilaterally; agy runs use Gemini 3.1 Pro (High)
(agy's default); routing comes from the rules file. Re-verify:

- Dispatch/watch scripts still present: `ls .claude/skills/orchestrate/scripts/`
- Routing defaults unchanged: `head -20 tooling/boss/data/rules.md`
- Plans contract exists: `ls plans/WORKFLOW.md plans/_TEMPLATE.md`
- Boss design spec still there: `ls docs/specs/2026-07-07-boss-design.md`
- agy default model: `grep -n "default model" tooling/boss/README.md`

## personal-stuff-architecture-contract

All claims verified against the repo 2026-07-12. Re-verify:
- Money chain: `ls apps/redirector apps/analytics-app pipelines/youtube/yt-analysis/sync_clicks.py`
- Python runtime: `grep -n "venv\|per-folder" pipelines/CLAUDE.md` + `head pipelines/common/env.py`
- Secrets patterns: `head -12 .gitignore`
- Move gate: read `scripts/README.md` "External touchpoints"
- decisions.md union merge: `cat .gitattributes`
- INFRA.md drift: run `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (drift table lives in **personal-stuff-hosting-inventory**)
- Plans staleness: compare the table rows vs `## boss-landed` in `plans/README.md`

## personal-stuff-build-and-env

Verified against `scripts/relink.sh`, `scripts/link-clis.sh`, `scripts/regen-mcp-json.sh`, `scripts/skills-status.sh`, `pipelines/CLAUDE.md`, app package.json wrangler pins, and `VPS-CRONS.md` on 2026-07-12. Re-verify: run `scripts/verify.sh` in this skill dir (offline checks; exit 0 all-pass, exit 1 names the failing check). The VPS layout check needs the network and is opt-in: `VERIFY_VPS=1 scripts/verify.sh` (or manually `ssh root@72.61.241.170 'ls /srv/crons /srv/projects'`) — SSH was unreachable from the 2026-07-12 verifying network, so VPS facts were re-verified against `VPS-CRONS.md` only.

## personal-stuff-change-control

Rules verified against root `CLAUDE.md`, `decisions.md`, `plans/WORKFLOW.md`, `.claude/settings.json`, and owner interview answers on 2026-07-05; boss/secretary path, dirty-main enforcement, deploy standing permission, decisions.md write convention, and the description guard re-verified against `decisions.md`, `tooling/boss/README.md`, `tooling/boss/CLAUDE.md`, `tooling/boss/bin/boss-dispatch.sh`, `.gitattributes`, and `scripts/check-skill-descriptions.sh` on 2026-07-12. Model-routing rule verified against `tooling/boss/data/rules.md` and decisions.md 2026-07-07 ("orchestrate stamps executor+model from rules.md at plan-authoring time; secretary only reads"), and the MCP token figures re-anchored to `docs/skill-library-and-infra-handoff.md`, on 2026-07-12. Re-verify:
- Boss gates: `grep -n "boss:ready\|deploy" tooling/boss/CLAUDE.md`
- Dirty-main guard: `grep -n "boss_repo_dirty\|--force" tooling/boss/bin/boss-dispatch.sh`
- decisions.md convention: `cat .gitattributes` + `grep -n "2026-07-11 — boss\|2026-07-08 — boss" decisions.md`
- Caps/gates: `grep -n "self-fix\|fix-up\|readiness" decisions.md`
- Model routing: `head -20 tooling/boss/data/rules.md` (routing table + "orchestrate stamps, secretary reads" preamble)
- Description budget: `./scripts/check-skill-descriptions.sh`

## personal-stuff-config-and-secrets

Key names verified against `pipelines/.env` (names only), `infra/secrets/` listing, `tooling/cli/hostinger/pp_hostinger.py`, app wrangler configs + CLAUDE.mds, `tooling/mcp/README.md`, and `VPS-CRONS.md` on 2026-07-12. Re-verify: run `scripts/verify.sh` in this skill dir (offline, names-only; exit 0 = all documented facts hold, exit 1 names the failing check). The one check it can't run offline — Worker prod secrets — stays manual: `cd apps/<app> && npx wrangler secret list` (needs Cloudflare auth).

## personal-stuff-debugging-playbook

Entries verified against app CLAUDE.mds, `VPS-CRONS.md`, `tooling/cli/*` READMEs, scripts, and recorded incidents on 2026-07-05. On 2026-07-12, rows 3 and 5 stopped pointing at the per-account memory store (unreadable from a fresh session): each row now embeds its incident as the dated record, with in-repo anchors (`VPS-CRONS.md` health checks; `docs/skill-library-and-infra-handoff.md` external deps) for the parts that have one. Guard against regression: `rtk proxy grep -cE "project[ ]memory" .claude/skills/personal-stuff-*/SKILL.md` (expected: 0 per file). Re-verify a row before relying on it if its subsystem changed:
- Row 2: `grep patch-routes apps/gym-app/package.json apps/kushal-docs/package.json`
- Row 7: `cat .mcp.json` + `tooling/mcp/README.md` STATUS banner
- Row 12: `ssh root@72.61.241.170 'crontab -l'`
- Rows 10/11: the respective README/HANDOVER under `tooling/cli/`

## personal-stuff-deploy-and-operate

Verified against `scripts/deploy-apps.sh`, `scripts/check-apps.sh`, `scripts/probe-sites.sh`, app package.json deploy scripts, `tooling/boss/README.md` + `bin/boss-deploy.sh`, `decisions.md` (2026-07-11 boss deploy permission, 2026-07-12 asset hubs), `VPS-CRONS.md`, `INFRA.md`, and `infra/secrets/minio-access.md` on 2026-07-12 (VPS SSH unreachable from the verifying network that day — VPS-side facts re-checked against the docs of record only). No verify script on purpose: this skill's real checks (probe-sites curls, cron runs, `wrangler secret list`) need network/SSH, and a script that can't run offline is worse than commands with expected outputs. Re-verify:
- deploy-apps flags: `sed -n '1,30p' scripts/deploy-apps.sh`
- Per-app deploy quirks: `grep '"deploy"' apps/*/package.json` (also shows the mixed v3/v4 wrangler pins — see **personal-stuff-build-and-env**)
- Boss deploy path: `tooling/boss/README.md` + decisions.md 2026-07-11 entry
- Cron ops: `VPS-CRONS.md` "Common operations"
- MinIO access: `infra/secrets/minio-access.md`

## personal-stuff-diagnostics-and-tooling

Router verified against `tooling/cli/*`, `scripts/*`, skill manifests, and owner-session records on 2026-07-05; re-verified 2026-07-12 (added notify/wt/greenlight rows from `ls tooling/cli/`; the overnight row was dropped 2026-08-23 when the tool was deleted; skills-status 43 skills 0 problems; doctor.sh still wraps skills-status + check-apps + opt-in probe-sites; shipped `scripts/check-descriptions.sh`). Re-verify:
- CLI inventory: `ls tooling/cli/`
- Skill inventory: `./scripts/skills-status.sh`
- doctor.sh still matches the scripts it wraps: read both before trusting after script changes
- Run `scripts/check-descriptions.sh` (this skill's folder) after any skill-description edit. Since 2026-08-25 it covers every skill in the repo — the store and its separate guard are gone — and `relink.sh` runs it before touching anything

## personal-stuff-docs-and-writing

Contracts verified against the docs themselves, `plans/WORKFLOW.md`, `context/CLAUDE.md`, plan 026/028/031 outcomes, and the global humanizer rule on 2026-07-05; re-verified 2026-07-12 (ledger formats, VPS-CRONS three-copy header, context cadence, and the table above against root CLAUDE.md's "Find it fast" — all match; added the asset-hub manifest row per `pipelines/CLAUDE.md` + decisions.md 2026-07-12). Re-verify:
- Ledger line formats: `sed -n '38,57p' plans/WORKFLOW.md`
- Three-copy rule: header of `VPS-CRONS.md`
- context cadence: `context/CLAUDE.md`
- Asset-hub manifest rule: "Generated media never lives in the repo" bullet in `pipelines/CLAUDE.md`

## personal-stuff-failure-archaeology

Compiled from `decisions.md`, git log (no reverts confirmed via `git log --grep=revert -i`), `INFRA.md` cleanup section, plans/README rejected list, and owner-session records on 2026-07-05; the 2026-07-06→07-12 rows added and verified 2026-07-12 against `decisions.md`, `plans/README.md` (table + rejected list), `pipelines/video/tts/SYNC-PROBLEM.md`, `pipelines/archive/rvc-flow/CLAUDE.md`, the `tooling/captain/` DEPRECATED banners (that tree is now deleted; see `docs/archive/captain-references/`), and `pipelines/youtube/final-workflow/final-workflow-notes.md`. On 2026-07-12, every evidence pointer into the per-account memory store (unreadable from a fresh session) was replaced with an in-repo anchor or an embedded dated fact, and spot-checks confirmed the cited anchors exist: commit hashes `86d0894`/`3338361`/`af8f596`/`ce08e57`/`150cf56`/`b7b20e3`/`a823479`/`3da2c69`/`9e0c060` all in `git log --all`, the OmniVoice HISTORICAL markers in `pipelines/video/tts/CLAUDE.md`, and the plan-number-collision note + escrow rejection in `plans/README.md`. Guard against regression: `rtk proxy grep -cE "project[ ]memory" .claude/skills/personal-stuff-*/SKILL.md` (expected: 0 per file). Re-verify a row before citing it: `grep -n "<keyword>" decisions.md` or `git log --oneline --all | grep -i "<keyword>"`. New settled battles: add a row here AND the decisions.md entry that settles it. Status vocabulary: FAILED (tried, didn't work) / SUPERSEDED (replaced by something better) / DEFERRED (validated, deliberately parked) / REJECTED (evaluated, declined) — never blur them.

## personal-stuff-frontier

Snapshot of 2026-07-12, verified against `final-workflow-notes.md` (incl. the corrected cost table), `decisions.md` (top entries + 2026-07-11 autonomy policy v1), `plans/README.md`, `tooling/boss/data/rules.md`, `context/bets.md`, the live PR queue, and the canonical `5-visuals/135-build-graphics-sonnet/` folder. The beyond-SOTA calibration (autonomy + <$10/video) is owner-confirmed 2026-07-12 via interview. **This skill ages fastest — re-verify at session start:**
- Landed truth: `grep -A30 "## boss-landed" plans/README.md` (table cells lie for boss-landed rows)
- Open queue: `gh pr list --state open --label boss:ready`
- The 7 problems + cost table: read `pipelines/youtube/final-workflow/final-workflow-notes.md`
- 135 rulebook still a stub? `head -3 pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`
- Autonomy window: decisions.md 2026-07-11 entry (≥4 clean weeks from 2026-07-11 → ~2026-08-08)

## personal-stuff-hosting-inventory

Map verified against `my-hosted-sites.md`, every `apps/*/wrangler.*`, app CLAUDE.mds, `INFRA.md`, and `VPS-CRONS.md` on 2026-07-05, re-verified 2026-07-12 (added timeblock; consolidated the INFRA.md drift descriptions from repo-map / architecture-contract / cloudflare-and-vps-reference into the canonical table above; those skills now point here). Re-verify:
- Drift table: `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (OK/DRIFT per row, exit 1 on any DRIFT)
- List vs reality: `./scripts/probe-sites.sh`
- Folder↔domain: `grep -rn "custom_domain\|pattern\|directory" apps/*/wrangler.*` (gym-app/kushal-docs: the source config carries the domain, but only `npm run deploy` — via `patch-routes.mjs` — actually ships it)
- Hub cards: `grep -n "url" apps/kushal-tools/src/hub.ts`
- D1 inventory (should be 5 — `clicks-db`, `lists-db`, `founders-db`, `tracker-db`, `yt-rankings`): `grep -rln "d1_databases" apps/*/wrangler.*` then `grep -n "database_name" <matches>`
- Cron names/rows: `VPS-CRONS.md` → "Active crons" (`site-probe` hourly, `route-audit` weekly)

## personal-stuff-idea-to-shipped

Placement rules, the boss chain (Station 4: dirty-main guard + `--force` in `bin/boss-dispatch.sh`, secretary stages only the plan file, greenlight land + boss closes the PR, `data/rules.md` exists, deploy standing-permission), asset-hub row, skill-budget guard, ledger nuance, and all sibling cross-refs (incl. `pipelines/video/CLAUDE.md`) verified against root CLAUDE.md rule 5, `tooling/boss/README.md` + `CLAUDE.md`, `tooling/claude-skills/secretary/SKILL.md`, `plans/README.md`, and decisions.md (2026-07-11 boss deploy permission, 2026-07-12 asset hubs) on 2026-07-12. House-stack/UI-standard reference apps verified 2026-07-12; auth model last verified 2026-07-05. Re-verify:
- Ship chain still boss-shaped: `head -35 tooling/boss/README.md`; captain gone: `test ! -d tooling/captain`
- Landed truth vs table: `grep -A20 "## boss-landed" plans/README.md` + `git log --oneline -10`
- House-stack reference app still current: `ls apps/lists-app/`
- Placement rules: root `CLAUDE.md` "Where does a new thing go?"
- UI standard: `grep -in "shadcn" docs/tracker-app-ui-migration-handover.md` (NOT decisions.md — it was never recorded there; the handover doc is the written home, tracker-app the reference implementation)

## personal-stuff-repo-map

Archived 2026-10-06; merged into personal-stuff-architecture-contract. Last notes before the merge:

Facts verified against the repo on 2026-07-12. Re-verify:
- Bucket layout: `ls` the repo root.
- Routing table: read root `CLAUDE.md`.
- Weak-spot #1 (INFRA drift): run `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` — the drift table itself lives in that skill, not here.
- Weak-spot #4 (resolved): `./scripts/skills-status.sh` now reports where skills load, not manifest membership.
- External-toucher list before any move: `scripts/README.md` "External touchpoints" section.
- Load-bearing list: owner answers recorded 2026-07-05; re-confirm with owner if bets change (`context/bets.md`).

## personal-stuff-research-methodology

Authored 2026-07-12 from `decisions.md`, `plans/README.md` (batch notes + rejected/deferred findings sections), `pipelines/video/tts/CLAUDE.md`, `pipelines/video/heygen/CLAUDE.md` + `fal-lipsync/README.md`, and `pipelines/archive/`. Proof-and-analysis recipes + the claim evidence bar folded in 2026-07-12 (owner interview: this skill absorbed the "proof-and-analysis toolkit" and the ship-bar fragment of "external positioning"). All worked-example numbers spot-verified against those files on 2026-07-12.

Re-verify a recipe example before citing it (grep here is rtk-filtered; on "N matches in 0 files" rerun via `rtk proxy grep`):

- TTS bake-off: `rtk proxy grep -n "RTF" pipelines/video/tts/CLAUDE.md`
- fal-lipsync spike: `rtk proxy grep -n "624 frames" pipelines/video/heygen/fal-lipsync/README.md` and `rtk proxy grep -n "fal-lipsync deferred" decisions.md`
- plan-011 fixture flip: `rtk proxy grep -n "| 011 |" plans/README.md`
- Lifecycle cases: `rtk proxy grep -n "<keyword>" decisions.md` / `plans/README.md`

When a new hunch completes the lifecycle, add its row to the worked-examples table only after the decisions.md entry exists.

## personal-stuff-validation-and-qa

Verified against `scripts/check-apps.sh`, app package.json test scripts, `plans/WORKFLOW.md`, `plans/runs/LESSONS.md`, and decisions.md (2026-07-04 uniform verification; 2026-07-05 orchestrate v2.2 rubric rule) on 2026-07-05; re-verified 2026-07-12 (KNOWN_FAILING still exactly analytics-app:lint + tutorial-tracker-app:lint; tutorial-tracker-app suite grew to ~76 cases; timeblock gained a vitest suite; guard-test rule wording still matches **personal-stuff-change-control**'s — change-control owns the rule, this skill owns the mechanics). Re-verify:
- Ladder level 1: `sed -n '1,30p' scripts/check-apps.sh`
- Test suites: `grep '"test"' apps/*/package.json`
- Executor rules: `grep -n "rubric\|scope check\|self-fix" decisions.md`

## personal-stuff-video-automation-campaign

Grounded in `pipelines/youtube/final-workflow/final-workflow-notes.md`, `pipelines/video/tts/{CLAUDE.md,SYNC-PROBLEM.md,OUTPUTS.md,REFERENCES.md}`, `pipelines/video/heygen/CLAUDE.md` + `fal-lipsync/README.md`, `decisions.md` (2026-07-12 VO-first + hubs + fal-deferral entries; 2026-07-11 autonomy policy; 2026-07-05/07 routing entries), `tooling/boss/data/rules.md` (executor/model routing), `plans/README.md` (011 DONE + PIPE-01 backlog). All paths, the 135 stub, the `TODO[HNS]` stubs, the OUTPUTS.md columns (header-only, 6 columns), the `jamila-30s` slug, and the cost numbers re-verified 2026-07-12. Most volatile skill in the library — re-verify before each campaign session:

- VO-first still the decision? `grep -n "VO-first" decisions.md | head -3`
- Open problems / cost table moved? `sed -n '16,52p' pipelines/youtube/final-workflow/final-workflow-notes.md`
- Processor time log started yet (baseline rows)? `grep -n "Processor time log" pipelines/youtube/final-workflow/final-workflow-notes.md` (no match as of 2026-07-12 — the operator adds it per the Phase-1 protocol)
- fal-lipsync still deferred? `grep -n "fal-lipsync deferred" decisions.md`
- Unattended runs still read-only-first? `grep -n "Autonomy policy" decisions.md`
- 135 rulebook still a stub? `head -3 pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`
- HeyGen still stubbed (PIPE-01)? `grep -n "TODO\[HNS\]" pipelines/youtube/tutorial-pipeline-2/lib/heygen.py`
- Which phases already have plans? `grep -in "final-workflow\|thumbnail\|qc" plans/README.md`
