# pinterest — Claude Code guide

The per-niche Pinterest PDF business (keto, wedding). One folder per niche; shared playbooks at this level.

## Which doc to read

- [`PLAN.md`](PLAN.md) — strategy roadmap (Phase 1/2/3). Start here for the big picture.
- [`WORKFLOW.md`](WORKFLOW.md) — the repeatable execution checklist per niche. Use this when actually posting.
- [`PINTEREST-PRINCIPLES.md`](PINTEREST-PRINCIPLES.md) — style/tone decision rules (contractions, emojis, titles).
- [`NICHE-RESEARCH.md`](NICHE-RESEARCH.md) — research method + findings log for picking/validating niches.
- [`BRAND-SETUP.md`](BRAND-SETUP.md) — domain + email operational runbook for standing up a new niche.

## Layout

- `<niche>/` (e.g. `keto/`, `wedding/`) — `config.json`, `playbook.md`, `posts/<slug>/`, and for wedding, `products/`.
- `landing-pages/` — per-niche assets-only Cloudflare Workers (`<niche>.agrolloo.com`). One folder per niche.

The pin-generation logic lives in the **personal-stuff** repo as skills (`pinterest-make-post`, `pinterest-research`, `pinterest-analyze`, `pinterest-board`), not here. This folder is data + playbooks.
