---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: ["188 must land first — it is what produces intro-film/out/intro.mp4, the file this tab plays. Raised as PR #148."]
needs_prs: [148]
touches: [pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx, pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.css, pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/lib/board.test.mjs, pipelines/video/visuals-flow/steps/025-author-intro-film-llm/README.md]

# Reverting the guard widening must break the intro-key test. Data-free but
# behavioral: the test asserts on the endpoint's response, not on source text.
mutation_apply: cd pipelines/video/visuals-flow && sed -i '' "s/ && !key.startsWith('intro:')//" lib/board.mjs
mutation_command: cd pipelines/video/visuals-flow && node --test lib/board.test.mjs
mutation_expect: intro: keys must be editable
mutation_timeout: 900
---

# Plan 189: visuals-flow — review the intro film in motion, not as a contact sheet

## Summary

- **Problem statement**: The Intro tab (gate 027) reviews the intro film as a **static contact sheet** — three still frames per beat plus the stage line and an Approve button. The Final Cut tab (gate 120) reviews the assembled video **in motion**: a real player, scrubbing, frame stepping, and comments pinned to a timestamp. A film is judged in motion, and three stills a beat cannot show a transition landing badly or an ambient drift stalling. The owner asked for parity: "is there no review for intro step like final cut, where i can stop, add comment etc".
- **Goals**:
  - Play `intro-film/out/intro.mp4` in the Intro tab with play/pause, scrub, and frame stepping.
  - Pin timestamped comments to the current moment, and optionally to a clicked point on the frame, exactly as Final Cut does.
  - Persist them into the same `feedback.json` the 130 fold already reads, under an `intro:` key namespace, so the fold picks up intro notes with no extra plumbing.
  - Keep the per-beat stage lines and frames **below** the player — they are what a beat is judged *against*, and losing them would remove the only place the intent is written down.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner override on 2026-08-04 ("can we do all with agy"), applied to the whole 188–190 chain. The original proposal was `claude-p` / `sonnet` on the following reasoning, which still stands as a risk note: this is a UI port, where the executor reads `FinalCutTab.tsx` and re-expresses its player and comment machinery for a simpler single-file case. Per the orchestrate grading rider, "port by reference" is continuous judgment, not fully-inlined work — the 2026-07-31 board-SPA port shipped a data-loss punt and an invented colour scheme under green gates. The mutation gate, `check.sh` and the `ui: true` screenshot requirement are what actually hold that line, and they are executor-independent.
- **Done criteria** (terse): `scripts/check.sh` green; `/intro-video` serves the mp4 with Range support; a comment posted from the tab lands in `feedback.json` as an `intro:<n>` item carrying `t`; the tab degrades cleanly when the film is not rendered; screenshot committed.
- **Stop conditions** (terse): deleting the beat list; inventing a second feedback store; changing the Final Cut tab; changing `approve.mjs` or gate semantics.
- **Test / verification for success**: `lib/board.test.mjs` cases over the new endpoints and the key-prefix guard, plus a committed screenshot of the tab with the player and one pinned comment.
- **Open points for plan readiness**: none. 188 is raised as PR #148 and recorded in `needs_prs`, so dispatch refuses until it closes.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9d94b51b..HEAD -- pipelines/video/visuals-flow/board-ui/src/tabs pipelines/video/visuals-flow/lib/board.mjs`
> **This plan EXPECTS drift**: plan 188 must have landed. Confirm
> `lib/intro-film/render-film.mjs` exists. If it does not, STOP — this tab would
> have nothing to play.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM — it edits `board.mjs`, which every tab shares, and it writes to `feedback.json`, which the 130 fold consumes. A malformed key namespace pollutes the fold's input.
- **Depends on**: plan 188
- **Category**: feature
- **Difficulty**: standard (but ported — hence sonnet, see Summary)
- **Planned at**: commit `9d94b51b`, 2026-08-04

## Why this matters

`TASTE.md` T10 is the whole argument, and it was learned the expensive way:

> The review sampled one frame at each beat's midpoint. Three beats out of twelve
> put their content in the last third […] All three were invisible to the pass
> built to catch them, which is why the film reviewed cleaner than it was.

That fix took the frame count from one to three per beat. Three stills is still a
contact sheet. The defects that actually reach the owner are motion defects: a
transition that lands late, an object that snaps instead of carries, a hold where
nothing moves. On 2026-08-03 the film gate caught 5.7s of frozen picture that
**every still frame passed** — the stills each looked fine, the stretch between
them was dead.

The owner already has the right review surface one tab over. This plan gives the
intro the same one.

## Current state

### What IntroTab renders today

`board-ui/src/tabs/IntroTab.tsx` is 110 lines. It fetches `/api/intro-data`, then
renders a findings list and a per-beat block:

```tsx
{data.beats?.map((b: any, i: number) => (
  <div key={i} className="intro-beat">
    <div className="intro-beat-header">
      <strong>{b.id}</strong> · {b.intent} · {b.register} · {b.face}
    </div>
    <div className="intro-beat-clause">“{b.clause}”</div>
    <div className="intro-beat-content">
      <div className="intro-beat-stage">{b.stage}</div>
      <div className="intro-beat-frames">
        {b.frames?.map((f: string, j: number) => (
          <img key={j} src={`/intro-frame?f=${encodeURIComponent(f)}`} alt={f} />
        ))}
      </div>
    </div>
  </div>
))}
```

Plus an Approve button wired to `POST /approve-intro`. There is no `<video>` in
the file at all.

### What FinalCutTab gives, which you are porting

`board-ui/src/tabs/FinalCutTab.tsx` (16.4 KB) holds:

- a `videoRef` + `currentTime` / `paused` / `duration` / `scrubbing` state
- the keyboard contract, which it advertises to the owner in its own help line:

```
Space play/pause · ← → ±5s · ⇧+← → step a frame · just start typing to note the
current moment · click the frame to pin a note to that exact spot
```

- comment submission:

```tsx
const submitComment = async () => {
  const text = inputText.trim();
  if (!text && !pendingImage) return;
  const t = currentTime;
  const item: FcItem = { text, t, context: 'final@' + fmtClock(t) };
  if (currentPin) { item.x = currentPin.x; item.y = currentPin.y; }
  const res = await fetch('/feedback-final', {
    method: 'POST',
    body: JSON.stringify({ label: version, item, image: pendingImage?.url })
  });
  ...
};
```

- and comment filtering by key prefix:

```tsx
const comments = Object.entries(fcItems)
  .filter(([k]) => k.startsWith(`final-${version}:`))
  .sort(([a], [b]) => a.localeCompare(b));
```

### The server side you will mirror

`lib/board.mjs` already exports the pin helper — **reuse it, do not rewrite it**:

```js
export function pinFromClick(clientX, clientY, rect) {
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  return { x: +(x.toFixed(2)), y: +(y.toFixed(2)) };
}
```

Key allocation for final-cut comments (`appendFinalFeedback`, line 78) builds
`final-<label>:<n>` by scanning existing keys for the max index. Your intro
equivalent does the same with the prefix `intro:`.

The video route at line 1196 is your model for Range support — scrubbing does not
work without it:

```js
  const videoMatch = url.pathname.match(/^\/video\/(.+)$/);
  if (req.method === 'GET' && videoMatch) {
    ...
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      ...
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
```

And the edit/delete guard at line 1242, which currently rejects every non-final
key:

```js
    if (!key.startsWith('final-')) { res.statusCode = 400; return res.end('{"ok":false,"error":"final-* keys only"}'); }
```

### House rule that governs this work

`decisions.md` 2026-07-31 + the architecture contract: a board UI is a
**Vite+React+TS component app** — `board-ui/` already is one. Add a tab
component; do not introduce template strings or a second UI idiom.

## Commands you will need

```bash
cd pipelines/video/visuals-flow

bash scripts/check.sh                 # merge gate; includes the board-ui smoke
node --test lib/board.test.mjs        # focused server tests

# to see the tab (a video with intro: film and a rendered film):
bash run.sh consistent-ai-influencer board
```

`scripts/check.sh` ends with `board-ui smoke OK` then `visuals-flow check OK`.
Both must still appear.

## Scope

**In scope:**

- `board-ui/src/tabs/IntroTab.tsx` — the player, keyboard, comments
- `board-ui/src/tabs/IntroTab.css` — styles for the new player + comment rail
- `lib/board.mjs` — `GET /intro-video`, `POST /feedback-intro`, widen the edit/delete guard
- `lib/board.test.mjs` — cases for the above
- `steps/025-author-intro-film-llm/README.md` — one line: the intro is reviewed in motion on the board

**Out of scope — do not touch:**

- `board-ui/src/tabs/FinalCutTab.tsx` — you are porting *from* it, never editing it. If you find a bug there, report it; do not fix it here.
- `lib/intro-film/approve.mjs` and the 027 gate semantics — express still waives 027 via `gateWaived`, unchanged.
- `lib/intro-film/review-film.mjs` — the still frames it writes stay exactly as they are; this tab keeps showing them under the player.
- `feedback-status.mjs` and the fold — they read `feedback.json` generically; the new keys need no change there.

## Steps

### 1. `GET /intro-video` with Range support

In `lib/board.mjs`, beside the existing `/intro-frame` handler (~line 1049), add
a route serving `path.join(workdir, 'intro-film', 'out', 'intro.mp4')`.

Copy the Range branch from the `/video/` handler at line 1196 verbatim in
structure — partial content is what makes the scrubber work. Return **404 with a
JSON body `{"ok":false,"error":"not rendered"}`** when the file is absent; the tab
keys its empty state off that, so do not 500 and do not send an HTML body.

**Verify:** with the board running on a rendered video,
`curl -s -o /dev/null -w "%{http_code}" "http://localhost:<port>/intro-video?video=<slug>"`
→ `200`, and
`curl -s -H "Range: bytes=0-99" -o /dev/null -w "%{http_code}" ...` → `206`.

### 2. `POST /feedback-intro`

Mirror the `/feedback-final` handler (line 1265) and `appendFinalFeedback`
(line 78), but with **no label** — the intro has exactly one deliverable, so
there is no version axis. Add an exported `appendIntroFeedback(feedback, item)`
next to `appendFinalFeedback` that allocates `intro:<n>`:

```js
// The intro has ONE deliverable (out/intro.mp4), so unlike final-cut there is no
// version axis and no label in the key. Same feedback.json, so the 130 fold sees
// intro notes and final-cut notes in one place with no extra plumbing.
export function appendIntroFeedback(feedback, item) {
  const updated = { ...feedback };
  if (!updated.items) updated.items = {};
  const prefix = 'intro:';
  let maxIdx = -1;
  for (const k of Object.keys(updated.items)) {
    if (k.startsWith(prefix)) {
      const idx = parseInt(k.slice(prefix.length), 10);
      if (Number.isFinite(idx) && idx > maxIdx) maxIdx = idx;
    }
  }
  const nextKey = `${prefix}${maxIdx + 1}`;
  updated.items[nextKey] = { ...item };
  return updated;
}
```

The item shape the tab posts — **use exactly these field names**, they mirror
final-cut so the fold reads both identically:

```
{ text: string, t: number, context: 'intro@' + MM:SS, x?: number, y?: number }
```

**Verify:** `node --test lib/board.test.mjs` with a new case asserting that
appending twice to an empty feedback yields keys `intro:0` then `intro:1`, and
that an existing `final-v1:3` key does not shift intro numbering.

### 3. Widen the edit/delete guard

Line 1242 currently rejects anything not starting with `final-`. Allow `intro:`
as well, and keep rejecting everything else:

```js
    if (!key.startsWith('final-') && !key.startsWith('intro:')) {
      res.statusCode = 400;
      return res.end('{"ok":false,"error":"final-* or intro:* keys only"}');
    }
```

**Verify:** a `lib/board.test.mjs` case posting a delete for key `cue:7` still
gets 400, and one for `intro:0` does not. **The intro case's assertion message
must be exactly `intro: keys must be editable`** — this plan's mutation recipe
reverts the widening and requires that string in the resulting failure. Dry-run
it before you finish:

```bash
cd pipelines/video/visuals-flow
sed -i '' "s/ && !key.startsWith('intro:')//" lib/board.mjs
node --test lib/board.test.mjs      # MUST fail printing: intro: keys must be editable
git checkout lib/board.mjs
node --test lib/board.test.mjs      # MUST pass again
```

### 4. The player in `IntroTab.tsx`

Put the player **above** the existing findings and beat list; keep both below it.

Port from `FinalCutTab.tsx`:

- `<video ref={videoRef} src={`/intro-video?video=${encodeURIComponent(video)}`} />`
- play/pause, a scrubber bound to `currentTime`, and a clock readout
- the keyboard contract, identical to Final Cut's so the owner has one muscle memory:
  - `Space` play/pause
  - `←` / `→` ±5s
  - `Shift+←` / `Shift+→` step one frame (**1/30s** — the film is rendered at 30fps)
  - typing any printable character focuses the comment box and starts a note at the current moment
  - clicking the frame sets a pin via `pinFromClick`
- render the same help line Final Cut shows, so the affordances are discoverable.

**Do not add a version selector.** There is one film.

**Verify:** `bash scripts/check.sh` → `board-ui smoke OK`, and load the tab: the
video plays and the clock advances.

### 5. Comments rail

Filter with `k.startsWith('intro:')`, sort by numeric index (not
`localeCompare` — `intro:10` must sort after `intro:9`, which string comparison
gets wrong; this is a real difference from Final Cut, whose labels made
`localeCompare` adequate). Each row shows the clock, the text, and a delete
control wired to the widened endpoint. Clicking a comment **seeks the player to
its `t`** — that is the whole point of a timestamped note.

**Verify:** post three comments at different times, reload the tab, confirm all
three persist in order and clicking one seeks.

### 6. Degraded states — enumerate all three

| Condition | Player area | Approve button |
|---|---|---|
| `run-config.intro !== 'film'` | existing "does not use the bespoke intro film" message, no player | not rendered (current behavior) |
| `intro: film` but `out/intro.mp4` missing (404 from `/intro-video`) | "Intro film not rendered yet — run `bash run.sh <slug> intro-render`" | **disabled**, `title="render the intro film first"` |
| film present | player | enabled as today |

The middle row is the new one and it is the likely state right after authoring.
An enabled Approve button over a film that does not exist is exactly the
"approved something I never watched" failure this tab is meant to prevent.

**Verify:** temporarily rename `out/intro.mp4`, reload: message shown, Approve
disabled with the title. Restore.

### 7. Screenshot (this plan is `ui: true`)

Commit a screenshot showing the player mid-playback with at least one pinned
comment visible in the rail. boss **rejects the branch without a committed
image**. Put it beside the other board screenshots if a convention exists; if
none, `docs/img/intro-tab-in-motion.png`.

## Test plan

| Test | Where | Follows |
|---|---|---|
| `appendIntroFeedback` allocates `intro:0`, `intro:1`; ignores `final-*` keys | `lib/board.test.mjs` | the existing `appendFinalFeedback` cases |
| `/intro-video` returns 206 for a Range request, 404 JSON when unrendered | `lib/board.test.mjs` | the existing `/video/` cases |
| edit/delete guard accepts `intro:0`, rejects `cue:7` | `lib/board.test.mjs` | the existing guard case |

Follow the existing style in `lib/board.test.mjs`. **Any test that opens the
server must close it in a `try/finally`** — an assertion that fires before
teardown otherwise leaves the runner alive forever and the failure invisible.

## Done criteria

1. `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, with `board-ui smoke OK` and `visuals-flow check OK` both printed.
2. `node --test lib/board.test.mjs` → all pass, including the three new cases.
3. On a video with a rendered film: the Intro tab plays it, `Space`/arrows/`Shift+arrows` behave as the help line claims, and a typed note lands in `videos/<slug>/feedback.json` under an `intro:<n>` key carrying a numeric `t`.
4. `node -e "const f=require('./videos/<slug>/feedback.json'); const k=Object.keys(f.items).filter(x=>x.startsWith('intro:')); console.log(k.length, typeof f.items[k[0]].t)"` → a count ≥ 1 and `number`.
5. With `out/intro.mp4` renamed away, the tab shows the not-rendered message and Approve is disabled.
6. A screenshot of the tab is committed.
7. `git diff --stat` touches no file outside the Scope list.

## STOP conditions

- **Deleting or hiding the per-beat stage lines and frames.** They are the criteria a beat is judged against; the player is added *above* them, not instead of them.
- Creating a second feedback store (a new json file, localStorage, anything). Intro notes go into the same `feedback.json` `items` map the fold already reads, or the fold silently misses them.
- Editing `FinalCutTab.tsx`.
- Changing 027 gate semantics or `gateWaived` behavior — express must still waive 027.
- A gate assertion fails and the tempting fix is to soften it: fix the code or the fixture, never the assertion.
- `render-film.mjs` does not exist → plan 188 has not landed. Stop.

## Maintenance notes

- **The key namespaces are now a contract.** `final-<label>:<n>` and `intro:<n>` share one `items` map. Anything that filters feedback by prefix must know about both — today that is `FinalCutTab`, the new `IntroTab`, and the edit/delete guard. A future third surface makes it worth extracting a shared helper.
- Sorting intro comments numerically rather than by string is deliberate; a reviewer should check it still holds past ten comments.
- **Plan 190 is the other half of this feature and must follow it.** This plan only *captures* intro feedback; 190 teaches the 130 fold to ingest it and pins down where an intro lesson may be written (`TASTE-INTRO.md` / the 025 authoring contract, never the body cue/zone rulebooks or `card-library/DESIGN.md`). Landing 189 alone leaves the owner able to write notes that nothing consumes. `context: 'intro@MM:SS'` is the discriminator 190 routes on — keep it stable.
- If the intro ever grows versions (a re-render worth keeping beside the old), the `intro:` key gains a label the way final-cut has one — that is a schema change, not a tweak.
