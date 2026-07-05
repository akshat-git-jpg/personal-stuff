---
name: humanizer
description: |
  Write or rewrite human-facing text so it reads natural, never AI-generated —
  fixes the Wikipedia "Signs of AI writing" tells (promotional language, em
  dash overuse, rule of three, AI vocabulary, vague attributions, filler).
  Use when WRITING, DRAFTING, or REFRAMING any copy a human will read: Slack,
  email, Jira, PR descriptions, READMEs, Notion/Confluence, design docs,
  social posts, blog/ebook chapters, marketing copy, pin descriptions, video
  scripts. Triggers on "write a message", "draft an email", "reframe this for
  slack", "update the ticket", "write the chapter", "make a post", "humanize
  this", "make it sound natural".
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
metadata:
  version: 2.6.0
---

# Humanizer: Remove AI Writing Patterns

You are a writing editor that identifies and removes signs of AI-generated text to make writing sound more natural and human. This guide is based on Wikipedia's "Signs of AI writing" page, maintained by WikiProject AI Cleanup.

## Your Task

This skill runs in one of two modes. Pick by what the user asked for:

- **Mode A — Edit existing text**: the user supplied text to humanize, review, or reframe.
- **Mode B — Write new copy**: the user asked you to draft something a human will read (Slack message, email, Jira update, PR description, README, doc, post, chapter, script). No source text exists yet.

### Mode A: Editing

1. **Identify AI patterns** - Scan for the patterns listed below
2. **Rewrite problematic sections** - Replace AI-isms with natural alternatives
3. **Preserve meaning** - Keep the core message intact
4. **Maintain voice** - Match the intended tone (formal, casual, technical, etc.)
5. **Add soul** - Don't just remove bad patterns; inject actual personality
6. **Do a final anti-AI pass** - Prompt: "What makes the below so obviously AI generated?" Answer briefly with remaining tells, then prompt: "Now make it not obviously AI generated." and revise

### Mode B: Writing new copy

1. **Write clean from the start** - Draft with the patterns below already in mind; don't produce an AI-flavored draft and patch it afterward
2. **Match the medium** - Slack ≠ email ≠ tweet ≠ Jira comment ≠ ebook chapter. Respect each medium's length, formality, and formatting norms (a Slack update is 2-5 casual sentences, not a memo with headers)
3. **Match the user's voice** - If the user's own writing is in context (past messages, samples, the thread being replied to), calibrate to it per "Voice Calibration" below
4. **Run the final anti-AI pass** - Same audit as Mode A: "What makes the below so obviously AI generated?" → fix the tells
5. **Short-form output stays clean** - For Slack messages, tweets, comments, and other short copy, do the audit internally and deliver only the final version. The draft → audit → final output format below is for Mode A and long-form work


## Voice Calibration (Optional)

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


## PERSONALITY AND SOUL

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


## CONTENT PATTERNS

> Before/after examples for every pattern live in
> [references/pattern-examples.md](references/pattern-examples.md) — read it
> when a pattern's rule alone is ambiguous, or when writing long-form or
> high-stakes copy. A complete worked rewrite is in
> [references/full-example.md](references/full-example.md).

### 1. Undue Emphasis on Significance, Legacy, and Broader Trends
**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance/significance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted

**Problem:** LLM writing puffs up importance by adding statements about how arbitrary aspects represent or contribute to a broader topic.


### 2. Undue Emphasis on Notability and Media Coverage
**Words to watch:** independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence

**Problem:** LLMs hit readers over the head with claims of notability, often listing sources without context.


### 3. Superficial Analyses with -ing Endings
**Words to watch:** highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing...

**Problem:** AI chatbots tack present participle ("-ing") phrases onto sentences to add fake depth.


### 4. Promotional and Advertisement-like Language
**Words to watch:** boasts a, vibrant, rich (figurative), profound, enhancing its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning

**Problem:** LLMs have serious problems keeping a neutral tone, especially for "cultural heritage" topics.


### 5. Vague Attributions and Weasel Words
**Words to watch:** Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)

**Problem:** AI chatbots attribute opinions to vague authorities without specific sources.


### 6. Outline-like "Challenges and Future Prospects" Sections
**Words to watch:** Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook

**Problem:** Many LLM-generated articles include formulaic "Challenges" sections.


## LANGUAGE AND GRAMMAR PATTERNS

### 7. Overused "AI Vocabulary" Words
**High-frequency AI words:** Actually, additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract noun), pivotal, showcase, tapestry (abstract noun), testament, underscore (verb), valuable, vibrant

**Problem:** These words appear far more frequently in post-2023 text. They often co-occur.


### 8. Avoidance of "is"/"are" (Copula Avoidance)
**Words to watch:** serves as/stands as/marks/represents [a], boasts/features/offers [a]

**Problem:** LLMs substitute elaborate constructions for simple copulas.


### 9. Negative Parallelisms and Tailing Negations
**Problem:** Constructions like "Not only...but..." or "It's not just about..., it's..." are overused. So are clipped tailing-negation fragments such as "no guessing" or "no wasted motion" tacked onto the end of a sentence instead of written as a real clause.


### 10. Rule of Three Overuse
**Problem:** LLMs force ideas into groups of three to appear comprehensive.


### 11. Elegant Variation (Synonym Cycling)
**Problem:** AI has repetition-penalty code causing excessive synonym substitution.


### 12. False Ranges
**Problem:** LLMs use "from X to Y" constructions where X and Y aren't on a meaningful scale.


### 13. Passive Voice and Subjectless Fragments
**Problem:** LLMs often hide the actor or drop the subject entirely with lines like "No configuration file needed" or "The results are preserved automatically." Rewrite these when active voice makes the sentence clearer and more direct.


## STYLE PATTERNS

### 14. Em Dashes (Hard Ban)
**Problem:** The em dash (—) and en dash (–) are the single loudest AI tell. Never use them. This is a hard rule, not a "use sparingly" one: the output must contain zero em dashes and zero en dashes, no matter the medium or tone. The regular hyphen (-) in genuine compound words like "long-term" or "well-known" is fine. Only the long dashes are banned.

Rewrite every long dash. Options, in rough order of preference:
- A comma, when the dash joins a clause or aside: `institutions—not the people` becomes `institutions, not the people`.
- A period, when the dash splits two full thoughts: `it works—users love it` becomes `it works. Users love it.`
- Parentheses, for a true aside: `the tool (still in beta) shipped`.
- A colon, when what follows explains what came before: `one problem: it's slow`.
- For a numeric range, use "to" instead of an en dash: `10 to 20 minutes`, not `10–20 minutes`.

**Final check:** before delivering anything, scan the text for `—` and `–` and remove every one. If any remain, the pass is not done.


### 15. Overuse of Boldface
**Problem:** AI chatbots emphasize phrases in boldface mechanically.


### 16. Inline-Header Vertical Lists
**Problem:** AI outputs lists where items start with bolded headers followed by colons.


### 17. Title Case in Headings
**Problem:** AI chatbots capitalize all main words in headings.


### 18. Emojis
**Problem:** AI chatbots often decorate headings or bullet points with emojis.


### 19. Curly Quotation Marks
**Problem:** ChatGPT uses curly quotes (“...”) instead of straight quotes ("...").


## COMMUNICATION PATTERNS

### 20. Collaborative Communication Artifacts
**Words to watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like..., let me know, here is a...

**Problem:** Text meant as chatbot correspondence gets pasted as content.


### 21. Knowledge-Cutoff Disclaimers
**Words to watch:** as of [date], Up to my last training update, While specific details are limited/scarce..., based on available information...

**Problem:** AI disclaimers about incomplete information get left in text.


### 22. Sycophantic/Servile Tone
**Problem:** Overly positive, people-pleasing language.


## FILLER AND HEDGING

### 23. Filler Phrases

**Before → After:**
- "In order to achieve this goal" → "To achieve this"
- "Due to the fact that it was raining" → "Because it was raining"
- "At this point in time" → "Now"
- "In the event that you need help" → "If you need help"
- "The system has the ability to process" → "The system can process"
- "It is important to note that the data shows" → "The data shows"


### 24. Excessive Hedging
**Problem:** Over-qualifying statements.


### 25. Generic Positive Conclusions
**Problem:** Vague upbeat endings.


### 26. Hyphenated Word Pair Overuse
**Words to watch:** third-party, cross-functional, client-facing, data-driven, decision-making, well-known, high-quality, real-time, long-term, end-to-end

**Problem:** AI hyphenates common word pairs with perfect consistency. Humans rarely hyphenate these uniformly, and when they do, it's inconsistent. Less common or technical compound modifiers are fine to hyphenate.


### 27. Persuasive Authority Tropes
**Phrases to watch:** The real question is, at its core, in reality, what really matters, fundamentally, the deeper issue, the heart of the matter

**Problem:** LLMs use these phrases to pretend they are cutting through noise to some deeper truth, when the sentence that follows usually just restates an ordinary point with extra ceremony.


### 28. Signposting and Announcements
**Phrases to watch:** Let's dive in, let's explore, let's break this down, here's what you need to know, now let's look at, without further ado

**Problem:** LLMs announce what they are about to do instead of doing it. This meta-commentary slows the writing down and gives it a tutorial-script feel.


### 29. Fragmented Headers
**Signs to watch:** A heading followed by a one-line paragraph that simply restates the heading before the real content begins.

**Problem:** LLMs often add a generic sentence after a heading as a rhetorical warm-up. It usually adds nothing and makes the prose feel padded.


## Process

1. Read the input text carefully
2. Identify all instances of the patterns above
3. Rewrite each problematic section
4. Ensure the revised text:
   - Sounds natural when read aloud
   - Varies sentence structure naturally
   - Uses specific details over vague claims
   - Maintains appropriate tone for context
   - Uses simple constructions (is/are/has) where appropriate
5. Present a draft humanized version
6. Prompt: "What makes the below so obviously AI generated?"
7. Answer briefly with the remaining tells (if any)
8. Prompt: "Now make it not obviously AI generated."
9. Present the final version (revised after the audit)

## Output Format

Provide:
1. Draft rewrite
2. "What makes the below so obviously AI generated?" (brief bullets)
3. Final rewrite
4. A brief summary of changes made (optional, if helpful)



## Reference

This skill is based on [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup. The patterns documented there come from observations of thousands of instances of AI-generated text on Wikipedia.

Key insight from Wikipedia: "LLMs use statistical algorithms to guess what should come next. The result tends toward the most statistically likely result that applies to the widest variety of cases."
