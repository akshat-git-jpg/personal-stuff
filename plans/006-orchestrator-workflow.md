# Plan 006: Formalize the orchestrator→executor workflow (plans/ convention)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- CLAUDE.md plans/ decisions.md`
> The `plans/` directory is NEW at planning time (this file is part of its
> first commit) — drift there is expected; only CLAUDE.md drift is a STOP signal.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 002 (adds the `plans/` row to the root map — if 002 hasn't run, add that one row yourself as part of Step 2)
- **Category**: dx / direction
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

The owner's working model is: an expensive high-ceiling model (Opus/Fable in
Claude Code) does audit/design/planning and review; cheaper executors
(Antigravity et al.) implement. This split already exists ad hoc — the
Devsplainers video pipeline literally names its steps by model
(`ty/ai-video-production/Devsplainers/hyperframes/steps/010-write-script-claude/`,
`.../120-build-static-scenes-antigravity/`) — and the `plans/` directory this
file lives in is its first repo-wide use. This plan makes the convention
durable and discoverable so every future improvement cycle reuses it instead
of reinventing it: a template, a lifecycle, and a routing entry.

## Current state

- `plans/` exists (created 2026-07-04 by an audit session) containing
  `README.md` (index with status table + backlog) and plans 001–007. Read
  `plans/README.md` first — its structure is the thing you're formalizing.
- Root `CLAUDE.md` has a "Find it fast" intent table; Plan 002 adds a
  `plans/` row to it. Its "How to operate here" section has 3 numbered rules.
- `/decisions.md` — append-only log, `YYYY-MM-DD — <decision> — <why>`.
- Evidence of the existing pattern to reference (do not modify it):
  `ty/ai-video-production/Devsplainers/hyperframes/steps/` — numbered steps
  with per-model ownership in the folder names.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Link check | `[ -f plans/_TEMPLATE.md ] && [ -f plans/WORKFLOW.md ] && echo OK` | OK |
| Map check | `grep -n "plans/" CLAUDE.md` | ≥ 1 row |

## Scope

**In scope**:
- Create `plans/WORKFLOW.md` and `plans/_TEMPLATE.md`
- `plans/README.md` — add a one-line pointer to WORKFLOW.md at the top
- `/CLAUDE.md` — one routing row (if 002 didn't already add it) + one operating rule
- `/decisions.md` — append one line

**Out of scope**:
- The Devsplainers pipeline (reference it, don't touch it).
- Any tooling/skill changes; no automation, no scripts. This is a paper convention.
- Rewriting existing plans 001–007 to match the template (they already do — they came from the same source).

## Git workflow

- Branch: `advisor/006-orchestrator-workflow`
- Commit: `docs(plans): formalize orchestrator→executor workflow` — no AI footers. Do NOT push.

## Steps

### Step 1: Write `plans/WORKFLOW.md`

Content to produce (~40 lines, write it in the repo's plain, terse doc voice —
mirror the tone of `scripts/README.md`):

1. **The split**: orchestrator (expensive model: Opus/Fable in Claude Code)
   audits, decides, writes plans, reviews diffs; executor (cheaper
   model/agent: Antigravity, Sonnet, etc.) implements exactly one plan at a
   time. Plans must be executable with **zero context** beyond the plan file
   and the repo.
2. **Lifecycle**: finding → plan file (`NNN-slug.md`, next free number, from
   `_TEMPLATE.md`) → row in README status table (`TODO`) → executor runs it
   (`IN PROGRESS`) → executor updates row (`DONE` / `BLOCKED: reason`) →
   orchestrator (or owner) reviews the diff against the plan's Done criteria
   before merging. `REJECTED: reason` closes a plan without work.
3. **Rules for executors** (verbatim list): run the drift check first; run
   every verification; never touch out-of-scope files; STOP conditions beat
   improvisation; report what you did, including failures, plainly.
4. **Rules for orchestrators**: every plan self-contained (excerpts inlined,
   commands exact); no plan without a verification story; record rejected
   findings in README's backlog so they aren't re-audited.
5. **Where plans come from**: any audit (e.g. the `/improve` skill), a design
   session, or the owner directly. One plan = one reviewable unit of work.

**Verify**: file exists; every claim in it about file locations is true
(`ls plans/_TEMPLATE.md plans/README.md`).

### Step 2: Write `plans/_TEMPLATE.md`

A skeleton matching the structure of plans 001–005 (read `plans/001-*.md` for
the shape): the executor-instructions blockquote (with drift-check line),
Status block (Priority/Effort/Risk/Depends on/Category/Planned at), Why this
matters, Current state, Commands you will need, Scope (in/out), Git workflow,
Steps (each with **Verify**), Test plan, Done criteria (checkboxes), STOP
conditions, Maintenance notes. Use `<angle-bracket placeholders>` for every
fillable field.

**Verify**: `grep -c "Verify" plans/_TEMPLATE.md` → ≥ 2; the template's section
headings match plan 001's headings (`grep '^## ' plans/001-restore-dashboard-auth.md` vs the template).

### Step 3: Wire it into the router

- If `CLAUDE.md`'s table lacks a `plans/` row (Plan 002 adds one), add:
  `| Implementation plans for executor agents (write or run one) | plans/README.md — convention in plans/WORKFLOW.md |`
  Otherwise extend 002's row to mention `WORKFLOW.md`.
- Add operating rule 4 to the "How to operate here" numbered list:
  `4. **Multi-step implementation work gets a plan file** — write it with plans/_TEMPLATE.md into plans/, register it in plans/README.md, and let an executor run it. Don't hand a chat transcript to another model.`
- Top of `plans/README.md`: add `> Convention: see [WORKFLOW.md](WORKFLOW.md). New plans start from [_TEMPLATE.md](_TEMPLATE.md).`

**Verify**: `grep -n "WORKFLOW.md" CLAUDE.md plans/README.md` → ≥ 2 hits total.

### Step 4: Record the decision

Append to `/decisions.md`:
`2026-07-04 — repo-wide orchestrator→executor convention: expensive model writes self-contained plans into plans/ (template + lifecycle in plans/WORKFLOW.md), cheaper models execute, orchestrator reviews — generalizes the per-model step split already proven in the Devsplainers pipeline.`

**Verify**: `head -8 decisions.md` shows it.

## Test plan

Docs-only. The acceptance test: hand `plans/_TEMPLATE.md` + `plans/WORKFLOW.md`
to a person (or model) who has never seen this session and ask "how do I get a
change implemented in this repo?" — the two files must answer it end to end.
Do a self-review pass against that bar and note any gap you had to fix.

## Done criteria

- [ ] `plans/WORKFLOW.md` + `plans/_TEMPLATE.md` exist with the content above
- [ ] Template headings match the shipped plans' headings
- [ ] Root CLAUDE.md routes to plans/ and has operating rule 4
- [ ] `plans/README.md` points at both files
- [ ] decisions.md appended; own status row updated to DONE

## STOP conditions

- `plans/README.md` doesn't exist or has a different structure than described
  (the plans/ dir was reorganized since planning) — reconcile with what's
  there, don't overwrite it.
- Root CLAUDE.md's numbered operating list has been restructured (drift).

## Maintenance notes

- When the owner's `/improve`-style audits run again, they should reconcile
  with `plans/README.md` (keep numbering monotonic, skip rejected findings) —
  WORKFLOW.md's orchestrator rules encode that.
- If plans accumulate (>~15 files), add an `archive/` subfolder for DONE plans
  — deferred until it hurts.
