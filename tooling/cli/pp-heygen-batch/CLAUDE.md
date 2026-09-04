# pp-heygen-batch — operate-doc

Runner half of the HeyGen batch pipeline (plans 266 + 267). Reads the desk's
queue file and produces avatar clips.

## Where things live

- Queue in: `pipelines/youtube/yt-script/videos/<key>/heygen-selections.json`
- Slices out: `~/kb-scratch/video/heygen/pp-heygen-batch/<key>/slices/<sel.id>.wav`
- Renders out: `~/kb-scratch/video/heygen/pp-heygen-batch/<key>/renders/<key>-<sel.id>.mp4`
- Word timings cache: `pipelines/youtube/yt-script/videos/<key>/audio/<id>.words.json`
- Drive: `HeyGen batches / <channel-slug> / <video-key> / <yyyy-mm-dd-hh-mm> /`

## Hard rules

- Never downgrade IV to III to fit the pool. STOP instead.
- Never disable the heygen-web meter check. The `⚠️NOT-free` verdict on an IV
  submit is the audit trail.
- Never edit `pipelines/video/heygen/registry.json` or `config/channels.json`
  as a side effect of a run.

## Not this tool's job

- The selection UI — that is `apps/yt-script-desk`'s avatar mode.
- The auto trigger — a freelancer runs the desk; the owner runs this CLI.
- fal-lipsync — parked by owner.
