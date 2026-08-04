---
executor: agy
model:
test_cmd: cd pipelines/video/intro-studio && bash scripts/check.sh
ui:
deploy:
needs: ["first of the 180-182 intro-studio batch; 181 and 182 depend on this scaffold"]
---

# Plan 180: intro-studio — scaffold and materials stage

## Summary

- **Problem statement**: visuals-flow builds its intro by placing 6 independent pre-made catalog cards over the screen recording. Because each card is a sealed template that knows nothing about its neighbours, the intro reads as a slideshow — no object persists across beats, no tonal arc, and the presenter's face cannot be composed into the design. The owner wants intros authored as ONE bespoke composition instead, proven first as a standalone tool that does not touch visuals-flow.
- **Goals**:
  - Create `pipelines/video/intro-studio/` as a self-contained pipeline with a `run.sh` driver, mirroring visuals-flow's shape (steps folders, `lib/`, `scripts/check.sh`).
  - Land the materials stage: take one recorded `input/intro.mp4`, split it into `vo.mp3` + `screen.mp4`, produce `transcript.json` with word timestamps, and accept an avatar clip.
  - Change ZERO files under `pipelines/video/visuals-flow/` or `pipelines/video/card-library/`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner's explicit choice, and this plan is mechanical file/CLI plumbing that matches the agy sweet spot.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0; `run.sh <slug> status` prints the artifact table; intake produces vo/screen/transcript from a fixture mp4; `git diff --stat` touches nothing under visuals-flow or card-library.
- **Stop conditions** (terse — full list below): any need to edit visuals-flow or card-library; any live HeyGen network call; missing `GROQ_API_KEY` handled by fallback, never by inventing a transcript.
- **Test / verification for success**: `node --test` unit tests over the pure functions (intake arg building, workdir resolution, transcript shape validation) plus a real ffmpeg round-trip on a generated 6-second fixture mp4.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/intro-studio pipelines/video/visuals-flow`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

The owner bought Loop Studio and found its intro genuinely good. Reading Loop Studio's `editors/intro.md`, its intro is one authored screenplay — a continuous stage where an object introduced in beat 1 is demoted/promoted through later beats, the colour register crossfades dark→light on the turn word, and the face is composited INTO the design (full-screen, then docked to a panel). Their own line is "continuity is the craft."

visuals-flow structurally cannot express that: its largest unit of authorship is a single catalog card, and a card cannot know what preceded it. The fix is not better cards, it is a bigger unit — one composition per intro.

This is a proof of concept. The owner's explicit constraint: build it standalone so nothing in the working visuals-flow pipeline is at risk until they have seen an intro they like. The handoff between the two systems is deliberately the dumbest possible thing — this tool emits an `intro.mp4` file, and the owner drops it into their video by hand. Wiring it into visuals-flow is a separate future plan and is explicitly NOT in this batch.

This plan is stage one of three: get the raw materials into a predictable shape. Plan 181 writes the screenplay pass, plan 182 composes, renders and critiques.

## Current state

`pipelines/video/visuals-flow/` is the pipeline this one mirrors in shape but must not touch. The conventions to copy:

- **Driver**: `run.sh <slug> <step>` is the single entry point; `run.sh <slug> status` prints an artifact table naming the next step. See `pipelines/video/visuals-flow/run.sh`.
- **Per-video workdir**: `videos/<slug>/` holds every artifact for one video. Media inside it is gitignored.
- **Steps**: `steps/NNN-name-actor/README.md` — actor suffix is one of `-run` (scripted), `-llm` (a Claude session does it), `-human` (owner).
- **Test gate**: `scripts/check.sh` runs an EXPLICIT list of test files. It must not use `node --test <dir>` — that form fails on node 22.14 with "Cannot find module '.../test'" (LESSONS 2026-07-09). Working forms: explicit files, a glob, or bare `node --test` from the package dir.

Existing `pipelines/video/visuals-flow/scripts/check.sh` (the shape to copy):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/source-structure.test.mjs lib/brand-inline.test.mjs ...
node lib/check-rulebook.mjs
echo "visuals-flow check OK"
```

Transcription already has a proven fast path at `pipelines/video/visuals-flow/lib/transcribe-groq.mjs`. Its contract, read from the file:

```
// Groq fast-path transcription: vo.mp3 -> transcript.json (word-level timestamps)
// Same output contract as `npx hyperframes transcribe` (flat [{text,start,end}]),
// ~30-60s for a 30-min VO vs ~8 min local.
const MODEL = 'whisper-large-v3-turbo';
// usage: node lib/transcribe-groq.mjs <slug-or-path> [--out <file>]
// reads <workdir>/vo.mp3, writes <workdir>/transcript.json
// exits 2 when GROQ_API_KEY is not set
```

**You will NOT import from visuals-flow.** intro-studio is standalone; it shells out to `npx hyperframes transcribe` and implements its own Groq fast path only if trivially, which this plan does NOT ask for. Use `npx hyperframes transcribe` as the single transcription path (see Step 5).

Hyperframes version is pinned in this repo. From `pipelines/video/visuals-flow/lib/render.mjs`:

```js
const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';
```

Use the same pin (`hyperframes@0.7.62`, overridable by `HYPERFRAMES_VERSION`) so the POC renders against the version the rest of the repo is proven on.

`pipelines/video/visuals-flow/brand.json` is 241 bytes of brand tokens. Copy it into intro-studio rather than importing it — standalone means standalone, and a POC diverging its palette is acceptable.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo root | `cd /Users/kbtg/codebase/personal-stuff` | — |
| Test gate | `cd pipelines/video/intro-studio && bash scripts/check.sh` | exit 0, prints `intro-studio check OK` |
| Unit tests only | `cd pipelines/video/intro-studio && node --test lib/intake.test.mjs lib/workdir.test.mjs lib/transcript.test.mjs` | exit 0 |
| ffmpeg present | `ffmpeg -version` | prints a version banner, exit 0 |
| ffprobe duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | a float |
| Driver status | `cd pipelines/video/intro-studio && bash run.sh demo status` | artifact table, exit 0 |
| Scope check | `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` | EMPTY output |

## Scope

**In scope**:
- `pipelines/video/intro-studio/` — every file in it (new folder).
- `plans/README.md` — status row for this plan only.

**Out of scope** (looks related, do NOT touch):
- `pipelines/video/visuals-flow/**` — the working pipeline. The entire point of this POC is that it stays untouched. Editing it is a STOP.
- `pipelines/video/card-library/**` — the shared card catalog. intro-studio does not use cards at all.
- `pipelines/CLAUDE.md` — the folder map gets its intro-studio row in plan 182's final step, not here (avoids three plans fighting over one table).
- `tooling/cli/heygen-web/**` — the avatar CLI is invoked, never modified.

## Git workflow

- Branch: `advisor/180-intro-studio-scaffold-and-materials`
- Commit per step: `feat(intro-studio): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the folder skeleton

Create `pipelines/video/intro-studio/` with these files. Exact contents given.

`pipelines/video/intro-studio/.gitignore`:

```
videos/*/input/
videos/*/vo.mp3
videos/*/screen.mp4
videos/*/avatar*.mp4
videos/*/avatar*.mov
videos/*/renders/
videos/*/out/
videos/*/qc/
videos/*/film/assets/
.test-tmp/
node_modules/
```

`pipelines/video/intro-studio/brand.json` — copy verbatim from `pipelines/video/visuals-flow/brand.json`:

```bash
cp pipelines/video/visuals-flow/brand.json pipelines/video/intro-studio/brand.json
```

`pipelines/video/intro-studio/README.md`:

```markdown
# intro-studio

Builds a video's intro as ONE bespoke authored composition instead of a
sequence of pre-made cards.

In: one recorded `videos/<slug>/input/intro.mp4` (screen recording + voice).
Out: `videos/<slug>/out/intro.mp4`.

Standalone by design — it does not read or write anything in
`visuals-flow`. The handoff is the mp4 file; drop it into your edit by hand.

Operating guide: [CLAUDE.md](CLAUDE.md). Stage-by-stage reference: [PIPELINE.md](PIPELINE.md).
```

`pipelines/video/intro-studio/CLAUDE.md`:

```markdown
# intro-studio — how to operate here

## What this is

A standalone proof of concept. It builds one video's intro as a single
authored Hyperframes composition — one continuous stage, objects that carry
across beats, a colour register that shifts on the story's turn, and the
presenter's face composed INTO the design rather than laid over footage.

## The one hard rule

**Never edit `../visuals-flow/` or `../card-library/` from here.** This
pipeline exists so the owner can evaluate a new intro approach with zero risk
to the working pipeline. The two systems meet at exactly one place: this one
emits `videos/<slug>/out/intro.mp4`, and the owner drops that file into their
edit by hand. There is no code path between them.

## Entry point

- `bash run.sh <slug> status` — artifact table, names the next step
- `bash run.sh <slug> <step>` — dispatch a step

## Gate

`bash scripts/check.sh` — must be green before any commit.
```

`pipelines/video/intro-studio/PIPELINE.md`:

```markdown
# intro-studio — the flow

| Step | Actor | In → Out |
|---|---|---|
| `010-intake-run` | [RUN] | `input/intro.mp4` → `vo.mp3` + `screen.mp4` + `transcript.json` (word timestamps) |
| `015-avatar-clip-human` | [OWNER] | the intro VO → one avatar clip covering the WHOLE intro, saved as `avatar.mp4`. Live HeyGen is owner-run; this step never makes a network call on its own |
| `020-write-screenplay-llm` | [LLM] | `transcript.json` → `screenplay.json` (plan 181) |
| `025-approve-screenplay-human` | [OWNER] | reads `screenplay.json`, approves or edits (plan 181) |
| `030-author-film-llm` | [LLM] | approved `screenplay.json` → `film/index.html` (plan 182) |
| `040-render-run` | [RUN] | `film/index.html` → `renders/intro-film.mp4` (plan 182) |
| `050-critique-llm` | [LLM] | the render → frame contact sheet → PASS/FAIL against `INTRO-BAR.md`; one retry on FAIL (plan 182) |
| `060-deliver-run` | [RUN] | passing render → `out/intro.mp4` (plan 182) |

Steps 020-060 land in plans 181 and 182. This file lists them from the start
so the shape is legible while the pipeline is half-built.
```

Create empty-but-real step folders for this plan's stages only:

- `steps/010-intake-run/README.md`
- `steps/015-avatar-clip-human/README.md`

Each README states the step's inputs, outputs and exact command. Write them to match the PIPELINE.md rows above; `015`'s README must carry the HeyGen guidance from Step 6.

**Verify**: `test -f pipelines/video/intro-studio/CLAUDE.md && test -f pipelines/video/intro-studio/brand.json && ls pipelines/video/intro-studio/steps/ | wc -l` → `2`

### Step 2: `lib/workdir.mjs`

Write this file exactly:

```js
// Resolve a slug (or a path) to the per-video working directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveWorkdir(slugOrPath) {
  if (!slugOrPath) throw new Error('resolveWorkdir: slug or path required');
  if (slugOrPath.includes('/')) return path.resolve(slugOrPath);
  return path.join(ROOT, 'videos', slugOrPath);
}

export function ensureWorkdir(slugOrPath) {
  const dir = resolveWorkdir(slugOrPath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const rootDir = () => ROOT;
```

Write `lib/workdir.test.mjs` covering: a bare slug resolves under `videos/`, a path with a slash is returned resolved, an empty argument throws.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/workdir.test.mjs` → exit 0, 3 passing

### Step 3: `lib/intake.mjs` — argument builders as pure functions

The ffmpeg invocations must be pure functions returning argv arrays, so they are unit-testable without running ffmpeg. Write this file exactly:

```js
// Split one recorded intro.mp4 into the two materials the film needs:
// vo.mp3 (the voice, for transcription and as the film's audio bed) and
// screen.mp4 (the recording, available to the film as a framed element).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

// 16kHz mono keeps whisper happy and the upload small.
export function audioExtractArgs(inFile, outFile) {
  return ['-y', '-i', inFile, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', outFile];
}

// Normalise the recording to 1920x1080 / 30fps so the film composes against a
// known canvas. Letterbox rather than crop — never silently discard picture.
export function screenNormaliseArgs(inFile, outFile) {
  return [
    '-y', '-i', inFile,
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    outFile,
  ];
}

export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  const d = parseFloat(String(r.stdout).trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe gave no duration for ${file}`);
  return d;
}

export function runIntake(slug) {
  const workdir = resolveWorkdir(slug);
  const input = path.join(workdir, 'input', 'intro.mp4');
  if (!fs.existsSync(input)) throw new Error(`missing ${input} — put the recorded intro there first`);

  const vo = path.join(workdir, 'vo.mp3');
  const screen = path.join(workdir, 'screen.mp4');

  for (const [label, args] of [['audio', audioExtractArgs(input, vo)], ['screen', screenNormaliseArgs(input, screen)]]) {
    const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg ${label} pass failed (exit ${r.status})`);
  }

  const meta = {
    slug: path.basename(workdir),
    source: 'input/intro.mp4',
    duration: probeDuration(vo),
    videoDuration: probeDuration(screen),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(workdir, 'intake.json'), JSON.stringify(meta, null, 2));
  return meta;
}
```

Write `lib/intake.test.mjs` asserting the exact argv arrays (input/output paths land in the right slots, `-ac 1`, `-ar 16000`, the scale+pad+fps filter string, `-an` on the screen pass). Do NOT run ffmpeg in this test file.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/intake.test.mjs` → exit 0

### Step 4: ffmpeg round-trip test on a generated fixture

Unit tests over argv strings cannot catch a filter that ffmpeg rejects. Add `lib/intake.roundtrip.test.mjs` that:

1. Creates `.test-tmp/rt/input/` and generates a 6-second fixture with ffmpeg's own sources — no binary fixture committed:
   ```
   ffmpeg -y -f lavfi -i testsrc=size=640x360:rate=30:duration=6 \
          -f lavfi -i sine=frequency=440:duration=6 \
          -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest .test-tmp/rt/input/intro.mp4
   ```
2. Calls `runIntake('.test-tmp/rt')`.
3. Asserts `vo.mp3` and `screen.mp4` exist and are non-empty, `intake.json` parses, and `meta.duration` is within 0.3s of 6.
4. Asserts the screen pass really is 1920x1080 via ffprobe:
   ```
   ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 .test-tmp/rt/screen.mp4
   ```
   expected `1920,1080`.
5. Cleans up `.test-tmp/rt` in a `test.after` hook — **guaranteed teardown, not at the end of the test body** (LESSONS 2026-07-31: a test that leaves handles or dirt open makes later failures invisible).

If `ffmpeg` is not on PATH, the test must `t.skip()` with a clear message, never silently pass.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/intake.roundtrip.test.mjs` → exit 0, and `ffprobe` reports `1920,1080`

### Step 5: Transcription — `lib/transcript.mjs`

Transcription shells out to the pinned Hyperframes CLI. Write:

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';

// The transcript contract, shared with the rest of the repo:
// a flat array of { text, start, end }, one entry per WORD, times in seconds.
export function validateTranscript(words) {
  const errs = [];
  if (!Array.isArray(words)) return ['transcript is not an array'];
  if (words.length === 0) errs.push('transcript is empty');
  words.forEach((w, i) => {
    if (typeof w?.text !== 'string' || !w.text.length) errs.push(`word ${i}: missing text`);
    if (!Number.isFinite(w?.start) || !Number.isFinite(w?.end)) errs.push(`word ${i}: non-numeric start/end`);
    else if (w.end < w.start) errs.push(`word ${i}: end before start`);
    if (i > 0 && Number.isFinite(w?.start) && Number.isFinite(words[i - 1]?.start) && w.start < words[i - 1].start - 0.001) {
      errs.push(`word ${i}: start goes backwards`);
    }
  });
  return errs;
}

export function transcriptText(words) {
  return words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
}

export function runTranscribe(slug) {
  const workdir = resolveWorkdir(slug);
  const vo = path.join(workdir, 'vo.mp3');
  if (!fs.existsSync(vo)) throw new Error(`missing ${vo} — run the intake step first`);
  const out = path.join(workdir, 'transcript.json');
  const r = spawnSync('npx', ['-y', HYPERFRAMES, 'transcribe', vo, '--output', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`transcribe failed (exit ${r.status})`);
  const words = JSON.parse(fs.readFileSync(out, 'utf8'));
  const errs = validateTranscript(words);
  if (errs.length) throw new Error(`transcript failed validation:\n  ${errs.slice(0, 10).join('\n  ')}`);
  return words;
}
```

**If `npx hyperframes transcribe` does not accept `--output`**, run `npx -y hyperframes@0.7.62 transcribe --help`, read the real flag, and use it — then record the actual flag in `steps/010-intake-run/README.md`. Do not invent a different transcription tool.

Write `lib/transcript.test.mjs` covering `validateTranscript` (empty array, missing text, backwards start, non-numeric times, a valid three-word transcript returning `[]`) and `transcriptText` (joins and collapses whitespace). No network in this test file.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/transcript.test.mjs` → exit 0

### Step 6: `steps/015-avatar-clip-human/README.md` — the avatar, owner-run

The face is central to this design, but the recorded `intro.mp4` is a screen recording and carries no face. The avatar clip is generated separately.

**One clip for the whole intro.** Do not slice per beat. HeyGen renders a single avatar clip speaking the entire intro VO; the film then decides moment to moment whether to show it full-screen, dock it into a panel, or hide it. Because the audio is continuous, the lip-sync is correct whenever the face is visible, and no span negotiation is needed anywhere in the system.

Write the README to say exactly that, plus:

- The clip is saved to `videos/<slug>/avatar.mp4`.
- Generation is **owner-run** with `tooling/cli/heygen-web`, resolving a character slug from `pipelines/video/heygen/registry.json` (`specs-man` is the current default man template; `girl-1`/`girl-2` are template renders). Read `tooling/cli/heygen-web/CLAUDE.md` before submitting.
- Every render gets a row in `pipelines/video/heygen/RENDERS.md` per the media policy in `pipelines/CLAUDE.md`.
- **This step makes no network call from intro-studio code, and no test in this repo may make one.** HeyGen calls are ToS-grey and account-bound (`tooling/cli/heygen-web/CLAUDE.md`: "Never run live HeyGen calls to test").
- If the owner already has a suitable clip, they drop it at `videos/<slug>/avatar.mp4` and skip generation entirely.

Add `lib/avatar.mjs` with one pure function and no network code:

```js
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration } from './intake.mjs';

// The avatar clip must cover the whole intro, or the film cannot show the face
// wherever the screenplay wants it. Short by more than a frame is a hard stop.
export function checkAvatarClip(slug, { tolerance = 0.1 } = {}) {
  const workdir = resolveWorkdir(slug);
  const clip = path.join(workdir, 'avatar.mp4');
  if (!fs.existsSync(clip)) return { ok: false, reason: 'no avatar.mp4 — see steps/015-avatar-clip-human/README.md' };
  const intake = JSON.parse(fs.readFileSync(path.join(workdir, 'intake.json'), 'utf8'));
  const clipDur = probeDuration(clip);
  if (clipDur + tolerance < intake.duration) {
    return { ok: false, reason: `avatar.mp4 is ${clipDur.toFixed(2)}s but the intro is ${intake.duration.toFixed(2)}s — regenerate over the full VO` };
  }
  return { ok: true, duration: clipDur };
}
```

Write `lib/avatar.test.mjs` for the missing-file branch only (the duration branches need ffprobe and a fixture — cover them in the roundtrip test if cheap, otherwise leave them; do NOT add a network test).

**Verify**: `cd pipelines/video/intro-studio && node --test lib/avatar.test.mjs` → exit 0, and `grep -rn "heygen.com\|api.heygen" pipelines/video/intro-studio/lib/ | wc -l` → `0`

### Step 7: `run.sh` driver

Write `pipelines/video/intro-studio/run.sh`, modelled on visuals-flow's driver but far smaller. It must support:

- `bash run.sh <slug> status` — print an artifact table: for each of `input/intro.mp4`, `vo.mp3`, `screen.mp4`, `transcript.json`, `avatar.mp4`, `screenplay.json`, `film/index.html`, `renders/intro-film.mp4`, `out/intro.mp4` print present/missing, then name the next step to run.
- `bash run.sh <slug> intake` — `node -e` into `runIntake` then `runTranscribe`.
- `bash run.sh <slug> avatar-check` — `checkAvatarClip`, exit 1 with the reason when not ok.
- Any unknown step: print the known steps and exit 1.
- `set -euo pipefail`, and `cd "$(dirname "$0")"` at the top.

Steps not yet built (`screenplay`, `author`, `render`, `critique`, `deliver`) must print `not built yet — see plans/181, plans/182` and exit 1. They are wired in by the later plans.

**Verify**: `cd pipelines/video/intro-studio && bash run.sh demo status` → exits 0 and prints a table with `input/intro.mp4` marked missing; `bash run.sh demo nonsense` → exits 1

### Step 8: `scripts/check.sh` and the driver smoke test

Write `pipelines/video/intro-studio/scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/workdir.test.mjs lib/intake.test.mjs lib/intake.roundtrip.test.mjs lib/transcript.test.mjs lib/avatar.test.mjs
bash scripts/test-run-sh.sh
echo "intro-studio check OK"
```

Write `scripts/test-run-sh.sh` asserting: `run.sh demo status` exits 0; `run.sh demo nonsense` exits 1; `run.sh demo render` exits 1 and its output contains `not built yet`. Use a throwaway slug under `.test-tmp/` and clean up with a `trap`.

`chmod +x` both scripts.

**Verify**: `cd pipelines/video/intro-studio && bash scripts/check.sh` → exit 0, last line `intro-studio check OK`

### Step 9: Register the plan row

Add the row for plan 180 to `plans/README.md` following the existing table format, status `DONE`.

**Verify**: `grep -c "180-intro-studio-scaffold-and-materials" plans/README.md` → `1`

## Test plan

- Pure-function unit tests: `lib/workdir.test.mjs`, `lib/intake.test.mjs`, `lib/transcript.test.mjs`, `lib/avatar.test.mjs`.
- One real ffmpeg round trip on a generated fixture: `lib/intake.roundtrip.test.mjs`. This is the test that catches a filter string ffmpeg rejects — argv assertions alone cannot.
- Driver smoke: `scripts/test-run-sh.sh`.
- Every test file that creates directories or processes cleans up in `test.after`, never at the end of the test body.

## Done criteria

- [ ] `cd pipelines/video/intro-studio && bash scripts/check.sh` exits 0 and prints `intro-studio check OK`
- [ ] `bash run.sh demo status` exits 0 and prints the artifact table
- [ ] `bash run.sh demo render` exits 1 with `not built yet`
- [ ] The round-trip test produces a 1920x1080 `screen.mp4` (`ffprobe … -of csv=p=0` → `1920,1080`)
- [ ] `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` prints NOTHING
- [ ] `grep -rn "heygen.com\|api.heygen\|visuals-flow" pipelines/video/intro-studio/lib/ pipelines/video/intro-studio/scripts/` returns no matches
- [ ] `plans/README.md` carries the 176 row

## STOP conditions

- **Any change to a file under `pipelines/video/visuals-flow/` or `pipelines/video/card-library/`.** This is the plan's central constraint. Stop and report rather than "just fixing" something there.
- **Any code path that calls the HeyGen API**, in library code or a test. Avatar generation is owner-run through the existing CLI.
- `npx hyperframes transcribe` does not exist or its flags differ so much the Step 5 shape does not fit — stop and report the real `--help` output rather than substituting a different tool.
- A gate assertion fails and the tempting fix is to weaken, swap or delete the assertion. Fix the code or the fixture instead; softening an assertion is a STOP.
- `ffmpeg`/`ffprobe` missing from PATH — report it; do not vendor a binary or stub the round-trip test into a no-op pass.

## Maintenance notes

- The `intake.json` `duration` field is the intro's authoritative length. Plans 181 and 182 both key off it (the screenplay must span it exactly; the render must match it frame-for-frame).
- The one-clip-for-the-whole-intro avatar decision is what keeps this system simple. If a future change slices the avatar per beat, span negotiation and lip-sync drift both come back — reconsider hard before doing it.
- The hyperframes pin (`0.7.62`) is duplicated from visuals-flow rather than imported, on purpose. If the repo upgrades, this POC does not have to move in lockstep.
