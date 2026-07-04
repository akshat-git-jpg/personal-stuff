"""Sentence-packing into ~chunk_seconds chunks. Used by step 080 (synthesize).

Two entry points:
  chunk(text, ...)            -> [{id, text}]              (plain script, one stream)
  chunk_segments(segments,...)-> [{id, text, role, seg}]   (avatar-aware: never packs across a
                                                            segment boundary, so each avatar block
                                                            is a whole number of clean chunks)
"""
import re

WPS = 2.5  # spoken words per second — estimates a chunk's duration from its word count


def split_sentences(text):
    text = re.sub(r"\s+", " ", text.strip())
    return [p.strip() for p in re.split(r"(?<=[.!?])\s+", text) if p.strip()]


def _pack(text, chunk_seconds):
    """Pack whole sentences until ~chunk_seconds of estimated speech, then start a new one."""
    target_words = max(8, int(chunk_seconds * WPS))
    out, cur, cur_w = [], [], 0
    for s in split_sentences(text):
        w = len(s.split())
        if cur and cur_w + w > target_words:
            out.append(" ".join(cur)); cur, cur_w = [], 0
        cur.append(s); cur_w += w
    if cur:
        out.append(" ".join(cur))
    return out


def chunk(text, chunk_seconds):
    return [{"id": f"{i:04d}", "text": c} for i, c in enumerate(_pack(text, chunk_seconds))]


def chunk_segments(segments, chunk_seconds):
    """segments: ordered [{role: 'avatar'|'body', id?, text}] covering the script end to end.
    Chunks EACH segment independently (hard break at every segment boundary) with global ids,
    tagging each chunk with its segment's role + id. So an avatar block = whole chunks."""
    out, i = [], 0
    for seg in segments:
        for c in _pack(seg["text"], chunk_seconds):
            out.append({"id": f"{i:04d}", "text": c,
                        "role": seg.get("role", "body"), "seg": seg.get("id")})
            i += 1
    return out
