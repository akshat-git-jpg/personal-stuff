# heygen-web

This CLI has been refactored into a layered architecture to make APIs safe to update and workflows easy to compose.

## Layout

- **`src/client/endpoints.mjs`** (source of truth): Every API endpoint is defined exactly once. To change an API path or query string, edit it here.
- **`src/operations/`**: Atomic actions (e.g., `listAvatars`, `submitGenerate`). They chain a few endpoints and parse responses.
- **`src/workflows/`**: End-to-end recipes (e.g., `generate`, `photo-to-video`) that compose operations. **To add a new pipeline, add a file here.**
- **`src/cli/`**: The CLI dispatch layer.
- **`src/client/payloads/`**: The raw JSON payload files mined from HARs. Never edit these directly unless a HAR proves it; they are verified byte-for-byte.
- **`avatars.json`** (package root) + **`src/client/registry.mjs`**: the avatar/template registry — friendly slugs → HeyGen ids. This is the single source of truth for ids, shared by this CLI and the youtube pipelines.

## Adding a new workflow

A **workflow** is an end-to-end command that composes operations (e.g. `photo-to-video` = create avatar → render). Adding one touches **three files** — plus one test line. Copy `src/workflows/photo-to-video.mjs` as the template.

1. **Write `src/workflows/<name>.mjs`** — export `async function fn(auth, args)` that:
   - parses flags with `arg(args, "--x")` (`import { arg } from "../cli/args.mjs"`);
   - composes **operations** (`import { … } from "../operations/*.mjs"`) — never call the network directly. If no operation covers the endpoint you need, add the endpoint to `src/client/endpoints.mjs` and a function in the right `src/operations/*.mjs` first, then compose it;
   - resolves any `--avatar` / `--template` value through `resolveAvatar` / `resolveTemplate` (`import … from "../client/registry.mjs"`) so slugs and raw ids both work;
   - prints machine output with `console.log(JSON.stringify(x, null, 2))`, human progress with `console.error(...)`, and fatal errors with `die(...)` (`import { die } from "../client/http.mjs"`).
2. **Wire it in `src/cli/dispatch.mjs`** — add the `import` and a `case "<name>": await fn(auth, rest); break;`.
3. **Add a help line in `src/cli/help.mjs`**, and add `"<name>"` to the command-parity set in `test/smoke.test.mjs` (test 3) — that test asserts the exact command set, so it fails until the command is registered.

**Verify (offline only):** `npm test` must stay green and `node heygen-web.mjs help` must list the new command. **Never run live HeyGen calls to test** — they are ToS-grey and account-bound (see Operational Gotchas).

## Avatar/template registry

`avatars.json` maps a slug to an avatar and/or template id plus a description:

```json
{ "girl-1": { "template_id": "7629dffb…", "description": "Girl 1 — soft-voice tutorial template" } }
```

Any `--avatar` / `--template` flag accepts **a slug or a raw id** — `registry.mjs`'s `resolveAvatar()` / `resolveTemplate()` map a known slug to its id and pass anything else through unchanged (so raw ids still work). To add a new avatar/template, edit `avatars.json` — no code change. The Python pipelines read this same file (`tutorial-pipeline-1/shared/avatar_mapping.py`), so ids live in exactly one place. Override the path with `HEYGEN_AVATARS`.

## Operational Gotchas

- **S3 PUT quirk**: The S3 presigned URL signs `host;x-amz-server-side-encryption`. Any PUT *must* send the header `x-amz-server-side-encryption: AES256` or S3 returns a 403 Forbidden.
- **Stale template fields**: `preview_image_url`/`processed_image_url` inside the payload JSON carry expiring signatures from the original HAR capture. If a render fails or looks wrong, this is the first suspect.
- **`studio-render` gap**: The `studio-render` operation fires the in-editor *preview*, not the real Generate render (that endpoint was never HAR-captured with Preserve-log on).
- **Meter semantics**: `usage` tracks credits (must stay flat), free second-pool (`/1200`, ~20 min/month cap), priority slots, and AI-image/video/concept pools. Run `usage --save` before and `usage --diff` after any create op to prove it stayed free.
- **Hard rule**: **Avatar III only**. Never use `--iv` or route through the official metered MCP.
- **Auth**: Parsed from `infra/secrets/heygen-web-curls.txt` (gitignored). Cloudflare cookies rotate in minutes to hours. On 403, recapture a fresh `submit` cURL.
- **Testing**: `npm test` (i.e. `node --test`, run from this folder) is offline and safe. Live commands are ToS-grey and account-bound — run them manually, never in automation loops.
