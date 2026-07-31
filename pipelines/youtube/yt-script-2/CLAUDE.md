# yt-script-2 — how to operate here

The operating contract lives in the skill, not here:
`pipelines/.claude/skills/yt-script-2/SKILL.md`. Read that before doing anything
in this folder.

## What this folder is

Owner-supplied knowledge → outline → (optionally) full script. Three steps, each
gated on the owner asking for the next one. No research happens here: no
transcript fetching, no `dossiers/` reads, no `yt-research/`. The knowledge the
owner pastes in is the whole input.

## Layout

```
OUTLINE-INSTRUCTIONS.md    owner-owned — the only authority on outline format
SCRIPT-INSTRUCTIONS.md     owner-owned — the only authority on script format
videos/<slug>/
├── knowledge.md           what the owner gave, verbatim (+ fetched link content)
├── outline.md             step 2
└── script.md              step 3
```

## Why it exists separately from yt-script/

`yt-script/` is hardwired to tier-list comparison videos built from a
Gemini-generated knowledge base — four tiers, pricing screenshots, ranked
Winners, affiliate-link mentions. It ran once. `yt-script-2` was built
deliberately clean (2026-07-31) for any topic, any format, with the owner
supplying the knowledge directly. The two do not share files. Neither replaces
the other yet.

## The trap

Both instruction files start as **placeholders**. A session that improvises an
outline format instead of stopping to ask has broken the one rule this folder
has — the format is the owner's to define, and a guessed format silently
produces plausible-looking wrong output.
