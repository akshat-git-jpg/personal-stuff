# 160 · verify-motion-scenes · [RUN · gate · free]

**Job:** Re-verify each scene with motion — timeline present, still lint-clean, deterministic.

**In:** `videos/<slug>/scenes/*/index.html`
**Out:** a pass/fail report

**Run:** `node steps/160-verify-motion-scenes-run/run.mjs --video <slug>`
**Then:** failures → fix-prompt to Antigravity (150); all pass → 170.

**Cost:** **None** (no LLM).
