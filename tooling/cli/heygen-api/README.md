# heygen-api

Drives HeyGen's **official public API** (`api.heygen.com`) with an API key.

## Which HeyGen CLI do I want?

| | `heygen-web` (sibling) | **`heygen-api`** (this) |
|---|---|---|
| Host | `api2.heygen.com` (web app internal) | `api.heygen.com` (public) |
| Auth | captured session cookie | API key |
| Avatar III | **free / unlimited** | **metered** (~3 credits/min) |
| Ban risk | ToS-grey, account-bound | sanctioned |
| Setup | capture a cURL from DevTools | paste a key in a file |

**`heygen-web` stays the default for the pipelines** — it is the free path.
This CLI exists for machines with no captured session, and for when the
sanctioned route is worth the credits. Nothing here is free: every `generate`
and `render` bills.

## Auth

Either export `HEYGEN_API_KEY`, or write it to `infra/secrets/heygen-api.env`
(gitignored via `**/secrets/*`):

```
HEYGEN_API_KEY=hg_your_key_here
```

Override the file location with `HEYGEN_API_KEY_FILE`.

## Commands

```bash
node heygen-api.mjs auth-check
node heygen-api.mjs list-templates [--json]
node heygen-api.mjs get-template <template_id>      # dump the template's variable slots
node heygen-api.mjs upload <file>                   # -> asset_id
node heygen-api.mjs generate --template <id> --audio <file> [--audio-var <name>] [--title T]
node heygen-api.mjs status <video_id>
node heygen-api.mjs download <video_id> <dest.mp4>
node heygen-api.mjs render --template <id> --audio <file> --out <dest.mp4> [--poll-secs 15]
```

`render` is the whole chain: upload audio → generate → poll → download.

## Endpoint contract

Verified against `developers.heygen.com` on 2026-08-16:

| Purpose | Call |
|---|---|
| Upload asset | `POST /v3/assets` — multipart `file`, ≤32 MB → `data.asset_id` |
| List templates | `GET /v3/templates` |
| Get template | `GET /v3/templates/{id}` → `data.variables` |
| Generate | `POST /v3/templates/{id}` — `{ variables, title, caption }` |
| Status | `GET /v1/video_status.get?video_id=` → `data.status`, `data.video_url` |

The legacy `/v2/template/{id}/generate` path still answers but HeyGen has it
marked for deprecation with the old AI Studio. Build on v3.

An audio slot is filled with:

```json
{ "type": "audio", "asset": { "type": "asset_id", "asset_id": "asset_..." } }
```

## Gotchas

- **`get-template` before you spend.** A template only accepts a pre-recorded
  voiceover if it exposes an `audio` variable. `pickAudioVar` refuses to guess
  when there are zero or several — guessing burns credits on a silent render.
- **Studio template ids are not guaranteed to be API-visible.** The ids in
  `pipelines/video/heygen/registry.json` were captured from the *web app*. Run
  `list-templates` and confirm the id appears before wiring it into a batch.
- **Failures can arrive as HTTP 200.** HeyGen sometimes returns `{error:…}` or a
  non-100 `code` with a 200; `unwrap()` treats all three as fatal.
- **Renders never live in this repo.** Download to `~/kb-scratch/video/heygen/…`
  per the media policy.

## Test

```bash
node --test test/*.test.mjs
```

Offline only — tests must never make a live call, because live calls bill.
(Note: `node --test test/` with a bare directory misreports on this Windows
box; pass the glob.)
