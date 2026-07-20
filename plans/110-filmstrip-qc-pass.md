---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: false
deploy:
needs: ["land 109 before dispatch — both edit scripts/check.sh, SKILL.md, HANDOFF.md, PIPELINE.md"]
---

# Plan 110: Filmstrip QC pass — contact-sheet self-check of the assembled video

## Summary

- **Problem statement**: There is no automated QC of the assembled video (final-workflow open problem #3 / GFX-10 "waiting on a cheap mechanism"); broken effects have shipped past "render succeeded" three times in one day (LESSONS 2026-07-19) and the owner is the only detector of timing gaps.
- **Goals**:
  - `scripts/qc-video.sh <slug>` builds a QC pack in kb-scratch: an expected-events checklist derived from `assembly.md` + `effects.json`, one 30fps contact sheet per event (every cut, overlay in/out, beat flash), overview strips, and a waveform.
  - `lib/qc-plan.mjs` (new, unit-tested) parses `assembly.md` into events with per-event "expected" text.
  - A `qc the video <slug>` skill verb tells the session how to read the pack and write a committed `videos/<slug>/qc-report.md` verdict table.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High — fully-inlined plan, default routing per `tooling/boss/data/rules.md`)
- **Done criteria** (terse): check.sh green including new `qc-plan.test.mjs` (fixture = committed test-01 assembly.md: 35 segments / 9 overlays / 15 transitions / 52 events); docs/skill lines present.
- **Stop conditions** (terse): baseline red; fixture parse yields wrong counts vs the committed file itself; scope breach.
- **Test / verification for success**: unit tests over the parser + event planner against a committed real-EDL fixture, wired into check.sh; the shell script self-guards (sheet count must equal event count) at runtime.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e885de7..HEAD -- pipelines/video/visuals-flow/scripts pipelines/video/visuals-flow/lib pipelines/.claude/skills/visuals-flow/SKILL.md pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/videos/test-01/assembly.md`
> Plan 109 landing first WILL show here — that is expected; re-read `scripts/check.sh` and `SKILL.md` as they then stand. If `videos/test-01/assembly.md` changed, recount the fixture expectations in Step 3 from the file (row counts per table) before writing the test.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (all new files except four one-line/one-section doc additions)
- **Depends on**: 109 (merge-order only — shared doc/gate files; no code dependency)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e885de7`, 2026-07-20

## Why this matters

The owner's remaining cost after assembly is *finding* the small defects (graphic ends before the VO finishes the point, caption missing, overlay lingering, flash rendering wrong) by watching a 30-minute video. The repo already proved the cheap detector: `scripts/analyze-reference.sh` builds 30fps contact sheets around detected moments of *competitor* videos and a session reads them (~10x cheaper than frame-by-frame). This plan points the same trick at our *own* output — but smarter: we don't need scene detection, because `assembly.md` + `effects.json` say exactly where every event is SUPPOSED to happen and what should be visible. The session compares sheets against expectations and writes a verdict table, so the owner (and the DaVinci touch-up pass of plan 109) starts from a defect list instead of a blind watch. Idea provenance: browser-use/video-use's "self-validate before presenting" pack, owner-approved 2026-07-20.

## Current state

All paths relative to `pipelines/video/visuals-flow/` unless noted.

- `videos/<slug>/assembly.md` — committed EDL written by step 090 (`assemblyMd()` in `lib/assemble.mjs` line ~210). Exact shape (from committed `videos/test-01/assembly.md` at `e885de7`): three pipe tables under `## Base track` (`| from | to | source | id |`, 35 rows for test-01), `## Overlays (composited on top)` (`| at | until | file |`, 9 rows), `## Transitions` (`| at | direction | from | to |`, 15 rows). Times are `MM:SS.d` (e.g. `29:12.1`); minutes can exceed 59 in principle (format is `mm` padded, unbounded). The Transitions section is OMITTED entirely when a video assembles with `--transitions none`.
- `videos/<slug>/effects.json` — committed per-instance manifest. Instance shape (verified on test-01): `{ "id": "whip-57.5", "type": "whip", "at": 57.52, "direction": "right", "style": "flash", "enabled": true }`. Types in use: `whip`, `beat`, `captions`, `drift`, `bubble` (see `effectFlags` in `lib/assemble.mjs` line ~352). `beat` instances carry a numeric `at` (mid-avatar-span flash+punch refreshes).
- `scripts/analyze-reference.sh` — the exemplar for every ffmpeg incantation used here: overview strips `fps=1/10,scale=320:-1,tile=6x5`, moment sheets `-ss <t-0.7> -t 1.4 ... fps=30,scale=480:-1,tile=4x11` (line ~87). Bash style to imitate: `set -euo pipefail`, `cd "$(dirname "$0")/.."`, node one-liners piped into a while-read loop.
- `lib/workdir.mjs` — `resolveWorkdir(slugOrPath)` maps a slug to `videos/<slug>` (283B, used by every lib CLI).
- Assembled videos live at `~/kb-scratch/video/visuals-flow/<slug>/final-draft.mp4` (720p draft) and `final.mp4` (1080p ship).
- `scripts/check.sh` — explicit `node --test` file list; append new test files there (never `node --test <dir>`, LESSONS 2026-07-09). After plan 109 it also lists `export-timeline.test.mjs`.
- `pipelines/.claude/skills/visuals-flow/SKILL.md` — verb router; repo-root copy is a symlink, edit only the `pipelines/` source. After plan 109 it has a `## Verb: "export the timeline"` section.
- Committed-vs-gitignored rule (PIPELINE.md): per-video TEXT is committed, media is not — so `qc-report.md` is committed, the qc/ image pack goes to kb-scratch.
- Conventions: plain `.mjs`, `node:` imports, no deps, 2-space indent, `node --test` + `assert/strict`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline + merge gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Run one test file | `cd pipelines/video/visuals-flow && node --test lib/qc-plan.test.mjs` | exit 0 |
| Fixture row counts (ground truth) | `rtk proxy grep -c '^|' pipelines/video/visuals-flow/videos/test-01/assembly.md` | 65 (= 35+9+15 rows + 3×2 header/divider lines) |

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow/lib/qc-plan.mjs` (new)
- `pipelines/video/visuals-flow/lib/qc-plan.test.mjs` (new)
- `pipelines/video/visuals-flow/tests/fixtures/qc-assembly-test-01.md` (new — copied fixture)
- `pipelines/video/visuals-flow/scripts/qc-video.sh` (new, chmod +x)
- `pipelines/video/visuals-flow/scripts/check.sh` (append one test file)
- `pipelines/.claude/skills/visuals-flow/SKILL.md` (add one verb section)
- `pipelines/video/visuals-flow/HANDOFF.md` (quick-reference: one line)
- `pipelines/video/visuals-flow/PIPELINE.md` (flow table row + one `videos/<slug>/` layout line)
- `plans/README.md` (status row flip at the end)

**Out of scope** (looks related — don't touch):
- `scripts/analyze-reference.sh` and `lib/reference-moments.mjs` — the reference-video path stays separate (different inputs: scene detection vs known EDL).
- `lib/assemble.mjs` / any effect module — this plan only READS their outputs.
- Automating verdicts (image analysis in code) — the READING is the session's job via the skill verb, by design.
- `videos/test-01/**` except the read-only fixture copy.

## Git workflow

- Branch: `advisor/110-filmstrip-qc-pass`
- Commit per step, single-line conventional messages — no AI footers. Do NOT push.

## Steps

### Step 1: Baseline

`bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, else STOP.

### Step 2: `lib/qc-plan.mjs`

Full file — place verbatim:

```js
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

export function parseMmss(s) {
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) throw new Error(`bad mmss: ${s}`);
  return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
}

const mmssDigits = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}${String(Math.floor(t % 60)).padStart(2, '0')}`;

function tableRows(md, title) {
  const re = new RegExp(`## ${title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## |$)`);
  const block = (md.match(re) || [''])[0];
  return block.split('\n').filter((l) => /^\|/.test(l)).slice(2); // drop header + divider
}

export function parseAssembly(md) {
  const segments = tableRows(md, 'Base track').map((l) => {
    const [, from, to, source, id] = l.split('|').map((x) => x.trim());
    return { start: parseMmss(from), end: parseMmss(to), kind: source, id };
  });
  const overlays = tableRows(md, 'Overlays (composited on top)').map((l) => {
    const [, at, until, file] = l.split('|').map((x) => x.trim());
    return { start: parseMmss(at), end: parseMmss(until), file };
  });
  const transitions = tableRows(md, 'Transitions').map((l) => {
    const [, at, direction, from, to] = l.split('|').map((x) => x.trim());
    return { at: parseMmss(at), direction, from, to };
  });
  return { segments, overlays, transitions };
}

export function expectedForCut(a, b, whip) {
  const into = {
    graphic: `card ${b.id} fully drawn within 6 frames — no half-rendered text, no black or solid-color frame`,
    avatar: `HARD cut to host (no transition frames), host visible immediately, no zoom-in on the host`,
    screen: `screen recording resumes cleanly; captions visible if speech is running; Ken Burns drift subtle (no jump)`,
  }[b.kind] || 'next segment starts cleanly';
  const at = whip
    ? 'whip transition (motion-blur streak, ~7 frames; orange flash-wipe if into a graphic — never pink/white-out)'
    : 'clean hard cut, zero gap or repeated frames';
  return `${at}; ${into}`;
}

export function planQcEvents({ segments, overlays, transitions }, effects = { instances: [] }) {
  const events = [];
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1];
    const b = segments[i];
    const whip = transitions.some((t) => Math.abs(t.at - b.start) < 0.15);
    events.push({ t: b.start, tag: `cut-${mmssDigits(b.start)}-${a.id}-to-${b.id}`, expected: expectedForCut(a, b, whip) });
  }
  for (const o of overlays) {
    const name = path.basename(o.file, path.extname(o.file));
    events.push({
      t: o.start, tag: `ovl-up-${mmssDigits(o.start)}-${name}`,
      expected: `overlay ${o.file} pops in within 6 frames, base content still visible behind it, no full-frame black box`,
    });
    events.push({
      t: o.end, tag: `ovl-down-${mmssDigits(o.end)}-${name}`,
      expected: `overlay ${o.file} fully gone within 6 frames — no ghost, no lingering box`,
    });
  }
  for (const inst of (effects.instances || [])) {
    if (inst.type === 'beat' && inst.enabled !== false && typeof inst.at === 'number') {
      events.push({
        t: inst.at, tag: `beat-${mmssDigits(inst.at)}-${inst.id}`,
        expected: 'orange flash + slight punch-in refresh (never pink/washed-out); host readable again within 5 frames',
      });
    }
  }
  events.sort((x, y) => x.t - y.t);
  return events.map((e, i) => ({
    ...e,
    sheet: `event-${String(i + 1).padStart(3, '0')}-${e.tag.replace(/[^a-zA-Z0-9._-]/g, '_')}.jpg`,
  }));
}

export function checklistMd(video, events, variant) {
  const rows = events.map((e, i) =>
    `| ${i + 1} | ${e.t.toFixed(1)}s | ${e.sheet} | ${e.expected} |`);
  return [
    `# ${video} — filmstrip QC checklist (${variant})`,
    '',
    'One contact sheet per expected event (30fps, event at ~frame 21 of the',
    'sheet, window starts 0.7s before). Read every sheet against its expected',
    'column; verdicts go to videos/<slug>/qc-report.md.',
    '',
    '| # | time | sheet | expected |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function main() {
  const [slugOrPath, ...rest] = process.argv.slice(2);
  if (!slugOrPath) {
    console.error('usage: node lib/qc-plan.mjs <slug-or-path> --out <events.json> --checklist <checklist.md> [--variant final|final-draft]');
    process.exit(1);
  }
  let out = null; let checklist = null; let variant = 'final-draft';
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out') out = rest[++i];
    else if (rest[i] === '--checklist') checklist = rest[++i];
    else if (rest[i] === '--variant') variant = rest[++i];
    else { console.error(`unknown argument: ${rest[i]}`); process.exit(1); }
  }
  const workdir = resolveWorkdir(slugOrPath);
  const mdPath = path.join(workdir, 'assembly.md');
  if (!fs.existsSync(mdPath)) { console.error(`missing ${mdPath} — assemble first`); process.exit(1); }
  const parsed = parseAssembly(fs.readFileSync(mdPath, 'utf8'));
  const effectsPath = path.join(workdir, 'effects.json');
  const effects = fs.existsSync(effectsPath) ? JSON.parse(fs.readFileSync(effectsPath, 'utf8')) : { instances: [] };
  const events = planQcEvents(parsed, effects);
  if (events.length === 0) { console.error('no events parsed from assembly.md'); process.exit(1); }
  const video = path.basename(workdir);
  if (out) fs.writeFileSync(out, JSON.stringify(events, null, 2));
  if (checklist) fs.writeFileSync(checklist, checklistMd(video, events, variant));
  console.log(`events: ${events.length} (${parsed.segments.length} segments, ${parsed.overlays.length} overlays, ${parsed.transitions.length} transitions)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Verify**: `cd pipelines/video/visuals-flow && node lib/qc-plan.mjs test-01 --out /tmp/qc-events.json --checklist /tmp/qc-checklist.md` → prints `events: <N> (35 segments, 9 overlays, 15 transitions)` where N ≥ 52 (52 + however many enabled beat instances test-01's committed effects.json carries). Both output files exist and are non-empty. (This works in a worktree — assembly.md and effects.json are committed text.)

### Step 3: Fixture + `lib/qc-plan.test.mjs`

1. `cp videos/test-01/assembly.md tests/fixtures/qc-assembly-test-01.md` (create `tests/fixtures/` if absent). The fixture freezes the shape; the live file regenerates on every assemble.
2. New `lib/qc-plan.test.mjs` (imports from `./qc-plan.mjs`, fixture via `path.resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'qc-assembly-test-01.md')`):
   - `parseMmss`: `parseMmss('00:57.5') === 57.5`, `parseMmss('29:12.1') === 1752.1` (use `assert.ok(Math.abs(x - y) < 1e-9)` for float compares), throws on `'xx'`.
   - `parseAssembly` on the fixture: `segments.length === 35`, `overlays.length === 9`, `transitions.length === 15`; `segments[0]` deep-equals `{ start: 0, end: 57.5, kind: 'avatar', id: 's01' }`; `overlays[0].file === '0239-c04-stat-hit.mov'`; `transitions[0].at === 57.5`.
   - `parseAssembly` with the Transitions section removed from the fixture string (`md.split('## Transitions')[0]`): `transitions.length === 0`, segments/overlays unchanged (a `--transitions none` video must parse).
   - `planQcEvents` on the fixture with empty effects: `events.length === 34 + 18` (34 cut boundaries + 9 overlays × up/down); events sorted ascending by `t`; all `sheet` names unique (`new Set(...).size === events.length`) and all match `/^event-\d{3}-[a-zA-Z0-9._-]+\.jpg$/`; the first event is the 57.5s cut and its `expected` contains `whip` (transition listed at 57.5) and `card c01`.
   - `planQcEvents` with `{ instances: [{ id: 'beat-100', type: 'beat', at: 100, enabled: true }, { id: 'beat-off', type: 'beat', at: 200, enabled: false }, { id: 'whip-1', type: 'whip', at: 57.5 }] }`: exactly ONE beat event added (disabled excluded, whip type ignored — cuts already cover whips).
   - `expectedForCut({ kind: 'screen', id: 'x' }, { kind: 'avatar', id: 's03' }, false)` contains `'HARD cut'`; into-graphic with `whip=true` contains `'flash-wipe'`.
   - `checklistMd` output contains one `| 1 | ` row per event count and the video name in the H1.
3. Append `lib/qc-plan.test.mjs` to the list in `scripts/check.sh`.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 including the new file.

### Step 4: `scripts/qc-video.sh`

Full file — place verbatim, `chmod +x`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

usage() { echo "Usage: scripts/qc-video.sh <slug> [--final]"; exit 1; }
[[ $# -ge 1 ]] || usage
SLUG="$1"; shift
VARIANT="final-draft"
[[ "${1:-}" == "--final" ]] && VARIANT="final"

WORKDIR="videos/$SLUG"
MEDIA=~/kb-scratch/video/visuals-flow/$SLUG
VIDEO="$MEDIA/$VARIANT.mp4"
QC="$MEDIA/qc"
[[ -f "$VIDEO" ]] || { echo "missing $VIDEO — run the assemble step first"; exit 1; }
[[ -f "$WORKDIR/assembly.md" ]] || { echo "missing $WORKDIR/assembly.md"; exit 1; }
rm -rf "$QC"; mkdir -p "$QC"

node lib/qc-plan.mjs "$SLUG" --out "$QC/events.json" --checklist "$QC/checklist.md" --variant "$VARIANT"

# waveform of the muxed audio (whole video, one image)
ffmpeg -y -i "$VIDEO" -filter_complex "aformat=channel_layouts=mono,showwavespic=s=3840x256:colors=white" -frames:v 1 "$QC/waveform.png" >/dev/null 2>&1

# overview strips: 1 frame / 10s, 6x5 tiles (same recipe as analyze-reference.sh)
ffmpeg -y -i "$VIDEO" -vf "fps=1/10,scale=320:-1,tile=6x5" "$QC/overview-%d.jpg" >/dev/null 2>&1

# one 30fps sheet per event (window starts 0.7s before the event)
node -e "
const evs = JSON.parse(require('fs').readFileSync('$QC/events.json', 'utf8'));
for (const e of evs) console.log(Math.max(0, e.t - 0.7).toFixed(3), e.sheet);
" | while read -r start sheet; do
  ffmpeg -y -ss "$start" -t 1.4 -i "$VIDEO" -vf "fps=30,scale=480:-1,tile=4x11" "$QC/$sheet" >/dev/null 2>&1
done

COUNT=$(ls "$QC" | grep -c '^event-' || true)
EXPECTED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$QC/events.json','utf8')).length)")
[[ "$COUNT" -eq "$EXPECTED" ]] || { echo "sheet count $COUNT != events $EXPECTED — a sheet failed to render"; exit 1; }
echo "qc pack ready: $QC ($EXPECTED event sheets + overviews + waveform + checklist.md)"
```

**Verify**: `bash pipelines/video/visuals-flow/scripts/qc-video.sh 2>&1 | head -1` → the usage line (exit 1, no args). Then `bash pipelines/video/visuals-flow/scripts/qc-video.sh no-such-slug` → `missing ... — run the assemble step first`, exit 1. (Do NOT run it against a real video — media is absent in worktrees; the parser is unit-tested and every ffmpeg incantation is copied from the proven analyze-reference.sh.)

### Step 5: Docs + skill verb

1. `PIPELINE.md` — flow table, add after the `095-resolve-export-run` row (after `090-assemble-run` if 109 hasn't landed — but see `needs`):
   ```
   | qc (`scripts/qc-video.sh`) | [RUN] + [LLM read] | `final(-draft).mp4` + `assembly.md` + `effects.json` → kb-scratch `qc/` pack (checklist + event contact sheets) → session-read verdicts in committed `qc-report.md` |
   ```
   And in the `videos/<slug>/` layout block, after the `assembly.md` line:
   ```
     qc-report.md     # filmstrip QC verdict table (qc verb output) — committed
   ```
2. `HANDOFF.md` — `## How to run (quick reference)` block, after the 095 export line:
   ```
   bash scripts/qc-video.sh <slug> [--final]          # -> kb-scratch qc/ pack; then READ the sheets (skill verb "qc the video")
   ```
3. `pipelines/.claude/skills/visuals-flow/SKILL.md` — add verbatim, right after the `## Verb: "export the timeline" / "open it in resolve"` section:
   ```markdown
   ## Verb: "qc the video <slug>" / "run the filmstrip qc"

   1. Requires an assembled video in kb-scratch: `final-draft.mp4` (default) or
      `final.mp4` (add `--final`).
   2. `bash scripts/qc-video.sh <slug> [--final]` — writes
      `~/kb-scratch/video/visuals-flow/<slug>/qc/`: `checklist.md` (one row per
      expected event, derived from assembly.md + effects.json), `events.json`,
      `waveform.png`, overview strips, and one 30fps contact sheet per event
      (the event lands ~frame 21; the window starts 0.7s before it).
   3. READ the pack in this order: checklist.md first, then the overview strips
      (whole-video sanity: no long freezes, no letterboxing shifts, captions
      present on screen segments), then EVERY event sheet (batch 4–6 images per
      Read). Score each event ✓/✗ against its "expected" column. Typical ✗:
      wrong/missing card, black or solid-color frames at a cut, caption absent,
      overlay lingering past its until, a zoom on a cut INTO the host, flash
      rendering pink/washed-out.
   4. Write `videos/<slug>/qc-report.md` (committed): the checklist table plus
      `verdict` and `note` columns, ✗ rows first, then surface the ✗ list to the
      owner with the cheapest fix for each (an `effects.json` per-instance kill,
      a board feedback box entry for cue/shot timing, or a Resolve nudge via the
      export verb). QC findings are observations for the OWNER — never edit
      cues/shots/effects yourself off the back of a sheet.
   Token note: a 30-min video ≈ 55–75 sheets ≈ the cost class of one
   "analyze reference" pass. Do not sample — coverage is the point.
   ```

**Verify**: `rtk proxy grep -c "qc-video.sh" pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/HANDOFF.md pipelines/.claude/skills/visuals-flow/SKILL.md` → each ≥ 1.

## Test plan

Step 3 covers the logic (parser, event planner, expected-text rules, checklist rendering) against a committed real-world EDL fixture. The shell layer is runtime-guarded (sheet-count === event-count check) and reuses analyze-reference.sh's proven ffmpeg recipes verbatim; its arg/missing-file paths are verified in Step 4.

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, including `qc-plan.test.mjs`.
- [ ] `git diff --stat` touches only in-scope files.
- [ ] `grep -c "qc-plan.test.mjs" pipelines/video/visuals-flow/scripts/check.sh` → 1.
- [ ] `test -x pipelines/video/visuals-flow/scripts/qc-video.sh` → exit 0.
- [ ] `grep -c "qc-video.sh" pipelines/video/visuals-flow/PIPELINE.md` → ≥1; same for `HANDOFF.md` and `pipelines/.claude/skills/visuals-flow/SKILL.md`; `grep -c "qc-report.md" pipelines/video/visuals-flow/PIPELINE.md` → ≥1.
- [ ] `tests/fixtures/qc-assembly-test-01.md` committed and byte-identical to `videos/test-01/assembly.md` at copy time (`diff` → exit 0).
- [ ] `plans/README.md` row 110 flipped to DONE.

## STOP conditions

- Baseline `check.sh` red before any change.
- The Step 2 verify prints segment/overlay/transition counts ≠ 35/9/15 against the committed test-01 assembly.md — the file drifted from this plan's ground truth; recount per the drift-check note, and if the TABLE SHAPE (columns/headers) changed, stop and report instead of adapting the parser.
- Anything requires touching `lib/assemble.mjs` or any effects module.
- Do NOT run `qc-video.sh` against real media (absent in worktrees).

## Maintenance notes

- The parser is coupled to `assemblyMd()`'s output shape (`lib/assemble.mjs` line ~210). If that generator ever changes columns/headers, `qc-plan.test.mjs`'s fixture assertions fail loudly — update BOTH together (same edit-both rule as prompt/RULEBOOK pairs).
- First real-video use (owner/main-checkout, post-merge): `bash scripts/qc-video.sh test-01` then run the skill verb on the result — the produced `videos/test-01/qc-report.md` doubles as the acceptance run and directly feeds HANDOFF open item #1 (the owner QC watch).
- Future upgrade path (deliberately not in this plan): auto-verdicts on the cheap objective checks (black-frame/solid-color detection via signalstats at event times) could pre-fill the verdict column; reading stays the fallback. Re-raise only with owner interest (GFX-10's "cheap mechanism" bar).
- Beat sheets scale event count with avatar-span length; if a future video produces >100 events, add a `--cuts-only` flag then (not now).
