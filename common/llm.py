"""LLM helpers for tool detection + YT description generation.

Reads prompt templates from common/prompts/.
Built on top of common.gemini.
"""

import os

from . import gemini

DEFAULT_MODEL = "gemini-2.5-flash"
PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(PACKAGE_DIR, "prompts")


def _load_prompt(filename: str) -> str:
    with open(os.path.join(PROMPTS_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()


def detect_tools(
    video_title: str,
    video_notes: str,
    candidate_tools: dict[str, str],
    model: str = DEFAULT_MODEL,
) -> list[dict]:
    """Identify ALL tools the creator promotes (affiliate or not).

    candidate_tools: {slug: display_name} — tools that have an affiliate program.

    Returns: list of dicts with keys:
      - slug (str): kebab-case slug
      - display_name (str): human name
      - homepage_url (str): "" for slugs in candidate_tools, else LLM's best guess

    Filters out empty-slug entries. Does NOT filter by candidate list — non-affiliate
    tools (slugs not in candidate_tools) are returned with their homepage_url.
    """
    candidates_block = "\n".join(
        f"- {slug} — {display}" for slug, display in candidate_tools.items()
    )
    prompt = _load_prompt("detect-tools.md").format(
        video_title=video_title,
        video_notes=video_notes,
        candidates_block=candidates_block,
    )
    schema = {
        "type": "object",
        "properties": {
            "tools": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "slug": {"type": "string"},
                        "display_name": {"type": "string"},
                        "homepage_url": {"type": "string"},
                    },
                    "required": ["slug", "display_name", "homepage_url"],
                },
            }
        },
    }
    parsed = gemini.generate_json(model=model, prompt=prompt, schema=schema)
    raw = parsed.get("tools", []) if isinstance(parsed, dict) else []
    out = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        slug = (entry.get("slug") or "").strip()
        if not slug:
            continue
        out.append({
            "slug": slug,
            "display_name": (entry.get("display_name") or slug).strip(),
            "homepage_url": (entry.get("homepage_url") or "").strip(),
        })
    return out


def generate_description(
    video_title: str,
    video_notes: str,
    link_specs: list[dict],
    model: str = DEFAULT_MODEL,
) -> str:
    """link_specs: list of {tool, short_url, coupon_code} dicts.
    Returns the polished YT description text."""
    lines = []
    for spec in link_specs:
        coupon = spec.get("coupon_code", "")
        coupon_part = f" (coupon: {coupon})" if coupon else ""
        lines.append(f"- {spec['tool']} → {spec['short_url']}{coupon_part}")
    links_block = "\n".join(lines)

    prompt = _load_prompt("generate-description.md").format(
        video_title=video_title,
        video_notes=video_notes,
        links_block=links_block,
    )
    return gemini.generate_text(model=model, prompt=prompt)
