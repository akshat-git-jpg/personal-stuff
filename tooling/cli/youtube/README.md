# pp-yt-transcript

Agent-native YouTube **transcript** CLI. Fetches a video's captions with no
API key, no MCP, and no Claude in the loop — built so bash crons and agents
can pull a transcript and pipe compact text into a single `claude -p`
call.

```bash
./pp-yt-transcript get "https://youtu.be/N9fRqffXdqQ"        # flowing text
./pp-yt-transcript get N9fRqffXdqQ --format srt > subs.srt    # timestamped
./pp-yt-transcript langs N9fRqffXdqQ                          # list tracks
```

## Why this exists (and why not the MCP / yt-dlp)

The `youtube` MCP's `get_video_transcript` uses **yt-dlp's caption extractor**,
which YouTube has effectively broken — it returns *"no captions available"*
even for videos that plainly have an (auto-generated) transcript in the web
player. This CLI uses **[`youtube-transcript-api`](https://pypi.org/project/youtube-transcript-api/)**
instead, which hits YouTube's `timedtext` endpoint — the same one the web
player loads — and succeeds where yt-dlp fails. yt-dlp is kept only as a
last-resort fallback.

## ⚠️ Run this from a residential IP (your Mac)

This is the single most important reliability fact:

> **YouTube blocks datacenter IPs** (Hostinger / AWS / GCP / Azure) for
> transcript fetches, no matter what config you use. There is **no free fix**
> for that — the paid one is rotating residential proxies (~$1–3/GB).

So this tool is designed to run on your **Mac** (a residential IP), where it
works perfectly. The local cache (below) softens repeat hits. If you ever
need the **VPS** to fetch transcripts, don't run it there directly — route
the VPS's egress through your home IP via a **Tailscale exit node** (free
personal tier) so the YouTube request exits from a residential address.

Sources: [yt-dlp datacenter-IP issue](https://github.com/yt-dlp/yt-dlp/issues/16082),
[youtube-transcript-api on cloud IPs](https://github.com/jdepoix/youtube-transcript-api),
[cloud-IP writeup](https://dev.to/osovsky/i-was-building-a-cloud-video-service-youtube-turned-me-into-an-ip-trafficker-1l9o).

## How it fetches (fallback chain)

1. **`youtube-transcript-api`** — preferred language, then sensible fallbacks
   (`en`, `en-US`, …). If the exact language isn't present it picks the best
   available track (manual over auto) and **translates** to the requested
   language when the track is translatable.
2. **`python3 -m yt_dlp`** subtitle download (VTT → stripped to text) — only
   if step 1 errors entirely. Yields **text only** (no per-line timestamps).
   Disable with `--no-fallback`.

No captions at *all* on a video → both paths fail with a clear error. (A
Whisper-from-audio tier was intentionally left out — see "Not included".)

## Staying unblocked (added 2026-07-06)

YouTube's 429s got worse through 2026: caption endpoints sit behind per-IP
rate limits plus proof-of-origin (PO token) checks, and even a residential
IP draws a temporary cooldown once unauthenticated volume looks bot-like.
Two defenses are built in:

1. **yt-dlp self-update.** The fallback path checks the installed yt-dlp
   version (date-shaped, e.g. `2026.07.04`) and runs `pip install -U yt-dlp`
   when it's over 30 days old. Stale yt-dlp loses the client-impersonation
   race with YouTube and draws blocks much faster. Update attempts are
   capped at one per day via a stamp file in the cache dir; failures are
   non-fatal.

2. **PO tokens via bgutil.** The `bgutil-ytdlp-pot-provider` pip plugin plus
   its node script mint proof-of-origin tokens for every yt-dlp call on this
   Mac, from any caller, no flags needed. The clone lives at
   `~/kb-scratch/bgutil-ytdlp-pot-provider`; `~/bgutil-ytdlp-pot-provider`
   symlinks to it because that's the plugin's default search path. Verify:

   ```bash
   python3 -m yt_dlp -v <url> --simulate 2>&1 | grep "pot:bgutil"
   # want: "Generating a gvs PO Token ... via bgutil script"
   ```

   Rebuild after pulling the clone (`npm ci && npx tsc` in `server/`), and
   update the pip plugin and the clone together so versions stay in step.

Still seeing 429s with both in place? That's an active IP cooldown: stop
retrying and wait a few hours, since hammering extends the ban. The next
escalation (not built) is Webshare rotating residential proxies, which
youtube-transcript-api supports natively at roughly $1/GB.

## Usage

### `get` — fetch a transcript

```bash
./pp-yt-transcript get URL|ID [--lang en] [--format text|json|srt|vtt] \
                              [--timestamps] [--no-cache] [--no-fallback]
```

| Flag | Default | Meaning |
|------|---------|---------|
| `--lang` | `en` | Preferred language code (BCP-47, e.g. `es`, `hi`, `en-GB`). |
| `--format` | `text` | `text` = one flowing block (best for LLM piping); `json` = structured snippets + metadata; `srt` / `vtt` = timestamped subtitle files. |
| `--timestamps` | off | With `--format text`, prefix each line with `[mm:ss]`. |
| `--no-cache` | off | Bypass the cache and don't write to it. |
| `--no-fallback` | off | Fail instead of trying the yt-dlp fallback. |

Accepts a bare 11-char ID or any URL shape (`youtu.be/…`, `watch?v=…`,
`/shorts/…`, `/embed/…`, `/live/…`; `?si=` / extra params are fine).

### `langs` — list available caption tracks

```bash
./pp-yt-transcript langs N9fRqffXdqQ
# en   auto   English (auto-generated) translatable
```

## Cache

Transcripts are cached as JSON at `~/.cache/pp-yt-transcript/<id>.<lang>.json`
(override the dir with `PP_YT_CACHE`). A cache hit returns in ~0.1s with no
network call — repeat fetches are instant and reduce YouTube hits. `--no-cache`
skips it both ways.

## Piping to Claude (the intended workflow)

```bash
./pp-yt-transcript get "$URL" | claude -p "Summarize this video transcript in 5 bullets."
```

## Install / deps

- **Mac:** `python3 -m pip install -U youtube-transcript-api` (already done).
  `yt-dlp` is optional — the fallback uses the `yt_dlp` module if importable.
- **VPS:** add `youtube-transcript-api` to `mcp/.venv` if you ever run it
  there — but read the residential-IP warning above first.

## Files

| File | Purpose |
|------|---------|
| `pp-yt-transcript` | Bash wrapper — resolves Python interpreter (matches `cli/gmail/`). |
| `pp_yt_transcript.py` | The CLI itself. |
| `README.md` | This file. |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Bad input (e.g. unparseable URL) / generic error |
| 2 | Fetch failed on all paths (no captions, blocked IP, video unavailable) |

## Not included (by design)

- **Whisper-from-audio transcription** for caption-less videos — heavier
  (CPU-bound) and needs residential egress for the audio download too. Scoped
  out for now; revisit if you hit enough caption-less videos to need it.
- **Video metadata** (title, channel) — that needs OAuth/the Data API; use the
  `youtube` MCP's `get_video` for that.
