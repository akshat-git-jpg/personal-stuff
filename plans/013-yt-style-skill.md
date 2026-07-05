# Plan 013: yt-style skill — distill Style DNA, generate topics/titles/scripts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3363123..HEAD -- tooling/claude-skills/yt-style/ tooling/claude-skills/manifest/personal.txt`
> (expect: no output — neither path may exist/have drifted yet. Plan 012's
> changes elsewhere in the tree are expected and fine.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 012 (the skill reads the style-pack folder 012 creates)
- **Category**: feature
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `3363123`, 2026-07-05

## Why this matters

Plan 012 gives each competitor channel a style pack of raw transcripts. This
plan adds the intelligence layer: a user-invocable Claude Code skill,
`yt-style`, that (a) **distills** a pack's transcripts once into a compact
Style DNA profile + a fidelity rubric + exemplar picks, and (b) **generates**
topic suggestions, titles, and full scripts in that channel's exact voice by
loading only the DNA + exemplars — never the raw corpus. That one-time
distillation is the whole cost/quality trick of the approved architecture:
expensive read once per channel, cheap consistent generation forever after.
The skill content below is the deliverable — the executor's job is exact
placement and registration, not authoring.

## Current state

- Custom skills live in `tooling/claude-skills/<name>/SKILL.md` — single
  source for both Claude accounts. Exemplar for shape and frontmatter:
  `tooling/claude-skills/dsa-coach/SKILL.md`, whose frontmatter is:

  ```yaml
  ---
  name: dsa-coach
  description: DSA learning workflow for learning/DSA in personal-stuff. … Triggers on "explain <dsa topic>", …
  user-invocable: true
  metadata:
    author: kbtg
    version: 1.0.0
  ---
  ```

- Membership is manifest-driven: `tooling/claude-skills/manifest/personal.txt`
  is a plain list, one skill folder name per line (currently ends with
  `dsa-coach`). A name present only in `personal.txt` links the skill into the
  personal account only. `scripts/relink.sh` (repo root) rebuilds symlinks
  into `~/.claude-personal/skills/` from the manifests and prunes removals;
  it is idempotent.
- Skill discovery is cached per session — changes appear only after the Claude
  session is restarted. (Verification below therefore checks the symlink, not
  live discovery.)
- `tooling/claude-skills/yt-style/` does not exist yet.
- The data this skill operates on is `pipelines/youtube/competitor-styles/`
  (created by Plan 012): per-channel packs at `channels/<slug>/` containing
  `channel.json`, `videos.json`, `transcripts/*.md` (frontmatter: id, title,
  views, upload_date, duration, url), `exemplars/`, `output/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Relink skills | `./scripts/relink.sh` (from repo root) | exits 0; prints sync summary |
| Confirm link | `readlink ~/.claude-personal/skills/yt-style` | a path ending in `tooling/claude-skills/yt-style` |
| Frontmatter sanity | `head -8 tooling/claude-skills/yt-style/SKILL.md` | the YAML block from Step 1 |

## Scope

**In scope** (the only files to create or touch):
- `tooling/claude-skills/yt-style/SKILL.md` — new
- `tooling/claude-skills/manifest/personal.txt` — append one line
- `plans/README.md` — status cell for this plan only

**Out of scope** (do NOT touch):
- `tooling/claude-skills/manifest/work.txt` — personal-account skill only.
- `scripts/relink.sh` — run it, never edit it.
- `pipelines/youtube/competitor-styles/` — Plan 012's territory; the skill
  only references it.
- Any other skill folder; any file with pre-existing uncommitted changes.

## Git workflow

- Branch: `advisor/012-competitor-styles` (continue on Plan 012's branch; do
  not create a new one).
- Stage files **by explicit path only — never `git add -A`** (the tree holds
  unrelated uncommitted changes).
- Commit: `feat(claude-skills): add yt-style competitor style-cloning skill` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the skill file

Create `tooling/claude-skills/yt-style/SKILL.md` with exactly this content:

````markdown
---
name: yt-style
description: Clone a competitor YouTube channel's script style from its style pack in pipelines/youtube/competitor-styles/. Verbs — distill a channel into a Style DNA profile; generate topic suggestions, title variants, or a full script in that channel's exact voice. Triggers on "yt-style", "distill <channel>", "clone <channel>'s style", "topics for <channel>", "titles like <channel>", "script this in <channel>'s style".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# yt-style — competitor style cloning

All data lives in style packs: `pipelines/youtube/competitor-styles/channels/<slug>/`
(layout in that folder's CLAUDE.md). Route on the verb; if the verb or slug is
missing, list `channels/` and ask which channel + verb in one question.

Never load the whole transcript corpus for generation — that is exactly what
the DNA exists to avoid. Generation verbs read ONLY `style-dna.md`,
`rubric.md`, `exemplars/`, and (for topics) `videos.json`.

## ingest <channel-url>

Not an LLM task. Tell the user to run (or run for them):

    python3 pipelines/youtube/competitor-styles/ingest.py <channel-url> --limit 30

Re-running later picks up new uploads. Then suggest `distill` if
`style-dna.md` doesn't exist yet.

## distill <slug>

The one expensive session per channel. Requires `transcripts/` to be non-empty.

1. Read `channel.json` + `videos.json`. Compute the median view count and note
   every video ≥ 2× median (the outliers).
2. Read ALL transcripts in batches of ~8. After each batch, append raw
   observations to `distill-notes.md` in the pack (hooks seen verbatim,
   structure beats, recurring phrases, pacing impressions, CTA moments).
   Don't polish; capture evidence with video ids.
3. Synthesize `style-dna.md` with EXACTLY these sections (all required —
   every claim backed by at least one verbatim example with its video id):
   - **Identity snapshot** — ≤5 lines: format(s), audience, energy, POV.
   - **Hook formulas** — each distinct opening pattern, 2 verbatim examples
     each, typical hook length in words/seconds.
   - **Structure map** — beat-by-beat skeleton per format they use, with
     rough % of runtime per beat.
   - **Pacing & rhythm** — words-per-minute estimate (words ÷ duration from
     frontmatter), sentence-length habits, question frequency, repetition
     devices.
   - **Language fingerprint** — recurring phrases and verbal tics (verbatim),
     vocabulary level, contractions/slang habits, words they NEVER use.
   - **Transitions & retention devices** — how sections connect; open loops,
     callbacks, pattern interrupts, with examples.
   - **CTA style** — when and how they ask (sub/like/links/product), verbatim.
   - **Title patterns** — cluster their titles into named patterns with
     examples; flag which patterns the outliers use.
   - **Topic performance** — median views; the outlier list with a one-line
     "what it shares with other outliers"; visibly under-explored adjacent
     topics.
   - **Do-not list** — things this channel never does (so a clone won't).
4. Write `rubric.md`: 12–15 binary pass/fail checks derived from the DNA,
   each check quoting the DNA section it enforces (e.g. "Hook is ≤25 words
   and uses one of the 3 hook formulas"). This is the QC gate for `script`.
5. Pick exemplars into `exemplars/` (copy the full transcript files):
   one top outlier, one maximally typical video, and — if the channel runs
   multiple formats — one of the format the owner most wants to make.
   State the picks + one-line reasons at the top of `rubric.md`.
6. Delete `distill-notes.md`. Report: DNA sections written, rubric check
   count, exemplar picks.

Refresh policy: re-run distill only when the pack gains ~10+ new transcripts
or the channel visibly changed style; it overwrites DNA/rubric (git holds
history).

## topics <slug>

Load `style-dna.md` (Topic performance + Title patterns) and `videos.json`.
Produce 10 topic suggestions this channel would plausibly make next but
hasn't: each with (a) one-line rationale grounded in their outliers, (b) the
format it fits, (c) 2 title variants using their named title patterns.
Append as a dated section to `output/topics.md` (create if missing).

## titles <slug> "<topic>"

Load `style-dna.md` (Title patterns). Produce 8 title variants for the topic,
each labeled with the pattern it uses; mark the 2 the outlier data favors.
Print in chat; no file write unless asked.

## script <slug> "<topic>"

Loads `style-dna.md`, `rubric.md`, and every file in `exemplars/`. Output dir:
`output/scripts/<topic-kebab-slug>/`. Target length: the channel's median
video duration × the DNA's words-per-minute (state the computed word target
before writing).

- **Pass 1 — outline.** Write `outline.md`: the hook fully drafted (not
  summarized), then each structure-map beat with 1-2 lines of planned content
  and a word budget. STOP and wait for explicit approval. Do not start the
  script in the same reply.
- **Pass 2 — full script.** Only after approval. Write `script.md` in the
  channel's exact voice — spoken lines only, no camera directions unless the
  channel's own scripts imply them. Any factual claim you cannot verify from
  the conversation gets a `[VERIFY: …]` placeholder rather than an invented
  fact.
- **Pass 3 — QC (same session, automatic).** Score the draft against every
  `rubric.md` check. Revise the script until every check passes or the misses
  are genuinely inapplicable. Append a scorecard to the bottom of `script.md`
  as an HTML comment (`<!-- rubric: 14/15 pass; #7 n/a because … -->`).

## Guardrails

- Style is cloned; facts are not. Never copy a competitor's specific claims,
  numbers, or sponsor reads into a generated script.
- One channel per invocation — no blending styles unless explicitly asked.
- If `style-dna.md` is missing for the requested slug, run `distill` first
  (confirm with the user — it's the expensive step).
````

**Verify**: `head -8 tooling/claude-skills/yt-style/SKILL.md` → shows the YAML frontmatter starting `---` / `name: yt-style`.

### Step 2: Register in the personal manifest

Append `yt-style` on its own line at the end of
`tooling/claude-skills/manifest/personal.txt` (personal account only — do not
touch `work.txt`).

**Verify**: `tail -2 tooling/claude-skills/manifest/personal.txt` → last non-empty line is `yt-style`.

### Step 3: Relink and confirm the symlink

From the repo root run `./scripts/relink.sh`.

**Verify**: `readlink ~/.claude-personal/skills/yt-style` → prints a path ending `tooling/claude-skills/yt-style`; and `test -f ~/.claude-personal/skills/yt-style/SKILL.md && echo OK` → `OK`.

## Test plan

Manual verification only (owner convention). Structural checks above prove
placement + registration. The skill's behavioral test is owner-driven after a
session restart: ingest a real competitor (Plan 012 tool), run
`/yt-style distill <slug>`, and judge `style-dna.md` against its required
section list — that list plus `rubric.md` **is** the acceptance rubric for
generated output, by design.

## Done criteria

- [ ] `tooling/claude-skills/yt-style/SKILL.md` exists with the exact frontmatter above (`name: yt-style`, `user-invocable: true`)
- [ ] `grep -x "yt-style" tooling/claude-skills/manifest/personal.txt` exits 0; `grep yt-style tooling/claude-skills/manifest/work.txt` exits 1
- [ ] `readlink ~/.claude-personal/skills/yt-style` resolves into the repo skill folder
- [ ] Commit touches only the two in-scope repo files (+ README status cell); unrelated uncommitted changes untouched

## STOP conditions

- `scripts/relink.sh` fails or reports pruning skills you didn't touch → stop
  and report; do not edit the script or the work manifest.
- `~/.claude-personal/skills/yt-style` already exists as a real directory (not
  a symlink) → stop and report; never overwrite non-symlink content there.
- Anything requires editing files under `pipelines/` → stop; that's Plan 012's
  scope and it should already be done.

## Maintenance notes

- SKILL.md hardcodes the pack layout from Plan 012's
  `competitor-styles/CLAUDE.md`; the two must change together.
- The required-section list in `distill` doubles as the quality rubric for the
  whole system — tightening output quality starts there, not in the verbs.
- If the owner later wants the RAG topic-research index (decisions.md
  2026-07-05), it slots in as a new verb without touching the existing ones.
