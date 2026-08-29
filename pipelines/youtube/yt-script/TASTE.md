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

**This governs the INSTRUCTION lanes too, not only the spoken copy.** A `SHOW`
or `EDIT` lane written in insider words is the same failure with a different
audience — the owner reads those, and on 2026-08-28 he could not: *"all the
instructions - i am finding too hard to understand."* See T11.

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

---

## T11 — An instruction that cannot be pictured is not an instruction. Show an example.

**From:** vox-style-video-ai, 2026-08-28. Owner: *"all the instructions - i am
finding too hard to understand.. Can you please keep the instruction similarly a
script? Basically simple and to the point. Maybe you can explain it with a simple
example so that it's easy easier to follow what you're asking for that section."*

Two halves, and both matter.

**First: the instruction lanes are written like the script.** T8 and T10 apply to
the whole document, not only to what gets said out loud. One idea per line.
Everyday words. Nothing that needs reading twice. The instruction track is the
half of the plan the owner and the maker actually work from, and it was the half
written as dense abstract prose while the spoken copy got all the care.

**Second, and this is the new rule: abstraction gets an example.** Any line that
says *what* to do without saying *what that looks like* carries an `Example:` line
under it. Not a rewrite of the instruction — a concrete instance of it.

| Instruction alone | Instruction plus example |
|---|---|
| "Be specific rather than calling it cluttered." | "Name what it costs: the eye has nowhere to rest, and the words stop landing." |
| "Contrast with what a normal edit does." | *Example: "a normal edit cuts to a new picture. This one just moves things around on the same picture."* |
| "Two topic examples, one that passes and one that does not." | *Example that passes: "why this shipping route changed the world." Example that fails: "is this tool better than that one."* |

**Why it is a rule and not a style note:** an abstract instruction reads as
complete. Nothing about "give a concrete example of swapping a weak concept for a
stronger one" looks unfinished on the page — it looks thorough. It is only at the
moment of filming that it turns out to say nothing. The example is what makes the
lane checkable at review time instead of at production time.

**Where no example is needed:** an instruction that is already concrete. "Hold
the frame for 4 seconds or more" is finished. The example exists for abstraction,
not for decoration, and a plan padded with obvious examples has just moved the
problem.

**Applies to:** 030, 050, 100
**Enforced by:** `SCRIPT-PLAN-INSTRUCTIONS.md`, section "Write the instructions
like the script", plus the owner's read at gate 055. Nothing mechanical catches
an abstraction.


---

## T12 — Instructions state the goal. The maker decides how.

**From:** vox-style-video-ai, 2026-08-28. Owner: *"For the instruction part I
like to give autonomy for my freelancers to take care of things. No need to go
too deep and too spoon-feeding. Just mention the goal and major points which you
want to focus on. If there are any references, then we can add the references,
that's it. But I like to keep it short and simple and let freelancer able to
handle it."*

The person receiving these lanes edits video for a living. A lane that tells him
to cut on the beat, hold a frame, or not stack two transitions is not helping —
it is spending his attention on things he already knows, so that the one line
that actually matters gets the same weight as four that do not.

**A lane carries at most three things:** the goal, the one or two points that are
not obvious, and any reference he can go and look at. Nothing else.

**The trims, concretely:**

- **Cut craft.** Pacing, cut rhythm, transition choice, framing — his call.
- **Cut the justification.** *"They are there to be recognised, not studied"*
  explains a decision he does not need to re-derive. State the requirement.
- **Cut the restatement.** Saying the same constraint twice in different words
  reads as two constraints.
- **Keep the reason on a constraint that would otherwise look arbitrary.** *"Do
  not show the OpenArt screen here — 1.2 needs it hidden"* is one line, and the
  clause after the dash is what stops him overriding it.
- **Never cut a `FACTS` line.** Facts are references, and references are what
  make the autonomy safe. Trimming those is not brevity, it is guesswork.

**Why it is a rule and not a style note:** length reads as diligence. A four-line
lane looks more thorough than a two-line lane, so the failure mode is invisible
to the person writing it and only shows up when the reader stops reading. The
owner hit exactly this on the first plan through the flow, twice in one day —
first the wording (T11), then the volume.

**Tension with T11 — resolve it this way.** T11 says an abstract instruction
needs an example. T12 says stop writing abstract instructions in the first place.
An `Example:` line is the fix for a lane you cannot make concrete, not a licence
to keep one that should have been cut. If the goal is stated concretely, no
example is needed and none is added.

**Applies to:** 030, 050, 100
**Enforced by:** `SCRIPT-PLAN-INSTRUCTIONS.md`, section "Say the goal, not the
steps", plus the owner's read at gate 055.


---

## T13 — The body is section cards. One card per section, one bullet list, nothing else.

**From:** vox-style-video-ai, 2026-08-29. Owner: *"there are currently too much
spoon feeding and too much information which we are giving. After the outline,
intro and conclusion, I don't want to divide the body into too many distinct
steps. It should be just body with major major sections. Think of it like a
section cards. You can't have too many section cards, right? So divide the video
imagining a section cards which you can see, you can show on a video, and for
each section card, just write the bullet points just the info for video editor...
I want high level section distinction and their information that's it don't break
down too much that it's cluttering everything and removes the creative freedom
from the freelancer."*

The video has an intro, a conclusion, and **a handful of big sections in
between**. Each section is one card: a heading you could put on screen, and a
short list of bullets under it. That is the entire body format.

**The three things this rule kills, and each of them looked like care:**

- **Sub-beats.** `What makes it look like Vox` had been cut into five beats.
  The owner's own words on that one: *"we have divided that into too many
  sections. No, just make one section."* Fifty-odd beats for an eleven-section
  video is not a plan, it is the same material chopped past the point where any
  piece can be acted on.
- **The lane split.** What to cover, video notes and general notes were three
  boxes holding one brief, sorted by which lane the writer typed a line into.
  *"remove those sections about video notes separately, general notes separately,
  everything else. Just need a simple bullet points."*
- **Craft instruction.** Hold times, cut rhythm, transition choice, framing. He
  edits video for a living. T12 already said this about lanes; T13 is the same
  judgement applied to the shape of the whole document.

**What survives, and is never cut:** the goal of the section, the points a good
maker would otherwise get wrong, and every real value — settings, prices, model
names, numbers, source links. Those buy the autonomy. Trimming them is not
brevity, it is guesswork, and T12 already settled it.

**Why it is a rule and not a style note:** granularity reads as diligence. A plan
with fifty beats looks more thorough than a plan with eleven cards, right up to
the moment someone has to work from it. The writer cannot see the failure,
because on the page a fine-grained plan looks finished and a coarse one looks
lazy. Only the reader finds out.

**The relationship to T11 and T12.** T11 said an abstract instruction needs an
example. T12 said state the goal, not the steps. T13 says how much document those
two are allowed to fill: one card per section. All three point the same way —
less, but every piece of it load-bearing.

**Applies to:** 030, 050, 100
**Enforced by:** `SCRIPT-PLAN-INSTRUCTIONS.md`, section "The NOTES lane — a body
section card", plus `CARD_DROPPED` and `CARD_ATE_A_BEAT` in
`test/beats.test.mjs`. Nothing mechanical catches a card with twenty bullets in
it — that one is the owner's read at gate 055.


---

## T14 — Two levels in the body. Broad sections, subsections under the ones that earn them.

**From:** vox-style-video-ai, 2026-08-29. Owner: *"do you think that this sections
like picking a topic that holds up, writing the script, locking the look and all
those things this should be subsection of basically how to create main process of
creating the vox style video they should not be having their main sections that
should be subsections right... Have broader sections, have subsections."*

The body has **a few broad sections**, and the steps inside one of them are
**subsections**, not sections of their own. On `vox-style-video-ai` that turned
eleven flat sections into four, with eight of them collapsing into `How to Make a
Vox Style Video with AI` — because they were never eleven separate things, they
were one process with eight steps.

**Do not force it symmetrical.** Corrected in the same message: *"everything need
to be a subsection just to keep it symmetrical it's fine that you are going ahead
with one one sections and then for one section you are having some subsections.
It's not necessary that every section has to be subsections. I think you are
forcing it here."*

So a section splits **only when it really has parts**. Two of the four sections
on `vox-style-video-ai` have no subsections at all, and that is the correct
shape, not an unfinished one. A section invented purely to be a parent for one
child is the failure this half of the rule exists to stop.

**The test:** would a viewer scrubbing the video read these as chapters? Chapters
are where they jump to. Steps are where they follow along. A step promoted to a
chapter makes the video look like eleven unrelated topics; a chapter demoted to a
step buries it.

**Applies to:** 030, 050
**Enforced by:** `OUTLINE-INSTRUCTIONS.md` and `SCRIPT-PLAN-INSTRUCTIONS.md` carry
the format. `SUBSECTION_NUMBERING` in `test/beats.test.mjs` proves the two shapes
coexist. Nothing mechanical can tell a real subsection from a forced one — that
is the owner's read at gate 040.

## T15 — Name sections for search, not for cleverness.

**From:** vox-style-video-ai, 2026-08-29. Owner: *"the section naming thing from a
[SEO] perspective as well So that if someone is searching for someone something
then you can but your sections is such that that section comes up in search
engine result."*

A section name is a chapter title on YouTube and a line in a search result. So it
is written with the words someone would actually type.

| Rejected | Chosen |
|---|---|
| `Why one tool beats five` | `The Best AI Tool for Vox Style Videos` |
| `Getting the AI to study real Vox videos` | `Teaching the AI the Vox Style from Real Vox Videos` |
| `When you need more control` | `OpenArt Settings for More Control` |
| `Picking the voice` | `Picking the AI Voice` |
| `Before you start` | (deleted — a generic bucket nobody searches for) |

**What this actually means:**

- **Name the subject, not the position.** `Before you start`, `Getting ready`,
  `Wrapping up` describe where a section sits in the video. Nobody searches for
  where something sits.
- **Put the real nouns in.** The tool, the format, the thing being made —
  `OpenArt`, `Vox style video`, `AI voice`, `map`. A name with none of them
  cannot be found.
- **A how-to section says how to.** `How to Animate a Map Without It Glitching`
  is a question someone types. `The map trick` is a name only the author
  understands.

**This does not licence keyword stuffing**, and it does not beat T8. The name
still has to be sayable out loud, because the intro roadmap says every one of
them and `test/roadmap.test.mjs` checks it. A name you cannot get into a sentence
is the wrong name whichever rule you reached it by.

**Applies to:** 030, 050
**Enforced by:** author judgement, plus `roadmap.test.mjs` for the sayable half.
Nothing mechanical can tell a searchable name from a clever one.
