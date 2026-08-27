# Script plan instructions

The script plan is the **beat-by-beat recording document** for a remote tutorial
maker. He reads the intro and conclusion aloud as written, walks the body beat by
beat recording his screen, and writes the demo lines himself.

Renamed from `outline.md` on 2026-08-23. It never was an outline — it carries
verbatim intro and conclusion copy plus every body beat's lanes, which is a draft
script. The real outline (`outline.md`) is now a separate, earlier, one-page
document holding sections and one line each, and the owner approves the video's
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

## The rules box

Anything true for a whole section goes in a `RULES` blockquote directly under
the section heading — **stated once**, never repeated inside each beat.

This is the single biggest readability fix. A rule like "never play a finished
output in this section" is the instruction that breaks the video if missed.
Buried in a paragraph it gets skimmed; restated in all five beats it becomes
wallpaper.

If an instruction appears in more than one beat of a section, it belongs in the
rules box instead.

## The intro — verbatim, 130–160 words

Six beats in order, no skipping, no reordering:

1. **Who it's for** — the viewer's exact situation, so they recognise
   themselves in the first sentence.
2. **Credibility** — what you actually did. Specific beats vague.
3. **Promise** — what they walk away knowing.
4. **Roadmap** — name the body sections out loud, in order. These must match
   the `### SECTION:` headings **exactly**.
5. **Links in description** — always present.
6. **Transition** into the body.

Where the video opens cold, that beat gets its own `####` heading naming the
shot, e.g. `#### Cold open — HeyGen avatar, temp human voice`.

Never open with "In this video, we will…" or "Hey guys, welcome back."

## The conclusion — verbatim, 80–100 words

Five beats in order: wrap signal → deals and free-trial links in the
description → thanks → a comment prompt that asks something answerable →
subscribe and sign off. Both monetisation beats always appear.

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
  why the chosen one won. Never a second walkthrough.

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
- **Spoken copy is always a blockquote. Nothing else is.**
- **Repeated instruction means it belongs in the rules box.**
- **Intro roadmap and section headings match word for word.**
- **Every claim traces to `knowledge.md`.** No support, no line — raise the gap.
- **No section without a verdict.**
- **No HTML or PDF is generated any more.** The markdown is the source and
  the script desk renders it. `render-outline.mjs` is retired.
