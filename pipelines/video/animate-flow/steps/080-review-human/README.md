# 080 · review the cut · [OWNER]

```
node lib/run.mjs <slug> review     # http://127.0.0.1:4330/
```

One page: a player for each registered version, the moments marked under it, and a comment
box that stamps the current time. Comments go to `videos/<slug>/feedback.json`.

## Item schema

Same as the other recipes' final-cut review, so one fold procedure reads them all:

```json
"final-v1:0": {
  "text": "the price lands before she says it",
  "t": 41.3,
  "context": "final@00:41.3",
  "added": "2026-10-08",
  "moment": "m03",
  "applied": "2026-10-09 — m03 re-authored, price waits for the word",
  "folded": "2026-10-09 — TASTE-ANIMATE A4"
}
```

- `moment` is filled in when the time falls inside a moment.
- `applied` (the fix to this video) and `folded` (the lesson made a rule) are set at 090.
- Folded items cannot be deleted from the page.

## Why a small page and not the visuals-flow board

The board's Final Cut tab is a view inside an app that loads cues, shots, intro state and
the card plan for whatever workdir it serves; pointing it at an animate workdir would fire
those template code paths. This page has one view and one write (a comment), so it is a
static HTML file served by `lib/review-server.mjs` with node built-ins. If it ever needs a
second view, it becomes a Vite+React app like the board.
