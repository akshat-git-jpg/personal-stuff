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

## Write the instructions like the script

**Every lane obeys the same language rules as the spoken copy.** T8 (everyday
words) and T10 (short sentences, one idea each) are not about the blockquote.
They are about the whole document. A `SHOW` lane written as one 60-word sentence
of abstract direction is exactly as unusable as a spoken line written that way.

Owner, 2026-08-28: *"all the instructions - i am finding too hard to understand.
Can you please keep the instruction similarly a script? Basically simple and to
the point."*

**Three rules, and they are the same three the script gets:**

1. **One line per idea.** Break every lane onto separate lines the way a `SAY`
   block is broken. If a lane is one long line with three ideas in it, it is
   three lines.
2. **Everyday words.** No "unattended", "counterintuitive", "cohesive",
   "generalises", "brisk". If you would not say it to a friend, do not write it
   in a lane.
3. **An `Example:` line wherever the instruction is abstract.** This is the new
   one. Any time a lane says *what* without saying *what that looks like*, the
   next line starts with `Example:` and shows it.

**The Example line is the fix that matters most**, because "be specific rather
than calling it cluttered" is an instruction nobody can act on:

| Abstract on its own | With the example |
|---|---|
| `Contrast with what a normal edit does.` | `Then say what a normal edit does instead.`<br>`Example: "a normal edit cuts to a new picture. This one just moves things around on the same picture."` |
| `A three-layer breakdown of one real shot.` | `Pull one real shot apart into its three layers.`<br>`Example: back layer is the sky, middle is the buildings, front is the person.` |
| `Two topic examples, one that passes and one that does not.` | `Two topic examples side by side.`<br>`Example that passes: "why this shipping route changed the world."`<br>`Example that fails: "is this tool better than that one."` |

**`FACTS` is one fact per line.** Never a paragraph of semicolons. The first pass
on `vox-style-video-ai` put nine separate findings into a single 90-word sentence,
which is a wall the owner has to parse before he can check any one of them.

**Where the instruction is already concrete, no example is needed.** `Hold the
frame for 4 seconds or more` needs nothing. The example exists for abstraction,
not for decoration.

## Name a source, link the source

**The freelancer has never heard of any of these people.** The lanes cite them
constantly — *"Joseph's checklist"*, *"Skai's angle"*, *"both Thomas Creates and
Joseph"* — and to him those are three strangers with opinions. Owner, 2026-08-28:
*"can we please add reference link wherever possible for my freelancer... you
said Joseph's list, but I don't think my freelancer is aware of Joseph."*

**Every section that names a person carries one reference line**, at the end of
its first `FACTS` block, which reaches the desk as **General Notes**:

```
Who these people are: Skai Generated https://youtu.be/Jkt4aTOpqpM · Luuk Alleman https://youtu.be/i5-tZegBvxU
```

Only the people that section actually names. In first-mention order. Per section,
not once per document, because he works one section at a time and should never
scroll up to find out who somebody is.

**Bare URLs. Never markdown links.** The instruction track renders text with one
handler for `**bold**` and nothing else, so `[Joseph](https://youtu.be/...)`
prints its own brackets. `WriteView.tsx` turns a bare URL into a clickable link;
a markdown one just looks broken. Guarded by `test/sourceLinks.test.mjs`.

**Never put a URL in a blockquote.** A blockquote is what comes out of the
presenter's mouth, and nobody reads a link aloud. Same test guards that.

**Do not link the same name inline at every mention.** The first attempt on
`vox-style-video-ai` did, and it mangled the names it was trying to explain —
`Skai (Skai Generated, https://…) Generated`, `Joseph (Joseph | Video Editing,
https://…)'s design checklist`. One line per section, names left alone.

## The ASK lane - your open question for Claude

**`ASK` is the owner's own question, left in place while he reviews.** Not script,
not an instruction for the maker. It is the one thing his editor could not give
him, and it is the whole reason there is no markup UI in the browser.

```
#### 2.25 - Generic looks like

**SHOW**
The generic boards, full screen.

**ASK**
Say which boards. And is 200% too close to read the texture?
```

**In the editor: type `ask`, press Tab.** `.vscode/yt-script.code-snippets`
expands it. `??` and `ask1` work too.

**Where it can go.** On a beat, like any lane. Or between a `### SECTION:`
heading and that section's first beat, for something about the whole section -
it attaches to the first beat, exactly like a section `FACTS` block.

**How it renders.** A purple card in the desk's **left** track, under the beat,
labelled `Asked Claude`. Deliberately not the paper/serif treatment: **nothing
purple is ever on paper**, so a note to Claude can never be read aloud.

**It never leaves this repo.** `buildWorksheet` only emits `SAY` blocks, so an ASK
cannot reach the maker's worksheet. `desk.mjs publish` **refuses** while any ASK
remains and names them; `--force` overrides that, and strips the field anyway.
Guarded by `test/askLane.test.mjs` and `bin/__tests__/askGate.test.mjs`.

**The loop.** Write ASKs while you read -> say `edits are done` in the terminal ->
the session lists every ASK with what it intends to do -> you approve or correct ->
it applies the changes and deletes the ASK lines. Repeat as many rounds as you
like. Publishing is blocked until none are left.

### Why this instead of an editing UI

A full review-and-markup layer for the desk was designed on 2026-08-28: hover
tools on every note, click-to-edit, an add-note menu, a request composer, an
overlay store, four plans. The owner stopped it before a line was written:

> *"I feel that this will be too complex. making comments, edits, all those things
> one by one on the URL when I have the entire thing as a text in my MD file,
> which I can easily cut paste everything. I can't do that easily on the UI."*

He was right. The desk is the better **reader** - two tracks, sections, one glance.
His editor is the better **writer** and always will be. The plan is already a text
file he owns. The only gap was leaving a question in place that the desk could show
back, and that is one lane, one regex and one card.

**Do not grow this into an editor.** If a future ask sounds like "let me edit notes
in the browser", the answer is the same: he edits the markdown, the desk renders it,
and he refreshes.

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
