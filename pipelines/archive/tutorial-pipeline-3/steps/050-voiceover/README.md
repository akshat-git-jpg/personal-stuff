# Step 050: Voiceover

Turns the polished script into one locked wav per section. Driven by the **`yt-vo`**
skill; the engine, voice and reference clip live in `pipelines/video/tts/`.

Replaces the retired `050-publish-ui` step (the `apps/tutorial-vo` Worker UI, deleted
2026-08-20 — see WORKFLOW.md "Voiceover: owner-run and local").

## Env Vars

Requires the following in `pipelines/.env`:
- `MODAL_TTS_URL` — the deployed `synth_section` endpoint URL
- `MODAL_TTS_TOKEN` — the `TTS_WEB_TOKEN` that endpoint checks

One-time Modal setup is in `pipelines/video/tts/CLAUDE.md`.

## Run Order

1. Set stage to tts: `node lib/set-stage.mjs <slug> tts`
2. Synthesize: `bash run.sh <slug> vo`
3. Listen to `videos/<slug>/audio/*.wav`.
4. Re-roll anything weak: `bash run.sh <slug> vo --only s03`
   Fix a mispronounced name in `videos/<slug>/respell.json` first, then re-roll.
5. Approve: `bash run.sh <slug> vo-lock`
6. Advance: `node lib/set-stage.mjs <slug> locked`

## Notes

- `vo` skips locked sections. Pass `--force` to re-synthesize one anyway.
- Each run writes `audio/<id>.wav` and bumps `tts.regens_used`, so Modal spend is
  visible in `script.json`.
- `respell.json` is optional, `{ "Asana": "Ah-sah-nah" }`, and only applies to
  sections whose `spoken_text` is still empty (it feeds `deriveSpoken`).
- Locking requires no open flags, non-empty `spoken_text`, and a take on disk.
