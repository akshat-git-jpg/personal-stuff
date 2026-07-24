# INTEGRATION.md — the caller contract

For any pipeline consuming visuals-flow as its graphics step (currently
`tutorial-pipeline-1` and `tutorial-pipeline-2`). Read `PIPELINE.md` first for
the flow itself; this doc is what changes when the caller is another pipeline
instead of a human running this folder directly.

## 1. What callers get

Hand visuals-flow a workdir containing a voiceover (or an existing
transcript) and it gives back `renders/*.mp4|mov` (final clips) plus
`manifest.md` (an editor-facing "place this file at this timecode" table).
Graphics reveal their content on the exact second the voiceover speaks each
point — driven by one LLM call per video; everything else is scripted and
free.

## 2. The workdir contract

The caller owns a directory anywhere on disk — a step-output folder inside
`tutorial-pipeline-1`/`-2` is fine, it does not need to live under this
pipeline's `videos/`. It must contain either:

- `vo.mp3` (or a `vo.mp4`/`.mov`/`.mkv`/`.m4a`/`.wav` for step 010 to
  ffmpeg-extract `vo.mp3` from), **or**
- a ready `transcript.json` — flat `[{text, start, end}]` word timestamps. If
  the calling pipeline already transcribed (both tutorial pipelines do, at
  their own numbered step), drop that transcript in this exact shape and
  **skip step 010** — never transcribe the same audio twice.

Everything the flow produces (`cues.json`, `resolved.json`, `manifest.md`,
`renders/`) lands back in that same directory. `videos/<slug>/` is just this
repo's local case of the same contract — nothing about it is special-cased in
the libs. Whether the caller commits or gitignores its workdir is the
caller's own policy; this flow has no opinion.

## 3. Invocation sequence

Every command below takes a slug (resolves under this pipeline's `videos/`)
or an external path (anything containing `/`, or an existing dir) — see
`resolveWorkdir` in each lib. Run from `pipelines/video/visuals-flow-2`:

```
bash steps/010-transcribe-run/run.sh <workdir>   # skip if transcript.json already exists
# 020 — see section 4
node lib/resolve.mjs <workdir>
node lib/lint-cues.mjs <workdir>
node lib/board.mjs <workdir>                     # OWNER gate — see section 5
node lib/render.mjs <workdir>
```

`resolve` and `lint` are the deterministic checks the cue pass must satisfy
before the board; `board` is where the owner approves; `render` refuses to
run against an unapproved `cues.json`.

## 4. Running the cue pass from another pipeline

Step 020 is the one judgment call in the whole flow — everything else above
is zero-token. Inside `tutorial-pipeline-2`'s conventions, this is a
`[SONNET]` step: a Claude Code session on model Sonnet, prompt =
`steps/020-cue-pass-llm/cue-pass-prompt.md` (self-contained; `RULEBOOK.md` is its
fold-maintained source, not a session input), inputs =
`node lib/transcript-text.mjs <workdir>` output + `card-library/catalog.json`,
output = `<workdir>/cues.json`.

After the session writes `cues.json`, run the deterministic fix-loop from
plan 072: `node lib/resolve.mjs <workdir> && node lib/lint-cues.mjs <workdir>`;
feed any errors back to the *same* session verbatim and re-run, up to 3
rounds. Errors surviving round 3 escalate to the owner rather than looping
forever. Model routing per HANDOFF.md's "Model routing" section: Sonnet is
the default; agy/Antigravity are approved to trial as free alternates.

## 5. The approval gate

The storyboard board (`node lib/board.mjs <workdir>`) is an OWNER step even
when the rest of the pipeline runs unattended — this does not become
automatic just because the caller is a pipeline instead of a human. After
plan 070, `render.mjs` hard-refuses `cues.json` with `approved !== true`.
Any edit made on the board after approval un-approves the cue (070
semantics) — the owner must re-approve, not just re-save. `render --force`
exists to bypass both the approval and freshness gates, but it is an owner
escape hatch, not something a caller invokes automatically.

## 6. `offset` for cold-opens

`cues.json`'s top-level `offset` (seconds, default 0) is VO-relative-to-final-
timeline placement, not a change to the clips themselves. If the calling
pipeline puts anything before the voiceover on its final timeline — a
cold-open, a title card — set `offset` to that lead-in's length before
render. All cue/beat times inside `cues.json`/`resolved.json` stay relative
to the VO's own start; `offset` only shifts `manifest.md`'s "place at"
column, so the editor always drops clips at real timeline timecodes. Changing
`offset` after render just means re-running `resolve` then `render` (or
hand-shifting the manifest's timecodes — the rendered clips don't change).

## 7. Versioning note

`cues.json`'s schema is owned by `PIPELINE.md`, not by this doc — this doc
links it, never restates it. Cards and `catalog.json` are owned by
`../card-library/`. Callers never edit either; if a schema or catalog change
is needed for an integration, that's a change to make in those owning files,
not a workaround in the caller.
