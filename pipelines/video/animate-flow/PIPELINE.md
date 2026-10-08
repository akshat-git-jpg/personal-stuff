# animate-flow — pipeline

| # | Step | Actor | Verb | In | Out |
|---|---|---|---|---|---|
| 010 | take in the sources | run | `intake` | voiceover, optional screen recording | `run-config.json`; media `audio.wav`, `vo.mp3`, `screen.mp4` |
| 020 | transcribe the voiceover | run | `transcribe` | media `vo.mp3` | `transcript.json` |
| 030 | plan the moments | llm (sealed) | `plan-moments` | transcript, design system, `TASTE-ANIMATE.md` | `moments.json` |
| 040 | author the moments | llm (sealed, one per moment) | `author-moments` | moment, design system, `TASTE-ANIMATE.md`, logos | `moments/<id>/index.html` |
| 050 | review the frames | run | `review-frames` | compositions | `review/REVIEW.md`, stills |
| 060 | render the moments | run | `render-moments` | compositions | media `moments/<id>.mp4` |
| 070 | assemble the cut | run | `assemble` | renders, audio, bed | media `final-draft.mp4`, `versions/vN.mp4` |
| 080 | review the cut | owner | `review` | the cut | `feedback.json` |
| 090 | learn from the feedback | opus | `feedback-status` | `feedback.json` | `TASTE-ANIMATE.md` / design system |

Each step's folder under `steps/` has its README and `step.json`; `lib/steps.test.mjs` keeps
this table, the step files and the dispatcher's verbs in agreement.

## run-config.json

```json
{
  "template": "animate",
  "video": "<registry key>",
  "title": "<working title>",
  "designSystem": "default",
  "canvas": { "w": 1920, "h": 1080, "fps": 30 },
  "models": { "plan": "opus", "author": "opus" },
  "moments": { "target": 6 },
  "source": { "audio": "audio.wav", "screen": "screen.mp4", "from": "<original names>" },
  "total": 76.4
}
```

`canvas`, `models` and `moments` are optional. `template: "animate"` is what routes the
video here (`video-edit-router`) and what the feedback skill checks before it folds anything.

## moments.json

```json
{
  "video": "<key>", "designSystem": "default", "total": 76.4,
  "moments": [
    { "id": "m01", "from": { "i": 12, "text": "OpenArt" }, "to": { "i": 31, "text": "together." },
      "hold": 0.5, "idea": "...", "why": "...", "start": 4.12, "end": 11.8, "duration": 7.68 }
  ]
}
```

The model writes the anchors, idea and why; `lib/moments.mjs` resolves `start`/`end` from the
transcript, so a time is never typed by hand.
