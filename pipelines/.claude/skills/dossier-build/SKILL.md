---
name: dossier-build
description: Analyze every fetched-but-unprocessed video transcript (discovering every tool/software each one mentions), then fold the results into each affected tool's persistent dossier under pipelines/youtube/dossiers/tools/. One trigger does the full catch-up pass -- extract then merge, always together. Triggers on "build dossiers", "update dossiers", "dossier-build".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# dossier-build - analyze + merge, one pass

Full design: `pipelines/youtube/dossiers/CLAUDE.md`. Every invocation does
BOTH steps below, always together -- there is no separate "just extract" or
"just merge" trigger.

## Step 1 -- pick execution method + model, confirm

Check pending videos via `registry.pending_extraction()` (`pipelines/youtube/dossiers/registry.py`).

If the list is non-empty, ask the owner (one message): execution method --
`agy` or a Claude Code subagent -- and which model. Show the last choice used
(if `pipelines/youtube/dossiers/.last-method.json` exists, read
`{"method": "...", "model": "..."}` from it) as the suggested default. State
the pending video count and confirm before proceeding. After the owner
answers, write their choice back to `.last-method.json` for next time.

Never call a raw paid API directly (no direct Gemini/OpenAI REST calls) --
only `agy` or a subagent, both subscription-backed.

## Step 2 -- extract

For each video id in `registry.pending_extraction()`:

1. Read `pipelines/youtube/dossiers/videos/<id>/transcript.md` and `meta.json` (for `title`/`channel`/`published`).
2. Build the prompt: `prompts.EXTRACTION_PROMPT.format(video_id=id, title=meta["title"], channel=meta["channel"], published=meta["published"], transcript=transcript_text)`.
3. Run it with the chosen method:
   - **agy**: `agy -p "<prompt>" --output-format json --model "<model>"` (direct CLI call -- NOT `tooling/boss/executors/agy.sh`, which is built for boss's async worktree/PR workflow and doesn't fit a synchronous single-prompt call). Capture stdout, pass to `registry.parse_agy_envelope(stdout)`.
   - **subagent**: dispatch a Task/Agent-tool subagent with the prompt and the chosen model; take its final text message, pass to `registry.parse_extraction_output(text)`.
4. On a `registry.ParseError`: print one error line with the reason, leave this video's `extracted` as `false`, continue to the next video -- don't block the batch.
5. On success: write `pipelines/youtube/dossiers/videos/<id>/extraction.md` -- one `##` section per tool in the parsed `tools[]` array, using `prompts.TOOL_SCHEMA`'s field names as subheadings, one bullet per item with its `ts` leading (e.g. `- [12:34] plan: VPS 1 -- price: $4.99/mo`). For each tool in `tools[]`, call `registry.match_tool(tool_name, aliases)`:
   - `("exact", slug)` -- this video mentions `slug`.
   - `("near", slug)` -- hold this tool's data out of `merged_into` for now; add it to the run's "near-duplicate" list (candidate name + matched slug) instead of seeding a status entry.
   - `("none", slug)` -- new tool; note it in the run's "new tools" list; this video mentions `slug`.
6. Update `meta.json`: `extracted: true`, `merged_into` seeded `false` for every exact/none-matched tool slug from this video (never for near-duplicates, which stay pending until the owner resolves them -- re-run `dossier-build` after that to pick them up).

## Step 3 -- merge

For each tool slug in `registry.all_pending_tools()`:

1. Gather `pending = registry.pending_merge_for_tool(slug)`.
2. Read each pending video's `extraction.md`, take only that tool's section.
3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if the tool folder is new (create `tools/<slug>/tool.json` with `{"name", "aliases"}` from the first video's `tools[]` entry for this slug).
4. Build the prompt: `prompts.MERGE_PROMPT.format(tool_name=..., date=today, n=len(pending), dossier=current_text, extractions=concatenated_sections, total_sources=...)`.
5. Run it with the same method+model chosen in Step 1 (agy direct CLI or subagent, same as extraction). Take the raw markdown response.
6. Run `registry.merge_guard(current_text, response, pending)`. If it fails: print the reason, leave `merged_into[slug]` unchanged for every video in `pending`, move to the next tool.
7. If it passes: **write `dossier.md` first**, then flip `merged_into[slug] = true` for every video in `pending` (write-then-flip order -- a crash between these two steps just means the next run re-detects and safely re-merges those videos; the merge prompt's corroboration rule collapses a re-seen claim rather than duplicating it).

## Step 4 -- report

One summary: videos extracted (N), dossiers updated (tool names), new tool
folders created this run (for a quick accuracy scan), near-duplicate tool
names flagged (name -> matched slug, needs an owner decision), anything
skipped or failed with its reason.

## Related

- `dossier-transcripts` -- populates the videos this skill consumes.
- `pipelines/youtube/dossiers/prompts.py` -- `EXTRACTION_PROMPT`, `TOOL_SCHEMA`, `MERGE_PROMPT`, `DOSSIER_SKELETON`.
- `pipelines/youtube/dossiers/registry.py` -- all the bookkeeping/parsing/guard functions referenced above.
