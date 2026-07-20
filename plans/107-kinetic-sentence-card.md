---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: ["108 depends on this — 108 teaches the LLM to emit the cue this plan makes resolvable"]
---

# Plan 107: kinetic-sentence card + word-synced resolver

## Summary

- **Problem statement**: The Youri reference's most frequent structural device — a single sentence alone on the ambient canvas whose keywords colorize one-by-one in sync with speech, used *instead of* a jump-cut talking head — does not exist in our card library. It was correctly identified as a candidate on 2026-07-19 and then built as the wrong artifact (a bottom-of-frame caption track, plan 096), so we cannot reproduce it at all.
- **Goals**:
  - Add `slate/kinetic-sentence`: fullframe card, brand-orange ambient canvas, sentence builds word by word, an accent phrase colorizes as it is spoken.
  - Add a `word-sync` catalog kind whose per-word `at` times are DERIVED from `transcript.json` by the resolver — never hand-authored per word.
  - Lint the new cue shape so a bad accent phrase fails at step 030, not on screen.
  - Ship it as a real template in the editor's gallery at https://render2.agrolloo.com — not just a pipeline-internal card.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — fully-inlined card + one well-specified resolver function.
- **Done criteria** (terse — full list below): `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 with 4 new tests; `bash scripts/check-cards.sh` exits 0 in card-library; a rendered MP4 of the card shows the accent phrase changing colour part-way through.
- **Stop conditions** (terse — full list below): do not touch `lib/captions.mjs`; do not change any existing card; do not widen `markKeyword`.
- **Test / verification for success**: unit tests in `lib/resolve.test.mjs` + `lib/kinetic-sentence.test.mjs`, plus a REQUIRED render-and-extract-frames visual check (frames, not "render succeeded").
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d46bcb1..HEAD -- pipelines/video/card-library pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/scripts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `d46bcb1`, 2026-07-20

## Why this matters

`references/-vwHldNaGPI.md` (analysed 2026-07-19) records this at row `3:36.4`:

> **Kinetic-sentence interstitial**: one sentence alone on ambient canvas ("It highlights some of the **cool technical features** as well as the **design**..."); keywords colorize to yellow ONE BY ONE in sync with speech; holds ~2s; then flash → floating footage window — *already have?* **no** — *candidate?* **YES**

and its rule 2:

> **Narration → on-canvas kinetic sentence** whenever there's no footage worth showing: sentence appears, keywords turn yellow exactly as spoken. This replaces jump-cut talking head for many bridges.

So this is a PRIMARY structural device, not a decoration — the owner confirmed on 2026-07-20 that it appears in every reference video (`-vwHldNaGPI` at 0:07, 0:26, 0:30). Evidence frames: `~/kb-scratch/video/visuals-flow/_reference/-vwHldNaGPI/moment-0025.3.jpg` shows talking head → white-core flash → dark canvas → the sentence building ("Because" → "Because picking" → "Because picking a...").

`EFFECTS.md` cites this exact candidate as the provenance for captions (plan 096), but 096 shipped a caption TRACK (overlay at `y=0.87` over footage, chunks of ≤6 words, accent chosen by `markKeyword`'s rules) rather than a fullframe interstitial that REPLACES the host. The functional consequence: the reference's emphasis is a semantic PHRASE — "more credits wasted" — and not one of those words trips `markKeyword` (numbers / currency / `CAP_ACCENT_LEXICON` / ALL-CAPS), so today we render that line entirely white, at the bottom, over footage. Closing this needs a new card, not a caption tweak.

## Current state

### Files

| File | Role |
|---|---|
| `pipelines/video/card-library/catalog.json` | card registry the cue pass selects from; `cards[]` with `slug`, `kind`, `placement`, `variables`, `beat_shape`, `default_duration`, `max_beats`, `max_reveal_chars` |
| `pipelines/video/card-library/DESIGN.md` | the visual contract a new card must meet |
| `pipelines/video/card-library/README.md` | "Beat contract" section — how beat cards receive `beats` |
| `pipelines/video/visuals-flow/lib/resolve.mjs` | turns `cues.json` + `transcript.json` into `resolved.json` (absolute times) |
| `pipelines/video/visuals-flow/lib/lint-cues.mjs` | pre-resolve lint gate |
| `pipelines/video/visuals-flow/scripts/check.sh` | the ONLY test registration point — a test file absent from its list silently never runs |

### The existing beat contract (card-library/README.md)

> 1. A **beat card** accepts two extra variables: `beats` (array; item shape is card-specific and listed in `catalog.json` as `beat_shape`, always plus a required numeric `at` = seconds from card start) and nothing else new. Reveal timing comes ONLY from `beats[].at`.
> 2. The TIMELINE block builds reveals with `DATA.beats.forEach(...)` — no hardcoded per-item offsets.
> 3. Defaults in `data-composition-variables` must encode the card's current 6s look, so the gallery preview and a variable-less render look exactly like today.
> 4. Card `data-duration` stays static in the file... cards must keep ALL their `data-duration` attributes at one identical value.

**This plan reuses that contract unchanged.** The only new thing is WHO fills `at`: for `kind: "word-sync"` the resolver derives it from the transcript instead of the LLM anchoring each beat. Anchoring 12 words by hand is not viable, which is the whole reason for the new kind.

### `lib/resolve.mjs` — the exact code you will modify

```js
export function normWord(w) { return w.toLowerCase().replace(/[^a-z0-9']/g, ''); }

// Forward-only phrase matcher over normalized words.
export function findPhrase(W, phrase, from) {
  const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
  if (p.length < 3) return { err: `anchor has fewer than 3 words: "${phrase}"` };
  for (let i = from; i <= W.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (W[i + j].n !== p[j]) { ok = false; break; }
    if (ok) return { idx: i, start: W[i].start, len: p.length };
  }
  return { err: `anchor not found (searching forward from word ${from}): "${phrase}"` };
}
```

and inside `resolveCues(cues, words, catalog, cardLibraryRoot)`:

```js
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  ...
    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + a.len;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    const start = Math.max(0, a.start - lead);
    const beats = [];
    let failed = false;
    for (const b of cue.beats ?? []) {
      const m = findFrom(b.anchor, cursor);
      if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
      cursor = m.idx + m.len;
      beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
    }
    if (failed) continue;
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
```

Note: `W[i]` carries `.n` (normalized), `.text`, `.start`. `findPhrase` returns `{idx, start, len}` or `{err}`.

### Palette (card-library/DESIGN.md — use these exact `:root` values)

| Token | Value |
|---|---|
| `--bg-from` | `#3a1f08` (radial origin, ellipse at ~30% 20%) |
| `--bg-to` | `#0a0805` (page background stays `#000`) |
| `--text` | `#ffffff` |
| `--accent` | `#fb923c` |

Typography: `'Inter', system-ui, sans-serif`, Google Fonts, weights 400–900. Titles 52–72px, weight 800, letter-spacing -1 to -2px.

### This card is editor-facing, not just pipeline-internal

`https://render2.agrolloo.com` (password-gated) is where the human editor works — he has no terminal. Its Templates tab is a **live directory scan** of `pipelines/video/card-library/`, mounted read-only on the VPS as `/cards`. A card appears there when, and only when, it is (a) shaped `<type>/<card-name>/index.html` and (b) committed **and pushed** — the VPS `repo-sync` cron (`*/15`) pulls, and there is no registration step and no redeploy. The failure mode is silent: a card that renders perfectly but never gets pushed is invisible to the editor forever, with nothing erroring (`verdict/winners-podium` sat untracked for a day exactly this way; see `card-library/CLAUDE.md`).

That is why `bash scripts/check-cards.sh` is a Done criterion and not a nicety — it is the gate that catches an unregistered or untracked card. Note the **two independent registrations**: the folder gets you render2, a `catalog.json` entry gets you the visuals-flow cue pass. This card needs both.

Push itself is boss's job at merge, not yours — do not push.

**Owner decision 2026-07-20, do not re-litigate**: the reference's canvas is neon green and its highlight is yellow; ours is the warm amber canvas above with `--accent` orange highlight. This is the standing "clone the mechanics, recolor to our brand" rule already applied to the bubble ring and the green→orange wipe. Do NOT introduce a new hue and do NOT use `gold #facc15` (reserved for verdict-winner moments).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full test gate (merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | exits 0, prints `visuals-flow check OK` |
| One test file | `node --test pipelines/video/visuals-flow/lib/resolve.test.mjs` | `# fail 0` |
| Card structural gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exits 0, `card check OK` |
| Lint the new card | `cd pipelines/video/card-library && npx --yes hyperframes@latest lint slate/kinetic-sentence` | "Studio can't drag-edit" + "Google Fonts" warnings are EXPECTED |
| Render the card | `cd pipelines/video/card-library && npx --yes hyperframes@latest render slate/kinetic-sentence -o /tmp/ks.mp4 --fps 30` | writes `/tmp/ks.mp4` |

**NEVER** write `node --test <dir>` with a directory argument — it fails on node 22.14 with "Cannot find module". Use an explicit file, a glob, or bare `node --test` from the package dir (LESSONS 2026-07-09).

## Scope

**In scope**:
- `pipelines/video/card-library/slate/kinetic-sentence/index.html` (new)
- `pipelines/video/card-library/catalog.json` (one new entry)
- `pipelines/video/visuals-flow/lib/resolve.mjs`
- `pipelines/video/visuals-flow/lib/kinetic-sentence.mjs` (new)
- `pipelines/video/visuals-flow/lib/kinetic-sentence.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/resolve.test.mjs`
- `pipelines/video/visuals-flow/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow/scripts/check.sh` (register the new test file)
- `pipelines/video/visuals-flow/PIPELINE.md` (schema doc)

**Out of scope** (looks related — do not touch):
- `lib/captions.mjs` / `markKeyword` — the owner explicitly rejected widening keyword rules; captions stay exactly as they are. This card is a separate artifact, not a caption change.
- `lib/effects/*` — the white-flash transition into the interstitial is a separate effect; this plan only makes the card.
- Any existing card folder or its `catalog.json` entry.
- `slate/headline-chips` — superficially similar but forces chips; leave it alone.
- `steps/020-cue-pass-llm/RULEBOOK.md` and `cue-pass-prompt.md` — plan 108 owns those.

## Steps

### Step 1 — Add the `word-sync` catalog entry

Add to `pipelines/video/card-library/catalog.json` `cards[]`:

```json
{
  "slug": "slate/kinetic-sentence",
  "kind": "word-sync",
  "placement": "fullframe",
  "purpose": "one spoken sentence alone on the ambient canvas; words appear as spoken and an accent phrase colorizes with them; used INSTEAD of a talking-head bridge",
  "variables": {
    "text": "string",
    "accent": "string (optional) — a phrase appearing verbatim inside text; those words render in --accent"
  },
  "beat_shape": { "text": "string", "accent": "boolean" },
  "default_duration": 6,
  "max_beats": 18,
  "max_reveal_chars": 24
}
```

`max_beats: 18` is the sentence word cap (a bridge sentence longer than 18 words should be split by the cue pass). `max_reveal_chars: 24` caps a single word's length.

**Verify**: `node -e "const c=require('./pipelines/video/card-library/catalog.json');const e=c.cards.find(x=>x.slug==='slate/kinetic-sentence');if(!e||e.kind!=='word-sync')process.exit(1);console.log('ok')"` prints `ok`.

### Step 2 — Write the word-sync resolver

Create `pipelines/video/visuals-flow/lib/kinetic-sentence.mjs`. This is the intelligence-heavy part; use this implementation as written:

```js
import { normWord } from './resolve.mjs';

// Expand a word-sync card's sentence into per-word beats, timed from the
// transcript. The LLM supplies `text` + an optional `accent` phrase; every
// per-word time is DERIVED here, because hand-anchoring 12 words per sentence
// is not viable (that is the whole reason `kind: "word-sync"` exists).
//
// W: normalized word list from resolveCues ({ n, text, start }).
// anchorIdx: index in W where the cue's anchor matched — the anchor IS the
//   opening of the sentence, so word matching starts AT it, not after it.
// start: the card's absolute start time (anchor start minus lead).
// Returns { beats, cursor } or { err }.
export function wordSyncBeats(cue, W, anchorIdx, start) {
  const sentence = String(cue.variables?.text ?? '').trim();
  const sWords = sentence.split(/\s+/).filter(Boolean);
  if (!sWords.length) return { err: 'word-sync card requires variables.text' };

  const sNorm = sWords.map(normWord);
  if (!sNorm.some(Boolean)) return { err: 'variables.text has no matchable words' };

  // Locate the accent phrase inside the sentence, by normalized words.
  const accentRaw = String(cue.variables?.accent ?? '').trim();
  const aNorm = accentRaw.split(/\s+/).map(normWord).filter(Boolean);
  let aStart = -1;
  if (aNorm.length) {
    for (let i = 0; i + aNorm.length <= sNorm.length; i++) {
      let ok = true;
      for (let k = 0; k < aNorm.length; k++) if (sNorm[i + k] !== aNorm[k]) { ok = false; break; }
      if (ok) { aStart = i; break; }
    }
    if (aStart < 0) return { err: `accent phrase "${accentRaw}" does not appear in text "${sentence}"` };
  }

  // Walk the transcript forward, matching each sentence word. A small lookahead
  // absorbs transcription noise (filler words the sentence omits) without
  // letting a wrong match run away.
  const LOOKAHEAD = 8;
  const beats = [];
  let wi = anchorIdx;
  for (let i = 0; i < sWords.length; i++) {
    const n = sNorm[i];
    if (!n) continue;
    let found = -1;
    for (let j = wi; j < Math.min(wi + LOOKAHEAD, W.length); j++) {
      if (W[j].n === n) { found = j; break; }
    }
    if (found < 0) {
      return { err: `word "${sWords[i]}" not found in the transcript within ${LOOKAHEAD} words of the expected position — text must quote the voiceover verbatim` };
    }
    beats.push({
      text: sWords[i],
      accent: aStart >= 0 && i >= aStart && i < aStart + aNorm.length,
      at: +(W[found].start - start).toFixed(2)
    });
    wi = found + 1;
  }
  return { beats, cursor: wi };
}
```

**Verify**: `node -e "import('./pipelines/video/visuals-flow/lib/kinetic-sentence.mjs').then(m=>console.log(typeof m.wordSyncBeats))"` prints `function`.

### Step 3 — Wire it into `resolveCues`

In `lib/resolve.mjs`, import at the top:

```js
import { wordSyncBeats } from './kinetic-sentence.mjs';
```

Then replace the beat loop shown in "Current state" with a branch. The existing `for (const b of cue.beats ?? [])` loop is the `else`; add the word-sync case before it:

```js
    const beats = [];
    let failed = false;
    if (cat.kind === 'word-sync') {
      const r = wordSyncBeats(cue, W, a.idx, start);
      if (r.err) { errors.push(`${cue.id}: ${r.err}`); continue; }
      beats.push(...r.beats);
      cursor = r.cursor;
    } else {
      for (const b of cue.beats ?? []) {
        const m = findFrom(b.anchor, cursor);
        if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
        cursor = m.idx + m.len;
        beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
      }
    }
    if (failed) continue;
```

Everything after this (`duration`, the fullframe-overlap check, `entry`) is unchanged — a word-sync cue produces a normal `beats` array, so `duration = last.at + hold` and `variables.beats` fall out of the existing code.

**Do not** change `validateCues`'s existing behaviour for other kinds.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 (existing tests still pass).

### Step 4 — Lint the new cue shape

In `lib/lint-cues.mjs`, add a check that runs for cues whose catalog `kind` is `word-sync`:

- `variables.text` present and non-empty → else `"<id>: word-sync card requires variables.text"`
- word count of `variables.text` ≤ catalog `max_beats` → else `"<id>: sentence is N words, max is M — split it into two cues"`
- if `variables.accent` non-empty, its normalized words must appear as a contiguous run inside `variables.text` → else `"<id>: accent phrase \"...\" does not appear in text"`
- `cue.beats` must be absent or `[]` → else `"<id>: word-sync cards must not author beats — timings are derived from the transcript"`

Match the file's existing error-string style and how it collects/returns errors (read it first).

**Verify**: `node --test pipelines/video/visuals-flow/lib/lint.test.mjs` exits 0.

### Step 5 — Build the card

Create `pipelines/video/card-library/slate/kinetic-sentence/index.html`.

Requirements:
- Copy the structure/conventions of an existing fullframe beat card — open `pipelines/video/card-library/slate/headline-chips/index.html` and match its shape (`data-duration`, `data-composition-variables`, the `===== CONTENT =====` block, the TIMELINE block).
- Canvas 1920x1080; background = radial gradient `--bg-from #3a1f08` at ~30% 20% → `--bg-to #0a0805`, page `#000`. Give the gradient a slow drift consistent with the other slate cards.
- One sentence, centered, max-width ~1560px, Inter weight 800, 64px, letter-spacing -1.5px, line-height 1.25. Words wrap naturally.
- Render one `<span>` per word from `DATA.beats`. Each word starts at `opacity: 0` and animates in at its own `beats[i].at`, per the beat contract (`DATA.beats.forEach(...)`, no hardcoded offsets).
- A word with `accent: true` animates its colour from `--text` to `--accent` **at the same moment it appears**. That colour change is the whole point of the card — it must be visible.
- `data-duration` static, and identical across every `data-duration` attribute in the file (beat contract rule 4).
- `data-composition-variables` defaults must encode a complete, good-looking 6s example so a variable-less render and the gallery preview both look right. Use this default (it is the reference sentence, rebranded):

```json
{"text":"Because picking the wrong model just burns credits","accent":"burns credits","beats":[{"text":"Because","accent":false,"at":0.0},{"text":"picking","accent":false,"at":0.35},{"text":"the","accent":false,"at":0.62},{"text":"wrong","accent":false,"at":0.8},{"text":"model","accent":false,"at":1.15},{"text":"just","accent":false,"at":1.5},{"text":"burns","accent":true,"at":1.75},{"text":"credits","accent":true,"at":2.1}]}
```

**Verify**:
- `cd pipelines/video/card-library && npx --yes hyperframes@latest lint slate/kinetic-sentence` — only the two expected warnings.
- `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0 with `card check OK`.

### Step 6 — REQUIRED visual check (extract frames and look)

Rendering successfully is NOT evidence the card works. On 2026-07-19 the render gate passed three visually-broken effects in one day because nobody extracted frames (LESSONS).

```bash
cd pipelines/video/card-library
npx --yes hyperframes@latest render slate/kinetic-sentence -o /tmp/ks.mp4 --fps 30
mkdir -p /tmp/ksframes
ffmpeg -y -v error -i /tmp/ks.mp4 -vf "fps=2" /tmp/ksframes/f%02d.png
```

Then **open the frames and confirm all four**, reporting what you saw:
1. Early frames show only the first word(s) — the sentence is NOT fully present at t=0.
2. Later frames show more words than earlier frames (it builds).
3. In a late frame, "burns credits" is visibly ORANGE while the preceding words are WHITE.
4. The background is the warm amber gradient, not green and not flat black.

If any of these fail, fix the card and re-render. Do not proceed on "render succeeded".

### Step 7 — Tests

Create `pipelines/video/visuals-flow/lib/kinetic-sentence.test.mjs` with 4 tests. Use a hand-built `W` array — **do not** read any file under `videos/` (tests must never touch committed per-video data):

```js
const W = [
  { text: 'Because', start: 10.0 }, { text: 'picking', start: 10.35 },
  { text: 'the', start: 10.62 },    { text: 'wrong', start: 10.80 },
  { text: 'model', start: 11.15 },  { text: 'just', start: 11.50 },
  { text: 'burns', start: 11.75 },  { text: 'credits', start: 12.10 }
].map(x => ({ ...x, n: x.text.toLowerCase() }));
```

1. **derives one beat per word with transcript-relative times** — `wordSyncBeats({variables:{text:'Because picking the wrong model just burns credits'}}, W, 0, 10.0)` returns 8 beats, `beats[0].at === 0`, `beats[7].at === 2.1`.
2. **marks exactly the accent span** — with `accent: 'burns credits'`, only indices 6 and 7 have `accent: true`.
3. **rejects an accent phrase absent from the text** — `accent: 'wasted money'` returns `{err}` mentioning `does not appear`.
4. **rejects a word missing from the transcript** — text `'Because picking the wrong xylophone just burns credits'` returns `{err}` mentioning `not found in the transcript`.

Add one test to `lib/resolve.test.mjs` proving end-to-end wiring: a `word-sync` cue through `resolveCues` yields `variables.beats` of length 8 with `at` values relative to the card start, and `duration === last.at + hold`.

Register the new file in `scripts/check.sh` — append `lib/kinetic-sentence.test.mjs` to the existing explicit `node --test` file list. **A test file not in that list silently never runs** (decisions.md 2026-07-20).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 and the total test count increased by at least 5.

### Step 8 — Document the schema

In `pipelines/video/visuals-flow/PIPELINE.md`, in the "cues.json schema" section's field-semantics list, add:

> - `kind: "word-sync"` cards (catalog) take `variables.text` (the sentence, quoted verbatim from the voiceover) and optional `variables.accent` (a phrase appearing verbatim inside `text`, rendered in the brand accent). They author **no** `beats` — the resolver derives one beat per word from `transcript.json`, so the cue's `anchor` must be the opening words of the sentence itself.

**Verify**: `grep -c "word-sync" pipelines/video/visuals-flow/PIPELINE.md` returns ≥ 1.

## Test plan

| Test | Where | Follows |
|---|---|---|
| 4 unit tests for `wordSyncBeats` | `lib/kinetic-sentence.test.mjs` (new) | the fixture style of `lib/resolve.test.mjs` |
| 1 end-to-end resolve test | `lib/resolve.test.mjs` | its existing `resolveCues` tests |
| Card structural gate | `card-library/scripts/check-cards.sh` | existing |
| Visual frame check | Step 6, manual, mandatory | LESSONS 2026-07-19 |

## Done criteria

1. `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0, printing `visuals-flow check OK`, with total tests ≥ 181 (was 176).
2. `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0 with `card check OK`.
3. `node -e "const c=require('./pipelines/video/card-library/catalog.json');process.exit(c.cards.some(x=>x.slug==='slate/kinetic-sentence')?0:1)"` exits 0.
4. `/tmp/ks.mp4` exists and the Step 6 four-point frame inspection passed — report which frame numbers you checked and what you saw.
5. `grep -c "word-sync" pipelines/video/visuals-flow/PIPELINE.md` ≥ 1.
6. `git diff --stat d46bcb1..HEAD` touches only files in the In-scope list.

## STOP conditions

- **`lib/captions.mjs` or `markKeyword` needs changing** to make this work → STOP. The owner explicitly rejected widening keyword rules (2026-07-20); if the design seems to require it, the design is wrong.
- **An existing card or its catalog entry needs editing** → STOP and report. This plan only adds.
- **`hyperframes render` fails or produces a 0-byte file** → STOP; do not mark done on a card you could not render and look at.
- **The frame inspection in Step 6 cannot show the accent colour change** after two fix attempts → STOP and report with the frames. Do not weaken the check to make it pass.
- **`resolveCues` changes would alter behaviour for non-`word-sync` cards** → STOP. Every existing card must resolve byte-identically.

## Maintenance notes

- The `word-sync` kind is the third catalog kind (`beat`, `single`, `word-sync`). Anything switching on `kind` — the board, `lint-cues.mjs`, `render.mjs` — may need to learn it. This plan touches only the resolver and lint; if the board renders the cue oddly, that is expected follow-up, not a bug in this plan.
- `LOOKAHEAD = 8` in `wordSyncBeats` is the tolerance for transcript noise. Too high and a repeated word matches far away, drifting the timing; too low and a filler word breaks resolution. Change it only with a test that pins the failure it fixes.
- Reviewers should scrutinise: that the accent colour change is *simultaneous* with the word's appearance (not a separate later beat), and that a sentence whose words repeat ("the ... the") still times correctly.
- Plan 108 teaches the cue pass to emit these cues. Until 108 lands, the card is reachable only by hand-writing a cue.
