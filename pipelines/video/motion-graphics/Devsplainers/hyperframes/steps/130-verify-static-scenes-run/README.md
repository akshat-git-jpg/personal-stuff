# 130 · verify-static-scenes · [RUN · gate · free]

**Job:** Render + lint every scene; pass/fail on color, font, watermark, canvas, and zero lint errors.

**In:** `videos/<slug>/scenes/*/index.html`
**Out:** a pass/fail report

**Run:** `node steps/130-verify-static-scenes-run/run.mjs --video <slug>` (→ `lib/verify-all.mjs`)
**Then:** any failures → short fix-prompt back to Antigravity (120); all pass → 140.

**Cost:** **None** (no LLM — this is how quality is gated without spending Opus).
