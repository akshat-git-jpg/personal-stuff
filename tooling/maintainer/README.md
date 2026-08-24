# Repo Maintainer

This agent is responsible for keeping the existing repository in good shape. It builds nothing new. It finds rot, reports it, and clears it once the owner approves.

## Directory Structure

- `CLAUDE.md` - Agent instructions and rules
- `bin/` - Shared scripts (`lib.sh`, `session-start.sh`, `run-job.sh`, `propose.sh`, `apply.sh`)
- `jobs/` - Contains one folder per job (e.g., `skills`, `memory`)
- `state/` - Gitignored directory for raw findings and proposals, and the tracked `ledger.md`

## Commands

- `bash bin/session-start.sh` - Lists available jobs and their status. Runs nothing.
- `bash bin/run-job.sh <job>` - Runs the mechanical checks for a specific job and writes findings to `state/findings/`.
- `bash bin/propose.sh <job>` - Scaffolds a proposal skeleton in `state/proposals/` based on the findings.
- `bash bin/apply.sh <job>` - Acts on an approved proposal (requires a `Decision:` line in the proposal file).
