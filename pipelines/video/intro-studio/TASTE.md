# TASTE.md

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
machine can state the rule, it also becomes a check in `run.sh <slug> review`
and the rule records which one. If it cannot, it stays here as judgement, which
is still better than living only in a chat log.

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

**Enforced by:** `run.sh <slug> review` — hyperframes `check` reports
`text_occluded` as an error and names both the text and the element covering it.
This check is only live because the composition's media was moved inside the
project directory; see `lib/film-assets.mjs` for why.

## T4 — Every beat needs something at hero scale, not just the last one.

**From:** poc-01 v1, 2026-08-02. Owner: *"the text is very badly decided. its
font is bad, very small letters."*

The first film's largest text was 54px on a 1080p frame. The rewrite fixed the
declared scale (140px hero over a 44px body) but only spends it in one beat out
of twelve, so the film still reads small for 80 of its 87 seconds.

A compliant type scale that is never used is not a type scale.

**Enforced by:** `lib/check-film-style.mjs` enforces the floor (hero >= 120px),
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
