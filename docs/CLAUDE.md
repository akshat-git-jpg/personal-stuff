# docs — repo-wide documentation

Project-level docs that aren't tied to any single code folder.

## Layout

```
docs/
└── research-and-script-workflow.md   # master guide for the research → script pipeline
                                       # (yt-research → yt-script). Auto-loaded by the
                                       # root CLAUDE.md via @-reference.
```

## Convention

- Workflow guides that span multiple folders go here.
- Per-folder docs live next to the code in the folder's own `CLAUDE.md`.
