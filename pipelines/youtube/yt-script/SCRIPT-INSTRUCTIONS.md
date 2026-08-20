# Script instructions

How to turn the **team member's completed draft** into `script.md` + `script.vo.txt`
— the final script an AI voiceover engine reads correctly on the first take.

```
outline.md   →  outline.pdf            the READ file: show, edit, rules
     └──────→  script-worksheet.md     the WRITE file: script only —
                                       pre-filled copy + empty slots
script-worksheet.md  →  [ he fills the slots ]  →  script-draft.md
script-draft.md      →  [ this file ]           →  script.md + script.vo.txt
```

**You are not writing the script.** The maker already did, working from the
outline PDF and his own screen time. Your job is a finalise pass: make his words
sound right out of a synthetic mouth, and separate what is spoken from what is
not. Two documents come out of it:

| File | For | Contains |
|---|---|---|
| `script.md` | humans — the owner, the editor | everything: Voiceover, Notes, lexicon, headings |
| `script.vo.txt` | the VO engine (step 4) | spoken lines only, pronunciation already applied |

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
- Direct address to the viewer as "you." Casual-professional — contractions,
  short sentences, no corporate hedging.
- Frame every comparison as fair and unbiased before making claims: state the
  test conditions (same script, same inputs) up front so verdicts later feel
  earned, not sponsored.
- Give every option credit before naming its limit. Never open a platform's
  verdict with the negative — earn the criticism after stating what it's
  genuinely good for.
- Confident, singular recommendations at the end — not "it depends," a named
  winner with a one-line reason.

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
  resolved before it reaches `script.vo.txt` — an unresolved placeholder is a
  blocker, not a note.
- Structure and claims still never change. That rule did not soften; it hardened.

## Section format

Every section separates two things, always labeled:

- **Voiceover** — the exact words spoken, written as full sentences/paragraphs.
- **Notes** — production/recording instructions (which avatar or asset to use,
  what to show on screen, what NOT to reveal yet, pacing cues like "skip
  loading screens"). Notes are never spoken.

For a comparison across N options, structure the walk as:
1. One short paragraph per option (quick overview) before any evaluation.
2. A `Notes` block per option covering setup specifics and what stays hidden.
3. An `ON-SCREEN — <TABLE NAME>` table when scoring, immediately followed by a
   Voiceover paragraph per row/metric explaining the numbers — never leave a
   table to speak for itself.

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

## Closing convention (Part C)

1. **Honest Verdict, weakest to strongest.** Walk every option in ascending
   order of fit, ending on the winner(s). Each gets a fair reason to exist,
   then its limit — never the reverse order.
2. **Overall synthesis line** before verdicts start: "none of these are bad,
   they're just built for different priorities" — softens the ranking that
   follows.
3. **Final recommendation** — restate the winner(s) addressed to named viewer
   personas (by role/use case), then one closing sentence naming the single
   top pick if forced to choose only one.
4. **Final CTA** — thanks for watching → links/deals reminder in description →
   comment prompt → like + subscribe → sign-off ("I'll see you in the next
   one").

## Word budget and pacing (rough, calibrate to the topic)

- Cold open + reveal: 100-160 words combined.
- Roadmap: 60-100 words.
- Per-option quick overview: 25-40 words each.
- Per-metric scorecard explanation: 50-90 words.
- Per-option honest-verdict paragraph: 50-80 words.
- Final CTA: 100-140 words.

## Never appears in a spoken line

- Recording/production directives ("use the custom avatar," "skip loading
  screens," "follow the pricing SOP") — these live in Notes only.
- Anything that spoils a cold-open reveal before the Reveal beat.
- References to internal process (SOPs, scoring methodology docs, "per our
  evaluation criteria doc") — state the criteria in plain language instead.
- Sponsor/bias language unless the video is actually sponsored — the fairness
  framing in the intro exists specifically so this never needs saying later.

---

# The VO polish pass

This is the part specific to step 3. A human reading a script silently corrects
it: they see `HeyGen` and say "hay-jen", they see `1080p` and say "ten-eighty-pee",
they see a 60-word sentence and breathe where it makes sense. **A synthetic voice
does none of that.** It reads characters. Every one of those corrections has to be
in the text before the engine sees it.

## 1 · The pronunciation lexicon

`script.md` opens with a lexicon table, before Part A. It lists every word in this
script that an engine is likely to get wrong, and the respelling that fixes it.

```markdown
## Pronunciation lexicon

| Written | Say it as | Note |
|---|---|---|
| HeyGen | hay-jen | not "hey-gen" |
| Descript | dee-script | |
| n8n | n-eight-n | never "en-eight-en" |
| ElevenLabs | eleven labs | two words when spoken |
| 1080p | ten-eighty p | |
| $29/mo | twenty-nine dollars a month | |
| API | A-P-I | letters, not "appy" |
| .mp4 | dot em-pee-four | |
```

Rules for the lexicon:

- **One row per distinct problem word**, not per occurrence.
- **Cover these categories every time:** product and brand names, acronyms,
  file extensions and formats, version numbers, prices and currency, units,
  numbers that are read as digits vs. words, and any non-English word.
- **Respell phonetically in plain letters with hyphens.** No IPA, no engine-specific
  phoneme codes — the engine is not chosen yet, and plain respelling works on all
  of them.
- **The lexicon is documentation, not markup.** It explains the substitutions you
  already made. It is never itself sent to the engine.

## 2 · Substitution — the lexicon is applied, not attached

This is the trap worth stating twice. **Brackets are for the human file only.**
An engine reads a bracket out loud, or chokes on it.

- In `script.md`, keep the name readable and let the lexicon carry the note:
  `We'll start with HeyGen.`
- In `script.vo.txt`, the substitution is already done:
  `We'll start with hay-jen.`

Never write the hint inline in the spoken text:

```
BAD   We'll start with HeyGen [hay-jen].
BAD   We'll start with HeyGen (pronounced hay-jen).
GOOD  script.md      → We'll start with HeyGen.
      script.vo.txt  → We'll start with hay-jen.
```

If the respelling looks wrong in the human file, that is fine — `script.vo.txt` is
not for reading, it is for speaking.

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

## Pronunciation lexicon
| ... |

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

## 5 · Building `script.vo.txt`

Flatten `script.md` into spoken text and nothing else.

**Keep:** the Voiceover blockquote content, in document order, with the lexicon
substitutions applied and the paragraph breaks preserved.

**Strip:** the lexicon table, every heading, every `**Voiceover**` / `**Notes**`
label, every Notes block, every blockquote marker, every bracket, every markdown
emphasis marker, and every table.

```
You'd expect to be able to tell. Remember this moment.

So over the last three weeks, I tested four avatar tools. Same script. Same
inputs. Same fifteen-second clip.

First up, hay-jen.
```

Then check it, because this file is the last thing between the draft and the
audio:

- [ ] Read it top to bottom. Every line is something you want said out loud.
- [ ] No `#`, `>`, `*`, `[`, `]`, `|`, `_` characters left.
- [ ] No `[PLACEHOLDER]` and no `[illegible]`.
- [ ] No em dashes, semicolons, or ellipses.
- [ ] No production instruction survived from a Notes block.
- [ ] Every lexicon row is actually applied in the text.
- [ ] Nothing is spelled `HeyGen` that the lexicon says to say as `hay-jen`.

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
