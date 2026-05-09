# Research & Script Workflow

This file is the master guide for running the full YouTube research → script pipeline. Read it at the start of every session. The two sub-workflows (`yt-research/CLAUDE.md` and `yt-script/CLAUDE.md`) handle the detailed steps — this file is the entry point that coordinates everything.

---

## Trigger

**When the user mentions a topic they want to research or script** (e.g. "I want to work on X", "let's do X", "new topic: X") — start the wizard below. Do not wait for a specific magic phrase.

---

## Step 0 — Derive the niche slug and check existing state

1. Convert the topic to a lowercase hyphenated slug (e.g. "n8n hosting" → `n8n-hosting`, "AI video generators" → `ai-video-generators`).
2. Check if `yt-research/niches/<slug>/` already exists.

**If it already exists**, show the user exactly what's already in place:
- Does `niche.md` exist and have content?
- Does `video-ids.md` exist?
- Does `gemini-research.md` exist?
- Does `pricing/` have subfolders with images?
- Does `output/knowledge-base-compact.md` exist?
- Does `yt-script/scripts/<slug>/script.md` exist?

Then ask: "What do you want to do — continue from where you left off, re-run the research, or generate the script?"  
Jump to whichever step makes sense based on their answer and what's already done.

**If it does not exist**, create the folder structure and proceed with Step 1.

```
yt-research/niches/<slug>/
├── niche.md
├── video-ids.md
├── gemini-research.md
├── pricing/
└── output/            ← auto-created by run.ts
```

---

## Step 1 — niche.md

Ask the user these three things (you can ask all at once):

1. **Which tools/platforms should be compared?** (list them all)
2. **What is your personal tier list / ranking?** (top pick first)
3. **Who is the audience?** (technical level, e.g. "semi-technical, mostly non-technical")

Once they answer, write the content to `yt-research/niches/<slug>/niche.md`. Use the same free-form style as the example below — no rigid template, just clear prose + the tier list.

Example format (from n8n-hosting):
```
n8n 15+ self hosting platforms compared. Final Verdict

Railway
Render
...

My tier list is
Hostinger
then Railway
then Digital Ocean

Most of my audience is semi-technical people or non-technical people...
```

Confirm the file is written, then move to Step 2.

---

## Step 2 — video-ids.md

Ask: **"Paste the YouTube video IDs you want to analyze (one per line or as a list)."**

Take whatever they paste, extract the 11-character IDs, and write them as a JSON array to `yt-research/niches/<slug>/video-ids.md`.

Example output:
```json
["zqtx1Soeq5E","6ZB0zADNaqk","umzLFM-DXL8"]
```

Confirm written, then move to Step 3.

---

## Step 3 — gemini-research.md

Tell the user:

> "Now I need the Gemini research. Go to Gemini, research the topic in depth (competitive analysis, technical specs, pricing landscape, pros/cons for each tool), then paste the full output here."

Wait for them to paste the content. Once they paste it, write it exactly as-is to `yt-research/niches/<slug>/gemini-research.md`.

Verify the file is non-empty, then move to Step 4.

---

## Step 4 — Pricing screenshots

Tell the user:

> "Last input before we run. Add pricing page screenshots for each tool.
>
> - Folder: `yt-research/niches/<slug>/pricing/`
> - Create one subfolder per tool, named **exactly** as the tool appears in your list (lowercase, e.g. `railway`, `hostinger`, `digital-ocean`)
> - Drop the screenshots (PNG/JPG/WEBP) into each subfolder
>
> Tell me when you're done."

**Once they say done**, check:
- `yt-research/niches/<slug>/pricing/` exists
- It has at least one subfolder
- Each subfolder has at least one image file (`.png`, `.jpg`, `.jpeg`, `.webp`)

Cross-check subfolder names against the tool list from `niche.md`. If any tools are missing a pricing folder, list them specifically and ask the user to add them. Do not proceed until all tools have at least one screenshot.

Once pricing is verified, move to Step 5.

---

## Step 5 — Run Phase 1 (automated Gemini pipeline)

Tell the user:

> "All inputs are ready. Run this command in your terminal (type it with the `!` prefix so it runs live in this session):
>
> `! cd yt-research && npx ts-node run.ts --niche <slug>`
>
> The pipeline will pause after validation and show you a summary — just press Enter to continue."

Wait for them to confirm the run completed. If they paste errors, diagnose and fix before proceeding.

The pipeline runs these steps in order: validate → transcripts → pricing → extract → profiles → comparative. All output lands in `yt-research/niches/<slug>/output/`.

Once complete, move to Step 6.

---

## Step 6 — Phase 2: Knowledge Base synthesis (Claude Code)

Say: **"Synthesize the KB for niche `<slug>`"** — this triggers the instructions in `yt-research/CLAUDE.md` which Claude will follow to read all Phase 1 outputs and write `knowledge-base.md` + `knowledge-base-compact.md`.

Once both files are written, move to Step 7.

---

## Step 7 — Script generation (Claude Code)

Say: **"script for `<slug>`"** — this triggers the instructions in `yt-script/CLAUDE.md`.

The two-pass workflow:
1. Claude writes `yt-script/scripts/<slug>/outline.md` and stops.
2. User reviews and approves the outline.
3. Claude writes the full script to `yt-script/scripts/<slug>/script.md`.

Do not skip the two-pass flow. Do not write the full script before outline approval.

---

## Quick reference — what lives where

| Input | Path |
|-------|------|
| Niche brief (tools, tier list, audience) | `yt-research/niches/<slug>/niche.md` |
| YouTube video IDs | `yt-research/niches/<slug>/video-ids.md` |
| Gemini deep research | `yt-research/niches/<slug>/gemini-research.md` |
| Pricing screenshots | `yt-research/niches/<slug>/pricing/<tool-name>/` |
| Phase 1 outputs | `yt-research/niches/<slug>/output/` |
| Knowledge base (full) | `yt-research/niches/<slug>/output/knowledge-base.md` |
| Knowledge base (compact) | `yt-research/niches/<slug>/output/knowledge-base-compact.md` |
| Script outline | `yt-script/scripts/<slug>/outline.md` |
| Final script | `yt-script/scripts/<slug>/script.md` |
