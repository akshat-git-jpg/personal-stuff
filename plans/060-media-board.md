---
executor: agy
model:
test_cmd: node --test pipelines/.claude/skills/media-board/test/media-board.test.mjs
ui: true
deploy:
needs: []
---

# Plan 060: media-board — local cockpit for generated video/audio/image assets

## Summary

- **Problem statement**: Generated media (avatar renders, voiceovers, base clips, character
  images) now lives in `~/kb-scratch/video/{tts,heygen}/` with tracked markdown manifests in
  the repo hubs — but a `.md` manifest isn't clickable. The owner has no fast way to SEE what
  has been generated.
- **Goals**:
  - A zero-dependency localhost gallery (`media-board`) that scans both hubs' kb-scratch
    output trees plus the repo-side reference assets, joins files against the manifest
    tables, and renders a browsable grid with inline video/audio/image players.
  - Drag-out support: drag an asset from the page into Finder or an upload target
    (Chromium `DownloadURL`), plus per-card **Reveal in Finder**, **Download**, and
    **Copy path** buttons.
  - A `media-board` skill (pinterest-board pattern) so "open my media board" starts it.
- **Executor proposed**: `agy` / executor-default model (Gemini Pro) — owner's explicit pick; the plan is fully inlined, which is agy's documented sweet spot (plans/runs/LESSONS.md 2026-07-09). Difficulty: standard.
- **Done criteria** (terse): `node --test …/media-board.test.mjs` exits 0; server serves
  `/`, `/api/media`, `/file` (with Range), `/api/reveal`; UI rubric passes; skill + symlink +
  doc rows in place.
- **Stop conditions** (terse): missing kb-scratch roots, port conflicts beyond fallback,
  any need to write to media files — stop, don't improvise.
- **Test / verification for success**: unit tests over the pure functions (table parser,
  scanner, path guard, range parser) + a scripted HTTP smoke against a fixture root +
  screenshot for the PR (ui: true).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 0fffe42..HEAD -- pipelines/.claude/skills/media-board .claude/skills/media-board pipelines/video/tts/CLAUDE.md pipelines/video/heygen/CLAUDE.md CLAUDE.md`
> If files under `pipelines/.claude/skills/media-board/` already exist with content this
> plan doesn't describe, STOP and report drift.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (hubs already exist as of `0fffe42`)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `0fffe42`, 2026-07-12

## Why this matters

The owner reviews every generated render/voiceover by eye and ear before using it. The new
asset-hub convention (decisions.md 2026-07-12) deliberately keeps media out of the repo, so
the tracked manifests (`RENDERS.md`, `OUTPUTS.md`) are text-only records. Without a viewer,
"what did I generate last week?" means spelunking Finder across nested folders with no
manifest context. This board is the visual index: one page, every asset, playable in place,
draggable out to wherever it gets uploaded. It follows the proven `pinterest-board` cockpit
pattern (same repo, same stack) so maintenance knowledge transfers.

## Current state

- **Exemplar (match its style and structure)**: `pipelines/.claude/skills/pinterest-board/serve.mjs`
  — zero-dep Node http server, `arg()` flag helper, `ROOT`/`PORT` config, JSON API + single
  inline `PAGE` HTML template, dark-theme cockpit CSS, path-guarded image endpoint
  (`if (!f.startsWith(ROOT) …) return 404`). Its `SKILL.md` shows the skill shape.
- **Media roots to scan** (all may be partially empty; scanner must tolerate missing dirs):
  - `~/kb-scratch/video/heygen/` — outputs; today holds `_test/{girl-1,girl-2,test-man,avatar-3,fal-lipsync}/` with `.mp4`s and one `.wav`.
  - `~/kb-scratch/video/tts/` — outputs; today holds only `_test/` (empty) — the board must render an empty state, not crash.
  - `pipelines/video/heygen/characters/` — tracked reference images (`<slug>/source.jpeg`).
  - `pipelines/video/heygen/fal-lipsync/` — tracked pose images (`pose-*.png`, `avatar-side.jpeg`).
  - `pipelines/video/tts/references/` — tracked reference voices (`.wav` + `.txt` transcripts).
- **Manifests to join**:
  - `pipelines/video/heygen/RENDERS.md` — pipe table under `## Videos generated`, columns
    `| Output file | Avatar / template | Audio | video_id |`. Example row:
    `| \`test-man/harry-intro__cb3a91d35fde44c8a32c04e0abb22710.mp4\` | Harry | test-man intro | \`514febe2ef2f4c16a03068aaf04c1852\` |`
    Paths are relative to `~/kb-scratch/video/heygen/_test/`; some rows say `(pending download)`.
  - `pipelines/video/tts/OUTPUTS.md` — pipe table with columns
    `| Date | Output file (under ~/kb-scratch/video/tts/) | Pipeline | Engine | Ref voice (slug) | Source / notes |`. Currently header-only (no data rows) — parser must return `[]`.
- **Registry for extra context**: `pipelines/video/heygen/registry.json` — slug → ids/description; join is OPTIONAL v1 (show manifest columns as-is; do not build a registry join).
- **Skill linking convention**: pipelines-domain skills live in `pipelines/.claude/skills/<name>/`
  with a relative symlink from `.claude/skills/<name>` (verify: `ls -la .claude/skills/pinterest-board`).
- **Node**: v22.14.0. KNOWN BUG (plans/runs/LESSONS.md 2026-07-09): `node --test <dir>` fails
  on this version — always pass the explicit `.test.mjs` file path.
- **Port**: pinterest-board uses 4000. media-board uses **4100** (decision made here).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests (THE merge gate) | `node --test pipelines/.claude/skills/media-board/test/media-board.test.mjs` | exit 0, all tests pass |
| Syntax check | `node --check pipelines/.claude/skills/media-board/serve.mjs` | exit 0, no output |
| Start server | `node pipelines/.claude/skills/media-board/serve.mjs --port 4100` | logs `Media board → http://localhost:4100` |
| API smoke | `curl -s http://localhost:4100/api/media \| head -c 200` | JSON starting `{"sources":` |
| Symlink check | `ls -la .claude/skills/media-board` | `-> ../../pipelines/.claude/skills/media-board` |

## Scope

**In scope** (the only files to create/touch):
- `pipelines/.claude/skills/media-board/SKILL.md` (new)
- `pipelines/.claude/skills/media-board/serve.mjs` (new)
- `pipelines/.claude/skills/media-board/test/media-board.test.mjs` (new)
- `.claude/skills/media-board` (new symlink)
- `pipelines/video/tts/CLAUDE.md`, `pipelines/video/heygen/CLAUDE.md` (one "browse via media-board" line each)
- `CLAUDE.md` (root — one Find-it-fast row)
- `plans/README.md` (status row update at the end)

**Out of scope** (looks related — do NOT touch):
- `RENDERS.md` / `OUTPUTS.md` / `registry.json` content — the board is strictly read-only.
- `pipelines/.claude/skills/pinterest-board/` — exemplar only.
- Anything under `~/kb-scratch/` — never write, move, or rename media.
- No npm packages, no package.json — Node built-ins only (repo convention for cockpits).

## Git workflow

- Branch: `advisor/060-media-board`
- Commits: one per step, conventional single-line messages (e.g. `feat(media-board): scanner + manifest join`) — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold the skill folder + symlink

Create `pipelines/.claude/skills/media-board/SKILL.md`:

```markdown
---
name: media-board
description: Open the local media board — a localhost gallery of every generated video/voiceover/image across the tts + heygen asset hubs (~/kb-scratch/video/ + repo reference assets), joined with the RENDERS.md/OUTPUTS.md manifests. Inline players, filters, drag an asset out to Finder or an upload page. Triggers on "open my media board", "show my renders", "show my generated media", "what have I generated", "media cockpit", "media-board".
---

# media-board

Start the server and open the browser:

    node pipelines/.claude/skills/media-board/serve.mjs &
    open http://localhost:4100

Flags: `--port <n>` (default 4100), `--kb-root <path>` (default `~/kb-scratch/video`),
`--repo-root <path>` (default: the repo root resolved from this file's location).
Strictly read-only over media and manifests; the only write action is `open -R` (Reveal in
Finder). Stop it with Ctrl-C / kill; it holds no state.
```

Create the symlink (relative, matching pinterest-board):
`ln -s ../../pipelines/.claude/skills/media-board .claude/skills/media-board`

**Verify**: `ls -la .claude/skills/media-board` → symlink to `../../pipelines/.claude/skills/media-board`

### Step 2: serve.mjs — config, scanner, manifest parser (exported pure functions)

Create `serve.mjs` following the exemplar's layout. Structural requirement: export the pure
functions and only start the server when run directly, so tests can import:

```js
import { pathToFileURL } from "node:url";
// … all function definitions …
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) startServer();
```

Source configuration (inline exactly this shape; `KB_ROOT` = `--kb-root` flag or
`MEDIA_KB_ROOT` env or `~/kb-scratch/video`; `REPO_ROOT` = `--repo-root` flag or resolved
`../../../..` from `serve.mjs`'s directory, which is the repo root):

```js
const EXT = {
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".m4a"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
};
const sources = () => [
  { id: "heygen-outputs", hub: "heygen", kind: "outputs",    root: path.join(KB_ROOT, "heygen") },
  { id: "tts-outputs",    hub: "tts",    kind: "outputs",    root: path.join(KB_ROOT, "tts") },
  { id: "heygen-characters", hub: "heygen", kind: "references", root: path.join(REPO_ROOT, "pipelines/video/heygen/characters") },
  { id: "heygen-fal",     hub: "heygen", kind: "references", root: path.join(REPO_ROOT, "pipelines/video/heygen/fal-lipsync") },
  { id: "tts-references", hub: "tts",    kind: "references", root: path.join(REPO_ROOT, "pipelines/video/tts/references") },
];
```

Scanner — `scanSource(src)`: recursive walk (max depth 4, skip dotfiles and dirs named
`node_modules`/`venv`), collect files whose extension is in EXT, return
`{ relPath, absPath, name, type, sizeBytes, mtimeMs, group }` where `group` is the first
path segment under the source root (`"_test"`, `"girl-1"`, …) or `"."` for root-level files.
Missing root → return `[]` (no throw).

Manifest parser — author it exactly (this is the intelligence-heavy bit):

```js
// Parse ALL pipe tables in a markdown string → one array of row objects keyed by
// lower-cased, trimmed header cells. Tolerates `back-ticked` cells and bold headers.
export function parseMdTables(md) {
  const rows = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])) continue;
    const cells = (l) => l.replace(/^\s*\||\|\s*$/g, "").split("|").map((c) => c.replace(/\*\*|`/g, "").trim());
    const headers = cells(lines[i]).map((h) => h.toLowerCase());
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const vals = cells(lines[j]);
      if (vals.every((v) => v === "")) continue;
      rows.push(Object.fromEntries(headers.map((h, k) => [h, vals[k] ?? ""])));
    }
  }
  return rows;
}
```

Join — `manifestFor(file, manifestRows)`: a manifest row matches a scanned file when the
row's output-file cell (the first header containing `"output file"`) ends with the file's
basename (`path.basename`). Attach the whole row as `file.manifest`; rows never matched by
any file are returned separately as `unmatched` (this list surfaces `(pending download)`
rows in the UI).

`/api/media` (GET) → `{ sources: [{ id, hub, kind, root, files: [...] }], unmatched: [...] }`
with manifests loaded fresh from `RENDERS.md` + `OUTPUTS.md` on every request (no caching —
the filesystem is the source of truth).

**Verify**: `node --check pipelines/.claude/skills/media-board/serve.mjs` → exit 0

### Step 3: /file with Range support + path guard, /api/reveal

`/file?src=<sourceId>&p=<relPath>` streams a file. Two hard requirements, author as written:

Path guard (prevents traversal):

```js
export function safeResolve(root, rel) {
  const abs = path.resolve(root, rel);
  const normRoot = path.resolve(root) + path.sep;
  return abs.startsWith(normRoot) ? abs : null; // null → respond 403
}
```

Range support (required for `<video>` scrubbing; browsers send `Range: bytes=N-`):

```js
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}
```

In the handler: no Range header → 200 with `Content-Length`, `Content-Type` from extension
(mp4→video/mp4, mov→video/quicktime, webm→video/webm, mp3→audio/mpeg, wav→audio/wav,
m4a→audio/mp4, png→image/png, jpg/jpeg→image/jpeg, webp→image/webp), `Accept-Ranges: bytes`.
Valid Range → 206 with `Content-Range: bytes <start>-<end>/<size>` and a
`fs.createReadStream(abs, { start, end })`. Invalid Range → 416.

`/api/reveal` (POST `{ src, p }`): validate via `safeResolve`, then
`execFile("open", ["-R", abs])` (import from `node:child_process`). This is the only
system-touching action; never accept an absolute path from the client.

Server binds explicitly to `127.0.0.1` (`server.listen(PORT, "127.0.0.1", …)`) — never
`0.0.0.0`.

**Verify**: `node --check …/serve.mjs` → exit 0 (behavior verified by Step 5 tests)

### Step 4: the page (inline PAGE template, exemplar's dark cockpit style)

Single inline HTML template like the exemplar. Layout spec (all decisions made here):

- Sticky header: title "🎬 Media Board", filter tabs **All / Heygen / TTS / References /
  Outputs**, a text search box (matches file name + any manifest cell), and a count
  ("N assets"). Tabs and search compose (AND).
- Body: one section per source (heading = `hub · kind`, subgrouped by `group` dir with a
  small heading), cards in a CSS grid (`repeat(auto-fill, minmax(260px, 1fr))`).
- Card content by type: video → `<video controls preload="none" src="/file?…">`;
  audio → `<audio controls preload="none">`; image → `<img loading="lazy">`. Below: file
  name (mono, truncated), size + date (`toLocaleDateString`), manifest fields as small
  `label: value` rows when present (e.g. `avatar / template: Harry`, `video_id: 514f…`).
- Buttons per card: **Reveal** (POST /api/reveal), **Download** (`<a download href=/file…>`),
  **Copy path** (clipboard, absPath), and the whole card `draggable="true"`.
- Drag-out (author as written — Chromium-only, and that's accepted):

```js
card.addEventListener("dragstart", (e) => {
  const fileUrl = location.origin + "/file?src=" + encodeURIComponent(srcId) + "&p=" + encodeURIComponent(relPath);
  e.dataTransfer.setData("DownloadURL", `${mime}:${name}:${fileUrl}`);
  e.dataTransfer.effectAllowed = "copy";
});
```

- An "Unmatched manifest rows" collapsed section at the bottom listing rows (e.g.
  `(pending download)`) so the manifest's promises stay visible.
- Empty state per source: "nothing here yet — outputs land in `<root>`".

UI rubric (the ui:true screenshot + reviewer judge against THIS, not taste):
1. All three media types render inline and play (video scrubs — Range works).
2. Grid stays responsive with 100+ cards (`preload="none"`, `loading="lazy"` present).
3. Tabs + search filter correctly and compose.
4. Manifest metadata visible on at least the heygen `_test` renders (join works).
5. Drag a card to Desktop in Chrome → file lands (DownloadURL).
6. Reveal button opens Finder at the file.
7. Dark theme consistent with pinterest-board (reuse its CSS variables).

**Verify**: start server, `curl -s localhost:4100/ | grep -c "Media Board"` → `1` (or more); then take the PR screenshot of the board with real heygen `_test` content.

### Step 5: tests

Create `test/media-board.test.mjs` using `node:test` + `node:assert`, importing the exported
functions from `../serve.mjs`. Required test cases:

1. `parseMdTables` — feed an inline string with the exact RENDERS.md "Videos generated"
   header + 2 data rows (one with backticked cells) → expect 2 objects with keys
   `output file`, `avatar / template`, `audio`, `video_id`, backticks stripped.
2. `parseMdTables` — header-only table (OUTPUTS.md today) → `[]`.
3. Scanner — build a fixture tree with `fs.mkdtempSync(path.join(os.tmpdir(), "mb-"))`:
   `heygen/_test/girl-1/a.mp4`, `heygen/_test/audio.wav`, `heygen/.hidden/x.mp4`,
   `heygen/notes.txt` (all `fs.writeFileSync(f, "x")`) → scan returns exactly 2 files,
   types `video`/`audio`, `group` `_test`, dotdir skipped, `.txt` skipped. Missing-root
   scan → `[]`.
4. Join — file `a.mp4` + manifest rows `[{"output file":"girl-1/a.mp4", …}, {"output file":"(pending download)", …}]`
   → file gets `.manifest`, unmatched has exactly the pending row.
5. `safeResolve` — `("/tmp/root", "ok/f.mp4")` → truthy; `("/tmp/root", "../etc/passwd")` → null.
6. `parseRange` — `("bytes=0-99", 1000)` → `{start:0,end:99}`; `("bytes=500-", 1000)` →
   `{start:500,end:999}`; `("bytes=-100", 1000)` → `{start:900,end:999}`; `("bytes=2000-", 1000)`
   → null; `(undefined, 1000)` → null.

**Verify**: `node --test pipelines/.claude/skills/media-board/test/media-board.test.mjs` → exit 0, ≥6 passing tests. (NEVER shorten to `node --test <dir>` — broken on node 22.14.)

### Step 6: register in docs

- `pipelines/video/heygen/CLAUDE.md` — under "Where render media lives", append:
  `Browse everything visually with the media-board skill ("open my media board" → localhost:4100).`
- `pipelines/video/tts/CLAUDE.md` — same one-liner in the Hub conventions section.
- Root `CLAUDE.md` Find-it-fast table, after the heygen row, add:
  `| Browse generated media (renders, voiceovers) visually | media-board skill (pipelines/.claude/skills/media-board) |`

**Verify**: `grep -rn "media-board" CLAUDE.md pipelines/video/tts/CLAUDE.md pipelines/video/heygen/CLAUDE.md | wc -l` → `3`

### Step 7: final gate

Run the full merge gate + syntax check once more from the repo root.

**Verify**: `node --test pipelines/.claude/skills/media-board/test/media-board.test.mjs && node --check pipelines/.claude/skills/media-board/serve.mjs && echo GATE-OK` → last line `GATE-OK`

## Test plan

Unit tests (Step 5) cover every pure function; the server handler itself stays thin
plumbing around them. Manual/PR evidence: the Step 4 screenshot against the 7-point rubric.
No live network, no external services, no writes to media — tests run fully offline.

## Done criteria

- [ ] `node --test pipelines/.claude/skills/media-board/test/media-board.test.mjs` exits 0 (≥6 tests).
- [ ] `node --check pipelines/.claude/skills/media-board/serve.mjs` exits 0.
- [ ] `ls -la .claude/skills/media-board` shows the relative symlink.
- [ ] Server on 4100 serves `/` (page), `/api/media` (JSON with 5 sources), `/file` with 206 on Range, 403 on traversal.
- [ ] Screenshot attached to the PR showing real heygen `_test` renders with manifest metadata, judged against the Step 4 rubric.
- [ ] The 3 doc rows/lines from Step 6 exist.
- [ ] `plans/README.md` row updated to DONE.

## STOP conditions

- `~/kb-scratch/video/` doesn't exist at run time → STOP (the hub migration should have created it; don't mkdir media roots yourself).
- Port 4100 busy: retry once on 4101 for the manual verify; if both busy, STOP and report.
- Any step seems to require modifying `RENDERS.md`/`OUTPUTS.md`/`registry.json` or anything under `~/kb-scratch/` → STOP; the board is read-only by design.
- Any step seems to require an npm dependency → STOP; zero-dep is a hard constraint.

## Maintenance notes

- Adding a new media hub later = one new row in `sources()` — keep it that way.
- The manifest join is filename-based; if manifests ever store duplicate basenames the join
  should switch to suffix-path matching (longest match wins). Note this in code next to `manifestFor`.
- If the fal-lipsync flow gets productized into a CLI, its outputs land under
  `~/kb-scratch/video/heygen/<pipeline>/` automatically — no board change needed.
- Chromium-only drag-out is accepted; Safari users have Reveal-in-Finder as the drag source.
