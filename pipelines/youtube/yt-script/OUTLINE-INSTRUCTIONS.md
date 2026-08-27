# Outline instructions

The outline is **the video's table of contents**: what the video is, what order
it happens in, and enough of what is inside each section that the owner can
picture it. It exists so he can approve the video's *direction* before anyone
writes a word of script.

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
over six and you are writing the beat document.

A real one:

```markdown
# Best Realistic AI Avatar Generator for Online Courses & Training

Format: comparison
Target: 18 min

## Contents
1. Quick Overview
2. Live Demo
3. Realism
4. Features For Course Creators
5. Pricing And Value
6. Summary Scorecard

## Intro
- hook: $300 and a studio day, versus a few dollars and a few minutes
- credibility: same script, same voice, same lesson through all five tools
- roadmap: names the six sections above

---

## 1. Quick Overview

Who each of the five tools is actually built for, before any of them is judged.

- what each one was built to do, in one pass
- the price tier each sits in
- which two are enterprise-first and why that shows up later
- the test conditions held constant across all five

## 2. Live Demo

The same script through all five, generated before any result is shown.

- the script, the avatar and the voice, held identical
- each platform's setup, and what stays off screen
- all five outputs revealed together, not one at a time

...
```

## Section names

**Every section name is a heading, not a sentence.** Owner, 2026-08-27: *"i
prefer simple heading and symmetricall. it should be like a title.. i prefer
section name to be simple and stndard"*.

- **A noun phrase, two to five words.** Title Case.
- **Symmetrical.** Every section in one outline takes the same grammatical shape.
  A list that mixes noun phrases with question clauses reads as a draft.
- **Standard words a viewer would scan for.** The name is a label on a card, not
  a joke and not a tease. The tease belongs in the hook.
- **No questions. No `When…` / `Why…` / `What…` / `How…` clauses. No verbs in
  the imperative.**

| Bad | Why | Good |
|---|---|---|
| `When It Breaks` | a clause, and a troubleshooting bucket | — (see below) |
| `Why One Chat` | a question without the mark | `Choosing The Tool` |
| `What Makes It Vox` | a clause | `The Vox Look` |
| `Locking the Style` | verb-first, breaks symmetry with noun-phrase siblings | `The Style Lock` |
| `Let's Add Motion` | imperative, and chatty | `Adding Motion` — acceptable only if **every** section is a gerund |

**Pick one shape for the whole outline and hold it.** All noun phrases, or all
gerunds. Never a mix.

## Never make a section out of failures

**A troubleshooting section is not a section.** Owner, 2026-08-27, on
`When It Breaks`: *"thats a bad section name.. infact that should not be even a
section name"*.

Failures belong in the phase where they happen. `SCRIPT-PLAN-INSTRUCTIONS.md`
already requires it: *"Give each phase's known failure mode a beat or an `EDIT`
note."* A bucket at the end means the viewer meets the fix minutes after the
moment it would have saved them, and the phase it belongs to is left teaching
the happy path only.

The same applies to any bucket-shaped section — `Tips And Tricks`, `Common
Mistakes`, `Extra Notes`. If a card's bullets have nothing in common except
that they did not fit anywhere else, it is not a section.

## Target length

`Target:` is required, in minutes, and it drives the section count.

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
- **No lanes.** No `SAY`, `SHOW`, `EDIT`, `FACTS`, no blockquotes, no verdicts,
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

- **The sections are the phases of the approach the owner picked at gate 020**,
  not a survey of every approach in `knowledge.md`. The approaches he did not
  pick are context, and at most one section covers them.
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
