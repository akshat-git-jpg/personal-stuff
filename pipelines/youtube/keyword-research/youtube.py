"""YouTube helpers for keyword-research: handle resolution, RSS, videos.list."""

import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
import certifi  # noqa: E402
from googleapiclient.discovery import build  # noqa: E402

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(SCRIPT_DIR, "channel_cache.json")
RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id="
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())
ATOM_NS = "{http://www.w3.org/2005/Atom}"
YT_NS = "{http://www.youtube.com/xml/schemas/2015}"

_HANDLE_RE = re.compile(r"youtube\.com/(@[A-Za-z0-9._-]+)", re.IGNORECASE)


def build_yt_client(api_key):
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)


def load_cache():
    if not os.path.exists(CACHE_PATH):
        return {}
    with open(CACHE_PATH) as f:
        return json.load(f)


def save_cache(cache):
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2, sort_keys=True)


def handle_from_url(url):
    """https://www.youtube.com/@foo -> '@foo'. Returns None if no handle found."""
    if not url:
        return None
    m = _HANDLE_RE.search(url)
    return m.group(1) if m else None


def resolve_channel(yt_client, channel_url, cache):
    """Resolve a channel URL to (channel_id, channel_title). Mutates cache on miss.

    Returns (None, None) on failure.
    """
    handle = handle_from_url(channel_url)
    if not handle:
        return None, None

    cached = cache.get(handle)
    if cached:
        return cached["channel_id"], cached.get("channel_title")

    try:
        resp = yt_client.channels().list(forHandle=handle, part="snippet").execute()
    except Exception as e:
        print(f"  ERROR resolving {handle}: {e}", file=sys.stderr)
        return None, None

    items = resp.get("items", [])
    if not items:
        print(f"  WARN  {handle} not found via channels.list", file=sys.stderr)
        return None, None

    channel_id = items[0]["id"]
    channel_title = items[0].get("snippet", {}).get("title", "")
    cache[handle] = {"channel_id": channel_id, "channel_title": channel_title}
    return channel_id, channel_title


def fetch_recent_video_ids(channel_id, limit):
    """Fetch the last `limit` video IDs from the channel's RSS feed (newest first)."""
    url = RSS_BASE + channel_id
    try:
        with urllib.request.urlopen(url, timeout=15, context=_SSL_CTX) as resp:
            xml_bytes = resp.read()
    except urllib.error.HTTPError as e:
        print(f"  ERROR RSS {channel_id}: HTTP {e.code}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  ERROR RSS {channel_id}: {e}", file=sys.stderr)
        return []

    root = ET.fromstring(xml_bytes)
    ids = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        vid_el = entry.find(f"{YT_NS}videoId")
        if vid_el is not None and vid_el.text:
            ids.append(vid_el.text)
        if len(ids) >= limit:
            break
    return ids


def fetch_video_snippets(yt_client, video_ids):
    """videos.list batch (50 IDs/call). Returns dict: video_id -> snippet dict."""
    out = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        try:
            resp = yt_client.videos().list(id=",".join(chunk), part="snippet").execute()
        except Exception as e:
            print(f"  ERROR videos.list batch: {e}", file=sys.stderr)
            continue
        for item in resp.get("items", []):
            out[item["id"]] = item.get("snippet", {})
    return out
