# Plan 008: Dissolve the `ty/` theme-folder into the by-kind structure (one brain)

> **Executor instructions**: This is a repository restructure that moves folders
> with internal AND external references. Work in the **stages** below **in
> order**, and **commit after each stage** (so any failure rolls back cleanly
> with `git reset --hard HEAD~1`). Run every **Verify** command and confirm its
> expected result before continuing. If anything in a stage's STOP conditions
> occurs, stop and report — do NOT improvise a workaround, and do NOT continue
> to the next stage. Do NOT push. When done, update the row in `plans/README.md`.
>
> **Drift check (run first)**: `git status --short` must be clean, and
> `git log --oneline -1` should be at or after `e88931b` (plans 001–007 landed).
> If the working tree is dirty, STOP — this plan needs a clean base for
> stage-by-stage rollback.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED-HIGH (folder moves with external touchpoints; mitigated by staged commits + git rollback)
- **Depends on**: plans 001–007 landed (they did — commit `e88931b`)
- **Category**: tech-debt / migration
- **Planned at**: commit `e88931b` (or later clean HEAD), 2026-07-04

## Why this matters

`ty/` is the one top-level folder organized by **origin/theme** ("my old TY
repo, ≈ money-making") while every other bucket (`apps/`, `tooling/`, `infra/`,
`learning/`) is organized by **kind of artifact**. That mismatch is why the repo
feels two-brained: `ty/` carries its own `docs/`, its own `decisions.md`, and
its own "Find it fast" routing map — a whole parallel scaffold an agent must
know to look in. The theme boundary also cuts *through* domains (the YouTube
business spans `apps/tracker-app` + `apps/analytics-app` AND `ty/youtube` +
`ty/workers/redirector`), so "where does X live?" has two answers. This plan
collapses the two brains into one: one routing map, one `decisions.md`, one
`docs/`, deployables next to their peers in `apps/`, and a meaningfully-named
workspace for the shared-Python code. The business/money lens is preserved — it
moves to `context/bets.md` (scaffolded in Plan 007), where a *view* belongs,
so the folder tree can stay by-kind.

## Current state (facts you must rely on)

**The Python workspace is anchored, so it moves as one unit.**
`ty/common/env.py` resolves config from the folder **above** `common/`:

```python
PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
MYPROJ_ROOT = os.path.abspath(os.path.join(PACKAGE_DIR, ".."))
load_dotenv(dotenv_path=os.path.join(MYPROJ_ROOT, ".env"))
```

So every Python script uses `from common.sheets import …` and relies on
`common/`'s parent holding `.env`, `credentials.json`, `requirements.txt`, the
`venv/`, `.npmrc`, and `.gitignore`. **As long as the whole `ty/` directory is
renamed atomically, nothing inside breaks** — `common/` keeps the same parent.

**`ty/` top-level entries** (verified): `CLAUDE.md`, `SETUP.md`, `decisions.md`,
`skills-lock.json`, `.env`, `.env.example`, `credentials.json`, `requirements.txt`,
`.npmrc`, `.gitignore`, `common/`, `youtube/`, `video-voice/`, `pinterest/`,
`ai-video-production/`, `hyperframes-vs-remotion/`, `yt-visuals-hyperframe/`,
`workers/`, `income-analysis/`, `bank-statement-parser/`, `big-comparison-util/`,
`channel ideas/`, `upwork-hiring/`, `to-do/`, `docs/`, plus `yt-workflow.md`.

**The two deployables to extract (no Python, no `common.*` import — verified: `find ty/workers/redirector ty/pinterest/landing-pages -name '*.py'` returns nothing):**
- `ty/workers/redirector/` — Cloudflare Worker for `go.agrolloo.com` (Node, own `package.json`). **Note:** `sync_clicks.py` is NOT here — it lives in `ty/youtube/yt-analysis/sync_clicks.py`, imports `common.*`, and therefore **stays in the workspace** (moves only via the Stage 1 rename). The root `README.md` line claiming the redirector "holds sync_clicks.py" is wrong; INFRA.md/SETUP.md have the correct path. Fix that README line in Stage 3.
- `ty/pinterest/landing-pages/` — the keto + bridebestie funnel Workers (Node).

**Every external reference into `ty/` (the complete fix list):**
- `apps/analytics-app/README.md:48` and `apps/analytics-app/CLAUDE.md:62` — `--file=../../ty/workers/redirector/migrations/0001_init.sql`
- `apps/analytics-app/CLAUDE.md:5,34,38` — prose pointing at `ty/workers/redirector/` and `ty/youtube/yt-analysis/`
- `apps/tracker-app/CLAUDE.md:170` — `--file=../../ty/workers/redirector/migrations/0001_init.sql` and prose "redirector in `ty/workers/redirector/`"
- `apps/hyperframes-render/CLAUDE.md` and `README.md` — Templates tab reads cards from `ty/yt-visuals-hyperframe/` (VPS mount via `CARDS_DIR`)
- Root `CLAUDE.md:25-28` — the `ty/` routing rows; `README.md:47` — the "Related" section
- Pinterest skills with **hardcoded absolute paths** (these are the single source; editing here is correct):
  - `tooling/claude-skills/pinterest-make-post/SKILL.md` lines 18, 28, 111, 143, 251 — `~/codebase/personal-stuff/ty/pinterest/...` and `TY/pinterest/...`
  - `tooling/claude-skills/pinterest-analyze/SKILL.md` lines 15, 37, 58 — same
  - `tooling/claude-skills/pinterest-research/niche-scan.mjs:16` — **stale** `codebase/TY/pinterest/.auth/...` (pre-merge path — fix to the new one)
- `tooling/claude-skills/github-router/SKILL.md` lines 19, 26, 37, 150 — path rule mapping `/Users/kbtg/codebase/personal-stuff/ty` to the **YT** git identity (`akshatparty17@gmail.com`). Post-merge this is a single repo with one remote (`github.com/akshat-git-jpg/personal-stuff`); the `ty` path rule must be updated to the new workspace path (see Stage 5).

**Two brains to merge:** `ty/decisions.md` (11 lines) into root `decisions.md`;
`ty/docs/` (`research/`, `specs/`, `superpowers/`, 3 workflow `.md` files, `plans/`)
into root `docs/`; `ty/CLAUDE.md`'s "Find it fast" map — the root map becomes the
single entry point, and the renamed workspace's `CLAUDE.md` becomes just its
*operating guide* (folder map of what's inside), not a parallel router.

**Two `skills-lock.json`** exist (root + `ty/`). Reconcile in Stage 4.

**Keep scoped config as-is:** the workspace's own `.npmrc` and `.gitignore` are
legitimate scoped config (apps/ use local `.npmrc` too) — they are NOT part of
the "two-brain" problem. Do not merge them into root; they move with the rename.

## Step 0 — Choose the workspace name (do this first, once)

The renamed workspace default is **`pipelines/`** (emphasizes its by-kind nature:
content/automation pipelines + the data they read/write, sharing one Python
runtime). If you prefer a different name, set it here and use it everywhere
below. This plan writes `WS` to mean the chosen name.

```
WS=pipelines
```

Everywhere the plan says `WS/`, use your chosen value. (Naming trade-off already
decided by the owner; do not re-litigate — just apply `WS`.)

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Clean base check | `git status --short` | empty |
| Python smoke (workspace intact) | `cd WS && python3 -c "import sys; sys.path.insert(0,'.'); import common"` (with venv if present) | no ImportError |
| Full stale-ref sweep | `grep -rIn "ty/workers\|ty/pinterest\|ty/yt-visuals\|ty/youtube\|ty/video-voice\|ty/common\|ty/income\|codebase/TY\|personal-stuff/ty" . \| grep -v node_modules \| grep -v '\.git/' \| grep -v '^\./plans/'` | empty when done |
| Rollback a bad stage | `git reset --hard HEAD~1` | working tree returns to prior stage |

## Scope

**In scope**: `git mv` of `ty/` and the two extracted deployables; edits to the
reference list above; merging `decisions.md` + `docs/` + routing maps; the
duplicate `skills-lock.json`; `scripts/README.md` external-touchpoints section;
`context/` if it points at `ty/`.

**Out of scope** (do NOT do):
- Reorganizing the **content** folders inside the workspace (youtube, video-voice,
  ai-video-production, pinterest data, income-analysis, bank-statement-parser,
  hyperframes-vs-remotion, channel ideas, upwork-hiring, to-do, big-comparison-util).
  They stay where they are inside `WS/`; the workspace CLAUDE.md maps them. A later
  pass can refine internal layout — not this plan.
- Any source-code behavior change. This is moves + reference fixes only.
- Rewriting git history. Use `git mv` (preserves history) — never delete-and-recreate.
- Changing the actual git remote or running `git config` identity changes (Stage 5 only *documents* the identity collapse in github-router).
- Touching the VPS. External VPS path changes are the owner's manual follow-up (Stage 5 lists them; do not attempt them).

## Git workflow

- Branch: `advisor/008-dissolve-ty`
- **Commit after every stage** with a conventional message (`refactor(repo): …`),
  no AI footers. This is the rollback granularity — do not batch stages.
- Do NOT push.

---

## Stage 1 — Rename the workspace atomically

```bash
git mv ty WS            # e.g. git mv ty pipelines
```

Then immediately smoke-test the Python workspace is intact (nothing should have
moved *relative to* `common/`):

```bash
cd WS && python3 -c "import sys; sys.path.insert(0,'.'); import common" && cd ..
```

If the workspace has a `venv/`, activate it first
(`source WS/venv/bin/activate`) and re-run so the real interpreter is used.
Also confirm one Node subproject still resolves its config:
`ls WS/workers/redirector/package.json WS/.npmrc`.

**Verify**: the import prints no `ImportError` / no traceback; `git status`
shows the rename as renames (R), not delete+add.

**STOP if**: the `import common` raises `FileNotFoundError` for `.env` or
`ModuleNotFoundError` — the anchor assumption is wrong; roll back and report.

**Commit**: `refactor(repo): rename ty/ workspace to WS/`

## Stage 2 — Fix every reference from `ty/` to `WS/`

Run the full stale-ref sweep (see Commands) to get the live hit list, then fix
each. The known set:

1. `apps/analytics-app/README.md`, `apps/analytics-app/CLAUDE.md`,
   `apps/tracker-app/CLAUDE.md` — replace `ty/workers/redirector` →
   `WS/workers/redirector` and `ty/youtube/yt-analysis` → `WS/youtube/yt-analysis`.
   (These become `apps/` → `apps/` in Stage 3 for the redirector; for now just
   rename `ty`→`WS`; Stage 3 rewrites the redirector path again.)
2. `apps/hyperframes-render/CLAUDE.md` + `README.md` — `ty/yt-visuals-hyperframe/` → `WS/yt-visuals-hyperframe/`.
3. Root `CLAUDE.md` and `README.md` — rename the `ty/` routing rows / prose to `WS/` (they get rewritten in Stage 4; the rename keeps them valid meanwhile).
4. Pinterest skills — `pinterest-make-post/SKILL.md`, `pinterest-analyze/SKILL.md`:
   replace `personal-stuff/ty/pinterest` → `personal-stuff/WS/pinterest` and any
   `TY/pinterest` → `WS/pinterest`.
5. `pinterest-research/niche-scan.mjs:16` — the **stale** `codebase/TY/pinterest/.auth/...`
   becomes `codebase/personal-stuff/WS/pinterest/.auth/...` (fix the pre-merge path too).
6. Any other hit the sweep surfaces (context/ files, my-hosted-sites.md, INFRA.md).

Do NOT touch `github-router/SKILL.md` yet (Stage 5) or references that live
*inside* `WS/` pointing at their own siblings (those are already correct after
the atomic rename — verify a couple, don't mass-edit them).

**Verify**: re-run the sweep → the only remaining `ty`-ish hits are inside
`WS/`'s own historical `decisions.md` entries and `github-router` (both handled
later). No `apps/`, root doc, or pinterest-skill hit remains.

**STOP if**: the sweep shows a reference in a file type you didn't expect (e.g. a
`.toml`/`.jsonc` wrangler config hardcoding a `ty/` path) — report it; a broken
wrangler path is a deploy landmine.

**Commit**: `refactor(repo): repoint external references ty/ -> WS/`

## Stage 3 — Extract the two deployables into `apps/`

```bash
git mv WS/workers/redirector apps/redirector
git mv WS/pinterest/landing-pages apps/pinterest-landing-pages
```

Then:
- Give each moved Worker a local `.npmrc` pinning the public registry if it
  doesn't already have one (copy `WS/.npmrc`, or match the pattern in
  `apps/tracker-app/.npmrc`) — the moved subprojects no longer inherit `WS/.npmrc`.
- If `WS/workers/` is now empty, remove the empty dir.
- Rewrite the redirector-path references (now `apps/redirector/`):
  - `apps/analytics-app/README.md`, `apps/analytics-app/CLAUDE.md`,
    `apps/tracker-app/CLAUDE.md`: the seed command path
    `../../WS/workers/redirector/migrations/0001_init.sql` becomes
    `../redirector/migrations/0001_init.sql` (sibling in `apps/`). Fix the prose
    "redirector in `WS/workers/redirector/`" → "redirector in `apps/redirector/`".
- Update root `README.md` app list + `my-hosted-sites.md` to list `apps/redirector`
  and `apps/pinterest-landing-pages` as apps.

**Verify**:
- `ls apps/redirector/package.json apps/pinterest-landing-pages/` → exist.
- `[ -f apps/redirector/migrations/0001_init.sql ] && echo OK` → OK.
- Sweep for the old inner path: `grep -rIn "WS/workers/redirector\|WS/pinterest/landing" . | grep -v '\.git/'` → empty.

**STOP if**: `WS/pinterest/landing-pages` contains a Python file importing
`common.*` (would break on the move) — the earlier check said none exists;
if the move surfaces one, report and roll back Stage 3.

**Commit**: `refactor(repo): move redirector + pinterest landing-pages into apps/`

## Stage 4 — Merge the two brains into one

1. **decisions.md**: append `WS/decisions.md`'s entries into the root
   `decisions.md` under `## Decisions` (keep newest-first ordering; preserve each
   original date — do NOT re-date them). Add a heading comment if helpful, then
   `git rm WS/decisions.md`.
2. **docs/**: `git mv` the contents of `WS/docs/` into root `docs/`, merging by
   topic — `WS/docs/research/` → `docs/research/`, `WS/docs/specs/` → `docs/specs/`,
   `WS/docs/superpowers/` → merge into `docs/superpowers/`, the workflow `.md`
   files → `docs/`. On any name collision, keep both (prefix the ty-origin one
   with its topic) and note it in your report. Update `docs/README.md` to describe
   the now-merged contents. Remove the empty `WS/docs/`.
3. **Routing maps**: root `CLAUDE.md` is the single "Find it fast" entry point.
   Replace its several `ty/` rows with by-kind rows into `WS/`:
   - `| YouTube / Pinterest / video / income business projects (Python workspace) | WS/CLAUDE.md |`
   - keep the specific sub-rows (youtube/video-voice/income) but point at `WS/...`.
   Then edit the renamed `WS/CLAUDE.md`: strip its "Find it fast / route by intent"
   framing so it's no longer a *parallel router*; keep it as the **workspace
   operating guide** — the folder map of what's inside `WS/`, the Python
   `common/`+venv+`.env` setup notes, and its project-structure rules. It should
   read as "how to work inside this workspace," not "how to route the whole repo."
4. **skills-lock.json**: compare root and `WS/skills-lock.json`
   (`diff skills-lock.json WS/skills-lock.json`). If identical or the WS one is a
   subset, `git rm WS/skills-lock.json`. If they differ meaningfully, report the
   diff and keep both — do not silently drop pins.
5. **context/**: if any `context/` file (from Plan 007) references `ty/`, repoint
   to `WS/`; ensure `context/bets.md` names the business projects by their new
   `WS/...` paths (this is where the money-making lens now lives).

**Verify**:
- `[ ! -f WS/decisions.md ] && grep -c "2026-" decisions.md` → the root log gained the ty entries.
- `[ ! -d WS/docs ] || ls WS/docs` → empty/gone.
- `grep -n "Find it fast" WS/CLAUDE.md` → no match (it's no longer a router).
- Root `CLAUDE.md` has a `WS/` workspace row.

**STOP if**: merging `docs/superpowers/` would overwrite a differently-authored
file with the same name — keep both, report; never clobber a spec.

**Commit**: `refactor(repo): merge ty decisions/docs/routing into the single root brain`

## Stage 5 — External touchpoints + identity

1. **github-router** (`tooling/claude-skills/github-router/SKILL.md` lines 19,
   26, 37, 150): the repo is now a single remote
   (`akshat-git-jpg/personal-stuff`). Update or remove the `…/personal-stuff/ty`
   path rule. Decision: since it's one repo/one remote, the whole
   `personal-stuff/` tree should route to ONE identity. Update the rule so
   `personal-stuff/WS` (and everything under `personal-stuff/`) maps to the same
   account as the rest of the repo, and delete the now-meaningless `ty`-specific
   YT-account carve-out. Note the change in your report so the owner can confirm
   which identity they want (the repo's current `git config user.email` is
   `akshatparty17@gmail.com`).
2. **scripts/README.md** "External touchpoints" section: add a line that
   `WS/` was formerly `ty/`, so anything hardcoding the old path (the VPS clone,
   any launchd/cron on the Mac) must be updated by hand.
3. **Downstream plans handle the rest — do NOT try to do them here:**
   - The **internal reorganization** of the workspace content (grouping video
     work, archiving superseded folders, de-spacing `channel ideas/`) is **Plan
     009** — runs after this one. Leave the content folders where the rename put them.
   - The **VPS migration** (fixing the `hyperframes-render` card mount, retiring
     the orphaned standalone `TY` clone, redeploying render2) is **Plan 010** —
     an SSH runbook that runs after 009 is merged and pushed. Do not SSH the VPS
     from this plan.
   - Note in your report any `~/.zshrc` / Mac shell alias referencing `ty/` you
     can see (per `scripts/README.md`), for the owner to update.

**Verify**: `grep -rIn "personal-stuff/ty\b\|codebase/TY" tooling/claude-skills/github-router/` → no stale live rule remains.

**Commit**: `refactor(repo): update github-router + external-touchpoint docs for WS/`

## Stage 6 — Final sweep, decisions log, index

1. Full stale-ref sweep (Commands table) → must be empty except intentional
   historical mentions inside `decisions.md`.
2. Link check the root map: every `WS/...` and `apps/...` path in `CLAUDE.md`
   resolves (`grep -oE '\]\(([^)]+)\)' CLAUDE.md | sed 's/.*(\(.*\))/\1/' | grep -v '^http' | while read p; do [ -e "$p" ] || echo "DEAD: $p"; done`).
3. Append to root `decisions.md`:
   `2026-07-04 — dissolved the ty/ theme-folder: renamed to WS/ (the shared-Python content/automation workspace, anchored by common/env.py), extracted the redirector + pinterest landing-pages Workers into apps/, and merged ty's decisions/docs/routing into the single root brain — ty/ was the only origin/theme-grouped bucket and forced a two-brain repo; the money-making lens now lives in context/bets.md, not the tree.`
4. Update `plans/README.md`: set 008 to DONE.

**Verify**: sweep empty; link check prints no `DEAD:`; `git status` clean after
final commit.

**Commit**: `refactor(repo): finalize ty/ dissolution — sweep, decisions, index`

## Test plan

No app behavior changes, so verification is structural + smoke:
- The Stage 1 `import common` smoke (workspace intact) — the single most
  important check; re-run it once more at the end.
- If a `WS/` Python entrypoint has a cheap dry command (e.g. `--help`), run one
  from the repo root with the venv active to confirm `from common.*` still resolves.
- `ls apps/redirector apps/pinterest-landing-pages` and confirm each has its
  `wrangler.*` config (deploy is owner-manual; do not deploy).
- Full stale-ref sweep returns empty.

## Done criteria

- [ ] `ty/` no longer exists; `WS/` exists with `common/`, `.env`, `credentials.json`, `requirements.txt` at its root
- [ ] `import common` smoke passes (venv-active)
- [ ] `apps/redirector/` and `apps/pinterest-landing-pages/` exist with their own `.npmrc` + wrangler config
- [ ] Seed-path refs in analytics-app/tracker-app point at `../redirector/migrations/…`
- [ ] One `decisions.md`, one `docs/`, one "Find it fast" map (root); `WS/CLAUDE.md` is an operating guide, not a router
- [ ] Duplicate `skills-lock.json` reconciled
- [ ] Pinterest skills + github-router repointed; no `codebase/TY` or `personal-stuff/ty` live refs
- [ ] Full stale-ref sweep empty; root map link-check clean
- [ ] Six stage commits present; nothing pushed; decisions.md + plans/README.md updated
- [ ] Report lists the owner's VPS/shell follow-ups and the github identity note

## STOP conditions

Stop and report (do not improvise) if:
- Stage 1's `import common` fails — the workspace anchor assumption is wrong.
- The sweep finds a `ty/` path inside a wrangler `.toml`/`.jsonc` or a `package.json` script (deploy-critical) — report before editing.
- Extracting a deployable surfaces a Python file importing `common.*`.
- A `docs/` merge would clobber a differently-authored file.
- The two `skills-lock.json` differ in a way that isn't a clean subset.
- Any stage's Verify fails twice after one reasonable fix attempt — roll back that stage (`git reset --hard HEAD~1`) and report.

## Maintenance notes

- **The internal layout of `WS/` is deliberately left as-is** — a future plan can
  refine it (e.g. group the content-production projects), but that's separate and
  not worth bundling into this risky move.
- After this lands, the owner's `/audit-repo-route` skill should be re-run to
  catch any routing drift the sweep missed.
- **Owner manual follow-ups** (from Stage 5): update the VPS `CARDS_DIR` mount,
  any cron paths to `apps/redirector/`, and shell aliases; confirm the intended
  single git identity for the whole repo.
- Reviewer should scrutinize: the Stage 3 seed-path rewrites (a wrong relative
  path silently breaks local D1 seeding) and the Stage 4 routing rewrite (root
  map must reach everything `ty/`'s map used to).
- `context/bets.md` is now the home of the money-making view — keep it current
  as bets start/stop, so the tree never needs a theme folder again.
