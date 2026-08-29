---
name: yt-script-feedback
description: >-
  Close the loop on owner feedback about yt-script output: ingest every source,
  root-cause each item, discuss, then ONE summary for approval before any file
  changes. Wraps the 130 fold step. Turns repeated reactions into TASTE.md rules
  so the skill learns how the owner likes his scripts written. Triggers on
  "script feedback", "fold my script feedback", "I'm done reviewing the script",
  "feedback on the outline", "make this a rule", "/yt-script-feedback".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# yt-script-feedback — the feedback conversation

Run everything from `pipelines/youtube/yt-script/`.

The owner reacts to an outline, a script plan, or a finished script. This skill
turns those reactions into **a fixed current video plus, sometimes, a durable
rule** — through a conversation, not a silent batch. The 130 step
(`steps/130-learn-from-feedback-llm/README.md`) stays the authority on *which
surface owns a lesson*; this skill owns the conversation around it and calls
that procedure as its execution phase. **Never restate 130's routing table
here — read it at execute time so the two cannot drift.**

## The files this skill reads and writes

| File | Role |
|---|---|
| `steps/130-learn-from-feedback-llm/README.md` | The routing table, the closed `kind` vocabulary, the promotion threshold. Authority — read it, do not paraphrase it. |
| `TASTE.md` | Numbered, dated taste rules. Written only on the second `kind` repeat, or an explicit owner ask. |
| `FEEDBACK-LOG.md` | Every reaction, logged on arrival, tagged with a `kind`. The repeat-detection index. |

None of the three owner-owned instruction files
(`OUTLINE-INSTRUCTIONS.md`, `SCRIPT-PLAN-INSTRUCTIONS.md`,
`SCRIPT-INSTRUCTIONS.md`) is edited by this skill directly — a format-shaped
item routes to one of them per 130's table, but that edit is the owner's
call to approve in Phase 4 like any other.

## Hard gates (check before anything)

1. **Opus-class only.** Folding feedback into durable rules is judgement work —
   the sibling skill's owner decision, 2026-07-18, applies here too. If the
   current session is not Opus-class, say so and stop.
2. **Never skip the discussion.** Phases 2–4 are the point of this skill. Do not
   jump from "here's my feedback" to editing files, however obvious a fix looks.
3. **One approval gate, and it is explicit.** No file changes before the owner
   approves the Phase 4 summary. "Sounds good" on a single item is not approval
   of the batch.
4. **Never fold mid-flow on another video.** Rule surfaces change between
   videos, never during one.

## Phase 1 — Ingest (all four sources, always)

Never work from the loudest source alone; three of the four are silent.

| Source | How to read it | Notes |
|---|---|---|
| Chat feedback | this conversation | The loudest and the easiest to lose. Anything the owner said instead of writing it down. |
| The owner's own edits | `git diff -- pipelines/youtube/yt-script/videos/<key>/script-plan.md videos/<key>/script.md` | Gate 055 explicitly invites the owner to edit the file himself. The same KIND of hand-edit twice is a feedback item; one is an instance fix. |
| The desk's edited-line list | printed by `node bin/desk.mjs pull <key>` at step 090 | Every line the maker overrode. Each is a place the plan and reality disagreed. Not owner feedback, but it is evidence about the plan. |
| `FEEDBACK-LOG.md` | read it in full | This is where repeat detection happens. Skipping it is how a third occurrence gets logged as a first. |

## Phase 2 — Root cause, not symptom

One line of RCA per item: the owner describes what he READ; the fold needs why
it came out that way. Then the recurring root-cause shapes in **this**
pipeline:

- **A `SAY` lane written as finished copy.** A body beat's `SAY` is a draft
  prompt. Polished prose there collapses the plan into a duplicate of the
  script — and it is enforced by `BODY_DRAFTS_ARE_INSTRUCTIONS` in
  `lib/beats.mjs`, so if the owner saw it, check whether the form parsed at
  all.
- **An unrecognised lane form falling through silently.** `lib/beats.mjs`
  recognises the exact forms in `SCRIPT-PLAN-INSTRUCTIONS.md`; anything else
  becomes plain prose with no error. "This beat lost its instructions" is
  usually this, not a writing failure.
- **A gap that was never answered at gate 020.** A claim with no support in
  `knowledge.md` traces back to a gap question the owner skipped. The fix is
  upstream, not in the wording.
- **A rule that exists but in the wrong file.** Check `TASTE.md` and all three
  instruction files before concluding a preference was never recorded.
- **The instruction file is stale.** `SCRIPT-INSTRUCTIONS.md` still describes
  parts of the pre-2026-08-23 flow. A step following it faithfully can produce
  something the owner does not want.
- **A comparison rule applied to a tutorial, or the reverse.** Check
  `outline.md`'s `Format:` line first. `TASTE.md`'s tutorial/comparison table
  and the fork rows in `SCRIPT-PLAN-INSTRUCTIONS.md` and
  `SCRIPT-INSTRUCTIONS.md` exist because T3–T5 were seeded from comparison
  scripts. A tutorial that grew a scorecard, or a comparison with no verdicts,
  is almost always this and not a writing failure.
- **A gate that asked instead of deciding, or decided without showing its
  work.** Step 010 owns the format call and the `# Approaches` menu; step 020's
  README lists the four parts its gate message must carry. "I could not choose
  from what you gave me" routes here, with `kind` gate-report.

## Phase 3 — Discuss

Answer the owner's questions directly — they are part of the deliverable, not
noise around it. Then per item, bring:

- the root cause in one sentence;
- the surface you propose (130's table decides);
- whether it is instance or rule, and **why the threshold says so**;
- anything you cannot fix and why.

Surface conflicts between two owner instructions; never resolve one
unilaterally.

## Phase 4 — Summary and approval

One message, one table:

| # | What you said | `kind` | Root cause | Fix | Surface | Instance or rule? |
|---|---|---|---|---|---|---|

Then, separately and plainly:

- **Rule promotions** — each citing the two `FEEDBACK-LOG.md` rows that
  triggered it, with the proposed `T<N>` text.
- **Instance fixes** — this video only, no rule.
- **New `kind` tags requested** (if any) — its own line, because a new tag
  resets repeat detection.
- **Routed to a plan** — architectural or code items, via `orchestrate`.
- **Not fixing** — with reasons.
- **Open questions** — anything still blocking.

End by asking for approval to proceed. Stop. Do not edit files yet.

## Phase 5 — Execute (only after approval)

Follow `steps/130-learn-from-feedback-llm/README.md` for routing and the rule
format. On top of it:

- **Write the `FEEDBACK-LOG.md` row for every item**, including the ones that
  stayed instance fixes. A missing row means the next occurrence reads as a
  first occurrence and the threshold never fires. This is the split-brain
  failure the sibling skill records at test-01: a board showing green while
  the gate stayed red.
- **Then run the gate**: `cd pipelines/youtube/yt-script && node --test test/*.test.mjs`.
  `test/feedback-surfaces.test.mjs` checks the rule shape and that the
  vocabulary has not drifted.
- **Report** what changed, what stayed an instance fix, and what you
  deliberately did not do.

## Anti-patterns

- Reading the chat and skipping the other three sources.
- Treating three occurrences of one preference as three one-off complaints.
- Promoting a rule the owner did not approve in the Phase 4 summary.
- Writing a rule with a paraphrase instead of the owner's words.
- Appending a taste preference into `SCRIPT-PLAN-INSTRUCTIONS.md` because it
  "feels like a rule" — that file is parsed.
- Marking an item fixed without a `FEEDBACK-LOG.md` row.
- Inventing a new `kind` to make two unlike items look like a repeat.

## See also

- `pipelines/.claude/skills/yt-script/SKILL.md` — the flow this skill's feedback
  is about.
- `pipelines/.claude/skills/yt-video-edit-feedback/SKILL.md` — the sibling this
  skill's shape is modelled on, for a different pipeline. Read it, do not edit
  it from here.
