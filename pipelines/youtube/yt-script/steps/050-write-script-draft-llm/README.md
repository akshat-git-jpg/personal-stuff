# 050 - write the script plan

**[LLM]** &nbsp; Expands the approved outline into the full beat-by-beat draft.

The approved `outline.md` + `knowledge.md` -> `videos/<key>/script-plan.md`, following `SCRIPT-PLAN-INSTRUCTIONS.md`. Two halves at two standards: intro and conclusion are finished verbatim copy; the body is beats carrying `SAY`/`SHOW`/`EDIT`/`FACTS` lanes. Was called `outline.md` until 2026-08-23.

**Reads:** `knowledge.md`, `outline.md`

**Writes:** `script-plan.md`

---

## What happens

Read `SCRIPT-PLAN-INSTRUCTIONS.md` in full and follow it exactly. Write
`videos/<key>/script-plan.md` against the approved `outline.md`.

## Two halves, two standards

- **Intro (130-160 words) and conclusion (80-100 words)** - finished verbatim
  copy. Nothing left to decide.
- **Body** - beats with lanes. A body beat's `SAY` is a SHORT DRAFT PROMPT, not
  finished copy. Writing it as polished prose collapses this into a duplicate of
  the script and defeats having two documents.

## Section names come from the outline

`### SECTION:` headings and the intro's roadmap must match `outline.md` word for
word. The owner approved those names at 040.

## The markdown is parsed

`lib/beats.mjs` reads this file and the desk renders what it finds. An
unrecognised form falls through to plain prose **silently** - no error, no lane.
The exact forms in `SCRIPT-PLAN-INSTRUCTIONS.md` are load-bearing.
