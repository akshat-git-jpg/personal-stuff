---
name: commit-now
description: Pre-commit gate for ANY git commit — runs prettier, lint, tsc, and build, auto-fixing what it can (including code edits for TS/build errors), prints a summary (repo, branch, git user, files changed), proposes a single-line conventional-commit message (no body, no em dash, no AI mention), and commits only after the user confirms. --no-verify only when every husky check already passed here. NEVER pushes; never mentions AI or any generator footer. Invoke BEFORE running `git commit` for ANY reason and HOWEVER the request is phrased — "commit now", "/commit-now", "commit and push", "commit this", "commit the changes", "push this" (a push implies committing first), "raise a PR", "address review comments", or when committing is just one step inside a larger task. In unattended/background sessions where confirmation is impossible, apply every check and message rule and skip only the interactive confirmation step.
user-invocable: true
metadata:
  author: kbtg
  version: 2.0.0
---

# commit-now

A pre-commit gate that runs the project's quality checks, fixes what it can, proposes a conventional-commit message, and — after the user confirms — stages the relevant files and creates the commit. **Never pushes.** Only edits source files (for auto-fixes) and the working tree (for staging the fix being committed).

## Hard constraints — non-negotiable

These rules override anything else in this skill or the user's general guidance:

1. **Allowed git state changes:** `git add <specific files>` and `git commit -m "..."` after the user confirms the message. **Not allowed:** `git push`, `git push --force`, `git stash`, `git reset`, `git checkout --`, `git restore .`, `git clean -f`, `git rebase`, `git commit --amend`, or `git add -A` / `git add .` / `git add *`. Read-only git commands (`status`, `diff`, `log`, `rev-parse`, `branch`, `config user.*`) are fine throughout.
2. **No AI/Claude/Anthropic footprint anywhere in output.** The commit message, the summary, and your conversational text must NOT contain:
   - "Claude", "Anthropic", "AI", "ChatGPT", "GPT", "LLM"
   - "Generated with", "Co-Authored-By", "🤖", "Authored by Claude", "with the help of"
   - Any other marker that the message was machine-drafted
   The message must read as if the engineer wrote it themselves.
3. **No emojis** in the commit message or summary unless the user explicitly asks.
4. **Commit message format** is strict Conventional Commits, **single line ONLY** — no body, no description paragraph, no footer, no `Co-Authored-By`, no bullet points, nothing after the subject line:
   `<type>(<scope>): <imperative subject in lowercase>`
   - Subject ≤ 50 chars where possible, hard cap 72. Aim short.
   - **Prefer generic over descriptive.** `fix(qb): filters` beats `fix(qb): correct app_name filter when negation is set`. The diff already says *what* changed; the message says *which area*.
   - No trailing period.
   - Examples (good): `fix(qb): filters`, `feat(sod): simulate-reason api`, `fix(sod): reason grouping`, `chore: deps`.
   - Examples (bad — too long/detailed): `fix(sod): align simulate-reason API with FE wire shape and group reasons by set_name`.
   - If a message includes a newline, the second line, or any explanation after the subject — that's a bug. Strip it.
5. **Don't claim a check passed unless you ran it and saw a zero exit code.** If a script doesn't exist in package.json, say so explicitly — don't fabricate output.
6. **`--no-verify` is allowed only under one condition:** every check the husky hook would have run (format, lint, typecheck, build) has already been run *by this skill* in this session and exited clean. If any check was skipped, failed, or wasn't applicable, you may NOT auto-use `--no-verify` — the user must explicitly authorize it.

## Workflow

Follow these steps in order.

### Step 1 — Locate the working repo and package manifest

```bash
git rev-parse --show-toplevel        # repo root
git rev-parse --abbrev-ref HEAD      # current branch
git config user.name                 # author
git config user.email                # author email
```

Then find the relevant `package.json`:

- If the user's current working directory has a `package.json`, use that.
- Else walk up to the repo root and check there.
- For monorepos with workspaces (e.g. dashboard-api has `postgres/` and `mongo/`), prefer the package.json closest to where the changed files live. `git diff --name-only` + `git diff --name-only --staged` tells you which subtree was touched.

Read the chosen `package.json` once and note which scripts exist: `format` / `prettier`, `lint` / `eslint`, `typecheck` / `tsc`, `build`. Different repos name them differently — don't assume.

### Step 2 — Run checks and auto-fix in a loop

For each of these check categories, in order, run the project's command if it exists. Use a max of **3 fix iterations** for the whole loop to avoid spinning.

| Category | Try in this order | Auto-fix command (if available) |
|---|---|---|
| Format | `prettier --check`, `npm run format:check`, `npm run prettier` | `prettier --write` or `npm run format` |
| Lint | `npm run lint`, `eslint .` | `npm run lint:fix` or `eslint . --fix` |
| Typecheck | `npm run typecheck`, `tsc --noEmit`, `npm run type-check` | Edit code to fix the reported errors |
| Build | `npm run build` | Edit code to fix the reported errors |

Rules:
- **Run the actual project script if it exists** (`npm run <script>`) instead of invoking the binary directly — projects often pass custom flags or paths.
- For format and lint: run check → if fail, run the fix variant → re-run check. If still failing after one fix pass, stop and report.
- For typecheck and build: read the error output, identify root causes, edit the code to fix them, then re-run. After 2 fix attempts on the same category, stop and surface the remaining errors to the user — don't keep guessing.
- If a category's script doesn't exist in package.json, **skip it and note "no <category> script defined"** in the summary. Do not pretend it passed.
- Never bypass a real failing check with `// @ts-ignore`, `eslint-disable`, or by deleting failing tests. If a check legitimately needs to be suppressed, the user decides — flag it and stop.
- **Track which categories ran clean.** This determines whether constraint #6 lets you use `--no-verify` automatically in Step 5.

### Step 3 — Produce the summary

After all checks finish (passing or with surfaced failures), print a compact summary block. Use this exact shape:

```
═══════════════════════════════════════════
 Pre-commit summary
═══════════════════════════════════════════
 Repo:    <basename of repo root>  (<absolute path>)
 Branch:  <branch>
 Author:  <git user.name> <<git user.email>>
 Checks:  format <ok|fail|skipped>  lint <ok|fail|skipped>  typecheck <ok|fail|skipped>  build <ok|fail|skipped>

 Files to commit (already staged + files this skill will stage):
   M  postgres/src/foo/bar.ts
   A  postgres/src/foo/baz.ts
   ...  (cap at 20 lines; if more, append "... and N more")

 Also in working tree (NOT being committed — will be left alone):
   M  postgres/package.json
   ...  (or omit this whole block if there are no leftovers)

 Auto-fixes applied:
   - prettier reformatted 3 files
   - eslint --fix resolved 2 issues
   - edited postgres/src/foo/bar.ts to fix TS2345
   (or: "none")

 Outstanding issues (if any):
   - <category>: <one-line description>
   ... (if none, omit this whole block)
═══════════════════════════════════════════
```

Use `git diff --name-status HEAD` + `git diff --staged --name-status` to build the file lists.

**Deciding which files to commit:**
- If files are already staged → those are the commit's scope. Treat unstaged changes as "leftovers" (do not stage them).
- If nothing is staged → infer from the prior conversation what work was just done. List those files as "to commit". Anything else in the working tree is a leftover.
- If you can't infer cleanly → ask the user to confirm the file list before staging.

### Step 4 — Propose a commit message

Infer `type` and `scope`, then **show the proposal and ask the user to confirm or override**.

**Type inference** (in priority order):
1. Branch prefix: `feature/*` → `feat`, `fix/*`/`bugfix/*`/`hotfix/*` → `fix`, `chore/*` → `chore`, `docs/*` → `docs`, `refactor/*` → `refactor`, `test/*` → `test`, `perf/*` → `perf`.
2. Diff signal: if only test files changed → `test`; only `*.md` → `docs`; package.json deps only → `chore`.
3. Default to `feat`.

**Scope inference** (in priority order):
1. Jira-style branch like `feature/zluriv1-12345-policy-platform-foo` → drop the ticket id and pick the most meaningful slug fragment as scope. E.g. `policy-platform`.
2. Branch like `feature/sod` → scope = `sod`.
3. If the diff is concentrated in one feature directory (e.g. `postgres/src/policy-platform/...`), use that dir name.
4. If nothing better, leave scope empty: `<type>: <subject>` is valid Conventional Commits.

**Subject inference**:
- Short imperative, lowercase, no trailing period.
- Prefer **generic** over **descriptive**: `filters`, `reason grouping`, `api`, `deps bump` — not a sentence describing the diff. The diff is the explanation; the message is just the label.
- Target ≤ 50 chars; hard cap 72.
- Never include parenthetical explanations, error names, "to fix X" clauses, or method names.

Show the proposal like this:

```
Proposed commit message:
  feat(policy-platform): single violation reason api

Type:    feat       (inferred from branch prefix "feature/")
Scope:   policy-platform   (inferred from branch slug)
Subject: single violation reason api   (inferred from diff)

Reply "ok" / "commit" to commit with this message, or send a different message.
```

Then **wait** for the user to confirm or edit. Validate any user-supplied message against the format rules (type required, scope optional, lowercase subject, ≤ 72 chars). If invalid, point out what's wrong and ask again.

**Unattended exception:** in a background/autonomous session where the user
cannot answer (and the commit follows directly from their request), do NOT
block on confirmation — print the same summary and proposed message, then
proceed. Every other rule (checks, staging discipline, message format, no AI
mention) still applies in full.

### Step 5 — Stage + commit

Once the message is confirmed:

1. **Verify the right git account** for this repo (if a `github-router` skill exists, it owns this check — call it out as a precondition). At minimum, `git config user.email` should match what the user wants on the commit; flag a mismatch before staging.
2. **Stage the in-scope files only** with explicit `git add <file1> <file2> …`. Never `-A`, `-a`, `.`, or `*`. Files in the "Also in working tree" leftovers list must NOT be staged.
3. **Decide `--no-verify`:**
   - If constraint #6 is satisfied (every applicable check ran clean in this skill), use `--no-verify`. State this in your message: *"Using --no-verify because format/lint/typecheck already ran clean in this skill."*
   - Otherwise, run the commit normally (no `--no-verify`). If the husky hook then fails on an environment issue (expired auth token, missing dep, etc.) and not a real code issue, surface the hook output and ask the user explicitly whether to retry with `--no-verify`.
4. **Run the commit:** `git commit -m "<message>" [--no-verify]`. Pass the message via `-m`, NOT a HEREDOC (subject is one line, doesn't need it). Never add `--amend`. Never add `-s` / `--signoff` / `--gpg-sign` flags unless the user requested them in the trigger.
5. **Verify success** with `git log -1 --oneline` and `git status --short`. Report the new SHA + subject in the result.

After commit, **stop**. Do not push. Do not open a PR. Do not amend.

## Examples

### Good — clean checks, skill commits with --no-verify

User: `commit now`

You:
1. Detect repo + branch + author.
2. Run `npm run format:check` → ok.
3. Run `npm run lint` → ok.
4. Run `npm run typecheck` → ok.
5. (No build script — note "build: no script defined".)
6. Print the summary block.
7. Propose `fix(qb): filters`, show inference, ask `Reply "ok" / "commit" to commit with this message, or send a different message.`.
8. User replies `ok`.
9. Stage just the touched file with `git add postgres/src/.../FiltersProcessor.ts`.
10. Run `git commit -m "fix(qb): filters" --no-verify` (constraint #6 satisfied — format/lint/typecheck all ran clean in this skill; build script not defined doesn't count against the gate).
11. Print: `Committed: <sha> fix(qb): filters`. Stop.

### Good — checks failed somewhere, normal commit

User: `commit now`

You:
1–6. Same. typecheck had errors but you fixed them on iteration 2.
7. Propose message.
8. User confirms.
9. Stage in-scope files.
10. `git commit -m "..."` (no `--no-verify` because typecheck only became clean after auto-fix — let the hook re-verify; running checks clean in this skill on auto-fixed code is fine, but if there's any doubt the hook is the safety net).
11. If the hook passes → report SHA. If the hook fails on a code issue → fix and retry. If it fails on env issues (npm auth, missing deps) → surface, ask the user.

### Bad — do NOT do this

- `git add -A && git commit -m "..."` — staging unrelated working-tree changes. Stage explicit files only.
- Auto-using `--no-verify` when typecheck was skipped (no `typecheck` script defined and no `build` either) — constraint #6 isn't satisfied if checks didn't actually run.
- Adding `Co-Authored-By: Claude` / `🤖` / "Generated with" anywhere. Forbidden.
- `git push` after the commit. Never. The user pushes themselves.
- `git commit --amend` to "fix" a hook failure. Always create a NEW commit if anything needs fixing.
- Multi-line commit message via HEREDOC. Subject only, single `-m`.
- Long descriptive subjects like `fix(sod): align simulate-reason API with FE wire shape and group reasons by set_name`. Prefer `fix(sod): simulate-reason api`.
- Past tense (`added X`) — use imperative (`add X`).

## Edge cases

- **No `package.json` in repo:** announce it, skip all script-based checks. Constraint #6 is not satisfied (no checks ran), so any `--no-verify` would need explicit user authorization.
- **Detached HEAD / no branch:** use the short SHA as the branch label in the summary; default type to `feat` and scope to the top-level changed directory. Still commit if the user confirms.
- **Nothing to commit (`git status --porcelain` empty):** tell the user there's nothing to commit and stop. Don't fabricate a message.
- **Mixed staged + unstaged:** commit only what's staged. List the unstaged changes as "Also in working tree" leftovers. Do not stage them on your own.
- **Conflicts present (`UU` in status):** stop. Tell the user to resolve conflicts first.
- **Auto-fix loop not converging:** after the iteration cap, surface remaining errors verbatim in the "Outstanding issues" block, propose a message, and ask the user whether to commit dirty. If they say yes, commit normally (no auto `--no-verify` — constraint #6 isn't met).
- **Hook fails on env issues (auth, missing deps) and the user explicitly says `--no-verify`:** honor it. Re-run the commit with `--no-verify` even if constraint #6 wasn't met.

## Red flags that mean STOP

- About to `git push`, `git push --force`, `git commit --amend`, `git reset --hard`, or any other history-rewriting/remote-mutating command — stop. Wrong tool.
- About to `git add -A` / `git add .` / `git add *` — stop. Stage explicit files.
- About to insert "Claude" / "AI" / "Co-Authored-By" anywhere — stop. Strip it.
- About to claim a check passed without running it — stop. Run it or mark "skipped".
- About to write a multi-line commit message — stop. Subject only.
- About to use `cat <<EOF` / HEREDOC for a commit message — stop. Subject-only fits in a single `-m "..."`.
- About to write a subject longer than 50 chars — try to shorten it to a generic label before settling for the 72-char hard cap.
- About to use `--no-verify` without constraint #6 being satisfied AND without explicit user authorization — stop. Either re-run the missing check or ask.
