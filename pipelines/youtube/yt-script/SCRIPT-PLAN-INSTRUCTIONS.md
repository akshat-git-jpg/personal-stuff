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
- **Body — section cards, on two levels.** A broad `### SECTION:` heading, and
  under it either its own `**NOTES**` bullet list (a section with no parts) or a
  run of `####` subsections that each carry one. One card, one bullet list, one
  thing for him to write. No second kind of note, nothing to look up in a
  different box.

**The body changed shape on 2026-08-29.** It used to be five to seven `#### 2.n`
beats per section, each carrying its own `SAY` draft, `VIDEO` lane and `FACTS`
block — around fifty beats for an eleven-section video. Owner: *"there are
currently too much spoon feeding and too much information which we are giving...
I want high level section distinction and their information that's it don't
break down too much that it's cluttering everything and removes the creative
freedom from the freelancer."* See `TASTE.md` T13.

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
| `### SECTION: Live Demo` | A broad section inside the body (`SECTION:` is stripped) |
| `#### Picking a Topic That Holds Up` | A SUBSECTION of the section above it. Numbered for you: `3.1`, `3.2` |
| `## Contents` then numbered lines | The table of contents at the top of the plan |
| `#### 2.3 · HeyGen` | A beat |
| `**SAY**` alone on a line, then a `>` blockquote | Amber chip, serif text, amber rail |
| `**VIDEO**` alone on a line, then plain lines | Everything to do with the picture — filming, screen-recording and post |
| `**NOTES**` alone on a line, then `- ` bullet lines | A body section CARD: the whole brief for that section, in one block |
| `**FACTS**` alone on a line, then plain lines | Slate chip, sans text — numbers for this beat |
| `**DEMO**` alone on a line, then plain lines | A silent block in the LEFT track — something plays, nobody speaks |
| `**SAY** — lip-sync` | Same, with a small caption under the chip |
| `> **RULES — WHOLE SECTION**` then `> - item` lines | Red rules box |
| `> **VERDICT:** ...` | Slate verdict block |
| A pipe table | A real scrollable table |

**The lane label must sit alone on its own line.** `SAY: "..."` on one line is
not recognised. Blank lines between the label and its content are fine.

**Spoken copy goes in a blockquote; instructions do not.** That indent is the
only signal telling him what to read aloud. Quoting a VIDEO line breaks the one
rule the whole document rests on.

For multi-paragraph spoken copy, keep every line inside the blockquote and
separate paragraphs with a bare `>`.

---

## The Contents block

**Every plan opens with a table of contents.** Straight after the `# Title`,
before the introduction. Titles only, nothing else. Owner, 2026-08-29: *"at the
top of the script can we show the outline? All sections, subsection, etc. Just
the title."*

```
# How to Make Vox Style Videos with AI

## Contents
1. What Makes a Vox Style Video Look Like Vox
2. The Best AI Tool for Vox Style Videos
3. How to Make a Vox Style Video with AI
   3.1 Teaching the AI the Vox Style from Real Vox Videos
   3.2 Picking a Topic That Holds Up
4. OpenArt Settings for More Control
   4.1 Image and Video Panel Settings
```

**It must match the headings below it exactly** — same order, same numbers, same
words. `CONTENTS_DRIFT` in `test/beats.test.mjs` fails if it does not, so a
renamed section is caught rather than left to be noticed.

**The desk does not read this block.** It builds its own contents from the
headings, which is why the two can never disagree on screen. The block in the
markdown is for whoever opens the file in an editor, and the test is what keeps
it honest.

`## Contents` is matched before the generic `##` part rule in the parser. Do not
give any other block a `##` heading in a plan.

---

## Two levels: sections and subsections

**The body has broad sections, and the steps inside one of them are
subsections.** `TASTE.md` T14 is the rule. The shape on the page:

```
### SECTION: What Makes a Vox Style Video Look Like Vox

**NOTES**
- ...bullets for the whole section...

### SECTION: How to Make a Vox Style Video with AI

#### Picking a Topic That Holds Up

**NOTES**
- ...bullets for this step...

#### Writing the Script

**NOTES**
- ...bullets for this step...
```

- **A section with no parts carries its own `**NOTES**`** and becomes one card,
  numbered `1`, `2`.
- **A section with parts carries no `**NOTES**` of its own.** Each `####` under
  it is a card, numbered `3.1`, `3.2`.
- **Never both.** A `**NOTES**` block under a section that also has `####`
  subsections becomes a card the contents does not list.

**Do not number a body `####` heading.** Write `#### Writing the Script` and the
parser numbers it from its position. Numbering by hand meant renumbering eight
headings to insert one, and every one of those numbers is also a key that the
maker's saved draft hangs off.

**Intro and conclusion beats keep their explicit numbers, and they are letters:**
`#### A1 · Cold open`, `#### C1 · Wrap and sign-off`. They must not use digits.
A body section numbered `3` with subsections produces `3.1`, and a conclusion
beat numbered `3.1` would then be the same key — `draft`, `says` and `edits` are
all keyed on the number, so the two beats would share one write box. Guarded by
`DUPLICATE_BEAT_NUM`.

**Do not force the split.** Two of the four sections on `vox-style-video-ai` have
no subsections and that is correct. A section invented to be a parent for one
child is worse than no split at all.

**Section and subsection names are written for search.** `TASTE.md` T15. The name
is a YouTube chapter title and a line in a search result, so it carries the real
nouns — the tool, the format, the thing being made — and never describes where it
sits in the video. `Before you start` is not a section name.

---

## The NOTES lane — a body section card

**A body section is ONE card.** The section heading, one flat bullet list, one
write box. That is the whole of the body format.

```
### SECTION: What makes it look like Vox

**NOTES**
- Show what this style actually is. No tool on screen yet.
- The background never moves. Cutouts move on top of it.
- Rough paper texture, and a jerky frame rate on purpose.
- Five parts in every scene: text, main object, background, small extras, camera.
- Maps draw themselves. Captions land on the beat.
- Say plainly it suits numbers and history, not every topic.
- Use real Vox clips. Never a made-up stand-in.
- Sources: Joseph https://youtu.be/PaXuebdY75U · Leo Ai https://youtu.be/WCDhGKNVrKU
```

**There is no `####` heading under a card.** `lib/beats.mjs` synthesizes the beat
from the section, numbers it `<part>.<n>` in order, and titles it with the section
name. The desk shows the section heading, one write box and one block headed
**Notes**.

**One bullet, one idea.** A bullet is a line, not a paragraph. If it needs an
"and" to carry a second idea, it is two bullets.

**What goes in the list, in this order:**

1. **What the section has to do.** One bullet. The goal, not the route to it.
2. **The points that are not obvious.** The things a good maker would otherwise
   get wrong, or that the video depends on. Usually four to eight bullets.
3. **The real values.** Settings, prices, model names, menu paths, numbers — every
   one straight from `knowledge.md`. These are the reason he does not have to
   guess, and they are never trimmed for brevity.
4. **Any hard constraint, with its reason on the same line.** `Do not show the
   OpenArt screen here — the intro reveal needs it hidden.`
5. **`CTA — link in description`** where the section is a good place for one.
6. **`Sources: <Name> <bare URL> · <Name> <bare URL>`** as the last bullet, for
   every person the section names.

**What does NOT go in it.** Craft. Pacing, cut rhythm, transition choice,
framing, hold times, how to light a thing — his call, every time. A bullet a
competent video person would do anyway is a bullet that makes the important ones
harder to find.

**Rough size: eight to thirteen bullets.** Below six and the section is probably
two sections' worth of nothing. Past fifteen and the old spoon-feeding is back
wearing bullet points. This is a range to sanity-check against, not a quota —
merging two real bullets to hit a number helps nobody.

### What this replaced, and why it is not coming back

A section used to be five to seven `####` beats, each with a `SAY` draft, a
`VIDEO` lane and sometimes a `FACTS` block. Three problems, all of them invisible
to whoever wrote it:

- **It read as thoroughness.** A fifty-beat plan looks more careful than an
  eleven-card one. It is not; it is the same material cut into pieces too small
  to act on.
- **It took the job away from the person doing it.** Deciding how to break a
  section into shots is what he is for.
- **It split one brief across three boxes** — What to cover, Video notes, General
  notes — sorted by which lane the writer happened to type a line into, which is
  the writer's filing system leaking onto the reader's screen.

**`SAY`, `VIDEO`, `FACTS` and `RULES` all still parse** so no older plan loses a
line, and the desk folds every one of them into the same `Notes` block. **Never
write them in a new body section.**

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

## The VIDEO lane — one lane for the picture

There used to be two: `SHOW` for what to film or screen-record, and `EDIT` for
what to do with it afterwards. They merged on 2026-08-28. Owner: *"I don't like
having screen recording notes and video editing notes, can you just club them
both together and make it just video notes."*

The split bought nothing. The same person does both jobs, back to back, on the
same beat — so making him read two boxes to learn what one shot needs was pure
overhead.

```
**VIDEO**
Play about 12 seconds of a finished paper-cut shot.
Its own music carries the silence. Duck it under the voice, do not cut it.
```

`SHOW` and `EDIT` still parse, and both fold into `video` in beat order, so an
older plan loses nothing. **Never write them in a new plan.** The desk shows one
block, headed **Video notes**.

## Beat headings are labels, not descriptions

**This applies to intro and conclusion beats only.** A body `####` heading is a
SUBSECTION name from `outline.md`, approved at gate 040, and it is copied word for
word — it is not a label you write here. See "Two levels" above.


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

What the beat covers already lives in `SAY` and `VIDEO`. The label is an
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

**VIDEO**
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
plays and that nobody is speaking. **How to shoot it and how to cut it stay in
`VIDEO`.** A DEMO lane that grows shooting notes has smuggled an
instruction into the left track and the exception stops being one.

**Not a blockquote.** Plain lines, like `VIDEO`. A blockquote means
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

## Say the goal, not the steps

**The maker is a professional. Give him the target and let him hit it.** Owner,
2026-08-28: *"For the instruction part I like to give autonomy for my freelancers
to take care of things. No need to go too deep and too spoon-feeding. Just
mention the goal and major points which you want to focus on. If there are any
references, then we can add the references, that's it."*

**Every bullet is one of three things:**

1. **The goal.** One bullet. What this section has to achieve on screen.
2. **A point that is not obvious.** Only the ones a good maker would otherwise
   get wrong, or that the video depends on.
3. **A reference.** A link, a number, a setting, a name — where he can look.

| Do not write | Write |
|---|---|
| `One second on each failure shot. No longer.`<br>`They are there to be recognised, not studied.`<br>`Keep the finished shot from 1.1 handy.`<br>`It comes back at the end of the video.` | `Three quick failure shots, about a second each.`<br>`Keep the 1.1 shot — it returns at the end.` |
| `Each line appears as you say its name. No transitions between lines. Keep the list up through the last sentence. Then cut straight to the first body shot. No wipe.` | `The eleven section names build up one line at a time as you say them.` |

**Three tests before a bullet ships:**

- **Would a good freelancer do this anyway?** Then cut the bullet.
- **Is this taste, or is it a requirement?** Taste is his. Requirements are
  yours — and a requirement gets one line saying why, not four saying how.
- **Could he look it up?** Then link it instead of explaining it.

**The one thing that is never trimmed is a fact.** A number, a price, a setting,
a source link — those are the references, and references are what buys the
autonomy. Cutting them does not make the card leaner, it makes it guesswork.

**Where a section genuinely has a hard constraint, say it once, plainly.** `Do
not show the OpenArt screen here — 1.2 needs it hidden` is one bullet and it
stays. A rule with a reason survives. A rule with three sentences of coaching
around it does not.

## Write the instructions like the script

**Every bullet obeys the same language rules as the spoken copy.** T8 (everyday
words) and T10 (short sentences, one idea each) are not about the blockquote.
They are about the whole document. A bullet written as one 60-word sentence of
abstract direction is exactly as unusable as a spoken line written that way.

Owner, 2026-08-28: *"all the instructions - i am finding too hard to understand.
Can you please keep the instruction similarly a script? Basically simple and to
the point."*

**Three rules, and they are the same three the script gets:**

1. **One bullet per idea.** If a bullet is one long line with three ideas in
   it, it is three bullets.
2. **Everyday words.** No "unattended", "counterintuitive", "cohesive",
   "generalises", "brisk". If you would not say it to a friend, do not write it
   in a bullet.
3. **An `Example:` bullet wherever the instruction is abstract.** Any time a
   bullet says *what* without saying *what that looks like*, the bullet under it
   starts with `Example:` and shows it. Where you can make the first bullet
   concrete instead, do that and drop the example — `TASTE.md` T12 beats T11.

**The Example line is the fix that matters most**, because "be specific rather
than calling it cluttered" is an instruction nobody can act on:

| Abstract on its own | With the example |
|---|---|
| `Contrast with what a normal edit does.` | `Then say what a normal edit does instead.`<br>`Example: "a normal edit cuts to a new picture. This one just moves things around on the same picture."` |
| `A three-layer breakdown of one real shot.` | `Pull one real shot apart into its three layers.`<br>`Example: back layer is the sky, middle is the buildings, front is the person.` |
| `Two topic examples, one that passes and one that does not.` | `Two topic examples side by side.`<br>`Example that passes: "why this shipping route changed the world."`<br>`Example that fails: "is this tool better than that one."` |

**One fact per bullet.** Never a paragraph of semicolons. The first pass on
`vox-style-video-ai` put nine separate findings into a single 90-word sentence,
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

**Every section that names a person carries one reference bullet**, as the LAST
bullet of that section's `NOTES` list:

```
- Sources: Skai Generated https://youtu.be/Jkt4aTOpqpM · Luuk Alleman https://youtu.be/i5-tZegBvxU
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

**VIDEO**
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

He was right about the DESIGN. He was not right about the conclusion drawn from
it, and later the same day he said so:

> *"the MD file is obviously yes it's very easy I can easily cut, paste, delete
> things, add things - but it's not easy to read while editing. I'm not able to
> follow the script, too much things is going on."*

**So the desk now has an edit mode**, and this section is kept because the line
between the two designs is the thing worth remembering:

| Rejected, and still rejected | Built |
|---|---|
| Comments and edits held in an overlay store | Every action is a line splice on `script-plan.md` |
| Reconciled back into the markdown later | Written straight back, atomically, now |
| A second copy of the script to keep in sync | No second copy exists |

The constraint was never "the desk must not write". It was **"do not build me a
second copy of my script."** Edit mode has none, which is why it is four small
files rather than four plans.

**The rule that survives:** anything that stores an edit anywhere other than
`script-plan.md` is the rejected design wearing a new hat. See
`apps/yt-script-desk/CLAUDE.md`, "Edit mode", for the guards on the write path.

**The ASK lane is unaffected.** Leaving a question for Claude *in the document*
is a different job from editing it, and this lane is still how it is done.

## The rules box — retired for the body

**A body section carries no `RULES` box.** A rule true for the whole section is
just a bullet in that section's `NOTES` list, because the card IS the section and
there is nothing left for a rule to span.

It existed to stop one instruction being restated in all five beats of a section.
With one card per section there are no five beats, so the box has no job.

`RULES` still parses, and the desk still folds an older plan's box into that
plan's `Notes` block. Never write one in a new body section.

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

- Mark each one as its own bullet in that section's `NOTES` list —
  `CTA — link in description` — in a section where the tool has just visibly done
  something well.
- Spread them across the document. Never two in adjacent sections.
- Never place one in a section whose subject is a limitation or a failure fix.
- Where a promo code or deal exists, say so in the bullet so the writer knows to
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

### Sections are the cards

Named exactly as the intro's roadmap named them. Section count follows the
material. **One section, one card, one `**NOTES**` list.**

**`outline.md`'s first line carries `Format: tutorial` or `Format: comparison`.**
Read it before writing a single section, and do not infer it from the section
names. The two shapes diverge here and stay diverged through step 100.

**For a comparison**, organise **by factor with every tool swept inside each
factor** — one Features section covering all tools, not one section per tool.
Every section closes with a `> **VERDICT:**` line, because ranking is what the
viewer came for. The verdict sits after the card's `NOTES` list.

**For a tutorial**, sections are phases of the job in the order he performs them.

- **No `> **VERDICT:**` line.** There is nothing being ranked, and a phase given
  a verdict reads as a score on the maker's own work.
- **The card must carry the exact values** — the setting, the menu path, the
  price, the model name — wherever `knowledge.md` has one. This is the whole
  reason a viewer chose a tutorial over the tool's own docs.
- **Give each phase's known failure mode a bullet**, where the knowledge names
  one. A tutorial that only shows the happy path is the one the viewer abandons
  at the first error.
- **Approaches the owner rejected at gate 020 get at most one section**, saying
  why the chosen one won. Never a second walkthrough. **This limits walkthroughs,
  not material** — a technique, warning or framing from any source in
  `knowledge.md` is fair game and combining them is expected. The one honesty
  limit: a price or setting stays attached to the tool it came from and is never
  relabelled as the chosen tool's.

### How many cards

**As many as the video has real phases, and no more.** Eleven is a long tutorial;
six is a normal one. The test is whether you could show the list as title cards
in the finished video without the viewer losing track — that is literally what
they are.

A section that would need sub-headings to explain itself is two sections. A
section whose bullets all say the same thing as its neighbour's is one section
wearing two hats.

### The proof insert

Where a section explains how to do something impressive, say in a bullet that the
**result** is shown first — the finished output, the real example. Motivation
before mechanics. How to shoot it is his call.

### On-screen tables

A pipe table may sit inside a card, under the `NOTES` list, where the video shows
a real on-screen graphic. It is the content of that graphic, not a shot list. Do
not write a bullet per row: he reads the table.

## Hard rules

- **Intro and conclusion are finished copy. Body sections are cards.** Never mix.
- **One card per leaf.** A section with no parts is one card; a section with parts
  has one card per `####` subsection. No `SAY`, `VIDEO`, `FACTS` or `RULES` block
  in a new one — they still parse, for older plans only.
- **Every plan opens with a `## Contents` block that matches its headings.**
- **A body `####` heading carries no number.** Intro and conclusion beats carry
  letters (`A1`, `C1`), never digits.
- **Lane labels sit alone on their line**, or the parser drops the lane.
- **Spoken copy is always a blockquote. Nothing else is.** And a blockquote
  holds **only** what is said aloud — no notes, no labels, no bracketed
  cross-references. Anything you want to say *about* the copy is a bullet.
- **A bullet a good freelancer would follow anyway does not get written.**
- **Intro roadmap names every section AND every subsection, word for word.**
- **Every claim traces to `knowledge.md`.** No support, no line — raise the gap.
- **No comparison section without a verdict.** A tutorial section carries none —
  see the tutorial rules above. This rule said "no section without a verdict"
  until 2026-08-27, which contradicted them.
- **No HTML or PDF is generated any more.** The markdown is the source and
  the script desk renders it. `render-outline.mjs` is retired.
