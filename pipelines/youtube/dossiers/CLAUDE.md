# dossiers - persistent per-software research library

One transcript is fetched once (`videos/<id>/`); one dossier per tool
(`tools/<slug>/dossier.md`) accumulates cited facts from every video that
has mentioned it. Full design: `docs/superpowers/specs/2026-07-08-dossier-skills-design.md`.

## The three skills

1. **`transcribe`** - fallback-chain transcript fetch (captions -> Groq Whisper -> local Whisper). Callable standalone; also used by `dossier-transcripts`.
2. **`dossier-transcripts`** - batch-fetch links into `videos/<id>/` (mechanical, skips anything already fetched).
3. **`dossier-build`** - one trigger that extracts every pending video (discovering all tools it mentions) and merges the results into every affected tool's dossier, in one pass. Asks once per run which execution method (`agy` or a subagent) and model to use - never a direct paid API call.

## Layout

```
videos/<id>/       meta.json (fetch status, extracted flag, merged_into per tool) · transcript.md (gitignored) · extraction.md
tools/<slug>/      tool.json (canonical name + aliases) · dossier.md
```

## Status model

- `fetched` - transcript exists (global, independent of which tools it mentions).
- `extracted` - every tool the video mentions has been pulled into `extraction.md`; `merged_into` seeded per discovered tool.
- `merged_into.<tool>` - true once that tool's dossier has folded this video in.

A video mentioning 5 tools is fetched and analyzed ONCE; each of its 5 tools can be merged into its dossier independently, at different times.

## Hard rules

- Extraction/merge calls go through `agy` or a Claude Code subagent only - never a direct paid API.
- A tool folder is only auto-created on a genuinely new name; a near-duplicate name is held pending and flagged for the owner, never silently merged or split.
- `dossier.md` is written before `merged_into` is flipped - a crash between the two is safe to retry (see `registry.py`'s merge_guard and the `dossier-build` skill).
