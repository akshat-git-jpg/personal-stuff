# TASTE-ANIMATE.md

The owner's taste for the animate recipe, turned into rules. 030 (plan the moments) and 040
(author the moments) read this file in their sealed stages; every rule binds them.

The design system the run uses (`pipelines/video/design-systems/<name>/DESIGN.md`) owns the
look: colours, fonts, motion vocabulary. This file owns how this recipe uses that look: which
moments earn a graphic, how a graphic acts out an idea, pacing, what the owner rejected on
screen.

## How a rule gets here

The owner watches a cut at 080 and leaves timestamped comments. The 090 fold turns a comment
into one numbered rule here, quoting the owner. If a machine can state the rule, it also
becomes a check in 050 and the rule names it.

Every rule keeps this shape, so it can be retired when its cause is gone:

```
## A<n> — <the rule, one line>

**From:** <slug> <version>, <date>. Owner: *"<their words>"*

<what was on screen, why it was wrong, the general form>

**Enforced by:** author judgement | <the check>
```

---

## Rules

A1-A13 are starter rules: craft lessons adopted from another animation workflow and
adapted to ours, where the graphics sit on a screen recording or take over from it for a
moment. They carry no owner quote yet; the owner's own reviews refine or retire them.

## A1 — Act the idea out; never just label it

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

A heading with icons under it names an idea without showing it. A problem visibly breaks,
a comparison puts two things side by side that differ, a count lands item by item. A
caption may name the idea; the picture has to show it. Stick figures and clip art standing
in for the idea are labels, not acting.

**Enforced by:** author judgement; the storyboard panel (035) is where the owner rejects it

## A2 — One colour means one thing

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

The accent colour marks the one thing the video follows (the fix, the product, the result)
and keeps that meaning in every moment. It is never spent on decoration or borders.

**Enforced by:** author judgement

## A3 — No generic AI defaults

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

Banned: a centred title on a gradient, everything fading in the same way, glows on chrome,
particle bursts, labels or borders parked in the corners, a logo sting as the ending. Every
frame should look like this design system and this subject.

**Enforced by:** author judgement

## A4 — Vary scale; at least one close-up per video

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

A video where every moment is a row of icons under a heading reads as a slideshow. Across
the moments, mix wide layouts, mid shots and at least one extreme close-up (one number,
one detail, one face of an object filling the frame).

**Enforced by:** author judgement; visible on the storyboard sheet (035)

## A5 — Something new every 2-4 seconds

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

A move, a reveal, a change. Four seconds with nothing new on screen is a dead beat. Motion
in the screen recording counts, so the check runs on the assembled cut.

**Enforced by:** 050/070 dead-beat check on the cut (`review.deadMax`, default 4s)

## A6 — A shot is complete on its first and last frame

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

When the cut lands, what defines the frame is drawn (or a short entrance is running); no
text is half-revealed on the first frame or caught mid-reveal on the last one. Write-ons
start early enough to finish.

**Enforced by:** 050 finished-frame check (first and last frame of each moment)

## A7 — Captions hold: at least 1.25s on screen, at most 3.5 words a second

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

A caption that flashes by is not read on a phone. Each piece of on-screen text stays at
least 1.25 seconds, and no text asks the viewer to read faster than 3.5 words a second.

**Enforced by:** author judgement; the phone sheet (050) is where it shows

## A8 — The payoff lands in the pause before the line that names it

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

The big reveal arrives in the gap before the narration names the result, or on the word
itself; never before the voice gets there, and never buried mid-sentence.

**Enforced by:** author judgement (040 times reveals from `moment.json` word times)

## A9 — Springs over plain easing for things with mass

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

Cards, logos and big type move like objects: a spring with a little overshoot and a settle
on UI pieces, none on big type. A value with several targets follows one continuous spring,
never a restarted ease.

**Enforced by:** author judgement

## A10 — Transitions match the moment; at most one hard slam

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

From the screen recording into a takeover: a short entrance of 0.2-0.4s (a wipe, a
scale-in, a push) by default, not a hard slam. Keep at most one hard cut slam per moment,
on its payoff.

**Enforced by:** author judgement

## A11 — The recording is the stage; an overlay stays off what the voice points at

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

The screen recording is the constant the viewer holds. An overlay leaves the part of the
recording that moves during it (what the voice is talking about) visible; a takeover
replaces the recording only when it has nothing to show.

**Enforced by:** 050 covers-busy check (the recording's motion map over the moment's span)

## A12 — Placed deliberately: a takeover fills its frame, nothing is wedged or piled

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

A takeover's built-up frame spans the height; it does not leave an empty band across a
third of it. Graphics never pile on each other or collide with text, and a graphic beside
a heading is either attached to it or clear of it. An overlay is compact, not cramped.

**Enforced by:** 050 empty-band and crowding checks

## A13 — Name the weakest moment after every run

**From:** cth9191/animate craft rules, owner approved 2026-10-09 as starter rules.

Every planning, storyboard and authoring run ends by naming its weakest moment and what
would fix it, and REVIEW.md ends with a weakest-moment line. It is the next run's to-do.

**Enforced by:** 050 REVIEW.md "Weakest moment" line; the 030/035/040 prompts
