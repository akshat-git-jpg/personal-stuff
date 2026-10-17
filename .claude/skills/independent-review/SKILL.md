---
name: independent-review
description: >-
  Use when the owner wants an outside opinion on a problem, plan, design or decision
  before acting - "get an independent review", "subagent review", "second opinion",
  "get a second subagent to review", "review this independently", "don't cloud its
  judgement", "is this worth building", "is our approach the best". Runs a fresh
  subagent that answers the problem blind first, then critiques our proposal.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# independent-review

A fresh subagent answers the owner's problem **on its own first**, writes that answer
to a file, and only then reads our proposal and critiques it. The blind answer is the
point: a reviewer that sees our plan first anchors on it and only polishes it.

## Steps

1. **Collect the brief.** Write `$TMP/review/brief.md` (`$TMP` is `$CLAUDE_JOB_DIR/tmp`
   when set, else a new `mktemp -d`). It holds only:
   - The owner's problem **in the owner's own words**, quoted from the conversation.
   - Facts: the files, paths, commands, numbers and constraints that are true today.
     Paths, not pasted file dumps; the reviewer reads them itself.
   - The owner's questions (default: "Is this worth solving? What is the best
     solution? What would you change?").

   It must NOT hold our plan, our option names, our leaning, or words like
   "we decided" / "the proposal". Reread it once for leaks before step 3.
2. **Write the proposal** to `$TMP/review/proposal.md`: our plan as it stands, with
   the decisions already taken and why.
3. **Spawn the reviewer** with the Agent tool: `subagent_type: general-purpose`,
   never `fork` (a fork inherits this whole conversation, which is the bias we are
   avoiding). Prompt: [references/reviewer-prompt.md](references/reviewer-prompt.md),
   filled in with the folder and the two paths.
4. **Check the reply before showing it.** It must have the file
   `$TMP/review/blind.md` written before `critique.md`, and `critique.md` must have
   every section of the output shape with at least one concrete finding or an explicit
   "none, because ...". Missing or empty: `SendMessage` the same agent, "Your reply has
   no findings. Fill <section> per the output shape." Do not start a new agent.
5. **Report to the owner**, in the owner's reply style:
   - Verdict in one line: worth solving or not.
   - Where the blind answer and our plan **agree** (one line) and **differ** (each
     difference, with the reviewer's reason).
   - Keep / change / drop list, each item with your own short view: agree or disagree
     and why. The reviewer advises; the owner decides.
   - Path to `critique.md` for the full text.

   Never apply a reviewer suggestion before the owner picks.

## Rules

- **Blind first, always.** The reviewer never sees `proposal.md` until `blind.md`
  exists. Never paste the proposal into the spawn prompt.
- **The owner's words, not a summary.** Summaries carry our framing. Quote.
- **One reviewer per question.** For a second angle (for example, the defects in a
  plan the owner already accepted), spawn a second fresh reviewer with its own brief;
  do not reuse the first one, which now knows our plan.
- **Defect review is different.** When the owner already chose the design and only
  wants bugs found, skip the blind step: give the reviewer the plan or diff and ask for
  defects ranked by harm, each with a concrete failure scenario.
