# Plan 002: Make the routing map reach everything and kill every stale path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- CLAUDE.md README.md ty/CLAUDE.md apps/tracker-app/CLAUDE.md docs/README.md decisions.md my-hosted-sites.md`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live files before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / docs
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

This repo's agent-navigation convention is a root `CLAUDE.md` "Find it fast"
intent table that routes questions to folders, each of which has its own
`CLAUDE.md`/README. The owner's #1 complaint is that Claude is slow to find
context. The audit found why: the map **cannot reach `ty/`** (885 tracked
files, the repo's largest tree, merged in 2026-06-30 via git subtree), several
map targets are **dead or stale** (paths pointing at the pre-merge sibling repo
`../../../TY/`, an empty `ty/to-do/`, a nonexistent `docs/research/`), and
three apps have no `CLAUDE.md` at all. Agents that follow a map into a dead end
fall back to grepping an ~18GB working tree. Fixing the map is the cheapest,
highest-leverage fix for navigation speed.

**Decided (by the advisor, owner delegated the call): `ty/` remains a
self-governing subtree.** It keeps its own `CLAUDE.md`, `docs/`, and
`decisions.md`. Rationale: every external toucher (VPS crons pulling this repo,
skill symlinks, hardcoded paths listed in `scripts/README.md`) keys on current
paths, so physical moves are high-risk/low-benefit; the win comes from making
the root map *delegate* into `ty/` explicitly. The placement rule to encode:
**`apps/` = personal products, `ty/` = money-making/business projects,
`tooling/` = the Claude/agent surface.** Deployable Cloudflare Workers live
with their *domain*, not their tech (that's why `ty/workers/redirector/` stays
put).

## Current state

Files to change, each with its role:

- `/CLAUDE.md` — root router. Its "Find it fast" table's ONLY `ty/` row is
  `| Pinterest pin data / landing pages | ty/pinterest/ |`. No row for `docs/`,
  no row for ty's YouTube/video/income trees. Its apps row reads
  `| A specific app (gym, docs, analytics, tracker, dashboard, telegram planner/email) | apps/<name>/ |`
  — missing founders-tracker, lists-app, kushal-tools, hyperframes-render,
  spending-tracker, and "docs" there ambiguously means the kushal-docs app.
- `/README.md` — the "Related" section mentions only Pinterest under `ty/`.
- `/ty/CLAUDE.md` — ty's own router. Three problems:
  1. Rows routing to `to-do/todolist.md` and `to-do/CLAUDE.md` — but `ty/to-do/`
     is an **empty directory** (both targets missing).
  2. "Getting started" says `cd /Users/kbtg/codebase/TY` — the pre-merge path;
     the tree now lives at `<repo-root>/ty/`.
  3. It's otherwise good — keep its structure.
- `/apps/tracker-app/CLAUDE.md` — two stale references to the pre-merge sibling
  repo. Line ~170 (Gotchas):
  `npx wrangler d1 execute clicks-db --local --file=../../../TY/workers/redirector/migrations/0001_init.sql`
  (the path `../../../TY/` no longer exists — correct is `../../ty/`), plus the
  prose "in the sibling TY repo at `TY/workers/redirector`". Line ~181:
  `## Roadmap (from the product audit at ../../../TY/docs/specs/2026-05-29-tracker-product-audit.md in the sibling TY repo)`.
- `/docs/README.md` — full current content:

  ```markdown
  # docs

  Notes that aren't tied to a single project: research write-ups and design specs.

  - `research/` — repo/tooling research findings. (Business and income-strategy research now lives in `TY/docs/research/`.)
  - `superpowers/specs/` — dated design specs for things built in this repo (e.g. the RapidAPI research CLI). The bank-statement-parser spec moved to `TY/docs/specs/` with the app.
  ```

  `docs/research/` does not exist; `TY/docs/...` should read `ty/docs/...`.
  Actual contents of `docs/`: `superpowers/{plans,specs}/`, four loose handoff/plan
  `.md` files, and a 3.3GB untracked `voice-pipeline-test/` (handled by Plan 003 — ignore it here).
- `apps/founders-tracker/`, `apps/lists-app/`, `apps/spending-tracker/` — have
  READMEs but **no CLAUDE.md**, breaking the repo convention ("a folder's
  README orients a human; its CLAUDE.md tells Claude how to operate there").
- `/my-hosted-sites.md` — flat index of every live URL (931 bytes). Verify
  completeness in Step 6.
- `/decisions.md` — append-only log, format `YYYY-MM-DD — <decision> — <why>`.

Exemplars for the new CLAUDE.md files — match this shape (terse operational
guardrails, run/deploy, gotchas; NOT a prose README duplicate):

- `apps/personal-dashboard/CLAUDE.md` — sections: `## Guardrails`, `## Run / deploy`, gotcha lines.
- `apps/hyperframes-render/CLAUDE.md` — same shape.

Facts for the new CLAUDE.md files (from the root README and app READMEs — verify against each app's README/wrangler config as you write):

- **founders-tracker**: shared action-item tracker at `founders.agrolloo.com`. Vite+React+Hono Cloudflare Worker, D1 (`founders-db`), shared-PIN gate, daily Cron Trigger materializes recurring tasks. package.json scripts: `build, db:local, db:remote, deploy, dev, preview`.
- **lists-app**: PIN-gated plain-text lists at `lists.agrolloo.com`. Worker + D1. Auth is a stateless HMAC-SHA256 signed cookie (documented decision, `decisions.md` 2026-07-01 — do not "upgrade" it to OAuth). Scripts: `build, db:local, db:remote, deploy, dev, dev:api, dev:local, dev:web, lint, preview, seed:local`.
- **spending-tracker**: design notes only, nothing built. Its CLAUDE.md is a 3-line stub saying exactly that and pointing at `README.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Link check (run from repo root) | see Step 7 script | `ALL OK` |
| Stale-path sweep | `grep -rn '\.\./TY/\|codebase/TY\|sibling TY' --include='*.md' . \| grep -v node_modules \| grep -v '^./plans/'` | no output when done |

## Scope

**In scope** (the only files you should modify/create/delete):
- `/CLAUDE.md`, `/README.md`, `/ty/CLAUDE.md`, `/apps/tracker-app/CLAUDE.md`, `/docs/README.md`, `/my-hosted-sites.md`, `/decisions.md`
- Create: `apps/founders-tracker/CLAUDE.md`, `apps/lists-app/CLAUDE.md`, `apps/spending-tracker/CLAUDE.md`
- Create: `ty/to-do/todolist.md` (stub) — see Step 3
- Any other tracked `*.md` whose only change is fixing a `../../../TY/` / `codebase/TY` stale path found by the Step 7 sweep

**Out of scope** (do NOT touch):
- Any source code, wrangler.toml, package.json — this is a docs/routing plan.
- `ty/` content beyond `ty/CLAUDE.md` (its internal sub-maps are fine).
- Moving/renaming any folder — explicitly rejected (external systems hardcode paths; see `scripts/README.md`).
- `docs/voice-pipeline-test/` — Plan 003's territory.
- The `plans/` directory (except the README status row).

## Git workflow

- Branch: `advisor/002-routing-overhaul`
- Commit style: `docs(routing): <what>` — matches repo history (`git log` shows `docs(routing): fix stale TY-repo references after the ty/ subtree merge`). No AI-attribution footers.
- Do NOT push.

## Steps

### Step 1: Extend the root "Find it fast" table in `/CLAUDE.md`

Add rows (keep the existing table format `| If the ask is about… | Go to |`):

| If the ask is about… | Go to |
|---|---|
| Anything business / money-making (YouTube pipelines, Pinterest business, video production, income tracking, short links) | [`ty/CLAUDE.md`](ty/CLAUDE.md) — ty/ is a self-governing subtree with its own map, docs, and decisions.md |
| YouTube research / scripts / tutorial pipeline | `ty/youtube/` (via [`ty/CLAUDE.md`](ty/CLAUDE.md)) |
| Voiceover / TTS / RVC / HeyGen avatar pipelines | `ty/video-voice/` |
| Income tracking across platforms | `ty/income-analysis/` |
| Cross-project research notes, design specs, handoff docs | [`docs/`](docs/README.md) |
| Implementation plans for executor agents | [`plans/README.md`](plans/README.md) |

And REPLACE the existing apps row with:

`| A specific app | apps/<name>/ — full list in the README map below; every app folder has its own CLAUDE.md |`

Also update the last row's phrasing ("only the *skills* live here") if it now
contradicts anything you changed.

Then add a short section after the table (before `## Operating notes` content or at its end):

```markdown
## Where does a new thing go?

- A personal product (app someone uses) → `apps/<kebab-name>/` (+ README.md + CLAUDE.md from day one).
- A business / money-making project → `ty/<name>/` (register it in `ty/CLAUDE.md`'s map).
- A skill, CLI, or MCP for driving work with Claude → `tooling/` (skills need a manifest entry — see `scripts/relink.sh`).
- A deployable Worker lives with its **domain**, not its tech: the go.agrolloo.com redirector serves the business → it stays in `ty/workers/`.
- `ty/` is deliberately self-governing: its own CLAUDE.md, docs/, decisions.md. Root files never duplicate its detail; they delegate.
```

**Verify**: every path referenced in the table exists:
`for p in ty/CLAUDE.md docs/README.md plans/README.md ty/youtube ty/video-voice ty/income-analysis; do [ -e "$p" ] && echo "OK $p" || echo "MISS $p"; done` → all OK.

### Step 2: Update `/README.md`'s "Related" section

Rewrite it to describe `ty/` as the business subtree (YouTube, Pinterest,
video production, income analysis, redirector Worker) with its own guide at
`ty/CLAUDE.md` — not Pinterest-only. Keep it to 3-4 lines.

**Verify**: `grep -n "ty/CLAUDE.md" README.md` → at least one hit.

### Step 3: Fix `ty/CLAUDE.md`

1. The empty `ty/to-do/` — create `ty/to-do/todolist.md` with a 2-line stub:
   `# TY to-do` / `(Empty — the active running lists live in apps/telegram-my-planner/to-do/.)`
   and change the two `ty/CLAUDE.md` rows that point at `to-do/CLAUDE.md` to
   point at `to-do/todolist.md`. (Chosen over deleting the rows because the
   folder-map table also lists `to-do/` and other ty docs may reference it.)
2. Replace the "Getting started" `cd /Users/kbtg/codebase/TY` with
   `cd <repo-root>/ty` phrasing (use a relative instruction, not a
   machine-absolute path).
3. Sweep the rest of the file for `codebase/TY` remnants.

**Verify**: `[ -f ty/to-do/todolist.md ] && ! grep -n "codebase/TY" ty/CLAUDE.md` → file exists, no output from grep.

### Step 4: Fix `apps/tracker-app/CLAUDE.md` stale sibling-repo paths

- Line ~170: `../../../TY/workers/redirector/migrations/0001_init.sql` →
  `../../ty/workers/redirector/migrations/0001_init.sql`, and rewrite the
  "sibling TY repo" prose to "the redirector in `ty/workers/redirector/`
  (same repo)".
- Line ~181 heading: `../../../TY/docs/specs/...` → `../../ty/docs/specs/...`,
  drop "in the sibling TY repo".

**Verify**: `[ -f apps/tracker-app/../../ty/workers/redirector/migrations/0001_init.sql ] && echo OK` → OK
(if the migrations file is at a different name, STOP — find the real one with
`ls ty/workers/redirector/migrations/` and use that, but confirm it's the init schema).

### Step 5: Fix `/docs/README.md` and write the three app CLAUDE.md files

- `docs/README.md`: remove the `research/` bullet (folder doesn't exist), fix
  `TY/docs/...` → `ty/docs/...`, and add bullets for what's actually there:
  `superpowers/plans/`, `superpowers/specs/`, and the loose handoff docs.
- Write `apps/founders-tracker/CLAUDE.md`, `apps/lists-app/CLAUDE.md`,
  `apps/spending-tracker/CLAUDE.md` per the facts in "Current state", matching
  the `apps/personal-dashboard/CLAUDE.md` shape (Guardrails / Run & deploy /
  Gotchas). Before writing each, read that app's `README.md` and `wrangler.*`
  config and fold in: the exact dev/deploy commands from its package.json
  scripts, the D1 database name + binding, and any secret names (NAMES only,
  never values). For lists-app include the guardrail: "auth is a deliberate
  stateless HMAC cookie (decisions.md 2026-07-01) — don't replace it with OAuth/KV."

**Verify**: `for a in founders-tracker lists-app spending-tracker; do [ -f "apps/$a/CLAUDE.md" ] && echo "OK $a"; done` → 3× OK.

### Step 6: Verify `my-hosted-sites.md` covers every live URL

Compare against the app list: kushal-tools, gym, docs, analytics, tracker,
founders, lists, render2, my-dashboard, go.agrolloo.com, pinterest landing
pages. Add any missing row in the file's existing format; change nothing else.

**Verify**: `grep -c "agrolloo.com" my-hosted-sites.md` → count ≥ 10.

### Step 7: Repo-wide stale-path sweep + link check

```bash
grep -rn '\.\./TY/\|codebase/TY\|sibling TY' --include='*.md' . | grep -v node_modules | grep -v '^\./plans/'
```

Fix every hit the same way as Step 4 (mechanical path fix only — if a hit is
inside `ty/` and refers to TY-as-its-own-repo historically (e.g. a dated
decision log entry), leave historical log entries alone; fix only *operative*
instructions). Then run the link check over the root map:

```bash
grep -oE '\]\(([^)]+)\)' CLAUDE.md ty/CLAUDE.md | sed 's/.*(\(.*\))/\1/' | grep -v '^http' | grep -v '^<' | while read -r p; do d=$(dirname "$0"); [ -e "$p" ] || [ -e "ty/$p" ] || echo "DEAD: $p"; done
```

(Links in `ty/CLAUDE.md` are relative to `ty/` — check them from that dir.)

**Verify**: sweep grep → no operative hits; link check → no `DEAD:` lines. Print `ALL OK`.

### Step 8: Record the decisions

Append to `/decisions.md` (newest at top), two lines:

- `2026-07-04 — ty/ stays a self-governing subtree (own CLAUDE.md/docs/decisions.md); root map delegates into it; Workers live with their domain (redirector stays in ty/workers/) — every external toucher (VPS crons, symlinks, scripts/README.md list) hardcodes current paths, so moves are high-risk/low-benefit; discoverability was the actual problem.`
- `2026-07-04 — placement rule: apps/ = personal products, ty/ = money-making projects, tooling/ = agent surface; every new folder gets README.md + CLAUDE.md from day one.`

**Verify**: `head -15 decisions.md` shows both lines above the 2026-07-01 entries.

## Test plan

No code changes — the "tests" are Step 7's two checks plus a manual spot-check:
pick three intents ("work on the lists app", "check my income", "edit a YouTube
script") and confirm the root table routes each to an existing file in ≤ 2 hops.

## Done criteria

- [ ] Step 7 sweep returns no operative stale-path hits; link check prints no `DEAD:`
- [ ] Root table has rows reaching `ty/CLAUDE.md`, `docs/`, and `plans/`
- [ ] 3 new app CLAUDE.md files exist and follow the exemplar shape
- [ ] `ty/to-do/todolist.md` exists; `ty/CLAUDE.md` has no dead to-do links
- [ ] Both decision lines appended
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The root `CLAUDE.md` table format differs from the excerpt (drift since `630ca99`).
- `ty/workers/redirector/migrations/` doesn't contain an init schema file.
- You find yourself wanting to move or rename a folder — that's rejected scope.
- A stale-path hit is ambiguous (can't tell if historical or operative) — list it in your report instead of guessing.

## Maintenance notes

- The owner has an on-demand `/audit-repo-route` skill (personal Claude account)
  that re-checks this map for drift — future drift is its job, not a manual one.
- When Plan 006 lands (orchestrator workflow), the `plans/` row added here becomes load-bearing.
- Reviewer should scrutinize: the new CLAUDE.md files must contain only facts
  verified from each app's own README/config — no invented commands.
