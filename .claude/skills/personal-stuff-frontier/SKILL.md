---
name: personal-stuff-frontier
description: Use when deciding what to work on next in personal-stuff, asked "what's the state of X / what's still open", planning the next work session or orchestrate run, or evaluating whether a new effort aligns with the owner's active bets. A snapshot of open ends, why each is open, and the first concrete steps — dated 2026-07-05 and expected to age.
---

# Frontier — where this repo is going (as of 2026-07-05)

## Overview

Owner-ranked priorities (interview 2026-07-05): **1) finish tutorial pipeline v3, 2) more autonomous orchestration, 3) fully automated YT video production — screen-recording AND explainer styles — best quality, token-optimized.** Everything else below is labeled candidate/open. The formal queue also lives in `plans/README.md` (deferred backlog + direction options) — check it before inventing work.

## Priority 1 — tutorial pipeline v3 (Plan 011, the only open plan)

- **Why open:** deliberately deferred — implementing avatar/graphics overlay passes before real HeyGen downloads exist would be building against stubs (plan 011 review note).
- **Asset in place:** an executor-ready plan with fixtures and expected numbers; working v2 voice machinery; committed v3 scaffolds.
- **First steps:** ① dispatch `plans/011-tutorial-pipeline-v3.md` via the `orchestrate` loop; ② owner eyeballs the first real `segments.json` against its recording (validates 040's boundary rules); ③ author step 135's graphics rulebook in a Sonnet Claude Code session with the pipelines hyperframes skills. Full runbook: **personal-stuff-video-automation-campaign**.

## Priority 2 — more autonomous orchestration

- **Why open:** v3 candidates (scheduled self-triggering runs, approval triage buckets, Stop-hook loops) were consciously skipped in orchestrate v2.3 — "autonomy policy still open" + YAGNI for a single operator (decisions.md 2026-07-05).
- **Asset in place:** orchestrate v2.3 with the full loop already automated (dispatch → ledger → watcher → verify → capped fix-ups), `plans/runs/LESSONS.md` compounding executor lessons, `watch-run.sh` exit codes + `runlog-status.sh` status words.
- **First steps:** ① write the autonomy policy as a `decisions.md` entry (what may self-trigger, what always gates on the human); ② pilot ONE scheduled self-triggering run on the lowest-risk plan class (mechanical docs-drift fixes, e.g. what `audit-repo-route` finds); ③ only add triage buckets if run volume actually creates a review queue.

## Priority 3 — fully automated video production (both styles)

- Screen-recording style: IS priorities 1 + the campaign's sync/graphics/avatar phases — one home: **personal-stuff-video-automation-campaign**.
- **Explainer style: no pipeline exists yet** (candidate). Assets already in repo: `yt-style-copy` skill + competitor style packs (script DNA), hyperframes + card-library + render2 (visuals), video/tts (voice). First steps: ① distill one explainer competitor into a style pack (`pipelines/youtube/competitor-styles/`); ② script one explainer via `yt-style-copy`; ③ prototype visuals as a hyperframes composition — then decide whether it earns its own `pipelines/` folder (register per **personal-stuff-idea-to-shipped**).

## Candidates (real assets, not owner-selected — don't start without asking)

| Candidate | Asset already in repo | Why open | First step if greenlit |
|---|---|---|---|
| Ship bank-statement-parser to RapidAPI | Code complete; reconciliation verified offline (`check_reconcile.py`); design spec in `docs/specs/` | Never run live; needs `ANTHROPIC_API_KEY` spend + VPS deploy + RapidAPI listing | One live pass on a real statement |
| Scale Pinterest PDF business | 4 pinterest-* skills, 2 brands live (keto, bridebestie), per-niche data folders | Posting is manual; Phase 2 unstarted (`pipelines/pinterest/PLAN.md`) | Pick from PLAN.md's roadmap with the owner |
| Complete the income picture | `paypal-txns-pp-cli` + `pp-impact` wired; gumroad/skool CLIs built but unwired | "to add" in `pipelines/income-analysis/README.md` | Wire gumroad snapshots into `snapshots/` |
| Spending-tracker app | Design notes + iOS SMS feasibility in `apps/spending-tracker/` | Explicitly not built; open design questions | Resolve the SMS-forwarding question with the owner |
| Security backlog | SEC-02..07 (SSRF, auth weaknesses, rate-limiting), BUG/DEP items enumerated in `plans/README.md` deferred list | Recorded during the workflow audit, never planned | Turn the highest-severity item into a plan |
| video/tts VPS deploy + editor web UI | Target spelled out in `pipelines/video/tts/CLAUDE.md` (2 vCPU box, async queue, add swap first) | Blocked behind the sync problem | Only after campaign Phase 2 |

## Standing context for any session here

The five active bets (`context/bets.md`): YouTube channels, Pinterest digital products, short-link/affiliate routing, bank-statement-parser micro-SaaS, career prep. Per-bet metrics are unfilled `TODO(owner interview)` placeholders — don't invent numbers; ask or leave open.

## When NOT to use this skill

- Executing any item above → its linked home skill/plan
- "Is this idea new?" → **personal-stuff-failure-archaeology** first
- Adding a brand-new idea → `context/ideas.md` via **personal-stuff-idea-to-shipped**

## Provenance and maintenance

Snapshot of 2026-07-05, from owner interview, `plans/README.md`, `context/bets.md`, and pipeline docs. **This skill ages fastest — re-verify at session start:**
- Open plans: `grep -n "TODO\|IN PROGRESS\|BLOCKED" plans/README.md`
- Owner priorities: re-ask if >1 month old or bets.md changed
- Candidate table rows: each names its source file — read it before acting
