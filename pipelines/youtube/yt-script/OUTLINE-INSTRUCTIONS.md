# Outline instructions

The outline is **one page that says what the video is and what order it happens
in**. Nothing else. It exists so the owner can approve the video's *direction*
before anyone writes a word of script.

```
knowledge.md  ->  outline.md  ->  script-plan.md  ->  the script desk
                  (this file)     (the beat doc)      (what the maker opens)
```

## Why this file exists

Until 2026-08-23 the first thing written after `knowledge.md` was the beat-level
document — verbatim intro copy, 25+ beats, lanes, verdicts, tables — and it was
called `outline.md`. Approving the direction therefore meant reading a finished
draft script. If the section order was wrong, or a section should not have
existed, all of it was rewritten.

This file is the cheap gate. A wrong running order costs one page here and a
whole document there.

## Shape

Markdown, **one screen**. Three parts, always in this order.

```markdown
# <the video's working title>

Format: tutorial | comparison

## Intro
- hook: <one line — what makes someone stay past 5 seconds>
- credibility: <one line — what you actually did>
- roadmap: names the body sections below, in order

## Body
1. <Section name> — <one line on what it covers>
2. <Section name> — <one line>
3. <Section name> — <one line>

## Conclusion
- <one line — what the verdict is organised by>
```

A real one:

```markdown
# Best Realistic AI Avatar Generator for Online Courses & Training

Format: comparison

## Intro
- hook: $300 and a studio day, versus a few dollars and a few minutes
- credibility: same script, same voice, same lesson through all five tools
- roadmap: names the six sections below

## Body
1. Quick Overview — who each of the five tools is actually built for
2. Live Demo — the same script through all five, generated before any is shown
3. Realism — lip-sync, expressions, gestures, judged over a full lesson
4. Features for Course Creators — templates, editing, branding, fixing a line later
5. Pricing & Value — real numbers, not the "starting at" line
6. Summary Scorecard — every score in one table

## Conclusion
- verdict split by budget and by what kind of course you are building
```

## Rules

- **One line per section. Never two.** The moment a section gets a paragraph,
  this has stopped being an outline.
- **No spoken copy anywhere.** Not one sentence the maker would read aloud. That
  is `script-plan.md`'s job and duplicating it here is how the two documents
  drift.
- **No lanes.** No `SAY`, `SHOW`, `EDIT`, `FACTS`, no blockquotes, no verdicts,
  no tables. Those are all script-plan forms.
- **Section names are final once approved.** `script-plan.md`'s `### SECTION:`
  headings and the intro roadmap must match these word for word, so renaming one
  later means editing three places.
- **Every section traces to `knowledge.md`.** A section the knowledge cannot
  support is a gap to raise with the owner, not a section to invent.
- **Body sections are numbered; intro and conclusion are bullets.** The numbers
  are the running order and the owner reorders by moving them.

## The format is already decided when you get here

Step 010 called it — tutorial or comparison — and stated the call in the gate
020 message. **Do not re-open it and do not ask.** Owner instruction,
2026-08-27: *"going forward you can take the call whether a video is supposed to
be a tutorial or comparison"*.

Two things you must do with it:

- **Name the format on the first line of the outline**, right under the title,
  as `Format: tutorial` or `Format: comparison`. One line. It is the only
  metadata this document carries, and it exists so `script-plan.md` and
  `script.md` cannot silently write the other shape.
- **If the knowledge does not support the call**, say so to the owner before
  writing. That is a gap that escaped gate 020, not a format decision to
  quietly flip.

The owner overrides the call at gate 040. That is the last cheap moment.

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

- **The sections are the phases of the approach the owner picked at gate 020**,
  not a survey of every approach in `knowledge.md`. The approaches the owner did
  not pick are context, and at most one section covers them.
- **There are no verdicts, because there is nothing to rank.** A tutorial that
  scores its own steps has become a comparison by accident. If a step has a real
  fork in it, that is a fork inside one section, not a scorecard.
- **The conclusion is what to do next and what breaks**, not a named winner.
  `TASTE.md`'s preamble records how T3–T5 read for a tutorial, because those
  rules were written from comparison scripts.

## What the owner does with it

Reads it, and either approves the direction or reorders/renames/cuts sections.
This is the last cheap moment to change what the video is about. Once it is
approved, `script-plan.md` is written against it and the section names are
locked.

This file is **not** parsed by anything. It is read by the owner and by whoever
writes `script-plan.md` next. Keep it readable rather than machine-shaped.
