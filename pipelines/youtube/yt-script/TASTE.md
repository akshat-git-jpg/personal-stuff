# TASTE.md

Owner feedback about `yt-script` output, turned into rules. The writing steps
(030, 050, 100) read this alongside their own instruction file.

**This file holds taste, never format.** The three instruction files
(`OUTLINE-INSTRUCTIONS.md`, `SCRIPT-PLAN-INSTRUCTIONS.md`,
`SCRIPT-INSTRUCTIONS.md`) hold format, and `SCRIPT-PLAN-INSTRUCTIONS.md`'s forms
are parsed by `lib/beats.mjs`. The two kinds do not share a file:
`steps/130-learn-from-feedback-llm/README.md` has the routing table and the
reason.

Every rule names where it came from, so it can be retired when its cause is gone
rather than living forever by default. **Enforced by** tells you whether a
machine will catch a breach; where it says *author judgement*, nothing will stop
you shipping the mistake again except reading this file.

## How a rule gets here

The owner reacts to a script. The reaction is logged in `FEEDBACK-LOG.md` with a
`kind`, and the current video is fixed. **A rule is written only on the second
reaction of the same `kind`**, or when the owner explicitly asks for one. Step
130 owns that threshold and the vocabulary.

Rules are appended and never renumbered. A rule whose cause is gone is retired in
place, with a note, so the reason it existed outlives it.

---

## T1 — A taste rule must never narrow what a script is allowed to say.

**From:** the session that commissioned this file, 2026-08-26. Owner: *"Do note
that I don't want to limit the creativity of the script writing, but I want
slowly and slowly for this skill to be able to learn my preferences and to be
able to learn how I like to make my scripts."*

This is the rule about the rules, and it is first because it constrains every
rule after it. A `T` rule records something the owner has actually rejected
twice. It does not pre-specify what a good script contains, list approved
sentence shapes, or supply copy to reuse. The moment a rule reads like a
template, the writing step has nothing left to decide and this file has stopped
helping.

The practical test before appending anything: could two good scripts both obey
this rule and still read completely differently? If not, it is a format rule in
the wrong file, or it is not a rule at all.

**Applies to:** 130
**Enforced by:** the promotion threshold in `steps/130-learn-from-feedback-llm/README.md` - repeat before rule, and the owner approves every promotion.
