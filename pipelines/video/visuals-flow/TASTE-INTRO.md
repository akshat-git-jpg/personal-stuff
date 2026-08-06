# TASTE-INTRO.md

Owner feedback, turned into rules. The author step reads this alongside
`card-library/DESIGN.md`. DESIGN.md is the brand contract and applies to
everything; this file is the accumulated record of what the owner has actually
rejected on screen.

Every rule names where it came from, so it can be retired when its cause is
gone rather than living forever by default.

**Enforced by** tells you whether a machine will catch a breach. Where it says
*author judgement*, nothing will stop you shipping the mistake again except
reading this file.

## How a rule gets here

Owner watches a cut and reacts. Each reaction becomes one numbered rule. If a
machine can state the rule, it also becomes a check in `run.sh <slug> intro-review`
and the rule records which one. If it cannot, it stays here as judgement, which
is still better than living only in a chat log.

A folded rule is appended by the 130 fold. It keeps the `From:` / `Enforced by:` shape, and cites the video and date it came from.

---

## T1 — No floating labels. Enact instead.

**From:** poc-01 v2, 2026-08-02. Owner: *"also remove for who, looks weird."*

An accent-outlined `FOR WHO` pill sat under the card row for roughly 25 seconds
of the film, drifting to a different position each beat because it was anchored
to nothing.

Two things were wrong. It was a label doing a graphic's job, which DESIGN.md
already forbids under "Enact, don't label". And it was the only pill in the
film, so it read as a stray UI button rather than part of the composition.

The viewer axis it stood for is a real idea and should stay. It needs to be a
shape the roster reacts to, not a word in a box.

**Enforced by:** author judgement.

## T2 — A winner device must visit every candidate, not sit on one.

**From:** poc-01 v2, 2026-08-02. Owner: *"for overall winner, can we move winner
card around all tools instead of just showing on synthesia."*

The gold crown descended once, over the middle card, and was refused there. It
reads as "Synthesia did not win". The narration says something stronger: there
is no overall winner at all.

A device that visits all five and is refused by each one enacts the actual
claim. One refusal enacts a different, weaker claim.

General form: when the narration makes a statement about *the whole set*, the
device has to touch the whole set.

**Enforced by:** author judgement.

## T3 — Text never crosses a graphic.

**From:** poc-01 v1, 2026-08-02. Owner: *"there are bugs here and there where
some text is overlapping with some motion graphic or something else."*

Recurring, and the single most common defect in this pipeline. Seen as rail
labels sitting on a card face, and as six agenda lines running under logo tiles.

**Enforced by:** `run.sh <slug> intro-review` — hyperframes `check` reports
`text_occluded` as an error and names both the text and the element covering it.
This check is only live because the composition's media was moved inside the
project directory; see `lib/intro-film/film-assets.mjs` for why.

## T4 — Every beat needs something at hero scale, not just the last one.

**From:** poc-01 v1, 2026-08-02. Owner: *"the text is very badly decided. its
font is bad, very small letters."*

The first film's largest text was 54px on a 1080p frame. The rewrite fixed the
declared scale (140px hero over a 44px body) but only spends it in one beat out
of twelve, so the film still reads small for 80 of its 87 seconds.

A compliant type scale that is never used is not a type scale.

**Enforced by:** `lib/intro-film/check-film-style.mjs` enforces the floor (hero >= 120px),
the spread (2.5x to 4x over body) and em-based tracking. It cannot tell whether
the hero ever appears. That half is author judgement.

## T5 — A full-bleed avatar buries whatever the beat is doing.

**From:** poc-01 v2, 2026-08-02. Owner, on the opening frame: *"in start, what
is this frame?"*

Beat 1 deals five candidate slots into frame while the avatar sits full-bleed at
1920x1080 and full opacity on top of them. The beat's entire content happens
behind an opaque person, so the opening reads as nothing happening.

`face: "full"` means the presenter leads the frame. It does not mean the
presenter covers it. Inset the portrait, or start the beat's staging after the
avatar has docked.

**Enforced by:** author judgement.

## T6 — A set at rest must look level. Ragged means broken, not "not yet".

**From:** poc-01 v2, 2026-08-02, found in review.

During the roll call the cast cards sit large and level while the uncast ones
float at different heights and rotations, one of them near the top corner. The
intent was "not yet cast". It reads as a layout bug.

Difference between states has to be carried by something that reads as
deliberate: opacity, fill, a dashed well. Not by position noise.

**Enforced by:** author judgement.

## T7 — A rule that crosses the frame must not cross a card face.

**From:** poc-01 v2, 2026-08-02, found in review.

The four assessment rails are drawn at a fixed height across the full width, so
they cut straight through the middle of every card in the row, and their labels
crowd the leftmost card.

A rail either passes between objects or stops at them.

**Enforced by:** partially. `text_occluded` catches the label collision. Nothing
catches a line crossing a shape.

## T8 — Fill the frame. The middle 50% is not the frame.

**From:** poc-01 v2, 2026-08-02, found in review.

Almost every beat puts its content in a band across the centre with large dead
margins above and below. Combined with T4 this is most of why the film reads
small even at a compliant type scale.

**Enforced by:** author judgement.

## T9 — A device has to be visible at viewing scale, not just present in the DOM.

**From:** poc-01 v3, 2026-08-02, found by reading beat frames against their stage
lines.

The four assessment rails were 2px at 20% opacity. They were in the composition,
they animated correctly, they passed every mechanical check, and on screen they
were not there. An entire beat's device was missing and three review passes had
not noticed, because nothing that measures a DOM can tell you a line is too
faint to see.

Same class: the viewer marker started as a 38px triangle and read as a speck.

Before shipping a device, look at the frame and ask whether you can see it
without knowing where to look.

**Enforced by:** author judgement, and only the beat-frame read will catch it.

## T10 — Review every beat at more than one moment.

**From:** poc-01 v3, 2026-08-02.

The review sampled one frame at each beat's midpoint. Three beats out of twelve
put their content in the last third — the verdict marks at 56.95s and 58.15s in
a beat sampled at 56.73s, the scorecard callback, the closing roster re-form.
All three were invisible to the pass built to catch them, which is why the film
reviewed cleaner than it was.

`beatSampleTimes` now takes three frames per beat at 25%, 55% and 85%. Edges are
still avoided because a beat's transition is resolving there.

**Enforced by:** `lib/intro-film/review-film.mjs`, with a regression test pinned to the
b08 case.

## T11 — A device belongs to its beat. Dimming is not leaving.

**From:** consistent-ai-influencer, 2026-08-04. Owner, on a b05 frame: *"why this
overlapping are there"*.

Beat 4's rail and three dashed sponsor slots were dimmed to 30% opacity when beat
5 began, rather than removed. Beat 5's row of four cards spans x120-1680 and its
fourth slot sits exactly on the mark column at x1420-1572, so for twelve seconds
the dashed slots read straight through a card whose fill is only 8.5% white.

Two lessons, and the second is the general one:

- **Space could not fix it.** The row occupies 81% of the canvas; there is no
  horizontal band free in both beats. Devices that cannot be separated in space
  must be mutually exclusive in TIME.
- **A dimmed element is still a drawn element.** `opacity: 0.3` on a stroke over a
  translucent surface is clearly visible. When a device's beat ends, it leaves —
  `autoAlpha: 0`, which also sets `visibility: hidden`. Keep a device alive across
  beats only when it is deliberately carried, and then it is a `carries` object
  with a stated transform, not a leftover.

**Enforced by:** the device-overlap audit in the film composition — at each beat
midpoint it compares the bounding boxes of every visible top-level device and
reports intersections as runtime errors, which `run.sh <slug> intro-review`
surfaces. This is the half of T7 that nothing used to catch. It found a second
defect on the same pass: the beat-11 score column used a 76px pitch on 78px rows.


## T12 — Never use system-UI vocabulary as final art.

A dashed box means "drop content here". A grey circle-plus-blob means "no avatar
set". An accent arc filling a ring means "loading". These are not neutral shapes
that happen to be common — they are the agreed signs for *nothing is here yet*.
Used as finished art they tell the viewer the film is unfinished, no matter what
the author intended them to mean.

**From:** the owner, three times on the same film — the dashed sponsor wells and
the grey silhouettes ("they look like placeholder", 2026-08-06), then the seal
("i dont like this orannge loading ui", 2026-08-07). Three separate defects, one
cause: reaching into the design-system drawer for shapes that are by definition
states of incompleteness.

The 2026-08-07 case is the instructive one, because the screenplay authored it.
Beat 7 asked for "an arc that is clearly incomplete by the end of the beat, so
the next beat has something to finish" — a legitimate plant/payoff instinct
across a beat boundary. But **every visual form of "incomplete" is a placeholder
or a wait state**; that is what incomplete means. There is no way to draw
half-done that does not read as not-done. So:

- Do not write a stage direction that requires a half-finished object. Give the
  payoff beat a NEW object to deliver instead. A stamp that lands is a payoff; an
  arc that finishes filling is a progress bar completing.
- Anything that holds mid-gesture for more than about a second is a wait state.
  The arc sat 42% drawn for 6.2 seconds.
- Position carries meaning too. The screenplay said *lower* corner; it was built
  top-right, which is exactly where products park spinners and status badges. A
  screenplay/implementation divergence in placement can create the misread on its
  own.
- A logo is a mark PLUS a name. A lone glyph reads as a UI affordance — the same
  correction the sponsor tiles needed.

**Enforced by:** nothing automatic, and that is the point — every other gate here
is quantitative (duration, freeze, luma, contrast, occlusion, overlap) and all of
them pass a frame that is numerically perfect and semantically wrong. The only
check that catches this is a human reading the beat sheet on the intro board,
where each stage direction sits beside the frames it produced. Author against
this rule; do not expect `intro-review` to save you. When reviewing, read for
"is this the FORM the line asked for", not "did the beat happen".
