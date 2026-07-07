# Rulebook — 2/010 write-script

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` and `--topic "<topic>"` from the operator (or read
   `<topic>` from `../../0-input/010-create-drive-folders-run/output/*.manifest.json`
   if only `--slug` was given).
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/script-style-dna.md`
   exists. If it does not, STOP here and tell the operator:
   "No script-style-dna.md for '<slug>'. Run yt-style-copy build-script-style-dna
   <slug> first (requires transcripts/ to be non-empty), then re-run this step."
   Do not proceed.
3. Invoke the `yt-style-copy` skill's `write-script <slug> "<topic>"` verb
   exactly as documented in `pipelines/.claude/skills/yt-style-copy/SKILL.md`.
   This has its OWN internal two-pass gate: it drafts `outline.md` and STOPS
   for your explicit approval before drafting the full `script.md`. Approve
   the outline, then let it produce `script.md` (with the QC scorecard already
   appended as a trailing HTML comment — do not look for a separate scorecard
   file).
4. Find the produced file: glob
   `pipelines/youtube/competitor-styles/channels/<slug>/output/scripts/*/script.md`,
   sorted by modification time, take the newest (it was just created in this
   same session). Copy it — unmodified, HTML comment included — to
   `./output/<base>.script.md` in THIS step's own output folder, where
   `<base>` is the safe-name of the topic (alnum + spaces/`-_.` kept, else
   replaced with `_`; see `0-input/010`'s `safe()` function for the exact
   transform — reuse it, do not reinvent a different one).
5. Report to the operator: the slug used, the word count of the copied script,
   and the rubric scorecard's pass/fail line from the trailing HTML comment.
