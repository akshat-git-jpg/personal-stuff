# yt-script — folder guide

The flow itself lives in the skill: `pipelines/.claude/skills/yt-script/SKILL.md`.
This file is the folder map. Read the skill first — it owns the step table and
the gates; this only says where things are.

## The flow is thirteen step folders

```
steps/
  010-take-knowledge-llm/        020-approve-knowledge-human/
  030-write-outline-llm/         040-approve-outline-human/
  050-write-script-draft-llm/    055-review-plan-md-human/
  060-review-local-desk-human/   070-publish-desk-run/
  080-freelancer-writes-human/   090-pull-draft-run/
  100-write-script-llm/          110-approve-script-human/
  120-voiceover-run/
```

Each holds a `step.json` (the machine record — actor, what it reads, what it
writes) and a `README.md` (what to actually do). Kinds are `llm`, `run`, `human`.
Six human gates: 020, 040, 055, 060, 080, 110.

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

npm run dev:local                  # 060 — review at localhost:5175/?key=<key>
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
lib/beats.mjs                 script-plan.md -> the typed beat model the desk reads
render-worksheet.mjs          script-plan.md -> script-worksheet.md (voiceover only) — desk-down fallback
render-outline.mjs            RETIRED 2026-08-23 — not called by any step
render-script.mjs             RETIRED 2026-08-23 — not called by any step
steps/                        the thirteen step folders
test/                         beats, worksheet, steps, desk-docs
videos/<key>/                 one folder per video
```

### Inside `videos/<key>/`

```
knowledge.md        010 — every source, as TEXT. The only input later steps read
sources/            010 — the originals. Provenance, tracked
outline.md          030 — one page, sections + one line each. The direction
script-plan.md      050 — the beat-by-beat document; reviewed as markdown at 055, published by the desk
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
conclusion copy plus 25+ beats with `SAY`/`SHOW`/`EDIT`/`FACTS` lanes, which is a
draft script. Approving "the outline" therefore meant reading a finished
document, and a wrong section order cost a full rewrite.

`outline.md` is now a genuinely new, one-page document written at step 030 and
approved at 040 — sections and one line each, no spoken copy, no lanes. The names
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
  recognise. Two files in `videos/` are still in that state:
  `ai-avatar-online-courses` and `ai-video-tools-comparison`.
- **A body beat's `SAY` is a draft prompt, never finished copy.** It reaches the
  desk as **What to cover** in the instruction track — something he reads, not a
  line he can paste. Enforced by `BODY_DRAFTS_ARE_INSTRUCTIONS` in `lib/beats.mjs`
  and its mutation gate.
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
