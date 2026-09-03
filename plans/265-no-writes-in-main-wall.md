<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash .claude/hooks/test-no-writes-in-main.sh
ui:
deploy:
needs: []
needs_plans: []
needs_prs: []
touches: [.claude/hooks/no-writes-in-main.sh, .claude/hooks/test-no-writes-in-main.sh, .claude/settings.json, CLAUDE.md, .claude/allow-main-writes.list]

# Mutation gate — proves the wall's revert path is actually exercised by the test.
# If someone stubs out the revert, the test's "leak assertion" must fail with a marker.
mutation_apply: perl -i -pe 's/^(\s*)(git\s+-C\s+"\$MAIN_TOP"\s+checkout\s+--)/$1# MUTATED $2/' .claude/hooks/no-writes-in-main.sh
mutation_command: bash .claude/hooks/test-no-writes-in-main.sh
mutation_expect: LEAK: tracked file in main was not reverted
mutation_cwd:
mutation_timeout: 120
---

# Plan 265: Close the write-through hole — third main-checkout wall

## Summary

- **Problem statement**: The two existing main-checkout walls (`no-edits-in-main.sh`, `no-history-in-main.sh`) only catch direct Claude `Edit`/`Write`/`NotebookEdit` calls and git-history verbs. A `Bash` tool call whose subprocess writes a tracked file (e.g. `heygen-web`'s `render-log.mjs` calling `appendFileSync` on `pipelines/video/heygen/RENDERS.md`) threads between them and dirties main silently. This class recurs. On 2026-09-03 it fired again in a Windows session; only the Stop hook noticed at turn end.
- **Goals**:
  - Add a third wall that catches ANY Bash tool call that dirties a tracked file inside the main checkout, regardless of what tool ran the write (Node CLI, `sed`, `echo >>`, formatter, Python script).
  - Auto-revert the dirtied file, quarantining its content first so no legit work is ever lost.
  - Reuse the existing `.claude/allow-main-edit` sentinel as the deliberate 10-minute escape hatch.
  - Ship an empty path-glob allow-list mechanism for known-legit writers, populated only when a real false positive appears.
  - Fire only on the main checkout of THIS repo (self-identifying) — never on linked worktrees, untracked files, or a different tree.
- **Decisions confirmed** (Step 2.5, 2026-09-03):
  - on-catch behavior -> quarantine, then revert (save newly-dirty content to `.claude/quarantine/<UTC>-<flat-path>.txt` first, then `git checkout -- <file>`)
  - allow-list mechanism -> ship an empty `.claude/allow-main-writes.list` from day one (newline-delimited repo-relative path globs)
  - executor -> `agy` / Gemini 3.1 Pro (High) — matches rules.md default; fully-inlined plumbing with a strong mutation gate
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — rules.md default row (fully-inlined plumbing).
- **Done criteria** (terse — full list below): `.claude/hooks/no-writes-in-main.sh` and its test exist; `.claude/settings.json` wires the new hook on `PreToolUse` + `PostToolUse` Bash; the test script exits 0; CLAUDE.md updated to "Three walls".
- **Stop conditions** (terse — full list below): mutation gate fails; a test case fails and the fix would weaken/delete an assertion; the new hook fires against a linked worktree or on the wrong tree in tests.
- **Test / verification for success**: `bash .claude/hooks/test-no-writes-in-main.sh` — self-contained fixture-based tests (mirrors existing `test-no-edits-in-main.sh`, `test-no-history-in-main.sh`, `test-commit-before-stop.sh`).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 26d478a8..HEAD -- .claude/hooks/ .claude/settings.json CLAUDE.md`

## Status

- **Priority**: P1 (safety wall — closes a class of bug that has recurred; owner explicitly wants it not to happen again)
- **Effort**: M (one hook + test + settings wiring + one CLAUDE.md line; test coverage is the bulk of the work)
- **Risk**: Medium (a bug in this hook itself either silently bypasses — same as today — or over-reverts legitimate work; the mutation gate + fixture tests are what make it safe)
- **Depends on**: —
- **Category**: infra / guardrails
- **Planned-at SHA**: `26d478a8`
- **Difficulty**: standard (fully-inlined; no live judgment required; tests are the safety net)

## Why this matters

CLAUDE.md sets a strong invariant: "On main: read, talk, and scratch only. Any edit you intend to KEEP … claims a workspace FIRST." Two walls enforce it today, but the enforcement surface is narrower than the invariant:

- `no-edits-in-main.sh` intercepts `Edit|Write|NotebookEdit` — Claude's own tool-level file writes.
- `no-history-in-main.sh` intercepts `Bash` — but only refuses git verbs that record history.

A `Bash` tool call that runs a Node/Python/shell subprocess whose SIDE EFFECT is writing a tracked file inside main is invisible to both. The 2026-09-03 heygen-web incident is one example; other repo-owned CLIs that resolve write paths off `import.meta.url` or `__dirname` (rather than the caller's cwd) are structurally the same shape. Fixing each CLI is Whack-A-Mole. The wall catches the class.

Auto-reverting is the "won't happen again" commitment. Warn-only fails identically to the current Stop hook — the work is already in the wrong tree by the time the message prints. Quarantining before the revert makes that commitment safe: any content that turns out to have been legitimate is one `cp` away.

## Current state

### The two existing walls (do not change)

`.claude/hooks/no-history-in-main.sh` (PreToolUse Bash) — refuses git verbs that record history. Full source in the checkout.

`.claude/hooks/no-edits-in-main.sh` (PreToolUse Edit|Write|NotebookEdit) — refuses editing tracked files in main. Full source in the checkout. Both hooks follow the same pattern:

- Read hook JSON payload from stdin.
- Resolve a JSON runtime (`python3` / `python` / `py` / `node`), fail-closed if none.
- Extract fields from the payload with a small inline parser.
- Compare `git rev-parse --path-format=absolute --git-dir --git-common-dir` — a linked worktree has `$GD != $GCD` and is allowed.
- **Self-identifying repo test**: only fires when the detected main checkout ships this hook file (so a tracked `settings.json` cannot follow onto another machine and match the wrong tree).
- Honor `.claude/allow-main-edit` sentinel with a 10-minute TTL.
- On block: print a loud `MSG` block to stderr and `exit 2`.

### The write-through hole (concrete example)

`tooling/cli/heygen-web/src/cli/render-log.mjs:20`:

```js
export function appendRenderLog({ output, avatar, audio = "-", video_id, title }) {
  try {
    const log =
      process.env.HEYGEN_RENDERS_LOG ||
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "pipelines", "video", "heygen", "RENDERS.md");
    if (!video_id || !existsSync(log)) return;
    const cell = output || `[heygen link](${heygenLink(title, video_id)})`;
    appendFileSync(log, `| ${cell} | ${avatar} | ${audio} | \`${video_id}\` |\n`);
  } catch {
    /* never throw from logging */
  }
}
```

Any caller (Claude, codex, agy, direct shell) that runs `heygen-web`-derived commands lands the append in the main checkout of THIS repo, wherever the caller's cwd sits.

### The current `.claude/settings.json`

```json
{
  "outputStyle": "ELI5",
  "worktree": { "bgIsolation": "none" },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "bash \"$(cygpath -u \"$CLAUDE_PROJECT_DIR\" 2>/dev/null || printf %s \"$CLAUDE_PROJECT_DIR\")/.claude/hooks/no-history-in-main.sh\"" } ] },
      { "matcher": "Edit|Write|NotebookEdit", "hooks": [ { "type": "command", "command": "bash \"$(cygpath -u \"$CLAUDE_PROJECT_DIR\" 2>/dev/null || printf %s \"$CLAUDE_PROJECT_DIR\")/.claude/hooks/no-edits-in-main.sh\"" } ] }
    ],
    "Stop": [ … commit-before-stop.sh … ],
    "SubagentStop": [ … commit-before-stop.sh … ]
  }
}
```

Note the `cygpath -u` prefix — required for Git Bash on Windows. Every new hook path must use the same prefix, unchanged.

### Hook payload shape (what to expect on stdin)

Both `PreToolUse` and `PostToolUse` receive a JSON object on stdin containing at least:

- `session_id` — stable per Claude session (used already by `session-group.sh`).
- `cwd` — the session's working directory at tool call time.
- `hook_event_name` — `"PreToolUse"` or `"PostToolUse"`.
- `tool_name` — e.g. `"Bash"`.
- `tool_input` — for Bash: `{ "command": "...", "description": "..." }`.
- On PostToolUse also: `tool_response` (ignore for this wall — we key off the git tree, not the tool's own report).

There is no reliable per-tool-call id you can depend on across the two events. **Claude Code executes tool calls serially per session**, so pairing pre/post with a single-slot file per session is safe:

- PreToolUse writes `$STATE_DIR/pre.snap`.
- PostToolUse reads it, diffs against a fresh snapshot, cleans up.

### Where the snapshot file lives

`$STATE_DIR = "${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/no-writes-in-main/$session_id"`. Directory created lazily (`mkdir -p`). One tiny file per session. Never inside the repo (would show up as noise) and never in a globally-shared path (would collide across users).

Cleanup: `pre.snap` is deleted every time PostToolUse reads it; the parent session directory is best-effort `rmdir`d when empty.

### The quarantine directory

`$MAIN_TOP/.claude/quarantine/` — inside the main checkout, but **gitignored** by an added `.gitignore` line so a saved payload never accidentally becomes tracked. One file per revert:

```
.claude/quarantine/2026-09-03T14-22-01Z__pipelines_video_heygen_RENDERS.md
```

Name format: `<UTC-ISO with colons→dashes>__<repo-relative path with slashes→underscores>`. Content: the file's newly-dirty content, verbatim.

### The allow-list

`.claude/allow-main-writes.list` — plain text, newline-delimited, `#` comments allowed, repo-relative path globs. Ships empty:

```
# Allow-list for the no-writes-in-main wall.
# One path glob per line, repo-relative. Blank lines and #-comments are ignored.
# Only add a line here for a KNOWN-LEGIT write-through (e.g. npm install regenerating
# package-lock.json under a specific app). Prefer teaching the tool to write elsewhere.
#
# Format: shell globs matched against the repo-relative path with case-sensitive fnmatch.
# Examples (not enabled):
#   apps/*/package-lock.json
#   pipelines/**/generated/*.json
```

Matching uses the JSON runtime's fnmatch equivalent (Python's `fnmatch` or a small Node implementation). Missing file = empty allow-list (fail-open on this specific check, because a missing file is normal at first-run).

### Exemplar files

Match the shape of the existing walls:

- Hook: **`.claude/hooks/no-edits-in-main.sh`** — copy the header comment style, JSON-runtime detection, self-identifying repo test, sentinel logic, and stderr `MSG` block format.
- Test: **`.claude/hooks/test-no-edits-in-main.sh`** — copy the fixture setup (temp dir + `git init` + committed sentinel file), the JSON payload construction pattern, and assertion helpers.

## Commands you will need

Recon commands (run first, from repo root):

```bash
git rev-parse --short HEAD                                # base drift check
cat .claude/settings.json                                 # confirm current hook wiring
ls .claude/hooks/                                         # confirm sibling files
head -60 .claude/hooks/no-edits-in-main.sh                # the exemplar
head -60 .claude/hooks/test-no-edits-in-main.sh           # the test exemplar
```

Verification commands (must all be green at the end):

```bash
# 1) The new wall's own test suite — the merge gate.
bash .claude/hooks/test-no-writes-in-main.sh              # exit 0

# 2) The sibling test suites still pass (no regressions).
bash .claude/hooks/test-no-history-in-main.sh             # exit 0
bash .claude/hooks/test-no-edits-in-main.sh               # exit 0
bash .claude/hooks/test-commit-before-stop.sh             # exit 0

# 3) Structural syntax check on the new shell files.
bash -n .claude/hooks/no-writes-in-main.sh
bash -n .claude/hooks/test-no-writes-in-main.sh

# 4) Settings.json parses.
python3 -c "import json,sys; json.load(open('.claude/settings.json'))"
```

## Scope

**In-scope files** (the only ones the executor may add or modify):

- `.claude/hooks/no-writes-in-main.sh` (new)
- `.claude/hooks/test-no-writes-in-main.sh` (new)
- `.claude/settings.json` (add two hook wirings — one PreToolUse Bash, one PostToolUse Bash)
- `.claude/allow-main-writes.list` (new — the empty allow-list file with just header comments)
- `.gitignore` (one line: `/.claude/quarantine/`)
- `CLAUDE.md` (update the "Two walls enforce this now" sentence to "Three walls" and name the new wall in the same block)

**Out-of-scope (do NOT touch)**:

- `tooling/cli/heygen-web/**` — the wall catches the class; do not patch heygen-web.
- `.claude/hooks/no-edits-in-main.sh` — sibling wall; unchanged.
- `.claude/hooks/no-history-in-main.sh` — sibling wall; unchanged.
- `.claude/hooks/commit-before-stop.sh` — Stop-hook nag; unchanged.
- Any test outside `.claude/hooks/test-*.sh`.
- Any file under `pipelines/`, `apps/`, `tooling/`, `docs/`, `plans/` other than what's listed above.

## Steps

Each step ends with a **Verify** you must run and confirm.

### Step 1 — Create the empty allow-list file

Write `.claude/allow-main-writes.list` with the header comments shown under **The allow-list** above. No live entries.

**Verify**:
```bash
test -s .claude/allow-main-writes.list && grep -q "^# Allow-list" .claude/allow-main-writes.list && echo OK
# Expected: OK
```

### Step 2 — Gitignore the quarantine dir

Append `/.claude/quarantine/` to `.gitignore` (create the entry if it isn't already covered by a broader glob).

**Verify**:
```bash
mkdir -p .claude/quarantine && touch .claude/quarantine/probe.txt
git check-ignore .claude/quarantine/probe.txt && rm .claude/quarantine/probe.txt && rmdir .claude/quarantine
# Expected: .claude/quarantine/probe.txt (echoed by check-ignore), then clean rm/rmdir.
```

### Step 3 — Write the hook: `.claude/hooks/no-writes-in-main.sh`

Copy `.claude/hooks/no-edits-in-main.sh` as the structural template and adapt. The behavior:

1. Read stdin JSON payload.
2. Resolve JSON runtime; fail-closed to exit 2 with a loud stderr message if none.
3. Extract: `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input.command`.
4. Only act when `tool_name == "Bash"`. Any other tool: `exit 0`.
5. Resolve `$STATE_DIR = "${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/no-writes-in-main/$session_id"`; `mkdir -p` it.
6. Determine `$MAIN_TOP` from `$cwd`:
   - Resolve to real path; `git -C rev-parse --path-format=absolute --git-dir --git-common-dir`.
   - If `$GD != $GCD`: this is a linked worktree — `exit 0`.
   - `$MAIN_TOP = dirname $GCD`.
   - **Self-identifying test**: `[ -f "$MAIN_TOP/.claude/hooks/no-writes-in-main.sh" ]` — otherwise `exit 0`.
7. **On `PreToolUse`**: snapshot to `$STATE_DIR/pre.snap`:
   ```bash
   git -C "$MAIN_TOP" status --porcelain=v1 -uno > "$STATE_DIR/pre.snap" 2>/dev/null || : > "$STATE_DIR/pre.snap"
   exit 0
   ```
   (fail-open if git status errors — never block a Bash call because of the snapshot).
8. **On `PostToolUse`**:
   - Read `$STATE_DIR/pre.snap` (empty if missing).
   - Fresh: `POST=$(git -C "$MAIN_TOP" status --porcelain=v1 -uno)`.
   - Compute **newly-dirty tracked files in main**: files present in `$POST` with a modification status (M, A, D, R, C, U) that were NOT present with the same status in `pre.snap`.
   - Delete `$STATE_DIR/pre.snap` regardless.
   - If the newly-dirty set is empty → `exit 0`.
   - For each newly-dirty path:
     - If the path matches any glob in `$MAIN_TOP/.claude/allow-main-writes.list` → skip (do not quarantine, do not revert).
     - If `.claude/allow-main-edit` sentinel exists and its mtime is within 600s → skip (deliberate override; print one stderr line naming the age).
     - Else:
       - Read the file's current bytes.
       - Write them to `$MAIN_TOP/.claude/quarantine/<UTC>__<flat-path>.txt`. UTC = `date -u +%Y-%m-%dT%H-%M-%SZ`. flat-path = the repo-relative path with `/` → `_`.
       - `git -C "$MAIN_TOP" checkout -- "$path"` to revert (this line is the mutation-gate target).
       - Track reverted paths + quarantine files for the message.
   - If any paths were quarantined+reverted:
     - Print the loud `MSG` block to stderr naming each reverted path, the Bash command from `tool_input.command` (truncated to a reasonable width), and the quarantine locations, plus the `pp-work claim` fix.
     - `exit 2` so Claude surfaces the incident.
   - Otherwise `exit 0`.
9. On any other `hook_event_name` → `exit 0`.

Include the same fail-closed policy on missing JSON runtime that the siblings use.

**The loud `MSG` block** (mirror `no-edits-in-main.sh` style):

```
BLOCKED: a Bash command dirtied tracked files in the main checkout.

  <path 1>          quarantined to .claude/quarantine/<name 1>
  <path 2>          quarantined to .claude/quarantine/<name 2>

Command that dirtied them:
  <first 200 chars of tool_input.command>

The files above have been REVERTED. Their prior content was saved to the quarantine
paths above — copy them anywhere you need. Two walls already refuse editing tracked
files in main; this is the third, catching subprocess writes that slip through them.

Do this instead:
  cd "$(pp-work claim --kind code --slug <short-task-name>)"
and re-run the command there. It lands on main by itself.

Reading is fine. Untracked scratch files here are fine. Only writes to tracked
files are refused.

Deliberate one-off (expires after 10 minutes):
  touch <main-top>/.claude/allow-main-edit
```

**Verify**:
```bash
bash -n .claude/hooks/no-writes-in-main.sh && echo OK
# Expected: OK
```

### Step 4 — Wire the hook into `.claude/settings.json`

Add two entries under `hooks`:

- Under existing `PreToolUse`, append a third element matching `"Bash"` that runs `no-writes-in-main.sh`. Do NOT merge into the existing Bash matcher — keep the siblings independent so a failure in one doesn't mask the other.
- Add a new top-level `PostToolUse` key with one element matching `"Bash"` that runs `no-writes-in-main.sh`.

Path formatting: match the `cygpath -u` prefix used by the two existing hook commands, byte-for-byte:

```
"bash \"$(cygpath -u \"$CLAUDE_PROJECT_DIR\" 2>/dev/null || printf %s \"$CLAUDE_PROJECT_DIR\")/.claude/hooks/no-writes-in-main.sh\""
```

**Verify**:
```bash
python3 -c "import json; d=json.load(open('.claude/settings.json')); \
  assert any('no-writes-in-main' in h['command'] for m in d['hooks'].get('PreToolUse',[]) for h in m['hooks']), 'missing PreToolUse'; \
  assert any('no-writes-in-main' in h['command'] for m in d['hooks'].get('PostToolUse',[]) for h in m['hooks']), 'missing PostToolUse'; \
  print('OK')"
# Expected: OK
```

### Step 5 — Write the test: `.claude/hooks/test-no-writes-in-main.sh`

Structural template: `.claude/hooks/test-no-edits-in-main.sh`. Bash, `set -eu`, prints per-case OK / FAIL lines, non-zero exit on any FAIL, prints a summary at the end.

Each test case uses a temp fixture repo:

```bash
setup_fixture() {
  local dir; dir="$(mktemp -d)"
  git -C "$dir" init -q
  git -C "$dir" config user.email "test@example.com"
  git -C "$dir" config user.name "test"
  mkdir -p "$dir/.claude/hooks"
  # Self-identifying: the fixture must contain the hook file for the wall to fire.
  cp "$REPO_ROOT/.claude/hooks/no-writes-in-main.sh" "$dir/.claude/hooks/no-writes-in-main.sh"
  echo "seed" > "$dir/tracked.txt"
  git -C "$dir" add tracked.txt .claude/hooks/no-writes-in-main.sh
  git -C "$dir" commit -qm seed
  echo "$dir"
}
run_pre() { … prints JSON payload with hook_event_name=PreToolUse … | bash "$dir/.claude/hooks/no-writes-in-main.sh"; }
run_post() { … prints JSON payload with hook_event_name=PostToolUse … | bash "$dir/.claude/hooks/no-writes-in-main.sh"; }
```

Cases the test MUST include (each a labeled function, invoked from `main`):

1. **`case_revert_appended_tracked_file`** — dirty a tracked file between PreToolUse and PostToolUse. Assert: file content == "seed\n" (reverted), quarantine file exists and contains the appended content, PostToolUse exit code is 2. Leak marker on failure: `LEAK: tracked file in main was not reverted`. **This is the mutation gate's target case.**

2. **`case_untracked_file_untouched`** — create a new untracked file between Pre and Post. Assert: file still exists after Post, no quarantine entry created, exit code is 0.

3. **`case_linked_worktree_untouched`** — set up `$dir` as a linked worktree (`git -C "$maindir" worktree add "$dir" -b test`), dirty a tracked file, assert Post exits 0 and file stays dirty (wall must not fire in a linked worktree).

4. **`case_wrong_tree_untouched`** — set up a git repo that does NOT contain `.claude/hooks/no-writes-in-main.sh`. Wall must self-identify OFF and `exit 0`, file stays dirty.

5. **`case_sentinel_lets_it_through`** — `touch .claude/allow-main-edit` before Post. Assert: file stays dirty, no quarantine, exit 0, one stderr line naming the sentinel age.

6. **`case_sentinel_expired`** — touch the sentinel to a mtime older than 600s (`touch -t 200001010000`). Assert: revert still happens; sentinel is NOT honored.

7. **`case_allow_list_glob_skips_revert`** — add `tracked.txt` to `.claude/allow-main-writes.list`. Dirty the file. Assert: file stays dirty, no quarantine, no revert, exit 0.

8. **`case_allow_list_missing_is_empty`** — no allow-list file at all. Assert: revert fires normally (fail-open on missing file only).

9. **`case_bash_only`** — invoke the wall with `tool_name=Edit` between Pre and Post. Assert: wall no-ops (`exit 0`) regardless of tree state.

10. **`case_pre_snap_missing_is_ok`** — call PostToolUse without a prior PreToolUse. Assert: treats pre state as empty, still catches new dirt, does not crash.

Exit code contract: any FAIL prints its message, sets a failure flag, and at the end the script exits 1. If everything passed, exit 0 with `PASS: N cases`.

**Verify**:
```bash
bash .claude/hooks/test-no-writes-in-main.sh && echo OK
# Expected: cases print PASS lines, final "PASS: 10 cases", then OK.
```

### Step 6 — Update CLAUDE.md

In the root `CLAUDE.md`, find the sentence:

> **Two walls enforce this now**, both `PreToolUse` hooks: `no-history-in-main.sh` refuses git verbs that record history, and `no-edits-in-main.sh` refuses an Edit/Write to a *tracked* file (untracked scratch stays allowed; one-off override is `touch .claude/allow-main-edit`, which expires after 10 minutes). The Stop hook still nags on a dirty checkout, as the backstop for whatever slips past both.

Rewrite it to:

> **Three walls enforce this now**: `no-history-in-main.sh` (PreToolUse Bash) refuses git verbs that record history; `no-edits-in-main.sh` (PreToolUse Edit/Write/NotebookEdit) refuses editing a *tracked* file; `no-writes-in-main.sh` (PreToolUse + PostToolUse Bash) catches subprocess writes that slip through the other two — it snapshots `git status` around every Bash call, quarantines the newly-dirty content to `.claude/quarantine/`, then reverts. Untracked scratch stays allowed; one-off override is `touch .claude/allow-main-edit`, which expires after 10 minutes. The Stop hook still nags on a dirty checkout, as the backstop.

**Verify**:
```bash
grep -c "no-writes-in-main.sh" CLAUDE.md
# Expected: 1 (or more if it naturally appears in a follow-up sentence).
grep -c "Three walls enforce this now" CLAUDE.md
# Expected: 1
```

### Step 7 — Run every verify from "Commands you will need"

Run all four verification commands. All must pass. If any fail, DO NOT weaken assertions — investigate the wall or the test setup.

## Test plan

The wall's correctness lives in `test-no-writes-in-main.sh`. Ten cases enumerated in Step 5, keyed on:

- The success behavior (revert + quarantine + exit 2 + loud message).
- Every "must NOT fire" boundary (linked worktree, wrong tree, untracked, non-Bash tool, sentinel active, allow-list glob).
- Both fail-open cases (missing allow-list, missing pre-snap).
- One expiration case (sentinel older than 600s).

Do NOT add cases that depend on the calling Claude Code harness — the test must be runnable on any machine with `bash`, `git`, and a JSON runtime.

## Done criteria

All must be true simultaneously:

1. `bash .claude/hooks/test-no-writes-in-main.sh` exits 0.
2. `bash .claude/hooks/test-no-history-in-main.sh` exits 0 (no regression).
3. `bash .claude/hooks/test-no-edits-in-main.sh` exits 0 (no regression).
4. `bash .claude/hooks/test-commit-before-stop.sh` exits 0 (no regression).
5. `bash -n .claude/hooks/no-writes-in-main.sh` exits 0.
6. `python3 -c "import json; json.load(open('.claude/settings.json'))"` exits 0.
7. `grep -q "no-writes-in-main" .claude/settings.json` succeeds twice (Pre and Post entries).
8. `grep -q "Three walls" CLAUDE.md` succeeds.
9. `.claude/allow-main-writes.list` exists and starts with a `# Allow-list` header comment.
10. `.gitignore` matches `.claude/quarantine/probe.txt` via `git check-ignore`.
11. The mutation gate proves the revert path is actually exercised (boss runs this itself; see frontmatter).

## STOP conditions

Stop and report — do NOT improvise around any of these:

1. **Gate-integrity**: if a test-case assertion fails, fix the wall or the fixture. **Weakening, swapping, or deleting the assertion is a STOP.** (Standard rider — crews reliably soften assertions to pass; not here.)
2. **The mutation gate fails to prove the revert is exercised.** If `mutation_apply` runs and the test still passes, the test is not exercising the revert. Fix the TEST to exercise it — do not disarm the mutation.
3. **The wall fires against a linked worktree** in any test case. That is the invariant most likely to be broken by a subtle path bug. Debug the `$GD == $GCD` check; do not "just skip that case".
4. **The wall fails to fire when it should** on a clean fixture (the case_revert_appended_tracked_file case). Same rule — debug the hook, not the test.
5. **Any of the sibling test suites regresses.** The three walls are independent; a change to one should not break the others.

## Maintenance notes

- **Interaction with `boss` executors**: boss dispatches leased worktrees, not the main checkout. This wall never fires there. A boss crew never trips it.
- **Interaction with the existing `commit-before-stop.sh` nag**: this new wall drains most of the cases that would have tripped the Stop hook, so the Stop hook stays as the backstop for the residual class (untracked scratch that a session forgot to clean, and the tiny window between PostToolUse and turn end where nothing runs).
- **A future write-through CLI**: prefer teaching the CLI to write into the workspace (or refuse to write when the target is a main checkout) over adding an allow-list line. The allow-list is an escape hatch, not a routine tool.
- **The mutation gate's `perl` invocation**: uses BSD-portable perl (present on macOS + Linux + Git Bash on Windows). Do NOT rewrite it as GNU-sed — see boss LESSONS 2026-08-02.
- **Reviewer, watch for**:
  - The `no-writes-in-main.sh` hook returning early on `exit 0` from an unexpected branch (silently disarms the wall).
  - Fixture drift: the test's `setup_fixture` must always copy the CURRENT `no-writes-in-main.sh` from repo root, not vendor an old one.
  - The self-identifying check running BEFORE any decision — if it moves below the allow-list check, the wall could fire against a wrong tree that happens to have a matching allow-list.
