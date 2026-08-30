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
5. Add the channel's profile assets ☔ see `plans/264`.

### Fields

| Field | Meaning |
|---|---|
| `id` | kebab-case key used by every database and API. Never reused, never renamed. |
| `youtube_channel_id` | `UC…` id. The uploads playlist is `"UU" + id.slice(2)`. |
| `owner_account` | The Google account that owns the channel. Only it can write via the API. |
| `link_domain` | Bare hostname for short links. Must sit inside `zone_name`. |
| `archived` | `true` hides the channel from pickers; its data and routes stay. |
| `profile` | Creative defaults (voice, avatar, brand, taste file). Consumed by plan 264. |

Validation lives in `channels.mjs`. Error strings start with a stable machine code
(`CHANNEL_DOMAIN_DUPLICATE`, …) that gates assert on — never reword one.
