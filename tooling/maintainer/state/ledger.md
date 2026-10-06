# Maintainer ledger

One line per job run. `proposed` is what the agent found worth raising; `approved` is what
the owner said yes to. A declined item is kept on purpose — it stops the next run proposing
it again.

| date | job | proposed | approved | applied |
|---|---|---|---|---|
| 2026-08-25 | skills | 5 | 5 | archived plan-review, roast, research-critic, scout; improve promoted to job 11 |
| 2026-08-25 | skills | 2 | 2 | archived valyu-best-practices; video-and-tts-reference promoted to pipelines/video/CLAUDE.md |
| 2026-08-25 | skills | 5 | 5 | archived media-board + 4 pinterest skills; pipelines/pinterest -> pipelines/archive/ |
| 2026-09-15 | skills | 3 | 1 (fix only) | check.sh: dup loop off the pipe; reference count now sees peer-skill refs (10 false -> 3 real) |
| 2026-09-15 | memory | 4 | 2 (fix only) | check.sh: resolve_slug replaces the lossy sed (24 false -> 3 real); empty memory dirs no longer counted as stores |
| 2026-09-15 | memory | 11 | 11 (all) | dashboard-api store 31 -> 21: 5 landed-work notes archived, 5 preferences promoted to ~/.claude-work/CLAUDE.md, beta-flag note rewritten (its rolling PR had merged), 16 wiki-links repaired |
| 2026-10-06 | skills | ~120 (95 skills vs Anthropic skill guide) | all A-E | feature-deploy 2072->387, orchestrate/humanizer/ui-testing split, printing-press resynced from upstream, yt-income PII moved to gitignored data, 14 descriptions trimmed, guard hooks added; F open: GUARD_OK, history rewrite, synced allowlist |
