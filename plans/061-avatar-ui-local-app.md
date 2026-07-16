---
executor: agy
model:
test_cmd: node --test pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs
ui: true
deploy:
needs: []
---

# Plan 061: Avatar Renderer — local UI for tutorial-pipeline-1

## Summary

- **Problem statement**: `tutorial-pipeline-1` turns a Drive folder of 3 recorded segments into 3 HeyGen avatar clips, but it is five Python scripts run by hand from a terminal. A non-technical family member needs to run it herself, and cannot use a CLI.
- **Goals**:
  - A zero-dependency localhost UI (`ui/serve.mjs`) that runs steps 010→050 as one job with live progress.
  - Registered in `local-apps-dashboard` so she runs the dashboard and starts this from there — never a terminal.
  - Fix the latent wrong-video bug that makes a second run silently upload the first run's renders.
  - Never re-submit a render to HeyGen when one was already submitted for the same video (duplicate renders are the expensive, ToS-grey call).
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner's explicit choice (2026-07-16), overriding the `standard` default of claude-p/sonnet in `tooling/boss/data/rules.md`. Consistent with `plans/runs/LESSONS.md`: fully-inlined single-plan builds are agy's sweet spot (cf. 054-timeblock, clean in one turn).
- **Done criteria** (terse — full list below): `node --test …/ui/test/ui.test.mjs` exits 0; `node -e` import of `serve.mjs` exposes the 3 pure fns; `apps.json` parses and contains the `avatar-ui` entry on a unique port; step 040's buffer is 300.
- **Stop conditions** (terse — full list below): do not add HeyGen polling; do not weaken step 030's pacing; do not run any live HeyGen render to "test"; do not touch the 5 step run.py files except 040's buffer constant.
- **Test / verification for success**: unit tests over the 3 pure functions (`node:test`, mirroring `media-board`'s test), plus a manual smoke of the dashboard entry. The end-to-end render path is NOT automatable — it costs a real HeyGen render — and is explicitly owner-verified only.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f048900..HEAD -- pipelines/youtube/tutorial-pipeline-1/ tooling/cli/local-apps-dashboard/apps.json`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the job runner mutates shared step-output dirs and shells out to a ToS-grey CLI; the correctness logic in Step 2 is what keeps a second run from uploading the wrong video.
- **Depends on**: none (plan 043 shipped the pipeline this wraps; it is live and verified)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `f048900`, 2026-07-16

## Why this matters

The owner's sister will produce the tutorial videos. The pipeline she needs already exists and was verified end-to-end on 2026-07-09 — the only thing missing is a way to run it that isn't a terminal. This plan adds *only* a UI wrapper: the pipeline's logic, its anti-ban posture, and its Drive contract are all unchanged, and the five step scripts stay the single source of truth for what the pipeline does.

Two things make this more than a form. First, the pipeline's step scripts were written for one careful human running one video at a time, so they share un-namespaced scratch directories — safe by hand, actively dangerous behind a button someone presses twice. Second, HeyGen submits are the one irreversible, account-bound, ToS-grey action in the flow, so the runner must be structurally incapable of re-submitting a render it already submitted. Both are handled in Step 2 and neither is optional.

The intent to preserve above all: **when in doubt, do less to HeyGen.** Every wait is deliberate. Every skipped poll is deliberate. If a detail here looks inefficient, it is load-bearing.

## Current state

### The pipeline being wrapped

`pipelines/youtube/tutorial-pipeline-1/` — Drive folder in, 3 avatar clips back into that folder's `output/`. Documented in `PIPELINE.md`. Five steps, run in order, each reading the previous step's `output/`:

| Step | Command (cwd = the step's own dir) | Reads → Writes |
|---|---|---|
| 010 | `python3 run.py --drive-link "<link>" [--account EMAIL]` | Drive folder → `output/{intro,body,conclusion}.mp4` + `output/<title>.input-manifest.json` |
| 020 | `python3 run.py "<title>"` | 010's manifest → `output/{seg}.wav` + `output/<title>.audio-manifest.json` |
| 030 | `python3 run.py "<title>"` | 020's manifest → HeyGen submit ×3 → `output/<title>.heygen-manifest.json` |
| 040 | `python3 run.py "<title>" [--buffer SECONDS]` | 030's manifest → timed wait → `output/videos/{seg}.mp4` |
| 050 | `python3 run.py "<title>" [--account EMAIL]` | 040's videos → `output/spokesperson_{seg}.mp4` + upload to Drive `output/` |

**Every step 020–050 already accepts an explicit `<title>` positional argument.** The runner must always pass it. Do not rely on their title-inference fallback (they glob `../<prev>/output/*.manifest.json` and take the first sorted match, which is wrong across runs).

### The trap this plan must fix (read carefully — this is the whole risk)

The step scripts write scratch files that are **not namespaced by title**:

- 020 → `output/<seg>.wav`
- 040 → `output/videos/<seg>.mp4`
- 050 → `output/spokesperson_<seg>.mp4`

and step 040 is deliberately idempotent — from its own docstring:

```
Writes: output/videos/<segment>.mp4   (idempotent — skips any .mp4 already present)
```

So: run video A, then run video B. Step 040 for B finds A's `intro.mp4` still sitting there, skips the download, and step 050 uploads **A's render into B's Drive folder**. It fails silently and looks like success. Passing explicit titles does *not* fix this — only clearing the step outputs does.

The counter-pressure: clearing outputs on every run would mean a job whose 040 timed out (renders not finished yet) could only be finished by re-running 010→030, which **re-submits three brand-new HeyGen renders**. That is the single action this system most wants to avoid. Hence the FRESH/RESUME decision in Step 2 — it exists to satisfy both constraints at once.

### Step 040's timing (owner decision: "wait longer, single attempt")

`steps/040-download-avatar-renders-run/run.py`, line ~28:

```python
DEFAULT_BUFFER = 60  # seconds of render overhead on top of clip length — a heuristic, not a poll
```

040 waits `clip_duration + buffer` once, then makes exactly ONE download attempt; anything not ready is reported pending and left alone. The owner chose to widen the buffer rather than add retries or polling. 60s is too tight (a real verified render was 1920×1080 / 86.6s — see `pipelines/video/heygen/RENDERS.md`). Raise to 300.

### The exemplar to match: `pipelines/video/heygen/renders-viewer/serve.mjs`

276 lines, zero dependencies, Node built-ins only, inline HTML + inline CSS in a template literal, `--port` flag with a `PORT` env fallback, and an `esc()` helper for HTML escaping. **Match its structure, its comment density, and its visual style.** Its opening:

```js
// serve.mjs — a tiny zero-dependency viewer for the HeyGen render manifest.
//
//   node serve.mjs [--port 4361]
//   → open the printed http://localhost:4361

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const portFlag = process.argv.indexOf("--port");
const PORT = process.env.PORT || (portFlag > -1 && process.argv[portFlag + 1]) || 4361;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
```

Do NOT introduce a framework, a build step, a `package.json`, or any dependency. This is a two-control internal page for one user — matching the sibling exemplar is the correct level of design investment, not an occasion for novel UI.

### The regexes step 010 uses (mirror these EXACTLY in JS)

From `steps/010-resolve-drive-input-run/run.py`:

```python
FOLDER_ID_RE = re.compile(r"/folders/([a-zA-Z0-9_-]+)")
TYPE_RE = re.compile(r"\s*@\s*(g1|g2)$", re.IGNORECASE)
```

010 dies with `✖ folder name {name!r} doesn't end in ' @ g1' or ' @ g2'` if the suffix is missing, and derives `video_title = TYPE_RE.sub("", name)`.

### Avatar registry

`pipelines/video/heygen/registry.json` — only `girl-1` and `girl-2` carry a `template_id`, which is what the template flow needs. `shared/avatar_mapping.py` maps the folder suffix to the slug: `SLUGS = {"g1": "girl-1", "g2": "girl-2"}`. The UI displays the resolved slug read-only; it must never offer a choice or override the suffix.

### Auth

`node tooling/cli/heygen-web/heygen-web.mjs auth-check` — **exit 0 = session live, exit 1 = expired** (`die()` in `src/client/http.mjs` is `console.error(...); process.exit(1)`). Verified live on 2026-07-16 against a cURL capture from 2026-07-09, so the session lasts about a week in practice — despite `tooling/cli/heygen-web/CLAUDE.md` claiming "minutes to hours". Auth comes from `infra/secrets/heygen-web-curls.txt` (gitignored). Only the owner can refresh it.

### Runtime deps (verified on this machine, 2026-07-16)

- `node` v22.14.0 — **`node --test <directory>` is broken on this version** (treats the path as a script). Test commands must name a test **file**. This is a recorded lesson in `plans/runs/LESSONS.md`; do not "fix" the test_cmd into a directory form.
- `ffmpeg` at `/opt/homebrew/bin/ffmpeg`.
- **No `pipelines/venv` is needed.** Every file in `tutorial-pipeline-1` imports Python stdlib only (`sys, json, pathlib, subprocess, shutil, argparse, time, random, re`). `pp-drive` is a bash wrapper that resolves to system `python3` on Mac, and the Google libs (`google-api-python-client`, `google-auth-oauthlib`, `google-auth-httplib2` — see `tooling/mcp/google-shared/requirements.txt`) are importable from system python3. Do not add a venv activation step anywhere.
- Drive account: `kushalbakliwal25@gmail.com` — already the default in steps 010/050. She has access to it. Do not add an account picker.

### The dashboard she will launch from

`tooling/cli/local-apps-dashboard/` — `apps.json` is the registry; `dashboard.mjs` serves :4321 with Start/Stop/Open per app. From its `CLAUDE.md`:

> **When you build a new local-only app or script the owner will want to run:** register it by adding one object to `apps.json` (`id`, `name`, `cwd` absolute, `start` shell command, `port`, `url`). That is the whole "document a local app" workflow.
> **Every app gets its OWN ports so all can run at once.** Two apps must never share a port.

Ports already taken: 4100, 4319, 4331, 4341, 4351, 4361, 5173, 5273, 5373, 8787, 8887. **Use 4371.** The `media-board` entry is the shape to copy:

```json
{
  "id": "media-board",
  "name": "media board",
  "cwd": "/Users/kbtg/codebase/personal-stuff/pipelines/.claude/skills/media-board",
  "start": "node serve.mjs --port 4100",
  "port": 4100,
  "ports": [4100],
  "url": "http://localhost:4100"
}
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the tests (merge gate) | `node --test pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs` | exit 0, all tests pass |
| Check exports load | `node -e "import('./pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs').then(m=>console.log(typeof m.parseFolderId, typeof m.parseTitleType, typeof m.decideRunMode))"` | `function function function` |
| Validate the registry JSON | `node -e "const a=require('./tooling/cli/local-apps-dashboard/apps.json'); const e=a.apps.find(x=>x.id==='avatar-ui'); if(!e) throw new Error('missing'); console.log(e.port)"` | `4371` |
| Assert no port collision | `node -e "const a=require('./tooling/cli/local-apps-dashboard/apps.json'); const p=a.apps.flatMap(x=>x.ports); if(new Set(p).size!==p.length) throw new Error('dup port'); console.log('ports unique')"` | `ports unique` |
| Check the buffer changed | `grep -n 'DEFAULT_BUFFER = 300' pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py` | one match |
| Start the server manually | `cd pipelines/youtube/tutorial-pipeline-1/ui && node serve.mjs --port 4371` | prints the localhost URL, serves 200 on `/` |
| Auth probe (read-only, safe) | `node tooling/cli/heygen-web/heygen-web.mjs auth-check` | exit 0 today |

## Scope

**In scope** (the only files to create or modify):
- `pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs` (new)
- `pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs` (new)
- `pipelines/youtube/tutorial-pipeline-1/ui/README.md` (new)
- `pipelines/youtube/tutorial-pipeline-1/PIPELINE.md` (add a short section pointing at `ui/`)
- `pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py` (**one line**: the `DEFAULT_BUFFER` constant)
- `tooling/cli/local-apps-dashboard/apps.json` (one new entry)
- `plans/README.md` (status row)

**Out of scope** — looks related, do not touch:
- `steps/010|020|030|050/run.py` — the pipeline is verified; the UI wraps it, it does not edit it. Any urge to "improve" a step is a STOP.
- `lib/heygen.py`'s `PACING` / `human_delay` — the 45–150s gaps are anti-ban, not slowness to optimize.
- `tooling/cli/heygen-web/**` — the CLI is fine; call it, don't change it.
- `pipelines/video/heygen/registry.json` — girl-1/girl-2 are the only valid targets; adding avatars is a separate decision.
- `tooling/cli/local-apps-dashboard/dashboard.mjs` — registry entry only, no dashboard code changes.
- `infra/secrets/**` — never read, print, log, or commit the cURL file.

## Steps

### Step 1 — Widen step 040's render buffer

In `pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py`, change the constant only:

```python
DEFAULT_BUFFER = 300  # seconds of render overhead on top of clip length — a heuristic, not a poll.
                      # Owner chose "wait longer, single attempt" over polling/retries (2026-07-16):
                      # 60s was tighter than real renders (a verified 1080p render ran 86.6s of clip).
```

Change nothing else in this file — the `--buffer` flag and the no-poll posture stay exactly as they are.

**Verify:** `grep -n 'DEFAULT_BUFFER = 300' pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py` → one match.
**Verify:** `git diff --numstat -- pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py` → shows at most 4 added / 1 removed lines. More than that means you changed logic; revert and redo.

### Step 2 — Write the three pure functions in `ui/serve.mjs`

Create `pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs`. Start with the pure, exported, testable core. **These three functions are written for you — place them as-is.** They are the correctness of this plan; do not paraphrase them.

```js
// Mirrors FOLDER_ID_RE in steps/010-resolve-drive-input-run/run.py.
export function parseFolderId(link) {
  const m = /\/folders\/([a-zA-Z0-9_-]+)/.exec(String(link || ""));
  return m ? m[1] : null;
}

// Mirrors TYPE_RE + video_title in steps/010-resolve-drive-input-run/run.py.
// "Some Tutorial @ g1" -> { title: "Some Tutorial", type: "g1", avatar: "girl-1" }
// A folder without the suffix is not renderable — 010 would reject it too.
const SLUGS = { g1: "girl-1", g2: "girl-2" };
export function parseTitleType(folderName) {
  const name = String(folderName || "");
  const m = /\s*@\s*(g1|g2)\s*$/i.exec(name);
  if (!m) return null;
  const type = m[1].toLowerCase();
  return { title: name.slice(0, m.index), type, avatar: SLUGS[type] };
}

// Decide how a job for this video should run.
//   "FRESH"  -> wipe every steps/*/output/, then run 010 -> 050.
//   "RESUME" -> run 040 -> 050 only.
//
// Why FRESH must wipe: steps 020/040/050 write files that are NOT namespaced by
// title (020 -> output/<seg>.wav, 040 -> output/videos/<seg>.mp4, 050 ->
// output/spokesperson_<seg>.mp4), and 040 deliberately SKIPS any .mp4 already
// present. Without a wipe, a job for video B reuses video A's renders and
// uploads them into B's Drive folder — silently, looking like success.
//
// Why RESUME exists: if 030 already submitted renders for this exact video, a
// re-run must NOT submit three more. Duplicate renders are the expensive,
// account-bound, ToS-grey action this whole pipeline is shaped to avoid. So a
// job whose 040 timed out is finished by re-running 040/050 only.
//
// The folder_id check closes the "two different videos, same title" hole: same
// title but a different source folder is a different video, so it's FRESH.
export function decideRunMode({ folderId, s010Manifest, s030ManifestExists }) {
  if (!s030ManifestExists) return "FRESH";        // nothing submitted yet
  if (!s010Manifest) return "FRESH";              // half-wiped/unknown state — don't trust it
  if (s010Manifest.folder_id !== folderId) return "FRESH";  // same title, DIFFERENT video
  return "RESUME";
}
```

**Verify:** `node -e "import('./pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs').then(m=>console.log(typeof m.parseFolderId, typeof m.parseTitleType, typeof m.decideRunMode))"` → `function function function`.

### Step 3 — Write the job runner in `ui/serve.mjs`

Still in `serve.mjs`. Build the runner on top of Step 2's functions.

**Paths** (resolve from `import.meta.url`, exactly like `renders-viewer/serve.mjs` does):

```js
const ROOT = dirname(fileURLToPath(import.meta.url));        // .../tutorial-pipeline-1/ui
const PIPE = join(ROOT, "..");                                // .../tutorial-pipeline-1
const STEPS = join(PIPE, "steps");
const REPO = join(PIPE, "..", "..", "..");                    // repo root
const HEYGEN_CLI = join(REPO, "tooling/cli/heygen-web/heygen-web.mjs");
const DRIVE_CLI = join(REPO, "tooling/cli/drive/pp-drive");
const STEP_DIRS = {
  "010": join(STEPS, "010-resolve-drive-input-run"),
  "020": join(STEPS, "020-extract-audio-run"),
  "030": join(STEPS, "030-submit-avatar-renders-run"),
  "040": join(STEPS, "040-download-avatar-renders-run"),
  "050": join(STEPS, "050-package-and-upload-run"),
};
const ACCOUNT = "kushalbakliwal25@gmail.com";
```

**Job state** — one job at a time, in memory, no persistence:

```js
let job = null;  // { title, avatar, folderId, mode, status, lines: [], driveLink, startedAt }
```

`status` is one of `running | done | failed`. A second start while `job?.status === "running"` returns HTTP 409.

**Running a step**: `spawn("python3", ["run.py", ...args], { cwd: STEP_DIRS[n] })`. Stream `stdout` and `stderr` line-by-line into `job.lines` and push each to the SSE clients. Resolve on `close` with the exit code. A non-zero exit fails the job — record the last stderr line as the reason and run no further steps.

Do NOT set a timeout on the spawn. Step 030 sleeps 45–150s between submits and step 040 waits `clip + 300s` per segment by design; a job legitimately runs 15+ minutes. Killing it on a timer would abandon renders mid-flight.

**The job sequence:**

1. **Auth gate.** Run `node <HEYGEN_CLI> auth-check`. Non-zero exit → fail immediately with exactly: `HeyGen login expired — ask Kushal to refresh it`. Do not start any step. (Do not print the CLI's stdout — it dumps avatar JSON.)
2. **Resolve.** `parseFolderId(link)`; null → fail with `That doesn't look like a Drive folder link — it should contain /folders/`.
3. **Name.** Run `<DRIVE_CLI> stat <folderId> --account <ACCOUNT>`, which prints tab-separated `id\tname\tmimeType`. Non-folder mimeType → fail with `That link is a file, not a folder`.
4. **Type.** `parseTitleType(name)`; null → fail with: `The folder must be named "<title> @ g1" or "<title> @ g2" — this one is "<name>"`.
5. **Mode.** Read `STEP_DIRS["010"]/output/<title>.input-manifest.json` (JSON or null if absent) and test existence of `STEP_DIRS["030"]/output/<title>.heygen-manifest.json`. Call `decideRunMode(...)`.
6. **If FRESH**: delete the `output/` directory under **every** one of the five step dirs (`rm -rf` semantics via `fs.rm(p, { recursive: true, force: true })`). Then run 010 → 020 → 030 → 040 → 050.
   **If RESUME**: log `Renders were already submitted for this video — picking up where it left off (not re-submitting).` and run 040 → 050 only.
7. **Post-010 consistency guard** (FRESH only). After 010 exits 0, assert `STEP_DIRS["010"]/output/<title>.input-manifest.json` exists. If it does not, the JS `parseTitleType` and the Python `TYPE_RE` disagreed about the title — fail with `Internal: title mismatch between the UI and step 010 — tell Kushal` and stop. This is the guard that keeps the two regex implementations honest; do not remove it.
8. **Step args** (always pass the title explicitly — never rely on their glob-inference fallback):
   - 010: `run.py --drive-link "<link>" --account <ACCOUNT>`
   - 020: `run.py "<title>"`
   - 030: `run.py "<title>"`
   - 040: `run.py "<title>"`
   - 050: `run.py "<title>" --account <ACCOUNT>`
9. **Finish.** Scan the job's captured lines for the last `https://drive.google.com/drive/folders/[A-Za-z0-9_-]+` (step 050 prints it) and store it as `job.driveLink`. Mark `done`.

**Pending renders.** If step 040 leaves a segment pending, step 050 exits non-zero with `✖ missing … run step 040 first`. The job fails; the log already shows why. Surface the failure verbatim and add one line: `Some renders weren't finished in time. Press Start again in a few minutes — it will pick up the existing renders without re-submitting.` (That sentence is only true because of RESUME — which is why RESUME is not optional.)

**Verify:** `node --check pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs` → exit 0, no output.

### Step 4 — Write the HTTP layer + page in `ui/serve.mjs`

Endpoints:

| Route | Behavior |
|---|---|
| `GET /` | The HTML page (inline template literal, `esc()` all interpolation) |
| `GET /api/auth` | `{ ok: true|false }` from `auth-check`'s exit code |
| `POST /api/resolve` | `{ link }` → `{ folderId, title, avatar }` or `{ error }` (steps 2–4 above; **stat + regex only** — do NOT list the folder's files here; step 010 is the authority on whether the segments exist, and it already fails with a clear message) |
| `POST /api/run` | `{ link }` → 202 and starts the job; 409 if one is `running` |
| `GET /api/events` | SSE: replay `job.lines`, then stream new ones; emit a terminal event carrying `status` + `driveLink` |

The page, matching `renders-viewer`'s inline style:

- Title "Avatar Renderer" and one line of help: *Paste the Drive folder link. The folder must be named like `My Tutorial @ g1`.*
- A text input for the link + a **Check folder** button.
- On resolve: a small card showing **Title**, **Avatar** (read-only text, e.g. `girl-1 — from the "@ g1" in the folder name`), and a **Start render** button. The avatar is never an input, a select, or editable.
- A log pane (monospace, auto-scrolling) fed by SSE.
- On done: a prominent **Open the output folder in Drive ↗** link.
- On page load, call `/api/auth`; if not ok, show a banner reading exactly `HeyGen login expired — ask Kushal to refresh it` and disable **Start render**.
- One live job: while running, disable **Start render** and show elapsed time. Tell her plainly it takes 15–20 minutes and she can leave the tab open.

Error text is plain sentences aimed at someone who has never seen a stack trace. Never surface a raw traceback as the primary message; put step output in the log pane instead.

**Verify:** start it (`cd pipelines/youtube/tutorial-pipeline-1/ui && node serve.mjs --port 4371 &`), then `curl -s -o /dev/null -w "%{http_code}" http://localhost:4371/` → `200`, and `curl -s http://localhost:4371/api/auth` → `{"ok":true}`. Kill it afterwards.
**Verify (UI plan — attach to the PR):** a screenshot of the loaded page at :4371. **The page renders fully without any HeyGen or Drive call** — start the server and load `/`; the empty form (plus the auth banner, whichever state it's in) is exactly what to capture. No render, no job, no live API needed. Precedent for this same shape: `plans/runs/evidence/060-media-board.png`, from the sibling local `serve.mjs` UI.

### Step 5 — Tests

Create `pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs`, following `pipelines/.claude/skills/media-board/test/media-board.test.mjs` (`node:test` + `node:assert`, importing the exported functions from the server module). Cover:

- `parseFolderId`: a real folder link → the id; a file link / garbage / empty → `null`.
- `parseTitleType`: `"My Tutorial @ g1"` → `{ title: "My Tutorial", type: "g1", avatar: "girl-1" }`; `"X @ G2"` (uppercase) → `girl-2`; `"No Suffix"` → `null`; `"Weird @ g3"` → `null`. Assert the title has no trailing space (this is what step 010's `TYPE_RE.sub` produces, and a mismatch would trip the Step 3 guard).
- `decideRunMode`: all four branches — no 030 manifest → `FRESH`; 030 but no 010 manifest → `FRESH`; both, mismatched `folder_id` → `FRESH`; both, matching `folder_id` → `RESUME`.

**Verify:** `node --test pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs` → exit 0.
**Note:** the test command must name the **file**. `node --test <dir>` is broken on node 22.14 (recorded in `plans/runs/LESSONS.md`). Do not "improve" it into a directory or glob form, and do not add a `package.json`.

### Step 6 — Register in the dashboard

Add to `tooling/cli/local-apps-dashboard/apps.json`'s `apps` array:

```json
{
  "id": "avatar-ui",
  "name": "avatar renderer",
  "cwd": "/Users/kbtg/codebase/personal-stuff/pipelines/youtube/tutorial-pipeline-1/ui",
  "start": "node serve.mjs --port 4371",
  "port": 4371,
  "ports": [4371],
  "url": "http://localhost:4371"
}
```

**Verify:** `node -e "const a=require('./tooling/cli/local-apps-dashboard/apps.json'); const e=a.apps.find(x=>x.id==='avatar-ui'); console.log(e.port); const p=a.apps.flatMap(x=>x.ports); if(new Set(p).size!==p.length) throw new Error('dup port');"` → prints `4371`, no throw.

### Step 7 — Docs

**`ui/README.md`** — written for her, not for an engineer. Content:
- What it does: paste a Drive folder link, get 3 avatar clips back in that folder's `output/`.
- How to run: open the local-apps dashboard, press Start on **avatar renderer**, press Open. (Do not document a terminal command as the primary path.)
- The folder rule: must be named `Something @ g1` or `Something @ g2`, and hold `intro.mp4`, `body.mp4`, `conclusion.mp4` in `input/` or at the root. The suffix is what picks the avatar.
- It takes 15–20 minutes. That is normal, not a hang — the pipeline paces itself on purpose.
- One-time setup on a new Mac: `node`, `ffmpeg` (`brew install ffmpeg`), the Google libs on system python3 (`python3 -m pip install -r tooling/mcp/google-shared/requirements.txt`), and **`infra/secrets/heygen-web-curls.txt`, which is gitignored and therefore not in a fresh clone — the owner must copy it in by hand.** No `pipelines/venv` is required.
- If it says the login expired, that is the cURL file — only the owner can refresh it.

**`PIPELINE.md`** — add a short section under Layout noting `ui/` is the local UI wrapper (dashboard app `avatar renderer`, :4371) that runs steps 010→050 as one job, and that the five steps remain the source of truth.

**Verify:** `test -s pipelines/youtube/tutorial-pipeline-1/ui/README.md && grep -c "heygen-web-curls" pipelines/youtube/tutorial-pipeline-1/ui/README.md` → ≥1.

## Test plan

New: `pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs` (Step 5), following `pipelines/.claude/skills/media-board/test/media-board.test.mjs`.

Deliberately NOT tested automatically: the end-to-end render. Exercising it costs three real HeyGen renders against the owner's account, and `tooling/cli/heygen-web/CLAUDE.md` is explicit — *"Live commands are ToS-grey and account-bound — run them manually, never in automation loops."* The pure functions carry the correctness that matters (FRESH/RESUME, title parsing); the wiring is verified by the owner's first real run.

## Done criteria

All must pass:

1. `node --test pipelines/youtube/tutorial-pipeline-1/ui/test/ui.test.mjs` → exit 0.
2. `node --check pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs` → exit 0.
3. `node -e "import('./pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs').then(m=>{if(!m.parseFolderId||!m.parseTitleType||!m.decideRunMode)throw new Error('missing exports');console.log('exports ok')})"` → `exports ok`.
4. `node -e "const a=require('./tooling/cli/local-apps-dashboard/apps.json'); const e=a.apps.find(x=>x.id==='avatar-ui'); if(e.port!==4371)throw new Error('port'); const p=a.apps.flatMap(x=>x.ports); if(new Set(p).size!==p.length)throw new Error('dup'); console.log('registry ok')"` → `registry ok`.
5. `grep -c 'DEFAULT_BUFFER = 300' pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-run/run.py` → `1`.
6. Server serves: `node serve.mjs --port 4371` in `ui/`, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:4371/` → `200`.
7. Scope is clean: `git diff --stat f048900..HEAD` touches only the In-scope list. In particular `git diff f048900..HEAD -- pipelines/youtube/tutorial-pipeline-1/steps/010-resolve-drive-input-run/ pipelines/youtube/tutorial-pipeline-1/steps/020-extract-audio-run/ pipelines/youtube/tutorial-pipeline-1/steps/030-submit-avatar-renders-run/ pipelines/youtube/tutorial-pipeline-1/steps/050-package-and-upload-run/ pipelines/youtube/tutorial-pipeline-1/lib/` is **empty**.
8. `grep -rn "heygen-web-curls\|Cookie\|cf_clearance" pipelines/youtube/tutorial-pipeline-1/ui/serve.mjs` → no match (the UI shells out to the CLI; it must never read or handle auth material itself).
9. A screenshot of the running page is attached to the PR (`ui: true`).

## STOP conditions

Stop and report — do not improvise around any of these:

- **Any urge to add HeyGen status polling, a retry loop, or an auto-refresh of renders.** The no-poll design is a deliberate anti-ban posture, not an oversight.
- **Any urge to shorten or remove step 030's 45–150s `human_delay` pacing** to make the UI feel faster. Same reason.
- **Any live HeyGen render** to "test the flow". `auth-check` is read-only and fine; `generate-from-template` is not. If you believe the plan cannot be verified without a live render, stop and say so.
- **A step script needs changing to make the UI work.** Only 040's buffer constant is in scope. If 010–050 or `lib/` seem to need edits, the plan is wrong — stop and report rather than editing them.
- **`decideRunMode` seems removable / over-complicated.** It is the fix for a silent wrong-video upload and for duplicate render submits. If you think it's unnecessary, re-read "The trap this plan must fix" and stop.
- **Auth is expired when you go to verify** (`auth-check` exits 1). Not your problem to fix and not a code bug — report it; the owner recaptures the cURL.
- **Port 4371 is already taken** by something in `apps.json` by the time you get here. Stop and report rather than silently picking another port.

## Maintenance notes

- **The two regexes are duplicated on purpose** — JS in `serve.mjs` (to show her the title/avatar before a job starts) and Python in step 010 (the authority). The Step 3 post-010 guard is what catches drift between them. If step 010's `TYPE_RE` or title derivation ever changes, `parseTitleType` must change with it, and the guard is what will tell you loudly if you forget.
- **`decideRunMode` is the first thing a reviewer should scrutinize.** Its failure mode is silent and expensive: a wrong `FRESH` re-submits three renders; a wrong `RESUME` uploads the wrong video to a customer's folder. The `folder_id` comparison is what separates those cases.
- Adding avatars beyond girl-1/girl-2 is not a UI change: `generate-from-template` needs a `template_id`, and the other registry slugs only have `avatar_id` (a different command and a bare avatar with no background). See `decisions.md` 2026-07-16 on `generate-from-audio` / `photar_not_found` before going near that.
- The 300s buffer is a heuristic, not a measurement. If pending renders become common, widen it — do **not** convert it into a poll.
- If the fal-lipsync flow is ever un-deferred (`decisions.md` 2026-07-12 defers it), this UI is the natural place to expose an engine choice — but that is a new decision, not a follow-up.
