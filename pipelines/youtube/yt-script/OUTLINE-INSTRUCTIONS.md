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

## For a comparison video

Organise **by factor with every tool swept inside each factor** — one "Pricing"
section covering all five tools, never one section per tool. Per-tool sections
make the viewer hold five separate verdicts in their head and make the scorecard
impossible to build.

## For a tutorial

Sections are the phases of the job, in the order the maker performs them.

## What the owner does with it

Reads it, and either approves the direction or reorders/renames/cuts sections.
This is the last cheap moment to change what the video is about. Once it is
approved, `script-plan.md` is written against it and the section names are
locked.

This file is **not** parsed by anything. It is read by the owner and by whoever
writes `script-plan.md` next. Keep it readable rather than machine-shaped.
