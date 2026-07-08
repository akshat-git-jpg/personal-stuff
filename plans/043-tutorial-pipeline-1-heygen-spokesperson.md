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
    with a `generate-from-audio` command — **real, HAR-verified implementation for `heygen3`**
    (Avatar III, unlimited) as of 2026-07-07; `heygen4` (Avatar IV, metered) remains a stub.
- **Executor proposed**: `agy` (Gemini-backed by default) — owner's explicit choice, overriding
  `tooling/boss/data/rules.md`'s `standard`-difficulty default of `claude-p`/`sonnet`.
- **Done criteria** (terse — full list below): `scripts/check.sh` passes (py_compile + `node
  --check` + structure check + the 2 new template JSONs parse); `pp-drive` has
  `stat`/`list-folder`/`download`; `heygen-web.mjs` has a real `generate-from-audio` (`heygen3`)
  wired into help + dispatch; `pipelines/CLAUDE.md` lists the pipeline; `tutorial-pipeline-2/`
  untouched.
- **Stop conditions** (terse — full list below): never run any step against a real Drive/HeyGen
  account during build/verify (syntax-only); never guess or implement the `heygen4` HTTP body
  (no HAR exists for it — leave it a `[TODO][HNS]` stub); never touch `tutorial-pipeline-2/` or
  `infra/secrets/`.
- **Test / verification for success**: syntax + structure checks only (`python3 -m py_compile`,
  `node --check`, JSON template parse, file/dir existence) — no live-account calls, no unit test
  suite (matches how `tutorial-pipeline-2` itself was verified when it landed).
- **Open points for plan readiness**: none. (`heygen4` staying a `[TODO][HNS]` stub is a
  deliberate scope decision, not an open question — see Maintenance notes for the usage
  implication and how to close it later.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c8afcb2..HEAD -- pipelines/youtube/tutorial-pipeline-1 tooling/cli/drive/pp_drive.py tooling/cli/drive/README.md tooling/cli/heygen-web/heygen-web.mjs tooling/cli/heygen-web/README.md tooling/cli/heygen-web/HANDOVER.md tooling/cli/heygen-web/studio-templates pipelines/CLAUDE.md`

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
`tutorial-pipeline-2`, no dependency between them) that automates the whole thing end to end. The
one HeyGen request that had never been captured — uploading arbitrary audio and rendering it on an
already-created avatar — was captured by the owner in a real HAR on 2026-07-07 (see "Current state"
below); this plan now ships a **real, verified implementation** for that path on `heygen3` (Avatar
III, unlimited), with `heygen4` (Avatar IV, metered) left as the one remaining documented stub.

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

**Update (2026-07-07) — the gap above is now resolved for `heygen3`.** The owner captured a real
HAR (`app.heygen.com11.har`, Preserve Log ON) of exactly the flow described above: upload local
audio, existing avatar, hit Generate. It also captures `text_draft.generate` — the actual "Generate"
endpoint `HANDOVER.md` said had never been captured (only `text_draft.scene_avatar_preview`, the
in-editor preview, existed before). Step 2 below now contains the real implementation — audio
upload (`/v1/file/url.get` → S3 PUT → `/v1/file.upload`), HeyGen's own ASR (`/v1/audio/fast_asr` —
no local Whisper/Groq step needed), and the render kickoff (`/v1/text_draft.generate`) — verified
line-by-line against the HAR, not guessed. **`heygen4` (Avatar IV, metered) is still a stub** — the
HAR only exercised Avatar III (`engine:"avatar_iii"`, `use_unlimited_mode:true`); `generate-from-audio
--engine heygen4` raises a `[TODO][HNS]` error until its own HAR is captured, same convention as
`tutorial-pipeline-2/lib/heygen.py`'s stubs (`plans/README.md` backlog item `PIPE-01`).

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
| New template JSONs parse | `python3 -c "import json; json.load(open('tooling/cli/heygen-web/studio-templates/generate-audio-save.json')); json.load(open('tooling/cli/heygen-web/studio-templates/generate-audio-generate.json'))"` | exit 0, no output |

**Do not** run any step's `run.py` against real Drive/HeyGen accounts as part of verification — see
STOP conditions. Verification in this plan is syntax + structure only.

## Scope

**In scope**:
- New folder `pipelines/youtube/tutorial-pipeline-1/` (everything under it).
- `tooling/cli/drive/pp_drive.py` + `tooling/cli/drive/README.md` — add `stat`, `list-folder`,
  `download` subcommands.
- `tooling/cli/heygen-web/heygen-web.mjs` + `tooling/cli/heygen-web/README.md` +
  `tooling/cli/heygen-web/HANDOVER.md` — add a real `generate-from-audio` (`heygen3` path) plus
  its two new template files, `tooling/cli/heygen-web/studio-templates/generate-audio-save.json`
  and `generate-audio-generate.json`.
- `pipelines/CLAUDE.md` — add the new pipeline's row to the folder map table.

**Out of scope**:
- `pipelines/youtube/tutorial-pipeline-2/` (renamed sibling) — do not touch any file in it.
- Implementing the `heygen4` HTTP body, or any real HeyGen avatar/voice ids for
  `shared/avatar_mapping.py` — `heygen4` needs its own HAR capture and real credentials, both
  owner-only actions (see STOP conditions); avatar ids are the owner's to fill in.
- `infra/secrets/heygen-web-curls.txt`, `infra/secrets/heygen-usage-last.json`, or any other
  secrets file.
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

### Step 2: Add `generate-from-audio` to `heygen-web.mjs` — REAL implementation (HAR-verified 2026-07-07)

**Update (2026-07-07): this is no longer a stub for the `heygen3` (Avatar III, unlimited) path.**
The owner captured a real HAR (`app.heygen.com11.har`, Preserve Log ON) of: upload a local audio
file → HeyGen's own ASR transcribes it → render it on an **existing** avatar (not a new
`create-photo-avatar`). This also happens to capture the endpoint `HANDOVER.md` flagged as the
permanent gap in `studio-render` (`text_draft.generate`, the actual "Generate" button — previously
only `text_draft.scene_avatar_preview`, the in-editor preview, had ever been captured). The
`heygen4` (Avatar IV, metered) path is **still a stub** — the HAR only exercised Avatar III.

The full chain, verified from the HAR (entries referenced by HAR index for traceability):
1. `GET /v1/file/url.get?file_type=audio&filename=<name>&content_type=audio%2Fwav&properties%5Baudio_source%5D=voice_recording`
   → `{data: {id, key, url (presigned S3 PUT), download_url}}` [HAR #155]
2. `PUT <presigned url>` — raw audio bytes, headers `Content-Type: audio/wav`,
   `x-amz-server-side-encryption: AES256` (same S3 signing quirk as `create-photo-avatar`'s image
   upload) [HAR #159]
3. `POST /v1/file.upload` body `{name, id, file_type:"audio", content_type, filename,
   properties:{audio_source:"voice_recording"}}` → `{data: {id: <asset_id>, url}}` [HAR #161]
4. `POST /v1/audio/fast_asr` body `{"url": "<download_url with original.mp3 swapped for
   transcode.mp3, plus a content-disposition query string>"}` → `{data: {data: {words, text,
   duration, language}}}` — **this is HeyGen's own ASR**, so this pipeline needs no local
   Whisper/Groq step for the avatar's lip-sync transcript [HAR #173]
5. `POST /v1/text_draft.create` → `{data: {video_id}}` (unchanged from `studio-render`) [HAR #178]
6. `POST /v1/text_draft.save` — full scene doc, avatar + uploaded-audio filled in [HAR #247]
7. `POST /v1/text_draft.generate` body `{video_id, enable_watermark:false, generate_type:"normal",
   version_id:<client-generated random token — NOT server-issued, confirmed by tracing every
   `text_draft.save`/`.create` response in the HAR and finding no match>, draft_details:{title,
   text_draft_with_metadata:{text_draft, metadata}}, complete_tts_in_backend:true}` →
   `{data: {video_id, status:"pending"}}` — **the actual render kickoff** [HAR #255]

Create `tooling/cli/heygen-web/studio-templates/generate-audio-save.json` with this **exact**
content (a real captured `text_draft.save` body, tokenized — mirrors how `save.json`/`preview.json`
already work: `__AVATAR_ID__` is blanket-substituted even inside cosmetic preview-image URLs,
proven harmless per `HANDOVER.md`'s own note that the render drives off the real id fields):

```json
{
 "video_id": "__VIDEO_ID__",
 "text_draft": {
  "script": {
   "elements": {
    "p3uQXbqx": {
     "id": "p3uQXbqx",
     "type": "audio",
     "text": "__AUDIO_TEXT__",
     "attributes": {
      "src": "__AUDIO_URL__",
      "voice_id": "__VOICE_ID__",
      "voice_settings": {
       "locale": "",
       "pitch": 0,
       "speed": 1,
       "volume": 1,
       "voice_engine_settings": {
        "engine_type": "elevenLabsV3",
        "seed": 2613764667
       }
      }
     },
     "voice_mirroring": false
    }
   },
   "timeline": [
    "p3uQXbqx"
   ],
   "brand_kit_id": "d4b4e72235224eb486f5066139cfa60d"
  },
  "captions": {
   "elements": {},
   "remove_punctuation": false
  },
  "background_audio": {
   "elements": {}
  },
  "visual": {
   "elements": {
    "zffBPsHA": {
     "id": "zffBPsHA",
     "type": "scene",
     "content": {
      "elements": [
       "Qh1Uwlho"
      ],
      "background_color": "#FFFFFF"
     }
    },
    "Qh1Uwlho": {
     "id": "Qh1Uwlho",
     "type": "avatar",
     "attributes": {
      "animations": [],
      "opacity": 1,
      "position": {
       "offset": {
        "x": 0,
        "y": 0
       },
       "type": "center"
      },
      "size": {
       "fit": "none",
       "scale": {
        "x": 0.8,
        "y": 0.8
       },
       "crop": {
        "top": 0,
        "left": 0,
        "bottom": 0,
        "right": 0
       }
      },
      "transformation": {
       "rotate": {
        "angle": 0
       }
      },
      "rounded_corners": {
       "top_left": 0,
       "top_right": 0,
       "bottom_right": 0,
       "bottom_left": 0
      }
     },
     "content": {
      "avatar_id": "__AVATAR_ID__",
      "avatar_state_id": "__AVATAR_ID__",
      "render_type": "normal",
      "avatar_type": "photo_avatar",
      "avatar_group_id": "__AVATAR_ID__",
      "matting": false,
      "talking_photo": {
       "enhance": false
      },
      "inference_mp4": "",
      "inference_webm": "",
      "inference_job_id": "",
      "gesture_mp4": "",
      "gesture_webm": "",
      "use_avatar_iv_model": false,
      "use_unlimited_mode": true,
      "engine": "avatar_iii",
      "engine_settings": {
       "engine_type": "avatar_iii"
      },
      "inference_packed_mp4": ""
     }
    }
   },
   "layout": [
    "zffBPsHA"
   ]
  },
  "alignments": {
   "zffBPsHA": {
    "element_id": "zffBPsHA",
    "alignment_info": {
     "start": {
      "script_id": "p3uQXbqx",
      "word_index": 0
     },
     "end": {
      "script_id": "p3uQXbqx",
      "word_index": -1
     }
    }
   },
   "Qh1Uwlho": {
    "element_id": "Qh1Uwlho",
    "alignment_info": {
     "start": {
      "script_id": "p3uQXbqx",
      "word_index": 0
     },
     "end": {
      "script_id": "p3uQXbqx",
      "word_index": -1
     }
    },
    "gesture_alignments": []
   }
  }
 },
 "video_output": {
  "resolution": {
   "width": 1080,
   "height": 1920
  },
  "fps": 25,
  "caption": false
 },
 "metadata": [
  {
   "element_id": "p3uQXbqx",
   "type": "audio",
   "seed": 2613764667,
   "url": "__AUDIO_URL__",
   "duration": 28.676854,
   "words": [
    {
     "word": "<start>",
     "start_time": 0,
     "end_time": 0
    },
    {
     "word": "The",
     "start_time": 0.039,
     "end_time": 0.14
    },
    {
     "word": "scarlet",
     "start_time": 0.179,
     "end_time": 0.62
    },
    {
     "word": "rot",
     "start_time": 0.719,
     "end_time": 0.959
    },
    {
     "word": "is",
     "start_time": 1,
     "end_time": 1.1
    },
    {
     "word": "not",
     "start_time": 1.179,
     "end_time": 1.359
    },
    {
     "word": "like",
     "start_time": 1.419,
     "end_time": 1.559
    },
    {
     "word": "the",
     "start_time": 1.599,
     "end_time": 1.639
    },
    {
     "word": "common",
     "start_time": 1.74,
     "end_time": 2.059
    },
    {
     "word": "poisons",
     "start_time": 2.139,
     "end_time": 2.639
    },
    {
     "word": "found",
     "start_time": 2.759,
     "end_time": 2.98
    },
    {
     "word": "in",
     "start_time": 3.039,
     "end_time": 3.119
    },
    {
     "word": "the",
     "start_time": 3.139,
     "end_time": 3.179
    },
    {
     "word": "world.",
     "start_time": 3.299,
     "end_time": 3.679
    },
    {
     "word": "It",
     "start_time": 4.119,
     "end_time": 4.199
    },
    {
     "word": "is",
     "start_time": 4.239,
     "end_time": 4.359
    },
    {
     "word": "an",
     "start_time": 4.4,
     "end_time": 4.46
    },
    {
     "word": "unstoppable",
     "start_time": 4.519,
     "end_time": 5.319
    },
    {
     "word": "tide,",
     "start_time": 5.48,
     "end_time": 5.879
    },
    {
     "word": "the",
     "start_time": 6.279,
     "end_time": 6.379
    },
    {
     "word": "purest",
     "start_time": 6.48,
     "end_time": 6.879
    },
    {
     "word": "expression",
     "start_time": 6.98,
     "end_time": 7.539
    },
    {
     "word": "of",
     "start_time": 7.579,
     "end_time": 7.699
    },
    {
     "word": "this",
     "start_time": 7.739,
     "end_time": 7.879
    },
    {
     "word": "deity's",
     "start_time": 8.019,
     "end_time": 8.519
    },
    {
     "word": "power.",
     "start_time": 8.599,
     "end_time": 8.939
    },
    {
     "word": "Where",
     "start_time": 9.399,
     "end_time": 9.519
    },
    {
     "word": "the",
     "start_time": 9.559,
     "end_time": 9.599
    },
    {
     "word": "rot",
     "start_time": 9.719,
     "end_time": 9.88
    },
    {
     "word": "takes",
     "start_time": 10,
     "end_time": 10.28
    },
    {
     "word": "hold,",
     "start_time": 10.359,
     "end_time": 10.719
    },
    {
     "word": "life",
     "start_time": 10.859,
     "end_time": 11.119
    },
    {
     "word": "is",
     "start_time": 11.159,
     "end_time": 11.279
    },
    {
     "word": "eviscerated,",
     "start_time": 11.399,
     "end_time": 12.139
    },
    {
     "word": "yes,",
     "start_time": 12.239,
     "end_time": 12.619
    },
    {
     "word": "but",
     "start_time": 12.88,
     "end_time": 13.02
    },
    {
     "word": "from",
     "start_time": 13.039,
     "end_time": 13.199
    },
    {
     "word": "that",
     "start_time": 13.239,
     "end_time": 13.5
    },
    {
     "word": "death,",
     "start_time": 13.539,
     "end_time": 13.859
    },
    {
     "word": "new",
     "start_time": 14.019,
     "end_time": 14.239
    },
    {
     "word": "life",
     "start_time": 14.279,
     "end_time": 14.619
    },
    {
     "word": "begins",
     "start_time": 14.679,
     "end_time": 15.06
    },
    {
     "word": "to",
     "start_time": 15.079,
     "end_time": 15.239
    },
    {
     "word": "stir.",
     "start_time": 15.259,
     "end_time": 15.659
    },
    {
     "word": "From",
     "start_time": 15.859,
     "end_time": 16
    },
    {
     "word": "the",
     "start_time": 16.02,
     "end_time": 16.119
    },
    {
     "word": "corpses",
     "start_time": 16.199,
     "end_time": 16.699
    },
    {
     "word": "rise",
     "start_time": 16.819,
     "end_time": 17.1
    },
    {
     "word": "the",
     "start_time": 17.139,
     "end_time": 17.219
    },
    {
     "word": "kindred",
     "start_time": 17.279,
     "end_time": 17.659
    },
    {
     "word": "of",
     "start_time": 17.699,
     "end_time": 17.819
    },
    {
     "word": "rot,",
     "start_time": 17.899,
     "end_time": 18.219
    },
    {
     "word": "skittering",
     "start_time": 18.619,
     "end_time": 19.119
    },
    {
     "word": "beings",
     "start_time": 19.18,
     "end_time": 19.62
    },
    {
     "word": "that",
     "start_time": 19.659,
     "end_time": 19.78
    },
    {
     "word": "resemble",
     "start_time": 19.799,
     "end_time": 20.359
    },
    {
     "word": "silverfish",
     "start_time": 20.42,
     "end_time": 21.119
    },
    {
     "word": "or",
     "start_time": 21.18,
     "end_time": 21.34
    },
    {
     "word": "cockroaches.",
     "start_time": 21.399,
     "end_time": 22.319
    },
    {
     "word": "It",
     "start_time": 22.619,
     "end_time": 22.719
    },
    {
     "word": "mirrors",
     "start_time": 22.819,
     "end_time": 23.139
    },
    {
     "word": "the",
     "start_time": 23.18,
     "end_time": 23.259
    },
    {
     "word": "way",
     "start_time": 23.299,
     "end_time": 23.44
    },
    {
     "word": "of",
     "start_time": 23.459,
     "end_time": 23.579
    },
    {
     "word": "our",
     "start_time": 23.619,
     "end_time": 23.739
    },
    {
     "word": "own",
     "start_time": 23.819,
     "end_time": 24.019
    },
    {
     "word": "world",
     "start_time": 24.059,
     "end_time": 24.399
    },
    {
     "word": "where",
     "start_time": 24.479,
     "end_time": 24.639
    },
    {
     "word": "bacteria",
     "start_time": 24.659,
     "end_time": 25.399
    },
    {
     "word": "and",
     "start_time": 25.439,
     "end_time": 25.6
    },
    {
     "word": "carrion",
     "start_time": 25.619,
     "end_time": 26.079
    },
    {
     "word": "eaters",
     "start_time": 26.119,
     "end_time": 26.44
    },
    {
     "word": "flourish",
     "start_time": 26.559,
     "end_time": 27
    },
    {
     "word": "upon",
     "start_time": 27.039,
     "end_time": 27.28
    },
    {
     "word": "the",
     "start_time": 27.299,
     "end_time": 27.359
    },
    {
     "word": "remains",
     "start_time": 27.399,
     "end_time": 27.819
    },
    {
     "word": "of",
     "start_time": 27.84,
     "end_time": 27.959
    },
    {
     "word": "the",
     "start_time": 27.979,
     "end_time": 28.099
    },
    {
     "word": "fallen.",
     "start_time": 28.18,
     "end_time": 28.559
    },
    {
     "word": "<end>",
     "start_time": 28.676854,
     "end_time": 28.676854
    }
   ],
   "text": "__AUDIO_TEXT__",
   "name": "Audio_File_37b23d.wav",
   "fileType": "upload",
   "source_audio_url": "__AUDIO_URL__"
  },
  {
   "element_id": "Qh1Uwlho",
   "type": "avatar",
   "avatar_type": "photo_avatar",
   "name": "girl looking down test 3",
   "pose_name": "girl looking down test 3",
   "avatar_name": "girl looking down test 3",
   "avatar_group_name": "girl looking down test 3",
   "is_motion": true,
   "is_avatar_iv_motion": true,
   "crop_box_crop_x": {},
   "preview_image_url": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H",
   "preview_video_url": "",
   "blurred_lips_mp4": "",
   "blurred_lips_webm": "",
   "fps": 25,
   "avatar_state_id": "__AVATAR_ID__",
   "available_style": {
    "normal": true,
    "circle": true,
    "close_up": true,
    "closeUp": true
   },
   "enable_matting": true,
   "has_alpha": false,
   "enable_enhance": true,
   "enable_4k": false,
   "enable_eye_contact": false,
   "preview": {
    "normal": {
     "size": {
      "width": 1792,
      "height": 2400
     },
     "src": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H"
    }
   },
   "crop_rect": {
    "circle": {
     "x": 0,
     "y": 24.444444444444446,
     "width": 1774.213399503722,
     "height": 1773.3333333333335
    },
    "close_up": {
     "x": 0,
     "y": 24.444444444444446,
     "width": 1774.213399503722,
     "height": 1773.3333333333335
    }
   },
   "is_private": true,
   "support_avatar_iv": true,
   "unlimited_mode_disabled": false,
   "unlimited_mode_disabled_reason": null,
   "photo_avatar_metadata": {
    "photar_version": "V3"
   },
   "width": 1792,
   "height": 2400,
   "natural_width": 1792,
   "natural_height": 2400,
   "processed_image_url": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H"
  },
  {
   "type": "scene",
   "element_id": "zffBPsHA"
  }
 ],
 "title": "__TITLE__",
 "skip_rate_limit": false,
 "has_faceswap": false
}
```

Create `tooling/cli/heygen-web/studio-templates/generate-audio-generate.json` (the tokenized
`text_draft.generate` body):

```json
{
 "video_id": "__VIDEO_ID__",
 "enable_watermark": false,
 "generate_type": "normal",
 "version_id": "__VERSION_ID__",
 "draft_details": {
  "title": "__TITLE__",
  "text_draft_with_metadata": {
   "text_draft": {
    "script": {
     "elements": {
      "p3uQXbqx": {
       "id": "p3uQXbqx",
       "type": "audio",
       "text": "__AUDIO_TEXT__",
       "attributes": {
        "src": "__AUDIO_URL__",
        "voice_id": "__VOICE_ID__",
        "voice_settings": {
         "locale": "",
         "pitch": 0,
         "speed": 1,
         "volume": 1,
         "voice_engine_settings": {
          "engine_type": "elevenLabsV3",
          "seed": 2613764667
         }
        }
       },
       "voice_mirroring": false
      }
     },
     "timeline": [
      "p3uQXbqx"
     ],
     "brand_kit_id": "d4b4e72235224eb486f5066139cfa60d"
    },
    "captions": {
     "elements": {},
     "remove_punctuation": false
    },
    "background_audio": {
     "elements": {}
    },
    "visual": {
     "elements": {
      "zffBPsHA": {
       "id": "zffBPsHA",
       "type": "scene",
       "content": {
        "elements": [
         "Qh1Uwlho"
        ],
        "background_color": "#FFFFFF"
       }
      },
      "Qh1Uwlho": {
       "id": "Qh1Uwlho",
       "type": "avatar",
       "attributes": {
        "animations": [],
        "opacity": 1,
        "position": {
         "offset": {
          "x": 0,
          "y": 0
         },
         "type": "center"
        },
        "size": {
         "fit": "none",
         "scale": {
          "x": 0.8,
          "y": 0.8
         },
         "crop": {
          "top": 0,
          "left": 0,
          "bottom": 0,
          "right": 0
         }
        },
        "transformation": {
         "rotate": {
          "angle": 0
         }
        },
        "rounded_corners": {
         "top_left": 0,
         "top_right": 0,
         "bottom_right": 0,
         "bottom_left": 0
        }
       },
       "content": {
        "avatar_id": "__AVATAR_ID__",
        "avatar_state_id": "__AVATAR_ID__",
        "render_type": "normal",
        "avatar_type": "photo_avatar",
        "avatar_group_id": "__AVATAR_ID__",
        "matting": false,
        "talking_photo": {
         "enhance": false
        },
        "inference_mp4": "",
        "inference_webm": "",
        "inference_job_id": "",
        "gesture_mp4": "",
        "gesture_webm": "",
        "use_avatar_iv_model": false,
        "use_unlimited_mode": true,
        "engine": "avatar_iii",
        "engine_settings": {
         "engine_type": "avatar_iii"
        },
        "inference_packed_mp4": ""
       }
      }
     },
     "layout": [
      "zffBPsHA"
     ]
    },
    "alignments": {
     "zffBPsHA": {
      "element_id": "zffBPsHA",
      "alignment_info": {
       "start": {
        "script_id": "p3uQXbqx",
        "word_index": 0
       },
       "end": {
        "script_id": "p3uQXbqx",
        "word_index": -1
       }
      }
     },
     "Qh1Uwlho": {
      "element_id": "Qh1Uwlho",
      "alignment_info": {
       "start": {
        "script_id": "p3uQXbqx",
        "word_index": 0
       },
       "end": {
        "script_id": "p3uQXbqx",
        "word_index": -1
       }
      },
      "gesture_alignments": []
     }
    }
   },
   "metadata": {
    "p3uQXbqx": {
     "element_id": "p3uQXbqx",
     "type": "audio",
     "seed": 2613764667,
     "url": "__AUDIO_URL__",
     "duration": 28.676854,
     "words": [
      {
       "word": "<start>",
       "start_time": 0,
       "end_time": 0
      },
      {
       "word": "The",
       "start_time": 0.039,
       "end_time": 0.14
      },
      {
       "word": "scarlet",
       "start_time": 0.179,
       "end_time": 0.62
      },
      {
       "word": "rot",
       "start_time": 0.719,
       "end_time": 0.959
      },
      {
       "word": "is",
       "start_time": 1,
       "end_time": 1.1
      },
      {
       "word": "not",
       "start_time": 1.179,
       "end_time": 1.359
      },
      {
       "word": "like",
       "start_time": 1.419,
       "end_time": 1.559
      },
      {
       "word": "the",
       "start_time": 1.599,
       "end_time": 1.639
      },
      {
       "word": "common",
       "start_time": 1.74,
       "end_time": 2.059
      },
      {
       "word": "poisons",
       "start_time": 2.139,
       "end_time": 2.639
      },
      {
       "word": "found",
       "start_time": 2.759,
       "end_time": 2.98
      },
      {
       "word": "in",
       "start_time": 3.039,
       "end_time": 3.119
      },
      {
       "word": "the",
       "start_time": 3.139,
       "end_time": 3.179
      },
      {
       "word": "world.",
       "start_time": 3.299,
       "end_time": 3.679
      },
      {
       "word": "It",
       "start_time": 4.119,
       "end_time": 4.199
      },
      {
       "word": "is",
       "start_time": 4.239,
       "end_time": 4.359
      },
      {
       "word": "an",
       "start_time": 4.4,
       "end_time": 4.46
      },
      {
       "word": "unstoppable",
       "start_time": 4.519,
       "end_time": 5.319
      },
      {
       "word": "tide,",
       "start_time": 5.48,
       "end_time": 5.879
      },
      {
       "word": "the",
       "start_time": 6.279,
       "end_time": 6.379
      },
      {
       "word": "purest",
       "start_time": 6.48,
       "end_time": 6.879
      },
      {
       "word": "expression",
       "start_time": 6.98,
       "end_time": 7.539
      },
      {
       "word": "of",
       "start_time": 7.579,
       "end_time": 7.699
      },
      {
       "word": "this",
       "start_time": 7.739,
       "end_time": 7.879
      },
      {
       "word": "deity's",
       "start_time": 8.019,
       "end_time": 8.519
      },
      {
       "word": "power.",
       "start_time": 8.599,
       "end_time": 8.939
      },
      {
       "word": "Where",
       "start_time": 9.399,
       "end_time": 9.519
      },
      {
       "word": "the",
       "start_time": 9.559,
       "end_time": 9.599
      },
      {
       "word": "rot",
       "start_time": 9.719,
       "end_time": 9.88
      },
      {
       "word": "takes",
       "start_time": 10,
       "end_time": 10.28
      },
      {
       "word": "hold,",
       "start_time": 10.359,
       "end_time": 10.719
      },
      {
       "word": "life",
       "start_time": 10.859,
       "end_time": 11.119
      },
      {
       "word": "is",
       "start_time": 11.159,
       "end_time": 11.279
      },
      {
       "word": "eviscerated,",
       "start_time": 11.399,
       "end_time": 12.139
      },
      {
       "word": "yes,",
       "start_time": 12.239,
       "end_time": 12.619
      },
      {
       "word": "but",
       "start_time": 12.88,
       "end_time": 13.02
      },
      {
       "word": "from",
       "start_time": 13.039,
       "end_time": 13.199
      },
      {
       "word": "that",
       "start_time": 13.239,
       "end_time": 13.5
      },
      {
       "word": "death,",
       "start_time": 13.539,
       "end_time": 13.859
      },
      {
       "word": "new",
       "start_time": 14.019,
       "end_time": 14.239
      },
      {
       "word": "life",
       "start_time": 14.279,
       "end_time": 14.619
      },
      {
       "word": "begins",
       "start_time": 14.679,
       "end_time": 15.06
      },
      {
       "word": "to",
       "start_time": 15.079,
       "end_time": 15.239
      },
      {
       "word": "stir.",
       "start_time": 15.259,
       "end_time": 15.659
      },
      {
       "word": "From",
       "start_time": 15.859,
       "end_time": 16
      },
      {
       "word": "the",
       "start_time": 16.02,
       "end_time": 16.119
      },
      {
       "word": "corpses",
       "start_time": 16.199,
       "end_time": 16.699
      },
      {
       "word": "rise",
       "start_time": 16.819,
       "end_time": 17.1
      },
      {
       "word": "the",
       "start_time": 17.139,
       "end_time": 17.219
      },
      {
       "word": "kindred",
       "start_time": 17.279,
       "end_time": 17.659
      },
      {
       "word": "of",
       "start_time": 17.699,
       "end_time": 17.819
      },
      {
       "word": "rot,",
       "start_time": 17.899,
       "end_time": 18.219
      },
      {
       "word": "skittering",
       "start_time": 18.619,
       "end_time": 19.119
      },
      {
       "word": "beings",
       "start_time": 19.18,
       "end_time": 19.62
      },
      {
       "word": "that",
       "start_time": 19.659,
       "end_time": 19.78
      },
      {
       "word": "resemble",
       "start_time": 19.799,
       "end_time": 20.359
      },
      {
       "word": "silverfish",
       "start_time": 20.42,
       "end_time": 21.119
      },
      {
       "word": "or",
       "start_time": 21.18,
       "end_time": 21.34
      },
      {
       "word": "cockroaches.",
       "start_time": 21.399,
       "end_time": 22.319
      },
      {
       "word": "It",
       "start_time": 22.619,
       "end_time": 22.719
      },
      {
       "word": "mirrors",
       "start_time": 22.819,
       "end_time": 23.139
      },
      {
       "word": "the",
       "start_time": 23.18,
       "end_time": 23.259
      },
      {
       "word": "way",
       "start_time": 23.299,
       "end_time": 23.44
      },
      {
       "word": "of",
       "start_time": 23.459,
       "end_time": 23.579
      },
      {
       "word": "our",
       "start_time": 23.619,
       "end_time": 23.739
      },
      {
       "word": "own",
       "start_time": 23.819,
       "end_time": 24.019
      },
      {
       "word": "world",
       "start_time": 24.059,
       "end_time": 24.399
      },
      {
       "word": "where",
       "start_time": 24.479,
       "end_time": 24.639
      },
      {
       "word": "bacteria",
       "start_time": 24.659,
       "end_time": 25.399
      },
      {
       "word": "and",
       "start_time": 25.439,
       "end_time": 25.6
      },
      {
       "word": "carrion",
       "start_time": 25.619,
       "end_time": 26.079
      },
      {
       "word": "eaters",
       "start_time": 26.119,
       "end_time": 26.44
      },
      {
       "word": "flourish",
       "start_time": 26.559,
       "end_time": 27
      },
      {
       "word": "upon",
       "start_time": 27.039,
       "end_time": 27.28
      },
      {
       "word": "the",
       "start_time": 27.299,
       "end_time": 27.359
      },
      {
       "word": "remains",
       "start_time": 27.399,
       "end_time": 27.819
      },
      {
       "word": "of",
       "start_time": 27.84,
       "end_time": 27.959
      },
      {
       "word": "the",
       "start_time": 27.979,
       "end_time": 28.099
      },
      {
       "word": "fallen.",
       "start_time": 28.18,
       "end_time": 28.559
      },
      {
       "word": "<end>",
       "start_time": 28.676854,
       "end_time": 28.676854
      }
     ],
     "text": "__AUDIO_TEXT__",
     "name": "Audio_File_37b23d.wav",
     "fileType": "upload",
     "source_audio_url": "__AUDIO_URL__"
    },
    "Qh1Uwlho": {
     "element_id": "Qh1Uwlho",
     "type": "avatar",
     "avatar_type": "photo_avatar",
     "name": "girl looking down test 3",
     "pose_name": "girl looking down test 3",
     "avatar_name": "girl looking down test 3",
     "avatar_group_name": "girl looking down test 3",
     "is_motion": true,
     "is_avatar_iv_motion": true,
     "crop_box_crop_x": {},
     "preview_image_url": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H",
     "preview_video_url": "",
     "blurred_lips_mp4": "",
     "blurred_lips_webm": "",
     "fps": 25,
     "avatar_state_id": "__AVATAR_ID__",
     "available_style": {
      "normal": true,
      "circle": true,
      "close_up": true,
      "closeUp": true
     },
     "enable_matting": true,
     "has_alpha": false,
     "enable_enhance": true,
     "enable_4k": false,
     "enable_eye_contact": false,
     "preview": {
      "normal": {
       "size": {
        "width": 1792,
        "height": 2400
       },
       "src": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H"
      }
     },
     "crop_rect": {
      "circle": {
       "x": 0,
       "y": 24.444444444444446,
       "width": 1774.213399503722,
       "height": 1773.3333333333335
      },
      "close_up": {
       "x": 0,
       "y": 24.444444444444446,
       "width": 1774.213399503722,
       "height": 1773.3333333333335
      }
     },
     "is_private": true,
     "support_avatar_iv": true,
     "unlimited_mode_disabled": false,
     "unlimited_mode_disabled_reason": null,
     "photo_avatar_metadata": {
      "photar_version": "V3"
     },
     "width": 1792,
     "height": 2400,
     "natural_width": 1792,
     "natural_height": 2400,
     "processed_image_url": "https://files2.heygen.ai/talking_photo/__AVATAR_ID__/32be43735f0a4d10baac990096307af2.WEBP?Expires=1783748580&Signature=gJK9KxiOzx4gWDP18EJlXncR3mOP8kRg1JP6pqM2YgqNTYmnkWU3h82kNS-jDt1w9MFySYBUtzbcYMntd~Cyb5xmNxuo18V4Eb8UYA-WbIUJ6TG7oiYS7paA315VRugUi1A1HOWpj3CgewYCgfio8Fj4xUInQ066qFXAmZc6wArz6V-y9iOk~8UsaAIULF6E-t3H4fgALlB0JXRqb8VCVrc1HKviYdKUdD~HBSYRDYy1RBn0l-RIN1f53ZUK9eAeRz9buBCjU7~LzQ-~YqdwiHiEjPsSoJeepZwdycS9qw297sV6hpUSWbVTArBiZaTvfY28~4PjIK6HlQ3wZs1QXg__&Key-Pair-Id=K38HBHX5LX3X2H"
    },
    "zffBPsHA": {
     "type": "scene",
     "element_id": "zffBPsHA"
    }
   },
   "video_output": {
    "resolution": {
     "width": 1080,
     "height": 1920
    },
    "fps": 25,
    "caption": false
   }
  }
 },
 "complete_tts_in_backend": true
}
```

In `tooling/cli/heygen-web/heygen-web.mjs`:
- Change the import line (currently `import { dirname, resolve } from "node:path";`) to also
  import `basename`: `import { dirname, resolve, basename } from "node:path";`
- Add this after `submitGenerate()`/`generate()` (after line 269, before `async function
  batch(...)`), replacing the old stub entirely:

```js
// Uploads a local audio file to HeyGen (S3 presigned PUT, same pattern as create-photo-avatar's
// image upload) and runs it through HeyGen's own ASR. Captured 2026-07-07 from a real HAR — see
// this step's HAR-index comments above for the exact endpoint trace.
async function uploadAudio(auth, audioPath) {
  const bytes = readFileSync(audioPath);
  const base = basename(audioPath).replace(/\.[^.]+$/, "");
  const ct = audioPath.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  const presign = await api(auth, `/v1/file/url.get?file_type=audio&filename=${encodeURIComponent(base)}` +
    `&content_type=${encodeURIComponent(ct)}&properties%5Baudio_source%5D=voice_recording`);
  const { id: fileId, url: putUrl, download_url } = presign?.data || {};
  if (!fileId || !putUrl) die("file/url.get failed: " + JSON.stringify(presign));

  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { "content-type": ct, "x-amz-server-side-encryption": "AES256" },
    body: bytes,
  });
  if (!put.ok) die(`S3 audio upload failed: HTTP ${put.status}\n${(await put.text()).slice(0, 300)}`);

  const finalize = await api(auth, "/v1/file.upload", {
    method: "POST",
    body: { name: `${base}.wav`, id: fileId, file_type: "audio", content_type: ct,
            filename: `${base}.wav`, properties: { audio_source: "voice_recording" } },
  });
  if (!finalize?.data?.id) die("file.upload failed: " + JSON.stringify(finalize));

  const transcodeUrl = `${download_url.replace(/original\.\w+$/, "transcode.mp3")}` +
    `?response-content-disposition=attachment%3B+filename%2A%3DUTF-8%27%27${encodeURIComponent(base)}.mp3%3B`;

  const asr = await api(auth, "/v1/audio/fast_asr", { method: "POST", body: { url: transcodeUrl } });
  const asrData = asr?.data?.data;
  if (!asrData?.words) die("fast_asr failed: " + JSON.stringify(asr));
  return { transcodeUrl, text: asrData.text, words: asrData.words, duration: asrData.duration };
}

function fillAudioTemplate(name, tokens) {
  const tdir = resolve(__dirname, "studio-templates");
  let text = readFileSync(resolve(tdir, name), "utf8");
  for (const [k, v] of Object.entries(tokens)) text = text.replaceAll(k, v);
  return JSON.parse(text);
}

// Renders an EXISTING avatar (an avatar_id you already made — NOT create-photo-avatar) lip-synced
// to a LOCAL audio file. Only the heygen3 (Avatar III, unlimited) path is HAR-verified; heygen4
// (Avatar IV, metered) needs its own capture before this can support it.
async function submitAudioGenerate(auth, { avatar, audioPath, engine, title }) {
  if (engine !== "heygen3")
    throw new Error(`[TODO][HNS] generate-from-audio: only heygen3 (Avatar III) is HAR-verified; ` +
      `heygen4 (Avatar IV) needs its own captured HAR before this path can be wired.`);
  const audio = await uploadAudio(auth, audioPath);

  const create = await api(auth, "/v1/text_draft.create", {
    method: "POST",
    body: { video_output: { resolution: { width: 1080, height: 1920 }, fps: 25 }, source_type: "ai_studio" },
  });
  const vid = create?.data?.video_id;
  if (!vid) die("text_draft.create failed: " + JSON.stringify(create));

  const tokens = {
    __VIDEO_ID__: vid, __AVATAR_ID__: avatar, __TITLE__: title || "generate-from-audio",
    __AUDIO_URL__: audio.transcodeUrl,
    __AUDIO_TEXT__: JSON.stringify(audio.text).slice(1, -1),
    __VOICE_ID__: "42d00d4aac5441279d8536cd6b52c53c", // formality field — audio.src drives playback, not TTS
  };

  const saveBody = fillAudioTemplate("generate-audio-save.json", tokens);
  const saveAudioMeta = saveBody.metadata.find((m) => m.type === "audio");
  saveAudioMeta.words = audio.words; saveAudioMeta.duration = audio.duration;
  await api(auth, "/v1/text_draft.save", { method: "POST", body: saveBody });

  const genBody = fillAudioTemplate("generate-audio-generate.json",
    { ...tokens, __VERSION_ID__: randomUUID().replace(/-/g, "") });
  const genMeta = genBody.draft_details.text_draft_with_metadata.metadata;
  const audioElId = genBody.draft_details.text_draft_with_metadata.text_draft.script.timeline[0];
  genMeta[audioElId].words = audio.words;
  genMeta[audioElId].duration = audio.duration;

  const gen = await api(auth, "/v1/text_draft.generate", { method: "POST", body: genBody });
  const outVid = gen?.data?.video_id;
  if (!outVid) die("text_draft.generate failed: " + JSON.stringify(gen));
  return { video_id: outVid };
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
           heygen3 (Avatar III) is real (HAR-verified 2026-07-07); heygen4 (Avatar IV) is [TODO][HNS].
```

Update `tooling/cli/heygen-web/README.md`'s command list the same way. In `HANDOVER.md`, mark the
"Get the Generate HAR" item in "What to do next" as **done** (`text_draft.generate` is now captured
and wired via `generate-from-audio`'s `heygen3` path) and add a note that `heygen4`'s equivalent
capture is the new remaining gap.

**Verify**: `node --check tooling/cli/heygen-web/heygen-web.mjs` → exit 0, no output. Also:
`python3 -c "import json; json.load(open('tooling/cli/heygen-web/studio-templates/generate-audio-save.json')); json.load(open('tooling/cli/heygen-web/studio-templates/generate-audio-generate.json'))"` → exit 0 (both templates are valid JSON).

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
- [ ] `heygen-web.mjs` has a real `generate-from-audio` (`heygen3` path) in its `help` text and
      dispatch `switch`, and `node --check` passes.
- [ ] `tooling/cli/heygen-web/studio-templates/generate-audio-save.json` and
      `generate-audio-generate.json` exist and are valid JSON.
- [ ] `pipelines/CLAUDE.md` lists the new pipeline.
- [ ] No file under `pipelines/youtube/tutorial-pipeline-2/` was touched (`git diff --stat
      c8afcb2..HEAD -- pipelines/youtube/tutorial-pipeline-2` is empty).

## STOP conditions

- **Never run any step's `run.py`/`download.py` against a real Drive or HeyGen account** as part
  of building or verifying this plan — verification is syntax + structure checks only (see
  "Commands you will need"). Stop and report if you find yourself needing real credentials to
  verify a Done criterion; that means the criterion is mis-specified, not that you should proceed.
- **Do not implement the `heygen4` HTTP body**, and do not guess a plausible-looking payload for
  it by analogy to the `heygen3` one — Avatar IV's request shape is genuinely unconfirmed (the HAR
  only exercised Avatar III). Leave `engine !== "heygen3"` raising `[TODO][HNS]` exactly as
  specified in Step 2. This mirrors `tooling/cli/heygen-web/HANDOVER.md`'s explicit rule ("do not
  guess and fire candidate generate URLs") — an unconfirmed guess against a live paid account is
  the one thing this plan must not risk.
- **Do not touch `pipelines/youtube/tutorial-pipeline-2/`** or any file inside it.
- **Do not touch `infra/secrets/`** or any credentials file.
- If `pp_drive.py` or `heygen-web.mjs` have drifted materially from the excerpts quoted in this
  plan (beyond trivial line-number shifts), stop and report the diff rather than guessing how to
  reconcile it.

## Maintenance notes

- **`heygen4` (Avatar IV, metered) is the one remaining stub.** The captured HAR only exercised
  Avatar III (`heygen3`, unlimited). To extend `generate-from-audio` to `heygen4`: capture a fresh
  HAR of the same upload+generate flow but with an Avatar IV avatar selected (DevTools Preserve Log
  ON), diff its `text_draft.save`/`.generate` bodies against `generate-audio-save.json`/
  `-generate.json` (expect at least `use_avatar_iv_model:true` and a different `engine`/
  `engine_settings`), and add an `engine === "heygen4"` branch to `submitAudioGenerate()`.
- `shared/avatar_mapping.py SEGMENT_ENGINE`'s intro/conclusion→HeyGen4, body→HeyGen3 default means
  **2 of 3 segments hit the still-stubbed `heygen4` path today** — reassign more segments to
  `heygen3` in that one config if you want a fully-working pipeline before capturing a `heygen4`
  HAR. This default was always inferred (mirrors `tutorial-pipeline-2`'s a4/a3 split), not a rule
  the owner explicitly fixed — change it freely.
- The `version_id` field in `generate-audio-generate.json`'s token (`__VERSION_ID__`) is
  client-generated, not server-issued — confirmed by tracing every `text_draft.save`/`.create`
  response in the HAR and finding no match for the value later sent in `text_draft.generate`. The
  implementation generates a fresh random one per call (`randomUUID()`); this is inferred-safe
  behavior, not verified against a second real request with a different token shape, so if HeyGen
  ever rejects a generate call with a version_id-related error, that's the first thing to suspect.
- `generate-audio-save.json`/`generate-audio-generate.json` carry the captured avatar's own cosmetic
  preview fields (`preview_image_url`, `crop_rect`, etc., all under the blanket-substituted
  `__AVATAR_ID__` token) verbatim from the HAR's specific avatar — same accepted staleness as
  `studio-templates/save.json`/`preview.json` already have (`HANDOVER.md`: "the render drives off
  the avatar_id we substitute... if a future render comes out wrong, suspect those stale template
  fields first").
- Once `generate-from-audio` is wired for real, revisit `PACING` in step 030 (`min_gap`/`max_gap`/
  `settle_every`) against whatever ban-risk signal the owner observes, same as
  `tutorial-pipeline-2/shared/heygen_config.py`'s `PACING` block.
- If a future need arises to feed this pipeline's spokesperson clips INTO `tutorial-pipeline-2`
  (the owner explicitly ruled this out for the initial build — standalone only), that's a new,
  separate plan, not a retrofit of this one.
