# 030 · plan the moments · [LLM]

```
node lib/run.mjs <slug> plan-moments            # stage, run, validate, write moments.json
node lib/run.mjs <slug> plan-moments --stage-only   # build the stage and stop (inspect it)
```

One fresh `claude -p` run (model `run-config.json` `models.plan`, default `opus`) picks the
spans of narration that deserve a custom graphic.

## Sealed stage

The run happens in `~/kb-scratch/video/animate-flow/<slug>/stage/030-plan-moments-llm/`,
outside the repo, with `--setting-sources project`, so no repo `CLAUDE.md`, skill or memory
is in reach. The stage holds exactly:

| File | From |
|---|---|
| `PROMPT.md` | `prompt.md` in this folder, placeholders filled |
| `transcript.tsv`, `transcript.json` | the workdir transcript |
| `DESIGN.md` | the run's design system |
| `TASTE-ANIMATE.md` | this recipe's taste file |
| `moments.mjs` | the validator, so the model checks its own file |

`stage-manifest.json` records the list after `sealStage()` has refused anything whose name
or text is banned for this recipe in `visuals-flow/recipe-isolation.json`.

## Out

`videos/<slug>/moments.json`: each moment's word anchors (`from`, `to`), `idea`, `why`, and
the resolved `start`/`end`/`duration` in seconds. Validation (`lib/moments.mjs`): anchors must
match the transcript word for word, moments 3-20s, no overlap, gaps under 1s are closed. One
correction round runs in the same session if the file fails.
