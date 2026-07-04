# docs — repo-wide documentation & Claude workflows

Project-level docs that aren't tied to any single code folder. Every file here that is `@`-referenced from the root `CLAUDE.md` is auto-loaded into Claude's context every session.

## Layout

```
docs/
├── research-and-script-workflow.md   # research → script pipeline (yt-research → yt-script)
├── yt-tracker-workflow.md            # process_yt_tracker.py — short links + description
└── yt-analysis-workflow.md           # views / clicks / metadata / ranking syncs
```

All three are auto-loaded by the root `CLAUDE.md` via `@`-reference, so they're always in Claude's context.

## Convention

- Files here describe **what Claude should do** when the user gives a particular trigger (e.g. "process yt tracker", "run analysis"). Each workflow file has a clear "Trigger" section listing the phrases that fire it.
- Per-folder docs live next to the code in the folder's own `CLAUDE.md`, not here.
- New workflow file? Add it here, give it a "Trigger" section, then add an `@docs/<file>.md` line to the root `CLAUDE.md` so it's auto-loaded.
