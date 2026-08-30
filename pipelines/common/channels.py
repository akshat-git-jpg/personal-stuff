"""channels.py - read config/channels.json from the Python pipelines.

Deliberately standalone: stdlib only, and importable by path so its test runs on a
bare python3 with no venv. Importing `common.channels` as a package still works, but
that path drags in common/__init__.py's dotenv side effect.

The registry is documented in plans/261 and config/README.md.
"""

import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
REGISTRY_PATH = os.path.join(REPO_ROOT, "config", "channels.json")


def load_registry(path=REGISTRY_PATH):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def all_channels(reg=None):
    reg = reg if reg is not None else load_registry()
    return list(reg["channels"])


def list_channels(reg=None):
    return [c for c in all_channels(reg) if not c.get("archived")]


def get_channel(channel_id, reg=None):
    for c in all_channels(reg):
        if c["id"] == channel_id:
            return c
    raise KeyError("CHANNEL_UNKNOWN: no channel with id %r" % (channel_id,))


def default_channel(reg=None):
    reg = reg if reg is not None else load_registry()
    return get_channel(reg["default_channel_id"], reg)
