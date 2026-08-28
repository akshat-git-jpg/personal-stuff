# 050 - write the script plan

**[LLM]** &nbsp; Expands the approved outline into the full beat-by-beat draft.

The approved `outline.md` + `knowledge.md` -> `videos/<key>/script-plan.md`, following `SCRIPT-PLAN-INSTRUCTIONS.md`. Two halves at two standards: intro and conclusion are finished verbatim copy; the body is beats carrying `SAY`/`SHOW`/`EDIT`/`FACTS` lanes. Was called `outline.md` until 2026-08-23.

**Reads:** `knowledge.md`, `outline.md`

**Writes:** `script-plan.md`

---

## What happens

Read **both** of these in full and follow them exactly, then write
`videos/<key>/script-plan.md` against the approved `outline.md`:

1. **`SCRIPT-PLAN-INSTRUCTIONS.md`** — the document's shape and its parsed lane
   forms.
2. **`SCRIPT-INSTRUCTIONS.md`** — how spoken words are written: "One sentence
   per line", "Reading as a human", "Length and pacing", and the voice sections.
   Plus `TASTE.md` in full.

**Both, not just the first one.** This step writes finished verbatim copy for the
intro and the conclusion, so every rule governing spoken words applies here and
not only at step 100. On 2026-08-27 this said "read `SCRIPT-PLAN-INSTRUCTIONS.md`
in full" and nothing more, the intro came back as dense paragraphs, and the
one-sentence-per-line rule that would have caught it was sitting in the file this
step was never told to open.

## Two halves, two standards

- **Intro (130-160 words) and conclusion (80-100 words)** - finished verbatim
  copy. Nothing left to decide.
- **Body** - beats with lanes. A body beat's `SAY` is a SHORT DRAFT PROMPT, not
  finished copy. Writing it as polished prose collapses this into a duplicate of
  the script and defeats having two documents.

## Run the `humanizer` skill, in Mode B

**Required.** Owner, 2026-08-27: *"My script should not look AI generated, so use
the humanizer skill"*. Everything this step writes is heading for a viewer's ears.

**Mode B, because nothing exists yet.** Write clean from the start rather than
producing an AI-flavoured draft and patching it. That applies to both halves:

- **The verbatim intro and conclusion** are finished spoken copy. Full pass.
- **A body beat's `SAY`** is a short draft prompt, not polished prose, so the
  prose-level patterns barely apply. What does apply is the **rhetorical
  posture**: a `SAY` shaped as a binary contrast ("this isn't X, it's Y"), a
  faux-insight setup, or a fake-profound kicker hands the maker a shape to fill
  in, and he will fill it in. The tell survives into his draft, and step 100 then
  has to strip it out of his words instead of yours.

`SCRIPT-INSTRUCTIONS.md` lists the patterns under "Reading as a human", including
the one place the house convention and the skill genuinely disagree.

## Section names come from the outline

`### SECTION:` headings and the intro's roadmap must match `outline.md` word for
word. The owner approved those names at 040.

## The markdown is parsed

`lib/beats.mjs` reads this file and the desk renders what it finds. An
unrecognised form falls through to plain prose **silently** - no error, no lane.
The exact forms in `SCRIPT-PLAN-INSTRUCTIONS.md` are load-bearing.

## The instructions are written like the script

The lanes are not scratch notes. The owner reads them at gate 055 and the maker
works from them, so they obey the same language rules as the spoken copy: one
idea per line, everyday words, and an `Example:` line under anything abstract.

`TASTE.md` T11 has the rule and the reason. `SCRIPT-PLAN-INSTRUCTIONS.md`,
section **"Write the instructions like the script"**, has the shape.

**The failure this prevents:** on the first pass at `vox-style-video-ai` the
spoken copy got every rule applied to it and the instruction track got none.
The `VIDEO` lane came out as long abstract prose — *"be specific rather than
calling it cluttered"*, *"contrast with what a normal edit does"* — which reads as
thorough and is unusable. Owner: *"all the instructions - i am finding too hard to
understand."* All 56 beats had to be rewritten.
