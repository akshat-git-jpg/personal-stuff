---
name: personal-stuff-change-control
description: Use before making any non-trivial change in personal-stuff — when deciding whether a task needs a plans/ file or can be done inline, whether a decision must be appended to decisions.md, where a new folder goes, or when tempted to edit a symlinked skill, create a worktree, write TDD-first tests, or commit generated media. Also use when a proposed approach might contradict a past decision.
---

# personal-stuff change control

## Overview

This repo has few rules, but each one exists because its absence already cost real time. **Violating the letter of a rule is violating its spirit.** If a rule seems wrong for your case, surface that to the owner — don't route around it.

## Gate 1 — Does this change need a plans/ file?

- **Multi-step implementation work → plan file.** Write it from `plans/_TEMPLATE.md` into `plans/NNN-slug.md`, register a row in `plans/README.md`, and let an executor run it (root `CLAUDE.md` rule 4). Don't hand a chat transcript to another model.
- **Small, single-session, you're doing it yourself now → inline.** Design inline, then build; no formal spec doc.
- The full orchestrator→executor contract (readiness gate, difficulty routing, runs ledger, fix-up caps) lives in `plans/WORKFLOW.md` and the `orchestrate` skill (`.claude/skills/orchestrate/`, repo-level since 2026-07-05). Key numbers (home for these in this library — others cross-reference here): executor self-fix cap = **5 per plan**; orchestrator fix-up rounds cap = **2**; **one run at a time** (shared working tree); one human gate, placed **pre-dispatch** (decisions.md v2.3 — supersedes `plans/WORKFLOW.md`'s older "owner reviews before merging" wording).
- Plans must pass the executor-readiness gate: the executor never decides — zero open decisions, tricky snippets authored into the plan, every Verify machine-checkable, subjective outputs get an explicit rubric.

## Gate 2 — Does this need a decisions.md entry?

Append (newest at top, format `YYYY-MM-DD — <decision> — <why>`) when you made a **non-obvious decision**: a tool/approach chosen, a convention set, or a load-bearing "why". Check `decisions.md` **before** proposing an approach — the readiness gate explicitly rejects plans that propose house-rejected approaches. `plans/README.md` also carries a rejected-findings list: do not re-audit those.

## Gate 3 — Placement

New folder? Route via the placement rule (apps/ = personal products incl. all deployable Workers; pipelines/ = money-making projects, register in `pipelines/CLAUDE.md`'s map; tooling/ = agent surface). Full lifecycle: **personal-stuff-idea-to-shipped**. Every new folder gets `README.md` + `CLAUDE.md` from day one.

## The non-negotiables (rule — rationale — incident)

| Rule | Rationale | Incident behind it |
|---|---|---|
| **Skills are edited ONLY in `tooling/claude-skills/`**, symlinked into accounts via `./scripts/relink.sh`. Never edit a copy under `~/.claude-work/skills/` or `~/.claude-personal/skills/`. | Single source across two accounts; edits to a symlink target propagate everywhere, edits to a stray copy silently fork. | Dual-account drift is why the manifest system exists (decisions.md 2026-06-30 example line). After relinking, **restart the session** — skill discovery is cached. |
| **No worktrees in this repo.** Edit the main checkout directly. `.claude/settings.json` sets `worktree.bgIsolation: "none"`. | External systems (VPS pulls, symlinks, .mcp.json) key on the one checkout path; the orchestrate loop already enforces one-run-at-a-time on the shared tree. | Owner-set stance; also why orchestrate v2.1 added the one-run-at-a-time rule. |
| **No TDD.** Write working code first; manual smoke tests. | Single-operator personal repo; test ceremony slows shipping. | Owner-set stance. |
| **EXCEPTION — guard tests are mandatory for generic/data-driven layers**: any engine that renders from configs/defs must have invariant tests looping over ALL configs, so a new config can't silently break rendering. Mechanics + model: **personal-stuff-validation-and-qa**. | A new pipeline def must not make the owner the test harness. | Tracker-app took **multiple redos** to become intuitive/scalable across systems (owner-confirmed 2026-07-05, plans 014–019 + engine rebuild). |
| **Media policy:** inputs/reference assets tracked; render outputs gitignored + untracked; heavy artifacts (models, work dirs) live OUTSIDE the repo in `~/kb-scratch/`. | Agent searches walk the tree; git stays fast. | The working tree hit **18GB** and every agent search walked it (decisions.md 2026-07-04). |
| **One brain, by-kind structure.** Never create a theme/origin-grouped bucket with its own docs/decisions. | Two routing tables = every lookup done twice, docs drift apart. | The `ty/` theme-folder forced a two-brain repo for weeks; dissolving it (2026-07-04) was the owner's costliest-confirmed cleanup. |
| **Skill descriptions ≤500 chars (hard cap ~700).** | Every linked skill's description loads into every session — permanent token tax. | 2026-07-04 hygiene pass trimmed 12 descriptions, saving ~2.9K chars/session. |
| **MCP is last resort; CLI + skill is the default tool shape.** MCP only for no-shell / stateful / distribution cases. | MCP price scales with catalog size, CLI with usage. | MCP catalog once cost **~47k tokens/session**; the MCP→CLI migration cut it to ~2.7k (figures from project memory; migration itself in decisions.md 2026-07-04). |
| **Auth gates and docs must match deployed reality.** Don't remove a gate as a "no-op"; don't document a gate that isn't enforced. | Public apps described as gated but actually open are silent exposures. | personal-dashboard's gate had been removed as a no-op while publicly reachable; restored 2026-07-04 (decisions.md). |

## After a deploy-shaped change

New Worker, domain, or hub card ⇒ the triple-update rule (all three inventory surfaces, same change) — home: **personal-stuff-hosting-inventory**. Human-facing prose goes through the humanizer skill (see **personal-stuff-docs-and-writing**).

## Red flags — stop and re-read this skill

- "I'll just fix the skill copy in ~/.claude-*/skills quickly"
- "A worktree would be cleaner here"
- "This engine change is too small to run the guard tests"
- "I'll commit the rendered MP4/PNG just this once"
- "This decision is obvious, no decisions.md entry needed" (if you had to think, it wasn't obvious)
- "The old decision doesn't apply to my case" (surface it, don't route around it)

## When NOT to use this skill

- Pure orientation (where does X live) → **personal-stuff-repo-map**
- Executing a deploy → **personal-stuff-deploy-and-operate**
- Writing/maintaining the docs of record themselves → **personal-stuff-docs-and-writing**

## Provenance and maintenance

Rules verified against root `CLAUDE.md`, `decisions.md`, `plans/WORKFLOW.md`, `.claude/settings.json`, and owner interview answers on 2026-07-05. Re-verify:
- No-worktree setting: `cat .claude/settings.json`
- Caps/gates: `grep -n "self-fix\|fix-up\|readiness" decisions.md`
- Description budget: `grep -n "500" tooling/claude-skills/claude-router/SKILL.md`
