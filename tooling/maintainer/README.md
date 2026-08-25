# Repo Maintainer

This agent is responsible for keeping the existing repository in good shape. It builds nothing new. It finds rot, reports it, and clears it once the owner approves.

## Directory Structure

- `CLAUDE.md` - Agent instructions and rules
- `bin/` - Shared scripts (`lib.sh`, `session-start.sh`, `run-job.sh`, `propose.sh`, `apply.sh`)
- `jobs/` - Contains one folder per job (e.g., `skills`, `memory`)
- `state/` - Gitignored directory for raw findings and proposals, and the tracked `ledger.md`

## Starting it

```
chief
```

`chief` is a zsh function that `cd`s here and starts Claude, so this folder's
`CLAUDE.md` becomes the session's operating instructions. Same shape as `boss`.

It is defined in `~/.zshrc`, which is **not** tracked in this repo, so a fresh
machine has to add it back:

```bash
chief-work() {
  cd "$HOME/codebase/personal-stuff/tooling/maintainer" || return
  CLAUDE_CONFIG_DIR="$CLAUDE_WORK_CONFIG_DIR" command claude --dangerously-skip-permissions --model opus "$@"
}
chief-personal() {
  cd "$HOME/codebase/personal-stuff/tooling/maintainer" || return
  CLAUDE_CONFIG_DIR="$CLAUDE_PERSONAL_CONFIG_DIR" command claude --dangerously-skip-permissions --model opus "$@"
}
chief() { chief-work "$@"; }
```

Bare `chief` uses the work account. `chief-personal` uses the personal one.

## Commands

- `bash bin/session-start.sh` - Lists available jobs and their status. Runs nothing.
- `bash bin/run-job.sh <job>` - Runs the mechanical checks for a specific job and writes findings to `state/findings/`.
- `bash bin/propose.sh <job>` - Scaffolds a proposal skeleton in `state/proposals/` based on the findings.
- `bash bin/apply.sh <job>` - Acts on an approved proposal (requires a `Decision:` line in the proposal file).
