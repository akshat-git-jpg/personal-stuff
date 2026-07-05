# Plan 028: Trim apps/tutorial-tracker-app/CLAUDE.md — current operating guide inline, superseded history out

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- apps/tutorial-tracker-app/CLAUDE.md`
> On drift, compare the section inventory below against the live file;
> mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (removing the wrong content degrades every future agent session in this app — the keep/move boundaries below are exact; do not deviate)
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

`apps/tutorial-tracker-app/CLAUDE.md` is 23,835 bytes (~6K tokens) and
auto-loads whenever Claude works in that folder. Nearly half of it describes
the **pre-2026-06-30 architecture** that the file's own "READ FIRST" banner
says is "kept only for history": the old hardcoded `STAGES` pipeline, the
retired Google Sheets backend, a file map listing superseded legacy modules as
if current, and a roadmap whose items are almost all shipped. Every agent
session in this app starts ~6K tokens in the hole, and worse, the historical
sections actively contradict the engine sections (e.g. "single source of
truth: `src/shared/pipeline.ts`" vs the engine's `definitions/`).

After this plan: CLAUDE.md keeps only the current operating guide (~10KB);
the historical material moves verbatim to `apps/tutorial-tracker-app/HISTORY.md`
(linked, loaded only on demand). No information is deleted.

## Current state

Section inventory of `apps/tutorial-tracker-app/CLAUDE.md` at `671741e`
(line numbers from the current file):

| Lines | Section | Disposition |
|---|---|---|
| 1–7 | Title + deployed-status banner | KEEP |
| 9–21 | `## ⚠️ READ FIRST — config-driven pipeline engine` | KEEP (this is the real guide) |
| 24–32 | `## Stack & where it runs` | KEEP |
| 35–52 | `## The pipeline (single source of truth: src/shared/pipeline.ts)` | MOVE — describes the pre-engine design the READ FIRST banner supersedes |
| 54–69 | `## Roles & RBAC` | CONDENSE (see Step 2) — mixes current truths with pre-engine mechanics |
| 73–85 | `## The Google Sheet (fallback backend)` | MOVE — the banner at line 5 says the Sheets fallback was REMOVED |
| 88–127 | `## File map` | MOVE — lists legacy `pipeline.ts`/`policy.ts` as "SINGLE SOURCE OF TRUTH"; contradicts the engine section |
| 129–140 | `## API (all behind a session...)` | KEEP (current worker routes) |
| 142–144 | `## Notifications (email)` | KEEP |
| 148–170 | `## Run locally` + `### ⚠️ Gotchas` | KEEP |
| 172–179 | `## Deploy (only on owner's "final")` | KEEP |
| 181–183 | `## Roadmap (from the product audit...)` | MOVE — one long "Done:" list + a "Next:" line; historical record |
| 185–188 | `## Access / onboarding` | KEEP |

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Size after | `wc -c apps/tutorial-tracker-app/CLAUDE.md` | ≤ 12,000 bytes |
| Nothing deleted | `wc -c apps/tutorial-tracker-app/CLAUDE.md apps/tutorial-tracker-app/HISTORY.md` | combined ≥ 23,000 bytes |
| App still verifies | `cd apps/tutorial-tracker-app && npm run typecheck && npm test` | exit 0 (docs-only change — this is a canary that you touched nothing else) |

## Scope

**In scope**:
- `apps/tutorial-tracker-app/CLAUDE.md`
- `apps/tutorial-tracker-app/HISTORY.md` (create)

**Out of scope**:
- `apps/tutorial-tracker-app/README.md`, `LOCAL-DEV.md`, and all source files.
- Root `CLAUDE.md` / `README.md`.

## Git workflow

- Branch: `advisor/028-tracker-claude-md-trim`
- Commit: `docs(tutorial-tracker-app): CLAUDE.md = current engine guide; pre-engine history to HISTORY.md` — no AI footers. Do NOT push.

## Steps

### Step 1: Create HISTORY.md and move the four MOVE sections verbatim

Create `apps/tutorial-tracker-app/HISTORY.md` with this header:

```markdown
# Tutorials Tracker — pre-engine history (superseded)

Everything below describes the app BEFORE the 2026-06-30 pipeline-engine
refactor and the D1 cutover. It is kept for archaeology only — the current
architecture is in [CLAUDE.md](CLAUDE.md)'s READ FIRST section. Do not follow
anything here when changing code.
```

Then move (cut from CLAUDE.md, paste unchanged) the four MOVE sections from
the inventory table: "The pipeline (single source of truth:
src/shared/pipeline.ts)", "The Google Sheet (fallback backend)", "File map",
and "Roadmap".

**Verify**: `grep -c 'src/shared/pipeline.ts' apps/tutorial-tracker-app/CLAUDE.md`
→ 0 or 1 (only permissible remaining mention is inside the READ FIRST legacy
warning bullet), AND `grep -c '## File map' apps/tutorial-tracker-app/HISTORY.md` → 1.

### Step 2: Condense "Roles & RBAC" in place

Replace the current 16-line `## Roles & RBAC` section with this exact
replacement (it preserves the still-true facts and drops the pre-engine
mechanics that `src/shared/engine/rbac.ts` superseded):

```markdown
## Roles & RBAC (current — engine-backed)

- Roles derive from the pipeline defs (`allRoles()` in the engine registry):
  stage-owner roles + cross-cutting `Reviewer` + `Admin`. Multi-role = union.
  People/roles are managed ONLY in the admin **Team** tab (D1 `employees`,
  membership-grained per system); resolved live on every request.
- **Single enforcement point:** `authorizeWrite(...)` in
  `src/shared/engine/rbac.ts` is the only authorization the worker calls;
  its `{ok, reason}` reason string becomes the UI lock tooltip.
- Everything is **enforced server-side**: restricted columns never leave the
  Worker, and each board row carries `_stages`/`_actions`/`_locks` so the
  client never re-derives permissions (admin "view as" can't diverge).
- Review is per-stage and optional: blank stage reviewer ⇒ submit goes
  straight to Done. Doers move To Do→In Progress→In Review; only the stage's
  reviewer (never on their own submission) sets Done / Need Changes, and
  Need Changes always writes feedback atomically.
```

**Verify**: `grep -c 'engine-backed' apps/tutorial-tracker-app/CLAUDE.md` → 1.

### Step 3: Link the history from the READ FIRST section

In the READ FIRST section, append one bullet:
`- **Pre-engine history** (old STAGES pipeline, Sheets backend, legacy file map, shipped roadmap): [HISTORY.md](HISTORY.md). Never code against it.`

**Verify**: `grep -c 'HISTORY.md' apps/tutorial-tracker-app/CLAUDE.md` → ≥ 1.

### Step 4: Size + canary checks

**Verify**:
- `wc -c apps/tutorial-tracker-app/CLAUDE.md` → ≤ 12,000
- combined `wc -c` of CLAUDE.md + HISTORY.md → ≥ 23,000
- `cd apps/tutorial-tracker-app && npm run typecheck && npm test` → exit 0
- `git status` → only CLAUDE.md modified + HISTORY.md added (plus `plans/README.md`)

## Test plan

Docs-only. The heading-inventory check is the test: save
`grep -E '^#{1,3} ' CLAUDE.md` before starting; after the change, the union of
headings across CLAUDE.md + HISTORY.md must equal the saved list (plus the new
HISTORY.md title, minus nothing). Run it and include the diff (should be
empty) in your report.

## Done criteria

- [ ] CLAUDE.md ≤ 12KB; KEEP sections all present; MOVE sections all gone from it
- [ ] HISTORY.md contains the four moved sections verbatim under the superseded banner
- [ ] Roles & RBAC replaced with the engine-backed version above
- [ ] Heading-union check passes (no heading lost)
- [ ] typecheck + test still green; git status clean outside the two files (plus plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The live section inventory (headings/line ranges) doesn't match the table above.
- Any KEEP section would need edits beyond the two specified (Step 2 replacement,
  Step 3 bullet) — report instead of improvising.
- `HISTORY.md` already exists.

## Maintenance notes

- When the legacy modules (`src/shared/{pipeline,control,rbac,policy,lifecycle}.ts`)
  are finally deleted (backlog item TRK-04), HISTORY.md is where their
  description already lives — nothing further to move.
- Reviewer should spot-check that the condensed RBAC section matches
  `src/shared/engine/rbac.ts` reality at review time.
