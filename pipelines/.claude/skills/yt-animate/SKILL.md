---
name: yt-animate
description: >-
  Operate the animate-flow recipe (pipelines/video/animate-flow) by verb: custom motion graphics
  per moment of a video in a swappable design system, then a kit-assembled cut the owner
  comments on. Invoke by name: "yt-animate", "animate this video", "/animate". Generic
  "edit this video" asks go through video-edit-router.
user-invocable: true
---

# yt-animate — operating skill (verb router)

Run everything from `pipelines/video/animate-flow/`. This skill routes verbs; the steps'
READMEs hold the procedure and `TASTE-ANIMATE.md` plus the design system hold the judgment.
Pipeline and schemas: `PIPELINE.md`. Operating rules: `CLAUDE.md`.

## Guardrails

1. **This recipe only.** Before any verb on an existing video, read
   `videos/<slug>/run-config.json`: `template` must be `"animate"`. Anything else belongs to
   another recipe; stop and hand back to `video-edit-router`. Never load another recipe's
   skill, taste file or prompts in this session.
2. **Name through the registry.** A new video starts with `intake`, which calls
   `vreg ensure`; use the key it prints as `<slug>` from then on.
3. **You do not author the graphics yourself.** 030 and 040 run fresh `claude -p` sessions in
   sealed stages outside the repo; that is the isolation. Do not hand-write a moment in this
   session unless the owner asks for a specific edit to one, and then edit
   `videos/<slug>/moments/<id>/index.html` directly and re-run 050-070.
4. **The look is the owner's call.** After `assemble`, extract a few frames and look at them,
   say plainly what looks wrong, and send the owner to `review`. Never call a cut approved.
5. **Feedback** goes through `yt-animate-feedback`, never folded ad hoc.

## Verbs

| Owner says | Run | Step |
|---|---|---|
| "animate <video>", "start an animate edit" | `node lib/run.mjs <name> intake --audio <file> [--screen <file>] [--title "..."] [--design-system <name>] [--canvas WxH] [--from s --to s]` | 010 |
| "transcribe it" | `node lib/run.mjs <slug> transcribe` | 020 |
| "pick the moments", "plan the graphics" | `node lib/run.mjs <slug> plan-moments` | 030 |
| "animate the moments", "make the graphics" | `node lib/run.mjs <slug> author-moments [--only m02]` | 040 |
| "check the graphics" | `node lib/run.mjs <slug> review-frames` | 050 |
| "render them" | `node lib/run.mjs <slug> render-moments` | 060 |
| "cut it", "assemble" | `node lib/run.mjs <slug> assemble [--final]` | 070 |
| "let me review", "open the review page" | `node lib/run.mjs <slug> review` (http://127.0.0.1:4330/) | 080 |
| "where is it", "status" | `node lib/run.mjs <slug> status` | - |
| "use another design system" | set `designSystem` in `run-config.json` to a folder under `pipelines/video/design-systems/`, then re-run 040-070 | - |

`bash run.sh <slug> <verb>` is the same thing with Node 22 and `GROQ_API_KEY` set up for you.

## A normal run

intake -> transcribe -> plan-moments -> author-moments -> review-frames (fix errors with
`author-moments --only <id>`) -> render-moments -> assemble -> look at frames -> owner reviews.
