# Script plan instructions

The script plan is the **beat-by-beat recording document** for a remote tutorial
maker. He reads the intro and conclusion aloud as written, walks the body beat by
beat recording his screen, and writes the demo lines himself.

Renamed from `outline.md` on 2026-08-23. It never was an outline — it carries
verbatim intro and conclusion copy plus every body beat's lanes, which is a draft
script. The real outline (`outline.md`) is now a separate, earlier, one-page
document holding a table of contents and a card per section, and the owner approves the video's
direction there, while changing it is still cheap. See
`OUTLINE-INSTRUCTIONS.md`.

```
knowledge.md  ->  outline.md  ->  script-plan.md  ->  the script desk
                  (direction)     (this file)        (what he opens)
```

He does not receive a PDF any more. `script-plan.md` is published to the script
desk (`apps/yt-script-desk`) and he opens a URL, which is the only handoff.
`render-outline.mjs` and `render-script.mjs` were dropped from the flow on
2026-08-23 — the desk replaced both.

**This file governs the document's shape. `SCRIPT-INSTRUCTIONS.md` governs the
spoken words, and step 050 must read both.** The intro and conclusion written
here are finished copy a narrator reads aloud, so every rule there applies: "One
sentence per line", "Reading as a human", the voice sections, and `TASTE.md` T2,
T8 and T10. Added 2026-08-27, after an intro came back as dense paragraphs because
this file was the only one the step had been told to open.

Two halves, two standards:

- **Intro and conclusion — finished verbatim copy.** Nothing left to decide.
- **Body — lane blocks.** Every beat carries the same lanes in the same order,
  so his eye learns one position and never asks "is this something I say?"

---

## The markdown is parsed, not just rendered

`render-outline.mjs` is a parser. It recognises the exact forms below. Anything
it does not recognise falls through to plain prose — **silently**, with no
error and no lane. Getting a form wrong does not fail the build; it produces a
worse outline that still looks fine at a glance.

Every form is valid markdown, so the raw file still previews acceptably
anywhere.

| Write this | Get this |
|---|---|
| `# Title` | Document title |
| `## 1 · INTRODUCTION` | A numbered part |
| `### SECTION: Live Demo` | A section inside the body (`SECTION:` is stripped) |
| `#### 2.3 · HeyGen` | A beat |
| `**SAY**` alone on a line, then a `>` blockquote | Amber chip, serif text, amber rail |
| `**SHOW**` alone on a line, then plain lines | Teal chip, sans text, teal rail |
| `**EDIT**` alone on a line, then plain lines | Rose chip, sans text, rose rail |
| `**FACTS**` alone on a line, then plain lines | Slate chip, sans text — numbers for this beat |
| `**DEMO**` alone on a line, then plain lines | A silent block in the LEFT track — something plays, nobody speaks |
| `**SAY** — lip-sync` | Same, with a small caption under the chip |
| `> **RULES — WHOLE SECTION**` then `> - item` lines | Red rules box |
| `> **VERDICT:** ...` | Slate verdict block |
| A pipe table | A real scrollable table |

**The lane label must sit alone on its own line.** `SAY: "..."` on one line is
not recognised. Blank lines between the label and its content are fine.

**Spoken copy goes in a blockquote; instructions do not.** That indent is the
only signal telling him what to read aloud. Quoting a SHOW or EDIT line breaks
the one rule the whole document rests on.

For multi-paragraph spoken copy, keep every line inside the blockquote and
separate paragraphs with a bare `>`.

---

## The FACTS lane

A beat may carry a `**FACTS**` lane: the numbers, prices, limits and product
names that beat depends on, lifted from `knowledge.md`. Plain lines, never a
blockquote — it is not spoken.

```
**FACTS**
Higgsfield Soul ID trains once, about 5 minutes.
Midjourney needs the reference URL pasted into every prompt.
```

It exists so the script desk can put a beat's numbers beside that beat instead
of making the maker hunt through the whole knowledge file. It is optional: an
outline with no FACTS lanes parses fine and the desk simply shows no facts.

**FACTS is never spoken copy.** Putting it in a blockquote makes the parser
treat it as prose, and the desk will not show it.

## Beat headings are labels, not descriptions

**A beat's `####` heading carries a short label, and the maker never sees it as
the beat's heading.** Owner, 2026-08-27, reading beats called `Cold open — a
finished Vox shot, no logos, no UI` and `Reveal, who this is for, and
credibility`: *"I don't like it. These are too confusing. I prefer that this
heading should be the actual outline headings... you can keep that as intro as a
heading and then you can just make it intro 1.1 intro 1.2."*

**The heading a beat appears under is the outline's own heading** — the section
name for a body beat, the part name for an intro or conclusion beat. The desk
renders that plus the beat number, and nothing else. Before this it rendered the
`####` label and never showed the section at all, so the section names the owner
approved at gate 040 were invisible in the tool built to review them.

So write the label for **you and the reviewer**, not as a headline:

- **Two to five words**, plain. `Cold open`, `The map trick`, `Bulk generate`.
- **No dash clauses, no lists, no promise.** `Cold open — a finished Vox shot,
  no logos, no UI` is three things at once.
- **What the beat *is*, not what it argues.** `Reveal` beats `Reveal, who this
  is for, and credibility`.

What the beat covers already lives in `SAY`, `SHOW` and `EDIT`. The label is an
index entry, so a human can find the beat in a 700-line file.

## The DEMO lane — a silent stretch

**`DEMO` marks a stretch where something plays or is shown and nobody speaks.**
Added 2026-08-27. Owner: *"there are multiple areas during our script where we
are not even saying anything, we are just showing something... that doesn't come
in the left side vertical timeline. It's confusing."*

```
#### 1.1 · Cold open — the finished shot

**DEMO**
The finished Vox shot plays. No voiceover.

**SHOW**
Roughly 12 seconds: locked background, cutouts landing, one slow camera push.
No browser, no logo, no cursor.
```

**It is timeline content, not an instruction.** That is why it renders in the
desk's **left** track alongside the spoken copy, and it is the one exception to
"instructions never enter the left track". The left track is the audio timeline,
and a stretch with no audio is part of that timeline. Without it a cold open
simply does not appear, and the video looks like it starts on the first spoken
line — which is what the owner hit on `vox-style-video-ai`.

**Keep the DEMO line short and about the timeline.** One or two lines naming what
plays and that nobody is speaking. **How to shoot it stays in `SHOW`; how to cut
it stays in `EDIT`.** A DEMO lane that grows shooting notes has smuggled an
instruction into the left track and the exception stops being one.

**Not a blockquote.** Plain lines, like `SHOW` and `EDIT`. A blockquote means
spoken copy, and the whole point is that nothing here is spoken.

**The silence comes first, so the spoken copy must read as coming after it.**
`DEMO` renders at the **top** of its beat, above the spoken lines, always. Every
line of that beat's `SAY` is therefore heard *after* the viewer has already
watched. **Never write a line that points forward to the demo.** "Just watch this
for a second", "here is what that looks like", "let me show you" — each of them
promises something the viewer has just sat through, and the beat plays as a
contradiction.

Write the spoken copy as a **reaction**, not an introduction:

| Wrong — points forward | Right — points back |
|---|---|
| "So before I say anything else, just watch this." | "You have probably seen shots like this before." |
| "Let me show you what it looks like." | "What you just watched was made with AI." |
| "Here is the finished result." | "That took one afternoon." |

If the video genuinely needs to tease first and *then* go silent, that is **two
beats** — a spoken beat, then a beat whose only left-track content is its `DEMO`.
That is still the lane as a beat property; it is not a new kind of beat. Do not
try to get both orders out of one beat, because only one of them renders.

Broken on 2026-08-27 in `vox-style-video-ai` beat 1.1, on the same day the lane
was added. Twelve seconds of shot played in silence, then the voice said *"just
watch this for a second."* Owner: *"You said just watch this for a second and
after that there is no demo section... Is the sequencing wrong?"* The desk was
right; the words were written for the opposite order.

**A property of a beat, never a beat of its own.** Owner decision, 2026-08-27:
a beat can open silent and then have spoken copy, and both render in the left
track in that order. It does not change the beat's `mode`, so it never adds to
the maker's write count and he gets no box for it — there is nothing for him to
write.

Use it wherever the video runs without narration: a cold open, a finished result
playing before it gets explained, a demo the viewer watches in silence, a
before-and-after held on screen.

## The rules box

Anything true for a whole section goes in a `RULES` blockquote directly under
the section heading — **stated once**, never repeated inside each beat.

This is the single biggest readability fix. A rule like "never play a finished
output in this section" is the instruction that breaks the video if missed.
Buried in a paragraph it gets skimmed; restated in all five beats it becomes
wallpaper.

If an instruction appears in more than one beat of a section, it belongs in the
rules box instead.

## The intro — verbatim, no word limit

**Length follows the video.** There used to be a 130-160 word cap here; the owner
removed it on 2026-08-27: *"depending on the video, if I am making a very long
video and very detailed video, then obviously I would want my intro to be more
hooky, more hook and more detailed... if it's a short video then maybe short intro
is fine."* `SCRIPT-INSTRUCTIONS.md` has the sizing guidance and the one thing
still banned, which is padding.

A long-form video's intro carries a longer hook and a roadmap naming every
section; a short video's intro is short. Both are correct. What is not correct is
either one hitting a number.

Six beats in order, no skipping, no reordering:

1. **Who it's for** — the viewer's exact situation, so they recognise
   themselves in the first sentence.
2. **Credibility** — what you actually did. Specific beats vague.
3. **Promise** — what they walk away knowing.
4. **Roadmap** — name the body sections out loud, in order. Each spoken line
   must contain its `### SECTION:` heading **verbatim**, inside a normal
   sentence: *"First, what makes it look like Vox, so you can judge your own
   results properly."*

   **Never annotate the match.** The heading appearing in the sentence *is* the
   match; there is nothing to prove and nothing to label. A blockquote holds
   only words that come out of your mouth, so a bracketed heading after the
   sentence — `... judge your own results properly. (What makes it look like
   Vox)` — is a line the voice reads aloud. `test/roadmap.test.mjs` checks the
   match for you, on every plan, which is why the annotation buys nothing.

   Broken on 2026-08-27 in `vox-style-video-ai`: eleven headings were appended
   in brackets to the eleven roadmap sentences that already contained them.
   Owner: *"What are these texts in the bracket and why are they in read as
   written? This is a major gap, right?"*
5. **Links in description** — always present.
6. **Transition** into the body.

Where the video opens cold, that beat gets its own `####` heading naming the
shot, e.g. `#### Cold open — HeyGen avatar, temp human voice`.

Never open with "In this video, we will…" or "Hey guys, welcome back."

## The conclusion — verbatim, no word limit

Same rule as the intro, and the same removal date. Length follows from how much
closing the video needs.

Five beats in order: wrap signal → deals and free-trial links in the
description → thanks → a comment prompt that asks something answerable →
subscribe and sign off. Both monetisation beats always appear.

## Body CTAs — plan them, do not leave them to the writer

**Two to four link mentions live in the body**, on top of the intro and
conclusion CTAs. `SCRIPT-INSTRUCTIONS.md` has the cadence rules and the wording
guidance; the plan's job is to **place** them.

- Mark each one in the beat's `EDIT` lane as `CTA — link in description`, in the
  beat where the tool has just visibly done something well.
- Spread them across the document. Never two in adjacent sections.
- Never place one in a beat whose subject is a limitation or a failure fix.
- Where a promo code or deal exists, say so in the lane so the writer knows to
  name it.

The maker will phrase them. Leaving the placement to him is how a video ends up
with either none or four in a row.

## The spoken words go through `humanizer`

Step 050 runs it in Mode B. The verbatim intro and conclusion get a full pass;
a body `SAY` is a draft prompt, so what matters there is the rhetorical shape.
A `SAY` handed over as a binary contrast, a faux-insight setup or a fake-profound
kicker is a mould the maker will fill, and the tell then arrives in his draft
wearing his name. `SCRIPT-INSTRUCTIONS.md` has the pattern table.

## The body

### Sections

Named exactly as the intro's roadmap named them. Section count follows the
material.

**`outline.md`'s first line carries `Format: tutorial` or `Format: comparison`.**
Read it before writing a single section, and do not infer it from the section
names. The two shapes diverge here and stay diverged through step 100.

**For a comparison**, organise **by factor with every tool swept inside each
factor** — one Features section covering all tools, not one section per tool.
Every section closes with a `> **VERDICT:**` line, because ranking is what the
viewer came for.

**For a tutorial**, sections are phases of the job in the order he performs them.

- **No `> **VERDICT:**` line.** There is nothing being ranked, and a phase given
  a verdict reads as a score on the maker's own work. Where a phase ends on a
  real judgement — an approach picked at a fork, a setting that only suits one
  case — that belongs in the beat's own lanes, not in a section-closing verdict.
- **The `SAY` draft for a phase must carry the exact value** — the setting, the
  menu path, the price, the model name — wherever `knowledge.md` has one. This
  is the whole reason a viewer chose a tutorial over the tool's own docs.
- **Give each phase's known failure mode a beat or an `EDIT` note**, where the
  knowledge names one. A tutorial that only shows the happy path is the one the
  viewer abandons at the first error.
- **Approaches the owner rejected at gate 020 get at most one section**, saying
  why the chosen one won. Never a second walkthrough. **This limits walkthroughs,
  not material** - a technique, warning or framing from any source in
  `knowledge.md` is fair game and combining them is expected. See the tutorial
  rules in `OUTLINE-INSTRUCTIONS.md`. The one honesty limit: a price or setting
  stays attached to the tool it came from and is never relabelled as the chosen
  tool's.

### Beats

One beat per feature — one thing he can show and explain in a continuous
stretch. Not one click, not a whole tool.

The `SAY` lane holds real spoken copy, written as a draft. He refines it into
final script after exploring the tool, so give him something to react to rather
than a blank page.

### The proof insert

Where a section explains how to do something impressive, the first beat shows
the **result** — the finished output, the real example. Motivation before
mechanics.

### On-screen tables

A `SHOW` lane saying "on-screen graphic:" followed by a pipe table, then a
following beat that walks the rows — one `**SAY** — <row>` lane per row. The
table is what the viewer sees; the lanes under it are what he says while it's
up.

---

## Hard rules

- **Intro and conclusion are finished copy. Body beats are lanes.** Never mix.
- **Lane labels sit alone on their line**, or the parser drops the lane.
- **Spoken copy is always a blockquote. Nothing else is.** And a blockquote
  holds **only** what is said aloud — no notes, no labels, no bracketed
  cross-references. Anything you want to say *about* the copy goes in `EDIT`.
- **Repeated instruction means it belongs in the rules box.**
- **Intro roadmap and section headings match word for word.**
- **Every claim traces to `knowledge.md`.** No support, no line — raise the gap.
- **No comparison section without a verdict.** A tutorial section carries none —
  see the tutorial rules above. This rule said "no section without a verdict"
  until 2026-08-27, which contradicted them.
- **No HTML or PDF is generated any more.** The markdown is the source and
  the script desk renders it. `render-outline.mjs` is retired.
