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
