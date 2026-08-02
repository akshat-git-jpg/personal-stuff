---
executor: claude-p
model:
test_cmd: cd pipelines/video/visuals-flow-2 && node --test lib/board.test.mjs && bash scripts/check.sh
ui: true
deploy:
needs: ["depends on 175 (PR #133) for the server-side overflow verdict — the storyboard's overflow badge currently reads the LIVE iframe via useOverflowBadge, and this plan removes that iframe. Land 175 first, or implement Step 3's fallback. Also touches lib/board.mjs, which no other open plan edits."]
---

# Plan 183: vf2 board — static storyboard tiles and backend liveness

## Summary

- **Problem statement**: The storyboard mounts one live `<iframe>` per unreviewed cue. On an 84-cue video that is dozens of full 1920x1080 card documents in one renderer, each running GSAP plus a permanent `hf-ambient` CSS animation over blurred, `will-change` layers. Nothing ever unmounts them. The tab pegs a CPU core and oscillates by ~1.8 GB, which on 2026-08-02 swap-thrashed the owner's laptop for nine hours.
- **Goals**: Tiles become static posters with at most one live card on demand; cards gain a static mode; the board tells you when its backend is gone; the port fallback stops being silent.
- **Executor proposed**: claude-p, sonnet — four contained changes across `board.mjs`, `CueTile.tsx` and the card template.
- **Done criteria** (terse): scrolling the whole storyboard mounts zero card iframes and the renderer stays flat.
- **Stop conditions** (terse): removing the iframe breaks the overflow badge with no server-side verdict available.
- **Test / verification for success**: measure renderer RSS across a full storyboard scroll, before and after.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow-2/lib/board.mjs pipelines/video/visuals-flow-2/board-ui/src`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 175 (PR #133) for the server-side overflow verdict
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

On 2026-08-02 the owner's laptop became unusable. The cause was a single Arc renderer holding a `visuals-flow` storyboard tab, open about nine hours, on a `best-ai-video-generator` board whose backend had since died.

Measured on the live process before it was killed:

```
RSS samples, 20s apart:  1349.9 → 2009.8 → 2135.9 → 291.5 → 391.6 → 274.2 MB
process state: R (pegged)          memory_pressure pageouts: 886,513
```

Two things that first looked true were not, and it is worth recording both so nobody re-diagnoses this the same way:

- **It is not an unbounded leak.** The tab oscillates between roughly 270 MB and 2.1 GB and settles low. The swap thrash, not a monotonic climb, is what stalled the machine.
- **It is not a retry loop against the dead backend.** There is no `setInterval`, no `setTimeout` retry, no `EventSource` and no WebSocket anywhere in `board-ui/src`. The only data fetch is one `useEffect` in `App.tsx` with a `[video]` dep and a terminal `.catch`. It fires once and gives up. The dead backend made the tab useless; it did not make it expensive.

The actual cost is `board-ui/src/components/CueTile.tsx:129`:

```jsx
{!reviewed && (
  <iframe ref={iframeRef} loading="lazy" src={`/card/${cue.id}`} />
)}
```

One live iframe per unreviewed cue. 84 cues on this video. Each iframe is a complete Hyperframes document: its own GSAP runtime, webfonts, a 1920x1080 canvas, and for 23 of the ~150 cards a permanent `animation: hf-ambient-breathe 6s ease-in-out alternate infinite` plus sheen loops, over elements carrying `backdrop-filter: blur(20px)` and `will-change: transform`.

`loading="lazy"` defers the first load and nothing ever unloads. The only unmount path is marking a tile reviewed. So the cost is paid once per scroll and then held for the life of the tab.

The nine-hour survival is a separate, smaller failure. `listenOnFreePort` walks 4322 → 4323 on `EADDRINUSE`, printing only to stderr, and the page never checks who it is talking to. So an old tab on 4322 and a new server on 4323 coexisted, and the page had no way to say so.

## Current state

- `board-ui/src/components/CueTile.tsx` — line 129 mounts the iframe; line 38 `useTileSync(audioRef, iframeRef)` scrubs the card from the audio element; line 39 `useOverflowBadge(iframeRef, seg.probeTimes)` measures overflow **inside the live iframe**.
- `board-ui/src/lib/overflow.ts` — `useOverflowBadge` drives that measurement. **This is the coupling that makes the fix non-trivial.**
- `board-ui/src/App.tsx` lines 45-56 — the single fetch, `.catch(err => console.error(err))`.
- `lib/board.mjs` — `listenOnFreePort` (line ~1295), `const port = Number(process.env.BOARD_PORT) || 4322` (line ~1327). `/slice/<id>.mp3` cuts on demand via `ensureSlice`; a poster endpoint should follow that pattern.
- `videos/<slug>/renders/` — every cue already has a rendered clip. A poster is one ffmpeg frame extraction away; nothing needs re-rendering.
- `card-library/DESIGN.md` line 232 — every card's ambient block carries the comment `/* hf-ambient */` exactly once, and this is already described as machine-checkable.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Board tests | `node --test lib/board.test.mjs` | exit 0 |
| Repo gate | `bash scripts/check.sh` | `visuals-flow check OK` |
| Start a board | `node lib/board.mjs best-ai-video-generator` | prints its port |
| Watch a renderer | `ps -o rss= -p <pid>` in a loop | see Step 6 |

## Scope

**In scope**:
- A `/poster/<cueId>.jpg` endpoint, cut on demand from the existing render.
- `CueTile` showing a poster by default and mounting the live card only on click.
- A `?static=1` card mode that disables ambient motion.
- A visible disconnected banner when the backend stops answering.
- A loud port collision and a server-identity assertion.

**Out of scope**:
- Virtualising live iframes with an IntersectionObserver. Owner decision 2026-08-02: with at most one live card there is nothing left to virtualise.
- The Final Cut and Calibrate tabs. Calibrate mounts one card by design and is not the problem.
- Changing any card's visual design. Static mode suppresses motion; it must not alter layout or colour.

## Git workflow

- Branch: `advisor/183-vf2-board-static-tiles-and-liveness`
- Commit: `fix(vf2): storyboard tiles render posters, not live card iframes` — no AI footers. Do NOT push.

## Steps

### Step 1: Poster endpoint

Add `/poster/<cueId>.jpg` to `lib/board.mjs`, following `ensureSlice`'s on-demand pattern: on first request extract one frame from that cue's clip in `renders/` with ffmpeg, cache it under `videos/<slug>/.posters/`, serve from cache after.

Pick the frame at the cue's last beat time plus 0.35s, falling back to `duration * 0.6` when the cue has no beats. That is the moment the card is fully revealed; frame 0 is usually mid-entrance and looks broken.

Add `.posters/` to the workdir gitignore.

**Verify**: `curl -sI localhost:<port>/poster/c27.jpg` returns 200 `image/jpeg`, and a second request is served from cache.

### Step 2: Tiles render posters, one live card on demand

In `CueTile.tsx`, replace the unconditional iframe with:

- an `<img src={`/poster/${cue.id}.jpg`} loading="lazy">` by default;
- a click on the poster swaps in the live `<iframe>` for THAT tile only;
- opening a second tile's live card unmounts the first. One live card at a time, enforced by lifting the "which tile is live" id into `StoryboardTab` state rather than per-tile local state.

`useTileSync(audioRef, iframeRef)` scrubs the card from the audio element and only makes sense while a card is live. Keep it wired, but it must no-op when `iframeRef.current` is null.

**Verify**: scroll the entire storyboard and confirm `document.querySelectorAll('iframe').length === 0`; click one tile and it becomes 1; click a second and it stays 1.

### Step 3: The overflow badge, which is the tricky part

`useOverflowBadge(iframeRef, seg.probeTimes)` measures overflow inside the live iframe. Removing the iframe removes the badge.

**Preferred**: plan 175 (PR #133) adds a server-side per-cue frame gate that computes exactly this verdict headlessly and stores it. Read that verdict from the board data and render the badge from it. The measurement gets better, not worse: 175 probes at real beat times rather than whenever the tile happened to be on screen.

**If 175 has not landed**, do NOT keep a hidden iframe alive to preserve the badge; that reinstates the bug. Instead compute the badge only for the one tile whose live card is open, and show the badge as "not measured" elsewhere. Say plainly in the PR body which of the two you shipped.

**Verify**: a cue known to overflow still shows its badge, and no hidden iframes exist (`document.querySelectorAll('iframe').length` is 0 with no card open).

### Step 4: Card static mode

Cards must be able to render with ambient motion off, for this board, for `card-qa` contact sheets, and for plan 175's headless gate, which should not measure a frame mid-breath.

Add to the shared card template: when `location.search` contains `static=1`, or `prefers-reduced-motion: reduce` matches, set a `static` class on `<body>`, and add one rule:

```css
body.static *, body.static *::before, body.static *::after { animation: none !important; }
```

Do not touch GSAP timelines; they are already paused and seeked, not free-running.

DESIGN.md already mandates the `/* hf-ambient */` marker exactly once per card and calls it machine-checkable, so use that marker to find every ambient block and confirm each one is covered.

**Verify**: load any card with `?static=1` and confirm `getComputedStyle($('#frame')).animationName === 'none'`; load without it and confirm the ambient animation is back. `bash scripts/check-cards.sh` still passes.

### Step 5: Disconnected banner and a loud port

Two small changes that would have turned nine hours into five minutes.

In `App.tsx`, replace the terminal `.catch(err => console.error(err))` with state that renders a visible banner: "backend not responding on this port — this tab is stale". Add a lightweight liveness check on `visibilitychange` only, so returning to a stale tab surfaces it. **Do not add an interval**; the absence of a polling loop in this codebase is a feature and this plan must not introduce one.

In `lib/board.mjs`:
- have `/status` (or the board-data payload) report the slug and `process.pid`, and have the page warn when the slug it asked for is not the slug the server is serving;
- when `listenOnFreePort` falls forward off the requested port, print a prominent warning naming both ports and telling the operator to close old tabs. Keep the fallback; make it loud.

**Verify**: start a board, start a second one on the same slug, confirm the second prints the fallback warning naming both ports. Kill the first server and confirm its tab shows the banner on refocus.

### Step 6: Prove it, with numbers

This plan exists because of a measurement, so it closes with one.

```bash
# before and after, same steps: open the board, scroll the full storyboard, wait 60s
for i in $(seq 1 12); do ps -o rss= -p <renderer_pid> | tr -d ' '; sleep 10; done
```

Record peak and steady-state RSS in the PR body for both. The bar: after the change, a full scroll mounts zero iframes and peak RSS is a small fraction of the ~2.1 GB peak measured on 2026-08-02.

Attach a screenshot of the storyboard with posters (`ui: true` requires it anyway).

**Verify**: both series in the PR body, plus the screenshot.

## Test plan

`lib/board.test.mjs` gains: `/poster/<id>.jpg` returns an image and caches; an unknown cue id 404s; `/status` reports slug and pid; `listenOnFreePort` warns when it falls forward.

The renderer measurement in Step 6 is the real acceptance test, and it is manual by nature. State the numbers rather than asserting improvement.

## Done criteria

- [ ] Scrolling the full storyboard mounts zero card iframes
- [ ] At most one live card at a time, enforced in `StoryboardTab` state
- [ ] `/poster/<id>.jpg` cuts on demand and caches under a gitignored `.posters/`
- [ ] The overflow badge still works, via 175's verdict or the documented fallback, with NO hidden iframe
- [ ] `?static=1` disables ambient motion on every card carrying `/* hf-ambient */`
- [ ] A dead backend produces a visible banner, and no polling interval was added
- [ ] A port fallback prints a warning naming both ports
- [ ] Step 6's before/after RSS series and a screenshot are in the PR body

## STOP conditions

- The overflow badge cannot be sourced without a live iframe and 175 has not landed. Ship the per-tile fallback in Step 3 and say so; do not keep a hidden iframe.
- Static mode changes a card's layout or colour rather than only its motion. That means the selector is too broad; report it.
- The fix appears to need a polling interval. It does not, and adding one would recreate the loop this codebase has correctly avoided.
- Step 6 shows no meaningful improvement. Then the iframes were not the cause and the RCA needs reopening; report the numbers rather than shipping.

## Maintenance notes

- The 2026-08-02 incident is the reference case. Two plausible-sounding diagnoses were wrong (unbounded leak, retry loop) and both would have sent a fix at the wrong layer. The evidence that settled it was RSS sampling plus a grep proving no timer exists.
- Posters come from clips the pipeline has already rendered, so this costs one ffmpeg frame extraction per cue and nothing else.
- Static mode is deliberately shared with `card-qa` and plan 175. If a future consumer needs a still card, it should use `?static=1` rather than inventing another route.
