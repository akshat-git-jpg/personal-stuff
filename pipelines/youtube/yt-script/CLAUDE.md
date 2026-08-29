# yt-script — folder guide

The flow itself lives in the skill: `pipelines/.claude/skills/yt-script/SKILL.md`.
This file is the folder map. Read the skill first — it owns the step table and
the gates; this only says where things are.

## The flow is fourteen step folders

```
steps/
  010-take-knowledge-llm/        020-approve-knowledge-human/
  030-write-outline-llm/         040-approve-outline-human/
  050-write-script-draft-llm/    055-review-plan-human/
  070-publish-desk-run/          080-freelancer-writes-human/
  090-pull-draft-run/
  100-write-script-llm/          110-approve-script-human/
  120-voiceover-run/             130-learn-from-feedback-llm/
```

Each holds a `step.json` (the machine record — actor, what it reads, what it
writes) and a `README.md` (what to actually do). Kinds are `llm`, `run`, `human`.
Five human gates: 020, 040, 055, 080, 110.

**Changing a step is local.** Edit its README. Adding one is a new folder plus a
row in SKILL.md's table — `test/steps.test.mjs` fails if the two disagree.

## The chain

```
knowledge.md  ->  outline.md   ->  script-plan.md  ->  script-draft.md  ->  script.md
  (010)           (030)            (050)               (090, his words)     (100)
```

The handoff is the **script desk** (`apps/yt-script-desk`), not a PDF:

```bash
cd apps/yt-script-desk
set -a && . ../../infra/secrets/script-desk.env && set +a

npm run dev:local                  # 055 — review at localhost:5175/?key=<key>
node bin/desk.mjs publish <key>    # 070 — prints the freelancer's secret URL
node bin/desk.mjs list             # every published video and its link
node bin/desk.mjs pull <key>       # 090 — his draft back as script-draft.md
```

```bash
bash run.sh <key> status            # stage, sections, how many locked
bash run.sh <key> vo                # 120 - synth every unlocked section
bash run.sh <key> vo --only s03     # re-roll one
bash run.sh <key> vo-lock           # lock what you have listened to
```

## Files in this folder

```
OUTLINE-INSTRUCTIONS.md       owner-owned — the only authority on outline format
SCRIPT-PLAN-INSTRUCTIONS.md   owner-owned — the only authority on script-plan format
SCRIPT-INSTRUCTIONS.md        owner-owned — the only authority on final script format
TASTE.md                      130 — accumulated taste rules, numbered and dated
FEEDBACK-LOG.md               130 — every reaction, tagged. The repeat-detection index
lib/beats.mjs                 script-plan.md -> the typed beat model the desk reads
render-worksheet.mjs          script-plan.md -> script-worksheet.md (voiceover only) — desk-down fallback
render-outline.mjs            RETIRED 2026-08-23 — not called by any step
render-script.mjs             RETIRED 2026-08-23 — not called by any step
steps/                        the fourteen step folders
test/                         beats, worksheet, steps, desk-docs, feedback-surfaces
videos/<key>/                 one folder per video
```

### Inside `videos/<key>/`

```
knowledge.md        010 — every source, as TEXT. The only input later steps read
sources/            010 — the originals. Provenance, tracked
outline.md          030 — contents + a card per section. The direction
script-plan.md      050 — the beat-by-beat document; reviewed at 055 as markdown AND in the desk, then published
script-worksheet.md fallback only, if the desk is down
desk-draft.json     local-mode scratch, gitignored
script-draft.md     090 — the maker's completed work, verbatim. Provenance, tracked
script.md           100 — the final VO script
script.json         100 - the per-section engine feed; step 120's input
respell.json        100 - pronunciation map, applied at synth time
audio/              120 - generated wavs, gitignored
```

## Renamed on 2026-08-23

`outline.md` → **`script-plan.md`**, and `OUTLINE-INSTRUCTIONS.md` →
**`SCRIPT-PLAN-INSTRUCTIONS.md`**.

The old `outline.md` was never an outline: it carried verbatim intro and
conclusion copy plus 25+ beats with `SAY`/`VIDEO`/`FACTS` lanes, which is a
draft script. Approving "the outline" therefore meant reading a finished
document, and a wrong section order cost a full rewrite.

`outline.md` is now a genuinely new, one-page document written at step 030 and
approved at 040 — contents plus a card per section, no spoken copy, no lanes. The names
finally mean what they say.

`lib/beats.mjs`, the desk's local server, the Worker and the tests all read
`script-plan.md` now.

## Gotchas

- **The script plan is PARSED, not just rendered.** `lib/beats.mjs` recognises the
  exact forms in `SCRIPT-PLAN-INSTRUCTIONS.md`. An unrecognised form falls through
  to plain prose **silently** — no error, no lane. Getting a form wrong does not
  fail anything; it produces a worse document that looks fine at a glance.
- **A pre-spec outline is refused, not half-parsed.** Files written before the
  format settled use `### 1. Cold Open` and `**Voiceover**`. `buildBeats` throws
  `LEGACY_OUTLINE_FORMAT` rather than returning the handful of beats it happens to
  recognise. No such file is left in
  `videos/` — the two that were (`ai-avatar-online-courses`,
  `ai-video-tools-comparison`) went with the older scripts on 2026-08-28. The
  guard stays, on an inline fixture in `test/beats.test.mjs`, because the next
  hand-written plan can land in that shape again.
- **A section-level `FACTS` block belongs to the section, and lands on its FIRST
  beat.** A `FACTS` block written between a `### SECTION:` heading and that
  section's first `####` beat is section context. It attaches once, to the first
  beat, and not to every beat the way `RULES` does. Until 2026-08-28 it was
  dropped silently — eleven sections' worth of research that never reached the
  desk. Guarded by `SECTION_FACTS_DROPPED` and `SECTION_FACTS_REPEATED` in
  `test/beats.test.mjs`.
- **`**ASK**` is the owner's own open question, and it never leaves this repo.** A
  question for Claude, written in the markdown while he reviews. It renders as a
  purple card in the desk's left track; `buildWorksheet` cannot emit it, and
  `desk.mjs publish` refuses while any remain (`--force` overrides and strips the
  field anyway). It exists INSTEAD of a browser markup UI — the owner edits the
  markdown in his editor, and this was the only gap. Do not grow it into one:
  `SCRIPT-PLAN-INSTRUCTIONS.md`, "Why this instead of an editing UI".
- **The body has TWO levels and a card is a LEAF.** `### SECTION:` is a broad
  section. If it carries its own `**NOTES**` it is one card, numbered `1`, `2`. If
  it carries `####` subsections instead, each of those is a card, numbered `3.1`,
  `3.2`. A leaf card is SYNTHESIZED from the section by `lib/beats.mjs`, so a
  section with neither a `NOTES` lane nor subsections produces nothing — silently.
  Guarded by `CARD_DROPPED`, `CARD_ATE_A_BEAT` and `SUBSECTION_NUMBERING`. Rules:
  `TASTE.md` T13 (cards), T14 (two levels), T15 (search-friendly names).
- **Body `####` headings carry no number; intro and conclusion beats carry
  LETTERS.** `#### A1 · Cold open`, `#### C1 · Wrap and sign-off`. A body section
  numbered 3 with subsections produces `3.1`, and `draft`, `says` and `edits` are
  all keyed on the number — a conclusion beat numbered `3.1` would share the
  subsection's write box. Guarded by `DUPLICATE_BEAT_NUM`.
- **Every plan opens with a `## Contents` block**, matching its headings exactly.
  The desk builds its own from the headings and never reads the block; the block
  is for whoever opens the file. `CONTENTS_DRIFT` keeps the two the same.
- **The desk shows ONE instruction block, headed `Notes`.** `notes`, `angle`,
  `video`, `rules` and `facts` are all folded into it, in that order, so an older
  plan loses nothing. The three separate blocks and their three chips went on
  2026-08-29.
- **A body beat's `SAY` is a draft prompt, never finished copy.** Only older plans
  have one. It reaches the desk inside the `Notes` block — something he reads, not
  a line he can paste. Enforced by `BODY_DRAFTS_ARE_INSTRUCTIONS` in
  `lib/beats.mjs` and its mutation gate.
- **`script-draft.md` is never edited in place.** It is his words. Yours go in
  `script.md`.
- **`PREFILLED_DRIFT`** in the worksheet tests means the worksheet's pre-filled
  blocks are no longer byte-identical to `script-plan.md`.
- Generated HTML and PDF are gitignored, and nothing generates them any more.

## Tests

```bash
cd pipelines/youtube/yt-script
node --test test/beats.test.mjs test/worksheet.test.mjs test/steps.test.mjs test/desk-docs.test.mjs
```

`test/steps.test.mjs` is the one that keeps the docs honest: it fails if the step
folders and SKILL.md's table disagree, if a gate is misnamed, if publishing is
ordered before the local review, or if a render step comes back.
