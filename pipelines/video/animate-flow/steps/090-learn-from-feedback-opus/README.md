# 090 · learn from the feedback · [OPUS]

Owner feedback on an animate cut becomes a rule for THIS recipe, so a correction given once
is never needed twice. Driven by the `yt-animate-feedback` skill; this file is the routing
authority.

```
node lib/run.mjs <slug> feedback-status     # pending items, exit 1 if any
```

**Recipe gate:** only workdirs whose `run-config.json` says `template: "animate"`.

## Where a lesson goes

| The lesson is about | It goes to |
|---|---|
| Which spans get a graphic, how many, how long | `TASTE-ANIMATE.md`, as a rule 030 reads |
| How a graphic is built or timed in this recipe | `TASTE-ANIMATE.md`, as a rule 040 reads |
| The look itself (a colour, a font, a motion rule) and the owner says it holds for this design system | `design-systems/<name>/DESIGN.md` of the run's system |
| Something a machine can state (a size, an overlap, a timing) | a check in `lib/review-frames.mjs` with a test, and the rule names it under `Enforced by:` |
| A wrong cut, a sync slip, a broken render | a code fix with a test (kit or this recipe), never a taste rule |

Never in scope: any other recipe's taste file, rulebook, prompts or skills. A lesson that
seems to belong there is raised with the owner, not written.

## Rule format (TASTE-ANIMATE.md)

```
## A<n> — <the rule, one line>

**From:** <slug> <version>, <date>. Owner: *"<their words, quoted>"*

<what was on screen, why it was wrong, the general form>

**Enforced by:** author judgement | <the check>
```

## Procedure

1. Read every pending item (`feedback-status`) and anything the owner said in chat.
2. Quote, do not paraphrase. One rejection is evidence about one graphic; a standing rule
   needs the owner saying so, or the same rejection three times.
3. Contradiction-check: grep `TASTE-ANIMATE.md` and the design system for a rule the new
   lesson would reverse; a conflict goes to the owner.
4. Fix this video (re-run 040 `--only` the moments concerned, then 050-070) and set
   `applied` on the item.
5. Write the rule, set `folded` on the item with where it went.
