# TASTE-SIMPLE.md

`TASTE-INTRO.md` governs the `complex` flow (the bespoke intro film). This file
governs `simple` (the locked-kit cut list, plans 218-221). **Neither file
inherits the other.** The two flows disagree on purpose — `complex` authors a
one-off composition and prizes continuity and register; `simple` picks and
fills from seven locked cards and prizes legibility and repeatability. A rule
that is correct for one is often the deliberate inverse of the correct rule for
the other (see `S-T5`). Do not move a rule between the two files and do not
delete one from either — retire it in place when its cause is gone.

Owner feedback, turned into rules, exactly as `TASTE-INTRO.md` does it. The
authoring step (`115-author-intro-simple-llm`, `SIMPLE-PASS.md`) reads this
file. Seeded 2026-08-22 from the four reference intros measured for plan 220
(`decisions.md`), before any owner round had run against a real simple video —
so `From:` below cites the reference measurement, not a rejected cut.

**Enforced by** tells you whether a machine will catch a breach. Where it says
*author judgement*, nothing will stop you shipping the mistake again except
reading this file. `lib/intro-kit/lint-cutlist.mjs` (S1-S7) enforces pacing;
it has nothing to do with the taste rules below, which are about what a card
says and looks like, not how long it holds the screen.

---

## S-T1 — Full-screen avatar and full-screen card alternate on hard cuts.

The presenter is never in a bubble, panel or corner beside a graphic. One
surface owns the whole frame at a time; the cut itself is the transition.

**From:** measured across all four reference intros, 2026-08-22.

**Enforced by:** author judgement.

## S-T2 — Every card carries the words being spoken, appearing word by word.

A card with no text on it does not exist in this flow. The card is a visual
restatement of the line being said at that moment, not a decorative interlude
between lines.

**From:** measured across all four reference intros, 2026-08-22.

**Enforced by:** author judgement (`S4` in the pacing lint checks that a
card's `vars` satisfy its kit contract, but does not check that the words on
screen match the words being spoken — see `S7` for that).

## S-T3 — One accent colour for the whole intro.

No register shift, no mood change mid-intro. The bespoke film's register
turns (dark → hopeful, etc.) are a `complex`-flow device; a locked-kit intro
does not have the authored beats to carry one.

**From:** measured across all four reference intros, 2026-08-22.

**Enforced by:** author judgement.

## S-T4 — Reusing the same card two or three times in a row is CORRECT.

Reference `kO3WtZmDb_A` uses one card four times back to back, changing only
its icon and two rows. Variety is not a goal here; legibility is. Do not
diversify cards for the sake of diversity — pick the card whose shape fits the
line, even if that means repeating the last one.

**From:** reference `kO3WtZmDb_A`, measured 2026-08-22.

**Enforced by:** author judgement.

## S-T5 — No continuity between cards.

A card does not carry an object from an earlier card. This is the deliberate
inverse of `TASTE-INTRO.md`'s continuity rules (e.g. its `T1`-family rules on
carried objects and register turns), which apply to the bespoke film only —
a `complex` film is one authored composition with a through-line; a `simple`
intro is seven independent, interchangeable cards. Do not import a continuity
rule from that file into this one.

**From:** measured across all four reference intros, 2026-08-22.

**Enforced by:** author judgement.

## S-T6 — Transitions are a two-frame white flash.

Not a crossfade, not a blur, not a wipe. `lib/intro-kit/render-simple.mjs`'s
`FLASH_FRAMES` constant encodes exactly this — a hard cut punctuated by two
frames of white at every kind change, nothing else.

**From:** measured across all four reference intros, 2026-08-22.

**Enforced by:** the renderer (`render-simple.mjs`'s `makeFlashClip` — there is
no code path that produces any other transition).

## S-T7 — Never use a form whose meaning is "not finished".

Quoted verbatim from `TASTE-INTRO.md`'s `T12`, because it is about what a
shape MEANS rather than about authoring a bespoke film, and that is true in
either flow: a dashed outline means "drop content here", a grey figure means
"no avatar set", an arc filling a ring means "loading". Used as finished art
in a locked card, these tell the viewer the intro is unfinished no matter what
the card was filled in to say.

**From (`TASTE-INTRO.md`'s `T12`):** the owner, three times on one film — the
dashed sponsor wells and the grey silhouettes ("they look like placeholder",
2026-08-06), then the drawing seal ("i dont like this orannge loading ui",
2026-08-07).

**Enforced by:** nothing automatic, and that is the point — read this file.
