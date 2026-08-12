# Handoff — consistent-character-ai-animation-howto

Video: "How To Create Long AI Animation Videos with Consistent Characters" (OpenArt tutorial).
Drive source folder: https://drive.google.com/drive/folders/1xpy7NfgTgcbb1qvwAEZqjRt1yj4pv9Vh
(owned by khushibakliwal251@gmail.com, a known team collaborator — confirmed legit, not the account this pipeline normally runs under)

## Done (steps 010-235, plus 310's mechanical half)

- Environment fully set up on this Windows machine: Drive OAuth, `GROQ_API_KEY`,
  ffmpeg, Chrome headless shell for Hyperframes. All verified working.
- Two real (non-Windows-specific-to-fix, but Windows-triggered) bugs found and
  fixed in the pipeline's own code — same fix applies on Mac too, not a workaround:
  1. **38 files** in `pipelines/video/visuals-flow/lib/*.mjs` used
     `` import.meta.url === `file://${process.argv[1]}` `` as their CLI-entrypoint
     guard. On Windows `process.argv[1]` is a backslash path, so the naive
     string-concat never matches `import.meta.url`'s properly-encoded
     `file:///C:/...` form — every `node lib/X.mjs` invocation silently did
     nothing and exited 0. Fixed by swapping to
     `import.meta.url === pathToFileURL(process.argv[1]).href` (adding the
     `pathToFileURL` import where missing). `lib/board.mjs` already had the
     correct pattern pre-existing — that's the reference fix.
  2. `pipelines/video/card-library/scripts/overflow-probe.mjs` did
     `await import(path.resolve(sharedModulePath))` — same class of bug, a raw
     Windows path handed to `import()`. Fixed with `pathToFileURL(...).href`.
- Video registered in video-registry as `consistent-character-ai-animation-howto`.
- Source files downloaded from Drive `Input/` into `videos/<slug>/src/`
  (intro.mp4, body.mp4, conclusion.mp4).
- `vo.mp3` built by concatenating the three source files' audio tracks in
  order (ffmpeg concat filter) — there was no separate voiceover file, this
  is a live tutorial recording with the narrator's own voice.
- 010 configure: drive_folder/drive_account set to the Input Drive folder above.
- 020 transcribe: Groq Whisper, 3741 raw words.
- 030 clean-transcript: cleaned to 3704 words (brand merges: OpenArt,
  Nano Banana 2, Flux 1.1, Kling; 22 sentence-initial filler trims). See the
  run-log entry for 030 for the full list of what was and wasn't touched.
- 040 segments: measured intro/body/conclusion structure.
  **`confirmed` is still `false`** in segments.json — the demo-vs-narration
  split is a heuristic I did not visually verify against the actual recording.
- 050 concept: thesis/frame/throughline/registers authored, lint-concept clean
  (99.5% narration coverage).
- 210 body cues + 220 zone (intro/conclusion) cues authored — 33 cues total
  across `cues.json`. `node lib/resolve.mjs --validate-only` is clean.
- 235 card-plan: 32 cues, 0 new cards needed, 0 flagged.
- **310 resolve.mjs (the mechanical half) now runs clean** — `resolved.json`
  is written, the browser frame-gate probe runs fine on this machine.

### A pre-existing, non-Windows, non-blocking bug found (not fixed, just noted)

`lib/zone-constants.mjs`'s `ZONE_PARTS = ['conclusion']` is missing `'intro'`.
This makes `card-plan.json` mislabel every intro-zone cue as `"part": "body"`
in its report. Doesn't affect `resolve.mjs`/`lint-cues.mjs` (they read each
cue's own `zone` field directly), so it's cosmetic — but worth a real fix
someday since the PIPELINE.md schema explicitly documents `"intro"` as a
valid section part.

### A footage problem flagged to the owner (not mine to fix)

`body.mp4` has a duplicated ~30s retake around 1021s-1069s (repeated
scorecard sentence + two stray "Thank you." "Thank you.") and an out-of-place
"this is so delicious, you have to try this" food-description tangent at
~841s that reads like a stray audio artifact. Cue authoring worked around
both rather than cueing over duplicate/garbled footage. Owner should be told
before final assembly — this may need a body.mp4 re-cut.

## Chunk A — finish 310 (cue-quality lint fixes) — NOT DONE, but fully diagnosed

Run from `pipelines/video/visuals-flow/`:
```
node lib/lint-cues.mjs consistent-character-ai-animation-howto
```
This currently reports **7 hard errors** (must fix) + ~30 warnings (advisory,
optional). The 7 errors and their exact fixes, already worked out:

1. **E5 demo-coverage** — `c11` (checklist/icon-pills, fullframe) starts at
   497.2s, inside the 485-515s demo segment. Fullframe cards are illegal
   during demo. **Fix: delete cue `c11` entirely** — it's supplementary
   advice ("vary your prompts..."), not essential, and removing it doesn't
   violate any coverage floor.
2. **E2 stat-hit-spacing** — `c07` and `c08` (both overlay/stat-hit) are only
   4.4s apart; need ≥90s. **Fix: delete `c08`**, and change `c07`'s
   `variables.context` to fold in the comparison, e.g.
   `"context": "vs dozens for most platforms"`.
3. **E3 card-repetition** — `statement/keyword-statement` used 6x (cap 3):
   `z06, c10, c13, c18, c19, c22`. **Fix: keep only `c10`, `c13`, `c22`.
   Delete `z06`, `c18`, `c19`** (deleting c18/c19 also fixes error #4 below,
   two birds one stone).
4. **E11 no-deictic-slate** — `c18` ("export it directly from **here**") and
   `c19` ("...built a complete pipeline **here**") both use "here", which is
   barred outright on slate/statement cards. **Fix: covered by deleting them
   in #3 above.**
5. **E9 overlay-over-graphic** (x2) — an overlay cue's time-span overlaps a
   fullframe cue's span, which isn't allowed:
   - `c06` (link-in-description pill) overlaps `c05` (kinetic-sentence).
     **Fix: change `c06`'s anchor** from `"My link is in the description"` to
     `"gets you the best discount available"` (verbatim, confirmed present at
     t=146.84s, safely after c05's card finishes).
   - `z10` (link-in-description pill, conclusion) overlaps `z09`
     (fill-gauge). **Fix: change `z10`'s anchor** from
     `"if you want to try this yourself my link"` to
     `"gets you the best discount available on any OpenArt"` (verbatim,
     confirmed present at t=1153.12s).

After applying those 5 fixes (2 deletes cover 3 of the 7 errors), re-run:
```
node lib/resolve.mjs consistent-character-ai-animation-howto --validate-only
node lib/resolve.mjs consistent-character-ai-animation-howto
node lib/lint-cues.mjs consistent-character-ai-animation-howto
```
Errors should be gone. The warnings (pacing gaps W1/W6/W7, long-hold W21,
variant-repetition W9, reveal-wordcount W4, enacted-vs-legacy preference W10,
first-beat-idle W5) are advisory — use judgment on whether any are worth
fixing now vs. leaving for the owner's 340 review; they do not block the
pipeline.

Once lint-cues is clean, close out the ledger:
```
node lib/run-log.mjs consistent-character-ai-animation-howto 310 done \
  --did "..." --issues "..." --output "resolved.json + lint-cues clean"
node lib/stillness.mjs consistent-character-ai-animation-howto
```
(`stillness.mjs` is W18 — needs absolute times from resolve, run it after.)

## Chunk B — 320 shot-pass (avatar placement)

```
bash run.sh consistent-character-ai-animation-howto shot-pass
```
This prints the prompt-assembly instructions (same LLM-authoring pattern as
210/220 — read `steps/320-place-avatar-llm/shot-pass-prompt.md`, fill
placeholders from `lib/plan-skeleton.mjs`, `lib/transcript-text.mjs`, and the
catalog, then author `shots.json` directly). Comparable authoring effort to
what 210/220 took, usually with fewer spans. This video is a solo talking-head
tutorial (one presenter, screen recording + narration) so shot spans are
likely simpler than a multi-product comparison video.

Guardrail: pre-flight `node lib/feedback-status.mjs` must exit 0 (it already
does, verified earlier this session).

## Chunk C — 330 storyboard-check → 340 (the human gate)

```
bash run.sh consistent-character-ai-animation-howto storyboard-check
```
Runs shot resolve, shot lint, zone stillness (W18), and the audit gate in one
pass. Fix whatever it reports (same iterate-and-rerun pattern as chunks A/B).
Once clean, the pipeline is ready for step 340 — **the owner review gate** —
open the board (`bash run.sh consistent-character-ai-animation-howto board`)
and stop there. Nothing renders until 340 is approved.

## Gotchas for whoever picks this up (Windows-specific)

- **PATH does not carry between separate tool invocations on this machine.**
  Every fresh shell call needs, at the top:
  ```bash
  export PATH="$PATH:/c/Users/kushi/AppData/Local/Microsoft/WinGet/Links"
  ```
  (for ffmpeg/ffprobe) and for anything needing `GROQ_API_KEY`:
  ```bash
  export GROQ_API_KEY=$(powershell.exe -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('GROQ_API_KEY','User')" | tr -d '\r')
  ```
  This is not a one-time setup step — it's needed in literally every new
  Bash/PowerShell tool call that touches these.
- If you hit ANOTHER `import.meta.url === \`file://${process.argv[1]}\`` or
  raw-path-into-`import()` failure somewhere not yet touched, it's the same
  bug class as the two already fixed — same fix (`pathToFileURL(...).href`).
