---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/youtube/yt-script && node --test test/*.test.mjs && node lib/build-script-json.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/youtube/yt-script/TASTE.md, pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md, pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs, pipelines/youtube/yt-script/steps/110-approve-script-human/step.json, pipelines/youtube/yt-script/steps/110-approve-script-human/README.md, pipelines/youtube/yt-script/.gitignore, pipelines/.claude/skills/yt-script/SKILL.md, decisions.md]

mutation_apply: |
  perl -pi -e 's/^- First person, one presenter/- Give every option credit before naming its limit.\n- First person, one presenter/' pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md
mutation_command: cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs
mutation_expect: "TASTE_IN_FORMAT_FILE"
mutation_cwd:
mutation_timeout: 600
---

# Plan 254: Move the taste rules out of SCRIPT-INSTRUCTIONS.md, and fix what 252 left behind

## Summary

- **Problem statement**: Two things, both fallout from the 251-253 batch.
  (1) `SCRIPT-INSTRUCTIONS.md` is a format spec, but it carries **four genuine
  taste rules** — one of them stated twice in two different sections, and one of
  them supplying verbatim copy for the script to reuse. Plan 253 built `TASTE.md`
  exactly for these and then deliberately did not migrate anything, because that
  is the owner's call and not a crew's.
  (2) Plan 252 declared step 110 out of scope with "the gate's wording stands",
  which was wrong: step 110 still tells the owner to approve `script.md` and
  `script.vo.txt`, and `script.vo.txt` no longer exists. An owner gate naming a
  deleted file is a real defect, and it is a planning error, not a crew error.
- **Goals**:
  - Migrate four taste rules from `SCRIPT-INSTRUCTIONS.md` into `TASTE.md` as
    seeded rules `T2`-`T5`, honestly marked as seeded rather than folded.
  - Collapse the duplicate: "give every option credit before naming its limit"
    currently appears in both **Voice and tone** and **Closing convention**.
  - Delete the supplied verbatim synthesis line, which fails `TASTE.md`'s own T1
    test — it is template copy, not a rule.
  - Fix step 110's gate text to name `script.json` and `respell.json`.
  - Fix two stale doc lines that still describe `script.vo.txt` as live, and
    one self-contradiction where section 4's `script.md` skeleton still emits
    the pronunciation lexicon table section 1 forbids.
  - Extend `test/feedback-surfaces.test.mjs` so a taste rule reappearing in a
    format file fails the build.
- **Decisions confirmed**:
  - Migrate the taste rules -> **yes**, owner-approved 2026-08-26 in response to
    the 251-253 verification report.
  - How to reconcile the migration with `TASTE.md`'s own rules -> **seed them,
    and say so.** `TASTE.md`'s T1 requires an owner quote and step 130 requires
    two logged occurrences; these four rules have neither, because they predate
    the log. The precedent is `pipelines/video/visuals-flow/TASTE-SIMPLE.md`,
    whose header states it was *"Seeded 2026-08-22 ... before any owner round had
    run against a real simple video — so `From:` below cites the reference
    measurement, not a rejected cut."* Same pattern: `From:` cites
    `SCRIPT-INSTRUCTIONS.md` and the hand-written script it was modelled on
    (2026-08-11), and each rule is marked `Seeded`.
  - Scope of the sweep -> `SCRIPT-INSTRUCTIONS.md` only.
    `OUTLINE-INSTRUCTIONS.md` was audited and is clean; see "Current state".
  - Step 110 -> **fixed here**, folded into this plan rather than raised
    separately, because this plan is already the "clean up after 252" PR and one
    review is cheaper than two.
- **Executor proposed**: `claude-p` / Sonnet. `tooling/boss/data/rules.md` routes
  quality-setting prose the owner judges by taste to claude-p/sonnet. Deciding
  the exact wording of a migrated taste rule is that, even though the mechanical
  half of this plan is trivial.
- **Done criteria** (terse): `TASTE.md` holds 5 well-formed rules, the four
  migrated texts are gone from `SCRIPT-INSTRUCTIONS.md`, step 110 names no
  deleted file, and the extended gate is green with its mutation armed.
- **Stop conditions** (terse): migrating a fifth rule not listed here, inventing
  an owner quote, touching `OUTLINE-INSTRUCTIONS.md` or
  `SCRIPT-PLAN-INSTRUCTIONS.md`, weakening any assertion.
- **Test / verification for success**: `test/feedback-surfaces.test.mjs`, extended
  with a taste-leak check over the format files, mutation-verified.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 605bcf04..HEAD -- pipelines/youtube/yt-script pipelines/.claude/skills/yt-script`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (251-253 already landed; PRs #212, #213, #214 closed `boss:done`)
- **Category**: refactor
- **Difficulty**: standard
- **Planned at**: commit `605bcf04`, 2026-08-26

## Why this matters

`TASTE.md` shipped with one rule, T1, whose whole content is *a taste rule must
never narrow what a script is allowed to say*. The file's reason to exist is that
taste and parsed format do not belong together — `SCRIPT-PLAN-INSTRUCTIONS.md`'s
forms are read by `lib/beats.mjs`, and an unrecognised form falls through to
plain prose **silently**, so a preference sitting next to a parsed form invites
the next session to "enforce" the preference by inventing a lane.

That argument applies just as well to `SCRIPT-INSTRUCTIONS.md`, which is where
the taste actually is. Leaving it there means step 100 reads editorial
preferences as though they were format contracts, and there is no way to retire
one, because nothing records where it came from or why.

The duplicate is the concrete cost. "Give every option credit before naming its
limit" is stated in **Voice and tone** and again, differently worded, in
**Closing convention** item 1. Two statements of one rule drift, and a reader
following the second one does not know the first exists.

## Current state

### The four taste rules, quoted exactly as they appear

All in `pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md`.

**In `## Voice and tone`** (a five-bullet list):

```markdown
- First person, one presenter talking directly to camera. "I tested," "I'm
  comparing," never "we" unless the channel is an established team.
- Direct address to the viewer as "you." Casual-professional — contractions,
  short sentences, no corporate hedging.
- Frame every comparison as fair and unbiased before making claims: state the
  test conditions (same script, same inputs) up front so verdicts later feel
  earned, not sponsored.
- Give every option credit before naming its limit. Never open a platform's
  verdict with the negative — earn the criticism after stating what it's
  genuinely good for.
- Confident, singular recommendations at the end — not "it depends," a named
  winner with a one-line reason.
```

Bullet 1 stays. It is a hard convention with a single correct answer, not a
preference — two good scripts cannot both obey it and differ. Bullets 2, 3, 4
and 5 are the migration.

**In `## Closing convention (Part C)`**:

```markdown
1. **Honest Verdict, weakest to strongest.** Walk every option in ascending
   order of fit, ending on the winner(s). Each gets a fair reason to exist,
   then its limit — never the reverse order.
2. **Overall synthesis line** before verdicts start: "none of these are bad,
   they're just built for different priorities" — softens the ranking that
   follows.
3. **Final recommendation** — restate the winner(s) addressed to named viewer
   personas (by role/use case), then one closing sentence naming the single
   top pick if forced to choose only one.
4. **Final CTA** — thanks for watching → links/deals reminder in description →
   comment prompt → like + subscribe → sign-off ("I'll see you in the next
   one").
```

- Item 1's second sentence — *"Each gets a fair reason to exist, then its limit —
  never the reverse order"* — **is Voice-and-tone bullet 4 restated.** The
  ordering half ("weakest to strongest", first sentence) is genuine structure and
  stays. The credit-before-limit half goes to `TASTE.md` and the sentence is cut
  from here.
- Item 2 **supplies verbatim copy**. Apply `TASTE.md`'s T1 test: could two good
  scripts both obey this and still read completely differently? No — obeying it
  means using that sentence. It is a template line, so it is neither a format
  rule nor a taste rule. The *idea* (soften the ranking before it starts)
  survives as part of T4; the supplied sentence is deleted.
- Items 3 and 4 are structure. They stay.

### `OUTLINE-INSTRUCTIONS.md` was audited and is clean

Do not edit it. Its `## Rules` section is six bullets and every one is a format
contract (one line per section, no spoken copy, no lanes, names final once
approved, every section traces to `knowledge.md`, body numbered / intro and
conclusion bulleted).

The one borderline case, deliberately left alone:

```markdown
## For a comparison video

Organise **by factor with every tool swept inside each factor** — one "Pricing"
section covering all five tools, never one section per tool. Per-tool sections
make the viewer hold five separate verdicts in their head and make the scorecard
impossible to build.
```

This reads like taste because it argues, but it is load-bearing structure — the
scorecard cannot be built the other way, and `SCRIPT-PLAN-INSTRUCTIONS.md`'s
on-screen tables depend on it. It stays a format rule. **Do not migrate it.**

### The step 110 defect

`pipelines/youtube/yt-script/steps/110-approve-script-human/README.md`:

> The owner reads the diff report from 100 - every line reworded, respelled or
> cut - and approves `script.md` and `script.vo.txt`. Last gate before anything
> is spoken aloud.

The same sentence is in that folder's `step.json` `summary`. `script.vo.txt` was
removed from the flow by plan 252. Plan 252's scope section said *"`steps/110-approve-script-human/**` — the gate's wording stands"*, which was a
planning mistake: the wording could not stand once the file it names was gone.

### The two stale doc lines

Verified at `605bcf04` — these are the only remaining `script.vo.txt` mentions
that are wrong rather than historical:

1. `pipelines/youtube/yt-script/.gitignore`:
   `# script.vo.txt ARE tracked — they are the sources and the deliverables (the`
   — the file is not tracked, because it does not exist.
2. `pipelines/.claude/skills/yt-script/SKILL.md`, inside the 2026-08-23
   "what changed" note:
   `VO engine reads \`script.vo.txt\`, so nothing read the script PDF any more.`
   — the claim is now false.

**Three other mentions are correct history and must be left alone:**
`lib/build-script-json.mjs` ("the way script.md + script.vo.txt would have"),
and step 120's `README.md` + `step.json` ("before that this step did nothing and
`script.vo.txt`, its supposed input, had never once been produced"). Plan 252
required that last one; deleting it loses the reason step 120 was rewritten.

> Note for whoever reads plan 252 later: its done criterion
> *"`git grep -c "script.vo.txt"` exits 1 (zero matches)"* was unsatisfiable,
> because the same plan required step 120's summary to explain the history and
> that explanation names the file. The criterion was wrong, not the work. Boss
> merged anyway because done-criteria prose gates nothing —
> `plans/runs/LESSONS.md` 2026-07-21.

### The gate to extend

`pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs`, landed by plan
253: 7 tests covering surface existence, the routing table's home, the no-drift
rule, the closed `kind` vocabulary, `TASTE.md` rule format, rule numbering, and
the taste/format split statement.

Measured at `605bcf04`:

| Suite | Result |
|---|---|
| `node --test test/*.test.mjs` | 57 tests, 57 pass |
| `node lib/build-script-json.test.mjs` | 8 tests, 8 pass |
| `bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh` | 47 pass |
| `bash pipelines/video/tts/scripts/check.sh` | 21 pass |

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| the merge gate | `cd pipelines/youtube/yt-script && node --test test/*.test.mjs && node lib/build-script-json.test.mjs` | exit 0; **58** then 8 passing |
| the extended suite alone | `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs` | exit 0, **8** tests |
| rule count | `grep -c '^## T[0-9]' pipelines/youtube/yt-script/TASTE.md` | `5` |
| no taste left in the format file | `cd pipelines/youtube/yt-script && grep -c "Casual-professional\|earn the criticism after\|not \"it depends\"\|they're just built for different priorities" SCRIPT-INSTRUCTIONS.md` | `0` (grep exits 1) |

Never write `node --test <dir>` — a directory argument fails on node 22.14
(`plans/runs/LESSONS.md` 2026-07-09).

## Scope

**In scope**:
- `pipelines/youtube/yt-script/TASTE.md` — append `T2`-`T5`.
- `pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md` — remove the four
  migrated texts, keep pointers.
- `pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs` — one new test.
- `pipelines/youtube/yt-script/steps/110-approve-script-human/{step.json,README.md}`.
- `pipelines/youtube/yt-script/.gitignore` — one comment line.
- `pipelines/.claude/skills/yt-script/SKILL.md` — one stale sentence.
- `decisions.md` — one dated entry.

**Out of scope**:
- `OUTLINE-INSTRUCTIONS.md`. Audited, clean. See "Current state" for the one
  borderline rule that deliberately stays.
- `SCRIPT-PLAN-INSTRUCTIONS.md`. Its forms are parsed by `lib/beats.mjs`; nothing
  in it is taste. Do not open it looking for something to move.
- `pipelines/.claude/skills/yt-script-feedback/SKILL.md` — the skill is correct as
  landed and the no-drift test guards it.
- `steps/130-learn-from-feedback-llm/**` — the routing table and the threshold are
  correct as landed.
- The three correct-history `script.vo.txt` mentions listed above.
- Any `videos/**` file. Nothing here touches a video.
- `pipelines/video/tts/**` and `pipelines/youtube/tutorial-pipeline-3/**`.

## Git workflow

- Branch: `advisor/254-taste-format-split`
- Commit: one per step, `refactor(yt-script): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Append T2-T5 to `TASTE.md`

Append after T1. All four are **seeded**, not folded — say so in each, because
`TASTE.md`'s T1 and step 130's threshold both require things these rules do not
have (an owner reaction quote, two logged occurrences). Hiding that would make
the file's first four entries a lie about its own process.

```markdown
---

## Seeded rules T2-T5 — migrated from `SCRIPT-INSTRUCTIONS.md`, 2026-08-26

These four were already being followed. They were written into
`SCRIPT-INSTRUCTIONS.md` as though they were format, and moved here when the
owner approved the split (plan 254). **They are seeded, not folded**: no
`FEEDBACK-LOG.md` row triggered them and no owner reaction is quoted, because
they predate the log. `From:` therefore cites the instruction file and the
hand-written script it was modelled on, the way
`pipelines/video/visuals-flow/TASTE-SIMPLE.md` cites its reference measurements.

Retire them on the same terms as any other rule: in place, with a note.

## T2 — Talk to one viewer, in contractions, in short sentences.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Direct address to the viewer as 'you.' Casual-professional —
contractions, short sentences, no corporate hedging."* Modelled on the script the
owner wrote by hand, 2026-08-11.

Second person, not "the user" or "viewers". Contractions rather than the expanded
form. No hedging clause where a plain statement will do. The register is a person
who has actually used the tools talking to a person deciding whether to, which is
neither a lecture nor a press release.

This is a floor, not a ceiling. It rules out a house style; it does not supply
one.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T3 — Earn the verdicts before making them.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Frame every comparison as fair and unbiased before making
claims: state the test conditions (same script, same inputs) up front so verdicts
later feel earned, not sponsored."*

State the test conditions in the intro, before any option is judged. Same script,
same inputs, same clip length — whatever was actually held constant. A viewer who
knows the method reads a later verdict as a finding; a viewer who does not reads
it as a preference, or as a placement.

This is also why the script never needs sponsor-disclaimer language later: the
fairness is established by the method, not asserted.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T4 — Credit before limit. Never open a verdict with the negative.

**From:** seeded from `SCRIPT-INSTRUCTIONS.md`, 2026-08-26. It was stated
**twice** there, in "Voice and tone" — *"Give every option credit before naming
its limit. Never open a platform's verdict with the negative — earn the criticism
after stating what it's genuinely good for."* — and again in "Closing convention"
item 1 — *"Each gets a fair reason to exist, then its limit — never the reverse
order."* One rule, two wordings, in one file.

Every option gets a real reason to exist before its limit is named. Not a
throwaway concession before the real point: the thing it is genuinely best at,
said plainly enough that someone for whom that matters would pick it.

The reason is not politeness. A ranking where every option is first praised on
its own terms tells the viewer which one is for *them*; a ranking that leads with
faults only tells them what the presenter dislikes.

**The ordering itself is not this rule.** "Honest Verdict, weakest to strongest"
is structure and stays in `SCRIPT-INSTRUCTIONS.md`. This rule governs what
happens inside each verdict, whatever order they come in.

**Applies to:** 050, 100
**Enforced by:** author judgement.

## T5 — Land on one named winner, not on "it depends".

**From:** seeded from `SCRIPT-INSTRUCTIONS.md` "Voice and tone", 2026-08-26.
Original text: *"Confident, singular recommendations at the end — not 'it
depends,' a named winner with a one-line reason."*

The conclusion names a pick and gives one line of why. Addressing different picks
to different named viewer personas is fine and is the structure step 100 already
follows; what is not fine is finishing without committing to anything.

Softening the ranking before it starts is part of doing this well — a video that
ranks five tools should say they are built for different priorities rather than
that four of them are bad. **Say it in your own words.** The supplied sentence
that used to live in "Closing convention" item 2 was deleted rather than moved
here, because a rule you satisfy by pasting one specific sentence is a template,
and T1 forbids that.

**Applies to:** 050, 100
**Enforced by:** author judgement.
```

**Verify**: `grep -c '^## T[0-9]' pipelines/youtube/yt-script/TASTE.md` -> `5`

### Step 2: Remove the migrated text from `SCRIPT-INSTRUCTIONS.md`

**2a — `## Voice and tone`.** Replace the whole five-bullet list with:

```markdown
- First person, one presenter talking directly to camera. "I tested," "I'm
  comparing," never "we" unless the channel is an established team.

Everything else about voice is taste, not format, and lives in
[`TASTE.md`](TASTE.md) — T2 (register), T3 (earn the verdicts), T4 (credit before
limit), T5 (land on a winner). Read it alongside this file. It moved there on
2026-08-26 so that a preference could be dated, sourced and retired; a rule with
no recorded origin lives forever by default.
```

**2b — `## Closing convention (Part C)` item 1.** Cut the taste half; keep the
structure half:

```markdown
1. **Honest Verdict, weakest to strongest.** Walk every option in ascending
   order of fit, ending on the winner(s). What goes *inside* each verdict is
   `TASTE.md` T4.
```

**2c — `## Closing convention (Part C)` item 2.** Delete it entirely and
renumber 3 and 4 to 2 and 3. The idea survives as part of T5; the supplied
sentence does not survive at all.

The section becomes:

```markdown
1. **Honest Verdict, weakest to strongest.** Walk every option in ascending
   order of fit, ending on the winner(s). What goes *inside* each verdict is
   `TASTE.md` T4.
2. **Final recommendation** — restate the winner(s) addressed to named viewer
   personas (by role/use case), then one closing sentence naming the single
   top pick if forced to choose only one.
3. **Final CTA** — thanks for watching → links/deals reminder in description →
   comment prompt → like + subscribe → sign-off ("I'll see you in the next
   one").
```

**2d** — in `## Never appears in a spoken line`, the last bullet cross-references
the fairness framing. Repoint it:

```markdown
- Sponsor/bias language unless the video is actually sponsored — the fairness
  framing in the intro (`TASTE.md` T3) exists specifically so this never needs
  saying later.
```

**Verify**: `cd pipelines/youtube/yt-script && ! grep -q "Casual-professional\|earn the criticism after\|not \"it depends\"\|they're just built for different priorities" SCRIPT-INSTRUCTIONS.md && echo CLEAN`
-> prints `CLEAN`

### Step 3: Extend the gate so a taste rule cannot leak back

Append this test to
`pipelines/youtube/yt-script/test/feedback-surfaces.test.mjs`. It needs the
existing `read`, `TASTE` and helper bindings already at the top of that file — do
not duplicate them.

```js
// The migrated rules (plan 254) must stay migrated. Reintroducing one into a
// format file is the exact drift TASTE.md exists to prevent, and it is a
// copy-paste away — the text lived there for months.
test('no migrated taste rule has leaked back into a format file', () => {
  const FORMAT_FILES = [
    'pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md',
    'pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md',
    'pipelines/youtube/yt-script/SCRIPT-PLAN-INSTRUCTIONS.md',
  ]
  // Distinctive fragments of T2-T5, chosen so a paraphrase is allowed but the
  // original sentence is not.
  const MIGRATED = [
    ['T2', 'Casual-professional'],
    ['T3', 'earned, not sponsored'],
    ['T4', 'earn the criticism after'],
    ['T4', 'never the reverse order'],
    ['T5', 'not "it depends"'],
    ['T5', "they're just built for different priorities"],
  ]
  for (const f of FORMAT_FILES) {
    const body = read(f)
    for (const [rule, fragment] of MIGRATED) {
      assert.ok(
        !body.includes(fragment),
        `TASTE_IN_FORMAT_FILE: ${f} contains ${rule}'s text ("${fragment}"). ` +
          'Taste lives in TASTE.md; steps/130-learn-from-feedback-llm/README.md has the routing table.',
      )
    }
  }

  // ...and each one really is in TASTE.md, so this check cannot pass by the
  // rules having been deleted rather than moved.
  const taste = read(TASTE)
  for (const rule of ['T2', 'T3', 'T4', 'T5']) {
    assert.match(taste, new RegExp(`^## ${rule} — `, 'm'), `TASTE_RULE_MISSING: ${rule} is not in TASTE.md`)
  }
})
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs`
-> exit 0, **8** tests, `# fail 0`

### Step 4: Fix step 110's gate text

In `pipelines/youtube/yt-script/steps/110-approve-script-human/step.json`, the
`summary` becomes:

```
"summary": "The owner reads the diff report from 100 - every line reworded, respelled or cut - and approves `script.md`, `script.json` and `respell.json`. Last gate before anything is spoken aloud."
```

In that folder's `README.md`, the matching sentence becomes:

```markdown
The owner reads the diff report from 100 - every line reworded, respelled or cut - and approves `script.md`, `script.json` and `respell.json`. Last gate before anything is spoken aloud.
```

Then add one paragraph to that README's `## What you do`, because the gate now
covers a file the owner did not have before:

```markdown
`respell.json` is worth thirty seconds of your time even though it is short. It
is the only place a pronunciation lives, and a wrong respelling there is a wrong
word in every take of that section. `script.json` is derived from `script.md`, so
if the two disagree the fix is to regenerate it, not to edit the JSON.
```

**Verify**: `cd pipelines/youtube/yt-script && ! grep -rq "script.vo.txt" steps/110-approve-script-human/ && node --test test/steps.test.mjs`
-> the grep finds nothing and the suite exits 0

### Step 5: Fix the two stale doc lines

**5a** — `pipelines/youtube/yt-script/.gitignore`. The comment block currently
lists `script.vo.txt` among the tracked deliverables. Replace that comment block
with:

```
# Generated by the retired render-outline.mjs / render-script.mjs — regenerate,
# don't commit. House rule: generated output never lives in the repo
# (pipelines/CLAUDE.md).
#
# knowledge.md, outline.md, script-plan.md, script-worksheet.md, script-draft.md,
# script.md, script.json and respell.json ARE tracked — they are the sources and
# the deliverables (the worksheet doubles as the diff baseline for what the maker
# changed). Only the HTML/PDF renders and the generated audio are not.
# script.vo.txt was dropped from the flow by plan 252.
```

Leave every actual ignore pattern below it exactly as it is.

**5b** — `pipelines/.claude/skills/yt-script/SKILL.md`, in the 2026-08-23 "No HTML
or PDF" note. The sentence currently claims the VO engine reads `script.vo.txt`.
Replace that clause so the note stays true:

```
the VO engine reads the per-section `script.json` (`script.vo.txt`, which this
note originally named, was dropped by plan 252), so nothing read the script PDF
any more.
```

**5c** — `SCRIPT-INSTRUCTIONS.md` **contradicts itself about the lexicon table**,
and this is the one leftover in Step 5 that could produce a wrong artifact rather
than just a wrong sentence.

Section 1 (rewritten by plan 252) says:

> `script.md` carries **no** lexicon table. It used to, and that meant the
> respelling existed in two places. One source only (plan 252, 2026-08-26).

But section 4's `script.md` skeleton, which is what step 100 actually copies,
still opens with one:

```markdown
# <video title> — final VO script

## Pronunciation lexicon
| ... |

## Part A — Introduction
```

Plan 252 rewrote section 1 and missed the skeleton in section 4. A step-100
session following the skeleton emits the table section 1 forbids — and the
pronunciation then exists in two places again, which is the exact thing plan 252
set out to end.

Delete the two skeleton lines so it reads:

```markdown
# <video title> — final VO script

## Part A — Introduction
```

Nothing else in that fenced block changes.

**Verify**: `cd pipelines/youtube/yt-script && ! grep -q "^## Pronunciation lexicon" SCRIPT-INSTRUCTIONS.md && grep -q "carries \*\*no\*\* lexicon table" SCRIPT-INSTRUCTIONS.md && echo CONSISTENT`
-> prints `CONSISTENT`

**Verify**: `cd pipelines/youtube/yt-script && node --test test/*.test.mjs && node lib/build-script-json.test.mjs`
-> exit 0; **58** then 8 passing

### Step 6: Record the decision

Append one dated entry to the repo root `decisions.md` covering:

- Why four rules moved out of `SCRIPT-INSTRUCTIONS.md`: it is a format spec and
  they are judgement; a preference with no recorded origin cannot be retired.
- That one of them was stated twice in the same file, in two sections, which is
  the concrete cost the split removes.
- That the supplied synthesis line ("none of these are bad, they're just built
  for different priorities") was **deleted rather than migrated**, because a rule
  satisfied by pasting one sentence is a template and `TASTE.md` T1 forbids it.
- That T2-T5 are **seeded, not folded** — no `FEEDBACK-LOG.md` row and no owner
  reaction quote, following `TASTE-SIMPLE.md`'s precedent of saying so in the
  header rather than faking a provenance.
- That `OUTLINE-INSTRUCTIONS.md` was audited and left alone, and that its
  by-factor comparison rule is structure, not taste, because the scorecard
  depends on it.
- That plan 252's `steps/110-approve-script-human` out-of-scope call was wrong,
  and that plan 252's zero-`script.vo.txt`-matches done criterion was
  unsatisfiable against its own step-120 requirement.
- That plan 252 rewrote `SCRIPT-INSTRUCTIONS.md` section 1 to forbid the
  lexicon table but left section 4's `script.md` skeleton still emitting one,
  so the file contradicted itself and a compliant step-100 session would have
  reintroduced the two-sources-of-pronunciation bug 252 existed to remove.
  The lesson: a rewrite that changes what a file FORBIDS has to sweep every
  template and example in that same file, not only the prose stating the rule.

**Verify**: `awk '/2026-08-26/{n++} END{exit !(n>=2)}' decisions.md && echo OK`
-> prints `OK` (the 253 entry plus this one)

## Test plan

- **Extended**: `test/feedback-surfaces.test.mjs` gains one test, 7 -> 8. It
  asserts both directions, which is the part that matters: the migrated fragments
  are **absent** from all three format files **and present** in `TASTE.md`. A
  one-directional check would pass if a crew deleted the rules instead of moving
  them.
- **Unchanged**: the other 6 suites in `test/`, and `lib/build-script-json.test.mjs`.
  Total goes 57 -> 58.
- **Mutation gate**: reinserting T4's original sentence into
  `SCRIPT-INSTRUCTIONS.md`'s Voice-and-tone list must fail
  `test/feedback-surfaces.test.mjs` printing `TASTE_IN_FORMAT_FILE`.
- **Not tested**: whether the migrated wording reads better than the original.
  That is the owner's judgement, and the rules are quoted from his own file
  precisely so he can compare.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script && node --test test/*.test.mjs` exits 0 with
      `# fail 0` and **58** passing.
- [ ] `cd pipelines/youtube/yt-script && node lib/build-script-json.test.mjs`
      exits 0 with 8 passing.
- [ ] `cd pipelines/youtube/yt-script && node --test test/feedback-surfaces.test.mjs`
      exits 0 with **8** tests.
- [ ] `grep -c '^## T[0-9]' pipelines/youtube/yt-script/TASTE.md` -> `5`.
- [ ] Every one of `T2`, `T3`, `T4`, `T5` in `TASTE.md` has a `**From:**`, an
      `**Applies to:**` and an `**Enforced by:**` line (the existing rule-format
      test covers this — confirm it is counting 5 rules, not 1).
- [ ] `cd pipelines/youtube/yt-script && grep -c "Casual-professional\|earn the criticism after\|not \"it depends\"\|they're just built for different priorities" SCRIPT-INSTRUCTIONS.md`
      exits 1 (zero matches).
- [ ] `grep -rc "script.vo.txt" pipelines/youtube/yt-script/steps/110-approve-script-human/`
      exits 1 (zero matches).
- [ ] `grep -c "script.vo.txt" pipelines/youtube/yt-script/lib/build-script-json.mjs pipelines/youtube/yt-script/steps/120-voiceover-run/README.md`
      -> `1` each. The correct history is still there.
- [ ] `cd pipelines/youtube/yt-script && grep -c '^## Pronunciation lexicon' SCRIPT-INSTRUCTIONS.md`
      exits 1 (the skeleton no longer emits the table section 1 forbids).
- [ ] `decisions.md` has a second 2026-08-26 entry.
- [ ] `git diff --stat 605bcf04..HEAD --name-only` lists no file outside this
      plan's in-scope list.

## STOP conditions

- **A gate assertion fails: fix the code or the fixture. Weakening, swapping,
  skipping or deleting an assertion is a STOP.**
- You are about to migrate a fifth rule. Exactly four move, and they are quoted
  in full under "Current state". Anything else you think is taste — including
  `OUTLINE-INSTRUCTIONS.md`'s by-factor comparison rule — is the owner's call,
  not yours. Report it and stop.
- You are about to write an owner quote for T2-T5. There isn't one. These are
  seeded rules and `From:` cites the instruction file; inventing a reaction quote
  is worse than having none, because it makes a fabricated provenance look real.
- You are about to move the supplied synthesis line into `TASTE.md`. It is
  deleted, not migrated. If that feels wasteful, re-read `TASTE.md` T1.
- You are about to delete one of the three correct-history `script.vo.txt`
  mentions (`lib/build-script-json.mjs`, step 120's README and step.json). They
  explain why step 120 was rewritten. Only the two stale ones in Step 5 change.
- You are about to open `SCRIPT-PLAN-INSTRUCTIONS.md`. Nothing in this plan
  touches it, and its forms are parsed — an edit there can break `lib/beats.mjs`
  silently.
- The `Six owner gates:` sentence in SKILL.md seems to need changing. It does
  not; no step is added or removed here.

## Maintenance notes

- **The MIGRATED fragment list in the test is the anti-drift mechanism, and it is
  also its own weak point.** It matches exact substrings, so a paraphrase of T4
  reintroduced into `SCRIPT-INSTRUCTIONS.md` passes. That is deliberate — a
  fuzzy check would block legitimate cross-references like the T3 pointer added
  in Step 2d. If leaks by paraphrase start happening, the fix is a review habit,
  not a cleverer regex.
- **T2-T5 being seeded matters for retirement.** A folded rule can be retired
  when the owner stops caring about the thing he reacted to. A seeded rule has no
  such trigger, so these four will need an explicit owner decision to retire.
  That is the honest cost of seeding, and it is why the block header says so.
- **T4 absorbed a duplicate, so retiring it removes a rule from two places.**
  Whoever retires it should check that "Honest Verdict, weakest to strongest" in
  `SCRIPT-INSTRUCTIONS.md` still makes sense on its own. It does today.
- **`TASTE.md` now has five rules and one of them (T1) governs the other four.**
  If T1 is ever retired, re-read T2-T5 — T5 in particular exists in its current
  shape because T1 forbids template copy.
- **The section-1-versus-section-4 contradiction is the interesting defect in
  this batch.** Every gate was green, both suites passed, and a step-100
  session doing exactly what the file said would still have emitted a lexicon
  table. Prose rules and the templates beside them are two surfaces, and a
  test over the prose cannot see the template. Worth a check if it recurs:
  assert that no fenced `script.md` skeleton in this file contains a heading
  the prose forbids.
- A reviewer should scrutinise: that Step 2c really renumbered the Closing
  convention items rather than leaving a gap, and that the Step 2a replacement
  did not also drop the first-person bullet, which stays.
