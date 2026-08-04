---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["189 must land first — it creates the intro:<n> feedback keys this plan teaches the fold to ingest. Raised as PR #149."]
needs_prs: [149]
touches: [pipelines/.claude/skills/visuals-flow-feedback/SKILL.md, pipelines/video/visuals-flow/TASTE-INTRO.md, pipelines/video/visuals-flow/lib/intro-film/check-taste-intro.mjs, pipelines/video/visuals-flow/lib/intro-film/check-taste-intro.test.mjs, pipelines/video/visuals-flow/scripts/check.sh, pipelines/video/visuals-flow/steps/130-learn-from-feedback-opus/README.md]

mutation_apply: cd pipelines/video/visuals-flow && sed -i '' "1,/^\*\*From:\*\*/s/^\*\*From:\*\*/From-ish:/" TASTE-INTRO.md
mutation_command: cd pipelines/video/visuals-flow && node --test lib/intro-film/check-taste-intro.test.mjs
mutation_expect: missing a **From:** provenance line
mutation_timeout: 600
---

# Plan 190: visuals-flow — fold intro feedback into intro-owned rules, and keep them separate

## Summary

- **Problem statement**: Once plan 189 lets the owner pin timestamped comments on the intro film, that feedback has nowhere to go. The 130 fold's ingest table does not list the Intro tab, so intro notes are collected and then dropped. Worse, there is no rule about **where** an intro lesson may be written: the obvious-looking targets (`lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `card-library/DESIGN.md`) all belong to the body and the shared brand, and an intro lesson landing there would change what every non-intro video renders.
- **Goals**:
  - Add the Intro tab to the fold's ingest table so intro feedback is a first-class source, triaged like every other item.
  - Write the routing rule down: an intro-originated item's durable fix lands in `TASTE-INTRO.md` or the 025 `AUTHORING.md`, **never** in the body cue/zone rulebooks or `card-library/DESIGN.md`. And the reverse — body and final-cut feedback never edits `TASTE-INTRO.md`.
  - Make the intro rule file machine-checked, so a rule added during a fold is guaranteed to be well-formed and actually reachable by the author step.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner override on 2026-08-04 ("can we do all with agy"), applied to the whole 188–190 chain. The original proposal was `claude-p` / `sonnet`, on the reasoning that this is quality-setting rulebook and skill prose the owner judges by taste, which is exactly the `rules.md` row for claude-p/sonnet. That risk stands; what holds the line mechanically is `check-taste-intro.mjs` inside `scripts/check.sh` plus the armed mutation gate, both executor-independent.
- **Done criteria** (terse): fold skill lists the Intro tab as a source with its routing rule; `check-taste-intro.mjs` runs inside `scripts/check.sh` and enforces the T-rule shape; the separation rule is stated in both directions.
- **Stop conditions** (terse): editing `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs` or `card-library/DESIGN.md`; weakening a check to make it pass.
- **Test / verification for success**: unit tests over the new checker, armed with the mutation recipe above.
- **Open points for plan readiness**: none. 189 is raised as PR #149 and recorded in `needs_prs`, so dispatch refuses until it closes.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9d94b51b..HEAD -- pipelines/video/visuals-flow/TASTE-INTRO.md pipelines/.claude/skills/visuals-flow-feedback/SKILL.md`
> **This plan EXPECTS drift**: 189 must have landed. Confirm `appendIntroFeedback`
> exists in `lib/board.mjs`. If it does not, STOP — there are no intro feedback
> keys to fold yet.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW on code, MEDIUM on consequence — this plan decides where a whole class of future rule changes gets written. Getting the routing wrong means intro lessons silently reshaping body videos.
- **Depends on**: plan 189 (which depends on 188)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `9d94b51b`, 2026-08-04

## Why this matters

The owner's requirement, stated 2026-08-04: *"make sure its part of feedback loop
as well for feedback visual flow.., basically make this similar to final cut but
keep it guidelines/rules separate for intro"*.

The separation is the load-bearing half. The intro film is deliberately walled off
from the card system — `steps/025-author-intro-film-llm/AUTHORING.md` forbids the
author step from even *reading* `catalog.json` or any card, and enforces it with
`no-template-contamination.test.mjs`, because:

> The intro has full creative freedom. A catalog in scope quietly removes it — you
> would start picking rather than authoring.

A fold that answers an intro note by editing a body rulebook breaks that wall from
the other side. The intro already has its own rule file, `TASTE-INTRO.md`, with ten
numbered rules each carrying provenance and an "Enforced by" line. This plan makes
the fold use it, and only it.

## Current state

### The intro's own rule file

`TASTE-INTRO.md` at the pipeline root, 169 lines. Its shape (this is the format a
folded rule must match):

```markdown
## T1 — No floating labels. Enact instead.

**From:** poc-01 v2, 2026-08-02. Owner: *"also remove for who, looks weird."*

<the reasoning>

**Enforced by:** author judgement.
```

Rules run T1–T10. Each has a `**From:**` provenance line naming where it came
from, and an `**Enforced by:**` line saying whether a machine catches it. The
file's own header explains the contract:

> Every rule names where it came from, so it can be retired when its cause is
> gone rather than living forever by default.
> **Enforced by** tells you whether a machine will catch a breach.

**Two defects to fix while you are here**: the file's H1 reads `# TASTE.md` even
though the file is `TASTE-INTRO.md` and `AUTHORING.md` refers to it by the latter
name; and the rules are ordered T1–T7, T9, T10, T8 rather than numerically.

### The author step already reads it

`steps/025-author-intro-film-llm/AUTHORING.md`:

> ## Taste
> Read `TASTE-INTRO.md` at the visuals-flow root. It is the accumulated record
> of what the owner has rejected on screen, as numbered rules.

That reference is what makes a folded rule reachable. If it were ever dropped, new
rules would be written into a file nobody opens — which is the failure this plan's
checker guards against.

### The fold's ingest table, which is missing the intro

`pipelines/.claude/skills/visuals-flow-feedback/SKILL.md` carries a table of
feedback sources — board comments, implicit edits (`lib/edit-delta.mjs`), and the
run ledger (`lib/run-log.mjs`), each with a note on how to read it. There is no
Intro row. The skill also already states the discipline this plan extends:

> folding feedback into durable rules is judgment work
> **Instance fixes** — this video only, no rule.
> ### Architectural items → a plan, not a heroic inline fix

### Where intro feedback will live after 189

Plan 189 writes intro comments into the same `videos/<slug>/feedback.json`
`items` map used by final cut, under keys `intro:<n>`, with:

```
{ text, t, context: 'intro@MM:SS', x?, y? }
```

`context` is the discriminator: `final@…` vs `intro@…`.

## Commands you will need

```bash
cd pipelines/video/visuals-flow
bash scripts/check.sh                                    # merge gate
node lib/intro-film/check-taste-intro.mjs                # new checker, standalone
node --test lib/intro-film/check-taste-intro.test.mjs    # focused
```

## Scope

**In scope:**

- `pipelines/.claude/skills/visuals-flow-feedback/SKILL.md` — the Intro source row + the routing rule
- `pipelines/video/visuals-flow/TASTE-INTRO.md` — H1 fix, rule reordering, a short "how a folded rule is written here" note
- `pipelines/video/visuals-flow/lib/intro-film/check-taste-intro.mjs` — **new**
- `pipelines/video/visuals-flow/lib/intro-film/check-taste-intro.test.mjs` — **new**
- `pipelines/video/visuals-flow/scripts/check.sh` — one line wiring the checker in
- `pipelines/video/visuals-flow/steps/130-learn-from-feedback-opus/README.md` — name the intro routing

**Out of scope — do not touch, this is the entire point of the plan:**

- `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs` — body rulebooks
- `../card-library/DESIGN.md` — the shared brand contract, read-only from the intro
- `lib/intro-film/*` other than the new checker
- `board-ui/` — 189's territory

## Steps

### 1. Add the Intro tab to the fold's ingest table

In `SKILL.md`, add a row to the sources table matching the existing style:

| Source | How to read it | Why it matters |
|---|---|---|
| Intro film review (027) | `videos/<slug>/feedback.json` → `items` keys prefixed `intro:`; each carries `t` and `context: 'intro@MM:SS'` | The owner's timestamped notes on the intro film, watched in motion. Distinct from `final-*` items: an intro note is about the authored film, not the assembled cut, and it routes to a different rulebook (below). |

### 2. Write the routing rule down, in both directions

Add a short subsection to `SKILL.md` under the durable-fix discussion. State it
plainly — this is the rule a future session must not have to infer:

> **Intro items route to intro-owned rules.** A durable fix for an `intro:*` item
> is written to `TASTE-INTRO.md` (a new numbered `T<N>` rule) or to
> `steps/025-author-intro-film-llm/AUTHORING.md` when it changes the authoring
> contract itself. It is **never** written to `lib/cue-rules.mjs`,
> `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, or `../card-library/DESIGN.md`.
> Those govern the body and the shared brand; an intro lesson landing there
> changes what every non-intro video renders, which is the same wall
> `no-template-contamination.test.mjs` defends from the other side.
>
> **And the reverse:** body or final-cut items never edit `TASTE-INTRO.md`.
>
> **If an intro item genuinely implies a brand change** (a palette or type-scale
> rule in `DESIGN.md`), that is not an intro fold — surface it to the owner as its
> own decision, because it changes every card in the library.

### 3. New checker `lib/intro-film/check-taste-intro.mjs`

A folded rule is only worth writing if it is well-formed and reachable. Assert:

1. Every `## T<N> — <title>` heading has a `**From:**` line and an `**Enforced by:**` line before the next heading. Missing provenance is the failure the mutation arms — the message must contain `missing a **From:** provenance line`.
2. Rule numbers are unique and in ascending order.
3. `steps/025-author-intro-film-llm/AUTHORING.md` still contains the literal string `TASTE-INTRO.md` — a rule file the author step no longer references is a rule file nobody obeys.

Export a pure `checkTasteIntro({ taste, authoring })` returning
`{ ok, errors }` so it is unit-testable without the filesystem, plus a CLI entry
block in the same style as plan 188's (`process.exit(errors.length ? 1 : 0)`).

**Verify:** `node lib/intro-film/check-taste-intro.mjs` → exit 0, prints a one-line
summary naming the rule count.

### 4. Fix TASTE-INTRO.md's two defects

- H1 `# TASTE.md` → `# TASTE-INTRO.md`, so the file and its title agree and the AUTHORING reference is unambiguous.
- Reorder so T8 sits between T7 and T9 (it is currently last, after T10).
- Add two sentences under the existing "How a rule gets here" section: a folded rule is appended by the 130 fold, keeps the `From:` / `Enforced by:` shape, and cites the video and date it came from.

Do **not** reword or renumber the existing rules' content — they are the owner's,
and their numbers are cited elsewhere (`AUTHORING.md` references T5; this plan and
189 reference T9 and T10).

**Verify:** `node lib/intro-film/check-taste-intro.mjs` → exit 0; `rtk proxy grep -c "^# TASTE-INTRO.md" TASTE-INTRO.md` → 1.

### 5. Wire the checker into the gate

`scripts/check.sh` already runs the rulebook checks and prints lines like
`zone rulebook ok`. Add the new checker beside them, printing `intro taste ok`.

**Verify:** `bash scripts/check.sh 2>&1 | rtk proxy grep -c "intro taste ok"` → 1, and the
script still ends `visuals-flow check OK` with exit 0.

### 6. Name the routing in the 130 step README

`steps/130-learn-from-feedback-opus/README.md`: one short paragraph that intro
items route to `TASTE-INTRO.md` / the 025 authoring contract, and body items never
do. Point at the fold skill for the full rule rather than duplicating it.

**Verify:** `rtk proxy grep -c "TASTE-INTRO.md" steps/130-learn-from-feedback-opus/README.md` → ≥1.

### 7. Dry-run the mutation

```bash
cd pipelines/video/visuals-flow
sed -i '' "0,/^\*\*From:\*\*/s/^\*\*From:\*\*/From-ish:/" TASTE-INTRO.md
node --test lib/intro-film/check-taste-intro.test.mjs   # MUST fail with the expect string
git checkout TASTE-INTRO.md
node --test lib/intro-film/check-taste-intro.test.mjs   # MUST pass again
```

This mutation corrupts **data** (a provenance line in the rule file), not the
checker — which is what makes it a real proof the gate fires. If it does not fail,
the checker is not checking; fix the checker, never the recipe.

## Test plan

| Test | Where | Follows |
|---|---|---|
| a T-rule with no `**From:**` line fails with the expect string | `lib/intro-film/check-taste-intro.test.mjs` (new) | `lib/intro-film/check-film-style.test.mjs` |
| a T-rule with no `**Enforced by:**` line fails | same | same |
| out-of-order or duplicate rule numbers fail | same | same |
| authoring text lacking `TASTE-INTRO.md` fails | same | same |
| the real repo files pass | same | same |

Pass fixture strings into `checkTasteIntro()` directly — no filesystem, no temp
dirs — except the last case, which reads the two real files.

## Done criteria

1. `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, printing both `intro taste ok` and `visuals-flow check OK`.
2. `node --test lib/intro-film/check-taste-intro.test.mjs` → all pass.
3. The mutation dry-run fails with `missing a **From:** provenance line` and passes again after revert.
4. `rtk proxy grep -c "intro:" pipelines/.claude/skills/visuals-flow-feedback/SKILL.md` → ≥1 (the Intro source row exists).
5. `rtk proxy grep -c "never" pipelines/.claude/skills/visuals-flow-feedback/SKILL.md` shows the routing rule present in both directions — verify by reading the subsection, not by count alone.
6. `git diff --name-only` includes **none** of: `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, `card-library/DESIGN.md`.
7. **Batch-final fresh-checkout check.** This is the last plan of the 188→189→190 chain, so prove the whole chain works on a pristine tree, not one carrying your build artifacts:

   ```bash
   git clean -xdn pipelines/video/visuals-flow   # review what would be removed FIRST
   git clean -xdf pipelines/video/visuals-flow
   cd pipelines/video/visuals-flow && bash scripts/check.sh
   ```

   Must exit 0. `board-ui/node_modules` and `board-ui/dist` are gitignored, so this
   catches a check that only passed because a previous build left artifacts behind.

## STOP conditions

- **Any edit to `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, or `card-library/DESIGN.md`.** This plan exists to keep intro lessons out of those files; touching them here is self-defeating. Stop and report.
- Rewording or renumbering existing T-rules' content — their numbers are cited from `AUTHORING.md` and from plans 189/190.
- A check fails and the tempting fix is to soften the assertion. Fix the file or the checker; weakening the assertion is a STOP.
- The mutation does not make the test fail — the checker is not gating. Stop and report.
- `appendIntroFeedback` is absent from `lib/board.mjs` → 189 has not landed. Stop.

## Maintenance notes

- **This plan sets a precedent**: each review surface owns a rulebook, and the fold routes by the item's origin. If a third review surface appears (a conclusion film, say), it needs its own rule file and its own row, not a shared dumping ground.
- `check-taste-intro.mjs` enforces *shape*, not *quality* — it cannot tell a good rule from a bad one. The judgment stays with the Opus-class fold, as `TASTE-INTRO.md`'s own "Enforced by: author judgement" lines already concede.
- The `context: 'intro@MM:SS'` discriminator is the only thing distinguishing intro items from final-cut ones inside a shared `feedback.json`. If the fold is ever automated, that string is the routing key — keep it stable.
- Watch for the reverse leak too: a body rule that quietly assumes the intro carries cards. Plan 187's `introOwnedByFilm()` predicate is the existing guard; new body rules should route through it rather than testing run-config directly.
