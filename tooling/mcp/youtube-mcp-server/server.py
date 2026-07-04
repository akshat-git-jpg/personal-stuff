# STATUS: RETIRED — referenced by tooling/cli/youtube; NOT in .mcp.json
from __future__ import annotations
import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

BASE_DIR = Path(__file__).parent

app = Server("youtube")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("youtube", "v3", credentials=creds)


# Accept raw IDs or URLs. YouTube IDs are 11 chars for videos, 24 for channels
# (UC...), variable for playlists. We try the most common URL patterns.
_VIDEO_URL_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?[^ ]*v=|embed/|shorts/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)
_CHANNEL_URL_RE = re.compile(r"youtube\.com/channel/(UC[A-Za-z0-9_-]{22})")
_PLAYLIST_URL_RE = re.compile(r"[?&]list=([A-Za-z0-9_-]+)")
# /@handle or /c/name or /user/name → resolved via search since IDs can't be parsed
_HANDLE_RE = re.compile(r"youtube\.com/@([A-Za-z0-9_.-]+)")


def _extract_video_id(value: str) -> str:
    s = value.strip()
    m = _VIDEO_URL_RE.search(s)
    return m.group(1) if m else s


def _extract_channel_id(value: str) -> str:
    s = value.strip()
    m = _CHANNEL_URL_RE.search(s)
    return m.group(1) if m else s


def _extract_playlist_id(value: str) -> str:
    s = value.strip()
    m = _PLAYLIST_URL_RE.search(s)
    return m.group(1) if m else s


def _video_summary(item: dict) -> dict:
    snip = item.get("snippet", {}) or {}
    stats = item.get("statistics", {}) or {}
    content = item.get("contentDetails", {}) or {}
    return {
        "id": item.get("id"),
        "title": snip.get("title"),
        "channelId": snip.get("channelId"),
        "channelTitle": snip.get("channelTitle"),
        "publishedAt": snip.get("publishedAt"),
        "description": snip.get("description"),
        "tags": snip.get("tags"),
        "categoryId": snip.get("categoryId"),
        "duration": content.get("duration"),
        "viewCount": stats.get("viewCount"),
        "likeCount": stats.get("likeCount"),
        "commentCount": stats.get("commentCount"),
        "url": f"https://youtu.be/{item.get('id')}" if item.get("id") else None,
    }


def _channel_summary(item: dict) -> dict:
    snip = item.get("snippet", {}) or {}
    stats = item.get("statistics", {}) or {}
    return {
        "id": item.get("id"),
        "title": snip.get("title"),
        "customUrl": snip.get("customUrl"),
        "description": snip.get("description"),
        "publishedAt": snip.get("publishedAt"),
        "country": snip.get("country"),
        "subscriberCount": stats.get("subscriberCount"),
        "videoCount": stats.get("videoCount"),
        "viewCount": stats.get("viewCount"),
        "uploadsPlaylistId": (item.get("contentDetails", {}) or {})
        .get("relatedPlaylists", {})
        .get("uploads"),
        "url": f"https://www.youtube.com/channel/{item.get('id')}" if item.get("id") else None,
    }


def _playlist_summary(item: dict) -> dict:
    snip = item.get("snippet", {}) or {}
    content = item.get("contentDetails", {}) or {}
    return {
        "id": item.get("id"),
        "title": snip.get("title"),
        "channelId": snip.get("channelId"),
        "channelTitle": snip.get("channelTitle"),
        "publishedAt": snip.get("publishedAt"),
        "description": snip.get("description"),
        "itemCount": content.get("itemCount"),
        "url": f"https://www.youtube.com/playlist?list={item.get('id')}" if item.get("id") else None,
    }


def _playlist_item_summary(item: dict) -> dict:
    snip = item.get("snippet", {}) or {}
    content = item.get("contentDetails", {}) or {}
    return {
        "playlistItemId": item.get("id"),
        "videoId": content.get("videoId"),
        "title": snip.get("title"),
        "channelTitle": snip.get("videoOwnerChannelTitle") or snip.get("channelTitle"),
        "position": snip.get("position"),
        "publishedAt": content.get("videoPublishedAt"),
        "url": f"https://youtu.be/{content.get('videoId')}" if content.get("videoId") else None,
    }


def _comment_summary(item: dict) -> dict:
    top = item.get("snippet", {}) or {}
    top_comment = (top.get("topLevelComment", {}) or {}).get("snippet", {}) or {}
    return {
        "threadId": item.get("id"),
        "author": top_comment.get("authorDisplayName"),
        "authorChannelId": (top_comment.get("authorChannelId") or {}).get("value"),
        "text": top_comment.get("textDisplay"),
        "likeCount": top_comment.get("likeCount"),
        "publishedAt": top_comment.get("publishedAt"),
        "updatedAt": top_comment.get("updatedAt"),
        "totalReplyCount": top.get("totalReplyCount"),
    }


def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


# ---------------------------------------------------------------------------
# RSS + yt-dlp helpers (no OAuth needed for public videos/feeds)
# ---------------------------------------------------------------------------

_RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id="
_ATOM = "{http://www.w3.org/2005/Atom}"
_YT = "{http://www.youtube.com/xml/schemas/2015}"
_MEDIA = "{http://search.yahoo.com/mrss/}"

# Candidate paths to find yt-dlp on the user's machine.
_YTDLP_CANDIDATES = [
    "/Users/kbtg/Library/Python/3.11/bin/yt-dlp",
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
]


def _find_ytdlp() -> str:
    """Return absolute path to yt-dlp, or raise if not installed anywhere known."""
    found = shutil.which("yt-dlp")
    if found:
        return found
    for cand in _YTDLP_CANDIDATES:
        if Path(cand).is_file():
            return cand
    raise RuntimeError(
        "yt-dlp not found. Install with: pip3 install --user yt-dlp"
    )


def _fetch_channel_rss(channel_id: str) -> list[dict]:
    """Return up to ~15 most-recent uploads from a channel's RSS feed (public, no quota)."""
    resp = requests.get(
        _RSS_BASE + channel_id,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=15,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    entries = []
    for entry in root.findall(f"{_ATOM}entry"):
        vid = entry.findtext(f"{_YT}videoId") or ""
        group = entry.find(f"{_MEDIA}group")
        views = None
        if group is not None:
            stats = group.find(f"{_MEDIA}community/{_MEDIA}statistics")
            if stats is not None:
                views = stats.get("views")
        entries.append({
            "videoId": vid,
            "title": entry.findtext(f"{_ATOM}title") or "",
            "publishedAt": entry.findtext(f"{_ATOM}published") or "",
            "updatedAt": entry.findtext(f"{_ATOM}updated") or "",
            "author": entry.findtext(f"{_ATOM}author/{_ATOM}name") or "",
            "channelId": channel_id,
            "url": f"https://youtu.be/{vid}" if vid else None,
            "viewCount": views,
        })
    return entries


def _parse_json3(json3_text: str) -> str:
    """Parse yt-dlp's json3 caption format into clean text."""
    data = json.loads(json3_text)
    out: list[str] = []
    last = None
    for event in data.get("events", []):
        segs = event.get("segs") or []
        line = "".join(s.get("utf8", "") for s in segs).strip()
        if not line or line == last:
            continue
        out.append(line)
        last = line
    return "\n".join(out)


_VTT_TIMESTAMP_RE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3} --> ")
_VTT_TAG_RE = re.compile(r"</?[^>]+>")


def _parse_vtt(vtt_text: str) -> str:
    """Parse WebVTT into clean text (yt-dlp falls back to this when json3 is blocked)."""
    out: list[str] = []
    last = None
    for raw in vtt_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if (
            line.startswith("WEBVTT")
            or line.startswith("Kind:")
            or line.startswith("Language:")
            or line.startswith("NOTE")
            or "-->" in line
            or line.isdigit()
        ):
            continue
        clean = _VTT_TAG_RE.sub("", line).strip()
        if not clean or clean == last:
            continue
        out.append(clean)
        last = clean
    return "\n".join(out)


def _lang_priority(want: str) -> list[str]:
    """Build a sensible language fallback list around the requested code."""
    want = want.lower()
    base = want.split("-")[0]
    order = [want]
    for c in (base, f"{base}-US", f"{base}-GB", "en", "en-US", "en-GB"):
        if c not in order:
            order.append(c)
    return order


def _fetch_transcript(video_id: str, lang: str) -> tuple[str, str]:
    """Return (clean_text, used_lang) for a video's captions.

    Primary path is youtube-transcript-api, which hits YouTube's timedtext
    endpoint (the one the web player uses) and succeeds from a residential IP
    where yt-dlp's caption extractor currently returns "no captions". Falls
    back to the yt-dlp path (_fetch_transcript_ytdlp) only if the primary
    errors. Mirrors cli/youtube/pp-yt-transcript.

    NOTE: run from a residential IP — YouTube blocks datacenter IPs for
    transcript fetches with no free workaround.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        api = YouTubeTranscriptApi()
        langs = _lang_priority(lang)
        try:
            fetched = api.fetch(video_id, languages=langs)
        except Exception:
            # exact language absent → pick best available track (manual over
            # auto), translating to the requested language when possible.
            transcripts = list(api.list(video_id))
            if not transcripts:
                raise
            transcripts.sort(key=lambda t: t.is_generated)
            base = transcripts[0]
            target = lang.split("-")[0]
            if base.language_code.split("-")[0] != target and base.is_translatable:
                try:
                    fetched = base.translate(target).fetch()
                except Exception:
                    fetched = base.fetch()
            else:
                fetched = base.fetch()
        text = "\n".join(s.text.strip() for s in fetched if s.text.strip())
        if not text:
            raise RuntimeError("empty transcript")
        return text, getattr(fetched, "language_code", lang)
    except Exception as primary_err:
        try:
            return _fetch_transcript_ytdlp(video_id, lang)
        except Exception as fb_err:
            raise RuntimeError(
                f"No captions available for {video_id} in lang '{lang}'. "
                f"primary (youtube-transcript-api): {primary_err}; "
                f"yt-dlp fallback: {fb_err}"
            )


def _fetch_transcript_ytdlp(video_id: str, lang: str) -> tuple[str, str]:
    """Download a video's caption track via yt-dlp and return (clean_text, used_lang).

    Fallback path only (see _fetch_transcript). Uses the same anti-429 flags as
    TY's yt-research/fetch-transcripts.ts: Chrome impersonation, browser
    cookies, retries, and json3 format.
    """
    ytdlp = _find_ytdlp()
    with tempfile.TemporaryDirectory() as tmpdir:
        url = f"https://www.youtube.com/watch?v={video_id}"
        cmd = [
            ytdlp,
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-lang", lang,
            "--sub-format", "json3",
            # Skip format probing — we only want subtitles, so failures in
            # YouTube's video-format extraction (nsig JS challenge, PO Token,
            # etc.) shouldn't kill the subtitle fetch.
            "--no-check-formats",
            "--ignore-no-formats-error",
            "--extractor-args", "youtube:player_client=web_safari",
            "--retries", "10",
            "--retry-sleep", "linear=1:10",
            "--socket-timeout", "60",
            "--sleep-requests", "1",
            "--sleep-subtitles", "1",
            "-o", f"{tmpdir}/%(id)s.%(ext)s",
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode != 0:
            raise RuntimeError(f"yt-dlp failed: {result.stderr.strip()[-500:]}")
        # yt-dlp prefers json3 but falls back to vtt when YouTube blocks json3
        # (PO Token requirement). Accept whichever landed.
        files = sorted(
            list(Path(tmpdir).glob(f"{video_id}*.json3"))
            + list(Path(tmpdir).glob(f"{video_id}*.vtt"))
        )
        if not files:
            raise RuntimeError(
                f"No captions available for {video_id} in lang '{lang}'. "
                "Try a different lang code (e.g. 'en', 'es')."
            )
        preferred = next((p for p in files if f".{lang}." in p.name), files[0])
        used_lang_match = re.search(
            r"\.([a-z]{2,3}(?:-[A-Za-z]+)?(?:-orig)?)\.(?:json3|vtt)$", preferred.name
        )
        used_lang = used_lang_match.group(1) if used_lang_match else "unknown"
        body = preferred.read_text(encoding="utf-8")
        parsed = _parse_json3(body) if preferred.suffix == ".json3" else _parse_vtt(body)
        return parsed, used_lang


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

_ACCT = {
    "type": "string",
    "description": "Full email address of the Google account to act as. Required.",
}
_VIDEO = {"type": "string", "description": "Video ID or YouTube URL"}
_CHANNEL = {"type": "string", "description": "Channel ID (UC...) or channel URL"}
_PLAYLIST = {"type": "string", "description": "Playlist ID or URL containing ?list="}


def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {"account": _ACCT, **props},
        "required": ["account", *required],
    }


def _public_schema(props: dict, required: list[str]) -> dict:
    """Schema for tools that need no OAuth (RSS / yt-dlp use public endpoints)."""
    return {
        "type": "object",
        "properties": props,
        "required": required,
    }


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search",
            description=(
                "Searches YouTube. 'kind' filters by type: video (default), channel, "
                "or playlist. Sort 'order' options: relevance (default), date, "
                "viewCount, rating, title. Use 'channel_id' to scope to a channel."
            ),
            inputSchema=_schema(
                {
                    "query": {"type": "string", "description": "Search query"},
                    "kind": {
                        "type": "string",
                        "enum": ["video", "channel", "playlist"],
                        "default": "video",
                    },
                    "max_results": {"type": "integer", "default": 10},
                    "order": {
                        "type": "string",
                        "enum": ["relevance", "date", "viewCount", "rating", "title"],
                        "default": "relevance",
                    },
                    "channel_id": {
                        "type": "string",
                        "description": "Optional channel ID/URL to scope results to",
                    },
                    "published_after": {
                        "type": "string",
                        "description": "RFC 3339 timestamp, e.g. 2026-01-01T00:00:00Z",
                    },
                },
                ["query"],
            ),
        ),
        types.Tool(
            name="get_video",
            description="Returns full details + statistics for one or more videos (comma-separated IDs/URLs ok).",
            inputSchema=_schema(
                {"video": {"type": "string", "description": "Video ID/URL, or comma-separated list (max 50)"}},
                ["video"],
            ),
        ),
        types.Tool(
            name="get_channel",
            description=(
                "Returns details + statistics for a channel. Pass 'channel' (ID/URL), "
                "'handle' (without @), or 'mine: true' to fetch the authenticated user's channel."
            ),
            inputSchema=_schema(
                {
                    "channel": {"type": "string", "description": "Channel ID or URL"},
                    "handle": {"type": "string", "description": "Channel handle without @"},
                    "mine": {"type": "boolean", "description": "Get the authenticated user's channel"},
                },
                [],
            ),
        ),
        types.Tool(
            name="list_channel_videos",
            description=(
                "Lists a channel's uploaded videos (newest first). Resolves channel via "
                "'channel' (ID/URL), 'handle', or 'mine: true'."
            ),
            inputSchema=_schema(
                {
                    "channel": {"type": "string"},
                    "handle": {"type": "string"},
                    "mine": {"type": "boolean"},
                    "max_results": {"type": "integer", "default": 25},
                },
                [],
            ),
        ),
        types.Tool(
            name="get_video_comments",
            description=(
                "Lists top-level comment threads on a video. Set 'include_replies: true' "
                "to also fetch reply text inline."
            ),
            inputSchema=_schema(
                {
                    "video": _VIDEO,
                    "max_results": {"type": "integer", "default": 25},
                    "order": {
                        "type": "string",
                        "enum": ["time", "relevance"],
                        "default": "relevance",
                    },
                    "include_replies": {"type": "boolean", "default": False},
                },
                ["video"],
            ),
        ),
        types.Tool(
            name="list_playlists",
            description=(
                "Lists playlists on a channel. Use 'channel' (ID/URL) or 'mine: true' "
                "for the authenticated user's playlists."
            ),
            inputSchema=_schema(
                {
                    "channel": {"type": "string"},
                    "mine": {"type": "boolean"},
                    "max_results": {"type": "integer", "default": 25},
                },
                [],
            ),
        ),
        types.Tool(
            name="get_playlist_items",
            description="Lists videos in a playlist (in playlist order).",
            inputSchema=_schema(
                {
                    "playlist": _PLAYLIST,
                    "max_results": {"type": "integer", "default": 50},
                },
                ["playlist"],
            ),
        ),
        types.Tool(
            name="create_playlist",
            description="Creates a new playlist on the authenticated user's channel.",
            inputSchema=_schema(
                {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "privacy": {
                        "type": "string",
                        "enum": ["private", "unlisted", "public"],
                        "default": "private",
                    },
                },
                ["title"],
            ),
        ),
        types.Tool(
            name="add_to_playlist",
            description="Adds a video to a playlist owned by the authenticated user.",
            inputSchema=_schema(
                {"playlist": _PLAYLIST, "video": _VIDEO},
                ["playlist", "video"],
            ),
        ),
        types.Tool(
            name="remove_from_playlist",
            description="Removes a single playlist item by its playlistItemId (NOT the video id).",
            inputSchema=_schema(
                {
                    "playlist_item_id": {
                        "type": "string",
                        "description": "The playlistItemId returned by get_playlist_items",
                    }
                },
                ["playlist_item_id"],
            ),
        ),
        types.Tool(
            name="list_subscriptions",
            description="Lists channels the authenticated user subscribes to.",
            inputSchema=_schema(
                {
                    "max_results": {"type": "integer", "default": 50},
                    "order": {
                        "type": "string",
                        "enum": ["relevance", "unread", "alphabetical"],
                        "default": "relevance",
                    },
                },
                [],
            ),
        ),
        types.Tool(
            name="list_liked_videos",
            description="Lists videos the authenticated user has liked (newest first).",
            inputSchema=_schema(
                {"max_results": {"type": "integer", "default": 25}},
                [],
            ),
        ),
        types.Tool(
            name="rate_video",
            description="Sets the authenticated user's rating on a video.",
            inputSchema=_schema(
                {
                    "video": _VIDEO,
                    "rating": {
                        "type": "string",
                        "enum": ["like", "dislike", "none"],
                    },
                },
                ["video", "rating"],
            ),
        ),
        types.Tool(
            name="get_captions",
            description=(
                "Lists available caption tracks for a video. Note: the YouTube Data "
                "API only allows downloading the caption body for videos you own."
            ),
            inputSchema=_schema({"video": _VIDEO}, ["video"]),
        ),
        types.Tool(
            name="get_channel_uploads_via_rss",
            description=(
                "Lists the ~15 most recent uploads from a channel via its public RSS feed. "
                "Free — no API quota consumed. Use this for cheap monitoring loops "
                "(competitor research, 'what dropped in the last week') instead of search()."
            ),
            inputSchema=_public_schema(
                {"channel_id": {"type": "string", "description": "Channel ID (UC...) or channel URL"}},
                ["channel_id"],
            ),
        ),
        types.Tool(
            name="get_video_transcript",
            description=(
                "Returns a video's transcript as cleaned text. Uses youtube-transcript-api "
                "(the timedtext endpoint the web player uses), falling back to yt-dlp. Gets "
                "manual or auto-generated captions and translates to the requested language "
                "when needed. No OAuth needed — works for any public video. Run from a "
                "residential IP; datacenter IPs are blocked by YouTube."
            ),
            inputSchema=_public_schema(
                {
                    "video": {"type": "string", "description": "Video ID or YouTube URL"},
                    "lang": {
                        "type": "string",
                        "description": "Preferred caption language code (default 'en'). Falls back across variants if missing.",
                        "default": "en",
                    },
                },
                ["video"],
            ),
        ),
        types.Tool(
            name="list_accounts",
            description="Lists Google accounts that already have a token in google-shared/tokens/.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

def _resolve_channel_id(service, *, channel: str | None, handle: str | None, mine: bool | None) -> str:
    """Map a 'channel'/'handle'/'mine' arg trio to a channel ID."""
    if mine:
        resp = service.channels().list(part="id", mine=True).execute()
        items = resp.get("items", [])
        if not items:
            raise ValueError("No channel found for the authenticated user.")
        return items[0]["id"]
    if channel:
        return _extract_channel_id(channel)
    if handle:
        resp = service.channels().list(part="id", forHandle=handle.lstrip("@")).execute()
        items = resp.get("items", [])
        if not items:
            raise ValueError(f"No channel found for handle @{handle.lstrip('@')}.")
        return items[0]["id"]
    raise ValueError("Provide one of: channel, handle, or mine=true.")


def _handle(name: str, args: dict) -> list[types.TextContent]:
    if name == "list_accounts":
        from auth import list_accounts
        accounts = list_accounts()
        return _text(json.dumps(accounts, indent=2) if accounts else "No accounts have tokens yet.")

    # Public tools (no OAuth required) — handled before the account guard.
    if name == "get_channel_uploads_via_rss":
        channel_id = _extract_channel_id(args["channel_id"])
        entries = _fetch_channel_rss(channel_id)
        return _text(f"{len(entries)} recent upload(s) for {channel_id}\n"
                     + json.dumps(entries, indent=2, ensure_ascii=False))

    if name == "get_video_transcript":
        video_id = _extract_video_id(args["video"])
        lang = args.get("lang", "en")
        text, used_lang = _fetch_transcript(video_id, lang)
        return _text(f"Transcript for {video_id} (lang={used_lang}, {len(text)} chars)\n---\n{text}")

    account = args.get("account")
    if not account:
        return _text("Error: 'account' is required (full email of the Google account to use).")
    service = get_service(account)

    if name == "search":
        params = dict(
            part="snippet",
            q=args["query"],
            type=args.get("kind", "video"),
            maxResults=int(args.get("max_results", 10)),
            order=args.get("order", "relevance"),
        )
        if args.get("channel_id"):
            params["channelId"] = _extract_channel_id(args["channel_id"])
        if args.get("published_after"):
            params["publishedAfter"] = args["published_after"]
        resp = service.search().list(**params).execute()
        results = []
        for it in resp.get("items", []):
            snip = it.get("snippet", {}) or {}
            kind_id = it.get("id", {}) or {}
            kind = kind_id.get("kind", "").replace("youtube#", "")
            results.append({
                "kind": kind,
                "id": kind_id.get(f"{kind}Id"),
                "title": snip.get("title"),
                "channelTitle": snip.get("channelTitle"),
                "channelId": snip.get("channelId"),
                "publishedAt": snip.get("publishedAt"),
                "description": snip.get("description"),
            })
        return _text(f"{len(results)} result(s)\n" + json.dumps(results, indent=2, ensure_ascii=False))

    if name == "get_video":
        raw = args["video"]
        ids = ",".join(_extract_video_id(v) for v in raw.split(",") if v.strip())
        resp = service.videos().list(
            part="snippet,statistics,contentDetails",
            id=ids,
        ).execute()
        items = [_video_summary(it) for it in resp.get("items", [])]
        if len(items) == 1:
            return _text(json.dumps(items[0], indent=2, ensure_ascii=False))
        return _text(f"{len(items)} video(s)\n" + json.dumps(items, indent=2, ensure_ascii=False))

    if name == "get_channel":
        params = dict(part="snippet,statistics,contentDetails")
        if args.get("mine"):
            params["mine"] = True
        elif args.get("handle"):
            params["forHandle"] = args["handle"].lstrip("@")
        elif args.get("channel"):
            params["id"] = _extract_channel_id(args["channel"])
        else:
            return _text("Error: pass one of: channel, handle, or mine=true.")
        resp = service.channels().list(**params).execute()
        items = [_channel_summary(it) for it in resp.get("items", [])]
        if not items:
            return _text("No channel found.")
        if len(items) == 1:
            return _text(json.dumps(items[0], indent=2, ensure_ascii=False))
        return _text(json.dumps(items, indent=2, ensure_ascii=False))

    if name == "list_channel_videos":
        channel_id = _resolve_channel_id(
            service,
            channel=args.get("channel"),
            handle=args.get("handle"),
            mine=args.get("mine"),
        )
        ch_resp = service.channels().list(part="contentDetails", id=channel_id).execute()
        ch_items = ch_resp.get("items", [])
        if not ch_items:
            return _text(f"No channel found for id {channel_id}.")
        uploads = ch_items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
        max_n = int(args.get("max_results", 25))
        videos: list[dict] = []
        page_token = None
        while len(videos) < max_n:
            page_size = min(50, max_n - len(videos))
            resp = service.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=uploads,
                maxResults=page_size,
                pageToken=page_token,
            ).execute()
            videos.extend(_playlist_item_summary(it) for it in resp.get("items", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return _text(f"{len(videos)} video(s) from channel {channel_id}\n"
                     + json.dumps(videos, indent=2, ensure_ascii=False))

    if name == "get_video_comments":
        video_id = _extract_video_id(args["video"])
        max_n = int(args.get("max_results", 25))
        include_replies = bool(args.get("include_replies", False))
        part = "snippet,replies" if include_replies else "snippet"
        threads: list[dict] = []
        page_token = None
        while len(threads) < max_n:
            page_size = min(100, max_n - len(threads))
            resp = service.commentThreads().list(
                part=part,
                videoId=video_id,
                maxResults=page_size,
                order=args.get("order", "relevance"),
                pageToken=page_token,
                textFormat="plainText",
            ).execute()
            for it in resp.get("items", []):
                row = _comment_summary(it)
                if include_replies:
                    replies = (it.get("replies", {}) or {}).get("comments", []) or []
                    row["replies"] = [
                        {
                            "author": (r.get("snippet", {}) or {}).get("authorDisplayName"),
                            "text": (r.get("snippet", {}) or {}).get("textDisplay"),
                            "likeCount": (r.get("snippet", {}) or {}).get("likeCount"),
                            "publishedAt": (r.get("snippet", {}) or {}).get("publishedAt"),
                        }
                        for r in replies
                    ]
                threads.append(row)
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return _text(f"{len(threads)} thread(s) on video {video_id}\n"
                     + json.dumps(threads, indent=2, ensure_ascii=False))

    if name == "list_playlists":
        params = dict(part="snippet,contentDetails", maxResults=int(args.get("max_results", 25)))
        if args.get("mine"):
            params["mine"] = True
        elif args.get("channel"):
            params["channelId"] = _extract_channel_id(args["channel"])
        else:
            return _text("Error: pass one of: channel or mine=true.")
        resp = service.playlists().list(**params).execute()
        items = [_playlist_summary(it) for it in resp.get("items", [])]
        return _text(f"{len(items)} playlist(s)\n" + json.dumps(items, indent=2, ensure_ascii=False))

    if name == "get_playlist_items":
        playlist_id = _extract_playlist_id(args["playlist"])
        max_n = int(args.get("max_results", 50))
        items: list[dict] = []
        page_token = None
        while len(items) < max_n:
            page_size = min(50, max_n - len(items))
            resp = service.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=playlist_id,
                maxResults=page_size,
                pageToken=page_token,
            ).execute()
            items.extend(_playlist_item_summary(it) for it in resp.get("items", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return _text(f"{len(items)} item(s) in playlist {playlist_id}\n"
                     + json.dumps(items, indent=2, ensure_ascii=False))

    if name == "create_playlist":
        body = {
            "snippet": {"title": args["title"]},
            "status": {"privacyStatus": args.get("privacy", "private")},
        }
        if args.get("description"):
            body["snippet"]["description"] = args["description"]
        resp = service.playlists().insert(part="snippet,status", body=body).execute()
        return _text(f"Created playlist.\n"
                     + json.dumps(_playlist_summary(resp), indent=2, ensure_ascii=False))

    if name == "add_to_playlist":
        playlist_id = _extract_playlist_id(args["playlist"])
        video_id = _extract_video_id(args["video"])
        body = {
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {"kind": "youtube#video", "videoId": video_id},
            }
        }
        resp = service.playlistItems().insert(part="snippet", body=body).execute()
        return _text(f"Added video {video_id} to playlist {playlist_id}.\n"
                     + json.dumps(_playlist_item_summary(resp), indent=2, ensure_ascii=False))

    if name == "remove_from_playlist":
        item_id = args["playlist_item_id"]
        service.playlistItems().delete(id=item_id).execute()
        return _text(f"Removed playlist item {item_id}.")

    if name == "list_subscriptions":
        max_n = int(args.get("max_results", 50))
        subs: list[dict] = []
        page_token = None
        while len(subs) < max_n:
            page_size = min(50, max_n - len(subs))
            resp = service.subscriptions().list(
                part="snippet,contentDetails",
                mine=True,
                maxResults=page_size,
                order=args.get("order", "relevance"),
                pageToken=page_token,
            ).execute()
            for it in resp.get("items", []):
                snip = it.get("snippet", {}) or {}
                subs.append({
                    "subscriptionId": it.get("id"),
                    "channelId": (snip.get("resourceId") or {}).get("channelId"),
                    "title": snip.get("title"),
                    "description": snip.get("description"),
                    "publishedAt": snip.get("publishedAt"),
                    "newItemCount": (it.get("contentDetails") or {}).get("newItemCount"),
                    "totalItemCount": (it.get("contentDetails") or {}).get("totalItemCount"),
                })
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return _text(f"{len(subs)} subscription(s)\n" + json.dumps(subs, indent=2, ensure_ascii=False))

    if name == "list_liked_videos":
        # The "LL" playlist is the authenticated user's liked videos.
        max_n = int(args.get("max_results", 25))
        ch = service.channels().list(part="contentDetails", mine=True).execute()
        items = ch.get("items", [])
        if not items:
            return _text("No channel found for the authenticated user.")
        likes_playlist = items[0]["contentDetails"]["relatedPlaylists"].get("likes")
        if not likes_playlist:
            return _text("This account has no 'likes' playlist exposed (often privacy-hidden).")
        videos: list[dict] = []
        page_token = None
        while len(videos) < max_n:
            page_size = min(50, max_n - len(videos))
            resp = service.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=likes_playlist,
                maxResults=page_size,
                pageToken=page_token,
            ).execute()
            videos.extend(_playlist_item_summary(it) for it in resp.get("items", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return _text(f"{len(videos)} liked video(s)\n" + json.dumps(videos, indent=2, ensure_ascii=False))

    if name == "rate_video":
        video_id = _extract_video_id(args["video"])
        rating = args["rating"]
        service.videos().rate(id=video_id, rating=rating).execute()
        return _text(f"Set rating '{rating}' on video {video_id}.")

    if name == "get_captions":
        video_id = _extract_video_id(args["video"])
        resp = service.captions().list(part="snippet", videoId=video_id).execute()
        tracks = []
        for it in resp.get("items", []):
            snip = it.get("snippet", {}) or {}
            tracks.append({
                "id": it.get("id"),
                "language": snip.get("language"),
                "name": snip.get("name"),
                "trackKind": snip.get("trackKind"),
                "isAutoSynced": snip.get("isAutoSynced"),
                "isCC": snip.get("isCC"),
                "isDraft": snip.get("isDraft"),
                "lastUpdated": snip.get("lastUpdated"),
            })
        return _text(f"{len(tracks)} caption track(s) on video {video_id}\n"
                     + json.dumps(tracks, indent=2, ensure_ascii=False))

    return _text(f"Unknown tool: {name}")


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        return _handle(name, arguments)
    except HttpError as e:
        return _text(f"YouTube API error: {e}")
    except ValueError as e:
        return _text(f"Error: {e}")
    except Exception as e:  # noqa: BLE001 — surface, never crash the tool call
        return _text(f"Unexpected error: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="youtube",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
