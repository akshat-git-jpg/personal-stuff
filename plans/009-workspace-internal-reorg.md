# Plan 009: Reorganize the workspace internals by kind (video / tools / notes / archive)

> **Executor instructions**: Runs AFTER Plan 008 (the `ty/ → WS/` dissolution) is
> merged. Work the **stages in order**, **commit after each stage** (rollback
> granularity), run every **Verify**. Honor STOP conditions — do not improvise.
> Do NOT push. Update the row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git status --short` clean, and the workspace
> from Plan 008 must exist (`ls WS/common/env.py` resolves, where `WS` is the
> name chosen in 008 — default `pipelines`). If `ty/` still exists, STOP: run 008 first.

## Status

- **Priority**: P3
- **Effort**: M-L
- **Risk**: MED (folder moves inside the Python workspace; the `video-voice` move is the deep one)
- **Depends on**: 008 (must be merged)
- **Category**: tech-debt / migration
- **Planned at**: commit `e88931b` (or later), 2026-07-04

## Why this matters

Plan 008 renamed `ty/ → WS/` and pulled the deployables out, but deliberately
left the workspace's *internal* layout untouched. Long-term, that internal layout
still has four smells: (1) related video work is scattered across three
top-level folders (`video-voice`, `ai-video-production`, `yt-visuals-hyperframe`);
(2) a superseded experiment (`hyperframes-vs-remotion`, tagged superseded in the
workspace CLAUDE.md) sits next to live projects; (3) tiny note folders
(`channel ideas`, `upwork-hiring`, `to-do`, `big-comparison-util`) clutter the top
level; (4) `channel ideas/` has a **space** in its name, violating the repo's
own "all directory names are hyphenated, no spaces" rule (stated in VPS-CRONS.md).
This plan gives the workspace a clean, durable by-kind internal shape so adding a
new video project or business note has an obvious home, and so the "content
loader" the render2 app mounts (`yt-visuals-hyperframe`) has an unambiguous place.

## Target internal structure

```
WS/
  common/  .env  credentials.json  requirements.txt  venv/  .npmrc  .gitignore   ← workspace root — DO NOT MOVE (common/env.py anchors config to its parent)
  CLAUDE.md  SETUP.md  yt-workflow.md                                            ← workspace guide — keep at root, update the folder map
  youtube/                    ← unchanged (substantial distinct project)
  pinterest/                  ← unchanged (pin data per niche; landing-pages already in apps/ from 008)
  income-analysis/            ← unchanged (distinct project)
  video/                      ← NEW bucket — all video production:
      voice/                  ← was video-voice/        (the deep one — see Stage 3)
      motion-graphics/        ← was ai-video-production/
      card-library/           ← was yt-visuals-hyperframe/  (the "content loader" render2 mounts — Plan 010 fixes the mount)
  tools/                      ← NEW bucket — monetizable/utility tools:
      bank-statement-parser/  ← was bank-statement-parser/
      big-comparison-util/    ← was big-comparison-util/
  notes/                      ← NEW bucket — small business notes:
      channel-ideas/          ← was "channel ideas/"   (de-spaced)
      upwork-hiring/          ← was upwork-hiring/
      to-do/                  ← was to-do/
  archive/                    ← NEW — superseded work, kept for reference:
      hyperframes-vs-remotion/  ← was hyperframes-vs-remotion/ (superseded per WS/CLAUDE.md)
```

**Placement rationale (do not re-litigate):** `youtube`, `pinterest`,
`income-analysis` stay top-level because they're large, live, distinct domains.
Everything else groups by kind. `video-voice` becomes `video/voice` even though
it's the highest-churn move, because leaving it out would defeat the grouping —
but its move gets its own careful stage.

## Current state (facts)

- Content folders and sizes (verified): `video-voice/` 582 files (222 `.py`,
  heavy) · `ai-video-production/` 182 · `yt-visuals-hyperframe/` 48 (HTML cards)
  · `hyperframes-vs-remotion/` 111 (superseded; its tracked media was untracked
  by Plan 003) · `bank-statement-parser/` 16 · the rest tiny.
- **`video-voice` has out-of-repo path indirection from Plan 003**: heavy model/
  output dirs were moved to `~/kb-scratch/video-voice/…` and scripts read them via
  env vars defaulting to that path (e.g. `os.environ.get("VV_MODELS_DIR", os.path.expanduser("~/kb-scratch/video-voice/…"))`).
  Those `~/kb-scratch/video-voice/` defaults **do not change** when the in-repo
  folder moves (they point outside the repo), so the move is safe — but verify.
- **`yt-visuals-hyperframe` is mounted by the render2 app** — the mount path is
  handled in Plan 010; this plan only moves the folder and updates in-repo doc refs.
- Reference surface (sweep for each before moving): `apps/hyperframes-render/`
  (CLAUDE.md + README + docker-compose) points at `yt-visuals-hyperframe`; the
  workspace `CLAUDE.md` maps all these folders; pinterest/other skills may mention
  `ai-video-production`/`video-voice` paths.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Clean base | `git status --short` | empty |
| Python smoke | `cd WS && python3 -c "import sys; sys.path.insert(0,'.'); import common"` (venv active if present) | no error |
| Per-folder ref sweep | `grep -rIn "<old-folder>" . \| grep -v node_modules \| grep -v '\.git/' \| grep -v '^\./plans/'` | drives each fix |
| Rollback a stage | `git reset --hard HEAD~1` | reverts the stage |

## Scope

**In scope**: `git mv` of the folders per the target structure; updating every
in-repo reference the sweeps surface; updating `WS/CLAUDE.md`'s folder map; the
`apps/hyperframes-render` doc references to the card library (the *compose mount
path* value is edited here too, but the VPS-side redeploy is Plan 010).

**Out of scope**:
- The workspace root files (`common/`, `.env`, `credentials.json`,
  `requirements.txt`, `venv/`, `.npmrc`, `.gitignore`) — moving them breaks the
  `common/env.py` anchor. Leave them.
- `youtube/`, `pinterest/`, `income-analysis/` internal layout.
- Any code behavior change; any VPS/SSH action (that's Plan 010); pushing.
- Deleting `hyperframes-vs-remotion` — it goes to `archive/`, not the bin.

## Git workflow

- Branch: `advisor/009-workspace-reorg`
- Commit after each stage, `refactor(WS): …`, no AI footers. Do NOT push.

## Stage 1 — The safe, high-value moves (notes, archive, de-space)

```bash
mkdir -p WS/notes WS/archive WS/tools
git mv "WS/channel ideas" WS/notes/channel-ideas      # de-space
git mv WS/upwork-hiring   WS/notes/upwork-hiring
git mv WS/to-do           WS/notes/to-do
git mv WS/big-comparison-util WS/tools/big-comparison-util
git mv WS/hyperframes-vs-remotion WS/archive/hyperframes-vs-remotion
git mv WS/bank-statement-parser   WS/tools/bank-statement-parser
```

Then sweep each moved name and fix in-repo references (the workspace `CLAUDE.md`
map rows, any skill or doc mentioning `to-do/todolist.md`,
`big-comparison-util`, `bank-statement-parser`, `channel ideas`). Note: Plan 002
created `WS/to-do/todolist.md` (formerly `ty/to-do/`) and root/workspace maps may
point at it — update those to `WS/notes/to-do/todolist.md`.

**Verify**: `ls WS/notes WS/archive WS/tools` show the moved folders; per-name
sweeps return no stale in-repo refs; `git status` shows renames (R).

**STOP if**: `bank-statement-parser` has a hardcoded absolute self-path in its
Python (it's a RapidAPI-product candidate; a wrong path breaks its build) — report.

**Commit**: `refactor(WS): group notes/, archive superseded, hyphenate channel-ideas`

## Stage 2 — Create `video/` and move the two light video folders

```bash
mkdir -p WS/video
git mv WS/ai-video-production   WS/video/motion-graphics
git mv WS/yt-visuals-hyperframe WS/video/card-library
```

Fix references:
- `WS/CLAUDE.md` map rows for both.
- `apps/hyperframes-render/CLAUDE.md` + `README.md`: the Templates-tab source is
  now `WS/video/card-library/` (was `WS/yt-visuals-hyperframe/`).
- `apps/hyperframes-render/docker-compose.yml`: update the volume line's **repo
  side** of the path to `…/WS/video/card-library` (the full VPS path is finalized
  in Plan 010 — but set the in-repo compose to the correct new relative segment so
  010 only has to adjust the `/srv/projects/...` prefix). Leave a comment
  `# card library: WS/video/card-library — see plans/010 for the VPS mount`.
- Any skill referencing `ai-video-production` (Devsplainers) or the card library.

**Verify**: `ls WS/video/motion-graphics WS/video/card-library`; sweep for
`ai-video-production` and `yt-visuals-hyperframe` → no stale in-repo refs;
`grep -n "card-library" apps/hyperframes-render/docker-compose.yml` → present.

**STOP if**: `motion-graphics` (Devsplainers kit) has a build config with an
absolute path to its own location that the sweep can't mechanically fix — report.

**Commit**: `refactor(WS): create video/ bucket; move motion-graphics + card-library`

## Stage 3 — Move `video-voice → video/voice` (the deep one)

Before moving, sweep for **self-referential in-repo paths** inside the folder
(scripts that build paths from a hardcoded `video-voice` segment rather than from
`__file__`):

```bash
grep -rIn "video-voice" WS/video-voice --include='*.py' --include='*.mjs' --include='*.sh' --include='*.json' --include='*.md' | grep -v '/kb-scratch/'
```

- Hits that are `~/kb-scratch/video-voice/…` (Plan 003's out-of-repo defaults):
  **leave unchanged** — they point outside the repo and stay valid.
- Hits that are in-repo relative/absolute references to the folder's own location:
  count them. If **≤ ~8** and each is a simple string, proceed and fix them after
  the move. If **> ~8** or any is a non-obvious path construction, **STOP and
  report** — a deep rename with many internal path deps needs a config refactor,
  not a blind move.

Then:

```bash
git mv WS/video-voice WS/video/voice
```

Fix: the in-repo self-refs counted above; `WS/CLAUDE.md` map; `WS/README` or
`WS/video/voice/README.md` note; any skill (e.g. a tts/voice skill) referencing
`video-voice`. Re-run the Python smoke with the venv active AND, if a voice script
has a cheap `--help`/dry path, run one from the repo root to confirm
`from common.*` and any `VV_*` env paths still resolve.

**Verify**: `ls WS/video/voice/`; `grep -rIn "WS/video-voice\|/video-voice/" . | grep -v '/kb-scratch/' | grep -v '\.git/'` → empty; Python smoke passes.

**STOP if**: the pre-move sweep exceeds the threshold, or the post-move smoke
raises a path error — roll back this stage (`git reset --hard HEAD~1`) and report
the ref list so a config-indirection plan can be written instead.

**Commit**: `refactor(WS): move video-voice into video/voice`

## Stage 4 — Update the workspace guide + final sweep

1. Rewrite `WS/CLAUDE.md`'s folder map to the new structure (video/, tools/,
   notes/, archive/ with their contents). Keep the Python `common/`+venv+`.env`
   setup notes intact (unchanged).
2. Full sweep: `grep -rIn "video-voice\|ai-video-production\|yt-visuals-hyperframe\|channel ideas\|big-comparison-util" . | grep -v node_modules | grep -v '\.git/' | grep -v '^\./plans/' | grep -v '/kb-scratch/' | grep -v '/archive/'` → only intentional historical mentions (dated decisions log) remain.
3. Root `CLAUDE.md` / `README.md`: if any row pointed at one of the moved
   folders, update it.
4. Append to root `decisions.md`:
   `2026-07-04 — WS/ internal layout regrouped by kind: video/{voice,motion-graphics,card-library}, tools/{bank-statement-parser,big-comparison-util}, notes/{channel-ideas,upwork-hiring,to-do}, archive/hyperframes-vs-remotion; youtube/pinterest/income-analysis stay top-level as distinct live domains — flat theme-era layout mixed superseded with live and scattered the video work.`
5. Update `plans/README.md`: 009 → DONE.

**Verify**: sweep clean; `WS/CLAUDE.md` map matches `ls WS/`; link-check the
workspace map (every path it lists resolves).

**Commit**: `refactor(WS): update workspace map + decisions for the new layout`

## Test plan

- Python `import common` smoke (venv active) at the end — the load-bearing check.
- One voice script and one youtube script dry/`--help` run from repo root, if cheap.
- `apps/hyperframes-render` compose references `WS/video/card-library` (grep).
- Full stale-ref sweep empty.

## Done criteria

- [ ] `WS/` top level = `common` + config + `youtube` + `pinterest` + `income-analysis` + `video/` + `tools/` + `notes/` + `archive/` (+ CLAUDE.md/SETUP.md/yt-workflow.md)
- [ ] `channel ideas` renamed to `notes/channel-ideas` (no spaces anywhere: `find WS -name '* *' -type d` → empty)
- [ ] `hyperframes-vs-remotion` under `archive/`
- [ ] Python `import common` smoke passes
- [ ] `apps/hyperframes-render` docs + compose reference `WS/video/card-library`
- [ ] Full sweep clean; workspace + root maps updated; decisions + index updated
- [ ] Four stage commits; nothing pushed

## STOP conditions

- Plan 008 hasn't landed (`ty/` still present) — run it first.
- Stage 3's pre-move sweep exceeds the ref threshold, or any post-move Python
  smoke fails — roll back that stage and report.
- A moved folder has a hardcoded absolute self-path in a build/deploy config.
- The `~/kb-scratch/video-voice/` indirection appears BROKEN after the move
  (it shouldn't be — those paths are outside the repo) — report, don't "fix" by
  moving scratch dirs.

## Maintenance notes

- **This plan changes the card-library folder path; Plan 010 must run after it**
  to fix the VPS mount (`/srv/projects/…/WS/video/card-library`). Do not deploy
  render2 from here.
- New video projects → `WS/video/<name>`; new business notes → `WS/notes/<name>`;
  new monetizable tool → `WS/tools/<name>`; superseded work → `WS/archive/`.
- Reviewer should scrutinize Stage 3 (the video-voice move) hardest — a missed
  in-repo path ref there is the most likely regression.
