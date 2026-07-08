<!-- boss frontmatter -->
---
executor: agy
model: "Gemini 3.1 Pro (High)"
test_cmd: python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q
ui: false
deploy:
needs: ["owner's explicit choice: executor agy, model Gemini 3.1 Pro (High) — do not substitute", "depends on plan 052 landing first — this plan's run.py calls registry.create_tool_if_new and relies on the new LIST_FIELDS-validated parse contract"]
---

# Plan 053: dossier-build — real driver script, real video metadata, agy retry

## Summary

- **Problem statement**: `dossier-build`'s `SKILL.md` describes the extraction/merge loop in prose for a Claude Code session to reimplement by hand every time it runs — there is no actual runnable script, so every run hand-writes the same agy-calling glue code from scratch (confirmed during a live run today: the operator wrote ad hoc Python three separate times in one session). Separately, `dossier-transcripts`'s `meta.json` leaves `title`/`channel`/`published` as empty strings, based on a false claim that `dossier-build`'s extraction step fills them in from the transcript later — it never does, because transcripts don't contain upload dates, and the merge prompt needs a real publish month for every citation. And one live `agy` call today hung 600+ seconds and failed, then succeeded in ~6 seconds on an immediate retry — there's no retry logic anywhere.
- **Goals**:
  - `pipelines/youtube/dossiers/run.py`: a real, reusable script with `extract` and `merge` subcommands implementing the loop `dossier-build`'s `SKILL.md` currently only describes, calling `agy` directly and reusing `registry.py`'s existing parse/guard/match functions.
  - One retry on a transient `agy` timeout/failure before giving up on a video or tool.
  - `pipelines/common/transcribe.py` gains a `fetch_metadata()` function (+ CLI subcommand) that calls `yt-dlp` for real title/channel/publish-date, and `dossier-transcripts`'s `SKILL.md` calls it instead of leaving those fields empty.
  - `dossier-build`'s `SKILL.md` Steps 2 and 3 become short pointers at `run.py` instead of a prose loop to reimplement.
  - Document `agy`'s undocumented CLI usage (`--output-format json` hidden flag, exact model-name strings) directly in `run.py`'s docstring, where the next session will actually be looking.
- **Executor proposed**: `agy`, model `Gemini 3.1 Pro (High)` — owner's explicit choice (see frontmatter `needs`).
- **Done criteria** (terse): `test_cmd` exits 0; `run.py extract --help` / `run.py merge --help` exit 0; `transcribe.py metadata <id>` exits 0 against a mocked `yt-dlp`; `dossier-build`/`dossier-transcripts` `SKILL.md` no longer contain the prose loop / the false "reads them from the transcript" claim.
- **Stop conditions** (terse): plan 052 hasn't landed yet (`registry.create_tool_if_new` missing) — stop immediately, don't proceed; any quoted excerpt doesn't match the file on disk.
- **Test / verification for success**: pytest for all pure-logic helpers (mocked `subprocess`, no network); `run.py`'s top-level `cmd_extract`/`cmd_merge` orchestration is glue over already-tested `registry.py` functions plus one real model call, so — matching plan 051's own stated testing boundary — it is verified behaviorally (one real `dossier-build` run), not by pytest.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`'s status table — boss/secretary owns that registry
> on `main` (see `decisions.md` 2026-07-07); stage only this plan file with
> your commit (`git add plans/053-…`). Keep ALL writes inside the repo working tree.
> Do **not** touch anything under `pipelines/youtube/dossiers/videos/` or
> `pipelines/youtube/dossiers/tools/` — live, uncommitted research data from a
> run today, orthogonal to this plan.
>
> **Drift check (run first)**:
> 1. Confirm plan 052 already landed: `python3 -c "import sys; sys.path.insert(0,'pipelines/youtube/dossiers'); import registry; assert hasattr(registry, 'create_tool_if_new'); print('052 OK')"` -> `052 OK`. If this fails (import error or `AssertionError`), **STOP** — plan 052 must land before this one; do not proceed or try to patch it in yourself.
> 2. `git diff --stat c93686a..HEAD -- pipelines/youtube/dossiers/run.py pipelines/youtube/dossiers/tests/test_run.py pipelines/common/transcribe.py pipelines/common/tests/test_transcribe.py pipelines/.claude/skills/dossier-transcripts/SKILL.md` (expect: no output — none of these touched by plan 052 or anything else)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 052
- **Category**: tech-debt
- **Difficulty**: standard — every decision (exact code, exact retry counts/timeouts, exact CLI shape) is fully specified below; nothing is left to the executor's judgment.
- **Planned at**: commit `c93686a`, 2026-07-08

## Why this matters

`dossier-build` only has value if it's actually run repeatedly and cheaply. Right now every run costs a fresh reimplementation of the same ~150 lines of glue code (confirmed: this happened 3 times in one session today, each with slightly different bugs — a `verdict`-shape crash, a bad bash associative-array script, an agy timeout with no retry). A real script removes that tax permanently, and turns "does this work" from "re-derive it and hope" into "run it and read the JSON summary line." The metadata fix matters because every dossier citation's accuracy depends on a real publish month — the merge prompt already assumes it exists; today's run had to backfill it by hand with `yt-dlp` outside the documented pipeline. The retry logic matters because a single transient `agy` hang otherwise silently drops a whole video's or tool's data for the run (no automatic recovery, no signal beyond a log line the operator has to notice and manually re-run).

## Current state

**Assumes plan 052 has already landed** — the excerpts below are written against the *post-052* state of files 052 also touches.

- **`pipelines/youtube/dossiers/registry.py`** (post-052): now has `LIST_FIELDS`, `create_tool_if_new(tool_name, aliases, slug)`, `match_tool(..., near_threshold=0.75)`, and `parse_agy_envelope`/`parse_extraction_output`/`merge_guard`/`pending_extraction`/`pending_merge_for_tool`/`all_pending_tools`/`load_tool` unchanged from plan 051. `run.py` (this plan) imports and calls these directly — it adds no bookkeeping logic of its own, only the agy-calling loop and markdown formatting.

- **`pipelines/youtube/dossiers/prompts.py`** (post-052): `EXTRACTION_PROMPT`, `TOOL_SCHEMA` (verdict now a list), `MERGE_PROMPT`, `DOSSIER_SKELETON` — all read in full already (plan 051's Step 7, plan 052's Step 3).

- **`pipelines/.claude/skills/dossier-build/SKILL.md`** (post-052) — Steps 2 and 3 in full, exactly as they read after plan 052's edits:

  ```markdown
  ## Step 2 -- extract

  For each video id in `registry.pending_extraction()`:

  1. Read `pipelines/youtube/dossiers/videos/<id>/transcript.md` and `meta.json` (for `title`/`channel`/`published`).
  2. Build the prompt: `prompts.EXTRACTION_PROMPT.format(video_id=id, title=meta["title"], channel=meta["channel"], published=meta["published"], transcript=transcript_text)`.
  3. Run it with the chosen method:
     - **agy**: `agy -p "<prompt>" --output-format json --model "<model>"` (direct CLI call -- NOT `tooling/boss/executors/agy.sh`, which is built for boss's async worktree/PR workflow and doesn't fit a synchronous single-prompt call). Capture stdout, pass to `registry.parse_agy_envelope(stdout)`.
     - **subagent**: dispatch a Task/Agent-tool subagent with the prompt and the chosen model; take its final text message, pass to `registry.parse_extraction_output(text)`.
  4. On a `registry.ParseError`: print one error line with the reason, leave this video's `extracted` as `false`, continue to the next video -- don't block the batch.
  5. On success: write `pipelines/youtube/dossiers/videos/<id>/extraction.md` -- one `##` section per tool in the parsed `tools[]` array, using `prompts.TOOL_SCHEMA`'s field names as subheadings, one bullet per item with its `ts` leading (e.g. `- [12:34] plan: VPS 1 -- price: .99/mo`). For each tool in `tools[]`, call `registry.match_tool(tool_name, aliases)`:
     - `("exact", slug)` -- this video mentions `slug`.
     - `("near", slug)` -- hold this tool's data out of `merged_into` for now; add it to the run's "near-duplicate" list (candidate name + matched slug) instead of seeding a status entry.
     - `("none", slug)` -- new tool; call `registry.create_tool_if_new(tool_name, aliases, slug)` immediately (so later videos in this same batch can match against it), note it in the run's "new tools" list, this video mentions `slug`.
  6. Update `meta.json`: `extracted: true`, `merged_into` seeded `false` for every exact/none-matched tool slug from this video (never for near-duplicates, which stay pending until the owner resolves them -- re-run `dossier-build` after that to pick them up).

  ## Step 3 -- merge

  For each tool slug in `registry.all_pending_tools()`:

  1. Gather `pending = registry.pending_merge_for_tool(slug)`.
  2. Read each pending video's `extraction.md`, take only that tool's section.
  3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if `dossier.md` doesn't exist yet. `tool.json` already exists by this point (created during extraction via `create_tool_if_new` — Step 2) — merge no longer creates it.
  4. Build the prompt: `prompts.MERGE_PROMPT.format(tool_name=..., date=today, n=len(pending), dossier=current_text, extractions=concatenated_sections, total_sources=...)`.
  5. Run it with the same method+model chosen in Step 1 (agy direct CLI or subagent, same as extraction). Take the raw markdown response.
  6. Run `registry.merge_guard(current_text, response, pending)`. If it fails: print the reason, leave `merged_into[slug]` unchanged for every video in `pending`, move to the next tool.
  7. If it passes: **write `dossier.md` first**, then flip `merged_into[slug] = true` for every video in `pending` (write-then-flip order -- a crash between these two steps just means the next run re-detects and safely re-merges those videos; the merge prompt's corroboration rule collapses a re-seen claim rather than duplicating it).
  ```

- **`pipelines/.claude/skills/dossier-transcripts/SKILL.md`** (read in full, unaffected by plan 052) — point 3 currently reads:

  ```markdown
  3. Otherwise call the `transcribe` skill's fetch (`cd pipelines && python3 -m common.transcribe fetch <link> --out-dir youtube/dossiers/videos/<id>`), then write `pipelines/youtube/dossiers/videos/<id>/meta.json`:

     ```json
     {
       "id": "<id>",
       "url": "<original link as given>",
       "title": "",
       "channel": "",
       "published": "",
       "fetched_at": "<today, YYYY-MM-DD>",
       "transcript_method": "<captions|groq|local, from the fetch call's JSON output>",
       "extracted": false,
       "merged_into": {}
     }
     ```

     `title`/`channel`/`published` are best-effort: leave them empty strings if
     not available from the link alone -- `dossier-build`'s extraction step
     reads them from the transcript itself and doesn't require them pre-filled.
  ```

  The last paragraph's claim is false — `dossier-build` never reads title/channel/published from a transcript anywhere in its `SKILL.md` or in `registry.py`/`prompts.py`. Verified live today: 9/9 videos needed a manual `yt-dlp --skip-download --print "%(title)s|||%(channel)s|||%(upload_date)s" <url>` call outside the documented pipeline to get real citation months.

- **`pipelines/common/transcribe.py`** (read in full, plan 051's Step 1) — has `video_id_from()`, `fetch()`, a `main()` with one `fetch` subparser. `yt-dlp` is already a dependency of this module (`fetch_youtube_audio()` calls it) and confirmed present on this machine (`which yt-dlp` -> `/Library/Frameworks/Python.framework/Versions/3.11/bin/yt-dlp`, used live today: `yt-dlp --skip-download --print "%(title)s|||%(channel)s|||%(upload_date)s" "https://www.youtube.com/watch?v=9SOlS-0syLc"` -> `Photorealistic AI Avatars? Veo 3, Heygen, Hedra Or Seedance?|||Samuel Sotiega|||20250725`, confirming the exact field order and `YYYYMMDD` date format).

- **`pipelines/common/tests/test_transcribe.py`** (read in full, plan 051's Step 3) — mocks `common.transcribe.subprocess.run`/`_try_captions`/etc. with `unittest.mock.patch`; no network, no real `yt-dlp`/`ffmpeg` calls.

- **Live-run lesson directly relevant here** (`plans/runs/LESSONS.md`, 2026-07-06 agy entry): "headless print mode does NOT bind cwd as workspace... default `--print-timeout` is 5m... `--output-format json` (hidden flag) is the only way to get usage + `conversation_id`." That lesson is about `agy`'s use as a **file-editing** executor (needs `--add-dir`). This plan's `agy` calls are pure text-in/text-out prompts (extraction/merge) that write no files themselves — `run.py` writes the files after receiving the response — so `--add-dir` does not apply here; only the `--output-format json` hidden-flag point carries over. This distinction is called out explicitly in `run.py`'s docstring (Step 1 below) so a future reader doesn't conflate the two `agy` usage patterns.

- **Uncommitted working-tree state** (do not touch): same as plan 052's Current state — `pipelines/youtube/dossiers/videos/` and `tools/` (9 + 23 folders) and `.last-method.json` are live, untracked data from today's run.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run both test suites | `python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q` | exit 0 |
| `run.py` CLI smoke test | `cd pipelines/youtube/dossiers && python3 run.py extract --help && python3 run.py merge --help` | usage text, exit 0 |
| `transcribe.py metadata` CLI smoke test | `cd pipelines && python3 -m common.transcribe metadata --help` | usage text, exit 0 |
| Confirm plan 052 landed (precondition) | `python3 -c "import sys; sys.path.insert(0,'pipelines/youtube/dossiers'); import registry; assert hasattr(registry, 'create_tool_if_new')"` | no output, exit 0 |

## Scope

**In scope**:
- `pipelines/youtube/dossiers/run.py` (new)
- `pipelines/youtube/dossiers/tests/test_run.py` (new)
- `pipelines/common/transcribe.py` (edit — add `fetch_metadata()` + `metadata` subcommand)
- `pipelines/common/tests/test_transcribe.py` (extend)
- `pipelines/.claude/skills/dossier-build/SKILL.md` (edit — replace Steps 2 and 3)
- `pipelines/.claude/skills/dossier-transcripts/SKILL.md` (edit — point 3)

**Out of scope**:
- `pipelines/youtube/dossiers/registry.py`, `prompts.py` — plan 052's territory, read-only here.
- `pipelines/youtube/dossiers/videos/**`, `pipelines/youtube/dossiers/tools/**`, `.last-method.json` — live, uncommitted research data. Do not touch.
- `pipelines/youtube/dossiers/CLAUDE.md`, `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` — no further edits needed here (052 already covers the design-doc-sync requirement for its own changes; this plan's changes are implementation-only, not a redesign).
- A subagent-dispatch driver script — subagents are dispatched by a Claude Code session, not a Python subprocess; that path stays prose-instructed in `SKILL.md` (see Step 3 below), matching the existing hard rule that both `agy` and subagent are valid dispatch methods.

## Git workflow

- Branch: `advisor/053-dossier-build-driver-script-and-metadata`
- Commit: `feat(dossiers): real extract/merge driver script + real video metadata + agy retry` — no AI footers. Do NOT push.

## Steps

### Step 1: `pipelines/youtube/dossiers/run.py`

Create the file:

```python
#!/usr/bin/env python3
"""Driver for the dossier-build pipeline: implements the extraction and merge
loop described in pipelines/.claude/skills/dossier-build/SKILL.md, using
registry.py's parse/guard/match functions and prompts.py's prompt templates.
Only ever calls the agy CLI - never a direct paid API (hard rule, see
pipelines/youtube/dossiers/CLAUDE.md).

CLI:
    cd pipelines/youtube/dossiers
    python3 run.py extract --model "<agy model name>"
    python3 run.py merge   --model "<agy model name>"

agy usage notes (discovered by testing; not fully documented in `agy --help`):
    - `--output-format json` is a real, working flag that does not appear in
      `agy --help` - it's the only way to get the {"status", "response",
      "usage", "conversation_id"} envelope this script needs; without it agy
      prints plain text with no machine-readable status.
    - Exact model name strings come from `agy models` (e.g. "Gemini 3.1 Pro
      (High)", "Gemini 3.5 Flash (High)", "Claude Sonnet 4.6 (Thinking)") -
      free-text names like "gemini-pro" are not accepted.
    - No `--add-dir` is needed here, unlike boss's agy.sh executor pattern:
      these are pure text-in/text-out prompt calls (extraction/merge) that
      write no files themselves - this script writes the files after
      receiving the response. `--add-dir` matters for agy calls that edit
      files directly, which this workflow never does.
    - A transient hang/timeout on one call does not necessarily mean the
      model or account is down - see _call_agy's retry logic below (observed
      2026-07-08: one merge call hung 600+s and timed out, then succeeded in
      ~6s on an immediate retry).
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import registry
import prompts

AGY_TIMEOUT_SECONDS = 900
AGY_MAX_ATTEMPTS = 2

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _call_agy(prompt, model):
    """Call agy once, retrying once on a subprocess timeout or non-zero exit
    (see this module's docstring - a transient hang is not necessarily model
    failure). Returns raw stdout (the JSON envelope), or raises RuntimeError
    after all attempts are exhausted."""
    last_error = None
    for attempt in range(1, AGY_MAX_ATTEMPTS + 1):
        try:
            result = subprocess.run(
                ["agy", "-p", prompt, "--output-format", "json", "--model", model],
                capture_output=True, text=True, timeout=AGY_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            last_error = f"agy call timed out after {AGY_TIMEOUT_SECONDS}s (attempt {attempt}/{AGY_MAX_ATTEMPTS})"
            continue
        if result.returncode != 0:
            last_error = f"agy exited {result.returncode}: {result.stderr[:300]} (attempt {attempt}/{AGY_MAX_ATTEMPTS})"
            continue
        return result.stdout
    raise RuntimeError(last_error)


def _month_year(published):
    """'2026-03-06' -> 'Mar 2026'; '' or malformed -> 'unknown'."""
    try:
        y, m, _d = published.split("-")
        return f"{MONTH_NAMES[int(m) - 1]} {y}"
    except (ValueError, IndexError):
        return "unknown"


def _format_items(items):
    """Generic bullet formatter: each item is a dict with 'ts' plus arbitrary
    other fields. Real model output uses inconsistent keys per item across
    videos (e.g. 'claim' vs 'text' vs 'recommendation'+'reasoning') - this
    formats any of them the same way, since registry.parse_extraction_output
    only requires 'ts' to be present, not any specific other key."""
    if not items:
        return ["- (none)"]
    lines = []
    for it in items:
        ts = it.get("ts", "")
        parts = [f"{k}: {v}" for k, v in it.items() if k != "ts" and v]
        lines.append(f"- [{ts}] " + " -- ".join(parts))
    return lines


def _write_extraction_md(tools_with_headers):
    """tools_with_headers: list of (header, tool_dict) pairs - the header is
    the CANONICAL tool name (registry.load_tool(slug)['name']) for exact/none
    matches, or the literal extracted name for a held-pending near-duplicate
    (see cmd_extract). Using the canonical name as the section header means
    cmd_merge can always recompute the exact header to look for from
    registry.load_tool(slug)['name'] alone - no extra bookkeeping needed."""
    sections = []
    for header, t in tools_with_headers:
        sec = [f"## {header}"]
        for field in registry.LIST_FIELDS:
            sec.append(f"\n### {field}")
            sec += _format_items(t.get(field, []))
        sections.append("\n".join(sec))
    return "\n\n".join(sections) + "\n"


def _get_section(extraction_md_text, header):
    pattern = re.compile(rf"^## {re.escape(header)}\n(.*?)(?=^## |\Z)", re.DOTALL | re.MULTILINE)
    m = pattern.search(extraction_md_text)
    if not m:
        raise RuntimeError(f"section {header!r} not found in extraction.md")
    return f"## {header}\n" + m.group(1).rstrip() + "\n"


def cmd_extract(model):
    pending = registry.pending_extraction()
    print(f"{len(pending)} videos pending extraction", file=sys.stderr)
    new_tools, near_dupes = [], []

    for vid in pending:
        meta = registry.load_meta(vid)
        try:
            transcript_text = (registry.VIDEOS_DIR / vid / "transcript.md").read_text()
            prompt = prompts.EXTRACTION_PROMPT.format(
                video_id=vid, title=meta.get("title", ""), channel=meta.get("channel", ""),
                published=meta.get("published", ""), transcript=transcript_text,
            )
            raw_stdout = _call_agy(prompt, model)
            data = registry.parse_agy_envelope(raw_stdout)
        except Exception as e:
            print(f"EXTRACT_FAILED:{vid}:{e}", file=sys.stderr)
            continue

        merged_into = meta.get("merged_into", {})
        tools_with_headers = []
        for t in data["tools"]:
            name, aliases = t["tool_name"], t.get("aliases", [])
            kind, slug = registry.match_tool(name, aliases)
            if kind == "near":
                near_dupes.append((name, slug, vid))
                tools_with_headers.append((name, t))
                continue
            if kind == "none":
                registry.create_tool_if_new(name, aliases, slug)
                new_tools.append((slug, name, vid))
            canonical_name = registry.load_tool(slug)["name"]
            tools_with_headers.append((canonical_name, t))
            merged_into[slug] = False

        (registry.VIDEOS_DIR / vid / "extraction.md").write_text(_write_extraction_md(tools_with_headers))
        meta["extracted"] = True
        meta["merged_into"] = merged_into
        registry.save_meta(vid, meta)
        print(f"EXTRACTED:{vid} ({len(tools_with_headers)} tools)", file=sys.stderr)

    print(json.dumps({"new_tools": new_tools, "near_duplicates": near_dupes}))


def cmd_merge(model):
    today = date.today().isoformat()
    pending_tools = registry.all_pending_tools()
    print(f"{len(pending_tools)} tools pending merge", file=sys.stderr)
    merged, guard_failed, new_folders = [], [], []

    for slug in pending_tools:
        pending = registry.pending_merge_for_tool(slug)
        if not pending:
            continue
        tool_info = registry.load_tool(slug)
        dossier_path = registry.TOOLS_DIR / slug / "dossier.md"
        is_new = not dossier_path.exists()
        current_text = (prompts.DOSSIER_SKELETON.format(tool_name=tool_info["name"], date=today, n=0, newest="—")
                        if is_new else dossier_path.read_text())
        if is_new:
            new_folders.append(slug)

        try:
            parts = []
            for vid in pending:
                meta = registry.load_meta(vid)
                extraction_text = (registry.VIDEOS_DIR / vid / "extraction.md").read_text()
                section = _get_section(extraction_text, tool_info["name"])
                parts.append(f"### Source video: {vid} (published: {_month_year(meta.get('published', ''))})\n{section}")
            extractions_text = "\n\n".join(parts)

            prompt = prompts.MERGE_PROMPT.format(
                tool_name=tool_info["name"], date=today, n=len(pending),
                dossier=current_text, extractions=extractions_text, total_sources=len(pending),
            )
            raw_stdout = _call_agy(prompt, model)
            envelope = json.loads(raw_stdout)
            if envelope.get("status") != "SUCCESS" or not envelope.get("response"):
                raise RuntimeError(f"agy status {envelope.get('status')!r} or empty response")
            new_dossier = envelope["response"]
        except Exception as e:
            guard_failed.append((slug, str(e)))
            print(f"MERGE_FAILED:{slug}:{e}", file=sys.stderr)
            continue

        ok, reason = registry.merge_guard(current_text, new_dossier, pending)
        if not ok:
            guard_failed.append((slug, reason))
            print(f"GUARD_FAIL:{slug}:{reason}", file=sys.stderr)
            continue

        dossier_path.parent.mkdir(parents=True, exist_ok=True)
        dossier_path.write_text(new_dossier)
        for vid in pending:
            m = registry.load_meta(vid)
            m["merged_into"][slug] = True
            registry.save_meta(vid, m)
        merged.append(slug)
        print(f"MERGED:{slug} ({len(pending)} videos)", file=sys.stderr)

    print(json.dumps({"merged": merged, "guard_failed": guard_failed, "new_folders": new_folders}))


def main():
    p = argparse.ArgumentParser(prog="run")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("extract", "merge"):
        sp = sub.add_parser(name)
        sp.add_argument("--model", required=True)
    args = p.parse_args()
    (cmd_extract if args.cmd == "extract" else cmd_merge)(args.model)


if __name__ == "__main__":
    main()
```

**Verify**: `cd pipelines/youtube/dossiers && python3 run.py extract --help && python3 run.py merge --help` -> usage text for both, exit 0.

### Step 2: `pipelines/youtube/dossiers/tests/test_run.py`

Create the file (pure-logic helpers only, mocked `subprocess` for `_call_agy` — matches plan 051's stated testing boundary: the model call itself isn't deterministically mockable for correctness, but the retry mechanics are):

```python
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import run


def test_month_year_formats_correctly():
    assert run._month_year("2026-03-06") == "Mar 2026"
    assert run._month_year("2025-12-30") == "Dec 2025"


def test_month_year_handles_missing_or_malformed():
    assert run._month_year("") == "unknown"
    assert run._month_year("not-a-date") == "unknown"


def test_format_items_empty_list():
    assert run._format_items([]) == ["- (none)"]


def test_format_items_generic_keys():
    items = [{"ts": "01:00", "claim": "fast"}, {"ts": "02:00", "recommendation": "buy it", "reasoning": "cheap"}]
    lines = run._format_items(items)
    assert lines[0] == "- [01:00] claim: fast"
    assert lines[1] == "- [02:00] recommendation: buy it -- reasoning: cheap"


def test_write_extraction_md_uses_given_header():
    tools_with_headers = [("HeyGen", {"strengths": [{"ts": "01:00", "claim": "good"}]})]
    md = run._write_extraction_md(tools_with_headers)
    assert md.startswith("## HeyGen")
    assert "### strengths" in md
    assert "- [01:00] claim: good" in md


def test_get_section_extracts_only_that_tool():
    md = "## HeyGen\ncontent A\n\n## Synthesia\ncontent B\n"
    section = run._get_section(md, "HeyGen")
    assert "content A" in section
    assert "content B" not in section


def test_get_section_raises_when_missing():
    try:
        run._get_section("## Other\nx\n", "HeyGen")
        assert False, "expected RuntimeError"
    except RuntimeError:
        pass


def test_call_agy_succeeds_first_try():
    fake = MagicMock(returncode=0, stdout='{"status": "SUCCESS", "response": "ok"}', stderr="")
    with patch("run.subprocess.run", return_value=fake) as mock_run:
        out = run._call_agy("prompt", "Gemini 3.1 Pro (High)")
    assert out == '{"status": "SUCCESS", "response": "ok"}'
    mock_run.assert_called_once()


def test_call_agy_retries_once_on_timeout_then_succeeds():
    import subprocess as sp
    fake_success = MagicMock(returncode=0, stdout='{"status": "SUCCESS", "response": "ok"}', stderr="")
    with patch("run.subprocess.run", side_effect=[sp.TimeoutExpired(cmd="agy", timeout=900), fake_success]) as mock_run:
        out = run._call_agy("prompt", "Gemini 3.1 Pro (High)")
    assert out == '{"status": "SUCCESS", "response": "ok"}'
    assert mock_run.call_count == 2


def test_call_agy_raises_after_all_attempts_fail():
    import subprocess as sp
    with patch("run.subprocess.run", side_effect=sp.TimeoutExpired(cmd="agy", timeout=900)) as mock_run:
        try:
            run._call_agy("prompt", "Gemini 3.1 Pro (High)")
            assert False, "expected RuntimeError"
        except RuntimeError as e:
            assert "timed out" in str(e)
    assert mock_run.call_count == run.AGY_MAX_ATTEMPTS
```

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests/test_run.py -v` -> 10 passed.

### Step 3: `pipelines/common/transcribe.py` — add `fetch_metadata()`

Add this function directly after `fetch_youtube_audio()`:

```python
def fetch_metadata(video_id_or_url):
    """Fetch title/channel/publish-date for a YouTube video via yt-dlp.
    Returns {"title": str, "channel": str, "published": "YYYY-MM-DD"} - all
    empty strings if yt-dlp fails (private/deleted video, network error) or
    returns an unexpected shape. Best-effort: never raises, never blocks a
    transcript fetch (dossier-transcripts calls this after fetch(), not
    instead of it)."""
    video_id = video_id_from(video_id_or_url)
    try:
        r = subprocess.run(
            ["yt-dlp", "--skip-download", "--print", "%(title)s|||%(channel)s|||%(upload_date)s",
             f"https://youtu.be/{video_id}"],
            capture_output=True, text=True, timeout=30, check=True,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return {"title": "", "channel": "", "published": ""}
    line = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
    parts = line.split("|||")
    if len(parts) != 3:
        return {"title": "", "channel": "", "published": ""}
    title, channel, upload_date = parts
    published = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}" if len(upload_date) == 8 else ""
    return {"title": title, "channel": channel, "published": published}
```

Then in `main()`, add a `metadata` subparser and dispatch. Replace:
```python
def main():
    p = argparse.ArgumentParser(prog="transcribe")
    sub = p.add_subparsers(dest="cmd", required=True)
    fetch_p = sub.add_parser("fetch")
    fetch_p.add_argument("video")
    fetch_p.add_argument("--method", choices=["auto", "captions", "groq", "local"], default="auto")
    fetch_p.add_argument("--out-dir", default=None)
    args = p.parse_args()
    text, method_used = fetch(args.video, method=args.method, out_dir=args.out_dir)
    out_dir = Path(args.out_dir) if args.out_dir else Path(".")
    out_dir.mkdir(parents=True, exist_ok=True)
    vid = video_id_from(args.video)
    out_path = out_dir / "transcript.md"
    out_path.write_text(text)
    print(json.dumps({"video_id": vid, "path": str(out_path), "method": method_used}))
```
with:
```python
def main():
    p = argparse.ArgumentParser(prog="transcribe")
    sub = p.add_subparsers(dest="cmd", required=True)
    fetch_p = sub.add_parser("fetch")
    fetch_p.add_argument("video")
    fetch_p.add_argument("--method", choices=["auto", "captions", "groq", "local"], default="auto")
    fetch_p.add_argument("--out-dir", default=None)
    meta_p = sub.add_parser("metadata")
    meta_p.add_argument("video")
    args = p.parse_args()
    if args.cmd == "fetch":
        text, method_used = fetch(args.video, method=args.method, out_dir=args.out_dir)
        out_dir = Path(args.out_dir) if args.out_dir else Path(".")
        out_dir.mkdir(parents=True, exist_ok=True)
        vid = video_id_from(args.video)
        out_path = out_dir / "transcript.md"
        out_path.write_text(text)
        print(json.dumps({"video_id": vid, "path": str(out_path), "method": method_used}))
    elif args.cmd == "metadata":
        vid = video_id_from(args.video)
        print(json.dumps({"video_id": vid, **fetch_metadata(args.video)}))
```

**Verify**: `cd pipelines && python3 -m common.transcribe metadata --help` -> usage text, exit 0.

### Step 4: Extend `pipelines/common/tests/test_transcribe.py`

Add these tests (append at the end of the file):

```python


def test_fetch_metadata_parses_yt_dlp_output():
    fake = MagicMock(returncode=0, stdout="Some Title|||Some Channel|||20260306\n")
    with patch("common.transcribe.subprocess.run", return_value=fake):
        meta = transcribe.fetch_metadata("dQw4w9WgXcQ")
    assert meta == {"title": "Some Title", "channel": "Some Channel", "published": "2026-03-06"}


def test_fetch_metadata_returns_empty_on_yt_dlp_failure():
    import subprocess
    with patch("common.transcribe.subprocess.run", side_effect=subprocess.CalledProcessError(1, "yt-dlp")):
        meta = transcribe.fetch_metadata("dQw4w9WgXcQ")
    assert meta == {"title": "", "channel": "", "published": ""}


def test_fetch_metadata_returns_empty_on_timeout():
    import subprocess
    with patch("common.transcribe.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="yt-dlp", timeout=30)):
        meta = transcribe.fetch_metadata("dQw4w9WgXcQ")
    assert meta == {"title": "", "channel": "", "published": ""}


def test_fetch_metadata_returns_empty_on_malformed_output():
    fake = MagicMock(returncode=0, stdout="only one field\n")
    with patch("common.transcribe.subprocess.run", return_value=fake):
        meta = transcribe.fetch_metadata("dQw4w9WgXcQ")
    assert meta == {"title": "", "channel": "", "published": ""}
```

**Verify**: `python3 -m pytest pipelines/common/tests/test_transcribe.py -v` -> 12 passed (8 existing + 4 new).

### Step 5: `pipelines/.claude/skills/dossier-build/SKILL.md` — point Steps 2/3 at `run.py`

Replace the entire Step 2 and Step 3 sections (the full text quoted in Current state above) with:

```markdown
## Step 2 -- extract

Run: `cd pipelines/youtube/dossiers && python3 run.py extract --model "<model>"` (this is the `agy` path — see Step 1. If the owner chose "subagent" instead, dispatch one Task/Agent-tool subagent per `registry.pending_extraction()` video, using the same `prompts.EXTRACTION_PROMPT` + `registry.parse_extraction_output` contract `run.py` implements — read `run.py`'s `cmd_extract` for the exact per-video logic to mirror: build the prompt, get the model's final text, parse it, resolve each tool via `registry.match_tool`/`registry.create_tool_if_new`, write `extraction.md`, update `meta.json`).

`run.py extract` builds the extraction prompt per pending video, calls `agy` (retrying once on a transient timeout or failure), parses the result via `registry.parse_agy_envelope`, writes `extraction.md` (one `##` section per tool, headed by its canonical name), resolves each tool via `registry.match_tool` — creating new tool folders immediately via `registry.create_tool_if_new` so later videos in the *same* batch can match against them — and updates `meta.json` (`extracted: true`, `merged_into` seeded). A per-video failure is logged to stderr as `EXTRACT_FAILED:<video_id>:<reason>` and does not block the rest of the batch. It prints one final JSON line to stdout: `{"new_tools": [[slug, name, video_id], ...], "near_duplicates": [[name, slug, video_id], ...]}` — read this for Step 4's report.

## Step 3 -- merge

Run: `cd pipelines/youtube/dossiers && python3 run.py merge --model "<model>"` (same agy-vs-subagent split as Step 2 — for a subagent run, dispatch one subagent per `registry.all_pending_tools()` slug using the same `prompts.MERGE_PROMPT` + `registry.merge_guard` contract `run.py`'s `cmd_merge` implements).

`run.py merge` gathers each pending video's `extraction.md` section for that tool, calls `agy` (same retry behavior as extraction), checks `registry.merge_guard`, and on success writes `dossier.md` before flipping `merged_into[slug] = true` for every video in that merge batch (write-then-flip order is unchanged from the original design — a crash between the two just means the next run re-detects and safely re-merges those videos). It prints one final JSON line to stdout: `{"merged": [slug, ...], "guard_failed": [[slug, reason], ...], "new_folders": [slug, ...]}` — read this for Step 4's report.
```

**Verify**: `grep -c "run.py" pipelines/.claude/skills/dossier-build/SKILL.md` -> at least `4`.

### Step 6: `pipelines/.claude/skills/dossier-transcripts/SKILL.md` — real metadata

Replace point 3 in full:

```markdown
3. Otherwise call the `transcribe` skill's fetch (`cd pipelines && python3 -m common.transcribe fetch <link> --out-dir youtube/dossiers/videos/<id>`), then write `pipelines/youtube/dossiers/videos/<id>/meta.json`:

   ```json
   {
     "id": "<id>",
     "url": "<original link as given>",
     "title": "",
     "channel": "",
     "published": "",
     "fetched_at": "<today, YYYY-MM-DD>",
     "transcript_method": "<captions|groq|local, from the fetch call's JSON output>",
     "extracted": false,
     "merged_into": {}
   }
   ```

   `title`/`channel`/`published` are best-effort: leave them empty strings if
   not available from the link alone -- `dossier-build`'s extraction step
   reads them from the transcript itself and doesn't require them pre-filled.
```

with:

```markdown
3. Otherwise call the `transcribe` skill's fetch (`cd pipelines && python3 -m common.transcribe fetch <link> --out-dir youtube/dossiers/videos/<id>`), then call `cd pipelines && python3 -m common.transcribe metadata <link>` to get `{"video_id", "title", "channel", "published"}` (`published` is `YYYY-MM-DD`; a `yt-dlp` failure returns empty strings for all three — best-effort, never blocks the transcript fetch), then write `pipelines/youtube/dossiers/videos/<id>/meta.json`:

   ```json
   {
     "id": "<id>",
     "url": "<original link as given>",
     "title": "<title from the metadata call, or empty if it failed>",
     "channel": "<channel from the metadata call, or empty if it failed>",
     "published": "<published from the metadata call, YYYY-MM-DD, or empty if it failed>",
     "fetched_at": "<today, YYYY-MM-DD>",
     "transcript_method": "<captions|groq|local, from the fetch call's JSON output>",
     "extracted": false,
     "merged_into": {}
   }
   ```

   `dossier-build`'s merge step cites each claim's source video by publish
   month, so a real `published` date matters for citation accuracy — this is
   why it's fetched here rather than left for a later step to backfill.
```

**Verify**: `grep -c "transcribe metadata" pipelines/.claude/skills/dossier-transcripts/SKILL.md` -> `1`.

## Test plan

Steps 2 and 4 are the automated test plan — pure-logic helpers (`_month_year`, `_format_items`, `_get_section`, `_call_agy`'s retry mechanics, `fetch_metadata`'s parsing/failure modes), all mocked, no network, no `agy`/`yt-dlp` binary required. Matching plan 051's own stated testing boundary, `cmd_extract`/`cmd_merge`'s top-level orchestration (mostly glue over already-tested `registry.py` functions plus one real model call) is verified behaviorally — the owner running one real `dossier-build` pass and checking the resulting `extraction.md`/`dossier.md` — not by pytest.

## Done criteria

- [ ] `python3 -m pytest pipelines/common/tests pipelines/youtube/dossiers/tests -q` exits 0.
- [ ] `cd pipelines/youtube/dossiers && python3 run.py extract --help && python3 run.py merge --help` exit 0.
- [ ] `cd pipelines && python3 -m common.transcribe metadata --help` exits 0.
- [ ] `pipelines/.claude/skills/dossier-build/SKILL.md` Steps 2/3 reference `run.py`, not the old prose loop.
- [ ] `pipelines/.claude/skills/dossier-transcripts/SKILL.md` no longer contains the false "reads them from the transcript" claim.
- [ ] No file under `pipelines/youtube/dossiers/videos/` or `pipelines/youtube/dossiers/tools/` was created, modified, or deleted.

## STOP conditions

- Plan 052 hasn't landed (`registry.create_tool_if_new` missing) — stop immediately per the drift-check precondition; do not attempt to patch registry.py yourself as part of this plan.
- Any quoted excerpt (a code block, a line/section to replace) doesn't match the file on disk exactly — stop; don't guess a new anchor.
- `pipelines/youtube/dossiers/videos/` or `pipelines/youtube/dossiers/tools/` contents look different from "9 video folders, 23 tool folders, all untracked" — stop and report; this plan must not touch live research data.
- A non-stdlib package is needed for any of this — stop; stdlib-only is a hard constraint (matches plan 051's precedent — `yt-dlp` is a system binary, not a Python package).
- The `agy` binary is not found on `PATH` when smoke-testing — stop and report; do not attempt a real `dossier-build` run as part of this plan's verification (Done criteria only require the `--help` smoke tests, not a live model call).

## Maintenance notes

- `AGY_TIMEOUT_SECONDS = 900` and `AGY_MAX_ATTEMPTS = 2` are data points from one observed hang today, not a proven-optimal tuning — if hangs recur often at a different duration, adjust here.
- `run.py` deliberately has no `--dry-run` or partial-batch flags — it always processes everything `registry.pending_extraction()`/`all_pending_tools()` returns. If a future need arises to test against one video without touching the rest of a real batch, that's a small, separate addition (an optional `--video-id`/`--tool` filter flag), not implied by anything in this plan.
- `fetch_metadata()`'s `YYYYMMDD` parsing assumes `yt-dlp`'s `%(upload_date)s` format holds (verified live today across all 9 real videos) — if `yt-dlp` changes that format in a future version, the length-8 check in `fetch_metadata` will start returning empty `published` values (fails safe, not silently wrong) rather than crashing.
- The subagent dispatch path in `dossier-build`'s `SKILL.md` (Step 5 of this plan) is now a pointer at `run.py`'s logic rather than fully independent prose — if `run.py`'s per-tool/per-video logic changes materially in a future plan, re-check that pointer still describes it accurately.
