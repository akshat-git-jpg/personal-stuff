# Humanizer patterns 1-36

The numbered AI-writing patterns. Mode C findings cite these names. Before/after examples for
each are in [pattern-examples.md](pattern-examples.md); a full worked rewrite is in
[full-example.md](full-example.md).

Contents:
- Content patterns (1-6)
- Language and grammar patterns (7-13)
- Style patterns (14-19), including the em-dash hard ban
- Communication patterns (20-22)
- Filler and hedging (23-29)
- Rhetorical posture patterns (30-36)

## Content patterns

### 1. Undue emphasis on significance, legacy, and broader trends
**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance/significance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted

### 2. Undue emphasis on notability and media coverage
**Words to watch:** independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence. Often a list of sources with no context.

### 3. Superficial analyses with -ing endings
**Words to watch:** highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing... tacked onto a sentence to fake depth.

### 4. Promotional and advertisement-like language
**Words to watch:** boasts a, vibrant, rich (figurative), profound, enhancing its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning. Worst on "cultural heritage" topics.

### 5. Vague attributions and weasel words
**Words to watch:** Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)

### 6. Outline-like "Challenges and Future Prospects" sections
**Words to watch:** Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook

## Language and grammar patterns

### 7. Overused "AI vocabulary" words
**High-frequency AI words:** Actually, additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract noun), pivotal, showcase, tapestry (abstract noun), testament, underscore (verb), valuable, vibrant. They often co-occur.

### 8. Avoidance of "is"/"are" (copula avoidance)
**Words to watch:** serves as/stands as/marks/represents [a], boasts/features/offers [a]

### 9. Negative parallelisms and tailing negations
"Not only...but..." and "It's not just about..., it's...". Also clipped tailing-negation fragments such as "no guessing" or "no wasted motion" tacked onto the end of a sentence instead of written as a real clause.

### 10. Rule of three overuse
Ideas forced into groups of three to look comprehensive.

### 11. Elegant variation (synonym cycling)
The same thing renamed every sentence. Repeat the right word instead.

### 12. False ranges
"From X to Y" where X and Y are not on a meaningful scale.

### 13. Passive voice and subjectless fragments
Hidden actor or dropped subject: "No configuration file needed", "The results are preserved automatically." Rewrite when active voice is clearer and more direct.

## Style patterns

### 14. Em dashes (hard ban)
The em dash (U+2014) and en dash (U+2013) are the loudest AI tell. The output must contain zero of either, whatever the medium or tone. A regular hyphen in a genuine compound ("long-term", "well-known") is fine.

Rewrite every long dash. Options, in rough order of preference:
- A comma, when the dash joins a clause or aside: `institutions, not the people`.
- A period, when the dash splits two full thoughts: `it works. Users love it.`
- Parentheses, for a true aside: `the tool (still in beta) shipped`.
- A colon, when what follows explains what came before: `one problem: it's slow`.
- For a numeric range, use "to": `10 to 20 minutes`.

**Final check is a command**, not a read-through. Save the text to a file and run:

```bash
grep -nP '[\x{2014}\x{2013}]' <file>
```

Any output line means the pass is not done.

### 15. Overuse of boldface
Phrases bolded mechanically for emphasis.

### 16. Inline-header vertical lists
List items that start with a bolded header and a colon.

### 17. Title case in headings
Use sentence case.

### 18. Emojis
Emoji decorating headings or bullets.

### 19. Curly quotation marks
Curly quotes and apostrophes instead of straight ones.

## Communication patterns

### 20. Collaborative communication artifacts
**Words to watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like..., let me know, here is a...

### 21. Knowledge-cutoff disclaimers
**Words to watch:** as of [date], Up to my last training update, While specific details are limited/scarce..., based on available information...

### 22. Sycophantic or servile tone
Overly positive, people-pleasing language.

## Filler and hedging

### 23. Filler phrases
- "In order to achieve this goal" → "To achieve this"
- "Due to the fact that it was raining" → "Because it was raining"
- "At this point in time" → "Now"
- "In the event that you need help" → "If you need help"
- "The system has the ability to process" → "The system can process"
- "It is important to note that the data shows" → "The data shows"

### 24. Excessive hedging
Over-qualified statements.

### 25. Generic positive conclusions and summary recaps
**Phrases to watch:** In conclusion, Ultimately, Overall, To sum up, The future looks bright

Two failure modes: the vague upbeat ending ("exciting times lie ahead"), and the recap that restates what the reader just read. End on the last concrete point, takeaway, or next action.

### 26. Hyphenated word pair overuse
**Words to watch:** third-party, cross-functional, client-facing, data-driven, decision-making, well-known, high-quality, real-time, long-term, end-to-end

AI hyphenates common pairs with perfect consistency; humans rarely do. Less common or technical compound modifiers are fine to hyphenate.

### 27. Persuasive authority tropes
**Phrases to watch:** The real question is, at its core, in reality, what really matters, fundamentally, the deeper issue, the heart of the matter. The sentence after usually restates an ordinary point with extra ceremony.

### 28. Signposting and announcements
**Phrases to watch:** Let's dive in, let's explore, let's break this down, here's what you need to know, now let's look at, without further ado

### 29. Fragmented headers
A heading followed by a one-line paragraph that restates the heading before the real content starts.

## Rhetorical posture patterns

These survive a vocabulary cleanup: the words are fine, the stance is the giveaway. Most common in blog posts, LinkedIn, video scripts.

### 30. Binary contrasts
**Shapes:** "This isn't X. It's Y." / "The question isn't X, it's Y." / "It's not just X, it's Y."

State Y directly: "the eval matters more than the model." Related to 9, but 9 is grammar and this is the rhetorical setup.

### 31. Throat-clearing openers
**Phrases:** Here's the thing, Here's what I mean, Let me be clear, I'll be honest, The uncomfortable truth is, Look

Cut it and start with the point. Distinct from 28: signposting announces structure, this performs candor.

### 32. Faux-insight setups
**Phrases:** What nobody tells you, What most people get wrong, This is the part everyone skips, The part nobody talks about, Here's what they don't want you to know

Cut the setup and let the claim stand: "distribution is the moat."

### 33. Colon reveals
**Shape:** a noun phrase, a colon, then a lowercase dramatic payoff. "The best part: it learns."

Rewrite as a plain sentence. Colons are for lists, labels, and quotes. Use sentence case after a colon unless grammar, a proper noun, a title, or code says otherwise.

### 34. Fake-profound kickers
A final short line that turns the point into a metaphor, aphorism, or mic-drop. "And that's the whole game."

The loudest tell in AI blog and social copy. **Delete it. Do not rewrite it into a better metaphor and do not keep its rhythm.** End on the clearest concrete sentence already there; if closure is needed, add a plain takeaway or next action.

### 35. Dramatic fragmentation
**Shapes:** "X. And Y. And Z." / "That's it. That's the whole thing." / stacked one-word paragraphs

Use complete sentences. Varied rhythm means a short sentence among longer ones, not a drumbeat of fragments.

### 36. Interpretive metadiscourse
**Phrases:** That last part matters more than it sounds, The key point is, As you can see, This distinction matters, It's worth pausing on, In other words (when redundant)

If the point is already clear, delete the aside. If not, replace it with the supporting fact. Overlaps 27, which fakes depth; this one directs the reader.
