---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: [205 — the /intro-teaser route, the playable list on introData, and POST /reject-intro-idea all land there]
needs_prs: [164]
touches: [pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx, pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.css, pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs, pipelines/video/visuals-flow/lib/fixtures/board]

mutation_apply: python3 -c "import base64;exec(base64.b64decode('cD0ncGlwZWxpbmVzL3ZpZGVvL3Zpc3VhbHMtZmxvdy9ib2FyZC11aS9zcmMvdGFicy9JbnRyb1RhYi50c3gnCnM9b3BlbihwKS5yZWFkKCkKbT0nSURFQS1URUFTRVItTk9ULVJFTkRFUkVEJwphc3NlcnQgbSBpbiBzLCAnbWFya2VyIG1pc3NpbmcgLSBwbGFuIDIwNiBTdGVwIDEgZGlkIG5vdCBsYW5kJwpzPXMucmVwbGFjZShtLCAndGVhc2VyIG1pc3NpbmcnKQpvcGVuKHAsJ3cnKS53cml0ZShzKQ=='))"
mutation_command: cd pipelines/video/visuals-flow && ( cd board-ui && npm run build ) && node scripts/board-ui-smoke.mjs
mutation_expect: IDEA-TEASER-NOT-RENDERED
mutation_cwd:
mutation_timeout: 900
---

# Plan 206: visuals-flow — the board's idea gate plays the teasers

## Summary

- **Problem statement**: plan 205 renders a 6-second teaser per proposed intro
  direction and serves it at `/intro-teaser`, but the board's Intro tab still
  renders the idea gate as three blocks of prose with an Approve button under each.
  The owner would still be picking a direction by reading.
- **Goals**:
  - Gate 120 shows **three players**, one per direction, with the prose demoted to a
    caption under each.
  - A direction with no rendered teaser cannot be approved from the board, and says
    why.
  - "Reject all" is a real control: a note composer that posts the owner's own words
    to `/reject-intro-idea`.
  - Every degraded state on this surface renders something honest instead of an
    enabled button that 400s.
- **Executor proposed**: `claude-p` / `sonnet` — a small React surface whose value is
  entirely in how it reads, plus a smoke fixture; content/taste work is rules.md's
  `claude-p`/`sonnet` row.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0;
  the new smoke fixture proves two `<video>` elements and one disabled approve
  button render on `#intro`; a screenshot of the gate is committed.
- **Stop conditions** (terse — full list below): no new UI idiom, no unstyled
  UA-default controls, no touching the film-review branch of the tab, no weakening
  a smoke assertion to get green.
- **Test / verification for success**: an added `board-ui-smoke.mjs` fixture pass
  that dump-DOMs `#intro` against an unapproved `idea.json` and asserts on the
  rendered markup, plus the existing vitest suite.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6145e4bc..HEAD -- pipelines/video/visuals-flow/board-ui pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plan 205 (must be merged first)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `6145e4bc`, 2026-08-17

## Why this matters

Plan 205 makes the artifact right. This plan makes the owner actually see it.

The whole chain — 2k tokens per teaser instead of 18k per rejected film — pays off
only at the moment the owner watches three clips and says "that one". If the tab
still leads with prose, the teasers are a file on disk nobody opens, and the gate
keeps failing the way it fails today.

There is a second, quieter failure this closes. Today `handleApproveIntroIdea`
accepts any id in `directions`. After 205 it refuses one with no rendered teaser —
so without this plan the board offers a button that returns 400 with no explanation.
An enabled control that cannot work is exactly the invented-behavior failure the
readiness gate's degraded-state rule exists to prevent.

## Current state

`pipelines/video/visuals-flow/board-ui/` is a Vite + React + TS app (the repo's
browser-UI standard, decisions.md 2026-07-31). Its `package.json` scripts:
`dev`, `build` (`tsc && vite build`), `typecheck`, `test` (`vitest run`), `preview`.

`board-ui/src/tabs/IntroTab.tsx` owns gate 120. Its idea-gate branch is verbatim
today (lines 104–144):

```tsx
  // Gate 028 — the idea gate, reviewed BEFORE any beat exists. idea.json can
  // be present with no screenplay.json on disk yet; once approved, the tab
  // falls through to the normal film review below. A page of prose is the
  // cheapest rejection in the pipeline (plan 197).
  if (data.idea && !data.idea.approved) {
    return (
      <div className="intro-tab" style={{ padding: 24 }}>
        <div className="intro-idea-directions">
          {data.idea.directions?.map((d: any) => (
            <div key={d.id} className="intro-idea-direction">
              <h3>{d.id} — {d.name}</h3>
              <div className="intro-idea-field"><strong>Central object:</strong> {d.central_object}</div>
              <ul className="intro-idea-arc">
                {d.arc?.map((clause: string, i: number) => <li key={i}>{clause}</li>)}
              </ul>
              <div className="intro-idea-field"><strong>Motifs:</strong> {d.motifs?.join(', ')}</div>
              <div className="intro-idea-field"><strong>Enacts through-line:</strong> {d.enacts_throughline}</div>
              <div className="intro-idea-field"><strong>Rejects:</strong> {d.rejects}</div>
              <button
                className="intro-idea-approve-btn"
                onClick={async () => {
                  try {
                    const res = await fetch('/approve-intro-idea', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ chosen: d.id }),
                    });
                    if (res.ok) await loadData();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Approve direction {d.id}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
```

`loadData()` fetches `/api/intro-data`, `/api/board-data` and probes `/intro-video`
— **each in its own `try`**, because chaining them in one `try` once made a
`board-data` 500 land in a catch that set `videoMissing`, so the tab claimed the
film was unrendered while it sat on disk. Keep that posture for anything you add.

After plan 205, `data.idea` additionally carries:

```
round:     number    (1-based; incremented by each rejection)
rejected:  Array<{ round: number, note: string, directions: any[] }>
playable:  string[]  (direction ids with a rendered teaser mp4 on disk)
```

and the server exposes `GET /intro-teaser?id=<id>&video=<slug>` (Range-capable,
`no-cache`) plus `POST /reject-intro-idea` with body `{ note: string }`, which
returns `{ ok, round, exhausted }`.

`scripts/board-ui-smoke.mjs` builds fixture workdirs from `lib/fixtures/board/`
(`const fixturesDir = path.join(process.cwd(), 'lib', 'fixtures', 'board')`), serves
the board, and drives headless Chrome with `--dump-dom` over
`HASHES = ['', '#intro', '#storyboard', '#avatar', '#final-cut', '#calibrate']`,
asserting on the returned markup. It already has an intro-film fixture pass. It has
**no idea-gate fixture** — that is what this plan adds.

`board-ui/src/tabs/IntroTab.css` owns Intro-specific chrome only; the player,
comments and composer live in `components/ReviewSurface.{tsx,css}`, shared with
Final Cut. `.intro-idea-*` classes already exist there.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Typecheck | `cd pipelines/video/visuals-flow/board-ui && npm run typecheck` | exit 0 |
| UI units | `cd pipelines/video/visuals-flow/board-ui && npx vitest run` | exit 0 |
| Build (smoke needs dist) | `cd pipelines/video/visuals-flow/board-ui && npm run build` | exit 0 |
| Smoke | `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` | exit 0 |

`check.sh` builds `board-ui/dist` before the board tests on purpose — on a fresh
checkout `dist` is gitignored and the suite fails without it. Never reorder it.

## Scope

**In scope**:
- `board-ui/src/tabs/IntroTab.tsx` — the idea-gate branch only
- `board-ui/src/tabs/IntroTab.css`
- `scripts/board-ui-smoke.mjs` — one new fixture pass
- `lib/fixtures/board/` — the new idea-gate fixture files
- one committed screenshot of the gate (the `ui: true` merge gate)

**Out of scope** (looks related, do not touch, because…):
- Everything below the idea-gate branch in `IntroTab.tsx` — the `<ReviewSurface>`
  film review, the beat sheet, the findings panel, the approve-film action. That is
  gate 150 and a different review.
- `components/ReviewSurface.{tsx,css}` — shared with Final Cut; a change here
  silently changes that tab too.
- `lib/board.mjs`, `lib/board-data.mjs`, `lib/intro-film/teasers.mjs` — all landed
  by plan 205. If something is missing there, STOP; do not patch the server from
  this plan.
- `src/lib/router.ts` — the tab list is registry-derived and correct.
- Anything under `videos/`.

## Git workflow

- Branch: `advisor/206-vf-intro-idea-teaser-gate-ui`
- Commit: one per step, `feat(plan-206): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Replace the idea-gate branch

Rewrite the `if (data.idea && !data.idea.approved)` branch. The structure below is
the specification, not a suggestion — the class names in particular are load-bearing
(`intro-idea-teaser` is this plan's mutation marker, and the smoke asserts on the
others).

Behaviour, exactly:

1. `const playable = new Set(data.idea.playable || [])`.
2. **If `directions` is empty and `rejected` is non-empty** — the owner rejected a
   round and 110 has not re-run. Render, with no approve controls at all:
   - a heading naming the round they rejected,
   - each `rejected` entry's `note` verbatim, in a blockquote,
   - the next command as `<code>bash run.sh {video} intro-idea</code>`,
   - and, when `data.idea.round > 3`, an additional line replacing that command:
     *"Three rounds is the cap. Describe the direction you want directly instead of
     asking for a fourth set."*
3. **If `directions` is empty and `rejected` is empty** — the idea pass has not
   written anything usable. Render `Run <code>bash run.sh {video} intro-idea</code>`
   and nothing else.
4. **Otherwise**, one card per direction, in a grid, each containing IN THIS ORDER:
   - `<h3>{d.id} — {d.name}</h3>`
   - **the player**, when `playable.has(d.id)`:
     ```tsx
     <video
       className="intro-idea-teaser"
       src={`/intro-teaser?id=${encodeURIComponent(d.id)}&video=${encodeURIComponent(video)}`}
       controls loop muted playsInline preload="metadata"
     />
     ```
     `muted` + `loop` are deliberate: six seconds is short enough to want a second
     look, and the gate judges picture, not sound — the teaser has no audio track.
   - **when NOT `playable.has(d.id)`**, in place of the player:
     ```tsx
     <div className="intro-idea-teaser-missing">
       IDEA-TEASER-NOT-RENDERED — run <code>bash run.sh {video} intro-teasers</code>
     </div>
     ```
     **`IDEA-TEASER-NOT-RENDERED` is the mutation marker.** The smoke asserts on
     that exact literal and the merge gate rewrites it to prove the assertion can
     fire. Do not reword it, do not move it into a constant, do not translate it
     into friendlier copy — it is user-visible AND a test contract at once, which
     is deliberate: the owner needs to be told why there is no player, and the
     gate needs a string it can break.
   - the prose fields, **demoted below the player**, unchanged in content from the
     current markup: Central object, the arc `<ul>`, Motifs, Enacts through-line,
     Rejects. They are the caption now, not the artifact.
   - the approve button, `disabled={!playable.has(d.id)}` with
     `title={!playable.has(d.id) ? 'render the teaser first' : undefined}`, posting
     the same `/approve-intro-idea` body as today and calling `loadData()` on ok.
5. **Below the grid**, the reject-all composer:
   - a `<textarea className="intro-idea-reject-note">` with placeholder
     *"What is wrong with all three? Your words go to the next round."*
   - a `<button className="intro-idea-reject-btn">Reject all directions</button>`,
     `disabled` while the textarea is empty or whitespace,
   - on click: POST `/reject-intro-idea` with `{ note }`, then `await loadData()`
     and clear the textarea. Wrap the fetch in its own `try/catch` that
     `console.error`s — same posture as `loadData`.

Type the direction as `any` to match the file's existing style; do not introduce a
new interface for it in this plan.

**Verify**: `cd pipelines/video/visuals-flow/board-ui && npm run typecheck && npx vitest run` → both exit 0

### Step 2: Style it

In `IntroTab.css`, add rules for the new elements. Requirements, not suggestions:

- `.intro-idea-directions` is a responsive grid: `display: grid;`
  `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;` so two or
  three directions sit side by side and are compared, not scrolled between.
  Comparison is the entire purpose of this surface.
- `.intro-idea-teaser` is `width: 100%; aspect-ratio: 16/9; display: block;` with the
  board's own border/background tokens.
- `.intro-idea-teaser-missing` fills the same 16/9 box so a missing teaser does not
  collapse the card and misalign the row.
- `.intro-idea-reject-note` and both buttons take the board's existing control
  tokens — the same custom properties the neighbouring rules in this file already
  use. **Do not leave any control at its user-agent default.** A UA-default
  `<select>`/`<button>`/`<textarea>` renders white-on-dark and has been
  re-introduced by three separate UI passes here (`plans/runs/LESSONS.md`,
  2026-07-31); check every interactive control you added, not just the players.
- Disabled approve buttons must be visibly disabled (reduced opacity plus
  `cursor: not-allowed`), never merely inert.

**Verify**: `cd pipelines/video/visuals-flow/board-ui && npm run build` → exit 0

### Step 3: The smoke fixture

Add to `lib/fixtures/board/` an idea-gate fixture: an `idea.json` with `approved:
false`, `round: 1`, `rejected: []`, and **two directions `a` and `b`**, each with
`name`, `central_object`, `arc` (3 clauses), `motifs`, `enacts_throughline`,
`rejects`.

In `scripts/board-ui-smoke.mjs`, add one pass following the shape of the existing
intro-film fixture pass:

1. Build a fixture workdir containing `intro-film/idea.json` from the fixture above.
2. Create `intro-film/teasers/a.mp4` — a real, tiny mp4. Use the same ffmpeg
   approach the existing intro player check uses, and follow its precedent of
   **SKIPping with a printed message when ffmpeg is unavailable** rather than
   failing the suite. Deliberately do NOT create `teasers/b.mp4`.
3. dump-DOM `#intro` for that workdir and assert:
   - exactly **one** `class="intro-idea-teaser"` `<video>` element (direction `a`),
   - the literal string `IDEA-TEASER-NOT-RENDERED` appears **once** (direction `b`),
   - a `disabled` approve button is present,
   - `intro-idea-reject-note` is present.

   Each assertion throws with a message naming what was expected and what was found.
   **The missing-teaser assertion's own error message must begin with the literal
   `IDEA-TEASER-NOT-RENDERED`**, e.g.:

   ```js
   if (missingCount !== 1) {
     throw new Error(`IDEA-TEASER-NOT-RENDERED assertion failed on #intro: expected 1 missing-teaser box, found ${missingCount}`);
   }
   ```

   That is not decoration. The merge gate rewrites the literal in `IntroTab.tsx` and
   requires `IDEA-TEASER-NOT-RENDERED` to appear in the resulting FAILURE OUTPUT — so
   the code has to live in the thrown message, not only in the markup being searched
   for. An assertion that fails without printing the code makes the mutation gate
   report a false negative, which is the failure mode that shipped two unfireable
   gates on 2026-08-02.

**Verify**:
```
cd pipelines/video/visuals-flow
( cd board-ui && npm run build )
node scripts/board-ui-smoke.mjs        # exit 0
```

**Verify (the gate really fires — run this exact sequence, it is the merge gate)**:
```
cd pipelines/video/visuals-flow
sed -i '' 's/IDEA-TEASER-NOT-RENDERED/teaser missing/g' board-ui/src/tabs/IntroTab.tsx
( cd board-ui && npm run build ) && node scripts/board-ui-smoke.mjs 2>&1 | grep -c IDEA-TEASER-NOT-RENDERED   # >= 1
git checkout board-ui/src/tabs/IntroTab.tsx
( cd board-ui && npm run build ) && node scripts/board-ui-smoke.mjs                                            # exit 0
```

The mutated run must BOTH exit non-zero AND print `IDEA-TEASER-NOT-RENDERED`. If it
fails without printing the code, the assertion message is wrong — fix the message,
not the mutation.

### Step 4: Commit the screenshot

`ui: true` is an enforced merge gate — boss REJECTS the branch unless it commits an
image. Capture the idea gate with two directions, one playable and one not, and
commit it. Reuse `board-ui-smoke.mjs`'s existing `--screenshot` invocation shape
rather than inventing a capture path.

The screenshot must show, in one frame: both direction cards side by side, the
player on `a`, the `IDEA-TEASER-NOT-RENDERED` box on `b`, `b`'s disabled approve
button, and the reject composer.

**Verify**: `git status --porcelain | grep -E '\.(png|jpg)$'` → at least one line

### Step 5: Fresh-checkout gate

```bash
cd pipelines/video/visuals-flow
git clean -ndx board-ui    # inspect only; dist is gitignored and must rebuild
bash scripts/check.sh
```

**Verify**: exit 0, prints `visuals-flow check OK`

## Test plan

- `board-ui`'s existing `vitest run` must stay green; add a unit only if a pure
  function falls out of Step 1 (none is expected — the branch is presentational).
- The real coverage is the `board-ui-smoke.mjs` fixture pass from Step 3. A UI
  behaviour with no machine-checkable verify silently downgrades to a lookalike stub
  (`plans/runs/LESSONS.md`, 2026-07-24) — that is why the smoke asserts on the
  player count, the missing-teaser string, the disabled button and the composer
  rather than on "the page rendered".
- Both are reached by `bash scripts/check.sh`.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`
- [ ] `cd pipelines/video/visuals-flow/board-ui && npm run typecheck` exits 0
- [ ] `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` exits 0
- [ ] Rewriting the `IDEA-TEASER-NOT-RENDERED` literal in `IntroTab.tsx` makes the smoke exit non-zero AND print `IDEA-TEASER-NOT-RENDERED`; reverting makes it pass
- [ ] A screenshot of the idea gate is committed and shows a player, a missing-teaser box, a disabled approve button and the reject composer
- [ ] `grep -c "ReviewSurface" board-ui/src/tabs/IntroTab.tsx` is unchanged from before this plan (the film-review branch was not touched)
- [ ] `git status --porcelain pipelines/video/visuals-flow/videos` is EMPTY

## STOP conditions

- **Gate integrity**: if a smoke assertion fails, fix the component. Weakening,
  loosening or deleting the assertion is a STOP.
- If plan 205's `/intro-teaser`, `POST /reject-intro-idea`, or `playable` on
  `introData` is absent, STOP and report. Do not implement the server side here —
  a second implementation is how the two drift.
- If any interactive control you add renders at its user-agent default, STOP and
  style it. This exact regression has shipped three times on this board.
- If a change is needed in `components/ReviewSurface.{tsx,css}`, STOP — that file is
  shared with Final Cut and changing it silently changes another gate.
- If ffmpeg is unavailable in the environment, the fixture pass must SKIP with a
  printed message, exactly as the existing intro player check does. Do not stub the
  mp4 with an empty file — a zero-byte mp4 makes `<video>` render an error state and
  the assertion would pass for the wrong reason.
- If any file under `videos/` changes, revert it and STOP.

## Maintenance notes

- Two strings here are test contracts, not copy: the `intro-idea-teaser` class name
  (the smoke counts players by it) and the `IDEA-TEASER-NOT-RENDERED` literal (the
  mutation gate rewrites it, and the smoke's assertion message must echo it).
  Changing either means changing the smoke in the same commit.
- The three empty/degraded states (rejected-and-waiting, round cap exceeded, nothing
  proposed) are enumerated in Step 1 on purpose. A future direction-list change must
  say what each of them renders.
- `muted` on the teasers is correct only while teasers carry no audio track. If 110's
  contract ever allows sound, revisit it.
- The grid is `minmax(360px, 1fr)` so directions are compared side by side. A future
  layout change that stacks them vertically removes the reason this surface exists.
