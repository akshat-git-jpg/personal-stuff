---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/youtube/yt-script && node --test test/*.test.mjs
ui:
deploy:
needs: ["PR #213 (plan 252) must land first — both plans edit pipelines/.claude/skills/yt-script/SKILL.md's step table and file table"]
needs_prs: [213]
touches: [pipelines/.claude/skills/yt-script-feedback/SKILL.md, pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/step.json, pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/README.md, pipelines/youtube/yt-script/TASTE.md, pipelines/youtube/yt-script/FEEDBACK-LOG.md, pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs, pipelines/.claude/skills/yt-script/SKILL.md, pipelines/youtube/yt-script/CLAUDE.md, decisions.md]

mutation_apply: |
  perl -pi -e 's/^\*\*Enforced by:\*\*.*\n//' pipelines/youtube/yt-script/TASTE.md
mutation_command: cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs
mutation_expect: "TASTE_RULE_MALFORMED"
mutation_cwd:
mutation_timeout: 600
---

# Plan 253: The `yt-script-feedback` skill — learn the owner's script preferences

## Summary

- **Problem statement**: The owner's reactions to `yt-script` output live only in
  chat. Every session starts from the same instruction files and re-earns the
  same corrections, and nothing accumulates. The sibling pipeline solved this
  (`yt-video-edit-feedback` + step 130 + `TASTE-INTRO.md`); `yt-script` has no
  equivalent, so a preference stated three times has been stated three times and
  changed nothing.
- **Goals**:
  - A new skill `yt-script-feedback` running the five-phase feedback
    conversation, modelled on `yt-video-edit-feedback`.
  - A new step `steps/130-learn-from-feedback-llm/` that owns the
    **surface-routing table** — the single authority on which file a lesson goes
    into. The skill reads it at execute time and never restates it.
  - `TASTE.md` — numbered, dated taste rules, each quoting the owner verbatim.
  - `FEEDBACK-LOG.md` — every item logged on arrival, tagged from a **closed
    vocabulary**, which is what makes repeat detection mechanical.
  - `test/feedback-surfaces.test.mjs` — a real gate over the rule format, the tag
    vocabulary and the no-drift rule.
- **Decisions confirmed**:
  - Where learned preferences live -> a **new numbered `TASTE.md`**, separate
    from the three instruction files. Taste and parsed format must not mix in one
    file (rejected: appending preferences into
    `OUTLINE-INSTRUCTIONS.md` / `SCRIPT-PLAN-INSTRUCTIONS.md` /
    `SCRIPT-INSTRUCTIONS.md`).
  - Home for the routing table -> a **new step folder** `130-...-llm`, because
    `test/steps.test.mjs` then machine-enforces it and it mirrors visuals-flow
    (rejected: the table inside the skill only, which no test can see).
  - Promotion threshold -> **repeat first, log once.** Every item is logged and
    fixed for the current video immediately. It becomes a standing `T<N>` rule
    only on the second item with the same `kind`, or when the owner says "make
    this a rule" (rejected: fold every approved item into a rule immediately).
  - Repeat detection -> a **closed `kind:` vocabulary**, so the trigger is
    mechanical rather than a fresh judgement each session (rejected: LLM
    judgement per run).
  - Step 130 is an `llm` step, **not** a gate. The owner gate count stays six,
    and `steps.test.mjs`'s `Six owner gates:` assertion is unchanged.
- **Executor proposed**: `claude-p` / Sonnet. `tooling/boss/data/rules.md` routes
  quality-setting content the owner judges by taste — rulebooks, prompts, prose —
  to claude-p/sonnet rather than the agy default. This plan authors a SKILL.md, a
  routing table and a rulebook seed; that is exactly that row.
- **Done criteria** (terse): the yt-script suite green including the new
  `feedback-surfaces` tests, the skill symlinked and loading, and the routing
  table present in step 130 and absent from the skill.
- **Stop conditions** (terse): any `steps.test.mjs` failure, any edit to a
  `videos/*/script-draft.md`, any TASTE rule invented rather than quoted, any
  change to the `Six owner gates:` sentence.
- **Test / verification for success**: `test/feedback-surfaces.test.mjs`, with an
  armed mutation gate proving the rule-format check can actually fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d923b178..HEAD -- pipelines/youtube/yt-script pipelines/.claude/skills`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plan 252, PR #213 (boss refuses to dispatch until it closes)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `d923b178`, 2026-08-26

## Why this matters

The owner's ask, verbatim: *"I want slowly and slowly for this skill to be able
to learn my preferences and to be able to learn how I like to make my scripts.
Do note that I don't want to limit the creativity of the script writing."*

Those two halves pull against each other, and the design has to hold both. A
rulebook that grows on every reaction eventually specifies the script, and then
there is nothing left to write. A rulebook that never grows learns nothing. The
resolution is the threshold: **one reaction is an instance fix, two of the same
kind is a rule.** That is why the `kind:` vocabulary is closed — a mechanical
trigger cannot quietly drift toward "fold everything", and it cannot quietly
drift toward "fold nothing" either.

The sibling pipeline already proved the shape works. `visuals-flow` accumulated
`TASTE-INTRO.md` from owner reactions to cuts, with each rule recording its
source quote and whether a machine enforces it; decisions.md 2026-08-02 records
why: *"owner feedback becomes rules, not chat."*

## Current state

### The precedent to follow

`pipelines/.claude/skills/yt-video-edit-feedback/SKILL.md` (12.2K). Its shape,
which this plan copies:

- **Hard gates** checked before anything: Opus-class only; never skip the
  discussion; one explicit approval gate; never edit rule surfaces mid-run of
  another video.
- **Phase 1 Ingest** — a table of every source, with the note that most are
  silent and reading only the obvious one is the anti-pattern.
- **Phase 2 Root cause** — one line of RCA per item, plus a list of recurring
  root-cause shapes in that pipeline.
- **Phase 3 Discuss** — answer the owner's questions directly; surface conflicts
  rather than resolving them unilaterally.
- **Phase 4 Summary** — one message, one table, then approval. Stop.
- **Phase 5 Execute** — only after approval, following the 130 step's routing.
- **Anti-patterns** — a closing list.

Its load-bearing sentence about drift, which this plan mirrors:

> The 130 step (`steps/130-learn-from-feedback-opus/README.md`) stays the
> authority on *which surface owns a lesson*; this skill owns the conversation
> around it and calls that procedure as its execution phase. **Never restate
> 130's surface-routing table here — read it at execute time so the two cannot
> drift.**

### The TASTE rule format to match

From `pipelines/video/visuals-flow/TASTE-INTRO.md`:

```markdown
## T1 — No floating labels. Enact instead.

**From:** poc-01 v2, 2026-08-02. Owner: *"also remove for who, looks weird."*

An accent-outlined `FOR WHO` pill sat under the card row for roughly 25 seconds
of the film, drifting to a different position each beat because it was anchored
to nothing.

...

**Enforced by:** author judgement.
```

And its header rules:

> Every rule names where it came from, so it can be retired when its cause is
> gone rather than living forever by default.
>
> **Enforced by** tells you whether a machine will catch a breach. Where it says
> *author judgement*, nothing will stop you shipping the mistake again except
> reading this file.

`yt-script`'s version adds one field the visuals-flow files do not have:
**`Applies to:`**, naming the step numbers, because `yt-script` has three
different writing steps (030, 050, 100) and a rule about outlines must not be
read at script-finalise time.

### The three instruction files, and what they are for

| File | Step | Owns |
|---|---|---|
| `OUTLINE-INSTRUCTIONS.md` | 030 | the one-page outline's shape |
| `SCRIPT-PLAN-INSTRUCTIONS.md` | 050 | the beat/lane forms — **parsed by `lib/beats.mjs`** |
| `SCRIPT-INSTRUCTIONS.md` | 100 | the final script's format and the VO checklist |

These are owner-owned. `SCRIPT-PLAN-INSTRUCTIONS.md` is the load-bearing one:
`lib/beats.mjs` recognises its exact forms and **an unrecognised form falls
through to plain prose silently** — no error, no lane. That is precisely why
taste rules must not be appended into it: a preference sitting next to a parsed
form invites someone to "enforce" the preference by inventing a lane.

### What the existing tests already enforce

`test/steps.test.mjs` (read it before editing any step folder):

- folder names match `^\d{3}-[a-z0-9-]+-(llm|run|human)$`;
- each `step.json`'s `slug` / `number` / `actor` match its folder name, and
  `oneLiner` and `summary` are non-empty;
- **SKILL.md's step table lists exactly the folders on disk**, matched by
  `^\| \`(\d{3}-[a-z0-9-]+)\` \|`;
- the sentence matching `\b[A-Z][a-z]+ owner gates: ([^.]+)\.` names exactly the
  `-human` folders on disk;
- step numbers unique and ascending;
- no `step.json` `produces` entry matches `\.(html|pdf)\b`.

So adding `130-learn-from-feedback-llm` requires **one** SKILL.md table row and
nothing else in that test — the gates sentence stays `Six owner gates: 020, 040,
055, 060, 080, 110.` because 130 is `llm`, not `human`.

At `d923b178` the suite is **50 tests, 50 pass** via
`cd pipelines/youtube/yt-script && node --test test/*.test.mjs`.

### Skill placement convention

`yt-script`'s siblings live in `pipelines/.claude/skills/<name>/` with an up-link
symlink at `.claude/skills/<name>` -> `../../pipelines/.claude/skills/<name>`.
Confirmed at `d923b178`:

```
.claude/skills/yt-script                -> ../../pipelines/.claude/skills/yt-script
.claude/skills/yt-video-edit-feedback   -> ../../pipelines/.claude/skills/yt-video-edit-feedback
```

`scripts/relink.sh` recreates these. Create the real folder under
`pipelines/.claude/skills/` and the symlink under `.claude/skills/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| the merge gate | `cd pipelines/youtube/yt-script && node --test test/*.test.mjs` | exit 0, `# fail 0`, pass count 50 + the new tests |
| the new suite alone | `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs` | exit 0, `# fail 0`, 7 tests |
| step table still honest | `cd pipelines/youtube/yt-script && node --test test/steps.test.mjs` | exit 0, `# fail 0` |
| the symlink resolves | `readlink .claude/skills/yt-script-feedback` | `../../pipelines/.claude/skills/yt-script-feedback` |
| the skill body is real | `wc -l pipelines/.claude/skills/yt-script-feedback/SKILL.md` | >= 150 |

Never write `node --test <dir>` — a directory argument fails on node 22.14
(plans/runs/LESSONS.md 2026-07-09).

## Scope

**In scope**:
- `pipelines/.claude/skills/yt-script-feedback/SKILL.md` — new.
- `.claude/skills/yt-script-feedback` — new symlink.
- `pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/{step.json,README.md}` — new.
- `pipelines/youtube/yt-script/TASTE.md` — new.
- `pipelines/youtube/yt-script/FEEDBACK-LOG.md` — new.
- `pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs` — new.
- `pipelines/.claude/skills/yt-script/SKILL.md` — one step-table row, one file-table
  row pair, the "thirteen" -> "fourteen" counts, one route line.
- `pipelines/youtube/yt-script/CLAUDE.md` — the step list and the file list.
- `decisions.md` — one dated entry.

**Out of scope**:
- `OUTLINE-INSTRUCTIONS.md`, `SCRIPT-PLAN-INSTRUCTIONS.md`,
  `SCRIPT-INSTRUCTIONS.md`. This plan builds the machine that will edit them
  later; it does not edit them now. Moving an existing taste-flavoured line out
  of `SCRIPT-INSTRUCTIONS.md` into `TASTE.md` is tempting and is **not** in scope
  — those files are owner-owned and a migration is the owner's call.
- `pipelines/.claude/skills/yt-video-edit-feedback/SKILL.md` — the precedent. Read
  it, copy its shape, do not edit it.
- `lib/beats.mjs` and every existing test file.
- `pipelines/video/visuals-flow/**`.
- Seeding `TASTE.md` with more than the one rule specified in Step 3. Do **not**
  invent rules from reading old scripts; a rule with no owner quote is exactly
  what this design forbids.
- Any `videos/*/script-draft.md`.

## Git workflow

- Branch: `advisor/253-yt-script-feedback-skill`
- Commit: one per step, `feat(yt-script): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Create step 130 and its routing table

`pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/step.json`:

```json
{
  "number": "130",
  "slug": "130-learn-from-feedback-llm",
  "title": "learn from the feedback",
  "actor": "llm",
  "actorLabel": "[LLM]",
  "oneLiner": "Routes each owner reaction to the one surface that owns it.",
  "consumes": [
    "FEEDBACK-LOG.md",
    "TASTE.md"
  ],
  "produces": [
    "TASTE.md",
    "FEEDBACK-LOG.md"
  ],
  "gate": null,
  "external": false,
  "optional": true,
  "summary": "The fold. Owns the surface-routing table - which file a lesson goes into - and the promotion threshold that decides whether a reaction is an instance fix or a standing rule. Run by the `yt-script-feedback` skill after the owner approves its Phase 4 summary; never run mid-flow on another video. Added 2026-08-26."
}
```

`pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/README.md`:

```markdown
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

**A format spec and a taste rule are not the same kind of thing and never share a
file.** `lib/beats.mjs` parses the exact forms in
`SCRIPT-PLAN-INSTRUCTIONS.md`, and an unrecognised form falls through to plain
prose **silently**. A preference sitting next to a parsed form invites the next
session to "enforce" the preference by inventing a lane, which produces a worse
document that looks fine at a glance.

**And the reverse:** a genuine format fix never becomes a `T` rule. A `T` rule is
judgement; a format rule is a contract with a parser.

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
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/steps.test.mjs`
-> exit 0, `# fail 0` (this will FAIL until Step 5 adds the SKILL.md row — run it
again after Step 5 and confirm green then)

### Step 2: Create `FEEDBACK-LOG.md`

`pipelines/youtube/yt-script/FEEDBACK-LOG.md`:

```markdown
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

| Date | Video | `kind` | What the owner said (verbatim) | Fixed in | Promoted |
|---|---|---|---|---|---|

<!-- No rows yet. The first fold appends here. -->
```

**Verify**: `test -f pipelines/youtube/yt-script/FEEDBACK-LOG.md && echo OK`
-> `OK`

### Step 3: Create `TASTE.md`, seeded with exactly one rule

The seed rule is real, dated, and quoted from the owner's own words in the
session that commissioned this plan. **Do not add any other rule.** A rule
without an owner quote is precisely what this design forbids.

`pipelines/youtube/yt-script/TASTE.md`:

```markdown
# TASTE.md

Owner feedback about `yt-script` output, turned into rules. The writing steps
(030, 050, 100) read this alongside their own instruction file.

**This file holds taste, never format.** The three instruction files
(`OUTLINE-INSTRUCTIONS.md`, `SCRIPT-PLAN-INSTRUCTIONS.md`,
`SCRIPT-INSTRUCTIONS.md`) hold format, and `SCRIPT-PLAN-INSTRUCTIONS.md`'s forms
are parsed by `lib/beats.mjs`. The two kinds do not share a file:
`steps/130-learn-from-feedback-llm/README.md` has the routing table and the
reason.

Every rule names where it came from, so it can be retired when its cause is gone
rather than living forever by default. **Enforced by** tells you whether a
machine will catch a breach; where it says *author judgement*, nothing will stop
you shipping the mistake again except reading this file.

## How a rule gets here

The owner reacts to a script. The reaction is logged in `FEEDBACK-LOG.md` with a
`kind`, and the current video is fixed. **A rule is written only on the second
reaction of the same `kind`**, or when the owner explicitly asks for one. Step
130 owns that threshold and the vocabulary.

Rules are appended and never renumbered. A rule whose cause is gone is retired in
place, with a note, so the reason it existed outlives it.

---

## T1 — A taste rule must never narrow what a script is allowed to say.

**From:** the session that commissioned this file, 2026-08-26. Owner: *"Do note
that I don't want to limit the creativity of the script writing, but I want
slowly and slowly for this skill to be able to learn my preferences and to be
able to learn how I like to make my scripts."*

This is the rule about the rules, and it is first because it constrains every
rule after it. A `T` rule records something the owner has actually rejected
twice. It does not pre-specify what a good script contains, list approved
sentence shapes, or supply copy to reuse. The moment a rule reads like a
template, the writing step has nothing left to decide and this file has stopped
helping.

The practical test before appending anything: could two good scripts both obey
this rule and still read completely differently? If not, it is a format rule in
the wrong file, or it is not a rule at all.

**Applies to:** 130
**Enforced by:** the promotion threshold in `steps/130-learn-from-feedback-llm/README.md` - repeat before rule, and the owner approves every promotion.
```

**Verify**: `cd pipelines/youtube/yt-script && node -e "const t=require('fs').readFileSync('TASTE.md','utf8');const n=(t.match(/^## T\d+ /gm)||[]).length;if(n!==1)throw new Error('expected 1 rule, got '+n);console.log('1 rule')"`
-> prints `1 rule`

### Step 4: Write `test/feedback-surfaces.test.mjs`

This is the gate. It must be able to fail — the mutation in the frontmatter
strips the `Enforced by:` line from T1 and this suite must go red printing
`TASTE_RULE_MALFORMED`.

`pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs`:

```js
// The feedback loop is three files that must agree: step 130 owns the routing
// table and the kind vocabulary, TASTE.md holds rules in one fixed shape, and
// FEEDBACK-LOG.md indexes reactions by kind. Prose agreements drift; these do
// not.
//
// The no-drift test is the important one. yt-video-edit-feedback's SKILL.md says
// "never restate 130's surface-routing table here — read it at execute time so
// the two cannot drift". That is an instruction nobody can enforce by reading.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const REPO = join(ROOT, '..', '..', '..')
const read = (p) => readFileSync(join(REPO, p), 'utf8')

const STEP130 = 'pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/README.md'
const SKILL = 'pipelines/.claude/skills/yt-script-feedback/SKILL.md'
const TASTE = 'pipelines/youtube/yt-script/TASTE.md'
const LOG = 'pipelines/youtube/yt-script/FEEDBACK-LOG.md'

// The closed vocabulary, restated here ON PURPOSE: this array is the assertion,
// so a tag added to step 130 without the owner's sign-off turns this red.
const KINDS = [
  'hook-length',
  'filler-phrase',
  'section-order',
  'claim-density',
  'cta-placement',
  'tone',
  'pacing',
  'jargon',
  'structure',
  'evidence',
  'format',
]

test('all four feedback surfaces exist', () => {
  for (const p of [STEP130, SKILL, TASTE, LOG]) {
    assert.ok(existsSync(join(REPO, p)), `FEEDBACK_SURFACE_MISSING: ${p}`)
  }
})

test('step 130 carries the routing table', () => {
  const s = read(STEP130)
  assert.match(s, /## The surface-routing table/, 'ROUTING_TABLE_MISSING: step 130 no longer owns the routing table')
  for (const f of ['SCRIPT-PLAN-INSTRUCTIONS.md', 'OUTLINE-INSTRUCTIONS.md', 'SCRIPT-INSTRUCTIONS.md', 'TASTE.md']) {
    assert.ok(s.includes(f), `ROUTING_TABLE_INCOMPLETE: no row routes to ${f}`)
  }
})

test('the skill does NOT restate the routing table', () => {
  const s = read(SKILL)
  assert.doesNotMatch(
    s,
    /## The surface-routing table/,
    'ROUTING_TABLE_DUPLICATED: the skill restates step 130s table, so the two will drift. ' +
      'The skill owns the conversation; 130 owns where a lesson lands.',
  )
  assert.match(
    s,
    /130-learn-from-feedback-llm/,
    'ROUTING_TABLE_UNREACHABLE: the skill never points at the step that owns routing',
  )
})

test('the kind vocabulary is closed and both files agree on it', () => {
  const step = read(STEP130)
  const log = read(LOG)
  for (const k of KINDS) {
    assert.ok(step.includes(`\`${k}\``), `KIND_VOCAB_DRIFT: step 130 does not define \`${k}\``)
  }
  assert.match(step, /closed/, 'KIND_VOCAB_OPEN: step 130 no longer says the vocabulary is closed')
  assert.match(
    log,
    /130-learn-from-feedback-llm/,
    'KIND_VOCAB_DRIFT: FEEDBACK-LOG.md does not defer to step 130 for the vocabulary',
  )
  // The log must NOT carry its own copy of the list — one authority only.
  const listed = KINDS.filter((k) => log.includes(`\`${k}\``))
  assert.deepEqual(
    listed,
    [],
    `KIND_VOCAB_DUPLICATED: FEEDBACK-LOG.md restates ${listed.join(', ')}; step 130 is the only authority`,
  )
})

test('every TASTE rule has all four required parts', () => {
  const t = read(TASTE)
  const blocks = t.split(/^## (?=T\d+ )/m).slice(1)
  assert.ok(blocks.length >= 1, 'TASTE_RULE_MALFORMED: TASTE.md contains no T rules, so this check is vacuous')
  for (const b of blocks) {
    const id = (b.match(/^T\d+/) || ['?'])[0]
    assert.match(b, /^T\d+ — .+/, `TASTE_RULE_MALFORMED: ${id} has no one-line rule after the dash`)
    assert.match(b, /\*\*From:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **From:** line`)
    assert.match(b, /Owner: \*".+"\*/s, `TASTE_RULE_MALFORMED: ${id}'s **From:** does not quote the owner verbatim`)
    assert.match(b, /\*\*Applies to:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **Applies to:** line`)
    assert.match(b, /\*\*Enforced by:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **Enforced by:** line`)
  }
})

test('TASTE rule numbers are unique and ascending', () => {
  const nums = [...read(TASTE).matchAll(/^## T(\d+) /gm)].map((m) => Number(m[1]))
  assert.deepEqual(nums, [...new Set(nums)], 'TASTE_RULE_MALFORMED: two rules share a number')
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), 'TASTE_RULE_MALFORMED: rules are not in ascending order')
})

test('TASTE.md states that it holds taste and not format', () => {
  const t = read(TASTE)
  assert.match(
    t,
    /holds taste, never format|taste, never format/,
    'TASTE_FORMAT_MIXED: TASTE.md no longer states the taste/format split, which is the reason it is a separate file',
  )
  for (const f of ['SCRIPT-PLAN-INSTRUCTIONS.md', 'OUTLINE-INSTRUCTIONS.md', 'SCRIPT-INSTRUCTIONS.md']) {
    assert.ok(t.includes(f), `TASTE_FORMAT_MIXED: TASTE.md does not name ${f} as the format home`)
  }
})
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs`
-> exit 0, `# fail 0`, 7 tests

### Step 5: Write the skill

Create `pipelines/.claude/skills/yt-script-feedback/SKILL.md`. Follow
`pipelines/.claude/skills/yt-video-edit-feedback/SKILL.md`'s five-phase shape.
**Do not copy its routing table** — Step 4's test asserts you did not.

Frontmatter:

```yaml
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
```

Body, in this order:

1. **Header note** — the folder is `pipelines/youtube/yt-script/`; run everything
   from there. State that `steps/130-learn-from-feedback-llm/README.md` is the
   authority on which surface owns a lesson, that this skill owns the
   conversation around it, and — verbatim in spirit from the sibling skill —
   *never restate 130's routing table here; read it at execute time so the two
   cannot drift.*

2. **Hard gates (check before anything)** — four:
   - **Opus-class only.** Folding feedback into durable rules is judgement work
     (the sibling skill's owner decision, 2026-07-18). If the session is not
     Opus-class, say so and stop.
   - **Never skip the discussion.** Phases 2-4 are the point. Do not jump from
     "here's my feedback" to editing files, however obvious a fix looks.
   - **One approval gate, explicit.** No file changes before the owner approves
     the Phase 4 summary. "Sounds good" on a single item is not approval of the
     batch.
   - **Never fold mid-flow on another video.** Rule surfaces change between
     videos, never during one.

3. **Phase 1 — Ingest (all four sources, always)** — a table. Say plainly that
   three of the four are silent and reading only the obvious one is the
   anti-pattern:

   | Source | How to read it | Notes |
   |---|---|---|
   | Chat feedback | this conversation | The loudest and the easiest to lose. Anything the owner said instead of writing it down. |
   | The owner's own edits | `git diff -- pipelines/youtube/yt-script/videos/<key>/script-plan.md videos/<key>/script.md` | Gate 055 explicitly invites the owner to edit the file himself. The same KIND of hand-edit twice is a feedback item; one is an instance fix. |
   | The desk's edited-line list | printed by `node bin/desk.mjs pull <key>` at step 090 | Every line the maker overrode. Each is a place the plan and reality disagreed. Not owner feedback, but it is evidence about the plan. |
   | `FEEDBACK-LOG.md` | read it in full | This is where repeat detection happens. Skipping it is how a third occurrence gets logged as a first. |

4. **Phase 2 — Root cause, not symptom.** One line of RCA per item: the owner
   describes what he READ; the fold needs why it came out that way. Then the
   recurring root-cause shapes in **this** pipeline:
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

5. **Phase 3 — Discuss.** Answer the owner's questions directly — they are part
   of the deliverable. Then per item: the root cause in one sentence, the surface
   you propose (130's table decides), whether it is instance or rule and **why
   the threshold says so**, and anything you cannot fix. Surface conflicts
   between two owner instructions; never resolve one unilaterally.

6. **Phase 4 — Summary and approval.** One message, one table:

   | # | What you said | `kind` | Root cause | Fix | Surface | Instance or rule? |

   Then, separately: **Rule promotions** (each citing the two `FEEDBACK-LOG.md`
   rows that triggered it, with the proposed `T<N>` text), **Instance fixes**,
   **New `kind` tags requested** (if any — its own line, because a new tag resets
   repeat detection), **Routed to a plan**, **Not fixing** with reasons, and
   **Open questions**. End by asking for approval. Stop. Do not edit files yet.

7. **Phase 5 — Execute (only after approval).** Follow
   `steps/130-learn-from-feedback-llm/README.md` for routing and the rule format.
   On top of it:
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

8. **Anti-patterns** — a closing list:
   - Reading the chat and skipping the other three sources.
   - Treating three occurrences of one preference as three one-off complaints.
   - Promoting a rule the owner did not approve in the Phase 4 summary.
   - Writing a rule with a paraphrase instead of the owner's words.
   - Appending a taste preference into `SCRIPT-PLAN-INSTRUCTIONS.md` because it
     "feels like a rule" — that file is parsed.
   - Marking an item fixed without a `FEEDBACK-LOG.md` row.
   - Inventing a new `kind` to make two unlike items look like a repeat.

Then create the up-link:

```bash
ln -s ../../pipelines/.claude/skills/yt-script-feedback .claude/skills/yt-script-feedback
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs && readlink ../../../.claude/skills/yt-script-feedback`
-> the suite exits 0; the symlink prints
`../../pipelines/.claude/skills/yt-script-feedback`

### Step 6: Register step 130 in the yt-script skill and folder guide

In `pipelines/.claude/skills/yt-script/SKILL.md` (the real file at that path —
never edit through the `.claude/skills/yt-script` symlink):

**6a** — add one step-table row after the `120` row:

```
| `130-learn-from-feedback-llm` | [LLM] | Folds your feedback into rules — run by `yt-script-feedback` |
```

**6b** — `The flow is thirteen numbered steps` becomes `fourteen`, and the
frontmatter `description`'s `Thirteen numbered steps with six owner gates` becomes
`Fourteen numbered steps with six owner gates`.

**6c** — **do not touch** `**Six owner gates: 020, 040, 055, 060, 080, 110.**`
Step 130 is `llm`, not `human`. `test/steps.test.mjs` asserts that sentence names
exactly the `-human` folders on disk, so changing it breaks the suite.

**6d** — add two rows to the file table:

```
| `TASTE.md` | 130 | Your accumulated taste rules, numbered and dated |
| `FEEDBACK-LOG.md` | 130 | Every reaction, tagged. The repeat-detection index |
```

**6e** — add one line to the "Not this skill's job" section or immediately after
the step table:

```markdown
Feedback on what this skill produced is a separate skill: `yt-script-feedback`.
It runs step 130. Do not fold feedback into a rule from inside an operating
session — rule surfaces change between videos, never during one.
```

In `pipelines/youtube/yt-script/CLAUDE.md`: add `130-learn-from-feedback-llm/` to
the step-folder block, change `thirteen step folders` to `fourteen`, and add
`TASTE.md` and `FEEDBACK-LOG.md` to the "Files in this folder" block with
one-line roles.

Finally add one dated entry to the repo root `decisions.md` recording: the
taste/format split and why `TASTE.md` is separate from the three parsed
instruction files; the repeat-before-rule threshold and the owner's reason for it
(quote him); and that the `kind` vocabulary is closed so the threshold is a string
match rather than a judgement.

**Verify**: `cd pipelines/youtube/yt-script && node --test test/*.test.mjs`
-> exit 0, `# fail 0`, and the pass count is 50 + 7 = **57**

## Test plan

- **New**: `test/feedback-surfaces.test.mjs`, 7 tests. The two that matter most
  are structural rather than cosmetic:
  - *the skill does NOT restate the routing table* — the sibling skill has this
    rule as prose (`"Never restate 130's surface-routing table here"`) and nothing
    enforces it. Here a copy fails the build.
  - *the kind vocabulary is closed and both files agree on it* — the `KINDS` array
    in the test file is the third copy on purpose. Adding a tag to step 130
    without owner sign-off turns the suite red, which is the point: a new tag
    resets repeat detection.
- **Unchanged**: the four existing suites, 50 tests. `steps.test.mjs` covers the
  new step folder and the SKILL.md table row.
- **Mutation gate**: stripping the `**Enforced by:**` line from `TASTE.md` must
  fail `test/feedback-surfaces.test.mjs` printing `TASTE_RULE_MALFORMED`. This is
  why `TASTE.md` ships with one real rule rather than zero — a rule-format check
  over an empty file passes vacuously, which reads as coverage and is not.
- **Not tested**: whether a folded rule actually improves a script. That is the
  owner's judgement at the next gate 055, and no test can stand in for it.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script && node --test test/*.test.mjs` exits 0 with
      `# fail 0` and **57** passing tests.
- [ ] `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs`
      exits 0 with 7 tests.
- [ ] `readlink .claude/skills/yt-script-feedback` prints
      `../../pipelines/.claude/skills/yt-script-feedback`.
- [ ] `wc -l < pipelines/.claude/skills/yt-script-feedback/SKILL.md` >= 150.
- [ ] `grep -c "Six owner gates: 020, 040, 055, 060, 080, 110" pipelines/.claude/skills/yt-script/SKILL.md`
      -> `1` (the sentence is unchanged).
- [ ] `grep -c "thirteen" pipelines/.claude/skills/yt-script/SKILL.md pipelines/youtube/yt-script/CLAUDE.md`
      -> `0` in both files.
- [ ] `pipelines/youtube/yt-script/TASTE.md` contains exactly one `## T<N>` rule.
- [ ] `pipelines/youtube/yt-script/FEEDBACK-LOG.md` contains zero data rows.
- [ ] `decisions.md` has one new dated entry for 2026-08-26.
- [ ] `git diff --stat d923b178..HEAD --name-only` lists no file outside this
      plan's in-scope list.

## STOP conditions

- **A gate assertion fails: fix the code or the fixture. Weakening, swapping,
  skipping or deleting an assertion is a STOP.** `test/feedback-surfaces.test.mjs`
  is the whole deliverable's proof; softening it to pass makes the plan worthless.
- You are about to write a second `TASTE.md` rule. Step 3 specifies exactly one.
  A rule needs an owner quote and two logged occurrences; you have neither for
  anything else. Inventing rules from reading old scripts is the failure mode this
  design exists to prevent.
- You are about to edit `OUTLINE-INSTRUCTIONS.md`,
  `SCRIPT-PLAN-INSTRUCTIONS.md` or `SCRIPT-INSTRUCTIONS.md`. Out of scope. This
  plan builds the machine that will edit them later.
- The `Six owner gates:` sentence seems to need changing. It does not — 130 is an
  `llm` step. If a test says otherwise, read `test/steps.test.mjs` again before
  touching the sentence.
- You are tempted to copy the routing table into the skill so it reads
  self-contained. That is the exact drift the test forbids.
- You are about to edit a `videos/*/script-draft.md`, or fold feedback about a
  video that is mid-flow.
- `pipelines/.claude/skills/yt-video-edit-feedback/SKILL.md` seems to need an
  edit. Read it, copy its shape, leave it alone.

## Maintenance notes

- **The `KINDS` array is deliberately duplicated** between step 130's table and
  the test file. That is not an oversight — the test is the sign-off gate for a
  new tag. Adding a tag means editing both, and the second edit is where the
  owner's approval gets recorded.
- **`TASTE.md` must never be empty of rules.** The rule-format check passes
  vacuously over zero rules, which reads as coverage while checking nothing
  (the 2026-08-02 "gate that never fires" class). T1 is the fixture as well as a
  real rule.
- **The threshold is the anti-ossification guard, and it is the thing most likely
  to erode.** A session under pressure will fold on the first occurrence because
  it is faster. The only defences are step 130's README and the owner noticing
  scripts getting narrower. If erosion shows up, the next move is a check that
  every `T` rule cites two `FEEDBACK-LOG.md` rows — not currently enforced,
  because T1 legitimately cites none.
- **`Applies to:` is the field that keeps rules from leaking across steps.** This
  pipeline has three writing steps; visuals-flow's TASTE files did not need this
  field and so do not have it. Watch that folds keep filling it honestly rather
  than writing `030, 050, 100` by default.
- A reviewer should scrutinise: that the skill really does not restate the routing
  table (read it, do not trust the test alone), and that T1's quote is verbatim
  from the owner rather than tidied.
- Follow-up, deliberately not done here: `SCRIPT-INSTRUCTIONS.md` contains at
  least one genuine taste rule ("Give every option credit before naming its limit.
  Never open a platform's verdict with the negative") sitting in a format file.
  Migrating it into `TASTE.md` is the owner's call, not a crew's.
