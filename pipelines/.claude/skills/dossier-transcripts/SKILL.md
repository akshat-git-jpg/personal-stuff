---
name: dossier-transcripts
description: Fetch transcripts for a batch of YouTube links into the shared dossiers video store (pipelines/youtube/dossiers/videos/), skipping anything already fetched. Feeds dossier-build. Triggers on "fetch transcripts for these videos", "get transcripts:", "dossier-transcripts".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# dossier-transcripts - batch transcript intake

Not an LLM task - mechanical. Input: any number of YouTube links or ids
(typically 10-25, no hard cap).

For each link:

1. Compute the video id via `common.transcribe.video_id_from(link)`.
2. If `pipelines/youtube/dossiers/videos/<id>/meta.json` already exists, skip -- note it as "already fetched" in the summary. Do not re-fetch.
3. Otherwise call the `transcribe` skill's fetch (`cd pipelines && python3 -m common.transcribe fetch <link> --out-dir youtube/dossiers/videos/<id>`), then write `pipelines/youtube/dossiers/videos/<id>/meta.json`:

   ```json
   {
     "id": "<id>",
     "url": "<original link as given>",
     "title": "",
     "channel": "",
     "published": "",
     "fetched_at": "<today, YYYY-MM-DD>",
     "transcript_method": "<captions|groq|local, from the fetch call's JSON output>",
     "extracted": false,
     "merged_into": {}
   }
   ```

   `title`/`channel`/`published` are best-effort: leave them empty strings if
   not available from the link alone -- `dossier-build`'s extraction step
   reads them from the transcript itself and doesn't require them pre-filled.

4. If the fetch call fails (all 3 transcribe methods failed), record the link as a hard failure with the error message; do not create a `meta.json` for it; move to the next link.

## Final report

One summary: `N new fetched (method used per video), M skipped (already had), K failed (reason)`.

## Related

- `transcribe` -- the fallback-chain fetch this skill calls.
- `dossier-build` -- the next step; picks up every video this skill fetches.
