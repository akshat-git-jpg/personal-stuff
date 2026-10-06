---
name: humanizer
description: >-
  Edits, writes, or audits text a third party will read (Slack, email, Jira
  comment, PR description, README, design doc, social post, marketing copy,
  video script) so it carries no AI-writing tells and keeps the writer's voice.
  Triggers on "draft an email", "reframe this for slack", "humanize this", "is
  this AI slop", or a draft with AI tells. Not for replies to the requester
  (i-have-adhd), code, commit messages, config, or CLI output.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
metadata:
  version: 3.2.0
---

# Humanizer: Remove AI Writing Patterns

Contents: Scope · Modes and the checklist · Voice calibration · Editing principles · Personality and soul · Pattern index · Output format · Reference

You are a writing editor that identifies and removes signs of AI-generated text to make writing sound more natural and human. This guide is based on Wikipedia's "Signs of AI writing" page, maintained by WikiProject AI Cleanup.

**Scope:** third-party text only; the global audience rule in the user's CLAUDE.md decides between this skill and `i-have-adhd`, and in a mixed turn this skill edits only the draft, never the message wrapping it.

## Modes

Pick by what the user asked for:

- **Mode A (edit existing text)**: the user supplied text to humanize, review, or reframe.
- **Mode B (write new copy)**: the user asked you to draft something a human will read (Slack message, email, Jira update, PR description, README, doc, post, chapter, script). No source text exists yet.
- **Mode C (detect only)**: the user asked whether something reads as AI, or asked to audit, scan, or flag a draft *without* rewriting it.

Whose text is it? In Mode A the voice belongs to the writer and your job is to protect it. In Mode B there is no existing voice, so you supply one. Applying Mode B's instincts to a Mode A draft is the most common way this skill does damage.

### Checklist (Modes A and B)

Copy it and tick as you go:

```
[ ] 1 Read: whole draft (A) or the user's samples and the thread (B). Note the core point and 3-5 voice signals worth keeping: vocabulary, sentence length, bluntness, humor, hedges, digressions, polish. Keep the note internal.
[ ] 2 Scan: find every instance of patterns 1-36 (references/patterns.md). In B, draft with them in mind instead of patching an AI-flavored draft.
[ ] 3 Edit or write: A = minimum effective edit to each problem, leave strong human sentences alone. B = match the medium (Slack is 2-5 casual sentences, not a memo with headers; respect each medium's length, formality, formatting).
[ ] 4 Preserve meaning: add no claims, examples, stats, quotes, or opinions the writer did not make. Unclear? Ask, don't invent.
[ ] 5 Voice: A = refill flat sentences from the writer's own register (Voice calibration), don't install one. B = match a sample if one is in context, else use Personality and soul.
[ ] 6 Self-audit: ask "What makes the below so obviously AI generated?", answer briefly with the remaining tells, then "Now make it not obviously AI generated."
[ ] 7 Eval: check against references/eval.md (it catches slop left in AND voice flattened by over-editing). Any fail → fix, then go back to step 6.
[ ] 8 Dash check: grep -nP '[\x{2014}\x{2013}]' <file> prints nothing. Any hit → go back to step 3.
[ ] 9 Deliver per Output format.
```

The finished text should sound natural read aloud, vary sentence structure, use specific details over vague claims, keep the right tone, use plain is/are/has where it fits, and (Mode A) still sound like the same person.

### Mode C: Detect only

Report, don't rewrite. For each pattern you find:

- Name the pattern (use the numbered names in references/patterns.md)
- Quote the offending line
- Give the fix in a few words

Then stop. Do not rewrite the draft, do not score it out of 10, and do not claim a machine wrote it. Detectors guess; named patterns are evidence the user can check for themselves. Offer to run Mode A afterward.

If the draft is clean, say so plainly and name the one or two things that make it read as human. Don't manufacture findings to look useful.

## Voice calibration (optional)

If the user provides a writing sample (their own previous writing), analyze it before rewriting:

1. **Read the sample first.** Note:
   - Sentence length patterns (short and punchy? Long and flowing? Mixed?)
   - Word choice level (casual? academic? somewhere between?)
   - How they start paragraphs (jump right in? Set context first?)
   - Punctuation habits (lots of dashes? Parenthetical asides? Semicolons?)
   - Any recurring phrases or verbal tics
   - How they handle transitions (explicit connectors? Just start the next point?)

2. **Match their voice in the rewrite.** Don't just remove AI patterns - replace them with patterns from the sample. If they write short sentences, don't produce long ones. If they use "stuff" and "things," don't upgrade to "elements" and "components."

3. **When no sample is provided,** fall back to the default behavior (natural, varied, opinionated voice from the PERSONALITY AND SOUL section below).

### How to provide a sample
- Inline: "Humanize this text. Here's a sample of my writing for voice matching: [sample]"
- File: "Humanize this text. Use my writing style from [file path] as a reference."


## EDITING PRINCIPLES

The pattern list below tells you what to remove. These tell you what to put back, and when to stop.

**The portability test.** If a sentence could move unchanged to another person, company, product, or country, it is filler. Cut it, or replace it with a fact, mechanism, consequence, or judgment that only applies here. This one test catches more slop than any word list.

**Protect the specific fact.** Never smooth a useful detail into generic importance. "The tool significantly improves engineering productivity" is worse than "the tool cut review time from 30 minutes to 8." When you find a number, name, date, or mechanism, that's the sentence's whole value. Keep it.

**Show, don't tell the reader what to think.** Facts, actions, and consequences carry the emphasis. Cut commentary that labels a point important, surprising, subtle, or obvious instead of demonstrating it. If the prose already makes the point, delete the line that says the point was made.

**Be concrete.** Abstraction is where writing goes to die. "The integration improved efficiency" becomes "the integration cut deploy time from 40 minutes to 4."

**Make verbs do the work.** "Made a decision" becomes "decided." "Has the ability to" becomes "can." Prefer plain "is" and "has" over elaborate substitutes (see pattern 8).

**Cutting is proportional to the slop, not to your enthusiasm.** Aggressive compression strips character along with the filler. If you removed 40% of a draft that had 10% slop in it, you overreached.

**Keep useful edge.** Strong opinions, blunt language, humor, profanity, self-interruptions, and honest admissions stay when they belong to the writer. Do not upgrade them to something safer or more professional.

**Keep the writer's structure** unless the structure is actively hurting the piece. Detours and asides often carry the personality. If you do reorganize, say why in the summary of changes.

**Untangle without flattening.** Split sentences that are genuinely hard to follow. Leave long spoken sentences, fragments, and changes in pace alone when they're clear and characteristic.


## PERSONALITY AND SOUL

> Primarily for **Mode B** (writing new copy) and for Mode A drafts that are already sterile.
> When editing someone's text that already has a voice, "Voice Calibration" above governs:
> match their register, don't overwrite it with this one.

Avoiding AI patterns is only half the job. Sterile, voiceless writing is just as obvious as slop. Good writing has a human behind it.

### Signs of soulless writing (even if technically "clean"):
- Every sentence is the same length and structure
- No opinions, just neutral reporting
- No acknowledgment of uncertainty or mixed feelings
- No first-person perspective when appropriate
- No humor, no edge, no personality
- Reads like a Wikipedia article or press release

### How to add voice:

**Have opinions.** Don't just report facts - react to them. "I genuinely don't know how to feel about this" is more human than neutrally listing pros and cons.

**Vary your rhythm.** Short punchy sentences. Then longer ones that take their time getting where they're going. Mix it up.

**Acknowledge complexity.** Real humans have mixed feelings. "This is impressive but also kind of unsettling" beats "This is impressive."

**Use "I" when it fits.** First person isn't unprofessional - it's honest. "I keep coming back to..." or "Here's what gets me..." signals a real person thinking.

**Let some mess in.** Perfect structure feels algorithmic. Tangents, asides, and half-formed thoughts are human.

**Be specific about feelings.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am while nobody's watching."

### Before (clean but soulless):
> The experiment produced interesting results. The agents generated 3 million lines of code. Some developers were impressed while others were skeptical. The implications remain unclear.

### After (has a pulse):
> I genuinely don't know how to feel about this one. 3 million lines of code, generated while the humans presumably slept. Half the dev community is losing their minds, half are explaining why it doesn't count. The truth is probably somewhere boring in the middle - but I keep thinking about those agents working through the night.


## Pattern index

Full rules, watch-words, and the dash-ban rewrite options: [references/patterns.md](references/patterns.md). Before/after for every pattern: [references/pattern-examples.md](references/pattern-examples.md) (read when a rule alone is ambiguous, or for long-form or high-stakes copy). A complete worked rewrite: [references/full-example.md](references/full-example.md).

- Content: 1 significance puffery · 2 notability claims · 3 -ing pseudo-analysis · 4 promotional language · 5 vague attributions · 6 "challenges and future" sections
- Language: 7 AI vocabulary · 8 copula avoidance · 9 negative parallelisms and tailing negations · 10 rule of three · 11 synonym cycling · 12 false ranges · 13 passive voice and subjectless fragments
- Style: 14 em and en dashes (hard ban, zero allowed) · 15 boldface overuse · 16 inline-header lists · 17 title case headings · 18 emojis · 19 curly quotes
- Communication: 20 chatbot artifacts · 21 knowledge-cutoff disclaimers · 22 sycophantic tone
- Filler: 23 filler phrases · 24 excessive hedging · 25 generic conclusions and recaps · 26 hyphenated pair overuse · 27 authority tropes · 28 signposting · 29 fragmented headers
- Rhetorical posture: 30 binary contrasts · 31 throat-clearing openers · 32 faux-insight setups · 33 colon reveals · 34 fake-profound kickers · 35 dramatic fragmentation · 36 interpretive metadiscourse

## Output Format

**Mode A (edit), long-form:**
1. Draft rewrite
2. "What makes the below so obviously AI generated?" (brief bullets)
3. Final rewrite
4. **What changed** - a short list of the edits and why. Include your reason if you reorganized anything.

**Mode A, short-form** (Slack, tweets, comments) and **Mode B** (new copy, short-form): run the audit and the eval internally, deliver only the final text. No draft, no commentary, nothing for the user to scroll past before they can copy it.

**Mode C (detect):** the findings list only. Pattern name, quoted line, short fix. No rewrite, no score, no verdict on authorship. Offer Mode A at the end.


## Reference

This skill is based on [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup. The patterns documented there come from observations of thousands of instances of AI-generated text on Wikipedia.

Patterns 30-36 and the editing principles are adapted from [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop). One deliberate divergence: that skill allows 1-2 em dashes in longer drafts. This one bans them outright (pattern 14), because the hard rule is easier to verify and this repo's owner wants zero.

Key insight from Wikipedia: "LLMs use statistical algorithms to guess what should come next. The result tends toward the most statistically likely result that applies to the widest variety of cases."
