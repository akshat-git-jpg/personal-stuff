---
name: yt-vo
description: >-
  Generate, review and lock TTS voiceover for any video pipeline in this repo, using IndexTTS-2 on Modal GPU. Verbs: setup, synth, respell, review, lock, batch, status. Use for "make the voiceover", "generate VO for <slug>", "re-roll section s03", "the voice mispronounces <word>", "lock the takes", "voiceover for <video>", "yt-vo". Also use when a pipeline step needs narration wavs, or when a VO run fails with 401/404/timeout against the Modal endpoint.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# yt-vo — the voiceover flow

One VO engine for the whole repo. **The engine, the voice and the reference clip live
in `pipelines/video/tts/`** — that folder is the hub and the source of truth for
anything voice-related. This skill is the operating layer over it: which verb to run,
in what order, and what "good" means before a take is locked.

Consuming pipelines own text and collect wavs. They never own a voice, a reference
clip, or an engine choice. If you find yourself copying a `.wav` out of
`pipelines/video/tts/references/`, stop — pass the slug instead.

## The two entry points

There are exactly two ways into the engine. Pick by shape of the input.

**Per-section HTTP** (`synth_section`) — a script split into named sections, each
needing its own file. This is what tutorial-pipeline-3 uses. One POST per section,
returns `audio/wav`.

**Batch CLI** (`modal run`) — a flat transcript already chunked into
`[{id, text}]`. This is the older talk-over/dub path in `pipelines/video/tts/pipeline/`.

Both hit the same model and the same reference voice, so takes are interchangeable.

## setup (one time per machine, and after any engine change)

Do this from `pipelines/video/tts/`. It is the owner's job, not an agent's — it costs
Modal money and pins the production voice.

    modal secret create tts-web-secret TTS_WEB_TOKEN=<long-random>
    modal run modal/indextts2_app.py::download_models          # ~9.5 GB, once
    modal run modal/indextts2_app.py::upload_ref --ref references/jamila-walking-30s.wav
    modal deploy modal/indextts2_app.py                        # prints the URL

Put the printed URL and the token into `pipelines/.env`:

    MODAL_TTS_URL=<the deployed synth_section URL>
    MODAL_TTS_TOKEN=<the TTS_WEB_TOKEN value>

`upload_ref` stores the reference clip in the Modal Volume, so callers never ship
1–2 MB of wav per request. Changing the production voice means re-running `upload_ref`
— and every existing take is now inconsistent with it, so re-synthesize, don't mix.

## synth <slug> [--only sNN] [--force]

tutorial-pipeline-3:

    cd pipelines/youtube/tutorial-pipeline-3
    bash run.sh <slug> vo                 # every unlocked section
    bash run.sh <slug> vo --only s03      # re-roll one
    bash run.sh <slug> vo --force --only s03   # re-roll one that is already locked

Writes `videos/<slug>/audio/<id>.wav` and updates each section's `tts` block
(`regens_used`, `take`). Locked sections are skipped unless `--force`, so re-running
the verb is always safe.

Requires stage `polished` or `tts`, and zero open `[VERIFY:` / `[FILL:` flags. If the
script still has flags, that is step 040's job — do not work around it here.

## respell — fixing pronunciation

TTS gets brand names and acronyms wrong. Fix the **text**, never the audio.

Put a map in `videos/<slug>/respell.json`:

    { "Asana": "Ah-sah-nah", "n8n": "N eight N" }

It only applies to sections whose `spoken_text` is still empty — it feeds
`deriveSpoken(display_text, respellMap)`. Once a section has an explicit
`spoken_text`, edit that field directly instead; the map will not touch it.

Then re-roll just that section. A respell edit does not by itself invalidate a take,
so you must re-synth for it to take effect.

## review — what to listen for

This is the gate the whole step exists for, and it is the owner's ear. Play each wav
and check, in this order:

1. **Wrong words.** Names, acronyms, numbers. → respell, re-roll.
2. **Onset artifact.** A faint "tsh" before speech. Known engine behaviour; the
   assemble step trims it. Do not re-roll for this alone.
3. **Pacing.** A section that races or drags. → re-roll; it is stochastic and the next
   take is usually different.
4. **Flat delivery.** → `--emo-text "warm, confident"` on the re-roll, or a livelier
   reference clip (a voice change, so treat it as a `setup` decision).

Two re-rolls that both sound wrong the same way means the text is wrong, not the
engine. Fix the sentence.

## lock <slug> [--only sNN]

    bash run.sh <slug> vo-lock
    node lib/set-stage.mjs <slug> locked

Locking asserts: no open flags, non-empty `spoken_text`, and a take on disk. **There
is no unlock** — only a text edit clears a lock, and that resets the take and marks
the section for re-record. This is deliberate: a locked take is what the freelancer
records against, so silently swapping it desyncs footage that already exists.

So do not lock to "tidy up". Lock when you have actually listened.

## batch — the flat-transcript path

For dubbing an existing recording rather than scripting a new one:

    cd pipelines/video/tts
    python3 pipeline/chunk_segments.py work/segments.json work/chunks.json 22
    modal run modal/indextts2_app.py --segments work/chunks.json \
      --ref references/jamila-walking-30s.wav --out work/idx_chunks
    python3 pipeline/assemble.py work/chunks.json work/idx_chunks out.mp3

Chunk to ~22s before synth. Per-sentence generation is what caused the onset-artifact
and uneven-pacing problems in the first place.

Generated audio never goes in the repo. It belongs in
`~/kb-scratch/video/tts/<pipeline>/`, with a row added to
`pipelines/video/tts/OUTPUTS.md`.

## status

    cd pipelines/youtube/tutorial-pipeline-3 && bash run.sh <slug> status

For per-section detail read `videos/<slug>/script.json` — `tts.regens_used` is the
Modal spend counter and `tts.locked` is the approval state.

## Sync: the thing that actually breaks

Voiceover length rarely matches the footage. **Never time-stretch speech** to fix it —
that is what makes output sound artificial. Timing is absorbed in the gaps between
sections (`lib/concat-plan.mjs` for tp3, `pipeline/assemble.py` for batch).

Tutorials have no lip-sync constraint, so section-level alignment is enough. Read
`pipelines/video/tts/SYNC-PROBLEM.md` before touching any timing code — the open
problem and the rejected approaches are recorded there.

## When it fails

- **401** → `MODAL_TTS_TOKEN` does not match the `TTS_WEB_TOKEN` in the Modal secret.
  Re-check `pipelines/.env`; the endpoint is the authority.
- **404 / connection refused** → the app is not deployed, or `MODAL_TTS_URL` is a
  stale URL from a previous `modal deploy`. Re-deploy and copy the printed URL.
- **First call is very slow** → cold start pulling ~9.5 GB of weights into the
  container. Expected. Do not lower the timeout.
- **"unresolved flags"** → the script is not polished. Go back to step 040.
- **"spoken text is empty"** → `display_text` derived to nothing, or `spoken_text` was
  set to `""` by hand. Fix the script, not the synth call.

## Related

- `pipelines/video/tts/CLAUDE.md` — engine benchmarks, why IndexTTS-2, reference-voice
  catalog. Read before proposing an engine change.
- `pipelines/video/CLAUDE.md` — cost model, engine trade-offs, settled decisions.
  Read before re-litigating VO-first or the fal-lipsync deferral.
- `pipelines/youtube/tutorial-pipeline-3/steps/050-voiceover/README.md` — the step.
