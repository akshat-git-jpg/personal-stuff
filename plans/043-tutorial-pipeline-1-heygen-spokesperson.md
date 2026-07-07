<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash pipelines/youtube/tutorial-pipeline-1/scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 043: `tutorial-pipeline-1` — Drive-in → HeyGen spokesperson clips → Drive-out

## Summary

- **Problem statement**: Turning a recorded intro/body/conclusion into an AI-avatar "spokesperson"
  version is a fully manual round trip through the HeyGen web app today — no automated
  Drive-in → HeyGen-render → Drive-out path exists.
- **Goals**:
  - Resolve a Drive folder link, detect its `_xx`/`_yy` avatar-mapping type from the folder name,
    and download `intro.mp4`/`body.mp4`/`conclusion.mp4` from an `input/` subfolder (flat fallback
    to the folder root if `input/` doesn't exist).
  - Extract each segment's audio and submit it to HeyGen against an **already-created** avatar
    (config-driven type→avatar mapping, no polling, anti-ban pacing).
  - Download the real finished renders and package them as `spokesperson_intro/body/conclusion.mp4`.
  - Upload the 3 packaged clips into a find-or-created `output/` subfolder of the source Drive folder.
  - Extend `pp-drive` with real read operations (`stat`/`list-folder`/`download`) and `heygen-web`
    with a `generate-from-audio` command (HTTP body intentionally stubbed — see Open points).
- **Executor proposed**: `agy` (Gemini-backed by default) — owner's explicit choice, overriding
  `tooling/boss/data/rules.md`'s `standard`-difficulty default of `claude-p`/`sonnet`.
- **Done criteria** (terse — full list below): `scripts/check.sh` passes (py_compile + `node
  --check` + structure check); `pp-drive` has `stat`/`list-folder`/`download`; `heygen-web.mjs` has
  `generate-from-audio` wired into help + dispatch; `pipelines/CLAUDE.md` lists the pipeline;
  `tutorial-pipeline-2/` untouched.
- **Stop conditions** (terse — full list below): never run any step against a real Drive/HeyGen
  account; never guess or implement the real `submitAudioGenerate()` HTTP body; never touch
  `tutorial-pipeline-2/` or `infra/secrets/`.
- **Test / verification for success**: syntax + structure checks only (`python3 -m py_compile`,
  `node --check`, file/dir existence) — no live-account calls, no unit test suite (matches how
  `tutorial-pipeline-2` itself was verified when it landed).
- **Open points for plan readiness**: none blocking handoff. The one known gap — HeyGen's
  "upload audio + render on an existing avatar" HTTP call — ships as an intentional `[TODO][HNS]`
  stub; every Done criterion here is achievable without it. The pipeline won't produce a REAL
  rendered video until the owner captures that HAR (Preserve Log on) and fills in
  `submitAudioGenerate()` — that's a follow-up action, not an unresolved planning decision.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c8afcb2..HEAD -- pipelines/youtube/tutorial-pipeline-1 tooling/cli/drive/pp_drive.py tooling/cli/drive/README.md tooling/cli/heygen-web/heygen-web.mjs tooling/cli/heygen-web/README.md pipelines/CLAUDE.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (the sibling rename `kushal-tutorial-pipeline-v2` → `tutorial-pipeline-2` is handled by the owner directly, not part of this plan)
- **Category**: feature
- **Difficulty**: standard — feeds executor/model selection; the executor+model themselves live in the frontmatter above (`executor:`/`model:`), not here
- **Planned at**: commit `c8afcb2`, 2026-07-07

## Why this matters

The owner records tutorial video segments (`intro.mp4`, `body.mp4`, `conclusion.mp4`) the normal
way, then wants an AI-avatar "spokesperson" version of each — an existing HeyGen avatar lip-synced
to that segment's own audio — to drop into editing. Today that's a fully manual round trip through
the HeyGen web app. This plan builds `tutorial-pipeline-1`, a small standalone pipeline (sibling to
`tutorial-pipeline-2`, no dependency between them) that automates everything **except** the one
HeyGen request that has never been captured: uploading arbitrary audio and rendering it on an
already-created avatar. That single call ships as a clean, documented stub (see "The one deliberate
gap" below) — everything around it (Drive download, audio extraction, config, submission
bookkeeping, the real HeyGen download, packaging, Drive upload) is fully real and runnable today.

## Current state

**No `tutorial-pipeline-1` folder exists yet** — this is a new build under
`pipelines/youtube/`, alongside `pipelines/youtube/tutorial-pipeline-2/` (renamed from
`kushal-tutorial-pipeline-v2` separately from this plan — by the time this plan runs, the sibling
folder is named `tutorial-pipeline-2`).

**Conventions to mirror exactly** (from `pipelines/youtube/tutorial-pipeline-2/PIPELINE.md` and its
`steps/010-create-drive-folders-run/README.md`, both read in full for this plan):
- Numbered `steps/<NNN-name-actor>/` folders, ×10 spacing, each with its own `README.md` +
  implementation file(s) + `output/`.
- Actor suffix: `-run` (deterministic script) or `-human` (a manual gate; the script side of a
  `-human` step still lives in that folder, e.g. `tutorial-pipeline-2/steps/160-download-avatar-videos-human/download.py` + `check.py`).
- `PIPELINE.md` at the pipeline root: a run-order table + short ASCII flow diagram.
- `lib/` for shared code imported by every step (`sys.path.insert(0, str(ROOT))` then
  `from lib import X`), `shared/` for editable config the owner tunes per video.
- A step reads `../<prev-step>/output/…` and writes its own `./output/…`.
- Anti-ban posture for HeyGen: **no polling**, randomized human-like gaps between submissions,
  usage checked before/after where practical.
- Drive tree uses `input`/`output` subfolders (`tutorial-pipeline-2/steps/010-create-drive-folders-run/run.py`'s
  `TREE` builds `script-writer/{input,output}` and `video-editor/{input/…, output}`) — this plan
  mirrors that split: step 010 reads from an `input/` subfolder of the linked folder (flat fallback
  to the folder root), step 050 writes into a find-or-created `output/` subfolder.

**`pp-drive` CLI today** (`tooling/cli/drive/pp_drive.py`, read in full) supports only
`accounts`, `find-folder`, `ensure-folder`, `upload`, `mirror` — **no way to inspect a folder by id,
list its children, or download a file**. This plan adds `stat`, `list-folder`, `download` (exact
code in Step 1) — all standard, well-documented Drive API v3 calls (`files.get`, `files.list`,
`files.get_media`), unlike the HeyGen gap below.

**`heygen-web` CLI today** (`tooling/cli/heygen-web/heygen-web.mjs`, read in full, 512 lines) has:
`auth-check`, `limits`, `usage`, `list-avatars`, `list-looks`, `list-voices`, `create-photo-avatar`,
`studio-render`, `studio-render-status`, `generate`, `batch`, `list-videos`, `delete-video`,
`download`, `raw`. Two facts matter here:
1. `generate`/`batch` only do avatar + **typed text** + a HeyGen TTS `voice_id`
   (`submitGenerate()`, line 239: `audio_data: { audio_type: "tts_pending", text, voice_id }`) —
   no custom-audio path at all.
2. `studio-render` lip-syncs an **existing avatar** to a **fixed, baked-in** audio clip
   (`studio-templates/save.json`'s `script.elements.ohy4XfAC` carries a hardcoded
   `resource2.heygen.ai` URL + full transcript + per-word timestamps for one specific 1-minute
   MP3). Swapping in different audio isn't just a URL change — the `text`/`words`/`duration` fields
   are HeyGen's own transcript+alignment for THAT audio, and the upload call that produces a fresh
   `resource2.heygen.ai` URL (+ HeyGen's own re-transcription) has **never been captured**.
   `tooling/cli/heygen-web/HANDOVER.md` ("The studio render, and the gap") already documents this
   exact class of gap for the *final render* endpoint, and states the house rule: **"Do not guess
   and fire candidate generate URLs — that could spawn real videos."** The audio-upload endpoint is
   the same category of unknown, so this plan applies the same rule to it.
3. `download <video_id>` (line 447) **is fully wired and real** — no gap there.

**The one deliberate gap this plan leaves as a stub:** the actual "upload this local audio file,
render it on avatar `avatar_id`" HTTP call. This plan adds a `generate-from-audio` command to
`heygen-web.mjs` whose orchestration (arg parsing, error handling, JSON output shape) is real, but
whose HTTP body (`submitAudioGenerate()`) raises `NotImplementedError` with a `[TODO][HNS]` message
— **identical convention** to `tutorial-pipeline-2/lib/heygen.py`'s `WebSessionBackend.submit`/
`fetch`, which have shipped in production since before this session with the same stub shape (see
`plans/README.md` backlog item `PIPE-01`). To wire it for real: open the HeyGen editor with
DevTools **Preserve Log ON**, pick an existing avatar, upload an audio file, hit Generate, and copy
the network calls as cURL — the same recapture `HANDOVER.md` already calls for on the render side.

**Avatar/engine config** — the owner confirmed (2026-07-07): the Drive folder name's `_xx`/`_yy`
suffix selects a preset; each preset carries **its own HeyGen 4 avatar id AND HeyGen 3 avatar id**;
which segment renders on which engine follows a fixed rule. This plan defaults intro+conclusion →
HeyGen 4 (full-screen, metered — the short bookend moments) and body → HeyGen 3 (unlimited
corner-style, free — the long middle section), mirroring `tutorial-pipeline-2`'s own a4/a3 split
("full-screen avatar blocks (impactful moments)" vs "corner talking head for the WHOLE video") and
its Drive tree's own `full-block-spokesperson` / `talking-head-spokesperson` folder names. This
default lives in one place (`shared/avatar_mapping.py SEGMENT_ENGINE`) and the owner can flip it
freely; actual avatar ids ship as `REPLACE_WITH_*` placeholders, same convention as
`tutorial-pipeline-2/shared/heygen_config.py`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Python syntax check | `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/lib/*.py pipelines/youtube/tutorial-pipeline-1/shared/*.py pipelines/youtube/tutorial-pipeline-1/steps/*/*.py` | exit 0, no output |
| Node syntax check | `node --check tooling/cli/heygen-web/heygen-web.mjs` | exit 0, no output |
| pp-drive syntax check | `python3 -m py_compile tooling/cli/drive/pp_drive.py` | exit 0, no output |
| Full check (test_cmd) | `bash pipelines/youtube/tutorial-pipeline-1/scripts/check.sh` | prints `✓ all checks passed`, exit 0 |
| ffmpeg present | `ffmpeg -version` | prints a version line (already a dependency of `tutorial-pipeline-2`) |

**Do not** run any step's `run.py` against real Drive/HeyGen accounts as part of verification — see
STOP conditions. Verification in this plan is syntax + structure only.

## Scope

**In scope**:
- New folder `pipelines/youtube/tutorial-pipeline-1/` (everything under it).
- `tooling/cli/drive/pp_drive.py` + `tooling/cli/drive/README.md` — add `stat`, `list-folder`,
  `download` subcommands.
- `tooling/cli/heygen-web/heygen-web.mjs` + `tooling/cli/heygen-web/README.md` — add
  `generate-from-audio` (stubbed HTTP body, real CLI plumbing).
- `pipelines/CLAUDE.md` — add the new pipeline's row to the folder map table.

**Out of scope**:
- `pipelines/youtube/tutorial-pipeline-2/` (renamed sibling) — do not touch any file in it.
- Filling in the actual `submitAudioGenerate()` HTTP call, or any real HeyGen avatar/voice ids —
  those need a live HAR capture and real credentials, both owner-only actions (see STOP conditions).
- `infra/secrets/heygen-web-curls.txt` or any other secrets file.
- Any change to `tooling/mcp/`, the official HeyGen MCP, or `--iv` (Avatar IV / metered) defaults.

## Git workflow

- Branch: `advisor/043-tutorial-pipeline-1-heygen-spokesperson`
- Commit: one commit per step below, conventional-commit style, no AI footers. Do NOT push.

## Steps

### Step 1: Extend `pp-drive` with `stat`, `list-folder`, `download`

In `tooling/cli/drive/pp_drive.py`, add these three functions right after `upload_file` (currently
ends at line 78, right before `def mirror(...)` at line 81):

```python
def stat(s, file_id):
    """Return {id, name, mimeType} for any file/folder id."""
    return s.files().get(fileId=file_id, fields="id,name,mimeType",
                         supportsAllDrives=True).execute()


def list_folder(s, parent):
    """List immediate children (files+folders) of a folder id. Returns [{id,name,mimeType}]."""
    q = f"'{parent}' in parents and trashed = false"
    r = s.files().list(q=q, fields="files(id,name,mimeType)", pageSize=1000,
                       supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    return r.get("files", [])


def download_file(s, file_id, dest):
    """Download a file's bytes to a local path. Returns dest."""
    from googleapiclient.http import MediaIoBaseDownload
    request = s.files().get_media(fileId=file_id, supportsAllDrives=True)
    with open(dest, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    return dest
```

In `main()`, add subparsers (alongside the existing `find-folder`/`ensure-folder`/`upload` block):

```python
    st = sub.add_parser("stat"); st.add_argument("id"); st.add_argument("--account", required=True)
    lf = sub.add_parser("list-folder"); lf.add_argument("id"); lf.add_argument("--account", required=True)
    dl = sub.add_parser("download"); dl.add_argument("id"); dl.add_argument("--out", required=True)
    dl.add_argument("--account", required=True)
```

And in the dispatch block (after the `svc(a.account)` call, alongside the existing `elif a.cmd ==
"upload":` branch):

```python
    elif a.cmd == "stat":
        r = stat(s, a.id); print(f"{r['id']}\t{r['name']}\t{r['mimeType']}")
    elif a.cmd == "list-folder":
        for f in list_folder(s, a.id):
            print(f"{f['id']}\t{f['name']}\t{f['mimeType']}")
    elif a.cmd == "download":
        download_file(s, a.id, a.out); print(f"saved {a.out}")
```

Update the module docstring (lines 9-17) and `README.md`'s command table to list the 3 new
commands (tab-separated `id  name  mimeType` output for `stat`/`list-folder`; `saved <path>` for
`download`).

**Verify**: `python3 -m py_compile tooling/cli/drive/pp_drive.py` → exit 0, no output.

### Step 2: Add `generate-from-audio` to `heygen-web.mjs` (stubbed HTTP body)

In `tooling/cli/heygen-web/heygen-web.mjs`, add this after `submitGenerate()`/`generate()` (after
line 269, before `async function batch(...)`):

```js
// Renders an EXISTING avatar (an avatar_id you already made — NOT create-photo-avatar) lip-synced
// to a LOCAL audio file, instead of typed text + HeyGen TTS. NOT WIRED YET — the web editor's
// "upload audio to an existing avatar, then Generate" request has never been captured with
// Preserve Log on (same class of gap as studio-render's final-render endpoint, see HANDOVER.md
// "The studio render, and the gap"). To wire it: open the editor, pick an existing avatar, upload
// an audio file, hit Generate, capture the network calls (Preserve Log ON), then fill this in with
// the same shape as submitGenerate() above, minus the TTS fields.
async function submitAudioGenerate(auth, { avatar, audioPath, engine, title }) {
  throw new Error(
    `[TODO][HNS] generate-from-audio not wired: need a captured HAR of "existing avatar + ` +
    `uploaded audio + Generate" (Preserve Log ON) to know the upload endpoint + payload shape. ` +
    `Args received: avatar=${avatar} audioPath=${audioPath} engine=${engine} title=${title}`);
}

async function generateFromAudio(auth, args) {
  const avatar = arg(args, "--avatar"), audioPath = arg(args, "--audio");
  const engine = arg(args, "--engine") || "heygen3", title = arg(args, "--title");
  if (!avatar || !audioPath)
    die('generate-from-audio needs --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4] [--title T]');
  if (!existsSync(audioPath)) die(`no such audio file: ${audioPath}`);
  try {
    const { video_id } = await submitAudioGenerate(auth, { avatar, audioPath, engine, title });
    console.log(JSON.stringify({ video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
```

Add to the dispatch `switch` (alongside `case "generate":`):

```js
  case "generate-from-audio": await generateFromAudio(auth, rest); break;
```

Add one line to the `help` text block (alongside the existing `generate --avatar ...` line):

```
  generate-from-audio --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4] [--title T]
           NOT WIRED YET — see HANDOVER.md / [TODO][HNS] in the code.
```

Update `tooling/cli/heygen-web/README.md`'s command list the same way, and add one line to
`HANDOVER.md`'s "What to do next" list noting the audio-upload capture is now also needed here.

**Verify**: `node --check tooling/cli/heygen-web/heygen-web.mjs` → exit 0, no output.

### Step 3: Scaffold the pipeline — `lib/`, `shared/`, `PIPELINE.md`

Create `pipelines/youtube/tutorial-pipeline-1/lib/__init__.py` (empty file).

Create `pipelines/youtube/tutorial-pipeline-1/lib/drive.py`:

```python
"""Thin wrappers around the pp-drive CLI (shell-out) for tutorial-pipeline-1.
Read-side operations (stat/list-folder/download) this pipeline needs, on top of the same
find-or-create/upload pattern tutorial-pipeline-2/lib/drive.py already uses.
"""
import shutil, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]           # tutorial-pipeline-1/


def resolve_cli(explicit=None):
    if explicit:
        if not pathlib.Path(explicit).exists():
            raise SystemExit(f"✖ --drive-cli not found: {explicit}")
        return explicit
    on_path = shutil.which("pp-drive")
    if on_path:
        return on_path
    guess = ROOT.parents[2] / "tooling/cli/drive/pp-drive"
    if guess.exists():
        return str(guess)
    raise SystemExit("✖ can't find pp-drive — pass --drive-cli /path/to/pp-drive")


def _run(cli, args):
    r = subprocess.run([cli, *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"✖ pp-drive {args[0]} failed:\n{(r.stderr or r.stdout).strip()}")
    return (r.stdout or "").strip()


def stat(cli, file_id, account):
    """Returns (id, name, mimeType) for any file/folder id."""
    fid, name, mime = _run(cli, ["stat", file_id, "--account", account]).split("\t")
    return fid, name, mime


def list_folder(cli, folder_id, account):
    """Returns [{"id":..., "name":..., "mimeType":...}] for a folder's immediate children."""
    out = _run(cli, ["list-folder", folder_id, "--account", account])
    children = []
    for line in out.splitlines():
        fid, name, mime = line.split("\t")
        children.append({"id": fid, "name": name, "mimeType": mime})
    return children


def download(cli, file_id, account, dest):
    _run(cli, ["download", file_id, "--out", str(dest), "--account", account])
    return dest


def find_child_folder(cli, parent, name, account):
    """Return the id of an immediate child folder named `name` (case-insensitive), or None."""
    for c in list_folder(cli, parent, account):
        if c["mimeType"] == "application/vnd.google-apps.folder" and c["name"].lower() == name.lower():
            return c["id"]
    return None


def ensure_folder(cli, name, parent, account):
    """Find-or-create a child folder; returns its id. Uses pp-drive's existing ensure-folder."""
    return _run(cli, ["ensure-folder", name, "--parent", parent, "--account", account])


def upload(cli, file, parent, account, name=None, overwrite=True):
    args = ["upload", str(file), "--parent", parent, "--account", account]
    if name:
        args += ["--name", name]
    if overwrite:
        args.append("--overwrite")
    return _run(cli, args)


def link(fid):
    return f"https://drive.google.com/drive/folders/{fid}"
```

Create `pipelines/youtube/tutorial-pipeline-1/lib/audio.py`:

```python
"""Audio primitives for tutorial-pipeline-1 (ffmpeg/ffprobe wrappers). dur()/mmss() mirror
tutorial-pipeline-2/lib/audio.py; extract_audio is new (that pipeline's audio starts as a TTS wav,
this one starts as a video file's audio track)."""
import subprocess, pathlib


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def mmss(s):
    s = max(0.0, float(s))
    return f"{int(s)//60}:{int(s)%60:02d}"


def extract_audio(video_path, dest, sr=16000):
    """Pull the audio track out of a video into a 16kHz mono wav. Returns dest."""
    subprocess.run(["ffmpeg", "-y", "-i", str(video_path), "-vn", "-ac", "1", "-ar", str(sr),
                    str(dest)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dest
```

Create `pipelines/youtube/tutorial-pipeline-1/lib/heygen.py`:

```python
"""HeyGen submission for tutorial-pipeline-1 — wraps the heygen-web CLI's generate-from-audio +
download commands. Same anti-ban posture as tutorial-pipeline-2/lib/heygen.py: no polling,
randomized human-like gaps between submissions. generate-from-audio's HTTP body is a [TODO][HNS]
stub in heygen-web.mjs until the audio-upload request is captured — this wrapper is real and ready
the moment that's wired; submit() just returns status="stub-not-wired" until then.
"""
import time, json, random, subprocess, shutil, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]           # tutorial-pipeline-1/


def resolve_cli(explicit=None):
    if explicit:
        if not pathlib.Path(explicit).exists():
            raise SystemExit(f"✖ --heygen-cli not found: {explicit}")
        return explicit
    guess = ROOT.parents[2] / "tooling/cli/heygen-web/heygen-web.mjs"
    if guess.exists():
        return str(guess)
    raise SystemExit("✖ can't find heygen-web.mjs — pass --heygen-cli /path/to/heygen-web.mjs")


def human_delay(pacing, n_done):
    gap = random.uniform(pacing["min_gap"], pacing["max_gap"])
    if pacing.get("settle_every") and n_done and n_done % pacing["settle_every"] == 0:
        gap += pacing.get("settle_gap", 0)
    print(f"   …waiting {gap:.0f}s (human pacing)")
    time.sleep(gap)


def submit(cli, audio_path, avatar_id, engine, title):
    """Submit one render. Returns {"video_id":..., "status":"submitted"} for real, or
    {"status":"stub-not-wired", "error":...} while generate-from-audio's HTTP body is a stub."""
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "generate-from-audio", "--avatar", avatar_id,
                        "--audio", str(audio_path), "--engine", engine, "--title", title],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return {"status": "stub-not-wired", "error": (r.stderr or r.stdout).strip()}
    out = json.loads(r.stdout)
    return {"video_id": out.get("video_id"), "status": "submitted"}


def download(cli, video_id, dest):
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "download", video_id, "--out", str(dest)],
                       capture_output=True, text=True)
    return r.returncode == 0
```

Create `pipelines/youtube/tutorial-pipeline-1/shared/__init__.py` (empty file).

Create `pipelines/youtube/tutorial-pipeline-1/shared/avatar_mapping.py`:

```python
# Avatar mapping for tutorial-pipeline-1 — EDIT THIS to plug in real HeyGen avatar ids.
# Keyed by the Drive folder's _xx / _yy suffix. Each type carries its OWN HeyGen 4 avatar id
# (full-screen, metered) AND HeyGen 3 avatar id (unlimited corner-style, free) — both are
# avatars you've ALREADY created in HeyGen; this pipeline never creates a new one.

TYPES = {
    "xx": {
        "heygen4_avatar_id": "REPLACE_WITH_XX_HEYGEN4_AVATAR_ID",
        "heygen3_avatar_id": "REPLACE_WITH_XX_HEYGEN3_AVATAR_ID",
    },
    "yy": {
        "heygen4_avatar_id": "REPLACE_WITH_YY_HEYGEN4_AVATAR_ID",
        "heygen3_avatar_id": "REPLACE_WITH_YY_HEYGEN3_AVATAR_ID",
    },
}

# Which HeyGen engine renders which segment. Default: intro/conclusion are the short, high-impact
# bookends -> HeyGen 4 (full-screen, metered, like tutorial-pipeline-2's "a4" flow); body is the
# long middle section -> HeyGen 3 (unlimited corner-style, free, like its "a3" flow). Edit freely.
SEGMENT_ENGINE = {
    "intro": "heygen4",
    "body": "heygen3",
    "conclusion": "heygen4",
}
```

Create `pipelines/youtube/tutorial-pipeline-1/PIPELINE.md`:

```markdown
# tutorial-pipeline-1

Turns a Drive folder of 3 raw segments (`intro.mp4`, `body.mp4`, `conclusion.mp4`) into 3
HeyGen-avatar "spokesperson" renders, dropped back into that same Drive folder. Standalone — does
not feed into or read from `tutorial-pipeline-2`.

## Drive layout

```
{title}_xx or {title}_yy/     ← the folder you link
  input/                      ← optional: intro.mp4, body.mp4, conclusion.mp4
                                 (falls back to reading them from the folder root if input/ is absent)
  output/                     ← find-or-created: spokesperson_intro/body/conclusion.mp4 land here
```

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 010 | `resolve-drive-input` | [RUN] | Drive folder link → `intro/body/conclusion.mp4` downloaded from `input/` (or the folder root) + type (`xx`/`yy`) detected |
| 020 | `extract-audio` | [RUN] | each segment's video → its audio track (`.wav`) |
| 030 | `submit-avatar-renders` | [RUN] | audio + avatar mapping → HeyGen submit (no polling) |
| 040 | `download-avatar-renders` | [HUMAN] | check HeyGen → download finished `.mp4`s |
| 050 | `package-and-upload` | [RUN] | rename to `spokesperson_*` + upload into `output/` (find-or-created) in the source Drive folder |

```
Drive folder "{title}_xx" or "{title}_yy"
   │ 010 resolve drive input      [RUN]    → reads input/ (or root) → intro/body/conclusion.mp4 (local)
   │ 020 extract audio            [RUN]    → intro.wav, body.wav, conclusion.wav
   │ 030 submit avatar renders    [RUN]    → HeyGen submit per segment (no polling)
   │ 040 download avatar renders  [HUMAN]✋ → check HeyGen, download when ready
   │ 050 package + upload         [RUN]    → spokesperson_{intro,body,conclusion}.mp4 → Drive output/
   ▼
3 spokesperson clips, local + in Drive's output/ subfolder
```

## Layout
```
tutorial-pipeline-1/
  PIPELINE.md
  lib/            drive.py (pp-drive wrapper), audio.py (ffmpeg), heygen.py (heygen-web wrapper)
  shared/
    avatar_mapping.py   ← EDIT: real HeyGen avatar ids per type, segment→engine rule
  steps/<NNN-name-actor>/
    README.md, run.py (or download.py + check.py for the human step), output/
```

## Conventions
Same as `tutorial-pipeline-2`: ×10 step numbering, `-run`/`-human` actor suffix, each step reads
`../<prev>/output/…` and writes its own `./output/…`, no HeyGen polling (anti-ban).

## Status
`030`'s HeyGen submit calls `generate-from-audio`, whose HTTP body is a `[TODO][HNS]` stub in
`tooling/cli/heygen-web/heygen-web.mjs` — needs a HAR capture (Preserve Log ON) of "existing avatar
+ uploaded audio + Generate" to go live. Every other step is real today.
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/lib/*.py pipelines/youtube/tutorial-pipeline-1/shared/*.py` → exit 0, no output.

### Step 4: Step 010 — `resolve-drive-input-run`

Create `pipelines/youtube/tutorial-pipeline-1/steps/010-resolve-drive-input-run/README.md`:

```markdown
# 010 · resolve-drive-input  ·  [RUN]  (first step)

- **In:** a Drive folder link (`--drive-link`), e.g. `https://drive.google.com/drive/folders/<id>`
- **Out:** `output/intro.mp4`, `output/body.mp4`, `output/conclusion.mp4` +
  `output/<title>.input-manifest.json` (folder id, detected type, file paths)
- **Run:** `python3 run.py --drive-link "<link>" [--account EMAIL]`
- **Next:** step 020 extracts audio from the 3 downloaded segments

The folder name must end in `_xx` or `_yy` (case-insensitive) — that suffix selects which avatar
mapping (`shared/avatar_mapping.py`) later steps use. `intro.mp4`/`body.mp4`/`conclusion.mp4` are
read from an `input/` subfolder of the linked folder if one exists, else from the folder itself
(flat fallback, for folders that don't use the subfolder convention).
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/010-resolve-drive-input-run/run.py`:

```python
#!/usr/bin/env python3
"""
Step 010 — resolve the Drive input.  [RUN]  (first step)

Takes a Drive FOLDER link, works out the video's type (_xx or _yy suffix on the folder name) and
title, then downloads intro.mp4 / body.mp4 / conclusion.mp4 into ./output/ — read from an
`input/` subfolder if one exists, else from the folder itself (flat fallback).

  python3 run.py --drive-link "https://drive.google.com/drive/folders/<id>" [--account EMAIL]

Out: output/<title>.input-manifest.json — {folder_id, type, video_title, files: {intro, body, conclusion}}
     output/intro.mp4, output/body.mp4, output/conclusion.mp4
"""
import sys, re, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]            # tutorial-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import drive                                           # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
SEGMENTS = ("intro", "body", "conclusion")
FOLDER_ID_RE = re.compile(r"/folders/([a-zA-Z0-9_-]+)")
TYPE_RE = re.compile(r"_(xx|yy)$", re.IGNORECASE)


def die(m): raise SystemExit("✖ " + m)


def parse_folder_id(link):
    m = FOLDER_ID_RE.search(link)
    if not m:
        die(f"couldn't find a folder id in {link!r} (expected .../folders/<id>)")
    return m.group(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drive-link", required=True)
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com")
    ap.add_argument("--drive-cli", default=None)
    a = ap.parse_args()

    cli = drive.resolve_cli(a.drive_cli)
    folder_id = parse_folder_id(a.drive_link)
    fid, name, mime = drive.stat(cli, folder_id, a.account)
    if mime != "application/vnd.google-apps.folder":
        die(f"{folder_id} is not a folder ({mime})")

    m = TYPE_RE.search(name)
    if not m:
        die(f"folder name {name!r} doesn't end in _xx or _yy — can't pick an avatar mapping")
    vtype = m.group(1).lower()
    video_title = TYPE_RE.sub("", name)

    print(f"↻ folder: {name} → type={vtype} title={video_title!r}")
    input_id = drive.find_child_folder(cli, folder_id, "input", a.account)
    segments_folder_id = input_id or folder_id
    print(f"  📁 reading segments from {'input/' if input_id else '(folder root, no input/ subfolder)'}")
    children = drive.list_folder(cli, segments_folder_id, a.account)
    by_name = {c["name"].lower(): c for c in children}

    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    for seg in SEGMENTS:
        key = f"{seg}.mp4"
        c = by_name.get(key)
        if not c:
            where = "input/" if input_id else name
            die(f"no {key!r} in Drive folder {where!r}")
        dest = OUT / key
        drive.download(cli, c["id"], a.account, dest)
        files[seg] = str(dest)
        print(f"  ⬇ {key} → {dest}")

    manifest = {"folder_id": folder_id, "type": vtype, "video_title": video_title, "files": files}
    mpath = OUT / f"{video_title}.input-manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"✓ resolved {video_title} ({vtype}) — manifest: {mpath}")


if __name__ == "__main__":
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/steps/010-resolve-drive-input-run/run.py` → exit 0.

### Step 5: Step 020 — `extract-audio-run`

Create `pipelines/youtube/tutorial-pipeline-1/steps/020-extract-audio-run/README.md`:

```markdown
# 020 · extract-audio  ·  [RUN]

- **In:** step 010's downloaded `intro.mp4`/`body.mp4`/`conclusion.mp4`
- **Out:** `output/intro.wav`, `output/body.wav`, `output/conclusion.wav` (16kHz mono) +
  `output/<title>.audio-manifest.json`
- **Run:** `python3 run.py [<video_title>]` (title inferred from step 010's manifest if omitted)
- **Next:** step 030 submits each wav to HeyGen against the mapped avatar
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/020-extract-audio-run/run.py`:

```python
#!/usr/bin/env python3
"""
Step 020 — extract audio from the 3 input segments.  [RUN]

  python3 run.py [<video_title>]

Reads:  ../010-resolve-drive-input-run/output/<video_title>.input-manifest.json
Writes: output/intro.wav, output/body.wav, output/conclusion.wav
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import audio                                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S010_OUT = ROOT / "steps/010-resolve-drive-input-run/output"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S010_OUT.glob("*.input-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 010 first (no manifest in {S010_OUT})")
    return cands[0].name.split(".input-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S010_OUT / f"{title}.input-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 010 first ({mpath})")
    manifest = json.loads(mpath.read_text())

    OUT.mkdir(parents=True, exist_ok=True)
    wavs = {}
    for seg in SEGMENTS:
        src = manifest["files"][seg]
        dest = OUT / f"{seg}.wav"
        audio.extract_audio(src, dest)
        wavs[seg] = str(dest)
        print(f"  🎧 {seg}.mp4 → {dest} ({audio.mmss(audio.dur(dest))})")

    (OUT / f"{title}.audio-manifest.json").write_text(
        json.dumps({"video_title": title, "type": manifest["type"], "wavs": wavs}, indent=2))
    print(f"✓ extracted audio for {title}")


if __name__ == "__main__":
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/steps/020-extract-audio-run/run.py` → exit 0.

### Step 6: Step 030 — `submit-avatar-renders-run`

Create `pipelines/youtube/tutorial-pipeline-1/steps/030-submit-avatar-renders-run/README.md`:

```markdown
# 030 · submit-avatar-renders  ·  [RUN]  (submits only — NO polling)

- **In:** step 020's extracted audio + `shared/avatar_mapping.py`
- **Out:** `output/<title>.heygen-manifest.json` (one job per segment, with `video_id` once real)
- **Run:** `python3 run.py [<video_title>]`
- **Next:** check HeyGen yourself; step 040 downloads once renders finish

Each job calls `heygen-web generate-from-audio`, whose HTTP body is a `[TODO][HNS]` stub until the
audio-upload request is captured (see `tooling/cli/heygen-web/HANDOVER.md`) — jobs come back
`status: "stub-not-wired"` until then; this step still runs end-to-end today.
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/030-submit-avatar-renders-run/run.py`:

```python
#!/usr/bin/env python3
"""
Step 030 — submit HeyGen avatar renders.  [RUN]  (submits only — NO polling)

  python3 run.py [<video_title>]

Reads:  ../020-extract-audio-run/output/<video_title>.audio-manifest.json
Writes: output/<video_title>.heygen-manifest.json
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import heygen                                            # noqa: E402
from shared import avatar_mapping as M                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S020_OUT = ROOT / "steps/020-extract-audio-run/output"

PACING = {"min_gap": 45, "max_gap": 150, "settle_every": 5, "settle_gap": 600}


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S020_OUT.glob("*.audio-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 020 first (no manifest in {S020_OUT})")
    return cands[0].name.split(".audio-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S020_OUT / f"{title}.audio-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 020 first ({mpath})")
    audio_man = json.loads(mpath.read_text())
    vtype = audio_man["type"]
    if vtype not in M.TYPES:
        die(f"unknown type {vtype!r} — add it to shared/avatar_mapping.py TYPES")

    cli = heygen.resolve_cli()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    print(f"video: {title} · type: {vtype} · submit (no polling)")
    for n, (seg, wav) in enumerate(audio_man["wavs"].items()):
        engine = M.SEGMENT_ENGINE[seg]
        avatar_id = M.TYPES[vtype][f"{engine}_avatar_id"]
        if n:
            heygen.human_delay(PACING, n)
        print(f"  → submit {seg} on {engine} (avatar {avatar_id})")
        res = heygen.submit(cli, wav, avatar_id, engine, title=f"{title}__{seg}")
        jobs.append({"segment": seg, "engine": engine, "avatar_id": avatar_id, "audio": wav, **res})
        vid = f" video_id={res['video_id']}" if res.get("video_id") else ""
        print(f"    {res.get('status')}{vid}")

    manifest = {"video_title": title, "type": vtype, "jobs": jobs}
    mpath_out = OUT / f"{title}.heygen-manifest.json"
    mpath_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    real = sum(1 for j in jobs if j.get("status") == "submitted")
    print(f"✓ {real}/{len(jobs)} submitted for real. manifest: {mpath_out}")
    print("  → check HeyGen yourself; when renders finish, download in step 040")


if __name__ == "__main__":
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/steps/030-submit-avatar-renders-run/run.py` → exit 0.

### Step 7: Step 040 — `download-avatar-renders-human`

Create `pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-human/README.md`:

```markdown
# 040 · download-avatar-renders  ·  [HUMAN] gate + [RUN] download

- **In:** step 030's HeyGen manifest (needs real `video_id`s — check HeyGen yourself first)
- **Out:** `output/videos/intro.mp4`, `body.mp4`, `conclusion.mp4`
- **Run:** `python3 download.py [<video_title>]` then `python3 check.py [<video_title>]`
- **Next:** step 050 packages + uploads the 3 files back to Drive

`heygen-web download <video_id>` is fully wired for real (unlike step 030's submit) — this step
works today for any job that has a real `video_id`.
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-human/download.py`:

```python
#!/usr/bin/env python3
"""
Step 040 — download finished HeyGen renders.  [RUN] side of the [HUMAN] gate.

  python3 download.py [<video_title>]

Reads:  ../030-submit-avatar-renders-run/output/<video_title>.heygen-manifest.json
Writes: output/videos/<segment>.mp4   (idempotent — skips any .mp4 already present)
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import heygen                                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
VIDEOS = HERE / "output" / "videos"
S030_OUT = ROOT / "steps/030-submit-avatar-renders-run/output"


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S030_OUT.glob("*.heygen-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 030 first (no manifest in {S030_OUT})")
    return cands[0].name.split(".heygen-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S030_OUT / f"{title}.heygen-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 030 first ({mpath})")
    jobs = json.loads(mpath.read_text())["jobs"]

    cli = heygen.resolve_cli()
    VIDEOS.mkdir(parents=True, exist_ok=True)
    done = pending = 0
    for j in jobs:
        dest = VIDEOS / f"{j['segment']}.mp4"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        if not j.get("video_id"):
            pending += 1
            print(f"   … {j['segment']} has no video_id yet (submit not wired / not finished)")
            continue
        if heygen.download(cli, j["video_id"], dest):
            done += 1; print(f"   ✓ {dest.name}")
        else:
            pending += 1; print(f"   … {j['segment']} not ready yet")
    print(f"✓ downloaded {done}, {pending} pending.")
    print("→ run check.py to confirm all 3 are present, then step 050 packages + uploads them")


if __name__ == "__main__":
    main()
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-human/check.py`:

```python
#!/usr/bin/env python3
"""Step 040 — download checklist. [HUMAN] gate helper.

  python3 check.py [<video_title>]

Exit 0 when all 3 segments are present in output/videos/, exit 1 otherwise.
"""
import sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VIDEOS = HERE / "output" / "videos"
S030_OUT = ROOT / "steps/030-submit-avatar-renders-run/output"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S030_OUT.glob("*.heygen-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 030 first (no manifest in {S030_OUT})")
    return cands[0].name.split(".heygen-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    VIDEOS.mkdir(parents=True, exist_ok=True)
    present = missing = 0
    print(f"video: {title} · drop downloaded .mp4s in {VIDEOS}\n")
    for seg in SEGMENTS:
        f = VIDEOS / f"{seg}.mp4"
        ok = f.exists() and f.stat().st_size > 0
        present += ok; missing += (not ok)
        print(f"  {'✓' if ok else '✗'} {seg}.mp4")
    print(f"\n{present} present, {missing} missing")
    if missing:
        print("→ download the ✗ files from HeyGen into output/videos/, then re-run check.py")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/steps/040-download-avatar-renders-human/*.py` → exit 0.

### Step 8: Step 050 — `package-and-upload-run`

Create `pipelines/youtube/tutorial-pipeline-1/steps/050-package-and-upload-run/README.md`:

```markdown
# 050 · package-and-upload  ·  [RUN]  (last step)

- **In:** step 040's downloaded segment renders + step 010's manifest (for the source folder id)
- **Out:** `output/spokesperson_intro.mp4`, `spokesperson_body.mp4`, `spokesperson_conclusion.mp4`
  — locally AND uploaded into an `output/` subfolder of the source Drive folder (find-or-created;
  mirrors step 010 reading segments from an `input/` subfolder)
- **Run:** `python3 run.py [<video_title>] [--account EMAIL]`
```

Create `pipelines/youtube/tutorial-pipeline-1/steps/050-package-and-upload-run/run.py`:

```python
#!/usr/bin/env python3
"""
Step 050 — package spokesperson clips + upload back to Drive.  [RUN]  (last step)

  python3 run.py [<video_title>] [--account EMAIL]

Reads:  ../040-download-avatar-renders-human/output/videos/{intro,body,conclusion}.mp4
        ../010-resolve-drive-input-run/output/<video_title>.input-manifest.json  (for folder_id)
Writes: output/spokesperson_intro.mp4, output/spokesperson_body.mp4, output/spokesperson_conclusion.mp4
        + uploads each into an output/ subfolder of the source Drive folder (find-or-created)
"""
import sys, json, shutil, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import drive                                             # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S010_OUT = ROOT / "steps/010-resolve-drive-input-run/output"
S040_VIDEOS = ROOT / "steps/040-download-avatar-renders-human/output/videos"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S010_OUT.glob("*.input-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 010 first (no manifest in {S010_OUT})")
    return cands[0].name.split(".input-manifest.json")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video_title", nargs="?")
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com")
    ap.add_argument("--drive-cli", default=None)
    a = ap.parse_args()

    title = infer_title(a.video_title)
    input_manifest = json.loads((S010_OUT / f"{title}.input-manifest.json").read_text())
    folder_id = input_manifest["folder_id"]

    cli = drive.resolve_cli(a.drive_cli)
    output_id = drive.ensure_folder(cli, "output", folder_id, a.account)
    OUT.mkdir(parents=True, exist_ok=True)
    for seg in SEGMENTS:
        src = S040_VIDEOS / f"{seg}.mp4"
        if not src.exists():
            die(f"missing {src} — run step 040 (and its check.py) first")
        dest = OUT / f"spokesperson_{seg}.mp4"
        shutil.copyfile(src, dest)
        drive.upload(cli, dest, output_id, a.account, overwrite=True)
        print(f"  ⬆ {dest.name} → Drive folder output/")

    print(f"✓ packaged + uploaded 3 spokesperson clips for {title} → {drive.link(output_id)}")


if __name__ == "__main__":
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/tutorial-pipeline-1/steps/050-package-and-upload-run/run.py` → exit 0.

### Step 9: `scripts/check.sh` + register in `pipelines/CLAUDE.md`

Create `pipelines/youtube/tutorial-pipeline-1/scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
PIPE="$REPO/pipelines/youtube/tutorial-pipeline-1"
cd "$PIPE"

echo "→ python syntax check"
python3 -m py_compile lib/*.py shared/*.py steps/*/*.py

echo "→ node syntax check"
node --check "$REPO/tooling/cli/heygen-web/heygen-web.mjs"

echo "→ pp-drive syntax check"
python3 -m py_compile "$REPO/tooling/cli/drive/pp_drive.py"

echo "→ structure check"
for f in PIPELINE.md lib/drive.py lib/audio.py lib/heygen.py shared/avatar_mapping.py; do
  [ -f "$f" ] || { echo "✖ missing $f"; exit 1; }
done
for d in steps/010-resolve-drive-input-run steps/020-extract-audio-run \
         steps/030-submit-avatar-renders-run steps/040-download-avatar-renders-human \
         steps/050-package-and-upload-run; do
  [ -d "$d" ] || { echo "✖ missing $d"; exit 1; }
done

echo "✓ all checks passed"
```

Make it executable: `chmod +x pipelines/youtube/tutorial-pipeline-1/scripts/check.sh`.

In `pipelines/CLAUDE.md`, add a row right after the `kushal-tutorial-pipeline-v2` /
`tutorial-pipeline-2` row in the folder map table:

```markdown
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/tutorial-pipeline-1/`](youtube/tutorial-pipeline-1/PIPELINE.md) | Drive-in → HeyGen spokesperson clips (existing avatar + own audio) → Drive-out | Python + Node (heygen-web) |
```

**Verify**: `bash pipelines/youtube/tutorial-pipeline-1/scripts/check.sh` → prints `✓ all checks
passed`, exit 0.

## Test plan

No unit tests — every script shells out to a real Drive/HeyGen account, so there is nothing to
mock meaningfully without real credentials. Verification is: (1) every `.py` file compiles, (2) the
extended `heygen-web.mjs` parses, (3) the full step/lib/shared structure exists. This matches how
`tutorial-pipeline-2` was verified when it landed — no test suite there either.

## Done criteria

- [ ] `bash pipelines/youtube/tutorial-pipeline-1/scripts/check.sh` exits 0 and prints `✓ all
      checks passed`.
- [ ] `pp-drive stat|list-folder|download` subcommands exist and `python3 -m py_compile
      tooling/cli/drive/pp_drive.py` passes.
- [ ] `heygen-web.mjs` has `generate-from-audio` in its `help` text and dispatch `switch`, and
      `node --check` passes.
- [ ] `pipelines/CLAUDE.md` lists the new pipeline.
- [ ] No file under `pipelines/youtube/tutorial-pipeline-2/` was touched (`git diff --stat
      c8afcb2..HEAD -- pipelines/youtube/tutorial-pipeline-2` is empty).

## STOP conditions

- **Never run any step's `run.py`/`download.py` against a real Drive or HeyGen account** as part
  of building or verifying this plan — verification is syntax + structure checks only (see
  "Commands you will need"). Stop and report if you find yourself needing real credentials to
  verify a Done criterion; that means the criterion is mis-specified, not that you should proceed.
- **Do not implement `submitAudioGenerate()`'s real HTTP body**, and do not guess a plausible-looking
  HeyGen endpoint/payload for it. Leave it exactly as the `[TODO][HNS]` stub specified in Step 2.
  This mirrors `tooling/cli/heygen-web/HANDOVER.md`'s explicit rule ("do not guess and fire
  candidate generate URLs") — an unconfirmed guess against a live paid account is the one thing
  this plan must not risk.
- **Do not touch `pipelines/youtube/tutorial-pipeline-2/`** or any file inside it.
- **Do not touch `infra/secrets/`** or any credentials file.
- If `pp_drive.py` or `heygen-web.mjs` have drifted materially from the excerpts quoted in this
  plan (beyond trivial line-number shifts), stop and report the diff rather than guessing how to
  reconcile it.

## Maintenance notes

- The one thing standing between this pipeline and being fully live is a single HAR capture: open
  the HeyGen editor, pick an existing avatar, upload an audio file, hit Generate, with DevTools
  **Preserve Log ON**, then fill in `submitAudioGenerate()` in `heygen-web.mjs` from that capture.
  The owner has stated they believe they've done this successfully before manually — if so, that
  capture should be quick to redo.
- `shared/avatar_mapping.py SEGMENT_ENGINE`'s intro/conclusion→HeyGen4, body→HeyGen3 default is an
  inferred convention (mirrors `tutorial-pipeline-2`'s a4/a3 split), not a rule the owner explicitly
  fixed — a future session should feel free to change it in one place.
- Once `generate-from-audio` is wired for real, revisit `PACING` in step 030 (`min_gap`/`max_gap`/
  `settle_every`) against whatever ban-risk signal the owner observes, same as
  `tutorial-pipeline-2/shared/heygen_config.py`'s `PACING` block.
- If a future need arises to feed this pipeline's spokesperson clips INTO `tutorial-pipeline-2`
  (the owner explicitly ruled this out for the initial build — standalone only), that's a new,
  separate plan, not a retrofit of this one.
