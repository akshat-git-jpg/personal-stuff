# yt-style-copy Video-Style-DNA Implementation Plan

> **For agentic workers:** This is personal tooling — per established preference, skip
> TDD/subagent-driven-development. Implement each task directly, verify manually (run the
> script or invoke the skill step for real, inspect the output), commit, move to the next
> task.

**Goal:** Add an independent video/visual-style cloning pipeline (`fetch-video`,
`build-video-style-dna`) to the `yt-style` skill alongside its existing script pipeline,
and rename the skill to `yt-style-copy`.

**Architecture:** Two-tier, fully independent pipeline. `fetch-video` (mechanical script)
downloads each catalog video at 720p, measures cut pacing via `ffmpeg` scene-detection
(free, every video), caches sampled frames, then deletes the raw video. `build-video-style-dna`
(Claude-driven, like the existing `build-script-style-dna`) reads cached frames from only a
capped representative subset of videos, synthesizes `video-style-dna.md`, keeps a small
evidence-frame set, and cleans up the rest. Neither new command touches the script
pipeline's files; neither script command checks for the other's artifacts.

**Tech Stack:** Python 3 stdlib only (`argparse`, `json`, `re`, `subprocess`, `pathlib`),
system `yt-dlp` + `ffmpeg`/`ffprobe` binaries. No new dependencies, no venv.

## Global Constraints

- Zero API keys; no cloud/paid video-analysis services (spec: "Non-goals").
- Stdlib-only Python — matches `ingest.py`'s existing convention, no venv.
- Videos downloaded at 720p (legible for on-screen text/motion graphics; not source quality).
- Raw video is deleted immediately after its metrics/frames are extracted — peak disk usage
  is one video at a time.
- `video-metrics.json` covers every fetched video (Tier 1, free); LLM vision analysis
  (Tier 2) only runs on a capped representative subset (~5-8 videos).
- Keep ~15-20 evidence frames in `frames/exemplars/` after `build-video-style-dna`; delete
  everything else in `.video-cache/`.
- No `video-rubric.md` — nothing consumes it yet.
- `write-script` is unchanged: reads only `script-style-dna.md`/`rubric.md`/`exemplars/`,
  never `video-style-dna.md`.
- The two pipelines share only `channel.json`/`videos.json`; whichever runs first creates
  them, the other reuses them. No other cross-dependency.

---

### Task 1: Extract shared catalog logic into `catalog.py`

**Files:**
- Create: `pipelines/youtube/competitor-styles/catalog.py`
- Modify: `pipelines/youtube/competitor-styles/ingest.py` (replace inline catalog logic
  with imports from `catalog.py`; update `channel.json` writes to the new per-pipeline-key
  schema)

**Interfaces:**
- Produces: `fetch_catalog(channel_url: str, slug: str | None) -> tuple[str, Path, list[dict]]`
  — lists uploads via `yt-dlp`, derives/uses `slug`, ensures `channels/<slug>/` exists,
  (re)writes `videos.json` with the full catalog, merges identity fields (`slug`,
  `channel_url`, `channel_name`) into `channel.json`. Returns `(slug, channel_dir, entries)`.
- Produces: `select(entries: list[dict], limit: int) -> list[dict]` — first 10 (newest) +
  top-by-views, capped at `limit`. Unchanged logic, moved verbatim from `ingest.py`.
- Produces: `update_channel_json(ch_dir: Path, key: str, fields: dict) -> None` — merges
  `fields` under `channel.json[key]` (e.g. `"transcripts"` or `"video"`), preserving
  whatever the other pipeline already wrote and the identity fields `fetch_catalog` set.
- Consumes: nothing (this is the foundation both other scripts build on).

`channel.json` schema changes from flat fields to per-pipeline sub-objects so the two
pipelines can never clobber each other:

```json
{
  "slug": "somechannel",
  "channel_url": "https://www.youtube.com/@somechannel",
  "channel_name": "Some Channel",
  "transcripts": {"last_ingest": "2026-07-05", "limit": 30, "count": 12},
  "video": {"last_fetch": "2026-07-05", "limit": 30, "count": 8}
}
```

- [ ] **Step 1: Create `catalog.py`**

```python
#!/usr/bin/env python3
"""Shared channel-catalog fetch + selection, used by both ingest.py
(transcripts) and fetch_video.py (video analysis). Neither pipeline depends
on the other having run — whichever runs first creates the catalog; the
other reuses it.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "channels"


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


def fetch_catalog(channel_url, slug=None):
    """Lists the channel's uploads, ensures channels/<slug>/ exists, (re)writes
    videos.json with the full catalog, and merges identity fields into
    channel.json. Returns (slug, channel_dir, entries).
    """
    url = channel_url.rstrip("/")
    if not url.endswith("/videos"):
        url += "/videos"

    print(f"Listing uploads: {url}")
    playlist = run_json(["yt-dlp", "--flat-playlist", "-J", url])
    entries = [e for e in (playlist.get("entries") or []) if e and e.get("id")]
    if not entries:
        sys.exit("No videos found — is that URL a channel page?")

    handle = playlist.get("uploader_id") or playlist.get("channel") or "channel"
    slug = slug or re.sub(r"[^a-z0-9-]", "", handle.lower().lstrip("@"))
    ch_dir = BASE / slug
    ch_dir.mkdir(parents=True, exist_ok=True)

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

    channel_name = playlist.get("channel") or playlist.get("uploader")
    path = ch_dir / "channel.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data["slug"] = slug
    data["channel_url"] = channel_url
    data["channel_name"] = channel_name
    path.write_text(json.dumps(data, indent=2))

    return slug, ch_dir, entries


def update_channel_json(ch_dir, key, fields):
    """Merges `fields` under channel.json[key] (e.g. "transcripts" or
    "video"), preserving the other pipeline's key and the identity fields
    fetch_catalog() already set.
    """
    path = ch_dir / "channel.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data[key] = fields
    path.write_text(json.dumps(data, indent=2))
```

- [ ] **Step 2: Rewrite `ingest.py` to use `catalog.py`**

Replace the whole file with:

```python
#!/usr/bin/env python3
"""Ingest a competitor YouTube channel's transcripts into a style pack folder.

Usage:
    python3 ingest.py <channel-url> [--limit 30] [--slug <slug>]

Zero API keys. Catalog listing via catalog.py (system `yt-dlp` binary);
transcript text via the repo's pp-yt-transcript CLI (cached, uses
youtube-transcript-api's timedtext endpoint — more reliable than yt-dlp's
caption extractor, and no VTT cleanup needed). Never downloads media.
Stdlib-only — no venv needed. Re-running skips already-fetched transcripts,
so it doubles as "pick up the channel's new uploads". Run from the Mac
(residential IP) — YouTube blocks transcript fetches from datacenter IPs.
Independent of fetch_video.py — run this even if you never run that.
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from catalog import fetch_catalog, select, update_channel_json

HERE = Path(__file__).resolve().parent
# HERE = <repo>/pipelines/youtube/competitor-styles → parents[2] = <repo>
TRANSCRIPT_CLI = HERE.parents[2] / "tooling" / "cli" / "youtube" / "pp-yt-transcript"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    slug, ch_dir, entries = fetch_catalog(args.channel_url, args.slug)
    tdir = ch_dir / "transcripts"
    tdir.mkdir(exist_ok=True)
    (ch_dir / "exemplars").mkdir(exist_ok=True)
    (ch_dir / "output").mkdir(exist_ok=True)

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

    update_channel_json(
        ch_dir, key="transcripts",
        fields={
            "last_ingest": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "count": len(list(tdir.glob("*.md"))),
        },
    )
    print(f"Done: {ok} new transcripts, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not TRANSCRIPT_CLI.exists():
        sys.exit(f"pp-yt-transcript not found at {TRANSCRIPT_CLI}")
    main()
```

- [ ] **Step 3: Manual verification**

Run against a real small channel you already have (or any small public one), reusing an
existing `--limit` you'd normally use:

```bash
cd pipelines/youtube/competitor-styles
python3 ingest.py <a-real-channel-url> --limit 2
cat channels/<slug>/channel.json
```

Expected: same transcript-fetching behavior as before the refactor, and `channel.json` now
shows a `"transcripts": {"last_ingest": ..., "limit": 2, "count": N}` sub-object instead of
flat fields.

- [ ] **Step 4: Commit**

```bash
git add pipelines/youtube/competitor-styles/catalog.py pipelines/youtube/competitor-styles/ingest.py
git commit -m "refactor(competitor-styles): extract shared catalog logic into catalog.py"
```

---

### Task 2: Rename `build-style-dna` → `build-script-style-dna`

**Files:**
- Modify: `tooling/claude-skills/yt-style/SKILL.md`
- Modify: `pipelines/youtube/competitor-styles/CLAUDE.md`

**Interfaces:** N/A — documentation-only rename, no code.

- [ ] **Step 1: Update `SKILL.md`**

In the frontmatter `description`, change:
`"Verbs — fetch-transcripts a channel, build-style-dna into a Style DNA profile, ..."` →
`"Verbs — fetch-transcripts a channel, build-script-style-dna into a Script Style DNA profile, ..."`
and the trigger phrase `"build style dna for <channel>"` → `"build script style dna for <channel>"`.

In the body, replace every occurrence of `` `style-dna.md` `` with `` `script-style-dna.md` ``
and the header `## build-style-dna <slug>` with `## build-script-style-dna <slug>`. This
touches: the intro paragraph ("Generation verbs read ONLY..."), the `build-script-style-dna`
section's step 3 and refresh-policy line, the `suggest-topics`/`suggest-titles`/`write-script`
sections' load lines, and the Guardrails section's last bullet
(`` If `script-style-dna.md` is missing... run `build-script-style-dna` first ``).

- [ ] **Step 2: Update `pipelines/youtube/competitor-styles/CLAUDE.md`**

In the layout tree, change:
```
    ├── style-dna.md        # distilled profile — written by /yt-style build-script-style-dna
    ├── rubric.md           # style-fidelity checklist — written by build-script-style-dna
```
to:
```
    ├── script-style-dna.md # distilled profile — written by /yt-style build-script-style-dna
    ├── rubric.md           # style-fidelity checklist — written by build-script-style-dna
```
And in Conventions, change `` `/yt-style build-style-dna <slug>` `` to
`` `/yt-style build-script-style-dna <slug>` `` (the skill-name part of this reference gets
fixed again in Task 5 — don't rename to `yt-style-copy` yet, just the verb).

- [ ] **Step 3: Manual verification**

```bash
rtk proxy grep -n "style-dna\|build-style-dna" tooling/claude-skills/yt-style/SKILL.md pipelines/youtube/competitor-styles/CLAUDE.md
```

Expected: no bare `style-dna.md` or `build-style-dna` left — every hit is either
`script-style-dna.md` or `build-script-style-dna`.

- [ ] **Step 4: Commit**

```bash
git add tooling/claude-skills/yt-style/SKILL.md pipelines/youtube/competitor-styles/CLAUDE.md
git commit -m "docs(yt-style): rename build-style-dna to build-script-style-dna"
```

---

### Task 3: `fetch-video` command

**Files:**
- Create: `pipelines/youtube/competitor-styles/fetch_video.py`
- Modify: `tooling/claude-skills/yt-style/SKILL.md` (add `## fetch-video` section)
- Modify: `pipelines/.gitignore` (ignore `.video-cache/`)

**Interfaces:**
- Consumes: `catalog.fetch_catalog`, `catalog.select`, `catalog.update_channel_json`
  (from Task 1).
- Produces: `channels/<slug>/video-metrics.json` (per-video `cuts_per_minute`,
  `shot_lengths_s`, `duration_s`, `frame_count`) and `channels/<slug>/.video-cache/<video_id>/`
  (extracted frame `.jpg` files) — both consumed by Task 4's `build-video-style-dna`.

- [ ] **Step 1: Create `fetch_video.py`**

```python
#!/usr/bin/env python3
"""Fetch a competitor channel's videos just long enough to measure cut
pacing and cache representative frames, into the same style-pack folder
fetch-transcripts uses. Never keeps the raw video.

Usage:
    python3 fetch_video.py <channel-url> [--limit 30] [--slug <slug>]

Needs the system `ffmpeg`/`ffprobe` and `yt-dlp` binaries. Stdlib-only — no
venv. Re-running later picks up new uploads only (skips videos already in
video-metrics.json). Downloads at 720p (legible for on-screen text and
motion graphics, far lighter than source quality) and deletes each raw
video immediately after its cut-metrics and frame cache are written, so
peak disk usage is one video at a time, not the whole catalog. Independent
of ingest.py — run this even if the channel has no script pack.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from catalog import fetch_catalog, select, update_channel_json

INTERVAL = 2.0                # seconds between interior samples in long shots
MIN_SHOT_FOR_INTERVAL = 4.0    # only add interior samples inside shots longer than this
SCENE_THRESHOLD = 0.4          # ffmpeg scene-filter sensitivity


def probe_duration(video_path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def detect_scene_cuts(video_path):
    """Cut timestamps (seconds) via ffmpeg's scene filter + showinfo."""
    result = subprocess.run(
        ["ffmpeg", "-i", str(video_path),
         "-vf", f"select='gt(scene,{SCENE_THRESHOLD})',showinfo",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    return sorted(float(m) for m in re.findall(r"pts_time:([\d.]+)", result.stderr))


def shot_lengths(cuts, duration):
    bounds = [0.0] + cuts + [duration]
    return [round(b - a, 2) for a, b in zip(bounds, bounds[1:]) if b > a]


def extract_frames(video_path, out_dir, cuts, duration):
    """One frame at the start of every shot, plus interior samples every
    INTERVAL seconds for shots longer than MIN_SHOT_FOR_INTERVAL — catches
    animation/motion graphics that unfold without a hard cut, without
    needing perceptual-hash frame deduplication."""
    out_dir.mkdir(parents=True, exist_ok=True)
    bounds = [0.0] + cuts + [duration]
    timestamps = {round(t, 1) for t in bounds[:-1]}
    for a, b in zip(bounds, bounds[1:]):
        if b - a > MIN_SHOT_FOR_INTERVAL:
            t = a + INTERVAL
            while t < b:
                timestamps.add(round(t, 1))
                t += INTERVAL
    kept = []
    for t in sorted(timestamps):
        frame_path = out_dir / f"t{t:07.1f}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(video_path),
             "-frames:v", "1", "-q:v", "4", str(frame_path)],
            capture_output=True,
        )
        if frame_path.exists():
            kept.append(frame_path.name)
    return kept


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("channel_url")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--slug", help="folder name; default derived from the channel handle")
    args = ap.parse_args()

    slug, ch_dir, entries = fetch_catalog(args.channel_url, args.slug)
    cache_dir = ch_dir / ".video-cache"
    cache_dir.mkdir(exist_ok=True)

    metrics_path = ch_dir / "video-metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}

    todo = [e for e in select(entries, args.limit) if e["id"] not in metrics]
    print(f"{len(entries)} videos in catalog; fetching {len(todo)} videos")

    ok = skipped = 0
    for i, e in enumerate(todo, 1):
        vid = e["id"]
        print(f"[{i}/{len(todo)}] {vid}  {(e.get('title') or '')[:60]}")
        raw_path = cache_dir / f"{vid}.mp4"
        dl = subprocess.run(
            ["yt-dlp", "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]",
             "--merge-output-format", "mp4", "-o", str(raw_path),
             f"https://www.youtube.com/watch?v={vid}"],
            capture_output=True, text=True,
        )
        if dl.returncode != 0 or not raw_path.exists():
            reason = dl.stderr.strip()[-120:]
            print(f"   download failed — skipped ({reason})")
            skipped += 1
            if ok == 0 and skipped >= 5:
                sys.exit("First 5 videos all failed — YouTube may be blocking "
                         "this IP. Run from the Mac and retry later; do not "
                         "add cookies or proxies.")
            continue

        duration = probe_duration(raw_path)
        cuts = detect_scene_cuts(raw_path)
        frame_dir = cache_dir / vid
        frames = extract_frames(raw_path, frame_dir, cuts, duration)
        raw_path.unlink()

        metrics[vid] = {
            "title": e.get("title"),
            "view_count": e.get("view_count"),
            "duration_s": round(duration, 1),
            "cuts_per_minute": round(len(cuts) / (duration / 60), 2) if duration else 0,
            "shot_lengths_s": shot_lengths(cuts, duration),
            "frame_count": len(frames),
        }
        metrics_path.write_text(json.dumps(metrics, indent=2))
        ok += 1

    update_channel_json(
        ch_dir, key="video",
        fields={
            "last_fetch": time.strftime("%Y-%m-%d"),
            "limit": args.limit,
            "count": len(metrics),
        },
    )
    print(f"Done: {ok} new videos measured, {skipped} skipped → {ch_dir}")


if __name__ == "__main__":
    if not shutil.which("yt-dlp"):
        sys.exit("yt-dlp not found — brew install yt-dlp")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("ffmpeg/ffprobe not found — brew install ffmpeg")
    main()
```

- [ ] **Step 2: Add `.video-cache/` to `pipelines/.gitignore`**

Add under a new comment block:
```
# competitor-styles video-analysis scratch — regenerable via fetch_video.py,
# emptied by build-video-style-dna once video-style-dna.md is written
youtube/competitor-styles/channels/**/.video-cache/
```

- [ ] **Step 3: Add the `## fetch-video` section to `SKILL.md`**

Insert right before the `## build-script-style-dna <slug>` section:

```markdown
## fetch-video <channel-url>

Not an LLM task. Tell the user to run (or run for them):

    python3 pipelines/youtube/competitor-styles/fetch_video.py <channel-url> --limit 30

Downloads at 720p, measures cut pacing, caches frames, and deletes the raw
video per video — independent of `fetch-transcripts`; run it even if the
channel has no script pack. Re-running later picks up new uploads. Then
suggest `build-video-style-dna` if `video-style-dna.md` doesn't exist yet.
```

- [ ] **Step 4: Manual verification**

```bash
cd pipelines/youtube/competitor-styles
python3 fetch_video.py <a-real-small-channel-url> --limit 1
cat channels/<slug>/video-metrics.json
ls channels/<slug>/.video-cache/*/
```

Expected: `video-metrics.json` has one entry with a plausible `cuts_per_minute` and a
non-empty `shot_lengths_s` list; `.video-cache/<video_id>/` contains several `.jpg` frames;
no `.mp4` file remains anywhere under `.video-cache/`; `channel.json` now has a `"video"`
sub-object.

- [ ] **Step 5: Commit**

```bash
git add pipelines/youtube/competitor-styles/fetch_video.py pipelines/.gitignore tooling/claude-skills/yt-style/SKILL.md
git commit -m "feat(competitor-styles): add fetch-video command for cut-pacing metrics + frame cache"
```

---

### Task 4: `build-video-style-dna` command

**Files:**
- Modify: `tooling/claude-skills/yt-style/SKILL.md` (add `## build-video-style-dna` section)

**Interfaces:**
- Consumes: `channels/<slug>/video-metrics.json`, `channels/<slug>/.video-cache/<video_id>/*.jpg`
  (from Task 3).
- Produces: `channels/<slug>/video-style-dna.md`, `channels/<slug>/frames/exemplars/*.jpg`.

- [ ] **Step 1: Add the `## build-video-style-dna` section to `SKILL.md`**

Insert after the `## write-script` section (before `## Guardrails`):

```markdown
## build-video-style-dna <slug>

The expensive video session per channel (independent of `build-script-style-dna`
— a channel can have one, the other, or both). Requires `video-metrics.json`
to be non-empty.

1. Read `video-metrics.json` + `videos.json`. Using view counts and
   `cuts_per_minute`, pick a representative subset: the top view-count
   outlier, one maximally typical video, one per visually distinct format
   if the channel runs several, and any video whose `cuts_per_minute` is a
   clear outlier vs the channel median (a "high-energy edit" signal worth
   its own look). Aim for roughly 5-8 videos total — enough range without
   reviewing every video's frames.
2. For each chosen video, read its frames from `.video-cache/<video_id>/`
   (already extracted — one per shot plus interior samples in long shots)
   in batches of ~10 images. After each batch, append raw observations to
   `video-distill-notes.md` in the pack (B-roll moments, caption/overlay
   style, motion-graphics/animation beats, framing, thumbnail impressions —
   capture evidence with video id + timestamp, don't polish yet).
3. Synthesize `video-style-dna.md` with EXACTLY these sections (all required
   — every claim backed by at least one example with its video id and
   timestamp):
   - **Identity snapshot** — ≤5 lines: visual format(s) (talking-head /
     screen-recording / animated / hybrid), overall visual energy,
     dominant color grade or aesthetic.
   - **Cut pacing** — cuts-per-minute and shot-length distribution computed
     across the FULL `video-metrics.json` (every fetched video, not just the
     reviewed subset), and how pacing varies by video length or format.
   - **B-roll patterns** — how often and when B-roll appears vs talking-head,
     typical B-roll sources, examples with video id + timestamp.
   - **On-screen text & captions** — burned-in caption/lower-third/callout
     style, timing relative to speech, examples.
   - **Motion graphics & animation** — kinetic typography, transition
     styles, animated overlays/icons, examples.
   - **Thumbnail style** — composition/color/text patterns across the
     reviewed videos' frames.
   - **Framing & composition** — camera angle and shot-composition habits.
   - **Do-not list** — visual patterns this channel never uses.
4. Copy 15-20 of the most illustrative frames referenced in the DNA into
   `frames/exemplars/` (rename descriptively, e.g.
   `<video_id>_<timestamp>s-lower-third.jpg`), so a claim can be visually
   spot-checked later.
5. Delete `video-distill-notes.md` and everything left in `.video-cache/`.
   Report: DNA sections written, evidence frames kept.

There is no `video-rubric.md` — nothing consumes it yet. `write-script`
reads only `script-style-dna.md`/`rubric.md`/`exemplars/`; it does not read
`video-style-dna.md`.

Refresh policy: re-run build-video-style-dna only when the pack gains ~10+
new measured videos or the channel visibly changed its visual style; it
overwrites `video-style-dna.md` (git holds history).
```

- [ ] **Step 2: Manual end-to-end verification**

Using the same channel/slug from Task 3's verification (which already has
`video-metrics.json` and cached frames), actually invoke the skill:

```
/yt-style build-video-style-dna <slug>
```

Expected: `channels/<slug>/video-style-dna.md` is written with all 8 sections, each
backed by a video id (and timestamp where applicable); `channels/<slug>/frames/exemplars/`
has a small set of copied `.jpg` files; `channels/<slug>/.video-cache/` and
`video-distill-notes.md` no longer exist.

- [ ] **Step 3: Commit**

```bash
git add tooling/claude-skills/yt-style/SKILL.md
git commit -m "feat(yt-style): add build-video-style-dna command"
```

---

### Task 5: Rename the skill to `yt-style-copy`

**Files:**
- Rename: `tooling/claude-skills/yt-style/` → `tooling/claude-skills/yt-style-copy/`
- Modify: `tooling/claude-skills/yt-style-copy/SKILL.md` (frontmatter `name` + description)
- Modify: `tooling/claude-skills/manifest/personal.txt`
- Modify: `pipelines/youtube/competitor-styles/CLAUDE.md`
- Modify: `pipelines/youtube/CLAUDE.md`
- Modify: `pipelines/CLAUDE.md`

**Interfaces:** N/A — rename + cross-reference fixes, no code.

- [ ] **Step 1: Rename the skill folder**

```bash
git mv tooling/claude-skills/yt-style tooling/claude-skills/yt-style-copy
```

- [ ] **Step 2: Update `SKILL.md` frontmatter**

Change `name: yt-style` to `name: yt-style-copy`, and update `description` to cover all
seven verbs:

```
description: Clone a competitor YouTube channel's script style and/or visual editing style from its style pack in pipelines/youtube/competitor-styles/. Verbs — fetch-transcripts/build-script-style-dna for the script side, fetch-video/build-video-style-dna for the visual side (independent of each other — a channel can have one, the other, or both), suggest-topics, suggest-titles, or write-script in that channel's exact voice. Triggers on "yt-style-copy", "clone <channel>'s style", "clone <channel>'s video style", "build script style dna for <channel>", "build video style dna for <channel>", "suggest topics for <channel>", "suggest titles like <channel>", "write a script in <channel>'s style".
```

- [ ] **Step 3: Update `manifest/personal.txt`**

Change the line reading `yt-style` to `yt-style-copy`.

- [ ] **Step 4: Fix cross-references in `pipelines/youtube/competitor-styles/CLAUDE.md`**

- Line referencing the skill folder: `` `yt-style` skill (`tooling/claude-skills/yt-style/`) ``
  → `` `yt-style-copy` skill (`tooling/claude-skills/yt-style-copy/`) ``.
- The Conventions bullet from Task 2: `` `/yt-style build-script-style-dna <slug>` `` →
  `` `/yt-style-copy build-script-style-dna <slug>` ``, and add a sibling bullet:
  `` New competitor (video style) = one `fetch_video.py` run + one
  `/yt-style-copy build-video-style-dna <slug>` session — independent of the script pipeline. ``
- Update the Layout tree to add the new video-side files/folders:
  ```
      ├── video-metrics.json  # per-video cut/shot-length stats (fetch_video.py, all videos)
      ├── video-style-dna.md  # distilled visual profile — written by /yt-style-copy build-video-style-dna
      ├── frames/exemplars/   # small evidence-frame set kept after build-video-style-dna
  ```
- Update the Commands section to add:
  ```
      python3 fetch_video.py https://www.youtube.com/@<channel> --limit 30
  ```

- [ ] **Step 5: Fix the one-line mentions in `pipelines/youtube/CLAUDE.md` and `pipelines/CLAUDE.md`**

In `pipelines/youtube/CLAUDE.md`, change:
`` Competitor style packs — transcript ingestion + Style DNA for the yt-style skill ``
to:
`` Competitor style packs — transcript/video ingestion + Style DNA for the yt-style-copy skill ``

In `pipelines/CLAUDE.md`, change:
`` Competitor style packs (ingest + Style DNA for yt-style skill) ``
to:
`` Competitor style packs (ingest + Style DNA for yt-style-copy skill) ``

- [ ] **Step 6: Run relink.sh and verify**

```bash
./scripts/relink.sh
```

Expected: output shows the stale `yt-style` symlink pruned and `yt-style-copy` linked into
`~/.claude-personal/skills/`. **Restart the Claude Code session afterward** — skill
discovery is cached and won't reflect the rename until relaunch.

- [ ] **Step 7: Commit**

```bash
git add -A tooling/claude-skills/yt-style-copy tooling/claude-skills/manifest/personal.txt pipelines/youtube/competitor-styles/CLAUDE.md pipelines/youtube/CLAUDE.md pipelines/CLAUDE.md
git commit -m "refactor(yt-style): rename skill to yt-style-copy"
```

---

## Self-Review Notes

- **Spec coverage:** independence/shared-catalog (Task 1), fetch-video two-tier Tier 1
  (Task 3), build-video-style-dna Tier 2 + evidence frames + no rubric (Task 4), file
  layout (Tasks 3-5 collectively), skill rename (Task 5), error handling patterns reused
  from `ingest.py` (Task 3) — all covered.
- **Placeholder scan:** none found; every step has literal code/commands.
- **Type consistency:** `fetch_catalog`/`select`/`update_channel_json` signatures introduced
  in Task 1 are used identically (same names, same argument shapes) in Tasks 1 and 3.
- **Deviation from the spec's literal wording:** the spec said extracted frames get
  "near-duplicate frames dropped" — implemented instead as a structural sampling rule (one
  frame per shot + interior samples only in shots longer than 4s) rather than a
  perceptual-hash dedup pass, to stay stdlib-only (no PIL dependency) per this pack's
  existing "stdlib-only" convention. Same intent (bounded, non-redundant frame count),
  simpler and more robust implementation.
