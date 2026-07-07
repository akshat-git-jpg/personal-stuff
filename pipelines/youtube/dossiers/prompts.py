"""Extraction and merge prompts for the dossiers pipeline. Verbatim from
docs/superpowers/specs/2026-07-08-dossier-skills-design.md - do not edit
these without updating the design spec to match.
"""

EXTRACTION_PROMPT = '''You are analyzing a YouTube video transcript to extract factual claims and
opinions about every distinct software product, tool, or service it discusses.

Video: {video_id} | "{title}" | channel: {channel} | published: {published}
Transcript lines are prefixed with [mm:ss] timestamps.

Identify every distinct tool discussed with real content (ignore a tool named
only in passing with no claims about it).

For EACH tool identified, extract:
- identity_notes: what it is, who it's for
- pricing_claims: plan, price, detail - copied exactly as spoken, never rounded or converted
- strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
- demos: things the creator actually DID on screen (not just described)
- comparisons: explicit head-to-head claims against other tools named in this video
- verdict: the creator's ranking or recommendation, with their stated reasoning

Every item carries "ts": the [mm:ss] of the transcript line supporting it.
Empty arrays are fine. NEVER invent or infer beyond the transcript.

Output ONLY a single fenced json code block, no prose before or after it,
containing an object of this shape:

{{"tools": [{{"tool_name", "aliases", "identity_notes", "pricing_claims",
"strengths", "weaknesses", "quirks", "demos", "comparisons", "verdict"}}, ...]}}

TRANSCRIPT:
{transcript}
'''

TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "tool_name": {"type": "string"},
        "aliases": {"type": "array", "items": {"type": "string"}},
        "identity_notes": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "pricing_claims": {"type": "array", "items": {"type": "object", "properties": {"plan": {"type": "string"}, "price": {"type": "string"}, "detail": {"type": "string"}, "ts": {"type": "string"}}, "required": ["price", "ts"]}},
        "strengths": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "weaknesses": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "quirks": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
        "demos": {"type": "array", "items": {"type": "object", "properties": {"what": {"type": "string"}, "ts": {"type": "string"}}, "required": ["what", "ts"]}},
        "comparisons": {"type": "array", "items": {"type": "object", "properties": {"vs": {"type": "string"}, "claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["vs", "claim", "ts"]}},
        "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}},
    },
    "required": ["tool_name", "identity_notes", "pricing_claims", "strengths", "weaknesses", "quirks", "demos", "comparisons"],
}

MERGE_PROMPT = '''You maintain a software DOSSIER: the single source of truth used to script YouTube comparison videos.

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
'''

DOSSIER_SKELETON = '''# {tool_name} - dossier
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
'''
