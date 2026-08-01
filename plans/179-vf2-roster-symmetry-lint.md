---
executor: claude-p
model:
test_cmd: cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs lib/lint-concept.test.mjs && node lib/check-rulebook.mjs && bash scripts/check.sh && node lib/lint-cues.mjs best-ai-video-generator
ui:
deploy:
needs: ["shares lib/lint-cues.mjs with 175 and 177, and lib/cue-rules.mjs with 177. Claims E-codes E14 and E15 — 175 claims E12, so the codes do not collide, only the file regions do. Boss resolves the concat."]
---

# Plan 179: vf2 roster symmetry lint

## Summary

- **Problem statement**: "Every compared item gets the same treatment" is the owner's most-repeated note (five separate comments across two reviews) and it lives only as prose in the rulebook, where it has now failed twice. Nothing counts the roster.
- **Goals**: Turn per-item symmetry into a lint error by giving the concept a machine-readable item list and checking every per-item slot against it.
- **Executor proposed**: claude-p, sonnet — small surface, but the failure semantics need care.
- **Done criteria** (terse): a video that gives 4 of 5 tools a section opener fails lint with both the card and the missing item named.
- **Stop conditions** (terse): the lint fires on a video that is actually correct.
- **Test / verification for success**: a fixture at 4-of-5 fails; the corrected `best-ai-video-generator` passes.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow-2/lib/lint-cues.mjs pipelines/video/visuals-flow-2/lib/cue-rules.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

The owner's symmetry note, in their own words, across two reviews of one video:

- "you used a different template to show synthesia. But for later tools, I think you use the section card. Why is that? I think I was very clear and I have said this multiple times that I want symmetry"
- "here you have used section card here but for synthesia you used some other card. Why this happened? I have said this multiple times and it again happened."
- "if you have shown this template for open art, I think you should have shown this template for everything else. Right? It's not symmetrical ... Is the Q decider LLM badly working?"
- "why no logo.."
- "we could have kept section card for main overview points and each tool section cards could be different template. Currently you used same card for a specific tool like 'OpenArt' as well as category like 'Pricing'"

Two rounds of prose rules have not held, and each round the prose was technically satisfied while the video was still wrong:

- Round 1 (2026-08-01) discovered that `CAP_FULLFRAME = 3` and `R_STRUCTURAL` directly contradict each other on any comparison wider than three. The fix made structural cards cap-exempt and told the model the series beats the cap.
- Round 2 (2026-08-02) found the body still at 4 of 5 tools, with the fifth skipped because its boundary fell inside demo footage, and the same card doubling as the Pricing divider. `R_STRUCTURAL` was satisfied throughout, because `section/section-card-flip` IS structural and the rule only demanded sameness. It never demanded completeness, and it never forbade one card carrying two meanings.

Prose cannot count. A lint can. The blocker is that the roster exists only inside an English sentence: `concept.json`'s `throughline.description` reads "A five-slot candidate roster: one card per tool (OpenArt, Higgsfield, Synthesia, HeyGen, Arcads)". Nothing machine-readable.

## Current state

- `videos/<slug>/concept.json` — `{ video, thesis, frame, throughline: { name, description, evolution }, registers }`. No item list.
- `lib/lint-concept.mjs` — validates the concept; the place to require the new field.
- `lib/lint-cues.mjs` — where E-codes live; E5 was extended on 2026-08-02 with a `section-opener` role carve-out and is the nearest neighbour.
- `lib/cue-rules.mjs` — `R_STRUCTURAL` already carries the prose version of both new rules, added 2026-08-02. The lint replaces trust with enforcement; keep the prose.
- `pipelines/video/card-library/catalog.json` — `roles: ["section-opener"]` now exists on `section/section-card-flip` and `section/tool-intro`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Concept lint | `node lib/lint-concept.mjs best-ai-video-generator` | exit 0 |
| Cue lint | `node lib/lint-cues.mjs best-ai-video-generator` | exit 0, no E-codes |
| Unit tests | `node --test lib/lint-cues.test.mjs lib/lint-concept.test.mjs` | exit 0 |
| Rulebook | `node lib/check-rulebook.mjs` | `rulebook ok` |

## Scope

**In scope**:
- `throughline.items` in the concept schema, plus its lint and its prompt instruction.
- Two new cue lint codes: per-item completeness, and one-card-one-meaning.
- Backfilling `throughline.items` for `best-ai-video-generator`.
- Tests for both codes, including the false-positive cases.

**Out of scope**:
- Any change to `CAP_FULLFRAME` or the structural exemption.
- Auto-fixing a detected asymmetry. The lint reports; the cue pass fixes.
- Videos that are not comparisons. Absent `throughline.items`, both codes stay silent.

## Git workflow

- Branch: `advisor/179-vf2-roster-symmetry-lint`
- Commit: `feat(vf2): lint per-item slot completeness and card-role exclusivity` — no AI footers. Do NOT push.

## Steps

### Step 1: Add `throughline.items` to the concept

Extend the concept schema with an optional `throughline.items: string[]` — the compared items, in the order the video takes them. In `lib/lint-concept.mjs`, require it when the throughline description or the thesis names a count ("five-slot", "5 way comparison"), and error when the declared count and the array length disagree.

Update the concept-pass prompt so the field is authored from the start.

Backfill `videos/best-ai-video-generator/concept.json` with `["OpenArt","Higgsfield","Synthesia","HeyGen","Arcads"]`.

**Verify**: `node lib/lint-concept.mjs best-ai-video-generator` -> exit 0.

### Step 2: Detect which cues fill a per-item slot

Add a helper to `lib/lint-cues.mjs`: for each fullframe card used two or more times, work out which roster item each of its cues is about, by matching `items[]` case-insensitively against the cue's `variables.name`, `variables.title`, and any single-string label field.

A card is a PER-ITEM SLOT when at least two of its cues match distinct roster items. Anything below that is an ordinary repeated card and neither new code applies.

**Verify**: a scratch script over `best-ai-video-generator` identifies `section/tool-intro` as a per-item slot (body openers and conclusion verdicts) and does not flag `overlay/tip-banner`.

### Step 3: E-code for completeness

For each per-item slot, error when it covers some but not all roster items. Name the card, the items covered, and the items missing:

```
E14 slot-incomplete: section/section-card-flip fills a per-item slot for 4 of 5 roster
items (OpenArt, Higgsfield, Synthesia, Arcads) — HeyGen has none. A per-item slot is
complete or absent, never partial. A section-opener card may cover up to 8s of demo
footage (E5 exempts it), so a boundary inside a screen recording is not a reason to
skip an item.
```

The message must name the missing item. "Not symmetrical" without a name is what the owner has been writing by hand five times.

**Verify**: a fixture with 4 of 5 fails carrying `HeyGen` in the message; the corrected `best-ai-video-generator` passes.

### Step 4: E-code for exclusivity

For each per-item slot, error when any cue using the SAME card does not match a roster item — that card is serving two meanings at once.

```
E15 slot-shared: section/section-card-flip fills a per-item slot (OpenArt, Higgsfield,
Synthesia, Arcads) AND is used for "Pricing", which is not a roster item — a viewer
cannot tell a tool from a category. Give the per-item slot the tool-branded card and
leave the plain one for categories.
```

Guard the false positive: a card used once for an item and once for something unrelated is not a slot at all. Step 2's two-distinct-items threshold already handles this; add a test that proves it.

**Verify**: a fixture reproducing the pre-fix state (section-card-flip on four tools plus Pricing) fails with both E14 and E15; the current state passes.

### Step 5: Mutation-proof both codes

The gate must be shown to fail before it is trusted.

- Temporarily rewrite `videos/best-ai-video-generator/cues.json` so c37 (HeyGen) goes back to `overlay/lower-third`. `node lib/lint-cues.mjs best-ai-video-generator` -> MUST fail with E14 naming HeyGen. Revert.
- Temporarily point c53 (Pricing) at `section/tool-intro`. -> MUST fail with E15. Revert.

Record both failure messages in the PR body.

**Verify**: both mutations fail, both reverts pass.

### Step 6: Cross-check the zone pass

The conclusion's per-tool verdicts are authored by the zone pass, which reads `lib/zone-rules.mjs`. Confirm the new codes run over zone cues too, since round 1's fix went into the zone rulebook and left the body untouched — the exact split this plan exists to make impossible.

**Verify**: deleting one of z08-z13 from `cues.json` fails E14. Revert.

## Test plan

`lib/lint-cues.test.mjs` gains: 5-of-5 passes; 4-of-5 fails naming the missing item; a card used once per item plus once for a non-item fails E15; a card used twice for the SAME item does not make a slot; a video with no `throughline.items` stays silent on both codes; zone cues participate.

`lib/lint-concept.test.mjs` gains: a stated count disagreeing with `items.length` errors.

## Done criteria

- [ ] `throughline.items` is in the concept schema, its lint, and the concept prompt
- [ ] `best-ai-video-generator/concept.json` carries the five items
- [ ] E14 names every missing item; E15 names the offending non-item value
- [ ] Both Step 5 mutations fail and both reverts pass, with messages in the PR body
- [ ] Step 6 shows the codes cover zone cues as well as body cues
- [ ] `node lib/lint-cues.mjs best-ai-video-generator` -> exit 0, no E-codes
- [ ] `bash scripts/check.sh` -> `visuals-flow check OK`

## STOP conditions

- The item-matching in Step 2 needs fuzzy matching or an LLM call. Stop and re-plan; if a card cannot be tied to an item by an exact label match, the data model is the thing to fix.
- The lint fires on a video that is genuinely correct. Report the case rather than loosening the threshold.
- Making the codes pass would mean weakening E5's 8s section-opener carve-out. That carve-out is what makes completeness reachable; if it is in the way, something else is wrong.

## Maintenance notes

- Round 1 wrote the per-item rule into `zone-rules.mjs` only, which fixed the conclusion and left the body broken for another whole review cycle. Any future symmetry work goes in the lint, which sees both.
- `R_STRUCTURAL` and `R_ZONE_STRUCTURAL` keep their prose. The lint is a backstop for when the model does not follow it, not a replacement for telling it.
