---
name: video-edit-router
description: >-
  Entry point for generic video-edit asks: "edit this video", "edit my video", "feedback is
  done", "I'm done with feedback", "I've finished reviewing", "process my feedback", "fold my
  feedback". Finds the video's recipe and hands off to exactly one recipe skill. Never edits
  or folds anything itself.
user-invocable: true
---

# video-edit-router — pick the recipe, then hand off

One recipe's judgment must never cloud another's. This skill only resolves **which
recipe owns the video**, then loads that recipe's skill and nothing else.

## Steps

1. **Find the video.** Take the slug from the owner or the open session. If unsure:
   `node pipelines/video-registry/bin/vreg.mjs where <name>`.
2. **Find the workdir.** `pipelines/video/visuals-flow/videos/<slug>/`. Missing → ASK the
   owner where the video lives. Never guess.
3. **Read the recipe.** `run-config.json` in the workdir, field `template`, then use the
   table below.
4. **Hand off** to the one skill in the row: the edit skill for edit asks, the feedback
   skill for feedback phrases. Load no other recipe skill in this session.

## Recipe table (add a recipe = add one row)

| `template` value | Recipe | Edit skill | Feedback skill |
|---|---|---|---|
| absent | template / cards | `yt-video-edit` | `yt-video-edit-feedback` |
| `coupon` | coupon (rule-based) | `yt-video-edit` (Coupon section) | `yt-video-edit-feedback` |

## Rules

- Unknown `template` value, no `run-config.json`, or a missing workdir: ASK the owner.
  Do not fall back to the template recipe.
- Feedback for one recipe is never folded into another recipe's rules. If the video's
  recipe has no feedback skill yet, say so and stop.
- Do not read the third-party taste skills (`video-taste`, `video-feedback`,
  `motion-graphics`, `talking-head-recut`, `vox-edit`, under `pipelines/.agents/skills/`)
  unless the chosen recipe's own skill points to one.
