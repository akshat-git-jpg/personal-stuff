# 2/020 · review-script  ·  [HUMAN]

Read `../010-write-script-opus/output/<base>.script.md` in full.

- **Resolve every `[VERIFY: …]` placeholder** — either replace it with a real,
  checked fact, or delete the claim entirely. `030-clean-script-for-tts-run`
  hard-fails if any `[VERIFY:` substring survives, by design — this is the
  gate that must catch them, not a later step.
- **Check the trailing rubric scorecard** (an HTML comment at the bottom of
  `script.md`) for any failing check; decide if it's acceptable or needs a
  rewrite pass back at 010.
- **Approve** by proceeding to step 030. There is no separate approval file —
  approval is simply choosing to run the next step.

This is separate from — and comes AFTER — `write-script`'s own internal
outline-approval gate (which already happened inside step 010, before the
full script was drafted).
