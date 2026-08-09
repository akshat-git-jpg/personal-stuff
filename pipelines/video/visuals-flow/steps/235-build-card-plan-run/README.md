# 235 · build the card plan · [RUN]

**A REPORT, NOT A GATE (plan 195).** Every card the video will use — body, intro and conclusion
— in one list, each marked EXISTING or NEW-to-build, with the spec of any
proposed new card. New cards are judged built and in context at the 080 storyboard.

- **In:** `videos/<slug>/cues.json` (both passes: 030 body + 035 zones),
  `card-library/catalog.json`
- **Out:** `videos/<slug>/card-plan.json`
- **Run:** `bash run.sh <slug> card-plan`
- **What it blocks:** Nothing. The 080 storyboard gate handles approval.
- **Next:** step 038 builds whatever came out NEW. If nothing is NEW, go
  straight to `run.sh <slug> resolve` (step 040).

## Why this report, here

**Build-vs-reuse is the cheapest decision in the pipeline and the most expensive
to defer.** Killing a proposed card here costs one line. Discovering at the Final
Cut that the card was wrong costs a re-author, a re-render and a re-assemble.

**It reads `cues.json`, not `resolved.json`** — that is the whole point. A cue
naming a card that does not exist yet can never appear in `resolved.json`,
because `resolve.mjs` refuses unknown cards and writes nothing. The old
zone-only gate read `resolved.json`, so its "NEW — to build" chip could only
ever fire for a card somebody had already hand-built. It was downstream of the
decision it existed to make.

**No timestamps here, and that is deliberate.** Cues carry anchor phrases, not
seconds; 040 is what puts them on a clock. The question this gate asks is *is
this the right card for this clause*, which the anchor answers better than a
timecode would.

## Replaces step 070

070 (`approve-intro-outro`) was this gate scoped to the intro and conclusion
only, which left the body's build-vs-reuse call unmade by anybody. Generalising
it to the whole video left 070 with no remaining job, so it is gone. The human
gate count is unchanged: **037, 080, 120**.

The intro/conclusion keep their own rulebook, their own numbers and their own
pass — only the approval *surface* merged. Nothing about the 2026-07-29
separation changed.

## Say why, not just yes or no

Every card has a note box, and every section has one for the section as a whole.
What you write is routed by **which section the card is in**, and the routing is
the owner's standing instruction (2026-07-29) — a zone lesson must never edit
the body's rulebook, and the reverse:

| Section | Feedback key | Folds into |
|---|---|---|
| intro | `zone-intro:<n>` | `steps/220-author-conclusion-cues-llm/RULEBOOK.md` |
| conclusion | `zone-conclusion:<n>` | same — the zone rulebook |
| body | `card-body:<n>` | `steps/030-pick-or-propose-graphics-llm/RULEBOOK.md` |

Rejecting a card without a note teaches the pipeline nothing and the same card
comes back on the next video. That was the actual behaviour until 2026-07-29.

## What to look for

- **A NEW card you do not want.** Say so in the note — that is a rule, not a
  one-off. The card is never built.
- **A NEW card you do want.** Approve it. 038 builds it into the shared
  collection and the body can use it on the next video too.
- **An existing card doing the wrong job.** The classic failure is settling for
  the nearest card because the catalog is short. If the honest answer is a card
  that does not exist, the pass should have proposed one — say that.
- **A repeated semantic slot using different cards.** Parallel items (the
  section opener for each compared tool) must use the SAME card. Mixing is a
  defect, not variety.
- **Anything flagged.** A flagged cue is the pass telling you it had no good
  answer.

**Not a checklist.** What belongs in an intro is a judgment call about that
script; this gate checks that cards were *chosen deliberately*, not that
particular slots are filled (owner ruling, `decisions.md` 2026-07-28).

## A still preview approves a LOOK, and only a look (owner fold, 2026-08-02)

When a NEW card is approved from an image — a Gemini/Flow prompt preview, a
mockup, a reference screenshot — that approval covers its palette, its
composition and its mood. It does **not** cover anything a still cannot show:

- **The motion device.** A still cannot show what moves, or what the motion
  costs the rest of the frame.
- **The absence of content.** A still of an empty frame and a still of a frame
  whose content has not been written look identical.

So a card whose whole device is motion, or whose defining property is that it
carries no text, is **not approved until someone watches it render**. Build it,
render it, and put the clip in front of the owner before it ships in a cut.

`enacted/promise-shelf` is the case that produced this rule. The owner approved
a Gemini still on 2026-08-01 — five lit pedestals, one in sharp focus, "no text
anywhere" — and the card was built exactly to it. Seeing it move, the owner
rejected both of the things the still could not convey: the depth-of-field pull
("all gets blury") and the empty plinths ("just icons and no info, no actual
content"). Nobody was wrong at any step; the approval simply never covered what
was being approved.
