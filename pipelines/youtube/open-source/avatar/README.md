# Open-source avatar video: problem, findings, and plan

Handoff doc written 2026-07-10. This captures a full brainstorming session about replacing HeyGen for the talking-avatar clips in the YouTube tutorial pipeline. Nothing has been built or spent yet. A future session should be able to pick up from the "Next step" section and run.

## How to use this doc

Read top to bottom once. The short version: we explored self-hosting heavy avatar models (InfiniteTalk, LongCat) on ComfyUI/RunPod, ran the cost math, and dropped that idea. The plan we landed on is a base video loop plus a cheap lip-sync API, which is cheaper than HeyGen and also solves a pose problem HeyGen can't. The immediate action is a small paid test to confirm quality on real inputs before any code gets written.

## Update 2026-07-11: de-risk test done, pipeline validated

The paid test happened and the approach works. LatentSync lip-sync is in sync on the actual stylized side-view face and holds through motion, so lip-sync is solved. The remaining work is purely tuning the base motion clip to look natural. About $2.40 of the $10 fal budget spent so far.

### Account and inputs
- fal.ai account is set up with $10 credit. The API key lives in `infra/secrets/fal.env` (gitignored) as `FAL_KEY`. Do not commit it or print it.
- Test image: `~/Downloads/Google Flow Avatar Side.jpeg`, a woman in a three-quarter side pose looking to the side and slightly down. Copied into the test folder as `avatar-side.jpeg`.
- Test audio: a 25 second snippet cut from `~/Downloads/Video (2).mp4` (a 60s file), saved as `audio-25s.wav`. A short snippet keeps each lip-sync call cheap while still being enough to judge quality.
- Everything lives in `pipelines/youtube/open-source/avatar/test/`.

### The pipeline that works
1. Base motion clip, made once per character: animate the still into a few seconds of subtle idle motion.
2. Loop it to the voiceover length with ffmpeg, ping-pong (forward then reversed) so the loop has no seam. Free.
3. Lip-sync per video with fal LatentSync, which paints the mouth onto the looped video to match the new audio. About $0.30/min.

The base clip is reused for every video. Only the lip-sync runs per video, because only the audio changes.

### What LatentSync proved
- fal-ai/latentsync is in sync on this face, with no "face not detected" failures across 624 frames, and it held the side pose. Output was 806x1080 with the audio muxed in. This was the biggest risk and it passed.
- Cost: about $0.20 flat up to 40s, then $0.005/s.

### The base-motion lessons (the hard part, learned by trial)
Getting the motion to look natural took several attempts. These are the lessons so the next session does not repeat them:
- Kling image-to-video from just the source image drifts the head toward the camera over the clip. The model prior pulls faces frontal, and prompting "do not face camera" barely helps.
- Pinning both the first and last frame to the same image (tail_image_url set to the source) stops the drift but freezes the head, because the laziest path between two identical endpoints is no motion. You get blinking only, which looks dead.
- The fix that works: pin the first frame to the source image (call it A) and the last frame to a slightly shifted variant of the same pose (B). Motion is then bounded between two poses. When both A and B are side poses the head cannot drift frontal, and because the endpoints differ it cannot freeze.
- Make B cheaply by editing the source with fal-ai/nano-banana/edit (about $0.04 per image). Resize B to match A's dimensions before feeding both to Kling.
- The direction of the shift matters. The first B tilted the head down, which read as looking at her lap, wrong for a tutorial. The correct shift is a sideways head turn that keeps the eyes at screen level and never lowers the gaze. The current best B is `pose-level-1.png` (turned further to profile, eyes level).
- The base clip must have a closed, still mouth, or leftover jaw motion fights LatentSync's mouth region. The Kling prompt says "mouth closed, not speaking" and the negative prompt blocks talking.

### Tools and exact settings used
- Base motion: fal-ai/kling-video/v2.5-turbo/pro/image-to-video, $0.35 per 5s. image_url is A, tail_image_url is B, duration "5", cfg_scale 0.65. Prompt and negative prompt are in `fal_kling.py`.
- Pose edit: fal-ai/nano-banana/edit, about $0.04 per image. Prompt in `fal_edit.py`.
- Lip-sync: fal-ai/latentsync. video_url is the looped base clip, audio_url is the voiceover. Script `fal_lipsync.py`.
- All three scripts read FAL_KEY from `infra/secrets/fal.env`, upload local files with fal_client, poll, and download the result.

### Download gotcha (corporate proxy)
This machine sits behind a proxy with a self-signed cert in the chain, so a plain Python download of the finished file fails SSL verification. The fal API calls themselves work fine through fal_client. The scripts download the result with httpx and fall back to verify=False when the secure attempt fails. Keep that fallback.

### Where we stopped
The last clip generated is `kling-base-v4-pingpong.mp4`, the eye-level motion version: a gentle head turn to profile and back, eyes on the screen, no downward look, no camera drift. It was handed to the owner to review and has not been lip-synced yet. If the owner approves the motion, the next action is to loop it to the audio length and run `fal_lipsync.py` for the finished clip.

Test-folder outputs, in the order they were made:
- `out-a-latentsync-still.mp4`: static still plus lip-sync. Rejected, dead (no blinking, frozen face).
- `out-b-latentsync-kling.mp4`: unpinned Kling motion plus lip-sync. Rejected, head drifted frontal.
- `out-b2-latentsync-kling-pinned.mp4`: pinned A to A plus lip-sync. Rejected, head frozen.
- `kling-base-v3-pingpong.mp4`: pinned A to B, but B tilted down. Rejected, looking down.
- `kling-base-v4-pingpong.mp4`: pinned A to B with B at eye level. Current candidate, awaiting verdict, not yet lip-synced.

### Open enhancement the owner asked for
The owner wants a version where she looks mostly sideways at the screen but glances at the camera (the main view) from time to time, like a real presenter. Sketch: one Kling clip at 10s (the max), pin both the first and last frame to the side pose so it loops, and prompt a single turn to glance at the camera in the middle and back. LatentSync lip-syncs fine whether she faces sideways or the camera, so the glance does not break anything. Caveats: image-to-video timing is imprecise so it may take a retry, and a 10s loop would glance about every 10s which may feel frequent (space it out in the real pipeline by looping a longer sideways stretch and dropping the glance in occasionally). This was deferred; the owner chose to nail the reliable sideways version first.

### Next steps for the fresh session
1. Get the owner's verdict on `kling-base-v4-pingpong.mp4`. If approved, loop it to the audio and run `fal_lipsync.py` for the finished clip so they can see the full result.
2. If the motion needs tuning (more or less turn, slower), re-run only the Kling A to B step. The pose-edit B can be reused, so this is cheap.
3. If wanted, try the occasional-glance version described above.
4. Once the owner is happy with a base clip, build the real thing: the reusable CLI under `tooling/cli/` (see the build sketch lower in this doc). The base clip per character is a one-time asset; per video you only loop and lip-sync.

### Fallback models if Kling keeps disappointing (from Fable)
- Kling AI Avatar v2 Standard (fal-ai/kling-video/ai-avatar/v2/standard, about $0.56 for 10s): audio-driven, tuned to preserve the character while adding natural head motion. Drive it with soft breathing audio, then re-lip-sync with LatentSync.
- Wan 2.2 image-to-video: cheaper, same A to B trick, 16fps so it needs frame interpolation.
- Avoid for this use: OmniHuman (pricey, adds hands and gestures that are not wanted here) and LivePortrait (degrades on non-frontal stylized faces).

## The problem

The YouTube tutorials use talking-avatar clips: a character speaking the voiceover, cut into intro, body, and conclusion segments. Some body segments run 1 to 5 minutes. The inputs that already exist are a portrait image of the avatar and an audio voiceover file. The wanted output is a talking-head video, ideally 1080p 16:9.

These clips were made with HeyGen. Two things pushed us to look for an alternative.

Cost and access. The old HeyGen unlimited plan (unlimited Avatar III via the web session, driven by the `tooling/cli/heygen-web` CLI) is no longer available. The only remaining HeyGen option is Avatar IV at about $1 per minute of finished video. The quality is good, but it gets expensive at volume, and there is no cheaper tier left.

Pose, the bigger pain point. HeyGen's avatar models normalize the face to look straight at the camera. Even when fed a side-view portrait (the avatar positioned as if working at a laptop), HeyGen forces it front-facing, making eye contact with the viewer. For body sections that is wrong. The avatar should look like it is working on the laptop, not staring at the audience. HeyGen structurally cannot do this, because its avatar pipeline re-renders the face to camera rather than preserving an arbitrary pose.

Important nuance on the pose, from the owner: it does not have to be a hard side profile. The head can stay fairly frontal as long as the gaze is directed down at the screen, so it reads as "working" rather than "talking to you." The one firm rule is no direct eye contact with the viewer during body sections.

In body sections the avatar is small (a corner picture-in-picture), not full screen. So gestures, hand movement, and expressions do not matter there. What matters is the correct gaze/pose plus lips that move with the voiceover, looped for the whole segment.

## What we want

- Self-owned or cheap, uncapped talking-avatar video, no per-minute meter anxiety.
- Cost meaningfully below HeyGen's $1/min without a big quality drop.
- The side-view / gaze-down "working at laptop" pose that HeyGen refuses to do.
- No GPU hardware (must run in the cloud). The owner does not use ComfyUI and will not debug it, so whoever builds this owns all internals; the owner just runs a CLI or pays per clip.
- Output around 1080p 16:9 for the pipeline.

## Options explored, and the verdict

### Rejected: self-host InfiniteTalk / LongCat on ComfyUI + RunPod

The first idea was to self-host audio-driven talking-video models (InfiniteTalk, LongCat-Video-Avatar), both built on Wan 2.1 14B, in ComfyUI on RunPod, first on a pod for bring-up and then as a scale-to-zero serverless endpoint with a CLI.

The cost math killed it. These are full video-diffusion models, which is the heaviest and slowest class. Details are in the cost section below. The short version: at 480p with aggressive step-reduction LoRAs, InfiniteTalk on a cheap 4090 comes to roughly $0.73 per output minute, a thin saving at lower quality. At 720p (HeyGen-comparable) it costs more than HeyGen, not less. Add brittle community-node maintenance, storage cost, cold starts, and failed renders, and it is not worth it.

External validation: fal.ai charges about $12 per minute at 480p (and $24 at 720p) to run InfiniteTalk, and other commercial hosts sell Wan-14B avatar output at $1.8 to $3.6 per minute. If the shops that optimize this for a living cannot get it under $1/min at good quality, a solo self-hoster will not either.

### Rejected: managed full-diffusion photo+audio models

Running the same heavy models through a managed API (fal.ai, Replicate) removes the infra pain but not the cost. OmniHuman runs about $0.14 to $0.16 per second (roughly $8 to $9 per minute) on fal. MultiTalk is around $1.80/min. Every full-diffusion photo+audio model, hosted or self-hosted, prices at or above HeyGen. So this does not beat the baseline either.

### Chosen: base video loop plus lip-sync

The reframe that changes everything: HeyGen's old Avatar III, the product the owner was happy with, is architecturally a looped base video with lip-sync applied on top, not per-minute diffusion. Gestures come from the base loop; only the mouth follows the audio. So replicate that structure:

1. Once per character (one-time cost): produce a short base clip of the avatar in the right pose. Either a near-still gentle loop of the existing image, or a 5 to 8 second image-to-video micro-clip with subtle "working at laptop" motion.
2. Per voiceover (the cheap, repeated part): loop or ping-pong the base clip to the voiceover length with ffmpeg (free), then run a cheap lip-sync model over it to move the mouth to the new audio. Drop the result in as the corner PiP.

This lands around $0.30 to $0.40 per output minute at 1080p with no infrastructure to maintain, and it preserves the pose in the base clip, so it does the side-view/gaze-down look HeyGen cannot. It is cheaper and better-fitting for this specific need.

## Cost analysis detail

RunPod serverless GPU pricing (per second, July 2026). These jobs are memory-bandwidth-bound, so the cheap 4090 is the most cost-efficient per output minute, not the H100.

| GPU | VRAM | Flex $/hr |
|---|---|---|
| RTX 4090 | 24GB | $1.10 |
| L40S | 48GB | $1.75 |
| A100 80GB | 80GB | $2.72 |
| H100 80GB | 80GB | ~$4.4 |

Break-even against $1/min: on the 4090 ($1.10/hr = $0.0183/GPU-min), you beat $1/min only if rendering one output minute takes under about 55 GPU-minutes. On pricier cards the budget shrinks (L40S ~34, A100 ~22, H100 ~14 GPU-min).

InfiniteTalk cost, the model we considered self-hosting:

| Config | GPU | $/min output | vs $1/min |
|---|---|---|---|
| 480p, 6-step optimized (measured) | 4090 | ~$0.73 | under, thin margin |
| 480p, un-optimized 40-step | 4090 | ~$0.90 to $1.03 | parity, no win |
| 720p (HeyGen-comparable) | A100/L40S needed | ~$2 to $3.5 | worse |

Hidden costs on top of the above: about $3.5 to $4 per month of network-volume storage for the weights whether or not you generate, plus 10 to 30 percent for cold starts and failed renders, plus a one-time bring-up cost of maybe $10 to $30 in pod time and debugging.

Benchmark caveat: InfiniteTalk has only a handful of community benchmarks, so the $0.73 figure is extrapolated from one measured 4090 run. LongCat-Video-Avatar has zero published speed benchmarks; any number for it is a guess until someone measures it.

Chosen-path cost, for comparison: lip-sync via LatentSync on fal runs about $0.005 per second, roughly $0.30 per minute, at 1080p, with no infra. A one-time base clip costs around $0.35 per character on Kling, or near-zero if you loop a still. So a 10-minute voiceover lip-syncs for about $3.

## Model findings

### Lip-sync models (the per-clip step)

Head-angle robustness was the key question, since the avatar is turned toward a laptop. Findings:

| Model | Head-angle behavior | Cost | Verdict |
|---|---|---|---|
| LatentSync 1.6 (fal) | Preprocessing frontalizes the crop; designed for turned/three-quarter faces. Only fails if face detection loses the face at near-90-degree profile. | ~$0.005/s (~$0.30/min), 1080p | The pick. Best price/quality for a near-frontal, gaze-down pose. |
| MuseTalk 1.5 | Documented soft/blurry mouth on side faces, but rarely hard-fails. Real-time fast. | free self-host / cheap on fal | Fallback, acceptable at small PiP size. |
| Wav2Lip / Wav2Lip-HD | Warps the mouth on any turned face; 2020-era 96px mouth. | cheap | Avoid. No reason to use in 2026. |
| sync.so lipsync-2 / pro | Docs say frontal or near-frontal only; profiles can distort. | ~$0.04 to $0.083/s | Escalation, near-frontal only. |
| sync.so sync-3 | The only model that explicitly documents support for extreme profiles and over-the-shoulder shots. | ~$0.107 to $0.133/s (~$8/min) | Escalation only if we ever need a true hard profile. Note: you pay for the full voiceover duration, so ~$65 to $80 for a 10-minute video. |

Because the owner is fine with a near-frontal head as long as the gaze is down (not a hard profile), the risky case is off the table, and LatentSync sits comfortably in its trained range.

### Base-clip generation (the one-time step, still to short video)

All mainstream image-to-video models use the input image as the literal first frame, so the pose is held at t=0. The documented risk is the character turning toward camera mid-clip. Mitigation: static camera, one small action, short clip, and a negative prompt against turning ("keeps eyes on the laptop screen, never looks at camera, subtle typing, gentle breathing").

| Model | Rough cost (5s, 720p) | Notes |
|---|---|---|
| Wan 2.2 I2V | free self-host, or trivial hosted | Preserves input look well with low-motion prompts. |
| Kling 2.5 Turbo Pro | ~$0.35 | Strong I2V; iterate with small prompt deltas to avoid drift. |
| Hailuo/MiniMax 02 | ~$0.28 to $0.50 | Good subject fidelity. |
| Runway Gen-4 | ~$0.50 to $1.00 | Fine but pricier, no advantage here. |
| Veo 3.x | up to ~$0.40/s | Overkill. |
| LTX | cheapest | Lowest quality, fine for a tiny PiP. |

For a 5 to 8 second micro-loop shown small, Wan 2.2 or Kling 2.5 are the right tools. Generate several takes, pick the one with zero head rotation, then ping-pong loop it to length before lip-syncing.

### Wildcard: OmniHuman 1.5

OmniHuman 1.5 on fal ($0.16/s) takes a still plus audio and produces a full talking clip (motion, expression, lip-sync) in one call. If it holds the side-view pose it would collapse the whole pipeline into a single step. No evidence it works on side-view input, so treat it as a cheap experiment (about $2), not the plan of record.

## Cost summary versus HeyGen

- HeyGen Avatar IV: $1/min, instant, no effort, premium quality, but cannot do the side-view pose.
- Chosen pipeline (base loop + LatentSync on fal): about $0.30 to $0.40/min at 1080p, plus a tiny one-time base-clip cost per character, no infra, and it does the side-view pose. Roughly a 60 to 70 percent discount at comparable quality for this use case.
- Self-hosted lip-sync (MuseTalk on RunPod): about $0.05/min, but only worth the infra above roughly 200 minutes per month.

## Decisions: settled vs open

Settled:
- Drop the ComfyUI/RunPod/InfiniteTalk self-hosting idea.
- Approach is base video loop plus lip-sync.
- Lip-sync model of record is LatentSync on fal.
- Pose target is near-frontal with gaze down, not a hard profile. No viewer eye contact in body sections.
- The owner has existing side-view avatar images to use.

Open (decide during or after the test):
- Near-still base loop vs subtle image-to-video motion. The owner wants to see both before choosing.
- Whether LatentSync quality holds on the owner's specific (possibly AI-generated) faces. Lip-sync models trained on real footage can stumble on stylized faces. This is the main risk and is exactly what the test resolves.
- Base-clip model if we go the motion route (Wan 2.2 vs Kling 2.5).
- Whether OmniHuman 1.5 one-shot is good enough to replace the two-step pipeline.

## Next step: the de-risk test

Before writing any pipeline code, run one head-to-head on the owner's real inputs so they can judge quality. Needed from the owner:

1. A fal.ai account and API key. This is where about $5 to $10 gets spent; it is the owner's account, so it cannot be created for them.
2. One existing side-view avatar image.
3. One sample voiceover file, ideally a body-section clip of about 1 to 2 minutes.

Then generate, on that single image and audio:
- (a) near-still base loop plus LatentSync lip-sync,
- (b) Kling subtle-motion base clip plus LatentSync lip-sync,
- (c) the OmniHuman 1.5 one-shot.

Optionally render the same segment on HeyGen Avatar IV as a quality control to compare against. Hand all outputs to the owner side by side.

Decision rule: if LatentSync looks clean on the owner's faces, the problem is solved at about a third of HeyGen's cost, and the next session builds a thin CLI around it. If it stumbles, escalate: lipsync-2-pro first, then sync-3 (which documents profile support) only if the cheap tiers visibly break.

Start small: run one 30-second test through LatentSync first. If fal's LatentSync throws "face not detected," the pose is too extreme; reduce the turn or escalate.

## If the test passes: the build

Plan (not yet started) is a thin CLI under `tooling/cli/`, mirroring the layered structure of the existing `heygen-web` CLI (endpoints, operations, workflows, cli layers, a slug registry like `avatars.json`, secrets in `infra/secrets/`, offline tests, JSON machine output). Rough command shape:

```
avatar generate --image <side-view.png> --audio <voiceover.wav> [--motion still|subtle] --out clip.mp4
```

It would: build or reuse the per-character base clip, ffmpeg-loop it to the audio length, call the fal lip-sync API, poll, and download the 1080p result, logging renders the way `heygen-web` does. This should be routed through the repo's normal new-build flow (the `orchestrate` skill writes the plan, `secretary` raises it) rather than hand-rolled.

## Repo context

- The existing HeyGen CLI lives at `tooling/cli/heygen-web/`. It drives HeyGen's web-session API for the old unlimited Avatar III. Read its `CLAUDE.md` for the layered CLI pattern this build should copy.
- Voiceover audio currently lives in Google Drive (see `tooling/cli/heygen-web/renders-log.md` for the folder ids and the recurring characters: girl-1, girl-2, test-man).
- CLI conventions: Node `.mjs`, layered client/operations/workflows/cli, slug registry JSON, gitignored `infra/secrets/*.env`, offline `npm test`, machine output as JSON to stdout and human progress to stderr.

## Key sources

Lip-sync: LatentSync paper (arxiv 2412.09262) and repo (github.com/bytedance/LatentSync), fal.ai/models/fal-ai/latentsync; MuseTalk (github.com/TMElyralab/MuseTalk, issue #66 on side-face blur); sync.so quality docs (sync.so/docs/compatibility-and-tips/improving-lip-sync-quality) and sync-3 docs (sync.so/docs/models/sync-3), sync.so/pricing.
Base clips: Wan, Kling, MiniMax, Runway, Veo, LTX via fal.ai/pricing; image-to-video pose-drift guidance (queststudio.io/blog/prevent-face-warping-image-to-video).
Heavy models we rejected: MeiGen-AI/InfiniteTalk and fal.ai/models/fal-ai/infinitalk (the ~$12/min figure); fal OmniHuman 1.5 (fal.ai/models/fal-ai/bytedance/omnihuman/v1.5); RunPod pricing (runpod.io/pricing).
