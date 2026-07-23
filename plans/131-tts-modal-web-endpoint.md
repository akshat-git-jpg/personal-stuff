---
executor: agy
model:
test_cmd: cd pipelines/video/tts/modal && python3 -m unittest discover -s . -p "test_*.py"
ui:
deploy: modal deploy pipelines/video/tts/modal/indextts2_app.py
needs: []
---

# Plan 131: Modal web endpoint for per-section TTS synthesis

## Summary

- **Problem statement**: IndexTTS-2 synth is only invocable via local
  `modal run` on the owner's machine. The tutorial-maker UI (plan 132, a
  Cloudflare Worker) needs an authed HTTPS endpoint that synthesizes ONE section
  and returns the wav.
- **Goals**:
  - Add a token-authed `POST` web endpoint (`synth_section`) to
    `pipelines/video/tts/modal/indextts2_app.py` returning `audio/wav` bytes.
  - Store the production reference voice in the Modal Volume once
    (`upload_ref` entrypoint) so callers never send ref bytes.
  - Pure-python request validation in `web_validate.py`, unit-tested offline.
  - Existing `modal run ... main` batch contract untouched.
- **Executor proposed**: agy (Gemini 3.1 Pro High — agy default). All non-trivial
  code is inlined below; the executor places and wires it.
- **Done criteria** (terse): unittest suite green; `python3 -m py_compile` passes on
  both files; existing `main` entrypoint unchanged except imports.
- **Stop conditions** (terse): NO live Modal calls of any kind (no `modal run`,
  `modal deploy`, `modal secret`); drift check fails.
- **Test / verification for success**: `python3 -m unittest discover` on
  `web_validate` tests + `py_compile` on the app file (GPU/deploy paths cannot be
  executed offline by design).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ff940f0..HEAD -- pipelines/video/tts/modal/`
> Expected: no changes. Any change → STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches the only GPU-side file; mitigated by not changing the
  existing entrypoint and by offline-only verification)
- **Depends on**: none (independent of plans 129/130; plan 132 depends on this)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ff940f0`, 2026-07-23

## Why this matters

The tutorial-pipeline-3 UI lets a freelancer self-serve TTS generation and regens
(owner decision 2026-07-23). The Worker cannot run `modal run`; it needs HTTPS. The
endpoint must be single-section (the Worker enforces per-section regen caps in D1),
authed by a shared bearer token (Modal Secret), and must read the reference voice
from the Volume so the 1–2 MB ref wav isn't shipped per request.

## Current state

`pipelines/video/tts/modal/indextts2_app.py` (the ONLY file in `modal/` today) —
structure, verbatim excerpts:

```python
app = modal.App("indextts2-synth")
image = ( modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "build-essential")
    .run_commands(
        "git clone https://github.com/index-tts/index-tts.git /root/index-tts",
        "cd /root/index-tts && pip install -e .", )
    .pip_install("huggingface_hub[hf_transfer]", "hf_xet", "soundfile")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"}) )
vol = modal.Volume.from_name("indextts2-models", create_if_missing=True)
MODELS = "/models"
CKPT = f"{MODELS}/checkpoints"

@app.cls(image=image, gpu="A10G", volumes={MODELS: vol}, timeout=3600)
class Synth:
    @modal.method()
    def synth(self, segments, ref_bytes, emo_text=None, interval_silence=200):
        """segments=[{id,text}], ref_bytes=reference wav. Returns {id: wav_bytes}."""
        ...

@app.local_entrypoint()
def main(segments: str, ref: str, out: str, emo_text: str = "", interval_silence: int = 200):
    ...
```

The production reference voice is
`pipelines/video/tts/references/jamila-walking-30s.wav` (repo-tracked). The hub's
rule: consumers reference voices by slug, never copy the wav.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit tests | `cd pipelines/video/tts/modal && python3 -m unittest discover -s . -p "test_*.py"` | `OK` |
| Syntax check | `python3 -m py_compile pipelines/video/tts/modal/indextts2_app.py pipelines/video/tts/modal/web_validate.py` | exit 0, no output |
| (OWNER ONLY, post-merge) deploy | `modal deploy pipelines/video/tts/modal/indextts2_app.py` | never run by executor |

## Scope

**In scope**:
- EDIT `pipelines/video/tts/modal/indextts2_app.py` (additive only — see Steps).
- CREATE `pipelines/video/tts/modal/web_validate.py`
- CREATE `pipelines/video/tts/modal/test_web_validate.py`
- EDIT `pipelines/video/tts/CLAUDE.md` — add the short "Web endpoint" note from
  Step 4.

**Out of scope**: everything else. Especially: `engines/`, `pipeline/`,
`references/`, any other Modal app, any file in tutorial-pipeline-3 or apps/.

## Git workflow

- Branch: `advisor/131-tts-modal-web-endpoint`
- Commits: `tts: web request validation module`, `tts: synth_section web endpoint + upload_ref`,
  `tts: document web endpoint`. Do NOT push.

## Steps

### Step 1: `web_validate.py` (pure, no modal imports)

```python
"""Request validation for the synth web endpoint. Pure python — unit-testable
offline, imported inside the Modal container via add_local_python_source."""
import re

ID_RE = re.compile(r"^s\d{2}$")
TEXT_MAX = 1200
EMO_MAX = 200
IV_MIN, IV_MAX, IV_DEFAULT = 50, 500, 200


def validate_payload(p):
    """Returns (ok, error, cleaned). cleaned = {id, text, interval_silence, emo_text}."""
    if not isinstance(p, dict):
        return False, "payload must be a JSON object", None
    sid, text = p.get("id"), p.get("text")
    if not isinstance(sid, str) or not ID_RE.match(sid):
        return False, "id must match s\\d\\d (e.g. s07)", None
    if not isinstance(text, str) or not text.strip():
        return False, "text is required", None
    if len(text) > TEXT_MAX:
        return False, f"text too long (max {TEXT_MAX} chars)", None
    iv = p.get("interval_silence", IV_DEFAULT)
    if isinstance(iv, bool) or not isinstance(iv, (int, float)) or int(iv) != iv:
        return False, "interval_silence must be an integer", None
    iv = int(iv)
    if not (IV_MIN <= iv <= IV_MAX):
        return False, f"interval_silence out of range {IV_MIN}-{IV_MAX}", None
    emo = p.get("emo_text") or None
    if emo is not None and (not isinstance(emo, str) or len(emo) > EMO_MAX):
        return False, "emo_text must be a string of at most 200 chars", None
    return True, None, {"id": sid, "text": text.strip(),
                        "interval_silence": iv, "emo_text": emo}
```

### Step 2: `test_web_validate.py`

`unittest.TestCase` coverage, minimum: happy path with defaults; happy path with
all fields; rejects non-dict, bad id (`x01`, `s1`, `s001`), empty/whitespace text,
1201-char text, boolean interval_silence, float 199.5, 49 and 501, non-string
emo_text, 201-char emo_text; confirms cleaned text is stripped and defaults
applied.

**Verify**: `cd pipelines/video/tts/modal && python3 -m unittest discover -s . -p "test_*.py"` → `OK`.

### Step 3: additive changes to `indextts2_app.py`

Do not modify the existing `image`, `vol`, `Synth`, `download_models`, or `main`.
Add, at the end of the file:

```python
# --- Web endpoint (plan 131): per-section synth over HTTPS for the tutorial UI ---
REF_DIR = f"{MODELS}/ref"
REF_FILE = f"{REF_DIR}/production.wav"

web_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi[standard]")
    .add_local_python_source("web_validate")
)


@app.function(volumes={MODELS: vol}, timeout=600)
def store_ref(ref_bytes: bytes):
    """Persist the production reference voice into the Volume (run via upload_ref)."""
    pathlib.Path(REF_DIR).mkdir(parents=True, exist_ok=True)
    pathlib.Path(REF_FILE).write_bytes(ref_bytes)
    vol.commit()
    print(f"reference stored at {REF_FILE} ({len(ref_bytes)} bytes)")


@app.local_entrypoint()
def upload_ref(ref: str):
    """One-time: modal run indextts2_app.py::upload_ref --ref references/jamila-walking-30s.wav"""
    store_ref.remote(pathlib.Path(ref).read_bytes())


@app.function(
    image=web_image,
    volumes={MODELS: vol},
    secrets=[modal.Secret.from_name("tts-web-secret")],
    timeout=600,
)
@modal.fastapi_endpoint(method="POST")
def synth_section(payload: dict, request):
    """POST {id, text, interval_silence?, emo_text?} + 'Authorization: Bearer <token>'
    -> audio/wav bytes for that one section. Token lives in Modal secret
    tts-web-secret as TTS_WEB_TOKEN. Caps/regen policy are the CALLER's job."""
    import hmac
    import os
    from fastapi.responses import JSONResponse, Response
    from web_validate import validate_payload

    supplied = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    expected = os.environ.get("TTS_WEB_TOKEN", "")
    if not expected or not hmac.compare_digest(supplied, expected):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    ok, err, clean = validate_payload(payload)
    if not ok:
        return JSONResponse({"error": err}, status_code=400)

    ref_path = pathlib.Path(REF_FILE)
    if not ref_path.exists():
        return JSONResponse({"error": "reference voice not uploaded (run upload_ref)"},
                            status_code=503)

    res = Synth().synth.remote(
        [{"id": clean["id"], "text": clean["text"]}],
        ref_path.read_bytes(),
        clean["emo_text"],
        clean["interval_silence"],
    )
    wav = res.get(clean["id"])
    if not wav:
        return JSONResponse({"error": "synth produced no audio"}, status_code=500)
    return Response(content=wav, media_type="audio/wav",
                    headers={"x-section-id": clean["id"]})
```

If the installed `modal` version in your environment errors on
`modal.fastapi_endpoint` at IMPORT time in `py_compile` — it will not, py_compile
does not import — leave the code exactly as written; runtime compatibility is
verified by the owner at deploy time.

**Verify**: `python3 -m py_compile pipelines/video/tts/modal/indextts2_app.py` →
exit 0. `git diff pipelines/video/tts/modal/indextts2_app.py | grep "^-" | grep -v "^---"` →
empty (purely additive).

### Step 4: document in `pipelines/video/tts/CLAUDE.md`

Add under the "Engines" section a short block titled `### Web endpoint
(tutorial-pipeline-3 UI)` stating: endpoint = `synth_section` in
`modal/indextts2_app.py`, POST `{id, text, interval_silence?, emo_text?}` with
`Authorization: Bearer $TTS_WEB_TOKEN` → `audio/wav`; owner one-time setup:
`modal secret create tts-web-secret TTS_WEB_TOKEN=<long-random>`, then
`modal run modal/indextts2_app.py::upload_ref --ref references/jamila-walking-30s.wav`,
then `modal deploy modal/indextts2_app.py`; the deployed URL is printed by
`modal deploy` and goes into the Worker secret `MODAL_TTS_URL` (plan 132). Note the
caller owns regen caps; the endpoint is deliberately policy-free.

**Verify**: `grep -c "synth_section" pipelines/video/tts/CLAUDE.md` → ≥1.

## Test plan

Offline only: unittest on `web_validate.py` (the entire request policy) +
`py_compile` on both files + additive-diff check on the app file. The endpoint's
GPU path reuses the already-proven `Synth.synth`; it is exercised by the owner
after `modal deploy` with a curl smoke test (documented in CLAUDE.md), never by
the executor.

## Done criteria

- [ ] `cd pipelines/video/tts/modal && python3 -m unittest discover -s . -p "test_*.py"` → OK.
- [ ] `python3 -m py_compile` on both files → exit 0.
- [ ] Diff of `indextts2_app.py` is purely additive (no removed/changed lines).
- [ ] CLAUDE.md documents endpoint, owner setup commands, and Worker handoff.

## STOP conditions

- ANY command starting with `modal ` (run/deploy/secret/token) — the executor must
  never talk to Modal.
- The drift check shows `modal/` already modified.
- `python3` < 3.9 in the environment.

## Maintenance notes

- The endpoint is policy-free by design: regen caps, locking, and per-video budget
  all live in the Worker (plan 132). Keep it that way — two cap implementations
  will disagree.
- Cold start pays the 9.5 GB model load (~1–2 min) on the first call after idle;
  the Worker UI must surface a "warming up" state (plan 132 does).
- If the reference voice changes, re-run `upload_ref` — consumers never send ref
  bytes.
