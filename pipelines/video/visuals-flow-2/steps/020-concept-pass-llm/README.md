# 020 · concept-pass · [LLM]

This step authors the whole-video concept, establishing the core thesis, the recurring visual motif, and the register map (dark vs. light).

- **Inputs**: `transcript.json`, `segments.json`
- **Output**: `concept.json` (committed)
- **Gate**: `node lib/lint-concept.mjs <slug>` must exit 0 before proceeding to `030`.
