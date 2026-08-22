<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash scripts/check-repo-hygiene.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [.gitignore, scripts/check-repo-hygiene.sh, tooling/cli/wt/bootstrap.d/personal-stuff.sh, docs/runbooks/rotate-gh-token.md, docs/reports/kb-scratch-orphan-inventory.md]

mutation_apply: |
  python3 - <<'PY'
  p='.gitignore'
  s=open(p).read()
  needle='.claude/settings.local.json'
  assert needle in s, 'mutation target not found — the fix is missing'
  # Reintroduce the real defect: the credential-bearing file is protected only by the
  # machine-local .git/info/exclude again, so a fresh clone has no protection at all.
  s=s.replace('\n.claude/settings.local.json', '\n#.claude/settings.local.json', 1)
  open(p,'w').write(s)
  PY
mutation_command: bash scripts/check-repo-hygiene.sh
mutation_expect: "HYGIENE-1"
mutation_cwd:
mutation_timeout: 300
---

# Plan 224: clone-safe ignores, a live dead rule, and the bootstrap link list

## Summary

- **Problem statement**: Three verified hygiene defects. (a) `.claude/settings.local.json` — which
  holds a live `GH_TOKEN` — and `.claude/worktrees/` are kept out of this **PUBLIC** repo *only*
  by `.git/info/exclude` (lines 18 and 11), which is per-clone and machine-local; the tracked
  `.gitignore` deliberately declines to ignore the first. Any fresh clone, or any directory copy,
  has no protection at all. (b) `.gitignore` lines 66-67 target
  `pipelines/hyperframes-vs-remotion/yt-visuals/cutaways/**`, a path that does not exist — the
  real one is under `pipelines/archive/` — so the rule has been dead and **37 rendered media files
  are already tracked** under the path it was meant to cover. (c) `wt`'s bootstrap hook links
  three machine-local runtime files into every leased worktree but omits `.dev.vars`, whose
  absence is an already-recorded failure.
- **Goals**:
  - Both `.claude` paths are ignored by the **tracked** `.gitignore`, so protection travels to
    every clone.
  - The dead ignore rule points at the real path.
  - `.dev.vars` joins the bootstrap link list.
  - A one-time inventory of the 33 GB of orphaned `~/kb-scratch` pool directories is written for
    the owner to act on — **no automated deletion**.
  - A runbook for the owner to rotate the exposed `GH_TOKEN` by hand.
- **Executor proposed**: `agy` / agy default (Gemini 3.1 Pro High). Graded **mechanical**: four
  small file edits, one new check script fully inlined below, and two generated documents. No
  judgement, no concurrency, no credential handling by the executor.
- **Done criteria** (terse — full list below): `bash scripts/check-repo-hygiene.sh` exits 0; the
  two `.claude` paths report `.gitignore` (not `.git/info/exclude`) as their ignore source; the
  mutation recipe fails with `HYGIENE-1`.
- **Stop conditions** (terse — full list below): the executor is about to touch a credential,
  delete anything under `~/kb-scratch`, or `git rm` any of the 37 tracked media files.
- **Test / verification for success**: a new `scripts/check-repo-hygiene.sh`, matching the
  existing `scripts/check-*.sh` convention. Every assertion is **behavioural** — it asks
  `git check-ignore -v` which file supplies the rule — never whether a string appears in
  `.gitignore`. A source-text assertion here would be circular.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- .gitignore scripts/ tooling/cli/wt/bootstrap.d/`

## Status

- **Priority**: P1 — (a) is a credential-exposure surface on a public repo.
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Standalone.
- **Category**: security
- **Difficulty**: mechanical
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

This repo is **PUBLIC** (`gh repo view` → `"visibility":"PUBLIC"`). The file
`.claude/settings.local.json` currently contains `GH_TOKEN=gho_…` (40 characters), and Claude
Code rewrites that file every time a permission is saved. The only thing keeping it out of git is
`.git/info/exclude:18` — a file that lives inside `.git`, is never committed, and therefore does
not exist in a fresh clone or on the VPS. `.gitignore:36-38` explicitly says the opposite:

```
# Local Claude permission overrides (each project may keep its own)
# NOTE: project .claude/settings.local.json is allowed (per-project overrides),
# only ignore stray runtime files
```

So the protection is one `git clone` away from being absent, on a repo anyone can read.

The dead rule is the same class of defect, already realised. Verified:
`git check-ignore -q pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/x.mp4` reports
**not ignored**, and `git ls-files` shows **37** tracked files under that directory. The rule's
own comment is "Rendered/generated media — outputs are rebuildable, never commit". It has been
silently inoperative because the tree moved under `archive/` and the rule did not follow.

Together these are the reason the design this plan belongs to treats
"a guard that looks installed and does nothing" as the primary defect class.

## Current state

### `.gitignore` — the two blocks to change

Lines 35-40, verbatim:

```
# Local Claude permission overrides (each project may keep its own)
# NOTE: project .claude/settings.local.json is allowed (per-project overrides),
# only ignore stray runtime files
.claude/cache/
.claude/logs/
```

Lines 64-68, verbatim:

```
# Rendered/generated media — outputs are rebuildable, never commit
pipelines/video/voice/**/output/
pipelines/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.mp4
pipelines/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.webm
docs/voice-pipeline-test/
```

### What actually supplies the protection today

Verified with `git check-ignore -v`:

```
.claude/settings.local.json   ->  .git/info/exclude:18:.claude/settings.local.json
.claude/worktrees/foo         ->  .git/info/exclude:11:**/.claude/worktrees/
```

Both machine-local. Note that `.gitignore` takes **precedence** over `.git/info/exclude`, so once
a matching rule is added to `.gitignore`, `check-ignore -v` will report `.gitignore:<n>` instead —
which is exactly the assertion Step 4's check script makes.

### Verified safe to ignore — nothing is tracked that this would newly exclude

`git ls-files | grep settings.local.json` returns **nothing**. So adding the rule cannot orphan or
shadow a tracked file, and the "each project may keep its own" allowance is unused in practice.
(Adding a path to `.gitignore` never untracks an already-tracked file, so even if one existed it
would keep working — but none does.)

### `tooling/cli/wt/bootstrap.d/personal-stuff.sh` — verbatim

```bash
# wt bootstrap for personal-stuff worktrees: link machine-local runtime files
# from the main checkout. Symlinks (not copies) so secrets have one home.

link() {  # link <relpath>
  ...
  ln -sfn "$main/$1" "$1"
}

link pipelines/.env
link pipelines/credentials.json
link .mcp.json
```

`.dev.vars` is missing from that list. Note that `link()` already begins
`[ -e "$main/$1" ] || return 0`, so a missing source is a safe no-op — which is also why a wrong
path here would be **silently** inert.

There is no `.dev.vars` at the repo root (`ls .dev.vars` fails). They are **per-app**, 8 of them,
including `apps/tutorial-tracker-app/.dev.vars` (2.8 KB). That app's missing `.dev.vars` in a
leased worktree is the recorded failure `tracker-e2e-needs-devvars`: `DEV_AUTH=1` goes missing,
producing "gate unprovable", `loginAs` timeouts, and blank "Not found" screenshots.

### `~/kb-scratch` — the orphan inventory

`du -sh ~/kb-scratch` is **33 GB** across **19** directories, of which only
`personal-stuff-0fbb2c25` (5.8 GB, 8 slots) is the live pool. The rest are leftovers: several
`tmp.*` directories from `test-wt.sh` runs, and older `personal-stuff-<hash>` pools dated
2026-07-06. The disk is 89% full with ~51 GiB free.

This plan **reports** them and stops. Deleting them is the owner's call: `dcg` blocks recursive
removal for good reason, and one of those directories could still hold uncommitted work.

### Existing convention to match

`scripts/` already holds `check-apps.sh`, `check-skill-descriptions.sh`, `probe-sites.sh`. Match
their shape: `#!/usr/bin/env bash`, `set -euo pipefail`, a `fail()` that prints a stable code and
exits non-zero, a final success line.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Which file supplies an ignore rule | `git check-ignore -v <path>` | `<source-file>:<line>:<rule>\t<path>` |
| Is a path ignored at all | `git check-ignore -q <path>` | exit 0 = ignored |
| The new gate | `bash scripts/check-repo-hygiene.sh` | prints `repo hygiene OK`, exit 0 |
| Count tracked archive media (informational) | `git ls-files \| grep -c "archive/hyperframes-vs-remotion.*cutaways"` | `37` |
| Scratch inventory | `du -sh ~/kb-scratch` | `33G` (approx) |

## Scope

**In scope**:
- `.gitignore` — the two blocks above
- `scripts/check-repo-hygiene.sh` — new
- `tooling/cli/wt/bootstrap.d/personal-stuff.sh` — one added `link` line
- `docs/runbooks/rotate-gh-token.md` — new, owner-facing
- `docs/reports/kb-scratch-orphan-inventory.md` — new, generated once

**Out of scope** — looks related, do not touch:
- **`.git/info/exclude`.** Leave both existing lines alone. They become redundant, not wrong, and
  removing them would briefly leave the file unprotected on this machine.
- **The 37 tracked media files.** Do **not** `git rm` them. Untracking without a history rewrite
  reclaims no space (the blobs stay in the 603 MB object store) and risks breaking anything that
  references them. Fixing the rule stops the bleeding; what to do about the existing 37 is a
  separate owner decision, and the runbook in Step 5 records it as one.
- **Any credential.** The executor must not read, print, move, rotate, or delete `GH_TOKEN` or
  any other secret. Step 5 writes *instructions for the owner*, nothing more.
- **Anything under `~/kb-scratch`.** Report only. No deletion, no `wt prune`, no `rm`.
- `tooling/cli/wt/wt` itself — plan 222 owns it.

## Git workflow

- Branch: `advisor/224-repo-hygiene-and-clone-safe-ignores`
- Commit per step, message style `fix(repo): <what>` / `docs: <what>` — no AI footers. Do **NOT**
  push.

## Steps

### Step 1: Make the two `.claude` paths clone-safe

In `.gitignore`, replace lines 35-40 (the "Local Claude permission overrides" block) with
**exactly** this:

```
# Local Claude permission overrides and per-session worktrees.
# These were previously protected ONLY by .git/info/exclude (lines 11 and 18), which is
# per-clone and machine-local — so a fresh clone or the VPS had no protection at all, on a
# PUBLIC repo, for a file that holds a live GH_TOKEN and is rewritten by Claude Code on
# every permission save. The old note here said settings.local.json was "allowed"; nothing
# is or was tracked (`git ls-files | grep settings.local.json` is empty), so ignoring it
# costs nothing. If a specific override file is ever genuinely wanted in git, add it by
# name with `git add -f`.
.claude/settings.local.json
.claude/worktrees/
.claude/cache/
.claude/logs/
```

**Verify**: `git check-ignore -v .claude/settings.local.json` -> the source is
`.gitignore:<n>`, **not** `.git/info/exclude:18`
**Verify**: `git check-ignore -v .claude/worktrees/foo` -> the source is `.gitignore:<n>`
**Verify**: `git status --porcelain | grep -c 'settings.local.json'` -> `0`

Commit: `fix(repo): ignore .claude local settings and worktrees in every clone`

### Step 2: Point the dead media rule at the real path

In `.gitignore`, replace the two `pipelines/hyperframes-vs-remotion/...` lines with **exactly**
this:

```
# The tree moved under archive/ and this rule did not follow, so it matched nothing and
# 37 rendered files are already tracked beneath it. Both spellings are kept: the archive
# path is where the files actually live, the original is harmless and covers a restore.
pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.mp4
pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.webm
pipelines/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.mp4
pipelines/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.webm
```

Do **not** `git rm` the 37 already-tracked files — see Scope.

**Verify**:
`git check-ignore -q pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/new.mp4`
-> exit 0 (ignored)
**Verify**: `git ls-files | grep -c "archive/hyperframes-vs-remotion.*cutaways"` -> still `37`
(the rule does not untrack, and must not)

Commit: `fix(repo): repair the dead rendered-media ignore rule`

### Step 3: Add `.dev.vars` to the bootstrap link list

There is **no `.dev.vars` at the repo root** — verified, `ls .dev.vars` fails. They are
**per-app**, and there are **8** of them today:

```
apps/analytics-app/.dev.vars        apps/kushal-tools/.dev.vars
apps/founders-tracker/.dev.vars     apps/lists-app/.dev.vars
apps/gym-app/.dev.vars              apps/timeblock/.dev.vars
apps/kushal-docs/.dev.vars          apps/tutorial-tracker-app/.dev.vars
```

So a single `link .dev.vars` would be a silent no-op — the exact failure mode this whole plan is
about. Loop instead. Add this immediately after `link .mcp.json`:

```bash
# Every app's .dev.vars is machine-local and gitignored, so a leased worktree gets none of
# them and any suite needing one fails there while passing in the main checkout. The
# tracker's absence produced "gate unprovable", loginAs timeouts and blank "Not found"
# screenshots (recorded lesson tracker-e2e-needs-devvars). Loop rather than naming one:
# there are 8 today, and a new app must not have to remember to edit this hook.
for _dv in "$main"/apps/*/.dev.vars; do
  [ -e "$_dv" ] || continue
  link "apps/$(basename "$(dirname "$_dv")")/.dev.vars"
done
```

No guard is needed and `link()` must not change: it already begins
`[ -e "$main/$1" ] || return 0`, so a missing source is a no-op.

**Verify**: `bash -n tooling/cli/wt/bootstrap.d/personal-stuff.sh` -> no output, exit 0
**Verify**: `grep -c 'apps/\*/.dev.vars' tooling/cli/wt/bootstrap.d/personal-stuff.sh` -> `1`

Commit: `fix(wt): link .dev.vars into leased worktrees`

### Step 4: Add the gate

Create `scripts/check-repo-hygiene.sh` with **exactly** this content:

```bash
#!/usr/bin/env bash
# Behavioural hygiene gate. Every assertion asks git WHICH FILE supplies an ignore rule,
# because that is the property that matters: a rule in .git/info/exclude protects this
# machine only, and this repo is PUBLIC. Asserting on .gitignore's text instead would be
# circular — the rule could be present and still not apply.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() { echo "$1" >&2; exit 1; }

# HYGIENE-1: credential-bearing local settings must be ignored by the TRACKED .gitignore,
# so the protection exists in a fresh clone and on the VPS.
src=$(git check-ignore -v .claude/settings.local.json 2>/dev/null | cut -d: -f1 || true)
[ "$src" = ".gitignore" ] || fail "HYGIENE-1: .claude/settings.local.json is ignored by '${src:-nothing}', not .gitignore — a fresh clone of this PUBLIC repo would track a file holding GH_TOKEN"

# HYGIENE-2: per-session worktrees, same reasoning.
src=$(git check-ignore -v .claude/worktrees/probe 2>/dev/null | cut -d: -f1 || true)
[ "$src" = ".gitignore" ] || fail "HYGIENE-2: .claude/worktrees/ is ignored by '${src:-nothing}', not .gitignore"

# HYGIENE-3: the rendered-media rule must match the path the files actually live at.
# It pointed at a tree that had moved under archive/, so it matched nothing for months.
git check-ignore -q pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/probe.mp4 \
  || fail "HYGIENE-3: rendered media under pipelines/archive/.../cutaways/ is NOT ignored — the rule is dead again"

# HYGIENE-4: actually RUN the bootstrap hook into a temp dir and assert it links every
# machine-local runtime file. A grep for a `link` line would pass while a glob silently
# matched nothing — which is exactly how the dead .gitignore rule above survived for
# months. So this executes the hook and checks for real symlinks.
repo="$PWD"
probe=$(mktemp -d)
( cd "$probe" && WT_MAIN_CHECKOUT="$repo" bash "$repo/tooling/cli/wt/bootstrap.d/personal-stuff.sh" ) >/dev/null 2>&1 \
  || { rm -rf "$probe"; fail "HYGIENE-4: the wt bootstrap hook failed to run"; }
for f in pipelines/.env pipelines/credentials.json .mcp.json apps/tutorial-tracker-app/.dev.vars; do
  [ -L "$probe/$f" ] || { rm -rf "$probe"; fail "HYGIENE-4: bootstrap hook did not link $f into a fresh worktree"; }
done
n=$(find "$probe/apps" -maxdepth 2 -name .dev.vars -type l 2>/dev/null | wc -l | tr -d ' ')
rm -rf "$probe"
[ "${n:-0}" -ge 8 ] || fail "HYGIENE-4: bootstrap linked only ${n:-0} app .dev.vars files, expected at least 8"

echo "repo hygiene OK"
```

Then `chmod +x scripts/check-repo-hygiene.sh`.

All four assertions are behavioural. HYGIENE-4 runs the real hook against a `mktemp -d` and looks
for real symlinks, so a `for` loop whose glob matches nothing fails the gate — a `grep` for a
`link` line would not.

**Verify**: `bash scripts/check-repo-hygiene.sh` -> prints `repo hygiene OK`, exit 0
**Verify**: `test -x scripts/check-repo-hygiene.sh` -> exit 0

Commit: `test(repo): add a behavioural hygiene gate`

### Step 5: Write the owner-facing token runbook

Create `docs/runbooks/rotate-gh-token.md`. The executor **must not** perform any of it — this
step writes instructions only.

Content requirements (write it in plain prose, owner-facing):

- **Why**: `.claude/settings.local.json` held a live `gho_…` token in a directory inside a
  **public** repo, protected only by a machine-local exclude file. Treat it as exposed and rotate
  it, even though `git ls-files` confirms it was never committed.
- **The safe order**: create the replacement token first, put it in place, verify `gh`, then
  revoke the old one. Never revoke first — `boss_assert_gh` refuses to run without a working
  `akshat-git-jpg` login.
- **Why removing it outright is not safe**: verified, `gh` currently authenticates as
  `akshat-git-jpg` **via `GH_TOKEN`**; with that variable unset, `gh`'s active keyring account is
  `kushal-zluri` — the Zluri **work** account — which `boss_assert_gh` rejects. So the variable
  must be *replaced*, not merely deleted.
- **The fallback that already exists**: `gh auth status` shows three keyring accounts —
  `kushal-zluri` (active), `akshat-git-jpg`, and `koala25`. Since `akshat-git-jpg` is already in
  the keyring, `boss_assert_gh`'s own `gh auth switch --hostname github.com --user
  akshat-git-jpg` fallback can authenticate boss without any env var. Record the trade-off
  honestly: `gh auth switch` changes the **global** active account, so a Zluri work session in
  another terminal would find `gh` acting as the personal account. That is why the env var exists,
  and it is why Step 1's `.gitignore` fix — not deletion — is the actual security fix.
- **Scopes to recreate**: `delete_repo`, `gist`, `read:org`, `repo`, `workflow` (read from
  `gh auth status`).
- **Verification after rotating**: `gh api user -q .login` prints `akshat-git-jpg`;
  `bash tooling/boss/test-boss.sh` still passes; `gh pr list --limit 1` works.
- **A separate open decision to record, not act on**: 37 rendered media files are tracked under
  `pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/`. Untracking them reclaims no
  space without a history rewrite. Left for the owner.

**Verify**: `test -f docs/runbooks/rotate-gh-token.md` -> exit 0
**Verify**: `grep -c 'kushal-zluri' docs/runbooks/rotate-gh-token.md` -> at least `1` (the
runbook must carry the warning about the work-account fallback)

Commit: `docs: runbook for rotating the exposed gh token`

### Step 6: Generate the one-time scratch inventory

Create `docs/reports/kb-scratch-orphan-inventory.md` by **running read-only commands** and pasting
their real output. Do not delete anything.

Include:
- `du -sh ~/kb-scratch` — the total.
- A table from `for d in ~/kb-scratch/worktrees/*/; do ...` giving each directory's name, size,
  slot count, and modification date.
- Which directory is the **live** pool, identified by `wt status --repo
  /Users/kbtg/codebase/personal-stuff` — do not guess from the name.
- For each non-live directory, whether any worktree inside it is **dirty**
  (`git -C <path> status --porcelain --untracked-files=all`), because a dirty one may hold
  uncommitted work and must not be deleted.
- The available disk from `df -h /Users/kbtg`.
- A closing line stating plainly that deletion is the owner's decision, that `dcg` blocks
  recursive removal by design, and that `wt prune --yes` only removes free-and-clean slots of the
  **live** pool and will not touch these.

**Verify**: `test -f docs/reports/kb-scratch-orphan-inventory.md` -> exit 0
**Verify**: `grep -c 'dirty' docs/reports/kb-scratch-orphan-inventory.md` -> at least `1`
**Verify**: `du -sh ~/kb-scratch` -> still roughly `33G` (nothing was deleted)

Commit: `docs: one-time kb-scratch orphan inventory`

## Test plan

`bash scripts/check-repo-hygiene.sh` is the gate. It asserts four properties:

1. `.claude/settings.local.json` is ignored **by `.gitignore`**, not by `.git/info/exclude`.
2. Same for `.claude/worktrees/`.
3. Rendered media under the real `pipelines/archive/.../cutaways/` path is ignored.
4. Running the bootstrap hook into a fresh directory really produces symlinks for
   `pipelines/.env`, `pipelines/credentials.json`, `.mcp.json` and at least 8
   `apps/*/.dev.vars`.

All four are behavioural. 1-3 ask git what it would actually do and which file made it do so;
4 executes the hook rather than grepping it. That is what makes the mutation meaningful —
commenting out one `.gitignore` line flips the reported source back to `.git/info/exclude` and the
check fails with `HYGIENE-1`.

No new unit tests are needed; nothing here is code with branches.

## Done criteria

- [ ] `bash scripts/check-repo-hygiene.sh` prints `repo hygiene OK` and exits 0.
- [ ] `test -x scripts/check-repo-hygiene.sh` exits 0 — the file exists and is executable, not
      merely specified (LESSONS 2026-08-17).
- [ ] `git check-ignore -v .claude/settings.local.json` reports `.gitignore` as the source.
- [ ] `git check-ignore -v .claude/worktrees/probe` reports `.gitignore` as the source.
- [ ] `git check-ignore -q pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/x.mp4`
      exits 0.
- [ ] `grep -c 'apps/\*/.dev.vars' tooling/cli/wt/bootstrap.d/personal-stuff.sh` returns `1`.
- [ ] The hook really links them: running it into a `mktemp -d` with
      `WT_MAIN_CHECKOUT` set to the repo produces at least 8 `apps/*/.dev.vars` symlinks
      (this is HYGIENE-4, and it must pass for a reason other than the glob matching nothing).
- [ ] `git ls-files | grep -c "archive/hyperframes-vs-remotion.*cutaways"` still returns `37` —
      nothing was untracked.
- [ ] `git ls-files | grep -c "settings.local.json"` returns `0`.
- [ ] `docs/runbooks/rotate-gh-token.md` and `docs/reports/kb-scratch-orphan-inventory.md` both
      exist and are non-empty.
- [ ] `du -sh ~/kb-scratch` is still approximately `33G` — nothing under it was deleted.
- [ ] `.git/info/exclude` is unchanged (`git diff` cannot show it; confirm by reading that lines
      11 and 18 are still present).
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes
      `bash scripts/check-repo-hygiene.sh` fail printing `HYGIENE-1`; reverting passes again.
- [ ] `git diff --stat` against the branch point touches only the five files in `touches`.

## STOP conditions

- **You are about to read, print, copy, move, rotate or delete any credential** — `GH_TOKEN`,
  `.env`, `credentials.json`, `.dev.vars`, or the contents of `.claude/settings.local.json`.
  STOP. Step 5 writes instructions for the owner; the executor never handles the secret. Do not
  echo a token value into any file, commit, or log.
- **You are about to delete anything under `~/kb-scratch`**, or run `wt prune`, `rm -rf`, or
  `git worktree remove` there. STOP. Step 6 is a report.
- **You are about to `git rm` any of the 37 tracked media files.** STOP — see Scope.
- **You are about to edit `.git/info/exclude`.** STOP — leave it alone.
- **`git ls-files | grep settings.local.json` returns anything.** That contradicts this plan's
  Current state and means a local settings file is tracked somewhere. STOP and report the paths
  before changing `.gitignore` — the rule is still correct, but the owner needs to know.
- **`git check-ignore -v` reports a source other than `.gitignore` after Step 1.** Do not "fix"
  it by editing `.git/info/exclude` or by adding a `!` negation. STOP and report the actual
  output.
- **A gate assertion fails and the tempting fix is to change the assertion.** STOP. Fix the rule,
  not the check.

## Maintenance notes

- The rule this plan encodes: **anything credential-bearing must be ignored by the tracked
  `.gitignore`, never by `.git/info/exclude`.** `info/exclude` is per-clone; this repo is public.
  `scripts/check-repo-hygiene.sh` is where a new such path gets a line.
- `HYGIENE-4`'s list must grow whenever `bootstrap.d/personal-stuff.sh` gains a `link` — the check
  and the hook are two halves of one contract. A suite that passes in the main checkout and fails
  in a worktree is almost always a missing `link`.
- The dead-rule failure mode is worth remembering: a path in `.gitignore` that matches nothing is
  invisible. It cost 37 tracked media files. When a directory tree moves, grep `.gitignore` for
  its old name.
- Both `.git/info/exclude` lines are now redundant. Leave them: they cost nothing, and removing
  them creates a window where this machine is unprotected.
- A reviewer should scrutinise: that Step 2 keeps **both** the archive and the original path
  spellings. The original is harmless and covers a future restore out of `archive/`.
