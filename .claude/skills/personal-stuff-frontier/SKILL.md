---
name: personal-stuff-frontier
description: Snapshots personal-stuff's open fronts (dated 2026-07-12, ages fast): why each is open and its first concrete step — autonomy, cost toward <$10/video, the plans really still open, deferred work, and the bet-alignment test. Use when deciding what to work on next, asked "what's still open", planning a session or boss run, or checking an effort against the active bets.
---

# Frontier — where this repo is going (as of 2026-07-12)

> **Dated snapshot.** Written 2026-07-12 and not refreshed since. Dates in it have passed (the autonomy window opened ~2026-08-08). Re-verify every row against `plans/README.md`, `decisions.md` and `gh pr list` before acting on it.

## Overview

The week 2026-07-05→07-12 closed the old frontier: plan 011 verified DONE, plans 043/044–051/054–060 landed via boss, the VO-first decision retired the dub-sync problem, and the tts/heygen asset hubs + media-board shipped. The frontier moved from "build the pipelines" to **scale the multi-channel final workflow past 12 videos/mo**. The formal queue lives in `plans/README.md` — but its table status cells are advisory and STALE for boss-landed rows (043/051/056–059 say TODO yet landed); the `## boss-landed` section at the bottom + `git log` are the truth.

**Beyond SOTA** here means two axes only: **autonomy** (Front 2) and **cost** toward <$10/video (Front 4), owner-confirmed 2026-07-12. The full definition, and why throughput is the constraint rather than the goal, lives in **personal-stuff-video-automation-campaign**.

## Front 1 — final-workflow scale-up (the binding LIVE constraint)

Videos/mo is stuck at 12 because the processor serializes every video. The 7 open problems (source of truth: `pipelines/youtube/final-workflow/final-workflow-notes.md` "Open problems (prioritized)"), their why-open notes and first steps are the phases of **personal-stuff-video-automation-campaign** — route there before building. Per-video cost context: Front 4.

## Front 2 — autonomy (beyond-SOTA axis a; pilot landed, the policy gates what's next)

End state (owner-confirmed 2026-07-12): the pipeline running unattended end-to-end. The route there is deliberate, not a leap:

- **What landed:** plan 058 — weekly read-only route-audit cron (VPS `claude -p`, report-only, Telegram; `infra/route-audit/`). The frontier's old priority-2 first steps (policy entry + pilot) are DONE.
- **The policy (decisions.md 2026-07-11, autonomy policy v1):** scheduled/unattended runs are READ-ONLY — report/alert only, never edit/commit/push/deploy. **Widen only after ≥4 clean weeks, one class at a time** — the window opened ~2026-08-08; as of 2026-10-06 `decisions.md` records no next class, so check there before assuming one was added.
- Separate standing grant (same date, not autonomy): boss may run the owner-side deploy chain end-to-end, but ONLY when the owner explicitly says "deploy". Boss routing defaults live in `tooling/boss/data/rules.md` (orchestrate stamps executor/model at plan time).
- **First step:** let route-audit accrue clean weeks; when the window passes, propose ONE next read-only class — the COST-06 usage-snapshot cron (below) is the natural candidate. Write classes come after read classes prove out.
- **You have a result when** a write-class cron completes 4 consecutive weeks with zero incident rows.

## Front 3 — plans that are REALLY open (table rows verified 2026-07-12)

- **PR#3 `045-dossiers-explainer-flow` is `boss:ready`** — the only open PR. First step: dispatch it in a boss session. (Research-v2 explainer variant; its 044 parent was superseded by landed 051.)
- **052 + 053 (dossier-build fixes: tool-identity/schema, then driver script + metadata):** plan files exist in `plans/`, no PR raised. First step: `/secretary raise` in order 052 → 053. These also unblock Front 1 problem #4.
- **011 remnants:** step 135 graphics rulebook — `pipelines/archive/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` EXISTS but is a 14-line stub (~814B, verified 2026-07-12); author the real thing in a Sonnet Claude Code session per the campaign skill. Ignore the legacy flat `steps/135-build-graphics-sonnet/` folder (only an empty `output/`) — the stage folders (`5-visuals/`, …) are canonical. Step 162 overlay passes (`PIPE-01`) stay blocked on real HeyGen downloads existing.

## Front 4 — cost: toward <$10/video all-in (beyond-SOTA axis b)

Target owner-confirmed 2026-07-12. Current: **~$48/video at 12/mo**; the reviewer share ($150/mo ÷ volume, script-only) is the only pure volume lever; TTS is already near-floor (done as a lever). Full cost table: `pipelines/video/CLAUDE.md` + `pipelines/youtube/final-workflow/final-workflow-notes.md`. Known levers:

- **fal-lipsync un-deferral** — validated at ~$0.30–0.40/min (~$1.75/video vs $5, subtracts ~$3.25) but owner-DEFERRED (decisions.md 2026-07-12). Un-deferring is an owner call; don't build ahead of it.
- **Reviewer-share automation/dilution** — volume alone takes $12.50 → $5 at 30/mo; automating parts of script review is the deeper cut (interacts with Front 1 problem #3's QC gap — don't automate review away while final-video QC is still unowned).
- **The human labor lines ($30: tutorial maker + editor)** are the arithmetic bulk — <$10 is unreachable without shrinking them, which is exactly what Front 1's productization (pre-rendered graphics shrink editor scope; VO-first makes the maker role cheaper to hire) and Front 2's autonomy converge on. Cost and autonomy are the same road at different mile markers.

**You have a result when** a shipped video's manifest-verified cost line is ≤ $10 all-in.

## Deferred, not dead (owned by plans/README.md backlog sections — point, don't re-list)

- **fal-lipsync avatar replacement** — validated (~$0.30–0.40/min, does the gaze-down pose) but owner-DEFERRED (decisions.md 2026-07-12): do not build the avatar CLI or push the migration until the owner revisits. HeyGen stays the path. (Also the second-order Front 4 lever — deferred means deferred there too.)
- **Income-snapshot wiring** (gumroad/skool CLIs built, unwired; one snapshot ever) — surfaced and deselected 2026-07-11.
- **COST-06 usage/cost cron** — deselected 2026-07-11; doubles as the next autonomy class candidate.
- **Security backlog SEC-02..07** + **tracker backlog TRK-01..05** — enumerated with effort grades in `plans/README.md` "Findings NOT turned into plans"; promote the highest-severity item to a plan when the owner wants one.

## Alignment test for any new effort

Check `context/bets.md` (5 active bets). Fronts 1 and 3 serve bet 1 (YouTube channels); problem #6 is bet 3 (affiliate routing) directly. Per-bet metrics are still unfilled `TODO(owner interview)` placeholders — don't invent numbers; ask or leave open. An effort serving no bet needs an explicit owner call (and a `context/ideas.md` entry first).

## When NOT to use this skill

- Executing Front 1 / video work → **personal-stuff-video-automation-campaign**
- Raising or dispatching a plan → `secretary` / `tooling/boss/` (via **personal-stuff-change-control**)
- "Is this idea new?" → **personal-stuff-failure-archaeology** first
- Adding a brand-new idea → `context/ideas.md` via **personal-stuff-idea-to-shipped**
