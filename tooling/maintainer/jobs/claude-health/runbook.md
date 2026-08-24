# claude-health maintenance runbook

## Procedure

1. Run `bash tooling/maintainer/bin/run-job.sh claude-health`.
2. Read `tooling/maintainer/state/findings/<date>-claude-health.md`.
3. Check the output from `claude doctor` and the recorded `claude --version` value.
4. Start a Claude session, run `/doctor`, and record anything the full checkup reports in
   the proposal. This is a session step because the fixing mode has no CLI equivalent.

## Reading the result

- Exit 0 means the CLI was absent or every automated check passed.
- Exit 1 means `claude doctor` reported a problem; read its indented output.
- Exit 2 means the check itself broke. Do not treat it as clean.

The automated job does not run the in-session `/doctor` command and does not claim it did.
It never runs an update or changes plugin state.
