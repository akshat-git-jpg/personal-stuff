# intro-studio — the flow

| Step | Actor | In → Out |
|---|---|---|
| `010-intake-run` | [RUN] | `input/intro.mp4` → `vo.mp3` + `screen.mp4` + `transcript.json` (word timestamps) |
| `015-avatar-clip-human` | [OWNER] | the intro VO → one avatar clip covering the WHOLE intro, saved as `avatar.mp4`. Live HeyGen is owner-run; this step never makes a network call on its own |
| `020-write-screenplay-llm` | [LLM] | `transcript.json` → `screenplay.json` (plan 181) |
| `025-approve-screenplay-human` | [OWNER] | reads `screenplay.json`, approves or edits (plan 181) |
| `030-author-film-llm` | [LLM] | approved `screenplay.json` → `film/index.html` (plan 182) |
| `035-review-run` | [RUN+LLM] | `film/index.html` → `review/` (beat frames, contact sheets, `REVIEW.md`) + blocking findings. Loops with 030 until clean. No encode |
| `040-render-run` | [RUN] | `film/index.html` → `renders/intro-film.mp4` (plan 182) |
| `050-critique-llm` | [LLM] | the render → frame contact sheet → PASS/FAIL against `INTRO-BAR.md`; one retry on FAIL (plan 182) |
| `060-deliver-run` | [RUN] | passing render → `out/intro.mp4` (plan 182) |

Steps 020-060 land in plans 181 and 182. This file lists them from the start
so the shape is legible while the pipeline is half-built.
