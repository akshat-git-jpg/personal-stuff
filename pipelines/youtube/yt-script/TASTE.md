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

---

## Seeded rules T2-T5 — migrated from `SCRIPT-INSTRUCTIONS.md`, 2026-08-26

These four were already being followed. They were written into
`SCRIPT-INSTRUCTIONS.md` as though they were format, and moved here when the
owner approved the split (plan 254). **They are seeded, not folded**: no
`FEEDBACK-LOG.md` row triggered them and no owner reaction is quoted, because
they predate the log. `From:` therefore cites the instruction file and the
hand-written script it was modelled on, the way
`pipelines/video/visuals-flow/TASTE-SIMPLE.md` cites its reference measurements.

Retire them on the same terms as any other rule: in place, with a note.

## T2 — Talk to one viewer, in contractions, in short sentences.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Direct address to the viewer as 'you.' Casual-professional —
contractions, short sentences, no corporate hedging."* Modelled on the script the
owner wrote by hand, 2026-08-11.

Second person, not "the user" or "viewers". Contractions rather than the expanded
form. No hedging clause where a plain statement will do. The register is a person
who has actually used the tools talking to a person deciding whether to, which is
neither a lecture nor a press release.

This is a floor, not a ceiling. It rules out a house style; it does not supply
one.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T3 — Earn the verdicts before making them.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Frame every comparison as fair and unbiased before making
claims: state the test conditions (same script, same inputs) up front so verdicts
later feel earned, not sponsored."*

State the test conditions in the intro, before any option is judged. Same script,
same inputs, same clip length — whatever was actually held constant. A viewer who
knows the method reads a later verdict as a finding; a viewer who does not reads
it as a preference, or as a placement.

This is also why the script never needs sponsor-disclaimer language later: the
fairness is established by the method, not asserted.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T4 — Credit before limit. Never open a verdict with the negative.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md`, 2026-08-26. It was stated
**twice** there, in "Voice and tone" — *"Give every option credit before naming
its limit. Never open a platform's verdict with the negative — earn the criticism
after stating what it's genuinely good for."* — and again in "Closing convention"
item 1 — *"Each gets a fair reason to exist, then its limit — never the reverse
order."* One rule, two wordings, in one file.

Every option gets a real reason to exist before its limit is named. Not a
throwaway concession before the real point: the thing it is genuinely best at,
said plainly enough that someone for whom that matters would pick it.

The reason is not politeness. A ranking where every option is first praised on
its own terms tells the viewer which one is for *them*; a ranking that leads with
faults only tells them what the presenter dislikes.

**The ordering itself is not this rule.** "Honest Verdict, weakest to strongest"
is structure and stays in `SCRIPT-INSTRUCTIONS.md`. This rule governs what
happens inside each verdict, whatever order they come in.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T5 — Land on one named winner, not on "it depends".

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Confident, singular recommendations at the end — not 'it
depends,' a named winner with a one-line reason."*

The conclusion names a pick and gives one line of why. Addressing different picks
to different named viewer personas is fine and is the structure step 100 already
follows; what is not fine is finishing without committing to anything.

Softening the ranking before it starts is part of doing this well — a video that
ranks five tools should say they are built for different priorities rather than
that four of them are bad. **Say it in your own words.** The supplied sentence
that used to live in "Closing convention" item 2 was deleted rather than moved
here, because a rule you satisfy by pasting one specific sentence is a template,
and T1 forbids that.

**Applies to:** 050, 100
**Enforced by:** author judgement.
