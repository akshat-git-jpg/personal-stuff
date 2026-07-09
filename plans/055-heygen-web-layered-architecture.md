<!-- boss frontmatter — fill for plans that boss will run; delete this block for non-boss plans. -->
---
executor: claude-p       # claude-p | agy
model: opus              # tricky refactor: byte-identical request bodies + no live testing + 2 downstream callers
test_cmd: node --test tooling/cli/heygen-web/test/smoke.test.mjs   # REQUIRED: offline structural suite, exit 0 = merge gate (dir-arg form of --test fails on node 22.14 — name the file or run `node --test` from the folder)
ui:                      # false — pure CLI, no user-facing view
deploy:                  # blank — local CLI, callers invoke it in place
needs: []                # no dependencies on other plans
---

# Plan 055: Restructure heygen-web into a layered CLI (endpoints → operations → workflows → dispatch)

## Summary

- **Problem statement**: The whole `heygen-web` CLI is one 787-line `.mjs` file where every command hardcodes its own endpoint paths and payload handling inline. Changing a HeyGen API means hunting through the monolith and editing it in several places; adding a new end-to-end recipe means copy-pasting an existing command.
- **Goals**:
  - Extract a **single source of truth for the API surface** (`src/client/endpoints.mjs`): every endpoint defined exactly once. Change a path → edit one line.
  - Separate three layers: **client** (auth/transport/endpoints/payloads) → **operations** (atomic actions, may chain a few endpoints) → **workflows** (end-to-end recipes composing operations) → a **thin CLI dispatch**.
  - Add one new composite **workflow** (`photo-to-video`) as proof the architecture makes new pipelines trivial.
  - Preserve **100% of current behavior**: every existing subcommand, its flags, its stdout contract (callers parse JSON from stdout), and every HTTP request body **byte-for-byte identical** to today.
  - Re-home the durable operational gotchas into a new `CLAUDE.md` operate-doc.
- **Executor proposed**: `claude-p` / Claude Opus (tricky — a behavior-preserving decomposition where request bodies must stay byte-identical and two downstream Python callers must keep working, all without any live API calls to verify against).
- **Done criteria** (terse — full list below): `node --test tooling/cli/heygen-web/test/` exits 0; `node heygen-web.mjs help` lists every command that exists today plus `photo-to-video`; entry file is a thin dispatcher; endpoints registry holds all 25 endpoints; no live HeyGen call was made.
- **Stop conditions** (terse — full list below): do NOT make any live HeyGen API call (auth, generate, render, download, upload) to "verify"; do NOT touch the two pipeline callers or any file under `infra/secrets/`; if a request body cannot be reproduced byte-identically, STOP and report.
- **Test / verification for success**: an **offline** `node --test` suite — registry completeness, dispatch/command parity, payload-template fill (no leftover `__TOKEN__`, valid JSON), and `help` renders — plus a manual owner-run live smoke listed in the Test plan (owner runs it, not the executor).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat eb81356..HEAD -- tooling/cli/heygen-web/ pipelines/youtube/tutorial-pipeline-1/lib/heygen.py pipelines/youtube/tutorial-pipeline-2/lib/heygen.py`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: tricky — feeds executor/model selection; executor+model live in the frontmatter above (`claude-p` / `opus`)
- **Planned at**: commit `eb81356`, 2026-07-09

## Why this matters

The owner wants to extend this CLI over time: new workflows (photo → avatar → audio → render → download; template-based videos; batches) built by composing a stable set of API operations. HeyGen's internal web endpoints change without notice — the whole reason `API-REFERENCE.md` exists is to avoid re-mining them. Today an endpoint change ripples through the monolith because paths are hardcoded per-command. A layered structure with an endpoints registry means: an API change is a one-line edit; a new pipeline is a new small file that reuses existing operations, with zero copy-paste. Intent: **make change cheap and make the request bodies impossible to accidentally alter** — the payloads are HAR-verified byte-for-byte (see the field-by-field notes in the current code, lines 363–384), so the refactor must move them, never mutate them.

## Current state

Everything lives in one file: `tooling/cli/heygen-web/heygen-web.mjs` (787 lines, plain Node ESM, run as `node heygen-web.mjs <cmd> ...`, no build step, no deps).

Folder today:
```
tooling/cli/heygen-web/
  heygen-web.mjs          787 lines — auth + transport + 18 commands + help + dispatch
  README.md               why it exists + command reference
  API-REFERENCE.md        full endpoint catalog (human doc)
  studio-templates/       preview.json, save.json, generate-audio-save.json, generate-audio-generate.json
```

**How auth/transport works** (must be preserved exactly):
- `heygen-web.mjs:38-41` — `__dirname`; `CURLS = process.env.HEYGEN_WEB_CURLS || resolve(__dirname, "../../../infra/secrets/heygen-web-curls.txt")`; `BASE = "https://api2.heygen.com"`.
- `loadAuth()` (`:44-52`) reads the cURL file **lazily** (only when called) and parses the `-b '<cookie>'` block, `x-zid` header, and `heygen_space` cookie. **Preserve the laziness** — modules must be importable without the secret file present (the offline tests depend on this).
- `headers(auth, extra)` (`:54-69`) — fixed browser headers + cookie/zid/space.
- `api(auth, path, {method, body, xPath})` (`:76-89`) — the one transport call; dies on 403/Cloudflare with the "recapture cURL" message; throws on non-ok.
- `USAGE_SNAP = resolve(__dirname, "../../../infra/secrets/heygen-usage-last.json")` (`:621`).

**Two non-`api()` direct fetches** (keep them; they use presigned URLs / different flow):
- S3 presigned `PUT` in `createPhotoAvatar` (`:131`) and `uploadAudio` (`:333`) — both must send `x-amz-server-side-encryption: AES256` or S3 returns 403.
- `fastAsrWithRetry` (`:301-318`) posts to `${BASE}/v1/audio/fast_asr` directly (it needs 404-retry semantics).

**The 25 endpoints in use** (this is the registry to build — transcribe verbatim, do not change any path/query):

| Registry name | Method | Path (with query params) | Used by |
|---|---|---|---|
| `avatarGroupPrivateList` | GET | `/v2/avatar_group.private.list?limit={limit}&page={page}` | authCheck, listAvatars |
| `avatarLookList` | GET | `/v2/avatar_group/look.list?group_id={g}&type=all&page=1&limit=20` | listLooks, createPhotoAvatar |
| `photoTempCreate` | GET | `/v1/avatar_group/photo/temp.create?num_photos=1` | createPhotoAvatar |
| `imageAttributesSubmit` | POST | `/v1/media_evaluation/image_attributes.submit` | createPhotoAvatar |
| `photoTempConvert` | GET | `/v1/avatar_group/photo/temp.convert?parent_temporary_user_photar_id={tid}&name={name}&skip_validation=true` | createPhotoAvatar |
| `textDraftCreate` | POST | `/v1/text_draft.create` | studioRender, submitAudioGenerate, submitFromTemplate |
| `textDraftSave` | POST | `/v1/text_draft.save` | studioRender, submitAudioGenerate, submitFromTemplate |
| `textDraftGenerate` | POST | `/v1/text_draft.generate` | submitAudioGenerate, submitFromTemplate |
| `sceneAvatarPreview` | POST | `/v1/text_draft.scene_avatar_preview` | studioRender |
| `sceneAvatarPreviewCheck` | GET | `/v1/text_draft.scene_avatar_preview.check?job_id={job}&video_id={vid}` | studioRenderStatus |
| `heygenTemplateGet` | GET | `/v2/heygen_template.get?id={id}` | getTemplate |
| `voiceList` | GET | `/v1/voice.list?page={page}&limit={limit}` | listVoices |
| `projectItems` | GET | `/v1/project/items?limit={limit}&item_types={type}&sort_key=created_ts&sort_order=desc&include_children=true&is_trash=false` | listVideos |
| `projectItemsStatus` | GET | `/v1/project/items/status?item_ids={id}` | status |
| `projectItemTrash` | DELETE | `/v1/project/item.trash` | deleteVideos |
| `avatarShortcutSubmit` | POST | `/v2/avatar/shortcut/submit` | submitGenerate |
| `fileUrlGet` | GET | `/v1/file/url.get?file_type=audio&filename={base}&content_type={ct}&properties%5Baudio_source%5D=voice_recording` | uploadAudio |
| `fileUpload` | POST | `/v1/file.upload` | uploadAudio |
| `fastAsr` | POST | `/v1/audio/fast_asr` | fastAsrWithRetry (direct fetch, keep) |
| `videoGenerateLimits` | GET | `/v1/avatar/video_generate/limits` | limits, usageSnapshot |
| `monthlyPriorityCount` | GET | `/v1/video_history/monthly_priority_video_count` | usageSnapshot |
| `aiGenerateElementLimits` | GET | `/v1/file.ai_generate_element.limits` | usageSnapshot |
| `migrateToCreditCheck` | POST | `/v1/payment/migrate_to_credit_first.check` | usageSnapshot |
| `videoDownload` | POST | `/v1/pacific/collaboration/video.download` | downloadCore |
| `videoDownloadStatus` | GET | `/v1/pacific/collaboration/video.download/status?workflow_id={wf}` | downloadCore |

**18 CLI commands today** (dispatch switch, `:766-786`) — all must survive with identical flags/behavior:
`auth-check, list-avatars, list-looks, limits, usage, generate, generate-from-audio, generate-from-template, batch, create-photo-avatar, studio-render, studio-render-status, list-voices, list-videos, status, delete-video, download, raw`.

**Downstream callers (DO NOT BREAK, DO NOT EDIT):**
- `pipelines/youtube/tutorial-pipeline-1/lib/heygen.py:20` hardcodes the path `ROOT.parents[2] / "tooling/cli/heygen-web/heygen-web.mjs"` and runs `node <cli> generate-from-template --template <id> --audio <file> --title <t>` then parses **`video_id` from stdout JSON** (`:37`), and `node <cli> download <video_id> --out <dest>` (`:48`). → The entry file **must stay at `tooling/cli/heygen-web/heygen-web.mjs`**, and `generate-from-template` / `download` must keep printing the same stdout JSON (human chatter stays on stderr, as it is today).
- `pipelines/youtube/tutorial-pipeline-2/lib/heygen.py:43,57` runs `heygen-web usage --save` / `usage --diff` (bare command; degrades gracefully if the binary is absent). → `usage` flags unchanged.

**Conventions to match** (exemplar: the current `heygen-web.mjs` itself): plain Node ESM (`.mjs`), 2-space indent, `import { ... } from "node:..."`, `die(msg)` for fatal errors (prints `✖ ` to stderr, `process.exit(1)`), machine output to **stdout via `console.log(JSON.stringify(...))`**, human progress to **stderr via `console.error`**. Node 22.14 (has built-in `node:test`). No external deps, no TypeScript, no bundler.

**House rules that apply** (from `.claude/skills/personal-stuff-video-automation-campaign` + memory): Avatar III only — the `--iv` flag and `use_unlimited_mode`/`use_avatar_iv_model` defaults must stay exactly as-is; never route through the official metered MCP. This refactor changes structure only, not any of those defaults.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Node version | `node --version` | `v22.x` (has `node:test`) |
| Help renders (no auth needed) | `node tooling/cli/heygen-web/heygen-web.mjs help` | exit 0, prints command list |
| Offline test suite (merge gate) | `node --test tooling/cli/heygen-web/test/` | exit 0, all tests pass |
| Module import smoke (no secret) | `node -e "import('./tooling/cli/heygen-web/src/cli/dispatch.mjs').then(()=>console.log('ok'))"` | prints `ok` (imports must not read the secret file) |
| Drift check | `git diff --stat eb81356..HEAD -- tooling/cli/heygen-web/` | only in-scope files |

Run all from repo root `/Users/kbtg/codebase/personal-stuff`.

## Scope

**In scope** (the only files to create/modify/move):
- `tooling/cli/heygen-web/heygen-web.mjs` (becomes a thin entry)
- `tooling/cli/heygen-web/package.json` (new)
- `tooling/cli/heygen-web/src/**` (new: client/, operations/, workflows/, cli/)
- `tooling/cli/heygen-web/test/**` (new)
- `tooling/cli/heygen-web/studio-templates/` → moved to `tooling/cli/heygen-web/src/client/payloads/` (git mv, contents unchanged)
- `tooling/cli/heygen-web/CLAUDE.md` (new operate-doc)
- `tooling/cli/heygen-web/README.md` (update file map + point at new layout)
- `plans/README.md` (status row)

**Out of scope** (looks related — do NOT touch):
- `tooling/cli/heygen-web/API-REFERENCE.md` — stays at the folder root, content unchanged (many in-repo docs reference it by name).
- `pipelines/youtube/tutorial-pipeline-1/lib/heygen.py` and `tutorial-pipeline-2/lib/heygen.py` / `shared/heygen_config.py` — the callers. The refactor must keep them working **without editing them**.
- Anything under `infra/secrets/` — auth cURL + usage ledger. Never read, print, move, or commit these.
- The **contents** of the four payload JSON files — move only, never edit a byte (they are HAR-verified request bodies).
- Root `CLAUDE.md`, `tooling/cli/README.md`, `tooling/README.md` — their one-line mentions of heygen-web stay valid (path unchanged); no edit needed.

## Git workflow

- Branch: `advisor/055-heygen-web-layered-architecture` (secretary/boss owns the actual branch/commit/PR when raised — do not push).
- Commit per step (rollback granularity), conventional-commit style, no AI footers. Do NOT push.

## Steps

Order is bottom-up so the CLI keeps working after every step. After each step that changes runtime code, `node heygen-web.mjs help` must still exit 0.

### Step 1: Scaffold package + directory tree

Create `tooling/cli/heygen-web/package.json`:
```json
{
  "name": "heygen-web",
  "version": "1.0.0",
  "type": "module",
  "bin": { "heygen-web": "./heygen-web.mjs" },
  "scripts": { "test": "node --test test/" },
  "private": true
}
```
Create empty dirs (with a `.gitkeep` if needed): `src/client/`, `src/client/payloads/`, `src/operations/`, `src/workflows/`, `src/cli/`, `test/`, `test/fixtures/`.

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0 (monolith still runs, nothing wired yet).

### Step 2: Extract the client layer (transport + endpoints registry)

Create `src/client/http.mjs` — move `BASE`, `CURLS`, `USAGE_SNAP`, `loadAuth`, `headers`, `api`, `die` here. **Recompute the secret paths for the new depth**: define `const PKG_ROOT = resolve(__dirname, "../..")` (from `src/client/` → `heygen-web/`), then `CURLS = process.env.HEYGEN_WEB_CURLS || resolve(PKG_ROOT, "../../../infra/secrets/heygen-web-curls.txt")` and `USAGE_SNAP = resolve(PKG_ROOT, "../../../infra/secrets/heygen-usage-last.json")` — this preserves the exact `../../../infra/secrets/...` hop that works today from the package root. Keep `loadAuth` lazy (called, not run at import). Export `{ BASE, CURLS, USAGE_SNAP, loadAuth, headers, api, die }`.

Create `src/client/endpoints.mjs` — the **single source of truth**. Transcribe all 25 rows from the "Current state" table. Shape:
```js
// Every HeyGen endpoint, defined exactly once. Change a path here and every
// operation using it updates. `path` is a function of its params so callers
// never build query strings by hand.
export const endpoints = {
  avatarGroupPrivateList: { method: "GET",    path: ({ limit = 20, page = 1 }) => `/v2/avatar_group.private.list?limit=${limit}&page=${page}` },
  avatarLookList:         { method: "GET",    path: ({ group_id })            => `/v2/avatar_group/look.list?group_id=${group_id}&type=all&page=1&limit=20` },
  photoTempCreate:        { method: "GET",    path: ()                        => `/v1/avatar_group/photo/temp.create?num_photos=1` },
  textDraftCreate:        { method: "POST",   path: ()                        => `/v1/text_draft.create` },
  // …transcribe the remaining rows verbatim from the plan's endpoint table…
  videoDownloadStatus:    { method: "GET",    path: ({ workflow_id })         => `/v1/pacific/collaboration/video.download/status?workflow_id=${encodeURIComponent(workflow_id)}` },
};

// Thin helper so operations read as call(auth, endpoints.x, params, { body, xPath }).
export async function call(auth, ep, params = {}, opts = {}) {
  const { api } = await import("./http.mjs");
  return api(auth, ep.path(params), { method: ep.method, ...opts });
}
```
Preserve every existing `encodeURIComponent(...)` exactly where the monolith used it (e.g. `item_ids`, `job_id`, `workflow_id`, `filename`, `content_type`). The two direct-fetch cases (`fastAsr`, S3 PUT) keep their own fetch in the operations that own them — `fastAsr` may still live in the registry for reference, but `fastAsrWithRetry` keeps its bespoke 404-retry fetch.

Update `heygen-web.mjs` to `import` `loadAuth`/`api`/`die` from `src/client/http.mjs` and delete their now-duplicated definitions.

**Verify**: `node -e "import('./tooling/cli/heygen-web/src/client/http.mjs').then(()=>console.log('ok'))"` → `ok` (imports without the secret file present); and `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0.

### Step 3: Move payloads + add fill helper

`git mv tooling/cli/heygen-web/studio-templates tooling/cli/heygen-web/src/client/payloads`. Do NOT edit the JSON contents.

Create `src/client/payloads/fill.mjs`:
```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Reproduces the monolith's two fillers exactly (studioRender's `fill` and `fillAudioTemplate`):
// string-replace every token, then JSON.parse.
export function fillTemplate(name, tokens) {
  let text = readFileSync(resolve(__dirname, name), "utf8");
  for (const [k, v] of Object.entries(tokens)) text = text.replaceAll(k, String(v));
  return JSON.parse(text);
}
```
Rewire `studioRender` and `fillAudioTemplate` in the monolith to use `fillTemplate` from the new location (the `studio-templates` `resolve(__dirname, ...)` references disappear).

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0; and confirm the four JSON files are unchanged: `git diff eb81356..HEAD -- tooling/cli/heygen-web/src/client/payloads/*.json` shows **only renames, no content diff**.

### Step 4: Extract operations (atomic actions)

Create these `src/operations/*.mjs`, moving the matching functions out of the monolith **unchanged** (only swap inline `api(...)` calls to `call(auth, endpoints.X, params, opts)` and import `die` from the client). Each keeps its exact request body and stdout/stderr behavior:
- `auth.mjs` → `authCheck`
- `avatars.mjs` → `listAvatars`, `listLooks`, `createPhotoAvatar` (keep the S3 PUT + AES256 header; keep the `image_attributes.submit` try/catch + 2500ms wait)
- `voices.mjs` → `listVoices`
- `videos.mjs` → `listVideos`, `status`, `deleteVideos`, `downloadCore`, `download`
- `audio.mjs` → `uploadAudio`, `fastAsrWithRetry` (keep bespoke direct fetch + 404 retry), `RESOLUTIONS` const
- `render.mjs` → `submitGenerate`, `submitAudioGenerate`, `submitFromTemplate`, `getTemplate`, `studioRender`, `studioRenderStatus`
- `account.mjs` → `limits`, `usageSnapshot`, `printUsage`, `diffUsage`, `usage`

Import operations back into the monolith so the switch still resolves.

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0; `node -e "import('./tooling/cli/heygen-web/src/operations/render.mjs').then(()=>console.log('ok'))"` → `ok`.

### Step 5: Extract workflows (end-to-end recipes)

Create `src/workflows/*.mjs` for the user-facing verb commands that run a full job, moving the arg-parsing wrappers here and having them compose operations:
- `generate.mjs` → `generate`
- `generate-from-audio.mjs` → `generateFromAudio`
- `generate-from-template.mjs` → `generateFromTemplate`
- `studio-render.mjs` → the `studioRender`/`studioRenderStatus` command wrappers
- `batch.mjs` → `batch`

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0.

### Step 6: Thin the entry + extract CLI layer

Create `src/cli/args.mjs` (`arg(a, f)` parser), `src/cli/help.mjs` (the help text — move verbatim), and `src/cli/dispatch.mjs` (the `switch` command→handler table + `loadAuth()` gate). Preserve the exact rule: **`help` / no-command exits before `loadAuth()`** (help must not require the secret).

Reduce `heygen-web.mjs` to a thin entry:
```js
#!/usr/bin/env node
import { run } from "./src/cli/dispatch.mjs";
run(process.argv.slice(2));
```
Keep the shebang and the top-of-file doc comment block (it's the CLI's inline reference).

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` → exit 0 and output lists all 18 current commands; `node tooling/cli/heygen-web/heygen-web.mjs bogus-cmd` → exits 1 with `unknown command`.

### Step 7: Add the composite `photo-to-video` workflow

Create `src/workflows/photo-to-video.mjs` — the recipe the owner described: make an avatar from a local image, then render it over a local audio file. Compose existing operations (no new endpoints):
```js
// photo-to-video: create-photo-avatar → generate-from-audio, in one call.
// Structural proof that a new pipeline = compose operations, zero copy-paste.
import { createPhotoAvatar } from "../operations/avatars.mjs";  // returns { look_id }
import { submitAudioGenerate } from "../operations/render.mjs";
import { die } from "../client/http.mjs";
export async function photoToVideo(auth, args) { /* parse --image --audio [--name --title --orientation]; call ops in sequence; print { look_id, video_id } JSON to stdout */ }
```
Wire it into dispatch as command `photo-to-video` and add it to the help text. If `createPhotoAvatar` currently only prints (doesn't return the look_id), add a return value without changing its printed output.

**This workflow is NOT to be run live by the executor** (it spends the account / is ToS-grey). Verify structurally only.

**Verify**: `node tooling/cli/heygen-web/heygen-web.mjs help` mentions `photo-to-video`; `node tooling/cli/heygen-web/heygen-web.mjs photo-to-video` (no args) → exits 1 with a usage message (arg validation runs before any network call).

### Step 8: Offline test suite

Create `test/smoke.test.mjs` using `node:test` + `node:assert`. No network, no secret file. Tests:
1. **Imports**: dynamically import `src/cli/dispatch.mjs`, all `src/operations/*.mjs`, all `src/workflows/*.mjs`, `src/client/endpoints.mjs`, `src/client/http.mjs` — none throw.
2. **Registry completeness**: `endpoints` has all 25 named keys from this plan's table; every `.path(...)` returns a string starting with `/`.
3. **Command parity**: the dispatch command table's keys === the expected set (all 18 existing commands + `photo-to-video`). Assert exact set equality so a dropped command fails the build.
4. **Payload fill**: `fillTemplate("save.json", { __VIDEO_ID__: "v", __AVATAR_ID__: "a" })` returns an object and its serialized form contains no `__` token; same for `preview.json`, and for the audio templates with a full token set (copy the token keys from `submitAudioGenerate`). Put a minimal token fixture in `test/fixtures/` if helpful.
5. **Help without auth**: spawn `node heygen-web.mjs help` with `HEYGEN_WEB_CURLS=/nonexistent` in env → exit 0, stdout contains `generate-from-template` and `photo-to-video`. (Proves help doesn't touch auth.)

**Verify**: `node --test tooling/cli/heygen-web/test/` → exit 0, all tests pass.

### Step 9: Docs — new CLAUDE.md, update README

Create `tooling/cli/heygen-web/CLAUDE.md` (operate-doc) capturing the layered layout + the durable gotchas re-homed from the deleted HANDOVER files:
- **Layout**: endpoints (source of truth) → operations → workflows → cli; "to change an API, edit `src/client/endpoints.mjs`; to add a pipeline, add a file under `src/workflows/`."
- **S3 PUT quirk**: presigned URL signs `host;x-amz-server-side-encryption`; the PUT must send `x-amz-server-side-encryption: AES256` or S3 returns 403.
- **Stale template fields**: `preview_image_url`/`processed_image_url` inside the payload JSON carry expiring signatures from the original HAR capture — first suspect if a render fails or looks wrong.
- **`studio-render` gap**: fires the in-editor *preview*, not the real Generate render (that endpoint was never HAR-captured with Preserve-log on).
- **Meter semantics**: `usage` tracks credits (must stay flat) / free second-pool (`/1200`, ~20 min/month cap) / priority slots / ai-image·video·concept pools; run `usage --save` before and `usage --diff` after any create op to prove it stayed free.
- **Hard rule**: Avatar III only — never `--iv`, never the official metered MCP.
- **Auth**: parsed from `infra/secrets/heygen-web-curls.txt` (gitignored); Cloudflare cookies rotate in minutes–hours; on 403 recapture a fresh `submit` cURL.
- **Testing**: `node --test test/` is offline and safe; live commands are ToS-grey and account-bound — run them manually, never in automation loops.

Update `README.md`'s file-map section to describe the `src/` layout (replace any `studio-templates/` / `HANDOVER.md` references). Run `humanizer` on the README/CLAUDE.md prose before finalizing (human-facing docs).

**Verify**: both files exist and are non-empty; `grep -q "src/client/endpoints.mjs" tooling/cli/heygen-web/CLAUDE.md` → exit 0; `grep -rq "studio-templates" tooling/cli/heygen-web/README.md` → exit 1 (no stale reference).

### Step 10: Update the plans index

Set this plan's row to `DONE` in `plans/README.md` (add the row first if absent).

**Verify**: `grep -q "055" plans/README.md` → exit 0.

## Test plan

- **Automated (merge gate, offline)**: `node --test tooling/cli/heygen-web/test/` — the Step 8 suite. This is the `test_cmd` boss re-runs.
- **Backward-compat (structural, offline)**: assert the entry path is unchanged (`test -f tooling/cli/heygen-web/heygen-web.mjs`) and the two caller-invoked commands still route — covered by the command-parity test (`generate-from-template`, `download`, `usage` all present) and the help test. The Python callers are not edited and not run here.
- **Manual live smoke (OWNER runs, not the executor — requires a valid session cookie and spends nothing on Avatar III but is ToS-grey)**: after merge the owner may run, in order: `heygen-web auth-check`; `heygen-web usage --save`; `heygen-web list-voices --limit 3`; and one `generate-from-template`/`download` round on a throwaway title; then `heygen-web usage --diff` to confirm no meter moved. Document this in the PR as owner-verified, not CI-verified.

## Done criteria

- [ ] `node --test tooling/cli/heygen-web/test/` exits 0 (all Step 8 tests pass).
- [ ] `node tooling/cli/heygen-web/heygen-web.mjs help` exits 0 and lists all 18 existing commands **plus** `photo-to-video`.
- [ ] `heygen-web.mjs` is a thin entry (≤ ~10 lines of runtime code beyond the doc comment) that delegates to `src/cli/dispatch.mjs`.
- [ ] `src/client/endpoints.mjs` exports an `endpoints` object with all 25 named keys from this plan's table.
- [ ] The four payload JSON files moved to `src/client/payloads/` with **zero content change** (`git diff` shows renames only).
- [ ] Modules import without the secret file present (the import smoke command prints `ok`).
- [ ] `tooling/cli/heygen-web/CLAUDE.md` exists and documents the layout + re-homed gotchas.
- [ ] The two pipeline caller files are unmodified (`git diff --stat eb81356..HEAD` lists neither).
- [ ] No live HeyGen API call was made during execution.

## STOP conditions

- **Any live HeyGen API call.** Do not run `auth-check`, `generate*`, `studio-render`, `download`, `create-photo-avatar`, `usage`, `list-*`, or `photo-to-video` against the network to "verify." Verification is offline only. If you believe a live call is required, STOP and report.
- **A request body cannot be reproduced byte-identically** after moving code (e.g. token substitution, header set, or JSON shape differs from the monolith). STOP and report — these bodies are HAR-verified and a silent change breaks renders.
- **A payload JSON needs editing** to make something work. It must not. STOP and report.
- **A caller or a secrets file would need to change.** Both are out of scope. STOP and report.
- **Command/flag parity would break** (a command or flag can't be preserved). STOP and report rather than dropping it.

## Maintenance notes

- The endpoints registry is the seam future changes flow through: an API path change is a one-line edit in `src/client/endpoints.mjs`; a new pipeline is a new file in `src/workflows/` composing existing operations.
- A reviewer should scrutinize: (1) that the 25 endpoint paths + query params are byte-identical to the monolith (diff against commit `eb81356`); (2) that every `encodeURIComponent` survived; (3) that the payload JSONs are pure renames; (4) that `help` still bypasses `loadAuth`; (5) that `generate-from-template` and `download` still emit the same stdout JSON the Python callers parse.
- If HeyGen ships a new endpoint, add it to the registry (one row) and the operation that needs it — not inline in a workflow.
- `photo-to-video` is structurally verified only; its first live run is owner-driven.
