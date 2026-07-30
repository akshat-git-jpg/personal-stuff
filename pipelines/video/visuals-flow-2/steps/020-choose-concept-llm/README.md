# 020 · choose concept · [LLM]

This step authors the whole-video concept, establishing the core thesis, the recurring visual motif, and the register map (dark vs. light).

- **Inputs**: `transcript.json`, `segments.json`
- **Output**: `concept.json` (committed)
- **Gate**: `node lib/lint-concept.mjs <slug>` must exit 0 before proceeding to `030`. It checks the required fields, that every register anchor resolves in forward order, and — since 2026-07-30 — that the register map covers at least **80% of narration time** (`MIN_NARRATION_COVERAGE`). It prints the coverage figure on success. `segments.json` must exist, because narration time is measured from it.

**Why coverage is gated.** A cue in a stretch no register span reaches inherits no register, so its card falls back to its own default look and `E8 concept-register` has no span to check it against — the tone drifts with nobody watching. Same failure class as the 2026-07-24 bug where register never reached `VARS` and every card rendered its default. The floor was prose in the prompt and enforced by nobody until 2026-07-30.

The gate measures the spans produced by `lib/concept-spans.mjs`'s `spansFromRegisters` — the same spans that drive the `whip-reg` transitions — so the number enforced here always describes what actually renders. Note a span ends at its `to_anchor`'s FIRST word + 1.0s, not at the end of the anchor phrase.

**Coverage can be gamed and the gate cannot see it.** Merging two adjacent spans of the SAME register raises the percentage without changing a frame. Raise coverage by extending a span over uncovered narration instead.
