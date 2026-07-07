# Dossier skills — design

**Status:** approved, ready for planning
**Supersedes:** PR #2 / `plans/044-dossiers-tutorial-flow.md` (a Python pipeline driven by search). That plan is closed; this design replaces it with skill-driven, link-driven workflow.

## Problem

Screen-recorded comparison/tutorial videos cover many tools each. Research today is redone per video: an expensive model re-reads dozens of transcripts every time, even though tool overlap across videos is high. The research unit should be the *video* (fetched once) and the *tool* (a persistent profile), not the video-for-a-specific-script.

## Scope

**In scope:**
- `pipelines/common/transcribe.py` — one shared transcript-fetching module with a fallback chain, replacing three duplicated implementations.
- Refactor `pipelines/youtube/tutorial-pipeline-2/lib/asr.py` and `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py` (plus their `lib/audio.py` mp3-conversion helpers) to call the shared module instead of keeping their own Groq-calling copies.
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
├── registry.py                      # pure bookkeeping over meta.json / dossier status, unit-testable
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

One trigger, no sub-verbs to choose between — every invocation does the full catch-up pass:

1. **Extract.** Find every video that is `fetched` but not `extracted`. If any exist: ask once which execution method (`agy` headless CLI or a Claude Code subagent) and which model to use — both are subscription-backed, no direct paid API calls — showing the previous run's choice as the suggested default, and confirm the video count before running. For each pending video, run the discovery-extraction prompt (below), write `extraction.md`, flip `extracted: true`, seed `merged_into` for each tool actually found. A video whose output doesn't parse is skipped with an error line and retried on the next run; it doesn't block the batch.
2. **Merge.** Find every tool with at least one video where `merged_into.<tool>` is still `false` (freshly extracted ones plus any left over from earlier runs). For each such tool, fold the pending videos' facts into `tools/<slug>/dossier.md` via the merge prompt (below), then flip `merged_into.<tool>` to `true` for each video folded in. If the model's output fails the sanity guard (too short, doesn't look like a real dossier), the file is **not** overwritten, the flag stays `false`, and an error is reported — safe to retry.
3. **Report** a single summary: videos extracted, dossiers updated (tool names), anything skipped or failed.

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

Output: {"tools": [{"tool_name", "aliases", "identity_notes", "pricing_claims",
"strengths", "weaknesses", "quirks", "demos", "comparisons", "verdict"}, ...]}

TRANSCRIPT:
{transcript}
```

### Merge prompt (per tool — same rules as plan 044)

Unchanged from plan 044's `MERGE_PROMPT`: rewrites the full dossier keeping the section skeleton, every claim cited `(video-id @ mm:ss, MMM YYYY)`, newest price wins with older conflicting prices moved to "Conflicts & open questions," non-pricing contradictions kept as both claims (never picking a winner), corroborated claims from multiple videos collapsed into one line with all citations.

### Tool identity matching

A tool is matched to an existing `tools/<slug>/` folder by normalized name (lowercased, punctuation stripped) or listed alias. No match creates a new tool folder from that extraction's `tool_name`/`aliases`. Near-duplicate tools from inconsistent naming across videos (e.g. "Hostinger" vs "Hostinger VPS") are a known limitation — not auto-resolved; the owner can merge folders manually if it happens.

## Error handling

- All three transcript methods fail → skipped with one error line, nothing written, rest of the batch continues.
- Malformed extraction output for one video → skipped with an error line, stays `extracted: false` for retry, rest of the batch continues.
- Merge output fails the sanity guard (response doesn't start with `# `, or is under half the current dossier's length) → `dossier.md` untouched, `merged_into` unflipped, error reported, safe to retry.

## Testing

- `pipelines/common/transcribe.py` and `pipelines/youtube/dossiers/registry.py` are plain Python with no model calls — real `pytest` coverage, mocking `subprocess`/network the way plan 044 did for its ingest step.
- The extraction and merge steps are dispatched to agy or a subagent per the owner's choice each run, not a deterministic mockable client — no pytest coverage for "is the LLM output correct." Verified behaviorally: run `dossier-build` against a couple of real transcripts and check the resulting `extraction.md`/`dossier.md` before trusting a full batch.

## Open points for plan readiness

None.
