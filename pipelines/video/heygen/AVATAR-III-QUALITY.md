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

## Making a new avatar: the checklist

Do all of these for every new avatar. Each line comes from a test above or from the reviewer.

**The photo**
1. **Cover the neck.** Turtleneck, high collar, or hair over the neck. Avatar III moves the head while
   the shoulders stay almost still, and it bends the neck to join them. A bare neck shows throat lines
   that appear and stretch (Maria with thin straps: head moved 4.2 times as much as the shoulders;
   Helen in a sweater: 2.0 times). Trade-off: Maria in a turtleneck had stiller shoulders and can look
   a little stiff.
2. **Head straight, eyes into the lens, calm face.** A slight smile at most. The motion clip adds
   expression on top of the photo, so a strong expression in the photo gets stronger.
3. **Mouth closed or only slightly open.** The mouth is painted from the photo (reviewer advice; not
   tested yet).
4. **Even, soft front light.** No hard shadows on the face.
5. **Nothing near the face.** No hands, microphone, glasses glare, or hair across the mouth.
6. **Sharp and large.** Face in focus, at least 1080 px tall (Maria at 2752x1536 worked well).
7. **Head and shoulders, with room around the head.** The corner circle zooms 1.3 to 1.4 times on
   the face; the frame must not cut the hair or chin at that zoom.
8. **Plain background.** A clean office or wall; nothing that moves or draws the eye.
9. **No watermark.** Google Flow pictures carry one. Remove it and check the result before upload.

**The free test (avatar-test skill, Avatar III, 0 credits, credits checked before and after)**
10. Render the standard 18 s intro and watch it in HeyGen. The owner judges the look here.
11. Watch the neck and the shoulders. If the neck stretches, change the photo, not the edit.
12. Render a 60 s test once. Note which render seconds look calm and how long the motion loop is
    (helen office clean: about 37.7 s). Render second 0 is the safe start we know.
13. Pick the circle zoom from an options picture (eyes open), then add it to
    `AVATAR_FOCUS_BY_TEMPLATE` in `visuals-flow/lib/effects/bubble.mjs`.
14. Add the avatar to `registry.json` (`avatar_id` for a photo avatar).

**Using it in a video**
15. Every full-screen section gets its own render, 10 to 25 s, cut on pauses. One long render only
    for the small corner circle.
16. Output 25 fps (the edit flow default since 2026-10-09). Never resample the avatar.
17. Check lip timing after every cut, within one frame (40 ms).
18. Stay on Avatar III. Avatar IV only with the owner's OK for that batch.

## Owner decisions (2026-10-09)

- **25 fps is the default for the whole edit flow**, not only coupon videos
  (`DEFAULT_CANVAS` in `visuals-flow/lib/kit/edit-plan.mjs`). Cards, intro kit and intro film render
  at 25 too. Side effect: 30 or 60 fps screen recordings lose some frames; the avatar matters more.
- **Coupon videos render intro and outro separately again** (`oneRender` removed from the coupon plan).
- **Lip timing:** the avatar seek now uses where the piece really starts on the frame grid, not the
  planned time (up to half a frame of slip before). Measured on the EverBee rebuild: lips 18 ms behind the
  voice (HeyGen's own lag), down from about 40 ms. Nearer is not possible at 25 fps.
- **Finals encode with x264, preset slow, CRF 16** (was the hardware encoder or veryfast/CRF 18,
  which softened the face). Drafts keep the fast settings.
- **Loudness:** the final stays at -14 LUFS, the YouTube level; YouTube plays every video near that
  level anyway. The HeyGen test only sounded quieter because it was raw. Open check: watch the good
  test at -14 LUFS and see if it still looks good.
- **Captions over the full-screen avatar:** left as they are for now.

## Parked: the whole video in short renders

The owner may later want every avatar part, not only full-screen sections, made from short renders.
Known costs before doing it:
- Every render opens with the same motion, so back-to-back batches can show the same head move.
  Hide it with b-roll, a zoom change, or 0.2 to 0.5 s of silence before some batches.
- At each join the head can jump from mid-move back to the photo pose. Cut on pauses and cover the cut.
- Each cut needs the lip check (rule 3).
- Total seconds stay the same. Unknown: whether HeyGen has a minimum charge per render.

## Still open (free tests)

- Run the same check on a third avatar.
- Is the motion loop the same length for every avatar, and does a known calm part sit at a fixed
  offset that could be reused?
- Render the same slice with 0.0 s, 0.2 s and 0.5 s of silence before it, and compare the takes.
- Shift the voice 40 ms later in the final, and see whether the lip sync looks better.
- The final intro was 12.6 dB louder than the HeyGen test. Does the good test still look good at
  -14 LUFS?

## Scripts

`pipelines/video/heygen/avatar-test/analysis/`: `clock_metric.py` (frame-by-frame comparison),
`loop.py` (loop period), `drift.py` (distance from the photo over time), `neck2.py` (head, neck and
shoulder motion). The first three take their inputs as arguments; `neck2.py` has its file paths and crops written in.
