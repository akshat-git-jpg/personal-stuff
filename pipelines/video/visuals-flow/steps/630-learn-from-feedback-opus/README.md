# 630 · learn from the feedback · [OPUS] (the learning step)

Owner feedback must never be applied ad-hoc and forgotten — this step is the
guarantee that a correction given once is never needed twice.

- **In:** every `videos/*/feedback.json` with unfolded items, owner feedback given
  in chat, and new findings in `tests/TESTS.md`
- **Out:** edits to the four rule surfaces, each feedback item marked folded
- **Actor:** an **Opus-class session** (owner decision 2026-07-18 — folding
  feedback into durable rules is judgment work; never route it to the cheap loop)
- **Run:** owner says "fold the feedback" (or it runs at the end of any session
  where feedback was given)

## A folded lesson must be traceable to what the owner said

**Owner correction, 2026-07-30.** The owner rejected a built card as *"not
intuitive, complicated to follow"*. The session recorded that as two general rules
— "an intro card gets ONE moving idea" and "prefer reusing a proven enacted card
over commissioning a device" — and the owner had to come back with *"this rule is
not required, my feedback was [the narrower thing]"*.

Both invented rules were wrong, and the second was worse than wrong: it
contradicted `R_ZONE_SHARED_CATALOG`, which states that commissioning a new card
is "an expected outcome, not a last resort". It would have been folded into the
same rulebook that says the opposite, and every later pass would have inherited
the contradiction.

Nothing in this step or in `appendCardPlanFeedback` prevented it: the stored text
is whatever the session writes, and the fold applies it.

So, before a lesson is written to any surface:

1. **Quote, do not paraphrase.** The recorded item must contain the owner's own
   words. If the lesson is broader than what they said, that widening is a
   proposal to raise in Phase 3 — not something to record as their instruction.
2. **Scope to the evidence.** One rejection is evidence about that one artifact.
   A standing rule needs either the owner saying so or the same rejection three
   times (the same threshold this step already uses for implicit edits).
3. **Contradiction-check.** Grep the target surface and its siblings for a rule
   the new lesson would reverse. If one exists, it is a conflict for the owner to
   settle, not a silent overwrite — the same instruction Phase 3 already carries.

## Procedure

1. Collect feedback from two inputs:
   - **Explicit (typed)**: pending items from `node lib/feedback-status.mjs`.
   - **Implicit (edits)**: run `node lib/edit-delta.mjs <slug>` for each video reviewed since the last fold. Treat systematic edits (the same kind of change 3+ times, e.g. reveals consistently shortened, holds consistently raised) as feedback items to fold. Treat one-off edits as already-applied instance fixes needing no rule.
2. For each item, decide WHERE the lesson lives, and edit that surface:
   - **intro items** (`intro:*`) route to `TASTE-INTRO.md` or the 025 authoring contract. Body items never do. See `pipelines/.claude/skills/visuals-flow-feedback/SKILL.md` for the full intro routing rule.
   - **any item keyed `zone-intro:*` / `zone-conclusion:*` (raised at the 037
     card-plan gate, or anywhere else about a zone) →
     `steps/035-pick-or-propose-intro-outro-llm/RULEBOOK.md` and
     `lib/zone-rules.mjs` / `lib/zone-constants.mjs`, then
     `node lib/build-zone-prompt.mjs`. NEVER into the body's rulebook.** The
     separation is the owner's explicit instruction (2026-07-29): intro and
     conclusion have their own rules, guidelines and execution. A zone lesson
     that edits `lib/cue-rules.mjs` re-couples what this split exists to
     separate — and the reverse is equally wrong: a body lesson never edits the
     zone rulebook. **The key is the routing**, not the gate it came from: 037
     raises both kinds, and the prefix is what tells them apart.
   - selection/timing/density mistake **in the body** — including items keyed
     `card-body:*` from the 037 gate → `steps/030-pick-or-propose-graphics-llm/RULEBOOK.md`
     AND the compressed rule in `cue-pass-prompt.md` (both, always — the prompt
     is what the model actually sees)
   - **"this card should exist" / "stop proposing this kind of card"** → the
     `R_CHOOSING` propose clause in `lib/cue-rules.mjs` (body) or
     `R_ZONE_SHARED_CATALOG` in `lib/zone-rules.mjs` (zones), then rebuild the
     prompt. A rejected proposal that changes no rule comes back next video.
   - quantitative selection rule (caps, spacing, zones, density) → `lib/lint-cues.mjs` thresholds
   - visual/design mistake → `card-library/DESIGN.md`, or the card itself
   - wrong card contract (shapes, limits, purpose wording) → `card-library/catalog.json`
     (machine-enforced surfaces beat prose — prefer a catalog field + resolver
     validation over a rulebook sentence when both could work)
   - flow/tooling mistake → the step README or lib script involved
3. Run the gates the edits touch: `node lib/check-rulebook.mjs`,
   `node lib/check-zone-rulebook.mjs` if a zone surface changed, board/resolver
   tests, `card-library/scripts/beat-smoke.sh` if catalog changed.
4. Mark each item in its feedback.json to indicate it is DONE. An item is DONE only when it carries `applied`, `folded`, or an explicit marker indicating it wasn't needed.
   - `applied`: `<date> — <what was edited in cues.json>` (or `"<date> — not needed"`)
   - `folded`: `<date> — <what rule was changed>` (or `"<date> — instance-only, no rule"`)
   Items needing both get both. The board treats folded items as read-only history.
5. Append one dated line per lesson to `tests/TESTS.md` under a `## Folded lessons`
   section (provenance: what feedback → which rule).
6. Append ONE metrics line per video to `tests/TESTS.md` under a `## Convergence` section:
   `- <date> <slug>: llm=<N> approved=<M> edited=<K> added=<A> removed=<R> typed=<count of feedback items> flags=<flagged count> lint-warnings=<count or n/a>`
   (Numbers come from edit-delta's totals, feedback.json, cues.json, and `node lib/lint-cues.mjs <slug>`). The trend everyone watches: `edited` and `typed` falling video over video.
7. Commit everything together (`fold(visuals-flow): <summary>`).

## Item Schema (feedback.json)

```json
"c05": {
  "text": "reveal 3 too wordy",
  "added": "2026-07-18",
  "context": { "card": "pros-cons/pros-cons", "anchor": "let's look at the pros", "start": 312.4 },
  "applied": "2026-07-19 — shortened reveal 3 in cues.json",
  "folded":  "2026-07-19 — RULEBOOK Beats: reveal wording rule"
}
```
- `context` — snapshotted automatically by the board at creation (card/anchor/start for cues, start/end/excerpt for gaps).
- `applied` — set by whoever performs the this-video edit (usually the next Claude session or 130 itself).
- `folded` — set when the lesson becomes a rule.

## Why a smart model

Folding is generalization: "stat-hit appears 5 times and looks odd" must become
a RULE ("dedicated caps for repeated overlays; spacing minimums") — not a
one-video patch. Cheap models patch; the folder must generalize, spot conflicts
with existing rules, and know which surface makes the lesson self-enforcing.
