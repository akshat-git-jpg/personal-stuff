# 010 - take the knowledge

**[LLM]** &nbsp; Reads everything you hand over into one knowledge file.

The owner's sources - brain-dump, screenshots, links, YouTube URLs - all become TEXT in `videos/<key>/knowledge.md`, with the originals kept in `sources/`. Fetching what you were handed is ingestion; going and finding more is research, and this skill does no research. Ends by naming every gap it can see as a question.

**Writes:** `knowledge.md`, `sources/`

---

## What happens

1. Mint the key from the video registry - never slugify a title by hand:
   `KEY=$(node bin/vreg.mjs ensure <name> --title "<title>")` from
   `pipelines/video-registry/`.
2. `mkdir -p videos/<key>/sources/`
3. Ingest all four source shapes into `knowledge.md`:
   - **plain text** - the owner's brain-dump, verbatim, at the top, untidied
   - **screenshots** - read the image, transcribe every number exactly
   - **links** - fetch, keep the facts, record the fetch date
   - **YouTube** - the `transcribe` skill
4. Report in 5 lines or fewer what the video is about.
5. Name every gap as a question, then stop.

## Why the brain-dump stays verbatim

Its messiness carries information. A thing said twice matters. An aside is often
the real hook. A trailing sentence marks where the owner was unsure. Tidying it
destroys all three, and the outline then reads like a spec sheet.

## Do not

- Search the web to fill a gap. Ask the owner.
- Fact-check a claim already in `knowledge.md`.
- Leave a source as a URL or an image path. If it is not text in
  `knowledge.md`, the next step cannot see it.
