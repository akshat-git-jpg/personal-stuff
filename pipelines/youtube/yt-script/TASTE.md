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

## Tutorial or comparison: how these rules read (added 2026-08-27)

**T3, T4 and T5 were seeded from comparison scripts.** They talk about options,
verdicts, rankings and a named winner, because the script they were modelled on
had five tools in it. A tutorial has none of those things, and a step that
applies them literally to a tutorial invents a scorecard nobody asked for. That
is the quality drift the owner named on 2026-08-27: *"pls have distinction
between tutorial videos and comparison video throught out the skill and
feedback.. so as to avoid any issues and degrading quality"*.

`outline.md`'s first line carries `Format: tutorial` or `Format: comparison`.
Read it, then read these rules through this table. **None of the four rules is
being narrowed or retired** — this says how each one lands in a format it was
not written from.

| Rule | In a comparison | In a tutorial |
|---|---|---|
| **T2** — one viewer, contractions, short sentences | unchanged | unchanged. This one is format-blind. |
| **T3** — earn the verdicts before making them | state the test conditions up front | state the **starting conditions** up front: what was already installed, what it cost, what was assumed. Same purpose — the viewer judges the result knowing the method. |
| **T4** — credit before limit | applies to each option's verdict | applies to each **tool, step or approach the video names**, including the ones it rejects. A rejected approach still gets its real reason to exist before its limit. |
| **T5** — land on one named winner | a named pick per persona | a named pick **at every fork the video presents**, plus one line on what to do next. An approach menu ending in "any of these work" is the same failure T5 exists to stop. |

**The trap this table closes:** a tutorial reading T4 and T5 without it produces
a ranked survey of approaches instead of a walkthrough of one. That is not a
tutorial with good taste; it is a comparison in the wrong clothes.

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

---

## T6 — Go as long as the material honestly carries, and keep it interesting the whole way.

**From:** vox-style-video-ai, 2026-08-27. Owner: *"i prefer longer videos without
making audience bored. i prefre longer videos only. keep the entire flow
interesting but always try to make as long video as possible."*

Length is a target to push toward, not a budget to spend. Where `knowledge.md`
supports depth, take it — more phases, more of the exact settings, more of what
breaks and why. A short video that left real material on the table is the failure
this rule exists to stop.

**The second half of the rule is load-bearing and is not a softener.** Padding
with repetition, restating a point in new words, or narrating what is already on
screen makes the video longer and worse, and breaks this rule rather than serving
it. When the honest ceiling is below what the owner would like, the answer is to
name the ceiling and its reason at the gate — never to fill the gap.

The practical test: could any minute be cut without the viewer losing something
they needed? If yes, that minute is padding and the rule has been broken in the
direction of length.

`OUTLINE-INSTRUCTIONS.md` carries the mechanism — a required `Target:` line and
the section count that serves it.

**Applies to:** 030, 050, 100
**Enforced by:** author judgement, plus the owner's read at gates 040 and 055.

## T7 — Assume the owner's expertise. Write the credibility claim; do not ask for it.

**From:** vox-style-video-ai, 2026-08-27. Owner: *"pls always assume that i know
things. you can add claim about prior experince. assume i have explored tools for
yeards and know my stuff. if i need to make changes in script - i will do during
review."*

The intro's credibility line, and any later line resting on the owner's
experience, is written as fact. He has used these tools for years. A hedge, a
`[PLACEHOLDER]`, or a question at the gate all read as doubt about the presenter
and all cost him a review cycle to delete.

**This rule is scoped to claims about the owner himself** — what he has used,
built, tested or seen. It does not license inventing anything else. Numbers,
prices, tool behaviour, model names and every factual claim still come from
`knowledge.md` and nowhere else, exactly as the skill's hard rules say. The two
do not conflict: one is about who is talking, the other about what is said.

Raised with the owner before this rule was written, because it sits against
"never invent facts"; he reaffirmed it, and named the review gate as where he
corrects a claim that overreaches.

**Applies to:** 030, 050, 100
**Enforced by:** author judgement. The owner's own read at gates 040, 055 and 110.

## T8 — Everyday words. If a normal person would not say it out loud, it is the wrong word.

**From:** vox-style-video-ai, 2026-08-27. Owner: *"also need language to be
simple day to day.. , intutive we use day to day.. no one uses ' The Music
Bed' .."*

The words are the ones the viewer already uses. Not the words the people who do
this for a living use with each other. `The Music Bed`, `The Motion Pass`,
`b-roll`, `colour grade`, `asset`, `composition`, `render pass` are all fluent
and all wrong: they signal that the video is for insiders, at the exact moment a
beginner is deciding whether they can follow it.

**The test is spoken, not written.** Read the line aloud. If it would sound odd
said to a friend, rewrite it. "Picking the music" passes. "The music bed" does
not, even though it is shorter and looks tidier on a page.

**A necessary technical term is allowed once you have paid for it** — name it,
then say what it means in the same breath, in ordinary words. What is banned is
the term used as if the viewer already shares it. A term the sources themselves
have to explain is one the script has to explain too.

**Where this bites hardest is a name or a heading**, because a heading has no
room to explain itself and gets read before anything else. See
`OUTLINE-INSTRUCTIONS.md`, which carries the naming rule and the table of names
this preference rejected — including the ones the earlier, stricter version of
that rule produced.

This overlaps T2 without duplicating it. T2 is register: who is being addressed
and how the sentences run. T8 is vocabulary: which words are allowed in them.

**Applies to:** 030, 050, 100
**Enforced by:** author judgement, plus the read-aloud test. Nothing mechanical
catches jargon.

---

## T9 — Every script is an affiliate script. Make the tool's benefit land, honestly, without selling it.

**From:** vox-style-video-ai, 2026-08-27. Owner: *"my main goal of making all
these scripts and videos is affiliate... Be genuine, be authentic. Obviously,
don't oversell the tools. But keep that in mind that I want to get affiliate
commissions. I want them to be able to use the tools I am promoting. So I want
them to understand the benefit of these tools... It should be subtle, not
oversell."*

The commercial goal is real and it is not a secret to be worked around. It is
also not served by enthusiasm. A viewer converts when they can see themselves
doing the thing, so the job is to make the benefit **legible**, not loud.

**What that means concretely:**

- **Show the benefit, do not assert it.** The strongest thing available is the
  work itself — the setting that saved an hour, the step that used to need a
  specialist, the result on screen. A tutorial has an advantage over a review
  here: the viewer watches the tool succeed rather than being told it does.
- **Name the limits.** This is the part that makes the rest believable, and it is
  where "don't oversell" has teeth. A video that admits where the output still
  looks like AI, which step is fiddly, and what came back wrong the first time,
  earns the recommendation it never had to make.
- **Never inflate a claim to close.** No superlative the material does not carry,
  no time saving nobody measured, no "this changes everything". Every claim still
  traces to `knowledge.md`.
- **Do not editorialise about the affiliate relationship.** No disclaimers
  invented to sound fair, no apologising for the link, no "I only recommend what
  I use" boilerplate. T3 already covers this: state the method up front and the
  recommendation reads as a finding.
- **Subtle means woven, not hidden.** The tool is named plainly and its value is
  stated plainly, in the flow of the work. Coyness reads worse than clarity.

**The test:** would a viewer who bought on this video's strength feel misled a
week later? If yes, the script oversold, however subtle the wording.

`SCRIPT-INSTRUCTIONS.md` owns the CTA cadence and wording — where the links get
mentioned and how often. This rule governs everything between the CTAs.

**Applies to:** 030, 050, 100
**Enforced by:** author judgement. Nothing mechanical can tell an earned
recommendation from a sold one.

---

## T10 — Short sentences. One idea each. A listener gets one pass, not two.

**From:** vox-style-video-ai, 2026-08-27. Owner: *"I like to keep my script very
simple and in human readable day-to-day language. Currently I feel that the script
is too gibberish, too much is going on in a small frame of time, it doesn't look
like our day-to-day language."*

Then, in the next message: *"I like my sentences to be shorter and not too long...
on the same line of when I said I like my script to be simple in simple language,
easier to follow."* Two reactions of the same shape, one after the other, which is
why this became a rule rather than an instance fix.

A reader can go back over a long sentence. A listener cannot. So the ceiling is
not what reads well, it is what survives being heard once, at speaking pace,
by someone half-watching.

**The mechanism is `SCRIPT-INSTRUCTIONS.md`'s "One sentence per line"**, and that
is where the format lives. This rule is the judgement behind it:

- **One idea per sentence.** If it needs an "and" to carry a second idea, it is
  two sentences.
- **Past about twenty words, look again.** Not a cap. A trigger to check whether
  it is really two sentences wearing one. Measured on 2026-08-27: the owner's own
  hand-written script ran a 15-word median with 28% of sentences over twenty, and
  he asked for shorter than that, so twenty is the point where checking starts,
  not where the sentence is wrong.
- **Short does not mean choppy.** Stacked fragments used as a drumbeat are
  `humanizer` pattern 35, and they read worse than the long sentence they
  replaced. Vary the rhythm inside the shorter range: a four-word line among
  twelve-word lines, not twenty four-word lines.

**The test, and it is a spoken one:** read the sentence out loud at pace. If you
have to re-read it to place a clause, or you run out of breath, it is too long.

This overlaps T2 without replacing it. T2 was seeded from the instruction file
with no owner quote and says "short sentences" without saying how short. T10
carries the owner's actual words, the measurement, and the trigger.

**Applies to:** 050, 100
**Enforced by:** author judgement, plus the read-aloud test. Nothing mechanical
catches a sentence that is merely hard to follow.

