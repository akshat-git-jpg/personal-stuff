---
name: personal-stuff-failure-archaeology
description: Use before proposing a tool, architecture, migration, or cleanup in personal-stuff — to check whether it was already tried, reverted, decommissioned, or explicitly rejected. Also use when encountering references to Hermes, ty/, TY, workers/, OmniVoice, x-twitter CLI, render.agrolloo.com, or Sheets-backed tracker code, or when a "great idea" feels suspiciously obvious.
---

# Failure archaeology — settled battles

## Overview

This repo reverses course via explicit decommissions (there are zero `git revert`s in history — reversals are deliberate, dated, and logged). Each row below is settled. **Re-opening one requires new evidence + an owner decision via decisions.md** (see **personal-stuff-change-control**), not enthusiasm. Also check `plans/README.md`'s rejected-findings list before re-auditing anything.

## The ledger

| Battle | Root cause | Evidence | Status |
|---|---|---|---|
| **Two-brain repo (`ty/` theme folder)** — theme/origin bucket with its own CLAUDE.md/docs/decisions | Every lookup + doc lived twice; routing forced through two brains | Subtree-merged 2026-07-03 (`a823479`), dissolved into `pipelines/` + `apps/` 2026-07-04 (`3da2c69`, `9e0c060`); owner-confirmed costliest mistake | SETTLED — never create theme buckets; money-making lens lives in `context/bets.md`, not the tree |
| **Hermes agent** (VPS containers + dashboard) | Decommissioned whole | 2026-06-14: containers, ~4.8GB image, `/docker/hermes`, `/root/.hermes` all purged (`86d0894`) | DEAD — do not resurrect; any doc mentioning Hermes is stale |
| **Fat MCP catalog** (gmail/sheets/youtube/hostinger/calendar/docs/elevenlabs servers) | MCP cost scales with catalog size: 47k tokens/session | MCP→CLI migration complete; graveyard cleaned 2026-07-04 (decisions.md); now ~2.7k tokens (token figures from project memory) | SETTLED — CLI+skill by default; only `google-drive` + `cloudflare` MCPs live. EXCEPTION: `gmail-mcp-server` + `google-shared` are load-bearing (VPS digest cron + CLI OAuth) — never delete |
| **Sheets as tracker-app backend** | Replaced by normalized D1 (`tracker-db`); sheet-only scripts deprecated | D1-only since 2026-06-30; `DATA_BACKEND` var is vestigial; `process_yt_tracker.py` deprecated (`3338361`, `af8f596`) | SETTLED — `HISTORY.md` says "never code against it" |
| **Tracker one-off redos** (owner: "not intuitive and scalable for different systems, had to do multiple redo, still not perfect") | Hand-built per-system UI instead of a generic engine | Pipeline engine (typed `PipelineDef`s) + plans 014–019 person-centric revamp; guard tests over ALL defs (plan 022) | SETTLED architecture — new system = one typed def + deploy. REJECTED: a system-builder admin UI (typed defs + deploy is the right cost for a quarterly action) |
| **Antigravity in the graphics path** | Failed quality on all four axes in the Devsplainers PoC | Recorded in decisions.md 2026-07-05 (tutorial pipeline v3) | SETTLED — Antigravity for prompt grind only; graphics via Sonnet + hyperframes skills |
| **Fine-tuning for style cloning** | 20–30 scripts/channel is too little data; weaker local models | decisions.md 2026-07-05 (competitor-styles) | REJECTED — distill-once Style DNA packs instead |
| **RAG for style cloning** | Style is a global property, not chunk-retrievable | Same entry | REJECTED — revisit only as topic-research index if a pack outgrows context (100+ transcripts) |
| **OmniVoice TTS engine** | Flipped to IndexTTS-2 (2026-06-23) | `pipelines/video/tts/` README (OmniVoice sections marked HISTORICAL) | SUPERSEDED — don't trust OmniVoice-era measurements |
| **x-twitter-pp-cli** | Can't read on Free tier; broken `auth login` | Tried then removed (project memory) | REMOVED — use the `tweet-lookup` skill (public embed endpoint); no safe free search/timeline |
| **html-to-video / render.agrolloo.com** | Replaced | `render2.agrolloo.com` backed by `apps/hyperframes-render/` | SUPERSEDED |
| **hyperframes-vs-remotion experiment** | Comparison concluded; Hyperframes won for this repo | `pipelines/archive/hyperframes-vs-remotion/` — "Don't build new work here" | ARCHIVED |
| **nginx on the VPS** | Traefik owns 80/443 | Purged entirely (INFRA.md cleanup, backup at `/root/cleanup-backup-20260613/`) | DEAD |
| **personal-dashboard gate removal** | Gate deleted as a "no-op" while app was public; docs still said gated | Restored 2026-07-04 with self-healing password hash (decisions.md) | REVERSED — the incident behind the "gates match docs" rule |
| **Standalone TY clone on VPS + github-ty deploy key** | Orphaned by the subtree merge; render2 mount pointed at it | Retired 2026-07-04 (decisions.md; plan 010, `ce08e57`) | DEAD |
| **n8n-website placeholder** | Dead folder | Removed (`150cf56`, `b7b20e3`) | DEAD |
| **Monolithic SKILL.md files** (printing-press was 294KB, loaded fully every invoke) | Skill body loads on invocation; phase content belongs in lazy references/ | Split 2026-07-04 into `references/phase-*.md` (~92% cheaper); humanizer/notebooklm too (plan 024) | SETTLED pattern. WARNING: printing-press split diverges from upstream — an upstream update will overwrite it; redo the split (script pattern in git history) |
| **Worktrees / TDD / formal specs in this repo** | Owner stances with recorded rationale | `.claude/settings.json`, project memory | SETTLED — see **personal-stuff-change-control** |

## Stale-reference decoder

Seeing these in docs means the doc predates a settled battle — fix the doc, don't follow it: `ty/` or `TY/` paths (→ `pipelines/`, landing pages → `apps/pinterest-landing-pages/`), `workers/redirector` (→ `apps/redirector/`), `render.agrolloo.com` (→ render2), Hermes anything, `personal stuff` with a space (→ `personal-stuff`), `pipelines/ai-video-production/` (→ `pipelines/video/motion-graphics/`).

## When NOT to use this skill

- The idea is genuinely new here → **personal-stuff-idea-to-shipped** (and the `roast`/`scout` skills to pressure-test it)
- Current failure, not historical → **personal-stuff-debugging-playbook**

## Provenance and maintenance

Compiled from `decisions.md`, git log (no reverts confirmed via `git log --grep=revert -i`), `INFRA.md` cleanup section, plans/README rejected list, and project memory on 2026-07-05. Re-verify a row before citing it: `grep -n "<keyword>" decisions.md` or `git log --oneline --all | grep -i "<keyword>"`. New settled battles: add a row here AND the decisions.md entry that settles it.
