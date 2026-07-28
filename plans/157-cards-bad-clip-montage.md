---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh
ui: true
deploy:
needs: []
---

# Plan 157: New card `enacted/bad-clip-montage` — enact the hook instead of titling it

## Summary

- **Problem statement**: test-03's hook ("you're not saving time, you're just automating and doing it badly") plays over `title/title-versus`, a static logo card. The most important 15 seconds of the video *describe* the pain in voiceover while the screen shows two logos and a "VS". There is no card in the library that shows a badly-automated clip.
- **Goals**:
  - A new `enacted/` card that DOES the hook: a vertical short-form clip frame cycling three real failure states, one per beat.
  - Registered in `catalog.json` so the cue pass can select it.
  - Verified by looking at rendered frames at each beat, not by file existence.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the card spec below is fully inlined; the work is authoring HTML to a fixed skeleton.
- **Done criteria** (terse): `bash scripts/check-cards.sh` exits 0; three extracted beat frames each show a *different, correct* failure state.
- **Stop conditions** (terse): any beat frame is visually identical to another; the card renders as a title-only stub.
- **Test / verification for success**: `scripts/card-qa.mjs` contact sheet + a mandatory rendered-frame inspection at beat times.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 64a151b..HEAD -- pipelines/video/card-library/catalog.json pipelines/video/card-library/enacted`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `64a151b`, 2026-07-28

## Why this matters

`R_CHOOSING` in `lib/cue-rules.mjs` already carries a mandatory clause added on the owner's instruction: *"PROPOSE A NEW CARD (mandatory): when no existing card enacts the clause, the answer is a NEW TEMPLATE, not the nearest existing one."* The hook is exactly that case — the library has no device for "the automated output is broken", so the cue pass reached for a title card.

The hook names three specific failures: **captions**, **pacing**, **layouts**. Those are showable. A viewer who *sees* a caption land a beat late and a head slide out of frame understands the thesis in two seconds; a viewer reading "Which One Ships Postable Clips" is being told.

**This plan has a specific known failure mode.** `plans/runs/LESSONS.md`, 2026-07-24: *"plan 137's crew shipped all 12 enacted cards as 76-line title-only stubs and every gate passed: check-cards/lint/existence checks are content-blind. Card plans need a rendered-frame inspection gate (extract frames at beat times and LOOK) and done-criteria must never accept 'file exists / mp4 >0 bytes' as proof of device code."* Step 5 is that gate and is not optional.

## Current state

**Card skeleton** — every card is `<type>/<card-name>/index.html`, a Hyperframes composition (HTML + GSAP). From `enacted/before-after/index.html`, verbatim (lines 73–76):

```html
    <div id="root" data-composition-id="before-after" data-start="0" data-duration="6" data-width="1920" data-height="1080"
      data-composition-variables='{"title":"Migration","before_label":"Legacy","after_label":"Modern","before_lines":[{"line":"5s cold start"}, ...]}'>
      <div id="bg" class="clip" data-start="0" data-duration="6" data-track-index="0"></div>
      <div id="frame" class="clip" data-start="0" data-duration="6" data-track-index="1">
```

and the variable defaults block (lines 105–107):

```js
        register: VARS.register ?? 'dark',
        variant: VARS.variant ?? 'a',
        marker: VARS.marker ?? false,
```

**Ambient marker** — `scripts/card-qa.mjs` hard-fails any card in its `AMBIENT_REQUIRED` list that lacks the `/* hf-ambient */` marker. `enacted/before-after` satisfies it with (line 68–69):

```css
      @keyframes hf-ambient-breathe { from { transform: scale(1); } to { transform: scale(1.012); } }
      #frame { animation: hf-ambient-breathe 6s ease-in-out alternate infinite; /* hf-ambient */ }
```

Copy that pattern. (A new card is not in `AMBIENT_REQUIRED` yet — add ambient anyway; a dead-still card is what plan 156 exists to prevent.)

**Palette** — `DESIGN.md` owns it. Exact values:

| token | value | use |
|---|---|---|
| `--bg-from` | `#3a1f08` | radial gradient origin (burnt amber), ellipse at ~30% 20% |
| `--bg-to` | `#0a0805` | near-black warm undertone; page background stays `#000` |
| `--text` | `#ffffff` | primary text |
| `--accent` | `#fb923c` | eyebrows, highlights, active states |
| negative | `#fb7185` | cons, no-marks (rose) |

Rules from `DESIGN.md`: dark warm background always; ONE orange accent; green/rose only for pros/cons. The three failure labels are cons — rose `#fb7185` is the correct colour for them. Do not introduce any other hue.

**Type-scale contract** — `scripts/check-type-scale.mjs` runs over every fullframe card. A card whose catalog entry sets `"hero_shape": "none"` must NOT declare a `--hero-size` CSS variable; any other shape must declare one and meet a size floor. This card's focus is the clip device, not a hero string, so it uses `"hero_shape": "none"` and **must not declare `--hero-size` anywhere**, including inside comments (the checker strips `/* */` comments before matching, but do not rely on it).

**Side contract** — `scripts/check-side.mjs` requires a boolean `side` on every fullframe catalog entry. This card is a centred vertical device and does not survive the 1200px side canvas, so it declares `"side": false`.

**Registration is two independent things** (`card-library/CLAUDE.md`): the folder makes it visible in the render2 Templates tab; the `catalog.json` entry makes the cue pass able to select it. Both are required.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0, `card check OK` |
| Hyperframes lint | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint enacted/bad-clip-montage` | passes ("Studio can't drag-edit" and "Google Fonts" warnings are expected and fine) |
| Contact sheet | `cd pipelines/video/card-library && node scripts/card-qa.mjs enacted/bad-clip-montage` | writes a min/max sheet, exit 0 |
| Render for inspection | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render enacted/bad-clip-montage -o /tmp/bcm.mp4` | mp4 written |
| Extract a frame | `ffmpeg -v error -ss <T> -i /tmp/bcm.mp4 -frames:v 1 /tmp/bcm-<T>.png -y` | png written |

## Scope

**In scope**:
- `pipelines/video/card-library/enacted/bad-clip-montage/index.html` (new)
- `pipelines/video/card-library/catalog.json` (one new entry)

**Out of scope**:
- `pipelines/video/card-library/gallery-order.json` — ordering only, not a whitelist; the card appears without it.
- Any existing card. Copy `enacted/before-after` as a starting skeleton but **do not modify it**.
- `pipelines/video/visuals-flow-2/**` — cueing this card into a video is a separate operating step. Do not touch `cue-rules.mjs`; `R_CHOOSING` already routes to `enacted/` first.
- `DESIGN.md` — this card follows the palette, it does not extend it.

## Git workflow

- Branch: `advisor/157-cards-bad-clip-montage`
- Commit: `feat(cards): enacted/bad-clip-montage — enact the badly-automated clip` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold from the nearest existing card

```bash
cd pipelines/video/card-library
mkdir -p enacted/bad-clip-montage
cp enacted/before-after/index.html enacted/bad-clip-montage/index.html
```

Then change `data-composition-id` to `bad-clip-montage`, set `data-duration="9"` on `#root` and on every `.clip` child, and keep `data-width="1920" data-height="1080"`.

**Verify**: `cd pipelines/video/card-library && grep -c 'data-composition-id="bad-clip-montage"' enacted/bad-clip-montage/index.html` -> `1`

### Step 2: Build the device

Replace the before/after body with this structure. The card is a **beat** card: three beats, one per failure state.

Layout (1920×1080):
- A centred vertical clip frame, **432×768** (9:16), radius 28px, 1px `rgba(255,255,255,0.10)` border, sitting on the dark warm radial background.
- Inside the frame: a flat grey "speaker" block standing in for footage (no photography — this is a diagram), plus a caption bar near the bottom of the frame.
- To the right of the frame, a stacked list of the three failure labels; the active one is full-opacity rose `#fb7185` with a small `!` chip, the inactive ones are `rgba(255,255,255,0.28)`.
- A single heading above the frame in `--text`, with exactly one word in `--accent` (DESIGN.md's one-accent rule).

The three beat states, in order — each must be **visually distinct at a glance**:

| beat | label | what changes inside the clip frame |
|---|---|---|
| 1 | `Captions land late` | the caption bar shows text offset noticeably behind a small progress marker — caption text sits visibly out of step with the marker position |
| 2 | `Speaker out of frame` | the grey speaker block is translated so it is clipped by the frame edge, with a dashed safe-area rectangle showing what it should have been inside |
| 3 | `Cut lands mid-word` | the caption text is visibly truncated mid-word (e.g. `"...automat"`) and a hard vertical cut line crosses the frame |

Drive the states from the beats: on beat *n*, state *n* becomes active and the previous state resets. Use the same GSAP timeline conventions as the source card — do NOT touch the `===== TIMELINE (LOCKED) =====` script's structure, only the data/DOM it drives.

Set `data-composition-variables` to a working default so the card renders standalone:

```json
{"title":"Automated, Then Fixed By Hand","clips":[{"label":"Captions land late"},{"label":"Speaker out of frame"},{"label":"Cut lands mid-word"}]}
```

Keep the ambient breathe animation and its `/* hf-ambient */` marker.

**Verify**: `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint enacted/bad-clip-montage 2>&1 | tail -3` -> no errors (font/drag-edit warnings are fine)

### Step 3: Register it in the catalog

Add this entry to `catalog.json`. **Insert it as text in the `enacted/` group — do not re-serialize the file.** The catalog uses `-` escapes for hyphens in some strings; `JSON.stringify` round-tripping un-escapes them and produces a 100+ line diff that hides the real change.

```json
    {
      "slug": "enacted/bad-clip-montage",
      "kind": "beat",
      "placement": "fullframe",
      "side": false,
      "hero_shape": "none",
      "purpose": "A vertical short-form clip frame that cycles three ways an auto-generated clip comes back broken; each beat lights one failure",
      "intent": "The VO claims automated clipping still leaves work behind, and no footage of a bad clip is on screen.",
      "anti_intent": "Praising a tool's output, or any moment where real footage of the actual result is already visible.",
      "variables": {
        "title": {
          "required": true,
          "type": "string",
          "role": "heading",
          "example": "Automated, Then Fixed By Hand"
        },
        "clips": {
          "required": true,
          "type": "array",
          "item_shape": {
            "label": {
              "type": "string",
              "role": "label",
              "required": true,
              "max_words": 4,
              "example": "Captions land late"
            }
          }
        }
      },
      "default_duration": 9,
      "register": ["dark"]
    },
```

**Verify**: `cd pipelines/video/card-library && python3 -c "import json;d=json.load(open('catalog.json'));c=d['cards'] if isinstance(d,dict) else d;print(len(c), any(x['slug']=='enacted/bad-clip-montage' for x in c))"` -> `61 True`

And confirm the diff stayed small: `git diff --stat catalog.json` -> roughly 40 insertions, **0 deletions**. If deletions appear, the file was re-serialized — revert and insert as text.

### Step 4: Contact sheet

**Verify**: `cd pipelines/video/card-library && node scripts/card-qa.mjs enacted/bad-clip-montage` -> exit 0, sheet written. Open the sheet. The `max` variant must not clip, overlap, or misalign.

### Step 5: MANDATORY rendered-frame inspection (the real gate)

A passing lint proves nothing about whether the device exists. Render and LOOK.

```bash
cd pipelines/video/card-library
npx --yes hyperframes@0.7.62 render enacted/bad-clip-montage -o /tmp/bcm.mp4
for t in 1.5 4.5 7.5; do ffmpeg -v error -ss $t -i /tmp/bcm.mp4 -frames:v 1 /tmp/bcm-$t.png -y; done
```

Then **open all three PNGs and confirm, one by one**:

1. `/tmp/bcm-1.5.png` — caption bar visibly out of step with the marker; label 1 is rose and active, labels 2 and 3 dimmed.
2. `/tmp/bcm-4.5.png` — the speaker block is clipped by the frame edge with the dashed safe-area visible; label 2 active.
3. `/tmp/bcm-7.5.png` — caption text truncated mid-word with the cut line; label 3 active.

Also confirm mechanically that the three frames actually differ:

```bash
python3 - <<'PY'
import subprocess
def load(p):
    return subprocess.run(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
a,b,c = load('/tmp/bcm-1.5.png'), load('/tmp/bcm-4.5.png'), load('/tmp/bcm-7.5.png')
def diff(x,y):
    n=min(len(x),len(y))
    return sum(abs(x[i]-y[i]) for i in range(0,n,997))/ (n//997)
print('1v2', round(diff(a,b),2), '1v3', round(diff(a,c),2), '2v3', round(diff(b,c),2))
PY
```

**Verify**: every printed value is `> 1.0`. A value near 0 means two beats render the same frame — the device is not wired to the beats.

### Step 6: Full card gate

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0, ends `card check OK`

## Test plan

The card library has no unit tests; its gates are `check-cards.sh` (structure, catalog registration, side contract, type-scale contract, logo normalization, nothing untracked) plus `card-qa.mjs` contact sheets. Those are all content-blind, which is why Step 5's frame inspection and the numeric frame-difference check are the actual test for this plan.

## Done criteria

- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `npx hyperframes@0.7.62 lint enacted/bad-clip-montage` reports no errors
- [ ] `catalog.json` contains `enacted/bad-clip-montage` and totals 61 cards
- [ ] `git diff --stat catalog.json` shows 0 deletions
- [ ] three beat frames extracted and each visually confirmed to show its own failure state
- [ ] the frame-difference check prints all three pairwise values `> 1.0`
- [ ] the card file is more than 150 lines and contains the three state labels as real DOM, not just in `data-composition-variables`

## STOP conditions

- Any pairwise frame difference in Step 5 is `< 1.0` — the beats are not driving distinct states. Stop and report; do not "fix" it by moving the sample timestamps.
- The rendered card shows a heading and nothing else (the plan-137 stub failure). Stop and report.
- `check-type-scale` fails complaining about `--hero-size` — the card declared one despite `hero_shape: "none"`. Remove the declaration; if the checker still fails, stop and report.
- `check-side` rejects `"side": false` — stop and report rather than flipping it to `true`, which would put the device on a canvas it was not designed for.
- Adding the catalog entry produces deletions in the diff. Revert `catalog.json` and re-insert the entry as text.

## Maintenance notes

- The card is deliberately a **diagram**, not footage: flat grey blocks, no photography, no video-in-video. That keeps it renderable, brand-consistent, and honest — it illustrates a failure rather than pretending to be a real broken clip.
- `default_duration: 9` gives three ~3s beats. Plan 155 makes narration coverage independent of this number, and plan 156's W13 requires a card holding past 12s to have beats — this card has three, so it satisfies both by construction.
- A reviewer should scrutinise whether beat 1 (caption lag) actually reads at a glance. It is the subtlest of the three; if it does not land in the contact sheet, exaggerate the offset rather than adding explanatory text.
