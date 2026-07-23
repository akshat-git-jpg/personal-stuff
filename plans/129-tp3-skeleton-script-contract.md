---
executor: agy
model:
test_cmd: cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 129: tutorial-pipeline-3 skeleton, script contract, and script-generation step

## Summary

- **Problem statement**: tutorial-pipeline-3 exists only as a concept doc
  (`WORKFLOW.md`). Nothing can run: no folder skeleton, no script.json contract, no
  lint gate, no script-generation step.
- **Goals**:
  - Pipeline skeleton mirroring visuals-flow (`steps/`, `lib/`, `videos/`,
    `scripts/check.sh`, `run.sh`, `PIPELINE.md`, `.gitignore`).
  - The `script.json` contract (schema + validator + flag scanner + lint CLI, all
    unit-tested).
  - Step 010 (video workdir init) and step 020 (script generation rulebook + prompt,
    text fully provided in this plan's appendices).
- **Executor proposed**: agy (Gemini 3.1 Pro High — agy default). All creative text
  (rulebook, prompt) is authored in this plan's appendices; the executor only places
  files and wires code.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0 in the new folder; lint
  CLI accepts the good fixture and rejects each bad fixture; all appendix files exist
  verbatim.
- **Stop conditions** (terse): drift check fails; any step needs a network call; any
  file outside the in-scope list needs editing.
- **Test / verification for success**: `node --test` suites for schema/flags/lint +
  a run.sh smoke test, all wired into `scripts/check.sh` (the test_cmd).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ff940f0..HEAD -- pipelines/youtube/tutorial-pipeline-3/`
> Expected: only `WORKFLOW.md` may show changes (it is a living concept doc). Any
> other file changed under this path → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ff940f0`, 2026-07-23

## Why this matters

The owner adopted a VO-first tutorial workflow (decisions.md 2026-07-23): script is
written first in sections, TTS is generated per section, and the freelancer records
the screen to the locked audio. The script.json contract is the interface every later
plan (130 polish gate, 132 UI, 133 intake QC) builds against, so it must land first
and be enforced by a lint gate from day one. The generation rulebook is the pipeline's
only script-quality mechanism (owner removed the human reviewer), so its text is
load-bearing and is provided verbatim in Appendix A/B — do not paraphrase it.

## Current state

- `pipelines/youtube/tutorial-pipeline-3/` contains exactly one file, `WORKFLOW.md`
  (the concept doc — read it first for intent; do not modify it).
- The sibling pipeline to imitate structurally is
  `pipelines/video/visuals-flow/`: steps in `steps/NNN-*/` each with a README,
  deterministic code in `lib/*.mjs` with `lib/*.test.mjs` next to it (node:test +
  `assert`), a `scripts/check.sh` that runs an explicit list of test files, per-video
  workdirs in `videos/<slug>/` with text artifacts committed and media gitignored.
- `pipelines/video/visuals-flow/scripts/check.sh` looks like this (imitate the shape):

  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  cd "$(dirname "$0")/.."
  node --test lib/resolve.test.mjs lib/render.test.mjs ...
  echo "visuals-flow check OK"
  ```

- House rule (pipelines/CLAUDE.md): generated media never lives in the repo;
  committed per-video artifacts are text only.
- Known repo lesson: `node --test <dir>` is broken on node 22 — always list test
  files explicitly or use a glob.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the new test gate | `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` | exit 0, last line `tutorial-pipeline-3 check OK` |
| Run one suite | `node --test lib/schema.test.mjs` (from the pipeline folder) | exit 0 |
| Lint a script | `node lib/lint-script.mjs videos/<slug>/script.json` | exit 0 on valid |
| Node version sanity | `node --version` | v20+ |

## Scope

**In scope** (create; nothing else):
- `pipelines/youtube/tutorial-pipeline-3/PIPELINE.md`
- `pipelines/youtube/tutorial-pipeline-3/.gitignore`
- `pipelines/youtube/tutorial-pipeline-3/run.sh`
- `pipelines/youtube/tutorial-pipeline-3/scripts/check.sh`
- `pipelines/youtube/tutorial-pipeline-3/scripts/test-run-sh.sh`
- `pipelines/youtube/tutorial-pipeline-3/lib/schema.mjs` + `lib/schema.test.mjs`
- `pipelines/youtube/tutorial-pipeline-3/lib/flags.mjs` + `lib/flags.test.mjs`
- `pipelines/youtube/tutorial-pipeline-3/lib/lint-script.mjs` + `lib/lint-script.test.mjs`
- `pipelines/youtube/tutorial-pipeline-3/lib/init-video.mjs` + `lib/init-video.test.mjs`
- `pipelines/youtube/tutorial-pipeline-3/steps/010-inputs/README.md`
- `pipelines/youtube/tutorial-pipeline-3/steps/020-script-gen/README.md`
- `pipelines/youtube/tutorial-pipeline-3/steps/020-script-gen/rulebook.md` (Appendix A, verbatim)
- `pipelines/youtube/tutorial-pipeline-3/steps/020-script-gen/prompt.md` (Appendix B, verbatim)

**Out of scope** (do not touch, even if tempting):
- `pipelines/youtube/tutorial-pipeline-3/WORKFLOW.md` — owner's concept doc.
- `pipelines/youtube/tutorial-pipeline-2/` — the superseded pipeline stays as-is.
- `pipelines/video/visuals-flow/` — read-only exemplar.
- `pipelines/CLAUDE.md`, `pipelines/youtube/CLAUDE.md` — folder maps already list
  tutorial-pipeline-3; no edit needed.

## Git workflow

- Branch: `advisor/129-tp3-skeleton-script-contract`
- Commit per step, conventional single-line messages (e.g.
  `tp3: add script.json schema + validator`) — no AI footers. Do NOT push.

## The script.json contract (single source of truth — goes into PIPELINE.md)

```json
{
  "video": "notion-vs-asana",
  "channel": "agrollo-reviews",
  "version": 1,
  "stage": "generated",
  "sections": [
    {
      "id": "s01",
      "demo": false,
      "display_text": "Notion and Asana both promise to run your whole team...",
      "spoken_text": "",
      "flags": [],
      "notes": "",
      "version": 1,
      "tts": { "regens_used": 0, "locked": false, "take": null },
      "recording": { "status": "none" }
    },
    {
      "id": "s02",
      "demo": true,
      "display_text": "Head to the pricing page and click [VERIFY: exact upgrade button label].",
      "spoken_text": "",
      "flags": [ { "kind": "VERIFY", "note": "exact upgrade button label" } ],
      "notes": "stay on the pricing page until the section ends",
      "version": 1,
      "tts": { "regens_used": 0, "locked": false, "take": null },
      "recording": { "status": "pending" }
    }
  ]
}
```

Field rules (encode exactly these in `lib/schema.mjs`):

- `video`: matches `/^[a-z0-9][a-z0-9-]*$/`.
- `channel`: non-empty string.
- `version` (top-level and per-section): integer ≥ 1.
- `stage`: one of `"generated" | "verified" | "polished" | "tts" | "locked" | "recorded" | "qc-passed"`.
- `sections`: array, length ≥ 3.
- `id`: `/^s\d{2}$/`, strictly sequential starting at `s01` (s01, s02, ...).
- `demo`: boolean. At least one section in the file must have `demo: true`.
- `display_text`: non-empty. Word count: hard error if < 8 or > 320 words; warning
  (reported, not fatal) outside 45–170 words (≈ 20–60 s of narration).
- `spoken_text`: string; may be `""` (meaning: derive from display_text). When
  non-empty it must contain no `[VERIFY:` / `[FILL:` markers.
- `flags`: array of `{ kind: "VERIFY" | "FILL", note: non-empty string }`. Every
  inline marker in `display_text` (see flag syntax below) must have a matching
  entry with the same kind and note, and vice versa — mismatch is a hard error.
- `notes`: string (may be empty).
- `tts.regens_used`: integer ≥ 0. `tts.locked`: boolean. `tts.take`: string or null.
- `recording.status`: `"none"` (non-demo) | `"pending" | "received" | "qc-passed" | "re-record"` (demo).
  A non-demo section with status other than `"none"` is a hard error, and a demo
  section with `"none"` is a hard error.

Flag syntax inside `display_text` (encode in `lib/flags.mjs`):
`[VERIFY: <note>]` and `[FILL: <note>]`, regex
`/\[(VERIFY|FILL):\s*([^\]]+)\]/g`. `scanFlags(text)` returns
`[{ kind, note, raw }]` with `note` trimmed.

Lint stages (`lib/lint-script.mjs`):
- default (`--stage generated`): all schema rules above.
- `--stage polished`: additionally, zero flags anywhere (no inline markers, empty
  `flags` arrays) and `spoken_text` non-empty for every section.

## Steps

### Step 1: skeleton + .gitignore + PIPELINE.md

Create the folder tree and top-level docs.

`.gitignore` (media never in git — house rule):

```
videos/*/audio/
videos/*/recordings/
videos/*/qc/
videos/*/*.wav
videos/*/*.mp3
videos/*/*.mp4
videos/*/*.mov
```

`PIPELINE.md` must contain: a one-paragraph header ("VO-first tutorial pipeline —
the how; WORKFLOW.md is the why"), the run-order table below, the `videos/<slug>/`
layout below, and the full script.json contract section from this plan (copy it
verbatim — PIPELINE.md is the schema's single home, same one-place rule as
visuals-flow's README).

Run-order table:

| Step | Actor | In → Out |
|---|---|---|
| `010-inputs` | [RUN] | slug → `videos/<slug>/inputs/` skeleton (topic.md, vision.md, transcripts/) |
| `020-script-gen` | [LLM: Claude session, Sonnet default] | inputs + dossier + style DNA → `script.json` + `script.md` |
| `030-verify-tm` | [HUMAN: tutorial maker] | script.md → flag resolutions (applied back into script.json) — plan 130 |
| `040-polish-lint` | [LLM + RUN] | verified script.json → polished script.json (zero flags) — plan 130 |
| `050-publish-ui` | [RUN] | polished script.json → UI store (Worker) — plan 132 |
| `060-intake-qc` | [RUN] | Drive recordings → intake-report.md — plan 133 |
| `070-handoff-visuals` | [RUN] | locked audio + recordings → visuals-flow `videos/<slug>/{vo.mp3,screen.mp4}` — plan 133 |

`videos/<slug>/` layout:

```
videos/<slug>/
  inputs/topic.md        # committed
  inputs/vision.md       # committed
  inputs/transcripts/    # committed (text)
  script.json            # committed — the contract artifact
  script.md              # committed — human-readable render for the tutorial maker
  audio/                 # gitignored (locked section wavs, pulled from UI)
  recordings/            # gitignored (per-section clips from Drive)
  qc/                    # gitignored (contact sheets)
  intake-report.md       # committed (plan 133)
```

**Verify**: `ls pipelines/youtube/tutorial-pipeline-3/` → shows PIPELINE.md,
.gitignore, WORKFLOW.md (pre-existing), lib/, steps/, scripts/.

### Step 2: `lib/flags.mjs` + tests

```js
// lib/flags.mjs
const FLAG_RE = /\[(VERIFY|FILL):\s*([^\]]+)\]/g;

export function scanFlags(text) {
  const out = [];
  for (const m of String(text).matchAll(FLAG_RE)) {
    out.push({ kind: m[1], note: m[2].trim(), raw: m[0] });
  }
  return out;
}

export function stripFlags(text) {
  return String(text).replace(FLAG_RE, "").replace(/\s{2,}/g, " ").trim();
}
```

Tests (`lib/flags.test.mjs`, node:test): scan finds both kinds, trims notes, returns
`[]` on clean text; strip removes markers and collapses double spaces.

**Verify**: `node --test lib/flags.test.mjs` → pass.

### Step 3: `lib/schema.mjs` + tests

Export `validateScript(obj, { stage } = {})` → `{ ok, errors: string[], warnings:
string[] }` implementing every field rule and both lint stages from the contract
section above. Each error string must name the section id where applicable
(e.g. `s03: demo section has recording.status "none"`). Word count = split on
`/\s+/` of `stripFlags(display_text)`.

Tests must cover, minimum: a valid fixture passes (extend the contract section's
two-section example with a third section — the example is illustrative and by
itself violates the ≥3 rule); each
of these fails with exactly one identifiable error — non-sequential ids; zero demo
sections; inline marker with no flags[] entry; flags[] entry with no inline marker;
demo section with `recording.status: "none"`; 5-word display_text; and for
`--stage polished`: leftover flag, empty spoken_text.

**Verify**: `node --test lib/schema.test.mjs` → pass.

### Step 4: `lib/lint-script.mjs` (CLI) + tests

```js
// usage: node lib/lint-script.mjs <path/to/script.json> [--stage generated|polished]
```

Reads the file, runs `validateScript`, prints errors (one per line, prefixed
`ERROR:`) and warnings (`WARN:`), exits 1 on any error, 0 otherwise (warnings never
fail). Tests spawn it via `node:child_process` `execFileSync` on temp-dir fixtures
(use `fs.mkdtempSync(os.tmpdir() + "/tp3-")` — never write fixtures into `videos/`).

**Verify**: `node --test lib/lint-script.test.mjs` → pass.

### Step 5: `lib/init-video.mjs` (step 010) + tests

`node lib/init-video.mjs <slug>`: validates slug against `/^[a-z0-9][a-z0-9-]*$/`,
refuses (exit 1, message) if `videos/<slug>/` exists, else creates
`videos/<slug>/inputs/transcripts/` and writes `inputs/topic.md` and
`inputs/vision.md` with these exact templates:

```markdown
# Topic

<one line: the video's topic>

## Channel

<channel slug>

## Target length

<minutes>
```

```markdown
# Vision

<owner's notes: angle, must-cover points, verdict if any>
```

Accept an optional `--root <dir>` flag (defaults to the pipeline folder) so tests
can target a temp dir. Tests: creates the tree; refuses an existing slug; rejects
a bad slug.

**Verify**: `node --test lib/init-video.test.mjs` → pass.

### Step 6: step READMEs + rulebook + prompt (appendix text, verbatim)

- `steps/010-inputs/README.md`: what the owner puts in `inputs/` (topic.md,
  vision.md, transcripts as one `.md`/`.txt` per source video named by video id),
  plus pointers: tool dossiers live in `pipelines/youtube/dossiers/tools/`, script
  Style DNA packs in `pipelines/youtube/competitor-styles/`.
- `steps/020-script-gen/README.md`: how to run the step — open a Claude Code
  session (Sonnet default), fill `prompt.md`'s placeholders, output is
  `videos/<slug>/script.json` + `script.md`; the session must run
  `node lib/lint-script.mjs videos/<slug>/script.json` and fix errors before
  finishing.
- `steps/020-script-gen/rulebook.md`: **Appendix A below, byte-for-byte.**
- `steps/020-script-gen/prompt.md`: **Appendix B below, byte-for-byte.**

**Verify**: `diff <(sed -n '/^### Appendix A/,/^### Appendix B/p' plans/129-tp3-skeleton-script-contract.md | sed '1,2d;$d' | sed '$d') steps/020-script-gen/rulebook.md`
— or, simpler and acceptable: visually confirm the first and last lines of each
file match the appendix, and `wc -l` is within ±2 of the appendix length.

### Step 7: `run.sh` + `scripts/check.sh` + smoke test

`run.sh` (executable): `bash run.sh <slug> <verb>` where verb ∈
`status | 010 | lint`. `status` prints one line per artifact
(script.json present? stage field? flag count via a small node -e inline call?
— keep it to file-existence checks plus `stage` extraction with `node -e`).
`010` runs `node lib/init-video.mjs <slug>`. `lint` runs the lint CLI on the
slug's script.json. Unknown verb → usage text, exit 2. (Later plans add verbs;
keep the dispatch a simple `case`.)

`scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/flags.test.mjs lib/schema.test.mjs lib/lint-script.test.mjs lib/init-video.test.mjs
bash scripts/test-run-sh.sh
echo "tutorial-pipeline-3 check OK"
```

`scripts/test-run-sh.sh`: smoke — run `bash run.sh zz-smoke-test 010` against a
temp `--root` (export `TP3_ROOT` env var honored by run.sh for this), assert
`inputs/topic.md` exists, run `bash run.sh zz-smoke-test status` and assert exit 0,
clean up the temp dir. Never write into the real `videos/`.

**Verify**: `bash scripts/check.sh` → exit 0, `tutorial-pipeline-3 check OK`.

## Test plan

All verification is `scripts/check.sh` (= the boss test_cmd): four node:test suites
plus the run.sh smoke script. No network, no ffmpeg, no LLM calls anywhere in tests.

## Done criteria

- [ ] `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` → exit 0.
- [ ] `node lib/lint-script.mjs <good-fixture>` → exit 0; each bad-fixture case → exit 1.
- [ ] `steps/020-script-gen/rulebook.md` and `prompt.md` match Appendices A/B.
- [ ] `PIPELINE.md` contains the run-order table, videos layout, and the full
      script.json contract.
- [ ] `git status` clean after commits; no files outside the in-scope list changed.

## STOP conditions

- Drift check shows changes under `pipelines/youtube/tutorial-pipeline-3/` beyond
  WORKFLOW.md.
- Any step appears to require a network call, an LLM call, or touching files
  outside the in-scope list.
- `node --version` < v20 (test runner semantics differ) — stop and report.

## Maintenance notes

- PIPELINE.md is the schema's single home. Plans 130/132/133 consume it; if the
  schema changes, change PIPELINE.md and every consumer in one commit.
- `scripts/check.sh` grows by explicit file list — later plans APPEND test files to
  the `node --test` line, never rewrite it (known boss rebase hotspot).
- The rulebook is owner-taste content. Future edits to it go through the owner, not
  through executor judgment.

---

### Appendix A — steps/020-script-gen/rulebook.md (place verbatim)

```markdown
# Script generation rulebook (step 020)

You are writing the full narration script for a VO-first tutorial video. The
voiceover generated from this script is the master timeline: a freelancer will
record the screen while listening to it, section by section. Nothing you write
can be fixed by editing later — the script IS the video's spine.

## Inputs (read all before writing)

1. `videos/<slug>/inputs/topic.md` — the topic, channel, target length.
2. `videos/<slug>/inputs/vision.md` — the owner's angle and must-cover points.
   Every point in vision.md must be covered or explicitly listed as dropped in
   your self-check.
3. `videos/<slug>/inputs/transcripts/` — competitor transcripts on this topic.
   These are your factual ground truth for what the tool does.
4. The tool's dossier: `pipelines/youtube/dossiers/tools/<tool>.md` (if present).
5. The channel's script Style DNA pack under
   `pipelines/youtube/competitor-styles/` — match its voice, pacing, and hook
   conventions. Do not import another channel's voice.

## Output

Two files in `videos/<slug>/`:

- `script.json` — conforming to the contract in `PIPELINE.md` (stage:
  "generated"). Run `node lib/lint-script.mjs videos/<slug>/script.json` and fix
  every error before you finish.
- `script.md` — a human-readable render for the tutorial maker: per section, a
  heading `## s01 [demo]` or `## s01 [no demo]`, the display text, the notes
  line, and each flag on its own line as `> FLAG (VERIFY): exact button label`.

## Sectioning rules

- A section is one continuous beat of narration, 45–170 words (about 20–60
  seconds spoken). Shorter is better than longer: the freelancer records one
  clip per demo section, and a blown take costs the whole section.
- One screen context per demo section. If the narration moves from the pricing
  page to the editor, that is two sections.
- Every section must stand alone at its start: no "as I just showed" across a
  section boundary that a cutaway could break.
- Order sections for the viewer, not for the tool's menu structure.

## The demo flag

- `demo: true` = the narration describes actions or states visible on the
  tool's screen. The freelancer WILL record this section. Its recording.status
  starts as "pending".
- `demo: false` = talk: context, opinion, comparison, verdict. No footage will
  ever exist for it (avatar or graphics cover it downstream). Its
  recording.status is "none".
- When in doubt, prefer demo: false — an unnecessary recording costs money; a
  missing one costs a re-record round.

## Flags: never guess UI facts

You have not seen the tool's current screen. Any claim about exact UI text,
menu paths, button labels, on-screen prices, or dialog contents must be a flag,
not a guess:

- `[VERIFY: <what to confirm>]` — you believe the surrounding text is right but
  a human must confirm it against the live tool.
- `[FILL: <what to write, rough notes are fine>]` — you cannot write this part
  at all without seeing the tool; the tutorial maker fills it.

Every inline marker must have a matching entry in the section's `flags` array.
Facts that come verbatim from a transcript or the dossier do not need a flag —
cite nothing, just write. Inventing a menu path without a flag is the one
unforgivable error in this step.

## Grounding rules

- Every factual claim must be traceable to topic.md, vision.md, a transcript,
  or the dossier. If it is in none of them, either flag it or cut it.
- Prices, plan names, and limits change: anything numeric about the tool that
  will appear ON SCREEN gets a `[VERIFY: ...]` even if a transcript states it.
- Never reference the freelancer, the recording process, or "this video's
  script" in narration text.

## Style rules

- Match the channel Style DNA pack for hook shape, sentence rhythm, and
  vocabulary. The hook is section s01 and is always demo: false.
- Write for the ear: short sentences, no parentheses, numbers under 13 spelled
  out. Avoid tongue-twisters — this text goes to TTS verbatim.
- `notes` is for the recorder ("stay on the dashboard", "scroll slowly") and
  for QC (it names the expected on-screen event) — write one whenever the
  section expects a specific visible moment.

## Self-check (do this before finishing, in order)

1. Lint passes: `node lib/lint-script.mjs videos/<slug>/script.json` → exit 0.
2. Every vision.md point is covered, or listed by you as deliberately dropped
   with one line of reasoning.
3. Read s01 aloud: would the target viewer keep watching? If unsure, rewrite it
   once before finishing.
4. Count flags: a typical 8-minute tutorial has 5–15. Zero flags on a script
   full of UI claims means you guessed — go back and flag. More than 25 means
   the knowledge base was too thin; say so in your final report.
5. Confirm every demo section names, in its text or notes, something visibly
   checkable on screen.
```

### Appendix B — steps/020-script-gen/prompt.md (place verbatim)

```markdown
# Script generation prompt (fill placeholders, paste into a Claude session)

Read these files completely before writing anything:

1. pipelines/youtube/tutorial-pipeline-3/steps/020-script-gen/rulebook.md
2. pipelines/youtube/tutorial-pipeline-3/PIPELINE.md (the script.json contract)
3. videos/{{SLUG}}/inputs/topic.md
4. videos/{{SLUG}}/inputs/vision.md
5. every file under videos/{{SLUG}}/inputs/transcripts/
6. {{DOSSIER_PATH}}            <!-- e.g. pipelines/youtube/dossiers/tools/notion.md, or "none" -->
7. {{STYLE_DNA_PATH}}          <!-- the channel's style pack, or "none" -->

Then write videos/{{SLUG}}/script.json and videos/{{SLUG}}/script.md following
the rulebook exactly. Target length: {{TARGET_MINUTES}} minutes of narration.

Finish by running:

    node pipelines/youtube/tutorial-pipeline-3/lib/lint-script.mjs videos/{{SLUG}}/script.json

Fix every ERROR. Then report: section count, demo/non-demo split, flag count,
and any vision.md points you deliberately dropped.
```
