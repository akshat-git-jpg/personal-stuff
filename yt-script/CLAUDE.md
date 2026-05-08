# yt-script — Claude Code instructions

This repo turns a niche knowledge base (produced by `../yt-research/`) into a finished YouTube comparison-video script.

Nothing in this workflow writes outside `yt-script/`. The KB is read-only input.

## Trigger

**When the user says "script for `<niche-name>`"** — run the full script-generation procedure.

1. Read `Guidelines/script-generation.md` in full. Follow it exactly.
2. Read `Guidelines/voice.md` and `Guidelines/structure.md` before writing anything.
3. Read the niche's compact KB: `../yt-research/niches/<niche>/output/knowledge-base-compact.md`. Fall back to `knowledge-base.md` only if the compact is missing.
4. **Pass 1 — Outline.** Write to `scripts/<niche>/outline.md`. Stop. Wait for approval.
5. **Pass 2 — Full script.** Only after explicit approval. Write to `scripts/<niche>/script.md`.

Do not skip the two-pass workflow. Do not write the full script before the outline is approved.

## Layout

```
yt-script/
├── CLAUDE.md                     # this file
├── Guidelines/
│   ├── voice.md                  # tone rules
│   ├── structure.md              # section skeleton + word budget
│   ├── script-generation.md      # full procedure (the system prompt)
│   └── reference.md              # transcripts of the user's own videos — voice source-of-truth
├── example-script/               # two finished scripts — reference for the production layout
└── scripts/
    └── <niche>/
        ├── outline.md            # Pass 1
        ├── script.md             # Pass 2
        └── run-log.md            # one-line append per draft
```

## Hard rules

- Output paths are **always** under `scripts/<niche>/`. Never write to `../yt-research/`.
- The word *affiliate* never appears in any spoken line. Every covered tool gets a "link in the description" mention; Winners get a warmer push with discount code callouts where available.
- Prices, tool names, and rankings come from the KB verbatim. Don't invent, round, or re-rank.
- Target length: 15–20 minutes spoken (~2,100–2,800 words of voiced lines). See `Guidelines/structure.md §13`.

## Related repos

- `../yt-research/` — Phase 1 (Gemini, automated) + Phase 2 (Claude Code KB synthesis). Produces the compact KB this workflow consumes. Has its own CLAUDE.md.
