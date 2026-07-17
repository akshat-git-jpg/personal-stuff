# graphics-flow

Beat-synced motion graphics for a video: word-timestamp transcription → LLM cue
pass → anchor resolver → owner storyboard review → batch render + editor
manifest. Everything except the cue pass is scripted and costs zero tokens.
Cards themselves (the Hyperframes compositions + `catalog.json`) live in
`../card-library/`, which this flow treats as a read-only source of truth.

## The flow (run top to bottom)

| Step | Actor | In → Out |
|---|---|---|
| `010-transcribe-run` | [RUN] | `vo.mp3` → `transcript.json` (word timestamps) |
| `020-cue-pass-llm` | [LLM] (pluggable: Sonnet default; agy/Antigravity allowed as form-fillers) | `transcript.json` + `card-library/catalog.json` → `cues.json` |
| `030-resolve-run` | [RUN] | `cues.json` → `resolved.json` (absolute times + merged variables) |
| `040-storyboard-review-owner` | [OWNER] | `resolved.json` → approved `cues.json` (localhost:4322 board) |
| `050-render-run` | [RUN] | approved `resolved.json` → `renders/*.mp4\|mov` + `manifest.md` |

Each `steps/NNN-*/` folder has a `README.md` (purpose, exact command, in →
out); the four scripted steps also have a thin `run.sh` wrapper.

## `videos/<slug>/` layout

```
videos/<slug>/
  vo.mp3           # input voiceover — gitignored (regenerable from the tts hub)
  transcript.json  # step 010 output — committed
  cues.json        # step 020 output, step 040 edits — committed
  resolved.json    # step 030 output — committed
  slices/          # per-cue vo slices, step 040's board — gitignored
  renders/         # step 050's clips — gitignored (regenerable)
  manifest.md      # step 050 output, at the workdir root — committed
```

Per-video text artifacts (transcript, cues, resolved times, manifest) are
committed so each video's graphics data is reviewable in one place; media
(voiceover, slices, rendered clips) is regenerable and never lands in git —
same house rule as the rest of `pipelines/`.

## Independence

Any flow may call `lib/resolve.mjs`, `lib/render.mjs`, or `lib/board.mjs`
directly with a path argument instead of a slug — this flow's steps are not
the only caller. `card-library` remains the card + catalog source of truth;
see `../card-library/README.md` for the beat contract cards must satisfy.

## cues.json schema

This is the interface plans 064 (writes it) and 065 (edits it) build against. Change it in one place only — this README — and update both consumers.

```json
{
  "video": "notion-vs-asana",
  "approved": false,
  "cues": [
    {
      "id": "c01",
      "card": "pros-cons/pros-cons",
      "anchor": "let's look at the pros",
      "lead": 0.5,
      "hold": 3.0,
      "variables": { "title": "Notion" },
      "beats": [
        { "reveal": { "kind": "pro", "text": "Unlimited free tier" }, "anchor": "the free tier alone" },
        { "reveal": { "kind": "con", "text": "Slow on mobile" },      "anchor": "the mobile app crawls" }
      ],
      "flagged": false
    }
  ]
}
```

Field semantics:

- `anchor` — verbatim transcript phrase (≥3 words) where the cue/beat lands.
- `lead` — seconds the card starts before its anchor (default 0.5).
- `hold` — seconds held after the last beat (default 3.0).
- `variables` — card variables excluding beats.
- `beats[].reveal` — the card-specific beat item (shape per catalog.json `beat_shape`, WITHOUT `at` — the resolver adds it).
- `placement` comes from catalog.json, not from the cue.
- `flagged: true` — no card fits, needs a novel card (plan 065 surfaces these).

Single-card cues (`kind: "single"`) have `beats: []` and use catalog `default_duration`.
