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

## The 7 cards, and what each is for

| Slug | Purpose | Overlay |
|---|---|---|
| `statement` | the spoken line, alone, word by word — the workhorse | no |
| `checklist` | two to four verdict rows under one icon, safe to repeat back-to-back | no |
| `logo-grid` | "too many tools" — real logos, then the line lands and they dim | no |
| `shot-float` | generated stills/screenshots as evidence while the line runs | no |
| `ui-mock` | a stylised app window, used once ok / once fail | no |
| `chain` | N labelled inputs converging into one named thing | no |
| `lower-third` | the ONLY card that sits over live footage (presenter name/role) | **yes** |

(Copied from `../../../intro-kit/KIT.md` — read that file for each card's full
description; do not restate its internals here.)

`lower-third` is the only card whose `kit.json` entry has `"overlay": true`.
An overlay card may ONLY be used with `kind: "overlay"` in a beat, never
`kind: "card"`, and vice versa for every other card.

## Read `../../../intro-kit/kit.json` for each card's required variables

It is the schema. `vars` on a beat must contain every key in that card's
`required` list, and no key outside `required` + `optional` — a missing
required var renders an empty card, and the pacing lint (S4) refuses it.

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
