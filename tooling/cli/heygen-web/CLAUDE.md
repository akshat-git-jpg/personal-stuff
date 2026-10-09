# heygen-web

This CLI has been refactored into a layered architecture to make APIs safe to update and workflows easy to compose.

## Layout

- **`src/client/endpoints.mjs`** (source of truth): Every API endpoint is defined exactly once. To change an API path or query string, edit it here.
- **`src/operations/`**: Atomic actions (e.g., `listAvatars`, `submitGenerate`). They chain a few endpoints and parse responses.
- **`src/workflows/`**: End-to-end recipes (e.g., `generate`, `photo-to-video`) that compose operations. **To add a new pipeline, add a file here.**
- **`src/cli/`**: The CLI dispatch layer.
- **`src/client/payloads/`**: The raw JSON payload files mined from HARs. Never edit these directly unless a HAR proves it; they are verified byte-for-byte.
- **`pipelines/video/heygen/registry.json`** (the avatar asset hub) + **`src/client/registry.mjs`**: the avatar/template registry — friendly slugs → HeyGen ids. This is the single source of truth for ids, shared by this CLI and the youtube pipelines.

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

`registry.json` maps a slug to an avatar and/or template id plus a description:

```json
{ "girl-1": { "template_id": "7629dffb…", "description": "Girl 1 — soft-voice tutorial template" } }
```

Any `--avatar` / `--template` flag accepts **a slug or a raw id** — `registry.mjs`'s `resolveAvatar()` / `resolveTemplate()` map a known slug to its id and pass anything else through unchanged (so raw ids still work). To add a new avatar/template, edit `pipelines/video/heygen/registry.json` — no code change. The Python pipelines read this same file (`pipelines/archive/tutorial-pipeline-1/shared/avatar_mapping.py`, archived), so ids live in exactly one place. Override the path with `HEYGEN_AVATARS`.

## Operational Gotchas

- **Render outputs never live in this folder.** Download to `~/kb-scratch/video/heygen/<pipeline>/` (media policy); `.gitignore` blocks media here. `pipelines/video/heygen/RENDERS.md` is the tracked manifest — submits auto-append a row via `src/cli/render-log.mjs`; fill in the output filename after downloading.
- **S3 PUT quirk**: The S3 presigned URL signs `host;x-amz-server-side-encryption`. Any PUT *must* send the header `x-amz-server-side-encryption: AES256` or S3 returns a 403 Forbidden.
- **Stale template fields**: `preview_image_url`/`processed_image_url` inside the payload JSON carry expiring signatures from the original HAR capture. If a render fails or looks wrong, this is the first suspect.
- **`studio-render` gap**: The `studio-render` operation fires the in-editor *preview*, not the real Generate render (that endpoint was never HAR-captured with Preserve-log on).
- **Credit check contract (owner rule 2026-10-09, any engine, every time)**: every render command (`generate`, `generate-from-audio`, `generate-from-template`, `batch`, `photo-to-video`, `avatar-test`) saves the meters, submits, **waits for the render to finish**, re-reads the meters and prints the diff. A free engine that spent anything exits 2. Meters: plan credits and add-on credits (billing page, `/v1/payment/subscription`), the seconds pool, AI-element credits. Avatar IV is refused without `--allow-spend`. `--no-meter-check` is ignored. The one hand-off is `--caller-meter`, used only by callers that hold their own before/after check around the whole batch (visuals-flow `avatar-render`, which waits for downloads before its verdict). A new caller must either let the CLI check or hold its own check the same way; never neither.
- **Meter semantics**: `usage` tracks credits (must stay flat), the second-pool (`/1200`), priority slots, and AI-image/video/concept pools. The `/1200` second-pool is the **generative / free-credit** meter (Avatar IV + AI generative), **NOT** an Avatar III cap — unlimited-mode Avatar III does not touch it (proven 2026-07-16: `credits +0 seconds +0` on a real render). Run `usage --save` before and `usage --diff` after any create op to prove it stayed free.
- **Re-login without a cURL paste**: on a 401 "session token expire", the owner logs in at app.heygen.com in Arc and the session runs `heygen-web login-from-browser --browser arc`. It decrypts Arc's cookies with the "Arc Safe Storage" Keychain key (first run shows an Allow popup; "Always Allow" makes later runs silent) and rewrites the auth file, keeping the old one as `.bak`. macOS only.
- **Template engine check**: a heygen3 `generate-from-template` renders the template AS SAVED, so it now refuses (`TEMPLATE-NOT-AVATAR-III`) unless every avatar element is `avatar_iii` with unlimited mode on. `template-engine --template <slug>` is the read-only pre-check (exit 3 = not III). visuals-flow runs it before every batch (2026-09-30).
- **Hard rule**: **Avatar III by default — it is the only free path.** Avatar IV
  (`generate-from-template --engine heygen4`, or `--iv` on the shortcut path) is
  METERED against the `/1200` monthly second-pool and is allowed ONLY when the
  owner explicitly asks for Avatar IV in the current conversation, per batch
  (first authorized 2026-08-01 for finalizing opusclip-vs-submagic). Before an
  IV batch: check `limits` covers the total seconds. After each IV submit: the
  meter check must print ⚠️NOT-free — a ✓UNLIMITED verdict on an IV submit means
  HeyGen silently fell back to Avatar III; stop and investigate. Never route
  through the official metered MCP.
- **Auth**: Parsed from `infra/secrets/heygen-web-curls.txt` (gitignored). Sessions last days, not minutes — a capture from 2026-07-09 still authenticated on 2026-07-16, 7 days later (this file previously claimed "minutes to hours", which wrongly implied a recapture before every run). One observation isn't a guarantee, so don't plan around a fixed lifetime: probe with `auth-check` (read-only, exit 0 = live) when it matters, and recapture a fresh `submit` cURL on a 403.
- **Credits, plan vs add-on**: `credits` reads the billing page's own call. `usage` (`credits=` there) shows only the plan pool and its `/1500` seconds meter is the Avatar IV pool in seconds; `credits` is the one to quote to the owner. Avatar IV costs 20 credits per minute.
- **Folders**: `move-video <ids> --folder <folder_id>`. Folder id = the id in the folder's HeyGen URL. "Test Avatar" = `f214dcf8986a4114ba69b9630e38fe00` (owner's folder for avatar tests).
- **Delete an avatar**: `delete-avatar <group_id>` removes the whole group. For a photo avatar the look id printed by `create-photo-avatar` IS the group id. There is no undo, so confirm the name with `list-avatars` first.
- **Voice change (why a browser render can sound different)**: giving a photo avatar a voice (`PUT /v1/avatar_group/voices.modify`, then `voices.set_primary`) makes the web editor re-voice any uploaded audio into that voice: `POST /v1/speech_to_speech.generate {voice_id, audio_url, settings}` returns a new `audio_url` with the same words and timing, and the audio element carries `voice_mirroring: true`. This CLI never calls it: `generate-from-audio` sends our recording unchanged, whatever the avatar's primary voice is. Owner decision 2026-10-09: keep the original voice (see `decisions.md`). To keep it in the browser too, switch voice mirroring off on the uploaded audio, or remove the avatar's primary voice. HAR: `app.heygen.com18.har`.
- **Testing**: `npm test` (i.e. `node --test`, run from this folder) is offline and safe. Live commands are ToS-grey and account-bound — run them manually, never in automation loops.
