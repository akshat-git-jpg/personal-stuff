# 060 · feedback-fold · [OPUS] (the learning step)

Owner feedback must never be applied ad-hoc and forgotten — this step is the
guarantee that a correction given once is never needed twice.

- **In:** every `videos/*/feedback.json` with unfolded items, owner feedback given
  in chat, and new findings in `tests/TESTS.md`
- **Out:** edits to the four rule surfaces, each feedback item marked folded
- **Actor:** an **Opus-class session** (owner decision 2026-07-18 — folding
  feedback into durable rules is judgment work; never route it to the cheap loop)
- **Run:** owner says "fold the feedback" (or it runs at the end of any session
  where feedback was given)

## Procedure

1. Collect unfolded feedback: `feedback.json` files where an item lacks
   `"folded"`, plus anything the owner said in chat this session.
2. For each item, decide WHERE the lesson lives, and edit that surface:
   - selection/timing/density mistake → `steps/020-cue-pass-llm/RULEBOOK.md`
     AND the compressed rule in `cue-pass-prompt.md` (both, always — the prompt
     is what the model actually sees)
   - visual/design mistake → `card-library/DESIGN.md`, or the card itself
   - wrong card contract (shapes, limits, purpose wording) → `card-library/catalog.json`
     (machine-enforced surfaces beat prose — prefer a catalog field + resolver
     validation over a rulebook sentence when both could work)
   - flow/tooling mistake → the step README or lib script involved
3. Run the gates the edits touch: `node lib/check-rulebook.mjs`, board/resolver
   tests, `card-library/scripts/beat-smoke.sh` if catalog changed.
4. Mark each folded item in its feedback.json by setting `folded` on the item
   object: `"c05": { "text": "...", "added": "2026-07-18", "folded": "2026-07-19 — RULEBOOK section 2" }`.
   The board treats folded items as read-only history — they can never be
   edited or deleted from the board again.
5. Append one dated line per lesson to `tests/TESTS.md` under a `## Folded lessons`
   section (provenance: what feedback → which rule).
6. Commit everything together (`fold(graphics-flow): <summary>`).

## Why a smart model

Folding is generalization: "stat-hit appears 5 times and looks odd" must become
a RULE ("dedicated caps for repeated overlays; spacing minimums") — not a
one-video patch. Cheap models patch; the folder must generalize, spot conflicts
with existing rules, and know which surface makes the lesson self-enforcing.
