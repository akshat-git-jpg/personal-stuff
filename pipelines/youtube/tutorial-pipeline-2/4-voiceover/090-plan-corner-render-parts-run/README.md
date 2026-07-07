# 090 · plan-corner-render-parts  ·  [RUN]

The one place A3 corner chunking lives. The corner talking-head (Avatar III) covers the whole
video, but a long continuous render hallucinates — so we cap each part at **~7 min**
(`shared/heygen_config.py` → `FLOWS['a3']['max_render_seconds']`, default 420s; well under the
30-min API cap, chosen for quality).

- **In:** `../080-synthesize-voice-run/output/<base>.work/{clips/*.wav, chunks.json}`
- **Out:** `output/corner-parts/<base>__a3__corner[-pNN].wav` (kept separate) + `<base>.corner-parts.json`
- **Run:** `python3 run.py [<base>]`
- **Next:** step 150 `run-a3.py` uploads these (one render each)

**How (no silence detection, no estimation):** step 080 already made clean, sentence-packed chunk
wavs with real durations. We just **group consecutive chunks** into balanced parts each ≤ the cap
and concat them — cuts land exactly on chunk = sentence boundaries; durations are exact and
guaranteed under the cap. Uses `lib/audio.py`.
