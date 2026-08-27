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
