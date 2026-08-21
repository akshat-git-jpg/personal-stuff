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

**The audit is per-film boilerplate and it does not carry itself forward.**
best-no-code-automation-tool shipped to owner review with zero
`getBoundingClientRect` calls in its composition, so none of this was running,
and the owner hand-caught two overlaps a machine already knew how to find. When
it was finally pasted in it reported fourteen findings on the first pass,
including a nine-second collision at b08 nobody had mentioned. Copy it into every
new film, or extract it into a shared snippet — that extraction is routed to
`plans/`. Until then, treat "does this film have the audit?" as a checklist item,
because an absent check looks exactly like a passing one.


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

## T13 — Clearance, not non-overlap. Boxes that miss by 8px read as touching.

**From:** best-no-code-automation-tool, 2026-08-15. Owner, three times on one
film: *"its needs to be little up, pls take care of all these things in future
too"* (b03), *"there is no proper gap between langchain and the rectrangular box
like the above one, pls fix all, take care it for future as well"* (b08-b12),
*"the words in the last slide is cutted by the line above it"* (b11).

Three complaints, one cause. Every check in this pipeline tests for **overlap** —
a strictly positive intersection of two boxes. The owner rejects on **clearance**:
two things that do not touch, but sit close enough to read as one broken object.
Nothing measures clearance, so all three shipped through a green gate.

The b03 case is the one to remember, because the CSS had already done the
arithmetic and drawn the wrong conclusion. Its comment read *"top:400 puts the
lintel BELOW the sub-line band (which ends at y392)"* — 8px of daylight, declared
safe. On a 1080p frame with 52px type it is a collision.

So:

- **Adjacent bands clear by at least 40px at 1080p.** Not 1px, not 8px. If two
  elements are within 40px and one of them is text, move one.
- **Measure ink, not boxes.** A 150px hero at `line-height:1.0` has roughly 109px
  of cap-height inside a 150px box; a descender pushes the other way. Both errors
  are about 20px and they compound.
- **A fixed-width label column is sized against the LONGEST label, not the first.**
  `.qname` was 186px, which fit four of five names. "LangChain" rendered 188px, so
  its gap to the bar collapsed to 16px while every other row had 113-140px. The
  owner reads the inconsistency, not the absolute. Keep the column fixed (a ragged
  bar edge breaks T6) and widen it to the worst case plus real slack.
- **A rule or rail is placed against the text band that will be on screen with
  it**, not against an empty stage. `#rule` sat at y352 inside a sub band of
  330-392 and struck the subtitle out.

**Enforced by:** `lib/intro-film/check-clearance.mjs`, run as part of
`run.sh <slug> intro-review`. It measures every visible element box at each beat
sample and reports two codes, both as errors: `low_clearance` when an aligned
pair is closer than `MIN_CLEARANCE_PX` and one of them is text, and
`text_intersect` when a pair partially intersects with text involved **in either
z-order** — the b11 case, where the measuring rule painted BEHIND the subtitle
and hyperframes' `text_occluded` could never fire because it only looks for text
covered BY something. `MIN_CLEARANCE_PX` is the same 40px this rule states and
the two are meant to stay identical. Text is measured by its INK (a Range over
the text node, clamped to the element box), because a 1600px nowrap block holding
800px of glyphs would otherwise report a gap that is not the one the eye reads.

**What counts as a device** is the other half of this rule, and getting it wrong
costs the gate its value in either direction. Measuring the whole element tree
reported 68 errors on a film already approved; the following are excluded on
principle, not to reach quiet:

- **Inside an `<svg>`** — paths and circles are strokes of one drawing.
- **Two parts of one unit** (same nearest id-bearing ancestor) — an icon and its
  caption, a logo and its wordmark. This replaces the per-film device list the
  old audit hand-wrote, by reading objects off the ids the author already gave them.
- **Near-full-frame elements** — a backdrop; everything sits on it.
- **Blurred elements, and gradients that fade to `transparent`** — a wash has no
  readable edge, and a clearance is a gap between two edges. The ambient glow and
  the legibility scrim exist *so that* text can sit on them.
- **Anything a TRAVELLER is involved in is demoted to a warning** — a wipe crosses
  what is on its path by design, which T14 already accepts.

A film may declare genuinely deliberate pairs in `<filmDir>/clearance.json`
(`{"allowedPairs": ["#rule|#rlabs"]}`). Keep it short and give each entry a
reason: `#rule|#rlabs` is there because the measuring labels are the rule's own
annotation and read as one object — the same single exception the old audit held.

Until 2026-08-20 this was enforced by an audit hand-copied into individual film
compositions, which is why it protected `consistent-ai-influencer` and did not
protect `best-no-code-automation-tool`. Before that it was
*"author judgement, and that is currently a gap"*.

This was *"author judgement, and that is currently a gap"* until 2026-08-16.
`check` had sampled this film 464 times — including every one of the six defect
timestamps — and returned zero layout findings, because it only ever looked for
intersection. Two notes from building it:

- **Measure text by its line box, not its Range rect.** A Range rect is built
  from the font's ascent+descent, so a 150px hero at `line-height:1.0` reports
  ~180px tall and hangs ~15px past the box the author positioned. Uncorrected,
  the audit's first run produced eleven findings that were all phantom — an
  eyebrow "intersecting" its own hero, every hero "18px" off its own sub. A
  clearance audit that cries wolf gets muted, which is worse than not having one.
- **The band is for devices.** An eyebrow, its hero and its sub are one title
  block on a designed vertical rhythm; holding them 40px apart is a worse
  picture. Text-against-text is checked for intersection only, which still
  catches the case the rule was written for (a hero wrapping onto its own sub).

## T14 — A device parked in a moving object's corridor will be crossed.

**From:** best-no-code-automation-tool, 2026-08-15. Owner: *"why there are 4
ovels at the bottom of send"* (b06) and *"whats the icon on above the send, whats
the signiface of it here"* (b14).

The coin stack and the hourglass are the film's two tolls — the whole argument
depends on reading them. Both were positioned at fixed coordinates chosen against
where the chain happened to sit at one authored moment. But the chain **travels**:
it sweeps 990px of frame five times at b14. Any fixed device inside that corridor
is crossed on every pass. The hourglass rendered on top of the SEND block and
buried its label; the coins hung off its bottom edge.

What makes this rule worth its number is that **both shapes had already been
fixed once.** The 140 run ledger records "the clock rendered as a partial orange
arc … replaced with an hourglass" and "the coins were flat orange dashes … now
stacked round coins." Both fixes were real, both were verified in isolation, and
the owner still could not identify either object — because a well-drawn shape
sitting on top of another object is not legible, and nobody checked the shape in
the frame where the collision happens.

So:

- **Reserve a lane.** If a beat leaves residue, give it a band the traveller never
  enters, and cap the travel to respect it. This film reserves x >= 1640.
- **Cap the traveller, do not nudge the device.** Moving the device just relocates
  the collision to a different frame of the same tween.
- T7 says a rail either passes between objects or stops at them. Same rule, with
  time added: check the object's whole path, not its authored end position.
- **Verify a redrawn device in the frame where it is used**, not on its own. A
  shape review that never composites against the moving element proves nothing.

**Enforced by:** `lib/intro-film/check-clearance.mjs` reports
`corridor_conflict` at **warning** severity. It unions each element's box across
every sample; an element whose union is much larger than its own box is a
traveller, and a static box inside that union is flagged. Containment is
suppressed in one direction only — scenery enclosing a corridor is not a defect,
a device parked inside one is.

The residual judgement is deliberate and stays with the author: the checker can
say the device sits in the path, but not which of the two fixes this rule wants.
T14 says cap the traveller rather than nudge the device, because moving the
device only relocates the collision to a different frame of the same tween — and
nothing mechanical can tell which object is the one that must hold its position.

## T15 — A hero captions the clause being spoken, not the metaphor.

**From:** best-no-code-automation-tool, 2026-08-15. Owner, on b03: *"whats the
significance of nothing in this context"*.

Beat 3's clause is "this video will save you hours of trial and error" — a
promise to the viewer. Its hero read `NOTHING IS FREE`, which captions the film's
gate metaphor instead. The viewer hears a promise and reads an unrelated
absolute, so the word has no referent; the nearest available reading is "this
video is not free".

It also contradicted `PAID NOTHING` at b06 ten seconds later. One hero says
nothing is free, the next says this one paid nothing. Both are true inside the
metaphor and the pair is incoherent on screen.

So:

- The hero answers "what is being said right now", not "what is this film about".
  The metaphor is carried by the staging, which is already doing that job.
- **Read the hero list top to bottom as a standalone document before rendering.**
  Every contradiction found here was visible in a 17-line list; neither frame
  review nor any checker will surface it, because each beat is individually fine.
- A film-level thesis that only fits one beat belongs to that beat. `NOTHING IS
  FREE` is a good line for the toll; b04's eyebrow already says "The toll".

**Enforced by:** author judgement.

## T16 — A tweened property that cannot apply to the element is invisible to everything except the frame.

**From:** best-no-code-automation-tool, 2026-08-16. Found by reading b10's frame
against its stage line; the owner never saw it, because the beat had already
been reviewed twice and looked merely dull.

b10 is the beat where the five tools spread out by how much machinery each drags
— 190 / 120 / 60 / 150 / 500 across five bars, the entire content of the beat.
It rendered as five empty tracks. So did b11, which resets them to identical.
Two beats, nineteen seconds, and the device never once painted.

The cause is one missing declaration. `.qload` is an `<i>` inside `.qbar`, and
`.qbar` is a plain block, so the `<i>` stayed **inline** — where `width` and
`height` are simply ignored. `.qbar` itself got away with a width because it is a
flex item of `.qc` and was blockified for free; the child was not, and the two
look identical in the stylesheet.

Nothing could catch it, and it is worth being precise about why:

- The tween ran. GSAP set the property on every frame, correctly.
- The element existed, was visible, and had non-zero opacity.
- `check` found nothing, because nothing overlapped and nothing overflowed.
- The device-overlap audit found nothing, because a zero-width box is not a box.
- Five empty tracks are a *plausible picture*. They read as "still loading"
  (T12), which is why two review passes accepted them.

So:

- **`display:block` on any element you intend to size, unless it is already a
  flex/grid item or positioned.** `<i>`, `<span>`, `<em>`, `<b>` are inline by
  default and silently discard `width`/`height`.
- **Before tweening a geometric property, confirm the element can hold it.** The
  question is not "does the element exist" but "does this property do anything
  here".
- **A beat whose device is a quantity must be read at a moment when the quantity
  is non-zero.** If every sampled frame shows the empty state, the sampling is
  wrong, not the beat.

**Enforced by:** author judgement, and only the beat-frame read against the
stage line will catch it. Same family as T9: a device that is present in the DOM,
animating correctly, and not on screen.

## T17 — Position against the geometry a beat gives an element, not the geometry it has at rest.

**From:** best-no-code-automation-tool, 2026-08-16, found by the clearance audit
on the *fix* for an earlier owner complaint (T13, b03).

Two defects on this film, same cause. `#gate` sits at x860-1560 / y400-960 in
CSS, and b03 tweens it `scale: 1.045` about `50% 100%` and never scales it back.
From 13.4s onward its real box is x844-1576 / y375-960 — 25px taller and 16px
wider than anything reading the stylesheet would believe.

- `#wall` was placed at x1560, flush to the gate's *resting* right edge. From
  13.4s it was behind the gate leg, so b05's device — the wall its chain is
  supposed to hit — was not visible in the only beat it exists for.
- The T13 fix for b03 moved `.sub` to y288 and its comment recorded a 47px gap
  to the lintel. The measured gap was 22px. The fix for the owner's complaint was
  itself computed against stale geometry and only half worked, and the owner
  would have been the one to find that too.

So:

- **A transform applied in one beat persists until something reverts it.** There
  is no end-of-beat reset. `scale`, `x`, `y` set at b03 are still in force at b12.
- **Never derive a neighbour's clearance from CSS values.** Read the number off
  a measurement of the live frame. Arithmetic on the stylesheet is how both of
  these passed inspection.
- **Scaling about `50% 100%` moves the top edge.** Bottom-anchored growth is
  usually chosen so a device stays planted on the floor; the cost is that its top
  rises into whatever is above it.

**Enforced by:** the clearance audit (see T13) — it measures the live composed
box, so a transform is included by construction. This rule exists so the author
stops producing the arithmetic the audit then has to contradict.

## T18 — Cap the devices on screen; a beat that adds one must retire one.

**From:** best-no-code-automation-tool, 2026-08-16. Owner, on the whole film:
*"The graphics look super complicated and are difficult to understand. Please
keep the graphic design as simple and easy to follow as possible throughout"*,
and again at 1:24: *"avoid showing too many elements at once"*.

The film accumulated. `#chain`, `#gate`, `#queue`, `#rule`, `#rlabs`, `#coins`,
`#clock`, `#shards`, `#wall`, `#cols`, `#winners` — eleven devices across
seventeen beats, and nothing anywhere said "enough". Each was defensible where
it was introduced; the sum was not legible. b14 carried four at once.

The ceiling is **three non-stage devices in any single beat**, where the stage
(background, ambient, avatar, scrim) does not count and text is not a device. A
beat that wants a fourth must retire one first, in the same beat.

This is a budget, not a preference: it converts "too complicated" — which an
author cannot act on — into a number they can check while writing.

**Enforced by:** author judgement at 025, and reviewable at 140 by counting the
`show()` calls live in any beat window. Not machine-enforced yet; the count is
derivable from the timeline, so it is a candidate for the clearance audit's
sweep pass.

## T19 — A stand-in for an object must not be made of that object's art.

**From:** best-no-code-automation-tool, 2026-08-16. Owner, at 1:30, with a
screenshot: *"The Trainer and AI boxes appear twice on the screen, as shown in
the attached reference. Please remove the duplicate elements."*

`#shards` is the residue a crossing leaves behind, and it was drawn with the
chain's own icons and its own words — a Trigger bolt labelled "Trigger", an AI
target labelled "AI". At b05 that reads correctly, because `#blk1`/`#blk2` drop
away at 20.1 and the shards arrive at 20.3: the viewer watches the substitution
happen. At b14 the chain is whole and on screen, so the identical shards land as
a second Trigger and a second AI, and the only available reading is a rendering
bug.

Same art plus same label equals the same object, whatever the author intends by
it. A fragment must look broken — a piece, a silhouette, a fading ghost — or it
must not appear while the whole is visible.

**Enforced by:** author judgement. The general test: if a device would be
correct only when its source object is absent, its appearance must be gated on
that absence, not on a timestamp that happens to fall after it.

## T20 — Naming a recurring object once is not naming it.

**From:** best-no-code-automation-tool, 2026-08-16. Owner, at 0:43: *"I don't
understand the significance of the three boxes/chains. Please either explain
their purpose visually or simplify/remove them if they aren't necessary."*

The chain IS explained — by `#u01`, "trigger, AI, send — one build, five ways",
which is on screen from 0.0 to 4.3 seconds. The owner, watching in motion, had
lost it by 0:43, which is the first beat where the chain has to carry an
argument rather than just exist.

An object that recurs across a film needs its meaning restated at the beat where
it starts doing work, not only at the beat where it first appears. The subtitle
slot is the cheapest place to do it and costs no device budget (T18).

**Enforced by:** author judgement at 025. Check: for each recurring device, is
there a line of text naming it within the beat where it first carries meaning?

## T21 — A beat's visual is one familiar icon doing one movement, started on its word.

**From:** best-no-code-automation-tool, 2026-08-18. Owner rejected the intro
graphics on ten separate beats with one sentence: *"This graphic looks super
complicated and doesn't really match the idea being explained in the text."*
Then, when pressed: *"think from the point of viewers, it's gonna be very
difficult even to decode the graphics, it should always flow with the audio"*.
Approved only at the fourth attempt, with *"yes it's good, I like the
simplicity"*.

Two whole directions failed before this rule existed, for opposite reasons, and
both looked like progress at the time:

- **Illustrated scenes fail.** An engine buried in cables, a maze with a solved
  path, a peeled poster revealing a machine. Each is a *metaphor*, and a
  metaphor must be decoded. A beat gives the viewer around three seconds and
  they are also listening. T18 reduced the device *count* and the complaint
  survived unchanged, which is the proof that clutter was never the defect —
  decode time was. Shrinking a metaphor leaves a smaller metaphor.
- **Text fails too.** Replacing the pictures with the spoken words put
  paragraphs on screen. Owner: *"there's too much text on the screen ... the
  text format looks very bad on screen."* Words are not a substitute for motion
  graphics; they are the absence of them.

What passes is **one icon a five-year-old already knows, performing exactly one
movement, beginning on the word it belongs to.** The movement carries the
meaning, so there is nothing left to interpret. "Easy, then stuck" is not a road
drawn beside a wall — it is a ball that rolls smoothly and stops dead.

The approved vocabulary from this film: a clock hand racing then stopping; gears
piling on until the first one grinds; a ball hitting a wall; a padlock clicking
open; one option lifting out of five and taking a tick; a person appearing per
group named; cross-then-tick; tiles then a play button; nodes lighting left to
right. All universal. None invented.

Three consequences that are part of the rule, not commentary:

1. **Never invent an object.** Gates, chains, queues, shards, measuring rules —
   every one of them cost this film a rejection. If the audience would have to
   be taught what it is, it does not go on screen.
2. **Sync is a requirement, not polish.** An element enters on its word. A
   static tableau the viewer must scan fails even when the drawing is right.
3. **Headline only.** No subhead paragraphs, no stacked phrase lists.

**Enforced by:** author judgement at 025, and by the preview gate — the look is
approved from an *animated* HTML page (`videos/<slug>/intro-film/look/`), never
from static frames, because motion is the thing being judged. Supersedes the
approach T18 was patching: T18's device budget still holds, but a beat obeying
T21 will rarely approach it.

## T22 — An agenda list is built from the promise, not from its own clause.

**From:** best-no-code-automation-tool, 2026-08-18. Owner, on b15: *"In the
'What We'll Cover' section, two points are already covered in the sentence
above, that points are missing."*

`#cover` was authored from b15's own clause and held exactly its five items:
ease of use, customization, AI flexibility, pricing, the honest verdict. b14's
clause — the beat immediately before, and part of the same spoken promise —
names two more: a quick overview of all five tools, and a live demo using the
same workflow idea. Neither had a row. The film therefore listed five of the
seven things it had just told the viewer it would do, and the two it dropped
were the two the viewer heard most recently.

The defect is the authoring habit, not the count. A device is normally built
from the clause of the beat it sits in — that is right for every other device in
this film and is what T11 asks for. An **agenda** is the exception: it is a
summary of a promise the narration may have spread across several beats, so its
source is the promise, not the beat.

**Enforced by:** author judgement at 025. Check: read the clauses of the agenda
beat AND every beat back to the start of the tease, list every deliverable named
in any of them, and confirm the list has a row for each. A row the narration
never promises is the same defect in the other direction.

## T23 — WITHDRAWN. There is no mandatory agenda format.

**From:** best-no-code-automation-tool, 2026-08-18 — raised and withdrawn the
same day. Owner, on the rendered b15: *"I was wrong to decide that use the
template. It's not looking good like this."*

In the morning the owner made `card-library/section/bullet-points` mandatory for
any "what we'll cover" beat: *"you have to use this template always in intro"*,
and *"I am not going to ask you to use this template next time."* It was written
here as a hard rule.

That afternoon he watched it rendered — seven numbered rows standing for
twenty-one seconds — and withdrew it: *"I was wrong to decide that use the
template. It's not looking good like this. You are free to use anything that
suited best."*

Keep the rule withdrawn, and keep the reason: **a format named from memory is
not a design decision.** The card is a good card at its own size, for its own
6-second run with four rows. Nothing about naming it made it right for a beat
three times as long carrying three more rows, and neither the owner nor I could
tell until it was on screen. T21 already covers what actually governs here —
little on screen, arriving on its word — and an agenda obeys it by showing one
line at a time, not by numbering seven of them.

If he names a template again, still open that card and copy its measurements
rather than guessing at the name. That part was never the problem.

**Enforced by:** nothing, deliberately — this rule is withdrawn and imposes no
check. It stays in the book so the next author does not re-derive the mandate
from the memory trail. The live constraint on an agenda beat is T21 plus T22.

## T24 — A distributed row is computed, never typed.

**From:** best-no-code-automation-tool, 2026-08-18. Owner, on b12: *"uneven gap,
look at the left side of the ease and the right side of the value, their gaps
are very uneven"*.

The measuring rule's four marks were authored as pixel literals — 96, 372, 648,
924 inside a 1160px rule. That is 96px of margin before the first and 236px
after the last. Nobody chose those numbers to be lopsided; they were nudged into
place one at a time and the asymmetry was never visible to the author, only to
someone looking at the finished frame.

The first fix was worse than it looked: retyping them as 145/435/725/1015 makes
the two ends match at 145 but leaves 290 between each pair, so the row is
symmetric and still not evenly spaced. A hand-authored distribution fails twice —
once by drifting, once by being hard to check.

Any row of N things spread across a width is `width * (i+1)/(N+1)`, which is the
only distribution with an equal gap everywhere including both ends — 232px here.
Generate the elements from the array that names them, so the count and the
geometry cannot disagree. A fifth measure re-spaces the row for free; a literal
would need five numbers retyped and would silently be wrong if one were missed.

The same rule covers the label under each mark: centre it on its own mark with
`transform: translateX(-50%)`, so a longer word grows both ways instead of
pushing its neighbour.

**Enforced by:** author judgement at 025. Check: grep the composition for
repeated sibling elements carrying hand-set `left:`/`top:` pixel values. Any run
of three or more is a distribution that should be derived from an array.

## T25 — A draw-on stroke takes its dash length from the path, measured.

**From:** best-no-code-automation-tool, 2026-08-18. Owner, looking at b13:
*"why is there a broken tick"*.

A tick that draws itself is `stroke-dasharray` set to the path length with
`stroke-dashoffset` tweened to zero. Set the dasharray SHORTER than the path and
it does not clip the stroke — it **tiles** it. b13's path is ~347 units and the
dasharray was a guessed 300, so a 47-unit fragment of a second copy floated in
frame, detached from the tick, for the length of the beat.

b07 is the more instructive half. Its path is 152 units against a guessed
dasharray of 180, so it rendered correctly — by luck. A guess that happens to be
large enough hides the bug and teaches the author that guessing works.

Never type the number. `path.getTotalLength()` is right by construction and
survives any later edit to the `d` attribute, which a literal does not:

```js
const drawOn = (sel, at, dur = 0.8) => {
  const el = document.querySelector(sel);
  const L = Math.ceil(el.getTotalLength()) + 2;
  tl.fromTo(sel, { strokeDasharray: L, strokeDashoffset: L, opacity: 0 },
                 { strokeDashoffset: 0, opacity: 1, duration: dur }, at);
};
```

**Enforced by:** author judgement at 025, and by the look preview at 110 — this
one was invisible in the composition and obvious the moment it was watched,
which is the argument for previewing motion rather than reading it. Check: grep
for `strokeDasharray` with a numeric literal. There should be none.

## T26 — Two lines on screen together must not say the same thing.

**From:** best-no-code-automation-tool, 2026-08-19. Three separate catches in one
film, all the same defect. An eyebrow reading *"The same test"* sat directly
above a hero reading **SAME TEST** — owner: *"there is two same test on screen"*.
A sub reading *"let's jump straight in"* sat under a hero reading **LET'S
BUILD** — owner: *"don't you think both conveys same meaning only"*. And an
agenda restated a promise the beat above had just made. His question is the rule:
*"don't you have any criteria to judge the things? you have put many times the
same words repeatedly on screen, all the words that convey the same meaning."*

There was no criterion. There was care, and care does not survive a rebuild —
the eyebrow and the hero were written months apart and each was fine alone.

The rule has two halves, and only one of them can be mechanised:

- **Repetition** — one line's words appearing inside another's. A machine can
  see this, so a machine now does.
- **Synonymy** — two lines with no shared word saying one thing. *LET'S BUILD*
  and *let's jump straight in* share nothing but their meaning. No gate will
  catch that; it is read aloud, by the author, per beat.

A related habit, same session: **a hero is a title, and a title does not end on
a preposition with nothing after it.** *FIVE WAYS IN* became *FIVE WAYS* —
owner: *"the five ways in looks super odd as a main heading ... think about it
when you give the main heading on any clip."* And a hero must not read as a
shrug: *ANYONE* became *ANYONE CURIOUS*, because alone it said nothing and broke
the pattern its three siblings set.

**Enforced by:** `auditEcho()` in the composition, called per beat beside the
clearance audit — it collects every text element visible at that moment and
fails the review when one line's content words are all contained in another's.
The synonymy half and the title-shape half are author judgement at 025: read
every hero out loud on its own, then read it against whatever else is on screen
with it. A green audit is not evidence that nothing is repeated.

## T27 — A reveal names the word it lands on. It never names a number.

**From:** best-no-code-automation-tool, 2026-08-20. Owner, three separate times
across two rounds: *"these icons appear on the screen earlier than the audio"*,
*"these things are not synced with the audio ... this is not the first time this
happened many times"*, *"again, these are not syncing with the audio."*

Measured against the transcript, the hand-typed times were out by 1.4 to 3.1
seconds: the n8n mark landed 1.7s before he says "n8n"; "anyone" landed 3.1s
after. The exact start of every word was sitting in `transcript.json` the whole
time and nothing read it.

The deeper error is the one worth keeping: a typed time **is not wrong in any way
a machine can see**. It renders, it passes every gate, it looks defensible in
the source. Only the owner's ear could catch it, which is why it survived three
rounds — the pipeline had no opinion about it at all.

So a reveal states which word it belongs to — `on('flowise')` — and the time
comes from the recording. Two consequences worth knowing before authoring:

- **Repeated words need their occurrence.** "ease", "flexibility" and "pricing"
  are each spoken twice in this intro; `#1` silently resolved to a word twenty
  seconds earlier. Write `'flexibility#3'` in an array, or `on('x', 3)` directly.
- **An even stagger is a guess about the voice.** He says "Make" and "Zapier"
  0.6s apart and "Zapier" and "LangChain" 1.3s apart. Any single stagger value
  is wrong for one of them.

**Enforced by:** `lib/intro-film/check-film-timing.mjs`, run in `intro-review`
before any render. It re-derives every `at()`/`on()` call against
`transcript.json`, fails when the baked `WORDS` table has drifted from the
transcript, when a named word is not spoken, or when a reveal is pinned to a
word outside its own beat. It prints the number of reveals it covered — a count
far below the number of reveals in the film means the gate has a blind spot,
which is how the first version reported "2 reveals timed" while sixteen more
flowed through arrays it could not see.

## T28 — When the presenter is not on screen, the stage centres.

**From:** best-no-code-automation-tool, 2026-08-20. Owner: *"even though there is
no avatar shown at the right or anywhere, the graphic is not in the center. Not
only these graphic but ALL the graphics that shown on the screen that does not
contain the avatar video are not in the center."*

The device lane sits left of centre because the presenter occupies the right
two-fifths. On the twelve beats where he is absent, nothing moved — so the
graphic stayed ~300px left with the whole right half of the frame empty. The
layout was correct for a frame he was in and nobody had asked what it should do
without him.

The headline does not move. It is a title, anchored top-left by design, and he
has never called it off-centre.

**Enforced by:** the offset is a function of one fact — is he on screen — so it
lives inside `faceIn`/`faceOut`/`faceRound` and nowhere else. There is no
per-beat number to forget. Author judgement only if a new face mode is added:
give it a stage offset in the same helper.

## T29 — A clause that names a thing and its opposite must show both.

**From:** best-no-code-automation-tool, 2026-08-20. Owner on b07: *"why there is
no graphic or anything when he said you should avoid ... there you had shown the
tick mark, but when he said about avoid it, you had said nothing."*

The clause is *"which tool makes sense for your use case, and which ones you
should avoid."* The choosing half got a tile that lifts and takes a tick. The
avoiding half got nothing — the other tiles simply stayed dimmed from earlier,
which reads as leftover state, not as an answer.

The general shape: when a sentence turns on a contrast — this **but** that, X
**and not** Y, before **and** after — a beat that enacts one side and leaves the
other implicit looks like it stopped halfway.

**Enforced by:** author judgement at 025, and nothing else — deliberately. This
needs someone to read the clause and notice it has two halves, which is
comprehension, not measurement. `check-film-timing.mjs` will confirm the reveal
you add is on the right word; it cannot tell you the reveal is missing.

## T30 — The presenter's treatment varies with what the beat is doing.

**From:** best-no-code-automation-tool, 2026-08-20. Owner: *"it's not necessary
to show the avatar of the same size. You can sometimes show the avatar on big
screen, sometimes on small circle, sometimes the thing like you are showing now,
or anything else, what is best suited on screen. I am leaving this completely
upon you."*

Read this against T5 and against 2026-08-18, when he rejected an enlarged
presenter and I responded by fixing ONE size for the entire film and writing that
down as the lesson. That was the wrong lesson. The complaint was that a size was
inconsistent with what a beat needed, not that variety is bad — and answering it
with a single constant traded one flaw for a flatter film.

Three treatments, chosen by what the beat is doing:

- **full** — he leads the frame; the stage stays readable beside him (T5).
- **panel** — he sits beside a device that needs the room.
- **round** — a close aside, no device to clear, where he is the whole point.

**Enforced by:** author judgement at 025, and by the frame — a film whose
presenter never changes treatment across seventeen beats is the failure this
rule names. The mechanical half is in the composition: each treatment is a
helper that also sets the stage offset (T28), so a new treatment cannot be added
without deciding where the graphics go.

