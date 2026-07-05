# Plan 026: Stop auto-loading README.md into every session — CLAUDE.md stands alone

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- CLAUDE.md README.md`
> NOTE: README.md and CLAUDE.md HAVE uncommitted edits from 2026-07-05 (the
> `tracker-app` → `tutorial-tracker-app` rename). That drift is expected —
> work from the CURRENT working-tree content. Any OTHER structural drift
> (sections missing vs the excerpts below) = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: mechanical
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

Root `CLAUDE.md` (~4.0KB) ends with `@README.md`, which inlines the ~5.8KB
README into **every Claude Code session** in this repo. The two files describe
the same repo structure twice: CLAUDE.md's "Find it fast" intent table routes
to every location, and README's "The map" re-enumerates the same folders as
prose. A session pays ~2.4K tokens for both when the intent table alone does
the routing job — the README's per-app one-liners are for humans orienting
from scratch, and Claude can open README on demand via the existing route row
("A specific app → apps/<name>/ — full list in the README map").

After this plan: CLAUDE.md no longer imports README.md; it carries a one-line
pointer instead. Per-session fixed load drops by ~5.8KB (~1.4K tokens).
README.md itself is NOT slimmed — it remains the human-facing map.

## Current state

`CLAUDE.md` (working tree) — relevant parts:

- Header: `# personal-stuff — Claude Code guide` followed by
  `The full repo map, what-runs-where, and conventions live in the README, imported below.`
- `## How to operate here (read first)` — 4 numbered rules.
- `## Find it fast (route by intent)` — the routing table (rows for
  decisions.md, INFRA.md, VPS-CRONS.md, my-hosted-sites.md, context/, skills,
  CLI tools, MCP, apps, pipelines, docs/, plans/, infra, DSA, scripts).
- The line `@README.md` (the import to remove — it sits on its own line after
  the routing table section).
- `## Where does a new thing go?` and `## Operating notes` sections.

`README.md` (working tree) — `# personal-stuff` intro, `## The map` with
`### tooling/`, `### apps/` (13 app one-liners), `### infra/`, `### learning/`,
`### Top level`, then `## Related` and `## Conventions`. Untouched by this plan.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Import gone | `grep -c '@README.md' CLAUDE.md` | `0` |
| Size check | `wc -c CLAUDE.md` | ≤ 4,300 bytes |
| README untouched | `git diff --stat -- README.md` | no NEW changes beyond the pre-existing uncommitted rename edits |

## Scope

**In scope**:
- `CLAUDE.md` (root) — remove the import, adjust two sentences.

**Out of scope**:
- `README.md` — zero edits.
- All folder-level CLAUDE.md files.
- `~/.claude-work/CLAUDE.md` (global, outside the repo).

## Git workflow

- Branch: `advisor/026-claude-md-dedup`
- Commit: `docs: stop importing README into every session; CLAUDE.md routes, README orients` — no AI footers. Do NOT push.
- NOTE: README.md + CLAUDE.md already carry uncommitted rename edits made by
  the owner. Commit ONLY your own CLAUDE.md hunks: stage with
  `git add -p CLAUDE.md` and leave the owner's rename hunks unstaged if they
  are in the same file — if the hunks are inseparable, STOP and report.

## Steps

### Step 1: Remove the import and fix the header sentence

In root `CLAUDE.md`:

1. Delete the line `@README.md`.
2. Change the header sentence
   `The full repo map, what-runs-where, and conventions live in the README, imported below.`
   to
   `Routing lives in the table below. The human-facing repo map (per-app one-liners, conventions) is in [README.md](README.md) — open it only when you need the full inventory.`

**Verify**: `grep -c '@README.md' CLAUDE.md` → `0`

### Step 2: Sanity-check that nothing else referenced the import

**Verify**: `grep -n 'imported below\|imported above' CLAUDE.md` → no matches.

### Step 3: Size + content check

**Verify**: `wc -c CLAUDE.md` → ≤ 4,300 bytes, AND the "Find it fast" table
still contains a row routing to apps (`grep -c 'A specific app' CLAUDE.md` → 1).

## Test plan

Manual: open a NEW Claude Code session in this repo after the change (owner
step, post-merge). In-plan proxy: the three verify commands above, plus
`git diff CLAUDE.md` reviewed to confirm only the two edits above.

## Done criteria

- [ ] `@README.md` import removed; pointer sentence in place
- [ ] `wc -c CLAUDE.md` ≤ 4,300
- [ ] README.md has no new modifications from this plan
- [ ] Only your two CLAUDE.md hunks are committed
- [ ] `plans/README.md` status row updated

## STOP conditions

- CLAUDE.md no longer contains an `@README.md` line (someone already did this).
- Your edits and the owner's uncommitted rename edits collide in the same
  hunks and can't be staged separately.

## Maintenance notes

- If a future session repeatedly needs the app inventory, the fix is a
  COMPACT app list row in the routing table, not re-importing the README.
- The same dedup lens applies if anyone adds new `@`-imports to CLAUDE.md:
  every imported byte is a per-session tax.
