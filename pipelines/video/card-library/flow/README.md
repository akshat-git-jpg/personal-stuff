# Graphics flow — per-video runbook

Mechanical pipeline around the one LLM step (the cue pass): word-timestamp
transcription → anchor resolver → batch render → editor manifest. Everything
except the cue pass is scripted and costs zero tokens.

Generated media never lives in the repo (decisions.md 2026-07-12) — the owner
creates and runs each video's workdir under `~/kb-scratch/`, not this repo.

## Workdir layout

```
~/kb-scratch/video/graphics/<video-slug>/
  vo.mp3           # the video's TTS voiceover (input, from the tts hub)
  transcript.json  # word timestamps — step 1 output
  cues.json        # the LLM cue pass output (plan 064 defines how it's produced)
  resolved.json    # resolver output — absolute times + merged variables
  renders/         # final clips + manifest.md
  slices/          # per-cue mp3 slices (written by the board, plan 065)
```

## The four commands

All run with `<card-library>` = the absolute path to `pipelines/video/card-library/` in this repo (needed so `npx` resolves the `.npmrc`-pinned public registry from a workdir that has no `.npmrc` of its own — verified working 2026-07-17).

1. **Transcribe** (writes `transcript.json` into the workdir):
   ```
   cd <workdir> && npx --prefix <card-library> hyperframes@latest transcribe vo.mp3 --json -m small.en
   ```
2. **Cue pass** — the one LLM step. See `flow/RULEBOOK.md` (plan 064) for how `cues.json` gets written; this flow only consumes it.
3. **Resolve** (from `<card-library>`):
   ```
   node flow/resolve.mjs <workdir>
   ```
4. **Render** (from `<card-library>`):
   ```
   node flow/render.mjs <workdir>
   ```

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
