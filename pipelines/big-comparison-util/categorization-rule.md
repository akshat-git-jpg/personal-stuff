# Categorization Rule — Big Comparison Util

A grouping-and-ranking method for comparing many tools at once.

This is a **standalone rules doc**, not an installed skill — it won't trigger on
its own. Point Claude at this file along with a list of tools, e.g. "use the
categorization rule in big-comparison-util on these tools".

The core problem this solves: when someone hands over 10–20 tools, half of them
aren't actually competing with each other. Ranking them in one flat list is
meaningless. So first **bucket them into categories of like-for-like tools**,
crown a **winner inside each bucket**, and only then reason about a single
**overall winner** given the user's stated goal.

---

## Inputs

**Required**
- The list of tools/software to compare.

**Optional (ask for these — don't assume)**
- The **goal / use case** — what the user is actually trying to do or buy.
  This is the single most important input; "best" is meaningless without it.
- **Priorities** — which dimensions matter most (price? ease? power? ecosystem?).
- **Pre-set categories** — if the user already has buckets in mind.
- **Hard constraints** — budget cap, platform (Mac/Windows/Linux/web), team size,
  open-source-only, must-integrate-with-X, etc. These can eliminate tools outright.

If the goal and priorities aren't given, **ask once, briefly, up front.** Don't
ask a long questionnaire — one or two targeted questions, then proceed.

---

## Process

### Step 1 — Intake & frame
1. Echo back the full list so the user can confirm nothing's missing or duplicated.
2. Confirm the **goal/use case** and any **hard constraints** (ask if not given).
3. Note the count. If it's large (>12), warn that some buckets may end up with a
   single tool — that's fine, a lone tool in a bucket is its own winner by default
   but still gets evaluated against the goal.

### Step 2 — Research first
For each tool, do **web research before forming any opinion**:
- What it actually is and the primary job it does.
- Natural category / what it competes with.
- Key features and standout capabilities.
- Pricing model (free tier? subscription? one-time? usage-based?).
- Platform/availability and notable integrations.
- Known strengths and common complaints.
- Maturity (how established, how active, last meaningful update).

Keep a short, sourced fact sheet per tool. Cite where non-obvious claims come
from. Flag anything you couldn't verify rather than guessing.

### Step 3 — Propose categories, then confirm (HYBRID — do not skip the confirm)
1. From the research, derive a small set of **category buckets** that group
   like-for-like tools. Aim for tight, meaningful buckets, not one giant catch-all.
2. Assign each tool to a bucket. If a tool genuinely spans two categories, place
   it in its **primary** bucket and note the overlap — don't double-count it into
   the overall verdict twice.
3. **Present the proposed grouping to the user and pause.** Show it as a simple
   list (`Category → tools`). Invite them to rename, merge, split, move a tool,
   or add a category. Apply their edits before continuing.
4. Park anything that fits no bucket in an "Other / standalone" group and say so
   explicitly — never silently drop a tool from the input list.

### Step 4 — Set scoring dimensions & weights
Default dimensions (use these unless the user's goal implies others):
- **Capability / features** — how much it does, how well.
- **Pricing / value** — cost vs what you get.
- **Ease of use** — learning curve, setup, day-to-day UX.
- **Ecosystem / integrations** — plays well with the user's stack.
- **Support / docs / community** — can you get unstuck.
- **Reliability / maturity** — stability, track record, longevity risk.

Then **apply the user's priorities as weights.** If they said "price matters most,
I'm a solo dev," weight pricing and ease up, ecosystem down. State the weighting
you're using so it's transparent and they can correct it.

### Step 5 — Score within each bucket → category winner
Within each category only (apples to apples):
1. Score each tool on the weighted dimensions. Use the research; **override with
   the user's own inputs/experience when they conflict** — their lived input wins
   over a generic review, but note the disagreement.
2. Pick a **category winner** with a one-line rationale.
3. Name a **runner-up** and the one thing that would make someone pick it instead
   (e.g. "winner unless you're on a tight budget — then pick X").
4. Call out any tool that's clearly outclassed and could be dropped from consideration.

### Step 6 — Overall winner
Categories serve different needs, so "overall" must be tied to the user's goal:
1. Name a single **overall winner** — the best pick for the user's stated goal and
   priorities, with a clear "why this one" rationale.
2. Add **"best for X" picks** where it helps (best free option, best for teams,
   best for power users, best all-rounder). This is usually more useful than one
   blunt winner.
3. If a few tools together cover the goal better than any single one, say so
   (a recommended stack), but still give a single headline pick.
4. Be honest about ties and "it depends" — don't manufacture a winner where the
   evidence is genuinely even; instead give the deciding question.

### Step 7 — Output
Deliver in this order:
1. **One-line verdict** — the overall winner up top.
2. **Per-category sections** — each with a compact comparison table
   (tool × dimensions), the winner, and the runner-up note.
3. **Overall winner + "best for X" picks**, tied back to the goal/priorities.
4. **Assumptions & weighting used**, so the user can challenge them.
5. **Sources / confidence** — flag anything unverified.

---

## Output template

```
## Verdict: <overall winner> — <one-line why, tied to the goal>

### How I grouped them
- <Category A>: tool1, tool2, tool3
- <Category B>: tool4, tool5
- Other / standalone: tool6

### <Category A>
| Tool  | Capability | Value | Ease | Ecosystem | Support | Maturity |
|-------|-----------|-------|------|-----------|---------|----------|
| tool1 | ...       | ...   | ...  | ...       | ...     | ...      |
**Winner: tool1** — <why>. Runner-up: tool2 (<pick this instead if…>).

### <Category B>
... (same shape)

### Overall
- **Overall winner:** <tool> — <why, for this goal>
- Best free: <tool>   ·   Best for teams: <tool>   ·   Best all-rounder: <tool>

### Assumptions & weighting
- Goal: <...>  ·  Priorities/weights: <...>  ·  Constraints: <...>

### Confidence / sources
- <unverified or low-confidence claims flagged here>
```

---

## Rules of thumb
- **Never compare across buckets in a single table** — that's the whole point of grouping.
- **Never silently drop a tool** — every input tool lands in a bucket or in "Other".
- **Research first, user input overrides** — web facts set the baseline; the user's
  own experience and priorities reshape the ranking on top.
- **"Best" is always relative to the stated goal** — surface the goal in the verdict.
- **Confirm the grouping before scoring** — a wrong bucketing wastes the whole analysis.
- **Flag, don't fabricate** — unverified or "it depends" beats a confident wrong call.
