# token-budget maintenance runbook

## Procedure

1. Run `bash tooling/maintainer/bin/run-job.sh token-budget`.
2. Read `tooling/maintainer/state/findings/<date>-token-budget.md`.
3. Compare `rtk gain` with the baseline below, then review the first 40 lines from
   `rtk discover` for missed savings.
4. Read the `ccusage` summaries for `~/.claude-work` and `~/.claude-personal`; do not use
   the legacy `~/.claude` directory as the work account.
5. In a Claude session, run `/context` and paste its system-prompt, tools, MCP, skills, and
   memory breakdown into the proposal. The script cannot collect this section.

## Baseline

On 2026-08-25, `rtk gain` reported 39,689 commands, 325.9M tokens saved, and 94.8% savings.
Keep this line when adding later readings so the runbook preserves the trend.

## Reading the result

- Exit 0 means the available reporting commands ran without producing a finding.
- Exit 1 means `rtk` was not on `PATH`, so shell commands are costing full tokens.
- Exit 2 means the check itself broke. Do not treat it as clean.
- `rtk discover` output is deliberately truncated to 40 lines. Run `rtk discover` directly
  when the full opportunity list is needed.
- A missing `/context` breakdown remains “not measured” until the session step is completed.
