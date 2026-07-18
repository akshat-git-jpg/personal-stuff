# 020 · cue-pass · [LLM] (pluggable: Sonnet default; agy/Antigravity allowed as form-fillers)

- **In:** `videos/<slug>/transcript.json`, `card-library/catalog.json`
- **Out:** `videos/<slug>/cues.json`
- **Pre-flight:** Before running a cue pass for ANY video: `node lib/feedback-status.mjs` — if it exits 1, fold first (step 060). Do not run a new cue pass over pending lessons.
- **Run:** load `RULEBOOK.md` (the operating manual) and `cue-pass-prompt.md` (the
  model-agnostic prompt) into the executor; fill the prompt's `{{CATALOG}}` and
  `{{TRANSCRIPT}}` placeholders with `card-library/catalog.json` and
  `transcript.json`; write the raw JSON output to `videos/<slug>/cues.json`.
- **Next:** step 030 resolves `cues.json` into absolute times. Fix-loop: run `node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>` — feed any errors back to the same executor and re-run, up to 3 rounds; errors after round 3 go to the owner. After the fix-loop converges, copy the final cues.json to `videos/<slug>/cues.llm.json` BEFORE any human/board edit. This file is committed and never edited afterward — it is the baseline the owner's edits are measured against.

This is the only step with a judgment call — everything else in the pipeline is
scripted and costs zero tokens. See `RULEBOOK.md` for the full rubric (density,
anchors, beats, flagged cues) and `cue-pass-prompt.md` for the compressed prompt
handed to whichever executor runs the pass.
