# FEEDBACK-LOG.md

Every owner reaction to `yt-script` output, logged on arrival. One row per item,
newest last. This file is the **repeat-detection index**: two rows with the same
`kind` are what promotes a reaction into a `TASTE.md` rule.

`steps/130-learn-from-feedback-llm/README.md` owns the closed `kind` vocabulary
and the promotion threshold. Read it before adding a row; do not restate it here.

A row is never deleted. `promoted` records which rule it became, if any - a row
with no rule is the record of a reaction that was deliberately left as a one-off,
and that is a useful thing to know later.

## Rows

**Tag names are written bare here, never in backticks.** `test/feedback-surfaces.test.mjs`
fails if this file wraps a tag name in backticks, because step 130 is the only
file allowed to define the vocabulary and a backticked tag here reads as a second
definition.

| Date | Video | `kind` | What the owner said (verbatim) | Fixed in | Promoted |
|---|---|---|---|---|---|
| 2026-08-27 | vox-style-video-ai | gate-report | "going forward you can take the call whether a video is supposed to be a tutorial or comparison" | `steps/010-take-knowledge-llm/README.md`, `steps/020-approve-knowledge-human/README.md`, `OUTLINE-INSTRUCTIONS.md`, `yt-script/SKILL.md` | No T rule. Flow spec — decision rights, not taste. Owner asked for it standing ("going forward"), so it did not wait for a repeat. |
| 2026-08-27 | vox-style-video-ai | gate-report | "claude said 8 different tool stacks.. but claude never shared the details - it should give options for me to choose and i can combine and give entirely new approach" | `steps/010-take-knowledge-llm/README.md` (new `# Approaches` section), `steps/020-approve-knowledge-human/README.md` (the four-part gate message) | No T rule. Flow spec — what a gate must show. Owner asked for it standing ("it should give options"). |
| 2026-08-27 | vox-style-video-ai | structure | "pls have distinction between tutorial videos and comparison video throught out the skill and feedback.. so as to avoid any issues and degrading quality" | `SCRIPT-PLAN-INSTRUCTIONS.md`, `SCRIPT-INSTRUCTIONS.md`, `OUTLINE-INSTRUCTIONS.md`, `TASTE.md` (scoping table only), both `SKILL.md` files | No T rule. Format specs plus a scoping table in `TASTE.md`. T2–T5 were left verbatim; the table says how each reads in a tutorial. |
| 2026-08-27 | vox-style-video-ai | gate-report | "when you give approaches.. i would like youtube video name and channel name as well. i like some channels so i wll be able to decide approaches more better" | `steps/010-take-knowledge-llm/README.md` (new "Always fetch YouTube metadata" section), `videos/vox-style-video-ai/knowledge.md` (Sources table rebuilt, every approach and technique attributed by channel) | No T rule. Flow spec. Third row of this tag in one session — see the note below. |
| 2026-08-27 | vox-style-video-ai | structure | "i prefer longer videos without making audience bored. i prefre longer videos only. keep the entire flow interesting but always try to make as long video as possible." | `TASTE.md` T6, `OUTLINE-INSTRUCTIONS.md` (required `Target:` line and the section count that serves it) | **T6** — owner asked for it long-term, so it did not wait for a repeat |
| 2026-08-27 | vox-style-video-ai | gate-report | "dont' ask about credibilty. - assume that if its already propven by differnt videos given during knowldge base - then it can be done, no need to question it" | `steps/010-take-knowledge-llm/README.md` (new "Which gaps are worth asking" section) | No T rule. Flow spec. 4th row of this tag. |
| 2026-08-27 | vox-style-video-ai | evidence | "pls always assume that i know things. you can add claim about prior experince. assume i have explored tools for yeards and know my stuff. if i need to make changes in script - i will do during review." | `TASTE.md` T7 | **T7** — owner asked for it long-term. Raised against the "never invent facts" hard rule first; he reaffirmed, so T7 is scoped to claims about himself only. |
| 2026-08-27 | vox-style-video-ai | format | "i prefer outline to be proper table of contens... i prefer simple heading and symmetricall. it should be like a title... 'when it breaks' - thats a bad section name.. infact that should not be even a section name" | `OUTLINE-INSTRUCTIONS.md` (new "Section names" and "Never make a section out of failures" sections), `steps/030-write-outline-llm/README.md` | No T rule. Format spec — 130's table sends outline shape and section-line content to this file, never to `TASTE.md`. |
| 2026-08-27 | vox-style-video-ai | format | "i need more details what we are planning inside each section so that i can visualize.. make the outline little more detailed" | `OUTLINE-INSTRUCTIONS.md` rewritten to a contents-plus-cards shape; `test/desk-docs.test.mjs` re-pointed at the new boundary; `steps/030`, `steps/040`, `CLAUDE.md`, `SCRIPT-PLAN-INSTRUCTIONS.md`, `SKILL.md` de-referenced | No T rule. Format spec. **Removed a stated rule** — see the last note below. |
| 2026-08-27 | vox-style-video-ai | format | "i take back my call - we can have phrases in section name" | `OUTLINE-INSTRUCTIONS.md` "Section names" rewritten and the reversal recorded in place, `steps/030-write-outline-llm/README.md` | No T rule. Format spec. **Reverses a rule written the same day** — see the last note. |
| 2026-08-27 | vox-style-video-ai | jargon | "also need language to be simple day to day.. , intutive we use day to day.. no one uses ' The Music Bed' .." | `TASTE.md` T8, `OUTLINE-INSTRUCTIONS.md` (bad-name table), all eleven section names of `vox-style-video-ai` rewritten | **T8** — owner stated it as a general preference about language, not only about names, so it is taste and not only format |
| 2026-08-27 | vox-style-video-ai | structure | "remove 11,also was 10 present in refernce video? if not - lets remove that as well" | `OUTLINE-INSTRUCTIONS.md` (every tutorial section must trace to the chosen approach's own source; a plug is not a section), `videos/vox-style-video-ai/outline.md` (sections 10 and 11 cut, target 22 to 20 min), `knowledge.md` (affiliate moved to the CTA) | No T rule. Format spec — the scope rule already existed in `knowledge.md`'s CHOSEN block and was broken in the outline, so it is now stated where it gets broken. |
| 2026-08-27 | vox-style-video-ai | structure | "this is wrong. i am totally ok with comnbing approaches. i am giving you diff erent videos and selecting one approach doesn't mean we have to only do all things from that video.. keep the idea/approach of the selected approach but obsiosuly we can take ideas from all diff videos, knowdlget base and make our own combined way - thats obiosuly alloed.. you made opposidte rule.." | `OUTLINE-INSTRUCTIONS.md` (the source-fence rule replaced with spine-not-fence, plus the one honesty limit), `SCRIPT-PLAN-INSTRUCTIONS.md`, `SCRIPT-INSTRUCTIONS.md`, `knowledge.md` CHOSEN block rewritten, outline back to 12 sections | No T rule. Format spec. **Reverses the rule logged in the row above it, written minutes earlier.** |
| 2026-08-27 | vox-style-video-ai | structure | "i already said dont include don't include cost breadkdow and yt ban parts. those are just feedbacks for this topic, not general.." | `videos/vox-style-video-ai/outline.md` (costs section cut again, 12 sections to 11, target 22 min), `knowledge.md` (recorded under "Cut from this video by the owner — instance only, not a rule") | **Instance only. Deliberately no rule anywhere.** The owner named it as topic feedback, not a preference. |
| 2026-08-27 | vox-style-video-ai | tone | "my main goal of making all these scripts and videos is affiliate... Be genuine, be authentic. Obviously, don't oversell the tools. But keep that in mind that I want to get affiliate commissions... I want them to understand the benefit of these tools... It should be subtle, not oversell." | `TASTE.md` T9 | **T9** — owner asked for it standing ("always have that in mind"). First tone row. |
| 2026-08-27 | vox-style-video-ai | cta-placement | "from time to time, whenever we are giving CTA, we should mention link in description. Best buy link in description. Something like that." | `SCRIPT-INSTRUCTIONS.md` (new "CTA cadence" section), `SCRIPT-PLAN-INSTRUCTIONS.md` (new "Body CTAs" section) | No T rule. Format spec — cadence and placement, not taste. T9 covers everything between the mentions. |
| 2026-08-27 | vox-style-video-ai | tone | "Can you confirm if we use humanizer skill for all those writings inside the skill especially when writing the actual script... My script should not look AI generated, so use the humanizer skill" | `steps/050-write-script-draft-llm/README.md` (Mode B), `steps/100-write-script-llm/README.md` (Mode A), `SCRIPT-INSTRUCTIONS.md` (new "Reading as a human" section, pattern table, the pattern-28 conflict resolved), `SCRIPT-PLAN-INSTRUCTIONS.md`, `yt-script/SKILL.md` | No T rule. Process wiring, and it was simply missing — `humanizer` appeared **zero** times in the whole skill despite the owner's global rule listing video scripts under it. |
| 2026-08-27 | vox-style-video-ai | structure | "I was wondering if both of this can be done in parallel… merge the two steps" and "no instant live refresh required I can just refresh the browser" | `steps/055-review-plan-human/` (merged, renamed from `055-review-plan-md-human`), `steps/060-review-local-desk-human/` deleted, `test/steps.test.mjs` and `test/desk-docs.test.mjs` re-pointed, `SKILL.md` table and gate count, `CLAUDE.md` | No T rule. Flow spec — two gates became one. Five owner gates now, not six. |
| 2026-08-27 | vox-style-video-ai | claim-density | "I like to keep my script very simple and in human readable day-to-day language. Currently I feel that the script is too gibberish, too much is going on in a small frame of time, it doesn't look like our day-to-day language." | `SCRIPT-INSTRUCTIONS.md` (new "One sentence per line" section), `videos/vox-style-video-ai/script-plan.md` (all four verbatim beats rewritten) | No T rule. **The taste rules already existed** — T2 (short sentences) and T8 (everyday words). The session broke them, and the missing piece was a format convention nobody had written down: `EXAMPLE-SCRIPT.md` puts one sentence on each line. That is a format spec, so it went to the instruction file. |
| 2026-08-27 | vox-style-video-ai | pacing | "I like my sentences to be shorter and not too long. thats one feedback basically on the same line of when I said I like my script to be simple in simple language, easier to follow on the same line." | TASTE.md T10, steps/050 README (now required to read SCRIPT-INSTRUCTIONS.md too), SCRIPT-PLAN-INSTRUCTIONS.md pointer, two long sentences trimmed in the plan | **T10** - second reaction of this shape in a row, so the threshold fired. Also exposed a wiring bug: see the note below. |
| 2026-08-27 | vox-style-video-ai | structure | "there are multiple areas during our script where we are not even saying anything, we are just showing something on the UI... that doesn't come in the left side vertical timeline. It's confusing... I want to make a left side part like that where it's a section of just demo without voiceover" | New DEMO lane: `render-worksheet.mjs` LANE_RE, `lib/beats.mjs`, `SCRIPT-PLAN-INSTRUCTIONS.md`, desk `types.ts` / `WriteView.tsx` / `FullScript.tsx` / css, `demoLane.test.tsx` (8 tests), desk `CLAUDE.md`, and beat 1.1 of this video | No T rule. Format plus code. Bends the desk's two-track rule on purpose: a silent stretch is timeline content, not an instruction. |
| 2026-08-27 | vox-style-video-ai | format | "you have added this title for each section so beat. I don't like it. These are too confusing. I prefer that this heading should be the actual outline headings... you can keep that as intro as a heading and then you can just make it intro 1.1 intro 1.2" | `SCRIPT-PLAN-INSTRUCTIONS.md` (beat headings are labels), desk `WriteView.tsx` + `FullScript.tsx` (heading comes from the outline section, printed once per section), `outlineHeadings.test.tsx` (5 tests), all 56 labels in this video shortened | No T rule. Format spec plus code. **The real defect was worse than the titles:** the desk never rendered `beat.section` at all, so the owner's approved section names were invisible in the review tool. |
| 2026-08-27 | vox-style-video-ai | structure | "You said just watch this for a second and after that there is no demo section. Not sure what you are trying to do here... Is the sequencing wrong?" | `SCRIPT-PLAN-INSTRUCTIONS.md` (new ordering rule in the DEMO lane section, with a wrong/right table), `videos/vox-style-video-ai/script-plan.md` beats 1.1 and 1.2, `test/desk-docs.test.mjs` | No T rule. Format spec, and the gap was in a section written hours earlier the same day. The lane was specified as *where* it renders and never as *what that means for the words*: `DEMO` is pinned to the top of its beat, so every spoken line in that beat is heard after the silence. The session then wrote a forward-pointing tease into it. Owner chose "silence first, then talk" over splitting into two beats. |
## Notes on these first three rows

**gate-report is a new tag**, approved by the owner on 2026-08-27 in the Phase
4 summary, and added to step 130's vocabulary and to
`test/feedback-surfaces.test.mjs` in the same change. It exists because the
eleven original tags are all about the script — hook length, tone, pacing — and
these two items are about how a gate behaves. Forcing them into the structure tag
would have made two unlike items look like a repeat, which is exactly what the
threshold must not do.

**Step 130 gained a routing row in the same change**: how a step behaves routes
to that step's own README. Before it there was no surface for a lesson about
decision rights, only surfaces for wording, markup and code.

**Three gate-report rows arrived in one session, and they are one pattern.** All
three say the same thing: the session made or presented a decision with the
evidence stripped out — the format call turned into a question, eight approaches
flattened to eight names, then those approaches left anonymous. The tag's
threshold does not apply the way a taste tag's does: gate-report routes to a step
README, and a flow spec IS the durable fix, so there is nothing waiting on a
second occurrence. What the repeat does tell us is that brevity was the failure
mode every time, which is now written into step 010 as its own "do not": the
5-line cap is on the summary and on nothing else.

## The one-line-per-section cap was removed, not relaxed (2026-08-27)

`OUTLINE-INSTRUCTIONS.md` and `steps/030-write-outline-llm/README.md` both opened
on *"One line per section. Never two."*, and `test/desk-docs.test.mjs` asserted
it. The step followed it exactly and produced a document the owner could not
picture. He asked for cards.

**This is the first fold that deleted an existing rule rather than adding one, so
the reasoning is recorded here.** The rule was a proxy. What actually separates
`outline.md` from `script-plan.md` is spoken copy and parsed lanes; a line count
was standing in for that, and it failed in the safe-looking direction by making
the document too thin to approve. The test now guards the real boundary: no
spoken copy, no lanes, no prose paragraph under a heading, and a hard cap of six
bullets per card.

**What did not change:** every ban that made the outline cheap. If a future
session finds a card carrying a `SAY` lane, or a sentence the maker would read
aloud, that is the same failure the deleted rule was aimed at, and the test still
catches it.

## Two T rules landed in one batch (2026-08-27)

T6 (length) and T7 (assume the owner's expertise) were both written on a first
occurrence, on the explicit-ask path rather than the repeat path — the owner said
*"only if you are sure - accomodate the changes long term in feedback"* and then
confirmed both. Neither waited for a second row.

T7 is worth re-reading before it is ever widened. It sits against the skill's
hard rule that claims come from `knowledge.md` and nowhere else, so it is scoped
to claims about the owner himself and stays that way. The conflict was raised
with him before the rule was written, and he reaffirmed it; that exchange is why
the rule names its own scope twice.

## A rule written this morning was reversed this afternoon (2026-08-27)

The owner asked for section names that were *"simple heading and symmetricall…
like a title"*. That became a rule requiring a noun phrase of two to five words,
Title Case, no `When`/`Why`/`What` clauses, and one grammatical shape across the
whole outline. Followed exactly, it turned all eleven sections of
`vox-style-video-ai` into `The <Noun>` and produced `The Music Bed`, `The Motion
Pass`, `The Final Stitch` and `The Narrator Audition`. He reversed it the same
day: *"i take back my call - we can have phrases in section name"*, with
*"no one uses ' The Music Bed'"* as the example.

**Why it went wrong, and it is worth remembering.** The rule specified a
grammatical *shape*, and a shape can be satisfied by jargon — in fact jargon is
the easiest thing to fit into one, because industry terms are already compact
noun phrases. So the rule did not merely fail to prevent jargon; it selected for
it. T8 replaces the shape requirement with a spoken test, which no jargon passes.

**The general shape of this mistake:** a preference stated as a *feeling* ("simple
and symmetrical") was written down as a *mechanism* (noun phrase, N words, Title
Case). The mechanism was checkable and the feeling was not, so the mechanism won
and the feeling was lost. Where a taste item resists mechanisation, the rule
should say how to judge it, not what shape it takes — `TASTE.md` T1 already
implies this and this is the first concrete instance of it.

**Two rows, one lesson.** The reversal is logged as a format row and the plain-
language preference as a jargon row, because they are genuinely two things: what
a section name is *allowed* to be, and which words may appear anywhere in the
script. Collapsing them into one row would have hidden the second behind the
first.

## Not every reaction wants a rule (2026-08-27)

The costs and platform-risk sections were cut from `vox-style-video-ai` twice.
The first time, the session read *"was 10 present in refernce video?"* as a
principle and wrote a rule banning material from unchosen approaches. The owner
reversed that. The second time it read the same instruction correctly:

> *"those are just feedbacks for this topic, not general.."*

**A reaction to one video's content is usually not a preference about all
videos.** "I do not want a costs section in this video" and "I never want a costs
section" are different statements, and only the owner knows which he means. Where
he does not say, the answer is the instance fix plus a log row - which is what the
threshold in `steps/130-learn-from-feedback-llm/README.md` has always said, and
what got skipped here.

**The tell:** if the reaction names *this topic, this tool, this section*, it is
probably an instance. If it names *how you work, what you always do, what you
should never ask* - the way T6, T7 and T8 all do - it is probably a rule. When
both readings are live, ask; the owner answered this one before being asked, twice.
