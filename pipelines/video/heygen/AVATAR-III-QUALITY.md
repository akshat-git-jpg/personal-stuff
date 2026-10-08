# Avatar III quality: why one take looks real and another looks fake

Found 2026-10-09 on the EverBee coupon video. Checked on two photo avatars (helen office clean,
Maria look `3eb3fa79…`) and by an independent reviewer who was not told the hypothesis.
Everything here was rendered on free Avatar III (0 credits).

## The finding

An Avatar III render of a photo avatar is a fixed head-and-body motion clip, with the mouth
lip-synced on top. Only the mouth follows the audio. The head, eyes, brows and hair follow a clock
that starts at second 0 of the render. For helen office clean, the motion repeats about every
37.7 s. This matches what `pipelines/video/CLAUDE.md` already says about Avatar III's design
(a looped base video plus lip-sync).

So a sentence looks different depending on where it lands in the render. The coupon intro rendered
on its own (render second 0) looked calm and real. The same words inside one long render (render
second 17.8) landed on a tenser stretch of the clip: eyes half closed, brows pulled. The owner saw
the second one as "AI", with "too much expression" and "lips not syncing".

## Evidence

Mean grayscale difference of the upper face (hair, forehead, eyes; the mouth is left out), compared
frame by frame over 18 s. Lower numbers mean the same motion.

| Comparison | Helen | Maria |
|---|---|---|
| Same audio rendered twice | 0.23 | 0.45 |
| Same render start, **different words** | 0.60 | 0.74 |
| **Same words**, different render start | 9.69 | 24.36 |
| Unrelated windows (baseline) | 9.2 to 9.4 | 23.9 |

- Different words at the same render second give almost the same head and eyes. The same words at
  a different render second look as different as two unrelated clips.
- Render length does not matter. A 60 s render that starts on the intro words matches the 18.8 s
  test (0.49).
- There is no drift over time. Across 270 s, the distance from the source photo stays flat
  (7.2 to 8.7 per 10 s window).
- Loop: render seconds 0 to 10 best match 37.6, 75.4, 113.0, 150.8, 188.4 and 226.0 s, all
  multiples of about 37.7 s.
- The independent reviewer reached the same main cause without being told it. It called the long
  render "a different take" (face PSNR 24 dB against 49 dB for a repeat render).
- Full POC write-up with every video comparison, picture and edit mistake (local, media not in git):
  `~/kb-scratch/avatar-tests/poc/HEYGEN-AVATAR-QUALITY-POC.md`. Side-by-side clips were also in `~/Downloads/proof-1` to `proof-7`. They are
  not committed.

The two explanations, "fixed render clock" and "the take depends on the audio before it", give the
same fix. The "same start, different words" result (0.60 and 0.74) favours the clock.

## Rules that follow

1. **Every full-screen avatar section gets its own render**, starting at render second 0 with that
   section's audio. A long render is fine only for a small corner bubble.
2. **Never change the avatar's frame rate.** HeyGen outputs 25 fps. A 30 fps edit repeats every
   6th frame, and the face and lips stutter 5 times a second. Output the video at 25 fps
   (`run-config.json` `"canvas": {"w":1920,"h":1080,"fps":25}`), or at a multiple of 25.
3. **Keep lip timing within one frame.** HeyGen's own lips run about 20 ms behind the input audio,
   and cutting on the 40 ms frame grid can add another 20 ms. Check the offset after every cut.
4. **Re-rendering the same file gives the same take.** To try a different take for free, move the
   slice start by 0.1 to 0.3 s, or add a little silence before it.
5. **Keep full-screen avatar sections short** (about 10 to 25 s), and cut on pauses.

## Picking a photo

- **Cover the neck.** Avatar III moves the head while the shoulders stay almost still, and it bends
  the neck to join them. On a bare neck you can see throat lines appear and stretch. Maria with
  thin straps: the head moved 4.2 times as much as the shoulders. Maria in a turtleneck (look
  `9c14386e…`): no skin stretching was visible, because the collar hides the join. Helen's sweater
  and hair did the same job.
- **Head straight, calm face, eyes at the camera.**
- **Mouth closed or only slightly open** (reviewer advice; not tested yet). The mouth is painted
  from the photo.
- **Even, front light.** No hands near the face.

## Still open (free tests)

- Run the same check on a third avatar.
- Is the motion loop the same length for every avatar, and does a known calm part sit at a fixed
  offset that could be reused?
- Render the same slice with 0.0 s, 0.2 s and 0.5 s of silence before it, and compare the takes.
- Shift the voice 40 ms later in the final, and see whether the lip sync looks better.
- The final intro was 12.6 dB louder than the HeyGen test. Does matching the loudness change how
  it reads?

## Scripts

`pipelines/video/heygen/avatar-test/analysis/`: `clock_metric.py` (frame-by-frame comparison),
`loop.py` (loop period), `drift.py` (distance from the photo over time), `neck2.py` (head, neck and
shoulder motion). The first three take their inputs as arguments; `neck2.py` has its file paths and crops written in.
