"""pp-youtube — agent-native CLI for YouTube Data API reads.

Ports the used surface of mcp/youtube-mcp-server (get_video, get_channel,
list_channel_videos, comments, search, subscriptions, captions, RSS) so the
MCP can come out of .mcp.json. Transcripts stay in the sibling
pp-yt-transcript tool. Reuses mcp/google-shared/ OAuth.

Subcommands (all but rss/transcript take --account EMAIL):
  accounts                              list available token accounts
  search QUERY [--type video|channel|playlist] [--max N]
  video VIDEO                           full metadata (ID or URL accepted)
  channel CHANNEL                       stats + uploads playlist (ID, URL, or @handle)
  channel-videos CHANNEL [--max N]      recent uploads (API, any depth)
  rss CHANNEL_ID                        ~15 recent uploads, no OAuth, no quota
  comments VIDEO [--max N]
  subscriptions [--max N]               the account's subscriptions
  captions VIDEO                        list caption tracks (use pp-yt-transcript for text)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET

import requests
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from auth import get_credentials, list_accounts

_VIDEO_URL_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?[^ ]*v=|embed/|shorts/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)
_CHANNEL_URL_RE = re.compile(r"youtube\.com/channel/(UC[A-Za-z0-9_-]{22})")
_HANDLE_RE = re.compile(r"(?:youtube\.com/)?@([A-Za-z0-9_.-]+)")


def _service(account: str):
    return build("youtube", "v3", credentials=get_credentials(account))


def _video_id(value: str) -> str:
    m = _VIDEO_URL_RE.search(value.strip())
    return m.group(1) if m else value.strip()


def _dump(data: object) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


def _video_summary(item: dict) -> dict:
    snip, stats = item.get("snippet", {}) or {}, item.get("statistics", {}) or {}
    content = item.get("contentDetails", {}) or {}
    return {
        "id": item.get("id"),
        "title": snip.get("title"),
        "channelId": snip.get("channelId"),
        "channelTitle": snip.get("channelTitle"),
        "publishedAt": snip.get("publishedAt"),
        "description": snip.get("description"),
        "tags": snip.get("tags"),
        "duration": content.get("duration"),
        "viewCount": stats.get("viewCount"),
        "likeCount": stats.get("likeCount"),
        "commentCount": stats.get("commentCount"),
        "url": f"https://youtu.be/{item.get('id')}" if item.get("id") else None,
    }


def _channel_summary(item: dict) -> dict:
    snip, stats = item.get("snippet", {}) or {}, item.get("statistics", {}) or {}
    return {
        "id": item.get("id"),
        "title": snip.get("title"),
        "customUrl": snip.get("customUrl"),
        "description": snip.get("description"),
        "publishedAt": snip.get("publishedAt"),
        "subscriberCount": stats.get("subscriberCount"),
        "videoCount": stats.get("videoCount"),
        "viewCount": stats.get("viewCount"),
        "uploadsPlaylistId": (item.get("contentDetails", {}) or {})
        .get("relatedPlaylists", {}).get("uploads"),
        "url": f"https://www.youtube.com/channel/{item.get('id')}" if item.get("id") else None,
    }


def _resolve_channel(svc, value: str) -> dict:
    """Channel ID, URL, or @handle -> full channel resource."""
    s = value.strip()
    m = _CHANNEL_URL_RE.search(s)
    if m:
        cid = m.group(1)
    elif s.startswith("UC") and len(s) == 24:
        cid = s
    else:
        hm = _HANDLE_RE.search(s)
        if not hm:
            raise ValueError(f"Can't parse channel '{value}'. Pass a UC... id, URL, or @handle.")
        resp = svc.channels().list(
            part="snippet,statistics,contentDetails", forHandle=hm.group(1)
        ).execute()
        items = resp.get("items", [])
        if not items:
            raise ValueError(f"No channel found for handle '@{hm.group(1)}'.")
        return items[0]
    resp = svc.channels().list(part="snippet,statistics,contentDetails", id=cid).execute()
    items = resp.get("items", [])
    if not items:
        raise ValueError(f"No channel found for id '{cid}'.")
    return items[0]


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_accounts(args) -> str:
    return "\n".join(list_accounts()) or "(no token accounts found)"


def cmd_search(args) -> str:
    svc = _service(args.account)
    resp = svc.search().list(
        part="snippet", q=args.query, type=args.type, maxResults=args.max
    ).execute()
    rows = []
    for item in resp.get("items", []):
        snip = item.get("snippet", {})
        rid = item.get("id", {})
        rows.append({
            "type": args.type,
            "id": rid.get("videoId") or rid.get("channelId") or rid.get("playlistId"),
            "title": snip.get("title"),
            "channelTitle": snip.get("channelTitle"),
            "publishedAt": snip.get("publishedAt"),
            "description": snip.get("description"),
        })
    return _dump(rows)


def cmd_video(args) -> str:
    svc = _service(args.account)
    resp = svc.videos().list(
        part="snippet,statistics,contentDetails", id=_video_id(args.video)
    ).execute()
    items = resp.get("items", [])
    if not items:
        return f"No video found for '{args.video}'."
    return _dump(_video_summary(items[0]))


def cmd_channel(args) -> str:
    svc = _service(args.account)
    return _dump(_channel_summary(_resolve_channel(svc, args.channel)))


def cmd_channel_videos(args) -> str:
    svc = _service(args.account)
    uploads = _channel_summary(_resolve_channel(svc, args.channel))["uploadsPlaylistId"]
    if not uploads:
        return "Channel has no uploads playlist."
    resp = svc.playlistItems().list(
        part="snippet,contentDetails", playlistId=uploads, maxResults=args.max
    ).execute()
    rows = []
    for item in resp.get("items", []):
        c = item.get("contentDetails", {})
        rows.append({
            "videoId": c.get("videoId"),
            "title": (item.get("snippet", {}) or {}).get("title"),
            "publishedAt": c.get("videoPublishedAt"),
            "url": f"https://youtu.be/{c.get('videoId')}" if c.get("videoId") else None,
        })
    return _dump(rows)


def cmd_rss(args) -> str:
    resp = requests.get(
        "https://www.youtube.com/feeds/videos.xml?channel_id=" + args.channel_id.strip(),
        headers={"User-Agent": "Mozilla/5.0"}, timeout=15,
    )
    resp.raise_for_status()
    atom, yt, media = ("{http://www.w3.org/2005/Atom}",
                       "{http://www.youtube.com/xml/schemas/2015}",
                       "{http://search.yahoo.com/mrss/}")
    rows = []
    for entry in ET.fromstring(resp.content).findall(f"{atom}entry"):
        vid = entry.findtext(f"{yt}videoId") or ""
        views = None
        group = entry.find(f"{media}group")
        if group is not None:
            stats = group.find(f"{media}community/{media}statistics")
            if stats is not None:
                views = stats.get("views")
        rows.append({
            "videoId": vid,
            "title": entry.findtext(f"{atom}title") or "",
            "publishedAt": entry.findtext(f"{atom}published") or "",
            "viewCount": views,
            "url": f"https://youtu.be/{vid}" if vid else None,
        })
    return _dump(rows)


def cmd_comments(args) -> str:
    svc = _service(args.account)
    resp = svc.commentThreads().list(
        part="snippet", videoId=_video_id(args.video),
        order="relevance", maxResults=args.max, textFormat="plainText",
    ).execute()
    rows = []
    for item in resp.get("items", []):
        top = (item.get("snippet", {}).get("topLevelComment", {}) or {}).get("snippet", {}) or {}
        rows.append({
            "author": top.get("authorDisplayName"),
            "text": top.get("textDisplay"),
            "likeCount": top.get("likeCount"),
            "publishedAt": top.get("publishedAt"),
            "totalReplyCount": item.get("snippet", {}).get("totalReplyCount"),
        })
    return _dump(rows)


def cmd_subscriptions(args) -> str:
    svc = _service(args.account)
    resp = svc.subscriptions().list(
        part="snippet,contentDetails", mine=True, maxResults=args.max,
        order="alphabetical",
    ).execute()
    rows = []
    for item in resp.get("items", []):
        snip = item.get("snippet", {}) or {}
        rows.append({
            "channelId": (snip.get("resourceId") or {}).get("channelId"),
            "title": snip.get("title"),
            "newItemCount": (item.get("contentDetails") or {}).get("newItemCount"),
        })
    return _dump(rows)


def cmd_captions(args) -> str:
    svc = _service(args.account)
    resp = svc.captions().list(part="snippet", videoId=_video_id(args.video)).execute()
    rows = []
    for item in resp.get("items", []):
        snip = item.get("snippet", {}) or {}
        rows.append({
            "language": snip.get("language"),
            "name": snip.get("name"),
            "trackKind": snip.get("trackKind"),
            "lastUpdated": snip.get("lastUpdated"),
        })
    if not rows:
        return "No caption tracks. (For transcript text use pp-yt-transcript.)"
    return _dump(rows) + "\n(For transcript text use pp-yt-transcript.)"


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-youtube",
        description="Agent-native YouTube Data API CLI (shares mcp/google-shared OAuth).",
    )
    sub = p.add_subparsers(dest="command", required=True)

    def acct(sp):
        sp.add_argument("--account", required=True, help="Full email of the Google account.")

    a = sub.add_parser("accounts", help="List available token accounts.")
    a.set_defaults(func=cmd_accounts)

    s = sub.add_parser("search", help="Search YouTube.")
    acct(s)
    s.add_argument("query")
    s.add_argument("--type", choices=["video", "channel", "playlist"], default="video")
    s.add_argument("--max", type=int, default=10)
    s.set_defaults(func=cmd_search)

    v = sub.add_parser("video", help="Full metadata for a video (ID or URL).")
    acct(v)
    v.add_argument("video")
    v.set_defaults(func=cmd_video)

    c = sub.add_parser("channel", help="Channel stats (ID, URL, or @handle).")
    acct(c)
    c.add_argument("channel")
    c.set_defaults(func=cmd_channel)

    cv = sub.add_parser("channel-videos", help="Recent uploads of a channel (API).")
    acct(cv)
    cv.add_argument("channel")
    cv.add_argument("--max", type=int, default=15)
    cv.set_defaults(func=cmd_channel_videos)

    r = sub.add_parser("rss", help="Recent uploads via public RSS (no OAuth, no quota).")
    r.add_argument("channel_id", help="UC... channel id")
    r.set_defaults(func=cmd_rss)

    cm = sub.add_parser("comments", help="Top comments of a video.")
    acct(cm)
    cm.add_argument("video")
    cm.add_argument("--max", type=int, default=20)
    cm.set_defaults(func=cmd_comments)

    sb = sub.add_parser("subscriptions", help="The account's subscriptions.")
    acct(sb)
    sb.add_argument("--max", type=int, default=50)
    sb.set_defaults(func=cmd_subscriptions)

    cp = sub.add_parser("captions", help="List caption tracks of a video.")
    acct(cp)
    cp.add_argument("video")
    cp.set_defaults(func=cmd_captions)

    return p


def main() -> int:
    args = build_parser().parse_args()
    try:
        print(args.func(args))
        return 0
    except HttpError as e:
        print(f"YouTube API error: {e}", file=sys.stderr)
        return 1
    except (ValueError, requests.RequestException) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
