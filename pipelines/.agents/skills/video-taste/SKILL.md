---
name: video-taste
description: >
  Luuk's compounding editing taste + quality bar for ANY video (shorts, longform,
  vlogs, product demos, talking-heads). LOAD THIS before cutting, assembling, captioning,
  scoring, or finishing any video, and RE-READ the relevant files before regenerating after
  feedback. It is the video twin of `me-context`: a memory that GROWS every review round so a
  note is given once and never needed again. TRIGGER whenever editing/assembling/finishing a
  video, applying reviewer feedback, or deciding shots/captions/music/pacing.
---

# video-taste — edit any video to Luuk's bar, and get better every round

The point: **stop re-learning the same lessons.** Every video Claude touches should start from
everything learned on every previous video. This file set is that memory.

## How to use it (the loop)
1. **Before the first cut** of any video, read `universal.md` + the matching `by-type/*.md`
   + `by-subject.md`. Apply them to the FIRST render — most "mechanical" feedback rounds
   (clipped words, caption sync, freezes, monotony, music timing, legibility) should never
   happen because the rules already prevent them.
2. **Review** with the `video-feedback` reviewer. Luuk drops timestamped notes.
3. **Apply + distill.** When you act on feedback, split each note:
   - *Taste call for THIS video only* (e.g. "use the backflip here") → just fix it.
   - *A general preference* (e.g. "captions should never clip a word", "start music where it
     actually comes in") → fix it AND append the generalized rule to the right file below.
   Re-read the file before regenerating so you don't undo a prior lesson.
4. Over time the per-video taste calls shrink; the permanent rules cover more. That is the
   whole design — feedback compounds instead of evaporating.

## Files
- `universal.md` — rules true for EVERY video (audio, b-roll, captions, music, structure,
  verification). The crown jewel — most learnings live here.
- `by-type/` — what differs by format: `shorts.md`, `longform.md`, `vlog.md`, `talking-head.md`.
- `by-subject.md` — who to feature / identity rules per person or project.

## What this is NOT
- Not the render engine (that's the assembly/edit skills, which READ this).
- Not a replacement for Luuk's eye on genuine creative calls — it removes the *repeat* feedback,
  not the *first-time* taste call. Aim: rarely have to say the same thing twice.

## Writing rule
Every entry states the RULE, then the WHY (so it transfers to a video type we haven't hit yet),
then HOW (the concrete mechanism). Keep it generalized — strip anything specific to one shoot
(a particular clip id, a particular location) unless it's a durable subject/brand fact.
