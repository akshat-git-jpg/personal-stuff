# Script instructions

How to turn the **team member's completed draft** into `script.md` + `script.json`
— the final script an AI voiceover engine reads correctly on the first take.

```
knowledge.md  ->  outline.md  ->  script-plan.md  ->  [ the desk ]
     script-plan.md  ->  [ he writes ]  ->  script-draft.md
     script-draft.md ->  [ this file ] ->  script.md + script.json + respell.json
```

**You are not writing the script.** The maker already did, working from the
outline PDF and his own screen time. Your job is a finalise pass: make his words
sound right out of a synthetic mouth, and separate what is spoken from what is
not. Two documents come out of it:

| File | For | Contains |
|---|---|---|
| `script.md` | humans — the owner, the editor | everything: Voiceover, Notes, headings. Normal spelling |
| `script.json` | the VO engine (step 120) | one entry per beat: `display_text`, `notes`, `tts` state |
| `respell.json` | the VO engine (step 120) | pronunciation map, applied at synth time |

The rest of this file is two things: the **standard the final script must meet**
(voice, structure, conventions, budgets — sections below), and the **VO polish
pass** that turns a human draft into engine-ready text (the last section, and the
part that is specific to step 3).

Modelled on an existing script the owner wrote by hand (2026-08-11); the patterns
below are inspiration, not a template to fill in — a topic that doesn't fit a
comparison/tier format still follows the voice, the locking rules, and the
Voiceover/Notes split, just not the exact section list.

## What you may and may not change

The draft's words are the maker's. The line is **sound, not substance**.

**Change freely** — this is the job:

- Split a long sentence into two the voice can land.
- Respell a name or acronym so it is pronounced correctly.
- Add or move punctuation to fix pacing and breath.
- Fix a typo, a tense slip, or a doubled word.
- Move a stray production instruction out of Voiceover and into Notes.
- Tighten filler that reads as dictation ("so basically what I did here was").
- Fold the beat's `SHOW`/`EDIT` lanes from `outline.md` into its `Notes` block —
  he no longer writes Notes at all.

**Never change silently** — flag these to the owner instead:

- A number, price, tier name, limit, or date.
- A verdict, ranking, or recommendation.
- The order of an argument, or which section a claim sits in.
- A claim `knowledge.md` does not support. That is a **GAP** — you may not go
  verify it and you may not correct it from memory. The no-research rule holds.
- Anything you genuinely cannot parse. Keep it verbatim and raise it.

## Voice and tone

- First person, one presenter talking directly to camera. "I tested," "I'm
  comparing," never "we" unless the channel is an established team.

Everything else about voice is taste, not format, and lives in
[`TASTE.md`](TASTE.md) — T2 (register), T3 (earn the verdicts), T4 (credit before
limit), T5 (land on a winner). Read it alongside this file. It moved there on
2026-08-26 so that a preference could be dated, sourced and retired; a rule with
no recorded origin lives forever by default.

## Structure: three parts, all locked

Three parts — **A** Introduction, **B** the body, **C** Honest Verdict +
Conclusion — and by the time the draft reaches you, **every one of them is
final**. A synthetic voice reads exactly the characters it is given; there is no
presenter at the microphone to adjust a phrase for flow.

This is the one structural rule that changed with AI voiceover. The old chain had
two soft levels: the outline's SAY lanes were drafts to react to, and the script's
Part B was a refined draft the presenter could still polish live. **Both soft
levels have already been spent** — the SAY lanes became the maker's draft, and the
maker's screen time was the polish. What is left is copy that will be spoken
literally, so:

- Do not leave a choice in the text. No "or maybe say…", no alternates in
  brackets, no "(adjust as needed)". Pick one and flag the other to the owner.
- Do not leave a blank for the voice to fill. A `[PLACEHOLDER]` is legitimate in
  `script.md` when a volatile fact needs owner confirmation, but it must be
  resolved before it reaches `script.json` — an unresolved placeholder is a
  blocker, not a note.
- Structure and claims still never change. That rule did not soften; it hardened.

## Section format

Every section separates two things, always labeled:

- **Voiceover** — the exact words spoken, written as full sentences/paragraphs.
- **Notes** — production/recording instructions (which avatar or asset to use,
  what to show on screen, what NOT to reveal yet, pacing cues like "skip
  loading screens"). Notes are never spoken.

### Read the outline's `Format:` line first

`outline.md` carries `Format: tutorial` or `Format: comparison` on its first
line, set at step 010 and approved at gate 040. Everything below forks on it,
and the two shapes do not mix. If the line is missing, stop and ask - do not
infer it from the section names.

### For a comparison across N options

Structure the walk as:
1. One short paragraph per option (quick overview) before any evaluation.
2. A `Notes` block per option covering setup specifics and what stays hidden.
3. An `ON-SCREEN — <TABLE NAME>` table when scoring, immediately followed by a
   Voiceover paragraph per row/metric explaining the numbers — never leave a
   table to speak for itself.

### For a tutorial

Structure the walk as the phases of the job, in performance order. What changes
from the comparison shape:

1. **No scorecard and no per-option verdicts.** Nothing is being ranked, so
   there is nothing to score. A tutorial that grades its own steps has drifted
   into the wrong format.
2. **Every phase states the exact setting, path or value** the maker used, in
   Voiceover or in `Notes`, wherever `knowledge.md` supplies one. A tutorial
   whose value was the specifics and that ships without them has failed, however
   well it reads.
3. **`Notes` carries what breaks at that phase**, and the fix, where the
   knowledge names one. The failure modes are the part a viewer cannot get from
   the tool's own documentation.
4. **An `ON-SCREEN — <TABLE NAME>` table is still fine** for settings, costs or
   options at a fork - the ban is on scoring tables, not on all tables.
5. **The approaches the owner did not pick get at most one section**, and it
   says why the chosen one won. It is not a second tutorial. **Their ideas,
   though, are fair game everywhere** - the chosen approach fixes the workflow,
   not the sources the material may come from, and folding the best of all of
   them into one route is the goal. A borrowed price or setting keeps the name of
   the tool it belongs to.

## Opening convention (Part A)

1. **Cold open** — a hook built on ambiguity or a claim the viewer doubts
   ("you'd expect to be able to tell... remember this moment"). Notes specify
   exactly which asset/voice to use and what to hide (no logos/UI) so the
   reveal lands.
2. **Reveal** — break the tension from the cold open, then state the video's
   premise and promise in 2-3 sentences.
3. **What this video covers** — a spoken roadmap naming every body section in
   order, each tagged with its section name in parentheses so it's traceable
   back to the outline's `### SECTION:` headings.
4. **First CTA** — links in the description, then a one-line transition into
   the body ("Now let's put them to the test").

## CTA cadence — more than the two bookends

**The intro and the conclusion are not the only places the links get mentioned.**
Owner, 2026-08-27: *"from time to time, whenever we are giving CTA, we should
mention link in description. Best buy link in description. Something like that."*

- **Two to four mentions across the body**, on top of the intro and final CTAs.
  Spread them; never two in adjacent sections.
- **Each one is one sentence, inside the flow of the work.** It rides a moment
  where the viewer has just seen the tool do something, not a moment invented to
  hold it. A paragraph break for a mid-roll ad is not this.
- **Always name the description as the place to get it.** "Link's in the
  description", "the link and the code are down below" — the wording is yours,
  the destination is not optional. Where a promo code or a deal exists, the
  mention says so, because that is the part that converts.
- **Never stack a CTA onto a limitation.** Naming a weakness and asking for the
  click in the same breath reads as a sale. Put the mention on a win.
- **Do not repeat one form of words.** Four identical "link in the description"
  sentences read as a script hitting its quota.

`TASTE.md` T9 governs what happens between these mentions — the benefit lands
through the work, and the limits get named honestly. The cadence here is the only
place the ask itself is made.

## Closing convention (Part C)

1. **Honest Verdict, weakest to strongest.** Walk every option in ascending
   order of fit, ending on the winner(s). What goes *inside* each verdict is
   `TASTE.md` T4.
2. **Final recommendation** — restate the winner(s) addressed to named viewer
   personas (by role/use case), then one closing sentence naming the single
   top pick if forced to choose only one.
3. **Final CTA** — thanks for watching → links/deals reminder in description →
   comment prompt → like + subscribe → sign-off ("I'll see you in the next
   one").

## Length and pacing

**The intro and the conclusion have no word limit.** Owner, 2026-08-27: *"I
don't need the limits on intro and conclusion… depending on the video, if I am
making a very long video and very detailed video, then obviously I would want my
intro to be more hooky, more hook and more detailed, so that once intro is over
we have our audience attention. If it's a short video then maybe short intro is
fine."*

**Size them against the video, not against a number.** A 25-minute tutorial with
eleven sections needs an intro that earns 25 minutes of attention: a longer hook,
more of the reveal, a roadmap that actually names eleven things. A six-minute
video needs none of that and a long intro would kill it.

The intro's job is what constrains it, and the job is done when:

- the hook has bought the viewer past the first few seconds
- they know what they are getting and roughly in what order
- they know why this person is the one explaining it
- the links have been mentioned once

Say all of that and stop. **What is still banned is padding**, which is the same
rule as `TASTE.md` T6: repetition, restating the promise twice, or narrating what
is about to happen. A long intro that earns its length is right; a long intro
because the target said so is not, and neither is a short one that skipped the
hook to hit a count.

The same applies to the conclusion. It closes the loop, gives the one thing to do
next, mentions the links, and asks for the comment and the subscribe. Length
follows from how much closing the video actually needs.

**These body figures stay** as rough guides for a comparison, where the shape
repeats per option and consistency between options matters more than it does in
an intro:

- Per-option quick overview: 25-40 words each.
- Per-metric scorecard explanation: 50-90 words.
- Per-option honest-verdict paragraph: 50-80 words.

## One sentence per line

**Every spoken line is one sentence on its own line.** This is how
`EXAMPLE-SCRIPT.md` is written, and it was never written down as a rule until
2026-08-27, when a script plan came back in paragraphs and the owner said the
whole thing read as *"too gibberish, too much is going on in a small frame of
time, it doesn't look like our day-to-day language"*.

Look at the reference script:

```
"Most people think they can instantly tell when they're looking at an AI avatar.
They expect awkward lip-sync, unnatural expressions, or something that just feels... off.
But AI avatar technology has come a long way.
So before I tell you anything else... remember this moment."
```

Four lines, four sentences. Then compare what the same content looks like as a
paragraph: identical words, and it reads twice as fast and half as clearly.

**The line break is not formatting. It is the pacing.** It is where the narrator
breathes, and writing paragraphs removes every one of those breaths at once. That
is the mechanism behind the owner's *"too much is going on in a small frame of
time"* — not word choice, sentence packing.

Three rules that follow from it:

- **One idea per sentence, one sentence per line.** If a line needs an "and" to
  hold two ideas together, it is two lines.
- **Blank line between thought groups**, roughly every three or four lines. That
  is the paragraph, and it is where the narrator takes a longer beat.
- **Do not stack three parallel fragments as a drumbeat.** Three real, distinct
  items on three lines is fine and the reference script does it. Three
  rewordings of one item is `humanizer` pattern 35.

**Claim density is the other half.** A line carries one claim. Four claims in
sixty words is a paragraph a listener cannot follow, however plain the words are,
because speech gives them no chance to re-read. When a beat has four things to
say, it needs four lines and a breath, not a denser sentence.

## Reading as a human

**The `humanizer` skill is part of writing a script here, not a polish option.**
Owner, 2026-08-27: *"My script should not look AI generated, so use the humanizer
skill"*. Step 050 runs it in Mode B (new copy), step 100 in Mode A (editing the
maker's draft, protecting his voice). Their READMEs carry the mode; this section
carries what matters for speech.

Two hard rules, both already true of the reference script and now named:

- **Zero em dashes and zero en dashes.** Scan for them before delivering. A
  regular hyphen in a compound word is fine.
- **Straight quotes only.** No curly quotes.

The patterns that do real damage to a spoken line, in rough order of how often
they show up in a video script:

| Pattern | The shape | The fix |
|---|---|---|
| Fake-profound kicker | a short mic-drop line closing a section: "and that's the whole game" | delete it, do not improve it. End on the last concrete sentence |
| Binary contrast | "this isn't X, it's Y" / "the question isn't X, it's Y" | state Y directly |
| Throat-clearing | "here's the thing", "let me be clear", "I'll be honest" | cut, start on the point |
| Faux-insight setup | "what nobody tells you", "the part everyone skips" | cut the setup, let the claim stand |
| Colon reveal | a noun phrase, a colon, a dramatic payoff | write it as a plain sentence |
| Dramatic fragmentation | "X. And Y. And Z." or stacked one-word lines | complete sentences. Varied rhythm is one short line among longer ones, not a drumbeat |
| Rule of three | every list forced to exactly three items | use the number of items there actually are |
| Undue significance | "underscores the importance of", "marks a shift" | say what happened |
| -ing tails | "…, highlighting the need for…" | end the sentence |
| Interpretive metadiscourse | "that matters more than it sounds", "as you can see" | delete, or replace with the fact that would make it land |

Formatting patterns (boldface, emojis, heading case, inline-header lists) do not
apply inside a `Voiceover` block. They still apply to `Notes` and to anything the
desk or the owner reads.

### Where the house convention and the skill disagree

**The spoken roadmap stays.** `humanizer` pattern 28 bans signposting, and the
opening convention above *requires* a roadmap that names every body section out
loud. That is not a conflict once you see what 28 is aimed at: it bans **empty
announcements** — "let's dive in", "without further ado", "let's break this
down" — sentences that describe the act of speaking instead of saying anything.

A roadmap carries real information: it tells the viewer what they are getting and
in what order, which is why it earns its place and why retention depends on it.
**Keep the roadmap, and keep it concrete.** What 28 forbids is the wind-up around
it. "Now let's dive into the first one" is a signpost; naming the section and
moving is not.

The same distinction settles the CTA cadence: "link's in the description" is
information. "But before we get into it, make sure to…" is a wind-up.

## Never appears in a spoken line

- Recording/production directives ("use the custom avatar," "skip loading
  screens," "follow the pricing SOP") — these live in Notes only.
- Anything that spoils a cold-open reveal before the Reveal beat.
- References to internal process (SOPs, scoring methodology docs, "per our
  evaluation criteria doc") — state the criteria in plain language instead.
- Sponsor/bias language unless the video is actually sponsored — the fairness
  framing in the intro (`TASTE.md` T3) exists specifically so this never needs
  saying later.

---

# The VO polish pass

This is the part specific to step 3. A human reading a script silently corrects
it: they see `HeyGen` and say "hay-jen", they see `1080p` and say "ten-eighty-pee",
they see a 60-word sentence and breathe where it makes sense. **A synthetic voice
does none of that.** It reads characters. Every one of those corrections has to be
in the text before the engine sees it.

## 1 · The pronunciation map

Pronunciation is **not** written into the script. It lives in
`videos/<key>/respell.json`, and the engine applies it at synth time
(`deriveSpoken` in `pipelines/video/tts/lib/spoken.mjs`).

```json
{
  "HeyGen": "hay-jen",
  "Descript": "dee-script",
  "n8n": "N eight N",
  "ElevenLabs": "eleven labs",
  "1080p": "ten-eighty p",
  "API": "A-P-I",
  ".mp4": "dot em-pee-four"
}
```

Rules for the map:

- **One key per distinct problem word**, not per occurrence.
- **Cover these categories every time:** product and brand names, acronyms,
  file extensions and formats, version numbers, prices and currency, units,
  numbers that are read as digits vs. words, and any non-English word.
- **Respell phonetically in plain letters with hyphens.** No IPA, no
  engine-specific phoneme codes.
- Matching is whole-word and case-sensitive, longest key first.
- `script.md` carries **no** lexicon table. It used to, and that meant the
  respelling existed in two places. One source only (plan 252, 2026-08-26).

## 2 · Never write a pronunciation hint into the text

Brackets and parentheticals are read out loud or choked on. And now that
`respell.json` owns pronunciation, a respelling typed into the script is worse
than useless — it gets respelled a second time.

```
BAD   We'll start with HeyGen [hay-jen].
BAD   We'll start with HeyGen (pronounced hay-jen).
BAD   We'll start with hay-jen.
GOOD  script.md     -> We'll start with HeyGen.
      respell.json  -> { "HeyGen": "hay-jen" }
```

The one place a respelling ever appears is `respell.json`.

## 3 · Punctuation is the pacing track

Punctuation is the only pacing control that works on every engine. Use it
deliberately.

- **Full stop = a real beat.** Prefer two short sentences over one long one. If a
  sentence runs past ~25 words, split it.
- **Comma = a short breath.** Add them where a human would breathe, even where a
  copy editor would not.
- **Em dashes and semicolons: remove them.** Engines treat them inconsistently —
  some pause, some ignore, some read the character. Convert to a full stop, a
  comma, or a paragraph break.
- **Ellipses: remove them** unless a deliberate trailing-off is the point, and
  then use a full stop plus a new line instead.
- **Paragraph break = the longest pause.** One idea per paragraph. This is how you
  build the beat before a reveal.
- **No ALL CAPS for emphasis** — many engines spell it out letter by letter. Get
  emphasis from sentence shape and word order instead.
- **Expand every symbol into words:** `&` → "and", `%` → "percent", `#` → "number",
  `/` → "per" or "slash" as the sense requires, `+` → "plus".
- **Write numbers the way they should be said.** `2026` as "twenty twenty-six",
  `1,500` as "fifteen hundred", `4K` as "four K". Do not leave the engine to guess.

## 4 · Headings and the spoken/not-spoken split

`script.md` is read by a human who needs to find their place fast, so it is
clearly headed. None of that structure reaches the engine.

```markdown
# <video title> — final VO script

## Part A — Introduction

### A1 · Cold open

**Voiceover**

> You'd expect to be able to tell. Remember this moment.

**Notes**
- Custom avatar, temp human voice. No logos, no UI on screen.

### A2 · Reveal
...
```

The rules:

- **Every heading is numbered** (`A1`, `B3`, `C2`) so the owner and the editor can
  refer to a beat by name.
- **`**Voiceover**` and `**Notes**` are always both labelled**, always in that
  order, even when a beat has no Notes (write `**Notes**` + `- none`).
- **Spoken copy sits in a blockquote.** Same convention as the outline: the indent
  is the signal. Notes are never quoted.
- **Notes are never spoken.** Everything in the "Never appears in a spoken line"
  list above lives here.

## 5 · Building `script.json`

`script.json` is derived from `script.md` by `lib/build-script-json.mjs` (step
100's README has the command). You do not hand-write it. What you control is
`script.md`, because the builder reads it:

- Each `### N. Title` heading becomes one section, id `s01`, `s02`, … in order.
- Its `**Voiceover**` blockquote becomes `display_text` — the spoken words.
- Its `**Notes**` block becomes `notes` — never spoken.
- A beat under `## PART B` gets `demo: true`; A and C get `demo: false`.

Then check, because this file is the last thing between the draft and the audio:

- [ ] The builder exits 0 and reports the section count you expect.
- [ ] No `[PLACEHOLDER]`, no `[illegible]`, no `[VERIFY:` / `[FILL:` anywhere.
- [ ] No em dashes, semicolons or ellipses in any `display_text`. Punctuation is
      the pacing track and those three have no spoken form.
- [ ] No production instruction sits in a `display_text` — it belongs in `notes`.
- [ ] Every problem word has a `respell.json` key.
- [ ] `stage` is `"tts"` and every `spoken_text` is `""`. Both are required: the
      respell map only applies while `spoken_text` is empty, and `vo-synth`
      refuses any stage other than `tts` or `polished`.

The old flat file is gone (plan 252, 2026-08-26). It was specified for two years of
this flow and never once produced, and it duplicated the spoken words that
`script.json` now holds.

## 6 · The change report

Step 3 ends with a report to the owner, not with a file. It lists:

1. **Every line changed**, as draft → final, grouped by beat number. Reworded,
   respelled, and repunctuated lines all count.
2. **Every gap** — a claim with no support in `knowledge.md`, an unresolved
   `[PLACEHOLDER]`, an illegible source value.
3. **Every judgement call** where you picked one of two readings of an ambiguous
   sentence.

The owner is reviewing changes to his team member's words. A silent improvement is
the failure mode this report exists to prevent.

## 7 · Word targets

`script-worksheet.md` carries a `target <n>–<n> words` marker on each body beat,
stamped by the step-2 session from the budgets above. Check his draft against it
and flag a beat that missed by more than ~40%: a 200-word answer to a 50–90-word
slot is a beat that will not cut, and it is cheaper to say so now than after the
voiceover is rendered.
