<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/card-library && node --test scripts/overflow-probe.test.mjs && bash scripts/check-cards.sh && cd ../visuals-flow-2 && bash scripts/check.sh
                         # Covers BOTH directories this plan writes to (card-library/ AND
                         # visuals-flow-2/lib/). LESSONS 2026-07-21: a gate that cannot see
                         # half the work lands half-finished work marked done. The first
                         # command is also the fail-proof — overflow-probe.test.mjs contains
                         # the real c17 input and must report overflow.
ui:                      # no user-facing view — a build-time CLI gate
deploy:                  # no deploy
needs: []
---

# Plan 168: Measure card text capacity at build time, so overflow can never reach a review

## Summary

- **Problem statement**: A card can ship a visibly clipped frame and pass every existing gate. `enacted/pipeline-flow` rendered its title over two lines in its vertical variant, pushing the last node off the canvas (`c17`, opusclip-vs-submagic, 2026-07-30). Nothing caught it: `card-qa.mjs` never renders a card's layout variants at all, and the only real detector lives inside `board.mjs` as a badge with zero consumers.
- **Goals**:
  - Extract the canvas-bounds overflow measurement into one shared module so the board badge and the new gate cannot drift.
  - Add `scripts/overflow-probe.mjs`: renders a card headless at 1920x1080, per **layout variant**, filled to its **declared capacity**, and reports every element that leaves the canvas.
  - Make it a **gate** in `scripts/check-cards.sh` — a card cannot join or stay in the catalog with an unmeasured or overflowing capacity.
  - Add a `--derive` mode that finds the true `max_words` per text field per variant and writes it into `catalog.json`, so capacity becomes a measured fact instead of the generic `ROLE_DEFAULTS` guess.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every file, snippet and command is inlined below.
- **Done criteria** (terse): `node --test scripts/overflow-probe.test.mjs` passes including a fixture that PROVES the probe fails on the known-bad c17 input; `bash scripts/check-cards.sh` exits 0 with the new gate active; every non-structural card declaring `variants` carries an explicit cap.
- **Stop conditions** (terse): do not add a bundled-browser dependency; do not shrink fonts or truncate text to make anything fit; do not edit any card's visual design; stop if >6 cards need caps that look wrong.
- **Test / verification for success**: unit tests over the pure measurement + a known-bad fixture the gate must reject (prove-it-can-fail), then the repo gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 035f967..HEAD -- pipelines/video/card-library/ pipelines/video/visuals-flow-2/lib/board.mjs`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (the `resolve.mjs` rotation guard already landed)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `035f967`, 2026-07-30

## Why this matters

The owner's words: *"i want all such overflow cards to be automaticllay fixed so that i dont waste my time in review"*, and then the key insight this plan is built on: *"can't we find the limit when building a card itslef? why to do it later again and again."*

Overflow depends only on a card's CSS, its layout variant, its font size and how much content it holds. **None of that varies per video.** So the limit is a property of the card, discoverable once at build time. Measuring per video would repeat the same work forever; measuring once and declaring the result makes every later video free — `validateVariable` in `resolve.mjs` already enforces declared caps at step 040, before anything renders.

There is a second reason to put the gate here rather than in the video pipeline. `LESSONS.md` 2026-07-24: *"making an LLM audit advisory (chips on a board) means it gets ignored — port doctrine as GATES, not signals."* The overflow detector already exists and is already correct; it is simply advisory. This plan does not invent detection, it promotes it.

**This closes a risk the owner accepted on purpose, rather than opening a new direction.** `decisions.md` 2026-07-17 introduced per-card capacity limits as *"conservative estimates from layout math, **unverified until video #1**"*, and recorded the accepted risk: *"retrofitted cards never visually audited (owner chose to find issues on the board during video #1)."* Video #1 happened; c17 is one of those issues. This plan replaces the estimates with measurements, which is the follow-through that entry anticipated — so nothing here contradicts a standing decision.

## Current state

### The defect, reproduced

`enacted/pipeline-flow` has `variants: ["a", "b"]`. `resolve.mjs` rotates a reused card's variant by use count, so the third use of the card in one video landed on `b` — a **vertical** node chain with much less vertical headroom than `a`'s horizontal one. The title `"Submagic: Straight To Posted"` wrapped to two lines, and both the title's top line and the final `POSTED` node were clipped off the 1080px canvas.

`title` was not literally uncapped: `lib/resolve.mjs` has `ROLE_DEFAULTS` where `heading: { max_words: 7 }`. The 4-word title passed a 7-word generic limit that knows nothing about this card's layout. **That generic default is the hole.**

### Why nothing caught it (all three verified by hand, 2026-07-30)

1. **`pipelines/video/card-library/scripts/card-qa.mjs` never tests layout variants.** Its `variant` parameter means min/max **content fill**, not the card's `variants`. Confirmed: the file never reads `card.variants` and never sets `variant: 'b'`. Its output is a PNG contact sheet for a human to look at; it measures nothing.
2. **`pipelines/video/visuals-flow-2/lib/board.mjs` has the correct detector, with zero consumers.** `__measureOverflow()` (line ~164) measures every element against the canvas and posts a message that paints a red badge. Grep for consumers found none outside `board.test.mjs`.
3. **`hyperframes check` does NOT catch this class.** Verified: on a fixture restored to the exact broken input (`title: "Submagic: Straight To Posted"`, `variant: "b"`), `npx hyperframes@latest check <dir> --at 1.2,3.0` reports `Layout: 0 issues across 2 sample(s)` and exits 0. Its layout check finds **text overflowing its container**; c17's elements sit fine inside their own boxes and the whole stack leaves the **canvas**. Different check. Do not assume `hyperframes check` covers this.

### The measurement to reuse (copy this exactly)

From `pipelines/video/visuals-flow-2/lib/board.mjs`, the function to extract. It runs **inside** the page:

```js
function __measureOverflow() {
  const W = 1920, H = 1080, TOL = 2;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + TOL || r.bottom > H + TOL || r.left < -TOL || r.top < -TOL) {
      offenders.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
      if (offenders.length >= 5) break;
    }
  }
  const doc = document.documentElement;
  const scrolled = doc.scrollWidth > W + TOL || doc.scrollHeight > H + TOL;
  return { broken: offenders.length > 0 || scrolled, offenders };
}
```

### The browser: reuse the one already on disk — do NOT download another

`card-library/package.json` has **zero dependencies** today and must stay light. hyperframes already caches a Chrome **via puppeteer**, and exposes its path:

```
$ npx hyperframes@latest browser path
/Users/kbtg/.cache/puppeteer/chrome-headless-shell/mac_arm-127.0.6533.88/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

So the dependency is **`puppeteer-core`** (no bundled browser download), launched against that path. Decision made; do not substitute `puppeteer` (bundles a second Chromium) or `playwright` (bundles three browsers).

### Conventions to match

- **Exemplar file**: `pipelines/video/card-library/scripts/check-catalog.mjs` — plain Node ESM, no deps, `err()` collects failures, prints `catalog ok` and exits non-zero on any failure. Match its shape and its terse output.
- Tests: `node --test`, files named `*.test.mjs`. Nearest example of a script-level test: `pipelines/video/card-library/scripts/normalize-logo.test.mjs`.
- `catalog.json` **escapes hyphens as `-`**. A full `JSON.parse`/`JSON.stringify` round-trip un-escapes them and churns ~120 lines of pure encoding. When writing to it, do **targeted text surgery** or re-escape on write. (Learned the hard way, 2026-07-30.)
- Generated media never enters the repo — temp renders go under `/tmp` or `~/kb-scratch/`, never `card-library/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Chrome path | `npx hyperframes@latest browser path` | absolute path to an executable |
| Catalog contract | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | prints `catalog ok`, exit 0 |
| Card gate (the merge gate) | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | ends `card check OK`, exit 0 |
| New unit tests | `cd pipelines/video/card-library && node --test scripts/overflow-probe.test.mjs` | all pass, exit 0 |
| Pipeline suite (must stay green) | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | ends `visuals-flow check OK` |

## Scope

**In scope** (the only files to create or modify):

- `pipelines/video/card-library/scripts/overflow-probe.mjs` (new)
- `pipelines/video/card-library/scripts/overflow-probe.test.mjs` (new)
- `pipelines/video/card-library/scripts/check-cards.sh` (add one gate section)
- `pipelines/video/card-library/package.json` (add `puppeteer-core` dependency)
- `pipelines/video/card-library/catalog.json` (write derived caps only)
- `pipelines/video/card-library/DESIGN.md` (document the measured-capacity contract)
- `pipelines/video/visuals-flow-2/lib/overflow-measure.mjs` (new — the shared measurement source)
- `pipelines/video/visuals-flow-2/lib/board.mjs` (import the shared module instead of its inline copy)

**Out of scope — looks related, do not touch:**

- `pipelines/video/visuals-flow-2/lib/resolve.mjs` — the rotation guard (`lacksExplicitTextCap`) already landed and is tested. Once caps are derived, cards will start rotating again on their own; that is the intended effect, not a change to make.
- Any card's `index.html` visual design. This plan measures cards; it does not redesign them. If a card's true capacity is absurdly small, STOP and report — do not "fix" the card.
- `scripts/card-qa.mjs` — leave it as the human contact-sheet tool. The new probe is a separate, machine-checkable script. Merging them is a later cleanup.
- `scripts/beat-smoke.sh` — it is stale (asserts 48 total / 15 beat cards against 64 / 25) and fails before reaching any card. Known, unrelated, do not fix here.

## Steps

### Step 1 — Extract the measurement into one shared module

Create `pipelines/video/visuals-flow-2/lib/overflow-measure.mjs` exporting the function **as a string** (it must be injected into a page, so it cannot be a normal import at the call site) plus the constants:

```js
// The canvas-bounds overflow measurement, in ONE place. board.mjs injects it into
// its preview iframe; card-library/scripts/overflow-probe.mjs injects it into a
// headless page. Two copies would drift, and the copy that drifts is the gate.
export const CANVAS = { W: 1920, H: 1080, TOL: 2 };

// Source text of a function evaluated INSIDE the page. Keep it dependency-free
// and ES5-safe: it is stringified, not bundled.
export const MEASURE_OVERFLOW_SRC = `
function __measureOverflow() {
  const W = 1920, H = 1080, TOL = 2;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + TOL || r.bottom > H + TOL || r.left < -TOL || r.top < -TOL) {
      offenders.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
      if (offenders.length >= 5) break;
    }
  }
  const doc = document.documentElement;
  const scrolled = doc.scrollWidth > W + TOL || doc.scrollHeight > H + TOL;
  return { broken: offenders.length > 0 || scrolled, offenders };
}
`;
```

Then edit `board.mjs` to import `MEASURE_OVERFLOW_SRC` and interpolate it where its inline `function __measureOverflow() {...}` currently sits, deleting the inline copy. The injected script text must remain byte-identical in behaviour.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/board.test.mjs` → passes, and `grep -c "function __measureOverflow" lib/board.mjs` → `0`.

### Step 2 — Add `puppeteer-core`

In `pipelines/video/card-library/package.json`, add:

```json
"dependencies": { "puppeteer-core": "^23.0.0" }
```

Then `cd pipelines/video/card-library && npm install`.

**Verify**: `cd pipelines/video/card-library && node -e "import('puppeteer-core').then(()=>console.log('ok'))"` → prints `ok`. And `du -sh node_modules | cut -f1` → under 20M (proves no bundled browser).

### Step 3 — Write the probe

Create `pipelines/video/card-library/scripts/overflow-probe.mjs`. Structure:

- `resolveChrome()` — `execSync('npx hyperframes@latest browser path')`, trim to the last line, assert it exists with `fs.existsSync`; throw a clear error naming the command to run if missing.
- `probeCardVariant(cardSlug, variant, variables, times)` — launch `puppeteer-core` with `executablePath`, `defaultViewport: {width:1920, height:1080}`, open the card's `index.html` as a `file://` URL with `data-composition-variables` rewritten to `variables` (write a temp copy under `os.tmpdir()`, never in the repo), wait for `window.__timelines`, then for each `t` in `times`: seek the timeline (`Object.values(window.__timelines)[0]` → `.pause()`, `.time(t)`), `await new Promise(r => requestAnimationFrame(r))`, and `page.evaluate(MEASURE_OVERFLOW_SRC + ';__measureOverflow()')`.
- Export the pure helpers so tests can cover them without a browser: `fillToCapacity(card, variant)` (reuse the FILLER-word approach already in `card-qa.mjs`) and `probeTimes(card)` (beat `at` times plus the midpoint and the final second).
- CLI: `node scripts/overflow-probe.mjs [slug...]` — default all cards. For each card, probe **every entry in `card.variants`** (or just the default when it declares none), filled to declared capacity. Print one line per card: `ok <slug> <variant>` or `OVERFLOW <slug> <variant> @<t>s <offenders>`. Exit non-zero if any card overflowed.
- `--derive` mode: for each text field, reduce `max_words` by one from the role default until the card stops overflowing in its **tightest** variant, then write that number into `catalog.json` via targeted text surgery (see Conventions — do not round-trip the JSON). Print `derived <slug>.<field> max_words=<n>`.

### Step 4 — Prove the gate can FAIL (do this before wiring it in)

Create `pipelines/video/card-library/scripts/overflow-probe.test.mjs`. It MUST contain a **known-bad fixture** — the exact c17 input — and assert the probe reports overflow:

```js
// The gate is worthless unless it can fail. This fixture is the real defect:
// enacted/pipeline-flow, title "Submagic: Straight To Posted", variant "b".
// It clipped both the title's top line and the final node off the canvas
// (c17, opusclip-vs-submagic, 2026-07-30). If this test ever goes green with
// the probe reporting "ok", the probe has stopped working — not the card.
test('the probe reports overflow on the known-bad c17 input', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovf-'));
  fs.cpSync('enacted/pipeline-flow', path.join(dir, 'pipeline-flow'), { recursive: true });
  const res = await probeCardVariant(path.join(dir, 'pipeline-flow'), 'b', {
    title: 'Submagic: Straight To Posted',
    variant: 'b',
    register: 'light',
    steps: [
      { step: 'Auto Edit', icon: 'bolt' },
      { step: 'Publish Ready', icon: 'star' },
      { step: 'Posted', icon: 'rocket' },
    ],
    beats: [
      { step: 'Auto Edit', at: 0.6 },
      { step: 'Publish Ready', at: 2.44 },
      { step: 'Posted', at: 4.2 },
    ],
  }, [1.2, 3.0]);
  assert.equal(res.broken, true, 'the probe must reject the input that actually shipped clipped');
  assert.ok(res.offenders.length > 0);
});

test('the probe passes the same card with a title that fits', async () => {
  // same fixture, 3-word title — the shipped fix. Guards against a probe that
  // simply reports everything as broken.
  ...assert.equal(res.broken, false);
});
```

Also unit-test the pure helpers (`fillToCapacity`, `probeTimes`) with no browser.

**Verify**: `cd pipelines/video/card-library && node --test scripts/overflow-probe.test.mjs` → all pass. Both tests must be present; a suite with only the passing case does not satisfy this step.

### Step 5 — Derive the caps

Run `node scripts/overflow-probe.mjs --derive`. It writes measured `max_words` into `catalog.json` for the cards that need them. Ten non-structural cards declare `variants` and only `enacted/pipeline-flow` currently has an explicit cap:

`statement/keyword-statement`, `overlay/tip-banner`, `enacted/fill-gauge`, `enacted/race-bars`, `enacted/counter-tally`, `enacted/before-after`, `enacted/spotlight-focus`, `enacted/timeline-scrub`, `enacted/terminal-enact`.

**Verify**: `node scripts/check-catalog.mjs` → `catalog ok`; `git diff --stat catalog.json` shows only added `max_words` lines (**no mass re-encoding** — if the diff is hundreds of lines, the JSON was round-tripped: revert and use text surgery); `node scripts/overflow-probe.mjs` → exit 0, every card `ok`.

### Step 6 — Wire the gate into `check-cards.sh`

Add a section, matching the existing style:

```bash
echo "==> overflow probe (declared capacity, every layout variant)"
node scripts/overflow-probe.mjs || fail "a card overflows the canvas at its declared capacity"
```

**Verify**: `bash scripts/check-cards.sh` → ends `card check OK`, exit 0. Then temporarily widen one derived cap by 3 words, re-run, and confirm it **fails** — then revert. Report both outcomes.

### Step 7 — Document the contract

Add to `pipelines/video/card-library/DESIGN.md`, near the existing "Declared capacity is the TIGHTEST variant's capacity" section: capacity is **measured, not guessed** — `scripts/overflow-probe.mjs --derive` produces it, `check-cards.sh` enforces it, and `resolve.mjs`'s `validateVariable` rejects over-long copy at step 040 so it never reaches a render. Note that `ROLE_DEFAULTS` remains only a fallback for cards without variants.

**Verify**: `bash scripts/check-cards.sh` → still exits 0 (it greps DESIGN.md for the palette; do not disturb that section).

## Test plan

| Test | File | Follows |
|---|---|---|
| Probe rejects the known-bad c17 input | `scripts/overflow-probe.test.mjs` | new; prove-it-can-fail discipline |
| Probe accepts the fixed 3-word title | same | guards against a probe that fails everything |
| `fillToCapacity` respects `max_words` / `max_chars` | same | pure, no browser |
| `probeTimes` includes every beat `at` | same | pure, no browser |
| Board still injects a working probe | `visuals-flow-2/lib/board.test.mjs` (existing) | must stay green after Step 1 |

## Done criteria

1. `cd pipelines/video/card-library && node --test scripts/overflow-probe.test.mjs` → exit 0, and the suite contains BOTH the failing-input and passing-input fixtures.
2. `cd pipelines/video/card-library && node scripts/overflow-probe.mjs` → exit 0, one `ok` line per card per variant.
3. `cd pipelines/video/card-library && bash scripts/check-cards.sh` → ends `card check OK`, exit 0.
4. `cd pipelines/video/card-library && node scripts/check-catalog.mjs` → `catalog ok`.
5. `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → ends `visuals-flow check OK`.
6. `grep -c "function __measureOverflow" pipelines/video/visuals-flow-2/lib/board.mjs` → `0` (the inline copy is gone).
7. `node -e "const c=require('./pipelines/video/card-library/catalog.json');const v=c.cards.filter(x=>x.variants&&!x.structural);const bad=v.filter(x=>!Object.values(x.variables||{}).some(s=>s&&(s.max_words!==undefined||s.max_chars!==undefined))&&x.max_reveal_chars===undefined);if(bad.length)throw new Error('uncapped: '+bad.map(x=>x.slug));console.log('all variant cards capped')"` → prints `all variant cards capped`.
8. `git diff --stat pipelines/video/card-library/catalog.json` → fewer than 40 changed lines (proves no JSON re-encoding).

## STOP conditions

- **A card's derived cap comes out below 2 words.** That means the card's layout is genuinely too cramped, which is a design fix and out of scope. Stop and report the card and the number.
- **More than 6 cards need caps that look wrong** (absurdly small, or a field that should be a sentence capped at 2 words). Stop and report rather than writing bad caps into the catalog.
- **`npx hyperframes@latest browser path` prints nothing or a missing file.** Stop — do not `npm install puppeteer` or any browser-bundling package to work around it. Report so the owner can run `npx hyperframes browser ensure`.
- **The `catalog.json` diff exceeds 40 lines.** The JSON was round-tripped and the `-` escapes were destroyed. Revert the file and switch to targeted text surgery.
- **`bash scripts/check.sh` in `visuals-flow-2` goes red** after Step 1. The shared-module extraction changed board behaviour; revert Step 1 and report.
- **Any temptation to shrink a font, reduce a hero size, or truncate text with an ellipsis to make a card fit.** `DESIGN.md` forbids it ("never shrink a font to make a layout fit"; "capacity comes down to match the hero, never the other way around"). The output of this plan is smaller CAPS, never smaller type.

## Maintenance notes

- **The rotation guard is the tell.** `resolve.mjs`'s `lacksExplicitTextCap` pins any non-structural variant card to `variants[0]` until it declares an explicit cap. As Step 5 lands caps, those cards resume rotating — expect variant `b` to reappear in resolved videos. That is the intended effect and the visible sign the plan worked.
- **A reviewer should scrutinise** whether the derived caps are honest. A cap that equals the role default (7 for a heading) probably means the derive loop never actually overflowed the card, i.e. the probe is not exercising the tight variant. Spot-check one card by rendering it at cap + 2 words and confirming it clips.
- **`card-qa.mjs` is now redundant in part.** It still makes useful contact sheets for a human, but the machine truth lives in the probe. A later cleanup could have `card-qa` call the probe rather than duplicate the fill logic.
- **This plan does not cover** a single unbreakable token (a long URL) exceeding a `max_words` cap of 1. If that surfaces, add `max_chars` alongside `max_words` — the enforcement path in `validateVariable` already supports it.
