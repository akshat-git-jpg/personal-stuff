# 070 · shot-pass  ·  [LLM] (Sonnet default; same pluggability as 020)

Decide which stretches of the video the **full-screen avatar** speaks — AFTER the
graphics cues are approved, so spans are planned around fullframe cards. Corner
avatar + screen recording is the implicit baseline everywhere else (design doc:
`docs/specs/2026-07-18-avatar-shot-plan-design.md`).

- **In:** `node lib/transcript-text.mjs <slug>` output + `videos/<slug>/resolved.json` (approved cues)
- **Out:** `videos/<slug>/shots.json` → snapshot the converged LLM output to `shots.llm.json` (committed, immutable) before any owner edit
- **How:** paste **the prompt only** (`shot-pass-prompt.md`, placeholders filled) into the executor
  session. It is self-contained; `RULEBOOK.md` is the judgment archive the 060 fold maintains.
  Fix-loop: `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`,
  feed errors back verbatim, ≤3 rounds; errors surviving round 3 escalate to the owner.
- **Pre-flight:** `node lib/feedback-status.mjs` must exit 0 (unfolded feedback = unapplied lessons), and `cues.json` must have `approved: true`.
- **Next:** owner reviews spans on the board (plan 079), then avatar render (plan 080).
