# Memory Job

`check.sh` reports four candidate lists without changing a memory store:

1. Index sync: notes missing from `MEMORY.md`, and pointers whose note is missing.
2. Age report: notes old enough to review for promotion into the repo.
3. Store-count alarm: extra real stores and stores with no session history.
4. Dead-path check: project entries whose reconstructed source directory is gone. The reconstruction is intentionally naive, so names containing dashes can produce false positives.

Exit `0` means no findings, `1` means findings need review, and `2` means the check itself broke.

Archive, never delete. A grep is a candidate list, never a verdict: the last audit found seven false positives in eight stale-looking matches. Promotion and archival require an approved proposal; `fix.sh` only reruns the idempotent shared-memory link repair.

See [runbook.md](runbook.md) for the full audit procedure and its traps.
