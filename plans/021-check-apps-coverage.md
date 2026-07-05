# Plan 021: Fix check-apps.sh — dead skip entry, visible coverage holes, shell syntax checks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- scripts/check-apps.sh`
> If the file changed since this plan was written, compare the excerpts below
> against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: mechanical
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

`scripts/check-apps.sh` is the repo's one-command verification baseline — the
thing the owner (and executor agents) trust to say "the apps still work". It
currently has three silent-trust problems:

1. Its `KNOWN_FAILING` list contains `tracker-app:lint`, but `apps/tracker-app/`
   no longer exists (renamed to `apps/tutorial-tracker-app/` on 2026-07-05).
   The entry is dead config — and because it no longer matches, the renamed
   app's lint runs unmasked and FAILS the baseline (~25 pre-existing issues,
   confirmed 2026-07-05; recorded as backlog item `TRK-05`). The mask's intent
   was correct; only its name is stale. **Fix = rename the entry, not delete it.**
2. `analytics-app:lint` is skipped permanently with no visibility into whether
   the lint situation is getting better or worse.
3. Any app directory without a `package.json` is skipped **silently** — today
   that's `pinterest-landing-pages`, `spending-tracker`, `telegram-email-assistant`,
   and `telegram-my-planner`. Two of those contain shell scripts that run as
   daily VPS crons (`digest.sh`) and are never even syntax-checked. The summary
   prints PASS while four shipping surfaces were never looked at.

After this plan: dead config gone, every skipped app/script prints an explicit
line in the summary, and all committed `.sh` files under `apps/` and `scripts/`
get a `bash -n` syntax check (shellcheck is NOT installed on this machine —
do not use it).

## Current state

`scripts/check-apps.sh` (92 lines, bash). Key excerpts as of `671741e`:

```bash
# lines 15-18
KNOWN_FAILING=(
  "analytics-app:lint"
  "tracker-app:lint"
)
```

```bash
# lines 48-51 — the silent skip
for dir in "$APPS_DIR"/*; do
  [ -d "$dir" ] || continue
  [ -f "$dir/package.json" ] || continue
  app_name="$(basename "$dir")"
```

The script then runs `typecheck`, `check`, `lint`, `test` npm scripts per app
(if present), collects lines into a `RESULTS` array, prints a summary, and
exits 1 if any failed. The apps without `package.json` (confirmed by listing
`apps/`): `pinterest-landing-pages/`, `spending-tracker/`,
`telegram-email-assistant/`, `telegram-my-planner/`.

Shell scripts that would be covered by the new `bash -n` pass include
`apps/telegram-email-assistant/digest.sh` and everything in `scripts/*.sh` +
`scripts/lib/*.sh`. Python virtualenvs must be excluded (`.venv/` dirs under
`apps/telegram-my-planner/` contain thousands of files).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check the runner itself | `bash -n scripts/check-apps.sh` | exit 0, no output |
| Run the full baseline | `./scripts/check-apps.sh` | exit 0, summary printed |
| Confirm dead entry gone | `grep -c 'tracker-app:lint' scripts/check-apps.sh` | `0` |

## Scope

**In scope** (the only file you should modify):
- `scripts/check-apps.sh`

**Out of scope** (do NOT touch):
- Any `package.json` in any app (do not add lint/test scripts to apps).
- `apps/analytics-app/` source (do not try to fix its lint errors).
- `scripts/README.md` (its description of check-apps.sh stays accurate).

## Git workflow

- Branch: `advisor/021-check-apps-coverage`
- Commit: `fix(scripts): check-apps visible skips, bash -n pass, rename stale tracker-app lint mask` — no AI footers. Do NOT push.

## Steps

### Step 1: Rename the stale KNOWN_FAILING entry (this ALSO fixes the red baseline)

In `scripts/check-apps.sh`, change the line `"tracker-app:lint"` to
`"tutorial-tracker-app:lint"` in `KNOWN_FAILING` (restoring the mask's
original intent after the app rename — its lint debt is tracked as `TRK-05`
in plans/README.md, do NOT try to fix the lint errors). Leave
`"analytics-app:lint"` in place. Keep both as skips, with the summary reading
`<app> : lint -> SKIP (known-failing — re-check occasionally)`.

Note: the baseline `./scripts/check-apps.sh` is EXPECTED to be red with
`[FAIL] tutorial-tracker-app : lint` BEFORE this step — that failure is the
stale mask itself and is what this step fixes. Any OTHER failing app/script
is a genuine STOP.

**Verify**: `grep -c '"tracker-app:lint"' scripts/check-apps.sh` → `0`, AND
`grep -c '"tutorial-tracker-app:lint"' scripts/check-apps.sh` → `1`, AND
`./scripts/check-apps.sh; echo "exit=$?"` → `exit=0` with
`tutorial-tracker-app : lint -> SKIP` in the summary.

### Step 2: Print explicit SKIP lines for apps with no package.json

Replace the silent `[ -f "$dir/package.json" ] || continue` with logic that
records the app in the results before continuing:

```bash
  if [ ! -f "$dir/package.json" ]; then
    echo "[SKIP] $app_name : no package.json (no verifier)"
    RESULTS+=("$app_name : no verifier -> SKIP")
    continue
  fi
```

**Verify**: `./scripts/check-apps.sh` output contains a line
`[SKIP] telegram-my-planner : no package.json (no verifier)` (and the same for
`pinterest-landing-pages`, `spending-tracker`, `telegram-email-assistant`).

### Step 3: Add a bash -n syntax pass over committed shell scripts

After the per-app loop and before the summary block, add:

```bash
echo ""
echo "Shell syntax pass (bash -n)..."
REPO_ROOT="$(cd "$APPS_DIR/.." && pwd)"
while IFS= read -r sh_file; do
  rel="${sh_file#$REPO_ROOT/}"
  if bash -n "$sh_file" 2>/dev/null; then
    RESULTS+=("$rel -> PASS (bash -n)")
  else
    echo "[FAIL] $rel : bash -n"
    RESULTS+=("$rel -> FAIL (bash -n)")
    FAILED=1
  fi
done < <(find "$REPO_ROOT/apps" "$REPO_ROOT/scripts" -name '*.sh' \
           -not -path '*/.venv/*' -not -path '*/node_modules/*' -not -path '*/dist/*')
```

Note: use plain `find` (the interactive rtk proxy does not apply inside
scripts, but if you test the find by hand and it errors about compound
predicates, invoke it as `command find ...`).

**Verify**: `./scripts/check-apps.sh` → summary includes
`apps/telegram-email-assistant/digest.sh -> PASS (bash -n)` and exit code is 0.

### Step 4: Full run + syntax check of the runner

**Verify**: `bash -n scripts/check-apps.sh` → exit 0, AND
`./scripts/check-apps.sh; echo "exit=$?"` → `exit=0` with a summary that
contains at least one `SKIP` line for a no-verifier app and at least one
`(bash -n)` line.

## Test plan

No unit tests (bash utility; repo policy is no TDD here). Verification is the
live runs in Steps 2–4. Additionally break-test once: temporarily add a stray
`fi` to a scratch file `apps/telegram-my-planner/tmp-syntax-test.sh`, run the
script, confirm it reports `[FAIL] ... bash -n` and exit 1, then DELETE the
scratch file and re-run to green. The scratch file must not be committed.

## Done criteria

- [ ] `grep -c '"tracker-app:lint"' scripts/check-apps.sh` → 0 and `"tutorial-tracker-app:lint"` present
- [ ] `./scripts/check-apps.sh` exit 0; summary lists 4 no-verifier SKIP apps
- [ ] Summary lists `bash -n` results for `apps/**/*.sh` and `scripts/**/*.sh` (no `.venv`/`node_modules` paths)
- [ ] `git status` shows only `scripts/check-apps.sh` modified (plus `plans/README.md` status row)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `./scripts/check-apps.sh` fails on the current code for anything OTHER than
  `tutorial-tracker-app : lint` (that one failure is expected pre-Step-1 and
  is fixed by the mask rename — any other red is a genuine baseline problem:
  report which app/script fails, don't fix it).
- The `bash -n` pass reports a failure in an existing committed script — that's
  a real pre-existing bug: STOP and report the file rather than editing it.
- `apps/tracker-app/` exists (the rename was reverted).

## Maintenance notes

- When an app gains a `package.json`, it automatically joins the npm-script
  loop; nothing to update here.
- `analytics-app:lint` and `tutorial-tracker-app:lint` remain known skips —
  the tracker's lint debt is backlog item `TRK-05` (fix when touching that
  app's client code).
- If shellcheck is ever installed, upgrade the `bash -n` pass to shellcheck.
