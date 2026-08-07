# 102 · propose the avatar and model · [OWNER]

The avatar spend gate. Nothing reaches HeyGen — no submit, no auth-check —
until this gate is approved. See `lib/avatar-plan.mjs`'s
`requireAvatarPlanApproved()`, called first thing inside
`lib/avatar-render.mjs`'s `--submit` path, before any network call.

- **In:** `shots.resolved.json` (the real clip count and seconds) + the
  character registry (`pipelines/video/heygen/registry.json`)
- **Out:** `videos/<slug>/avatar-plan.json`
- **Next:** `run.sh <slug> avatar --submit ...` (step 100)

```bash
bash run.sh <slug> avatar-plan   # compute candidates + clip/second totals
```

Then pick a character and model on the board's Avatar tab. Approving writes
`character`, `model` and `approved: true` together — a POST missing either
field is refused.

## Why this replaced the kickoff `engine` flag

`run-config.json`'s `engine` (step 005) used to BE the owner's authorization
for metered HeyGen spend, set before `shots.json` existed — against a clip
count nobody had computed. This gate asks the same question against
`shots.resolved.json`'s real numbers instead, and it is a hard stop rather
than a flag that could be forgotten or left at its default.

## Degraded state

Before `shots.resolved.json` exists, the Avatar tab says so and every button
is disabled with a `title` explaining why — run `run.sh <slug>
storyboard-check` first.
