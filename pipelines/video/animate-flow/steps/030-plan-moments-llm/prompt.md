# Plan the moments

You are planning custom motion graphics for one YouTube video. Everything you need is in
this folder; do not look outside it.

The video is {{TOTAL}} seconds of voiceover over {{BED}}, on a {{CANVAS}} canvas.
For a few spans of narration we lay a graphic over that bed, or replace it for a moment,
with a graphic designed from scratch for exactly what is being said. Your job is to choose those spans. You do not design or write
any HTML.

## Read first

1. `TASTE-ANIMATE.md`: the owner's rules for this recipe. Every rule binds you.
2. `DESIGN.md`: the visual language the graphics will be drawn in. Read it so you only
   pick ideas that language can draw well.
3. `transcript.tsv`: every spoken word with its index `i`, start and end time.

## What makes a good moment

- The words carry an idea a picture explains faster than the bed does: a list being
  counted out, a number, a before/after, a problem and its fix, a process, a comparison,
  a strong claim.
- The viewer does not need the bed right then. While the speaker narrates clicks in an
  interface, the screen recording is the content; leave it alone.
- It is one idea, said in one breath. 4-12 seconds is typical; 3 is the minimum and 20
  the maximum.

## Takeover or overlay

The recording is the stage: the one constant the viewer's eye holds. Each moment is one
of two kinds:

- `"overlay"`: the graphic sits on top of the recording, which keeps playing. Use it when
  the viewer still needs to see the screen (the speaker is pointing at something in it)
  and the idea fits in part of the frame, away from where the screen moves.
- `"takeover"` (the default): the graphic replaces the recording for the whole frame, then
  hands back. Use it only when the recording has nothing to show right then and the idea
  needs the whole frame.

## Plan for the frame checklist

The graphics will be held to these, so pick moments that can meet them:

- **Act the idea out, do not label it.** Write each `idea` as something that happens on
  screen (a thing breaks, two things differ, a count lands), not a title with icons.
- **One colour means one thing** across the whole video: say in each idea what the accent
  marks, and keep it the same thing every time.
- **Vary scale across the moments**: wides, mids and at least one close-up. Not every
  moment a row of icons under a heading.
- **Something new every 2-4 seconds**: a 15-second moment needs a reveal every few
  seconds of narration, so plan the beats inside it.
- **The payoff lands in the pause**: end a moment, or place its reveal, in the gap before
  the line that names the result.
- **Banned:** a centred title on a gradient, everything fading in, glows, particle bursts,
  corner labels, a logo sting as an ending.

Pick about {{TARGET}} moments. Fewer, stronger moments beat many weak ones. Moments never
overlap. Leave at least 2 seconds between two moments, or make them touch.

## Write `moments.json`

```json
{
  "moments": [
    {
      "id": "m01",
      "from": { "i": 12, "text": "OpenArt" },
      "to": { "i": 31, "text": "together." },
      "hold": 0.5,
      "kind": "takeover",
      "idea": "One line: what the viewer sees and how it moves.",
      "why": "One line: why this span earns a graphic."
    }
  ]
}
```

- `from` is the first spoken word of the moment, `to` the last. `i` is the index from
  `transcript.tsv` and `text` is that word copied exactly.
- `hold` (optional, 0-1.5s, default 0.5) keeps the graphic up after the last word.
- Ids are `m01`, `m02`, ... in time order.
- `idea` is concrete: name the objects on screen and what they do, using the real names
  and numbers from the narration.

## Check your work

Run this and fix every error until it prints `moments OK`:

```
node moments.mjs check moments.json transcript.json {{TOTAL}}
```

Finish with one short paragraph: the moments you chose and what you deliberately left out.
Then name the weakest moment you kept and why it still earns its place.
