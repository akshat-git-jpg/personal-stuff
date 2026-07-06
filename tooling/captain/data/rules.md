# Routing rules

Task shape → lane + model. Checked during intake (CLAUDE.md section 3)
before falling back to propose-and-confirm. A confirmed novel routing gets
appended here by the captain — append-only, most-specific rule wins.

| Task shape | Lane | Model | Notes |
|---|---|---|---|
| plan-batch (an existing `plans/NNN-*.md` to execute) | antigravity | — | plan already reviewed; pass `--skip review` to greenlight on land |
| scout / research (no code change, produces a report) | claude-headless | sonnet | writes `data/<id>/report.md`, nothing lands |
| bug-fix worker (focused, few files, clear scope) | claude-headless | sonnet | confirmed 2026-07-06; headless keeps it parallel + deterministic |
| Hyperframes card-library card (add/rename/edit a `pipelines/video/card-library/**` card) | claude-headless | sonnet | confirmed 2026-07-06; focused single-area file work, verify via `npx hyperframes lint` + structure asserts; lands via greenlight |
