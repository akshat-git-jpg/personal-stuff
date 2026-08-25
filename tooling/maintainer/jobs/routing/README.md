# routing

This job audits the repository's navigation layer ("the map") against actual structure, fixing what is broken and proposing missing routes.

## The five checks

1. **Unmapped folder** — missing from the intent table. (Mechanical, auto-fix)
2. **Dead link or false claim** — missing target. (Mechanical, auto-fix if relocated, else flag)
3. **Missing operate-doc** — project sub-folder with no README.md/CLAUDE.md. (Mechanical, auto-fix)
4. **Stale decisions.md entries** — contradicted by current structure. (Judgement, **flag-only**)
5. **Missing routes** — an unanswerable question or weak row. (Judgement, propose-only)

Check 4 is flag-only; the job must never auto-edit the append-only `decisions.md` log.
Checks 4 and 5 require session judgement and are evaluated during `propose.sh`. Checks 1-3 are evaluated by `check.sh`.
