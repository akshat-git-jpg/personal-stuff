# Intro + conclusion rulebook — the WHY

This file holds **provenance and judgment**, never rule text. Every governed
number lives in `lib/zone-constants.mjs` and every governed rule in
`lib/zone-rules.mjs`; both are rendered into `zone-pass-prompt.md` by
`node lib/build-zone-prompt.mjs`, and `lib/check-zone-rulebook.mjs` fails the
gate if this file restates one of them verbatim. That is deliberate — a second
live copy of a rule is a copy that drifts.

The 130 fold maintains this file. Feedback given at the **070 intro/outro gate**
folds here and ONLY here; body feedback folds into
`steps/030-place-graphics-llm/RULEBOOK.md` and never reaches this file.

## Inputs and outputs

The pass reads the transcript, the shared card catalog, and the measured
`structure` spans. It writes cues carrying a `zone` field. The field is not
decoration: `W19 zone-authorship` uses it to prove the two passes stayed in
their own territory, and a zone cue whose anchor resolves outside its declared
zone is reported rather than silently accepted.

## What a zone is

A zone is **measured, not guessed**. The owner records every video as three
files — `intro.mp4`, `body.mp4`, `conclusion.mp4` — and `lib/source-structure.mjs`
turns their real durations into exact spans. Before that landed, the pipeline
re-derived structure from transcript keywords and got it wrong; the intro was
assumed to be the first 15 seconds when test-03's was 117.6.

There is no required shape for either zone. The owner ruled on this directly
(2026-07-28): *"its subjective. Pls dont make this hardcoded"*. So the rules
here constrain **quality** — motion, dead patches, stillness — and never
prescribe which beats an intro must contain. A checklist would produce five
filled slots and a bad intro.

## Motion is the bar

This is the load-bearing lesson, and it is counter-intuitive enough to be worth
stating plainly: **the rejected intro was denser than the body.**

Measured on test-03:

| | intro | body |
|---|---|---|
| cue rate | 3.57/min | 2.30/min |
| fullframe cards | 4 | — |
| of those, `enacted/` | 1 | — |
| longest fullframe-to-fullframe gap | 45.7s | — |
| longest static-footage run | ~20s | — |

Three of the four cards named their point (`title/`, `statement/`,
`table-of-contents/`) instead of enacting it, the 45.7s gap slipped through
because the body's limit is 45s, and the footage underneath sat still. Adding
*more* cues to that intro would have made it worse. Hence `W16` (enacted share),
`W15` (gap measured from the zone opening, not just card-to-card) and `W18`
(the footage itself). `W17` exists only so the rate cannot regress.

## Commissioning a new card

Expected, not exceptional. The owner has said twice that new motion graphics for
these zones are welcome — 2026-07-26 (*"Even if we need to create new motion
graphic i am ok"*) and again 2026-07-29 (*"more than open to make new graphics
for intro/conclusion"*). When nothing in the catalog does the job, flag the cue
and describe the card you want rather than settling for the nearest slate.

There is **one shared collection**. The owner rejected a zone-only card family
outright (2026-07-29: *"No need to restrict on templates. Also there will be one
template collection which body and intro,conclusion anyone can use"*), so a body
card is a legitimate choice in a zone and a card built for a zone is available
to the body afterwards. Choose on merit; never on provenance.

## Rubric

A zone is done when:

1. `node lib/lint-cues.mjs <slug>` reports no `W15`/`W16`/`W17`/`W19` for it.
2. `node lib/stillness.mjs <slug>` reports no `W18` (or *not applicable* when
   the video has no footage).
3. Walking the zone start to end, something is moving at every second — a card
   revealing beats, footage in motion, or the presenter. This is the human
   check the numbers approximate, and it is the one the owner actually applies.
4. Nothing was added purely to satisfy a floor.

## Folded lessons

Dated entries, newest last. One line per lesson: what the owner said → what
changed here.

- 2026-07-29 — zone rules split out of the shared cue rulebook entirely
  (`R_ZONES` retired from `lib/cue-rules.mjs`). Owner: *"i want intro conclusion
  steps to be very explicit and not tied with full body"*.
