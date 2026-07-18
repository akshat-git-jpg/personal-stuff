---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: [land after 087 — both touch lib/avatar-render.mjs]
---

# Plan 088: visuals-flow hygiene batch — test-tmp teardown, workdir dedupe, small guards

## Summary

- **Problem statement**: Five small, mechanical debts from the 2026-07-18 audit: (1) three test suites never clean `lib/.test-tmp/` (+57 dirs per `check.sh` run, incl. media — GFX-02); (2) `resolveWorkdir` is copy-pasted into 11 modules (GFX-01); (3) `transcribe-groq --out` with no value crashes with a TypeError; (4) `steps/010-transcribe-run/run.sh` with no arg dies with a cryptic `unbound variable`; (5) the board returns full stack traces to HTTP clients and its POST endpoints accept any Origin; plus lint-cues' E4 exclusion zones invert on videos shorter than 35s.
- **Goals**: shared `lib/workdir.mjs`; suite-level `.test-tmp` teardown in the three offending test files; the four small guards.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — purely mechanical, fully inlined.
- **Done criteria** (terse): `check.sh` exit 0; `.test-tmp` dir count stable across two consecutive runs; single `resolveWorkdir` definition repo-wide.
- **Stop conditions** (terse): any behavior change beyond the listed guards; board UI/UX changes.
- **Test / verification for success**: existing suite green + dir-count check + small new unit cases.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88c6943..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps/010-transcribe-run` — plan 087's avatar-render changes WILL appear (it lands first); anything else is drift.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 087 landed (same-file overlap in avatar-render.mjs)
- **Category**: tech-debt
- **Difficulty**: mechanical
- **Planned at**: commit `88c6943`, 2026-07-18

## Why this matters

None of these bites daily, but each is the kind of debt that compounds: the tmp leak grows disk unboundedly with media files; the 11-way copy-paste means a workdir-convention change needs 11 lockstep edits; the crash guards turn cryptic failures into one-line usage errors. Registered as GFX-01/GFX-02 in the backlog ("fold into the next touch") — this is that touch.

## Current state (excerpts verified at 88c6943, `pipelines/video/visuals-flow/`)

- The canonical `resolveWorkdir` (identical bodies, 11 sites — `assemble.mjs:140`, `avatar-render.mjs:65`, `board.mjs:1012`, `edit-delta.mjs:4`, `feedback-status.mjs:4`, `lint-cues.mjs:148`, `lint-shots.mjs:82`, `render.mjs:94`, `resolve-shots.mjs:48`, `resolve.mjs:137`, `transcribe-groq.mjs:12`):
  ```js
  function resolveWorkdir(arg) {
    if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
    const pipelineRoot = path.resolve(import.meta.dirname, '..');
    return path.join(pipelineRoot, 'videos', arg);
  }
  ```
  NOTE: `import.meta.dirname` in the shared module still resolves to `lib/`, so `pipelineRoot` is unchanged when the helper moves to `lib/workdir.mjs`.
- The correct teardown pattern already used by sibling suites (`lib/feedback-status.test.mjs:18-22`):
  ```js
  test.before(() => {
    if (fs.existsSync(TMP_ROOT)) {
      fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    }
  });
  ```
  Offenders: `lib/board.test.mjs` (`makeWorkdir` at :23-31, `mkdtempSync(TMP_ROOT, 'board-')`, no cleanup), `lib/render.test.mjs` (:72,93,113), `lib/resolve.test.mjs` (:221,239).
- `lib/transcribe-groq.mjs:25-27`: `` const outFlag = args.indexOf('--out'); … outFlag !== -1 ? path.resolve(args[outFlag + 1]) : … `` — `--out` as last token → `path.resolve(undefined)` TypeError.
- `steps/010-transcribe-run/run.sh:2-3`: `set -euo pipefail` then `arg="$1"; shift` — no-arg run dies with `$1: unbound variable` (the other four step wrappers forward `"$@"` to a Node CLI that prints usage).
- `lib/board.mjs:1005-1008` (inside `createServer`):
  ```js
  handleRequest(req, res, workdir, cardLibraryRoot).catch((err) => {
    res.statusCode = 500;
    res.end(String((err && err.stack) || err));
  });
  ```
  Full stack + absolute paths to any client. And `handleRequest` (:940-992) routes `POST /save|/approve|/approve-shots` with no Host/Origin inspection — any web page open in the owner's browser can POST cross-origin to `127.0.0.1:4322`.
- `lib/lint-cues.mjs:6-8` — `ZONE_START = 15; ZONE_END = 20;` and the E4 loop (:73-80) flags `start < 15` and `end > T - 20`; for `T < 35` every cue fails both bounds (contradictory errors on short clips).

## Design (decided)

1. **`lib/workdir.mjs`** (new): export the function verbatim; all 11 modules import it (`import { resolveWorkdir } from './workdir.mjs';`) and delete their local copies. No signature/behavior change.
2. **Teardown**: add the `test.before` wipe (pattern above, each suite's own `TMP_ROOT`) to `board.test.mjs`, `render.test.mjs`, `resolve.test.mjs`. (`assemble.test.mjs` writes to one fixed dir and self-overwrites — leave it.) Wipe-at-start, not at-end, so failing runs stay inspectable — same rationale as feedback-status.
3. **transcribe-groq**: after computing `outFlag`, `if (outFlag !== -1 && !args[outFlag + 1]) { console.error('--out needs a file path'); process.exit(1); }`.
4. **run.sh**: replace `arg="$1"; shift` with:
   ```bash
   arg="${1:-}"
   if [ -z "$arg" ]; then echo "usage: run.sh <slug-or-path>" >&2; exit 1; fi
   shift
   ```
5. **Board**: (a) 500 handler logs `err.stack` via `console.error` and sends the body `internal error`; (b) at the top of `handleRequest`, before the POST routes: reject non-GET requests whose `Host` header is not `localhost`/`127.0.0.1` (with any port) or whose `Origin` header (when present) is not `http://localhost[:port]`/`http://127.0.0.1[:port]` — respond 403 `forbidden origin`. GET routes unchanged.
6. **lint-cues E4**: guard the zone loop: when `T < ZONE_START + ZONE_END + 5`, push ONE warning `W-zones: video too short (<40s) for exclusion zones — skipped` instead of running the per-cue checks.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Leak check | `bash scripts/check.sh && ls lib/.test-tmp \| wc -l && bash scripts/check.sh && ls lib/.test-tmp \| wc -l` | the two counts are EQUAL |
| Dedupe check | `grep -rln "function resolveWorkdir" lib/ \| wc -l` | 1 (workdir.mjs only) |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/workdir.mjs` (new), the 11 modules' import swap, `lib/board.test.mjs` `lib/render.test.mjs` `lib/resolve.test.mjs` (teardown + new guard tests), `lib/transcribe-groq.mjs`, `steps/010-transcribe-run/run.sh`, `lib/board.mjs` (items 5a/5b only), `lib/lint-cues.mjs` (item 6 only), `lib/lint.test.mjs` (E4 guard test).

**Out of scope**: any board rendering/UX/save-merge logic; lint rule VALUES (caps, spacing — 060-fold territory); `assemble.mjs` (plans 084/085 own it); avatar-render beyond the mechanical import swap.

## Git workflow

- Branch: `boss/088-visuals-flow-hygiene`
- Commit per numbered design item (6 commits), conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: `lib/workdir.mjs` + 11 import swaps

**Verify**: `bash scripts/check.sh` → exit 0; `grep -rln "function resolveWorkdir" lib/ | wc -l` → 1.

### Step 2: test teardowns

**Verify**: run the leak check command above → equal counts (and both runs exit 0).

### Step 3: transcribe-groq + run.sh guards

**Verify**: `node lib/transcribe-groq.mjs test-01 --out` → `--out needs a file path`, exit 1 (no TypeError; GROQ_API_KEY check comes later so no network); `bash steps/010-transcribe-run/run.sh` → usage line, exit 1.

### Step 4: board 500 body + origin check (+ tests)

Add two cases to `lib/board.test.mjs` (its `startServer`/`fetch` conventions): a `POST /save` with header `Origin: http://evil.example` → 403; a `POST /save` with `Origin: http://127.0.0.1:<port>` → still 200-path behavior.

**Verify**: `node --test lib/board.test.mjs` → all pass.

### Step 5: lint-cues E4 short-video guard (+ test in `lib/lint.test.mjs`: a 30s-total fixture yields the single W-zones warning and zero E4 errors)

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Steps 2/4/5 carry their own new tests; the rest is covered by the existing 95-test suite passing unchanged.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] `.test-tmp` count identical across two consecutive gate runs.
- [ ] One `resolveWorkdir` definition repo-wide (in `lib/workdir.mjs`).
- [ ] Board: cross-origin POST → 403; 500 body is generic.
- [ ] `plans/README.md` row 088 updated to DONE.

## STOP conditions

- Any suite needs its assertions changed (beyond adding the new cases) to survive the teardown — that suite depended on leaked state; stop and report which.
- The origin check breaks the board's own UI fetches (same-origin `fetch('/save')` sends `Origin` on some browsers) — the allowlist above must accept it; if a legit board request still 403s after 2 fix attempts, stop and report.

## Maintenance notes

- `lib/workdir.mjs` is now the single home of the slug-or-path convention (INTEGRATION.md §3 documents it) — future workdir changes happen once.
- GFX-01 and GFX-02 backlog rows can be marked folded when this lands.
