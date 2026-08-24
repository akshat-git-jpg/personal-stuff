# Windows setup: commit custody, worktrees and auto-commit

For a second person running this repo from a Windows laptop with Claude Code. Written
2026-08-24. Assumes the clone, Claude Code, and skill discovery already work, and that
only the commit-custody machine is in question.

Everything here is executed by Claude. Copy the prompt in
[the prompt](#the-prompt-copy-this-into-claude) and paste it into a Claude Code session
opened at the repo root. The rest of this page is context for the person who owns the
repo, and the pass table Claude should end up printing.

## What the custody machine is

Four parts, and they are independent of each other:

1. A PreToolUse hook (`.claude/hooks/no-history-in-main.sh`) that refuses `git add`,
   `git commit`, `git rebase` and friends when they would run in the main checkout.
2. A Stop hook (`.claude/hooks/commit-before-stop.sh`) that refuses to let a turn end
   while a workspace holds uncommitted work. This is the auto-commit guarantee. The
   hook does not write the commit, it blocks the turn until Claude has.
3. `pp-work`, which hands out a per-task git worktree under `~/kb-scratch/workspaces/`
   and never resets it. Two sessions stop sharing one working tree.
4. A `post-commit` git hook that fires `pp-land`, which rebases the commit onto main,
   verifies it, and pushes it to `origin/main`. Plus `pp-push`, a secret-scanning gate
   that every push passes through, and a `pre-push` hook that refuses any push which
   skipped the gate.

Part 4 pushes to a public repo. Read [before you start](#before-you-start).

## Why a fresh clone is only half installed

git carries the rules but not the parts that run them.

In the clone already:

| Thing | Path |
|---|---|
| Hook wiring | `.claude/settings.json` |
| The two Claude hooks | `.claude/hooks/*.sh` |
| The worktree tool | `tooling/cli/pp-work/pp-work` |
| The lander | `tooling/cli/pp-land/pp-land` |
| The push gate source | `tooling/cli/pp-push/pp-push` |

Never in a clone, on any operating system:

- `.git/hooks/pre-commit`, `post-commit` and `pre-push`. git does not clone its own
  hooks directory. `scripts/relink.sh` writes them, via `scripts/lib/guard-install.sh`.
- `pp-work` on PATH. It reaches PATH as a symlink in `~/.local/bin`, created by
  `scripts/link-clis.sh`.
- `~/.local/libexec/pp-push`, the installed copy of the push gate.
- `.claude/settings.local.json`, which is gitignored on purpose because it holds a live
  token.

Seeing the skills load proves nothing about any of this. Claude Code discovers
`.claude/skills/` straight out of the repo, so skills appear whether or not
`relink.sh` has ever run.

## The three Windows failures

### python3, and why it fails silently

Both Claude hooks parse their JSON input by shelling out to `python3 -c`. A stock
Windows install provides `python.exe` and no `python3`. The Microsoft Store alias stub
is worse: it exists, and it fails.

When `python3` is missing, `json_field` returns an empty string. The hook reads that as
"no command, not my repo" and exits 0. No error, no message, no block. The wall is
simply gone and nothing says so. This is the failure most likely to be live on the
laptop right now, because it produces no symptom at all.

### shasum

`pp-work` derives the workspace root from a hash of the main checkout path
(`tooling/cli/pp-work/pp-work:24`). `pp-land` and `pp-push` do the same. All three use
`shasum -a 256`, which is a Perl script and may not be present in Git Bash. `sha256sum`
always is, and prints the same format.

Missing `shasum` fails loudly in `pp-work`, which dies under `set -euo pipefail`. It
fails quietly inside `guard_install`, which records the gate's checksum with `shasum`
right after copying it into place. Under `relink.sh`'s `set -e` the function returns
there, so `pp-push` is installed but `post-commit` and `pre-push` never get written.
Called directly from an interactive shell it carries on instead and leaves an empty
`pp-push.sha256`, which makes `pp-push` refuse every push with "no recorded checksum".
Either way part 4 ends up half installed and nothing prints an error, which is why
Phase 2 below checks that file is non-empty.

### ln -s on a file copies it

MSYS creates a directory junction for `ln -s` on a directory without needing admin
rights, and that behaves like a symlink for anything that just opens paths. For a
*file* it has no junction to fall back on, so it copies. `~/.local/bin/pp-work` then
becomes a frozen snapshot that goes stale on the next edit to `pp-work`, and
`link-clis.sh` will refuse to touch it afterwards because `[[ -L "$link" ]]` is false.

A wrapper script is the reliable answer on Windows. The prompt below writes one.

## What is not needed

The 100 tracked symlinks in the repo (`git ls-files -s | grep ^120000`) break on
Windows unless Developer Mode is on and `core.symlinks=true` was set at clone time.
Roughly half are `.agents/skills/`, which only a Codex session reads. None of them are
needed by the custody machine. Treat broken symlinks as a separate, lower-priority
problem: some pipelines skills will not load, and commit custody will work fine anyway.

`pp-work snapshot` used to be broken on Windows and Linux both, and was fixed on
2026-08-24. It called `mktemp -t ppwork-snap-idx`, which is BSD syntax; GNU mktemp reads
`-t` as a name relative to `$TMPDIR` and refuses it for having too few X's. The failure
was silent in the worst possible direction: `snap_one` returned 1, the caller read that
as "tree is clean", and the verb printed "nothing to snapshot" over a workspace full of
unlanded work. If the laptop's clone predates that commit, `git pull` before relying on
`snapshot`.

## Before you start

Auto-land pushes to `origin/main` of a public repo, with no review step, from her
laptop. That needs two things to be true, and Claude cannot decide either one:

- She is a collaborator on `akshat-git-jpg/personal-stuff` with write access.
- She has her own GitHub credentials on the machine. The Mac uses a repo-local helper
  at `~/.local/bin/git-credential-pp-personal`, which does not exist on her laptop and
  should not be copied there. Git Credential Manager ships with Git for Windows and is
  the right choice: `git config credential.helper manager`.

Also set the commit identity per clone, since the Mac gets it from a zshrc rule that
does not exist on Windows:

```bash
git config user.name "Her Name"
git config user.email "her@email.example"
```

If either of the two conditions is false, the setup still installs cleanly and every
part except the land succeeds. The land will fail with a 403 and write the reason into
`land.log`. Nothing is lost; her commits stay on the local `work/*` branch.

## The prompt (copy this into Claude)

Open a Claude Code session at the repo root on the Windows laptop, then paste
everything inside the block.

````text
I am on Windows. This repo has a commit-custody system (Claude hooks + pp-work
worktrees + auto-commit + auto-land) that was built and tested on macOS. I need you to
verify it actually works here and fix it where it does not. Read
docs/runbooks/windows-custody-setup.md first for the design and the three known
Windows failures.

Work in four phases. Do not skip to fixing.

PHASE 1: REPORT ONLY. Change nothing. Report:
  - uname -s (expect MINGW64_NT... if Claude Code is using Git Bash)
  - Whether each of these resolves: bash, git, python3, shasum, sha256sum, nohup, df,
    mktemp, perl
  - Whether ~/.local/bin is on PATH
  - git config --get core.symlinks, and how many tracked symlinks are intact:
    compare `git ls-files -s | awk '$1=="120000"' | wc -l` against how many of those
    paths are real directories or links rather than one-line text files
  - Which of these exist and are executable: .git/hooks/pre-commit,
    .git/hooks/post-commit, .git/hooks/pre-push
  - Whether ~/.local/libexec/pp-push and ~/.local/libexec/pp-push.sha256 exist
  - Whether `pp-work` resolves on PATH, and if so whether it is a symlink or a copy
  - git config --get user.email, git config --get credential.helper, and
    `gh auth status` if gh is installed
  Print a table. Say plainly which parts of the custody machine are currently dead.

PHASE 2: FIX. Apply only what Phase 1 showed was missing.

  2a. If python3 is missing or is the Store stub, write a shim and confirm
      `python3 -c "print(1)"` prints 1:
        mkdir -p ~/.local/bin
        printf '#!/bin/sh\nexec python "$@"\n' > ~/.local/bin/python3
        chmod +x ~/.local/bin/python3
      If `python` is also missing, stop and tell me. Do not install Python yourself.

  2b. If shasum is missing, shim it onto sha256sum, which prints the same format:
        printf '#!/bin/sh\n[ "$1" = "-a" ] && shift 2\nexec sha256sum "$@"\n' > ~/.local/bin/shasum
        chmod +x ~/.local/bin/shasum
      Confirm `printf x | shasum -a 256` prints a 64-char hex hash.

  2c. If ~/.local/bin is not on PATH, append it to ~/.bashrc and tell me to restart
      the Claude session afterwards. Do not rely on exporting it in one shell.

  2d. Put the repo CLIs on PATH. Do NOT run scripts/link-clis.sh: `ln -s` on a file
      copies it under MSYS, which produces a stale snapshot. Write wrapper scripts
      instead, one per CLI, using the absolute repo path:
        for n in pp-work pp-land wt yt-claude; do ... done
      Each wrapper is two lines: a #!/bin/sh line and
      `exec "<abs-repo>/tooling/cli/<n>/<n>" "$@"`. Skip any whose target is missing.
      chmod +x each one. Confirm `pp-work` with no arguments prints its usage line.

  2e. Install the git hooks and the push gate. Source
      scripts/lib/guard-install.sh and call `guard_install "<abs-repo>"`. Do not run
      scripts/relink.sh: it also rewrites the skills directories, which are already
      working, and its description guard needs python3 before 2a has landed.
      After it runs, confirm all three of .git/hooks/pre-commit, post-commit and
      pre-push exist and are executable, and that pp-push.sha256 is non-empty. If any
      is missing, guard_install returned early on a failing command; find which and
      tell me.

  2f. Set credential.helper to `manager` and set user.name / user.email if unset. Ask
      me for the name and email rather than guessing.

PHASE 3: PROVE IT, LIVE. A dependency check is not proof. The path formats differ
between a native Windows Claude Code binary and Git Bash, so the only trustworthy test
is the real thing.

  3a. The wall. Actually attempt `git commit --allow-empty -m "hook probe"` from the
      repo root as a normal Bash tool call. You must be BLOCKED before the command
      runs, with the "BLOCKED: recording git history in the main checkout" message.
      If the commit succeeds, the PreToolUse hook is dead. Reset it with
      `GUARD_OK=1 git reset --hard HEAD~1` and report the failure.

  3b. The wall, second net. `GUARD_OK=1 git commit --allow-empty -m "hook probe 2"`
      should still be refused, this time by .git/hooks/pre-commit with exit 1. That
      proves part 4's hooks are armed independently of the Claude hook.

  3c. Worktree custody. Run `pp-work claim --kind code --slug win-probe`. It must
      print a path under ~/kb-scratch/workspaces/. Run `pp-work list` and confirm the
      workspace appears with a branch of work/win-probe.

  3d. The Stop hook. Create a file `hook-probe.txt` in that new workspace, then end
      your turn without committing. You must be blocked with "This workspace has 1
      uncommitted change(s)". Report whether you were. That block IS the auto-commit
      guarantee; if the turn ends quietly, auto-commit is not enforced here.

  3e. The lander. Commit hook-probe.txt in the workspace with a real conventional
      commit message. Then wait about 60 seconds and read
      ~/kb-scratch/workspaces/*/win-probe/land.log. Report what it says verbatim. A
      403 or an auth error means the credential setup in 2f is incomplete, which is a
      separate problem from the hooks; say so explicitly rather than calling the
      hooks broken.

  3f. Clean up. Remove hook-probe.txt, commit the removal, let it land, then
      `pp-work remove <path> --now`. If pp-work refuses because the branch is not on
      origin, leave the workspace in place and tell me; do not force it.

PHASE 4: REPORT. One table, one row per part, each PASS or FAIL with the evidence you
actually saw. Then list anything you changed on this machine outside the repo, with
full paths, so it can be undone. Finally, name anything you could not prove and why.

Rules: do not edit any tracked file in the repo. Do not run scripts/relink.sh or
scripts/link-clis.sh. Do not install Python, Git, or gh. If a phase fails, stop and
report rather than working around it.
````

## What a pass looks like

| Part | Proof |
|---|---|
| PreToolUse wall | `git commit` in the main checkout is blocked before it runs |
| pre-commit net | `GUARD_OK=1 git commit` is still refused, exit 1 |
| pp-work | `claim` prints a path under `~/kb-scratch/workspaces/`, `list` shows it |
| Stop hook (auto-commit) | Ending a turn on a dirty workspace is blocked |
| post-commit lander | `land.log` records a land attempt within a minute of the commit |
| pp-push gate | `~/.local/libexec/pp-push.sha256` is non-empty, pre-push is armed |

A `land.log` showing a 403 is a pass for the hook and a fail for the credentials. Keep
those two apart when reading the report.

## Undoing it

Everything Phase 2 writes lives outside the repo:

```
~/.local/bin/python3
~/.local/bin/shasum
~/.local/bin/{pp-work,pp-land,wt,yt-claude}
~/.local/libexec/pp-push
~/.local/libexec/pp-push.sha256
<repo>/.git/hooks/{pre-commit,post-commit,pre-push}
```

Delete those and the custody machine is off, except for the two Claude hooks. Those are
wired by the tracked `.claude/settings.json`, so switching them off means commenting
the `hooks` block out of a local copy of that file, or adding an override in
`.claude/settings.local.json`, which is gitignored.
