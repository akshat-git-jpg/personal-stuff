---
name: personal-stuff-docs-and-writing
description: Use when writing or updating any documentation in personal-stuff — appending to decisions.md, registering a plan, closing a runs ledger, refreshing INFRA.md / VPS-CRONS.md / my-hosted-sites.md, or adding a README or CLAUDE.md to a new folder. Also use when unsure which doc of record a fact belongs in. (Rewriting prose to sound natural stays with humanizer.)
---

# Docs and writing

## Overview

Every fact has exactly ONE home; everything else links to it. A doc that drifts is worse than no doc — this repo's own INFRA.md proves it (see weak spots in **personal-stuff-repo-map**). When you change reality, update the home doc **in the same change**.

## The docs of record and their contracts

| Doc | Contract | Format |
|---|---|---|
| `decisions.md` | Append on any non-obvious decision; newest at TOP; check before re-deriving | `YYYY-MM-DD — <decision> — <why> (<optional link>)`, one line |
| `plans/NNN-slug.md` | From `plans/_TEMPLATE.md`; register a row in `plans/README.md`; statuses: TODO / IN PROGRESS / DONE / BLOCKED (reason) / REJECTED (rationale) | template |
| `plans/runs/<YYYYMMDD-HHMM>-<slug>.md` | Append-only run ledger; orchestrator writes header + `ROUND N START`; executor appends START/HEARTBEAT/DONE/BLOCKED; `RUN DONE` is the success sentinel | `plans/WORKFLOW.md` |
| `plans/runs/LESSONS.md` | One line per cross-run executor lesson, appended after verification | `YYYY-MM-DD <executor> — <lesson>` |
| `INFRA.md` | Update on ANY infra change (new Worker/domain/D1/KV/container/cron) | inventory prose |
| `VPS-CRONS.md` | **Mirrored to three places** — repo root, `vps-crons` root, `/root/VPS-CRONS.md` on the VPS. Update ALL THREE (plan 031 synced them; drift returns otherwise) | runbook |
| `my-hosted-sites.md` | One line per live URL; update on launch/retire; `probe-sites.sh` parses it, so format matters | flat list |
| `context/` | `bets.md` on bet start/pause/stop/pivot; `inventory.md` on launch/pause/retire; `ideas.md` on new high-potential idea. Pointers not copies; NO secrets/PII | per `context/CLAUDE.md` |

## Folder-doc conventions

- Every new folder: `README.md` (orients a human) + `CLAUDE.md` (tells Claude how to operate there) from day one. Sub-folder CLAUDE.mds are not auto-loaded.
- **CLAUDE.md must not import/duplicate its README** (plan 026 removed that pattern). Keep CLAUDE.md operational: rules, gotchas, commands. Target ≤12KB (plan 028 trimmed tracker-app's for this).
- Superseded design belongs in a `HISTORY.md` marked "never code against it" (tracker-app pattern), not inline in CLAUDE.md.
- Stub marker convention: `<!-- stub: flesh out -->` — leave it when scaffolding, so the `audit-repo-route` skill can find unfinished docs.
- Skill frontmatter descriptions: ≤500 chars (see **personal-stuff-change-control**).
- Date-stamp volatile facts ("as of YYYY-MM-DD") — counts, URLs, versions, statuses.

## Routing-map maintenance

Mechanical drift in the root "Find it fast" table, dead links, missing READMEs → run the existing `audit-repo-route` skill (personal account) rather than hand-auditing; review its fixes via `git diff`.

## Human-facing prose → humanizer

Any prose a human will read — README content, PR descriptions, Slack/email/Jira text, docs pages, landing/marketing copy, scripts for videos — goes through the existing `humanizer` skill before delivery. Exclusions: code, code comments, commit messages, config files, CLI output, machine-read files. (Global rule from the user's CLAUDE.md; it applies when drafting AND when rewriting.)

## Where does this fact go? (quick disambiguator)

- A *why* → `decisions.md`. A *what-runs-where* → `INFRA.md`. A *how-to-operate* → the owning folder's CLAUDE.md. A *URL* → `my-hosted-sites.md`. A *cron detail* → `VPS-CRONS.md`. An *owner-level goal* → `context/bets.md`. Cross-project research/spec → `docs/`. If two docs both want it: pick the more specific home, link from the other.

## When NOT to use this skill

- Deciding IF a change needs a decision/plan at all → **personal-stuff-change-control**
- Writing a new operating skill → `superpowers:writing-skills` + the conventions here
- The doc you're fixing contradicts reality → verify reality first (**personal-stuff-debugging-playbook**, `probe-sites.sh`), then fix the doc

## Provenance and maintenance

Contracts verified against the docs themselves, `plans/WORKFLOW.md`, `context/CLAUDE.md`, plan 026/028/031 outcomes, and the global humanizer rule on 2026-07-05. Re-verify:
- Ledger line formats: `sed -n '38,57p' plans/WORKFLOW.md`
- Three-copy rule: header of `VPS-CRONS.md`
- context cadence: `context/CLAUDE.md`
