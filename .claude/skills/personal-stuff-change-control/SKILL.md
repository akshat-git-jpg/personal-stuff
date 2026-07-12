---
name: personal-stuff-change-control
description: Use before making any non-trivial change in personal-stuff — deciding whether a task needs a plans/ file or can be done inline, raising or dispatching a boss PR (secretary raise, boss:ready, dirty-main, deploy gate), whether a decision goes in decisions.md, where a new folder goes, or when tempted to edit a symlinked skill, create an ad-hoc worktree, switch an executor model, write TDD-first tests, or commit generated media. Also when a proposed approach might contradict a past decision.
---

# personal-stuff change control

## Overview

This repo has few rules, but each one exists because its absence already cost real time. **Violating the letter of a rule is violating its spirit.** If a rule seems wrong for your case, surface that to the owner — don't route around it.

## Gate 1 — Does this change need a plans/ file?

- **Multi-step implementation work → plan file.** Write it from `plans/_TEMPLATE.md` into `plans/NNN-slug.md`, register a row in `plans/README.md`, and let an executor run it (root `CLAUDE.md` rule 4). Don't hand a chat transcript to another model.
- **The landing path is PR-driven via boss (as of 2026-07-12).** `captain` is frozen/deprecated (decisions.md 2026-07-07). Flow: `orchestrate` writes the plan (with boss YAML frontmatter, routing defaults in `tooling/boss/data/rules.md`) → `secretary raise` turns it into a `boss:ready` GitHub PR, staging ONLY the plan file — **never hand-roll the branch/commit/PR** (root `CLAUDE.md` rule 5) → boss dispatches a crew in a `wt` worktree, verifies via the plan's `test_cmd`, lands via greenlight. The `boss:ready` label IS the owner's approval (batch-confirmed at session start) — the one implementation gate; deploy is the only hard per-item gate. Operating manual: `tooling/boss/CLAUDE.md`.
- **`plans/README.md` is boss-owned on main.** Plan branches never edit it — the 044–050 batch had every branch editing it, producing rebase conflicts greenlight parked on (decisions.md 2026-07-07). Registry rows and landings are recorded on main only.
- **Small, single-session, you're doing it yourself now → inline.** Design inline, then build; no formal spec doc.
- The full orchestrator→executor contract (readiness gate, difficulty routing, runs ledger, fix-up caps) lives in `plans/WORKFLOW.md` and the `orchestrate` skill (`.claude/skills/orchestrate/`, repo-level since 2026-07-05). Key numbers (home for these in this library — others cross-reference here): executor self-fix cap = **5 per plan**; orchestrator fix-up rounds cap = **2**; **one run at a time** (shared working tree); one human gate, placed **pre-dispatch** (decisions.md v2.3 — supersedes `plans/WORKFLOW.md`'s older "owner reviews before merging" wording).
- Plans must pass the executor-readiness gate: the executor never decides — zero open decisions, tricky snippets authored into the plan, every Verify machine-checkable, subjective outputs get an explicit rubric.

## Gate 2 — Does this need a decisions.md entry?

Append (newest at top, format `YYYY-MM-DD — <decision> — <why>`) when you made a **non-obvious decision**: a tool/approach chosen, a convention set, or a load-bearing "why". Check `decisions.md` **before** proposing an approach — the readiness gate explicitly rejects plans that propose house-rejected approaches. `plans/README.md` also carries a rejected-findings list: do not re-audit those.

**Who writes it:** executors/crewmates never edit `decisions.md` — the orchestrator appends after landing (convention set with captain's parallel-dispatch hardening, decisions.md 2026-07-07; carried into boss). `.gitattributes` sets `decisions.md merge=union` so parallel branches appending it auto-merge instead of rebase-conflicting. The invariant itself is stated in **personal-stuff-architecture-contract**.

## Gate 3 — Placement

New folder? Route via the placement rule (apps/ = personal products incl. all deployable Workers; pipelines/ = money-making projects, register in `pipelines/CLAUDE.md`'s map; tooling/ = agent surface). Full lifecycle: **personal-stuff-idea-to-shipped**. Every new folder gets `README.md` + `CLAUDE.md` from day one.

## The non-negotiables (rule — rationale — incident)

| Rule | Rationale | Incident behind it |
|---|---|---|
| **Skills are edited ONLY in `tooling/claude-skills/`**, symlinked into accounts via `./scripts/relink.sh`. Never edit a copy under `~/.claude-work/skills/` or `~/.claude-personal/skills/`. | Single source across two accounts; edits to a symlink target propagate everywhere, edits to a stray copy silently fork. | Dual-account drift is why the manifest system exists (decisions.md 2026-06-30 example line). After relinking, **restart the session** — skill discovery is cached. |
| **Worktrees only via `wt` (managed runs).** Agent/executor/parallel runs work in pool worktrees from `tooling/cli/wt`; owner interactive sessions, deploys, VPS/cron ops, and skill edits stay on the main checkout. Never create ad-hoc worktrees by hand. | Parallel agent runs need isolation, but external systems (VPS pulls, symlinks, .mcp.json) and the deploy/skill toolchain key on the one checkout path — the pool bootstraps runtime files and keeps the main checkout canonical. | Rule lifted 2026-07-06 (decisions.md) after the agentic-workflow study; replaces the 2026-07-05 blanket ban. |
| **One writer per checkout.** At most ONE active session uses the main checkout; any additional concurrent session works in a `wt` worktree on a real named branch (`git switch -c task/<name>` inside it — never commit work-to-land on a detached HEAD). Land a task by MERGING its branch into main; never cherry-pick a subset off a mixed branch. `.claude/hooks/branch-guard.sh` (PreToolUse) enforces the switch half: it blocks `git switch`/`checkout <branch>` in the main checkout while another session's transcript is <5 min fresh (override: `GUARD_OK=1` prefix). Shared registries (plans/README.md, decisions.md, my-hosted-sites.md, INFRA.md) are updated on main at landing time only. | Git has one HEAD per checkout — a switch in session B moves it under session A, so A's commits land on B's branch; the only escape is exclusion-cherry-picking, which mints duplicate SHAs that conflict forever after. | The 054/055 tangle (decisions.md 2026-07-10): timeblock commits interleaved on the heygen branch, 40+ cherry-pick conflicts, two competing squashes of the same app on main vs origin. |
| **Never dispatch boss work on a dirty main.** `boss-dispatch.sh` refuses (exit 1) if the main checkout has any uncommitted tracked change, printing the offenders; dirty definition single-sourced as `boss_repo_dirty()` in `tooling/boss/bin/boss-lib.sh`. `--force` overrides — only when you know exactly why. | greenlight parks EVERY merge onto a dirty `REPO_ROOT` as "main checkout busy"; the prior control was a passive session-start reminder that got skipped. The guard now bites at the point of action. | Two batches silently parked: the 2026-07-07 explainer batch and 2026-07-08 PR#12 (decisions.md 2026-07-08). |
| **Boss deploy gate: owner-triggered per item, boss-executed end-to-end (as of 2026-07-11).** Boss has STANDING permission to run the owner-side deploy chain itself — `wrangler secret put`/`deploy`, VPS SSH cron wiring (`timeout`, NOT `gtimeout` — the VPS is Linux), `vps-crons` repo commits, syncing the 3 mirrored `VPS-CRONS.md` copies — but ONLY when the owner explicitly says "deploy" (or equivalent) on that item. The gate itself is unchanged; boss never deploys on its own judgment. Still human-only: interactive browser OAuth consent (`invalid_grant` re-consent via `setup_auth.py`) and destructive acts like deleting a live credential without explicit instruction. | Standing permission removes the hand-the-SSH-steps-back friction, not the gate. Covers plans with empty `deploy:` frontmatter but "Post-merge (owner)" body steps. | First exercised 2026-07-11 deploying 057 (cred-probe cron) + 058 (route-audit pilot) (decisions.md 2026-07-11). |
| **Never pick the executor model unilaterally.** Executor+model routing comes from `tooling/boss/data/rules.md` at plan-authoring time: `orchestrate` stamps the plan's frontmatter from its per-task-type table (default → claude-p/sonnet; type:refactor (large) → claude-p/opus; type:chore (mechanical) → agy on its own default, Gemini 3.1 Pro (High)); `secretary` and boss only read what was stamped. If a different model seems right for a plan, surface it to the owner — the `boss-dispatch.sh --executor/--model` one-off override and rules.md appends are owner calls, never a silent switch. | Model choice changes cost, quality, and tooling behavior — it's an owner-level knob, not an optimization the orchestrating session gets to make. | During the boss build an orchestrating session unilaterally forced Claude onto agy runs; owner-corrected (recorded 2026-07-12 from owner interview; promotion to this table owner-approved same day). |
| **No TDD.** Write working code first; manual smoke tests. | Single-operator personal repo; test ceremony slows shipping. | Owner-set stance. |
| **EXCEPTION — guard tests are mandatory for generic/data-driven layers**: any engine that renders from configs/defs must have invariant tests looping over ALL configs, so a new config can't silently break rendering. Mechanics + model: **personal-stuff-validation-and-qa**. | A new pipeline def must not make the owner the test harness. | Tracker-app took **multiple redos** to become intuitive/scalable across systems (owner-confirmed 2026-07-05, plans 014–019 + engine rebuild). |
| **Media policy:** inputs/reference assets tracked; render outputs gitignored + untracked; heavy artifacts (models, work dirs) live OUTSIDE the repo in `~/kb-scratch/`. Voice/avatar media specifically flows through the asset hubs `pipelines/video/{tts,heygen}`: outputs to `~/kb-scratch/video/{tts,heygen}/<pipeline>/` + a manifest row (`OUTPUTS.md`/`RENDERS.md`); slugs resolve from the hub registry, never copied into pipeline folders (decisions.md 2026-07-12; browse via the `media-board` skill). | Agent searches walk the tree; git stays fast. | The working tree hit **18GB** and every agent search walked it (decisions.md 2026-07-04). |
| **One brain, by-kind structure.** Never create a theme/origin-grouped bucket with its own docs/decisions. | Two routing tables = every lookup done twice, docs drift apart. | The `ty/` theme-folder forced a two-brain repo for weeks; dissolving it (2026-07-04) was the owner's costliest-confirmed cleanup. |
| **Skill descriptions ≤500 chars (hard cap 700) — machine-enforced.** `scripts/check-skill-descriptions.sh` scans `tooling/claude-skills/` (WARN >500, FAIL >700 → exit 1) and runs inside `scripts/relink.sh`, so an oversized description fails the relink (plan 059, landed 2026-07-11). Run it after ANY skill-description edit. | Every linked skill's description loads into every session — permanent token tax. | 2026-07-04 hygiene pass trimmed 12 descriptions, saving ~2.9K chars/session; the guard makes the budget a change gate instead of a periodic cleanup. |
| **MCP is last resort; CLI + skill is the default tool shape.** MCP only for no-shell / stateful / distribution cases. | MCP price scales with catalog size, CLI with usage. | MCP catalog once cost **~47k tokens/session**; the MCP→CLI migration cut it to ~2.7k — measured at migration time (2026-07-04, owner-recorded; the original measurement is not preserved in-repo — `docs/skill-library-and-infra-handoff.md` (2026-07-05) records the figures and labels them memory-sourced). Migration itself: decisions.md 2026-07-04 (MCP graveyard cleaned). |
| **Auth gates and docs must match deployed reality.** Don't remove a gate as a "no-op"; don't document a gate that isn't enforced. | Public apps described as gated but actually open are silent exposures. | personal-dashboard's gate had been removed as a no-op while publicly reachable; restored 2026-07-04 (decisions.md). |

## After a deploy-shaped change

New Worker, domain, or hub card ⇒ the triple-update rule (all three inventory surfaces, same change) — home: **personal-stuff-hosting-inventory**. Human-facing prose goes through the humanizer skill (see **personal-stuff-docs-and-writing**).

## Red flags — stop and re-read this skill

- "I'll just fix the skill copy in ~/.claude-*/skills quickly"
- "I'll just git worktree add by hand instead of wt get"
- "I'll just switch branches quickly — the other session looks idle" (that's how 054/055 tangled; GUARD_OK=1 only when you've VERIFIED it's done)
- "I'll cherry-pick just my commits onto main" (mixed branch = the failure already happened; merge task branches, never subset-pick)
- "This engine change is too small to run the guard tests"
- "I'll commit the rendered MP4/PNG just this once"
- "This decision is obvious, no decisions.md entry needed" (if you had to think, it wasn't obvious)
- "The old decision doesn't apply to my case" (surface it, don't route around it)
- "I'll create the branch and PR myself, secretary is overhead" (secretary encodes "stage only the plan file" — hand-rolling is how plans get committed to main)
- "Main is only a little dirty, I'll dispatch with --force" (that exact shortcut silently parked two batches)
- "The merge landed, might as well deploy" (deploy fires only on the owner's explicit "deploy" for that item)
- "This plan would go faster/cheaper on model X, I'll just change the frontmatter" (model routing is owner-level — stamp from `tooling/boss/data/rules.md`, surface any deviation)
- "I'll append my decision to decisions.md from the plan branch" (executors never write it; the orchestrator appends after landing)

## When NOT to use this skill

- Pure orientation (where does X live) → **personal-stuff-repo-map**
- The invariants themselves (what must stay true, why the repo is designed this way, known-weak points) → **personal-stuff-architecture-contract** — this skill owns the change GATES around them
- Executing a deploy → **personal-stuff-deploy-and-operate**
- Full idea→shipped lifecycle (scaffold, first deploy, registration) → **personal-stuff-idea-to-shipped**
- Writing/maintaining the docs of record themselves → **personal-stuff-docs-and-writing**

## Provenance and maintenance

Rules verified against root `CLAUDE.md`, `decisions.md`, `plans/WORKFLOW.md`, `.claude/settings.json`, and owner interview answers on 2026-07-05; boss/secretary path, dirty-main enforcement, deploy standing permission, decisions.md write convention, and the description guard re-verified against `decisions.md`, `tooling/boss/README.md`, `tooling/boss/CLAUDE.md`, `tooling/boss/bin/boss-dispatch.sh`, `.gitattributes`, and `scripts/check-skill-descriptions.sh` on 2026-07-12. Model-routing rule verified against `tooling/boss/data/rules.md` and decisions.md 2026-07-07 ("orchestrate stamps executor+model from rules.md at plan-authoring time; secretary only reads"), and the MCP token figures re-anchored to `docs/skill-library-and-infra-handoff.md`, on 2026-07-12. Re-verify:
- Boss gates: `grep -n "boss:ready\|deploy" tooling/boss/CLAUDE.md`
- Dirty-main guard: `grep -n "boss_repo_dirty\|--force" tooling/boss/bin/boss-dispatch.sh`
- decisions.md convention: `cat .gitattributes` + `grep -n "2026-07-11 — boss\|2026-07-08 — boss" decisions.md`
- Caps/gates: `grep -n "self-fix\|fix-up\|readiness" decisions.md`
- Model routing: `head -20 tooling/boss/data/rules.md` (routing table + "orchestrate stamps, secretary reads" preamble)
- Description budget: `./scripts/check-skill-descriptions.sh`
