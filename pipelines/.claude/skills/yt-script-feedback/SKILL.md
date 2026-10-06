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

Contents: Files this skill reads and writes · Hard gates · Phase 1 Ingest ·
Phase 2 Root cause · Phase 3 Discuss · Phase 4 Summary and approval ·
Phase 5 Execute · Anti-patterns · See also

Run everything from `pipelines/youtube/yt-script/`.

The owner reacts to an outline, a script plan, or a finished script. This skill
turns those reactions into **a fixed current video plus, sometimes, a durable
rule** — through a conversation, not a silent batch. The 130 step
(`steps/130-learn-from-feedback-llm/README.md`) stays the authority on *which
surface owns a lesson*; this skill owns the conversation around it and calls
that procedure as its execution phase. **Never restate 130's routing table
here — read it at execute time so the two cannot drift.**

Copy this checklist and tick it off:

```
- [ ] Hard gates checked
- [ ] Phase 1: all four sources read
- [ ] Phase 2: one line of RCA per item
- [ ] Phase 3-4: discussed; one summary sent; explicit approval received
- [ ] Phase 5: FEEDBACK-LOG rows written, node --test green, step re-run for <key>
- [ ] Report sent
```

If the owner pushes back on the summary, go back to Phase 3. If `node --test`
fails, fix and re-run before reporting.

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

Shared with `yt-video-edit-feedback`: read
[the feedback loop](../yt-video-edit-feedback/references/feedback-loop.md#hard-gates-check-before-anything). Same four gates,
same Opus-class rule.

## Phase 1 — Ingest (all four sources, always)

Never work from the loudest source alone; three of the four are silent.

| Source | How to read it | Notes |
|---|---|---|
| Chat feedback | this conversation | The loudest and the easiest to lose. Anything the owner said instead of writing it down. |
| The owner's own edits | `git diff -- pipelines/youtube/yt-script/videos/<key>/script-plan.md videos/<key>/script.md` | Gate 055 explicitly invites the owner to edit the file himself. The same KIND of hand-edit twice is a feedback item; one is an instance fix. |
| The desk's edited-line list | printed by step 090's `desk.mjs pull <key>` (`apps/yt-script-desk/bin/desk.mjs`) | Every line the maker overrode. Each is a place the plan and reality disagreed. Not owner feedback, but it is evidence about the plan. |
| `FEEDBACK-LOG.md` | read it in full | This is where repeat detection happens. Skipping it is how a third occurrence gets logged as a first. |

## Phase 2 — Root cause, not symptom

One line of RCA per item: the owner describes what he READ; the fold needs why
it came out that way. Then the recurring root-cause shapes in **this**
pipeline:

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

Follow [the feedback loop](../yt-video-edit-feedback/references/feedback-loop.md#phase-3--discuss). For the surface, 130's
table decides; for instance-vs-rule, say **why the promotion threshold says so**.

## Phase 4 — Summary and approval

Follow [the feedback loop](../yt-video-edit-feedback/references/feedback-loop.md#phase-4--summary-and-approval), with this table:

| # | What you said | `kind` | Root cause | Fix | Surface | Instance or rule? |
|---|---|---|---|---|---|---|

Two extra lines in this pipeline:

- **Rule promotions** — each citing the two `FEEDBACK-LOG.md` rows that
  triggered it, with the proposed `T<N>` text.
- **New `kind` tags requested** (if any) — its own line, because a new tag
  resets repeat detection.

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
- **Re-run the affected step for `<key>`** (the one whose output the fix
  changes; follow its `steps/<NNN>-*/README.md`, or `bash run.sh <key> vo` for
  the voiceover), so the current video carries the fix, not just the rule. If
  `node --test` fails, fix and re-run it before reporting.
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
