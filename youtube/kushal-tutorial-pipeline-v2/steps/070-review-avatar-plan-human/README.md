# 070 · review-avatar-plan-human  ·  [HUMAN gate]  ← the pre-spend gate

The last checkpoint **before TTS (GPU) and avatar generation (credits)**. Approving here locks the
avatar-block boundaries that step 080 chunks to — so changing your mind later means re-synth.

- **Review:** step 060's draft `../060-plan-avatar-blocks/output/<base>.avatar-plan.md`
- **On approval:** Claude finalizes `../060-plan-avatar-blocks/output/<base>.avatar-segments.json`
  (the handoff step 080 consumes). **Nothing has cost anything yet.**

## Checklist
- [ ] Full-screen budget looks right (est. total vs target; U-curve shape — heavy open, lean middle, heavy close).
- [ ] The passages chosen for full-screen are the *right* impactful moments (intro, verdicts, wrap, conclusion).
- [ ] Verbatim lines for each block read correctly.
- [ ] Nothing important left only on screen-rec that should have a host moment (or vice-versa).

## How to give feedback
Plain language — "tighten the intro", "add a beat in the Synthesia section", "drop the pricing-wrap
avatar". Claude revises the draft and re-totals the budget. Iterate until you say **approved**.

Drop notes/approval in `output/` if you want a record.
