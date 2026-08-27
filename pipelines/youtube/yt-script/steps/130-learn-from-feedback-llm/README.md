# 130 - learn from the feedback

**[LLM]** &nbsp; Routes each owner reaction to the one surface that owns it.

The fold. Owns the surface-routing table - which file a lesson goes into - and the
promotion threshold that decides whether a reaction is an instance fix or a
standing rule. Run by the `yt-script-feedback` skill after the owner approves its
Phase 4 summary; never run mid-flow on another video. Added 2026-08-26.

**Reads:** `FEEDBACK-LOG.md`, `TASTE.md`

**Writes:** `TASTE.md`, `FEEDBACK-LOG.md`

---

## This file is the authority on routing

The `yt-script-feedback` skill owns the conversation. This file owns **where a
lesson lands**. The skill reads this table at execute time and never copies it,
so the two cannot drift.

## The surface-routing table

| The lesson is about | Surface | File |
|---|---|---|
| A parsed lane form the desk reads (`SAY`/`SHOW`/`EDIT`/`FACTS`, a table, a proof insert) | format spec | `SCRIPT-PLAN-INSTRUCTIONS.md` |
| The one-page outline's shape, length or what a section line may contain | format spec | `OUTLINE-INSTRUCTIONS.md` |
| The final script's format, the VO checklist, `respell.json`, `script.json` | format spec | `SCRIPT-INSTRUCTIONS.md` |
| What the script SAYS or how it SOUNDS - wording, register, a phrase to stop using, how a claim is framed, running-order preference | taste | `TASTE.md` |
| One video only, no pattern yet | nothing durable | the video's own file, plus a `FEEDBACK-LOG.md` row |
| A parser bug, a broken command, a missing tool | code | a plan in `plans/` via the `orchestrate` skill |
| How a STEP behaves — what it decides on its own vs. asks the owner, and what a gate must put in front of him | flow spec | that step's own `steps/NNN-*/README.md` |

**A format spec and a taste rule are not the same kind of thing and never share a
file.** `lib/beats.mjs` parses the exact forms in
`SCRIPT-PLAN-INSTRUCTIONS.md`, and an unrecognised form falls through to plain
prose **silently**. A preference sitting next to a parsed form invites the next
session to "enforce" the preference by inventing a lane, which produces a worse
document that looks fine at a glance.

**And the reverse:** a genuine format fix never becomes a `T` rule. A `T` rule is
judgement; a format rule is a contract with a parser.

**A flow spec is a third kind again.** It governs neither wording nor markup but
**decision rights** — which calls a session makes on its own, and what a gate
must show the owner so his call is an informed one. It lands in the step's own
README because that is the only file the session running that step is required
to read. Added 2026-08-27, when the owner found that step 010 had turned "is
this a tutorial or a comparison?" into a gap question, and had compressed eight
candidate approaches into one line each before asking him to pick one.


## The `kind:` vocabulary is closed

Every `FEEDBACK-LOG.md` row carries exactly one `kind`. The list is closed on
purpose - repeat detection is a string match, not a judgement, so the threshold
cannot drift session to session.

| `kind` | Covers |
|---|---|
| `hook-length` | the cold open's length or how fast the hook lands |
| `filler-phrase` | a stock phrase to stop using |
| `section-order` | the running order of sections or beats |
| `claim-density` | how many claims a beat carries |
| `cta-placement` | where a call to action sits |
| `tone` | register, formality, how confident a verdict reads |
| `pacing` | beat length, breath, sentence length |
| `jargon` | a term used without explaining it |
| `structure` | part or section shape beyond simple order |
| `evidence` | how a claim is backed or attributed |
| `format` | a parsed form or markup - routes to an INSTRUCTIONS file, never to `TASTE.md` |
| `gate-report` | what a gate puts in front of the owner, and which calls the session makes instead of asking - routes to a step README, never to `TASTE.md` |

**Adding a tag needs the owner's approval**, in the Phase 4 summary, as its own
line. A new tag resets repeat detection for everything it absorbs, so it is a
real decision and not housekeeping.

## The promotion threshold: repeat first, log once

1. **Every item gets a `FEEDBACK-LOG.md` row immediately**, and the current
   video gets fixed. That happens on the first occurrence, always.
2. **A standing `TASTE.md` rule needs a second item with the same `kind`** - or
   the owner explicitly saying "make this a rule".
3. On the second one, say so plainly: *"this is the second `filler-phrase` item -
   promote to a rule?"* and cite both rows. Then wait.

Why the threshold exists, in the owner's words (2026-08-26): *"I don't want to
limit the creativity of the script writing, but I want slowly and slowly for this
skill to be able to learn my preferences."* A rulebook that grows on every
reaction eventually specifies the script and there is nothing left to write. One
reaction is a mood; two is a preference.

**Never promote silently.** A rule the owner did not approve is a rule he will
find later by wondering why the scripts got narrower.

## Writing a `TASTE.md` rule

Append. Never renumber, never delete - retire in place, so the reason a rule
existed survives the rule.

```markdown
## T<N> — <the rule, one line, imperative>

**From:** <video key>, <YYYY-MM-DD>. Owner: *"<verbatim quote>"*

<Two to four sentences: what actually happened, and why the rule follows.>

**Applies to:** <step numbers, e.g. 050, 100>
**Enforced by:** <the machine check that catches a breach> | author judgement
```

All four parts are required and `test/feedback-surfaces.test.mjs` checks them.

- **`From:` must quote the owner verbatim.** A paraphrase loses the thing that
  lets a future reader judge whether the rule still applies.
- **`Applies to:` is not optional.** This pipeline has three writing steps (030,
  050, 100). A rule about outlines read at script-finalise time is noise.
- **`Enforced by:` tells you whether a machine will catch a breach.** Where it
  says *author judgement*, nothing stops the mistake recurring except reading
  the file. Say so honestly rather than claiming a check that does not exist.

## Do not

- Run this mid-flow on another video. Rule surfaces change between videos, never
  during one.
- Fold an item the owner did not approve in the Phase 4 summary.
- Write a rule with no quote. If you cannot quote it, ask.
- Move a rule between `TASTE.md` and an INSTRUCTIONS file to "tidy up". The
  routing table above decides once.
