# Plan 031: Refresh VPS-CRONS.md — stale paths, stale date, naming drift (both repo copies)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **⚠️ TWO REPOS**: `VPS-CRONS.md` is mirrored — `~/codebase/personal-stuff/VPS-CRONS.md`
> and `~/codebase/vps-crons/VPS-CRONS.md` must end up byte-identical. (The
> third copy, `/root/VPS-CRONS.md` on the VPS, is owner follow-up.)
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- VPS-CRONS.md`
> plus `diff ~/codebase/personal-stuff/VPS-CRONS.md ~/codebase/vps-crons/VPS-CRONS.md`
> (they may already diverge — if so, note WHICH lines and treat personal-stuff
> as canonical).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (docs only)
- **Depends on**: 029 (soft — if 029 landed, the runbook sections should reference vps-apply.sh; a conditional step below handles both cases)
- **Category**: docs
- **Executor**: antigravity
- **Difficulty**: mechanical
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

`VPS-CRONS.md` is the operational runbook every cron-touching session reads.
Its header says "Last updated: 2026-05-27" — since then the repo was
restructured twice (top-level regroup to `apps/`/`tooling/`; `ty/` →
`pipelines/`), and several of its concrete paths and examples predate that.
A runbook whose examples use paths that no longer exist actively misleads the
agent sessions that trust it (they'll `cd` into nowhere or scp to the wrong
target).

## Current state

`VPS-CRONS.md` (root of personal-stuff, ~20.4KB, 529 lines). Confirmed-stale
items, each with its current wording:

1. **Line 10**: `Last updated: 2026-05-27.`
2. **Repo-path-with-space examples** (pre-rename `personal stuff`):
   - ~line 264: `cd ~/codebase/personal\ stuff` (in "Adding a new cron" step 1)
   - ~line 279: `cd ~/codebase/personal\ stuff` (step 2)
   - ~line 385: `cd ~/codebase/personal\ stuff/<path>` (update-deps section)
   - ~line 412: `scp /Users/kbtg/codebase/personal\ stuff/mcp/google-shared/tokens/...`
     — BOTH the space AND the path are wrong: `mcp/` moved to `tooling/mcp/`.
3. **`mcp/google-shared` references missing the `tooling/` prefix**:
   - ~line 404-406: `python3 mcp/google-shared/setup_auth.py` and the comment
     `This writes mcp/google-shared/tokens/<email>.json`.
4. **Naming drift my-planner vs kb-daily-planner**: the "Active crons" section
   correctly names the cron `my-planner` (wrapper `/srv/crons/my-planner/run.sh`),
   but the "Repo: vps-crons" layout tree (~lines 138-143) and the "Reference:
   useful one-liners" section (~lines 517-521) still say `kb-daily-planner/`.
   The real directory in the vps-crons repo is `my-planner/` (verified by
   listing `~/codebase/vps-crons/`). The PROJECT is still called
   kb-daily-planner in its own README — only the CRON FOLDER name drifted.
5. **`some-domain/my-new-tool` scaffold examples** (~lines 265-266, 295, 325):
   the repo's placement rule is now `apps/`/`pipelines/`/`tooling/` — the
   generic `some-domain/` wording predates it. Minor: replace with
   `apps/<my-new-tool>` and add "(or pipelines/… per the placement rule in
   the repo CLAUDE.md)".
6. **`/docker/n8n/` in the VPS file-system layout** (~line 162): verify against
   `INFRA.md` — if INFRA.md no longer lists n8n on the VPS, delete the line;
   if it does, keep it. (Decided by evidence, not by this plan.)

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| No stale space-paths left | `grep -c 'personal\\\\ stuff' VPS-CRONS.md` | 0 |
| No un-prefixed mcp paths | `grep -cE '(^|[^/])mcp/google-shared' VPS-CRONS.md` | 0 |
| No stale cron-folder name | `grep -c 'kb-daily-planner/' VPS-CRONS.md` | 0 (prose mentions of the PROJECT name kb-daily-planner without a trailing slash are fine) |
| Copies identical | `diff personal-stuff/VPS-CRONS.md vps-crons/VPS-CRONS.md` | empty |

## Scope

**In scope**:
- `~/codebase/personal-stuff/VPS-CRONS.md` (canonical — edit here)
- `~/codebase/vps-crons/VPS-CRONS.md` (copy the finished file over)

**Out of scope**:
- `/root/VPS-CRONS.md` on the VPS (owner follow-up).
- `decisions.md`, historical `plans/*.md`, `docs/*` — historical records keep
  their historical names; do NOT sweep-rename `tracker-app` elsewhere.
- The `README.md` files of either repo.
- Any run.sh / crontab.

## Git workflow

- personal-stuff branch: `advisor/031-vps-crons-doc-refresh`; commit
  `docs(VPS-CRONS): refresh stale paths + names post-restructure`
- vps-crons branch: `advisor/031-doc-sync`; commit `docs: sync VPS-CRONS.md from personal-stuff`
- No AI footers. Do NOT push.

## Steps

### Step 1: Apply fixes 1–5 in personal-stuff/VPS-CRONS.md

Work through the list in "Current state": update the date line to
`Last updated: 2026-07-05.`; fix every `personal\ stuff` → `personal-stuff`;
prefix every bare `mcp/google-shared` with `tooling/`; rename the two
`kb-daily-planner/` tree/one-liner mentions to `my-planner/` (adding, in the
layout tree, a trailing comment `← project: kb-daily-planner`); modernize the
`some-domain/` scaffold examples.

**Verify**: the first three grep commands from the table → all 0.

### Step 2: Resolve the n8n line by evidence

Open `INFRA.md`, search for `n8n`. If present as a live VPS service, leave
line ~162 alone. If absent/marked decommissioned, delete the
`/docker/n8n/ ← n8n (separate concern)` line.

**Verify**: state in your report which way the evidence pointed and what you did.

### Step 3: Conditional — reference vps-apply.sh

Check whether `~/codebase/vps-crons/vps-apply.sh` exists (plan 029).
- If YES: in the "decision rule" 5-situation table and the "Common operations"
  section, add one sentence: situations 2+3 collapse to
  `ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'`.
- If NO: skip, and say so in your report.

**Verify**: `grep -c 'vps-apply' VPS-CRONS.md` → 1 if 029 landed, else 0.

### Step 4: Sync the second copy

`cp ~/codebase/personal-stuff/VPS-CRONS.md ~/codebase/vps-crons/VPS-CRONS.md`

**Verify**: `diff ~/codebase/personal-stuff/VPS-CRONS.md ~/codebase/vps-crons/VPS-CRONS.md` → empty.

## Test plan

Docs-only; the grep gates above are the tests. Additionally sanity-read the
"Adding a new cron" walkthrough top to bottom once after editing: every path
in it must exist in the repo (`apps/`, `tooling/mcp/google-shared/`,
`/srv/crons/_template` naming) — report any OTHER stale path you notice
without fixing beyond the listed items (new findings go in your report).

## Done criteria

- [ ] All grep gates green (see Commands table)
- [ ] Date line = 2026-07-05
- [ ] n8n line resolved by INFRA.md evidence (either way, reported)
- [ ] Both repo copies byte-identical
- [ ] `git status` in both repos clean outside VPS-CRONS.md (plus plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The two repo copies already diverge in ways beyond the listed stale items
  (someone edited the vps-crons copy directly) — report the diff, don't merge
  blind.
- A listed line number's content doesn't match its quoted wording (the file
  shifted) — re-locate by grep; if the wording itself is gone, skip that item
  and report.

## Maintenance notes

- **Owner follow-up:** after merge+push of both repos, refresh the VPS copy:
  `scp ~/codebase/personal-stuff/VPS-CRONS.md root@72.61.241.170:/root/VPS-CRONS.md`.
- The three-copy mirror is inherently drift-prone; if it drifts again,
  consider making the vps-crons copy a one-line pointer file instead of a
  mirror (owner decision, out of scope here).
