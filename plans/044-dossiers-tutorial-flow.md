---
executor: agy
model:
test_cmd: python3 -m pytest pipelines/youtube/dossiers/tests -q
ui: false
deploy:
needs: ["runs before 045 (explainer flow builds on this)"]
---

# Plan 044: Research v2 — tutorial/comparison flow (per-software dossier library, end to end)

## Summary

- **Problem statement**: Research for screen-recorded comparison/tutorial videos is redone per video: 20–30 transcripts re-read by an expensive model every time, plus manual research. Tool overlap across videos is HIGH, so per-video research throws away exactly the work that should compound.
- **Goals**:
  - New `pipelines/youtube/dossiers/`: one persistent dossier per software, built by a cheap model reading each transcript ONCE, updated incrementally, every claim dated + cited.
  - `ingest.py` (discover + fetch timestamped transcripts) → `distill.py` (Gemini flash extraction per transcript) → `merge.py` (fold into `dossier.md`).
  - A Claude assembly workflow (`CLAUDE.md`): 10–15 dossiers → per-video brief with ranking rationale, per-tool demo plans, and a pricing-verification list.
  - Wire `yt-script/` to consume briefs; register the folder in the routing maps.
  - Stdlib-only, system `python3`, no venv (house pattern: `competitor-styles/`).
- **Executor proposed**: `agy` (default model) — standard difficulty; all prompts, schemas, and the one non-trivial module are authored verbatim in this plan.
- **Done criteria** (terse): pytest suite green (mocked LLM/CLIs, no network); CLAUDE.md workflows in place; yt-script reads briefs; maps registered.
- **Stop conditions** (terse): repo CLIs missing; folder already exists; any non-stdlib import needed; docs to edit drifted from quoted excerpts.
- **Test / verification for success**: pytest — ingest with mocked `subprocess.run`, distill/merge with mocked `llm.generate`, structural doc tests.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`. Stage this plan file with
> your commit (`git add plans/…`). Keep ALL writes inside the repo working tree.
>
> **Drift check (run first)**: `git diff --stat 6adc5d0..HEAD -- pipelines/youtube/dossiers/ pipelines/youtube/CLAUDE.md pipelines/CLAUDE.md pipelines/youtube/yt-script/CLAUDE.md docs/research-and-script-workflow.md` (expect: no output — none of these touched yet; `pipelines/youtube/dossiers/` must not exist)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `6adc5d0`, 2026-07-07

## Why this matters

The owner's main format is screen-recorded software comparisons (10+ tools per video). The research unit must be the SOFTWARE, not the video: with high tool overlap, the 5th video touching Hostinger should start ~80% researched. The core token rule this plan implements: **a frontier model never reads raw transcripts** — a cheap model (Gemini flash, cents per video) distills each transcript once into a small structured extraction; everything downstream (merge, Claude brief assembly, `yt-script/`) reads only compact layers. Claims carry citations (video-id @ mm:ss) and dates so facts can age and be re-verified rather than trusted forever. Design context (optional reading): `docs/yt-research-v2-brainstorm-handoff.md`.

## Current state

- The exemplar to imitate for style and structure is **`pipelines/youtube/competitor-styles/ingest.py`** — stdlib-only, repo CLIs via `subprocess`, idempotent re-runs, path resolution:

```python
HERE = Path(__file__).resolve().parent
# HERE = <repo>/pipelines/youtube/competitor-styles → parents[2] = <repo>
TRANSCRIPT_CLI = HERE.parents[2] / "tooling" / "cli" / "youtube" / "pp-yt-transcript"
...
t = subprocess.run([str(TRANSCRIPT_CLI), "get", vid], capture_output=True, text=True)
```

- **Transcript CLI** `tooling/cli/youtube/pp-yt-transcript` (cached, must run from a residential IP i.e. the Mac): `pp-yt-transcript get <ID> --timestamps` → flowing text, each line prefixed `[mm:ss]`. Non-zero exit or very short output = no usable transcript.
- **Search CLI** `tooling/cli/youtube/pp-youtube` (verified live 2026-07-07): `pp-youtube search "<query>" --account kushalbakliwal25@gmail.com --max 12 --type video` → JSON array of `{"type":"video","id","title","channelTitle","publishedAt","description"}`.
- **No `pipelines/venv/` exists on this machine**; system `python3 -m pytest` works. `common/gemini.py` needs the `google-genai` package and therefore CANNOT be used — hence the stdlib REST client below (deliberate; mirrors stdlib-only `competitor-styles/`). `GEMINI_API_KEY` is present in `pipelines/.env` (gitignored).
- `pipelines/youtube/yt-script/CLAUDE.md` step 3 currently reads:
  ```
  3. Read the niche's compact KB: `../yt-research/niches/<niche>/output/knowledge-base-compact.md`. Fall back to `knowledge-base.md` only if the compact is missing.
  ```
- `pipelines/youtube/CLAUDE.md` has a Subfolders table (one row per sub-project) and, under "Pipeline relationships", a stale link `(../docs/research-and-script-workflow.md)` — the file lives at repo-root `docs/`, so the correct relative path from `pipelines/youtube/` is `../../docs/research-and-script-workflow.md`.
- `pipelines/CLAUDE.md` has a "Folder map" table with indented youtube rows (see the `competitor-styles` row for format).
- `docs/research-and-script-workflow.md` is the v1 wizard (niche → KB → script). v1 (`yt-research/`, its niches) stays as-is — NOT deprecated by this plan.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests (repo root) | `python3 -m pytest pipelines/youtube/dossiers/tests -q` | exit 0 |
| Script help | `python3 pipelines/youtube/dossiers/<script>.py --help` | usage, exit 0 |
| Live smoke (OPTIONAL, human-run, needs network) | `python3 pipelines/youtube/dossiers/ingest.py tool hostinger --name "Hostinger" --videos nIy6sFbv9to` | transcript + registry written |

## Scope

**In scope**:
- `pipelines/youtube/dossiers/` (new): `ingest.py`, `llm.py`, `prompts.py`, `distill.py`, `merge.py`, `CLAUDE.md`, `.gitignore`, `tests/test_ingest.py`, `tests/test_distill_merge.py`, `tests/test_docs.py`
- `pipelines/youtube/yt-script/CLAUDE.md` (edit step 3 + Related repos)
- `pipelines/youtube/CLAUDE.md` (add row; fix stale link; relationships line)
- `pipelines/CLAUDE.md` (add folder-map row)
- `docs/research-and-script-workflow.md` (pointer note at top)
- `plans/README.md` (status row only)

**Out of scope**:
- Explainer/topic mode (`topics/`, topic prompts, fact sheets) — plan 045. Design the argparse subcommand structure so 045 can add a `topic` subcommand without restructuring.
- `yt-script/Guidelines/**` — the voice/structure source of truth, never touched.
- `yt-research/**`, `competitor-styles/**`, `common/**`, root `CLAUDE.md`, `docs/README.md`.

## Git workflow

- Branch: `advisor/044-dossiers-tutorial-flow`
- Commit: `feat(dossiers): per-software dossier library (comparison flow)` — no AI footers. Do NOT push.

## Steps

### Step 1: Layout + `.gitignore`

`pipelines/youtube/dossiers/` runtime layout (directories appear as scripts run; commit only the code files + `.gitignore`):

```
pipelines/youtube/dossiers/
├── CLAUDE.md · ingest.py · llm.py · prompts.py · distill.py · merge.py
├── .gitignore                 # one line: transcripts/
├── tests/
├── tools/<slug>/
│   ├── tool.json              # {"name":"Hostinger","slug":"hostinger","aliases":["hostinger vps"],"category":"","created":"YYYY-MM-DD"}
│   ├── sources.json           # registry, schema below
│   ├── transcripts/<id>.md    # timestamped transcript text (gitignored — regenerable via CLI cache)
│   ├── extractions/<id>.md    # distill output (committed)
│   └── dossier.md             # merge output (committed)
└── briefs/<video-slug>/brief.md   # Claude assembly output (committed)
```

`sources.json` (keys are 11-char video ids):

```json
{
  "nIy6sFbv9to": {
    "title": "Hostinger VPS Full Review ...",
    "channel": "HIVE corp.",
    "published": "2026-06-02",
    "fetched": "2026-07-07",
    "words": 4813,
    "extracted": false,
    "merged": false
  }
}
```

**Verify**: `cat pipelines/youtube/dossiers/.gitignore` → `transcripts/`

### Step 2: `ingest.py`

Stdlib-only (argparse, json, subprocess, datetime, pathlib, sys, time). Docstring states: run from the Mac (residential IP), stdlib-only, idempotent. Use argparse **subparsers**; implement only `tool` (045 adds `topic`):

```
python3 ingest.py tool <slug> [--name "Display Name"] [--aliases "a,b"] [--category vps-hosting]
                              [--search "query"] [--max 12] [--videos id1,id2,...]
```

Behavior:
1. Create `tools/<slug>/` + `transcripts/` + `extractions/`; write `tool.json` only if absent — never overwrite. `--name` defaults to the slug title-cased; `--search` defaults to `"<name> review"`.
2. Candidates: if `--videos` given, those ids (no search). Else run `pp-youtube search "<query>" --account kushalbakliwal25@gmail.com --max <max> --type video` (CLI path per the exemplar pattern, `HERE.parents[2]/…/pp-youtube`), parse JSON; drop results older than 548 days (18 months, constant `MAX_AGE_DAYS` at top) and ids already in `sources.json`.
3. Per candidate: `pp-yt-transcript get <id> --timestamps`; exit != 0 OR under 300 words (constant `MIN_WORDS`) = unusable → one skip line, continue. If the first 5 candidates all fail, `sys.exit` with a YouTube-block warning (copied from the exemplar). Sleep 1s between fetches.
4. On success: write `transcripts/<id>.md` (raw stdout); add registry entry (`published` = `publishedAt[:10]`, or `""` for `--videos` ids; `fetched` = today; `words`; `extracted`/`merged` false). Rewrite `sources.json` (sorted keys, indent=2) after EACH success so interruption loses nothing.
5. Final print: `ingested <n> new, skipped <m>, total <t> sources for <slug>`.

**Verify**: `python3 pipelines/youtube/dossiers/ingest.py --help` → usage listing the `tool` subcommand, exit 0.

### Step 3: `llm.py` — place as-is

```python
#!/usr/bin/env python3
"""Minimal stdlib Gemini REST client for the dossiers pipeline.

No deps, no venv. Reads GEMINI_API_KEY from the environment or from
pipelines/.env. Deliberately NOT common/gemini.py: that helper needs the
google-genai package, and this pipeline is stdlib-only by design.
"""
import json
import os
import time
import urllib.request
from pathlib import Path

MODEL = "gemini-2.5-flash"
MAX_OUTPUT_TOKENS = 16384
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"  # <repo>/pipelines/.env


def _api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    if _ENV_PATH.exists():
        for line in _ENV_PATH.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"GEMINI_API_KEY not in env or {_ENV_PATH}")


def generate(prompt, *, schema=None, model=MODEL, retries=2):
    """One Gemini call. With schema (a dict): JSON mode, returns the parsed
    object. Without: returns response text."""
    config = {"maxOutputTokens": MAX_OUTPUT_TOKENS}
    if schema is not None:
        config["responseMimeType"] = "application/json"
        config["responseSchema"] = schema
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": config}
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "x-goog-api-key": _api_key()},
    )
    last = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                resp = json.load(r)
            text = resp["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text) if schema is not None else text
        except Exception as e:  # noqa: BLE001 — retry then surface
            last = e
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    raise last
```

**Verify**: `python3 -c "import sys; sys.path.insert(0,'pipelines/youtube/dossiers'); import llm; print(llm.MODEL)"` → `gemini-2.5-flash`

### Step 4: `prompts.py` — constants verbatim

`TOOL_EXTRACTION_PROMPT` (placeholders filled by callers via `.format(...)`):

```
You are extracting factual claims about ONE software product from a YouTube video transcript.

Tool: {tool_name} (also referred to as: {aliases})
Video: {video_id} | "{title}" | channel: {channel} | published: {published}
Transcript lines are prefixed with [mm:ss] timestamps.

Extract ONLY claims about {tool_name}. Other tools may appear ONLY inside "comparisons".

Rules:
- Every item carries "ts": the [mm:ss] of the transcript line supporting it.
- Copy prices and numbers exactly as spoken; never round, never convert currency.
- "demos" = things the creator actually DID on screen (signals: "let me click", "as you can see", "I'll deploy", errors happening live) — not features merely described.
- "quirks" = friction, surprises, bugs, confusing UX the creator hit.
- If the creator ranks the tool or gives a verdict, capture it with their stated reasoning.
- Empty arrays are fine. NEVER invent or infer beyond the transcript.

TRANSCRIPT:
{transcript}
```

`TOOL_SCHEMA` — Gemini responseSchema, written as a Python dict literal with this JSON shape:

```json
{
  "type": "object",
  "properties": {
    "identity_notes": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "pricing_claims": {"type": "array", "items": {"type": "object", "properties": {"plan": {"type": "string"}, "price": {"type": "string"}, "detail": {"type": "string"}, "ts": {"type": "string"}}, "required": ["price", "ts"]}},
    "strengths":  {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "weaknesses": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "quirks":     {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "demos":      {"type": "array", "items": {"type": "object", "properties": {"what": {"type": "string"}, "ts": {"type": "string"}}, "required": ["what", "ts"]}},
    "comparisons": {"type": "array", "items": {"type": "object", "properties": {"vs": {"type": "string"}, "claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["vs", "claim", "ts"]}},
    "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}}
  },
  "required": ["identity_notes", "pricing_claims", "strengths", "weaknesses", "quirks", "demos", "comparisons"]
}
```

`DOSSIER_SKELETON` (used by merge when no dossier exists yet):

```markdown
# {tool_name} — dossier
Updated: {date} · Sources: {n} videos (newest: {newest})

## Identity

## Pricing
| Plan | Price | Notes | As-of | Source |
|---|---|---|---|---|

## Strengths

## Weaknesses

## Quirks & gotchas

## Screen-worthy moments

## Head-to-head

## Verdicts heard

## Conflicts & open questions
```

`MERGE_PROMPT`:

```
You maintain a software DOSSIER: the single source of truth used to script YouTube comparison videos.

Tool: {tool_name}
Today: {date}

Below are (1) the CURRENT dossier and (2) {n} NEW extraction files, each distilled from one video (its publish date is in its header).

Rewrite the FULL dossier, folding in the new extractions.

Rules:
- Keep EXACTLY the section skeleton of the current dossier (same headings, same order).
- Every claim line ends with its citation: (video-id @ mm:ss, MMM YYYY) where MMM YYYY is the source video's publish month.
- Pricing: the newest source wins the table row; a conflicting older price moves to "Conflicts & open questions" with both citations. Every pricing row's As-of = publish month of its source.
- Non-pricing contradictions: keep BOTH claims in "Conflicts & open questions" with citations. Do not pick a winner.
- The same claim from 2+ videos becomes ONE line with all citations (corroboration strengthens it).
- "Screen-worthy moments": keep the most concrete, demonstrable ones, max 10, each describing what happens on screen.
- Never drop a cited claim unless directly superseded; never add text without a citation.
- Update the header line: today's date, source count {total_sources}, newest source month.

Output ONLY the dossier markdown, nothing else.

CURRENT DOSSIER:
{dossier}

NEW EXTRACTIONS:
{extractions}
```

**Verify**: `python3 -c "import sys; sys.path.insert(0,'pipelines/youtube/dossiers'); import prompts; assert '{transcript}' in prompts.TOOL_EXTRACTION_PROMPT; assert 'Screen-worthy moments' in prompts.DOSSIER_SKELETON; print('ok')"` → `ok`

### Step 5: `distill.py`

CLI: `python3 distill.py tool <slug> [--video <id>]` (subparsers again; 045 adds `topic`).

1. Targets = `sources.json` entries with `extracted == false` (or only `--video`'s id). Per target: read `transcripts/<id>.md`, format `TOOL_EXTRACTION_PROMPT` (`tool.json` supplies name/aliases; registry supplies title/channel/published), call `llm.generate(prompt, schema=prompts.TOOL_SCHEMA)`.
2. Render to `extractions/<id>.md`: header block (`video:`, `title:`, `channel:`, `published:`, `extracted: <today>`) then one `## <section>` per non-empty schema key, one bullet per item with `ts` leading (e.g. `- [12:34] plan: VPS 1 — price: $4.99/mo — first term only`). Dumb and lossless.
3. Flip `extracted: true` per video, rewriting `sources.json` after each.
4. Per-video failure: print one error line, continue the batch. Final print: `distilled <n> extractions for <slug>`.

**Verify**: `python3 pipelines/youtube/dossiers/distill.py --help` → usage, exit 0.

### Step 6: `merge.py`

CLI: `python3 merge.py <slug>`.

1. Pending = entries with `extracted == true and merged == false`. None → print `nothing to merge`, exit 0.
2. Current `dossier.md`, or `DOSSIER_SKELETON` formatted (n=0, newest `—`) if absent. Concatenate pending extractions with `--- extraction <id> ---` separators.
3. One `llm.generate(MERGE_PROMPT.format(...))` call (no schema). **Guard**: response must start with `# ` AND be at least half the current dossier's length — otherwise do NOT write, print the error, exit 1.
4. On success: write `dossier.md`, flip `merged: true` for pending ids, print `merged <n> extractions into tools/<slug>/dossier.md`.

**Verify**: `python3 pipelines/youtube/dossiers/merge.py --help` → usage, exit 0.

### Step 7: `CLAUDE.md` — the assembly workflow

Create `pipelines/youtube/dossiers/CLAUDE.md` with exactly:

````markdown
# dossiers — persistent per-software research library (research v2)

One dossier per software, built once from YouTube transcripts by a cheap
model, updated incrementally, reused by every future video. A comparison
video assembles a brief from 10–15 dossiers instead of re-reading 200k+
words of transcripts. Successor to the per-niche `../yt-research/` flow for
NEW videos (v1 stays for its archived niches). Design:
`docs/yt-research-v2-brainstorm-handoff.md`.

## Commands (stdlib python3, run from this folder, on the Mac — residential IP)

    python3 ingest.py tool <slug> --name "Hostinger" [--search "hostinger review"] [--max 12] [--videos id,id]
    python3 distill.py tool <slug>            # cheap-model extraction per new transcript (Gemini flash)
    python3 merge.py <slug>                   # fold new extractions into tools/<slug>/dossier.md

Adding sources later: re-run the same three commands — already-fetched /
already-merged videos are skipped automatically.

## Layout

    tools/<slug>/   tool.json · sources.json · transcripts/ (gitignored) · extractions/ · dossier.md
    briefs/<video-slug>/brief.md

## When the user says "assemble brief for <video-slug> — tools: a, b, c"

1. Read `tools/<t>/dossier.md` for every listed tool. If one is missing, or
   its header `Updated:` is older than 6 months, say so and offer to run the
   ingest→distill→merge cycle first. Read NOTHING from `transcripts/`.
2. Ask the owner (one message): their tier ranking of the listed tools, the
   audience, and any angle they already have. Their ranking is the video's
   ranking — dossiers justify it, they don't override it.
3. Write `briefs/<video-slug>/brief.md`:

   # Video brief — <video-slug>
   Date · Tools: <list> · Dossier freshness: <slug: Updated date, one per tool>

   ## Angle & thesis            — one sentence + 2-3 lines of support
   ## Tier ranking              — the owner's ranking; per tier, WHY, grounded in dossier claims (keep citations)
   ## Per-tool segments         — for each tool: 3-5 key points (cited), a demo plan
                                  (pick from the dossier's "Screen-worthy moments"),
                                  and its price line with as-of date
   ## Pricing verification list — every price whose as-of is older than 90 days;
                                  the freelancer/owner verifies these before recording
   ## Gaps & open questions     — from the dossiers' "Conflicts & open questions";
                                  each either resolved here (say how) or listed to omit
   ## Hook candidates           — 3, drawn from the strongest surprises in the dossiers

4. Self-check against the rubric before presenting:
   - every ranking statement traces to a dossier claim or the owner's stated ranking
   - every tool has at least one concrete on-screen demo moment
   - no price appears without an as-of date; all >90-day prices are in the verification list
   - no tool outside the requested list; no uncited factual claim

## Script handoff

A finished brief feeds `../yt-script/` ("script for <video-slug>") — its
CLAUDE.md accepts `briefs/<video-slug>/brief.md` from this folder as the
input document. Voice/structure stay governed by `../yt-script/Guidelines/`.

## Hard rules

- Never read `transcripts/` in an assembly session — that's the token sink
  this folder exists to prevent. Distill first, then assemble from compact
  layers.
- Prices, names, rankings come from dossiers/the owner verbatim — never
  invent, round, or re-rank.
- Facts age: trust a claim's date, not its presence. Stale pricing goes to
  the verification list, not the script.
````

**Verify**: `grep -c "assemble brief for" pipelines/youtube/dossiers/CLAUDE.md` → at least `1`.

### Step 8: Wire `yt-script/` + register + fix links

1. `pipelines/youtube/yt-script/CLAUDE.md` — replace step 3 (quoted in Current state) with:
   ```
   3. Read the input document, whichever exists for this name (checked in this order):
      - `../dossiers/briefs/<name>/brief.md` (research v2 — preferred for new videos)
      - `../yt-research/niches/<name>/output/knowledge-base-compact.md`, falling back to `knowledge-base.md` (v1 niches)
   ```
   And add to "Related repos": `- `../dossiers/` — research v2: per-software dossier library; briefs land in `dossiers/briefs/<video-slug>/brief.md`.`
2. `pipelines/youtube/CLAUDE.md` — Subfolders table, after the `yt-script` row: `| [`dossiers/`](dossiers/CLAUDE.md) | Persistent per-software dossier library (research v2) → video briefs | Python + Claude workflows |`. Under "Pipeline relationships" add: `- **Dossier → script (v2):** `dossiers/` builds per-software dossiers once, assembles per-video briefs; `yt-script/` consumes them.` Fix the stale link `(../docs/research-and-script-workflow.md)` → `(../../docs/research-and-script-workflow.md)`.
3. `pipelines/CLAUDE.md` — Folder map, with the other youtube rows: `| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/dossiers/`](youtube/dossiers/CLAUDE.md) | Per-software dossier library → video briefs (research v2) | Python + Claude workflows |`
4. `docs/research-and-script-workflow.md` — directly under the H1: `> **Research v2 (2026-07):** for NEW videos, prefer the per-software dossier flow in `pipelines/youtube/dossiers/` (see its CLAUDE.md). This wizard remains valid for the archived v1 niches.`

**Verify**: `grep -c "dossiers/briefs" pipelines/youtube/yt-script/CLAUDE.md` → `2`; `grep -c "dossiers/CLAUDE.md" pipelines/CLAUDE.md pipelines/youtube/CLAUDE.md` → 1 each; `grep -c "(../docs/research-and-script-workflow.md)" pipelines/youtube/CLAUDE.md` → `0`.

### Step 9: Tests

All pytest, importing modules via `sys.path.insert(0, str(Path(__file__).resolve().parents[1]))`, using `tmp_path` + monkeypatched base-dir constants so nothing writes into the repo.

`tests/test_ingest.py` (mock `subprocess.run`):
1. **Layout + registry**: fake search returns 2 videos (30 days old / 3 years old), fake transcript 400 words → one transcript written; correct `sources.json` entry; `tool.json` created; old video filtered.
2. **Idempotency**: same fake search twice → second run ingests 0; `tool.json` not overwritten.
3. **Short-transcript skip**: under 300 words → no file, no entry, counted skipped.
4. **`--videos` path**: no search invocation (fake raises on `search` argv); `published` = `""`.

`tests/test_distill_merge.py` (mock `llm.generate`; fixture tool dir with 2 sources):
5. **Distill happy path**: valid schema object returned → 2 extraction files with expected `##` sections and `[mm:ss]` bullets; `extracted` flags true; prompt contained transcript + tool name.
6. **Distill --video**: only that id processed.
7. **Merge happy path**: valid `# Tool — dossier` doc returned → `dossier.md` written; `merged` true; prompt contained skeleton (first merge) + both extraction bodies.
8. **Merge guard**: fake returns `"oops"` → dossier NOT written, non-zero exit, `merged` stays false.
9. **Nothing to merge**: exits 0 without calling the LLM (fake raises if called).

`tests/test_docs.py` (structural; resolve repo root via `Path(__file__).resolve().parents[4]`):
10. `dossiers/CLAUDE.md` contains `assemble brief for`, `Pricing verification list`, and `Never read`.
11. `yt-script/CLAUDE.md` contains `dossiers/briefs/<name>/brief.md`.
12. `pipelines/youtube/CLAUDE.md` and `pipelines/CLAUDE.md` contain `dossiers/CLAUDE.md`; `pipelines/youtube/CLAUDE.md` does NOT contain `(../docs/research-and-script-workflow.md)`.

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests -q` → all pass, exit 0.

### Step 10: Register status

Flip plan 044's row to DONE in `plans/README.md`.

**Verify**: `grep "| 044" plans/README.md` → DONE.

## Test plan

Step 9 is the test plan. External seams (`subprocess.run`, `llm.generate`) are mocked everywhere; no network, no API key, no venv in tests.

## Done criteria

- [ ] `python3 -m pytest pipelines/youtube/dossiers/tests -q` exits 0 (≥12 tests).
- [ ] All five scripts respond to `--help` with exit 0.
- [ ] `prompts.py` and `llm.py` match this plan verbatim.
- [ ] yt-script step 3 checks the brief path first; both folder maps registered; stale link fixed; v1 doc carries the v2 pointer.
- [ ] No non-stdlib imports anywhere in the folder; no writes outside the listed in-scope paths.

## STOP conditions

- `tooling/cli/youtube/pp-yt-transcript` or `pp-youtube` missing at the stated paths — stop; do NOT write a replacement fetcher (plans/runs/LESSONS.md 2026-07-05).
- `pipelines/youtube/dossiers/` already exists with content — stop and report.
- A file to edit doesn't contain the excerpt quoted in Current state — stop; don't guess a new anchor.
- Any prompt/schema seems wrong for a case you hit — stop and report; prompt redesign is the orchestrator's job.
- You need a non-stdlib package — stop; stdlib-only is a design decision.

## Maintenance notes

- Tuning knobs: `MAX_AGE_DAYS`/`MIN_WORDS` (ingest.py), `MODEL`/`MAX_OUTPUT_TOKENS` (llm.py — single place to swap models), the 6-month dossier / 90-day pricing thresholds (CLAUDE.md policy text), merge's "max 10 screen-worthy moments" cap (prompts.py).
- Merge rewrites the whole dossier each run; the Step 6 guard is the protection against a bad LLM response. If dossiers outgrow ~4k words, tighten the caps in the merge prompt rather than splitting files.
- Plan 045 (explainer flow) adds `topic` subcommands to ingest/distill and a fact-sheet workflow to CLAUDE.md — keep the subparser structure and the extraction renderer generic enough for that (renderer takes a dict, not hardcoded tool keys).
- The brief template/rubric live only in CLAUDE.md — edit there and keep `test_docs.py`'s pinned strings in sync.
