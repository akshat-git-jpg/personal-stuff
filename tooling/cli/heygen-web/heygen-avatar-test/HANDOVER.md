# heygen avatar test

A record of testing the photo-avatar → preview-video flow on the HeyGen web
session, using the `heygen-web.mjs` CLI one folder up. This is the working
log + how to repeat it, not a spec.

The whole thing runs on Avatar III (the unlimited tier tied to the paid web
subscription), never Avatar IV. Keep it that way unless there's a specific
reason not to.

## What we tested

Two stages, both against `api2.heygen.com` (the web app's own internal API,
not the public `api.heygen.com`):

1. Turn a local image from `~/Downloads` into a photo avatar and get its
   `look_id`.
2. Run a preview render of that avatar lip-syncing a voiceover that's already
   baked into the studio template. No TTS, no script — the audio is fixed.

Both worked. The avatar came back valid and the preview render was accepted
and started processing server-side.

## The run (2026-07-01)

### Stage 1 — create the avatar

```bash
cd /Users/kbtg/codebase/personal-stuff/tooling/cli/heygen-web
node heygen-web.mjs create-photo-avatar \
  "/Users/kbtg/Downloads/Woman Smiling in White Shirt Avatar.jpeg" \
  --name "Woman Smiling White Shirt"
```

What it did under the hood: `temp.create` to get a presigned S3 URL, a raw
`PUT` of the image bytes to that URL, `temp.convert` to turn the upload into
an avatar group, then `look.list` to read back the look.

Result:

```
name:    Woman Smiling White Shirt
group_id / look_id: 02487e852056468f9eb17a6d73eb7318
is_valid: true
```

The `look_id` is the `avatar_id` you pass everywhere downstream.

### Stage 2 — preview render over the configured audio

```bash
node heygen-web.mjs studio-render \
  --avatar 02487e852056468f9eb17a6d73eb7318 \
  --title "Woman White Shirt — preview test"
```

This fills the templates in `../studio-templates/` (`save.json`,
`preview.json`), swapping in the avatar id, then calls `text_draft.create`,
`text_draft.save`, and `text_draft.scene_avatar_preview`. The templates are
pinned to `engine: "avatar_iii"` with `use_unlimited_mode: true`, so the
render bills as unlimited subscription usage.

The configured audio is `FULLTEST_indextts2_jamila_SYNCED_voiceover_1min.mp3`
(about 60 seconds, the Jamila brand voice from the AI-tools comparison video).
It lives on `resource2.heygen.ai` and is referenced by URL inside `save.json`.
That's the "audio file is already configured" part — the avatar lip-syncs that
clip as-is.

Result:

```
video_id: 205c41a5b277483cb269d0c38d86ddd9
job_id:   205c41a5b277483cb269d0c38d86ddd9-mvCsnrn0-14157dff-c8e1-43b0-a78e-a4af92060200
title:    Woman White Shirt — preview test
```

## No polling

The CLI fires the render and stops. It does not loop on the status endpoint,
and neither should you — repeated automated polls against the web API look
like a bot and put the paid account at risk. Check the result by hand:

- Web app: https://app.heygen.com/projects → open "Woman White Shirt — preview test".
- One-shot status check from the terminal (a single call, no loop):

  ```bash
  node heygen-web.mjs studio-render-status \
    205c41a5b277483cb269d0c38d86ddd9 \
    "205c41a5b277483cb269d0c38d86ddd9-mvCsnrn0-14157dff-c8e1-43b0-a78e-a4af92060200"
  ```

  When it's done this prints a `video_url`; while it's still rendering it just
  says so. Run it again later if you want, but don't wrap it in a watch loop.

## Auth

The CLI reads the cookie block and `x-zid` header straight out of
`../../../infra/secrets/heygen-web-curls.txt` (a captured cURL). The
Cloudflare cookies in there (`cf_clearance`, `__cf_bm`) rotate within
minutes to hours. When calls start coming back 403, open the HeyGen web app,
generate or submit one thing, copy that request as cURL, and paste it over the
file. Only the `-b '...'` cookie and the `x-zid:` line matter.

`node heygen-web.mjs auth-check` confirms the session is live before you spend
time on anything else.

## Repeat it with a different image

```bash
# 1. point at any image in Downloads (or anywhere)
node heygen-web.mjs create-photo-avatar "/path/to/photo.jpg" --name "Some Name"
#    → copy the look_id from the output

# 2. preview it over the configured audio
node heygen-web.mjs studio-render --avatar <look_id> --title "whatever"

# 3. check the web app, or one status call (see "No polling")
```

To make it speak something *other* than the baked-in clip, that's the
`generate` command instead (`--voice` + `--text`, TTS), or swap the audio URL
inside `studio-templates/save.json`. Out of scope for this test — we only
exercised the configured-audio path here.

## Gotchas worth knowing

- The studio templates carry a few values captured from the original avatar,
  including `preview_image_url` / `processed_image_url` that point at a
  specific image hash with an expiring signature. The render drives off the
  `avatar_id` we substitute, so the preview worked, but if a future render
  comes out wrong or fails, suspect those stale template fields first.
- "Unlimited" Avatar III is capped at roughly 20 minutes a month
  (`total_limit: 1200` seconds on the `limits` endpoint). Run
  `node heygen-web.mjs limits` to see what's left.
- This path uses the web session rather than the API key, which is grey under
  HeyGen's terms. It's account-bound and the internal endpoints can change
  without warning. Own paid account, own content only.

## Files

- `../heygen-web.mjs` — the CLI doing all of the above.
- `../studio-templates/{save,preview}.json` — the scene + configured audio.
- `../README.md`, `../HANDOVER.md` — the tool's own docs.
- `../../../infra/secrets/heygen-web-curls.txt` — the session auth (gitignored).
