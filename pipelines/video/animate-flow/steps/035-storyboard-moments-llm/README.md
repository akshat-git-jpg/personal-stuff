# 035 · storyboard the moments · [LLM] + owner gate

```
node lib/run.mjs <slug> storyboard [--only m01,m03]      # draw stills, composite, contact sheet
node lib/run.mjs <slug> storyboard --stage-only           # build the stage and stop
node lib/run.mjs <slug> storyboard-review                 # approve/reject per panel at http://127.0.0.1:4331/
node lib/run.mjs <slug> approve-storyboard --ok m02,m04 [--reject m01 --note "..."]
```

The cheap check before the expensive one: a wrong idea costs one static still here and a
full opus authoring run at 040.

## The run

ONE fresh `claude -p` run (model `models.storyboard`, default `sonnet`) draws every
requested moment in one session, in a sealed stage
(`~/kb-scratch/video/animate-flow/<slug>/stage/035-storyboard-moments-llm/`,
`--setting-sources project`, audited by `sealStage()` like 030 and 040):

| Path | From |
|---|---|
| `PROMPT.md` | `prompt.md` here: the screen-recording frame checklist and the output contract |
| `moments.json` | per moment: kind, idea, why, words, the recording's busy region in words, the owner's rejection note |
| `recording/<id>.jpg` | a frame of the screen recording at the middle of the moment |
| `design-system/`, `TASTE-ANIMATE.md`, `logos/` | as 040 |
| `stills/` | empty; the output: `stills/<id>.html`, static, no script |

The run also writes `board.json`: per moment the key second `at` and a one-line caption.
One correction round runs if a still or an entry is missing.

## After the run (no model)

- Each still is screenshotted in hyperframes' Chrome with a transparent background, laid
  over the recording frame at `start + at`, and saved as `<media>/storyboard/<id>.png`.
- `<media>/storyboard/storyboard.png`: the contact sheet, three panels across, each
  labelled number, id, kind, time, status and caption.
- `videos/<slug>/storyboard/<id>/index.html` keeps the still (committed); 040 stages it as
  the frame its composition must arrive at.
- `videos/<slug>/storyboard.json`: per moment `at`, `caption`, `status`
  (`pending` / `approved` / `rejected`), `note`, and `sig`, a hash of the moment's span,
  kind and idea. Re-planning a moment (030) changes its `sig`, so its approval goes stale.

## The gate

`author-moments` (040) refuses any moment whose panel is missing, stale, pending or
rejected, and names why. `--skip-storyboard` overrides it for one run (say so to the owner).
A rejection note goes into the next `storyboard --only <id>` run as `ownerNote`.

## Cost

One sonnet session for all moments, static HTML only: well under a dollar for a
5-moment video. The recording frames and composites are ffmpeg and a headless screenshot.
