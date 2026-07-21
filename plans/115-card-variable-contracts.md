<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && node --test
ui:
deploy:
needs: ["Foundation for 116/117/118 — land this first"]
---

# Plan 115: Card variable contracts (typed shapes + editorial roles) with resolver enforcement

## Summary

- **Problem statement**: `card-library/catalog.json` declares card variables as bare type hints (`"left": "object"`, `"subtitle": "string (optional)"`). `lib/resolve.mjs` only checks that a key exists and that descriptions containing the word "array" hold a non-empty array. Everything else — wrong shapes, invalid enum values, unknown icon names, and editorially wrong content — passes silently and reaches render as a broken or embarrassing card.
- **Goals**:
  - Replace the untyped `variables` map with a machine-checkable contract (type, shape, enum, editorial role, length caps, omit-guidance).
  - Enforce shape/enum/role violations as hard errors in `resolve.mjs` so they can never reach the board.
  - Give the cue-pass LLM a per-slot content contract so it stops inventing flow narration and sentence-shaped headings.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — fully inlined schema + validator code below; mechanical migration across ~50 catalog entries.
- **Done criteria** (terse — full list below): `node --test` green in visuals-flow; the three garbage-shape fixtures are REJECTED; every catalog card carries object-form variables; `check-cards.sh` passes.
- **Stop conditions** (terse — full list below): any pre-existing test failure before you start; any card whose real render contradicts the contract you are writing.
- **Test / verification for success**: new unit tests in `lib/resolve.test.mjs` asserting rejection of malformed variables, plus the existing suite staying green.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/card-library/catalog.json pipelines/video/visuals-flow/lib/resolve.mjs pipelines/video/visuals-flow/lib/lint-cues.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (foundation for 116, 117, 118)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

The visuals-flow cue pass is explicitly designed to be model-portable — the prompt is self-contained and any "Sonnet-class-or-better" session may run it. That portability only holds if the card contract is machine-enforced. Today it is not, so output quality swings with whichever model happened to guess a variable shape correctly, and the owner catches the misses by eye on the storyboard.

This was demonstrated, not theorised. On 2026-07-21 the following cues were fed to `node lib/resolve.mjs` and **all three were accepted with exit code 0**:

```json
{ "card": "comparison/head-to-head", "variables": { "left": "this is not an object at all", "right": 42 } }
{ "card": "overlay/callout",         "variables": { "kind": "banana", "pos": "diagonally-nowhere", "title": "T", "text": "x" } }
{ "card": "checklist/icon-pills",    "beats": [ { "reveal": { "icon": "not-a-real-icon", "text": "hello" } } ] }
```

Each renders as a broken or default card. Nothing in the pipeline objects.

The same thinness causes *editorial* misses. Three owner rejections in one review session, all traceable to a slot with no content contract:

- `tool-glass-tile.subtitle` was filled with `"First up in the demo"` — flow narration, not tool information. The catalog says only `"string (optional)"`.
- `headline-chips.headline` was filled with `"Same video, same goal, same criteria"` — a comma-listed sentence sitting in a slot the card renders as a bold heading. The catalog calls it "a spoken headline sentence"; the card draws a title.
- Optional slots get filled reflexively because the prompt says "fill every non-beat variable the card lists" and nothing says when omitting is better.

The fold README (`steps/060-feedback-fold-opus/README.md`, line 26) already states the governing principle: *"machine-enforced surfaces beat prose — prefer a catalog field + resolver validation over a rulebook sentence when both could work."* This plan applies it.

## Current state

### `pipelines/video/card-library/catalog.json`

50 cards. Variables are free-text descriptions. Representative entries, verbatim:

```json
{
  "slug": "tool-icon/tool-glass-tile",
  "kind": "single",
  "placement": "fullframe",
  "purpose": "hero for one tool/model: a glassy app-icon tile with the tool's (muted) logo, its name beneath, and an optional subtitle — the 'this is the tool' beat",
  "variables": {
    "logo": "string — logos/ registry slug",
    "name": "string",
    "subtitle": "string (optional)"
  },
  "default_duration": 6
}
```

```json
{
  "slug": "comparison/head-to-head",
  "kind": "single",
  "placement": "fullframe",
  "purpose": "two-contender VS panel with stats stacked on each side and a center VS badge",
  "variables": { "left": "object", "right": "object" },
  "default_duration": 5.5
}
```

```json
{
  "slug": "overlay/callout",
  "kind": "single",
  "placement": "overlay",
  "variables": {
    "kind": "string",
    "title": "string",
    "text": "string",
    "pos": "string",
    "style": "string (optional): 'feature' | 'tip' | 'warning' — default 'feature'",
    "kicker": "string (optional)"
  },
  "default_duration": 5
}
```

The real enum values live only in each card's `index.html`. Confirmed by reading the cards:

- `overlay/callout` — `kind`: `tip | warning | note`; `pos`: `top-right | top-left | bottom-right | center`; `style`: `feature | tip | warning`.
- `overlay/tip-banner` — `kind`: `tip | warning | danger | info`; `edge`: `bottom | top`.
- `overlay/savings-badge` — `pos`: `center | bottom-left | bottom-right | top-right`.
- `comparison/head-to-head` — `left`/`right` are `{ name: string, stats: [{ label, value }], logoSvg?: string }`.
- `checklist/icon-pills` — `beat_shape.icon` is already documented as a pipe list in the catalog: `brain|calendar|person|bolt|gear|lock|clock|chart|chat|shield|doc|search|star|cloud`, but nothing validates it.

### `pipelines/video/visuals-flow/lib/resolve.mjs` — the only validation that exists

Lines 67–78, verbatim:

```js
    for (const [k, desc] of Object.entries(cat.variables ?? {})) {
      const optional = String(desc).toLowerCase().includes('optional');
      if (!(k in vars)) {
        if (!optional) errors.push(`${cue.id}: missing variable "${k}" (${desc}) — the card would silently show its default content`);
        continue;
      }
      if (String(desc).toLowerCase().includes('array')) {
        if (!Array.isArray(vars[k]) || vars[k].length === 0) {
          errors.push(`${cue.id}: variable "${k}" must be a non-empty array (${desc})`);
        }
      }
    }
```

Note the optionality test is `desc.toLowerCase().includes('optional')` — a substring match on prose. This is the whole contract.

Logo slug refs ARE validated (lines 79–91) against `card-library/logos/registry.json`, which is the one place the current design already does the right thing. Use it as the model for the new validator's error wording.

### Conventions to match

- ESM (`.mjs`), `import fs from 'node:fs'`, 2-space indent, no semicolon-free style — match `lib/resolve.mjs` exactly.
- Errors are pushed as plain strings prefixed with the cue id: `` `${cue.id}: ...` ``.
- Tests use `node:test` + `node:assert/strict`. **Exemplar to imitate: `lib/resolve.test.mjs`.**

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full test suite (the merge gate) | `cd pipelines/video/visuals-flow && node --test` | exit 0, `# fail 0` |
| Single test file | `cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs` | exit 0 |
| Card structure check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Catalog parses | `node -e "JSON.parse(require('fs').readFileSync('pipelines/video/card-library/catalog.json','utf8')); console.log('ok')"` | `ok` |
| Rulebook gate | `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` | `rulebook ok` |

**Do NOT** write a `test_cmd` of the form `node --test <dir>/` — it fails on node 22.14 (`plans/runs/LESSONS.md`, 2026-07-09). The working form is `node --test` with no argument from the package directory.

## Scope

**In scope**:
- `pipelines/video/card-library/catalog.json` (all 50 card entries)
- `pipelines/video/visuals-flow/lib/resolve.mjs` (validator)
- `pipelines/video/visuals-flow/lib/resolve.test.mjs` (new tests)
- `pipelines/video/card-library/scripts/check-catalog.mjs` (new)
- `pipelines/video/card-library/package.json` (one script entry)
- `pipelines/video/card-library/CLAUDE.md` (document the contract)

**Out of scope**:
- `steps/020-cue-pass-llm/cue-pass-prompt.md` and `RULEBOOK.md` — the prompt rewrite is plan 116. Touching it here creates a merge conflict with 116.
- `lib/lint-cues.mjs` thresholds — plan 116 owns those.
- Any card's `index.html`. You are documenting what the cards already do, never changing behaviour. If a card's real enum disagrees with this plan, STOP (see STOP conditions).
- `videos/**` — no cue file is edited by this plan.

## Git workflow

- Branch: `advisor/115-card-variable-contracts`
- Commit per step. Message style: `feat(card-library): typed variable contracts`. No AI footers. Do NOT push.

## Steps

### Step 1: Define the contract schema

Create `pipelines/video/card-library/VARIABLE-CONTRACT.md` documenting the object form. This is the human-facing spec; the executor writes it verbatim from here.

A variable entry becomes an object instead of a string:

```json
"subtitle": {
  "type": "string",
  "required": false,
  "role": "descriptor",
  "max_words": 6,
  "omit_unless": "it adds information the logo and name do not already convey — never flow narration such as 'First up in the demo'",
  "example": "Caption-first short-form editor"
}
```

Field definitions:

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `string` \| `number` \| `boolean` \| `object` \| `array` |
| `required` | yes | boolean. Replaces the `includes('optional')` substring hack. |
| `role` | yes for `string` | see role table below |
| `enum` | no | array of legal values; validator rejects anything else |
| `max_words` | no | integer; validator counts whitespace-separated tokens |
| `max_chars` | no | integer |
| `shape` | no | for `type: object` / `array` — nested contract, same field set |
| `item_shape` | no | for `type: array` — contract each element must satisfy |
| `omit_unless` | no | model-facing prose; only meaningful when `required: false` |
| `example` | yes for `string` | a correct value, shown to the LLM |

Role table (`role` is the editorial contract — this is what stops sentence-shaped headings):

| role | Meaning | Validator enforces |
|---|---|---|
| `heading` | Title-like. Reads as a heading, not a sentence. | `max_words` default 7; **no terminal `.`**; **at most 1 comma** |
| `sentence` | A spoken line, may be verbatim VO. | `max_words` default 18 |
| `label` | Chip/pill/row label. | `max_words` default 5; no terminal `.` |
| `descriptor` | Positioning line under a name. | `max_words` default 6; no terminal `.` |
| `value` | A number carrying its unit. | must match `/[0-9]/` |
| `logo_slug` | A `logos/registry.json` slug. | existing logo-registry check |
| `icon_name` | An icon-set name. | must be in the card's `enum` |
| `free` | No editorial constraint. | nothing |

**Verify**: `test -f pipelines/video/card-library/VARIABLE-CONTRACT.md && grep -c "omit_unless" pipelines/video/card-library/VARIABLE-CONTRACT.md` -> at least `1`

### Step 2: Write the validator

Add to `lib/resolve.mjs`, replacing the lines 67–78 block quoted in "Current state". Write this function verbatim — it is the intelligence-heavy part of the plan:

```js
const ROLE_DEFAULTS = {
  heading:    { max_words: 7,  noTerminalPeriod: true,  maxCommas: 1 },
  sentence:   { max_words: 18 },
  label:      { max_words: 5,  noTerminalPeriod: true },
  descriptor: { max_words: 6,  noTerminalPeriod: true },
  value:      { mustContainDigit: true },
  logo_slug:  {},
  icon_name:  {},
  free:       {},
};

// Validate one value against one contract entry. Returns an array of message
// strings (empty = valid). `path` is a human-readable location like
// `left.stats[0].label` so an error points at the exact slot.
export function validateVariable(path, value, spec) {
  const out = [];
  if (spec === undefined) return out;

  // Legacy string form: fall back to presence-only checking so a partially
  // migrated catalog still resolves. check-catalog.mjs is what forbids it.
  if (typeof spec === 'string') return out;

  const t = spec.type;
  const actual = Array.isArray(value) ? 'array' : typeof value;
  if (t && actual !== t) {
    out.push(`${path}: expected ${t}, got ${actual} (${JSON.stringify(value)?.slice(0, 40)})`);
    return out; // shape is wrong; further checks would be noise
  }

  if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
    out.push(`${path}: "${value}" is not one of ${spec.enum.join(' | ')}`);
  }

  if (t === 'string') {
    const rule = { ...(ROLE_DEFAULTS[spec.role] ?? {}), ...spec };
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    if (rule.max_words && words.length > rule.max_words) {
      out.push(`${path}: ${words.length} words exceeds max_words ${rule.max_words} for role "${spec.role}" — "${value}"`);
    }
    if (rule.max_chars && String(value).length > rule.max_chars) {
      out.push(`${path}: ${String(value).length} chars exceeds max_chars ${rule.max_chars}`);
    }
    if (rule.noTerminalPeriod && /\.\s*$/.test(String(value))) {
      out.push(`${path}: role "${spec.role}" must not end in a period — "${value}" reads as a sentence, not a ${spec.role}`);
    }
    if (rule.maxCommas !== undefined && (String(value).match(/,/g) ?? []).length > rule.maxCommas) {
      out.push(`${path}: role "${spec.role}" allows at most ${rule.maxCommas} comma — "${value}" reads as a list, not a heading`);
    }
    if (rule.mustContainDigit && !/[0-9]/.test(String(value))) {
      out.push(`${path}: role "value" must carry a number — "${value}"`);
    }
  }

  if (t === 'object' && spec.shape && value && typeof value === 'object') {
    for (const [k, sub] of Object.entries(spec.shape)) {
      if (!(k in value)) {
        if (sub.required !== false) out.push(`${path}.${k}: missing required field`);
        continue;
      }
      out.push(...validateVariable(`${path}.${k}`, value[k], sub));
    }
  }

  if (t === 'array' && spec.item_shape && Array.isArray(value)) {
    value.forEach((el, i) => {
      for (const [k, sub] of Object.entries(spec.item_shape)) {
        if (!(k in el)) {
          if (sub.required !== false) out.push(`${path}[${i}].${k}: missing required field`);
          continue;
        }
        out.push(...validateVariable(`${path}[${i}].${k}`, el[k], sub));
      }
    });
  }

  return out;
}
```

Wire it into the existing loop, replacing lines 67–78:

```js
    for (const [k, spec] of Object.entries(cat.variables ?? {})) {
      const isRequired = typeof spec === 'string'
        ? !String(spec).toLowerCase().includes('optional')
        : spec.required !== false;
      if (!(k in vars)) {
        if (isRequired) errors.push(`${cue.id}: missing variable "${k}" — the card would silently show its default content`);
        continue;
      }
      for (const msg of validateVariable(k, vars[k], spec)) errors.push(`${cue.id}: ${msg}`);
    }
```

Also validate beat reveals against `beat_shape` using the same function, immediately after the loop above:

```js
    for (const [i, b] of (cue.beats ?? []).entries()) {
      for (const [k, spec] of Object.entries(cat.beat_shape ?? {})) {
        if (typeof spec === 'string') continue; // legacy entry, nothing to check
        if (!(k in (b.reveal ?? {}))) {
          if (spec.required !== false) errors.push(`${cue.id} beat ${i + 1}: missing reveal field "${k}"`);
          continue;
        }
        for (const msg of validateVariable(`beat ${i + 1}.${k}`, b.reveal[k], spec)) {
          errors.push(`${cue.id}: ${msg}`);
        }
      }
    }
```

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/resolve.test.mjs` -> exit 0

### Step 3: Migrate the catalog to object form

Convert every `variables` and `beat_shape` entry in `catalog.json` to the object form. Preserve every existing description as the `example` or in `omit_unless` where it carries meaning. Do not invent limits beyond the role defaults unless the card's `index.html` proves a tighter one.

Three entries are specified exactly — write these verbatim, they are the ones the owner rejected:

```json
"tool-icon/tool-glass-tile": {
  "logo":     { "type": "string", "required": true,  "role": "logo_slug", "example": "submagic" },
  "name":     { "type": "string", "required": true,  "role": "label", "max_words": 3, "example": "Submagic" },
  "subtitle": { "type": "string", "required": false, "role": "descriptor", "max_words": 6,
                "omit_unless": "it states what the tool IS or DOES in words the logo and name do not already carry. Never flow narration about the video itself ('First up in the demo', 'Next tool', 'Same video, same goal').",
                "example": "Caption-first short-form editor" }
}
```

```json
"slate/headline-chips": {
  "headline": { "type": "string", "required": true, "role": "heading", "max_words": 7,
                "example": "Publish-ready beats raw speed" }
}
```

```json
"comparison/head-to-head": {
  "left":  { "type": "object", "required": true, "shape": {
     "name":  { "type": "string", "required": true,  "role": "label", "max_words": 3, "example": "OpusClip" },
     "stats": { "type": "array", "required": true, "item_shape": {
        "label": { "type": "string", "required": true, "role": "label",  "max_words": 3, "example": "Starter" },
        "value": { "type": "string", "required": true, "role": "value",  "max_words": 3, "example": "$12 / mo" }
     }}
  }},
  "right": { "type": "object", "required": true, "shape": { "...": "identical to left" } }
}
```

(Write `right` out in full, mirroring `left` — the `"..."` above is shorthand for this plan only, never for the JSON.)

For `overlay/callout`, `overlay/tip-banner`, `overlay/savings-badge` and `checklist/icon-pills`, add the `enum` arrays exactly as listed in "Current state". Read each card's `index.html` `DATA` block to confirm before writing; the comment beside each `VARS.x ??` default is the authoritative list.

**Verify**: `node -e "const c=JSON.parse(require('fs').readFileSync('pipelines/video/card-library/catalog.json','utf8')); const bad=c.cards.filter(k=>Object.values(k.variables??{}).some(v=>typeof v==='string')); console.log(bad.length===0?'all migrated':'STILL STRING: '+bad.map(b=>b.slug).join(','))"` -> `all migrated`

### Step 4: Add the catalog self-check script

Create `pipelines/video/card-library/scripts/check-catalog.mjs`. It fails (exit 1) when:

- any `variables` or `beat_shape` entry is still a bare string,
- a `string`-typed entry lacks `role` or `example`,
- a `role` value is not in the role table,
- an `example` value would itself fail `validateVariable` (import it from `../../visuals-flow/lib/resolve.mjs`).

That last check is the important one — it means every example the LLM is shown is guaranteed to satisfy its own contract.

Add to `card-library/package.json` scripts: `"check-catalog": "node scripts/check-catalog.mjs"`.

**Verify**: `cd pipelines/video/card-library && node scripts/check-catalog.mjs` -> `catalog ok`, exit 0

### Step 5: Regression tests

Add to `lib/resolve.test.mjs`, following the existing test style in that file. Each of these must produce a non-empty `errors` array:

1. `head-to-head` with `left: "this is not an object at all"` → error mentioning `expected object, got string`.
2. `overlay/callout` with `kind: "banana"` → error mentioning `not one of`.
3. `icon-pills` beat with `icon: "not-a-real-icon"` → error mentioning `not one of`.
4. `tool-glass-tile` with `subtitle: "First up in the demo"` → **passes shape but must fail** `max_words`? No — it is 5 words and legal by length. Assert instead that a 9-word subtitle fails, and document in the test name that the *editorial* miss ("flow narration") is caught by `omit_unless` prose in the prompt, not by the validator.
5. `headline-chips` with `headline: "Same video, same goal, same criteria"` → error mentioning `at most 1 comma`.
6. A valid cue for each of the three cards → `errors` is empty.

Test 5 is the direct regression for the owner's 2026-07-21 rejection. Test 4's comment is deliberate: it records the known boundary between what code can enforce and what stays prose.

**Verify**: `cd pipelines/video/visuals-flow && node --test` -> exit 0, `# fail 0`

### Step 6: Document

Add a "Variable contracts" section to `pipelines/video/card-library/CLAUDE.md` under the existing "Adding a new card" section: a new card's catalog entry must use object-form variables and pass `npm run check-catalog`, and every `string` slot needs a `role` and an `example`.

**Verify**: `grep -c "check-catalog" pipelines/video/card-library/CLAUDE.md` -> at least `1`

## Test plan

- New tests live in `lib/resolve.test.mjs` alongside the existing resolver tests; follow the file's current `describe`/`test` structure.
- No new test runner, no new dependency.
- The merge gate is the whole visuals-flow suite, which already covers resolve/lint/board/assemble.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0 with `# fail 0`
- [ ] `cd pipelines/video/card-library && node scripts/check-catalog.mjs` prints `catalog ok`
- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] No `variables` or `beat_shape` entry in `catalog.json` is a bare string
- [ ] All six regression tests from Step 5 exist and pass
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope file list

## STOP conditions

- **The suite is red before you start.** Run `node --test` first. If anything fails at `18488a2`, stop and report — do not "fix" a pre-existing failure inside this plan.
- **A card's real behaviour contradicts the contract.** If reading a card's `index.html` shows an enum value or shape this plan did not list, stop and report the discrepancy. Do not change the card, and do not silently widen the contract to match.
- **Migrating a card would require changing its render.** The contract documents existing behaviour only.
- **Any existing `videos/*/cues.json` stops resolving.** Run `node lib/resolve.mjs test-01` and `node lib/resolve.mjs test-02` after Step 3. New *errors* on committed videos mean the contract is wrong, not the video — stop and report which slot.

## Maintenance notes

- The `omit_unless` field is the one deliberately non-machine-checkable part. It exists to be rendered into the cue prompt (plan 116) so the model sees it. Reviewers should scrutinise whether a new rule belongs in `enum`/`max_words` (enforceable) before settling for `omit_unless` (prose).
- `validateVariable` is exported so `check-catalog.mjs` can validate the catalog's own examples. Keep it pure and dependency-free.
- When adding a card type with a genuinely new editorial register, add a role to `ROLE_DEFAULTS` rather than piling `max_words` overrides onto individual cards.
