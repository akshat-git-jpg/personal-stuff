# Plan 012: Competitor style packs — folder scaffold + zero-API transcript ingestion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3363123..HEAD -- pipelines/youtube/competitor-styles/ pipelines/CLAUDE.md pipelines/youtube/CLAUDE.md decisions.md`
> (expect: no output, or only `pipelines/youtube/CLAUDE.md` — these paths must not have drifted)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `3363123`, 2026-07-05

## Why this matters

The owner makes YouTube videos and wants Claude to write scripts, titles, and
topic suggestions in the exact style of chosen competitor channels. The chosen
architecture (brainstormed and approved 2026-07-05) is **distill-once,
generate-many**: each competitor gets a self-contained "style pack" folder —
raw transcripts ingested once, then (in Plan 013) distilled into a compact
Style DNA profile that later generation runs load instead of the raw corpus.
This plan builds the foundation: the folder convention and a zero-API-key
ingestion tool. Constraints that shaped it: no paid LLM API (all Claude work
happens in Claude Code on subscription), no YouTube Data API (yt-dlp +
auto-subtitles only), everything user-triggered, must scale from 1 channel to
~10 by pure repetition. Fine-tuning and RAG were evaluated and rejected
(too little per-channel data for a fine-tune; style is a global property, not
chunk-retrievable — RAG is only a future option for topic research if a corpus
outgrows context).

## Current state

- `pipelines/youtube/` holds one folder per YouTube use case, each with a
  `CLAUDE.md`, indexed in a table in `pipelines/youtube/CLAUDE.md` and in the
  folder map of `pipelines/CLAUDE.md`. `pipelines/youtube/competitor-styles/`
  **does not exist yet** — this plan creates it.
- The `pipelines/youtube/CLAUDE.md` subfolder table currently ends with this
  row (add the new row after it):

  ```
  | [`my-yt/`](my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
  ```

- The `pipelines/CLAUDE.md` folder map lists youtube subfolders as indented
  rows; the last youtube row is:

  ```
  | &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/kushal-tutorial-pipeline-v2/`](youtube/kushal-tutorial-pipeline-v2/PIPELINE.md) | Tutorial recording prep steps | Python + Claude steps |
  ```

- Python convention in `pipelines/`: scripts that import `common.*` need the
  shared venv and a `sys.path` prelude. **This tool deliberately uses neither**
  — it is stdlib-only and shells out to the system `yt-dlp` binary, so it runs
  with any `python3` and no venv. Do not add third-party imports.
- `yt-dlp` is installed at `/opt/homebrew/bin/yt-dlp`, version 2026.06.09
  (verified during planning). It is used ONLY for catalog listing and
  per-video metadata — NOT for subtitles (its caption path bursts requests
  and triggers HTTP 429; observed live 2026-07-05, and
  `tooling/cli/youtube/README.md` documents it as broken for captions).
- Transcript text comes from `tooling/cli/youtube/pp-yt-transcript` — an
  existing repo CLI: no API key, local cache in `~/.cache/pp-yt-transcript/`,
  clean flowing-text output on stdout (no VTT parsing needed), exit code 2
  when all fetch paths fail. Called via subprocess; keeps ingest stdlib-only.
- Repo hygiene rule (from Plan 003): no media accretion in the working tree.
  This tool **never downloads video/audio** — `--skip-download` on every call.
  Transcripts are small text files and ARE committed (they're the corpus the
  Plan-013 skill reads, and they sync to other machines with the repo).
- The working tree currently carries unrelated uncommitted changes
  (tutorial-pipeline v3 files). Leave them exactly as they are.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Confirm yt-dlp present | `yt-dlp --version` | a date-style version, e.g. `2026.06.09` |
| Run ingestion | `python3 pipelines/youtube/competitor-styles/ingest.py <channel-url> --limit N [--slug <slug>]` | progress lines, then `Done: N new transcripts, M skipped → …` |
| Validate JSON output | `python3 -c "import json;json.load(open('<file>'))"` | exit 0, no output |

## Scope

**In scope** (the only files/dirs to create or touch):
- `pipelines/youtube/competitor-styles/` — new folder: `ingest.py`, `CLAUDE.md`, `channels/.gitkeep`
- `pipelines/youtube/CLAUDE.md` — add one table row
- `pipelines/CLAUDE.md` — add one folder-map row
- `decisions.md` — append one dated line
- `plans/README.md` — status cell for this plan only

**Out of scope** (looks related, do NOT touch):
- `pipelines/youtube/yt-script/`, `yt-research/`, `keyword-research/` — older
  script/research workflows; this system is deliberately independent of them.
- `tooling/claude-skills/` — the skill is Plan 013.
- `pipelines/youtube/kushal-tutorial-pipeline-v2/` and any file with existing
  uncommitted modifications — unrelated in-flight work.
- `pipelines/requirements.txt`, `pipelines/common/` — this tool must stay
  stdlib-only.

## Git workflow

- Branch: `advisor/012-competitor-styles` (create from current HEAD; Plan 013
  continues on this same branch).
- Commit per stage. Stage files **by explicit path only — never `git add -A`
  or `git add .`** (the tree holds unrelated uncommitted changes).
- Commit messages: `feat(competitor-styles): <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold the folder and its CLAUDE.md

Create `pipelines/youtube/competitor-styles/channels/.gitkeep` (empty file) and
`pipelines/youtube/competitor-styles/CLAUDE.md` with exactly this content:

```markdown
# competitor-styles — clone a competitor channel's script style

One self-contained **style pack** per competitor channel. Ingest transcripts
once (zero API keys, via yt-dlp), distill once into a Style DNA profile, then
generate topics/titles/scripts cheaply forever. The generation workflow is the
`yt-style` skill (`tooling/claude-skills/yt-style/`); this folder is its data.

## Layout

    channels/<slug>/
    ├── channel.json        # channel url/name, last ingest date
    ├── videos.json         # full catalog: id, title, views, duration, url
    ├── transcripts/        # one cleaned .md per video (frontmatter + text)
    ├── style-dna.md        # distilled profile — written by /yt-style distill
    ├── rubric.md           # style-fidelity checklist — written by distill
    ├── exemplars/          # 2-3 full transcripts kept as few-shot references
    └── output/
        ├── topics.md       # dated batches of topic + title suggestions
        └── scripts/<slug>/ # outline.md + script.md per generated video

## Commands

    # Ingest (or re-run later to pick up new uploads — already-fetched ids are skipped)
    python3 ingest.py https://www.youtube.com/@<channel> --limit 30

Stdlib-only; needs the system `yt-dlp` binary (catalog + metadata) and the
repo's `tooling/cli/youtube/pp-yt-transcript` CLI (transcript text, cached).
No venv, no API keys, never downloads media. Run from the Mac — YouTube
blocks transcript fetches from datacenter IPs (see the pp-yt-transcript README).

## Conventions

- Everything in a style pack is committed (small text only; media never lands here).
- Transcripts are regenerable — if one looks garbled, delete it and re-run ingest.
- New competitor = one `ingest.py` run + one `/yt-style distill <slug>` session.
- Scale note: if a pack someday holds 100+ transcripts and topic research no
  longer fits in context, add a local embedding index THEN (decided 2026-07-05:
  no RAG/vector DB before that point; never for style itself).
```

**Verify**: `test -f pipelines/youtube/competitor-styles/CLAUDE.md && test -f pipelines/youtube/competitor-styles/channels/.gitkeep && echo OK` → `OK`

### Step 2: Write ingest.py

Create `pipelines/youtube/competitor-styles/ingest.py` with exactly this
content (author's note: the VTT cleaning and selection logic are load-bearing —
transcribe them verbatim):

```python
#!/usr/bin/env python3
"""Ingest a competitor YouTube channel into a style pack folder.

Usage:
    python3 ingest.py <channel-url> [--limit 30] [--slug <slug>]

Zero API keys. Catalog listing + per-video metadata via the system `yt-dlp`
binary; transcript text via the repo's pp-yt-transcript CLI (cached, uses
youtube-transcript-api's timedtext endpoint — more reliable than yt-dlp's
caption extractor, and no VTT cleanup needed). Never downloads media.
Stdlib-only — no venv needed. Re-running skips already-fetched transcripts,
so it doubles as "pick up the channel's new uploads". Run from the Mac
(residential IP) — YouTube blocks transcript fetches from datacenter IPs.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE / "channels"
# HERE = <repo>/pipelines/youtube/competitor-styles → parents[2] = <repo>
TRANSCRIPT_CLI = HERE.parents[2] / "tooling" / "cli" / "youtube" / "pp-yt-transcript"


def run_json(cmd):
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"{cmd[0]} failed ({out.returncode}): {out.stderr.strip()[-400:]}")
    return json.loads(out.stdout)


def select(entries, limit):
    """First 10 (the /videos tab lists newest-first) + top by views, capped."""
    chosen = {}
    for e in entries[:10]:
        chosen[e["id"]] = e
    by_views = sorted(entries, key=lambda e: e.get("view_count") or 0, reverse=True)
    for e in by_views:
        if len(chosen) >= limit:
            break
        chosen.setdefault(e["id"], e)
    return list(chosen.values())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    url = args.channel_url.rstrip("/")
    if not url.endswith("/videos"):
        url += "/videos"

    print(f"Listing uploads: {url}")
    playlist = run_json(["yt-dlp", "--flat-playlist", "-J", url])
    entries = [e for e in (playlist.get("entries") or []) if e and e.get("id")]
    if not entries:
        sys.exit("No videos found — is that URL a channel page?")

    handle = playlist.get("uploader_id") or playlist.get("channel") or "channel"
    slug = args.slug or re.sub(r"[^a-z0-9-]", "", handle.lower().lstrip("@"))
    ch_dir = BASE / slug
    tdir = ch_dir / "transcripts"
    tdir.mkdir(parents=True, exist_ok=True)
    (ch_dir / "exemplars").mkdir(exist_ok=True)
    (ch_dir / "output").mkdir(exist_ok=True)

    catalog = [
        {
            "id": e["id"],
            "title": e.get("title"),
            "view_count": e.get("view_count"),
            "duration": e.get("duration"),
            "url": f"https://www.youtube.com/watch?v={e['id']}",
        }
        for e in entries
    ]
    (ch_dir / "videos.json").write_text(json.dumps(catalog, indent=2))

    todo = [e for e in select(entries, args.limit) if not (tdir / f"{e['id']}.md").exists()]
    print(f"{len(entries)} videos in catalog; fetching {len(todo)} transcripts")

    ok = skipped = 0
    for i, e in enumerate(todo, 1):
        vid = e["id"]
        print(f"[{i}/{len(todo)}] {vid}  {(e.get('title') or '')[:60]}")
        t = subprocess.run([str(TRANSCRIPT_CLI), "get", vid],
                           capture_output=True, text=True)
        text = t.stdout.strip()
        if t.returncode != 0 or len(text.split()) < 100:
            reason = t.stderr.strip()[-120:] if t.returncode != 0 else "under 100 words"
            print(f"   no usable transcript — skipped ({reason})")
            skipped += 1
            if ok == 0 and skipped >= 5:
                sys.exit("First 5 videos all failed — YouTube may be blocking "
                         "this IP. Run from the Mac and retry later; do not "
                         "add cookies or proxies.")
            continue
        # metadata is best-effort; fall back to the flat-playlist entry
        m = subprocess.run(
            ["yt-dlp", "-J", "--skip-download",
             f"https://www.youtube.com/watch?v={vid}"],
            capture_output=True, text=True,
        )
        info = json.loads(m.stdout) if m.returncode == 0 else {}
        up = info.get("upload_date") or ""
        up = f"{up[:4]}-{up[4:6]}-{up[6:]}" if len(up) == 8 else ""
        title = (info.get("title") or e.get("title") or "").replace('"', "'")
        header = (
            "---\n"
            f"id: {vid}\n"
            f'title: "{title}"\n'
            f"views: {info.get('view_count') or e.get('view_count') or 0}\n"
            f"upload_date: {up}\n"
            f"duration: {info.get('duration_string') or ''}\n"
            f"url: https://www.youtube.com/watch?v={vid}\n"
            "---\n\n"
        )
        (tdir / f"{vid}.md").write_text(header + text + "\n")
        ok += 1
        time.sleep(2)

    (ch_dir / "channel.json").write_text(json.dumps(
        {
            "slug": slug,
            "channel_url": args.channel_url,
            "channel_name": playlist.get("channel") or playlist.get("uploader"),
            "last_ingest": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "transcripts": len(list(tdir.glob("*.md"))),
        },
        indent=2,
    ))
    print(f"Done: {ok} new transcripts, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not TRANSCRIPT_CLI.exists():
        sys.exit(f"pp-yt-transcript not found at {TRANSCRIPT_CLI}")
    main()
```

**Verify**: `python3 -m py_compile pipelines/youtube/competitor-styles/ingest.py && echo OK` → `OK`

### Step 3: Smoke-test against a real channel, then remove the test pack

Run:

```
python3 pipelines/youtube/competitor-styles/ingest.py "https://www.youtube.com/@mkbhd" --limit 3 --slug _smoke
```

Expected: a catalog line (hundreds of videos), `fetching 3 transcripts` (or
fewer if a video lacks subs), and a final `Done:` line. Then check quality and
clean up:

```
python3 - <<'EOF'
import json, pathlib
d = pathlib.Path("pipelines/youtube/competitor-styles/channels/_smoke")
json.load(open(d / "videos.json")); json.load(open(d / "channel.json"))
ts = list((d / "transcripts").glob("*.md"))
assert ts, "no transcripts written"
body = ts[0].read_text()
assert body.startswith("---") and len(body.split()) > 150, "transcript malformed/too short"
assert "-->" not in body and "<c>" not in body, "VTT artifacts leaked into transcript"
print("SMOKE OK:", len(ts), "transcripts")
EOF
rm -rf pipelines/youtube/competitor-styles/channels/_smoke
```

**Verify**: the heredoc prints `SMOKE OK: <n> transcripts` (n ≥ 1) AND `ls pipelines/youtube/competitor-styles/channels/` → only `.gitkeep` remains. Do not commit `_smoke`.

### Step 4: Register the folder in both maps and decisions.md

1. `pipelines/youtube/CLAUDE.md` — add this row at the end of the subfolder table:

   ```
   | [`competitor-styles/`](competitor-styles/CLAUDE.md) | Competitor style packs — transcript ingestion + Style DNA for the yt-style skill | Python + Claude skill |
   ```

2. `pipelines/CLAUDE.md` — add this row directly after the
   `youtube/kushal-tutorial-pipeline-v2/` row:

   ```
   | &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/competitor-styles/`](youtube/competitor-styles/CLAUDE.md) | Competitor style packs (ingest + Style DNA for yt-style skill) | Python + Claude skill |
   ```

3. `decisions.md` — append this line at the end of the file:

   ```
   - **2026-07-05 — Competitor style cloning = distill-once style packs.** `pipelines/youtube/competitor-styles/` + the `yt-style` skill: ingest competitor transcripts once via yt-dlp (zero API keys), distill once into a Style DNA + rubric, generate topics/titles/scripts from the DNA only. All LLM work on the Claude subscription. Fine-tuning rejected (20-30 scripts/channel is too little data; weaker local models). RAG rejected for style (global property, not chunk-retrievable) — revisit only as a topic-research index if a pack outgrows context.
   ```

**Verify**: `grep -c "competitor-styles" pipelines/youtube/CLAUDE.md pipelines/CLAUDE.md decisions.md` → each file reports ≥ 1.

## Test plan

Manual verification only (owner's convention: no test suites for personal
tooling). The Step 3 smoke test against a live channel is the end-to-end gate;
Step 2's `py_compile` catches syntax; JSON validation is inline in Step 3.

## Done criteria

- [ ] `python3 -m py_compile pipelines/youtube/competitor-styles/ingest.py` exits 0
- [ ] Step 3 smoke test printed `SMOKE OK` and the `_smoke` folder was deleted (not committed)
- [ ] `grep competitor-styles pipelines/CLAUDE.md pipelines/youtube/CLAUDE.md` — one row in each
- [ ] `decisions.md` has the 2026-07-05 distill-once line
- [ ] `git log --oneline` shows commit(s) touching only in-scope paths; `git status` still shows the pre-existing unrelated modifications untouched

## STOP conditions

- ingest.py exits with its "YouTube may be blocking this IP" message (first 5
  transcript fetches all failed), or yt-dlp/pp-yt-transcript errors mention
  "Sign in to confirm" or HTTP 429 repeatedly → stop and report; do NOT add
  cookies, proxies, or retry loops.
- The smoke test yields 0 transcripts (all videos lack English subs) → stop and
  report rather than switching test channels more than once (one substitute
  channel of your choice with spoken English content is allowed).
- Any need for a third-party Python package → stop; stdlib-only is a design
  decision.
- `git status` tempts a bulk stage — never `git add -A`; if unrelated files end
  up staged, unstage them and report.

## Maintenance notes

- Transcript fetching is delegated to `tooling/cli/youtube/pp-yt-transcript`
  (fallback chain + cache live there) — if transcripts stop arriving, debug
  that CLI, not ingest.py. Do NOT reintroduce yt-dlp subtitle downloads here:
  its caption path bursts per-language requests and self-inflicts HTTP 429
  (this exact failure blocked the first execution run, 2026-07-05).
- `select()` assumes the `/videos` tab lists newest-first (true today).
- Plan 013 (the `yt-style` skill) reads this folder layout verbatim — layout
  changes must update both.
- Owner's VPS IP is known to be blocked for YouTube scraping; ingest is meant
  to run on the Mac, not the VPS.
