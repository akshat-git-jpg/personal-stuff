# animate-flow — pipeline

| # | Step | Actor | Verb | In | Out |
|---|---|---|---|---|---|
| 010 | take in the sources | run | `intake` | voiceover, optional screen recording | `run-config.json`; media `audio.wav`, `vo.mp3`, `screen.mp4` |
| 020 | transcribe the voiceover | run | `transcribe` | media `vo.mp3` | `transcript.json` |
| 030 | plan the moments | llm (sealed) | `plan-moments` | transcript, design system, `TASTE-ANIMATE.md` | `moments.json` |
| 035 | storyboard the moments | llm (sealed, one run) + owner | `storyboard`, `storyboard-review`, `approve-storyboard` | moments, design system, `TASTE-ANIMATE.md`, recording frames | `storyboard.json`, `storyboard/<id>/index.html`; media `storyboard/storyboard.png` |
| 040 | author the moments | llm (sealed, one per moment) | `author-moments` | approved moment, its storyboard still, design system, `TASTE-ANIMATE.md`, logos | `moments/<id>/index.html` (+ `moments/<id>--9x16/` per extra format) |
| 050 | review the frames | run | `review-frames` | compositions, recording, the cut if any | `review/REVIEW.md` (ends with the weakest moment), stills, phone sheet |
| 060 | render the moments | run | `render-moments` | compositions | media `moments/<id>.mp4` |
| 070 | assemble the cut | run | `assemble` | renders, audio, bed | media `final-draft.mp4` (+ `final-draft-9x16.mp4` per extra format), `versions/vN.mp4`, cut checks |
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
  "models": { "plan": "opus", "storyboard": "sonnet", "author": "opus" },
  "formats": ["16:9", "9:16"],
  "review": { "deadMax": 4 },
  "moments": { "target": 6 },
  "source": { "audio": "audio.wav", "screen": "screen.mp4", "from": "<original names>" },
  "total": 76.4
}
```

`canvas`, `models`, `moments`, `formats` and `review` are optional. `formats` defaults to
`["16:9"]`; `"9:16"` and `"1:1"` are laid out again by 040 (the recording sits in a band across
the middle and graphics re-lay out around it), never cropped. `review.deadMax` is the longest
stretch of the cut with no visible change before 050 flags a dead beat (default 4s). `template: "animate"` is what routes the
video here (`video-edit-router`) and what the feedback skill checks before it folds anything.

## moments.json

```json
{
  "video": "<key>", "designSystem": "default", "total": 76.4,
  "moments": [
    { "id": "m01", "from": { "i": 12, "text": "OpenArt" }, "to": { "i": 31, "text": "together." },
      "hold": 0.5, "kind": "takeover", "idea": "...", "why": "...", "start": 4.12, "end": 11.8, "duration": 7.68 }
  ]
}
```

The model writes the anchors, idea and why; `lib/moments.mjs` resolves `start`/`end` from the
transcript, so a time is never typed by hand. `kind` is `takeover` (the graphic owns the frame,
the default) or `overlay` (it sits on the running recording; 060 renders it on a key-green plate
and 070 keys it over the bed).

## storyboard.json

```json
{ "video": "<key>", "made": "...", "moments": {
  "m01": { "at": 6.2, "caption": "...", "status": "approved", "note": "", "sig": "3f9c..." } } }
```

`status` is `pending`, `approved` or `rejected`; `sig` hashes the moment's span, kind and idea,
so a re-planned moment needs a new panel. 040 authors only approved moments.
