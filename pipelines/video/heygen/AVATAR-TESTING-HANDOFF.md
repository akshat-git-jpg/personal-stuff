# Avatar testing: session handoff

Written 2026-07-16. Pick this up in a fresh session to keep testing avatar looks and find the one you want.

## What you're doing

Rendering a short test clip for each candidate avatar look id, driven by a fixed reference voice, on unlimited Avatar III. You store the HeyGen link (no download), open it to judge the avatar, and mark Yes/No in a local viewer.

## Fast path to continue

From `tooling/cli/heygen-web`:

```bash
node heygen-web.mjs generate-from-audio \
  --avatar <LOOK_ID> \
  --audio ~/kb-scratch/video/heygen/_test/test-man/intro.mp3 \
  --engine heygen3 --orientation landscape \
  --title "<Name>-<LOOK_ID>"
```

- It auto-prints `✓ UNLIMITED confirmed` (proves the render is free) and auto-appends the HeyGen link to `RENDERS.md`.
- Wait 1 to 2 min, then open the link. Nothing gets downloaded.
- Review and flag in the renders viewer (see Tools).

To render several at once, loop the command over your look ids:

```bash
AUDIO=~/kb-scratch/video/heygen/_test/test-man/intro.mp3
for LOOK in <id1> <id2> <id3>; do
  node heygen-web.mjs generate-from-audio --avatar "$LOOK" --audio "$AUDIO" \
    --engine heygen3 --orientation landscape --title "<Name>-$LOOK"
done
```

## Five things that will save you time

1. **Avatar III is unlimited on your Creator plan.** Every render shows `credits +0, seconds +0`. The CLI's `limits` command reports a 1200s (~20 min) pool, but that is the generative / Avatar-IV meter, not an Avatar III cap. Ignore it. Every `generate` auto-runs a usage diff and prints `✓ UNLIMITED` or `⚠️ NOT free`.

2. **Links use a double dash.** The share URL is `https://app.heygen.com/videos/<title-slug>--<video_id>`. A single dash gives a 404 ("This video doesn't exist"). The CLI builds this for you (`heygenLink()` in `src/cli/render-log.mjs`); you never hand-build it.

3. **A successful submit does not mean a successful render.** `generate-from-audio` returns a `video_id` even when the render later fails. Confirm with:
   ```bash
   node heygen-web.mjs list-videos --limit 20 --json
   ```
   and check `status: completed` (not `failed`).

4. **`generate-from-audio` only drives Talking Photos (`photo_avatar`).** An `instant_avatar` look fails with `photar_not_found`, sometimes at submit, sometimes at render. When a look fails, it's almost always this: the avatar is the wrong type, not a bad id. See "Known gap" below.

5. **Set `--title` up front.** The title becomes the link slug and the HeyGen project name. You can rename a render in the viewer, but that only changes the local label. To change the real HeyGen title or link you have to re-render.

## The reference voices (already on disk)

| Voice | Length | Path |
|---|---|---|
| test-man intro (male) | ~118s | `/Users/kbtg/kb-scratch/video/heygen/_test/test-man/intro.mp3` |
| girl-1 intro | ~87s | `/Users/kbtg/kb-scratch/video/heygen/_test/girl-1/intro.mp3` |
| girl-2 intro | ~107s | `/Users/kbtg/kb-scratch/video/heygen/_test/girl-2/intro.mp3` |

Most avatar tests this session used the test-man voice.

## Tools (all local, start from the dashboard)

Start the dashboard once: `node tooling/cli/local-apps-dashboard/dashboard.mjs`, then open http://localhost:4321. Start and Open each app from there.

- **heygen renders** at http://localhost:4361 is the review board for these tests. Every render in `RENDERS.md` shows as a clickable row. Per render you can click the name to open it on HeyGen, flag it Yes or No, and rename the local label (click the name and type). Your flags and names persist to `renders-viewer/selections.json`, which is git-tracked.
- **media board** at http://localhost:4100 shows all generated media. The HeyGen renders appear as link-cards under "renders · on HeyGen", alongside the on-disk audio. Search is separator-insensitive, so "girl 1" finds "girl-1".
- **heygen-web CLI** in `tooling/cli/heygen-web`. Read its `CLAUDE.md` first. Avatar III only. Never pass `--iv` (that's metered Avatar IV).

## Where things live

- `pipelines/video/heygen/registry.json`: friendly slug to avatar/template id.
- `pipelines/video/heygen/RENDERS.md`: the manifest. Every render auto-logs a link row here.
- `pipelines/video/heygen/renders-viewer/`: the review board (`serve.mjs`) plus your `selections.json`.
- `pipelines/video/heygen/characters/`: reference source images per character.

## Auth and quota notes

- Auth comes from `infra/secrets/heygen-web-curls.txt` (gitignored). Cloudflare cookies rotate in minutes to hours. On a 403, recapture one fresh `submit` cURL into that file.
- The free pool showing "~14 min left" is irrelevant to Avatar III (see point 1).

## Known gap: instant avatars fail

Avatar `f64bdab33dcf4136b32d66da2a74ed28` renders fine in the HeyGen web UI but fails `photar_not_found` here. Root cause, confirmed from a web-UI HAR: it's an `instant_avatar` (avatar group `80a93446fd274f83b6ac72e5fcc6b10c`), not a Talking Photo. Our `generate-from-audio` payload hardcodes `avatar_type: "photo_avatar"`, so HeyGen looks it up in the Talking-Photo table and 404s.

To support instant avatars, add a second payload path keyed on avatar type. The web UI sends `content: { avatar_id, avatar_state_id (both = look id), render_type: "normal", avatar_type: "instant_avatar" }`. Doing it properly needs the full instant_avatar `text_draft.save` and `text_draft.generate` bodies captured byte-for-byte from a clean HAR (the one in `~/Downloads` was truncated). Details are in `decisions.md` under the 2026-07-16 entries.

Workaround for now: test Talking-Photo avatars through this CLI, and render instant avatars in the web UI. To turn a look into a Talking Photo you own, create it in the web UI, then use its look id here.

## Full detail

The `decisions.md` entries dated 2026-07-16 record the reasoning behind everything above: the unlimited proof, the link format, the photar-vs-instant-avatar gap, and the media-board fix. `RENDERS.md` has every render made, with its link and the known-fail notes.
