---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-shots.mjs test-03
ui: false
deploy:
needs: [unblocks PR#116 / plan 158 — land this first]
---

# Plan 166: E9 must see the avatar, and lint-shots must find the catalog

## Summary

- **Problem statement**: Two verified bugs on main. (1) Plan 162 taught `extendExposure` about avatar spans and updated E7, but **missed E9 twenty-nine lines below** — so E9 computes a fullframe's hold as if no avatar span clamped it, and reports the two mandatory end CTAs as overlapping a card they actually sit beside. (2) `lint-shots.mjs` resolves `catalog.json` one directory too high and throws ENOENT for **every** workdir, breaking `run.sh <slug> shots` — not specific to any one video.
- **Goals**: fix both, with regression tests that would have caught them.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — two small edits, the value is in the tests.
- **Done criteria** (terse): `check.sh` exits 0; `lint-shots.mjs test-03` runs without throwing; new tests fail against the old code.
- **Stop conditions** (terse): E9 stops honouring the real `base`; the catalog path is fixed by changing the `../` count.
- **Test / verification for success**: new cases in `lib/lint-cues.test.mjs` and `lib/lint-shots.test.mjs`, plus a live CLI run.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bb53892..HEAD -- pipelines/video/visuals-flow-2/lib/lint-cues.mjs pipelines/video/visuals-flow-2/lib/lint-shots.mjs`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `bb53892`, 2026-07-28

## Why this matters

Both bugs passed every existing gate, and both were found only because plan 158's crew hit them and **reported instead of patching** — its STOP condition forbids `lib/*.mjs` edits. That is the process working; this plan is where the fix belongs.

Bug 1 is a scope gap in plan 162, which I wrote. 162 correctly identified that E7 and `extendExposure` were avatar-blind and fixed both, but E9 makes its own `extendExposure` call 29 lines further down in the same file and was never updated. The lesson: when a function gains a parameter that changes its result, every call site is in scope, not just the ones the bug report named.

Bug 2 is worse in reach: it breaks the `shots` verb for every video, and has presumably been broken since the line was written.

## Current state

### Bug 1 — E9 is avatar-blind

`pipelines/video/visuals-flow-2/lib/lint-cues.mjs`. The E7 call (line 313), **correct**:

```js
  if (manifest?.base === 'none') {
    const extended = extendExposure(sortedResolved, { base: 'none', total: T, avatarSpans: avatarFullSpans(avatarJobs) });
```

The E9 call (line 342), **missing `avatarSpans`**:

```js
  {
    const extended = extendExposure(sortedResolved, { base: manifest?.base ?? 'screen', total: T });
    const fullSpans = extended
      .filter(c => bySlug[c.card]?.placement === 'fullframe')
      .map(c => ({ id: c.id, start: c.start, end: c.start + c.duration }));
```

`lib/resolve.mjs:397` is `export function extendExposure(resolved, { base, total, avatarSpans = [] })`, and its clamp ("A card must not be held over the presenter") is at ~411–413. With `avatarSpans` defaulting to `[]` the clamp never applies, so E9 sees a longer hold than the pipeline will actually produce.

**Symptom** on plan 158's workdir — fullframe `c03` (`verdict/verdict-trophy`) treated as holding `[45.6–74.7]`:

```
E9 overlay-over-graphic: c04 (link-in-description/link-in-description) [54.7-58.7] overlaps fullframe c03
E9 overlay-over-graphic: c05 (like-subscribe/like-subscribe) [69.0-74.0] overlaps fullframe c03
```

Both CTAs actually sit over an `avatar-full` span that clamps `c03`.

**The `base` question, answered — do NOT cargo-cult E7's hardcoded `'none'`.** E7's call sits *inside* `if (manifest?.base === 'none')`, so hardcoding `'none'` there is correct and unreachable otherwise. E9 runs for **every** video regardless of base, so it must keep passing the real base: `manifest?.base ?? 'screen'` is correct and stays. The only defect is the missing `avatarSpans`.

### Bug 2 — wrong catalog path

`pipelines/video/visuals-flow-2/lib/lint-shots.mjs`, line 154, verbatim:

```js
  const catalog = JSON.parse(fs.readFileSync(path.join(workdir, '../../../../card-library/catalog.json'), 'utf8'));
```

From `videos/<slug>`, four `../` resolves to `pipelines/card-library/` (does not exist); three resolves to `pipelines/video/card-library/` (correct). Verified:

```
4x ../ -> /Users/kbtg/.../pipelines/card-library/catalog.json        exists=False
3x ../ -> /Users/kbtg/.../pipelines/video/card-library/catalog.json  exists=True
```

Running `node lib/lint-shots.mjs test-03` on main throws ENOENT on the first path. `run.sh:212` runs this CLI as the `shots` verb, so that verb is broken for every workdir.

**The fix is NOT `4` → `3`.** `lib/workdir.mjs` accepts an arbitrary path:

```js
export function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
```

so a workdir outside `videos/` makes *any* workdir-relative count wrong. Use the idiom the rest of the codebase already uses — `lib/assemble.mjs:845`, verbatim:

```js
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
```

That anchors to the module, not the caller's argument. `lint-shots.mjs:154` is the **only** site in `lib/` still doing workdir-relative arithmetic for the catalog.

### Why the tests missed both

`lib/lint-shots.test.mjs` exists and IS registered in `scripts/check.sh`, but every case calls the pure `lintShots({ ..., catalog: mockCatalog })`. The broken path lives in `main()`, which no test exercises. Same shape for bug 1: the lint tests build argument objects directly and never asserted the E9/avatar interaction.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| lint-shots CLI | `cd pipelines/video/visuals-flow-2 && node lib/lint-shots.mjs test-03` | runs, no ENOENT |
| lint-cues CLI | `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03` | exit 0, output unchanged |
| Targeted tests | `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs lib/lint-shots.test.mjs` | `# fail 0` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/lib/lint-cues.mjs` (the E9 `extendExposure` call, one argument)
- `pipelines/video/visuals-flow-2/lib/lint-shots.mjs` (the catalog path)
- `pipelines/video/visuals-flow-2/lib/lint-cues.test.mjs`
- `pipelines/video/visuals-flow-2/lib/lint-shots.test.mjs`

**Out of scope**:
- **`plans/158-vf2-cut-the-conclusion.md`** — do not touch it. Its STOP condition forbidding `lib/*.mjs` edits is why these bugs were reported rather than patched, and it worked.
- `lib/resolve.mjs` — `extendExposure` already takes `avatarSpans` and clamps correctly; only a caller is wrong.
- E4, E7, `ZONE_END`, `ENDCARD_SLUG_PREFIXES` — unchanged.
- The `base` argument at line 342 — it is correct (see above).
- `videos/test-03-conclusion/` — plan 158 owns it.

## Git workflow

- Branch: `advisor/166-vf2-e9-avatar-and-catalog-path`
- Commit: `fix(vf2): E9 honours avatar spans; lint-shots anchors the catalog path` — no AI footers. Do NOT push.

## Steps

### Step 1: Write the failing tests FIRST

Both bugs passed every gate, so write the tests before the fixes and watch them fail — otherwise there is no evidence the tests can catch a regression.

In `lib/lint-cues.test.mjs`:

```js
test('E9 does not fire when an overlay sits over an avatar span that clamps the card', () => {
  // fullframe c1 anchored at 10s would extend far on base:'none', but an
  // avatar-full span starts at 20s and clamps it. The overlay at 30s sits on
  // the presenter, not on the card. Before this fix E9 reported an overlap.
  const resolved = [
    { id: 'c1', card: 'verdict/verdict-trophy', start: 10, duration: 5, placement: 'fullframe' },
    { id: 'c2', card: 'like-subscribe/like-subscribe', start: 30, duration: 5, placement: 'overlay' },
  ];
  const avatarJobs = { jobs: [{ id: 's1', kind: 'avatar-full', start: 20, end: 60 }] };
  const { errors } = lintCues(mkArgs({ resolved, avatarJobs, base: 'none', total: 80 }));
  assert.ok(!errors.some((e) => e.startsWith('E9 overlay-over-graphic')));
});

test('E9 still fires when an overlay genuinely overlaps a fullframe card', () => {
  const resolved = [
    { id: 'c1', card: 'verdict/verdict-trophy', start: 10, duration: 20, placement: 'fullframe' },
    { id: 'c2', card: 'like-subscribe/like-subscribe', start: 15, duration: 5, placement: 'overlay' },
  ];
  const { errors } = lintCues(mkArgs({ resolved, avatarJobs: null, base: 'screen', total: 80 }));
  assert.ok(errors.some((e) => e.startsWith('E9 overlay-over-graphic')));
});
```

`mkArgs` stands for however the neighbouring tests assemble `lintCues`'s argument object — **read the file and reuse its real helper or literal shape**, including `cuesFile`, `words`, `catalog`, `segmentsData`, `manifest`. Do not change `lintCues`'s signature.

In `lib/lint-shots.test.mjs`, exercise the **CLI**, not the pure function:

```js
test('lint-shots CLI resolves the real catalog from a workdir', () => {
  // The bug lived in main(), which no test touched: every case called
  // lintShots({ catalog: mockCatalog }) and never resolved a path.
  const res = spawnSync(process.execPath, ['lib/lint-shots.mjs', 'test-03'], {
    cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8',
  });
  assert.ok(!/ENOENT/.test(res.stderr), `lint-shots threw ENOENT:\n${res.stderr.slice(-500)}`);
});
```

Import `spawnSync` from `node:child_process` and `path` from `node:path` if not already imported. If `videos/test-03/shots.resolved.json` is absent the CLI may exit non-zero for an unrelated reason — this test asserts only that it does not throw **ENOENT**, which is exactly the bug.

**Verify (these MUST fail now)**: `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs lib/lint-shots.test.mjs 2>&1 | tail -6` -> at least 2 failures. Record which. If they pass before any fix, the tests do not reproduce the bugs — STOP and report.

### Step 2: Fix bug 1

In `lib/lint-cues.mjs`, change the E9 block's call to pass the same spans E7 uses, and leave the `base` argument alone:

```js
    const extended = extendExposure(sortedResolved, {
      base: manifest?.base ?? 'screen',
      total: T,
      // Same spans E7 uses. Without them the clamp in extendExposure never
      // applies here, so E9 measures a hold the pipeline will never produce
      // and reports end CTAs as overlapping a card they sit beside.
      avatarSpans: avatarFullSpans(avatarJobs),
    });
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs 2>&1 | tail -4` -> `# fail 0`

### Step 3: Fix bug 2

In `lib/lint-shots.mjs`, replace the workdir-relative path with the module-anchored idiom used by `assemble.mjs:845`:

```js
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/lint-shots.mjs test-03 2>&1 | tail -3` -> runs without `ENOENT`, and `node --test lib/lint-shots.test.mjs 2>&1 | tail -4` -> `# fail 0`

### Step 4: Confirm nothing else moved

**Verify**:
```bash
cd pipelines/video/visuals-flow-2
node lib/lint-cues.mjs test-03; echo "exit=$?"
```
-> `exit=0`, output **identical** to before this plan. test-03 is `base:"screen"` with avatar jobs, so E9's result must not change for it — if it does, report the diff rather than accepting it.

### Step 5: Full gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-shots.mjs test-03` -> both exit 0

## Test plan

Three tests, all chosen because the existing suite could not have caught these:

- the E9/avatar positive case (bug 1)
- the E9 negative case, so the fix cannot be "make E9 never fire"
- a **CLI-level** lint-shots run (bug 2) — the existing tests only ever called the pure function with a mock catalog, which is precisely why a broken path in `main()` survived a registered, passing test file

Step 1 requires watching all of them fail first. A regression test that was never seen red is not evidence.

## Done criteria

- [ ] the three new tests failed before the fixes and pass after (state which failed, in the run log)
- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `node lib/lint-shots.mjs test-03` runs with no ENOENT
- [ ] `node lib/lint-cues.mjs test-03` exits 0 with output unchanged
- [ ] `grep -c "avatarSpans" lib/lint-cues.mjs` is `2` (E7 and E9)
- [ ] `grep -c "\.\./\.\./\.\./\.\./card-library" lib/lint-shots.mjs` is `0`
- [ ] `git diff --stat` shows no change to `lib/resolve.mjs`, `plans/158-*.md`, or `videos/`

## STOP conditions

- You are about to change E9's `base` argument to a hardcoded `'none'`. It is correct as `manifest?.base ?? 'screen'` — E7 hardcodes `'none'` only because it sits inside a `base === 'none'` guard. Stop and report.
- You are about to fix bug 2 by changing `../../../../` to `../../../`. That leaves the path workdir-relative, and `resolveWorkdir` accepts arbitrary absolute paths. Use the module-anchored idiom.
- Either new test passes BEFORE the corresponding fix — it does not reproduce the bug. Stop and report.
- `node lib/lint-cues.mjs test-03` output changes. Report the diff.
- You are about to edit `plans/158-vf2-cut-the-conclusion.md` or anything under `videos/`. Out of scope.

## Maintenance notes

- The generalizable lesson from bug 1: **when a function gains a parameter that changes its result, every call site is in scope.** `extendExposure` has callers in `lint-cues.mjs` (×2), `resolve.mjs` and `board.mjs`; plan 162 updated one of the two in the file it was editing. A grep for the function name is the cheap check that would have caught it.
- The lesson from bug 2: a registered, passing test file is not coverage of the CLI it lives beside. Anything with a `main()` needs at least one test that runs it as a process.
- After this lands, PR#116 / plan 158 can be re-readied. Its `test_cmd` already chains `node lib/lint-cues.mjs test-03-conclusion`, so a green gate there will genuinely mean the conclusion lints clean.
