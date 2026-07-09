# heygen-web

This CLI has been refactored into a layered architecture to make APIs safe to update and workflows easy to compose.

## Layout

- **`src/client/endpoints.mjs`** (source of truth): Every API endpoint is defined exactly once. To change an API path or query string, edit it here.
- **`src/operations/`**: Atomic actions (e.g., `listAvatars`, `submitGenerate`). They chain a few endpoints and parse responses.
- **`src/workflows/`**: End-to-end recipes (e.g., `generate`, `photo-to-video`) that compose operations. **To add a new pipeline, add a file here.**
- **`src/cli/`**: The CLI dispatch layer.
- **`src/client/payloads/`**: The raw JSON payload files mined from HARs. Never edit these directly unless a HAR proves it; they are verified byte-for-byte.

## Operational Gotchas

- **S3 PUT quirk**: The S3 presigned URL signs `host;x-amz-server-side-encryption`. Any PUT *must* send the header `x-amz-server-side-encryption: AES256` or S3 returns a 403 Forbidden.
- **Stale template fields**: `preview_image_url`/`processed_image_url` inside the payload JSON carry expiring signatures from the original HAR capture. If a render fails or looks wrong, this is the first suspect.
- **`studio-render` gap**: The `studio-render` operation fires the in-editor *preview*, not the real Generate render (that endpoint was never HAR-captured with Preserve-log on).
- **Meter semantics**: `usage` tracks credits (must stay flat), free second-pool (`/1200`, ~20 min/month cap), priority slots, and AI-image/video/concept pools. Run `usage --save` before and `usage --diff` after any create op to prove it stayed free.
- **Hard rule**: **Avatar III only**. Never use `--iv` or route through the official metered MCP.
- **Auth**: Parsed from `infra/secrets/heygen-web-curls.txt` (gitignored). Cloudflare cookies rotate in minutes to hours. On 403, recapture a fresh `submit` cURL.
- **Testing**: `npm test` (i.e. `node --test`, run from this folder) is offline and safe. Live commands are ToS-grey and account-bound — run them manually, never in automation loops.
