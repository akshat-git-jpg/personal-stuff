---
executor: agy
model:
test_cmd: test -L .claude/skills/visuals-flow-2 && cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: [after 140-vf2-board-two-tabs]
---

# Plan 141: v2 docs, skill, and repo registration

## Summary

- **Problem statement**: after plans 134–140 land, visuals-flow-2 works but is invisible: its PIPELINE.md still describes v1's flow, no skill routes its verbs, and the repo maps don't list it.
- **Goals**: (1) rewrite v2's `PIPELINE.md` flow table + folder layout for the full v2 chain; (2) create the `visuals-flow-2` operating skill (source in `pipelines/.claude/skills/`, symlink at root `.claude/skills/`); (3) register the folder in `pipelines/CLAUDE.md`'s map; (4) mark v1 as superseded-fallback in its own README header.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — mechanical/docs.
- **Done criteria**: check.sh green; skill resolves through the symlink; both CLAUDE-map rows present.
- **Stop conditions**: any content conflict with a doc edited by an in-flight plan branch.
- **Test / verification for success**: structural checks (files exist, symlink resolves, greps) — content is docs.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md` or `decisions.md` (both are main-owned).
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2 pipelines/.claude/skills pipelines/CLAUDE.md`
> (Plans 134–140 will have landed — large diffs in visuals-flow-2 are EXPECTED; drift only matters for the skill dir + CLAUDE.md.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 134–140 (documents what they built — run LAST)
- **Category**: dx
- **Difficulty**: mechanical
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

The repo routes by docs: sub-folder CLAUDE/README files are the operating contract, `pipelines/CLAUDE.md` is the folder map, and skills are how sessions drive a pipeline by verb. An unregistered pipeline gets rediscovered by grep, which this repo explicitly forbids.

## Current state

- `pipelines/video/visuals-flow-2/PIPELINE.md` — still the v1 copy (flow table of steps 010→095 + qc + 060; cues.json/shots.json schemas with plan-135/136/139 additions appended by those plans).
- Skill precedent: source `pipelines/.claude/skills/visuals-flow/SKILL.md` (verb router: "run graphics for <video>", "open my storyboard", "assemble the video", etc.); root symlink `​.claude/skills/visuals-flow -> ../../pipelines/.claude/skills/visuals-flow`.
- `pipelines/CLAUDE.md` folder map row for v1: `video/visuals-flow/` "Beat-synced motion-graphics pipeline — VO mp3 → cues → storyboard review → rendered clips + manifest (uses card-library cards)".
- Spec: `docs/specs/2026-07-24-visuals-flow-v2-design.md` (deltas A–I + coverage matrix) — the authority for what to describe.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Symlink check | `readlink .claude/skills/visuals-flow-2` (repo root) | `../../pipelines/.claude/skills/visuals-flow-2` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/PIPELINE.md`, `README.md` (new, 5-line orientation), `INTEGRATION.md` (v2 caller contract note)
- `pipelines/.claude/skills/visuals-flow-2/SKILL.md` (new) + root symlink `.claude/skills/visuals-flow-2`
- `pipelines/CLAUDE.md` (one map row under video/)
- `pipelines/video/visuals-flow/README.md` — header banner only ("v1 — superseded by ../visuals-flow-2 (2026-07-24); kept as working fallback; no new work here")

**Out of scope**: `decisions.md`, `plans/README.md`, `my-hosted-sites.md`, `INFRA.md` (nothing hosted changed), root README, any code.

## Git workflow

- Branch: `advisor/141-vf2-docs-registration`. Commit per step. Do NOT push.

## Steps

### Step 1: v2 PIPELINE.md + README

Rewrite the flow table to the v2 chain (keep the v1 doc's table format and tone):
010 transcribe → 015 segments → **018 concept-pass [LLM]** (concept.json, gate `lint-concept`) → plan-skeleton → 020 cue-pass [LLM] (now consumes {{CONCEPT}}; bespoke escalation rule) → 030 resolve+lint (incl. `extendExposure`, E7/W7/W8/W9) → **035 cue-audit [LLM]** (audit.json mute test) → 040 board [OWNER] (two tabs; Final Cut reviews assembled versions; Gates A/B) → 050 render (brand-inline; bespoke staging; variant rotation) → 070 shot-pass [LLM] (modes full/panel) → 080 avatar [OWNER live HeyGen] → effects-plan (register transitions, motif lane, captions default-on) → **sound [RUN]** (sound.json gate) → **mix [RUN]** (master.wav −14 LUFS, frame-exact) → 090 assemble (freeze gap-filler, master.wav, version registry) → 095 export (layered FCPXML + music/sfx lanes + panel transforms) → qc → 060 fold [OPUS].
Folder-layout block: add `video.json`, `concept.json`, `audit.json`, `sound.json`, `bespoke/`, `motif/`, and the kb-scratch `versions/` note. Add a "What v2 adds over v1" 9-line list (deltas A–I, one line each, linking the spec).
New `README.md`: what this folder is, spec link, v1-fallback note, `run.sh` as entry point.

**Verify**: `grep -c "018\|035\|sound\|mix" pipelines/video/visuals-flow-2/PIPELINE.md` ≥ 4; README exists.

### Step 2: the skill

`pipelines/.claude/skills/visuals-flow-2/SKILL.md` — copy the v1 skill's structure/frontmatter style and adapt: name `visuals-flow-2`, description triggers ("visuals-flow-2", "run v2 graphics for <video>", "run the concept pass", "audit the cues", "make the sound plan", "mix the audio", "open my v2 board", "final cut review", plus the v1 verb set). Verb table maps each phrase to the `run.sh` verb or lib CLI, marks the owner gates (040 board approval, sound.json approval before mix, 060 fold, 080 live HeyGen) and Gate A/B behaviors. Then from the REPO ROOT: `ln -s ../../pipelines/.claude/skills/visuals-flow-2 .claude/skills/visuals-flow-2`.

**Verify**: symlink-check command → expected target; `head -5 .claude/skills/visuals-flow-2/SKILL.md` shows the frontmatter.

### Step 3: map rows + v1 banner

- `pipelines/CLAUDE.md`: insert directly under the v1 row: `video/visuals-flow-2/` — "v2 of the motion-graphics pipeline — adds concept/through-line pass, enacted cards, coverage+density fixes, head panel mode, sound+mix stage, two-tab review board (spec docs/specs/2026-07-24-visuals-flow-v2-design.md)" | Node + Claude steps.
- v1 `README.md`: prepend the superseded-fallback banner (2 lines, keep the rest untouched). Do NOT touch v1's PIPELINE.md or code.

**Verify**: `grep -n "visuals-flow-2" pipelines/CLAUDE.md` → 1 row; `head -3 pipelines/video/visuals-flow/README.md` shows the banner.

### Step 4: gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0 (docs must not have broken the rulebook checks — if PIPELINE.md prose restates a constant, use the constant's rule text verbatim from `lib/cue-constants.mjs`).

## Test plan

Structural verification only (files, symlink, greps, gate) — this is a docs plan; prose quality is reviewed on the PR.

## Done criteria

- [ ] check.sh green; symlink resolves
- [ ] PIPELINE.md describes the full v2 chain incl. concept/audit/sound/mix/two-tab board
- [ ] pipelines/CLAUDE.md row present; v1 README banner present
- [ ] No edits outside the Scope list (`git diff --stat` on the branch confirms)

## STOP conditions

- `pipelines/CLAUDE.md` conflicts with another in-flight branch's edit at rebase — leave resolution to boss (the shared-file precedent), don't hand-merge unrelated rows.
- Anything requiring a decisions.md or plans/README.md edit.

## Maintenance notes

- When v2 has produced its first real video end-to-end, the owner decides whether v1 gets archived (`pipelines/archive/`) — that's a future decisions.md entry, not this plan.
- Keep skill verb names aligned with run.sh cases; `scripts/test-run-sh.sh` covers run.sh only.
