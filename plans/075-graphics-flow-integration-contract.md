---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui:
deploy:
needs: ["072 (the contract references the lint fix-loop); 070 (approval gate semantics)"]
---

# Plan 075: graphics-flow INTEGRATION.md — the caller contract for tutorial-pipeline-1/2

## Summary

- **Problem statement**: graphics-flow is about to be consumed by `pipelines/youtube/tutorial-pipeline-1` and `-2`, but there is no caller-facing contract: what a pipeline must provide, how the one LLM step runs inside another pipeline's conventions, where the owner-approval gate sits, and what comes back. Today that knowledge lives across PIPELINE.md, HANDOFF.md, and step READMEs written for a human running THIS folder.
- **Goals**: a single `INTEGRATION.md` defining inputs (vo.mp3 OR an existing transcript.json — no double transcription), the workdir-by-path calling convention, the 020 session + resolve/lint fix-loop, the approval gate, outputs (`renders/` + `manifest.md`), and `offset` semantics for pipelines with cold-opens; plus a path-arg smoke check proving the libs honor external workdirs.
- **Executor proposed**: claude-p sonnet (doc is the deliverable; prose quality and correct synthesis of existing docs matter more than code).
- **Done criteria** (terse): INTEGRATION.md exists, is linked from PIPELINE.md and both tutorial pipelines' PIPELINE.md files, and every command in it has been run once.
- **Stop conditions** (terse): a contract claim can't be made true with current code; tutorial-pipeline docs conflict structurally.
- **Test / verification for success**: run every command in the doc against a temp external workdir; flow gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow pipelines/youtube/tutorial-pipeline-1/PIPELINE.md pipelines/youtube/tutorial-pipeline-2/PIPELINE.md`

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: 070 (approval gate), 072 (lint fix-loop) — the doc describes both
- **Category**: dx / docs
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

The owner's stated direction: graphics-flow becomes the graphics step for
tutorial-pipeline-1 and tutorial-pipeline-2. Those pipelines have their own
conventions (numbered step folders, `[RUN]`/`[SONNET]`/`[ANTIGRAVITY]` actor
tags, each step reads `../<prev>/output/`, Sonnet steps run as "Claude Code
sessions switched to Sonnet" — see `tutorial-pipeline-2/PIPELINE.md`). Without
a contract, each integration will re-derive answers to:

- Do we transcribe again? (pipeline-2 already produces transcripts; graphics-flow's
  010 would happily re-run whisper on the same audio.)
- Where does the workdir live? (The libs already accept a path instead of a
  slug — `resolveWorkdir` in every lib: `if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);`
  — but nothing documents that this is the supported integration surface.)
- How does the cue pass run headlessly-ish inside another pipeline? (Answer:
  the same way pipeline-2 runs its other Sonnet steps — a Claude session step
  with the rulebook, plus the deterministic resolve+lint fix-loop from plan 072.)
- Who approves, and when? (The board is an OWNER gate — it stays; render
  refuses unapproved cues after plan 070.)
- What does the caller get back, and what does `offset` mean when the calling
  pipeline puts a cold-open before the VO?

PIPELINE.md's "Independence" section (3 sentences) is the seed; this plan
grows it into the real contract so the two pipeline integrations are
mechanical.

## Current state

- `pipelines/video/graphics-flow/PIPELINE.md` — flow table (steps 010-060),
  `videos/<slug>/` layout, cues.json schema (the authoritative copy), the
  `offset` semantics bullet, and the short "Independence" section.
- `pipelines/video/graphics-flow/HANDOFF.md` — current state; "How to run"
  quick reference.
- Step READMEs under `steps/NNN-*/` — per-step in/out/run.
- Libs all support slug-or-path:
  `node lib/resolve.mjs <slug-or-path>`, `node lib/render.mjs <slug-or-path>`,
  `node lib/board.mjs [<slug-or-path>]`, `node lib/transcribe-groq.mjs <slug-or-path>`.
  Step 010's `run.sh` however does `cd "videos/$slug"` — slug-only (document
  this asymmetry honestly, or fix run.sh to accept a path with the same
  `includes('/')` test; fixing is in scope and small).
- Transcript contract: flat `[{text, start, end}]` (word-level), produced by
  Groq fast path or `npx hyperframes transcribe` — an external transcript in
  this exact shape is a valid drop-in for step 010's output.
- After plan 070: `render.mjs` refuses `approved !== true` (`--force` to
  override) and verifies resolved.json freshness.
- After plan 072: `node lib/lint-cues.mjs <slug-or-path>` is the post-resolve
  gate; 020's README documents the ≤3-round fix-loop.
- Consumers: `pipelines/youtube/tutorial-pipeline-1/PIPELINE.md` (Drive-in →
  HeyGen spokesperson clips; VO exists as extracted `.wav` audio per segment)
  and `pipelines/youtube/tutorial-pipeline-2/PIPELINE.md` (topic → draft cut;
  produces script, TTS VO, transcripts, avatar clips; editor role is optional QC).
- Repo rule (root CLAUDE.md): a folder's CLAUDE.md/README tells Claude how to
  operate there; docs must be linked from where a session will look.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Path-arg smoke: resolve an external workdir | `mkdir -p "$SCRATCH/gfx-ext" && cp pipelines/video/graphics-flow/lib/fixtures/{cues-ok.json,transcript.json} "$SCRATCH/gfx-ext/" && cd pipelines/video/graphics-flow && mv "$SCRATCH/gfx-ext/cues-ok.json" "$SCRATCH/gfx-ext/cues.json" && node lib/resolve.mjs "$SCRATCH/gfx-ext"` | exit 0; `resolved.json` appears in the external dir |
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |

(`$SCRATCH` = any temp dir; the fixtures resolve cleanly — `resolve.test.mjs`
uses exactly this data for its CLI test.)

## Scope

**In scope**:
- New `pipelines/video/graphics-flow/INTEGRATION.md`.
- `steps/010-transcribe-run/run.sh`: accept slug-or-path like the libs do
  (mirror the `includes('/')` test in bash: if `$1` contains `/` or exists as
  a dir, use it as the workdir; else `videos/$1`).
- Pointer links: PIPELINE.md "Independence" section becomes a pointer to
  INTEGRATION.md; one row/line added to `tutorial-pipeline-1/PIPELINE.md` and
  `tutorial-pipeline-2/PIPELINE.md` pointing at INTEGRATION.md as the graphics
  step's contract (a "graphics" pointer under their conventions/notes section —
  do NOT restructure their step tables; the actual step wiring is each
  pipeline's own future plan).

**Out of scope**:
- Building the actual integration steps inside either tutorial pipeline.
- Any behavior change beyond the 010 run.sh path support.
- The cue-pass prompt/rulebook content.

## Git workflow

- Branch: `advisor/075-graphics-flow-integration-contract`
- Commit: `docs(graphics-flow): INTEGRATION.md caller contract + path-arg support in 010 run.sh` — no AI footers. Do NOT push.

## Steps

### Step 1: 010 run.sh path support

Rework the top of `steps/010-transcribe-run/run.sh`: derive `workdir` from
`$1` (contains `/` or is an existing dir → use as-is; else `videos/$1`), then
use `$workdir` everywhere the script currently uses `videos/$slug`. Keep the
extract-from-video and Groq/local fallback logic identical. Pass the same
workdir to `lib/transcribe-groq.mjs` (it already accepts paths).

**Verify**: `bash steps/010-transcribe-run/run.sh "$SCRATCH/no-such-dir"` -> clean usage error (not a cd crash); with a temp dir containing a small vo.mp3 (copy `lib/fixtures/board/vo.mp3`) and GROQ_API_KEY unset -> falls through to the local path or errors cleanly, never touching `videos/`.

### Step 2: Write INTEGRATION.md

Sections (each backed by the sources named in Current state — synthesize,
don't invent):

1. **What callers get** — one paragraph: workdir in, `renders/*.mp4|mov` +
   `manifest.md` out; graphics reveal on VO beats; one LLM call per video.
2. **The workdir contract** — the caller owns a directory anywhere on disk
   (a step-output folder in pipeline-1/2 is fine) containing `vo.mp3` (or a
   video file for 010 to extract from) OR a ready `transcript.json`
   (flat `[{text,start,end}]` word timestamps — if you already transcribed,
   drop it in and SKIP step 010; do not transcribe twice). Everything the
   flow produces lands in that same directory; the `videos/<slug>/` convention
   is just this repo's local case. Committed-vs-gitignored guidance is the
   CALLER's policy for external workdirs.
3. **Invocation sequence** — the exact commands with `<workdir>` paths:
   010 (or skip), 020 (see next), `node lib/resolve.mjs <workdir>`,
   `node lib/lint-cues.mjs <workdir>`, `node lib/board.mjs <workdir>` (OWNER
   gate — approval is required; render refuses otherwise), `node lib/render.mjs <workdir>`.
4. **Running the cue pass from another pipeline** — matches
   tutorial-pipeline-2's actor conventions: a `[SONNET]` step whose rulebook
   is `steps/020-cue-pass-llm/cue-pass-prompt.md` + `RULEBOOK.md` (absolute
   paths from the caller's step README), writing `<workdir>/cues.json`, then
   the deterministic fix-loop: resolve + lint, feed errors back verbatim to
   the same session, ≤3 rounds, unresolved errors escalate to the owner.
   Model routing per HANDOFF ("Model routing" section): Sonnet default, agy
   approved to trial.
5. **The approval gate** — the board is an owner step even inside an
   automated pipeline; what approve means (070 semantics: edits after approve
   un-approve), and that `render --force` exists but is for the owner only.
6. **`offset` for cold-opens** — restate PIPELINE.md's offset bullet from the
   CALLER's view: if the calling pipeline places the VO at t≠0 on the final
   timeline, set `offset` in cues.json before render; clips don't change,
   only manifest place-at times.
7. **Versioning note** — cues.json schema is owned by PIPELINE.md; catalog
   and cards are owned by `../card-library/`; callers never edit either.

Tone: operational, terse, like the step READMEs. Target ≤120 lines.

**Verify**: every command block in the doc has been executed once against the Step 1/Commands-table temp workdir (except render, which may stop at the approval-gate error — that error IS the documented behavior; show it).

### Step 3: Pointers

- PIPELINE.md "Independence" section: keep the first sentence, replace the
  rest with `Full caller contract: [INTEGRATION.md](INTEGRATION.md).`
- `tutorial-pipeline-1/PIPELINE.md` and `tutorial-pipeline-2/PIPELINE.md`: one
  line each in their notes/conventions area:
  `Graphics step: consume pipelines/video/graphics-flow per its INTEGRATION.md (workdir-by-path contract).`

**Verify**: `grep -rn 'INTEGRATION.md' pipelines/video/graphics-flow/PIPELINE.md pipelines/youtube/tutorial-pipeline-1/PIPELINE.md pipelines/youtube/tutorial-pipeline-2/PIPELINE.md` -> 3 hits.

## Test plan

The doc's own commands run once (Step 2 verify), the path-arg smoke from the
commands table, and `scripts/check.sh` (unchanged code paths must stay green).

## Done criteria

- [ ] `INTEGRATION.md` exists covering all 7 sections; every command in it ran once.
- [ ] Step 010 run.sh accepts an external workdir path.
- [ ] Three pointer links in place.
- [ ] `scripts/check.sh` exits 0.

## STOP conditions

- Any contract claim that current code makes false (e.g. a lib that actually
  hardcodes `videos/`) beyond the known 010 run.sh case — stop and report; the
  doc must not promise what the code doesn't do.
- 070/072 not landed at execution time — stop and report (the contract
  describes their behavior; writing it first would document vapor).

## Maintenance notes

- When pipeline-1/2 build their actual graphics steps, their step READMEs
  should link INTEGRATION.md rather than restating it — one contract, N callers.
- If the cues.json schema changes, PIPELINE.md remains the single owner;
  INTEGRATION.md links, never copies, the schema.
