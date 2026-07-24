---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 146: review-surface split — storyboard reviews composition; effects/sound auto-approve and get judged on Final Cut

## Summary

- **Problem statement**: owner decision (decisions.md 2026-07-24): storyboard review = COMPOSITION ONLY (screen vs graphics vs avatar+mode); effects and sound are judged in motion on the Final Cut tab. Today effects.json/sound.json still demand pre-render owner approval, and the storyboard tab gives effects/sound lanes equal visual weight with no mode labels on the avatar lane.
- **Goals**: (1) `effects-plan` and `sfx-plan` write `approved: true` at generation (supersedes the 2026-07-20 per-artifact effects gate for v2 — owner-directed); assemble/mix no longer block on them; (2) storyboard tab: SCREEN/GRAPHICS/AVATAR lanes prominent, avatar blocks labeled with their mode (full/panel/stage), effects+sound lanes collapsed behind a remembered toggle (reuse the list page's fold pattern); (3) docs/skill updated to the two-scope review model.
- **Executor proposed**: agy (Gemini 3.1 Pro High); ui:true — screenshots required.
- **Done criteria**: gate green; a fresh effects/sound plan is born approved; lanes fold; mode labels visible.
- **Stop conditions**: any consumer hard-requires `approved:false` initial state; v1 edits.
- **Test / verification for success**: unit tests on the plan writers' approved default + board markup assertions; screenshots.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step; run every verification. If a STOP condition occurs, stop and report. Do NOT edit `plans/README.md`. `videos/test-01/` may exist untracked (live review) — never stage/edit/delete anything under `videos/`.
>
> **Drift check (run first)**: `git diff --stat 49ce96d..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (coexists with 145 — different files except lint-shots context; boss resolves trivial overlaps)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `49ce96d`, 2026-07-24

## Why this matters

The owner reviews twice: a fast structural pass on the storyboard, then the real review on the assembled draft. Effects and sound are deterministic derivatives that can only be judged in motion — forcing a pre-render approval on them adds a gate the owner doesn't want and clutters the composition review. Removing it also makes the short-video "straight-to-draft" path fully unattended after cue/shot approval.

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- `lib/effects-plan.mjs`: writes `{video, approved: existing.approved === true && unchanged, instances}` — a fresh plan is `approved:false`; `lib/assemble.mjs` (`loadAssemblyInputs`) refuses an unapproved effects.json without `--force`.
- `lib/sound/sfx-plan.mjs`: same preserve/approve pattern; `run.sh` `mix)` refuses unless sound.json `approved:true`.
- Board storyboard tab (`lib/board.mjs`, `renderTimelinePage`): five equal lanes SCREEN/GRAPHICS/AVATAR/EFFECTS/SOUND (`tl-track` rows, ~line 1130 region); avatar blocks (`avatarBlocksHtml`) carry no mode labels. The `/list` page has the fold precedent: `overviewToggle` + `overviewBlock` + `localStorage['board:list-overview']` (search `fold-toggle`).
- Approve buttons: `Approve graphics` (cues) / `Approve effects` on the board topbar; the effects one becomes redundant — keep the endpoint (fixes may re-gate manually) but demote the button.
- Docs: `PIPELINE.md` flow rows for effects-plan/sound/mix mention the approval gates; skill `pipelines/.claude/skills/visuals-flow-2/SKILL.md` "Review model" paragraph (added 2026-07-24) and the verb table row "mix ... sound.json approval before mix".

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Serve | `node lib/board.mjs <slug>` | URL printed |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/` plus the skill file):
- `lib/effects-plan.mjs`, `lib/sound/sfx-plan.mjs` + tests (approved-by-default)
- `lib/assemble.mjs` (drop the effects-approval refusal; keep `--force` semantics for cues), `run.sh` (`mix` no longer checks sound approval)
- `lib/board.mjs` + `lib/board.test.mjs` (lane fold, avatar mode labels, demote Approve-effects button to the folded section)
- `PIPELINE.md`, `steps/090-assemble-run/README.md` if it names the gate, `pipelines/.claude/skills/visuals-flow-2/SKILL.md`

**Out of scope**: v1; the CUES approval gate (unchanged — composition is still owner-gated); shots gate (unchanged); Final Cut tab; `videos/**`.

## Git workflow

- Branch: `advisor/146-vf2-review-surface-split`. Commit per step. Do NOT push.

## Steps

### Step 1: auto-approve derivatives

- `effects-plan.mjs`: output `approved: true` always (drop the unchanged-comparison for the flag; keep `enabled` preservation). Same in `sfx-plan.mjs`.
- `assemble.mjs`: remove the unapproved-effects refusal (delete the check; document in assembly.md header line that effects/sound are Final-Cut-reviewed). `run.sh mix)`: drop the approval check.
- Update the writers' tests: fresh plan asserts `approved: true`; `enabled` overrides still survive regen.

**Verify**: `node --test lib/effects.test.mjs lib/sound/sfx-plan.test.mjs lib/assemble.test.mjs` pass.

### Step 2: storyboard lane refit

- Avatar blocks show their mode: label text `full`/`panel`/`stage` inside each avatar block (data from shots.resolved; fall back to `full`).
- Wrap the EFFECTS + SOUND `tl-track` rows (and their chips) in a folded block with a `details ▸` fold-toggle button (default CLOSED, `localStorage['board:tl-derivatives']`, exact pattern of the list page's overview toggle).
- Move the `Approve effects` button inside that folded block (still functional).

**Verify**: `node --test lib/board.test.mjs` pass (markup assertions: fold button present, avatar mode label rendered for a panel fixture); serve smoke → lanes folded by default, toggle persists across reload.

### Step 3: docs

- `PIPELINE.md`: effects-plan/sound/mix rows say "auto-approved — reviewed on Final Cut"; 040 row's review-model note gains "storyboard scope = composition (screen/graphics/avatar+mode) only".
- Skill: update the Review model paragraph + remove "sound.json approval before mix" from the verb table.

**Verify**: `grep -n "auto-approved" PIPELINE.md` → present; `bash scripts/check.sh` exit 0.

### Step 4: screenshots (ui:true)

Storyboard tab: (a) default state — three prominent lanes, avatar mode labels, derivatives folded; (b) unfolded derivatives.

## Test plan

Writer-default unit tests, board markup unit tests, serve smoke, screenshots for the visual claims — no existence-only checks.

## Done criteria

- [ ] check.sh green
- [ ] Fresh `effects.json`/`sound.json` are born `approved: true`; assemble+mix run without approval steps
- [ ] Storyboard: avatar mode labels; effects/sound folded by default with persisted toggle
- [ ] Docs + skill reflect the split
- [ ] Two PR screenshots

## STOP conditions

- Any test encodes `approved:false`-at-birth as a safety invariant whose removal breaks non-gate behavior — report before changing semantics.
- Any edit to the cues/shots approval gates.

## Maintenance notes

- If a derivative ever needs re-gating (e.g. a risky new effect), the manual approve endpoint still exists — flip `approved:false` by hand.
- Plan 145's `stage` mode label rides the same avatar-lane labeling added here.
