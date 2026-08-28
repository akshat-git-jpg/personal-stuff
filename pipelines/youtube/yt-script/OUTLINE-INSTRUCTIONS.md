# Outline instructions

The outline is **the video's table of contents**: what the video is, what order
it happens in, and enough of what is inside each section that the owner can
picture it. It exists so he can approve the video's *direction* before anyone
writes a word of script.

```
knowledge.md  ->  outline.md  ->  script-plan.md  ->  the script desk
                  (this file)     (the section cards)  (what the maker opens)
```

## Why this file exists

Until 2026-08-23 the first thing written after `knowledge.md` was the beat-level
document — verbatim intro copy, 25+ beats, lanes, verdicts, tables — and it was
called `outline.md`. Approving the direction therefore meant reading a finished
draft script. If the section order was wrong, or a section should not have
existed, all of it was rewritten.

This file is the cheap gate. A wrong running order costs one page here and a
whole document there.

**Rewritten 2026-08-27.** It used to cap every section at one line, which made
the document too thin to picture. Owner: *"i need more details what we are
planning inside each section so that i can visualize.. make the outline little
more detailed"* and *"i prefer outline to be proper table of contens. imaging we
have your outline section as actual cards"*. The one-line cap is gone; the bans
that actually separate this document from `script-plan.md` are unchanged and
listed under **Rules**.

## Shape

Markdown. **Two parts, always in this order.**

Part one is the **Contents** block — the scannable table of contents, and it
fits on one screen however many sections there are. Part two is one **card** per
section.

```markdown
# <the video's working title>

Format: tutorial | comparison
Target: <NN> min

## Contents
1. <Section Name>
2. <Section Name>
3. <Section Name>

## Intro
- hook: <one line — what makes someone stay past 5 seconds>
- credibility: <one line — why he is the person explaining this>
- roadmap: names the sections above, in order

---

## 1. <Section Name>

<One line: what the viewer can do, or knows, after this section.>

- <what happens, in the order it happens>
- <what happens>
- <what happens>

## 2. <Section Name>

...

---

## Conclusion
- <one line — what the verdict, or the what-to-do-next, is organised by>
```

**Three to six bullets per card.** Under three and the owner cannot picture it;
over six and you are writing the script plan.

A real one:

```markdown
# Best Realistic AI Avatar Generator for Online Courses & Training

Format: comparison
Target: 18 min

## Contents
1. Who each one is for
2. The same script through all five
3. Which one looks real
4. What course creators actually need
5. What they really cost
6. Every score in one place

## Intro
- hook: $300 and a studio day, versus a few dollars and a few minutes
- credibility: same script, same voice, same lesson through all five tools
- roadmap: names the six sections above

---

## 1. Who each one is for

Work out which tool is built for you, before any of them is judged.

- what each one was built to do, in one pass
- the price bracket each one sits in
- which two are built for big companies, and why that shows up later
- what was kept identical across all five, so the results mean something

## 2. The same script through all five

One script through every tool, all of it generated before any result is shown.

- the script, the face and the voice, held identical
- each tool's setup, and what stays off screen
- all five results revealed together, not one at a time

...
```

## Section names

**Plain, everyday words. The words a viewer would use talking to a friend.**
Owner, 2026-08-27: *"need language to be simple day to day.. , intutive we use
day to day.. no one uses ' The Music Bed'"*.

- **Say it out loud.** If a normal person would not say it in conversation, it is
  the wrong name. That is the whole test and it beats every rule below.
- **A phrase is fine.** So is a short sentence fragment, and so is a `What…` or
  `Why…` clause when that is the natural way to say the thing.
- **Sentence case, not Title Case.** Title Case makes an ordinary phrase read as
  a label.
- **No industry jargon, ever.** `The Music Bed`, `The Motion Pass`, `The Style
  Lock`, `B-roll`, `Colour Grade` — all of these are words the people who do this
  for a living use with each other. The viewer is not one of them.
- **Symmetry is welcome where it happens on its own** — several sections in a row
  naturally starting with a gerund is a good sign. **Never chase it.** Forcing
  every section into one grammatical mould is what produced the jargon this rule
  exists to stop.

| Bad | Why | Good |
|---|---|---|
| `The Music Bed` | jargon. Nobody says it | `Picking the music` |
| `The Narrator Audition` | jargon, and pompous | `Picking the voice` |
| `The Motion Pass` | jargon | `Adding the motion` |
| `The Final Stitch` | jargon | `Putting it all together` |
| `The Topic Brief` | jargon | `Picking a topic that holds up` |
| `The Real Cost` | reads as a label, not speech | `What it really costs` |
| `When It Breaks` | a troubleshooting bucket. Not a naming problem — see below | — |

### The reversal, recorded (2026-08-27)

This section first said *"a noun phrase, two to five words, Title Case,
symmetrical… no `When`/`Why`/`What` clauses"*, written the same day from the
owner's *"i prefer simple heading and symmetricall. it should be like a title"*.
Applied literally it turned all eleven sections of `vox-style-video-ai` into
`The <Noun>` and produced `The Music Bed`, `The Motion Pass` and `The Final
Stitch`. The owner reversed it within the hour: *"i take back my call - we can
have phrases in section name"*.

**Kept from the original call:** simple and standard rather than clever, no tease
in the name, and no bucket sections. **Dropped:** the noun-phrase requirement,
Title Case, the clause ban, and enforced symmetry.

The lesson worth carrying: **symmetry and plain speech pull against each other,
and plain speech wins.** A rule that specifies a grammatical shape will be
satisfied by jargon, because jargon is what fits a mould.

## Never make a section out of failures

**A troubleshooting section is not a section.** Owner, 2026-08-27, on
`When It Breaks`: *"thats a bad section name.. infact that should not be even a
section name"*.

Failures belong in the phase where they happen. `SCRIPT-PLAN-INSTRUCTIONS.md`
already requires it: *"Give each phase's known failure mode a bullet."* A bucket at the end means the viewer meets the fix minutes after the
moment it would have saved them, and the phase it belongs to is left teaching
the happy path only.

The same applies to any bucket-shaped section — `Tips And Tricks`, `Common
Mistakes`, `Extra Notes`. If a card's bullets have nothing in common except
that they did not fit anywhere else, it is not a section.

## Target length

`Target:` is required, in minutes, and it drives the section count.

**A section here becomes ONE card in `script-plan.md`** — one heading and one
short bullet list, nothing under it. So the section list you write is the whole
structure of the body; there is no second, finer level of breakdown coming later
to rescue a section that is really two. `TASTE.md` T13 is the rule, and
`SCRIPT-PLAN-INSTRUCTIONS.md` has the card format.

**The test: could these section names be title cards in the finished video?**
That is what they are. A list nobody could hold in their head is too long, and a
section that would need sub-headings to explain itself is two sections.

**Go as long as the material honestly carries** — see `TASTE.md` T6. Derive the
number from what `knowledge.md` actually supports, section by section, and say so
at the gate. Padding a target with repetition breaks T6 rather than serving it,
because T6's second half is that the flow stays interesting throughout.

Where the honest ceiling is lower than the owner wants, name the ceiling and the
reason at gate 040. That is a real answer; a padded outline is not.

## Rules

- **No spoken copy anywhere.** Not one sentence the maker would read aloud. That
  is `script-plan.md`'s job and duplicating it here is how the two documents
  drift. This is the real boundary between the two documents, not a line count.
- **No lanes.** No `SAY`, `VIDEO`, `FACTS`, no blockquotes, no verdicts,
  no tables. Those are all script-plan forms.
- **A card's bullets name what happens, never how it sounds.** "the price tier
  each sits in" is a bullet. "He says the pricing page is misleading" is copy.
- **Three to six bullets per card**, and no prose paragraph under a heading
  beyond the single promise line.
- **The Contents block fits one screen.** The cards below it are as long as the
  section count needs.
- **Section names are final once approved.** `script-plan.md`'s `### SECTION:`
  headings and the intro roadmap must match these word for word, so renaming one
  later means editing three places.
- **Every section traces to `knowledge.md`.** A section the knowledge cannot
  support is a gap to raise with the owner, not a section to invent.
- **Body sections are numbered; intro and conclusion are bullets.** The numbers
  are the running order and the owner reorders by moving them.

## For a comparison video

Organise **by factor with every tool swept inside each factor** — one "Pricing"
section covering all five tools, never one section per tool. Per-tool sections
make the viewer hold five separate verdicts in their head and make the scorecard
impossible to build.

The conclusion is organised by **who each option is for**. Verdicts are the
point of the video.

## For a tutorial

Sections are the phases of the job, in the order the maker performs them.

Three rules that only apply here, and that a comparison-shaped habit breaks:

- **The chosen approach is the spine, not a fence.** The approach the owner
  picked at gate 020 fixes **the workflow the video teaches** - which tool the
  viewer opens, and the order of the phases. It does **not** limit which sources
  the material may come from. Owner, 2026-08-27: *"i am totally ok with comnbing
  approaches... selecting one approach doesn't mean we have to only do all things
  from that video.. keep the idea/approach of the selected approach but obsiosuly
  we can take ideas from all diff videos, knowdlget base and make our own combined
  way - thats obiosuly alloed"*.

  **Combining is the point.** A technique, a warning, a framing or a number from
  any source in `knowledge.md` is fair game, and a video that folds the best of
  all of them into one route is better than any single source. The whole
  `# Approaches` section exists so the owner can splice - see the splice-in
  techniques there.

- **One workflow, though.** The thing to guard against is not borrowed material,
  it is **a second competing walkthrough** - the viewer told to do the same job
  twice, two different ways, and left to choose. The rejected approaches are
  named and dismissed in one pass, in one section, and never taught. That is what
  "at most one section" means in `SCRIPT-PLAN-INSTRUCTIONS.md` and
  `SCRIPT-INSTRUCTIONS.md`.

- **A borrowed number stays attached to the tool it came from.** This is the only
  real limit on combining, and it is honesty rather than scope: a credit price
  from a different platform is not the chosen tool's price, and a setting from a
  different tool's panel is not the chosen tool's setting. Adapt it, attribute it,
  or state the general shape - never relabel it. Where the chosen tool's own
  number is missing from `knowledge.md`, that is a gap for the owner, not a figure
  to borrow.

### The rule that used to be here was wrong (2026-08-27)

For a short time this said *"every section must be supported by the chosen
approach's own source… if the answer is a rejected approach, it is not a
section"*, written from the owner's *"was 10 present in refernce video? if not -
lets remove that as well"*. He rejected it immediately: *"this is wrong... you
made opposidte rule"*.

**What actually went wrong on `vox-style-video-ai`** was narrower than the rule
claimed. A costs section quoted `$20 in credits` and `$3.50 a chapter` - figures
belonging to Higgsfield and Kie AI - as though they were the chosen tool's
prices. The defect was the mislabelled numbers, not the existence of a costs
section. Cutting the section fixed the symptom and banned the wrong thing.

The generalisation error is recorded in `FEEDBACK-LOG.md`; it is the second time
in one session that a specific correction was written up as a broader ban than
the owner asked for.
- **There are no verdicts, because there is nothing to rank.** A tutorial that
  scores its own steps has become a comparison by accident. If a step has a real
  fork in it, that is a fork inside one section, not a scorecard.
- **The conclusion is what to do next and what breaks**, not a named winner.
  `TASTE.md`'s preamble records how T3–T5 read for a tutorial, because those
  rules were written from comparison scripts.

## The format is already decided when you get here

Step 010 called it — tutorial or comparison — and stated the call in the gate
020 message. **Do not re-open it and do not ask.** Owner instruction,
2026-08-27: *"going forward you can take the call whether a video is supposed to
be a tutorial or comparison"*.

Two things you must do with it:

- **Put it on the `Format:` line**, under the title. It is metadata this document
  carries so `script-plan.md` and `script.md` cannot silently write the other
  shape.
- **If the knowledge does not support the call**, say so to the owner before
  writing. That is a gap that escaped gate 020, not a format decision to
  quietly flip.

The owner overrides the call at gate 040. That is the last cheap moment.

## What the owner does with it

Reads it, and either approves the direction or reorders/renames/cuts sections.
This is the last cheap moment to change what the video is about. Once it is
approved, `script-plan.md` is written against it and the section names are
locked.

This file is **not** parsed by anything. It is read by the owner and by whoever
writes `script-plan.md` next. Keep it readable rather than machine-shaped.
