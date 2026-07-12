# Final workflow — all channels

Workflow same as your style multiple channels.
Two category of channels (both use this same workflow — confirmed 2026-07-12):
1 - high quality Review, big comparison
2 - how to, small review, etc

## Workflow (VO-first — sync by construction, decisions.md 2026-07-12)

1) Tutorial Maker — writes script
2) Reviewer — makes sure script is high quality, covers everything
3) Processor — fixes/updates script, makes TTS, makes avatar videos, makes thumbnail
4) Tutorial Maker — records screen WHILE listening to the finished TTS (this is what keeps video and voice in sync — no dub-sync machinery needed)
5) Video Editor — adds avatar video, motion graphics, effects, music, etc.

## Cost per video (corrected 2026-07-12)

| Line | Old note | Actual | Why |
|---|---|---|---|
| Avatar (5 min) | $5 | **$5** | HeyGen ($1/min) is the path for now — owner decision 2026-07-12. fal-lipsync (validated, ~$0.30–0.40/min → ~$1.75/video, does the gaze-down pose) is DEFERRED, revisit later |
| Tutorial Maker | $20 | $20 | VO-first makes this hireable cheaper later (no narration skill needed — just click along to the track) |
| Video Editor | $10 | $10 | Scope shrinks if motion graphics come pre-rendered from the processor (hyperframes) |
| TTS | $2 | **$0.50** | IndexTTS-2 on Modal — $2 was a stale placeholder |
| Processor | $0 | $0 cash — but it's admin time, the real throughput cap | |
| Reviewer share | $8.33 | **$12.50 at 12/mo** | $8.33 assumed 18 videos/mo. $150/12 = $12.50. Volume is the only lever: 18/mo → $8.33, 30/mo → $5 |

Per video: **~$48.00 at 12/mo**, ~$43.83 at 18/mo, ~$40.50 at 30/mo.
(Old note said $45.33 but mixed 12 videos with an 18-video reviewer share.)
If fal-lipsync is adopted later: subtract ~$3.25/video.

## Open problems (prioritized)

1. **Processor is the bottleneck, not a $0 line.** Every video serializes through a manual
   admin Claude session (script fix, TTS, avatar, thumbnail). This is why 12/mo is stuck.
   Fix = finish productizing: TTS one-command run / editor UI (video/tts target-deployment
   section), fal-lipsync avatar CLI (orchestrate → secretary once base clip approved),
   script-fix as a pipeline stage. Thumbnail is the only piece with nothing built.
2. **No title/thumbnail packaging loop.** Thumbnail is a processor afterthought; no CTR
   iteration, no testing. On YouTube this decides more than production quality. Highest-ROI
   gap in the whole workflow.
3. **No final-video QC gate.** Reviewer covers the script only (confirmed 2026-07-12) —
   nobody signs off the shipped video. A bad edit sails through.
4. **Topic selection isn't wired in.** yt-research / keyword-research / dossiers exist but
   the workflow starts at "write script". Who decides what gets made, against what data?
5. **No analytics feedback loop.** yt-analysis + tracker exist; nothing feeds performance
   back into topic choice.
6. **Affiliate links aren't a workflow step.** tracker-app mints them; for review/comparison
   channels that's the revenue.
7. **Motion graphics quality at $10/video editor.** Decided routing (decisions.md
   2026-07-05): Sonnet + hyperframes generates graphics, editor just places pre-rendered
   clips. Step 135 rulebook still a stub.

## Quality levers that cost nothing

- Claude first-pass script review against the tool's dossier → the $150 reviewer reviews
  a diff, not raw drafts. Quality up, reviewer capacity up, same retainer.
- yt-style-copy Style DNA per channel so multi-channel scripts don't converge into one voice.
- Pre-rendered hyperframes graphics handed to the editor (see #7 above).

## Old goals (kept)

- Need to figure out a way to optimize cost without decreasing quality → see cost table
- More automation → see open problem #1
- More better quality → see quality levers + open problems #2/#3
