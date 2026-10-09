---
name: yt-vo
description: >-
  Final script from any source -> voiceover, via IndexTTS-2 on Modal. Preps a VO copy (punctuation, numbers, pronunciation) without touching the script, then synthesizes, reviews and locks. Verbs: prep, synth, say, respell, review, lock, batch, status, setup. Use for "make the voiceover", "VO from this doc", "prep this script for VO", "re-roll s03", "mispronounces <word>", "lock the takes", "yt-vo", or a 401/404/timeout from the Modal endpoint.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# yt-vo — the voiceover flow

Contents: The flow · The two entry points · prep · say · setup · synth · respell · review · lock · batch · status · Sync · When it fails · Related

One VO engine for the whole repo. **The engine, the voice and the reference clip live
in `pipelines/video/tts/`** — that folder is the hub and the source of truth for
anything voice-related. This skill is the operating layer over it: which verb to run,
in what order, and what "good" means before a take is locked.

Consuming pipelines own text and collect wavs. They never own a voice, a reference
clip, or an engine choice. If you find yourself copying a `.wav` out of
`pipelines/video/tts/references/`, stop — pass the slug instead.

## The flow

**Final script in, voiceover out.** The script can come from anywhere: yt-script,
a Google Doc, a freelancer. yt-vo never edits it, because it is also the caption
text. It writes a separate VO copy for the voice:

    final script  ->  prep (VO copy + respell map)  ->  synth / say  ->  review  ->  lock

Writing the script (what to say, cutting repeats, sounding human) is the script
owner's job. Making it speakable (punctuation, numbers, pronunciation) is `prep`.

## The two entry points

There are exactly two ways into the engine. Pick by shape of the input.

**Per-section HTTP** (`synth_section`) — a script split into named sections, each
needing its own file. This is what `yt-script` (step 120) uses.
The old `tutorial-pipeline-3` used it too; it was archived 2026-10-09.
One POST per section, returns `audio/wav`.

**Batch CLI** (`modal run`) — a flat transcript already chunked into
`[{id, text}]`. This is the older talk-over/dub path in `pipelines/video/tts/pipeline/`.

Both hit the same model and the same reference voice, so takes are interchangeable.

**Never `curl` the endpoint with raw text.** That skips the respell map, which is how
the 2026-09-08 VO said "did" for D-ID. For text with no `script.json` (a Google Doc, a
pasted line), use `say` below.

## prep — make a final script speakable

**Read `references/prep-rules.md` first, every time.** It holds the punctuation,
number and pronunciation rules. Prep never rewords, never cuts, and never touches
the script itself.

**A script with `script.json`** (yt-script, step 120). From the pipeline folder:

    bash run.sh <slug> vo-prep --seed     # copy each display_text into an empty spoken_text
    # edit spoken_text in videos/<slug>/script.json per prep-rules.md,
    # and add problem words to videos/<slug>/respell.json
    bash run.sh <slug> vo-prep            # check; repeat until it exits 0

The check prints every changed section as `script:` / `vo:` and every problem left
(a dash, a digit, a symbol, ALL CAPS, an open flag). Show the owner that change
list. Exit 0 means every section is ready for synth.

**A doc or pasted text** (no `script.json`):

    cd pipelines/video/tts
    # write <name>.vo.txt next to the source, per prep-rules.md
    node lib/vo-prep.mjs --file <name>.vo.txt [--respell extra.json]

Then `say --file <name>.vo.txt`.

## say — text with no script.json (a doc, a one-line test)

    cd pipelines/video/tts
    node lib/vo-say.mjs --text "One line to test." --out ~/Desktop/test.mp3
    node lib/vo-say.mjs --file doc.vo.txt --out ~/kb-scratch/video/tts/_adhoc/<name>.mp3

Run `prep` on a doc first. `say` still speaks unprepped text, so a one-line test
works, but it prints a warning that lists each problem.

Paragraphs split on blank lines, long ones cut to ~22s at sentence ends, one request
each, joined with a 0.35s gap. It applies the shared `respell.json` and prints every
word it respelled. `--respell extra.json` adds a map for this run only.

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

Every per-section pipeline exposes the same verbs through its own `run.sh`, which
calls `pipelines/video/tts/lib/vo-synth.mjs` with `--root` set to that pipeline.
Run from the pipeline's folder:

| Pipeline | Folder | Its VO step |
|---|---|---|
| yt-script | `pipelines/youtube/yt-script` (key from the video registry) | `steps/120-voiceover-run` |

    bash run.sh <slug> vo                      # every unlocked section
    bash run.sh <slug> vo --only s03           # re-roll one
    bash run.sh <slug> vo --force --only s03   # re-roll one that is already locked

Writes `videos/<slug>/audio/<id>.wav` and updates each section's `tts` block
(`regens_used`, `take`). Locked sections are skipped unless `--force`, so re-running
the verb is always safe.

`vo-synth` requires `script.json` stage `polished` or `tts`, and zero open `[VERIFY:` /
`[FILL:` flags. If the script still has flags, fix them in the pipeline's own
writing step (yt-script: step 100); do not work around it here.

**It reads `spoken_text`, never `display_text`.** It runs the prep check on every
target section first and refuses before the first paid request if any section is
empty or not speakable. Run `prep`. Synth never writes `spoken_text` back.

## respell — fixing pronunciation

TTS gets brand names and acronyms wrong. Fix the **text**, never the audio.

Two maps, merged at synth time. **`pipelines/video/tts/respell.json` is shared** by
every voiceover (`vo-synth` and `vo-say`): a word that recurs across videos (brand
names like D-ID) goes there, once. A video's own map wins on a clash. Spelled-out
acronyms are hyphenated capitals (`D-I-D`); `dee eye dee` pauses between letters.

For words only this video needs, put a map in `videos/<slug>/respell.json`:

    { "Asana": "Ah-sah-nah", "n8n": "N eight N" }

The map is applied to `spoken_text` at synth time, every time. So `spoken_text`
keeps normal spelling, and a fix to either map reaches every later take.

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

From the same pipeline folder:

    bash run.sh <slug> vo-lock

When every section is locked, `vo-lock` prints the follow-up.

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

    bash run.sh <slug> status      # from the pipeline's folder (yt-script)

For per-section detail read `videos/<slug>/script.json` — `tts.regens_used` is the
Modal spend counter and `tts.locked` is the approval state.

## Sync: the thing that actually breaks

Voiceover length rarely matches the footage. **Never time-stretch speech** to fix it —
that is what makes output sound artificial. Timing is absorbed in the gaps between
sections (`pipeline/assemble.py` for batch; the archived tutorial-pipeline-3 had `lib/concat-plan.mjs`).

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
- **"unresolved flags"** → the script is not polished. Go back to the pipeline's
  writing step (yt-script: 100).
- **"not ready for synth (...)"** → the section was never prepped (`empty`) or its VO
  text still has a dash, digit, symbol, bracket or ALL CAPS word. Run `prep`; the
  message names each problem.

## Related

- `pipelines/video/tts/CLAUDE.md` — engine benchmarks, why IndexTTS-2, reference-voice
  catalog. Read before proposing an engine change.
- `pipelines/video/CLAUDE.md` — cost model, engine trade-offs, settled decisions.
  Read before re-litigating VO-first or the fal-lipsync deferral.
- `references/prep-rules.md` — the rules `prep` follows.
- `pipelines/youtube/yt-script/steps/120-voiceover-run/README.md` — the step.
