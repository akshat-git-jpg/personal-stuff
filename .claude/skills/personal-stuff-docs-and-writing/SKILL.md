---
name: personal-stuff-docs-and-writing
description: Holds the contracts for personal-stuff's docs of record (decisions.md, plans and run ledgers, INFRA.md, VPS-CRONS.md, my-hosted-sites.md, context/, asset-hub manifests), the folder README/CLAUDE.md conventions, and where a given fact belongs. Use when writing or updating any repo doc or unsure which doc owns a fact. Third-party prose goes to humanizer; owner-facing replies to i-have-adhd.
---

# Docs and writing

## Overview

Every fact has exactly ONE home; everything else links to it. A doc that drifts is worse than no doc — this repo's own INFRA.md proves it (see weak points in **personal-stuff-architecture-contract**). When you change reality, update the home doc **in the same change**.

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
| `pipelines/video/tts/OUTPUTS.md`, `pipelines/video/heygen/RENDERS.md` | Asset-hub manifests — docs of record for generated media: one row per voiceover/render; the media itself lives OUTSIDE the repo in `~/kb-scratch/video/{tts,heygen}/<pipeline>/`, never committed (decisions.md 2026-07-12) | per asset-hub rule in `pipelines/CLAUDE.md` |

## Folder-doc conventions

- Every new folder: `README.md` (orients a human) + `CLAUDE.md` (tells Claude how to operate there) from day one. Sub-folder CLAUDE.mds are not auto-loaded.
- **CLAUDE.md must not import/duplicate its README** (plan 026 removed that pattern). Keep CLAUDE.md operational: rules, gotchas, commands. Target ≤12KB (plan 028 trimmed tracker-app's for this).
- Superseded design belongs in a `HISTORY.md` marked "never code against it" (tracker-app pattern), not inline in CLAUDE.md.
- Stub marker convention: `<!-- stub: flesh out -->` — leave it when scaffolding, so the routing maintainer job can find unfinished docs.
- Skill frontmatter descriptions: ≤500 chars (see **personal-stuff-change-control**).
- Date-stamp volatile facts ("as of YYYY-MM-DD") — counts, URLs, versions, statuses.

## Routing-map maintenance

Mechanical drift in the root "Find it fast" table, dead links, missing READMEs → run the existing `routing` maintainer job rather than hand-auditing; review its fixes via `git diff`.

## Prose → humanizer or i-have-adhd, by audience

Prose a **third party** will read (README content, PR descriptions, Slack/email/Jira text, docs pages, landing/marketing copy, video scripts) goes through the `humanizer` skill before delivery, when drafting and when rewriting.

Prose the **owner** reads back in the session (explanations, instructions, summaries, status reports) goes through `i-have-adhd` instead. It auto-fires and persists once active; after "stop adhd mode" it must not be re-invoked.

Excluded from both: code, code comments, commit messages, config files, CLI output, machine-read files. (Global rule from the user's CLAUDE.md; see decisions.md 2026-08-08 for why the split is by audience.)

## Where does this fact go? (quick disambiguator)

- A *why* → `decisions.md`. A *what-runs-where* → `INFRA.md`. A *how-to-operate* → the owning folder's CLAUDE.md. A *URL* → `my-hosted-sites.md`. A *cron detail* → `VPS-CRONS.md`. An *owner-level goal* → `context/bets.md`. Cross-project research/spec → `docs/`. If two docs both want it: pick the more specific home, link from the other.

## When NOT to use this skill

- Deciding IF a change needs a decision/plan at all → **personal-stuff-change-control**
- Writing a new operating skill → `superpowers:writing-skills` + the conventions here
- The doc you're fixing contradicts reality → verify reality first (**personal-stuff-debugging-playbook**, `probe-sites.sh`), then fix the doc
