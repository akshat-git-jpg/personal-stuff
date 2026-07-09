# Avatar mapping for tutorial-pipeline-1.
# The HeyGen ids now live in the shared registry (single source of truth):
#   tooling/cli/heygen-web/avatars.json   (slug -> {avatar_id?/template_id?/description})
# This file only maps the Drive folder suffix (" @ g1" / " @ g2") to a registry SLUG and
# resolves its template_id from that shared file, so an id is defined in exactly one place.
# To add a new type: add the slug+id to avatars.json, then map the suffix here.
import json
import pathlib

# Drive folder suffix -> slug in avatars.json
SLUGS = {"g1": "girl-1", "g2": "girl-2"}

_REGISTRY = pathlib.Path(__file__).resolve().parents[4] / "tooling/cli/heygen-web/avatars.json"


def _load_registry():
    try:
        return json.loads(_REGISTRY.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _build_types():
    reg = _load_registry()
    out = {}
    for suffix, slug in SLUGS.items():
        tid = reg.get(slug, {}).get("template_id")
        if tid:
            out[suffix] = {"template_id": tid, "slug": slug}
    return out


# Same interface as before: TYPES[vtype]["template_id"].
TYPES = _build_types()
