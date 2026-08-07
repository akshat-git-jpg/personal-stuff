# Humanizer eval

Run this against the finished text before delivering it. Answer each check pass or fail. Any fail means fix the text and run the list again.

This is a two-sided gate. The first half catches slop you left in. The second half catches voice you edited out, which is the failure mode nobody notices because the output looks clean.

## Hard checks (mechanical, no judgment needed)

1. Does the text contain zero em dashes (—) and zero en dashes (–)? Search for both characters literally. Hyphens in genuine compounds are fine.
2. Are all quotation marks straight (") and not curly (“ ”)? Same for apostrophes.
3. Are headings sentence case, not Title Case?
4. Is the text free of emoji in headings and bullets?
5. Is bold used for real labels only, not sprinkled mid-sentence for emphasis?
6. Is the text free of chatbot artifacts: "I hope this helps", "Of course!", "Let me know if", "Would you like me to"?
7. Is the text free of knowledge-cutoff hedges: "as of my last update", "based on available information"?

## Slop checks

1. Are banned AI-vocabulary words gone unless quoted as examples: delve, leverage, utilize, foster, robust, tapestry, testament, pivotal, showcase, underscore, intricate, vibrant, seamless, empower, elevate, transformative?
2. Are filler phrases gone: "it's important to note", "at the end of the day", "when it comes to", "in order to", "in today's world"?
3. Are importance puffery and broader-trend claims gone (pattern 1)? No sentence tells the reader that something marks a moment, reflects a shift, or underscores its significance.
4. Are trailing -ing clauses that fake analysis gone (pattern 3): highlighting, underscoring, reflecting, showcasing?
5. Is every vague attribution either named or cut (pattern 5)? No "experts argue", "industry reports", "studies show" without a source. If the writer had no source, was that flagged rather than invented?
6. Are copula substitutes replaced with plain is/has where clearer (pattern 8)? No "serves as", "stands as", "boasts".
7. Are negative parallelisms and tailing negations rewritten as real clauses (pattern 9)?
8. Are forced groups of three broken up (pattern 10)?
9. Is the same word repeated where it is the right word, instead of rotated through synonyms (pattern 11)?
10. Are "from X to Y" false ranges gone (pattern 12)?
11. Are subjectless fragments and hidden actors made active where that is clearer (pattern 13)?
12. Are inline-header bullet lists converted to prose where two sentences would read better (pattern 16)?
13. Is hedging proportional to real uncertainty, not stacked (pattern 24)?
14. Does the ending land on a concrete point, takeaway, or next action, with no recap paragraph and no vague upbeat close (pattern 25)?
15. Are authority tropes gone (pattern 27): "the real question is", "at its core", "what really matters"?
16. Is signposting gone (pattern 28): "let's dive in", "here's what you need to know"?
17. Does every heading go straight into content, with no restating warm-up line (pattern 29)?

## Rhetorical posture checks

1. Are binary contrasts stated directly instead of as oppositions (pattern 30)? No "it's not X, it's Y".
2. Are throat-clearing openers cut (pattern 31): "here's the thing", "let me be clear", "I'll be honest"?
3. Are faux-insight setups cut (pattern 32): "what nobody tells you", "the part everyone misses"?
4. Are colon reveals rewritten as plain sentences (pattern 33)? Colons appear only for lists, labels, and quotes.
5. Was the fake-profound kicker deleted rather than rewritten into a better metaphor (pattern 34)? Check the last line specifically. This is the most commonly missed check on the list.
6. Are dramatic fragment stacks written as complete sentences (pattern 35)?
7. Is interpretive metadiscourse cut (pattern 36)? Nothing tells the reader what to notice or how much a point matters.

## Substance checks

1. Does every generic sentence pass the portability test? If a sentence could move unchanged to another person, company, or product, was it cut or made specific?
2. Were specific facts protected rather than smoothed into generic importance? Every number, name, date, and mechanism in the input still present in the output.
3. Does the text show rather than tell? No line labels a point as important, surprising, or obvious instead of demonstrating it.
4. Do the verbs do the work? No "made a decision" for "decided", no "has the ability to" for "can".

## Voice checks (the over-editing gate)

1. Was anything added that the writer did not say: a claim, example, statistic, quote, or opinion? Adding is a harder failure than leaving slop in.
2. Would the writer recognize this as their own writing, not as a cleaned-up version of it?
3. Is the amount cut proportional to the actual slop? If a draft with light slop lost a third of its length, this fails.
4. Do the writer's hedges, asides, humor, bluntness, profanity, and self-interruptions survive where they carried personality?
5. Are strong human sentences untouched, rather than rewritten for consistency with the rest?
6. Does the sentence rhythm still vary, and is that variation the writer's rather than an imposed one?
7. Is the writer's structure intact, unless it was actively hurting the piece? If it was reorganized, is the reason stated in the What changed section?
8. Does anything read as flatter or more corporate than the input? Naming the flattest sentence in the output and comparing it to its source is a fast way to catch this.

## Fit and delivery checks

1. Does the format match the medium? A Slack message is a few casual sentences, not a memo with headers. A PR description is not an essay.
2. Does the text sound natural read aloud?
3. For short-form output, was the draft and audit kept internal so the user gets only the final text?
4. For Mode A long-form, does the output include the full rewrite plus a What changed section?
5. For Mode C, does the response name each pattern with a quoted line and a short fix, without rewriting, scoring, or claiming a machine wrote it?
