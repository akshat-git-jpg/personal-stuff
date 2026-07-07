# voice-maker — run log (price & time)

Real numbers from actual runs, so we know what a voiceover costs and how long it takes.
GPU is the only paid resource; everything else (chunking, trim, stitch) is local/free.

## Pricing reference
- **Modal A10G GPU:** ~$1.10 / hour ≈ $0.000306 / second (billed for container wall-time,
  cold start included). This is the only cost in the pipeline.
- Transcription (separate, in transcript-maker) was ~$0.04 via Groq — negligible.

## Runs

### BODY_2 — first real run (2026-06-29)
- **Script:** `transcript-maker/output/BODY_2.improved.txt`
- **Chunks:** 89 (~20s target each), all synthed OK
- **Voice:** jamila (30s ref), interval_silence 150ms, A10G
- **Wall time:** 26m 53s (1613s) end to end, incl. cold start
- **Per-chunk inference:** ~12.7s avg (RTF ~1.15 — slightly slower than realtime)
- **Output length (audio):** 1290.6s = **21.5 min** of voiceover (57 MB wav)
- **Est. GPU cost:** ~**$0.45–0.50** — A10G @ ~$1.10/hr; ~24 min of billed container time
  (cold start ~5–6 min one-time + ~19 min inference). The cold start is a fixed tax; a
  warm/second run of similar length lands nearer ~$0.35.
- **Takeaways:** ~21.5 min of finished voice for under 50¢. Cost scales with audio length, not
  chunk count. The redo loop (`--only`) re-synths a single chunk for ~1–2¢.
- **Notes:** quality TBD — listen pending; flag bad chunks for the `--only` redo loop.

<!-- template for future rows:
### <video> — <date>
- Chunks: N | Wall time: Xm Ys | Cost: ~$Z | Audio length: Mm | Notes:
-->
