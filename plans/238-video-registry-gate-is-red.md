---
executor: agy
model:
test_cmd: cd pipelines/video-registry && node --test registry.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video-registry/videos.json, tooling/cli/pp-land/verify-map.tsv]

mutation_apply: python3 -c "import io;p='pipelines/video-registry/videos.json';s=io.open(p,encoding='utf-8').read();s=s.replace('\"character-consistency-ai\"','\"zzz-mutated-key\"',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: node --test registry.test.mjs
mutation_expect: unregisteredDirs is empty for the committed registry
mutation_cwd: pipelines/video-registry
mutation_timeout: 300
---

# Plan 238: the video-registry gate is red on main and nobody can see it

## Summary

- **Problem statement**: `pipelines/video-registry/registry.test.mjs` has been failing on
  `main` (15 pass / 1 fail) because two video directories exist with no registry entry.
  Nothing surfaces it: `pipelines/video-registry/` has **no row** in
  `tooling/cli/pp-land/verify-map.tsv`, so `pp-land` never runs this suite on any land.
- **Goals**:
  - Register the two unregistered directories, using decisions already made below.
  - Add `pipelines/video-registry/` to `verify-map.tsv` so the suite runs on every land
    that touches it, and can never go silently red again.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every decision is inlined; this is
  data entry plus a one-line TSV append.
- **Done criteria** (terse): `node --test registry.test.mjs` reports 16 pass / 0 fail, and
  `verify-map.tsv` carries a `pipelines/video-registry/` row.
- **Stop conditions** (terse): do not weaken or delete the `unregisteredDirs` assertion; do
  not rename any directory; do not alias `character-consistency-ai`.
- **Test / verification for success**: the repo's own existing test, which currently fails
  and must pass. The mutation gate proves it can still fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4375bec1..HEAD -- pipelines/video-registry/ tooling/cli/pp-land/verify-map.tsv`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Difficulty**: mechanical
- **Planned at**: commit `4375bec1`, 2026-08-25

## Why this matters

`pipelines/video-registry/` is the authority on what a video is called
(`decisions.md` 2026-08-09). Its test suite contains a self-check —
`unregisteredDirs is empty for the committed registry` — whose whole job is to catch a
video folder that nobody registered. That check works. It is failing right now.

It is invisible for one reason: `pp-land` decides which suite to run from
`tooling/cli/pp-land/verify-map.tsv`, and that file has no row for
`pipelines/video-registry/`. So every land touching the registry has skipped its tests.

This is the same failure shape as LESSONS 2026-07-21: *"a plan's `test_cmd` must execute
in EVERY directory the plan writes to; boss has no other merge signal, so a gate that
cannot see half the work lands half-finished work marked done."* Here the gate exists and
is simply never invoked.

Fixing the data without wiring the map would let it rot again in a month. Both halves are
the deliverable.

## Current state

### The failing test

`pipelines/video-registry/registry.test.mjs:119`:

```js
test("unregisteredDirs is empty for the committed registry", () => {
  assert.deepStrictEqual(unregisteredDirs(), []);
});
```

Running it today (`cd pipelines/video-registry && node --test registry.test.mjs`):

```
# tests 16
# pass 15
# fail 1

not ok 13 - unregisteredDirs is empty for the committed registry
    Expected values to be strictly deep-equal:
    + actual - expected
    + [
    +   '.../pipelines/youtube/yt-script/videos/ai-avatar-generator-comparison',
    +   '.../pipelines/youtube/yt-script/videos/character-consistency-ai'
    + ]
    - []
```

### The registry file

`pipelines/video-registry/videos.json` — `version: 1`, a `videos` object keyed by slug,
sorted by key. Eight entries today. Entry shape:

```json
"ai-avatar-online-courses": {
  "title": "Best Realistic AI Avatar Generator for Online Courses & Training",
  "minted": "2026-08-12",
  "aliases": []
}
```

An alias example already in the file:

```json
"best-ai-video-generator": {
  "title": "Best AI Video Software — Pictory vs InVideo vs Fliki vs Synthesia vs Lumen5",
  "minted": "2026-07-31",
  "aliases": ["ai-video-tools-comparison"]
}
```

### The CLI (do not hand-edit if a verb exists)

`bin/vreg.mjs` provides:

| Command | Does |
|---|---|
| `node bin/vreg.mjs mint <key> [--title "..."]` | register a new key; fails if the name is taken |
| `node bin/vreg.mjs alias <key> <other-name>` | point another name at an existing key |
| `node bin/vreg.mjs check` | exit 1 listing any `videos/` dir the registry does not know |
| `node bin/vreg.mjs list` | every registered video |

### The verify map

`tooling/cli/pp-land/verify-map.tsv` — TAB-separated, `<path prefix>\t<command>`. Existing
rows for comparison:

```
pipelines/video/visuals-flow/	cd pipelines/video/visuals-flow && bash scripts/check.sh
apps/tutorial-tracker-app/	cd apps/tutorial-tracker-app && npm test
```

There is **no** `pipelines/video-registry/` row. `grep -c video-registry
tooling/cli/pp-land/verify-map.tsv` returns `0`.

### The two decisions, already made — obey these, do not re-derive them

`decisions.md` 2026-08-09 is explicit that backfill is established **from content, never
from name similarity**: `ai-avatar-generators` and `consistent-ai-influencer` look like a
pair and are two different videos.

**1. `ai-avatar-generator-comparison` is an ALIAS of the existing key
`ai-avatar-online-courses`.**

Evidence, from `pipelines/youtube/yt-script/videos/ai-avatar-generator-comparison/knowledge.md`:

```
# Video title

Production Blueprint and Technical Evaluation: AI Avatar Generators for Online Courses and Training
(working title given to me: "best ai avatar generator for online courses & training")
```

The registry's existing `ai-avatar-online-courses` entry has title
`"Best Realistic AI Avatar Generator for Online Courses & Training"`. The working title is
a verbatim match. Both cover HeyGen / Synthesia / VEED.io / Colossyan / D-ID for course
creators and corporate trainers.

It is **NOT** an alias of `ai-avatar-generators`, whose title is
`"Best Realistic AI Avatar Generator for YouTube Videos"` — a different audience and a
different video. Aliasing it there is the exact trap `decisions.md` documents.

**2. `character-consistency-ai` is a NEW key. Do not alias it to anything.**

Its own title, from `.../character-consistency-ai/knowledge.md`:

```
# Video title

Best AI Tool for Character Consistency in Videos
```

Three existing keys look adjacent and are all different videos:

| Existing key | Its title | Why it is not this |
|---|---|---|
| `consistent-ai-influencer` | "Consistent AI influencer" | an influencer persona, not a tool comparison |
| `consistent-character-ai-animation-howto` | "How To Create Long AI Animation Videos with Consistent Characters" | a long-animation how-to |
| `ai-avatar-generators` | "Best Realistic AI Avatar Generator for YouTube Videos" | avatars, not character consistency |

`character-consistency-ai` is a best-tool comparison framed for AI stories, short films
and social campaigns, and it exists **only** on the script side — there is no
`visuals-flow/videos/character-consistency-ai/`, consistent with a video whose script is
written and whose edit has not started.

**Rule applied:** when the evidence is not verbatim, mint rather than alias. Minting is
reversible (an alias can be added later); aliasing merges two videos permanently.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Reproduce the failure | `cd pipelines/video-registry && node --test registry.test.mjs` | 16 tests, **1 fail** before your change |
| The suite (merge gate) | `cd pipelines/video-registry && node --test registry.test.mjs` | 16 tests, **0 fail** after |
| Registry self-check | `cd pipelines/video-registry && node bin/vreg.mjs check` | exit 0, no output after |
| List entries | `cd pipelines/video-registry && node bin/vreg.mjs list` | 9 keys after |
| Verify-map row present | `grep -c 'pipelines/video-registry/' tooling/cli/pp-land/verify-map.tsv` | `1` |

`node --test <directory>` is broken on node 22.14 (LESSONS 2026-07-09) — always pass the
**file**, `registry.test.mjs`, exactly as written above.

## Scope

**In scope**:
- `pipelines/video-registry/videos.json`
- `tooling/cli/pp-land/verify-map.tsv`

**Out of scope**:
- `pipelines/video-registry/registry.test.mjs` — the assertion is correct. Changing it is a
  STOP condition.
- `pipelines/video-registry/lib/registry.mjs` and `bin/vreg.mjs` — no logic change needed.
- **Any directory under `pipelines/youtube/yt-script/videos/` or
  `pipelines/video/visuals-flow/videos/`.** Looks related; do not touch. `decisions.md`
  2026-08-09: "The registry NEVER renames a directory" — workdirs carry render caches,
  assembly caches and run-log ledger keys that embed the slug.
- `decisions.md` — the orchestrator appends the entry for this batch, not you.

## Git workflow

- Branch: `advisor/238-video-registry-gate-is-red`
- Commit: `fix(video-registry): register two drifting videos` — no AI footers. Do NOT push.

## Steps

### Step 1: Reproduce the failure before changing anything

```bash
cd pipelines/video-registry && node --test registry.test.mjs
```

**Verify**: output contains `# fail 1` and
`not ok 13 - unregisteredDirs is empty for the committed registry`, naming both
`ai-avatar-generator-comparison` and `character-consistency-ai`.

If it is already green, STOP and report — someone changed the registry since commit
`4375bec1` and this plan's decisions need re-checking.

### Step 2: Alias `ai-avatar-generator-comparison` onto `ai-avatar-online-courses`

Use the CLI, not a hand edit:

```bash
cd pipelines/video-registry && node bin/vreg.mjs alias ai-avatar-online-courses ai-avatar-generator-comparison
```

**Verify**:
`cd pipelines/video-registry && node bin/vreg.mjs resolve ai-avatar-generator-comparison`
-> prints `ai-avatar-online-courses`, exit 0.

### Step 3: Mint `character-consistency-ai` as a new key

```bash
cd pipelines/video-registry && node bin/vreg.mjs mint character-consistency-ai --title "Best AI Tool for Character Consistency in Videos"
```

**Verify**:
`cd pipelines/video-registry && node bin/vreg.mjs resolve character-consistency-ai`
-> prints `character-consistency-ai`, exit 0. And
`node -e "const v=require('./videos.json');if(v.videos['character-consistency-ai'].aliases.length!==0)throw new Error('must have zero aliases')"`
-> exit 0.

A newly minted video has zero aliases (`pipelines/video-registry/CLAUDE.md`). If this key
has any, something aliased it wrongly — STOP.

### Step 4: Confirm the suite is green and the file stayed sorted

```bash
cd pipelines/video-registry && node --test registry.test.mjs
```

**Verify**: `# pass 16` and `# fail 0`.

Then confirm key order was preserved (the file is sorted by key — `CLAUDE.md`):

```bash
cd pipelines/video-registry && node -e "const k=Object.keys(require('./videos.json').videos);const s=[...k].sort();if(JSON.stringify(k)!==JSON.stringify(s))throw new Error('videos.json keys are not sorted');console.log(k.length)"
```

**Verify**: prints `9`, exit 0.

### Step 5: Wire the suite into the verify map

Append **one TAB-separated row** to `tooling/cli/pp-land/verify-map.tsv`. The separator
between the prefix and the command must be a literal TAB, matching every existing row:

```
pipelines/video-registry/	cd pipelines/video-registry && node --test registry.test.mjs
```

**Verify**:

```bash
grep -c 'pipelines/video-registry/' tooling/cli/pp-land/verify-map.tsv
```
-> `1`

And confirm the separator really is a tab (this fails if spaces were used):

```bash
awk -F'\t' '$1=="pipelines/video-registry/" && NF==2 {n++} END {exit !(n==1)}' tooling/cli/pp-land/verify-map.tsv && echo TAB_OK
```
-> prints `TAB_OK`, exit 0.

### Step 6: Commit

```bash
git add pipelines/video-registry/videos.json tooling/cli/pp-land/verify-map.tsv
git commit -m "fix(video-registry): register two drifting videos"
```

Stage those two paths explicitly. Never `git add -A`. Do not push.

**Verify**: `git status --short` shows nothing staged or modified in the in-scope paths.

## Test plan

No new test file. This plan makes an **existing** test pass, which is the stronger
signal — the assertion was written before the drift and is not tuned to it.

The mutation gate in the frontmatter proves the test can still fail: it renames the
`character-consistency-ai` key in `videos.json`, which must make
`unregisteredDirs is empty for the committed registry` fail again, then reverts. Without
this, a green suite would not distinguish "registered correctly" from "assertion no longer
runs".

## Done criteria

- [ ] `cd pipelines/video-registry && node --test registry.test.mjs` -> `# pass 16`, `# fail 0`
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs check` -> exit 0, no output
- [ ] `cd pipelines/video-registry && node bin/vreg.mjs list` -> 9 keys
- [ ] `node bin/vreg.mjs resolve ai-avatar-generator-comparison` -> `ai-avatar-online-courses`
- [ ] `node bin/vreg.mjs resolve character-consistency-ai` -> `character-consistency-ai`
- [ ] `videos.json` -> `character-consistency-ai` has `"aliases": []`
- [ ] `videos.json` keys are still sorted, and the file still parses as JSON
- [ ] `awk -F'\t' '$1=="pipelines/video-registry/" && NF==2' tooling/cli/pp-land/verify-map.tsv` -> one row
- [ ] `git diff --stat` touches exactly two files
- [ ] No directory under any `videos/` tree was created, renamed, moved or deleted:
      `git diff --name-status 4375bec1..HEAD | grep -E 'videos/(yt-script|visuals-flow)?' ; test $? -ne 0`

## STOP conditions

- **The `unregisteredDirs` assertion fails and you are tempted to change the test.** Fix
  the data, never the assertion. Weakening, swapping or deleting a gate assertion is a
  STOP (LESSONS 2026-07-31, 2026-07-24 — crews reliably soften assertions to pass).
- **You are about to rename, move or delete a directory.** `decisions.md` 2026-08-09
  forbids it: workdirs embed the slug in render caches, assembly caches and run-log ledger
  keys, and plan 199 migrated ledger slug keys once and it was painful.
- **You are about to alias `character-consistency-ai` to anything.** This plan's evidence
  says it is a distinct video. If you believe otherwise, stop and report the evidence —
  do not act on it.
- **Step 1 shows the suite already green.** The registry changed under this plan; the
  content decisions need re-verifying against the new state.
- **`vreg mint` or `vreg alias` errors** (e.g. "name is taken"). Do not hand-edit
  `videos.json` to force it through — report the error.
- **The suite hangs.** Do not wait it out. `registry.test.mjs` opens no servers, so a hang
  means something else is wrong; report it.

## Maintenance notes

- After this lands, `pipelines/video-registry/` is a mapped path, so **any** future land
  touching it runs this suite. A new video directory created without `vreg ensure` will now
  fail a land rather than rotting silently. That is the intent.
- `vreg check` is still deliberately **not** wired into any merge gate as a standalone
  command (`decisions.md` 2026-08-09: a scratch workdir would turn the gate red). The
  `registry.test.mjs` assertion is the gate; `vreg check` stays a report. Do not "improve"
  this by adding `vreg check` to `test_cmd`.
- `test-01` is a pipeline test fixture with no tracker card, and it is already registered.
  Leave it.
- A reviewer should scrutinise exactly one thing: **the two content decisions**. The alias
  rests on a verbatim working-title match; the mint rests on a distinct title plus the
  absence of an edit-side folder. Everything else is mechanical.
