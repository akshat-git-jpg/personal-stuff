# Plan 036: `/plan-review` — visual pre-dispatch plan review (lavish-axi + our skill)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- .claude/skills/plan-review/ CLAUDE.md`
> (Changes from plans 033–035 under `tooling/cli/` and one CLAUDE.md row are
> expected. Anything else: STOP.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 033–035)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

The single human gate in the orchestrate workflow is pre-dispatch plan review
— the highest-leverage moment in the pipeline, currently served by reading
200-line markdown files in a terminal. This skill renders a `plans/NNN-*.md`
file as an interactive HTML page in the browser: sections laid out, the
load-bearing decisions as clickable approve/change cards, risks highlighted,
and annotations on exact spots flowing back to the session — using
`lavish-axi` (npm, MIT, local-only server, by kunchenguid) as the transport
(owner decision 2026-07-06: adopt the transport, build our skill layer).
**On-command only**: the skill runs when invoked, never automatically.

## Current state

- Repo-operating skills live in `.claude/skills/<name>/SKILL.md` (NOT
  `tooling/claude-skills/` — that's for cross-repo skills). Exemplar to match
  for tone/structure: `.claude/skills/personal-stuff-change-control/SKILL.md`.
  Skill descriptions must be ≤500 chars (house rule).
- Plan files follow `plans/_TEMPLATE.md`: sections `Status`, `Why this
  matters`, `Current state`, `Commands you will need`, `Scope`, `Git
  workflow`, `Steps` (each with **Verify**), `Test plan`, `Done criteria`,
  `STOP conditions`, `Maintenance notes`.
- lavish-axi usage contract (verified from its skill + source 2026-07-06):
  - Write HTML to a file, then `npx -y lavish-axi <file>` opens the browser.
  - `npx -y lavish-axi poll <file>` long-polls for feedback (leave running;
    stdout stays pure JSON; heartbeat spaces keep it alive). Response carries
    `prompts: [{uid, prompt, selector, tag, text, target?}]` + `dom_snapshot`
    + `next_step`.
  - Reply mid-loop with `npx -y lavish-axi poll <file> --agent-reply "<msg>"`;
    finish with `npx -y lavish-axi end <file>`.
  - Decision widgets: a `<form data-lavish-question="<key>">` with radio
    labels and a submit button calling
    `window.lavish.queuePrompt('<natural sentence>', {tag:'choice',
    data:{question:'<key>', answer: choice}})` — one queued answer per
    question, replace-on-requeue.
  - Native inputs are interactive automatically; the artifact must be
    self-contained (no external design system injected by lavish).
- Media policy: generated HTML goes to `~/kb-scratch/plan-review/` (outside
  the repo), gitignored by location.
- Node/npx are installed (node v22).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| lavish available | `npx -y lavish-axi --help` | exit 0, usage text |
| Skill discovery | `./scripts/skills-status.sh` | table includes `plan-review`, exit 0 |

## Scope

**In scope**:
- `.claude/skills/plan-review/SKILL.md` (new)
- `.claude/skills/plan-review/references/artifact-template.md` (new — the
  HTML authoring guide)
- `CLAUDE.md` (one routing row)

**Out of scope**:
- `plans/WORKFLOW.md`, the orchestrate skill (they may later reference
  /plan-review; not this plan's job), anything under `tooling/`.

## Git workflow

- Branch: `advisor/036-plan-review`
- Commit: `feat(skills): /plan-review visual plan gate` — no AI footers. Do NOT push.

## Steps

### Step 1: SKILL.md

Frontmatter description (≤500 chars): triggers on "/plan-review",
"plan review", "review the plans visually", "open the plan gate". Body
workflow the skill instructs the session to follow:

1. Resolve target plan file(s): explicit path argument, else every
   `plans/NNN-*.md` with status TODO in `plans/README.md`.
2. For each plan, generate `~/.../plan-review/<NNN>.html` (expand `~` to
   `$HOME/kb-scratch`) following `references/artifact-template.md`.
3. `npx -y lavish-axi <file>` then `npx -y lavish-axi poll <file>` — leave
   the poll running; never kill it; obey the `next_step` field.
4. On feedback: apply annotation comments and decision answers as EDITS to
   the plan file (decisions become facts in the plan body; annotated
   corrections rewrite the anchored section), then `--agent-reply` a one-line
   summary of what changed, regenerate the HTML if edits were substantial.
5. On `end`/owner-closed session: report per plan — decisions taken,
   sections changed, anything still open.

Rules to state: on-command only; the HTML is disposable (kb-scratch), the
plan file is the source of truth; never dispatch executors from this skill
(that's orchestrate's job).

**Verify**: `test -s .claude/skills/plan-review/SKILL.md` and description
line count ≤ 500 chars (`awk` the frontmatter description length).

### Step 2: The artifact template reference

`references/artifact-template.md` — authoring guide the session follows when
generating the HTML. Specify exactly:

- Self-contained single file: inline CSS, no external fetches, system font
  stack, light background; readable at 900px width.
- Page structure mirroring the plan: header strip (plan number/title +
  Status fields as badges — priority/effort/risk/executor/difficulty), then
  sections in order: Why (prose), Current state (collapsible `<details>`),
  Scope (two columns in/out), Steps (numbered cards, each showing its
  **Verify** line in monospace), Done criteria (checklist), STOP conditions
  (amber panel), Maintenance (collapsible).
- **Decision cards**: for each load-bearing decision the plan already makes
  (the session identifies 2–5 while reading: chosen approach, risky defaults,
  scope cuts), render a `<form data-lavish-question="<slug>">` card titled
  with the decision, radio options `Approve as planned` /
  `Change (explain in an annotation)`, and a `Queue answer` submit button
  wired exactly as the lavish contract in Current state specifies.
- **Risk panel**: the plan's Risk level + STOP conditions + any line
  containing "push", "merge", "delete", "deploy" quoted verbatim in a
  distinct panel at the top — the reviewer must see destructive surface
  first.
- No JS beyond the queuePrompt wiring; no external libraries.

**Verify**: `grep -c "data-lavish-question" .claude/skills/plan-review/references/artifact-template.md` ≥ 1

### Step 3: Routing row + smoke test

Add to root `CLAUDE.md` "Find it fast": `| Visual plan review before dispatch
| .claude/skills/plan-review/SKILL.md |` (match table style). Smoke test:
`npx -y lavish-axi --help` exits 0; generate a sample HTML for
`plans/033-worktree-pool-manager.md` by hand-following the template (this
validates the template is followable — you, the executor, are the first
consumer), save to `~/kb-scratch/plan-review/033.html`, and verify it parses:
`python3 -c "import html.parser,sys; p=html.parser.HTMLParser(); p.feed(open('$HOME/kb-scratch/plan-review/033.html').read()); print('OK')"` → `OK`.
Do NOT open the browser or start poll loops (headless executor).

**Verify**: the python parse prints `OK`; `./scripts/skills-status.sh` exit 0.

## Test plan

Template-followability is tested by Step 3's hand-generated artifact. The
live browser loop is verified by the orchestrator/owner on first real use
(needs a human + browser).

## Done criteria

- [ ] SKILL.md + artifact-template.md exist, description ≤500 chars
- [ ] Sample 033 artifact generated and parses as HTML
- [ ] CLAUDE.md routing row present
- [ ] `./scripts/skills-status.sh` exit 0

## STOP conditions

- `npx -y lavish-axi --help` fails (network/registry) — STOP, report; do not
  vendor the package.
- The skill would need to run automatically anywhere — STOP; on-command only
  is an owner decision.

## Maintenance notes

- If lavish-axi's CLI contract changes upstream, `references/` is the only
  place tracking it — re-verify `poll`/`--agent-reply`/`end` semantics on
  version bumps (`npx -y` always pulls latest).
- Orchestrate's Step 4b human gate can later say "offer /plan-review" — one
  line there, deliberately not part of this plan.
