# Plan 007: Scaffold the second-brain context layer (design/spike)

> **Executor instructions**: This is a SCAFFOLD plan — it creates structure and
> seeds it from existing repo content; the deep content comes later from an
> owner interview (out of your scope). Follow the steps, run every
> verification. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- CLAUDE.md apps/telegram-my-planner/to-do/ ty/income-analysis/ my-hosted-sites.md`
> On drift, re-read the affected source before seeding from it.

## Status

- **Priority**: P3
- **Effort**: S (scaffold) — the full layer grows over months by design
- **Risk**: LOW
- **Depends on**: 002 (routing rows exist; if 002 hasn't run, add this plan's row yourself)
- **Category**: direction
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

The repo is strong on *capabilities* (50+ skills, a dozen CLIs) and *cadence*
(VPS crons) but has no *context layer*: who the owner is, what the active
business bets are, what exists and what state it's in. Today that knowledge is
scattered — business ideas as loose lines in
`apps/telegram-my-planner/to-do/{todo,business}.md`, income state in
`ty/income-analysis/`, the app inventory implicit in READMEs — and the owner's
own note says "fix/clean memory. make personal memory". Every Claude session
re-derives this or asks. A small `context/` area makes "answer like a
co-founder, not a stranger" possible and gives agents one place to check
goals before proposing work.

## Current state

Sources to seed from (read each before writing):

- `apps/telegram-my-planner/to-do/todo.md` and `business.md` — raw idea dumps
  (job-switch prep, digital products, SaaS, YouTube video types, "every app I
  use makes me want a customized version", a list of app ideas). **These files
  feed a VPS cron digest — do NOT move, rename, or edit them.** Copy/synthesize only.
- `ty/income-analysis/README.md` — income sources wired (PayPal, impact.com)
  and to-add (Gumroad, Skool); the "why" is one-question income checks.
- `/my-hosted-sites.md` — flat URL index of live products.
- `/README.md` map + `apps/*/README.md` first lines — the product inventory.
- `ty/CLAUDE.md` line 3 — the business framing: "money-making / business
  projects: YouTube, the Pinterest PDF business, monetizable tools".
- Root `CLAUDE.md` — the routing table this layer must be reachable from.

Design decisions (made by the advisor, owner-approved direction):
- Location: **`context/` at repo root** (peer of `docs/`; it's identity/state,
  not research notes).
- Four files to start, no more: `profile.md`, `bets.md`, `inventory.md`,
  `ideas.md`. Resist premature structure — this layer earns depth by use.
- Contents are **pointers + synthesis**, never duplicates of live data (income
  numbers live in `ty/income-analysis/snapshots/`; `bets.md` links there).
- This repo is the owner's personal repo; the layer may hold personal-but-not-secret
  context. **No credentials, no financial account numbers, no third-party PII.**

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Scaffold check | `ls context/` | 5 files (4 content + CLAUDE.md) |
| Route check | `grep -n "context/" CLAUDE.md` | ≥ 1 row |

## Scope

**In scope**:
- Create `context/{CLAUDE.md,profile.md,bets.md,inventory.md,ideas.md}`
- `/CLAUDE.md` — one routing row
- `/decisions.md` — append one line

**Out of scope** (do NOT touch):
- `apps/telegram-my-planner/**` — cron-fed, read-only source.
- `ty/**` — read-only source.
- Claude's account-level memory (`~/.claude-personal/...`) — different layer, different owner.
- Inventing biographical facts. Anything not derivable from the repo gets an
  explicit `<!-- TODO(owner interview) -->` marker instead of a guess.

## Git workflow

- Branch: `advisor/007-context-layer`
- Commit: `feat(context): scaffold second-brain context layer` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the files

- `context/CLAUDE.md` (~10 lines): what this folder is (the second-brain
  context layer — identity, active bets, inventory, idea funnel), the update
  rule ("update `bets.md` when a bet starts/stops; `inventory.md` when
  something ships or dies; keep pointers, not copies"), and the privacy rule
  from Current state.
- `context/profile.md`: skeleton with headers (Who I am / How I work / Tools &
  accounts I drive everything with) — fill ONLY what the repo evidences (e.g.
  dual Claude accounts from `scripts/relink.sh`, VPS + Cloudflare estate from
  `INFRA.md`, working style from CLAUDE.md conventions). Everything else:
  `<!-- TODO(owner interview) -->`.
- `context/bets.md`: one section per active bet, synthesized from the sources —
  YouTube (channel + tutorial pipeline), Pinterest PDF business, affiliate/short-link
  system, monetizable tools (bank-statement-parser → RapidAPI), job-switch prep.
  Per bet: one-line thesis, where it lives (path links), status link (e.g.
  income → `ty/income-analysis/`). No invented numbers.
- `context/inventory.md`: table of every shipped thing — name, URL, path,
  one-line purpose, state (live/paused/design-only) — synthesized from
  `my-hosted-sites.md` + the README map (include `spending-tracker` as
  design-only, `hyperframes-vs-remotion` as superseded).
- `context/ideas.md`: the idea funnel — synthesize the planner to-do dumps into
  grouped, deduplicated lists (app ideas / content ideas / business models),
  each item one line, with a header note: "Source of truth for daily tasks
  stays `apps/telegram-my-planner/to-do/` (cron-fed); this file is the durable
  idea backlog."

**Verify**: `ls context/` → 5 files; `grep -rn "TODO(owner interview)" context/ | wc -l` → ≥ 3 (proves you marked gaps instead of inventing).

### Step 2: Route it

Add to root `CLAUDE.md`'s table:
`| Who I am, active bets, product inventory, idea backlog | context/ (start at context/CLAUDE.md) |`

**Verify**: `grep -n "context/" CLAUDE.md` → the row exists.

### Step 3: Record + hand off the interview

Append to `/decisions.md`:
`2026-07-04 — second-brain context layer scaffolded at context/ (profile/bets/inventory/ideas; pointers not copies; no secrets/PII) — capabilities and cadence existed but identity/goals context did not; sources: planner to-do dumps, income-analysis, hosted-sites index.`

End your report with the list of every `TODO(owner interview)` marker — that
list is the interview agenda the owner runs with Claude later.

**Verify**: `head -8 decisions.md` shows the line.

## Test plan

Docs-only. Acceptance: ask (yourself, reading only `context/`) three questions —
"what is this person betting on right now?", "what have they shipped and what
state is it in?", "what's in the idea backlog for Pinterest?" — each must be
answerable from `context/` in one file-open, with links that resolve.

## Done criteria

- [ ] 5 files under `context/`, all links resolve (`grep -oE '\]\([^)]+\)' context/*.md` targets exist)
- [ ] No copied income numbers / no secrets / no invented facts (TODO markers instead)
- [ ] Routing row present; decisions.md appended
- [ ] Planner to-do files untouched (`git status apps/telegram-my-planner` → clean)
- [ ] `plans/README.md` row updated; interview-agenda list in your report

## STOP conditions

- A source file (planner to-dos, income README) is materially different from
  the Current state description — re-read, and if the business picture is
  unclear, mark more TODOs rather than synthesizing wrongly.
- You feel the need to create more than the 4 content files — premature
  structure; the four-file cap is deliberate.

## Maintenance notes

- The layer only pays off if it stays current: the owner should fold
  "update context/bets.md" into how bets start/stop (a future hook could
  remind, but that's deliberately not scaffolded yet).
- Follow-up (not this plan): the owner runs an interview session with Claude to
  burn down the TODO markers; and optionally a periodic "context freshness"
  check in the existing `/audit-repo-route` skill.
