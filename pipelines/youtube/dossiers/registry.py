"""Pure bookkeeping for the dossiers pipeline: per-video meta.json, the
extraction output-parse contract, and the merge sanity guard. No LLM calls,
no subprocess - fully unit-testable.
"""
import difflib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent            # pipelines/youtube/dossiers
VIDEOS_DIR = HERE / "videos"
TOOLS_DIR = HERE / "tools"

CITATION_RE = re.compile(r"\([A-Za-z0-9_-]{11} @")


# ---- per-video meta.json ----------------------------------------------

def meta_path(video_id):
    return VIDEOS_DIR / video_id / "meta.json"


def load_meta(video_id):
    return json.loads(meta_path(video_id).read_text())


def save_meta(video_id, data):
    meta_path(video_id).parent.mkdir(parents=True, exist_ok=True)
    meta_path(video_id).write_text(json.dumps(data, indent=2, sort_keys=True))


def all_video_ids():
    if not VIDEOS_DIR.exists():
        return []
    return sorted(p.parent.name for p in VIDEOS_DIR.glob("*/meta.json"))


def pending_extraction():
    """Video ids that are fetched but not yet extracted."""
    return [vid for vid in all_video_ids() if not load_meta(vid).get("extracted")]


def pending_merge_for_tool(tool_slug):
    """Video ids whose merged_into[tool_slug] is still false."""
    out = []
    for vid in all_video_ids():
        m = load_meta(vid)
        if m.get("extracted") and m.get("merged_into", {}).get(tool_slug) is False:
            out.append(vid)
    return out


def all_pending_tools():
    """Every tool slug with at least one video where merged_into[slug] is false."""
    tools = set()
    for vid in all_video_ids():
        m = load_meta(vid)
        for slug, done in m.get("merged_into", {}).items():
            if not done:
                tools.add(slug)
    return sorted(tools)


# ---- extraction output parse contract ----------------------------------

class ParseError(Exception):
    pass


def parse_extraction_output(raw_text):
    """Extract + validate the fenced ```json block an extraction call must
    return. Raises ParseError with a human-readable reason on any failure."""
    fence = re.search(r"```json\s*(.*?)\s*```", raw_text, re.DOTALL)
    if not fence:
        raise ParseError("no fenced ```json block found in output")
    try:
        data = json.loads(fence.group(1))
    except json.JSONDecodeError as e:
        raise ParseError(f"fenced block is not valid JSON: {e}")
    tools = data.get("tools")
    if not isinstance(tools, list) or not tools:
        raise ParseError("'tools' key missing or empty")
    for i, t in enumerate(tools):
        if not isinstance(t, dict) or not t.get("tool_name"):
            raise ParseError(f"tools[{i}] missing required 'tool_name'")
    return data


def parse_agy_envelope(raw_stdout):
    """Unwrap agy's --output-format json envelope, confirm status SUCCESS
    with a non-empty response (see plans/runs/LESSONS.md 2026-07-07: a
    quota-exhausted model request can return SUCCESS with an empty response),
    then run parse_extraction_output on the embedded response text."""
    try:
        envelope = json.loads(raw_stdout)
    except json.JSONDecodeError as e:
        raise ParseError(f"agy envelope is not valid JSON: {e}")
    if envelope.get("status") != "SUCCESS":
        raise ParseError(f"agy status was {envelope.get('status')!r}, not SUCCESS")
    response = envelope.get("response", "")
    if not response:
        raise ParseError("agy returned status SUCCESS but an empty response (0-token failure mode)")
    return parse_extraction_output(response)


# ---- merge sanity guard -------------------------------------------------

def merge_guard(old_dossier_text, new_dossier_text, batch_video_ids):
    """Four checks from the design spec. Returns (ok: bool, reason: str)."""
    if not new_dossier_text.startswith("# "):
        return False, "response doesn't start with '# '"
    if len(new_dossier_text) < len(old_dossier_text) / 2:
        return False, "response is under half the current dossier's length"
    old_citations = len(CITATION_RE.findall(old_dossier_text))
    new_citations = len(CITATION_RE.findall(new_dossier_text))
    if new_citations < old_citations:
        return False, f"citation count dropped ({old_citations} -> {new_citations})"
    missing = [vid for vid in batch_video_ids if vid not in new_dossier_text]
    if missing:
        return False, f"source video id(s) missing from output: {missing}"
    return True, ""


# ---- tool identity matching ---------------------------------------------

def normalize_name(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def load_tool(slug):
    return json.loads((TOOLS_DIR / slug / "tool.json").read_text())


def all_tool_slugs():
    if not TOOLS_DIR.exists():
        return []
    return sorted(p.parent.name for p in TOOLS_DIR.glob("*/tool.json"))


def match_tool(tool_name, aliases=None, near_threshold=0.82):
    """Match a discovered tool_name against existing tool folders.
    Returns ('exact', slug) | ('near', slug) | ('none', normalize_name(tool_name))."""
    aliases = aliases or []
    candidate_names = [tool_name] + list(aliases)
    candidate_slugs = {normalize_name(n) for n in candidate_names}
    for slug in all_tool_slugs():
        existing = load_tool(slug)
        existing_names = [existing.get("name", "")] + existing.get("aliases", [])
        existing_slugs = {normalize_name(n) for n in existing_names}
        if candidate_slugs & existing_slugs:
            return "exact", slug
    best_slug, best_ratio = None, 0.0
    for slug in all_tool_slugs():
        existing = load_tool(slug)
        existing_names = [existing.get("name", "")] + existing.get("aliases", [])
        for cn in candidate_names:
            for en in existing_names:
                ratio = difflib.SequenceMatcher(None, normalize_name(cn), normalize_name(en)).ratio()
                if ratio > best_ratio:
                    best_slug, best_ratio = slug, ratio
    if best_slug and best_ratio >= near_threshold:
        return "near", best_slug
    return "none", normalize_name(tool_name)
