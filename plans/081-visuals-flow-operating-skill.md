---
executor: agy
model:
test_cmd: bash -c 'test -f .claude/skills/visuals-flow/SKILL.md && bash scripts/check-skill-descriptions.sh && cd pipelines/video/visuals-flow && bash scripts/check.sh'
ui:
deploy:
needs: []
---

# Plan 081: visuals-flow operating skill (GFX-12) — verb router so the owner stops shepherding steps

## Summary

- **Problem statement**: operating visuals-flow means the owner hand-runs each step (copy the cue/shot prompt into a session, run resolve/lint/fix-loops, remember pre-flights and model gates). GFX-12: a thin trigger-router skill that makes the Claude session the operator; the owner only reviews on the board and green-lights live HeyGen.
- **Goals**:
  - `pipelines/.claude/skills/visuals-flow/SKILL.md` — full text inlined below, place verbatim.
  - Relative symlink `.claude/skills/visuals-flow` → `../../pipelines/.claude/skills/visuals-flow` (same convention as media-board).
  - Registry row updates only; no pipeline code changes.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High, agy default) — owner-directed; content fully authored in this plan.
- **Done criteria** (terse): SKILL.md readable through the symlink; description-budget guard green; flow gate untouched and green.
- **Stop conditions** (terse): don't edit any lib/step/rulebook file; don't paraphrase the skill text.
- **Test / verification for success**: the frontmatter `test_cmd` (symlink + description budget + flow gate).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 92797b5..HEAD -- pipelines/.claude/skills .claude/skills pipelines/video/visuals-flow`
> Expect empty; anything else → report before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds one markdown file + one symlink)
- **Depends on**: none (077–080 landed 2026-07-18)
- **Category**: dx
- **Difficulty**: mechanical
- **Planned at**: commit `92797b5`, 2026-07-18

## Why this matters

The avatar phase doubled the number of steps the owner shepherds by hand (this was the owner's direct complaint on 2026-07-18: "if I'm approving on the board it should just make the videos"). Full automation is deliberately off the table in two spots — board approval is the owner gate, and live HeyGen submits are owner-run (ToS-grey, heygen-web CLAUDE.md) — so the right fix is a skill that lets any Claude session run everything BETWEEN those two human moments from a single verb.

## Current state

- Skill source convention: `pipelines/.claude/skills/<name>/SKILL.md`, frontmatter `name:` + `description:` (description carries the trigger phrases — see `pipelines/.claude/skills/media-board/SKILL.md` as the exemplar). Root sessions see it via a RELATIVE symlink: `.claude/skills/<name>` → `../../pipelines/.claude/skills/<name>` (e.g. `media-board`, verified 2026-07-18).
- Guards that exist and are referenced by the skill text (do not re-implement): `scripts/check-skill-descriptions.sh` (description token budget), `scripts/skills-status.sh` (dangling-link check).
- The flow being routed (all landed): `pipelines/video/visuals-flow/` steps 010–080 + 060 fold; operating facts in its `HANDOFF.md` ("How to run" block updated 2026-07-18) and `PIPELINE.md` (schemas). The skill is a ROUTER — those docs stay authoritative; the skill quotes commands but defers judgment content to the step rulebooks.
- Overlap check (backlog row requirement, done 2026-07-18): `video-and-tts-reference` is a theory/reference skill (engines, sync, costs, settled decisions) — zero verb overlap with this operating skill. No changes needed there.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Symlink resolves | `test -f .claude/skills/visuals-flow/SKILL.md && echo ok` | `ok` |
| Description budget | `bash scripts/check-skill-descriptions.sh` | exit 0 |
| No dangling links | `bash scripts/skills-status.sh` | exit 0, no dangling-link warnings |
| Flow gate untouched | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- New: `pipelines/.claude/skills/visuals-flow/SKILL.md`.
- New symlink: `.claude/skills/visuals-flow`.
- `plans/README.md` status row for 081.

**Out of scope**:
- Everything inside `pipelines/video/visuals-flow/` (libs, steps, rulebooks, HANDOFF).
- `video-and-tts-reference` and every other skill.
- `scripts/relink.sh` / the tooling/claude-skills manifest (that mechanism is for cross-repo skills, not pipelines-domain skills).

## Git workflow

- Branch: `advisor/081-visuals-flow-operating-skill`
- Commit: `feat(skills): visuals-flow operating skill (GFX-12)` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `pipelines/.claude/skills/visuals-flow/SKILL.md`

EXACTLY this content (owner-reviewed operating text — place verbatim, do not paraphrase):

```markdown
---
name: visuals-flow
description: Operate the visuals-flow pipeline (pipelines/video/visuals-flow) by verb — the session runs the steps, the owner only reviews the board and green-lights live HeyGen. Verbs: run graphics for <video>, run the shot pass for <video>, open my storyboard/board, render the graphics, make the avatar videos, download the avatar videos, fold the feedback. Triggers on those phrases plus "visuals-flow", "run the cue pass", "approve flow for <video>", "avatar clips for <video>".
---

# visuals-flow — operating skill (verb router)

Run everything from `pipelines/video/visuals-flow/`. This skill routes verbs to
step procedures; judgment content lives in the step rulebooks and stays there.
State of the pipeline + full command list: `HANDOFF.md`. Schemas: `PIPELINE.md`.

## Guardrails (check BEFORE any verb, never skip)

1. **Pre-flight for ANY LLM pass** (cue or shot): `node lib/feedback-status.mjs`
   must exit 0. Non-zero = unfolded owner feedback = unapplied lessons — run the
   fold first or stop and tell the owner.
2. **060 feedback-fold is Opus-class ONLY.** If the current session is not
   Opus-class, refuse the fold verb and say why (HANDOFF "Model routing").
3. **Live HeyGen is owner-run.** Submit only when the owner explicitly asked in
   THIS conversation and confirmed the template slug. Never submit from a cron,
   subagent, or unattended session. Download is safe to re-run.
4. **`engineMode` stays `"test"`.** Production (HeyGen 4) is a validation error
   by design until the owner flips it (docs/specs/2026-07-18-avatar-shot-plan-design.md).
5. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
6. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 060 fold, not through operating sessions.

## Verb: "run graphics for <slug>"

1. Guardrail 1. If `videos/<slug>/transcript.json` is missing:
   `bash steps/010-transcribe-run/run.sh <slug>` (accepts vo.mp3/mp4/mov/mkv/m4a/wav).
2. Run the cue pass IN THIS SESSION: read `steps/020-cue-pass-llm/cue-pass-prompt.md`,
   fill its placeholders (`../card-library/catalog.json` + the transcript text),
   produce `videos/<slug>/cues.json` exactly per the prompt's schema. Any
   Sonnet-class-or-better session qualifies (the pass is form-filling; HANDOFF
   "Model routing").
3. Fix-loop (≤3 rounds): `node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>`;
   feed error output back into step 2 verbatim. Errors surviving round 3 →
   stop, surface to the owner.
4. Guardrail 5 (snapshot to `cues.llm.json`), then tell the owner the board is
   ready: `node lib/board.mjs <slug>`.

## Verb: "run the shot pass for <slug>"

1. Guardrail 1, plus `cues.json` must have `"approved": true` (the shot pass
   plans AROUND approved graphics — refuse otherwise).
2. Extract the fullframe cue times for the prompt:
   `node -e "const r=require('./videos/<slug>/resolved.json');for(const c of r.resolved.filter(c=>c.placement==='fullframe'))console.log(c.id, c.start, +(c.start+c.duration).toFixed(2))"`
3. Run the shot pass IN THIS SESSION: `steps/070-shot-pass-llm/shot-pass-prompt.md`
   with the fullframe list + transcript → `videos/<slug>/shots.json`.
4. Fix-loop (≤3 rounds): `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`.
5. Guardrail 5 (snapshot to `shots.llm.json`), then point the owner at the
   board's shot lane + "Approve shots" button.

## Verb: "open my storyboard" / "open the board"

`node lib/board.mjs <slug>` (background), report the printed 127.0.0.1 URL.
Unsaved-feedback warning and approval semantics are the board's own.

## Verb: "render the graphics"

`node lib/render.mjs <slug>` — it refuses unapproved/stale on its own; never
pass `--force` unless the owner says so. Output: `renders/` + `manifest.md`.

## Verb: "make the avatar videos" (live HeyGen — guardrail 3)

1. Requires `shots.json` `"approved": true` and the owner's template slug
   (from `pipelines/video/heygen/registry.json`; ask if not given).
2. `bash steps/080-avatar-render-run/run.sh <slug> --template <slug> --submit`
   — gates, slicing, pacing, and `avatar-jobs.json` are the step's own.
3. Tell the owner renders take minutes; the download verb finishes the job.

## Verb: "download the avatar videos"

`bash steps/080-avatar-render-run/run.sh <slug> --download` — one attempt per
pending job; re-run until no `pending:` lines. Output: clips in
`~/kb-scratch/video/heygen/visuals-flow/<slug>/` + `avatar-manifest.md`.
Editor handoff = `renders/` + `manifest.md` + those clips + `avatar-manifest.md`.

## Verb: "fold the feedback" (guardrail 2 — Opus-class only)

Follow `steps/060-feedback-fold-opus/README.md`: `node lib/edit-delta.mjs <slug>`
for the owner-edit diff, fold lessons into the rule surfaces, mark items folded.
Done when `node lib/feedback-status.mjs` exits 0.
```

**Verify**: `test -f pipelines/.claude/skills/visuals-flow/SKILL.md && echo ok` → `ok`.

### Step 2: Symlink into the root skills dir

From the repo root: `ln -s ../../pipelines/.claude/skills/visuals-flow .claude/skills/visuals-flow` (relative target, matching `ls -la .claude/skills/media-board`).

**Verify**: `test -f .claude/skills/visuals-flow/SKILL.md && echo ok` → `ok`; `bash scripts/skills-status.sh` → exit 0, no dangling links.

### Step 3: Gates

`bash scripts/check-skill-descriptions.sh` and `cd pipelines/video/visuals-flow && bash scripts/check.sh`.

**Verify**: both exit 0 (this plan changes nothing the flow gate tests — a failure means an environment problem, STOP and report).

## Test plan

No new tests — the deliverable is markdown + a symlink; the three existing guards (symlink resolution, description budget, flow gate) are the machine checks.

## Done criteria

- [ ] `test -f .claude/skills/visuals-flow/SKILL.md` succeeds (symlink resolves).
- [ ] `bash scripts/check-skill-descriptions.sh` exit 0; `bash scripts/skills-status.sh` exit 0.
- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exit 0.
- [ ] SKILL.md content matches this plan verbatim.
- [ ] `plans/README.md` row for 081 flipped to DONE.

## STOP conditions

- Any edit needed inside `pipelines/video/visuals-flow/` or another skill — report instead.
- `check-skill-descriptions.sh` fails on the description — report the budget number; do NOT trim the description yourself (owner-reviewed text).
- The symlink convention on disk differs from this plan's (e.g. relink-managed) — report before creating anything.

## Maintenance notes

- The skill quotes commands but owns no rules — when steps change, HANDOFF/PIPELINE update first and this skill's command lines follow; drift here is cosmetic, drift there is real.
- If a future session moves pipelines skills under `scripts/relink.sh` management, this symlink migrates with the rest.
- Guardrail 3 (owner-present HeyGen) is the load-bearing line — any future edit weakening it needs an explicit owner decision.
