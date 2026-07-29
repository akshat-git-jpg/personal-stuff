# 060 · place avatar · [LLM] (Sonnet default; same pluggability as 030)

Decide which stretches of the video the **full-screen avatar** speaks. Spans are
planned around the RESOLVED fullframe cards. Corner avatar + screen recording is
the implicit baseline everywhere else (design doc:
`docs/specs/2026-07-18-avatar-shot-plan-design.md`).

**Runs BEFORE the 080 storyboard gate** (owner decision 2026-07-25,
decisions.md). The owner reviews graphics and avatar together in one sitting, so
the spans must already exist when the board opens. This step therefore reads
`resolved.json` while `cues.json` is still `approved: false` — approval for BOTH
cues and shots happens at 080, not before.

- **In:** `node lib/transcript-text.mjs <slug>` output + `videos/<slug>/resolved.json` (resolved cues; approval comes later, at 080)
- **Out:** `videos/<slug>/shots.json` → snapshot the converged LLM output to `shots.llm.json` (committed, immutable) before any owner edit
- **How:** paste **the prompt only** (`shot-pass-prompt.md`, placeholders filled) into the executor
  session. It is self-contained; `RULEBOOK.md` is the judgment archive the 130 fold maintains.
  Fix-loop: `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`,
  feed errors back verbatim, ≤3 rounds; errors surviving round 3 escalate to the owner.

  Fill `<SIDE_CAPABLE_CARDS>` with:

  ```bash
  node -e "const c=require('../../../card-library/catalog.json');const s=(c.cards||[]).filter(x=>x.placement==='fullframe'&&x.side===true).map(x=>'- '+x.slug);console.log(s.length?s.join('\n'):'(none yet — no side spans may be planned)')"
  ```
- **Pre-flight:** `node lib/feedback-status.mjs` must exit 0 (unfolded feedback = unapplied lessons), and `resolved.json` must be fresh for the current `cues.json`. Do NOT require `cues.json approved: true` — under the 2026-07-25 review model this step runs before that approval exists.
- **Next:** owner reviews spans on the board (step 080), then avatar render (step 100).
