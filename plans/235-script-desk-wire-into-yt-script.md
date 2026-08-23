---
executor: agy
model:
test_cmd: cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs test/beats.test.mjs test/worksheet.test.mjs
ui:
deploy:
needs: ["234 lands the hosted worker and the desk CLI"]
needs_prs: [195]
touches: [pipelines/.claude/skills/yt-script/SKILL.md, pipelines/youtube/yt-script/CLAUDE.md, pipelines/youtube/yt-script/test/desk-docs.test.mjs, tooling/cli/local-apps-dashboard/apps.json, my-hosted-sites.md, INFRA.md, apps/yt-script-desk/README.md, apps/yt-script-desk/CLAUDE.md]

mutation_apply: perl -0pi -e "s#https://script-desk\.agrolloo\.com#https://example.invalid#g" my-hosted-sites.md
mutation_command: cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs
mutation_expect: DESK_URL_MISSING
mutation_cwd:
mutation_timeout: 600
---

# Plan 235: wire the script desk into the yt-script skill and the registries

## Summary

- **Problem statement**: Plans 231–234 build the desk but nothing points at it. The `yt-script` skill still tells a session to render a PDF and a worksheet, the local dashboard has no entry for it, and the new URL is in none of the three inventory surfaces.
- **Goals**:
  - Rewrite steps 2 and 3 of the `yt-script` skill so the desk is the handoff and `desk.mjs pull` is how the draft comes back.
  - Register the app in `local-apps-dashboard`, `my-hosted-sites.md` and `INFRA.md` (the triple-update rule).
  - Write the app's real `README.md` and `CLAUDE.md`.
  - Land a docs gate so the wiring cannot silently rot.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High)
- **Done criteria** (terse): `node --test test/desk-docs.test.mjs test/beats.test.mjs test/worksheet.test.mjs` exits 0; `./scripts/check-skill-descriptions.sh` exits 0.
- **Stop conditions** (terse): you are about to delete `render-worksheet.mjs` or `render-outline.mjs`; you are about to edit `decisions.md`.
- **Test / verification for success**: a new docs test asserting every wiring point exists, plus the existing two suites staying green.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ca36925c..HEAD -- pipelines/.claude/skills/yt-script/ pipelines/youtube/yt-script/ tooling/cli/local-apps-dashboard/ my-hosted-sites.md INFRA.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 234
- **Category**: feature
- **Difficulty**: mechanical
- **Planned at**: commit `ca36925c`, 2026-08-23

## Why this matters

A tool nobody is routed to is a tool nobody uses. The owner's whole complaint was that the handoff is two documents in an awkward shape; that only changes when the skill itself stops producing them as the handoff.

The `render-worksheet.mjs` and `render-outline.mjs` paths **stay working**. Retiring them is a separate owner decision, and until the desk has carried a real video end to end, the PDF is the fallback. This plan changes what the skill *recommends*, not what exists.

## Current state

### The skill

Source of truth: `pipelines/.claude/skills/yt-script/SKILL.md` (a pipelines-domain skill; `.claude/skills/yt-script` is a symlink to it — edit the source, never the symlink). `pipelines/youtube/yt-script/CLAUDE.md` carries a near-duplicate of the same operating text and must be kept in step.

Step 2 today ends with:

> 5. Generate the write artifact: `node render-worksheet.mjs <key>` → `script-worksheet.md`. …
> 7. The owner sends the maker **both** files: `outline.pdf` to read, and `script-worksheet.md` to fill.

Step 3 today begins with:

> Triggered by the owner handing back the **team member's completed draft** … It may arrive as a file, a paste, or a link to a doc.
> 1. **Store the draft verbatim first** as `videos/<key>/script-draft.md` …
> 2. **Diff it against what was sent**: `diff script-worksheet.md script-draft.md`.

### The registries

- `tooling/cli/local-apps-dashboard/apps.json` — a JSON array of `{id, name, cwd, start, port, ports, url}` objects; `cwd` is relative to the repo root; reload the dashboard page, no restart needed.
- `my-hosted-sites.md` — a flat bullet list, `- <Name> — <url>`.
- `INFRA.md` — the canonical Cloudflare + VPS + DNS inventory.

### The skill-description budget

`./scripts/check-skill-descriptions.sh` warns over 500 characters and fails over 700. The `yt-script` description is already near the warn line; if you touch it, keep it shorter than it was.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The merge gate | `cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs test/beats.test.mjs test/worksheet.test.mjs` | exit 0, `fail 0` |
| Skill descriptions | `./scripts/check-skill-descriptions.sh` | exit 0 |
| apps.json parses | `node -e "JSON.parse(require('fs').readFileSync('tooling/cli/local-apps-dashboard/apps.json','utf8'))"` | exit 0 |
| App suite still green | `cd apps/yt-script-desk && npm run typecheck && npm test` | exit 0 |

## Scope

**In scope**:
- `pipelines/.claude/skills/yt-script/SKILL.md`
- `pipelines/youtube/yt-script/CLAUDE.md`
- `pipelines/youtube/yt-script/test/desk-docs.test.mjs` (new)
- `tooling/cli/local-apps-dashboard/apps.json`
- `my-hosted-sites.md`
- `INFRA.md`
- `apps/yt-script-desk/README.md`, `apps/yt-script-desk/CLAUDE.md`

**Out of scope**:
- `decisions.md` — the orchestrator appends after landing. Executors never write it.
- `render-worksheet.mjs`, `render-outline.mjs`, `render-script.mjs`, `SCRIPT-INSTRUCTIONS.md`, `OUTLINE-INSTRUCTIONS.md` — unchanged. Do not delete or deprecate them.
- `test/worksheet.test.mjs` and `test/beats.test.mjs` — run them, do not edit them.
- Any app source under `apps/yt-script-desk/src`, `server`, `bin` — plans 232–234 own it.
- Deploying anything.

## Git workflow

- Branch: `advisor/235-script-desk-wire-into-yt-script`
- Commit: `docs(yt-script): route the outline handoff through the script desk` — no AI footers. Do NOT push.

## Steps

### Step 1: Rewrite step 2 of the skill

In `pipelines/.claude/skills/yt-script/SKILL.md`, replace items 4–8 of "Step 2 — the outline" with:

```markdown
4. Render the read copy: `node render-outline.mjs <key>` → `outline.html` +
   `outline.pdf`. Both gitignored. The PDF is now a **fallback**, not the
   handoff — keep making it, because it is what works if the desk is down.
5. Publish to the script desk:

   ```bash
   cd apps/yt-script-desk
   DESK_ADMIN_TOKEN=… node bin/desk.mjs publish <key>
   ```

   It prints one URL. That URL is the handoff — the maker reads the
   instructions and writes his lines in the same page, with the two kept in
   separate tracks. Nothing else is sent.
6. **Stop and wait for approval.** Do not start the script.
```

Delete the two paragraphs beginning "**The worksheet carries no reference draft and no facts**" and replace them with:

```markdown
**Instructions never enter the script track.** The desk splits every beat into
two columns: the words that will be spoken on the left, and the recording
notes, edit notes and facts on the right. That separation is the whole reason
the desk exists — the old `outline.pdf` mixed all four in one vertical stream
and the maker could not tell content from instruction at a glance.

A body beat's `SAY` lane is still a short draft prompt, never finished copy. In
the desk it appears in the RIGHT track, labelled **Angle** — an instruction he
reads, not a line he can paste (decisions.md 2026-08-18; enforced by a test in
`lib/beats.mjs`).

`render-worksheet.mjs` still works and still produces `script-worksheet.md`.
Use it only if the desk is unavailable.
```

**Verify**: `grep -c 'desk.mjs publish' pipelines/.claude/skills/yt-script/SKILL.md` → `1` or more.

### Step 2: Rewrite step 3's intake

Replace items 1–2 of "Step 3 — the final AI-VO script" with:

```markdown
1. **Pull his draft down.** From the repo root:

   ```bash
   cd apps/yt-script-desk
   DESK_ADMIN_TOKEN=… node bin/desk.mjs pull <key>
   ```

   It writes `videos/<key>/script-draft.md` — his words, verbatim — and prints
   to stderr one line per beat whose locked copy he edited. It refuses to
   overwrite an existing draft without `--force`, because that file is the
   record.

   If he sent a file or a paste instead (desk unavailable), store it verbatim
   at that same path by hand. Never edit it in place, then or later.
2. **Read the edited-line list.** Every line `desk.mjs pull` printed is a place
   he changed copy that was final. Each one becomes its own line in the step-7
   change report. Changing pre-filled copy is legitimate — his screen time may
   have shown it wrong — but it may never pass silently. The original is kept
   in the desk and reachable with its **Restore original** control.
```

Keep the rest of step 3 as-is. In the folder-layout tree near the top of the file, change the `script-worksheet.md` line's comment to note it is a fallback, and add a `desk-draft.json` line marked "local-mode scratch, gitignored".

**Verify**: `grep -c 'desk.mjs pull' pipelines/.claude/skills/yt-script/SKILL.md` → `1` or more.

### Step 3: Mirror into the folder guide

`pipelines/youtube/yt-script/CLAUDE.md` restates the same operating text. Apply the same two rewrites there so the two documents do not drift. Do not change anything else in it.

**Verify**: `grep -c 'desk.mjs' pipelines/youtube/yt-script/CLAUDE.md` → `2` or more.

### Step 4: Register in the local dashboard

Append to `tooling/cli/local-apps-dashboard/apps.json`:

```json
{
  "id": "script-desk",
  "name": "script desk",
  "cwd": "apps/yt-script-desk",
  "start": "npm run dev:local",
  "port": 5175,
  "ports": [5175, 4327],
  "url": "http://localhost:5175/?key=character-consistency-ai"
}
```

Ports 5175 and 4327 must not already appear on another entry.

**Verify**:
```bash
node -e "
const a=JSON.parse(require('fs').readFileSync('tooling/cli/local-apps-dashboard/apps.json','utf8'));
const all=a.flatMap(x=>x.ports||[x.port]).filter(Boolean);
console.log(a.some(x=>x.id==='script-desk'), new Set(all).size===all.length)"
```
→ prints `true true`.

### Step 5: The triple-update rule

**`my-hosted-sites.md`** — add, in the same idiom as its neighbours:

```
- Script desk (freelancer script-writing page) — https://script-desk.agrolloo.com (secret-link only, per video)
```

**`INFRA.md`** — add a row/entry for the Worker `yt-script-desk` in whatever table the file already uses for Cloudflare Workers, recording: worker name `yt-script-desk`, custom domain `script-desk.agrolloo.com`, D1 binding `DESK_DB` → database `script-desk-db`, secret `DESK_ADMIN_TOKEN`, and the note "access is a per-video secret link; there is no login". Match the file's existing column set exactly — read it before writing.

**Verify**: `grep -c 'script-desk.agrolloo.com' my-hosted-sites.md INFRA.md` → `1` for each file.

### Step 6: The app's own docs

`apps/yt-script-desk/README.md` — for a human: what the desk is, the two views, how to run it locally (`npm run dev:local`, the `?key=` query), how to publish and pull, and what the freelancer sees.

`apps/yt-script-desk/CLAUDE.md` — for a session operating here: the two-track rule (instructions never enter the left track), the `says → say → draft` resolution order, that `outline.md` is upstream and D1 is a copy, that `script-draft.md` is the record and is never edited in place, where the mutation-target constants live and why they must not be tidied away, and the deploy chain being owner-gated.

Both replace the stubs from plan 232.

**Verify**: `wc -l apps/yt-script-desk/README.md apps/yt-script-desk/CLAUDE.md` → each over 25 lines.

### Step 7: The docs gate

Create `pipelines/youtube/yt-script/test/desk-docs.test.mjs`. Every assertion message that guards a wiring point must contain the marker shown.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const read = (p) => readFileSync(join(REPO, p), 'utf8')

const URL = 'https://script-desk.agrolloo.com'

test('the skill routes the handoff through the desk', () => {
  const s = read('pipelines/.claude/skills/yt-script/SKILL.md')
  assert.match(s, /desk\.mjs publish/, 'DESK_WIRING_MISSING: step 2 does not publish to the desk')
  assert.match(s, /desk\.mjs pull/, 'DESK_WIRING_MISSING: step 3 does not pull the draft')
  assert.match(s, /Angle/, 'DESK_WIRING_MISSING: the body-draft rule is not restated')
})

test('the folder guide says the same thing', () => {
  const c = read('pipelines/youtube/yt-script/CLAUDE.md')
  assert.match(c, /desk\.mjs/, 'DESK_WIRING_MISSING: CLAUDE.md has drifted from SKILL.md')
})

test('the fallback renderers are still documented, not deleted', () => {
  const s = read('pipelines/.claude/skills/yt-script/SKILL.md')
  assert.match(s, /render-outline\.mjs/, 'DESK_WIRING_MISSING: render-outline.mjs was dropped from the skill')
  assert.match(s, /render-worksheet\.mjs/, 'DESK_WIRING_MISSING: render-worksheet.mjs was dropped from the skill')
})

test('the app is registered in the local dashboard', () => {
  const apps = JSON.parse(read('tooling/cli/local-apps-dashboard/apps.json'))
  const entry = apps.find((a) => a.id === 'script-desk')
  assert.ok(entry, 'DESK_WIRING_MISSING: no script-desk entry in apps.json')
  assert.equal(entry.cwd, 'apps/yt-script-desk')
  const ports = apps.flatMap((a) => a.ports || (a.port ? [a.port] : []))
  assert.equal(new Set(ports).size, ports.length, 'DESK_WIRING_MISSING: two dashboard apps share a port')
})

test('the URL is in every inventory surface', () => {
  for (const f of ['my-hosted-sites.md', 'INFRA.md']) {
    assert.ok(read(f).includes(URL), `DESK_URL_MISSING: ${f} does not list ${URL}`)
  }
})

test('the app carries its own docs', () => {
  for (const f of ['apps/yt-script-desk/README.md', 'apps/yt-script-desk/CLAUDE.md']) {
    assert.ok(read(f).split('\n').length > 25, `DESK_WIRING_MISSING: ${f} is still a stub`)
  }
})
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs` → `fail 0`.

### Step 8: Prove the gate fires and run everything

```bash
perl -0pi -e "s#https://script-desk\.agrolloo\.com#https://example.invalid#g" my-hosted-sites.md
cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs 2>&1 | grep -c DESK_URL_MISSING
```
→ greater than 0, exit non-zero. Revert with `git checkout my-hosted-sites.md`, then run everything:

```bash
cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs test/beats.test.mjs test/worksheet.test.mjs
./scripts/check-skill-descriptions.sh
cd apps/yt-script-desk && npm run typecheck && npm test
```

**Verify**: all exit 0. And `cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs 2>&1 | grep -cE 'DESK_URL_MISSING|DESK_WIRING_MISSING'` → `0` on a passing run.

### Step 9: Fresh-tree check

This is the last plan in the batch, so verify on a pristine tree:

```bash
git clean -xdn apps/yt-script-desk pipelines/youtube/yt-script
cd apps/yt-script-desk && rm -rf node_modules dist && npm install && npm run typecheck && npm run lint && npm test && npm run build
cd ../.. && bash scripts/check-apps.sh
```

**Verify**: nothing tracked would be cleaned; every command exits 0. `scripts/check-apps.sh` discovers the new app automatically because it walks `apps/*/package.json` — confirm `yt-script-desk` appears in its summary.

## Test plan

Six new assertions-groups in `test/desk-docs.test.mjs` pin every wiring point: both skill documents, the fallback renderers still being documented, the dashboard entry and its port uniqueness, the URL in both inventory surfaces, and the app's own docs being real rather than stubs. Boss's mutation removes the URL from `my-hosted-sites.md` and the gate must fail with `DESK_URL_MISSING`.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script && node --test test/desk-docs.test.mjs test/beats.test.mjs test/worksheet.test.mjs` exits 0, `fail 0`.
- [ ] `./scripts/check-skill-descriptions.sh` exits 0.
- [ ] `node -e "JSON.parse(require('fs').readFileSync('tooling/cli/local-apps-dashboard/apps.json','utf8'))"` exits 0.
- [ ] `grep -c 'script-desk.agrolloo.com' my-hosted-sites.md` and the same for `INFRA.md` both return `1`.
- [ ] `cd apps/yt-script-desk && npm run typecheck && npm test` exits 0.
- [ ] `bash scripts/check-apps.sh` exits 0 and lists `yt-script-desk`.
- [ ] `git status --porcelain decisions.md` is empty — you did not touch it.
- [ ] `ls pipelines/youtube/yt-script/render-worksheet.mjs pipelines/youtube/yt-script/render-outline.mjs` both exist.
- [ ] The Step 8 mutation makes the docs gate fail with `DESK_URL_MISSING`, and reverting makes it pass.

## STOP conditions

- **You are about to delete or deprecate `render-worksheet.mjs`, `render-outline.mjs` or `render-script.mjs`.** They are the fallback until the owner retires them. Stop.
- **You are about to edit `decisions.md`.** Executors never write it; the orchestrator appends after landing. Stop.
- **You are about to edit the symlink at `.claude/skills/yt-script`** rather than the source at `pipelines/.claude/skills/yt-script/`. Stop.
- **If a gate assertion fails, fix the code or the fixture; weakening, swapping, or deleting the assertion is a STOP.**
- `check-skill-descriptions.sh` fails because your edit grew the `yt-script` description past the cap. Shorten the description; do not raise the cap.
- Port 5175 or 4327 is already taken by another dashboard entry. Stop and report rather than picking a different port silently — the ports are baked into `vite.config.ts` and `server/local.mjs` from plan 232.
- `INFRA.md`'s table shape does not match what this plan describes. Read the file and match what is there; do not invent a new table.

## Maintenance notes

- `test/desk-docs.test.mjs` is the anti-rot gate for this wiring. If a future plan moves the desk or renames the domain, that test tells you every place to update.
- SKILL.md and `pipelines/youtube/yt-script/CLAUDE.md` deliberately duplicate their operating text; the second test in the docs gate is what keeps them honest.
- The PDF path is still live. The decision to retire it belongs to the owner after the desk has carried one real video end to end.
- After this lands, the orchestrator appends the decisions.md entry covering: the two-track split, instructions never entering the script track, body SAY drafts becoming `Angle`, files-upstream/D1-a-copy, and the confirm-only (no reason field) edit gate.
