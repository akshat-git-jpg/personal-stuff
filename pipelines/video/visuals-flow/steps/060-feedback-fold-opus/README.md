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

1. Collect feedback from two inputs:
   - **Explicit (typed)**: pending items from `node lib/feedback-status.mjs`.
   - **Implicit (edits)**: run `node lib/edit-delta.mjs <slug>` for each video reviewed since the last fold. Treat systematic edits (the same kind of change 3+ times, e.g. reveals consistently shortened, holds consistently raised) as feedback items to fold. Treat one-off edits as already-applied instance fixes needing no rule.
2. For each item, decide WHERE the lesson lives, and edit that surface:
   - selection/timing/density mistake → `steps/020-cue-pass-llm/RULEBOOK.md`
     AND the compressed rule in `cue-pass-prompt.md` (both, always — the prompt
     is what the model actually sees)
   - quantitative selection rule (caps, spacing, zones, density) → `lib/lint-cues.mjs` thresholds
   - visual/design mistake → `card-library/DESIGN.md`, or the card itself
   - wrong card contract (shapes, limits, purpose wording) → `card-library/catalog.json`
     (machine-enforced surfaces beat prose — prefer a catalog field + resolver
     validation over a rulebook sentence when both could work)
   - flow/tooling mistake → the step README or lib script involved
3. Run the gates the edits touch: `node lib/check-rulebook.mjs`, board/resolver
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
- `applied` — set by whoever performs the this-video edit (usually the next Claude session or 060 itself).
- `folded` — set when the lesson becomes a rule.

## Why a smart model

Folding is generalization: "stat-hit appears 5 times and looks odd" must become
a RULE ("dedicated caps for repeated overlays; spacing minimums") — not a
one-video patch. Cheap models patch; the folder must generalize, spot conflicts
with existing rules, and know which surface makes the lesson self-enforcing.
