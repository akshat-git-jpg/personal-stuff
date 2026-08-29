# docs

Notes that aren't tied to a single project: research write-ups and design specs.

- `plans/` — YouTube/tracker-app pipeline plans (e.g. `2026-05-29-yt-tracker-app.md`).
- `specs/` — design specs (e.g. bank-statement-parser, tracker-app audit).
- `research/` — business, platform and monetization research (e.g. `rapidapi-money-ideas/`, `upload-passive-marketplaces/`).
- `runbooks/` — step-by-step operating procedures: `rotate-gh-token.md`, `windows-custody-setup.md` (2026-08-24 — verifying and repairing the commit-custody machine, pp-work worktrees, auto-commit and auto-land on a Windows laptop; carries a copy-paste prompt that Claude executes end to end). Note: memory and skill maintenance moved to `tooling/maintainer/jobs/<job>/runbook.md`.
- `superpowers/plans/` — implementation plans for superpowers (dashboard, link generation, etc.).
- `superpowers/specs/` — design specs for superpowers (RapidAPI research CLI, founders tracker, personal dashboard, tts-flow).
- Loose handoff and workflow documents:
  - Workflows: `yt-tracker-workflow.md`, `research-and-script-workflow.md`, `yt-analysis-workflow.md`.
  - Handoffs: `vf2-round1-fixes-handoff.md` (2026-07-24 visuals-flow Final Cut round-1: template prunes/reworks, E9/E10/SFX gates, board transport, template-notes loop, what to test next), `motion-graphics-strategy-handoff.md` (2026-07-07 repetitive-motion-graphics diagnosis + two-tier composition-pipeline recommendation — owner deferred the plan), `yt-research-v2-brainstorm-handoff.md` (2026-07-07 research+scripting pipeline v2 — six approaches, owner hasn't picked), `tts-screen-sync-brainstorm-handoff.md` (2026-07-22 syncing a rewritten-script TTS voiceover back to a pre-existing screen recording; RESOLVED 2026-07-23 by going VO-first — see `pipelines/youtube/tutorial-pipeline-3/WORKFLOW.md` and decisions.md; kept as the autopsy of the rejected map-and-retime chain), `kb-routing-audit-handoff.md`, `tracker-app-ui-migration-handover.md`, `transcript-voice-tools-plan.md`, `ty-merge-plan.md`, `orchestrator-executor-loop-handoff.md`, `boss-autonomy-brainstorm-handoff.md` (2026-08-22 — the "I don't like this two-terminal flow" question: measured boss orchestration cost, every ruled-out option, nine verified landmines, and the "pager" leading candidate; still OPEN and undecided, so read it before re-deriving any of it), `skill-library-and-infra-handoff.md` (2026-07-05 skill library + proposed long-term infra decisions + laptop-migration checklist).
  - Working checklists: `2026-08-28-youtube-description-link-swaps.md` (DONE 2026-08-28 - all 65 videos edited via the YouTube Data API: 97 description links and 161 localized ones swapped to `go.agrolloo.com`. Kept as the record: where the pre-edit backup lives, the round-trip proof used, the 269 bot clicks the edit provoked and the `isRobot` fix, and the 5 programmes still needing a real affiliate URL).
  - Data-source references: `indian-railways-data-sources.md` (2026-08-04 — erail vs ConfirmTkt, why booking APIs hide unreserved trains, both endpoint contracts, and the MCP comparison behind `tooling/mcp/indian-railways-mcp`).
  - Testing: `voice-pipeline-test/`.
