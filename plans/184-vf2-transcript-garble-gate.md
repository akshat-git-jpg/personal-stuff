---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["touches scripts/check.sh — the visuals-flow serial-collision hotspot; rebase-resolve the node --test concat rather than dropping either side"]
---

# Plan 184: catch ASR caption garbles at step 010, not at the final cut

## Summary

- **Problem statement**: `best-ai-video-generator` burned four wrong words onto screen as captions ("10 ATP exports" for 1080p, "one clip translation" for one-click, a hallucinated "Harrison", "straight forward") and nobody saw them until the 120 final-cut gate, ~9 hours of pipeline work later. The transcript came from local whisper `small.en` because the Groq `large-v3-turbo` guard rejected a perfectly usable transcript on a technicality, and nothing downstream ever questioned a word.
- **Goals**:
  - Stop discarding the good ASR engine: judge timestamp poison by **magnitude**, not by a count of sub-second jitters.
  - Make an engine downgrade **loud and recorded** instead of a one-line stderr note.
  - Add a **domain lexicon** of product/spec terms the cleanup pass may correct.
  - Add a **suspect gate** at 010 that flags digit-letter mashups, known confusables, and once-only proper nouns, and fails until each is corrected or acknowledged.
  - Add a **targeted second-opinion re-transcription** that re-checks only the flagged windows against `large-v3-turbo`.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — the default per `tooling/boss/data/rules.md`. The one prose surface (`cleanup-prompt.md`) has its replacement text inlined verbatim in Step 6, so no taste judgment is delegated.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0 with five new test files running; the suspect gate reproduces all four known garbles from a fixture; the poison guard accepts the 2.16% case and still rejects a genuinely backwards timeline.
- **Stop conditions** (terse — full list below): a gate assertion that fails must be fixed in the code or the fixture, never weakened or deleted; do not rewrite any existing video's `transcript.json`.
- **Test / verification for success**: `node --test` unit tests over pure functions, plus a fixture built from the real four-garble case.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 592b0ae5..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps/010-transcribe-run pipelines/video/visuals-flow/scripts/check.sh`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `592b0ae5`, 2026-08-02

## Why this matters

Captions are burned onto every screen segment from `transcript.json` **verbatim**
(`lib/assemble.mjs` calls `planCaptions(words)`). That makes the transcript a
render-critical artifact, not a convenience: a wrong word there is a wrong word
on the finished video, in a font the viewer is reading.

On 2026-08-02 four such words shipped into a 32-minute cut. The chain was:

1. Groq `whisper-large-v3-turbo` returned a good transcript with 129 non-monotonic
   word starts out of 5974. The guard's cap is 2% (120 words). 129 is 2.16%. It
   rejected the transcript **by nine words**.
2. Every one of those 129 was a sub-second jitter that the code immediately above
   the guard already knows how to clamp, and whose own comment calls it "noise,
   not poison". The guard was counting the noise it had just cleaned up.
3. The run fell back to local `small.en`, a much weaker model, with one line of
   stderr. Nothing recorded which engine produced the transcript, so no later step
   knew caption quality had dropped.
4. `small.en` produced the four garbles. The ASR cleanup pass (step 010) has a
   carve-out for **brand** names but none for spec/product terms, and its
   "Change nothing else" rule is emphatic, so the pass correctly left them alone.
5. The session logged them in the run-log's `issues` field as needing "an
   editorial decision" — a field nobody reads until something goes wrong.

Every link held individually. The transcript is the one artifact where being
approximately right is a visible defect, and it had the least verification of
anything in the pipeline.

A second-opinion check is cheap and was proven by hand on 2026-08-02: clip a
14-second window with ffmpeg, send it to `large-v3-turbo`, diff the text. That
run confirmed all four corrections and cost four API calls on a 32-minute video.

## Current state

### Files in scope

| File | Role |
|---|---|
| `pipelines/video/visuals-flow/lib/transcribe-groq.mjs` | Groq fast path; owns the clamp and the poison guard |
| `pipelines/video/visuals-flow/steps/010-transcribe-run/run.sh` | orchestrates groq → whisper fallback → cleanup pass |
| `pipelines/video/visuals-flow/steps/010-transcribe-run/cleanup-prompt.md` | the ASR cleanup pass's rulebook |
| `pipelines/video/visuals-flow/scripts/check.sh` | the repo gate; `node --test` file list lives here |

### The poison guard as it stands

`lib/transcribe-groq.mjs`, immediately after the words are mapped:

```js
  // whisper-large-v3-turbo word timestamps carry occasional small jitter: a word
  // starting slightly BEFORE its predecessor (test-02: 61 of 5543 words, all
  // ≤0.52s). That is noise, not poison — clamp it. Rejecting the transcript
  // for it forces the garbled local-whisper fallback (and wastes an hour of
  // Groq audio quota per retry). Fold 2026-07-20.
  let clamped = 0;
  for (let i = 1; i < words.length; i++) {
    const overlap = words[i - 1].start - words[i].start;
    if (overlap > 0 && overlap <= 1.0) {
      words[i].start = words[i - 1].start;
      if (words[i].end < words[i].start) words[i].end = words[i].start;
      clamped++;
    }
  }
  // A genuinely garbage response (NaN/negative/large-backwards timestamps, or
  // jitter beyond ~2% of words) would poison every downstream anchor — refuse
  // to write transcript.json (GFX-04).
  const clampCap = Math.ceil(words.length * 0.02);
  if (clamped > clampCap) {
    console.error(`transcript rejected: ${clamped} non-monotonic word starts (cap ${clampCap}) — timestamps look poisoned`);
    process.exit(1);
  }
```

Note that overlaps **greater** than 1.0s are never clamped, so they fall through
to the per-word validation below it (`w.start < prevStart` → reject). The 1.0s
window is therefore already the real poison boundary; `clampCap` only re-judges
words that were inside it.

### The fallback as it stands

`steps/010-transcribe-run/run.sh`:

```sh
engine=""
if [ -n "${GROQ_API_KEY:-}" ]; then
  if node lib/transcribe-groq.mjs "$workdir"; then
    engine="groq"
  else
    echo "groq path failed — falling back to local whisper" >&2
  fi
fi
if [ -z "$engine" ]; then
  cd "$workdir"
  npx hyperframes@0.7.62 transcribe vo.mp3 --json -m small.en "$@"
  cd "$pipeline_root"
  engine="whisper"
fi
```

`$engine` is used only to name the backup file (`transcript.$engine-raw.bak.json`).
It is never written anywhere a later step or a human reads.

### The cleanup rule that preserved the garbles

`steps/010-transcribe-run/cleanup-prompt.md` currently carries exactly three fix
classes — punctuation, brand names, fillers — and then:

```md
**Change nothing else.** Do not rewrite grammar, reorder words, or tighten
phrasing. The caption must still read as what the speaker said — a caption
that visibly differs from the audio reads as a subtitling error, which is a
worse defect than the punctuation this pass fixes.
```

This rule is correct and must survive. What it lacks is the observation that a
mis-transcribed **spec token** is not "what the speaker said" either — it is the
same category of error as a mangled brand, which already has a carve-out.

### Conventions to match

- Node ESM (`.mjs`), `import fs from 'node:fs'`, a `if (import.meta.url === \`file://${process.argv[1]}\`)` CLI block at the bottom. **Exemplar: `lib/transcript-quality.mjs`** — match its shape, its exported-pure-function-plus-CLI split, and its comment density.
- Tests are `node:test` + `node:assert/strict`, one `lib/<name>.test.mjs` per module. **Exemplar: `lib/transcript-quality.test.mjs`**.
- Workdir resolution is always `import { resolveWorkdir } from './workdir.mjs'`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, prints `visuals-flow check OK` |
| One test file | `cd pipelines/video/visuals-flow && node --test lib/transcript-suspect.test.mjs` | exit 0 |
| Suspect gate on a video | `cd pipelines/video/visuals-flow && node lib/transcript-suspect.mjs best-ai-video-generator` | exit 0 (that video is already corrected) |
| Second opinion | `cd pipelines/video/visuals-flow && node lib/transcript-second-opinion.mjs <slug>` | prints a diff table |

## Scope

**In scope** (the only files to create or modify):

- `pipelines/video/visuals-flow/lib/transcribe-groq.mjs`
- `pipelines/video/visuals-flow/lib/transcribe-groq.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/lexicon.json` (new)
- `pipelines/video/visuals-flow/lib/transcript-suspect.mjs` (new)
- `pipelines/video/visuals-flow/lib/transcript-suspect.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/transcript-second-opinion.mjs` (new)
- `pipelines/video/visuals-flow/steps/010-transcribe-run/run.sh`
- `pipelines/video/visuals-flow/steps/010-transcribe-run/cleanup-prompt.md`
- `pipelines/video/visuals-flow/steps/010-transcribe-run/README.md`
- `pipelines/video/visuals-flow/scripts/check.sh`

**Out of scope — looks related, do not touch:**

- `lib/transcript-quality.mjs` and its test. The timing-integrity gate is correct and already permits merges. Do not add suspect logic to it.
- `lib/captions.mjs` / `lib/assemble.mjs`. Captions are downstream and are not the defect; changing them would hide a bad transcript rather than fix it.
- `videos/*/transcript.json` for any existing video. `best-ai-video-generator` was corrected by hand on 2026-08-02 and re-resolved; rewriting it would break cue anchors, which quote the transcript verbatim.
- The cue/zone rulebooks (`lib/cue-rules.mjs`, `lib/zone-rules.mjs`). This defect is upstream of card selection.

## Steps

### Step 1 — Judge timestamp poison by magnitude, not count

In `lib/transcribe-groq.mjs`, replace the clamp loop **and** the `clampCap`
block quoted in Current state with exactly this:

```js
  // whisper-large-v3-turbo word timestamps carry occasional small jitter: a word
  // starting slightly BEFORE its predecessor (test-02: 61 of 5543 words, all
  // ≤0.52s). That is noise, not poison — clamp it.
  //
  // Poison is a timeline that cannot be TRUSTED, which is a question of
  // magnitude, not of how many small jitters occurred. The old guard capped the
  // COUNT at 2% of words and rejected a good transcript at 129/5974 = 2.16% —
  // by nine words. The fallback to local small.en then burned four wrong words
  // onto screen as captions (best-ai-video-generator, 2026-08-02). Every one of
  // those 129 was inside the ≤1.0s window this loop already absorbs.
  //
  // So measure the damage instead: the worst single backwards jump, and the
  // share of total runtime displaced by all of them.
  let clamped = 0;
  let displaced = 0;    // total seconds of backwards jitter absorbed
  let worstOverlap = 0; // the largest single backwards jump anywhere
  for (let i = 1; i < words.length; i++) {
    const overlap = words[i - 1].start - words[i].start;
    if (overlap <= 0) continue;
    if (overlap > worstOverlap) worstOverlap = overlap;
    if (overlap <= 1.0) {
      words[i].start = words[i - 1].start;
      if (words[i].end < words[i].start) words[i].end = words[i].start;
      clamped++;
      displaced += overlap;
    }
  }
  const runtime = words[words.length - 1].end - words[0].start;
  const displacedShare = runtime > 0 ? displaced / runtime : 0;
  if (worstOverlap > 1.0 || displacedShare > 0.02) {
    console.error(
      `transcript rejected: worst backwards jump ${worstOverlap.toFixed(2)}s, ` +
      `${(displacedShare * 100).toFixed(2)}% of runtime displaced across ${clamped} clamped word(s) ` +
      `— timestamps look poisoned`
    );
    process.exit(1);
  }
```

Then extend the success line at the bottom of the file to carry the new numbers.
Find:

```js
  console.log(JSON.stringify({ ok: true, engine: 'groq', model: MODEL, wordCount: words.length, clampedWords: clamped, durationSeconds: words[words.length - 1].end, transcriptPath: outPath }));
```

and replace with:

```js
  console.log(JSON.stringify({ ok: true, engine: 'groq', model: MODEL, wordCount: words.length, clampedWords: clamped, displacedShare: +displacedShare.toFixed(5), worstOverlap: +worstOverlap.toFixed(3), durationSeconds: words[words.length - 1].end, transcriptPath: outPath }));
```

**Extract the guard so it can be tested.** Add this exported pure function near
the top of the file (after the imports) and have the CLI path call it rather
than inlining the loop:

```js
// Exported so the guard is unit-testable without an API call. Mutates `words`
// in place (clamping) and returns the verdict.
export function clampAndJudge(words) {
  let clamped = 0;
  let displaced = 0;
  let worstOverlap = 0;
  for (let i = 1; i < words.length; i++) {
    const overlap = words[i - 1].start - words[i].start;
    if (overlap <= 0) continue;
    if (overlap > worstOverlap) worstOverlap = overlap;
    if (overlap <= 1.0) {
      words[i].start = words[i - 1].start;
      if (words[i].end < words[i].start) words[i].end = words[i].start;
      clamped++;
      displaced += overlap;
    }
  }
  const runtime = words.length ? words[words.length - 1].end - words[0].start : 0;
  const displacedShare = runtime > 0 ? displaced / runtime : 0;
  const poisoned = worstOverlap > 1.0 || displacedShare > 0.02;
  return { clamped, displaced, worstOverlap, displacedShare, poisoned };
}
```

The CLI block then calls `clampAndJudge(words)` and exits 1 with the message
above when `poisoned` is true. Keep the per-word NaN/negative validation loop
that follows it exactly as it is.

**Verify:** `cd pipelines/video/visuals-flow && node -e "import('./lib/transcribe-groq.mjs').then(m=>{const w=[];for(let i=0;i<5974;i++)w.push({text:'x',start:i*0.32,end:i*0.32+0.3});for(let i=1;i<130;i++)w[i*40].start=w[i*40-1].start-0.2;console.log(m.clampAndJudge(w))})"`
→ prints `clamped: 129` and `poisoned: false`.

### Step 2 — Record the engine and make a downgrade loud

In `steps/010-transcribe-run/run.sh`, after the `engine` is settled and **before**
the `raw_backup` copy, write a metadata file and shout on the fallback path.
Insert exactly:

```sh
# The transcript is a render-critical artifact: step 090 burns its words onto
# screen as captions verbatim. Record which engine produced it so a later step
# (and a human reading the run-log) can see when caption quality was degraded.
cat > "$workdir/transcript-meta.json" <<META
{"engine":"$engine","model":"$([ "$engine" = groq ] && echo whisper-large-v3-turbo || echo small.en)","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
META

if [ "$engine" != "groq" ]; then
  cat >&2 <<'WARN'
================================================================================
 CAPTION QUALITY DEGRADED — transcript came from local whisper small.en
 Groq whisper-large-v3-turbo was unavailable or rejected, so this transcript is
 from the weaker local model. small.en mis-transcribes spec tokens and product
 names, and those words get BURNED ONTO THE VIDEO as captions.
 Run the suspect gate and the second-opinion pass before the cue pass:
   node lib/transcript-suspect.mjs <slug>
   node lib/transcript-second-opinion.mjs <slug>
================================================================================
WARN
fi
```

**Verify:** `cd pipelines/video/visuals-flow && bash -n steps/010-transcribe-run/run.sh && echo "syntax ok"` → prints `syntax ok`.

### Step 3 — Add the domain lexicon

Create `lib/lexicon.json` with exactly this content. `terms` are tokens that are
correct and must never be flagged; `confusables` maps a mis-transcription (lower-cased,
whitespace-normalised) to its correction.

```json
{
  "_comment": "Domain vocabulary for the ASR cleanup pass and the suspect gate. `terms` are known-good tokens (never flag them). `confusables` are observed mis-transcriptions mapped to the correct form; keys are lower-cased and whitespace-normalised. Append to this file whenever a fold finds a new garble — that is how this gate gets better.",
  "terms": [
    "1080p", "4K", "8K", "720p", "60fps", "30fps",
    "SCORM", "SSO", "SAML", "API", "SDK", "CSV", "JSON", "MP4", "GIF",
    "one-click", "text-to-video", "text-to-speech", "lip-sync", "voice cloning",
    "HeyGen", "Synthesia", "Higgsfield", "Arcads", "OpenArt", "OpusClip",
    "Submagic", "Zapier", "Make", "n8n", "LangChain", "Flowise"
  ],
  "confusables": {
    "10 atp": "1080p",
    "ten atp": "1080p",
    "one clip": "one-click",
    "won click": "one-click",
    "straight forward": "straightforward",
    "squirm": "SCORM",
    "score m": "SCORM",
    "for k": "4K",
    "single sign on": "SSO"
  }
}
```

**Verify:** `cd pipelines/video/visuals-flow && node -e "const l=require('./lib/lexicon.json');console.log(l.terms.length,'terms',Object.keys(l.confusables).length,'confusables')"` → prints `31 terms 9 confusables`.

### Step 4 — Build the suspect gate

Create `lib/transcript-suspect.mjs`. Match `lib/transcript-quality.mjs`'s shape:
pure exported functions, then a CLI block.

It exports `findSuspects(words, lexicon)` returning an array of
`{ kind, at, text, suggestion, reason }` sorted by `at`, where `kind` is one of
`confusable | digit-letter | once-only-proper-noun`. Detection rules, all three
required:

1. **`confusable`** — for each key in `lexicon.confusables`, scan the word stream
   for that consecutive token run (compare on `text` lower-cased with punctuation
   stripped). Report `at` = the first word's `start`, `text` = the matched run as
   written, `suggestion` = the mapped value.

2. **`digit-letter`** — a token matching `/^\d+$/` immediately followed by a token
   matching `/^[A-Z]{2,4}$/`, OR any single token matching `/^\d+[A-Za-z]{2,}$/`.
   This is the "10 ATP" shape: a spoken spec like "1080p" that the ASR split into
   a number and an acronym. `suggestion` is `null` (there is nothing to guess).
   Skip the match if the joined form is already in `lexicon.terms`.

3. **`once-only-proper-noun`** — a token that is capitalized, is at least 4
   characters, is **not** sentence-initial (the previous token does not end in
   `.`, `!` or `?`), appears exactly **once** in the whole transcript, and is not
   in `lexicon.terms`. This is what would have caught "Harrison". `suggestion` is
   `null`.

The CLI takes a slug, reads `transcript.json` and the merged lexicon
(`lib/lexicon.json`, then `videos/<slug>/lexicon.json` if present — per-video
`terms` append, per-video `confusables` override by key), and:

- writes `videos/<slug>/transcript-suspects.json` with the findings;
- prints one line per suspect: `<kind>  t=<at>s  "<text>"  -> <suggestion or "?">  (<reason>)`;
- exits **1** if any suspect is not acknowledged, **0** otherwise.

Acknowledgement: a suspect is cleared when either its text no longer appears in
the transcript (it was corrected), or its `at` timestamp is listed in
`videos/<slug>/transcript-suspects.reviewed.json`, a file of shape
`{"reviewed": [{"at": 1675.17, "why": "checked against audio, correct as-is"}]}`.
A `reviewed` entry with a missing or empty `why` does NOT clear the suspect —
acknowledging must cost a sentence, or it becomes a rubber stamp.

**Verify:** `cd pipelines/video/visuals-flow && node lib/transcript-suspect.mjs best-ai-video-generator; echo "exit=$?"` → exit 0 (that transcript was corrected on 2026-08-02, so nothing should fire).

### Step 5 — Build the second-opinion pass

Create `lib/transcript-second-opinion.mjs <slug>`. For each suspect in
`videos/<slug>/transcript-suspects.json`, it re-checks just that window against
the stronger model. This is a direct port of the manual procedure that confirmed
all four corrections on 2026-08-02:

- window = `[at - 7, at + 7]`, clamped to the transcript's span;
- `ffmpeg -v error -ss <start> -t <len> -i vo.mp3 -ar 16000 -ac 1 -b:a 32k <tmp>.mp3 -y`;
- POST that file to `https://api.groq.com/openai/v1/audio/transcriptions` with
  `model=whisper-large-v3-turbo`, `response_format=json`, bearer `GROQ_API_KEY`
  (copy the request shape from `lib/transcribe-groq.mjs`);
- print a table: suspect text, what the local transcript says over that window,
  what `large-v3-turbo` says, and whether they differ.

It never writes `transcript.json` — a human or the cleanup pass decides. Exit 0
always unless `GROQ_API_KEY` is missing (exit 2) or ffmpeg is absent (exit 2).
Deduplicate overlapping windows before calling the API so three suspects two
seconds apart cost one request, not three.

**Verify:** `cd pipelines/video/visuals-flow && node lib/transcript-second-opinion.mjs 2>&1 | head -2` → prints a usage line and exits non-zero (no slug given).

### Step 6 — Give the cleanup pass a spec-term carve-out

In `steps/010-transcribe-run/cleanup-prompt.md`, immediately **after** the
existing brand-names paragraph and **before** the "Change nothing else"
paragraph, insert exactly:

```md
**Fix spec and product terms** to their real form, using `lib/lexicon.json`.
This is the same class of fix as a brand name, not a grammar rewrite: when the
ASR renders "1080p" as "10 ATP" or "one-click" as "one clip", the caption is
not showing what the speaker said — it is showing a mis-hearing of it. Correct
these the same way you correct brands, merging split words into ONE output word
that spans both timings. The `confusables` map in the lexicon lists the ones
already seen; apply the same judgment to spec tokens it does not yet list
(resolutions, frame rates, file formats, plan tiers, feature names). When you
are unsure whether a token is a mis-hearing or genuinely what was said, LEAVE
IT and note it — the suspect gate will surface it for a second opinion.
```

Do not modify the "Change nothing else" paragraph. Its point still stands and
the new paragraph is scoped narrowly enough not to contradict it.

Then in `steps/010-transcribe-run/README.md`, add the two new commands to the
step's documented flow, after the cleanup-pass instructions.

**Verify:** `cd pipelines/video/visuals-flow && grep -c 'Fix spec and product terms' steps/010-transcribe-run/cleanup-prompt.md` → prints `1`.

### Step 7 — Tests and gate wiring

Create `lib/transcript-suspect.test.mjs` (`node:test` + `node:assert/strict`,
matching `lib/transcript-quality.test.mjs`). It must include a fixture built
from the real case, asserting all four are found:

```js
const WORDS = [
  { text: 'comparing', start: 8.0, end: 8.4 }, { text: 'them', start: 8.4, end: 8.6 },
  { text: 'is', start: 8.6, end: 8.8 }, { text: 'not', start: 8.8, end: 9.6 },
  { text: 'straight', start: 9.755, end: 10.1 }, { text: 'forward', start: 10.1, end: 10.5 },
  { text: 'like', start: 1519.0, end: 1519.4 }, { text: 'SCORM', start: 1519.72, end: 1520.2 },
  { text: 'export', start: 1520.2, end: 1520.6 }, { text: 'and', start: 1520.6, end: 1520.7 },
  { text: 'one', start: 1520.72, end: 1520.9 }, { text: 'clip', start: 1520.9, end: 1521.3 },
  { text: 'translation', start: 1521.3, end: 1521.9 },
  { text: 'videos,', start: 1554.0, end: 1554.4 }, { text: '10', start: 1554.49, end: 1554.7 },
  { text: 'ATP', start: 1554.88, end: 1555.2 }, { text: 'exports,', start: 1555.2, end: 1555.8 },
  { text: 'with.', start: 1673.89, end: 1674.4 }, { text: 'Harrison', start: 1675.17, end: 1675.4 },
  { text: 'covers', start: 1675.4, end: 1675.8 },
];
```

Required assertions:

- `findSuspects` returns a `confusable` at 9.755 suggesting `straightforward`;
- a `confusable` at 1520.72 suggesting `one-click`;
- a `digit-letter` at 1554.49 for `10 ATP`;
- a `once-only-proper-noun` at 1675.17 for `Harrison`;
- `SCORM` at 1519.72 is **not** flagged (it is in `lexicon.terms`);
- a `reviewed` entry with an empty `why` does not clear a suspect, and one with a real `why` does.

Create `lib/transcribe-groq.test.mjs` asserting `clampAndJudge`:

- accepts the real failure case: 5974 words with 129 sub-second backwards jitters → `poisoned === false`, `clamped === 129`;
- rejects a genuinely backwards timeline: one word starting 4s before its predecessor → `poisoned === true`;
- rejects death-by-a-thousand-cuts: jitter totalling >2% of runtime → `poisoned === true`;
- an empty array does not throw.

Finally add both new test files to the `node --test` list in `scripts/check.sh`,
appended to the existing single-line list (do not reorder or drop any existing entry).

**Verify:** `cd pipelines/video/visuals-flow && node --test lib/transcript-suspect.test.mjs lib/transcribe-groq.test.mjs` → exit 0, all assertions pass.

## Test plan

| New test | Where | Follows |
|---|---|---|
| suspect detection, all three kinds + lexicon exemption + reviewed-file semantics | `lib/transcript-suspect.test.mjs` | `lib/transcript-quality.test.mjs` |
| poison guard: accept 2.16% jitter, reject big jumps, reject >2% displaced runtime | `lib/transcribe-groq.test.mjs` | `lib/transcript-quality.test.mjs` |

No test may call the Groq API. Both modules must be importable and testable
without `GROQ_API_KEY` set — keep the API call behind the CLI block.

## Done criteria

Every one of these must pass, run from `pipelines/video/visuals-flow/`:

1. `bash scripts/check.sh` → exit 0, prints `visuals-flow check OK`.
2. `node --test lib/transcript-suspect.test.mjs lib/transcribe-groq.test.mjs` → exit 0.
3. `node lib/transcript-suspect.mjs best-ai-video-generator; echo $?` → `0`.
4. `grep -c 'transcript-suspect.test.mjs' scripts/check.sh` → `1`.
5. `grep -c 'Fix spec and product terms' steps/010-transcribe-run/cleanup-prompt.md` → `1`.
6. `bash -n steps/010-transcribe-run/run.sh` → exit 0.
7. `git status --porcelain videos/` → **empty**. No existing video's artifacts may be modified by this plan.

## STOP conditions

- **Gate integrity**: if a gate assertion fails, fix the code or the fixture. Weakening, swapping, or deleting the assertion is a STOP — report instead. (Crews reliably soften assertions to pass: LESSONS 2026-07-31, 2026-07-24.)
- **Do not rewrite any existing `videos/*/transcript.json`.** Cue anchors quote the transcript verbatim, so a text edit silently breaks every anchor in that video. `best-ai-video-generator` was corrected and re-resolved by hand on 2026-08-02; if the suspect gate fires on it, report what it found — do not "fix" the transcript.
- If the suspect gate's `once-only-proper-noun` rule fires on more than ~15 tokens for `best-ai-video-generator`, it is too loose to be a gate. Stop and report the count and a sample rather than padding `lexicon.terms` until it goes quiet.
- If `scripts/check.sh` has been changed on `main` since the drift check, rebase and **resolve the `node --test` list by concatenation** — this file is a known serial-collision point across visuals-flow plans. Never resolve it by taking one side.

## Maintenance notes

- `lib/lexicon.json` is meant to grow. Every future feedback fold that finds a garble should append to `confusables` — that is the mechanism by which this gate improves, and it costs one line.
- The `once-only-proper-noun` rule is the loosest of the three and will produce false positives on genuinely rare names. That is the intended trade: it is a gate that asks a question, not an auto-correct. The `reviewed.json` escape hatch with a mandatory `why` is what keeps it survivable.
- A reviewer should scrutinise the poison-guard thresholds. `worstOverlap > 1.0` is deliberately the same boundary as the clamp window, so the two can never disagree about what counts as poison; if someone widens the clamp window, they must widen this together or the guard becomes unreachable.
- If Groq ever becomes reliable enough that the local fallback never fires, the loud warning in Step 2 becomes dead code — leave it. It costs nothing and it is the only signal that caption quality silently dropped.
