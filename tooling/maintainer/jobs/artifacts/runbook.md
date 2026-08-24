# Artifacts Runbook

## Procedure

Run the artifacts job to find leftovers of published videos:
```bash
bash tooling/maintainer/bin/run-job.sh artifacts
```

## Standing Rules
1. **`published()` requires BOTH a link and a done status.** A link alone is a draft upload; a done status alone is a bookkeeping slip.
2. **No tracker data means nothing is published.** The failure mode must be "cannot tell", not "assume shipped".
3. **`test-01` is skipped by name.** It is a pipeline fixture with no card, and every run would otherwise flag it forever.

## Expected Reclamation
- **Visuals-flow videos:** ~0.5–1.5 MB per video.
- **yt-script videos:** ~14–77 KB per video.
*Note:* Do not expect this to reclaim significant disk space from git tracked files. The real win is cleaning up untracked local renders and reducing the total number of tracked files.

## Archiving Renders
Local renders are archived, never deleted (`rm`). The archive path is:
`~/pp-maintainer-archive/<date>-artifacts/`

This path is **outside the repo**, so it can never affect a clone or a land. The actual move happens in a separate session after approval.
