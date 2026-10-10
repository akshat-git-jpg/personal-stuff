# 040 · author the moments · [LLM]

```
node lib/run.mjs <slug> author-moments [--only m02,m04] [--jobs 3]
node lib/run.mjs <slug> author-moments --stage-only
```

One fresh `claude -p` run per moment (model `models.author`, default `opus`), up to `--jobs`
at a time. Each writes one hyperframes composition per format for the moment's span: a
takeover fills the frame, an overlay paints only its graphic on a transparent page.

**Storyboard gate:** a moment is authored only when its 035 panel is approved and was drawn
for the moment as it stands; otherwise the run stops and names why. `--skip-storyboard`
overrides it for one run. The approved still is staged as the frame the composition must
arrive at.

The prompt carries the screen-recording frame checklist and the banned defaults (see
`prompt.md`), and ends by naming the weakest frame.

## Sealed stage, per moment

`~/kb-scratch/video/animate-flow/<slug>/stage/040-author-moments-llm/<id>/`, outside the repo,
`--setting-sources project`:

| Path | From |
|---|---|
| `PROMPT.md` | `prompt.md` in this folder, placeholders filled |
| `moment.json` | the moment's kind, idea, why, the recording's busy region in words, and its words with times relative to its start |
| `design-system/` | the run's design system folder, whole |
| `TASTE-ANIMATE.md` | this recipe's taste file |
| `logos/` | the brand logo registry and files (`card-library/logos/`, nothing else from there) |
| `.claude/skills/` | `hyperframes`, `hyperframes-core`, `hyperframes-animation`, `gsap` |
| `storyboard/` | the approved still (`still.html`) and its panel over the recording (`panel.png`) |
| `recording.jpg` | a frame of the screen recording at the still's key time |
| `composition/` (+ `composition-9x16/`, `composition-1x1/` per extra format) | empty; the output |

The model lints, checks and snapshots its own composition and looks at the frames before it
stops. Afterwards `composition/` is copied to `videos/<slug>/moments/<id>/`; the stage keeps
the snapshots and the run's JSON envelope (`claude-author.json`). Cost and time per moment
go to `author-log.json`.

Re-run one moment with `--only <id>`; the others are untouched.
