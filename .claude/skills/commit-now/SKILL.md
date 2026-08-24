---
name: commit-now
description: The commit flow for the personal-stuff repo. Auto-commit is the DEFAULT here — invoke this at the end of any turn that changed tracked files inside a pp-work workspace, without being asked and without asking. Also use it when the owner says "commit now", or when you are about to stage, commit, push, rename a branch, or finish a merge in this repo. Never use it in a ZluriHQ work repo; that is commit-now-work.
user-invocable: true
metadata:
  author: kbtg
---

# commit-now (personal-stuff)

Runs the repo's quality checks, fixes what it can, writes a conventional-commit message,
stages the relevant files and commits — **inside a `pp-work` workspace**. It never pushes:
a `post-commit` hook carries the commit to `main` on its own.

**This skill is personal-stuff only.** ZluriHQ work repos use `commit-now-work`, which is a
separate, standalone skill. The two share wording on purpose; do not merge them, and do not
apply one repo's rules to the other.

## Auto-commit is the default in this repo

At the end of **any** turn in which you changed tracked files inside a workspace, run this
flow **without being asked**. Do not wait for "commit now". Do not ask "shall I commit?".

Why it is automatic here: work lives in a per-session workspace folder, so uncommitted work
is invisible from the main checkout. The owner's words: *"I might forget that some of the
things are not committed yet… if I close the session I might not remember to track that."*
Landing every turn's work is what makes that impossible.

**Still print the summary and the message** (Steps 3-4). Automatic means you don't ask
permission; it does not mean you work silently.

### When NOT to auto-commit

- **Nothing changed**, or the only changes are gitignored (renders, `node_modules`,
  bootstrap symlinks). Generated media must never be committed.
- **You are not in a workspace.** Claim one first (Step 1). Never commit in the main checkout.
- **A quality check is still failing** after the fix loop. Say so plainly in your reply and
  leave the work uncommitted. Committing a red tree either lands untested code to `main`
  (the verify map covers only some paths) or creates a blocked land that burns a fix-up
  agent. The work is safe either way — a dirty workspace is never deleted, and
  `boss-session-start.sh` lists it.
- **The owner said not to**, in this turn or as a standing instruction for the session.
- You are only reading, explaining, or planning. No change, no commit.

### One commit per turn

Default to a single commit covering that turn's work. Split into several only when the
changes are genuinely separate concerns, and give each its own conventional-commit subject.

### What it costs

Every commit starts a land: a rebase onto the newest `main`, the mapped test suite, then a
merge and push. Measured 2026-08-23: 15s and 54s of background work per land. That is the
price of the guarantee, and it is paid in background CPU, not in your tokens.

## Hard constraints — non-negotiable

These override anything else in this skill or the user's general guidance:

1. **Allowed git state changes:** `git add <specific files>` and `git commit -m "..."`.
   **Not allowed:** `git push`, `git push --force`, `git stash`, `git reset`,
   `git checkout --`, `git restore .`, `git clean -f`, `git rebase`, `git commit --amend`,
   or `git add -A` / `git add .` / `git add *`. Read-only git commands (`status`, `diff`,
   `log`, `rev-parse`, `branch`, `config user.*`) are fine throughout.
2. **Never push, and never open a PR.** The commit reaches `main` by itself — see "The
   commit does not push, but it does land" below. "Not pushed" does not mean "going nowhere".
3. **Branch naming is not yours.** `pp-work claim` creates and names the branch
   (`work/<slug>` or `subject/<slug>`). Never rename it, never create a branch as part of
   the commit flow, and never use a `feature/` prefix — that is `commit-now-work`'s rule and
   it does not apply here.
4. **No AI/Claude/Anthropic footprint anywhere in output.** The commit message, the summary,
   and your conversational text must NOT contain "Claude", "Anthropic", "AI", "ChatGPT",
   "GPT", "LLM", "Generated with", "Co-Authored-By", "🤖", "Authored by Claude", "with the
   help of", or any other marker that the message was machine-drafted. It must read as if
   the engineer wrote it.
5. **No emojis** in the commit message or summary unless the user explicitly asks.
6. **Commit message format** is strict Conventional Commits, **single line ONLY** — no body,
   no description paragraph, no footer, no `Co-Authored-By`, no bullet points, nothing after
   the subject: `<type>(<scope>): <imperative subject in lowercase>`
   - Subject ≤ 50 chars where possible, hard cap 72. Aim short.
   - **Prefer generic over descriptive.** `fix(pp-work): media probe` beats
     `fix(pp-work): guard the grep so a media-free workspace does not abort list`. The diff
     says *what* changed; the message says *which area*.
   - No trailing period. Imperative, not past tense (`add X`, never `added X`).
   - If a message includes a newline or anything after the subject, that's a bug. Strip it.
7. **Don't claim a check passed unless you ran it and saw a zero exit code.** If a script
   doesn't exist, say so explicitly — don't fabricate output.
8. **`--no-verify` is allowed only under one condition:** every check a pre-commit hook
   would have run has already been run *by this skill* in this session and exited clean. If
   any check was skipped or failed, the user must explicitly authorize it.
9. **Generated media is never committed.** Renders (`.mp4`, `.mov`, `.wav`, `.mp3`, `.png`,
   `.jpg`) are gitignored on purpose and cannot be recovered from git. Folder persistence is
   what protects them, which is also why a workspace holding them is never auto-removed.

## Workflow

### Step 1 — Be in a workspace

The main checkout refuses history-recording git verbs
(`.claude/hooks/no-history-in-main.sh`). Any of these works from any directory:

```bash
cd "$(pp-work claim --kind code --slug <short-task-name>)"            # then commit later
cd "$(pp-work claim --kind code --slug <short-task-name>)" && <git …>  # one command
git -C <workspace-path> <git …>                                        # one command, no cd
```

`--kind code` for discrete feature work (`work/<slug>`); `--kind subject` for persistent
topical work such as one video (`subject/<slug>`). Re-claiming the same slug returns the
same folder, which is how a new session picks up yesterday's work.

**Write the workspace path literally — never via a variable.** The wall resolves the
target directory from the command text, and it cannot expand a variable without running
the shell. So `WS=<path>` followed by `git -C "$WS" commit` is **refused**: any path
containing `$`, a backtick, `*` or `?` falls back to the session cwd and is judged as
main. Paste the absolute path into each command. (`cd "$(pp-work claim ...)"` is the one
substitution the wall recognises by shape, which is why that form is allowed.)

**Pick ONE form per command; never mix them.** The wall resolves a single leading `cd` or a
single `git -C`, and fail-closes on anything ambiguous. So
`cd <ws> && git -C <ws> add …` is **refused** — two retargeting constructs that could
disagree. After `cd <ws>`, use plain `git add` / `git commit` with no `-C`.

**Never use `GUARD_OK=1`.** There are deliberately zero call sites. Since 2026-08-23 the
wall resolves the directory a command targets, so all three forms above are allowed. If one
is refused, re-read the paragraph above — it is almost always a mixed form, not a wall bug.

Then gather:

```bash
git -C <ws> rev-parse --abbrev-ref HEAD      # the workspace branch
git -C <ws> config user.name
git -C <ws> config user.email
```

### Step 2 — Run the checks and auto-fix

Find the check command for the area you touched. Do not guess it — the mapping the lander
itself uses is `tooling/cli/pp-land/verify-map.tsv`, which maps a path prefix to its suite.
Run the one that covers your change. If your path is not in that map, run the closest
package's own tests and **say in your summary that the path is unmapped**, because the land
will not test it either.

Max **3 fix iterations** overall. For lint/format: check → fix → re-check once. For
typecheck/test failures: read the error, fix the code, re-run; after 2 attempts on the same
failure, stop and surface it.

Never bypass a failing check with `@ts-ignore`, an eslint-disable, or by weakening or
deleting an assertion. If a check legitimately needs suppressing, that is the owner's call —
flag it and stop.

### Step 3 — Print the summary

```
═══════════════════════════════════════════
 Pre-commit summary
═══════════════════════════════════════════
 Workspace: <slug>  (<absolute path>)
 Branch:    <branch>
 Author:    <git user.name> <<git user.email>>
 Checks:    <suite> <ok|fail|skipped>   (unmapped path: yes|no)

 Files to commit:
   M  tooling/cli/pp-work/pp-work
   A  tooling/cli/pp-work/test-pp-work.sh
   ...  (cap at 20 lines; if more, append "... and N more")

 Also in working tree (NOT being committed):
   ...  (omit this block if there are none)

 Auto-fixes applied:
   - <what>            (or: "none")

 Outstanding issues:
   - <category>: <one line>   (omit this block if none)
═══════════════════════════════════════════
```

Build the lists from `git -C <ws> diff --name-status HEAD` and
`git -C <ws> diff --staged --name-status`.

**Deciding what to commit:** if files are already staged, that is the scope. If nothing is
staged, commit the files this turn's work touched; anything else is a leftover and stays
unstaged. If you can't tell cleanly, ask.

### Step 4 — Propose the message, then commit

Infer `type` and `scope`, print the proposal, and **commit** — this is the auto path, so you
do not wait for confirmation. If the owner had asked for a specific message, use theirs.

**Type**: the nature of the work — bug fix → `fix`, new capability → `feat`. Diff signals:
only tests → `test`; only `*.md` → `docs`; deps only → `chore`. Default `feat`.

**Scope**: the tool or area, taken from the concentration of the diff — `pp-work`, `wall`,
`boss`, `tracker`, `visuals-flow`. The workspace slug is a good fallback. Leave it out
entirely rather than inventing one: `<type>: <subject>` is valid.

**Subject**: short, imperative, lowercase, generic, no trailing period, no parenthetical
explanation, no error names, no method names.

```
Proposed commit message:
  fix(pp-work): media probe and idle cleanup
```

### Step 5 — Stage and commit

1. Stage **only** the in-scope files, explicitly: `git -C <ws> add <file1> <file2> …`.
   Never `-A`, `-a`, `.`, or `*`. Leftovers must not be staged.
2. `git -C <ws> commit -m "<message>"`. Pass the message with `-m`, never a heredoc. Never
   `--amend`. Never `-s` / `--signoff` / `--gpg-sign` unless asked.
3. Verify: `git -C <ws> log -1 --oneline` and `git -C <ws> status --short`.
4. Report the new SHA and subject. **Then stop.**

## The commit does not push, but it does land

The `post-commit` hook starts `pp-land` in the background. It takes a dedicated landing
copy, rebases your branch onto the newest `main`, runs the mapped suite, and merges and
pushes. You do nothing and you wait for nothing.

- **Do not push, do not open a PR, do not run `greenlight` or `pp-land` yourself.**
- Commit as many times as you like. Each commit lands on its own. If a second commit
  arrives mid-land it is queued and picked up automatically.
- **Merges and conflicts are not yours.** If a land can't rebase cleanly it stops, leaves
  your workspace and `main` untouched, and records the reason. A sweep then sends one agent
  into your workspace to resolve it. Do not finish a conflicted merge by hand unless a land
  brief explicitly tells you to.
- **Cleanup is not yours either.** A land does not delete your workspace. `pp-work reap`
  reclaims it later, and only when it is clean, fully landed, and untouched for the grace
  window.

## Edge cases

- **Nothing to commit** (`git status --porcelain` empty): say so and stop. Don't invent a message.
- **Only gitignored changes** (renders, `node_modules`): nothing to commit. Say so.
- **Mixed staged + unstaged:** commit what's staged; list the rest as leftovers.
- **Conflict markers present (`UU`):** stop. Resolve first, or follow the land brief.
- **Detached HEAD:** you are not in a workspace. Claim one.
- **Fix loop not converging:** surface the remaining errors verbatim, do **not** commit, and
  say clearly that the work is uncommitted and where the workspace is.

## Red flags that mean STOP

- About to `git push`, `git push --force`, `git commit --amend`, `git reset --hard`, or open
  a PR — stop. Wrong tool; the lander owns that.
- About to `git add -A` / `.` / `*` — stop. Stage explicit files.
- About to use `GUARD_OK=1` — stop. Use one of the three forms in Step 1.
- About to rename the branch or create a `feature/` branch — stop. `pp-work` owns the name.
- About to commit a `.mp4` / `.wav` / `.png` — stop. Generated media is never committed.
- About to insert "Claude" / "AI" / "Co-Authored-By" anywhere — stop. Strip it.
- About to claim a check passed without running it — stop. Run it or mark it skipped.
- About to write a multi-line commit message or use a heredoc — stop. Subject only.
- About to commit while a check is red — stop. Report it uncommitted instead.
