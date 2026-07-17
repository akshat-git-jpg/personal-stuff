# 020 · cue-pass · [LLM] (pluggable: Sonnet default; agy/Antigravity allowed as form-fillers)

- **In:** `videos/<slug>/transcript.json`, `card-library/catalog.json`
- **Out:** `videos/<slug>/cues.json`
- **Run:** load `RULEBOOK.md` (the operating manual) and `cue-pass-prompt.md` (the
  model-agnostic prompt) into the executor; fill the prompt's `{{CATALOG}}` and
  `{{TRANSCRIPT}}` placeholders with `card-library/catalog.json` and
  `transcript.json`; write the raw JSON output to `videos/<slug>/cues.json`.
- **Next:** step 030 resolves `cues.json` into absolute times

This is the only step with a judgment call — everything else in the pipeline is
scripted and costs zero tokens. See `RULEBOOK.md` for the full rubric (density,
anchors, beats, flagged cues) and `cue-pass-prompt.md` for the compressed prompt
handed to whichever executor runs the pass.
