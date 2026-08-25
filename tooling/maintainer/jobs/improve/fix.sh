#!/bin/bash
# improve — has no fix path, by design.
set -uo pipefail
cat >&2 <<'MSG'
improve never edits source code.

Its output is a plan, not a diff:
  1. plans/NNN-<slug>.md          (written by the session, after approval)
  2. plans/README.md              (register the plan)
  3. state/ledger.md              (one line)

To land a plan, use the `secretary` skill (raise) then `boss`.
MSG
exit 2
