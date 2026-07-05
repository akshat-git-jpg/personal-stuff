# Plan 029: vps-apply.sh — one command to apply cron changes on the VPS

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md` (in personal-stuff).
>
> **⚠️ WORKING REPO**: all edits in `~/codebase/vps-crons` except the status
> row. Confirm clean: `git -C ~/codebase/vps-crons status --short` (only
> plan-025/027 branches' merged state or clean main is acceptable — if other
> unrelated changes are present, STOP).
>
> **Drift check (run first)**: confirm `~/codebase/vps-crons/crontab.txt`
> exists and `VPS-CRONS.md` (either repo copy) still documents the 5-situation
> SSH matrix.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (the script touches the live crontab when run on the VPS — mitigated by diff-before-apply + a --dry-run default posture; the executor only ever runs it in dry-run on the Mac)
- **Depends on**: none (composes with 025/027 but needs neither)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: personal-stuff commit `671741e`, 2026-07-05

## Why this matters

Applying any cron change today is a remembered SSH runbook (`VPS-CRONS.md`
documents 5 situations): pull both repos, reinstall venvs whose
`requirements.txt` changed, `crontab /srv/crons/crontab.txt`, verify with
`crontab -l`. Two silent failure modes: forgetting the `crontab` reload (the
edited crontab.txt never takes effect — cron only reloads when told) and
forgetting the pip reinstall (a cron runs against stale deps). One committed
script collapses the common cases to a single command run on the VPS.

## Current state

- `~/codebase/vps-crons/crontab.txt` — canonical cron table; comment header
  says: edit here, commit, then on the VPS `crontab /srv/crons/crontab.txt`.
- VPS layout (from `VPS-CRONS.md`): `/srv/crons/` = clone of vps-crons,
  `/srv/projects/personal-stuff/` = clone of personal-stuff (read-only key).
  Python projects keep a `.venv/` NEXT TO their code inside the personal-stuff
  clone, each with its own `requirements.txt` (e.g.
  `apps/telegram-my-planner/tools/daily-digest/`).
- There is no state file tracking "last applied" anything.
- The script must be runnable (dry) on the Mac where `/srv/` doesn't exist —
  paths must be overridable via env for that.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `bash -n ~/codebase/vps-crons/vps-apply.sh` | exit 0 |
| Mac dry-run | see Test plan (uses env overrides + a temp sandbox) | correct plan printed, nothing executed |

## Scope

**In scope** (vps-crons):
- `vps-apply.sh` (create, repo root)
- `README.md` (document it; adjust the "how to apply changes" prose to point at it)

**In scope** (personal-stuff):
- `plans/README.md` (status row only)

**Out of scope**:
- Running it against the real VPS (owner follow-up).
- `crontab.txt` content, wrappers, `_shared/`.
- personal-stuff `VPS-CRONS.md` (plan 031 will point its runbook at this script).

## Git workflow

- Repo `~/codebase/vps-crons`; branch: `advisor/029-vps-apply`
- Commit: `feat: vps-apply.sh — pull repos, reinstall changed venvs, reload + verify crontab` — no AI footers. Do NOT push.

## Steps

### Step 1: Write `vps-apply.sh`

Contract (write clean bash, `set -euo pipefail`):

```
Usage: ./vps-apply.sh [--dry-run]
Env overrides (for testing off-VPS): CRONS_DIR (default /srv/crons),
PROJECT_REPO (default /srv/projects/personal-stuff)
```

Behavior, in order:

1. **Pull both repos.** `git -C "$CRONS_DIR" pull --ff-only` and
   `git -C "$PROJECT_REPO" pull --ff-only`. Record each repo's HEAD before and
   after (`git rev-parse HEAD`).
2. **Reinstall changed venvs.** For the personal-stuff pull, diff the two
   SHAs: `git -C "$PROJECT_REPO" diff --name-only <before> <after> -- '*requirements.txt'`.
   For each changed requirements.txt whose directory contains a `.venv/`:
   run `<dir>/.venv/bin/pip install -r <dir>/requirements.txt`. If a changed
   requirements.txt has NO adjacent `.venv/`, print a `NOTE: no venv at <dir>
   (new cron? see VPS-CRONS.md one-time setup)` and continue.
3. **Reload the crontab only if it differs.**
   `crontab -l | diff -u - "$CRONS_DIR/crontab.txt"` — if identical, print
   `crontab: already current`; if different, show the diff, then
   `crontab "$CRONS_DIR/crontab.txt"` and re-verify
   `crontab -l | diff -q - "$CRONS_DIR/crontab.txt"` → must now match, else
   exit 1 with `crontab verify FAILED`.
4. **Summary.** Print pulled-SHA movement per repo, venvs reinstalled, and
   crontab action taken.
5. `--dry-run`: perform ONLY reads (`git fetch` + `git log HEAD..@{u} --oneline`
   instead of pull; list would-be venv reinstalls from the fetched diff; show
   the crontab diff) and execute nothing that mutates. Every mutating command
   in the script goes through a `run()` wrapper that echoes with a `+ ` prefix
   and skips execution when dry.

**Verify**: `bash -n ~/codebase/vps-crons/vps-apply.sh` → exit 0.

### Step 2: Sandbox test on the Mac

Build a throwaway sandbox to prove the flow without a VPS (see Test plan for
the full script), run `vps-apply.sh` against it with env overrides, and
confirm: both repos pulled, the changed-requirements venv reinstall is
detected, and the crontab step prints the diff. NOTE: on the Mac, do NOT let
the script touch the real user crontab — in the sandbox run, `--dry-run` is
MANDATORY for the crontab stage; the test only checks the printed plan.

**Verify**: sandbox run output contains `+ ` lines for the expected mutations
and exits 0.

### Step 3: Document in README.md

Replace/extend the vps-crons README's "apply changes" instructions: the 5
SSH situations from VPS-CRONS.md collapse to
`ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'` for situations 2 (schedule
change) and 3 (new pip dep); situations 1 (brand-new cron: .env + venv
creation), 4 (secret rotation) and 5 (removal) remain manual — say so
explicitly so nobody expects magic.

**Verify**: `grep -c 'vps-apply' ~/codebase/vps-crons/README.md` → ≥ 1.

## Test plan

Sandbox (all under `mktemp -d`; nothing outside it):

```bash
SANDBOX="$(mktemp -d)"
# fake "remote" repos
git init -q "$SANDBOX/crons-remote";  (cd "$SANDBOX/crons-remote"  && cp ~/codebase/vps-crons/crontab.txt . && git add . && git commit -qm init)
git init -q "$SANDBOX/proj-remote";   (cd "$SANDBOX/proj-remote"   && mkdir -p app && echo "requests" > app/requirements.txt && git add . && git commit -qm init)
# clones playing the VPS roles
git clone -q "$SANDBOX/crons-remote" "$SANDBOX/crons"
git clone -q "$SANDBOX/proj-remote"  "$SANDBOX/proj"
python3 -m venv "$SANDBOX/proj/app/.venv"
# push a requirements change to the remote
(cd "$SANDBOX/proj-remote" && echo "urllib3" >> app/requirements.txt && git commit -qam bump)
# run
CRONS_DIR="$SANDBOX/crons" PROJECT_REPO="$SANDBOX/proj" ~/codebase/vps-crons/vps-apply.sh --dry-run
```

Expected in output: the proj repo shows 1 incoming commit; `app/requirements.txt`
listed as a would-be venv reinstall; crontab stage shows a diff or
`already current` line (Mac user crontab vs the file — either is fine in
dry-run, it must only PRINT). Then a second, non-dry run with
`CRONS_DIR`/`PROJECT_REPO` still pointing at the sandbox, but **comment out /
skip the crontab stage via dry-run only** — i.e. non-dry is allowed for the
pull+pip stages in the sandbox; the crontab stage must never run non-dry on
the Mac. Simplest compliant check: run non-dry and confirm the pip install
executed (`urllib3` importable from the sandbox venv:
`"$SANDBOX/proj/app/.venv/bin/python" -c "import urllib3"` → exit 0) — and
that when the crontab stage is reached it either matched (`already current`)
or the script was interrupted BEFORE applying; if your implementation can't
guarantee that on a Mac, keep non-dry runs out entirely and rely on the
dry-run assertions. Clean up: `rm -rf "$SANDBOX"`.

## Done criteria

- [ ] `bash -n vps-apply.sh` exit 0
- [ ] Dry-run sandbox: incoming commits listed, venv reinstall detected, crontab diff printed, zero mutations
- [ ] Pip-stage sandbox check: `import urllib3` succeeds after non-dry sandbox run (or documented dry-run-only rationale)
- [ ] Real user crontab on the Mac untouched: `crontab -l` output identical before/after all testing (capture it first!)
- [ ] vps-crons README updated; `git status` clean outside in-scope files
- [ ] `plans/README.md` (personal-stuff) status row updated

## STOP conditions

- `crontab` binary behaves differently than expected on macOS during dry-run
  testing (e.g. no user crontab exists → `crontab -l` errors): handle the
  empty case (`crontab -l 2>/dev/null || true`), but if the diff logic can't
  be made safe, STOP and report rather than risking a crontab write.
- The sandbox git flow can't reproduce the diff detection.

## Maintenance notes

- **Owner follow-up:** push+merge, `cd /srv/crons && git pull` once by hand
  (bootstrap), then future applies are `ssh root@... '/srv/crons/vps-apply.sh'`.
- Plan 031 updates VPS-CRONS.md's runbook tables to reference this script.
- The script deliberately does NOT create .envs or venvs (new-cron bootstrap
  stays manual — it involves secrets, which never travel via git).
