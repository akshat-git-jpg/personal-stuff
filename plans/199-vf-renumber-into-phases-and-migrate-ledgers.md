---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
allow_artifacts: true
needs: []
needs_prs: [154, 155, 156, 157, 158]
touches: [pipelines/video/visuals-flow/steps, pipelines/video/visuals-flow/lib/steps.mjs, pipelines/video/visuals-flow/lib/run-log.mjs, pipelines/video/visuals-flow/lib/ledger-migration.mjs, pipelines/video/visuals-flow/lib/ledger-migration.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/PIPELINE.md, pipelines/video/visuals-flow/videos]

mutation_apply: python3 -c "import base64;exec(base64.b64decode('cD0ncGlwZWxpbmVzL3ZpZGVvL3Zpc3VhbHMtZmxvdy9saWIvbGVkZ2VyLW1pZ3JhdGlvbi5tanMnCnM9b3BlbihwKS5yZWFkKCkKbWFya2VyPSdTTFVHX01JR1JBVElPTicKYXNzZXJ0IG1hcmtlciBpbiBzLCAnbWFya2VyIG1pc3Npbmcg4oCUIHBsYW4gMTk5IFN0ZXAgMyBkaWQgbm90IGxhbmQnCiMgRHJvcCBvbmUgbWFwcGluZy4gRXZlcnkgZ2F0ZSBzdGF5cyBncmVlbiB3aGlsZSBvbmUgdmlkZW8ncyBoaXN0b3J5IHNpbGVudGx5CiMgc3RvcHMgcmVzb2x2aW5nIHRvIGEgc3RlcCDigJQgd2hpY2ggaXMgZXhhY3RseSB0aGUgZmFpbHVyZSB0aGlzIHBsYW4gbXVzdCBub3Qgc2hpcC4KaW1wb3J0IHJlCnMgPSByZS5zdWIociJcblxzKicwMTAtdHJhbnNjcmliZS1ydW4nOlxzKidbXiddKicsIiwgIlxuIiwgcywgY291bnQ9MSkKb3BlbihwLCd3Jykud3JpdGUocyk='))"
mutation_command: cd pipelines/video/visuals-flow && node --test lib/ledger-migration.test.mjs
mutation_expect: LEDGER-KEY-ORPHANED
mutation_cwd:
mutation_timeout:
---

# Plan 199: visuals-flow — renumber into phase buckets and migrate the ledgers

## Summary

- **Problem statement**: the step numbers grew by insertion (`005, 010, 015, 020,
  025, 027, 030, 035, 037, 038, 040, 050, 060, 080, 090, 100, 110, 120, 130, 140,
  150`, plus everything plans 196–198 added at whatever slot was free). There is
  no phase structure, `130-learn-from-feedback` is numbered *before* delivery
  although it consumes post-delivery feedback, and three steps in the intro flow
  are crammed into one folder. The owner's restructure gives every phase the same
  rhythm — **author → review cheaply → approve → spend** — and that only reads if
  the numbers say so.
- **Goals**:
  - Renumber every step into `0xx`–`6xx` phase buckets, in tens, so there is room
    to insert.
  - Split `027-approve-intro-film-human` into its three real steps: review,
    approve, render.
  - Migrate the slug keys in all three `run-log.json` ledgers in one pass, with a
    map that is machine-checked for completeness.
  - Make the registry express the **two parallel tracks** so the next-hint stops
    serialising the intro film behind the card plan.
- **Executor proposed**: `claude-p` / sonnet. The map and the migration module
  are fully inlined, so this is not the agy default's fault — but STOP condition 2
  leaves one genuine judgment call mid-run (a ledger key absent from the map must
  be *identified*, or the run stops), and unlike every other plan in this batch
  the failure mode is unrecoverable: 39 entries of owner history with no second
  copy, one video live. That is `rules.md`'s "plan can't be fully inlined — real
  judgment expected mid-execution" row. Owner call, 2026-08-07.
- **Done criteria** (terse — full list below): `check.sh` exits 0 **on a fresh
  checkout**; every ledger key resolves to a step; `PIPELINE.md` lists the phases.
- **Stop conditions** (terse — full list below): any ledger entry lost; the map
  incomplete; a step folder renamed without a map entry.
- **Test / verification for success**: `scripts/check.sh` on a pristine tree, a
  new `lib/ledger-migration.test.mjs`, and a mutation proving an incomplete map
  is caught.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/run.sh`
>
> **This is the LAST plan of a six-plan batch.** Expect large drift from 194–198.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH — it renames every step folder and rewrites owner data
- **Depends on**: 194, 195, 196, 197, 198 — the step SET must be final before it is numbered
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

`lib/steps.mjs`'s own header records what happens when step identity is loose:
*"renumbering a step broke running code with nothing to catch it (PIPELINE.md
records a rename sweep that already destroyed a mapping table)."* The registry
was built so a rename is safe — one declaration, everything derived. This plan is
the first time that promise is actually exercised at scale, and the one thing the
registry does **not** cover is the ledger: `lib/run-log.mjs` derives its valid
keys from step slugs, so a rename orphans every historical entry filed under the
old name.

That is why the map is a checked artifact rather than a shell script. Two of the
three videos are finished (`best-ai-video-generator` and `opusclip-vs-submagic`,
17 entries each, both reaching `150-deliver-drive-run`) — their ledgers are
history, and history that no longer resolves to a step is unreadable. The third,
`consistent-ai-influencer`, is **live at 025 with 5 entries**: get it wrong and
the pipeline forgets where the in-flight video is.

Doing it now is the cheap moment. Every future video adds ~17 more entries under
the old names.

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

### The ledger binds to folder names

`lib/run-log.mjs` line 25:

```js
  return loadSteps({ dir: stepsDir }).map((s) => s.slug);
```

and a real ledger keys on the full slug:

```json
{
  "video": "consistent-ai-influencer",
  "steps": {
    "010-transcribe-run": { "status": "done", "started": "…", "did": "Transcribed the 20:30 voiceover…" }
  }
}
```

### The three ledgers

| Video | Entries | Last key | State |
|---|---|---|---|
| `best-ai-video-generator` | 17 | `150-deliver-drive-run` | finished |
| `consistent-ai-influencer` | 5 | `025-author-intro-film-llm` | **live, at 025** |
| `opusclip-vs-submagic` | 17 | `150-deliver-drive-run` | finished |

### `027` is three steps in one folder

```json
{
  "number": "027",
  "slug": "027-approve-intro-film-human",
  "verbs": ["intro-review", "intro-render"],
  "gate": { "file": "intro-film/screenplay.json", "field": "approved", "label": "Intro Film" },
  "tab": "intro"
}
```

One folder holding a cheap review, an owner gate and a 67-second encode. Nothing
stops rendering a film nobody reviewed, because the review is a sibling verb
rather than a prior step.

### The next-hint serialises everything

`lib/steps.mjs` `nextStep()` walks the registry in number order and returns the
first unsatisfied step. With the intro film numbered `025`–`027`, an owner gate
there stops the walk — so waiting on the intro idea blocks the body cue pass,
even though the two share no artifact. (`025`'s own contract forbids it from
reading `catalog.json`, `cues.json` or `card-plan.json`; the independence is
already a documented, enforced rule.)

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, `visuals-flow check OK` |
| Migration tests | `cd pipelines/video/visuals-flow && node --test lib/ledger-migration.test.mjs` | exits 0 |
| Dry-run the migration | `cd pipelines/video/visuals-flow && node lib/ledger-migration.mjs --dry-run` | prints per-video before/after counts, writes nothing |
| Apply the migration | `cd pipelines/video/visuals-flow && node lib/ledger-migration.mjs --apply` | rewrites the three ledgers |
| Regenerate the doc | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs` | rewrites `PIPELINE.md` |
| Fresh-checkout gate | see Step 8 | exits 0 on a pristine tree |

## Scope

**In scope**:
- Every folder under `steps/` — renamed, with `number` and `slug` updated inside
  each `step.json`
- `027` split into three folders
- New `lib/ledger-migration.mjs` + `lib/ledger-migration.test.mjs`
- `videos/*/run-log.json` — keys rewritten (the only owner data this batch edits)
- `lib/steps.mjs` — the two-track next-hint
- `run.sh`, `PIPELINE.md` (regenerated)

**Out of scope** — looks related, do not touch:
- **Any step's behaviour.** This plan moves and splits; it changes no logic. The
  `027` split reassigns existing verbs to new folders without editing what they do.
- **Artifact filenames** inside `videos/<slug>/`. Only ledger *keys* change.
- **`plans/`** — other plans reference old numbers in prose; that is history.
- **The board's tab ids.** Tabs are named `intro`/`storyboard`/`final-cut`, not
  numbered. `lib/board-data.mjs` derives them from `step.tab`, which is unchanged.

## Git workflow

- Branch: `advisor/199-vf-renumber-into-phases-and-migrate-ledgers`
- Commit per step, message `plan 199 step N: <what>` — no AI footers. Do NOT push.
- **Use `git mv`** for every rename so history follows the file.

## Steps

### Step 1: Confirm a green baseline and record the ledger inventory

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
for f in videos/*/run-log.json; do
  node -e "const d=require('./$f');console.log('$f', Object.keys(d.steps).length, Object.keys(d.steps).sort().join(' '))"
done > /tmp/ledger-before.txt
cat /tmp/ledger-before.txt
```

**Verify**: `check.sh` exits 0; `/tmp/ledger-before.txt` has three lines. Keep
this file — Step 7 diffs against it.

### Step 2: split `027` into review / approve / render

Three folders, all at temporary numbers (Step 4 renumbers them):

- `steps/027a-review-intro-frames-run/` — `verbs: ["intro-review"]`,
  `produces: ["intro-film/review/REVIEW.md"]`, `gate: null`, `tab: null`,
  `actor: "run"`. Summary: renders ~36 stills and runs the checks, ~15s against a
  ~67s encode — the beat sheet where each stage direction sits beside the frames
  it produced.
- `steps/027b-approve-intro-film-human/` — `verbs: []`, keeps the existing
  `gate` and `tab: "intro"`, `actor: "human"`.
- `steps/027c-render-intro-film-run/` — `verbs: ["intro-render"]`,
  `produces: ["intro-film/out/intro.mp4"]`, `gate: null`, `tab: null`,
  `actor: "run"`.

Delete `steps/027-approve-intro-film-human/`, moving its README content across.
**No verb changes** — `run.sh`'s `intro-review` and `intro-render` cases are
untouched; only which folder declares them moves.

**Verify**: `node scripts/gen-pipeline-table.mjs && node scripts/gen-pipeline-table.mjs --check` exits 0;
`node lib/steps.mjs verbs | grep -c "^intro-review$\|^intro-render$"` → `2`

### Step 3: `lib/ledger-migration.mjs` — the map, checked

Create it with this content. **The map is the deliverable** — every old slug the
batch renames must appear exactly once.

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadSteps } from './steps.mjs';

// Renaming a step folder orphans every ledger entry filed under the old name:
// lib/run-log.mjs derives its valid keys from step slugs. Three videos carry 39
// entries between them and one of them is live, so this map is a checked
// artifact rather than a sed script (plan 199).
//
// Left = the slug as it existed after plans 194-198. Right = its 0xx-6xx home.
export const SLUG_MIGRATION = {
  // 0xx intake
  '005-configure-run-human':              '010-configure-run-human',
  '010-transcribe-run':                   '020-transcribe-run',
  '012-clean-transcript-llm':             '030-clean-transcript-llm',
  '015-map-segments-run':                 '040-split-narration-demo-run',
  '020-choose-concept-llm':               '050-choose-concept-llm',
  // 1xx intro film
  '026-propose-intro-idea-llm':           '110-propose-intro-idea-llm',
  '028-approve-intro-idea-human':         '120-approve-intro-idea-human',
  '025-author-intro-film-llm':            '130-author-intro-screenplay-llm',
  '027a-review-intro-frames-run':         '140-review-intro-frames-run',
  '027b-approve-intro-film-human':        '150-approve-intro-film-human',
  '027c-render-intro-film-run':           '160-render-intro-film-run',
  // 2xx card plan
  '030-pick-or-propose-graphics-llm':     '210-author-body-cues-llm',
  '035-pick-or-propose-intro-outro-llm':  '220-author-conclusion-cues-llm',
  '036-review-cue-plan-run':              '230-review-cue-plan-run',
  '038-build-cards-llm-and-review-human': '240-build-cards-llm',
  // 3xx storyboard
  '040-sync-graphics-run':                '310-sync-graphics-run',
  '060-place-avatar-llm':                 '320-place-avatar-llm',
  '070-review-storyboard-run':            '330-review-storyboard-run',
  '080-approve-storyboard-human':         '340-approve-storyboard-human',
  // 4xx render
  '090-render-graphics-run':              '410-render-graphics-run',
  '102-propose-avatar-human':             '420-propose-avatar-human',
  '100-render-avatar-run':                '430-render-avatar-run',
  '108-rerender-intro-film-run':          '440-rerender-intro-film-run',
  '105-plan-sound-run':                   '450-plan-sound-run',
  '107-mix-audio-run':                    '460-mix-audio-run',
  // 5xx cut
  '110-build-video-run':                  '510-assemble-video-run',
  '115-review-cut-run':                   '520-review-cut-run',
  '120-approve-final-cut-human':          '530-approve-final-cut-human',
  // 6xx deliver and learn
  '140-davinci-export-run':               '610-davinci-export-run',
  '150-deliver-drive-run':                '620-deliver-drive-run',
  '130-learn-from-feedback-opus':         '630-learn-from-feedback-opus',
};

// Steps deleted earlier in the batch. A ledger entry under one of these is
// HISTORY, not an orphan — it records work that really happened on a step that
// no longer exists. Keep the entry, prefix it so it can never be mistaken for a
// live step, and say why.
export const RETIRED_SLUGS = {
  '050-review-graphics-llm':        'retired/050-review-graphics-llm',        // folded into 330 (plan 196)
  '037-approve-card-plan-human':    'retired/037-approve-card-plan-human',    // gate removed (plan 195)
};

export function migrateLedger(ledger) {
  const out = { ...ledger, steps: {} };
  const unmapped = [];
  for (const [key, value] of Object.entries(ledger.steps ?? {})) {
    const next = SLUG_MIGRATION[key] ?? RETIRED_SLUGS[key];
    if (!next) { unmapped.push(key); continue; }
    out.steps[next] = value;
  }
  return { ledger: out, unmapped };
}

// Every RIGHT-hand slug must be a real step folder, and nothing may be dropped.
export function checkMigration({ steps = null, ledgers = [] } = {}) {
  const errors = [];
  const known = new Set((steps ?? loadSteps()).map((s) => s.slug));
  for (const [from, to] of Object.entries(SLUG_MIGRATION)) {
    if (!known.has(to)) {
      errors.push(`LEDGER-KEY-ORPHANED: ${from} maps to ${to}, which is not a step folder`);
    }
  }
  for (const { video, ledger } of ledgers) {
    const { ledger: next, unmapped } = migrateLedger(ledger);
    for (const key of unmapped) {
      errors.push(`LEDGER-KEY-ORPHANED: ${video}'s ledger has "${key}", which the migration map does not cover — that video's history would stop resolving to a step`);
    }
    const before = Object.keys(ledger.steps ?? {}).length;
    const after = Object.keys(next.steps).length;
    if (before !== after) {
      errors.push(`LEDGER-KEY-ORPHANED: ${video} had ${before} entries and would have ${after} — the migration must never lose one`);
    }
  }
  return { ok: errors.length === 0, errors };
}
```

Add a CLI entry supporting `--dry-run` (report only) and `--apply` (write, after
copying each `run-log.json` to `run-log.json.bak`).

**Verify**: `node lib/ledger-migration.mjs --dry-run` prints three videos and
writes nothing (`git status --porcelain videos/` is empty).

### Step 4: rename every step folder

For each pair in `SLUG_MIGRATION`, `git mv` the folder, then update `number` and
`slug` inside its `step.json` to match. The folder name and `slug` must be
identical and the folder must start with `number-` — `validateStep()` enforces
both, so a mismatch fails loudly at load rather than silently.

```bash
cd pipelines/video/visuals-flow
node -e '
const { SLUG_MIGRATION } = await import("./lib/ledger-migration.mjs");
const fs = require("fs");
for (const [from, to] of Object.entries(SLUG_MIGRATION)) {
  if (!fs.existsSync(`steps/${from}`)) { console.error("MISSING " + from); process.exit(1); }
  console.log(`git mv steps/${from} steps/${to}`);
}
' > /tmp/renames.sh
sh /tmp/renames.sh
```

then rewrite each `step.json`:

```bash
for d in steps/*/; do
  slug=$(basename "$d")
  node -e '
    const fs=require("fs"); const p=process.argv[1]; const slug=process.argv[2];
    const o=JSON.parse(fs.readFileSync(p,"utf8"));
    o.number = slug.slice(0,3); o.slug = slug;
    fs.writeFileSync(p, JSON.stringify(o,null,2)+"\n");
  ' "$d/step.json" "$slug"
done
```

Also update the `title` of the two steps whose job changed name:
`040-split-narration-demo-run` → `"split narration from demo"`;
`130-author-intro-screenplay-llm` → `"author the intro screenplay"`.

**Verify**: `node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps();console.log(s.length, s.every(x=>x.slug.startsWith(x.number+'-')))})"`
→ the step count and `true`

### Step 5: `lib/ledger-migration.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SLUG_MIGRATION, migrateLedger, checkMigration } from './ledger-migration.mjs';

function realLedgers() {
  const dir = path.join(import.meta.dirname, '..', 'videos');
  return fs.readdirSync(dir)
    .map((video) => ({ video, p: path.join(dir, video, 'run-log.json') }))
    .filter(({ p }) => fs.existsSync(p))
    .map(({ video, p }) => ({ video, ledger: JSON.parse(fs.readFileSync(p, 'utf8')) }));
}

test('every mapped destination is a real step folder', () => {
  const r = checkMigration({ ledgers: [] });
  assert.ok(r.ok, r.errors.join('\n'));
});

test('every key in every real ledger is covered, and nothing is lost', () => {
  const r = checkMigration({ ledgers: realLedgers() });
  assert.ok(r.ok, r.errors.join('\n'));
});

test('migrating twice is a no-op — the map is idempotent on migrated keys', () => {
  for (const { video, ledger } of realLedgers()) {
    const once = migrateLedger(ledger).ledger;
    const twice = migrateLedger(once);
    assert.deepEqual(Object.keys(twice.ledger.steps).sort(), Object.keys(once.steps).sort(),
      `LEDGER-KEY-ORPHANED: re-running the migration on ${video} changed the keys — it must be safe to run twice`);
  }
});

test('the map has no duplicate destinations', () => {
  const dests = Object.values(SLUG_MIGRATION);
  assert.equal(new Set(dests).size, dests.length,
    'LEDGER-KEY-ORPHANED: two steps map to the same slug — one would overwrite the other in every ledger');
});
```

> The idempotency test is why `migrateLedger` must leave an already-migrated key
> alone. If a migrated key is not in the map it will land in `unmapped`; make the
> function treat a key that is already a valid destination as a pass-through.

**Verify**: `node --test lib/ledger-migration.test.mjs` → exits 0, 4 tests pass

### Step 6: the two parallel tracks

Add a `track` field to `step.json` — `"intro"` for `110`–`160`, `"main"` for
everything else — and validate it in `lib/steps.mjs` alongside the other fields.

Change `nextStep()` to return **one step per track** rather than the first
unsatisfied step overall, and `nextHintLine()` to print both when they differ:

```
next: run.sh <slug> intro-idea            (110 propose the intro idea)
next: run.sh <slug> cue-pass              (210 author body cues)
```

The two tracks share no artifact — `130-author-intro-screenplay-llm`'s authoring
contract forbids reading `catalog.json`, `cues.json` or `card-plan.json`, and no
2xx step reads the screenplay. They rejoin at `440-rerender-intro-film-run`, which
consumes both the film and the avatar clips, so `440` and everything after it
stays on `main`.

Add a test asserting a blocked `intro` gate does not suppress the `main` hint:
set `120`'s gate to unapproved, and assert `nextStep` still returns a `main` step.
Message: `TRACKS-SERIALISED: an intro gate must not block the card track`.

**Verify**: `node --test lib/steps.test.mjs` → exits 0; `node lib/steps.mjs next consistent-ai-influencer`
prints two `next:` lines

### Step 7: apply the migration and prove nothing was lost

```bash
cd pipelines/video/visuals-flow
node lib/ledger-migration.mjs --dry-run     # read it
node lib/ledger-migration.mjs --apply
for f in videos/*/run-log.json; do
  node -e "const d=require('./$f');console.log('$f', Object.keys(d.steps).length, Object.keys(d.steps).sort().join(' '))"
done > /tmp/ledger-after.txt
diff <(cut -d' ' -f2 /tmp/ledger-before.txt) <(cut -d' ' -f2 /tmp/ledger-after.txt) && echo "COUNTS MATCH"
```

**Verify**: `COUNTS MATCH` — 17 / 5 / 17 before and after. Then confirm the live
video still resolves: `node lib/steps.mjs next consistent-ai-influencer` names a
`1xx` intro step (it is at the old `025`, now `130`), **not** `010-configure`.
That last check is the one that proves the in-flight video was not reset.

Delete the `.bak` files only after the counts match.

### Step 8: fresh-checkout gate, docs, and the mutation

A crew worktree carries build artifacts a pristine tree does not
(LESSONS 2026-07-31 — `board-ui/dist` is gitignored and `board.test.mjs` fetches
`/`). This is the batch's last plan, so it runs the gate clean:

```bash
cd /Users/kbtg/codebase/personal-stuff
git clean -xdn pipelines/video/visuals-flow      # READ the list first
git clean -xdf pipelines/video/visuals-flow
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

> `git clean -xdf` deletes gitignored files including `node_modules` and any
> untracked scratch. Read the `-xdn` dry-run output before running it, and do NOT
> run it while another session holds the checkout.

Then `node scripts/gen-pipeline-table.mjs`, and run the frontmatter mutation:
drop `'010-transcribe-run'` from the map, confirm
`node --test lib/ledger-migration.test.mjs` **fails** printing
`LEDGER-KEY-ORPHANED`, revert, confirm green.

**Verify**: `check.sh` exits 0 on the cleaned tree; `PIPELINE.md` shows the seven
phases; the mutation fails with the expected string.

## Test plan

- `lib/ledger-migration.test.mjs` (4 tests) checks the map against the **real**
  ledgers rather than fixtures — a fixture cannot catch a key that only exists in
  one owner's history, which is the whole risk here.
- The idempotency test makes a re-run safe, so a partial migration can be finished
  rather than unwound.
- The duplicate-destination test catches the silent overwrite case.
- `lib/steps.test.mjs` gains the two-track assertion.
- The fresh-checkout run catches build-order and gitignored-artifact dependencies
  that only surface on a pristine tree.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 **on a freshly cleaned tree** (Step 8)
- [ ] `node --test lib/ledger-migration.test.mjs` exits 0 with 4 passing tests
- [ ] Ledger entry counts unchanged: 17 / 5 / 17 (Step 7's `COUNTS MATCH`)
- [ ] `node lib/steps.mjs next consistent-ai-influencer` names a `1xx` step, not `010`
- [ ] `ls steps/ | grep -c "^0[0-9][0-9]-\|^1[0-9][0-9]-\|^2[0-9][0-9]-\|^3[0-9][0-9]-\|^4[0-9][0-9]-\|^5[0-9][0-9]-\|^6[0-9][0-9]-"` equals the total step count
- [ ] `ls steps/ | grep -c "027-approve-intro-film-human"` → `0`
- [ ] No `.bak` files left: `find videos -name 'run-log.json.bak' | wc -l` → `0`
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0
- [ ] The frontmatter mutation makes `ledger-migration.test.mjs` fail printing `LEDGER-KEY-ORPHANED`; reverting restores green

## STOP conditions

- **Any ledger loses an entry.** If Step 7's counts do not match exactly, restore
  from the `.bak` files and STOP. This is owner history and there is no other copy.
- **A ledger key is not in the map.** `checkMigration` reports it as
  `LEDGER-KEY-ORPHANED`. Add it to `SLUG_MIGRATION` or `RETIRED_SLUGS` **only if
  you can say which step it was** — if you cannot identify it, STOP and report
  rather than guessing a destination.
- **A step folder is renamed without a map entry**, or two entries share a
  destination. Both are silent-overwrite bugs.
- **`git clean` while another session holds the checkout.** A concurrent session
  has been editing `board-ui` throughout this batch; cleaning under it destroys
  its uncommitted work. Confirm the checkout is yours alone first.
- **The live video's next-hint resets to `010`.** That means its ledger did not
  migrate. Restore and STOP.
- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, `skip`-ing or deleting an assertion is a STOP.

## Maintenance notes

- **Plan 6 of 6** (194 → 195 → 196 → 197 → 198 → **199**). It must run last: the
  step SET has to be final before it is numbered, which is why `needs_prs` lists
  all five.
- **`RETIRED_SLUGS` is not a dumping ground.** Two steps were deleted in this
  batch and their historical entries are preserved under a `retired/` prefix so
  they cannot be mistaken for live steps. A future deletion should do the same;
  silently dropping the entry rewrites history.
- **Numbers go in tens inside each hundred** so a step can be inserted without a
  second migration. Resist filling the gaps.
- **The `track` field is the seam for a third track.** If the conclusion ever
  becomes a bespoke film too, it is a new `track` value plus its own steps — the
  next-hint already handles N tracks once it handles two.
- **A reviewer should scrutinise**: that `git mv` was used (so history follows),
  that Step 4's scripted `step.json` rewrite preserved every other field, and that
  `130-learn-from-feedback` really did move to `630` — it is the one step whose
  number was actively wrong before, not merely unstructured.
