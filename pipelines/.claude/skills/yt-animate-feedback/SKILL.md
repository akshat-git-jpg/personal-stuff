---
name: yt-animate-feedback
description: >-
  Close the loop on owner feedback for an animate-flow video: read the timestamped comments,
  root-cause each one, agree the fixes, then fix the video and fold each lesson into
  TASTE-ANIMATE.md or the design system. Wraps step 090. Invoke by name or "/yt-animate-feedback".
  Refuses any video whose run-config template is not "animate".
user-invocable: true
---

# yt-animate-feedback — fold the owner's comments into this recipe

Run everything from `pipelines/video/animate-flow/`. Step 090's README
(`steps/090-learn-from-feedback-opus/README.md`) is the authority on where a lesson goes;
read it at execute time instead of restating it.

```
- [ ] Gates checked
- [ ] Phase 1: every pending item and chat note read
- [ ] Phase 2: one line of root cause per item
- [ ] Phase 3: open questions asked, fixes agreed
- [ ] Phase 4: one summary, explicit approval
- [ ] Phase 5: video fixed, rules written, items marked, new cut assembled
```

## Gates (before anything)

1. Read `videos/<slug>/run-config.json`. If `template` is not `"animate"`, **stop**: say this
   skill folds animate videos only and hand back to `video-edit-router`. Do not read or
   edit anything for that video.
2. Folding is judgment work: an Opus-class session only.
3. Only this recipe's surfaces are in scope: `TASTE-ANIMATE.md`, the run's design system,
   this folder's code and prompts. Any other recipe's files are never read or written here.

## Phase 1 — Ingest

- `node lib/run.mjs <slug> feedback-status` lists pending items (exit 1 when there are any).
- Each item has `t` (seconds into the cut) and usually `moment` (the moment id). Open that
  moment's composition and, for a visual note, extract the frame:
  `ffmpeg -ss <t> -i ~/kb-scratch/video/animate-flow/<slug>/versions/<label>.mp4 -frames:v 1 /tmp/<key>.png`
  and look at it.
- Add anything the owner said in chat as an item of its own.

## Phase 2 — Root cause, one line each

Was it the moment choice (030), the design of the graphic (040), the design system, a
mechanical defect a check could have caught (050/060), or assembly (070/kit)?

## Phase 3 — Discuss

Ask only what you cannot decide from the evidence. Quote the owner; never widen one comment
into a general rule without asking.

## Phase 4 — One summary, then wait

Per item: the fix for this video, and the rule (if any) with its target file. Get an
explicit yes.

## Phase 5 — Execute

1. Fix the video: re-run `author-moments --only <ids>` (the new rule is already in
   `TASTE-ANIMATE.md`, so write the rule first), or edit the composition directly when the
   owner asked for a specific change; then `review-frames`, `render-moments`, `assemble`.
2. Mark each item in `feedback.json`: `applied` (what changed in this video) and `folded`
   (where the rule went), both dated.
3. Look at frames of the new cut before reporting; the owner reviews it at 080.
