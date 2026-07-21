<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && node --test
ui: true
deploy:
needs: ["Independent of 115; both touch lib/resolve.mjs — land 115 first to avoid a conflict"]
---

# Plan 116: Beat-card timing determinism — no card ever renders a blank frame

## Summary

- **Problem statement**: A beat card's start time is chosen by the cue anchor while its content is driven by beat anchors, so a card can appear seconds before it has anything to show. Worse, 7 of 16 beat cards gate their own title/eyebrow on the first beat's time, so during that gap they render a **completely blank frame**. Lint rule W5 misses it entirely because its threshold is 8s.
- **Goals**:
  - Make beat-card placement **computed, not authored**: the resolver derives `start` from the first beat, so a model can no longer place a beat card badly.
  - Make every beat card render its chrome promptly regardless of beat timing.
  - Retune W5 into a regression detector that errors on dead air instead of tolerating it.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — resolver change and card edits are fully inlined below; visual output goes through the render+inspect gate.
- **Done criteria** (terse — full list below): `node --test` green; no card in `videos/*/resolved.json` has a first beat later than 0.8s; the 7 gated cards animate chrome at ~0.3s; W5 errors on a synthetic dead-air fixture.
- **Stop conditions** (terse — full list below): suite red before starting; any card whose chrome cannot be ungated without changing its look.
- **Test / verification for success**: unit tests on the resolver clamp, plus a rendered-frame inspection of two repaired cards at t=0.5s proving chrome is visible.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/visuals-flow/lib/resolve.mjs pipelines/video/visuals-flow/lib/lint-cues.mjs pipelines/video/card-library`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 115 (both edit `lib/resolve.mjs`; land 115 first)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Owner review of `opusclip-tutorial` on 2026-07-21 rejected cue `c31` (`verdict/persona-match`) because the card showed a bare orange gradient for its first 5+ seconds. The owner noted this was not the first occurrence and that it is visible in multiple places on the current board.

Measured across that video, **8 of 14 beat cards** idle 2s or longer before their first reveal:

```
c02  slate/headline-chips      first beat 5.46s
c05  overlay/verdict-chips     first beat 2.12s
c10  checklist/icon-pills      first beat 7.38s
c15  checklist/icon-pills      first beat 4.36s
c22  overlay/verdict-chips     first beat 3.04s
c22a slate/headline-chips      first beat 2.14s
c30  comparison/summary-table  first beat 4.44s
c31  verdict/persona-match     first beat 6.42s
```

`W5 first-beat-idle` fired on **none** of them — its threshold is `FIRST_BEAT_IDLE_MAX = 8`.

There are two independent defects and both must be fixed.

### Defect 1 — cards gate their own chrome on the first beat

`card-library/verdict/persona-match/index.html`, lines 94–96, verbatim:

```js
const firstAt = DATA.beats.length ? Math.max(0, Math.min(...DATA.beats.map(b => Number(b.at))) - 0.3) : 0.3;
tl.from('#eyebrow', { opacity: 0, y: 14, duration: 0.45, ease: 'power2.out' }, Math.max(0, firstAt - 0.15));
tl.from('#title',   { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, firstAt);
```

Because these are `tl.from()` tweens starting at `firstAt`, the elements sit at their "from" state (`opacity: 0`) until then. With a first beat at 6.42s the title is invisible for 6.12s. The card's own `data-composition-variables` demo beats run 0.6–4.2s, so the flaw is invisible in isolation and only appears with real resolver output.

Seven cards share this pattern (confirmed by `grep -l firstAt */*/index.html`):

```
checklist/icon-pills
comparison/credits-math
comparison/table-rows
process/step-flow
pros-cons/pros-cons
verdict/persona-match
verdict/winners-podium
```

Cards NOT in that list (`slate/headline-chips`, `comparison/summary-table`) render chrome immediately — which is exactly why the owner did not flag `c02`'s 5.46s idle: its headline was on screen the whole time.

### Defect 2 — placement is authored, so it can be authored badly

`lib/resolve.mjs` lines 104–130 compute `start` purely from the cue anchor:

```js
    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + a.len;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    const start = Math.max(0, a.start - lead);
    ...
      for (const b of cue.beats ?? []) {
        const m = findFrom(b.anchor, cursor);
        if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
        cursor = m.idx + m.len;
        beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
      }
    ...
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
```

Nothing relates `start` to the first beat. Choosing an anchor close to the first beat is left to the model's judgment — precisely the model-dependent variance this work exists to remove.

**Owner decision (2026-07-21):** for beat cards the anchor becomes **advisory** — it determines ordering only, and the resolver computes `start` from the first beat. The clamp applies to **all videos**, with no legacy flag; `test-01` and `test-02` re-resolve with shifted times and that is accepted.

## Current state

- `lib/resolve.mjs` — `resolveCues()` is the only place cue times are computed. Excerpt above.
- `lib/lint-cues.mjs` line 21: `const FIRST_BEAT_IDLE_MAX = 8; // s a beat card may sit before its first reveal (owner: an empty scaffold reads as broken, test-02 c29)`
- `lib/lint-cues.mjs` lines 157–165 hold the W5 implementation.
- Beat cards are those with catalog `kind: "beat"`. `kind: "word-sync"` (only `slate/kinetic-sentence`) builds beats via `wordSyncBeats()` and already starts at ~0.3s — **leave word-sync untouched**.
- Card timelines: every card has a `/* ===== TIMELINE (LOCKED) ===== */` marker. `card-library/CLAUDE.md` says the TIMELINE block is the shared motion feel — this plan changes only the two chrome tweens inside it, never the row/beat tweens.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full suite (merge gate) | `cd pipelines/video/visuals-flow && node --test` | exit 0, `# fail 0` |
| Re-resolve a video | `cd pipelines/video/visuals-flow && node lib/resolve.mjs <slug>` | exit 0 |
| Lint a video | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs <slug>` | exit 0 |
| Card structure check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Render one card to inspect | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render <type>/<card> --out /tmp/x.mp4` | mp4 written |
| Extract a frame to LOOK at | `ffmpeg -v error -ss 0.5 -i /tmp/x.mp4 -frames:v 1 /tmp/x.png -y` | png written |

Never author a `test_cmd` as `node --test <dir>/` — it fails on node 22.14 (`plans/runs/LESSONS.md`, 2026-07-09).

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/resolve.mjs`
- `pipelines/video/visuals-flow/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow/lib/resolve.test.mjs`, `lib/lint.test.mjs`
- The 7 cards listed above (`index.html`, TIMELINE chrome tweens only)
- `pipelines/video/card-library/catalog.json` — add `pre_beat_render` to beat cards
- `pipelines/video/card-library/DESIGN.md` — record the chrome rule
- `videos/test-01/resolved.json`, `videos/test-02/resolved.json`, `videos/opusclip-tutorial/resolved.json` (regenerated outputs)

**Out of scope**:
- Any `cues.json`. This plan changes how cues resolve, never what the cues say. Do not "fix" a cue to dodge a failing check.
- `slate/kinetic-sentence` and the `word-sync` code path.
- Row/beat/glow tweens inside any card. Only `#eyebrow` and `#title` (and equivalent chrome ids) move.
- Re-rendering or re-approving any video.

## Git workflow

- Branch: `advisor/116-beat-card-timing`
- Commit per step. Message style: `fix(visuals-flow): derive beat-card start from first beat`. No AI footers. Do NOT push.

## Steps

### Step 1: Ungate chrome in the 7 cards

For each of the 7 cards, change the two chrome tweens so they no longer depend on `firstAt`. Keep `firstAt` where it is used for row timing. The edit, shown for `verdict/persona-match`:

```js
// BEFORE
tl.from('#eyebrow', { opacity: 0, y: 14, duration: 0.45, ease: 'power2.out' }, Math.max(0, firstAt - 0.15));
tl.from('#title',   { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, firstAt);

// AFTER — chrome enters immediately, independent of when beats land
const CHROME_IN = 0.15;
tl.from('#eyebrow', { opacity: 0, y: 14, duration: 0.45, ease: 'power2.out' }, CHROME_IN);
tl.from('#title',   { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, CHROME_IN + 0.15);
```

Apply the same shape to each card, mapping to whatever chrome ids that card uses (`#eyebrow`, `#title`, `#heading`, `#head`, table header rows). **Read each file and adapt; do not blind-replace.** Row/beat tweens keep using `firstAt` and their per-beat `at` offsets exactly as they are.

`comparison/table-rows` and `comparison/summary-table` also draw a header row — that header counts as chrome and must enter at `CHROME_IN` too.

**Verify** (per card, and this is the render+inspect gate from `plans/runs/LESSONS.md` 2026-07-19 — do not trust "render succeeded"):

```
cd pipelines/video/card-library
npx --yes hyperframes@0.7.62 render verdict/persona-match --out /tmp/pm.mp4
ffmpeg -v error -ss 0.5 -i /tmp/pm.mp4 -frames:v 1 /tmp/pm.png -y
```

Then **open `/tmp/pm.png` and look at it**. Expected: the title is legible at t=0.5s. A blank/gradient-only frame is a FAIL. Repeat for all 7 cards; attach at least two of these PNGs to the PR (`ui: true`).

### Step 2: Derive beat-card start from the first beat

In `lib/resolve.mjs`, restructure the loop body so beat anchors resolve **before** `start` is fixed. Replace the block quoted in "Current state" with:

```js
const BEAT_LEAD_IN = 0.6; // s a beat card is on screen before its first reveal

    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + a.len;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    let start = Math.max(0, a.start - lead);

    const beats = [];
    let failed = false;
    if (cat.kind === 'word-sync') {
      const r = wordSyncBeats(cue, W, a.idx, start);
      if (r.err) { errors.push(`${cue.id}: ${r.err}`); continue; }
      beats.push(...r.beats);
      cursor = r.cursor;
    } else {
      // Resolve every beat anchor to an ABSOLUTE time first — the cue anchor is
      // advisory for beat cards (owner decision 2026-07-21): it fixes ordering,
      // the first beat fixes placement. This makes dead air structurally
      // impossible instead of merely lint-detectable.
      const abs = [];
      for (const b of cue.beats ?? []) {
        const m = findFrom(b.anchor, cursor);
        if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
        cursor = m.idx + m.len;
        abs.push({ reveal: b.reveal, at: m.start });
      }
      if (!failed) {
        if (abs.length) start = Math.max(0, +(abs[0].at - BEAT_LEAD_IN).toFixed(2));
        for (const x of abs) beats.push({ ...x.reveal, at: +(x.at - start).toFixed(2) });
      }
    }
    if (failed) continue;
```

The rest of the loop (duration, fullframe-overlap check, entry construction) is unchanged and now reads the corrected `start`.

Two consequences to expect and accept:
- `start` moves **later** or stays equal, never earlier (beat anchors always follow the cue anchor in the forward-only cursor).
- `duration` shrinks by the same amount, because `duration = lastBeat.at + hold` and every `at` shrinks. The dead air leaves the timeline rather than being hidden.

**Verify**:
```
cd pipelines/video/visuals-flow && node lib/resolve.mjs opusclip-tutorial
node -e "const r=require('./videos/opusclip-tutorial/resolved.json');const bad=r.resolved.filter(c=>c.variables.beats&&c.variables.beats.length&&c.variables.beats[0].at>0.8);console.log(bad.length===0?'no dead air':'DEAD AIR: '+bad.map(b=>b.id+'@'+b.variables.beats[0].at).join(', '))"
```
-> `no dead air`

### Step 3: Add `pre_beat_render` to the catalog

For every `kind: "beat"` card, add a field declaring what is on screen before the first reveal:

- `"chrome"` — eyebrow/title visible (all 7 repaired cards, plus `headline-chips`, `verdict-chips`, `key-takeaways`, etc.)
- `"frame"` — chrome plus structural scaffold such as a table header or product columns (`comparison/summary-table`, `comparison/feature-matrix`, `comparison/table-rows`)

After Step 1 no card may declare `"none"`. If one genuinely renders nothing, that is a Step 1 miss — go back and fix the card.

**Verify**: `node -e "const c=require('./pipelines/video/card-library/catalog.json');const b=c.cards.filter(k=>k.kind==='beat');const miss=b.filter(k=>!k.pre_beat_render);const none=b.filter(k=>k.pre_beat_render==='none');console.log('beat cards',b.length,'missing',miss.length,'none',none.length)"` -> `missing 0 none 0`

### Step 4: Retune W5 into a regression detector

In `lib/lint-cues.mjs`:

```js
// Dead air is now designed out by the resolver's BEAT_LEAD_IN clamp (plan 116);
// W5 stays as the regression detector for that clamp, not as a style hint.
const FIRST_BEAT_IDLE_MAX = { chrome: 1.2, frame: 2.5 };
```

Rewrite the W5 block so it:
- looks up the card's `pre_beat_render` and picks the matching threshold (default `chrome`),
- pushes to **`errors`** when the card's placement is `fullframe` (dead air fills the screen),
- pushes to **`warnings`** when placement is `overlay` (the recording is still visible underneath),
- keeps the existing message shape, appending the threshold actually applied.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/lint.test.mjs` -> exit 0

### Step 5: Regression tests

In `lib/resolve.test.mjs`:
1. A beat cue whose cue anchor sits ~6s before its first beat anchor resolves with `beats[0].at` within `0.6 ± 0.05` — proving the clamp, and directly regressing owner-rejected `c31`.
2. The same cue's `start` equals `firstBeatAbsolute - 0.6`.
3. A `word-sync` cue is unaffected (`slate/kinetic-sentence` keeps its existing `at` values).
4. A single (non-beat) cue still honours `lead` off the cue anchor.

In `lib/lint.test.mjs`:
5. A synthetic resolved fullframe beat card with `beats[0].at = 3.0` and `pre_beat_render: "chrome"` produces an **error** containing `first-beat-idle`.
6. The same as an overlay produces a **warning**, not an error.

**Verify**: `cd pipelines/video/visuals-flow && node --test` -> exit 0, `# fail 0`

### Step 6: Re-resolve the committed videos

Run the resolver for `test-01`, `test-02`, `opusclip-tutorial` and commit the regenerated `resolved.json`. Then lint each and record the before/after warning counts in the commit message.

Do **not** re-approve, re-render, or edit any `cues.json`. If a video that linted clean now reports a new **error**, stop (see STOP conditions).

**Verify**: `cd pipelines/video/visuals-flow && for s in test-01 test-02 opusclip-tutorial; do node lib/resolve.mjs $s || exit 1; done` -> exit 0 for all three

### Step 7: Document

Add to `card-library/DESIGN.md` a "Chrome timing" rule: a beat card's eyebrow/title/header must animate in within ~0.3s of the card appearing and must never be scheduled off a beat time; only per-beat rows may wait for beats. Note that `catalog.pre_beat_render` declares the result and lint W5 enforces it.

**Verify**: `grep -c "Chrome timing" pipelines/video/card-library/DESIGN.md` -> at least `1`

## Test plan

- Resolver tests extend `lib/resolve.test.mjs`; lint tests extend `lib/lint.test.mjs`. No new runner, no new dependency.
- Visual verification is manual frame extraction (Step 1) because no automated check can judge "is the title legible".
- The merge gate is the full visuals-flow suite.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0 with `# fail 0`
- [ ] No beat card in any `videos/*/resolved.json` has `beats[0].at > 0.8`
- [ ] `grep -l firstAt pipelines/video/card-library/*/*/index.html` returns the same 7 files, and in each the `#title`/`#eyebrow` tweens no longer reference `firstAt`
- [ ] Every `kind: "beat"` catalog card has `pre_beat_render`, and none is `"none"`
- [ ] Extracted frames at t=0.5s for at least 2 repaired cards show legible chrome (PNGs attached to the PR)
- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope list

## STOP conditions

- **The suite is red before you start.** Run `node --test` at `18488a2` first; a pre-existing failure is not this plan's to fix.
- **A card's chrome cannot be ungated without changing its look** — e.g. the chrome tween is load-bearing for a transition. Stop and report which card; do not redesign the animation.
- **A previously clean video reports a new resolver or lint ERROR** after Step 6. Warnings changing is expected and fine; a new error means the clamp interacts with something this plan did not anticipate. Stop and report the cue id.
- **A repaired card's extracted frame is still blank at t=0.5s.** Do not proceed to the next card; the fix is wrong.
- **You are tempted to edit a `cues.json`.** That is out of scope in every case.

## Maintenance notes

- `BEAT_LEAD_IN` is the single knob controlling how long a beat card breathes before its first reveal. It lives in `lib/resolve.mjs`. Plan 118 moves lint/resolver constants into one exported module — this constant joins them there.
- With the clamp in place W5 should never fire in normal operation. If it starts firing, the clamp has regressed; treat it as a resolver bug, not a cue-authoring problem.
- The advisory-anchor rule applies to `kind: "beat"` only. If a future card kind needs authored placement, it must opt out explicitly rather than by omission.
- Reviewers should scrutinise Step 1 card-by-card: the seven cards use different chrome element ids, and a blind find/replace across them is the most likely way this lands broken.
