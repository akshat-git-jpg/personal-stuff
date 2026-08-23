# 100 - write the final script

**[LLM]** &nbsp; Finalises his words into the VO-ready script.

`script-draft.md` -> `script.md` (human-readable) + `script.vo.txt` (the flattened engine feed, spoken lines only). Follows `SCRIPT-INSTRUCTIONS.md`. This is a FINALISE pass over someone else's words, not a fresh write - his phrasing survives unless it is wrong.

**Reads:** `script-draft.md`, `script-plan.md`, `knowledge.md`

**Writes:** `script.md`, `script.vo.txt`

---

## What happens

Read `SCRIPT-INSTRUCTIONS.md` in full. Read the approved `script-plan.md` and
`knowledge.md`. Every claim in his draft must trace back to `knowledge.md`.

Write `script.md`, then `script.vo.txt` - spoken lines only, nothing else, since
that file is step 120's only input.

## His words, not yours

This is the one big rule. He was there and you were not: he used the tool, saw
what it did, and wrote from that. Reword only what is wrong, unspeakable, or
unsupported by `knowledge.md`. Rewriting his draft into your voice throws away
the entire point of the handoff.

## Report the diff

List every line reworded, respelled or cut, and why. That list is what the owner
reads at 110.
