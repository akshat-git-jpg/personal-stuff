---
name: youtube
description: Look up YouTube videos, channels, comments, subscriptions, and search via the pp-youtube CLI (no MCP needed). Use whenever a task involves YouTube video metadata/stats, channel info or uploads, video comments, or YouTube search. For transcript TEXT use pp-yt-transcript in the same folder. Triggers on "this youtube video", "video stats", "channel uploads", "youtube search", "video comments", "my subscriptions".
---

# YouTube via pp-youtube

All YouTube Data API work goes through the `pp-youtube` CLI — do NOT look for a youtube MCP server (it was removed to save context).

```
CLI:        "/Users/kbtg/codebase/personal stuff/tooling/cli/youtube/pp-youtube"
Transcripts: "/Users/kbtg/codebase/personal stuff/tooling/cli/youtube/pp-yt-transcript" VIDEO_ID_OR_URL [--lang en]
```

Most commands need `--account <full-email>` (token accounts: `pp-youtube accounts`). Video/channel args accept raw IDs, URLs, or @handles.

## Commands

```bash
pp-youtube video VIDEO --account EMAIL                 # metadata + stats (ID or URL)
pp-youtube channel CHANNEL --account EMAIL             # stats (ID, URL, or @handle)
pp-youtube channel-videos CHANNEL [--max 15] --account EMAIL
pp-youtube rss UC_CHANNEL_ID                           # ~15 recent uploads, NO auth, NO quota
pp-youtube search "query" [--type video|channel|playlist] [--max 10] --account EMAIL
pp-youtube comments VIDEO [--max 20] --account EMAIL
pp-youtube subscriptions [--max 50] --account EMAIL
pp-youtube captions VIDEO --account EMAIL              # track list only; text via pp-yt-transcript
```

## Notes

- `search` costs 100 quota units per call — prefer `rss` (free) for "latest uploads of channel X".
- Transcripts: run pp-yt-transcript from the Mac/residential IP — datacenter IPs are blocked by YouTube.
- Playlist mutations (create/add/remove) and rate_video were never used and are not in the CLI; if ever needed, the MCP code remains at `mcp/youtube-mcp-server/` for reference.
