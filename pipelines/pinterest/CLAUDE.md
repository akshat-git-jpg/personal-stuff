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

## The Pinterest CLI + MCP (built 2026-06-02, currently idle)

A Go CLI and MCP generated with the `printing-press` skill. **Neither this folder's docs nor the
skills mention it**, which is how it went unused — recorded here 2026-08-24 so it is findable.

- **Source / library:** `~/printing-press/library/pinterest/` — slug `pinterest`, binary
  `pinterest-pp-cli`, MCP `pinterest-pp-mcp`.
- **Ready-to-run multi-account folder:** `~/yt-claude/pinterest-mcp/` — a `pin` wrapper,
  `gen-mcp-config.sh`, `SETUP.md`, and `accounts.conf` (gitignored, holds tokens). It lives under
  `~/yt-claude` for historical reasons only; nothing ties it to the transcript workflow there.
- **Account model:** one read-only *research* account (Claude reads curated niche boards for
  inspiration) plus N read+write *posting* accounts, one per niche. Each account gets an isolated
  SQLite store via the `PINTEREST_DB` env override, and one MCP instance named `pinterest-<name>`.

Build facts worth not rediscovering:

- Generated from Pinterest's official `pinterest/api-description` OpenAPI v5, trimmed to the
  **organic** subset — 46 operations across pins, boards, sections, media, user_account, analytics,
  search, terms and trends. Ads and business endpoints were excluded deliberately.
- Auth is OAuth2 via `PINTEREST_ACCESS_TOKEN` (manifest auth type `bearer_token`). Each account
  needs its own Pinterest **business** account and developer app.
- The MCP uses thin `search` + `execute` orchestration, giving 34 tools per instance so the tool
  count stays manageable across many accounts.
- Eight hand-written commands beyond the generated surface: `publish`, `insights efficiency`,
  `insights momentum`, `boards audit`, `posted since`, `pins remix-candidates`, `report compare`,
  `pins find`.
- A generator template bug was fixed in place: typed `boards_pins`/`sections` upsert failed
  `boards_id NOT NULL` because Pinterest child resources carry the parent id as `parent_id`. Fixed
  with `coalesceFieldValue`. **The retro was never filed upstream** — worth doing before any
  `printing-press-reprint`.

**State as of 2026-08-24:** built and graded A (94/100), all shipcheck legs passed, promoted to the
library, and registered as an MCP in the work account. `accounts.conf` has not been touched since
the day it was created, so nothing has actually run through it. Before using it, confirm the
Pinterest business accounts and tokens exist.
