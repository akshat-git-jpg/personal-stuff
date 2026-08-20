# Outline instructions

The outline is a **read-only recording reference for a remote tutorial maker**.
He reads the intro and conclusion aloud as written, walks the body beat by beat
recording his screen, and freestyles the demo. He does not edit this file — he
copies the body into his own doc to draft script.

He receives a **PDF**. The markdown here is the source; `render-outline.mjs`
turns it into the styled HTML and PDF he actually opens.

```
outline.md  →  node render-outline.mjs <slug>  →  outline.html + outline.pdf
```

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

For a comparison, organise **by factor with every tool swept inside each
factor** — one Features section covering all tools, not one section per tool.
For a tutorial, sections are phases of the job in the order he performs them.

Every section closes with a `> **VERDICT:**` line.

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
- **Never commit the generated `outline.html` / `outline.pdf`** — they are
  gitignored. The markdown is the source; regenerate on demand.
