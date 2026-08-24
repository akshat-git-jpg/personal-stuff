# bigfiles

This job tracks and reports oversized files to prevent repo bloat.

The job has two halves:
1. **check.sh**: Reports oversized or wrong-type files tracked at HEAD, and untracked local junk.
2. **rewrite-plan.sh**: Provides a generator that emits a complete, reviewed `git-filter-repo` plan plus an impact checklist.

**Why this matters (measured 2026-08-25)**:
- `.git` pack size: **610 MB**
- Tracked at HEAD: **157 MB**
- History-only bloat: **~450 MB**

Deleting files from HEAD does not shrink a clone; only a history rewrite does. This is why the rewrite is planned, never improvised.
