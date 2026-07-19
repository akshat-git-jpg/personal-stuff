---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 096: keyword-highlight captions — accent the load-bearing words

## Summary

- **Problem statement**: Burned captions render every word plain white. The reference channel (see `pipelines/video/visuals-flow/references/-vwHldNaGPI.md`, moment 3:36.4) colorizes the load-bearing words (numbers, product names, emphasis) so on-screen text carries the sentence's weight.
- **Goals**:
  - Deterministic keyword marking in `planCaptions` (numbers/currency/percent, brand lexicon, ALL-CAPS emphasis).
  - Per-word accent rendering (brand orange `#FB923C`) in `caption-render.py`.
  - No change to caption timing, chunking, or the effects module contract.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria** (terse): check.sh green incl. new marking tests; rendered PNG fixture contains accent-colored pixels for a highlighted word and none for a plain chunk.
- **Stop conditions** (terse): timing regressions or any edit to chunking constants — stop.
- **Test / verification for success**: unit tests on the marking rule + a PIL pixel-count check on rendered PNGs.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a249173..HEAD -- pipelines/video/visuals-flow/lib/captions.mjs pipelines/video/visuals-flow/lib/caption-render.py pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/captions.test.mjs`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plan 095)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `a249173`, 2026-07-19

## Why this matters

The reference channel's on-screen text always tells you which words matter —
keywords turn accent-colored in sync with speech. Our captions module already
has per-word timestamps and a PNG pipeline; marking + two-color drawing is a
small, contained upgrade with outsized perceived quality.

## Current state

- `lib/captions.mjs` — `planCaptions(words)` chunks word objects
  (`{text,start,end}`) into caption chunks `{i,text,start,end}` by
  `CAP_MAX_WORDS=6` / `CAP_MAX_CHARS=32` / `CAP_GAP_SPLIT=0.6`. Pure, tested
  in `lib/captions.test.mjs`.
- `lib/caption-render.py` — PIL renderer; reads `{outDir,width,fontPx,chunks}`
  JSON on stdin; draws each chunk's `text` centered, white with black stroke,
  Helvetica; writes `cap-<i>.png`; prints `N rendered`.
- `lib/assemble.mjs` (~line 355-380) — builds `capChunks = planCaptions(words)`,
  filters to screen segments, spawns the python renderer with the JSON payload.
- `lib/effects/captions.mjs` — overlays the PNGs per segment; reads only
  `{i,start,end}` — untouched by this plan.
- Brand accent: `#FB923C` (card-library DESIGN.md / EDITOR-STYLE-GUIDE.md
  "Accent (THE brand color)").
- Products the owner's videos name (for the lexicon): HeyGen, OpenArt,
  Higgsfield, Synthesia, Arcads (EDITOR-STYLE-GUIDE "Quick don'ts" spelling
  list).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Caption tests only | `cd pipelines/video/visuals-flow && node --test lib/captions.test.mjs` | exit 0 |
| Python renderer smoke | see Step 3 fixture | `2 rendered`, exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/captions.mjs`
- `pipelines/video/visuals-flow/lib/caption-render.py`
- `pipelines/video/visuals-flow/lib/assemble.mjs` (payload only: pass `words` through)
- `pipelines/video/visuals-flow/lib/captions.test.mjs`

**Out of scope**:
- `lib/effects/captions.mjs` (PNG overlay contract unchanged)
- Chunking constants/behavior; caption Y position/size; fonts.
- The kinetic-sentence CANVAS interstitial (that is a card, not captions — future Tier-2/3 work).

## Git workflow

- Branch: `advisor/096-keyword-highlight-captions`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: keyword marking in planCaptions

In `lib/captions.mjs` add and export:

```js
export const CAP_ACCENT_LEXICON = [
  'heygen', 'openart', 'higgsfield', 'synthesia', 'arcads'
];

export function markKeyword(text, lexicon = CAP_ACCENT_LEXICON) {
  const t = text.replace(/[.,!?;:]+$/, '');
  if (/[\d$%€£]/.test(t)) return true;                    // numbers, money, percent
  if (lexicon.includes(t.toLowerCase())) return true;      // brand names
  if (t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true; // ALL-CAPS emphasis
  return false;
}
```

In the chunk-output loop, add a `words` array to each emitted chunk:

```js
out.push({
  i, text,
  words: chunkWords.map(w => ({ text: w.text, hl: markKeyword(w.text) })),
  start: +(start).toFixed(3),
  end: +(end).toFixed(3)
});
```

**Verify**: `cd pipelines/video/visuals-flow && node --input-type=module -e "import('./lib/captions.mjs').then(m=>{console.log(m.markKeyword('180'),m.markKeyword('HeyGen'),m.markKeyword('INSANE'),m.markKeyword('the'))})"` -> `true true true false`

### Step 2: two-color word rendering in caption-render.py

Replace the single `draw.text` with a per-word walk. Inline logic:

```python
ACCENT = (251, 146, 60, 255)   # #FB923C
words = chunk.get('words') or [{'text': t, 'hl': False} for t in text.split(' ')]
space_w = draw.textlength(' ', font=font)
widths = [draw.textlength(w['text'], font=font) for w in words]
total_w = sum(widths) + space_w * (len(words) - 1)
x = (width - total_w) // 2
y = (height - text_h) // 2 - bbox[1]   # keep the existing bbox-based y math on the full text
for w, wd in zip(words, widths):
    fill = ACCENT if w.get('hl') else 'white'
    draw.text((x, y), w['text'], font=font, fill=fill,
              stroke_width=stroke_width, stroke_fill='black')
    x += wd + space_w
```

Keep the `bbox` measurement on the full `text` (it still provides `text_h` and
the vertical centering); only horizontal layout becomes per-word.

In `lib/assemble.mjs` no payload change is needed beyond what Step 1 already
adds (chunks now carry `words`; the same objects are JSON-serialized into
`renderStdin`) — verify by reading the `renderStdin` construction (~line 367)
and confirm it passes `chunks: screenChunks` through untouched.

**Verify**: Step 3 smoke (below) — do them together.

### Step 3: tests

1. Extend `lib/captions.test.mjs`:
   - `markKeyword`: cases `'180'→true`, `'$49'→true`, `'93%'→true`,
     `'HeyGen'→true` (lexicon, case-insensitive), `'INSANE'→true`,
     `'the'→false`, `'A'→false` (len<2), `'Kling,'→false` (not in lexicon,
     trailing punct stripped first).
   - `planCaptions` output: every chunk has `words`, `words.length` equals the
     chunk word count, and timing fields are IDENTICAL to the pre-change
     expectations already asserted in this file (no timing drift).
2. Renderer smoke + pixel proof, as a new test in `lib/captions.test.mjs`
   spawning python3 (skip cleanly with `t.skip()` if `python3 -c "import PIL"`
   fails — mirrors how avatar tests guard optional deps if any do; otherwise
   plain spawn):

```js
const payload = { outDir: 'tmp-captest', width: 800, fontPx: 44, chunks: [
  { i: 0, text: 'costs 180 credits', words: [
    { text: 'costs', hl: false }, { text: '180', hl: true }, { text: 'credits', hl: false } ],
    start: 0, end: 1 },
  { i: 1, text: 'plain words only', words: [
    { text: 'plain', hl: false }, { text: 'words', hl: false }, { text: 'only', hl: false } ],
    start: 1, end: 2 }
]};
```

   Spawn `python3 lib/caption-render.py` with that stdin (cwd
   `pipelines/video/visuals-flow`), expect stdout `2 rendered`. Then in the
   test, read the PNGs back via a 10-line python one-liner
   (`PIL: count pixels where |r-251|<12 and |g-146|<12 and |b-60|<12`):
   `cap-0.png` count > 50, `cap-1.png` count == 0. Delete `tmp-captest/`
   afterwards (stays inside the repo — agy permission rule).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/captions.test.mjs` -> exit 0, all new cases pass; then `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0.

## Test plan

Unit tests for the marking rule and no-timing-drift; renderer pixel proof
counting accent pixels in the produced PNGs (a fixture that CAN detect the
effect — folded lesson from the blank-captions bug: the old fixture matched
the buggy field name and validated the bug).

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exit 0
- [ ] `markKeyword` cases pass exactly as specified
- [ ] Chunk timing assertions unchanged from before this plan (no drift)
- [ ] Pixel proof: accent pixels > 50 in the highlighted-chunk PNG, 0 in the plain-chunk PNG
- [ ] No changes to `lib/effects/captions.mjs`

## STOP conditions

- Any existing timing assertion in `lib/captions.test.mjs` needs its EXPECTED VALUE changed — that's timing drift; stop and report.
- PIL missing on the machine — stop and report (don't pip-install anything).
- The per-word layout visibly misaligns (total width > image width for the fixture) — stop, report measurements, don't shrink fonts.

## Maintenance notes

- The lexicon is intentionally tiny and additive: new product names get appended to `CAP_ACCENT_LEXICON` (one line). If per-video lexicons are ever needed, thread them via the captions instance in `effects.json` (`lexicon` field) — the instance already flows into `contribute`.
- Reference evidence: `references/-vwHldNaGPI.md` (spoken-sync yellow keywords; ours are orange per DESIGN.md).
