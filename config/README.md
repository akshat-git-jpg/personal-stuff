# config/ — cross-surface configuration

One folder for settings that more than one surface must agree on. Nothing here is a

secret; secrets live in `infra/secrets/` and Worker secrets.

## channels.json — the channel registry

The single source of truth for "what YouTube channels exist". Read by the redirector
route gate, the tracker Worker, the analytics Worker and the Python pipelines
(`pipelines/common/channels.py`).

It is a committed file rather than a D1 table because the Python pipelines cannot read
D1 at all, and a per-app copy would drift. Workers bundle it directly — verified: a
relative JSON import from outside the app folder resolves in `wrangler deploy`.

### Adding a channel

1. Create the Google account that will OWN the channel, and give it a
   YouTube-scope-only token via `tooling/mcp/google-shared`. Studio manager/editor
   permissions do NOT grant Data API write access — only the owning account can write.
2. Add the short domain to Cloudflare (the zone must already exist).
3. Add the entry to `channels.json`.
4. Add the matching `[[routes]]` block to `apps/redirector/wrangler.toml` and deploy
   the redirector. `apps/redirector/test/routes.test.ts` FAILS until you do.
5. Add the channel's profile assets — a brand file, an avatar in `heygen/registry.json`,
   a taste file, and (once consumed) a voice — then fill in the channel's `profile`
   block. See **Profiles** below; `node --test config/profiles.test.mjs` fails until
   every pointer resolves.

### Fields

| Field | Meaning |
|---|---|
| `id` | kebab-case key used by every database and API. Never reused, never renamed. |
| `youtube_channel_id` | `UC…` id. The uploads playlist is `"UU" + id.slice(2)`. |
| `owner_account` | The Google account that owns the channel. Only it can write via the API. |
| `link_domain` | Bare hostname for short links. Must sit inside `zone_name`. |
| `archived` | `true` hides the channel from pickers; its data and routes stay. |
| `profile` | Creative defaults (voice, avatar, brand, taste file). See **Profiles** below. |

Validation lives in `channels.mjs`. Error strings start with a stable machine code
(`CHANNEL_DOMAIN_DUPLICATE`, …) that gates assert on — never reword one.

## Profiles — a channel's creative defaults

Each channel's `profile` block points at the assets that give it its own voice and
look, so several channels don't converge into one sound. Validated in `profiles.mjs`
(`node --test config/profiles.test.mjs`), consumed from JS via `profileFor()` and from
Python via `pipelines/common/channels.py`'s `profile_for()`.

| Field | Points at | Catalogue | Gate code when it dangles |
|---|---|---|---|
| `voice_slug` | a reference voice | `pipelines/video/tts/REFERENCES.md` (Markdown table, first column) | `PROFILE_VOICE_UNKNOWN` |
| `avatar_slug` | a HeyGen character | `pipelines/video/heygen/registry.json` (top-level keys) | `PROFILE_AVATAR_UNKNOWN` |
| `brand` | a visuals-flow brand file | `pipelines/video/visuals-flow/brand.json` (name `"default"`) or `brands/<name>.json` | `PROFILE_BRAND_UNRESOLVED` |
| `taste_file` | the script-writing taste doc | any real repo path, e.g. `pipelines/youtube/yt-script/TASTE.md` | `PROFILE_TASTE_FILE_MISSING` |
| `style_dna` | a yt-style-copy DNA doc, or `null` | any real repo path when set | `PROFILE_STYLE_DNA_MISSING` |

A missing block, or a missing `voice_slug`/`avatar_slug`/`brand`/`taste_file`, fails as
`PROFILE_MISSING` / `PROFILE_VOICE_MISSING` / `PROFILE_AVATAR_MISSING` /
`PROFILE_BRAND_MISSING` / `PROFILE_TASTE_MISSING`.

**`voice_slug` is validated but not yet consumed.** The reference voice IndexTTS-2
clones from is uploaded once into a Modal volume (`pipelines/video/tts/modal/indextts2_app.py`),
not chosen per request — wiring per-channel voice means changing that Modal app to
accept a reference per call. That is its own plan (see `decisions.md` 2026-08-30);
plan 264 only builds and gates the pointer.

`pipelines/video-registry` records which channel each video belongs to
(`"channel"` on a `videos.json` entry, default when absent), and `visuals-flow`'s
`loadBrand()` resolves a video's brand through its channel's `profile.brand` — see
`pipelines/video/visuals-flow/PIPELINE.md`.
