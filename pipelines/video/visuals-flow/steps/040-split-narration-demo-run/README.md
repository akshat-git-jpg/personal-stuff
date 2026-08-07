# 040 · split narration from demo · [RUN]

- **In:** `videos/<slug>/transcript.json` (from 010) and `videos/<slug>/src/intro.mp4`,
  `body.mp4`, `conclusion.mp4` (the owner's three source recordings)
- **Out:** `videos/<slug>/segments.json`, committed
- **Run:** `bash run.sh <slug> segments` (wraps `node lib/segments.mjs <slug> --propose`)
- **Then, by hand:** open the file and set `confirmed: true`. See "What confirming
  buys you" below.
- **Next:** 020 reads `segments.json`; 035 refuses to run without its `structure` block

## What it writes

One file, two independent blocks that come from two different places.

`structure` is measured, not guessed. `lib/source-structure.mjs` ffprobes each
`src/*.mp4` and lays them end to end in timeline order, so the intro/body/conclusion
spans are exactly as long as what you recorded:

```json
"structure": [
  { "part": "intro",      "start": 0,     "end": 42.6 },
  { "part": "body",       "start": 42.6,  "end": 268.1 },
  { "part": "conclusion", "start": 268.1, "end": 300.0 }
]
```

`segments` is a keyword heuristic over the transcript. It scans a rolling 30s
window for demo phrases ("click on", "as you can see", "over here"), calls a
window `demo` at two or more hits, and merges any run shorter than 20s into its
neighbour. Constants live at the top of `lib/segments.mjs`.

```json
"segments": [
  { "kind": "narration", "start": 0,   "end": 95 },
  { "kind": "demo",      "start": 95,  "end": 210 }
]
```

The heuristic is the weak half of this file. Read it before confirming, because
the confirm is what promotes its opinion into a hard gate.

## What confirming buys you

`confirmed` is read in exactly one place: the E5 demo-coverage check in
`lib/lint-cues.mjs`. A fullframe card sitting on top of a demo segment hides the
screen the viewer is meant to be watching.

| `confirmed` | E5 fires as |
|---|---|
| `false` (as written) | warning |
| `true` | error, and the lint gate fails |

So the file is useful unconfirmed and load-bearing once confirmed. Confirm it when
you have actually looked at the demo/narration split, not reflexively.

## Warnings you should expect, and act on

`sourceStructure` compares the source spans against the length of the cut (the last
word in the transcript). Two warnings print to stderr and do not stop the run:

- **"the conclusion is entirely OUTSIDE this 300.0s cut"**. You recorded it, and
  nothing in the finished video will contain it. This is not cosmetic. It is how
  test-03 shipped without its conclusion: the cut stopped at the length of the
  screen recording and nobody was told.
- **"the body is truncated by this cut"**. Same class of problem, partial.

Either one means the source recordings and the cut disagree about how long the
video is. Fix the inputs and re-run. Carrying on gives 035 zone spans that point
at footage the viewer never sees.

## Errors that stop the run

- `src/intro.mp4` or `src/conclusion.mp4` missing, exit 1. Every video is recorded
  as three files and that convention is the structure. `body.mp4` is optional.
- A source file ffprobe cannot read, exit 1.
- No `src/` directory at all: a warning, not an error. `structure` comes out empty,
  which is legal for old workdirs that predate the convention. 035 will then have
  nothing to author against, so a new video should never take this path.

## Reading it back

`node lib/segments.mjs <slug>` with no flag prints the segment table and touches
nothing. Re-running `--propose` overwrites the whole file, `confirmed: true`
included, so re-propose before you confirm rather than after.
