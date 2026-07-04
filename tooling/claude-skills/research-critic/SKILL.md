---
name: research-critic
description: >-
  Adversarial review loop for research done in Claude Code: a fresh critic
  subagent red-teams the findings, spot-verifies load-bearing claims with its
  own lookups, and returns PASS / NEEDS-WORK / FAIL plus severity-tagged
  findings and tough questions; loops critique -> deeper research ->
  re-critique until PASS or a round cap. Triggers on "critique this research",
  "red-team these findings", "stress-test this", "ask the tough questions",
  "poke holes in this", "validate this research", "is this research solid",
  "/research-critic".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# research-critic

A tough editor that sits next to you and refuses to let weak research ship.
You drive the research the way you already do — CLI/MCP tools, web search, or
your own input. This skill runs the **adversarial review loop** around whatever
findings currently exist in the conversation.

The whole point is **isolation**: the critique runs in a *fresh subagent* that
has not watched you talk yourself into your conclusions. It cannot be charmed by
your own reasoning, so the questions have teeth.

You do NOT do the research inside this skill. You critique, checkpoint, then go
deeper. Repeat until the critic signs off.

## When to run

Run after a round of research exists in the conversation, or any time you want
the current findings stress-tested. Re-run it each round to advance the loop.

## The loop — one round

Run these steps in order. Use a TodoWrite item per step for a round.

### 1. Snapshot the findings

Gather the current research state from the conversation — every claim, the
sources/evidence behind it, and the conclusions drawn — and write it to a
scratch file so the critic gets a clean, complete picture instead of a
scrollback it has to reconstruct.

```
docs/research/<topic-slug>/round-<N>-findings.md
```

(`<topic-slug>` is a short kebab name for the research topic. `<N>` starts at 1
and increments each round.) The snapshot must be self-contained — the critic
subagent has none of this conversation's context.

Snapshot structure:

```markdown
# Research snapshot — <topic> — round <N>

## Question being researched
<the actual question / decision this research must answer>

## Claims & conclusions
- <claim 1> — evidence: <source/tool/reasoning>
- <claim 2> — evidence: ...

## Sources used
- <source> (primary/secondary, date, how it was obtained)

## Open questions I already know about
- ...

## What changed since last round (round 2+ only)
- <which blockers/majors were addressed and how>
```

### 2. Spawn the critic subagent

Use the **Agent** tool (`subagent_type: general-purpose`) with the adversarial
prompt below. Fresh, isolated context — do NOT summarize your own conclusions
for it beyond the snapshot file path. Let it form its own view.

Pass the critic:
- the path to `round-<N>-findings.md`,
- the round number and the round cap,
- permission to run its own web searches / CLI / MCP lookups to verify.

**Critic system prompt (paste into the Agent call, fill the brackets):**

> You are an adversarial research critic. Your job is to find what is wrong,
> thin, unsupported, or missing in a body of research — NOT to praise it. You
> have NOT seen the work that produced this; judge only what is written.
>
> Read the snapshot at `<path>`. Then:
>
> 1. **Identify the 2–3 load-bearing claims** — the ones that, if false, collapse
>    the conclusion. List them explicitly.
> 2. **Spot-verify those load-bearing claims yourself.** Run your own web
>    searches / CLI / MCP lookups. Do not trust the snapshot's sources at face
>    value — check whether they say what they're claimed to say, whether they're
>    primary, current, and not cherry-picked. Report what you actually found.
> 3. **Interrogate the rest**: unsupported assertions, logical leaps, confirmation
>    bias, survivorship bias, missing counter-evidence, undefined scope, stale
>    data, conflated correlation/causation, and the angles a smart skeptic would
>    raise that the research never addresses.
>
> Then return EXACTLY this structure:
>
> ```
> VERDICT: PASS | NEEDS-WORK | FAIL
>
> LOAD-BEARING CLAIMS (and verification result):
> - <claim> — [CONFIRMED / CONTRADICTED / UNVERIFIABLE] — <what you found, with source>
>
> FINDINGS:
> [BLOCKER] <finding — why it invalidates the conclusion as it stands>
> [MAJOR]   <finding — a serious gap/weakness that materially weakens it>
> [MINOR]   <finding — worth noting, does not block delivery>
>
> TOUGH QUESTIONS / MISSING ANGLES:
> - <question the research must answer to be trustworthy>
>
> ONE-LINE BOTTOM LINE: <should this be trusted yet, and why/why not>
> ```
>
> Rules: VERDICT is PASS only if there are zero BLOCKER and zero MAJOR findings.
> Be specific — quote the claim you're attacking. No vague "could be more
> thorough." If you verified something and it held up, say so plainly; don't
> manufacture problems. If you genuinely cannot find a real weakness in a claim,
> that is a valid and useful result.

### 3. Report to the main thread

When the critic returns, restate to the user in plain text (the user cannot see
subagent output):
- the **verdict**,
- **load-bearing claims** + verification result (call out any CONTRADICTED loudly),
- **findings grouped by severity**,
- the **tough questions**.

Then write your **proposed plan** to close every BLOCKER and MAJOR in the next
pass — concrete steps (which tool/search/source you'll use for each).

### 4. Checkpoint — wait for the user

Stop and let the user decide:
- **approve** the plan → go to step 5,
- **redirect** it → revise the plan, re-checkpoint,
- **deliver as-is** → go to "Finishing".

Do NOT start a deeper pass without the user's go.

### 5. Deeper research pass

Execute the approved plan — CLI/MCP/web/user input — to close the open BLOCKER
and MAJOR findings. Capture new evidence as you go. When done, increment `N` and
go back to step 1 for the next round (re-snapshot, re-critique).

## Finishing

End the loop when **any** of these is true:
- the critic returns **PASS** (no open blockers or majors), OR
- you hit the **round cap** (default **4**; the user may set another at invoke), OR
- the user says **deliver as-is**.

If you hit the cap with blockers/majors still open, do NOT claim it passed. Be
honest about what's unresolved.

Write the final deliverable to:

```
docs/research/<topic-slug>/RESULT.md
```

with these sections:

```markdown
# <topic> — vetted research result

## Status
<PASSED-CRITIQUE on round N | DELIVERED WITH OPEN ITEMS (cap reached) | DELIVERED AS-IS>

## The vetted findings
<the research as it stands after surviving the critique>

## Audit trail (why you can trust this)
### Round 1
- Verdict: NEEDS-WORK
- Challenged: <finding> [severity] -> Resolved by: <what you did / verified>
### Round 2
- ...

## Open items
- <minors that didn't block>
- <anything still unresolved at the cap, with its severity>
```

Then tell the user the file path and give a 2–3 line spoken summary: verdict,
how many rounds, what the critic killed or forced deeper, and anything still open.

## Principles

- **The critic is adversarial, not a cheerleader.** A round that finds nothing
  real is a valid PASS — but the default expectation is that round 1 finds
  something. If the critic keeps rubber-stamping, the snapshot is probably too
  thin or too flattering; fix the snapshot.
- **Verify the load-bearing claims, don't re-research everything.** Spot-checking
  what the conclusion rests on is what keeps the loop affordable and honest.
- **Severity drives the loop.** Only BLOCKER and MAJOR keep the loop running.
  MINOR is logged, never a blocker.
- **You stay the driver.** Every deeper pass is gated on the user's approval.
- **Never fake a PASS.** Hitting the cap with open blockers is delivered honestly,
  not dressed up.

## Example (compressed)

User has researched "is there demand for an ADHD wedding-planning checklist?"
using Pinterest + search data.

1. Snapshot → `docs/research/adhd-wedding-demand/round-1-findings.md`.
2. Critic subagent runs. Returns:
   - VERDICT: NEEDS-WORK
   - Load-bearing claim "high Pinterest save-velocity = buyer demand" —
     CONTRADICTED — saves correlate with aspiration, not purchase; found two
     niches with high saves and near-zero Gumroad conversion.
   - [BLOCKER] No evidence anyone *pays* for this, only that they save it.
   - [MAJOR] Sample is one platform; no search-volume or competitor-pricing data.
   - [MINOR] "ADHD" framing not validated against how the audience self-describes.
   - Tough Qs: what's the proven willingness-to-pay? who sells this today and at
     what price?
3. Report verdict + findings to user; propose: pull competitor Gumroad listings +
   pricing, check search volume, find one paid-conversion signal.
4. User approves.
5. Deeper pass closes the blocker (found 3 paid competitors + price band) and the
   major (added search-volume data). Round 2 critic → PASS.
6. `RESULT.md` written: PASSED-CRITIQUE on round 2, with the audit trail.
