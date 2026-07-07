# Dossier skills — design

**Status:** approved, ready for planning
**Supersedes:** PR #2 / `plans/044-dossiers-tutorial-flow.md` (a Python pipeline driven by search). That plan is closed; this design replaces it with skill-driven, link-driven workflow.

## Problem

Screen-recorded comparison/tutorial videos cover many tools each. Research today is redone per video: an expensive model re-reads dozens of transcripts every time, even though tool overlap across videos is high. The research unit should be the *video* (fetched once) and the *tool* (a persistent profile), not the video-for-a-specific-script.

## Scope

**In scope:**
- `pipelines/common/transcribe.py` — one shared transcript-fetching module with a fallback chain, replacing three duplicated implementations.
- Refactor `pipelines/youtube/tutorial-pipeline-2/lib/asr.py` and `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py` to call the shared module instead of keeping their own Groq-calling copies. The two `asr.py` files are confirmed byte-identical, so deduping them is safe. Their sibling `lib/audio.py` files are **not** confirmed identical beyond the `to_mp3()` function `asr.py` calls — before deduping, diff both `audio.py` files in full; only fold `to_mp3()` into the shared module and leave any other functions (`dur`, `mmss`, `concat`, etc.) where callers already depend on them if the files diverge.
- `transcribe` skill — thin router documenting/orchestrating the fallback chain for any consumer.
- `dossier-transcripts` skill — takes YouTube links, fetches transcripts into a global store.
- `dossier-build` skill — analyzes fetched transcripts (discovering every tool each one mentions) and folds the results into per-tool dossiers.
- Data layer: `pipelines/youtube/dossiers/` (videos/ global store, tools/ per-tool dossiers, registry bookkeeping).

**Out of scope (deferred):**
- A third skill that assembles a video brief / answers questions / drafts a script from dossiers (was skill 3 in the original ask — explicitly deferred, not built now). The data layout below leaves room for it later without rework.
- Any search/discovery step (finding candidate videos for a topic). The owner supplies links directly.
- Direct paid API calls for the analysis step (e.g. calling Gemini's REST API directly) — the owner wants subscription-backed execution only (agy or a Claude Code subagent), never a metered API key.

## Architecture

```
pipelines/.claude/skills/
├── transcribe/SKILL.md              # shared fallback-chain router
├── dossier-transcripts/SKILL.md     # fetch links -> transcripts
└── dossier-build/SKILL.md           # analyze + merge into dossiers

pipelines/common/
└── transcribe.py                    # fallback chain: captions -> Groq Whisper -> local Whisper
                                      #   CLI + importable; no LLM calls, pure mechanics

pipelines/youtube/dossiers/
├── CLAUDE.md                        # layout + status-model reference (not a skill)
├── prompts.py                       # extraction prompt (multi-tool discovery) + merge prompt
├── registry.py                      # bookkeeping over meta.json/dossier status, plus the extraction
│                                     #   parse contract + merge sanity guard — all pure, unit-testable
├── videos/<video-id>/
│   ├── meta.json                    # title, channel, published, fetched_at, transcript_method, url
│   ├── transcript.md                # gitignored, raw transcript, regenerable
│   └── extraction.md                # committed — every tool this video mentions, each with its
│                                     #   own facts, discovered automatically
└── tools/<slug>/
    ├── tool.json                    # canonical name + aliases, created on first discovery
    └── dossier.md                   # folded-in facts for this tool, from every video that has
                                      #   merged it in so far
```

## Status model

Tracking is split into two levels so a video that covers five tools is analyzed once, not five times:

- **`fetched`** (per video) — transcript exists in `videos/<id>/`. Global; independent of which tools it mentions.
- **`extracted`** (per video) — the transcript has been fully analyzed and every tool it mentions has been pulled into `extraction.md`, with `meta.json.merged_into` seeded to `{tool-slug: false, ...}` for whatever tools were actually found (never pre-declared by the owner).
- **`merged_into.<tool>`** (per video, per tool) — `true` once that specific tool's dossier has folded this video's facts in.

Worked example: a video titled "Best 5 Web Hosting" gets fetched once. Extraction discovers it mentions Hostinger, Bluehost, and three others, seeding `merged_into` with all five as `false`. Building Hostinger's dossier flips `merged_into.hostinger` to `true` and leaves the other four `false` until their own dossiers get built — potentially weeks apart, no re-fetching or re-analysis needed.

## `transcribe` skill

Given a YouTube link (or local audio/video file), produce a transcript by trying, in order:

1. **Native captions** — `tooling/cli/youtube/pp-yt-transcript get <id> --timestamps`. Fast, free, YouTube URLs only, fails if the video has no captions.
2. **Groq Whisper** — `yt-dlp` pulls audio, converts to mp3, sent to Groq's hosted `whisper-large-v3-turbo` (`GROQ_API_KEY` from `~/.zshenv`, same as the existing `asr.py` pattern). Fast, cheap, subscription-backed, works on any video.
3. **Local Whisper** — `npx hyperframes transcribe <file> --model small` (no `.en` suffix unless the audio is confirmed English — `.en` models mistranslate instead of transcribing). No API key, no network, slowest, last resort.

**Quality floor (carried over from plan 044, dropped is a regression, not a simplification):** a result is only accepted if it's at least `MIN_WORDS = 300` words. Native captions returning a thin/empty/placeholder transcript (autogenerated-but-broken captions, a "captions disabled" stub, etc.) do **not** count as success — the chain falls through to Groq Whisper instead of silently keeping garbage. Same floor applies to Groq and local Whisper output.

Interface (mechanical, not an LLM task):
```
python3 -m pipelines.common.transcribe fetch <youtube-url-or-id> [--method auto|captions|groq|local] [--out-dir path]
```
`--method auto` (default) walks the fallback chain; an explicit method skips straight to it. Returns the transcript path and which method actually succeeded, which callers record in `meta.json.transcript_method`.

## `dossier-transcripts` skill

Input: any number of YouTube links (typically 10–25, no hard cap). For each link:
1. Extract the video id.
2. If `videos/<id>/meta.json` already exists, skip (already fetched) — one line in the summary.
3. Otherwise call `transcribe` (fallback chain), write `meta.json` + `transcript.md` under `videos/<id>/`.
4. Final report: N new fetched (method used per video), M skipped, any hard failures (all three methods failed — video unavailable, region-locked, etc.).

Pure mechanics — no model calls, so invoking this skill is cheap regardless of how many links are given.

## `dossier-build` skill

One trigger, no sub-verbs to choose between — every invocation does the full catch-up pass.

**Deliberate trade-off, stated explicitly (not a silent regression):** plan 044's core principle was "a frontier model never reads raw transcripts" — a cheap model did, via a direct API call. This design drops the direct-API path entirely per the owner's instruction (subscription-backed execution only, `agy` or a Claude Code subagent — never a metered key). Both of those options do read the raw transcript directly when they extract. That's an accepted cost/architecture trade-off in exchange for not touching a paid API, not an oversight.

**Dispatch mechanics:** `agy` is invoked directly with its own CLI (`agy -p "<prompt>" --output-format json --model "<model>"`), **not** through `tooling/boss/executors/agy.sh` — that wrapper is built for boss's async crew/PR/worktree workflow (leases a `wt` worktree, requires a git commit, polls dispatch/alive/collect) and doesn't fit a synchronous single-prompt call. The `--output-format json` flag conventions and the `status: SUCCESS|ERROR` envelope shape are reused from it, since that's already agy's real output contract.

1. **Extract.** Find every video that is `fetched` but not `extracted`. If any exist: ask once which execution method (`agy` or a Claude Code subagent) and which model to use, showing the previous run's choice as the suggested default, and confirm the video count before running. For each pending video, run the discovery-extraction prompt (below) and parse the result against the **output contract**: the executor must emit ONLY a single fenced ` ```json ` block matching `TOOL_SCHEMA` — no prose before or after. Parsing steps: (a) for `agy`, unwrap the `--output-format json` envelope and confirm `status: SUCCESS`; for a subagent, take its final text message directly; (b) extract the content of the first fenced json block; (c) `json.loads()` it; (d) validate `tools` is a present, non-empty array and every entry has at minimum `tool_name`. Any failure in (a)-(d) is a parse failure: skip this video, log the error, leave `extracted: false` for retry — doesn't block the rest of the batch. On success: write `extraction.md`, flip `extracted: true`, seed `merged_into` for each tool actually found (see "Tool identity matching" below for how a discovered name maps to a folder).
2. **Merge.** Find every tool with at least one video where `merged_into.<tool>` is still `false` (freshly extracted ones plus any left over from earlier runs). For each such tool, fold the pending videos' facts into `tools/<slug>/dossier.md` via the merge prompt (below). **Write order matters:** the file is written to disk first; `merged_into.<tool>` is only flipped to `true` per video *after* a successful write. If the process crashes in between, the next run re-detects those videos as unmerged and re-merges them — safe, because the merge prompt's corroboration rule collapses a re-seen claim into the same cited line rather than duplicating content (worst case is a harmless duplicate citation, not corrupted data). If the model's output fails the **sanity guard**, the file is **not** overwritten, no flags are flipped, and an error is reported — safe to retry. The guard now checks four things, not just length: (a) response starts with `# `; (b) response is at least half the current dossier's length; (c) the citation count (occurrences of `(<11-char-video-id> @`) is not lower than the current dossier's citation count; (d) every video id in this merge batch appears at least once in the output. Any failing check blocks the write.
3. **Report** a single summary: videos extracted, dossiers updated (tool names), any new tool folders created this run (for a quick accuracy scan), any near-duplicate tool names flagged for a decision, anything skipped or failed.

### Extraction prompt (discovery — replaces plan 044's single-tool-scoped version)

```
You are analyzing a YouTube video transcript to extract factual claims and
opinions about every distinct software product, tool, or service it discusses.

Video: {video_id} | "{title}" | channel: {channel} | published: {published}
Transcript lines are prefixed with [mm:ss] timestamps.

Identify every distinct tool discussed with real content (ignore a tool named
only in passing with no claims about it).

For EACH tool identified, extract:
- identity_notes: what it is, who it's for
- pricing_claims: plan, price, detail — copied exactly as spoken, never rounded or converted
- strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
- demos: things the creator actually DID on screen (not just described)
- comparisons: explicit head-to-head claims against other tools named in this video
- verdict: the creator's ranking or recommendation, with their stated reasoning

Every item carries "ts": the [mm:ss] of the transcript line supporting it.
Empty arrays are fine. NEVER invent or infer beyond the transcript.

Output ONLY a single fenced json code block, no prose before or after it,
containing an object of this shape (see TOOL_SCHEMA below for the full
per-tool field spec):

{"tools": [{"tool_name", "aliases", "identity_notes", "pricing_claims",
"strengths", "weaknesses", "quirks", "demos", "comparisons", "verdict"}, ...]}

TRANSCRIPT:
{transcript}
```

`TOOL_SCHEMA` (the object each `tools[]` entry must match — same shape plan 044 used per-tool, now nested under the discovery wrapper):

```json
{
  "type": "object",
  "properties": {
    "tool_name": {"type": "string"},
    "aliases": {"type": "array", "items": {"type": "string"}},
    "identity_notes": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "pricing_claims": {"type": "array", "items": {"type": "object", "properties": {"plan": {"type": "string"}, "price": {"type": "string"}, "detail": {"type": "string"}, "ts": {"type": "string"}}, "required": ["price", "ts"]}},
    "strengths":  {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "weaknesses": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "quirks":     {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
    "demos":      {"type": "array", "items": {"type": "object", "properties": {"what": {"type": "string"}, "ts": {"type": "string"}}, "required": ["what", "ts"]}},
    "comparisons": {"type": "array", "items": {"type": "object", "properties": {"vs": {"type": "string"}, "claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["vs", "claim", "ts"]}},
    "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}}
  },
  "required": ["tool_name", "identity_notes", "pricing_claims", "strengths", "weaknesses", "quirks", "demos", "comparisons"]
}
```

### Merge prompt (per tool)

Inlined in full (plan 044 is deleted from disk — defining this by reference left nothing for a planner to read):

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
- If the folded dossier would exceed ~4,000 words: prioritize corroborated (multi-video) claims; prune single-source claims from "Quirks & gotchas" and "Weaknesses" first, never from "Pricing," "Identity," or "Verdicts heard."
- Never drop a cited claim unless directly superseded; never add text without a citation.
- Update the header line: today's date, source count {total_sources}, newest source month.

Output ONLY the dossier markdown, nothing else.

CURRENT DOSSIER:
{dossier}

NEW EXTRACTIONS:
{extractions}
```

`DOSSIER_SKELETON` (used when a tool folder is created and has no dossier yet):

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

### Tool identity matching

A discovered `tool_name` is matched against existing `tools/<slug>/` folders by normalized name (lowercased, punctuation stripped) or listed alias:

- **Exact match** → reuse that folder, no interruption. This is the common case and stays fully automatic.
- **Near match** (e.g. one normalized name is a substring of another, or a small edit-distance against an existing name/alias) → do **not** auto-create a new folder and do **not** auto-merge into the existing one. Hold that video's data for this tool as pending, and flag it in the run's final summary (e.g. "'Hostinger VPS' looks similar to existing 'hostinger' — merge or keep separate?") for the owner to resolve — either by adding it as an alias or explicitly confirming a distinct tool.
- **No match at all** (genuinely new) → auto-create the folder, same as before — this stays frictionless since it's the majority case — but every folder created in a run is listed in the final summary so the owner can glance over new entries for accuracy rather than discovering a bad one deep in the library later.

## Error handling

- All three transcript methods fail, or all three return under `MIN_WORDS` → skipped with one error line, nothing written, rest of the batch continues.
- Extraction output fails the parse contract (no fenced json block, invalid JSON, missing `tools`/`tool_name`) → skipped with an error line, stays `extracted: false` for retry, rest of the batch continues.
- Merge output fails any of the four sanity-guard checks (doesn't start with `# `; under half current length; citation count didn't hold or grow; a source video id from this batch is missing from the output) → `dossier.md` untouched, `merged_into` unflipped for that batch, error reported, safe to retry.
- Near-duplicate tool name detected → held pending, flagged in the run summary, no folder created or merged until the owner resolves it.

## Testing

- `pipelines/common/transcribe.py` and `pipelines/youtube/dossiers/registry.py` are plain Python with no model calls — real `pytest` coverage, mocking `subprocess`/network the way plan 044 did for its ingest step. `registry.py`'s coverage includes the extraction parse contract (fenced-block extraction, JSON validation, required-field checks) and the merge sanity guard (all four checks) as pure functions over fixture strings — these are mechanical and fully mockable even though the model call that produces the input isn't.
- The extraction and merge model calls themselves are dispatched to agy or a subagent per the owner's choice each run, not a deterministic mockable client — no pytest coverage for "is the LLM output correct." Verified behaviorally: run `dossier-build` against a couple of real transcripts and check the resulting `extraction.md`/`dossier.md` before trusting a full batch.

## Open points for plan readiness

None.
