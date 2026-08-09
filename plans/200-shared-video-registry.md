<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video-registry && node --test registry.test.mjs && cd ../video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video-registry/videos.json, pipelines/video-registry/lib/registry.mjs, pipelines/video-registry/bin/vreg.mjs, pipelines/video-registry/registry.test.mjs, pipelines/video-registry/CLAUDE.md, pipelines/video-registry/README.md, pipelines/video/visuals-flow/lib/workdir.mjs, pipelines/video/visuals-flow/lib/workdir.test.mjs, pipelines/.claude/skills/yt-script-2/SKILL.md, pipelines/.claude/skills/visuals-flow/SKILL.md, pipelines/youtube/yt-script-2/CLAUDE.md, pipelines/CLAUDE.md]

mutation_apply: perl -0pi -e 's/for \(const a of \(v\.aliases \|\| \[\]\)\) \{/for (const a of []) {/' pipelines/video-registry/lib/registry.mjs
mutation_command: node --test registry.test.mjs
mutation_expect: resolves an alias to its canonical key
mutation_cwd: pipelines/video-registry
mutation_timeout: 300
---

# 200 — One shared video key across yt-script-2 and visuals-flow

## Summary

**Problem statement.** A video's folder name is invented independently in every
pipeline: `yt-script-2` picks a kebab slug from the working title at knowledge
time, `visuals-flow` picks one again weeks later from a differently-worded title.
Nothing records that `youtube/yt-script-2/videos/ai-video-tools-comparison/` and
`video/visuals-flow/videos/best-ai-video-generator/` might be the same video, and
nothing can tell you they aren't.

**Goals.**
- One registry that mints a video key **once** and is the authority on what that
  video is called for the rest of its life.
- **Symmetric.** Whichever pipeline reaches a video first mints the key; the
  other looks it up and reuses it. Both call the same idempotent verb
  (`vreg ensure`), so neither pipeline is "the one that names things".
- The key format does not change: same kebab-case readable slug, same
  `videos/<key>/` paths, same `Output/<key>-final.mp4` on Drive.
- `visuals-flow` resolves an old/alternate name to the canonical key without any
  folder on disk being renamed.
- Existing videos are registered as-is. Nothing moves, nothing breaks.

**Executor proposed.** `agy` / Gemini 3.1 Pro (High) — standard, fully inlined.

**Done criteria (terse).** `pipelines/video-registry/` exists with a passing
`node --test registry.test.mjs`; `vreg list` prints 5 entries covering all 6
existing video dirs; `vreg check` exits 0; `vreg where ai-video-tools-comparison`
shows both pipelines' folders for one video; `visuals-flow`'s `scripts/check.sh`
is green including a new `lib/workdir.test.mjs`; both skills call `vreg ensure`.

**Stop conditions (terse).** Do not rename any directory under any `videos/`.
Do not make `resolveWorkdir` throw. Do not link any video pair beyond the one
in Step 7's table.

**Test / verification for success.** Unit tests on the registry module (including
`ensure` idempotence and alias-returns-canonical) + a new `lib/workdir.test.mjs`
in visuals-flow proving alias fallthrough, both run by `test_cmd`.
Mutation-gated: disabling alias lookup must turn the suite red.

**Open points for plan readiness.** None. The one question the code could not
answer — which existing video dirs are the same video — was resolved from
transcript/outline content and confirmed by the owner on 2026-08-09; the result
is the table in Step 7.

---

## Executor instructions

Planned-at SHA: `167b2734`

**Drift check — run this first:**

```bash
git diff --stat 167b2734..HEAD -- pipelines/video/visuals-flow/lib/workdir.mjs pipelines/.claude/skills/yt-script-2/SKILL.md pipelines/CLAUDE.md
```

If it reports changes to `lib/workdir.mjs`, re-read that file before Step 4 and
adapt; the rest of the plan is additive and drift-tolerant.

## Status

| | |
|---|---|
| Priority | Medium |
| Effort | ~2h |
| Risk | Low (additive; one 6-line change to existing code) |
| Depends on | — |
| Category | Infrastructure / cross-pipeline convention |
| Difficulty | standard |
| Planned-at SHA | `167b2734` |

## Why this matters

A video passes through at least two pipelines: `yt-script-2` produces the
outline/script, `visuals-flow` produces the edit. Today those two only agree on
a video's identity by luck, because each derives a folder name from whatever
title string it was handed. The title legitimately drifts during production —
that is why a content-hash key was rejected: the same video hashes differently
in the two pipelines, and you would never notice.

So identity has to be **minted once and looked up**, not derived on demand. That
is the whole idea. Everything else in this plan is plumbing around it.

The second constraint is that nothing on disk may move. `visuals-flow`'s video
workdirs carry render caches, assembly caches and run-log ledger keys that embed
the slug; plan 199 already had to migrate ledger slug keys once (decisions.md
2026-08-07) and it was painful. So old names become **aliases**, not renames.

## Current state

### The two pipelines and their video folders

`pipelines/youtube/yt-script-2/videos/`:
- `ai-video-tools-comparison/` (has `knowledge.md`, `outline.md`)
- `ai-avatar-generators/` (has `outline.md`, `outline.html`, `outline.pdf` — no `knowledge.md`)

`pipelines/video/visuals-flow/videos/`:
- `best-ai-video-generator/`
- `consistent-ai-influencer/`
- `opusclip-vs-submagic/`
- `test-01/`

### Where the slug is picked today

`pipelines/.claude/skills/yt-script-2/SKILL.md`, Step 1, item 1 — verbatim:

```
1. Pick a `<slug>` from the title — kebab-case, short (`n8n-hosting`,
   `best-ai-video-tools`). Confirm it with the owner in one line if ambiguous.
```

That is the only place a key is created. There is no minting code anywhere.

### The choke point in visuals-flow

`pipelines/video/visuals-flow/lib/workdir.mjs` — the **entire** file:

```js
import fs from 'node:fs';
import path from 'node:path';

export function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}
```

This is imported by 20+ modules (`lib/board.mjs`, `lib/lint-cues.mjs`,
`lib/render.mjs`, `lib/avatar-render.mjs`, `lib/resolve.mjs`, the whole
`lib/intro-film/` set, …). Changing it once gives alias resolution to the entire
pipeline. **There is no `lib/workdir.test.mjs` today** — this plan adds one.

Three properties of this function are load-bearing and must survive:
1. A path-like arg (`contains /`) or an existing path is returned resolved, untouched.
2. It returns a path for a workdir that **does not exist yet** — it is used to
   create new workdirs, not only to open existing ones. It must never throw and
   must never require the directory to exist.
3. `resolveWorkdir(".")` resolves to the pipeline root, and
   `scripts/test-run-sh.sh` drives verbs with slug `.` (decisions.md 2026-07-30).
   That path goes through branch 1, so it must stay unreachable by new logic.

### Conventions to match

- **Exemplar for a registry-shaped asset:** `pipelines/video/heygen/registry.json`
  + `pipelines/video/heygen/CLAUDE.md` — a tracked JSON registry with a CLAUDE.md
    describing how consumers resolve from it. Match that shape.
- **Exemplar for a small Node lib + test:** any `pipelines/video/visuals-flow/lib/*.mjs`
  with its sibling `*.test.mjs`. ESM, `node:test` + `node:assert/strict`, named exports.
- Pipelines under `pipelines/` do not get their own `.env`, `venv/` or
  `requirements.txt` (pipelines/CLAUDE.md). This module needs **no dependencies** —
  `node:fs`, `node:path`, `node:test` only. Do not add a `package.json` with deps.
- New top-level folder under `pipelines/` gets a row in `pipelines/CLAUDE.md`'s
  folder map and a `CLAUDE.md` of its own from day one (root CLAUDE.md).

### Why a new top-level folder rather than living inside one pipeline

Both consumers must depend on the registry and the registry must depend on
neither. `pipelines/youtube/yt-script-2/` and `pipelines/video/visuals-flow/` sit
in different subtrees, so the registry goes at their common ancestor:
`pipelines/video-registry/`. Putting it under `video/` would make the `youtube/`
subtree depend on the `video/` subtree for its own folder naming, which inverts
the dependency.

## Commands you will need

```bash
# from repo root — the registry's own tests
cd pipelines/video-registry && node --test registry.test.mjs
# expect: "# pass <N>" and "# fail 0", exit 0

# visuals-flow full gate (this is the merge gate; ~2-5 min)
cd pipelines/video/visuals-flow && bash scripts/check.sh
# expect final line: "visuals-flow check OK", exit 0

# the CLI, once built
cd pipelines/video-registry
node bin/vreg.mjs list
node bin/vreg.mjs resolve <name>
node bin/vreg.mjs mint <slug> --title "<title>"
node bin/vreg.mjs alias <canonical-key> <other-name>
```

`scripts/check.sh` discovers tests with
`find lib -name '*.test.mjs' -not -path '*/.test-tmp/*'`, so a new
`lib/workdir.test.mjs` joins the gate **by existing**. Do not add it to any list.

## Scope

**In scope — create:**
- `pipelines/video-registry/videos.json`
- `pipelines/video-registry/lib/registry.mjs`
- `pipelines/video-registry/bin/vreg.mjs`
- `pipelines/video-registry/registry.test.mjs`
- `pipelines/video-registry/CLAUDE.md`
- `pipelines/video-registry/README.md`
- `pipelines/video/visuals-flow/lib/workdir.test.mjs`

**In scope — edit:**
- `pipelines/video/visuals-flow/lib/workdir.mjs` (one added branch)
- `pipelines/.claude/skills/yt-script-2/SKILL.md` (Step 1 item 1 + one hard rule)
- `pipelines/.claude/skills/visuals-flow/SKILL.md` (one new Guardrails item)
- `pipelines/youtube/yt-script-2/CLAUDE.md` (one paragraph)
- `pipelines/CLAUDE.md` (one folder-map row)

**Out of scope — do NOT touch:**
- **Any directory under any `videos/`.** No renames, no moves, no new video dirs.
  The whole point of the alias design is that disk stays still.
- `pipelines/video/visuals-flow/run.sh`, `lib/run-log.mjs`, `lib/board.mjs`,
  `steps/*/step.json` — they all reach the registry through `resolveWorkdir`,
  which is why that is the only file being changed. Editing them is scope creep
  and will collide with in-flight visuals-flow plans.
- `pipelines/video/visuals-flow/scripts/check.sh` — known serial-collision
  hotspot across visuals-flow plans. The new test joins by glob; do not add a line.
- `pipelines/video/heygen/registry.json` — different registry (characters), same
  word. Unrelated.
- `decisions.md` — the orchestrator appends the decision entry on main after this
  lands. Do not edit it on the branch.

## Steps

### Step 1 — Scaffold `pipelines/video-registry/`

Create the folder with an empty registry:

`pipelines/video-registry/videos.json`
```json
{
  "version": 1,
  "videos": {}
}
```

**Verify:**
```bash
cd pipelines/video-registry && node -e "JSON.parse(require('fs').readFileSync('videos.json','utf8'))" && echo OK
```
Expect: `OK`, exit 0.

### Step 2 — Write `lib/registry.mjs`

This is the whole module. Write it exactly as given — the alias loop's exact
shape is what the mutation gate targets.

```js
import fs from 'node:fs';
import path from 'node:path';

export const REGISTRY_PATH = path.resolve(import.meta.dirname, '..', 'videos.json');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length <= 60 && SLUG_RE.test(key);
}

export function load(file = REGISTRY_PATH) {
  if (!fs.existsSync(file)) return { version: 1, videos: {} };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw.videos !== 'object' || raw.videos === null) {
    throw new Error(`E-REGISTRY: ${file} has no "videos" object`);
  }
  return raw;
}

export function save(reg, file = REGISTRY_PATH) {
  const ordered = { version: reg.version ?? 1, videos: {} };
  for (const k of Object.keys(reg.videos).sort()) ordered.videos[k] = reg.videos[k];
  fs.writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n');
}

/**
 * Canonical key for any name the owner might type.
 * Exact key wins; then aliases. Returns null when nothing matches —
 * callers treat null as "not registered", never as an error.
 */
export function resolveKey(name, reg = load()) {
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(reg.videos, name)) return name;
  for (const [key, v] of Object.entries(reg.videos)) {
    for (const a of (v.aliases || [])) {
      if (a === name) return key;
    }
  }
  return null;
}

/** Every name that maps to this video: the key plus its aliases. */
export function namesFor(key, reg = load()) {
  const v = reg.videos[key];
  if (!v) return [];
  return [key, ...(v.aliases || [])];
}

export function list(reg = load()) {
  return Object.entries(reg.videos).map(([key, v]) => ({ key, ...v }));
}

export function mint(key, { title = '', minted, aliases = [] } = {}, reg = load()) {
  if (!isValidKey(key)) {
    throw new Error(`E-REGISTRY: "${key}" is not a valid key (lowercase kebab-case, <=60 chars)`);
  }
  const clash = resolveKey(key, reg);
  if (clash) throw new Error(`E-REGISTRY: "${key}" already resolves to "${clash}"`);
  for (const a of aliases) {
    const c = resolveKey(a, reg);
    if (c) throw new Error(`E-REGISTRY: alias "${a}" already resolves to "${c}"`);
  }
  reg.videos[key] = { title, minted: minted ?? new Date().toISOString().slice(0, 10), aliases };
  return reg;
}

/**
 * The symmetric entry point BOTH pipelines call. Idempotent by design:
 *   - name already resolves -> return that canonical key, touch nothing
 *   - name is new           -> mint it and return it
 * Whichever pipeline reaches a video first mints; the other finds it and reuses.
 * Returns { key, minted } so a caller can tell "I created this" from "it existed".
 */
export function ensure(name, { title = '' } = {}, reg = load()) {
  const existing = resolveKey(name, reg);
  if (existing) return { key: existing, minted: false, reg };
  return { key: name, minted: true, reg: mint(name, { title }, reg) };
}

/** Absolute paths of the per-pipeline workdirs a key would use, and whether each exists. */
export function whereIs(key, repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')) {
  const pipelines = path.join(repoRoot, 'pipelines');
  const spots = {
    script: path.join(pipelines, 'youtube', 'yt-script-2', 'videos', key),
    visuals: path.join(pipelines, 'video', 'visuals-flow', 'videos', key),
  };
  return Object.fromEntries(
    Object.entries(spots).map(([k, p]) => [k, { path: p, exists: fs.existsSync(p) }]),
  );
}

/** Every videos/ directory on disk that no registry entry claims. */
export function unregisteredDirs(reg = load(), repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')) {
  const pipelines = path.join(repoRoot, 'pipelines');
  const roots = [
    path.join(pipelines, 'youtube', 'yt-script-2', 'videos'),
    path.join(pipelines, 'video', 'visuals-flow', 'videos'),
  ];
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      if (!resolveKey(d.name, reg)) out.push(path.join(root, d.name));
    }
  }
  return out;
}

export function addAlias(key, alias, reg = load()) {
  if (!reg.videos[key]) throw new Error(`E-REGISTRY: no video "${key}"`);
  const clash = resolveKey(alias, reg);
  if (clash === key) return reg;
  if (clash) throw new Error(`E-REGISTRY: alias "${alias}" already resolves to "${clash}"`);
  reg.videos[key].aliases = [...(reg.videos[key].aliases || []), alias].sort();
  return reg;
}
```

**Verify:**
```bash
cd pipelines/video-registry && node -e "import('./lib/registry.mjs').then(m=>console.log(typeof m.resolveKey))"
```
Expect: `function`.

### Step 3 — Write `registry.test.mjs`

Tests write to a temp file, never to the real `videos.json`.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveKey, mint, addAlias, list, save, load, isValidKey, namesFor, ensure, whereIs, unregisteredDirs } from './lib/registry.mjs';

function tmpReg() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vreg-'));
  return path.join(dir, 'videos.json');
}

test('resolves an exact key to itself', () => {
  const reg = mint('ai-avatar-generators', { title: 'T', minted: '2026-08-09' }, { version: 1, videos: {} });
  assert.equal(resolveKey('ai-avatar-generators', reg), 'ai-avatar-generators');
});

test('resolves an alias to its canonical key', () => {
  let reg = mint('ai-avatar-generators', { title: 'T', minted: '2026-08-09' }, { version: 1, videos: {} });
  reg = addAlias('ai-avatar-generators', 'best-ai-video-generator', reg);
  assert.equal(resolveKey('best-ai-video-generator', reg), 'ai-avatar-generators');
});

test('returns null for an unknown name instead of throwing', () => {
  const reg = { version: 1, videos: {} };
  assert.equal(resolveKey('never-heard-of-it', reg), null);
  assert.equal(resolveKey('', reg), null);
  assert.equal(resolveKey(undefined, reg), null);
});

test('refuses a key that collides with an existing key or alias', () => {
  let reg = mint('one', { minted: '2026-08-09' }, { version: 1, videos: {} });
  reg = addAlias('one', 'uno', reg);
  assert.throws(() => mint('one', {}, reg), /already resolves/);
  assert.throws(() => mint('uno', {}, reg), /already resolves/);
});

test('rejects a malformed key', () => {
  assert.equal(isValidKey('Good-Slug'), false);
  assert.equal(isValidKey('good-slug'), true);
  assert.equal(isValidKey('trailing-'), false);
  assert.equal(isValidKey(''), false);
  assert.throws(() => mint('Not A Slug', {}, { version: 1, videos: {} }), /not a valid key/);
});

test('namesFor returns the key plus its aliases', () => {
  let reg = mint('one', { minted: '2026-08-09' }, { version: 1, videos: {} });
  reg = addAlias('one', 'uno', reg);
  assert.deepEqual(namesFor('one', reg), ['one', 'uno']);
  assert.deepEqual(namesFor('nope', reg), []);
});

test('save writes keys sorted and load round-trips', () => {
  const file = tmpReg();
  let reg = { version: 1, videos: {} };
  reg = mint('zulu', { minted: '2026-08-09' }, reg);
  reg = mint('alpha', { minted: '2026-08-09' }, reg);
  save(reg, file);
  assert.deepEqual(Object.keys(load(file).videos), ['alpha', 'zulu']);
  assert.equal(list(load(file)).length, 2);
});

test('ensure mints when the name is new', () => {
  const { key, minted, reg } = ensure('brand-new-video', { title: 'T' }, { version: 1, videos: {} });
  assert.equal(key, 'brand-new-video');
  assert.equal(minted, true);
  assert.equal(resolveKey('brand-new-video', reg), 'brand-new-video');
});

test('ensure is idempotent — a second call mints nothing', () => {
  const first = ensure('a-video', {}, { version: 1, videos: {} });
  const second = ensure('a-video', {}, first.reg);
  assert.equal(second.key, 'a-video');
  assert.equal(second.minted, false);
  assert.equal(Object.keys(second.reg.videos).length, 1);
});

test('ensure called with an ALIAS returns the canonical key and mints nothing', () => {
  // This is the whole point: pipeline B starts a video under the name it knows,
  // and gets back the key pipeline A already minted.
  let reg = mint('canonical-name', {}, { version: 1, videos: {} });
  reg = addAlias('canonical-name', 'other-name', reg);
  const { key, minted } = ensure('other-name', {}, reg);
  assert.equal(key, 'canonical-name');
  assert.equal(minted, false);
});

test('whereIs reports a slot per pipeline', () => {
  const spots = whereIs('anything');
  assert.deepEqual(Object.keys(spots).sort(), ['script', 'visuals']);
  for (const s of Object.values(spots)) {
    assert.equal(typeof s.exists, 'boolean');
    assert.ok(path.isAbsolute(s.path));
  }
});

test('whereIs finds the real workdir of a registered video', () => {
  const spots = whereIs('best-ai-video-generator');
  assert.equal(spots.visuals.exists, true, 'visuals-flow workdir should exist on disk');
});

test('unregisteredDirs is empty for the committed registry', () => {
  assert.deepEqual(unregisteredDirs(), []);
});

test('the committed registry links the script and visuals folders of the same video', () => {
  assert.equal(resolveKey('ai-video-tools-comparison'), 'best-ai-video-generator');
});

test('the committed registry parses and every entry is well-formed', () => {
  const reg = load();
  for (const v of list(reg)) {
    assert.ok(isValidKey(v.key), `bad key: ${v.key}`);
    assert.ok(Array.isArray(v.aliases), `${v.key} has no aliases array`);
    assert.match(v.minted, /^\d{4}-\d{2}-\d{2}$/, `${v.key} has a bad minted date`);
  }
});
```

**Verify:**
```bash
cd pipelines/video-registry && node --test registry.test.mjs
```
Expect `# fail 0`, exit 0.

### Step 4 — Add alias fallthrough to `visuals-flow`'s `resolveWorkdir`

Replace `pipelines/video/visuals-flow/lib/workdir.mjs` with:

```js
import fs from 'node:fs';
import path from 'node:path';
import { resolveKey } from '../../../video-registry/lib/registry.mjs';

export function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  const direct = path.join(pipelineRoot, 'videos', arg);
  if (fs.existsSync(direct)) return direct;
  // Not on disk under this name. If the registry knows it as an alias, and the
  // canonical workdir DOES exist, use that. Otherwise fall through to `direct`
  // unchanged — this function must still return a path for a workdir that has
  // not been created yet, and must never throw.
  try {
    const canonical = resolveKey(arg);
    if (canonical && canonical !== arg) {
      const aliased = path.join(pipelineRoot, 'videos', canonical);
      if (fs.existsSync(aliased)) return aliased;
    }
  } catch {
    // A malformed or missing registry must never break the pipeline.
  }
  return direct;
}
```

Confirm the relative import depth: `lib/workdir.mjs` → `..` is `visuals-flow/`,
`../..` is `video/`, `../../..` is `pipelines/`. So
`../../../video-registry/lib/registry.mjs` is correct.

**Verify:**
```bash
cd pipelines/video/visuals-flow && node -e "import('./lib/workdir.mjs').then(m=>console.log(m.resolveWorkdir('test-01')))"
```
Expect: an absolute path ending `/visuals-flow/videos/test-01`.

### Step 5 — Add `lib/workdir.test.mjs` in visuals-flow

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

const PIPELINE_ROOT = path.resolve(import.meta.dirname, '..');

test('a bare slug whose dir exists resolves under videos/', () => {
  const p = resolveWorkdir('test-01');
  assert.equal(p, path.join(PIPELINE_ROOT, 'videos', 'test-01'));
});

test('an unknown slug still returns a videos/ path and does not throw', () => {
  const p = resolveWorkdir('definitely-not-a-real-video-xyz');
  assert.equal(p, path.join(PIPELINE_ROOT, 'videos', 'definitely-not-a-real-video-xyz'));
});

test('"." still resolves to the pipeline root', () => {
  assert.equal(resolveWorkdir('.'), path.resolve('.'));
});

test('resolves an alias to the canonical workdir when that dir exists', () => {
  // Uses the committed registry: every video dir is registered by its own name,
  // so pick one and assert its own name still resolves to itself. Then assert
  // that any registered alias points at a real directory.
  const { list } = await import('../../../video-registry/lib/registry.mjs');
  for (const v of list()) {
    for (const alias of v.aliases) {
      const viaAlias = resolveWorkdir(alias);
      const viaKey = resolveWorkdir(v.key);
      if (fs.existsSync(viaKey)) {
        assert.equal(viaAlias, viaKey, `alias ${alias} did not resolve to ${v.key}`);
      }
    }
  }
});
```

Note: the last test needs `async` on its callback for the dynamic import — write
it as `test('resolves an alias …', async () => { … })`.

**Verify:**
```bash
cd pipelines/video/visuals-flow && node --test lib/workdir.test.mjs
```
Expect `# fail 0`.

### Step 6 — Write `bin/vreg.mjs`

```js
#!/usr/bin/env node
import { load, save, mint, addAlias, list, resolveKey, ensure, whereIs, unregisteredDirs, REGISTRY_PATH } from '../lib/registry.mjs';

const [cmd, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}
const positional = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1] || '').startsWith('--'));

try {
  if (cmd === 'list') {
    for (const v of list()) {
      const al = v.aliases?.length ? `  (aka ${v.aliases.join(', ')})` : '';
      console.log(`${v.key}  ${v.minted}  ${v.title || '-'}${al}`);
    }
  } else if (cmd === 'resolve') {
    const key = resolveKey(positional[0]);
    if (!key) { console.error(`not registered: ${positional[0]}`); process.exit(1); }
    console.log(key);
  } else if (cmd === 'mint') {
    const reg = mint(positional[0], { title: flag('title') ?? '' });
    save(reg);
    console.log(`minted ${positional[0]} -> ${REGISTRY_PATH}`);
  } else if (cmd === 'ensure') {
    // The symmetric verb both pipelines call. Prints ONLY the canonical key on
    // stdout so a caller can use `$(vreg ensure ...)` directly; the human-facing
    // note goes to stderr.
    const { key, minted, reg } = ensure(positional[0], { title: flag('title') ?? '' });
    if (minted) save(reg);
    console.error(minted ? `minted new key: ${key}` : `already registered: ${key}`);
    console.log(key);
  } else if (cmd === 'where') {
    const key = resolveKey(positional[0]);
    if (!key) { console.error(`not registered: ${positional[0]}`); process.exit(1); }
    console.log(key);
    for (const [pipeline, info] of Object.entries(whereIs(key))) {
      console.log(`  ${info.exists ? '[x]' : '[ ]'} ${pipeline.padEnd(8)} ${info.path}`);
    }
  } else if (cmd === 'check') {
    const stray = unregisteredDirs();
    for (const p of stray) console.error(`unregistered: ${p}`);
    if (stray.length) { console.error(`${stray.length} video dir(s) not in the registry — run: vreg ensure <name>`); process.exit(1); }
    console.log('every video dir is registered');
  } else if (cmd === 'alias') {
    save(addAlias(positional[0], positional[1]));
    console.log(`${positional[1]} -> ${positional[0]}`);
  } else {
    console.log('usage: vreg ensure <name> [--title "..."] | resolve <name> | where <name>');
    console.log('       vreg list | check | mint <key> [--title "..."] | alias <key> <other>');
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
```

**Verify:**
```bash
cd pipelines/video-registry && node bin/vreg.mjs && echo "usage-ok"
```
Expect the usage line then `usage-ok`.

### Step 7 — Backfill the existing videos

The correspondence below was established from **content**, not name similarity,
and confirmed by the owner on 2026-08-09. **Register exactly this — do not infer
any further links.**

| Registry key | Aliases | Evidence |
|---|---|---|
| `best-ai-video-generator` | `ai-video-tools-comparison` | Same video. The yt-script-2 outline is titled *"Pictory vs InVideo vs Fliki vs Synthesia vs Lumen5"*; the visuals-flow transcript opens *"5 AI video tools, 5 very different promises"* — the same five tools. |
| `ai-avatar-generators` | — | HeyGen (26 mentions) vs Synthesia (19), talking-head avatars. |
| `consistent-ai-influencer` | — | Nano Banana / Flux image consistency, **zero** HeyGen mentions. A different video from `ai-avatar-generators` despite both being avatar-adjacent. |
| `opusclip-vs-submagic` | — | Short-form clipping tools. No script-side folder. |
| `test-01` | — | Pipeline test fixture, not a real video. |

`best-ai-video-generator` is canonical for the linked pair because it carries the
downstream state — render caches, run-log ledger keys, and the already-delivered
Drive filename. `ai-video-tools-comparison` stays on disk untouched under
`yt-script-2/videos/` and resolves to the canonical key.

Run, from `pipelines/video-registry/`:

```bash
node bin/vreg.mjs mint best-ai-video-generator   --title "Best AI Video Software — Pictory vs InVideo vs Fliki vs Synthesia vs Lumen5"
node bin/vreg.mjs alias best-ai-video-generator ai-video-tools-comparison
node bin/vreg.mjs mint ai-avatar-generators      --title "Best Realistic AI Avatar Generator for YouTube Videos"
node bin/vreg.mjs mint consistent-ai-influencer  --title "Consistent AI influencer"
node bin/vreg.mjs mint opusclip-vs-submagic      --title "OpusClip vs Submagic"
node bin/vreg.mjs mint test-01                   --title "Pipeline test fixture"
```

Then set each entry's `minted` to the directory's own creation date rather than
today, so the registry does not claim six videos were started on the same day:

```bash
cd /Users/kbtg/codebase/personal-stuff
git log --diff-filter=A --format=%ad --date=short -1 -- pipelines/video/visuals-flow/videos/best-ai-video-generator
```

Use each result to hand-edit that entry's `minted` field. If a directory has no
git history (untracked), leave `2026-08-09`.

**Verify:**
```bash
cd pipelines/video-registry && node bin/vreg.mjs list | wc -l
```
Expect `5` (six directories, five videos — the linked pair is one entry).

```bash
cd pipelines/video-registry && node bin/vreg.mjs resolve ai-video-tools-comparison
```
Expect `best-ai-video-generator`, exit 0.

```bash
cd pipelines/video-registry && node bin/vreg.mjs where ai-video-tools-comparison
```
Expect `best-ai-video-generator` followed by two lines, **both marked `[x]`** —
the script-side and visuals-side workdirs of the same video.

```bash
cd pipelines/video-registry && node bin/vreg.mjs check
```
Expect `every video dir is registered`, exit 0.

```bash
cd pipelines/video-registry && node bin/vreg.mjs resolve nope-not-real; echo "exit=$?"
```
Expect `not registered: nope-not-real` and `exit=1`.

### Step 8 — Point yt-script-2's skill at the registry

In `pipelines/.claude/skills/yt-script-2/SKILL.md`, replace Step 1 item 1 —
currently:

```
1. Pick a `<slug>` from the title — kebab-case, short (`n8n-hosting`,
   `best-ai-video-tools`). Confirm it with the owner in one line if ambiguous.
```

with:

```
1. **Get the key from the registry.** Propose a `<name>` from the title —
   kebab-case, short (`n8n-hosting`, `best-ai-video-tools`) — and confirm it with
   the owner in one line. Then, from `pipelines/video-registry/`:

   ```bash
   KEY=$(node bin/vreg.mjs ensure <name> --title "<the video's working title>")
   ```

   `ensure` is symmetric and idempotent: if this video was already started in
   another pipeline it prints that pipeline's key and mints nothing; if it is
   new it mints. **Use whatever `$KEY` comes back — it may differ from the name
   you proposed**, which means the video already exists under that key. Check
   where with `node bin/vreg.mjs where "$KEY"`.

   This key is the video's identity for every downstream pipeline, `visuals-flow`
   included — the same string becomes `visuals-flow/videos/<key>/` and the Drive
   filename `<key>-final.mp4`. It is minted ONCE and never re-derived from a
   later wording of the title.
```

Also add to the **Hard rules** section:

```
- **Never invent a key that the registry doesn't know.** The key comes from
  `pipelines/video-registry/` (`vreg ensure`), never from re-slugifying whatever
  the title happens to say today. A key derived twice from two wordings of the
  same title is how one video became two folders.
```

Bump the skill's `version:` from `1.2.0` to `1.3.0`.

**Verify:**
```bash
cd /Users/kbtg/codebase/personal-stuff
rtk proxy grep -c "vreg" pipelines/.claude/skills/yt-script-2/SKILL.md
```
Expect `>= 3`.

### Step 8b — Point visuals-flow's skill at the SAME verb

Minting must be **symmetric**. A video does not always start in yt-script-2 —
`opusclip-vs-submagic` and `consistent-ai-influencer` have visuals-flow workdirs
and no script-side folder at all. Whichever pipeline reaches a video first mints;
the other finds it and reuses. `ensure` is the single verb that makes both cases
identical, which is why it is idempotent.

`pipelines/.claude/skills/visuals-flow/SKILL.md` has a numbered
**`## Guardrails (check BEFORE any verb, never skip)`** section starting at line
12, whose item 1 is the feedback-status pre-flight. Add a **new item 1** at the
top of that list (renumbering the existing items), because this must happen
before any verb creates or names a workdir:

```
1. **A workdir's name comes from the registry, never from slugifying a title.**
   Before creating `videos/<slug>/` for a video this pipeline has not seen, run
   from `pipelines/video-registry/`:

```bash
KEY=$(node bin/vreg.mjs ensure <name> --title "<the video's working title>")
node bin/vreg.mjs where "$KEY"
```

   `ensure` prints the canonical key: it MINTS when this video is new, and
   returns the EXISTING key when another pipeline (usually `yt-script-2`)
   already started it. **Use `$KEY` as the workdir name — it may differ from
   the name you proposed.** If `where` shows `[x]` beside `script`, the outline
   and script for this video already exist; read them before the concept pass.

   An existing workdir needs nothing: `resolveWorkdir` resolves a registered
   alias to the canonical folder already. This guardrail is about NAMING a new
   one. (`pipelines/video-registry/CLAUDE.md`)
```

Do not modify `run.sh`, `steps/*/step.json`, or any lib module for this — the
skill is the operator of the pipeline, and the code side already resolves aliases
via `resolveWorkdir` (Step 4). Wiring `vreg` into `run.sh` would collide with
in-flight visuals-flow plans for no added safety.

**Verify:**
```bash
cd /Users/kbtg/codebase/personal-stuff
rtk proxy grep -c "vreg" pipelines/.claude/skills/visuals-flow/SKILL.md
```
Expect `>= 2`.

### Step 9 — Docs

**`pipelines/youtube/yt-script-2/CLAUDE.md`** — under "What this folder is", add:

```
The `<slug>` in `videos/<slug>/` is **not** picked here. It is minted once in
`pipelines/video-registry/` and is the same string `visuals-flow` uses for the
same video. See that folder's CLAUDE.md.
```

**`pipelines/CLAUDE.md`** — add one row to the folder map, immediately above the
`video/` row:

```
| [`video-registry/`](video-registry/CLAUDE.md) | The shared video key — mints a video's kebab slug once, resolves old/alternate names to it. Consumed by `youtube/yt-script-2/` and `video/visuals-flow/`; depends on neither | Node |
```

**`pipelines/video-registry/CLAUDE.md`** — write it covering:
- what the registry is (one key per video, minted once, readable kebab slug —
  identical in shape to the folder names already in use)
- the four CLI verbs with examples
- **why aliases exist**: purely a bridge for names that were picked independently
  before this existed. A newly-minted video has zero aliases and should stay that
  way. An alias is added only when two pipelines already have folders on disk for
  the same video.
- the hard rule: **the registry never renames a directory.** `visuals-flow` video
  workdirs carry render caches, assembly caches and run-log ledger keys that embed
  the slug (decisions.md 2026-08-07, plan 199) — aliasing exists precisely so no
  folder has to move.
- how consumers resolve: `resolveKey()` returns `null` for an unknown name and
  callers treat that as "not registered", never as an error. Nothing in a
  consuming pipeline may hard-fail on a missing registry entry.

**`pipelines/video-registry/README.md`** — short human orientation: what it is,
the CLI verbs, where `videos.json` lives.

**Verify:**
```bash
cd /Users/kbtg/codebase/personal-stuff && ls pipelines/video-registry/CLAUDE.md pipelines/video-registry/README.md && rtk proxy grep -c "video-registry" pipelines/CLAUDE.md
```
Expect both files listed and a count `>= 1`.

### Step 10 — Full gate on a clean tree

```bash
cd /Users/kbtg/codebase/personal-stuff && git status --porcelain
cd pipelines/video-registry && node --test registry.test.mjs
cd ../video/visuals-flow && bash scripts/check.sh
```

Expect: only intended files in `git status`; both suites exit 0; the last line of
check.sh is `visuals-flow check OK`.

## Test plan

| Test | File | Follows |
|---|---|---|
| exact key, alias, unknown-name, collision, malformed key, sort/round-trip, committed-registry well-formedness | `pipelines/video-registry/registry.test.mjs` | any `visuals-flow/lib/*.test.mjs` |
| bare slug resolves, unknown slug does not throw, `.` still the pipeline root, alias reaches the canonical workdir | `pipelines/video/visuals-flow/lib/workdir.test.mjs` | `lib/intro-film/workdir.test.mjs` |

`scripts/check.sh` finds `lib/**/*.test.mjs` by glob — the new visuals-flow test
joins the gate by existing. **Do not add it to any list.**

## Done criteria

1. `cd pipelines/video-registry && node --test registry.test.mjs` → exit 0, `# fail 0`.
2. `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, final line `visuals-flow check OK`.
3. `cd pipelines/video-registry && node bin/vreg.mjs list | wc -l` → `5`.
4. `cd pipelines/video-registry && node bin/vreg.mjs check` → `every video dir is registered`, exit 0.
5. `cd pipelines/video-registry && node bin/vreg.mjs resolve ai-video-tools-comparison` → `best-ai-video-generator`, exit 0.
6. `cd pipelines/video-registry && node bin/vreg.mjs where ai-video-tools-comparison` → the canonical key, then two lines **both** marked `[x]`.
7. `cd pipelines/video-registry && node bin/vreg.mjs ensure ai-video-tools-comparison` → prints `best-ai-video-generator` on stdout, `already registered:` on stderr, and leaves `videos.json` **byte-identical** (`git diff --quiet videos.json`).
8. `cd pipelines/video-registry && node bin/vreg.mjs resolve nope-not-real; echo $?` → prints `not registered: nope-not-real`, exit `1`.
9. `git status --porcelain pipelines/video/visuals-flow/videos pipelines/youtube/yt-script-2/videos` → **empty**. No video directory was created, renamed, moved or modified.
10. `git diff --stat 167b2734..HEAD --name-only` → every path appears in this plan's `touches` list.
11. The mutation gate passes: disabling the alias loop in `lib/registry.mjs` makes `registry.test.mjs` fail with `resolves an alias to its canonical key`.

## STOP conditions

- **Any directory under a `videos/` folder needs to move, be renamed, or be
  created.** STOP and report. The alias design exists so this never happens; if
  you believe a rename is needed, the plan is wrong.
- **You believe two existing video folders are the same video, beyond the one
  pair in Step 7's table.** STOP and report. `ai-avatar-generators` and
  `consistent-ai-influencer` look related and are NOT the same video (HeyGen/
  Synthesia talking heads vs Nano-Banana/Flux image consistency); merging them
  would fuse two real videos into one identity. Name similarity is not evidence.
- **`resolveWorkdir` would need to throw, or to require the directory to exist.**
  STOP. It is called to create new workdirs and is driven with the literal slug
  `.` by `scripts/test-run-sh.sh`. Both must keep working.
- **`scripts/check.sh` needs editing.** STOP. The test joins by glob. Editing
  check.sh is a known cross-plan collision point.
- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping,
  deleting or skipping the assertion is a STOP.
- **A test opens a server or child process.** Guarantee teardown with
  `try/finally`; a hanging runner makes the failure invisible.
- **The registry module needs an npm dependency.** STOP. It is `node:` built-ins
  only, by design — `pipelines/` has no shared Node package root.

## Maintenance notes

- **The single choke point is `resolveWorkdir`.** Every future consumer of a
  video key in visuals-flow gets alias resolution free by going through it. A
  module that builds `videos/<slug>` by hand (there are a few:
  `lib/plan-skeleton.mjs:114`, `lib/segments.mjs:114`, `lib/board.mjs:64`,
  `lib/feedback-status.mjs:80`, `lib/ledger-migration.mjs:128`) will **not**.
  That is acceptable today because aliases are a legacy bridge and newly-minted
  videos have none — but if aliases ever become routine, those five sites are the
  gap to close. A reviewer should scrutinise any new hand-built `videos/<slug>`
  join.
- **The registry is deliberately not a gate.** Nothing hard-fails on an
  unregistered slug, and `resolveKey` returns `null` rather than throwing. Making
  it strict later would break `scripts/test-run-sh.sh` (slug `.`) and any ad-hoc
  workdir. If strictness is ever wanted, it belongs at mint time in the skill, not
  at resolve time in the pipeline.
- **`vreg check` is the natural follow-up gate, and is intentionally NOT wired
  into `test_cmd` yet.** It exits 1 on any `videos/` directory the registry does
  not know, which is exactly the "someone forgot to run `ensure`" case. It is
  left as a command rather than a gate because a scratch workdir would otherwise
  turn the merge gate red. Once the `ensure` habit is established, adding
  `node bin/vreg.mjs check` to a gate is a one-line change — and the right one.
- **Minting is symmetric on purpose.** Both skills call `ensure`, never `mint`.
  If a future pipeline joins (a thumbnail flow, a publishing flow), it calls
  `ensure` too and adds its slot to `whereIs()`. Do not add a "primary" pipeline
  that owns naming — the moment one pipeline owns it, the other starts
  re-slugifying, which is the bug this plan exists to kill.
- **Do not add a `stages` or `paths` field to registry entries.** The paths are
  derivable (`youtube/yt-script-2/videos/<key>/`,
  `video/visuals-flow/videos/<key>/`); recording them creates a second source of
  truth that drifts.
- **A content-hash key was considered and rejected.** The title legitimately
  changes between the script pipeline and the edit pipeline, so a hash forks the
  identity silently. Minted-once is the whole point; do not "improve" this into a
  derived key later.
