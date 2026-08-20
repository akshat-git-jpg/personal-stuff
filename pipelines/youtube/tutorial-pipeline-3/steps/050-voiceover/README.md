# Step 050: Publish UI

Publishes the script to the freelancer UI and later pulls the locked state back.

## Env Vars
Requires the following in `pipelines/.env`:
- `VO_UI_URL`
- `VO_UI_ADMIN_TOKEN`

## Run Order

1. Set stage to tts: `node lib/set-stage.mjs <slug> tts`
2. Publish: `bash run.sh <slug> publish [--drive-url URL]`
3. Send the printed link to the freelancer.
4. Later, pull state: `bash run.sh <slug> pull`
