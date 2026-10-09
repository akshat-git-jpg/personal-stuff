# Step 040 — polish script for delivery (subjective; Claude applies this)

Input: the cleaned transcript from step 2.
Output: an improved script + a short change-log, kept as a **separate** file so the cleaned
version is never lost.

This is the one creative, judgment step. Claude rewrites the parts that genuinely need it
from a script-writing / storytelling point of view — but **lightly**. The goal is a crisper,
more engaging version of *the same tutorial*, not a different script.

Runs on every video by default. Because it self-limits to small edits, a script that's
already tight passes through mostly untouched — being "on" doesn't mean it changes much.

## The golden rule
**Improve delivery, not substance. Change only what clearly helps. When in doubt, leave it.**

This script is welded to a screen recording — the tutorial was recorded while these words
were spoken. So you are polishing *how* it's said, never *what* is being done on screen.

## Safe to improve
- **The hook** (first ~15 seconds) — make the opening pull the viewer in. Freestyle openings
  are usually the weakest part and the safest to sharpen.
- **Transitions** between sections — smooth the jumps ("okay so now…" → a cleaner bridge).
- **Rambling / repetition** — cut sentences that circle the same point; tighten wordy ones.
- **Awkward or unclear phrasing** — make an instruction read cleanly without changing it.
- **The outro / CTA** — land the ending and the call to action.

## Protected — never change
- **What's on screen.** If a line describes an action ("click the blue button", "open the
  model selector"), it must still describe *that exact action*. Reword the sentence, never
  the thing being pointed at.
- **The order of steps.** They follow the recording. Don't reorder.
- **Substance.** Don't add steps, claims, or facts that weren't in the original; don't remove
  a real step. No inventing.
- **Names, numbers, technical accuracy.** Those belong to step 2 / the pronunciation map.
- **Overall length.** Keep it roughly the same so the editor's sync still holds. Don't bloat
  or gut it.

## Restraint check
If you're rewriting more than ~20–30% of the sentences, you've gone too far — back off. Most
of the script should pass through untouched. A good pass is mostly small surgical edits plus
a stronger hook and ending.

## Output
- Write `<video>.improved.txt` — don't overwrite the cleaned version.
- Append a short **change-log**: a few bullets on what you changed and why (hook reworked,
  three rambly sentences cut, transition at section 2 smoothed). This lets a human scan the
  edits and revert any they don't like.

## Order note
Runs **after** step 030 (clean text in). If a rewrite introduces a new number or name, give it
the step-2 treatment (spell out / map) before TTS — number-and-name normalization is always
the last thing before synthesis.

## Segment Map
ALSO write `output/<base>.segments.json` mapping each polished sentence block to its raw video span:
```json
[
  {
    "seg_id": "s01",
    "kind": "screen",
    "raw_start": 12.40,
    "raw_end": 41.92,
    "script_text": "The polished sentences belonging to this block."
  }
]
```

Boundary rules:
1. Block boundaries may sit only where the raw ASR transcript (`../../2-recording/020-transcribe-video-to-text-run/output/<base>.transcript.json`) shows a silence gap of at least 1.0s, or at a brief-section change.
2. Every sentence of `improved.txt` belongs to exactly one segment, in order.
3. `raw_start`/`raw_end` come from the ASR word timestamps of the first/last raw word the block was derived from.
4. `kind` is `"a4_block"` only for blocks the avatar plan will render fullscreen (intro, verdicts, conclusion), else `"screen"`.
Output: Write `output/<base>.segments.json` per the schema above.
