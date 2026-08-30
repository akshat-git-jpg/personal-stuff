---
executor: claude-p
model: sonnet
test_cmd: node --test config/profiles.test.mjs && (cd pipelines/video-registry && node --test registry.test.mjs) && python3 pipelines/common/channels_test.py
ui:
deploy:
needs: ["261 must land first: this plan validates and consumes the profile block in config/channels.json"]
needs_prs: [261]
touches: [config/profiles.mjs, config/profiles.test.mjs, config/README.md, pipelines/common/channels.py, pipelines/common/channels_test.py, pipelines/video-registry/lib/registry.mjs, pipelines/video-registry/bin/vreg.mjs, pipelines/video-registry/videos.json, pipelines/video-registry/registry.test.mjs, pipelines/video-registry/CLAUDE.md, pipelines/video/visuals-flow/lib/brand-inline.mjs, pipelines/video/visuals-flow/PIPELINE.md, pipelines/CLAUDE.md]

mutation_apply: node -e "const fs=require('fs');const f='config/channels.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));j.channels[0].profile.avatar_slug='not-a-real-avatar';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
mutation_command: node --test config/profiles.test.mjs
mutation_expect: PROFILE_AVATAR_UNKNOWN
mutation_cwd:
mutation_timeout:
---

# Plan 264: Channel profiles, so several channels don't all sound the same

## Summary

- **Problem statement**: The creative side of the repo has exactly one of everything.
  One `TASTE.md`, one `brand.json` literally named `"default"`, one avatar registry,
  one reference-voice catalogue, and a `video-registry` whose slugs sit in a flat
  namespace with no channel. Several channels would converge into one voice and one
  look, with nothing anywhere reporting a problem.
- **Goals**:
  - Make the `profile` block in `config/channels.json` real: validate it against the
    assets it names, and expose it to JS and Python.
  - Give every video in `video-registry` a channel.
  - Make `visuals-flow` resolve a video's brand from its channel instead of always
    loading `brand.json`.
- **Decisions confirmed**:
  - Pipeline channel profiles -> build the mechanism NOW, seeded with `agrollo` only.
    Adding a channel later is one registry entry, not a code change.
  - Registry home -> the `profile` block lives inside `config/channels.json` (one
    file, one loader, one gate) rather than a second per-channel file.
  - Seeding -> `agrollo` only.
- **Executor proposed**: `claude-p` / Sonnet. This spans five subsystems with
  different conventions and touches the owner's taste-setting configuration, which is
  the `rules.md` "can't be fully inlined" row, not the `agy` default.
- **Done criteria** (terse): the profile validator rejects every broken profile,
  `vreg` records a channel, `visuals-flow` picks a brand by channel, Python reads
  profiles, all three suites green.
- **Stop conditions** (terse): inventing a second channel's assets; renaming an
  existing video key; making a missing registry entry hard-fail a pipeline; weakening
  a gate.
- **Test / verification for success**: `node --test` on the profile validator (with a
  proven-firing `PROFILE_AVATAR_UNKNOWN` gate), the existing video-registry suite, and
  the stdlib Python loader test.
- **Open points for plan readiness**: none. Note the deliberate exclusion below:
  per-channel TTS **voice** is NOT wired here, and the reason is recorded in Scope.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ddc5f4dd..HEAD -- config pipelines`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — no database, no money path, no deployed surface. The worst failure
  is a pipeline picking the wrong colours.
- **Depends on**: plan 261 (the registry and its `profile` block). Independent of 262
  and 263; can run in parallel with either.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ddc5f4dd`, 2026-08-30

## Why this matters

`pipelines/youtube/final-workflow/final-workflow-notes.md` already names this risk in
its "Quality levers that cost nothing" section:

> yt-style-copy Style DNA per channel so multi-channel scripts don't converge into one
> voice.

That convergence is the default outcome today, because every creative input is a single
hardcoded file. This plan does not write any new taste, voice or brand — it builds the
slot each channel's version goes into, and adds gates that fail when a channel names an
asset that does not exist. Filling the slots is work for when channel two is real.

## Current state

### `config/channels.json` after plan 261

```json
      "profile": {
        "voice_slug": "jamila-30s",
        "avatar_slug": "girl-1",
        "brand": "default",
        "taste_file": "pipelines/youtube/yt-script/TASTE.md",
        "style_dna": null
      }
```

Nothing reads it yet. This plan makes it load-bearing.

### The assets each profile field must point at

**`voice_slug`** — the catalogue is a Markdown table in
`pipelines/video/tts/REFERENCES.md`:

```markdown
| Slug | Files | Character / use | Source | Notes |
|---|---|---|---|---|
| `jamila-30s` | `jamila-walking-30s.wav` + `.txt` | production female tutorial voice | … |
| `jamila-45s` | `jamila-walking-45s.wav` + `.txt` | longer variant of `jamila-30s` | … |
| `ref-6s-soft` | `ref-6s-soft.wav` | early "soft and elegant speaker" test voice | … |
```

Slugs are the backtick-wrapped first cell. Parse them with a line regex; do not add a
Markdown dependency.

**`avatar_slug`** — `pipelines/video/heygen/registry.json` is real JSON:

```json
{
 "girl-1": { "template_id": "…", "description": "Girl — soft-voice tutorial template …" },
 "specs-man": { "template_id": "…", "image": "characters/specs-man/source.jpeg", "description": "…" },
 "side-avatar": { "image": "characters/side-avatar/source.jpeg", "description": "…" }
}
```

Top-level keys are the slugs.

**`brand`** — resolved by `pipelines/video/visuals-flow/lib/brand-inline.mjs`, which
ALREADY supports named brands:

```js
export function loadBrand(root, videoManifest = {}) {
  const brandName = videoManifest.brand || 'default';
  const brandPath = brandName === 'default' 
    ? path.join(root, 'brand.json')
    : path.join(root, 'brands', `${brandName}.json`);

  if (!fs.existsSync(brandPath)) {
    throw new Error(`brand not found: ${brandName}`);
  }
  
  return JSON.parse(fs.readFileSync(brandPath, 'utf8'));
}
```

So multi-brand is already possible; nothing selects a brand per channel. `brand.json`
today:

```json
{
  "name": "default",
  "tokens": {
    "--bg-from": "#3a1f08", "--bg-to": "#0a0805", "--text": "#ffffff",
    "--text-dim": "rgba(255,239,219,0.6)", "--accent": "#fb923c"
  },
  "caption": { "keywordColor": "#fb923c" }
}
```

**`taste_file`** — `pipelines/youtube/yt-script/TASTE.md`, a real path in the repo.

### `pipelines/video-registry` — the shared video key

`lib/registry.mjs` already exports what this plan needs:

```js
export const REGISTRY_PATH = path.resolve(import.meta.dirname, '..', 'videos.json');
export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
```

`videos.json` entries carry no channel:

```json
    "ai-avatar-generators": {
      "title": "Best Realistic AI Avatar Generator for YouTube Videos",
      "minted": "2026-07-31",
      "aliases": []
    },
```

And the module's contract, verbatim from `resolveKey`'s doc comment, is load-bearing:

> Returns null when nothing matches — callers treat null as "not registered", NEVER as
> an error. Nothing in a consuming pipeline may hard-fail on a missing entry.

**Preserve that.** A video with no channel resolves to the default channel; it never
throws.

### `pipelines/common/channels.py` after plan 261

Stdlib-only, standalone-importable, exporting `load_registry`, `all_channels`,
`list_channels`, `get_channel`, `default_channel`. It must STAY importable without the
venv (`pipelines/common/__init__.py` loads dotenv on import, which needs it).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Profile validator tests | `node --test config/profiles.test.mjs` | exit 0 |
| Video registry tests | `cd pipelines/video-registry && node --test registry.test.mjs` | exit 0 |
| Python loader tests | `python3 pipelines/common/channels_test.py` | exit 0, `OK` |
| Registry validator (from 261) | `node --test config/channels.test.mjs` | exit 0 |
| `vreg` smoke | `node pipelines/video-registry/bin/vreg.mjs list` | exit 0 |
| Merge gate | `node --test config/profiles.test.mjs && (cd pipelines/video-registry && node --test registry.test.mjs) && python3 pipelines/common/channels_test.py` | exit 0 |

> `node --test <directory>` FAILS on node 22.14 ("Cannot find module .../test"). Always
> pass a FILE path or run `node --test` with no argument from the package directory
> (LESSONS 2026-07-09).

## Scope

**In scope**:
- `config/profiles.mjs` (new)
- `config/profiles.test.mjs` (new)
- `config/README.md` (edit — document the profile fields and their gates)
- `pipelines/common/channels.py` (edit — add `profile_for`)
- `pipelines/common/channels_test.py` (edit — cover it)
- `pipelines/video-registry/{lib/registry.mjs,bin/vreg.mjs,videos.json,registry.test.mjs,CLAUDE.md}` (edit)
- `pipelines/video/visuals-flow/lib/brand-inline.mjs` (edit)
- `pipelines/video/visuals-flow/PIPELINE.md` (edit — one section)
- `pipelines/CLAUDE.md` (edit — one row)

**Out of scope** — looks related, do not touch:
- **Per-channel TTS voice.** `profile.voice_slug` is validated and exposed here, but
  nothing consumes it yet. The reference voice is uploaded once into a Modal volume
  (`pipelines/video/tts/modal/indextts2_app.py`), not chosen per request, so selecting
  a voice per channel means changing the Modal app to accept a reference per call.
  That is its own plan with its own recon. Do NOT attempt it here.
- `pipelines/video/tts/**`, `pipelines/video/heygen/**` — read as validation targets
  only. No edits.
- `pipelines/youtube/yt-script/TASTE.md` and the `*-INSTRUCTIONS.md` files. They are
  owner-owned. This plan validates that the path resolves; it never edits the content.
- `apps/**` — plans 261, 262, 263.
- Creating a second channel's brand, avatar, voice or taste file. Seeded with
  `agrollo` only, by decision.
- Generated media. It never lives in the repo — see `pipelines/CLAUDE.md`.

## Git workflow

- Branch: `advisor/264-channel-profiles-for-the-pipelines`
- Commit per step. One conventional-commit line each, no body, no AI footers. Do NOT push.

## Steps

### Step 1: The profile validator

Create `config/profiles.mjs`. It reads the registry from `channels.mjs` (plan 261) and
checks each profile against the real assets. Error strings carry stable machine codes;
gates assert on them.

```js
/**
 * profiles.mjs — the creative half of a channel: voice, avatar, brand, taste.
 *
 * A profile is a set of POINTERS at assets that live in the pipelines. This module is
 * what makes a dangling pointer a build failure instead of a video that quietly comes
 * out in the wrong voice.
 *
 * Error strings are prefixed with a stable CODE. Gates assert on the code, so
 * renaming one silently disarms a gate. Do not reword them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { allChannels, getChannel, loadRegistry } from './channels.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const VOICE_CATALOG = path.join(REPO_ROOT, 'pipelines', 'video', 'tts', 'REFERENCES.md');
const AVATAR_REGISTRY = path.join(REPO_ROOT, 'pipelines', 'video', 'heygen', 'registry.json');
const VISUALS_ROOT = path.join(REPO_ROOT, 'pipelines', 'video', 'visuals-flow');

/** Slugs from the Markdown table in tts/REFERENCES.md — the backticked first cell. */
export function knownVoiceSlugs(file = VOICE_CATALOG) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Top-level keys of heygen/registry.json. */
export function knownAvatarSlugs(file = AVATAR_REGISTRY) {
  if (!fs.existsSync(file)) return [];
  return Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Where a brand name resolves to on disk. Mirrors visuals-flow/lib/brand-inline.mjs. */
export function brandPathFor(brandName, root = VISUALS_ROOT) {
  return brandName === 'default'
    ? path.join(root, 'brand.json')
    : path.join(root, 'brands', `${brandName}.json`);
}

export function profileFor(channelId, reg = loadRegistry()) {
  const p = getChannel(channelId, reg).profile;
  if (!p) throw new Error(`PROFILE_MISSING: channel ${JSON.stringify(channelId)} has no profile block`);
  return p;
}

/** Returns [] when every profile points at something real; else one string per problem. */
export function validateProfiles(reg = loadRegistry(), opts = {}) {
  const voices = new Set(opts.voices ?? knownVoiceSlugs());
  const avatars = new Set(opts.avatars ?? knownAvatarSlugs());
  const root = opts.repoRoot ?? REPO_ROOT;
  const visuals = opts.visualsRoot ?? VISUALS_ROOT;
  const errors = [];

  for (const c of allChannels(reg)) {
    const at = JSON.stringify(c.id);
    const p = c.profile;
    if (!p) { errors.push(`PROFILE_MISSING: ${at} has no profile block`); continue; }

    if (!p.voice_slug) errors.push(`PROFILE_VOICE_MISSING: ${at} has no voice_slug`);
    else if (!voices.has(p.voice_slug)) {
      errors.push(`PROFILE_VOICE_UNKNOWN: ${at} names voice ${p.voice_slug}, not in tts/REFERENCES.md`);
    }

    if (!p.avatar_slug) errors.push(`PROFILE_AVATAR_MISSING: ${at} has no avatar_slug`);
    else if (!avatars.has(p.avatar_slug)) {
      errors.push(`PROFILE_AVATAR_UNKNOWN: ${at} names avatar ${p.avatar_slug}, not in heygen/registry.json`);
    }

    if (!p.brand) errors.push(`PROFILE_BRAND_MISSING: ${at} has no brand`);
    else if (!fs.existsSync(brandPathFor(p.brand, visuals))) {
      errors.push(`PROFILE_BRAND_UNRESOLVED: ${at} names brand ${p.brand}, no file at ${brandPathFor(p.brand, visuals)}`);
    }

    if (!p.taste_file) errors.push(`PROFILE_TASTE_MISSING: ${at} has no taste_file`);
    else if (!fs.existsSync(path.join(root, p.taste_file))) {
      errors.push(`PROFILE_TASTE_FILE_MISSING: ${at} names taste_file ${p.taste_file}, which does not exist`);
    }

    if (p.style_dna != null && !fs.existsSync(path.join(root, p.style_dna))) {
      errors.push(`PROFILE_STYLE_DNA_MISSING: ${at} names style_dna ${p.style_dna}, which does not exist`);
    }
  }

  return errors;
}
```

**Verify**: `node -e "import('./config/profiles.mjs').then(m=>{const e=m.validateProfiles();if(e.length){console.error(e);process.exit(1)}console.log('ok')})"` -> `ok`
**Verify**: `node -e "import('./config/profiles.mjs').then(m=>console.log(m.knownVoiceSlugs().join(',')))"` -> `jamila-30s,jamila-45s,ref-6s-soft`
**Verify**: `node -e "import('./config/profiles.mjs').then(m=>console.log(m.knownAvatarSlugs().join(',')))"` -> `girl-1,specs-man,side-avatar`

> If either list comes back empty, the parser is wrong. An empty catalogue would make
> every membership check vacuously pass — that is a disarmed gate, so fix the parser
> and do not proceed.

### Step 2: The profile tests

Create `config/profiles.test.mjs`, using `node:test`. Test 1 and test 2 together are
what stop an empty catalogue silently disarming everything.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry } from './channels.mjs';
import { knownAvatarSlugs, knownVoiceSlugs, profileFor, validateProfiles } from './profiles.mjs';

const base = () => JSON.parse(JSON.stringify(loadRegistry()));

test('the shipped profiles all resolve', () => {
  assert.deepEqual(validateProfiles(), []);
});

test('the asset catalogues are non-empty', () => {
  // An empty catalogue makes every membership check vacuously pass. That is a
  // disarmed gate, not a passing one.
  assert.ok(knownVoiceSlugs().length >= 3, 'voice catalogue parsed empty');
  assert.ok(knownAvatarSlugs().length >= 3, 'avatar registry parsed empty');
});

test('profileFor returns the block', () => {
  assert.equal(profileFor('agrollo').brand, 'default');
});

test('an unknown avatar is rejected', () => {
  const reg = base();
  reg.channels[0].profile.avatar_slug = 'not-a-real-avatar';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_AVATAR_UNKNOWN')));
});

test('an unknown voice is rejected', () => {
  const reg = base();
  reg.channels[0].profile.voice_slug = 'not-a-real-voice';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_VOICE_UNKNOWN')));
});

test('a brand with no file is rejected', () => {
  const reg = base();
  reg.channels[0].profile.brand = 'nonexistent-brand';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_BRAND_UNRESOLVED')));
});

test('a missing taste file is rejected', () => {
  const reg = base();
  reg.channels[0].profile.taste_file = 'pipelines/nope/TASTE.md';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_TASTE_FILE_MISSING')));
});

test('a style_dna path that does not exist is rejected', () => {
  const reg = base();
  reg.channels[0].profile.style_dna = 'pipelines/nope/dna.md';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_STYLE_DNA_MISSING')));
});

test('null style_dna is allowed', () => {
  const reg = base();
  reg.channels[0].profile.style_dna = null;
  assert.deepEqual(validateProfiles(reg), []);
});

test('a channel with no profile block is rejected', () => {
  const reg = base();
  delete reg.channels[0].profile;
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_MISSING')));
});
```

**Verify**: `node --test config/profiles.test.mjs` -> exit 0, `pass 10`

### Step 3: Prove the gate fires against real data

Temporarily set `config/channels.json`'s `profile.avatar_slug` to `"not-a-real-avatar"`,
run the tests, confirm the failure names `PROFILE_AVATAR_UNKNOWN`, then revert.

**Verify**: `node --test config/profiles.test.mjs` -> FAILS, output contains `PROFILE_AVATAR_UNKNOWN`
**Verify after revert**: `git diff --exit-code config/channels.json` -> exit 0
**Verify after revert**: `node --test config/profiles.test.mjs` -> exit 0

### Step 4: Python reads profiles

Add to `pipelines/common/channels.py`:

```python
def profile_for(channel_id, reg=None):
    """The creative profile for a channel: voice, avatar, brand, taste file.

    Validation of these pointers lives in config/profiles.mjs (node); Python is a
    consumer only. Raises KeyError for an unknown channel, matching get_channel.
    """
    profile = get_channel(channel_id, reg).get("profile")
    if not profile:
        raise KeyError("PROFILE_MISSING: channel %r has no profile block" % (channel_id,))
    return profile
```

Add to `pipelines/common/channels_test.py`:

```python
    def test_profile_for_returns_the_block(self):
        p = channels.profile_for("agrollo")
        self.assertEqual(p["brand"], "default")
        self.assertTrue(p["voice_slug"])
        self.assertTrue(p["avatar_slug"])

    def test_profile_for_unknown_channel_raises(self):
        with self.assertRaises(KeyError):
            channels.profile_for("missing")
```

Keep the module stdlib-only and standalone-importable — `pipelines/common/__init__.py`
loads dotenv on import and needs the venv, which the test must not require.

**Verify**: `python3 pipelines/common/channels_test.py` -> exit 0, `OK`, 7 tests

### Step 5: Video registry learns about channels

1. **`lib/registry.mjs`** — add a `channelOf(key, reg)` helper returning
   `reg.videos[key]?.channel` or the registry's `default_channel_id`, read via
   `config/channels.mjs` (resolve it from the existing `REPO_ROOT` export). Preserve
   the module's contract exactly: an unregistered key returns the default channel; it
   NEVER throws. Have `ensure`/mint write `channel` on new entries.

2. **`bin/vreg.mjs`** — accept `--channel <id>` on `ensure`. Default to the registry's
   `default_channel_id`. An unknown id exits non-zero with the `CHANNEL_UNKNOWN` message
   rather than minting an entry that points nowhere. Add `channel` to the `list` output.

3. **`videos.json`** — add `"channel": "agrollo"` to EVERY existing entry. Do not
   change any key, title, `minted` date or alias. Keep `save()`'s key ordering.

4. **`registry.test.mjs`** — add tests: every entry has a channel; an entry with no
   `channel` resolves to the default; an unregistered key resolves to the default and
   does not throw; `--channel` with an unknown id is rejected.

**Verify**: `cd pipelines/video-registry && node --test registry.test.mjs` -> exit 0
**Verify**: `node -e "const r=require('fs').readFileSync('pipelines/video-registry/videos.json','utf8');const j=JSON.parse(r);const bad=Object.entries(j.videos).filter(([,v])=>!v.channel);if(bad.length){console.error('missing channel:',bad.map(b=>b[0]));process.exit(1)}console.log('ok',Object.keys(j.videos).length)"` -> `ok <n>`
**Verify**: `node pipelines/video-registry/bin/vreg.mjs list` -> exit 0, output includes a channel column

### Step 6: visuals-flow picks a brand by channel

Change `loadBrand` in `pipelines/video/visuals-flow/lib/brand-inline.mjs` so the
resolution order is explicit and documented:

1. `videoManifest.brand` if set — an explicit per-video override always wins.
2. Otherwise the channel's `profile.brand`, where the channel comes from
   `videoManifest.channel` if present, else the video's `video-registry` entry, else
   the registry default.
3. Otherwise `'default'`.

Keep the existing `brands/<name>.json` path convention and the existing
`brand not found: <name>` error text — other code and docs reference it.

Add the resolution order as a comment block above the function. Add unit tests
alongside the existing visuals-flow tests covering: explicit manifest brand wins; a
manifest with only `channel` resolves through the profile; no manifest at all still
loads `brand.json`; an unresolvable brand still throws `brand not found:`.

**Verify**: `cd pipelines/video/visuals-flow && node --test <the brand test file>` -> exit 0
**Verify**: `node -e "import('./pipelines/video/visuals-flow/lib/brand-inline.mjs').then(m=>{const b=m.loadBrand('pipelines/video/visuals-flow',{});if(b.name!=='default')process.exit(1);console.log('ok')})"` -> `ok`

> Do NOT change `assemble.mjs` or `board.mjs` call signatures. Both already call
> `loadBrand(root, manifest)`; the new behaviour lives entirely inside the function.

### Step 7: Documentation

1. **`config/README.md`** — a **Profiles** section: what each field points at, which
   file is the catalogue for each, and the gate code that fires when it dangles. State
   plainly that `voice_slug` is validated but not yet consumed, and why (the Modal TTS
   app holds one uploaded reference; selecting per channel needs that app changed).
2. **`pipelines/video-registry/CLAUDE.md`** — record that entries carry a `channel`,
   that a missing one means the default channel, and that `resolveKey` still never
   throws for an unregistered video.
3. **`pipelines/video/visuals-flow/PIPELINE.md`** — the brand resolution order, in the
   order above.
4. **`pipelines/CLAUDE.md`** — one row in the folder map pointing at
   `config/README.md` for channel profiles.
5. Append one dated line to `decisions.md`:
   `- 2026-08-30 — **Channel profiles live inside config/channels.json, and dangling pointers are a build failure.** ...`
   Record: why one file beat a second per-channel file; that the validator checks each
   pointer against the real catalogue so a typo cannot ship; and that per-channel VOICE
   is deliberately deferred because the Modal TTS app holds a single uploaded reference
   rather than choosing one per request.

**Verify**: `grep -q "Profiles" config/README.md && grep -q "2026-08-30" decisions.md` -> exit 0

### Step 8: Fresh-checkout gate run

```bash
git clean -xdn config pipelines   # review what would be removed FIRST
node --test config/profiles.test.mjs && (cd pipelines/video-registry && node --test registry.test.mjs) && python3 pipelines/common/channels_test.py
```

**Verify**: exit 0

## Test plan

- `config/profiles.test.mjs` (10 tests) — the shipped profile resolves; the catalogues
  parse non-empty (so no check is vacuous); and each of the six failure classes is
  proven to reject a synthetic bad profile. Step 3 proves the gate fires on real data.
- `pipelines/video-registry/registry.test.mjs` — every entry has a channel; missing
  channel means default; an unregistered key still returns null/default and never
  throws; `--channel` rejects an unknown id.
- `pipelines/common/channels_test.py` (7 tests) — the Python side reads the same
  profiles, on a bare `python3` with no venv.
- New visuals-flow brand tests — the four resolution cases.

## Done criteria

- [ ] `node --test config/profiles.test.mjs` exits 0 with 10 passing tests.
- [ ] `cd pipelines/video-registry && node --test registry.test.mjs` exits 0.
- [ ] `python3 pipelines/common/channels_test.py` exits 0 with 7 tests.
- [ ] `test -f config/profiles.mjs && test -f config/profiles.test.mjs` exits 0.
- [ ] `knownVoiceSlugs()` returns at least 3 entries and `knownAvatarSlugs()` at least 3
      — proving neither catalogue parser silently returns empty.
- [ ] Step 3 was executed: the tests were observed FAILING with
      `PROFILE_AVATAR_UNKNOWN`, and `git diff --exit-code config/channels.json` exits 0
      afterwards.
- [ ] Every entry in `pipelines/video-registry/videos.json` has a `channel`, and no key,
      title, `minted` date or alias changed:
      `git diff ddc5f4dd..HEAD -- pipelines/video-registry/videos.json` shows only added
      `channel` lines.
- [ ] `node pipelines/video-registry/bin/vreg.mjs list` exits 0.
- [ ] `git diff --stat ddc5f4dd..HEAD -- pipelines` lists only In-scope files, and
      `git diff --stat ddc5f4dd..HEAD -- pipelines/video/tts pipelines/video/heygen` is
      EMPTY.
- [ ] `decisions.md` has the dated 2026-08-30 line.

## STOP conditions

- **A gate assertion fails and the obvious fix is to weaken it.** Fix the code or the
  fixture. Weakening, swapping or deleting an assertion is a STOP.
- **A catalogue parser returns an empty list.** That makes every membership check pass
  vacuously — a disarmed gate wearing a green tick. Fix the parser; do not proceed.
- **You are about to invent a second channel's brand, avatar, voice or taste file.**
  The registry ships with `agrollo` only, deliberately. Stop and report.
- **You are about to make `resolveKey` or any registry lookup throw for an unregistered
  video.** Its documented contract is that callers treat null as "not registered, NEVER
  an error" and no consuming pipeline may hard-fail on a missing entry.
- **You are about to rename or renumber a key in `videos.json`.** Those keys are the
  shared identity between `yt-script` and `visuals-flow`; renaming one silently
  detaches a video's work from itself.
- **You are about to edit `pipelines/video/tts/**` or `pipelines/video/heygen/**`.**
  They are validation targets, not deliverables here.
- **You are about to wire per-channel TTS voice.** The Modal app holds one uploaded
  reference in a volume; selecting per channel needs that app changed. Out of scope by
  decision — stop and report.
- **You are about to edit `TASTE.md` or any `*-INSTRUCTIONS.md`.** Owner-owned content.
- **Done criteria still fail after 5 fix attempts.** Write
  `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- The validator is the whole point of this plan. Without it, a profile is a set of
  strings nobody checks, and a typo surfaces as a video in the wrong voice weeks later.
  The two "catalogue is non-empty" assertions are what keep the validator honest.
- `profile.voice_slug` is validated but unconsumed. That is deliberate and recorded in
  `config/README.md`. Its follow-up plan changes
  `pipelines/video/tts/modal/indextts2_app.py` to accept a reference per request
  instead of one uploaded into the volume, then makes the VO engine pass the channel's
  slug.
- Brand resolution has three layers now (manifest override, channel profile, default).
  If a video ever renders in the wrong colours, that order is the first thing to check.
- When channel two arrives, the work is: add its entry to `config/channels.json`, drop
  a `brands/<name>.json` into `visuals-flow`, add its avatar to
  `heygen/registry.json`, and point `taste_file` at its own taste file. The validator
  fails until all four exist — which is the intended forcing function.
- A reviewer should scrutinise: that the catalogue parsers really parse (not return
  empty); that `videos.json` gained only `channel` lines; that no registry lookup
  became throwing; and that Step 3 was really executed.
