# Plan 030: skills-status.sh — per-account skills table + dangling-symlink detector

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- scripts/ tooling/claude-skills/manifest/`
> On drift in `scripts/lib/skill-link.sh` or the manifests' format, compare
> against the excerpts below; mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (new read-only script; no existing file's behavior changes)
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

Two related gaps, one read-only tool:

1. **No visibility**: the owner has no single view of which skill is linked
   into which Claude account (work / personal / both) and where each resolves
   from. Answering "is X installed on personal?" means reading two manifest
   files and ls-ing two symlink farms by hand.
2. **No drift detection**: `relink.sh` creates ABSOLUTE-path symlinks in
   `~/.claude-work/skills` and `~/.claude-personal/skills`. After a repo
   move/rename, every link dangles and skills silently vanish from Claude —
   nothing detects it (`scripts/README.md` explicitly warns you must remember
   to re-run relink).

After this plan: `./scripts/skills-status.sh` prints a markdown table —
skill × (work, personal) with source and link health — and exits non-zero if
any manifest entry can't resolve or any managed symlink dangles, so it doubles
as the drift check.

## Current state

- `tooling/claude-skills/manifest/work.txt` and `personal.txt` — one skill
  name per line, `#`-prefixed comment lines allowed, blank lines allowed.
  (This is exactly how `scripts/lib/skill-link.sh` parses them:
  `case "$name" in \#*) continue ;; esac`.)
- `scripts/lib/skill-link.sh` — shared lib sourced by relink.sh/vps-sync.sh.
  Its source-resolution rule (reuse this logic, copied here):

  ```bash
  resolve_src() {
    local name="$1"
    if   [ -d "$store/$name" ];      then echo "$store/$name"
    elif [ -d "$agents_dir/$name" ]; then echo "$agents_dir/$name"
    else return 1; fi
  }
  ```

  where `store=tooling/claude-skills` (resolved relative to the script) and
  `agents_dir=$HOME/.agents/skills` (printing-press pp-* skills live there).
- `scripts/relink.sh` — computes:
  `WORK_DIR="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/skills"`,
  `PERS_DIR="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/skills"`.
  Match these env-override conventions.
- A symlink is "managed" when its target lies under the store or agents dir
  (see `is_managed()` in skill-link.sh). Non-managed entries (e.g. plugin
  dirs) are none of this script's business.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `bash -n scripts/skills-status.sh` | exit 0 |
| Run | `./scripts/skills-status.sh` | table + exit 0 (healthy farm) |
| Drift simulation | see Test plan | exit 1 + the broken row marked |

## Scope

**In scope**:
- `scripts/skills-status.sh` (create)
- `scripts/README.md` (one line in the "Scripts here" list)

**Out of scope**:
- `scripts/relink.sh`, `scripts/lib/skill-link.sh`, `scripts/vps-sync.sh` — do
  NOT modify (the status script is standalone so it can never break linking).
- The manifests and any skill folder.
- `~/.claude-work` / `~/.claude-personal` contents (READ-only — the script
  must not create, delete, or repair anything).

## Git workflow

- Branch: `advisor/030-skills-status`
- Commit: `feat(scripts): skills-status.sh — account membership table + dangling-link check` — no AI footers. Do NOT push.

## Steps

### Step 1: Write `scripts/skills-status.sh`

Requirements (`set -uo pipefail`, no `-e`; strictly read-only):

- Resolve `STORE`, `WORK_DIR`, `PERS_DIR`, `AGENTS_DIR` exactly as relink.sh
  does (same env overrides, paths relative to the script's own location).
- Build the skill universe: union of names from both manifests (skip blank
  and `#` lines).
- For each skill, compute per account (work, personal):
  - `both|work|personal` membership from the manifests;
  - link state in that account's dir: `ok` (symlink exists AND its target
    directory exists) / `DANGLING` (symlink exists, target gone) /
    `MISSING` (in manifest but no symlink) / `-` (not in this account's manifest);
  - source: `store` / `agents` / `UNRESOLVED` via the resolve_src rule above.
- Output a markdown table sorted by skill name:

  ```
  | Skill | Accounts | Work link | Personal link | Source |
  |---|---|---|---|---|
  | commit-now | both | ok | ok | store |
  | improve | work | ok | - | store |
  ```

  followed by a summary line: `N skills — X both / Y work-only / Z personal-only; problems: <count>`.
- Also scan each account dir for MANAGED symlinks (target under store or
  agents dir) whose name is NOT in that account's manifest, or whose target is
  gone — report them under a `## Strays / dangling` section. Ignore
  non-managed entries entirely.
- Exit 0 when zero problems (no DANGLING/MISSING/UNRESOLVED/strays);
  exit 1 otherwise.

**Verify**: `bash -n scripts/skills-status.sh` → exit 0.

### Step 2: Run it against the real farm

**Verify**: `./scripts/skills-status.sh; echo "exit=$?"` → a table whose row
count equals `sort -u` of both manifests' non-comment lines, membership counts
that add up, and (expected on a healthy machine) `exit=0`. If it exits 1,
inspect: a REAL problem found is a valid outcome — report it in your summary
rather than "fixing" the script to hide it (but first triple-check the
detection isn't a bug, e.g. plugin symlinks misclassified as managed).

### Step 3: Drift-detection test (sandboxed, no real farm changes)

Point the script at a fake account dir via the env overrides:

```bash
FAKE="$(mktemp -d)"; mkdir -p "$FAKE/skills"
ln -s /nonexistent-target-dir "$FAKE/skills/broken-skill" 2>/dev/null || true
CLAUDE_WORK_CONFIG_DIR="$FAKE" ./scripts/skills-status.sh; echo "exit=$?"
rm -rf "$FAKE"
```

Expected: every work-manifest skill shows `MISSING` for the work link, exit 1.
(The `/nonexistent-target-dir` link is NOT managed — it must be ignored, not
listed as a stray. If your is_managed logic lists it, fix the classification.)

**Verify**: output + exit code as described.

### Step 4: Register in scripts/README.md

Add one line: `skills-status.sh — read-only: markdown table of every skill's
account membership (work/personal/both), symlink health, and source
(store/agents); exit 1 on any dangling/missing/unresolved link. Run it when a
skill seems absent or after moving the repo (then fix with relink.sh).`

**Verify**: `grep -c 'skills-status' scripts/README.md` → ≥ 1.

## Test plan

Steps 2 and 3 are the tests (real-farm truth + synthetic drift). Also confirm
read-only-ness: `ls -la ~/.claude-work/skills | md5` before and after Step 2
runs must be identical.

## Done criteria

- [ ] `./scripts/skills-status.sh` prints the full table; healthy farm → exit 0
- [ ] Synthetic drift (Step 3) → MISSING rows + exit 1; unmanaged link ignored
- [ ] Farm dirs byte-identical before/after (read-only proof)
- [ ] `scripts/README.md` row added
- [ ] `git status` clean outside the two files (plus plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The manifests' format differs from "one name per line + # comments".
- `scripts/lib/skill-link.sh` no longer contains the resolve/managed rules
  excerpted above (logic has moved — mirror the NEW rules or report).
- You find yourself wanting to make the script FIX anything — that is
  relink.sh's job; this script only reports.

## Maintenance notes

- Candidate follow-up (not in this plan): call `skills-status.sh` from
  `check-apps.sh` so the baseline catches farm drift too.
- If a third account is ever added, the script needs a third column — the
  manifest-driven design makes that a small diff.
- The VPS has its own single-account farm (`vps-sync.sh`); this script is
  Mac-only by scope. Point Remote-Control debugging at `vps-sync.sh` logs.
