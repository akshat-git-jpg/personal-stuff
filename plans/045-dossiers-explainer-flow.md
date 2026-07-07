---
executor: agy
model:
test_cmd: python3 -m pytest pipelines/youtube/dossiers/tests -q
ui: false
deploy:
needs: ["depends on 044 (dossier library: ingest/distill/llm/prompts/CLAUDE.md)"]
---

# Plan 045: Research v2 — explainer flow (per-topic fact sheets)

## Summary

- **Problem statement**: The second video category — pure explainer videos, no screen recording — needs research too, but topics are mostly one-shot (no reuse across videos), so they don't warrant persistent dossiers. They need a cheap per-topic pass: fetch top transcripts once, distill once, synthesize one cited fact sheet.
- **Goals**:
  - `topic` subcommands on 044's `ingest.py` and `distill.py`, writing under `topics/<slug>/`.
  - Topic extraction prompt + schema in `prompts.py` (authored verbatim below).
  - A "fact sheet for topic <slug>" Claude workflow appended to `dossiers/CLAUDE.md`.
- **Executor proposed**: `agy` (default model) — standard; small delta on 044's structures.
- **Done criteria** (terse): pytest green (044's tests + new topic tests); topic commands work; CLAUDE.md carries the fact-sheet workflow.
- **Stop conditions** (terse): 044 not landed; its subparser/renderer structure differs from what this plan assumes.
- **Test / verification for success**: pytest with mocked `subprocess.run` / `llm.generate`; structural doc test for the new CLAUDE.md section.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`. Stage this plan file with
> your commit. Keep ALL writes inside the repo working tree.
>
> **Drift check (run first)**: `git diff --stat 6adc5d0..HEAD -- pipelines/youtube/dossiers/` (expect: exactly plan 044's files — ingest/llm/prompts/distill/merge/CLAUDE.md/.gitignore/tests)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 044
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `6adc5d0`, 2026-07-07

## Why this matters

Explainer topics differ from software tools in exactly one way that matters: no reuse. A tool's dossier pays for itself across many videos; a topic is covered once. So the explainer flow reuses 044's machinery (same ingest, same cheap-model distillation, same citation discipline) but skips merge/dossier entirely — extractions go straight to a one-shot fact sheet written in a Claude session. For explainers the moat is angle and structure (owned by `competitor-styles/` + the yt-style-copy skill); this flow supplies the grounded facts.

## Current state

After 044, `pipelines/youtube/dossiers/` has:
- `ingest.py` with an argparse **subparser** structure (only `tool` implemented) — fetch loop: `pp-youtube search` → filter (constants `MAX_AGE_DAYS = 548`, `MIN_WORDS = 300`) → `pp-yt-transcript get <id> --timestamps` → `transcripts/<id>.md` + `sources.json` entry (`{title, channel, published, fetched, words, extracted, merged}`).
- `distill.py` with the same subparser structure (only `tool`), rendering LLM JSON to `extractions/<id>.md` via a generic dict renderer, flipping `extracted: true` per video.
- `llm.py` (`generate(prompt, *, schema=None, ...)`), `prompts.py` (TOOL_* constants), `merge.py` (tools only — unchanged by this plan), `CLAUDE.md` (Commands / Layout / assemble-brief workflow / Script handoff / Hard rules sections), `tests/` (test_ingest, test_distill_merge, test_docs).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests (repo root) | `python3 -m pytest pipelines/youtube/dossiers/tests -q` | exit 0 |
| Topic ingest help | `python3 pipelines/youtube/dossiers/ingest.py topic --help` | usage, exit 0 |

## Scope

**In scope**:
- `pipelines/youtube/dossiers/ingest.py` (add `topic` subcommand)
- `pipelines/youtube/dossiers/distill.py` (add `topic` subcommand)
- `pipelines/youtube/dossiers/prompts.py` (add TOPIC_EXTRACTION_PROMPT, TOPIC_SCHEMA)
- `pipelines/youtube/dossiers/CLAUDE.md` (add topic commands, layout line, fact-sheet workflow)
- `pipelines/youtube/dossiers/tests/test_topic.py` (new), one assertion added to `tests/test_docs.py`
- `plans/README.md` (status row only)

**Out of scope**:
- `merge.py`, `llm.py` (unchanged — topics never merge).
- The tool-mode behavior of ingest/distill (regression = 044's tests must stay green untouched).
- `yt-script/`, `yt-research/`, folder maps (already registered by 044), `competitor-styles/`.

## Git workflow

- Branch: `advisor/045-dossiers-explainer-flow`
- Commit: `feat(dossiers): explainer flow — per-topic fact sheets` — no AI footers. Do NOT push.

## Steps

### Step 1: `ingest.py topic`

```
python3 ingest.py topic <slug> --search "query" [--max 6] [--videos id1,id2,...]
```

Same fetch loop as `tool`, base dir `topics/<slug>/` (create with `transcripts/` + `extractions/`), identity file `topic.json` `{"topic": "<slug spaces>", "query": "<search>", "created": "YYYY-MM-DD"}` (write only if absent). `--search` is REQUIRED unless `--videos` is given. Default `--max` is 6 (explainers need fewer sources than tool dossiers). Reuse the existing fetch/registry code — factor a shared helper if that's cleaner than duplicating; both subcommands must keep identical registry behavior.

**Verify**: `python3 pipelines/youtube/dossiers/ingest.py topic --help` → usage, exit 0.

### Step 2: `prompts.py` topic constants — verbatim

`TOPIC_EXTRACTION_PROMPT`:

```
You are extracting facts from a YouTube video transcript to research the topic below for an explainer video.

Topic: {topic}
Video: {video_id} | "{title}" | channel: {channel} | published: {published}
Transcript lines are prefixed with [mm:ss] timestamps.

Rules:
- Every item carries "ts": the [mm:ss] of the supporting line.
- "facts" = concrete, checkable claims. "stats" = numbers with their context, copied exactly.
- "explanations" = how the creator explains a sub-concept (capture concept + the gist of the explanation — it may inspire ours).
- "misconceptions" = things the creator says people get wrong.
- "angles" = the video's framing/hook, one item.
- Empty arrays are fine. NEVER invent.

TRANSCRIPT:
{transcript}
```

`TOPIC_SCHEMA` — same responseSchema pattern as `TOOL_SCHEMA`, with properties: `facts` (items: `claim`, `ts`), `stats` (items: `stat`, `ts`), `explanations` (items: `concept`, `gist`, `ts`), `misconceptions` (items: `claim`, `ts`), `angles` (items: `angle`, `ts`); required: all five; every item's fields required.

**Verify**: `python3 -c "import sys; sys.path.insert(0,'pipelines/youtube/dossiers'); import prompts; assert '{topic}' in prompts.TOPIC_EXTRACTION_PROMPT; assert 'explanations' in prompts.TOPIC_SCHEMA['properties']; print('ok')"` → `ok`

### Step 3: `distill.py topic`

`python3 distill.py topic <slug> [--video <id>]` — identical loop to tool mode against `topics/<slug>/`, using `TOPIC_EXTRACTION_PROMPT` (+ `topic.json`'s `topic` field) and `TOPIC_SCHEMA`; the generic renderer handles the new keys unchanged. Flips `extracted: true` the same way. (`merged` stays false forever for topics — merge.py is never run on them.)

**Verify**: `python3 pipelines/youtube/dossiers/distill.py topic --help` → usage, exit 0.

### Step 4: `CLAUDE.md` additions

1. In "## Commands", add after the existing three lines:
   ```
   python3 ingest.py topic <slug> --search "what are ai agents" [--max 6]
   python3 distill.py topic <slug>           # topics skip merge — fact sheet is the synthesis
   ```
2. In "## Layout", add: `    topics/<slug>/  topic.json · sources.json · transcripts/ (gitignored) · extractions/ · fact-sheet.md`
3. Add this section between "## When the user says "assemble brief for …"" and "## Script handoff":

````markdown
## When the user says "fact sheet for topic <slug>"

1. Read `topics/<slug>/extractions/*.md` (ingest + distill must have run; if
   the folder is empty, say so and offer to run them first). Read NOTHING
   from `transcripts/`.
2. Write `topics/<slug>/fact-sheet.md` (1,000–2,000 words):

   # Fact sheet — <topic>
   Date · Sources: <n> videos (id: published date, one per line)

   ## Core facts                — deduped, every fact keeps its (video-id @ mm:ss) citation
   ## Numbers & stats           — exact figures with context, cited
   ## Common misconceptions     — cited
   ## How others explain it     — the explanation approaches seen, 1-2 lines each
   ## Angle candidates          — 3, grounded in the strongest facts/misconceptions

   Conflicting claims are flagged inline with both citations — never resolved
   silently.
3. Self-check: no uncited fact; numbers copied exactly; conflicts visible.

The fact sheet feeds either `../yt-script/` or a `yt-style-copy` scripting
session (`write-script` in a target channel's style) — the fact sheet is the
grounding, the style pack is the voice.
````

**Verify**: `grep -c "fact sheet for topic" pipelines/youtube/dossiers/CLAUDE.md` → at least `1`.

### Step 5: Tests

`tests/test_topic.py` (same mocking patterns as 044's tests):
1. **Topic ingest**: fake search + 400-word transcript → `topics/<slug>/` layout created, `topic.json` written with the query, registry entry correct.
2. **Search required**: `topic` without `--search` and without `--videos` → argparse error / non-zero exit.
3. **Topic distill**: fake `llm.generate` returns a valid TOPIC_SCHEMA object → extraction file contains `## facts` (or the renderer's section for it) and `[mm:ss]` bullets; `extracted` flipped; prompt contained the topic string.

`tests/test_docs.py`: add one assertion — `dossiers/CLAUDE.md` contains `fact sheet for topic`.

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests -q` → all pass (044's + these), exit 0.

### Step 6: Register status

Flip plan 045's row to DONE in `plans/README.md`.

**Verify**: `grep "| 045" plans/README.md` → DONE.

## Test plan

Step 5; all external seams mocked, 044's suites must pass unmodified (any edit to existing tests is a STOP — it means tool-mode behavior changed).

## Done criteria

- [ ] `python3 -m pytest pipelines/youtube/dossiers/tests -q` exits 0 (044's tests untouched and green + ≥3 new).
- [ ] `ingest.py topic` / `distill.py topic` help exit 0.
- [ ] `prompts.py` topic constants match this plan verbatim.
- [ ] `CLAUDE.md` carries the fact-sheet workflow, topic commands, and layout line.

## STOP conditions

- 044's files are absent or its subparser/renderer structure doesn't match "Current state" — stop and report.
- You need to modify a 044 test to make anything pass — stop (behavior regression).
- You need a non-stdlib package — stop.

## Maintenance notes

- Topics deliberately have no dossier and no refresh story — a topic re-covered later just gets a fresh ingest+distill+fact-sheet run (cheap).
- If a topic cluster becomes recurring (e.g. monthly AI-news explainers), promote it to a running theme note by hand — don't bend this pipeline for it until it actually recurs.
- Keep the fact-sheet template in CLAUDE.md and `test_docs.py`'s pinned string in sync.
