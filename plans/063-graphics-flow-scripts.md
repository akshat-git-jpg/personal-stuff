---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && node --test flow/resolve.test.mjs flow/render.test.mjs
ui:
deploy:
needs: ["062 (beat cards + catalog.json must exist)"]
---

# Plan 063: Graphics flow scripts — transcript → resolver → render + manifest

## Summary

- **Problem statement**: The beat-sync design (`docs/specs/2026-07-17-motion-graphics-beat-sync-design.md`) needs the mechanical, zero-token pipeline around the one LLM step: word-timestamp transcription, an anchor-phrase resolver that turns quoted phrases into beat offsets, a batch render loop, and the editor manifest. None of it exists.
- **Goals**:
  - `flow/resolve.mjs` — deterministic anchor resolver (cues.json + transcript.json → resolved.json), loud failures.
  - `flow/render.mjs` — staged per-cue renders (data-duration rewrite + `--variables-file`), ffprobe checks, `manifest.md`.
  - `flow/README.md` — the per-video runbook (workdir layout + the 4 commands).
  - Unit tests over inline fixtures for both scripts.
- **Executor proposed**: claude-p / sonnet (standard)
- **Done criteria** (terse): `node --test` on both test files exits 0; resolver and render behaviors match the inlined algorithm exactly.
- **Stop conditions** (terse): hyperframes render/transcribe CLI behaves differently than documented here; any need for npm dependencies; writes outside card-library (tests) — runtime workdirs under `~/kb-scratch` are owner-run, not executor-run.
- **Test / verification for success**: `cd pipelines/video/card-library && node --test flow/resolve.test.mjs flow/render.test.mjs`
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 02f536f..HEAD -- pipelines/video/card-library/flow/`
> (Plan 062 will have landed changes elsewhere in card-library — that is expected. `flow/` must not exist yet.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (CLI behavior contracts)
- **Depends on**: 062
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `02f536f`, 2026-07-17

## Why this matters

Steady-state cost per 30-min video must be ~one LLM call. That works only if everything after the LLM's cues.json is scripted: phrases → timestamps (resolver), timestamps → clips (render loop), clips → editor handoff (manifest). The resolver also carries the design's central trick — the LLM quotes transcript phrases verbatim and never does timestamp arithmetic; this code does it, and rejects bad anchors deterministically before anything renders.

## Current state

- `pipelines/video/card-library/` — HyperFrames project; after plan 062 it has `catalog.json` (37 cards: `slug`, `kind: beat|single`, `placement: fullframe|overlay`, `variables`, `beat_shape`, `default_duration`) and 8 beat cards whose reveals come from a `beats: [{...item, at}]` variable. `.npmrc` pins the public registry — run all npx from inside card-library.
- No `flow/` folder yet. No test infra; node 22 is available. `node --test <dir>` is broken on this node (LESSONS 2026-07-09) — test_cmd must list files explicitly, as this plan's frontmatter does.
- **Verified CLI facts (2026-07-17, hyperframes v0.7.61 — trust these, don't re-derive):**
  - `npx hyperframes@latest transcribe vo.mp3 --json -m small.en` run with cwd = the workdir writes `<cwd>/transcript.json` = a flat JSON array `[{"text":"If","start":0.01,"end":0.18}, ...]` (word-level), and prints a summary JSON (`{ok, wordCount, durationSeconds, transcriptPath, ...}`) to stdout.
  - `npx hyperframes@latest render <cardDir> --variables-file <json> -o <out> --fps 30 --format mp4|mov --quality draft|standard --quiet` — `mov` renders with transparency. Variables merge over `data-composition-variables`; read in-card via `getVariables()`.
  - Render length comes ONLY from the static `data-duration` attributes in index.html. A script-time attribute patch does NOT change it; rewriting the attribute text in the file DOES (tested: rewrite to `"9"` → 270 frames @30fps, ffprobe 9.000000).
  - A card renders from a minimal staged project: a temp dir containing copies of card-library's `hyperframes.json` + `meta.json` + the card folder.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests | `cd pipelines/video/card-library && node --test flow/resolve.test.mjs flow/render.test.mjs` | exit 0, all pass |
| Clip duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | seconds |
| Manual smoke (optional, slow) | `node flow/render.mjs <workdir>` against a hand-made workdir | renders + manifest.md |

## Scope

**In scope**:
- `pipelines/video/card-library/flow/` (new): `README.md`, `resolve.mjs`, `render.mjs`, `resolve.test.mjs`, `render.test.mjs`, `fixtures/` (test data)
- `pipelines/video/card-library/.gitignore` — add `flow/.test-tmp/`

**Out of scope**:
- Card index.html files, catalog.json, serve.mjs, scripts/beat-smoke.sh (plan 062 owns them).
- The storyboard board and slicing (plan 065), the cue-pass rulebook/prompt (plan 064).
- Any LLM invocation — this plan is 100% mechanical code.

## Git workflow

- Branch: `advisor/063-graphics-flow-scripts`
- Commit per step, e.g. `feat(card-library): graphics-flow anchor resolver`. No AI footers. Do NOT push.

## Steps

### Step 1: flow/README.md — the workdir contract

Document exactly this per-video layout (owner creates the workdir; generated media never lives in the repo — decisions.md 2026-07-12):

```
~/kb-scratch/video/graphics/<video-slug>/
  vo.mp3           # the video's TTS voiceover (input, from the tts hub)
  transcript.json  # word timestamps — step 1 output
  cues.json        # the LLM cue pass output (plan 064 defines how it's produced)
  resolved.json    # resolver output — absolute times + merged variables
  renders/         # final clips + manifest.md
  slices/          # per-cue mp3 slices (written by the board, plan 065)
```

And the four commands (all run from `pipelines/video/card-library/`):
1. `cd <workdir> && npx hyperframes@latest transcribe vo.mp3 --json -m small.en` (writes `transcript.json` into the workdir; note npx must still resolve — run it as `npx --prefix <card-library abs path>` OR document that the owner runs it from card-library with absolute paths; pick the first and verify it resolves, else fall back to documenting `cp` of vo.mp3 — whichever you verify working goes in the README verbatim)
2. cue pass (pointer to `flow/RULEBOOK.md`, plan 064)
3. `node flow/resolve.mjs <workdir>`
4. `node flow/render.mjs <workdir>`

Also paste the cues.json schema below into this README — it is the interface plans 064/065 build against:

```json
{
  "video": "notion-vs-asana",
  "approved": false,
  "cues": [
    {
      "id": "c01",
      "card": "pros-cons/pros-cons",
      "anchor": "let's look at the pros",
      "lead": 0.5,
      "hold": 3.0,
      "variables": { "title": "Notion" },
      "beats": [
        { "reveal": { "kind": "pro", "text": "Unlimited free tier" }, "anchor": "the free tier alone" },
        { "reveal": { "kind": "con", "text": "Slow on mobile" },      "anchor": "the mobile app crawls" }
      ],
      "flagged": false
    }
  ]
}
```

Field semantics: `anchor` = verbatim transcript phrase (≥3 words) where the cue/beat lands; `lead` = seconds the card starts before its anchor (default 0.5); `hold` = seconds held after the last beat (default 3.0); `variables` = card variables excluding beats; `beats[].reveal` = the card-specific beat item (shape per catalog.json `beat_shape`, WITHOUT `at` — the resolver adds it); `placement` comes from catalog.json, not from the cue; `flagged: true` = no card fits, needs a novel card (plan 065 surfaces these). Single-card cues (`kind: "single"`) have `beats: []` and use catalog `default_duration`.

**Verify**: `test -s flow/README.md && grep -c '"anchor"' flow/README.md` -> `>= 2`

### Step 2: flow/resolve.mjs — the anchor resolver

CLI: `node flow/resolve.mjs <workdir>` — reads `<workdir>/cues.json` + `<workdir>/transcript.json` + `./catalog.json`, writes `<workdir>/resolved.json`. On any error: print ALL errors (one per line, prefixed by cue id), write nothing, exit 1.

Export the pure core for tests. Implement exactly this algorithm:

```js
export function normWord(w) { return w.toLowerCase().replace(/[^a-z0-9']/g, ''); }

export function resolveCues(cues, words, catalog) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const bySlug = Object.fromEntries(catalog.cards.map((c) => [c.slug, c]));
  const errors = [];
  const out = [];
  let cursor = 0;
  const findFrom = (phrase, from) => {
    const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
    if (p.length < 3) return { err: `anchor has fewer than 3 words: "${phrase}"` };
    for (let i = from; i <= W.length - p.length; i++) {
      let ok = true;
      for (let j = 0; j < p.length; j++) if (W[i + j].n !== p[j]) { ok = false; break; }
      if (ok) return { idx: i, start: W[i].start };
    }
    return { err: `anchor not found (searching forward from word ${from}): "${phrase}"` };
  };
  for (const cue of cues) {
    const cat = bySlug[cue.card];
    if (!cat) { errors.push(`${cue.id}: unknown card "${cue.card}"`); continue; }
    if (cue.flagged) continue; // flagged cues are skipped, not errors
    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + 1;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    const start = Math.max(0, a.start - lead);
    const beats = [];
    let failed = false;
    for (const b of cue.beats ?? []) {
      const m = findFrom(b.anchor, cursor);
      if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
      cursor = m.idx + 1;
      beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
    }
    if (failed) continue;
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
    const prev = out[out.length - 1];
    if (prev && cat.placement === 'fullframe' && prev.placement === 'fullframe' && start < prev.start + prev.duration) {
      errors.push(`${cue.id}: overlaps previous fullframe cue ${prev.id} (${start} < ${(prev.start + prev.duration).toFixed(2)})`);
      continue;
    }
    out.push({
      id: cue.id, card: cue.card, placement: cat.placement,
      start: +start.toFixed(2), duration,
      variables: { ...cue.variables, ...(beats.length ? { beats } : {}) },
    });
  }
  return { resolved: out, errors };
}
```

Load-bearing properties (do not "improve" them): matching is monotonic — every anchor is searched only forward of the previous match, which both disambiguates repeated phrases and enforces script order; flagged cues are silently skipped; overlap of consecutive fullframe cues is an error, overlays may overlap anything; `beats[].at` is relative to cue start (already lead-shifted).

**Verify**: `node -e "import('./flow/resolve.mjs').then(m=>console.log(typeof m.resolveCues))"` -> `function`

### Step 3: flow/resolve.test.mjs

`node:test` + `node:assert`. Build the fixture inline: a ~30-word transcript array with known timestamps (hand-write it, e.g. words at 0.5s spacing covering "let's look at the pros the free tier alone is great ... but it's not all good the mobile app crawls ...") and a minimal catalog (`pros-cons/pros-cons` beat/fullframe/default_duration 6, one `single` overlay card). Cases (all against `resolveCues` — no CLI spawning):

1. Happy path: 1 cue + 2 beats → correct `start` (anchor start − 0.5, floored at 0), `beats[].at` relative and 2-decimal, `duration` = last at + 3.0.
2. Anchor not in transcript → error listing the cue id + phrase, cue absent from resolved.
3. Monotonicity: a beat whose phrase occurs only BEFORE the cue anchor → "not found" error (forward search).
4. Repeated phrase: phrase occurring twice, cue 2's anchor after cue 1's → matches the second occurrence.
5. `<3`-word anchor → error.
6. Flagged cue skipped without error.
7. Two overlapping fullframe cues → overlap error on the second; overlay overlapping fullframe → no error.
8. Beat-less single cue → duration = catalog `default_duration`.
9. Punctuation/case robustness: transcript word `"Pros,"` matches anchor word `pros`.
10. CLI: spawn `node flow/resolve.mjs` on a fixture workdir in `flow/.test-tmp/` (create via `fs.mkdtempSync` under it) → resolved.json written, exit 0; and a bad-anchor workdir → exit 1, no resolved.json.

**Verify**: `node --test flow/resolve.test.mjs` -> all pass

### Step 4: flow/render.mjs — staged renders + manifest

CLI: `node flow/render.mjs <workdir> [--only <cueId>] [--quality draft|standard]` (default standard). Reads `<workdir>/resolved.json`. For each cue, sequentially:

1. Stage: `fs.mkdtempSync(os.tmpdir()+...)`; copy `hyperframes.json`, `meta.json`, and the card folder from card-library (resolve card-library root as the script's own location: `path.resolve(import.meta.dirname, '..')`).
2. Rewrite duration in the staged `index.html`: `html.replace(/data-duration="[0-9.]+"/g, \`data-duration="${cue.duration}"\`)`. Before rewriting, assert all existing `data-duration` values in the file are identical — if not, record a per-cue error and skip (contract rule from plan 062).
3. Write `vars.json` = `cue.variables`; run `npx hyperframes@latest render <cardDirName> --variables-file vars.json -o <workdir>/renders/<file> --fps 30 --format <mov if placement==='overlay' else mp4> --quality <q> --quiet` with cwd = the staged dir (spawnSync, inherit stdio on failure only).
4. ffprobe the output; |duration − cue.duration| > 0.15 → per-cue error.
5. Clean the temp dir.

Output file naming: `<mmss(cue.start)>-<id>-<card basename>.<ext>` (e.g. `0432-c01-pros-cons.mp4`; mmss zero-padded from floor(start)).
Then write `<workdir>/renders/manifest.md`, cues sorted by start:

```
# <video> — graphics manifest

| place at | file | duration | placement | card |
|---|---|---|---|---|
| 04:32.0 | 0432-c01-pros-cons.mp4 | 24.5s | fullframe | pros-cons/pros-cons |
```

`place at` = mm:ss.d of cue.start — the editor snaps the clip start to this timecode (the VO is already on their timeline; clips are video-only by design).
Exit 1 if any per-cue error occurred, after processing all cues; print the error list. Export the pure helpers (`mmss`, `rewriteDuration(html, seconds)` returning `{html, error}`, `manifestMd(video, cues)`) for tests.

**Verify**: `node -e "import('./flow/render.mjs').then(m=>console.log(typeof m.rewriteDuration, typeof m.manifestMd))"` -> `function function`

### Step 5: flow/render.test.mjs

Pure-function tests only (no real renders — they cost minutes and Chrome; the smoke render lives in plan 062's gate):

1. `rewriteDuration`: HTML with three `data-duration="6"` → all become `"24.5"`; HTML with mixed `"6"`/`"3"` → `{error}` set, html unchanged.
2. `mmss(272.03)` → `"04:32.0"`; `mmss(0)` → `"00:00.0"`.
3. `manifestMd`: two cues out of order by start → table sorted by start, correct columns, `.mov` name for an overlay cue.
4. Naming: overlay placement yields `--format mov` + `.mov` filename, fullframe yields `.mp4` (test via an exported `planRender(cue)` helper returning `{args, outFile}` — structure render.mjs so command construction is a pure exported function).

**Verify**: `node --test flow/render.test.mjs` -> all pass

## Test plan

All logic that computes (matching, offsets, durations, overlap, rewrite, naming, manifest) is pure and unit-tested against inline fixtures; CLI wrappers get 2 spawn tests (resolver only). Real rendering is validated once by plan 062's smoke and by the owner's first real video run.

## Done criteria

- [ ] `cd pipelines/video/card-library && node --test flow/resolve.test.mjs flow/render.test.mjs` exits 0
- [ ] `git diff --stat 02f536f..HEAD -- pipelines/video/card-library/flow/` shows only in-scope files
- [ ] flow/README.md documents the workdir layout, all 4 commands (transcribe command verified working, per Step 1), and the cues.json schema
- [ ] No entries added to package.json dependencies (node stdlib + npx hyperframes + ffprobe binary only)

## STOP conditions

- The transcribe command does not produce `transcript.json` as a flat `[{text,start,end}]` array when you verify Step 1's README command — report the actual shape; do not silently adapt the resolver.
- Any temptation to add an npm dependency (fuzzy matching, CLI parsing, test framework) — the design wants stdlib only.
- `--variables-file` or `--format mov` misbehaves against the staged project — report; do not switch to editing cards in place inside card-library.
- Writes outside `pipelines/video/card-library/` (tests use `flow/.test-tmp/`; runtime workdirs are owner-run).

## Maintenance notes

- The cues.json schema in flow/README.md is the contract for plans 064 (the LLM writes it) and 065 (the board edits it). Change it in one place only — that README — and update both consumers.
- The 0.15s ffprobe tolerance and the 0.5/3.0 lead/hold defaults are design constants; the rulebook (064) may override lead/hold per cue but not the defaults' meaning.
- If hyperframes later supports variable-driven `data-duration` natively, `rewriteDuration` staging can be deleted — check release notes on upgrades.
