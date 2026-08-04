---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh
ui: true
deploy:
needs: [plan 157 builds enacted/bad-clip-montage, the fourth member of this family]
---

# Plan 161: The intro card family — promise, audience, proof

## Summary

- **Problem statement**: The strongest moments of an intro currently render as text slates. "By the end you will know exactly which one is worth using" and "for creators, podcasters, coaches and educators" both land on `statement/keyword-statement` — a sentence on a background. The library has no device that DOES either job, and none at all for the credibility beat ("I tested both on the same footage"), which strong tutorial intros rely on.
- **Goals**: three new cards the cue pass can reach for in any intro, sharing one visual language.
  - `statement/promise-payoff` — what the viewer will be able to decide by the end.
  - `checklist/audience-fit` — who this video is for, as persona chips.
  - `section/proof-of-work` — how the comparison was actually run.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner-specified.
- **Done criteria** (terse): `bash scripts/check-cards.sh` exits 0; each card rendered and visually confirmed to show its device, not a title.
- **Stop conditions** (terse): any card renders as heading-only; a card duplicates an existing one's job.
- **Test / verification for success**: `card-qa.mjs` contact sheets plus a mandatory rendered-frame inspection per card.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12646f6..HEAD -- pipelines/video/card-library/catalog.json`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (157 is a sibling, not a blocker)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `12646f6`, 2026-07-28

## Why this matters

The owner: *"Intro and Conclusion are most important and I want best quality there... I am ok if we need to make new motion graphics."*

Plan 160 deliberately does NOT require an intro to contain particular cards — what an intro needs is a judgment call about that script. But judgment is only as good as the options available, and right now the cue pass reaching for "the strongest device that fits" finds a text slate for three of the intro's most important beats. `R_CHOOSING` already instructs the model to prefer `enacted/` devices and to PROPOSE A NEW CARD when none fits; this plan supplies the cards so that instruction has somewhere to land.

**Scope honesty**: the intro family is four cards, and this plan builds three. `enacted/bad-clip-montage` (the hook) was built by plan 157 and has already landed (PR#115). The contrast beat ("one focuses on speed, the other on output you can publish") is already served by the existing `enacted/promise-split`, and the roadmap beat by `table-of-contents/table-of-contents` — neither needs rebuilding. Do not create a fourth card here to round the number up.

**Known failure mode for card plans.** `plans/runs/LESSONS.md`, 2026-07-24: *"plan 137's crew shipped all 12 enacted cards as 76-line title-only stubs and every gate passed: check-cards/lint/existence checks are content-blind. Card plans need a rendered-frame inspection gate (extract frames at beat times and LOOK)."* Step 5 is that gate, per card, and is not optional.

## Current state

**What these beats render as today**, from `videos/test-03/cues.json`:

- c03 `statement/keyword-statement`, variables `{ text: "For creators repurposing long-form content without babysitting every clip." }` — the audience beat, as a sentence.
- The promise beat ("by the end of this video you will know exactly which one is worth using") gets no card at all; it is absorbed into c02's 24.3s hold.

**Card skeleton** — one folder per card, `<type>/<card-name>/index.html`, Hyperframes HTML + GSAP. From `enacted/before-after/index.html`, verbatim (lines 73–76):

```html
    <div id="root" data-composition-id="before-after" data-start="0" data-duration="6" data-width="1920" data-height="1080"
      data-composition-variables='{"title":"Migration","before_label":"Legacy",...}'>
      <div id="bg" class="clip" data-start="0" data-duration="6" data-track-index="0"></div>
      <div id="frame" class="clip" data-start="0" data-duration="6" data-track-index="1">
```

and its variable defaults (lines 105–107):

```js
        register: VARS.register ?? 'dark',
        variant: VARS.variant ?? 'a',
        marker: VARS.marker ?? false,
```

**Ambient motion** — `scripts/card-qa.mjs` hard-fails listed cards missing the `/* hf-ambient */` marker; `before-after` satisfies it with (lines 68–69):

```css
      @keyframes hf-ambient-breathe { from { transform: scale(1); } to { transform: scale(1.012); } }
      #frame { animation: hf-ambient-breathe 6s ease-in-out alternate infinite; /* hf-ambient */ }
```

Include ambient in all three cards.

**Palette** (`DESIGN.md` owns it — exact values):

| token | value | use |
|---|---|---|
| `--bg-from` | `#3a1f08` | radial gradient origin (burnt amber), ellipse ~30% 20% |
| `--bg-to` | `#0a0805` | near-black warm undertone; page background `#000` |
| `--text` | `#ffffff` | primary text |
| `--accent` | `#fb923c` | THE accent |
| positive | `#34d399` | pros/wins ONLY |
| negative | `#fb7185` | cons ONLY |
| gold | `#facc15` | winner moments only |

Rules: dark warm background always; ONE orange accent per card; green/rose reserved for pros/cons.

**Contracts every new fullframe card must satisfy** (`scripts/check-cards.sh` runs all of these):
- `catalog.json` entry with matching `slug` (otherwise the cue pass can never select it)
- a boolean `side` on every fullframe entry (`check-side.mjs`)
- `check-type-scale.mjs`: `hero_shape` is one of `short` | `prose` | `none`. `none` means the card must NOT declare `--hero-size`; `short` requires `--hero-size` ≥120px and ≥2.5× the next-largest text; `prose` lowers the floor to 60px.

**Registration is two independent things** (`card-library/CLAUDE.md`): the folder makes it visible in the render2 Templates tab; the catalog entry makes it selectable. A card is only real once **pushed** — the tab is a live directory scan.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0, `card check OK` |
| Lint one card | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint <slug>` | no errors (font / drag-edit warnings expected) |
| Contact sheet | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug>` | sheet written, exit 0 |
| Render | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render <slug> -o /tmp/<name>.mp4` | mp4 written |
| Frame | `ffmpeg -v error -ss <T> -i /tmp/<name>.mp4 -frames:v 1 /tmp/<name>-<T>.png -y` | png written |

## Scope

**In scope** (new files + one catalog edit):
- `pipelines/video/card-library/statement/promise-payoff/index.html`
- `pipelines/video/card-library/checklist/audience-fit/index.html`
- `pipelines/video/card-library/section/proof-of-work/index.html`
- `pipelines/video/card-library/catalog.json` (three new entries)

**Out of scope**:
- `enacted/bad-clip-montage` — plan 157 owns it.
- Any existing card, including `statement/keyword-statement`. It stays; these are additions, not replacements.
- `pipelines/video/visuals-flow/**` — no cue rules here. Plan 160 handles zone guidance, and per the owner no rule may require a particular card in the intro.
- `gallery-order.json` — ordering only, not a whitelist.

## Git workflow

- Branch: `advisor/161-cards-intro-family`
- Commit: `feat(cards): intro family — promise-payoff, audience-fit, proof-of-work` — no AI footers. Do NOT push.

## Steps

### Step 1: `statement/promise-payoff`

**Job**: the viewer sees the decision they will be able to make by the end.

**Device**: a centred question in `--text` (e.g. "Which one ships clips you can actually post?"), with two answer plates beneath it that resolve on beats — each plate is a candidate with a lock icon that flips to a check on its beat, and a final beat lights ONE plate in `--accent`. It shows a decision being made, not a sentence about a decision.

Scaffold by copying `enacted/before-after/index.html`, set `data-composition-id="promise-payoff"`, `data-duration="7"` on `#root` and every `.clip`.

`hero_shape`: `short` — the question IS the hero, so declare `--hero-size` at **120px** minimum and keep every other text element at most 48px so the ≥2.5× ratio holds.

Default variables:

```json
{"question":"Which One Ships Clips You Can Post?","options":[{"label":"Speed first"},{"label":"Publish ready"}]}
```

**Verify**: `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint statement/promise-payoff 2>&1 | tail -3` -> no errors

### Step 2: `checklist/audience-fit`

**Job**: who this video is for.

**Device**: a row of persona chips (icon tile + label) that land one per beat, left-aligned on a shared left edge, with a single summarising line beneath in `--accent`. Reuse the icon-tile treatment from `checklist/icon-pills` — read that card and match its tile size, radius and left-edge alignment exactly; the owner has already corrected that card twice for alignment ("logos should be in one line") and this card must not reintroduce the same defect.

`data-composition-id="audience-fit"`, `data-duration="7"`.

`hero_shape`: `none` — this is a parallel list with no hero. **Do not declare `--hero-size`.**

Default variables:

```json
{"title":"Who This Is For","personas":[{"label":"Creators","icon":"person"},{"label":"Podcasters","icon":"chat"},{"label":"Coaches","icon":"brain"},{"label":"Educators","icon":"calendar"}]}
```

Use only icon names already present in the catalog's existing `icon` enums — read one (e.g. `enacted/pipeline-flow`) and pick from that list. Do not invent icon names.

**Verify**: `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint checklist/audience-fit 2>&1 | tail -3` -> no errors

### Step 3: `section/proof-of-work`

**Job**: why the viewer should believe the comparison — the test setup.

**Device**: three or four stat plates that count up on their beats (e.g. "1 video", "2 tools", "same footage", "0 manual fixes"), arranged on a single baseline, with a caption line above naming the method. One plate's number carries `--accent`; the rest are `--text`.

`data-composition-id="proof-of-work"`, `data-duration="8"`.

`hero_shape`: `none` — parallel stat plates, no single hero. **Do not declare `--hero-size`.**

Default variables:

```json
{"method":"Same Footage, Both Tools","facts":[{"value":"1","label":"long-form video"},{"value":"2","label":"tools tested"},{"value":"0","label":"manual fixes allowed"}]}
```

**Verify**: `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint section/proof-of-work 2>&1 | tail -3` -> no errors

### Step 4: Register all three in the catalog

Add three entries to `catalog.json`. **Insert them as text within their type groups — do not re-serialize the file.** The catalog escapes some hyphens as `-`; a `JSON.stringify` round-trip un-escapes them and buries the real change in a 100+ line diff.

Each entry must carry: `slug`, `kind: "beat"`, `placement: "fullframe"`, `side` (boolean), `hero_shape` as specified above, `purpose`, `intent`, `anti_intent`, a `variables` schema matching the defaults in Steps 1–3, `default_duration` (7 / 7 / 8), and `register`.

`side` values — these are decided, do not re-derive: `promise-payoff` `true`, `audience-fit` `true`, `proof-of-work` `false` (its stat plates need the full width).

Write `anti_intent` lines that keep each card out of the others' territory, e.g. `promise-payoff`'s anti_intent must exclude "a final verdict" (that is the `verdict/` family, used at the end, not the start).

**Verify**:
```bash
cd pipelines/video/card-library && python3 -c "
import json;d=json.load(open('catalog.json'));c=d['cards'] if isinstance(d,dict) else d
want={'statement/promise-payoff','checklist/audience-fit','section/proof-of-work'}
print('total:',len(c),'| added:',want<= {x['slug'] for x in c})"
```
-> `total: 64 | added: True`. The catalog held 61 cards at this plan's Planned-at commit (60 originals plus `enacted/bad-clip-montage`, landed by plan 157 in PR#115). If the starting count differs, report it rather than adjusting the expectation silently.

And `git diff --stat catalog.json` -> insertions only, **0 deletions**.

### Step 5: MANDATORY rendered-frame inspection, per card

For EACH of the three cards:

```bash
cd pipelines/video/card-library
npx --yes hyperframes@0.7.62 render <slug> -o /tmp/<name>.mp4
for t in 1.5 4.0 6.0; do ffmpeg -v error -ss $t -i /tmp/<name>.mp4 -frames:v 1 /tmp/<name>-$t.png -y; done
```

**Open every PNG and confirm the device is present** — plates resolving, chips landing, numbers counted up. A heading over an empty background is a FAIL even though every automated gate passes.

Then confirm the beats actually change the frame:

```bash
python3 - <<'PY'
import subprocess, itertools, sys
name = sys.argv[1] if len(sys.argv)>1 else 'promise-payoff'
def load(p):
    return subprocess.run(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
fs=[load(f'/tmp/{name}-{t}.png') for t in ('1.5','4.0','6.0')]
for (i,a),(j,b) in itertools.combinations(enumerate(fs),2):
    n=min(len(a),len(b))
    d=sum(abs(a[k]-b[k]) for k in range(0,n,997))/(n//997)
    print(f'{name} frame{i} vs frame{j}: {d:.2f}')
PY
```

**Verify**: for every card, all three pairwise values are `> 1.0`.

### Step 6: Contact sheets

**Verify**: `cd pipelines/video/card-library && for s in statement/promise-payoff checklist/audience-fit section/proof-of-work; do node scripts/card-qa.mjs $s || exit 1; done` -> exit 0 for all three. The `max` variant of each must not clip, overlap, or misalign.

### Step 7: Full card gate

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0, ends `card check OK`

## Test plan

The card library has no unit tests; its gates (`check-cards.sh`, `card-qa.mjs`) are structural and content-blind by design. The real test for this plan is Step 5 — per-card frame inspection plus the numeric pairwise difference check — because that is the only thing that can distinguish a working device from a styled heading.

## Done criteria

- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] all three cards lint clean
- [ ] all three registered in `catalog.json`; `git diff --stat catalog.json` shows 0 deletions
- [ ] nine frames extracted (3 per card), each visually confirmed to show its device
- [ ] every pairwise frame-difference value is `> 1.0` for all three cards
- [ ] `audience-fit` and `proof-of-work` declare NO `--hero-size`; `promise-payoff` declares one ≥120px
- [ ] each card's `index.html` exceeds 150 lines
- [ ] contact sheets produced for all three

## STOP conditions

- Any card renders as a heading on a background with no device (the plan-137 stub failure). Stop and report which.
- Any pairwise frame difference is `< 1.0` — the beats are not driving state. Do not move the sample timestamps to make it pass.
- `check-type-scale` fails on `audience-fit` or `proof-of-work` for declaring `--hero-size` — remove it. If it still fails, stop and report.
- `check-side` rejects a declared `side` value. Report rather than flipping it; the values in Step 4 are deliberate.
- Adding catalog entries produces deletions in the diff — revert and insert as text.
- A card you are about to build substantially duplicates `statement/keyword-statement`, `enacted/promise-split`, or `table-of-contents`. Stop and report; the point is to add devices those cards cannot do.

## Maintenance notes

- These three plus `enacted/bad-clip-montage` (plan 157) are the intro family. They are **available**, never **required** — the owner has ruled that intro structure is subjective and must not be hardcoded, so no lint or rule may demand any of them.
- All three must read as one family: same background treatment, same chip/plate radius, one accent each. A reviewer should put the three contact sheets side by side and check they look like siblings before approving.
- `audience-fit` is the one most likely to regress into the alignment defect the owner has already reported twice on `checklist/icon-pills`. Check the shared left edge specifically.
