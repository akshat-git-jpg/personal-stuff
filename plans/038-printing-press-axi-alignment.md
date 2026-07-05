# Plan 038: printing-press — AXI alignment pass (skill-level levers + upstream draft)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- tooling/claude-skills/printing-press/ tooling/claude-skills/printing-press-polish/ docs/`
> (Changes from plans 033–037 elsewhere are expected. Anything else in THESE
> paths: STOP.)

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

AXI (axi.md, kunchenguid) is a benchmarked set of 10 design principles for
agent-first CLIs (gh-axi: 100% task success at 1/3 the cost of GitHub MCP).
The printing press already implements much of it (`--agent`, auto-JSON when
piped, typed exit codes, `--select`/`--compact`). This plan bakes the
REMAINING gaps into the press *skill* references so every future generated
CLI gets them — and drafts the upstream issue for template-level changes we
cannot make locally (press templates live in the read-only Go module cache;
upstream is `github.com/mvanhorn/cli-printing-press`; recon 2026-07-06).

## Current state

- Skill source of truth (SYMLINK SOURCES — edit here, never the copies under
  `~/.claude-work/skills/`): `tooling/claude-skills/printing-press/` with
  `references/phase-2-generate.md`, `references/phase-3-build.md`,
  `references/scorecard-patterns.md`, `references/noi-examples.md`; and
  `tooling/claude-skills/printing-press-polish/SKILL.md`.
- Press behavior today (verified in template source):
  - Piped output auto-switches to JSON; terminal gets a ≤6-column table.
  - Lists ≥25 rows print a stderr hint (`Showing N results. To narrow: ...`).
  - `--agent` = `--json --compact --no-input --no-color --yes`. No TOON mode;
    `--llm` terse mode exists only as a per-CLI novel feature (openrouter).
  - Errors: typed exit codes (2 usage, 3 not-found, 4 auth, 5 api, 7
    rate-limit, 10 config) with actionable multi-line hints; JSON error
    envelope `{"error","code"}` under `--json`.
- **The gap list this plan encodes** (authored from the AXI principles vs the
  recon; these are the decisions — do not re-derive):
  1. *Definitive empty states* (AXI #5): zero-result lists must print
     `<noun>: 0 results for <scope>` (stdout, structured), never empty
     output. Press today: empty JSON array / empty table.
  2. *Pre-computed aggregates* (AXI #4): list output should carry
     `count: N of M total` when the API exposes totals; detail views carry
     cheap derived counts (`comments: 7`).
  3. *Content truncation with size hints* (AXI #3): large text fields render
     a 500–1500-char preview + `(truncated, N chars total)` + a `--full`
     escape hatch, never silent omission.
  4. *Content first* (AXI #8): bare `<cli>` with no args should show a
     compact live home view (auth state + 2–3 headline resources), not help.
  5. *Contextual disclosure* (AXI #9): after non-self-contained output, emit
     1–2 complete runnable next-step commands (press's stderr-hint pattern,
     generalized; keep them on stderr so piped stdout stays parseable — a
     deliberate, documented deviation from AXI's stdout preference).
  6. *TOON output* (AXI #1): upstream-only (template rendering change);
     goes in the issue draft, NOT the skill levers.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Skill symlinks intact | `./scripts/skills-status.sh` | exit 0, no DANGLING |
| Files well-formed | `test -s <each edited file>` | exit 0 |

## Scope

**In scope**:
- `tooling/claude-skills/printing-press/references/axi-alignment.md` (new)
- `tooling/claude-skills/printing-press/references/phase-2-generate.md` (append one section)
- `tooling/claude-skills/printing-press-polish/SKILL.md` (append one checklist)
- `tooling/claude-skills/printing-press/references/scorecard-patterns.md` (append one note)
- `docs/press-axi-upstream-issue.md` (new — the draft to file manually)

**Out of scope**:
- The Go module cache (read-only), any published CLI in
  `~/printing-press/library/`, the `printing-press-score` skill, cloning the
  upstream repo (the owner decides if/when to fork).

## Git workflow

- Branch: `advisor/038-press-axi`
- Commit: `docs(press): AXI alignment levers + upstream draft` — no AI
  footers. Do NOT push.

## Steps

### Step 1: `references/axi-alignment.md`

Write the reference: the 10 AXI principles (one line each), a
press-status table (already-covered / skill-lever / upstream-only) using
exactly the gap list above, and the standing instruction: "During phase 2
(novel features) and polish, apply the skill-lever items to every generated
CLI as post-generation patches; they must not regress the scorecard."

**Verify**: `grep -c "0 results" tooling/claude-skills/printing-press/references/axi-alignment.md` ≥ 1

### Step 2: Wire it into the phases

- `phase-2-generate.md`: append a short section "AXI alignment (see
  references/axi-alignment.md)" instructing that novel-feature selection
  favors: a no-args home view command, count aggregates, and empty-state
  lines — items 1, 2, 4 of the gap list, stated concretely.
- `printing-press-polish/SKILL.md`: append an "AXI checklist" to its fix
  passes: empty states (1), truncation hints + `--full` (3), next-step
  stderr suggestions (5) — each phrased as a check + the patch pattern.
- `scorecard-patterns.md`: append a note that AXI items are additive polish
  and must never game scorecard dimensions (the press README's anti-gaming
  rule).

**Verify**: `grep -l "axi-alignment" tooling/claude-skills/printing-press/references/phase-2-generate.md tooling/claude-skills/printing-press-polish/SKILL.md` → both files listed

### Step 3: Upstream issue draft

`docs/press-axi-upstream-issue.md`: title, summary of AXI + benchmark
numbers, the upstream-only asks — TOON as an output mode (`--toon` or under
`--agent`), template-level empty states, `count: N of M`, truncation +
`--full`, no-args home view — each mapped to the template file it would
change (`helpers.go.tmpl` rendering pipeline, `root.go.tmpl` flags/help,
`command_endpoint.go.tmpl`+`command_promoted.go.tmpl` in sync,
`readme.md.tmpl`/`skill.md.tmpl` contract docs, `scorecard.go` in lockstep,
golden files regenerated per `docs/GOLDEN.md`). End with a note that the
owner files this manually against `mvanhorn/cli-printing-press`.

**Verify**: `grep -c "helpers.go.tmpl" docs/press-axi-upstream-issue.md` ≥ 1

## Test plan

Doc-only plan: verification is greps + `skills-status.sh` (symlink integrity
— you edited symlink SOURCES; the linked copies must still resolve).

## Done criteria

- [ ] All five files exist/updated; greps in Steps 1–3 pass
- [ ] `./scripts/skills-status.sh` exit 0, no DANGLING
- [ ] No file outside the in-scope list changed (drift check clean)

## STOP conditions

- Any edit target's current content contradicts the recon summary in Current
  state (e.g. phase-2-generate.md has no novel-features section) — STOP and
  report what you actually found.
- Temptation to "quickly patch" a published CLI in `~/printing-press/library/`
  — STOP; out of scope.

## Maintenance notes

- When the owner reprints or polishes any CLI next, the AXI checklist fires —
  watch the first run for friction and refine axi-alignment.md.
- If upstream adopts TOON, revisit item 6 locally (flip from upstream-only to
  covered).
