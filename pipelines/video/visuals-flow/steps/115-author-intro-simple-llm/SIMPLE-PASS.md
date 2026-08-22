# SIMPLE-PASS — authoring the simple intro cut list

You are authoring `videos/<slug>/intro-simple/cutlist.json`. Read this whole
file before writing anything.

## Your only output is `intro-simple/cutlist.json`

You do not write HTML. You do not design a card. You do not propose
directions, and you do not invent a visual idea. You pick a card slug per
beat from the locked kit of 7 and fill that card's variables. If the kit
cannot express a beat, use `statement` — it always works.

`cutlist.json` is a flat list of beats (`avatar`, `card`, or `overlay`) that
tile the measured intro span exactly, in order, with no gaps and no overlaps.
See the schema in `plans/220-vf-intro-simple-flow.md` ("The cut list") for the
full shape, or read `../../lib/intro-kit/cutlist-schema.mjs` / a fixture under
`../../lib/intro-kit/fixtures/good.json`.

## Pick from the body card catalogue — the same one the cue pass uses

There is no intro card set. `pipelines/video/card-library/catalog.json` is the
ONE catalogue for the intro and the body (owner decision 2026-08-23), and every
card in it is available to you. A slug is always `"<type>/<card>"` —
`slate/kinetic-sentence`, never `kinetic-sentence`.

Read `catalog.json` and pick per beat. Each entry tells you everything you
need:

| Field | What it means for you |
|---|---|
| `purpose` | one line on what the card is for — this is your selection signal |
| `placement` | `overlay` cards may ONLY be used with `kind: "overlay"`; `fullframe` cards ONLY with `kind: "card"` |
| `variables` | `vars` must contain every entry with `"required": true`, and nothing outside the whole list |
| `beat_shape` | present on beat cards: the shape of each element of `vars.beats[]` |
| `max_beats` | the cap on `vars.beats[]` length |
| `default_duration` | the length the card's motion was designed for — see the truncation note below |

`vars.beats[]` elements may additionally carry `at` (seconds, rebased to the
beat's own start), which is the cut list's own field and is not in any
`beat_shape`.

**Never set `duration`.** The renderer computes it from `t_end - t_start` and
injects it; lint code `S4 renderer-owned-var` refuses a cut list that sets one.

If nothing in the catalogue expresses a beat, use `slate/kinetic-sentence` —
one spoken sentence, word by word, on the ambient canvas. It always works, and
it is the direct replacement for the old kit's `statement`.

### The four cards that came from the old intro kit

These were the intro kit's own devices and are now ordinary body cards, so the
body may use them too:

| Slug | Purpose |
|---|---|
| `tool-icon/logo-grid` | "too many tools" — real logos, then the line lands and they dim |
| `enacted/shot-float` | generated stills or screenshots as evidence while the line runs |
| `enacted/ui-mock` | a stylised app window around a screenshot, in an ok or a fail state |
| `process/chain` | N labelled inputs converging on one named output |

They are the only cards that scale their motion to the beat length.

### Truncation: expect it, report it, do not work around it

Body cards hard-code their motion schedule in absolute seconds against a
`default_duration` of 4–15s, while an intro beat runs 1.5–4.0s. A body card in
an intro therefore plays its entry animation and is cut off part-way through
its idle motion. The owner accepted this on 2026-08-23 rather than retrofitting
every body card up front.

`intro-simple-lint` prints a `NOTICE truncation:` line per beat that runs under
60% of its card's `default_duration`. Notices are NOT errors and never fail the
lint. **Do not lengthen a beat past its transcript line to silence one** — the
cut length comes from the words being spoken, and `S3` caps it at 4.0s anyway.
Leave the notices; they are the owner's list of what to look at in the render.

## The pacing targets — author to these, do not discover them by failing the lint

- avatar share of the whole span: **<= 55%** (`overlay` beats count as avatar
  time too — the presenter is still on screen underneath the card)
- no single avatar-alone beat longer than **5s**
- every beat's length: **1.5s to 4.0s**

These come from measuring the owner's four reference intros (plan 220): a cut
roughly every 2 seconds, and the presenter alone for about half the intro at
most ("more footage to avatar time").

## Every word you put on screen comes from `transcript.json`

Use `introWords(workdir)` from `../../lib/intro-kit/inputs.mjs`. **Never type
a product name, or any word, from memory.** The standalone intro POC put four
of five product names wrong on screen ("Hejian", "Arcad", "Open Art", "Higgs
Field") — this is exactly what lint code **S7** exists to catch: every word in
a card's `vars.beats[]` list must appear, in order, in the transcript within
that beat's own time window.

A card's `beats[]` word times are transcript times **rebased to the beat's own
start** — `at: 0.0` means the word lands at the instant the beat begins, not
at the video's absolute zero.

## There is no continuity requirement

Unlike the complex flow, a card does not carry an object from an earlier
card. Each beat is independent and disposable. Reusing the same card three
times in a row is CORRECT, not lazy — the reference video `kO3WtZmDb_A` does
exactly that. Do not invent a through-object just to make beats feel
connected; the kit's whole point is that no session has to exercise taste
about a "story" here.

## Then check your work

```bash
bash run.sh <slug> intro-simple-lint      # cheap: prints the S1-S7 report, renders nothing
bash run.sh <slug> intro-simple-render    # renders intro-film/out/intro.mp4 (refuses if the lint fails)
```

Read the lint output. `S1`-`S7` are all hard gates — there is no warning tier
in this lint. A cut list that trips one of them is the defect the flow exists
to prevent; fix the cut list, never the lint.
