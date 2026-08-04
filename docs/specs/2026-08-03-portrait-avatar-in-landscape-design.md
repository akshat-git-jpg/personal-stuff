# Putting a portrait avatar clip into a landscape video

Date: 2026-08-03
Pipeline: `pipelines/video/visuals-flow/`
Status: look approved by owner, not yet implemented in code

## Why this came up

HeyGen renders this character best in portrait. It can produce landscape, but the
framing is worse: the camera sits further back and the angle is flatter. The owner
would rather keep the good portrait render and solve the aspect problem in the
pipeline than accept a weaker performance to get a 16:9 file.

So the question was never "can we rescue an unusable clip". It was "how do we get
the better framing into a 1920x1080 timeline".

Test source for everything below: `~/Downloads/Video (2).mp4`, 1080x1920, 25 fps,
60 seconds.

## The constraint everything else follows from

A 9:16 source cannot fill a 16:9 frame and keep the subject. That is arithmetic,
not a setting you can tune.

Displaying the clip at full canvas height with no crop makes it 608px wide, so
1312px of the canvas has nothing in it. Widening the clip to cover more canvas
means cropping the top and bottom, and the cost climbs fast:

| Clip width on canvas | Vertical crop | What survives |
|---|---|---|
| 608px | 0% | all of her |
| 720px | 16% | down to the waist |
| 900px | 32% | down to the chest |
| 1080px | 44% | shoulders only |
| 1250px | 51% | face only |

I built a fill crop to check whether the arithmetic was lying, and it isn't. At
1080x608 out of 1080x1920, tuned to hold the face, the frame still cuts across her
eyebrows. There is no vertical offset that produces a usable head. Route closed.

That leaves one real question: what occupies the canvas she doesn't.

## What we settled on

A rounded card, inset from the right edge, on a warm brand gradient. The space to
her left is free for a headline, a card from the library, or whatever that shot
needs to show.

Approved reference render: `card-720.mp4`.

### The recipe

Canvas 1920x1080 at 30 fps.

Background: radial gradient, `#3a1f08` at the centre falling to `#0a0805`, centred
at (560, 430) so the warm part sits behind the text rather than behind her.

Card: 720 wide by 1000 tall, corner radius 36, positioned at x=1140, y=40. That
leaves a 60px right margin and 40px top and bottom.

The clip inside the card: scale the source to 720x1280, then crop 720x1000 at
y=157. That keeps 78% of the source height.

Shadow: a rounded rectangle 800x1080, radius 60, blurred with `boxblur=26:2`,
black, alpha-merged and placed at x=1100, y=0. It lifts the card off the
background instead of letting it sit flat.

### The headroom rule

Crop offset is not a magic number. It comes from holding her head in the same place
regardless of card width, so any width looks intentional rather than arbitrary:

```
cropY = 370 * (cardWidth / 1080) - 90
```

370 is the source row where the top of her hair sits. 90 is the headroom we want
below the card's top edge. This is what makes the six widths in `sheet8.png`
comparable: only the crop changes, nothing else.

Widths and what each keeps, for a 1000px-tall card:

| Card width | Keeps | cropY |
|---|---|---|
| 720 | 78% | 157 |
| 760 | 74% | 170 |
| 800 | 70% | 184 |
| 840 | 67% | 198 |
| 870 | 65% | 208 |
| 900 | 62% | 218 |

Owner picked 720. 900 was rejected as too tight.

Card height caps how loose this can get. Dropping the 40px top and bottom inset and
running 720 at the full 1080 height reaches 84%, at the cost of the floating look.
Not built, but it's the next step down if 720 ever feels tight.

## What we tried and threw away

Worth recording so nobody spends another evening on these.

**Fill crop.** Cuts the face. Covered above.

**Blurred copy of the same clip as the backdrop.** This was my recommendation for
about an hour and it was wrong. The theory is sound: the backdrop is the same
footage, so the colour and lighting can never mismatch. In practice the out of
focus version of her dark hair reads as a grey smudge floating in the empty space,
and because the source is off centre it lands on one side only, which looks like a
mistake rather than a choice. Darkening it hard and adding a vignette rescues it
(see `sheet6a.png`, C2), but a flat brand gradient beats it and costs less.

**Mirrored sides.** Flip copies of the clip outward to fill the gaps, then blur.
This is a common trick and it fails badly here: you get two blurry human shapes
standing either side of her. Genuinely distracting. `sheet6a.png`, C3.

**Glow behind her head.** Screen blending an orange radial over near black came out
purple. My blend maths, not a real limitation, but C8's spotlight already achieves
the look properly so I stopped.

**Centred instead of right anchored.** Works fine and looks good (C2, C4, C5, C8).
The reason we went right anchored anyway is layout, not looks: centring leaves two
600px strips that can hold a word or a number, while right anchoring gives one
solid 1140px block that can hold a real comparison table.

## Something to fix before any of this reaches the pipeline

`planPanelGeometry` and `planSideGeometry` both accept a `srcAspect` argument, and
nobody passes it. Every caller gets the 16/9 default:

- `lib/assemble.mjs:696` and `:704`
- `lib/export-timeline.mjs:250` and `:259`

Feed a portrait file through side or panel mode today and it scales 1080x1920 to
1920x1080 first, a 3.16x horizontal stretch, then crops. The face comes out
grotesquely wide. Any portrait work has to thread the real aspect through both
renderers first. Same second-renderer drift shape as the four export bugs found on
2026-08-02.

## A finding that outlasts this specific clip

Side mode already wants a portrait source, and we have been feeding it the wrong
one.

The side column is 720x1080, aspect 0.667. A portrait source at 0.5625 cover-crops
into it losing 16% vertically and nothing horizontally. A landscape source loses
**62.5% of its width**.

That reframes the original complaint. When the owner said the landscape HeyGen
render looked "further from camera", part of that was HeyGen's framing, but part of
it was our own geometry cropping a wide shot down to a narrow column so the head
came out small. Portrait renders are the better input for side mode, not a
compromise.

## ffmpeg notes for whoever implements this

Three things cost me time.

`geq` is slow enough per frame to be unusable on video. Bake every rounded-corner
and feather mask to a PNG once, then use `alphamerge` at render time. A 12 second
clip renders in about 17 seconds that way.

A `color=` source with no duration produces an infinite stream, so the render never
ends even with `-t` on the real input. Give it `:d=<seconds>` and add `-shortest`.

`drawtext` treats `%` as a strftime escape and silently drops the whole text
argument. Write "pct" or escape it.

Also worth knowing: shell variables interpolated into a `-filter_complex` string
were being stripped in this environment, which produced empty filter names and
confusing errors. Writing the ffmpeg calls into a `.sh` file and running that
worked reliably.

## Open questions

Whether this becomes a real mode in `assemble.mjs`, applied automatically when a
source is portrait, or stays a manual treatment in Resolve. Nobody has decided.

Generative outpainting is the only untested route that would genuinely let her fill
the frame at her original framing. Runway or Adobe generative expand would invent
the room to her left and right. I would expect frame to frame flicker across 60
seconds, but it has not been tried.

## Artifacts

All renders live in `~/kb-scratch/video/visuals-flow-2/_avatar-portrait-fullframe-tests/`.
They are scratch, not tracked, and will not survive a cleanup.

| File | What it shows |
|---|---|
| `card-720.mp4` | the approved look |
| `card-760.mp4`, `card-800.mp4` | tighter alternatives |
| `sheet4.png` | width against composition, the sheet that corrected my bad pick |
| `sheet5.png` | right anchored layouts, blur against flat background |
| `sheet6a/b/c.png` | ten centred treatments |
| `sheet7.png` | six rounded card shapes |
| `sheet8.png` | the six zoom steps, headroom held constant |

Build scripts sit beside them in the job scratch dir and are disposable. The recipe
above is the thing worth keeping.
