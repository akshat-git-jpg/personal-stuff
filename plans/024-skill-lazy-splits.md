# Plan 024: Lazy-split three monolithic SKILL.md files (humanizer, notebooklm, printing-press-publish) without behavior loss

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- tooling/claude-skills/humanizer/ tooling/claude-skills/notebooklm/ tooling/claude-skills/printing-press-publish/`
> On any drift, compare the section inventories below against the live files;
> mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (a bad split degrades skill behavior — the boundaries below are chosen to prevent that; do not deviate from them)
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

A skill's whole SKILL.md body is injected into context every time the skill is
invoked. Three skills are monolithic and fat:

| Skill | SKILL.md size | references/ | Invoke frequency |
|---|---|---|---|
| `humanizer` | 30,081 B (~7.5K tokens) | none | very high — triggers on nearly all human-facing writing (a global CLAUDE.md rule mandates it) |
| `notebooklm` | 35,787 B (~9K tokens) | none | occasional |
| `printing-press-publish` | 57,634 B (~14K tokens) | none | occasional |

The repo already has the precedent: the main `printing-press` SKILL.md was
split on 2026-07-04 into a short body + `references/*.md` phase files read on
demand (~92% cheaper invoke; see `decisions.md` entry dated 2026-07-04). This
plan applies the same treatment, with per-skill boundaries chosen so that the
**decision-making content stays inline** and only examples / rarely-needed
detail moves out. The hard requirement from the owner: **do not degrade the
skills' behavior.**

## Current state

All three live in `tooling/claude-skills/<name>/SKILL.md` (this folder is the
single source; symlinked into `~/.claude-work/skills` and
`~/.claude-personal/skills` — edit ONLY here). None has a `references/` dir.
Exemplar of the target pattern: `tooling/claude-skills/printing-press/SKILL.md`
(short body + a mandatory-read map pointing at `references/*.md`).

### humanizer section inventory (headings with line numbers at 671741e)

Frontmatter (name/description), then:
`# Humanizer` (25), `## Your Task` (29), `### Mode A: Editing` (36),
`### Mode B: Writing new copy` (45), `## Voice Calibration` (54),
`## PERSONALITY AND SOUL` (75), `## CONTENT PATTERNS` (108) — patterns 1–6,
`## LANGUAGE AND GRAMMAR PATTERNS` (188) — patterns 7–13,
`## STYLE PATTERNS` (277) — patterns 14–19,
`## COMMUNICATION PATTERNS` (358) — patterns 20–22,
`## FILLER AND HEDGING` (397) — patterns 23–29,
`## Process` (491), `## Output Format` (508), `## Full Example` (517–~579),
`## Reference` (580–end).

Each numbered pattern section (~11 lines) = a rule statement + a
Before/After example pair. The rules are the skill's operating knowledge; the
examples are illustration.

### notebooklm section inventory

`# NotebookLM Automation`, `## Installation`, `## Prerequisites`
(+ `### CI/CD, Multiple Accounts, and Parallel Agents`),
`## Agent Setup Verification`, `## When This Skill Activates`,
`## Autonomy Rules`, `## Quick Reference`, `## Command Output Formats`,
`## Generation Types`, `## Features Beyond the Web UI`, `## Common Workflows`
(4 subsections), `## Output Style`, `## Error Handling`, `## Exit Codes`,
`## Long Prompts`, `## Known Limitations`, `## Language Configuration`,
`## Troubleshooting`.

### printing-press-publish section inventory

`# /printing-press publish`, `## Direct User Invocation Required`, `## Setup`,
`## Configuration`, `## Step 1: Prerequisites` … `## Step 8: Branch, Commit, and PR`
(steps 1, 2, 3, 4, 4.5, 5, 6, 6.5, 6.6, 7, 8), `## After the PR opens`,
`## Secret & PII Protection`, `## Error Handling`.

**Upstream caveat (must be preserved in the plan's commit message and a note):**
the printing-press* skills come from upstream `mvanhorn/printing-press`; a
future upstream update will overwrite this split (same situation as the main
skill's split, recorded in `decisions.md` 2026-07-04). This is accepted.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Size before/after | `wc -c tooling/claude-skills/<name>/SKILL.md` | see per-skill targets |
| No content lost | `wc -c` of SKILL.md + all new references combined | ≥ 95% of the original byte count (moving, not deleting) |
| Frontmatter intact | `head -5 tooling/claude-skills/<name>/SKILL.md` | unchanged `name:`/`description:` |
| Symlinks still resolve | `ls -l ~/.claude-work/skills/humanizer` | points into tooling/claude-skills |

## Scope

**In scope**:
- `tooling/claude-skills/humanizer/SKILL.md` + new `tooling/claude-skills/humanizer/references/`
- `tooling/claude-skills/notebooklm/SKILL.md` + new `references/`
- `tooling/claude-skills/printing-press-publish/SKILL.md` + new `references/`

**Out of scope**:
- Frontmatter `description:` fields (a separate backlog item owns description
  trimming — do not edit descriptions here).
- Every other skill, including `printing-press` (already split) and
  `printing-press-polish`/`-retro`/`-amend` (have references already; deferred).
- The symlink farm (`~/.claude-work/skills`, `~/.claude-personal/skills`) —
  symlinks are directory-level, so new files inside the skill folder are
  picked up automatically.

## Git workflow

- Branch: `advisor/024-skill-lazy-splits`
- One commit per skill:
  `refactor(claude-skills): humanizer lazy split — rules inline, examples in references`
  (and analogous for the other two; the printing-press-publish message must
  note "diverges from upstream; redo after upstream sync"). No AI footers. Do NOT push.

## Steps

### Step 1: humanizer — move EXAMPLES, keep every rule

Create `tooling/claude-skills/humanizer/references/pattern-examples.md` and
`references/full-example.md`.

- For **each numbered pattern section (1–29)**: keep in SKILL.md the heading,
  the rule prose, and any hard directives (e.g. the em-dash ban wording,
  "NEVER/ALWAYS" lines). Move ONLY the Before/After example pairs to
  `pattern-examples.md`, under identical headings (`### 14. Em Dashes` etc.).
- Move `## Full Example` (whole section) to `full-example.md`.
- Keep inline and UNCHANGED: `## Your Task`, both Modes, `## Voice Calibration`,
  `## PERSONALITY AND SOUL` (incl. its short before/after — it's load-bearing
  voice guidance, not pattern illustration), `## Process`, `## Output Format`,
  `## Reference`.
- Immediately after the `## CONTENT PATTERNS` heading, insert:
  ```
  > Before/after examples for every pattern live in
  > [references/pattern-examples.md](references/pattern-examples.md) — read it
  > when a pattern's rule alone is ambiguous, or when writing long-form or
  > high-stakes copy. A complete worked rewrite is in
  > [references/full-example.md](references/full-example.md).
  ```

**Verify**:
`wc -c tooling/claude-skills/humanizer/SKILL.md` → between 12,000 and 18,000
bytes, AND
`grep -c '^### ' tooling/claude-skills/humanizer/SKILL.md` → still shows all
pattern headings present (29 numbered patterns + the handful of non-numbered
`###` subsections that existed before — count them before you start and match).

### Step 2: notebooklm — move reference matter, keep operating core

Create `references/setup.md`, `references/workflows.md`, `references/reference.md`.

- Move to `setup.md`: `## Installation`, `## Prerequisites` (+ its CI/CD
  subsection), `## Agent Setup Verification`.
- Move to `workflows.md`: `## Common Workflows` (all 4 subsections),
  `## Features Beyond the Web UI`, `## Generation Types`.
- Move to `reference.md`: `## Command Output Formats`, `## Exit Codes`,
  `## Known Limitations`, `## Language Configuration`, `## Troubleshooting`,
  `## Long Prompts`.
- Keep inline: `## When This Skill Activates`, `## Autonomy Rules`,
  `## Quick Reference`, `## Output Style`, `## Error Handling`.
- At the top of the body add a short map:
  ```
  ## Read on demand
  - First run / broken install → references/setup.md
  - Building a podcast/artifact flow → references/workflows.md
  - Parsing output, exit codes, limits, languages, troubleshooting → references/reference.md
  ```

**Verify**: `wc -c tooling/claude-skills/notebooklm/SKILL.md` → under 15,000
bytes; `ls tooling/claude-skills/notebooklm/references/` → 3 files.

### Step 3: printing-press-publish — phase split (mirror the printing-press pattern)

Create `references/steps-1-4-validate.md` (Steps 1, 2, 3, 4, 4.5),
`references/steps-5-6-package.md` (Steps 5, 6, 6.5, 6.6),
`references/steps-7-8-pr.md` (Steps 7, 8, After the PR opens),
`references/pii-protection.md` (`## Secret & PII Protection`).

- Move each listed section VERBATIM (no rewording — this skill's shell
  snippets are load-bearing).
- Keep inline: the title, `## Direct User Invocation Required`, `## Setup`,
  `## Configuration`, `## Error Handling`, plus a **mandatory-read step map**
  in the style of `tooling/claude-skills/printing-press/SKILL.md` (open that
  file and copy its map's framing): each phase entry says when to read which
  reference file, and states that reading the phase file before executing that
  phase is REQUIRED, not optional.
- Add one line at the top of the body: `> NOTE: this split diverges from
  upstream mvanhorn/printing-press — redo it if an upstream update overwrites
  this skill (see decisions.md 2026-07-04 for the precedent).`

**Verify**: `wc -c tooling/claude-skills/printing-press-publish/SKILL.md` →
under 15,000 bytes; combined bytes of SKILL.md + references ≥ 55,000 (nothing
deleted, only moved).

### Step 4: cross-checks

**Verify** (all three skills):
- `head -5 <skill>/SKILL.md` → frontmatter unchanged vs `git diff` (only body edits).
- `git diff --stat` shows no files outside the three skill folders.
- Every `references/*.md` file you created is referenced by exact filename
  somewhere in its SKILL.md body: for each skill,
  `for f in tooling/claude-skills/<name>/references/*.md; do grep -q "$(basename $f)" tooling/claude-skills/<name>/SKILL.md || echo "UNREFERENCED: $f"; done`
  → no output.

## Test plan

Content-preservation audit per skill (this replaces behavior testing, which
isn't possible offline): build a heading inventory before and after —
`grep -E '^#{1,3} ' SKILL.md` pre-change (save to /tmp), then post-change run
the same grep across SKILL.md + references/*.md combined and diff the two
lists. Expected: identical heading sets (plus the new "Read on demand"/map
headings, minus nothing).

## Done criteria

- [ ] humanizer SKILL.md 12–18KB; all 29 pattern rules still inline; examples in references/
- [ ] notebooklm SKILL.md <15KB; 3 reference files, each linked from the body
- [ ] printing-press-publish SKILL.md <15KB; 4 reference files; mandatory-read map present; upstream-divergence note present
- [ ] Heading-inventory diff per skill: no heading lost
- [ ] `git status` clean outside the three skill folders (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A skill's live section inventory doesn't match the ones listed above.
- You find yourself REWRITING prose rather than MOVING it — this plan moves
  sections verbatim; if a section seems to need rewording to survive the
  split, stop and report which one.
- Any verify target is missed by more than ~20% and hitting it would require
  moving content this plan says must stay inline.

## Maintenance notes

- decisions.md should eventually record this split (the reviewer/owner will
  append it — executors don't edit decisions.md).
- Same treatment is available for `printing-press-polish` (65KB body, has
  references already) — deferred, listed in the plans/README backlog.
- After an upstream printing-press sync, re-check `printing-press-publish` for
  an overwritten split.
