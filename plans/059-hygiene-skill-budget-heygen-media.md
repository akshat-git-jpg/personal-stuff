---
executor: agy
model:
test_cmd: bash scripts/check-skill-descriptions.sh && cd tooling/cli/heygen-web && npm test
ui: false
deploy:
needs: ["PRE-DISPATCH: owner must move the untracked heygen-web media out of the main checkout first (see Pre-dispatch precondition)"]
---

# Plan 059: Hygiene pair — skill-description budget guard + heygen-web render-output policy

## Summary

- **Problem statement**: (a) The skill-description token budget (≤500 chars, hard cap ~700 — decisions.md 2026-07-04) has regressed again with no guard: `commit-now` is at 918 chars and 14 more skills sit between 500–700, taxing every session of both accounts. (b) 468MB of HeyGen render MP4s sit untracked inside `tooling/cli/heygen-web/` (violating the media policy: outputs live in `~/kb-scratch/`), and the valuable `renders-log.md` manifest is untracked and hand-maintained.
- **Goals**:
  - `scripts/check-skill-descriptions.sh` — measures every skill description; WARN >500, FAIL >700 (exit 1); wired into `scripts/relink.sh` so the cap can't silently regress again.
  - Trim `commit-now`'s description under 500 (exact replacement text below).
  - heygen-web: `.gitignore` for media, `renders-log.md` tracked (content inlined below, media paths pointing at `~/kb-scratch/heygen-web-renders/`), and an `appendRenderLog()` helper wired into the three submit operations so the manifest maintains itself.
- **Executor proposed**: agy, executor-default model (Gemini 3.1 Pro (High)).
- **Done criteria** (terse): test_cmd green (guard passes because commit-now is trimmed in the same branch; heygen offline tests pass incl. 2 new ones).
- **Stop conditions** (terse): drift vs excerpts; any live HeyGen call; any skill description rewrite other than commit-now.
- **Test / verification for success**: the guard run against the real store + `npm test` in heygen-web (offline).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report.
> Do NOT edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 855cdf9..HEAD -- scripts/relink.sh tooling/claude-skills/commit-now/SKILL.md tooling/cli/heygen-web/`
> Expect: no changes (except possibly `tooling/cli/heygen-web/` changes from plan 055's landing — if `src/operations/render.mjs` no longer matches the excerpt below, STOP).

## Pre-dispatch precondition (OWNER, main checkout — not the executor)

The main checkout holds ~468MB of **untracked** render outputs plus an untracked `renders-log.md` inside `tooling/cli/heygen-web/`. This plan makes `renders-log.md` a tracked file — if the untracked copy is still present at merge time, greenlight's merge will fail with "untracked working tree file would be overwritten". Before dispatch, run on the Mac:

```bash
mkdir -p ~/kb-scratch/heygen-web-renders
cd ~/codebase/personal-stuff/tooling/cli/heygen-web
mv girl-1 girl-2 test-man ~/kb-scratch/heygen-web-renders/
mv renders-log.md ~/kb-scratch/heygen-web-renders/renders-log.pre-059-backup.md
```

(Nothing is lost: this plan recreates `renders-log.md` as a tracked file with the same data, and the backup can be deleted after landing.)

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none (but see pre-dispatch precondition)
- **Category**: dx / tech-debt
- **Difficulty**: standard
- **Planned at**: commit `855cdf9`, 2026-07-11

## Why this matters

- **Skill budget**: every linked skill's description loads into every session of its account. The budget was set 2026-07-04, regressed by 2026-07-05 (recorded as backlog item `COST-01`), was partially re-trimmed, and has regressed again — because nothing enforces it. Measured at `855cdf9`: `commit-now` 918 (only one over the 700 hard cap); 14 more between 500–700 (`printing-press-amend` 683, `humanizer` 648, `debug-dbt-data-errors` 625, `create-feature-plan` 609, …). A guard at the relink chokepoint ends the regress-retrim cycle.
- **heygen-web media**: the media policy (decisions.md 2026-07-04) exists because the working tree hit 18GB and every agent search walked it. The untracked `girl-1/` (96MB), `girl-2/` (121MB), `test-man/` (251MB) recreate exactly that problem, and `renders-log.md` — the only record mapping outputs → avatar ids → video_ids — is one `rm -rf` from gone.

## Current state

### Skill store + relink

- `tooling/claude-skills/` holds 42 skill dirs; descriptions live in each `SKILL.md`'s YAML frontmatter (`description:` may be single-line or a multi-line block).
- `scripts/relink.sh` (34 lines) resolves `STORE` then calls `sync_skills_dir` twice (work + personal). Excerpt of the insertion area:

```bash
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPTS_DIR/lib/skill-link.sh"

STORE="$(cd "$SCRIPTS_DIR/../tooling/claude-skills" && pwd)"
```

- `tooling/claude-skills/commit-now/SKILL.md` frontmatter today: `name: commit-now`, a 918-char single-line `description:`, `user-invocable: true`, `metadata:` (author kbtg, version 2.0.0).

### heygen-web (post plan 055 layered refactor)

- No `.gitignore` in `tooling/cli/heygen-web/`.
- `src/operations/render.mjs` exports `submitGenerate`, `submitAudioGenerate`, `getTemplate`, `submitFromTemplate`, `studioRender`, `studioRenderStatus`. The three submit functions end respectively with:
  - `return { video_id: out?.data?.video_id, raw: out };` (submitGenerate)
  - `return { video_id: outVid };` after `if (!outVid) die(...)` (submitAudioGenerate)
  - `return { video_id: outVid };` after `if (!outVid) die(...)` (submitFromTemplate)
  - `basename` is already imported from `node:path` at the top of the file.
- `test/smoke.test.mjs` has a command-parity test asserting the exact CLI command set — this plan adds **no** command, so it must stay untouched.
- `npm test` = `node --test` run **from the package dir** (never `node --test <dir>` — broken on node 22).
- `CLAUDE.md` documents the layered architecture; its "Operational Gotchas" section is where the output-location note belongs.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Guard (after trim) | `bash scripts/check-skill-descriptions.sh` | WARN lines allowed, zero FAIL, exit 0 |
| Guard listing | `bash scripts/check-skill-descriptions.sh --list` | one `<len>  <skill>` line per skill |
| heygen tests | `cd tooling/cli/heygen-web && npm test` | all pass (existing + 2 new) |
| relink still valid | `bash -n scripts/relink.sh` | exit 0 |

## Scope

**In scope**:
- `scripts/check-skill-descriptions.sh` (new)
- `scripts/relink.sh` (edit)
- `tooling/claude-skills/commit-now/SKILL.md` (frontmatter description ONLY)
- `tooling/cli/heygen-web/.gitignore` (new)
- `tooling/cli/heygen-web/renders-log.md` (new tracked file)
- `tooling/cli/heygen-web/src/cli/render-log.mjs` (new)
- `tooling/cli/heygen-web/src/operations/render.mjs` (edit — 3 one-line insertions + 1 import)
- `tooling/cli/heygen-web/test/render-log.test.mjs` (new)
- `tooling/cli/heygen-web/CLAUDE.md` (add one gotcha bullet)

**Out of scope** (do NOT touch):
- Every other skill's `SKILL.md` — the 500–700 WARN group is deliberately left for an owner batch pass (descriptions are trigger-sensitive; mechanical trimming degrades skill routing)
- `scripts/lib/skill-link.sh`, the manifests
- `test/smoke.test.mjs` command-parity set
- Any live HeyGen call — everything verifies offline

## Git workflow

- Branch: `advisor/059-hygiene-skill-budget-heygen-media`
- Commits: one per step, conventional style — no AI footers. Do NOT push.

## Steps

### Step 1: `scripts/check-skill-descriptions.sh`

```bash
#!/usr/bin/env bash
# Guard the skill-description token budget (decisions.md 2026-07-04): every
# linked skill's description loads into EVERY session of that account.
# Budget ≤500 chars (WARN above), hard cap 700 (FAIL above → exit 1).
# Usage: check-skill-descriptions.sh [--list]
set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORE="$(cd "$SCRIPTS_DIR/../tooling/claude-skills" && pwd)"
python3 - "$STORE" "${1:-}" <<'PY'
import os, re, sys
store, mode = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
fails = warns = 0
for d in sorted(os.listdir(store)):
    f = os.path.join(store, d, "SKILL.md")
    if not os.path.isfile(f):
        continue
    m = re.match(r"^---\n(.*?)\n---", open(f).read(), re.S)
    if not m:
        continue
    dm = re.search(r"^description:\s*(.*?)(?=^\w[\w-]*:|\Z)", m.group(1), re.S | re.M)
    if not dm:
        continue
    n = len(dm.group(1).strip())
    if mode == "--list":
        print(f"{n:5d}  {d}")
    if n > 700:
        print(f"FAIL {d}: {n} chars (hard cap 700)"); fails += 1
    elif n > 500:
        print(f"WARN {d}: {n} chars (budget 500)"); warns += 1
print(f"{fails} over hard cap, {warns} over budget (42-ish skills scanned)")
sys.exit(1 if fails else 0)
PY
```

`chmod +x` it.

**Verify**: `bash scripts/check-skill-descriptions.sh; echo "exit=$?"` → currently prints `FAIL commit-now: 918 chars …` and `exit=1` (expected until Step 3).

### Step 2: wire the guard into `scripts/relink.sh`

Insert immediately after the `STORE=` line:

```bash
# Refuse to propagate over-cap descriptions to both accounts (COST-01 guard).
if [[ "${SKIP_DESC_GUARD:-}" != "1" ]]; then
  "$SCRIPTS_DIR/check-skill-descriptions.sh" || {
    echo "relink aborted: a skill description exceeds the 700-char hard cap." >&2
    echo "Trim it (budget ≤500) or rerun with SKIP_DESC_GUARD=1." >&2
    exit 1
  }
fi
```

**Verify**: `bash -n scripts/relink.sh` → exit 0. Do NOT run relink itself (it mutates `~/.claude-*/skills`).

### Step 3: trim `commit-now`'s description

In `tooling/claude-skills/commit-now/SKILL.md`, replace ONLY the `description:` value (keep `name`, `user-invocable`, `metadata` untouched, and change nothing below the frontmatter) with exactly:

```
Pre-commit gate for ANY git commit, however phrased — "commit now", "commit this", "commit and push", "push this" (push implies commit), "raise a PR", or committing as one step of a larger task. Runs prettier, lint, tsc, and build, auto-fixing what it can; proposes a single-line conventional-commit message (no body, no AI mention) and commits only after the user confirms (unattended sessions skip only the confirmation). NEVER pushes.
```

(That is ~450 chars; every dropped detail — `--no-verify` policy, footer bans, summary format — remains in the skill body, which only loads on invocation.)

**Verify**: `bash scripts/check-skill-descriptions.sh` → zero FAIL lines, exit 0 (WARNs remain — expected).

### Step 4: heygen-web `.gitignore` + tracked `renders-log.md`

`tooling/cli/heygen-web/.gitignore`:

```
# Render outputs live OUTSIDE the repo in ~/kb-scratch/heygen-web-renders/
# (media policy, decisions.md 2026-07-04). Only the renders-log.md manifest
# is tracked.
*.mp4
*.mp3
*.wav
girl-*/
test-man/
```

`tooling/cli/heygen-web/renders-log.md` — create with exactly this content (it preserves the previously untracked manifest; media paths now point at kb-scratch; the "Videos generated" table is deliberately the LAST section so `appendRenderLog()` rows land inside it):

```markdown
# heygen-web render log

Manifest of avatars created and videos generated with this CLI. All videos =
unlimited Avatar III (heygen3), 1080p, landscape 16:9 unless noted.
**Media files live outside the repo** in `~/kb-scratch/heygen-web-renders/`
(media policy); this tracked manifest is the record. Rows in "Videos
generated" are auto-appended on submit by `src/cli/render-log.mjs`
(output column starts as `(pending download)` — update it after downloading).

Audio sources (Google Drive, account kushalbakliwal25@gmail.com):
- **test-man audio** — folder `1x-uUSd-c5tZe3UoyD284tuTt5w2q2rsv` (male voiceover; intro/body/conclusion)
- **girl-1 audio** — folder `1H2Ffkqw_xWMUR20EWLWQ7ydTGAQ-rZoL` (intro/BODY/conclusion at root)
- **girl-2 audio** — folder `1KveaLcUr2j3KwudLK1XrxFWQYWKfbUvh` → `input/` subfolder (intro/body/conclusion)

HeyGen templates:
- `girl-1` = `7629dffbebe141eb8f701630948bd707` (Girl 1, 16:9)
- `girl-2` = `887ad69c743d4740a0174eecb3198ef4` (girl 2, 16:9)
- (also exist: Girl 3 `7ff3a8672bc24be8817be39139f2e044`, boy 1 `5692cc6b192e4a5db08ce967a377428f`)

**Note:** `generate-from-audio` only accepts Talking Photos (owned photo
avatars). Public/stock avatars and non-account avatar ids fail with
`photar_not_found`. To drive a public avatar with audio, a different
(non-photar) endpoint would be needed — not currently wired in this CLI.
Failed attempts kept for the record: avatar `f64bdab33dcf4136b32d66da2a74ed28`
(video `72395a3ee4c744c1973e2b544e4f2244`) and public avatar
`Hada_LivelyGestures_Side_public` (video `29c168a74df44866bab0b34abe2776a6`),
both `photar_not_found` on girl-1 intro audio.

## Avatars created (photo → Avatar III)

| Name | Source image (~/Downloads) | look_id (avatar_id) |
|---|---|---|
| Bearded Man 1 | `Bearded Man 2K Jul 9.jpeg` | `14eea609c76343399b1f74508b0f28a9` |
| Man with Specs Black Shirt | `Man with Specs Black Shirt Jul 09 2023.jpeg` | `6bdc449aaabf4f998c34ac7490260285` |
| Woman with Laptop | `Woman with Laptop 2K Jul 9.jpeg` | `3949a56f150941bd860d68c64e6f8f0b` |
| Harry (pre-existing) | — | `cb3a91d35fde44c8a32c04e0abb22710` |

## Videos generated

Filename convention: `<description>__<avatar-or-template-id>.mp4`. Paths are
relative to `~/kb-scratch/heygen-web-renders/`.

| Output file | Avatar / template | Audio | video_id |
|---|---|---|---|
| `bearded-man-1-tutorial__14eea609c76343399b1f74508b0f28a9.mp4` (~/Downloads) | Bearded Man 1 | TTS (tutorial script, Patrick voice) | `bfaef33977dd4778bb84a8e2d6b77e02` |
| `test-man/beardedman-intro__14eea609c76343399b1f74508b0f28a9.mp4` | Bearded Man 1 | test-man intro | `c232ac8259654e39ac06d4c793c02b72` |
| `test-man/harry-intro__cb3a91d35fde44c8a32c04e0abb22710.mp4` | Harry | test-man intro | `514febe2ef2f4c16a03068aaf04c1852` |
| `test-man/specsman-intro__6bdc449aaabf4f998c34ac7490260285.mp4` | Man with Specs Black Shirt | test-man intro | `ad4bcc76dd114cc485f85a1b8c040b35` |
| `girl-1/girl1-intro__7629dffbebe141eb8f701630948bd707.mp4` | template girl-1 | girl-1 intro | `dc52ec0d33cb4f62aa492c8d5698437c` |
| `girl-2/girl2-intro__887ad69c743d4740a0174eecb3198ef4.mp4` | template girl-2 | girl-2 intro | `3a9cf68b1cb0425790c98c6c393b16f7` |
| `girl-1/womanlaptop-intro__3949a56f150941bd860d68c64e6f8f0b.mp4` | Woman with Laptop | girl-1 intro | `7d4f89e1d5d3447eaadedd31be10ad5c` |
```

**Verify**: `git check-ignore tooling/cli/heygen-web/girl-1/x.mp4` → prints the path (ignored); `git status --short tooling/cli/heygen-web/renders-log.md` → shows as new/added.

### Step 5: `appendRenderLog()` + wiring + test + CLAUDE.md note

`tooling/cli/heygen-web/src/cli/render-log.mjs`:

```js
import { appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Append one manifest row to renders-log.md after a successful submit.
// The media itself lives outside the repo (~/kb-scratch/heygen-web-renders/);
// this log is the record. Logging must never break a render.
export function appendRenderLog({ output = "(pending download)", avatar, audio = "-", video_id }) {
  try {
    const log =
      process.env.HEYGEN_RENDERS_LOG ||
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "renders-log.md");
    if (!video_id || !existsSync(log)) return;
    appendFileSync(log, `| \`${output}\` | ${avatar} | ${audio} | \`${video_id}\` |\n`);
  } catch {
    /* never throw from logging */
  }
}
```

(The log path is resolved **inside** the function so tests can switch `HEYGEN_RENDERS_LOG` between calls.)

Wire into `src/operations/render.mjs` — add `import { appendRenderLog } from "../cli/render-log.mjs";` to the imports, then:

- `submitGenerate`: before the `return`, add
  `appendRenderLog({ avatar, audio: "TTS", video_id: out?.data?.video_id });`
- `submitAudioGenerate`: after the `if (!outVid) die(...)` line, add
  `appendRenderLog({ avatar, audio: basename(audioPath), video_id: outVid });`
- `submitFromTemplate`: after its `if (!outVid) die(...)` line, add
  `appendRenderLog({ avatar: templateId, audio: basename(audioPath), video_id: outVid });`

No changes to `studioRender`/`studioRenderStatus` (preview path, no final render).

`tooling/cli/heygen-web/test/render-log.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRenderLog } from "../src/cli/render-log.mjs";

test("appendRenderLog appends a table row to the log", () => {
  const dir = mkdtempSync(join(tmpdir(), "hg-log-"));
  const log = join(dir, "renders-log.md");
  writeFileSync(log, "| a | b | c | d |\n");
  process.env.HEYGEN_RENDERS_LOG = log;
  appendRenderLog({ avatar: "girl-1", audio: "intro.mp3", video_id: "vid123" });
  const text = readFileSync(log, "utf8");
  assert.match(text, /vid123/);
  assert.match(text, /\(pending download\)/);
});

test("appendRenderLog never throws when the log is missing", () => {
  process.env.HEYGEN_RENDERS_LOG = join(tmpdir(), "no-such-dir", "renders-log.md");
  appendRenderLog({ avatar: "x", audio: "y", video_id: "z" });
});

test("appendRenderLog skips rows without a video_id", () => {
  const dir = mkdtempSync(join(tmpdir(), "hg-log-"));
  const log = join(dir, "renders-log.md");
  writeFileSync(log, "");
  process.env.HEYGEN_RENDERS_LOG = log;
  appendRenderLog({ avatar: "x", audio: "y", video_id: undefined });
  assert.equal(readFileSync(log, "utf8"), "");
});
```

`CLAUDE.md`: add one bullet to "Operational Gotchas":

```
- **Render outputs never live in this folder.** Download to `~/kb-scratch/heygen-web-renders/` (media policy); `.gitignore` blocks media here. `renders-log.md` is the tracked manifest — submits auto-append a row via `src/cli/render-log.mjs`; fill in the output filename after downloading.
```

**Verify**: `cd tooling/cli/heygen-web && npm test` → all tests pass (existing suite + 3 new). The command-parity smoke test must be untouched and green.

## Test plan

Frontmatter test_cmd (offline): `bash scripts/check-skill-descriptions.sh && cd tooling/cli/heygen-web && npm test`. The guard proves the trim landed AND the cap is enforceable; the node tests prove the helper appends, skips, and never throws — no live HeyGen call anywhere.

## Done criteria

- [ ] test_cmd exits 0.
- [ ] `check-skill-descriptions.sh --list` prints a length for every skill; only WARNs remain.
- [ ] `relink.sh` refuses (exit 1) on a >700 description unless `SKIP_DESC_GUARD=1`.
- [ ] `commit-now` description ≤500 chars; frontmatter otherwise byte-identical; body untouched.
- [ ] heygen-web: media ignored, `renders-log.md` tracked with the inlined content, 3 submit paths append rows, 3 new tests pass, smoke parity test untouched.
- [ ] `git diff --stat` vs base shows only in-scope paths.

## STOP conditions

- `src/operations/render.mjs` no longer contains the three `return { video_id: … }` shapes excerpted above (plan 055 follow-ups may have changed it) — report, don't improvise.
- Any step would trim/rewrite a skill description other than `commit-now`.
- Any step would execute a live heygen-web command (network) — offline only.
- `test/smoke.test.mjs` needs modification to pass — it must not; report instead.

## Post-merge (owner)

1. Delete `~/kb-scratch/heygen-web-renders/renders-log.pre-059-backup.md` after confirming the tracked manifest matches.
2. Optionally schedule the WARN-group description batch-trim (14 skills, 500–700 chars) as its own pass — descriptions are trigger-sensitive, owner judgment per skill.

## Maintenance notes

- New skills fail relink loudly if their description exceeds 700 — that's the point; trim at authoring time (claude-router's authoring flow should mention the budget).
- If heygen-web ever gains a real `download` workflow, have it update the row's output column (match on `video_id`) instead of appending a duplicate.
